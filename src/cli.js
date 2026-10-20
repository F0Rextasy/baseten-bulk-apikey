#!/usr/bin/env node
'use strict';

/**
 * baseten-bulk-apikey — one Baseten account per key, at any scale.
 *
 * Baseten hands each new workspace free credits; a key belongs to a workspace,
 * so N independent keys means N accounts. This tool drives the whole lifecycle
 * without a browser:
 *
 *   1. a fresh inbox gets a fresh address                        (inbox.js)
 *   2. WorkOS AuthKit sends a 6-digit magic code to that address (account.js)
 *   3. the code creates the account and the app session
 *   4. POST https://app.baseten.co/graphql  CreateUserApiKey  -> text_key
 *   5. POST https://inference.baseten.co/v1/chat/completions  -> 200 = the key is live
 *      (GET /v1/models answers 202 + an AWS-WAF challenge for a fresh key,
 *       while chat on the same key answers 200 — chat is the proof, see
 *       verifyKey() in account.js)
 *
 *   node src/cli.js --count 30 --out keys.txt --accounts accounts.json \
 *               --proxy-file proxy-live-pool.txt
 *
 * Mint as many accounts/keys as you need — `--count` takes any number, there is
 * no cap; the default is 30 because that is the batch this tool was verified
 * with. One account → exactly one key. Zero dependencies, Node.js >= 18.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createAccount, verifyKey, KEY_RE, AUTHORIZE, CLIENT_ID, REDIRECT_URI } = require('./account');
const { makeInbox } = require('./inbox');
const { parseProxy, label } = require('./proxy');
const { fetchUrl, withUa } = require('./http');
const { presetArgv, resolvePreset } = require('./preset');
const { uaFor } = require('./ua-pool');

const VERSION = (() => {
  for (const dir of [__dirname, path.join(__dirname, '..')]) {
    try {
      return require(path.join(dir, 'package.json')).version;
    } catch (e) {
      /* published (flat) layout keeps package.json next to this file, src/ one level up */
    }
  }
  return '0.0.0';
})();

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else args[key] = true;
  }
  return args;
}

