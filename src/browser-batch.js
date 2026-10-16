'use strict';

/**
 * The batch driver for the browser path: mint `--target` verified keys, one
 * account each, sequentially (a shared egress line — WARP — must not carry two
 * sign-ups at once).
 *
 * State is on disk and appended per account, so a run can be cut anywhere and
 * restarted: `keys.txt` (one verified key per line), `accounts.json` (the
 * records), `browser-pending.json` (accounts that signed in but whose key mint
 * failed — their only key is never thrown away, the mint is retried first),
 * `browser-accounts.jsonl` (one timing/verdict line per attempt),
 * `browser-models-probe.jsonl` (the /v1/models cohort: baselines, each fresh
 * key's status, and age-tagged re-probes).
 *
 * Verification is a chat completion, not `GET /v1/models`: a key minted for a
 * brand-new account meets an AWS-WAF challenge (202) on the listing route while
 * serving `/v1/chat/completions` 200. Accounts listed in `--skip-profile-for`
 * deliberately leave the onboarding profile form empty, so the batch measures
 * whether filling it is what clears that 202.
 *
 * CLI:
 *   node src/browser-batch.js --target 30 --per-run 5 \
 *        [--warp socks5://127.0.0.1:40000] [--broker http://127.0.0.1:9700] \
 *        [--pool proxies.txt] [--max-failures 5] \
 *        [--skip-profile-for 15,16] [--code-timeout 180000]
 *
 * `--pool-browser <file>` makes pool lines the primary egress (a dead pick is
 * buried at once) and WARP the fallback when none answers — the shared-exit
 * policy: pool first, WARP for rescue.
 */

const fs = require('fs');
const path = require('path');

const { createAccountViaBrowser } = require('./browser-signup');
const { createKey, verifyKey, KEY_RE } = require('./account');
const { CookieJar, fetchUrl } = require('./http');
const { makeInbox } = require('./inbox');
const { parseProxy, loadProxyList, label } = require('./proxy');

const HERE = path.resolve(__dirname, '..'); // data root (the repo root)
const ROOT = HERE; // a relative --pool / --log resolves from the data root

const files = {
  keys: path.join(HERE, 'keys.txt'),
  accounts: path.join(HERE, 'accounts.json'),
  pending: path.join(HERE, 'browser-pending.json'),
  jsonl: path.join(HERE, 'browser-accounts.jsonl'),
  log: path.join(HERE, 'browser-batch.log'),
  modelsProbe: path.join(HERE, 'browser-models-probe.jsonl'),
  chromeState: path.join(HERE, 'outputs', 'bt-chrome-live.json'),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

// ------------------------------------------------------------------ file state

function readLines(file) {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function appendLine(file, line) {
  fs.appendFileSync(file, line + '\n');
}

// ----------------------------------------------------------------------- chrome

/** A killed run can leave one Chrome behind; the state file names it. */
function reapStrayChromes(log) {
  const state = readJson(files.chromeState, null);
  if (!state || !state.pid) return;
  try {
    const { spawnSync } = require('child_process');
    spawnSync('taskkill', ['/PID', String(state.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    log(`reaped stray chrome pid ${state.pid} (port ${state.port})`);
    fs.rmSync(files.chromeState, { force: true });
  } catch (e) {
    /* best effort */
  }
}

// -------------------------------------------------------------------- the run

function parseArgs(argv) {
  const args = {
    target: 30,
    perRun: Infinity,
    warp: 'socks5://127.0.0.1:40000',
    broker: 'http://127.0.0.1:9700',
    pool: null,
    poolBrowser: null,
    maxFailures: 5,
    codeTimeoutMs: 180000,
    skipProfileFor: new Set(),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') args.target = parseInt(argv[++i], 10);
    else if (a === '--per-run') args.perRun = parseInt(argv[++i], 10);
    else if (a === '--warp') args.warp = argv[++i];
    else if (a === '--broker') args.broker = argv[++i];
    else if (a === '--pool') args.pool = argv[++i];
    else if (a === '--pool-browser') args.poolBrowser = argv[++i];
    else if (a === '--max-failures') args.maxFailures = parseInt(argv[++i], 10);
    else if (a === '--code-timeout') args.codeTimeoutMs = parseInt(argv[++i], 10);
    else if (a === '--skip-profile-for') args.skipProfileFor = new Set(argv[++i].split(',').map((n) => parseInt(n, 10)).filter(Boolean));
  }
  return args;
}

/**
 * A rotating browser-egress queue over a pool file: the file is re-read so new
 * survivors can land mid-run, a line that fails is struck for the rest of the
 * run, and an exhausted queue waits for a refill instead of giving up.
 */
function makeLineQueue(file, log) {
  const queue = [];
  const struck = new Set();
  const seen = new Set();
  const refill = () => {
    let added = 0;
    for (const line of readLines(file)) {
      if (seen.has(line)) continue;
      seen.add(line);
      if (struck.has(line)) continue;
      queue.push(line);
      added++;
    }
    return added;
  };
  refill();
  log(`line queue: ${queue.length} fresh line(s) from ${file}`);
  return {
    get size() {
      return queue.length;
    },
    pick() {
      refill();
      return queue.shift() || null;
    },
    strike(line) {
      if (!line) return;
      struck.add(line);
      log(`struck line ${line.slice(0, 44)} (${struck.size} total)`);
    },
    async waitForRefill(ms = 90000) {
      const deadline = Date.now() + ms;
      while (Date.now() < deadline) {
        await sleep(10000);
        if (refill() > 0) return true;
      }
      return false;
    },
  };
}

/** A cheap pre-flight on the flow's own first request, so Chrome is never
 *  launched onto a line that is already dead. Two attempts, as measured. */
async function probeLine(line, log) {
  const p = parseProxy(line);
  if (!p) return false;
  p.connectTimeoutMs = 8000;
  p.timeoutMs = 20000;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetchUrl('https://login.baseten.co/', { proxy: p, timeoutMs: 20000, follow: false });
      if (r.status >= 200 && r.status < 400) return true;
    } catch (e) {
      /* retry once */
    }
  }
  log(`line ${line.slice(0, 44)} does not answer login.baseten.co — skipped`);
  return false;
}

async function main() {
  const args = parseArgs(process.argv);
  const logFile = files.log;
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = (m) => {
    const line = `${nowIso().slice(11, 19)} ${m}`;
    console.log(line);
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch (e) {
      /* logging must not kill the run */
    }
  };

  reapStrayChromes(log);

  // ----------------------------------------------- the /v1/models cohort probe
  // Measured 2026-10-14: `GET /v1/models` answers a plain 401 without a key,
  // 200 for keys of the older cohort, and an AWS-WAF *challenge* (202, empty
  // body, `x-amzn-waf-action: challenge`) for keys minted for brand-new
  // accounts — same key and same line, while `POST /chat/completions` serves
  // 200. These probes record the cohort each fresh key lands in and watch
  // whether the challenge clears with account age.
  const warpProxy = () => parseProxy(args.warp);
  const probeRecord = (rec) => {
    try {
      fs.appendFileSync(files.modelsProbe, JSON.stringify({ at: nowIso(), ...rec }) + '\n');
    } catch (e) {
      /* diagnostics only */
    }
  };

  /** Account keys whose /v1/models was not 200, re-probed one per round. */
  const rechecks = [];
  const recheckModels = async () => {
    if (!rechecks.length) return;
    const item = rechecks.shift();
    const c = await verifyKey(item.key, { proxy: warpProxy(), timeoutMs: 25000, modelsOnly: true });
    const ageMin = Math.round((Date.now() - item.createdAt) / 60000);
    probeRecord({ kind: 'recheck', email: item.email, key: item.key.slice(0, 8), ageMin, modelsStatus: c.modelsStatus, tries: item.tries + 1 });
    log(`recheck ${item.email}: /v1/models -> ${c.modelsStatus} at ${ageMin} min old`);
    if (c.modelsStatus !== 200 && item.tries < 5) rechecks.push({ ...item, tries: item.tries + 1 });
  };

  const pool = args.pool
    ? loadProxyList(path.resolve(ROOT, args.pool))
        .map((l) => parseProxy(l))
        .filter(Boolean)
    : [];

  const readState = () => {
    const keys = readLines(files.keys).filter((k) => KEY_RE.test(k));
    const accounts = readJson(files.accounts, []);
    const pending = readJson(files.pending, []);
    return { keys, accounts, pending };
  };

  let { keys, accounts, pending } = readState();
  log(
    `batch start: ${keys.length}/${args.target} verified keys on disk, ` +
      `${pending.length} pending mint(s), egress ${args.warp}, pool ${pool.length} lines`
  );

  try {
    const noauth = await fetchUrl('https://inference.baseten.co/v1/models', { proxy: warpProxy(), timeoutMs: 25000 });
    probeRecord({ kind: 'baseline-noauth', modelsStatus: noauth.status });
    log(`baseline: /v1/models without a key -> ${noauth.status}`);
  } catch (e) {
    probeRecord({ kind: 'baseline-noauth', error: String(e.message).slice(0, 120) });
  }
  const cohortKey = readLines(path.join(HERE, 'keys.single-account.bak'))[0];
  if (cohortKey && KEY_RE.test(cohortKey)) {
    const c = await verifyKey(cohortKey, { proxy: warpProxy(), timeoutMs: 25000, modelsOnly: true });
    probeRecord({ kind: 'baseline-old-cohort', key: cohortKey.slice(0, 8), modelsStatus: c.modelsStatus });
    log(`baseline: /v1/models with an old-cohort key (${cohortKey.slice(0, 8)}…) -> ${c.modelsStatus}`);
  }

  let failures = 0;
  let minted = 0;
  let index = accounts.length + 1;

  /** Account records whose key mint is pending get their key minted here, on
   *  the cookies the browser already produced — no new sign-up involved. */
  const retryPending = async () => {
    if (!pending.length) return 0;
    const still = [];
    let got = 0;
    for (const p of pending) {
      const jar = new CookieJar(p.sessionCookies || []);
      if (!jar.get('sessionid')) {
        log(`pending ${p.email}: no sessionid in the saved cookies — dropping`);
        continue;
      }
      try {
        let key = p.key;
        let prefix = p.prefix;
        let keyId = p.keyId;
        if (!key) {
          const created = await createKey({ jar, proxy: parseProxy(args.warp), timeoutMs: 45000, keyName: p.keyName || 'baseten-bulk' });
          key = created.key;
          prefix = created.prefix;
          keyId = created.id;
          log(`pending ${p.email}: key ${prefix}… minted late`);
        }
        const check = await verifyKey(key, { proxy: warpProxy(), timeoutMs: 35000 });
        if (!check.ok)
          throw new Error(`verify -> models ${check.modelsStatus == null ? '-' : check.modelsStatus} · ${check.error || check.chatStatus || '-'}`);
        appendLine(files.keys, key);
        keys = [...keys, key];
        accounts = [
          ...accounts,
          {
            email: p.email,
            key,
            prefix,
            keyId,
            verified: true,
            models: check.models,
            verifiedVia: check.via,
            modelsStatus: check.modelsStatus == null ? null : check.modelsStatus,
            profileSubmitted: p.profileSubmitted === undefined ? null : !!p.profileSubmitted,
            recoveredAt: nowIso(),
            keyName: p.keyName || null,
          },
        ];
        writeJson(files.accounts, accounts);
        appendLine(files.jsonl, JSON.stringify({ at: nowIso(), email: p.email, ok: true, recovered: true, ms: null }));
        log(`pending ${p.email}: recovered (${keys.length}/${args.target})`);
        got++;
      } catch (e) {
        still.push({ ...p, key, prefix, keyId, lastError: String(e.message).slice(0, 200), retriedAt: nowIso() });
        log(`pending ${p.email}: still failing — ${String(e.message).slice(0, 120)}`);
      }
      await sleep(500);
    }
    pending = still;
    writeJson(files.pending, pending);
    return got;
  };

  await retryPending();

  const lineQueue = args.poolBrowser ? makeLineQueue(path.resolve(ROOT, args.poolBrowser), log) : null;

  while (keys.length < args.target && minted < args.perRun && failures < args.maxFailures) {
    await recheckModels();
    const i = index++;
    minted++;
    const skipProfile = args.skipProfileFor.has(i);
    const keyName = `baseten-bulk-${Date.now().toString(36)}-${i}`;
    log(
      `── account ${i}: creating (${keys.length}/${args.target} verified, ${failures} consecutive failures)` +
        (skipProfile ? ' [control: profile form left empty]' : '')
    );
    const startedAt = Date.now();
    let box = null;
    let r = null;
    let failure = null;
    try {
      // one mailbox per account, reused across egress retries (a dead line must
      // not burn a box — boxes are the scarce shared resource)
      if (!box) {
        const folder = process.env.BT_MAIL_FOLDER || 'baseten-v2-bulk';
        // Direct Mailtrap first: the broker's /list and /read ride its own
        // proxy chain, which timed out twice in a row mid-run (18:45Z) and
        // starved account 2 of its code; this line reaches Mailtrap fine (the
        // capacity cleaner just walked 275 inboxes over it). The broker stays
        // the fallback for when no token is readable.
        const sources = [
          { provider: 'mailtrap', mailtrapFolder: folder, label: `mailtrap/${folder}` },
          { provider: 'broker', broker: args.broker, folder, label: `broker ${args.broker}` },
        ];
        let boxErr = null;
        for (const source of sources) {
          const inbox = makeInbox(source);
          const attempts = source.provider === 'mailtrap' ? 2 : 3;
          for (let attempt = 1; attempt <= attempts && !box; attempt++) {
            try {
              box = await inbox.create();
            } catch (e) {
              boxErr = e;
              log(`account ${i}: mailbox via ${source.label} attempt ${attempt} failed: ${String(e.message).slice(0, 110)}`);
              if (attempt < attempts) await sleep(3000 * attempt);
            }
          }
          if (box) {
            log(`account ${i}: mailbox ${box.address} via ${source.label}`);
            break;
          }
        }
        if (!box) throw new Error(`no mailbox source worked: ${boxErr && boxErr.message}`);
      }

      const maxAttempts = lineQueue ? 3 : 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let line = args.warp;
        if (lineQueue) {
          // Pool first, WARP as the fallback that keeps the flow alive
          // (shared-exit policy): pool entries die by the minute, so a pick
          // that cannot answer is buried at once, never waited for. At most a
          // handful of picks per attempt so a dead pool cannot stall the run.
          let pooled = null;
          for (let picks = 0; picks < 5 && !pooled; picks++) {
            const candidate = lineQueue.pick();
            if (!candidate) break;
            if (await probeLine(candidate, log)) pooled = candidate;
            else lineQueue.strike(candidate);
          }
          if (pooled) {
            line = pooled;
            log(`account ${i}: egress ${line.slice(0, 44)} (pool)`);
          } else {
            log(`account ${i}: no live pool line — falling back to ${args.warp}`);
          }
        }
        try {
          r = await createAccountViaBrowser({
            index: i,
            keyName,
            broker: args.broker,
            warp: line,
            pool,
            box,
            codeTimeoutMs: args.codeTimeoutMs,
            skipProfile,
            log,
          });
          break;
        } catch (e) {
          failure = e;
          const msg = String(e.message);
          const networkish =
            /timeout|ECONN|ECONNRESET|ETIMEDOUT|EPIPE|socket hang|tunnel|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|secureConnect|net::ERR|devtools|CDP timeout/i.test(
              msg
            ) || /sign-in page not reached|no e-mail field|no magic-code page|code not accepted/i.test(msg);
          if (lineQueue && attempt < maxAttempts && networkish) {
            log(`account ${i}: line died mid-flow (${msg.slice(0, 90)}) — retrying on the next line`);
            lineQueue.strike(line);
            if (e.record && e.record.sessionCookies) break; // session is good; do not re-sign a fresh flow
            continue;
          }
          throw e;
        }
      }
      if (!r) throw failure || new Error('no line attempt produced a record');

      appendLine(files.keys, r.key);
      keys = [...keys, r.key];
      accounts = [
        ...accounts,
        {
          email: r.email,
          key: r.key,
          prefix: r.prefix,
          keyId: r.keyId,
          verified: true,
          models: r.models,
          verifiedVia: r.verifiedVia || null,
          modelsStatus: r.modelsStatus == null ? null : r.modelsStatus,
          chatStatus: r.chatStatus == null ? null : r.chatStatus,
          profileFormSeen: r.profileFormSeen === undefined ? null : !!r.profileFormSeen,
          profileSubmitted: r.profileSubmitted === undefined ? null : !!r.profileSubmitted,
          keyName,
          egress: r.egress,
          createdAt: r.createdAt,
          durationMs: r.durationMs,
        },
      ];
      writeJson(files.accounts, accounts);
      appendLine(
        files.jsonl,
        JSON.stringify({
          at: nowIso(),
          email: r.email,
          ok: true,
          ms: r.durationMs,
          keyName,
          egress: r.egress || null,
          modelsStatus: r.modelsStatus == null ? null : r.modelsStatus,
          verifiedVia: r.verifiedVia || null,
          profileSubmitted: r.profileSubmitted === undefined ? null : !!r.profileSubmitted,
        })
      );
      if (r.modelsStatus !== 200) {
        rechecks.push({ email: r.email, key: r.key, createdAt: Date.parse(r.createdAt) || Date.now(), tries: 0 });
      }
      failures = 0;
      log(`account ${i}: OK — ${keys.length}/${args.target} verified (${(r.durationMs / 1000).toFixed(1)}s)`);
    } catch (e) {
      failures++;
      const rec = (failure && failure.record) || e.record || {};
      if (rec.sessionCookies && rec.email) {
        pending = [...pending, { ...rec, keyName, lastError: String(e.message).slice(0, 200) }];
        writeJson(files.pending, pending);
        log(`account ${i}: FAILED with session in hand (saved to pending) — ${String(e.message).slice(0, 140)}`);
      } else {
        log(`account ${i}: FAILED — ${String(e.message).slice(0, 160)}`);
      }
      appendLine(
        files.jsonl,
        JSON.stringify({
          at: nowIso(),
          email: rec.email || (box && box.address) || null,
          ok: false,
          ms: Date.now() - startedAt,
          error: String(e.message).slice(0, 300),
          failUrl: rec.failUrl || null,
          pending: !!(rec.sessionCookies && rec.email),
        })
      );
      await sleep(2000);
    }
  }

  reapStrayChromes(log);
  let drained = 0;
  while (rechecks.length && drained < 30) {
    const item = rechecks.shift();
    const c = await verifyKey(item.key, { proxy: warpProxy(), timeoutMs: 25000, modelsOnly: true });
    const ageMin = Math.round((Date.now() - item.createdAt) / 60000);
    probeRecord({ kind: 'final', email: item.email, key: item.key.slice(0, 8), ageMin, modelsStatus: c.modelsStatus });
    log(`final probe ${item.email}: /v1/models -> ${c.modelsStatus} at ${ageMin} min old`);
    drained++;
  }
  const final = readState();
  log(
    `batch end: ${final.keys.length}/${args.target} verified keys, ${final.accounts.length} accounts, ` +
      `${final.pending.length} pending — this run: ${minted} attempted, ${failures} consecutive failures`
  );
  const summary = {
    at: nowIso(),
    target: args.target,
    keys: final.keys.length,
    accounts: final.accounts.length,
    pending: final.pending.length,
    attempted: minted,
    failuresInARow: failures,
    egress: args.warp,
  };
  console.log('SUMMARY ' + JSON.stringify(summary));
  console.log(files.keys + ' has ' + final.keys.length + ' line(s), all verified');
}

if (require.main === module) {
  main().catch((e) => {
    console.error('batch died: ' + e.stack);
    process.exit(1);
  });
}

module.exports = { main, files };