const HELP = `baseten-bulk-apikey v${VERSION} — one Baseten account → one API key, mint as many as you need

Usage:
  node src/cli.js [options]

Options:
  --count <n>            how many accounts (and keys) to create        [30]
                         any number works — there is no cap
  --out <file>           verified keys, one per line                [keys.txt]
  --accounts <file>      account records (email, key, prefix)  [accounts.json]
  --rejected <file>      accounts whose key never verified  [accounts-rejected.json]
  --delay <ms>           pause between accounts                       [8000]
  --preset=<name>        run shape: turbo (5 accounts in flight) · balanced (4)
                         · safe (2); sets --conc and the pause unless overridden
  --conc <n>             accounts created in flight at once                 [1]
  --gap <s>              pause before every account start, seconds           [8]
  --tries <n>            proxy lines tried per account, one per attempt  [3]
  --pool-wait <s>        when the pool runs dry, wait up to this long for
                         freshly screened lines to arrive               [600]
  --max-failures <n>     give up after this many accounts failing in a row [8]
  --proxy <line>         proxy for every provider call, e.g. socks5://1.2.3.4:1080
  --proxy-file <file>    one proxy per line; rotated per account, re-tried on failure
  --inbox <provider>     broker | mailtrap | inboxes               [broker]
  --broker <url>         inbox broker base URL     [http://127.0.0.1:9700]
  --mailtrap-token <t>   Mailtrap inbound token        [$MAILTRAP_TOKEN]
  --key-name <prefix>    API-key display name prefix          [baseten-bulk]
  --timeout <s>          per-step timeout in seconds                   [180]
  --verify-only          verify the keys in --out instead of minting
  --no-verify            write keys without the inference check
  --allow-direct         accepted for compatibility — a run with no proxy list is direct by default
  --connect-9router      register the keys in --out with a 9Router instance
  --base <url>           9Router base URL (with --connect-9router) [http://localhost:20128]
  --password <pw>        9Router password (with --connect-9router)          [123456]
  --model <id>           default model for new 9Router connections [openai/gpt-oss-120b]
  -h, --help             this text

Notes:
  · Only verified keys are written: a key lands in keys.txt the moment
    POST /v1/chat/completions answers 200 with it (GET /v1/models answers a
    fresh key with a 202 WAF challenge, so the listing is not the verdict).
    An account whose key never verifies goes to --rejected instead, with its
    e-mail, and does not count against --count.
  · accounts.json keeps the matching e-mail so a re-run can top up.
  · Every attempt takes the next line of the proxy pool; a line that fails at
    the network level twice is taken out of rotation. With --proxy-file the tool
    never falls back to the machine's own address while any line still works.
  · --proxy-file is re-read before every account, so a screener can keep
    appending freshly verified lines to the same file while the batch runs.
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function loadLines(file) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim());
  } catch (e) {
    return [];
  }
}

function loadKeys(file) {
  return loadLines(file).filter((l) => KEY_RE.test(l));
}

function loadAccounts(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : data.accounts || [];
  } catch (e) {
    return [];
  }
}

function writeAccounts(file, accounts) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ updated_at: new Date().toISOString(), count: accounts.length, accounts }, null, 2));
}

function appendKey(file, key) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.appendFileSync(file, key + '\n');
}

// ----------------------------------------------------------------- proxy pool

/**
 * Round-robin over the proxy lines with strikes: the next account always gets
 * the next line, and a line that dies at the network level twice is buried for
 * the rest of the run — one dead entry cannot take down three accounts.
 */
class ProxyPool {
  constructor(proxies = []) {
    this.proxies = proxies.slice();
    this.strikes = new Map();
    this.dead = new Set();
    // cursor walks backwards from the newest line; see next()
    this.cursor = this.proxies.length;
  }

  get size() {
    return this.proxies.length;
  }

  alive() {
    return this.proxies.length - this.dead.size;
  }

  /**
   * The next line that has not been buried, **newest first**: the screener
   * appends lines as it verifies them, so the highest index is the one most
   * likely to still be alive, and free lines die within minutes.
   */
  next() {
    const n = this.proxies.length;
    if (!n) return null;
    for (let i = 0; i < n; i++) {
      this.cursor = (this.cursor - 1 + n) % n;
      const proxy = this.proxies[this.cursor];
      if (!this.dead.has(label(proxy))) return proxy;
    }
    return null;
  }

  strike(proxy) {
    if (!proxy) return;
    const key = label(proxy);
    const n = (this.strikes.get(key) || 0) + 1;
    this.strikes.set(key, n);
    if (n >= (this.proxies.length <= 8 ? 1 : 2)) this.dead.add(key);
  }

  /** Buried for good — used when the line fails a check at the moment of use. */
  kill(proxy) {
    if (proxy) this.dead.add(label(proxy));
  }

  /**
   * Adds lines the pool has not seen yet — the screener keeps appending new
   * live exits to the same file while the batch is running, and free lines die
   * far faster than a batch takes, so a top-up is picked up on the next account.
   */
  merge(proxies = []) {
    const known = new Set(this.proxies.map((p) => label(p)));
    let added = 0;
    for (const p of proxies) {
      const key = label(p);
      if (known.has(key)) continue;
      known.add(key);
      this.proxies.push(p);
      added += 1;
    }
    return added;
  }
}

const NETWORKISH = /timeout after|ECONN|ECONNRESET|ETIMEDOUT|EPIPE|socket hang|tunnel|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH/i;

/** A local relay in front of the pool is judged by its own answers, not by the
 *  upstreams it happened to race — its CONNECTs may legitimately take longer. */
const isLocalLine = (proxy) => /^(127\.0\.0\.1|localhost|\[?::1\]?)$/i.test(proxy.host);

const PROBE_STATE = Buffer.from(JSON.stringify({ next_url: '/onboarding' })).toString('base64url');
const PROBE_URL =
  `${AUTHORIZE}?client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code&provider=authkit&state=${encodeURIComponent(PROBE_STATE)}`;

/**
 * A pool line is a promise made minutes ago, and free exits die between the
 * screener's verdict and the attempt. So the line must prove itself *twice* on
 * the flow's first request (the authorize URL) and once on the WAF edge the
 * sign-up comes back through; a single lucky CONNECT is not enough, a line in a
 * bad phase fails one of the three and is buried without costing an attempt.
 */
async function probeHop(proxy, url, timeoutMs, attempts) {
  let ok = 0;
  for (let i = 0; i < attempts; i++) {
    try {
      await fetchUrl(url, { proxy, timeoutMs, follow: false });
      ok += 1;
    } catch (e) {
      /* keep the count honest */
    }
  }
  return ok;
}

async function lineAlive(proxy, timeoutMs = 20000) {
  if (!proxy) return true;
  // one cheap ask: the steps themselves retry across lines, this only keeps the
  // clearly dead entries from being handed out at all
  const budget = isLocalLine(proxy) ? Math.max(timeoutMs, 30000) : Math.min(timeoutMs, 10000);
  return (await probeHop(proxy, PROBE_URL, budget, 1)) >= 1;
}

/**
 * GET /v1/models with `key`, on the next pool line each try. A 401 is final —
 * that is the key's own answer, no proxy will change it; anything else gets
 * another line.
 */
async function verifyAcross(key, pool, tries) {
  let last = { ok: false, status: 0, error: 'no proxy left' };
  const attempts = pool.size ? tries : 1;
  for (let t = 0; t < attempts; t++) {
    const proxy = pool.size ? pool.next() : null;
    if (pool.size && !proxy) break;
    const res = await verifyKey(key, { proxy, timeoutMs: 30000 });
    if (res.ok) return { ...res, proxy: proxy ? label(proxy) : 'direct' };
    if (res.status === 401) return res;
    last = res;
    if (proxy && !res.status) pool.strike(proxy);
  }
  return last;
}

/**
 * createAccount, retried on a fresh pool line per attempt. Each line is probed at
 * the moment of use — free exits die between the screener's verdict and the
 * attempt — and a line that cannot answer is buried there and then, without
 * costing one of the account's attempts.
 */
async function createWithRetries(baseOpts, pool, tries, log, stats) {
  let lastErr = null;
  const attempts = pool.size ? tries : 1;
  const maxProbes = pool.size ? Math.max(4, tries * 2) : 0;
  let probes = 0;
  for (let t = 0; t < attempts; t++) {
    let proxy = pool.size ? pool.next() : null;
    if (pool.size && !proxy) {
      lastErr = lastErr || new Error('every proxy line has been taken out of rotation');
      break;
    }
    let chosen = proxy;
    while (chosen && probes < maxProbes) {
      stats.probes += 1;
      probes += 1;
      if (isLocalLine(chosen)) {
        // the pool's façade: ask once and use it either way — its upstreams are
        // raced per CONNECT, so a probe failure here says nothing about the line
        await lineAlive(chosen, 30000);
        break;
      }
      if (await lineAlive(chosen, Math.min(20000, baseOpts.timeoutMs))) break;
      stats.probeFails += 1;
      pool.strike(chosen);
      log(`    ~ ${label(chosen)} cannot answer api.workos.com (probe ${probes}/${maxProbes})`);
      chosen = pool.next();
    }
    proxy = chosen;
    if (!proxy && pool.size) {
      lastErr = lastErr || new Error('every proxy line failed the use-time probe');
      break;
    }
    log(`    attempt ${t + 1}/${attempts} via ${proxy ? label(proxy) : 'direct'}`);
    stats.flows += 1;
    try {
      const record = await createAccount({ ...baseOpts, proxy, pool, log });
      record.proxy = proxy ? label(proxy) : null;
      stats.flowSuccess += 1;
      return { record, error: null };
    } catch (e) {
      lastErr = e;
      const msg = String(e.message || e).split('\n')[0];
      if (proxy && NETWORKISH.test(msg)) pool.strike(proxy);
      log(`    ✘ ${msg.slice(0, 180)}`);
    }
  }
  return { record: null, error: lastErr };
}

// ---------------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(HELP);
    return;
  }

  const outFile = String(args.out || 'keys.txt');

  if (args['connect-9router']) {
    const child = spawnSync(
      process.execPath,
      [
        path.join(__dirname, 'connect-9router.js'),
        '--keys-file', outFile,
        ...(args.base ? ['--base', String(args.base)] : []),
        ...(args.password ? ['--password', String(args.password)] : []),
        ...(args.model ? ['--model', String(args.model)] : []),
      ],
      { windowsHide: true, stdio: 'inherit' }
    );
    process.exit(child.status === null ? 1 : child.status);
  }
  const accountsFile = String(args.accounts || 'accounts.json');
  const rejectedFile = String(args.rejected || accountsFile.replace(/\.json$/i, '') + '-rejected.json');
  const inboxProvider = String(args.inbox || 'broker');
  const broker = String(args.broker || process.env.BASETEN_BROKER || 'http://127.0.0.1:9700');
  const mailtrapToken = args['mailtrap-token'] || process.env.MAILTRAP_TOKEN || null;
  const keyPrefix = String(args['key-name'] || 'baseten-bulk');
  const stepTimeoutMs = Math.max(30, parseInt(args.timeout || '180', 10)) * 1000;
  const verify = !args['no-verify'];
  const tries = Math.max(1, parseInt(args.tries || '3', 10));
  const poolWaitMs = Math.max(0, parseInt(args['pool-wait'] || '600', 10)) * 1000;
  const pool = new ProxyPool(proxyList(args));
  const poolFiles = args['proxy-file'] ? [String(args['proxy-file'])] : [];
  const refreshPool = () => {
    let added = 0;
    for (const file of poolFiles) added += pool.merge(parseProxyLines(loadLines(file)));
    return added;
  };
  const hasSource = pool.size || poolFiles.length || args.proxy || process.env.BASETEN_PROXY;
  // The proxy pool is OPTIONAL: with no proxy list at all the run leaves from
  // this machine (direct) — a pool is recommended at scale (per-IP limits,
  // bans). `--allow-direct` / BASETEN_ALLOW_DIRECT stay accepted for
  // compatibility; they are no longer a gate.
  if (!hasSource) console.error('  ! no proxy list: running WITHOUT a proxy (direct)');

  // ---- verification-only mode -------------------------------------------
  if (args['verify-only']) {
    const keys = loadKeys(outFile);
    if (!keys.length) {
      console.error(`  no keys in ${outFile}`);
      process.exit(1);
    }
    let ok = 0;
    for (const key of keys) {
      refreshPool();
      const res = await verifyAcross(key, pool, Math.max(tries, 3));
      if (res.ok) {
        ok += 1;
        console.log(`  ✔ ${key.slice(0, 8)}…${key.slice(-4)} -> ${res.status}${res.proxy ? ` via ${res.proxy}` : ''}`);
      } else {
        console.error(`  ✘ ${key.slice(0, 8)}…${key.slice(-4)} -> ${res.status || res.error}`);
      }
    }
    console.log(`  verified  : ${ok}/${keys.length} keys answer the inference API with 200 (chat; /v1/models 202 is a WAF challenge, not a verdict)`);
    if (ok < keys.length) process.exitCode = 1;
    return;
  }

  // ---- minting ------------------------------------------------------------
  const count = Math.max(1, parseInt(args.count || '30', 10));
  // Presets (operator standard v3): --preset=turbo|balanced|safe picks
  // account-level parallelism (conc) plus the pause between account starts
  // (gap, seconds). Explicit --conc/--gap/--delay always win, and without
  // --preset the run keeps today's shape exactly: one account at a time with
  // an 8000 ms pause.
  const presetRun = resolvePreset({
    preset: args.preset || presetArgv(),
    conc: args.conc != null ? parseInt(String(args.conc), 10) : null,
    gap: args.gap != null ? parseInt(String(args.gap), 10) : null,
    defaultConc: 1,
    defaultGap: 8,
  });
  const conc = Math.max(1, presetRun.conc);
  const delay = Math.max(0, args.delay != null ? parseInt(String(args.delay), 10) : Math.round(Math.max(0, presetRun.gap) * 1000));
  const pendingFile = accountsFile.replace(/\.json$/i, '') + '-pending.json';
  const accounts = loadAccounts(accountsFile);
  const rejected = loadAccounts(rejectedFile);
  const pending = loadAccounts(pendingFile);
  const directOnly = !hasSource; // --allow-direct and no lines anywhere
  const keys = loadKeys(outFile);
  console.log(`  accounts  : ${accounts.length} recorded, target ${count}`);
  console.log(`  keys      : ${keys.length} in ${outFile}`);
  console.log(`  inbox     : ${inboxProvider}${inboxProvider === 'broker' ? ` (${broker})` : ''}`);
  console.log(`  proxies   : ${pool.size ? `${pool.size} lines, rotated per attempt` : directOnly ? 'direct (no proxy configured)' : 'none yet — waiting for the screener'}`);
  if (pending.length) console.log(`  pending   : ${pending.length} created account(s) waiting for a key check`);

  const maxAttempts = Math.max(count * 3, count + 10);
  const maxFailures = Math.max(1, parseInt(args['max-failures'] || '8', 10));
  const stats = { probes: 0, probeFails: 0, flows: 0, flowSuccess: 0 };
  let attempts = 0;
  let consecutive = 0;

  /** Commits an account whose key answered 200: the only place keys.txt grows. */
  const commit = (record, how) => {
    record.verified = true;
    accounts.push(record);
    writeAccounts(accountsFile, accounts);
    appendKey(outFile, record.key);
    consecutive = 0;
    console.log(`    ✔ ${record.email} -> ${record.key.slice(0, 8)}…${record.key.slice(-4)} (via ${how}) · ${accounts.length}/${count}`);
    console.log(`✓ #${record.index != null ? record.index : record.email} KEY ALINDI: ${String(record.key).slice(0, 22)}… [${accounts.length} ok / ${attempts} deneme]`);
  };

  /**
   * A key that could not be checked *yet* is not a lost key — a Baseten account
   * mints exactly one — so created-but-unverified accounts wait in pending and
   * are checked again on the next fresh line. Only a 401 is final.
   */
  const flushPending = async () => {
    while (pending.length && pool.alive()) {
      const record = pending[0];
      const res = await verifyAcross(record.key, pool, Math.max(tries, 3));
      if (res.ok) {
        pending.shift();
        writeAccounts(pendingFile, pending);
        commit(record, res.proxy || 'direct');
      } else if (res.status === 401) {
        pending.shift();
        writeAccounts(pendingFile, pending);
        record.verified = false;
        record.rejectedReason = 'GET /v1/models -> 401';
        rejected.push(record);
        writeAccounts(rejectedFile, rejected);
        console.error(`    ! pending key ${record.key.slice(0, 8)}… is refused by the API (401) -> ${path.basename(rejectedFile)}`);
      } else {
        console.error(`    … pending key not checked yet (${res.status || res.error}) — will retry on a fresh line`);
        return;
      }
    }
  };

  // Serializes the shared post-processing (account files, pending queue,
  // consecutive-failure counter) while account creation itself runs conc-wide.
  let chain = Promise.resolve();
  const serial = (fn) => {
    const p = chain.then(fn, fn);
    chain = p.catch(() => {});
    return p;
  };

  async function mintAccount() {
    while (accounts.length < count && attempts < maxAttempts) {
      attempts += 1;
      const added = refreshPool();
      if (added) console.log(`  pool      : +${added} fresh lines picked up (${pool.alive()}/${pool.size} alive)`);
      // Free lines live for minutes; a dry pool usually means the screener is
      // about to append more, so wait for it instead of writing the run off.
      if (!directOnly && !pool.alive()) {
        let waited = 0;
        while (!pool.alive() && waited < poolWaitMs) {
          await sleep(15000);
          waited += 15000;
          const n = refreshPool();
          if (n) console.log(`  pool      : +${n} fresh lines after ${Math.round(waited / 1000)}s (${pool.alive()}/${pool.size} alive)`);
        }
        if (!pool.alive()) {
          console.error(`  aborting: no live proxy line for ${Math.round(poolWaitMs / 1000)}s`);
          return;
        }
      }

      await serial(flushPending);
      if (accounts.length >= count) return;

      const index = accounts.length + rejected.length + pending.length + 1;
      console.log(`\n  [${now()}] account ${accounts.length + 1}/${count} · attempt ${attempts}/${maxAttempts}`);
      console.log(`… #${index} başladı (${pool.alive() ? `pool ${pool.alive()}/${pool.size}` : directOnly ? 'direct' : 'pool dry'})`);

      // Per-account fingerprint: the whole account flow runs inside withUa so
      // every provider request of this account carries its own UA (ua-pool).
      const { record, error } = await withUa(uaFor(index).ua, () => createWithRetries(
        {
          index,
          keyName: `${keyPrefix}-${index}`,
          inboxProvider,
          broker,
          mailtrapToken,
          timeoutMs: stepTimeoutMs,
          verify,
          log: (line) => console.log(`    ${line}`),
        },
        pool,
        tries,
        (line) => console.log(line),
        stats
      ));

      let stop = false;
      await serial(async () => {
        if (record) {
          let how = record.proxy || 'direct';
          let verified = record.verified;
          let final401 = false;
          if (verify && !verified) {
            const res = await verifyAcross(record.key, pool, Math.max(tries, 3));
            verified = res.ok;
            final401 = res.status === 401;
            if (verified) how = res.proxy || 'direct';
            else if (!final401) console.error(`    … key not checked yet (${res.status || res.error}) — account held pending`);
          }
          record.verified = verified;
          if (!verify || verified) {
            commit(record, how);
          } else if (final401) {
            record.rejectedReason = 'GET /v1/models -> 401';
            rejected.push(record);
            writeAccounts(rejectedFile, rejected);
            console.error(`    ! key refused by the API (401) -> ${path.basename(rejectedFile)}`);
            console.error(`✗ #${index} key yok: key refused by the API (401)`);
          } else {
            pending.push(record);
            writeAccounts(pendingFile, pending);
            console.log(`    … ${pending.length} account(s) pending a key check`);
            console.log(`✗ #${index} key yok: not checked yet (account held pending)`);
          }
        } else {
          consecutive += 1;
          if (error) console.error(`    ✘ ${String(error.message || error).split('\n')[0].slice(0, 200)}`);
          console.error(`✗ #${index} key yok: ${String((error && error.message) || error || 'no record').split('\n')[0].slice(0, 200)}`);
          if (consecutive >= maxFailures) {
            console.error(`  aborting: ${consecutive} accounts failed in a row — that is the flow being blocked, not the proxies`);
            stop = true;
          }
        }
      });
      if (stop) return;
      if (delay) await sleep(delay);
      console.log(`    point-of-use so far: ${stats.probes - stats.probeFails}/${stats.probes} probes answered · ${stats.flowSuccess}/${stats.flows} flows completed`);
    }
  }

  console.log(`  shape     : conc=${conc} gap=${delay / 1000}s${presetRun.name ? ` preset=${presetRun.name}` : ''}`);
  await Promise.all(Array.from({ length: Math.min(conc, Math.max(1, count)) }, () => mintAccount()));

  await serial(flushPending);
  console.log(`\n  done      : ${accounts.length}/${count} accounts · ${loadKeys(outFile).length} keys in ${outFile}`);
  console.log(`BASETEN ${accounts.length}/${count} OK`);
  console.log(`  accounts  : ${accountsFile}`);
  console.log(`  point-of-use: ${stats.probes - stats.probeFails}/${stats.probes} lines answered the probe · ${stats.flowSuccess}/${stats.flows} flows completed`);
  if (pending.length) console.log(`  pending   : ${pending.length} created account(s) whose key was never confirmed — ${pendingFile}`);
  if (rejected.length) console.log(`  rejected  : ${rejected.length} unverified accounts in ${rejectedFile}`);
  if (accounts.length < count) process.exitCode = 1;
}

function parseProxyLines(lines) {
  return lines
    .map((l) => String(l).split('#')[0].trim()) // some lists carry inline `# exit=…` notes
    .filter((l) => l)
    .map((l) => {
      try {
        return parseProxy(l);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}

function proxyList(args) {
  let raw = [];
  if (args['proxy-file']) raw = raw.concat(loadLines(String(args['proxy-file'])));
  if (args.proxy) raw = raw.concat(String(args.proxy).split(','));
  if (!raw.length && process.env.BASETEN_PROXY) raw = raw.concat(process.env.BASETEN_PROXY.split(','));
  return parseProxyLines(raw);
}

main().catch((e) => {
  console.error('[fatal]', e.message);
  process.exit(1);
});

module.exports = { parseArgs, loadKeys, ProxyPool };
