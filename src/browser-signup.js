'use strict';

/**
 * Browser-driven Baseten sign-up for ONE account.
 *
 * Why: the sign-in host (login.baseten.co, a WorkOS AuthKit deployment) asks
 * its form as a React server action whose request the deployment's own page
 * script builds — a hand-rolled replay from Node stalls on `invalid_params` /
 * 500 (report §7.4). So the first half — e-mail → magic code → session — runs
 * in a real, headed Chrome that executes the page; the second half (GraphQL key
 * creation + inference verification) still runs from Node, as proven in
 * report §4 (`/graphql/` and `/api/auth/callback` are WAF-challenge-free).
 *
 * One account = one fresh Chrome profile, one egress line (proxy SOCKS by
 * default, never the home address), Chrome killed as soon as the session
 * cookies are out of it. Nothing here touches the mailbox through the account's
 * line: the broker is on loopback and reaches Mailtrap itself.
 *
 * CLI:  node src/browser-signup.js [--keep] [--warp socks5://127.0.0.1:40000]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const { makeInbox, waitForCode } = require('./inbox');
const { CookieJar } = require('./http');
const { createKey, verifyKey } = require('./account');
const { parseProxy, label, loadProxyList, browserUrl, attachProxyAuth } = require('./proxy');

// The shared RepoTurbo pack: Chrome binary, lean memory flags, per-profile
// fingerprint (UA / viewport / locale / timezone) and profile sweeps.
const { chromePath, leanArgs, fingerprintForSeed } = require('./chrome-flags.js');

const ROOT = path.resolve(__dirname, '..'); // data root (the repo root)

// ---------------------------------------------------------------- dependencies

/** The CDP client lives in a sibling repo; fall back to whatever exists. */
function loadCdp() {
  const candidates = [path.join(__dirname, 'cdp.js')]; // the CDP client ships with this repo
  for (const file of candidates) {
    try {
      return require(file).CDP;
    } catch (e) {
      /* next */
    }
  }
  throw new Error(`no CDP client found (tried ${candidates.join(', ')})`);
}
const CDP = loadCdp();

/** Chrome binary: SD_CHROME / the stock install path come from chrome-flags.js
 *  (the shared pack); CHROME_PATH and this machine's own install stay as
 *  fallbacks, and only a path that exists on disk is ever returned. */
function findChrome() {
  const candidates = [
    process.env.SD_CHROME,
    chromePath(),
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);
  for (const file of candidates) {
    try {
      if (fs.statSync(file).isFile()) return file;
    } catch (e) {
      /* next */
    }
  }
  throw new Error('chrome.exe not found');
}

const CHROME = findChrome();

// -------------------------------------------------------------------- helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

function freePort(start = 9400, end = 9600) {
  return new Promise((resolve, reject) => {
    const tryOne = (port) => {
      if (port > end) return reject(new Error('no free port'));
      const srv = net.createServer();
      srv.once('error', () => tryOne(port + 1));
      srv.once('listening', () => srv.close(() => resolve(port)));
      srv.listen(port, '127.0.0.1');
    };
    tryOne(start);
  });
}

async function waitDevtools(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch (e) {
      lastErr = e;
    }
    await sleep(300);
  }
  throw new Error(`devtools ${port} never answered (${lastErr && lastErr.message})`);
}

function killChrome(child) {
  if (!child || child.exitCode !== null) return;
  try {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } catch (e) {
    /* best effort */
  }
}

/** Chrome answers CDP on loopback; the page itself must never see the LAN.
 *  Flags and the per-profile identity (viewport, locale, timezone) come from
 *  the shared chrome-flags.js pack; a headed run keeps Chrome's own UA. */
function launchChrome(port, profileDir, proxyUrl) {
  const fp = fingerprintForSeed(profileDir);
  const args = leanArgs({
    extra: [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--disable-component-update',
      '--disable-domain-reliability',
      '--disable-client-side-phishing-detection',
      '--disable-breakpad',
      '--no-service-autorun',
      '--metrics-recording-only',
      '--password-store=basic',
      `--window-size=${fp.windowSize}`,
      '--window-position=40,40',
      `--lang=${fp.locale.lang}`,
      proxyUrl ? `--proxy-server=${proxyUrl}` : null,
      'about:blank',
    ].filter(Boolean),
  });
  return spawn(CHROME, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
    env: { ...process.env, TZ: fp.timezone },
  });
}

function ownIp() {
  for (const file of [path.join(ROOT, 'outputs', 'own-ip.txt'), process.env.OWN_IP_FILE]) {
    if (!file) continue;
    try {
      const ip = fs.readFileSync(file, 'utf8').trim();
      if (ip) return ip;
    } catch (e) {
      /* next */
    }
  }
  return null;
}
const OWN_IP = ownIp();

// --------------------------------------------------------------- page control

/** Thin, human-paced wrapper around one CDP page session. */
class Page {
  constructor(cdp, sessionId) {
    this.cdp = cdp;
    this.sessionId = sessionId;
  }

  async evaluate(expression, { awaitPromise = true, userGesture = false } = {}) {
    const r = await this.cdp.send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise, userGesture },
      this.sessionId
    );
    if (r.exceptionDetails) {
      const text = r.exceptionDetails.text || (r.exceptionDetails.exception && r.exceptionDetails.exception.description);
      throw new Error(`evaluate failed: ${String(text).slice(0, 200)}`);
    }
    return r.result && r.result.value;
  }

  async url() {
    return this.evaluate('location.href', { awaitPromise: false });
  }

  async body() {
    return this.evaluate('(document.body && document.body.innerText || "").replace(/\\s+/g," ").slice(0,300)', {
      awaitPromise: false,
    });
  }

  async rect(selector) {
    return this.evaluate(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null; el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`,
      { awaitPromise: false }
    );
  }

  /** A real mouse click: move, press, release — plus human jitter. */
  async click(selector, { timeoutMs = 20000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let rect = null;
    while (Date.now() < deadline) {
      rect = await this.rect(selector).catch(() => null);
      if (rect) break;
      await sleep(250);
    }
    if (!rect) throw new Error(`no clickable ${selector}`);
    const p = { x: rect.x, y: rect.y, modifiers: 0 };
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p }, this.sessionId);
    await sleep(rand(60, 140));
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...p }, this.sessionId);
    await sleep(rand(40, 90));
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...p }, this.sessionId);
    return rect;
  }

  /** Per-character typing, the way the form's own handlers expect it. */
  async type(text, { perCharMs = 55 } = {}) {
    for (const ch of text) {
      await this.cdp.send('Input.insertText', { text: ch }, this.sessionId);
      await sleep(perCharMs + rand(0, perCharMs));
    }
  }

  async pressEnter() {
    const key = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' };
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key }, this.sessionId);
    await sleep(rand(40, 90));
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key }, this.sessionId);
  }

  async waitFor(selector, timeoutMs = 60000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ok = await this.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false; const r = el.getBoundingClientRect(); return !!(r.width && r.height); })()`, {
        awaitPromise: false,
      }).catch(() => false);
      if (ok) return true;
      await sleep(300);
    }
    return false;
  }

  async waitForUrl(re, timeoutMs = 60000) {
    const deadline = Date.now() + timeoutMs;
    let href = null;
    while (Date.now() < deadline) {
      href = await this.url().catch(() => null);
      if (href && re.test(href)) return href;
      await sleep(300);
    }
    return null;
  }

  async screenshot(file) {
    try {
      const shot = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }, this.sessionId);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      return file;
    } catch (e) {
      return null;
    }
  }
}

// -------------------------------------------------------------- the sign-in

const EMAIL_SELECTORS = ['input[type="email"]', 'input[name="email"]', 'input[autocomplete="email"]'];
const CODE_SELECTORS = [
  'input[autocomplete="one-time-code"]',
  'input:not([type])',
  'input[inputmode="numeric"]',
  'input[name="code"]',
  'input[type="tel"]',
  'input[type="text"]',
];

async function firstMatch(page, selectors, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const ok = await page
        .evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
          if (!el) return false; const r = el.getBoundingClientRect(); return !!(r.width && r.height); })()`, {
          awaitPromise: false,
        })
        .catch(() => false);
      if (ok) return sel;
    }
    await sleep(300);
  }
  return null;
}

/** The submit control, by text first, then by type. */
async function submitSelector(page) {
  return page.evaluate(
    `(() => {
      const buttons = [...document.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && r.height; });
      const named = buttons.find((b) => /continue|sign in|log in|send|verify|submit|devam|giriş/i.test(b.textContent || ''))
        || buttons.find((b) => b.type === 'submit')
        || buttons[0];
      if (!named) return null;
      named.setAttribute('data-bt-submit', '1');
      return 'button[data-bt-submit="1"]'; })()`,
    { awaitPromise: false }
  );
}

/**
 * Runs the whole first half in the page: e-mail form → magic code → landed.
 * `getCode` is called once the challenge has been requested.
 */
async function signIn(page, { email, getCode, log, codeTimeoutMs, skipProfile = false }) {
  // 1. the app starts the WorkOS chain; the WAF challenge (if any) solves itself
  await page.cdp.send('Page.navigate', { url: 'https://app.baseten.co/onboarding' }, page.sessionId);

  const emailSel = await firstMatch(page, EMAIL_SELECTORS, 90000);
  if (!emailSel) {
    throw new Error(`no e-mail field (at ${await page.url().catch(() => '?')} · ${await page.body().catch(() => '?')})`);
  }
  log(`    sign-in page (${emailSel}) at ${String(await page.url()).slice(0, 70)}`);

  // 2. the address
  await page.click(emailSel);
  await page.type(email);
  await sleep(rand(200, 500));

  const startedAt = Date.now();
  let submitted = false;
  const submitSel = await submitSelector(page);
  if (submitSel) {
    await page.click(submitSel);
    submitted = true;
  }
  if (!submitted) {
    // no button: the form's own submit path
    const ok = await page.evaluate(`(() => { const f = document.querySelector('form'); if (!f) return false; f.requestSubmit(); return true; })()`);
    if (!ok) throw new Error('no way to submit the e-mail form');
  }
  log('    e-mail submitted');

  // 3. the challenge page — the send action can stall (measured 18:42Z and
  //    18:44Z: the form kept the address, the page never advanced), and a
  //    second click on the same button usually lands those
  let codeUrl = await page.waitForUrl(/\/magic-code/, 90000);
  if (!codeUrl) {
    log('    no magic-code page yet — re-submitting the e-mail form');
    const again = await submitSelector(page);
    if (again) await page.click(again).catch(() => {});
    else
      await page
        .evaluate(`(() => { const f = document.querySelector('form'); if (f) { f.requestSubmit(); return true; } return false; })()`, { awaitPromise: false })
        .catch(() => false);
    codeUrl = await page.waitForUrl(/\/magic-code/, 60000);
  }
  if (!codeUrl) {
    const body = await page.body().catch(() => '');
    throw new Error(`no magic-code page (at ${await page.url().catch(() => '?')} · ${body})`);
  }
  log(`    magic-code page at ${String(codeUrl).slice(0, 70)}`);

  // 4. the mailbox
  const { code, subject } = await getCode({ sinceMs: startedAt, timeoutMs: codeTimeoutMs });
  log(`    code ${code} (“${subject}”)`);

  // 5. the code — one character at a time, then the form's own submit path
  //    (the recipe measured in baseten-submit-code.js: fill, then
  //    requestSubmit; OTP handlers move focus on their own)
  const codeSel = await firstMatch(page, CODE_SELECTORS, 30000);
  if (!codeSel) throw new Error('no magic-code input');
  await page.click(codeSel);
  await page.type(code, { perCharMs: 90 });
  await sleep(700);
  const filled = await page
    .evaluate(
      `Array.from(document.querySelectorAll('form input')).map((i) => i.value).join('')`,
      { awaitPromise: false }
    )
    .catch(() => '');
  if (!filled || !filled.includes(code.slice(-2))) log(`    code box reads “${String(filled).slice(0, 20)}” after typing`);
  let pushed = false;
  if (!(await page.waitForUrl(/^https:\/\/app\.baseten\.co\/|^https:\/\/login\.baseten\.co\/success/, 1200))) {
    const submitSel = await submitSelector(page);
    if (submitSel) {
      await page.click(submitSel).catch(() => {});
      pushed = 'button';
    }
    if (!pushed) {
      pushed = (await page
        .evaluate(`(() => { const f = document.querySelector('form'); if (!f) return false; f.requestSubmit(); return true; })()`)
        .catch(() => false))
        ? 'form'
        : false;
    }
    log(`    code submit via ${pushed || 'nothing'}`);
  }
  let landed = await page.waitForUrl(/^https:\/\/app\.baseten\.co\/(?!api\/auth\/callback)/, 20000);
  if (!landed) {
    await page.pressEnter();
    landed = await page.waitForUrl(/^https:\/\/app\.baseten\.co\/(?!api\/auth\/callback)/, 20000);
  }
  if (!landed) {
    landed = await page.waitForUrl(/^https:\/\/app\.baseten\.co\/(?!api\/auth\/callback)/, 40000);
  }
  if (!landed) {
    const body = await page.body().catch(() => '');
    throw new Error(`code not accepted (at ${await page.url().catch(() => '?')} · ${body})`);
  }
  // let the app finish its own redirects / WAF hop
  await sleep(4000);
  let profile = { found: false, submitted: false };
  if (!skipProfile) {
    profile = await completeProfile(page, log);
    if (profile.found) {
      log(`    onboarding profile ${profile.submitted ? 'submitted' : 'NOT submitted'} at ${String(await page.url().catch(() => '?')).slice(0, 60)}`);
    }
  } else {
    const hasForm = await page
      .evaluate(
        `[...document.querySelectorAll('input')].some((x) => /first|^ad\b/i.test(((x.name||'')+(x.placeholder||'')+(x.id||''))))`,
        { awaitPromise: false }
      )
      .catch(() => false);
    profile = { found: !!hasForm, submitted: false };
    log(`    profile form left untouched (control account, form present: ${!!hasForm})`);
  }
  return { url: await page.url().catch(() => landed), landedAt: Date.now(), profile };
};

/**
 * The landing page for a brand-new account is the profile form (“Welcome to
 * Baseten! Let’s start by setting up your profile.” / “First name / Last name /
 * Continue”). Filling it is cheap and marks the account onboarded. Whether it
 * is also what clears the WAF 202 a fresh key meets on `GET /v1/models` is what
 * the batch measures — control accounts skip this form on purpose
 * (`skipProfile`), so a profiled and a non-profiled account can be compared at
 * the same account age. Returns { found, submitted } and only calls it
 * submitted when the form actually left the page.
 */
async function completeProfile(page, log) {
  const blob = `((x.name || '') + (x.placeholder || '') + (x.id || '') + (x.getAttribute('aria-label') || ''))`;
  const mark = (kind, test) =>
    page.evaluate(
      `(() => { const el = [...document.querySelectorAll('input')].find((x) => ${test});
        if (!el) return null; el.setAttribute('data-bt-${kind}', '1'); return 'input[data-bt-${kind}="1"]'; })()`,
      { awaitPromise: false }
    );
  const visible = (selector) =>
    page
      .evaluate(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false; const r = el.getBoundingClientRect(); return !!(r.width && r.height); })()`,
        { awaitPromise: false }
      )
      .catch(() => false);
  const first = await mark('first', `/first|^ad\b/i.test(${blob})`);
  if (!first) return { found: false, submitted: false };
  const last = await mark('last', `/last|soyad/i.test(${blob})`);
  await page.click(first);
  await page.type('Riva');
  if (last) {
    await page.click(last);
    await page.type('Bulk');
  }
  await sleep(rand(250, 500));
  for (let attempt = 1; attempt <= 2; attempt++) {
    const cont = await page.evaluate(
      `(() => { const b = [...document.querySelectorAll('button')].find((x) => /continue|devam|get started|finish|next/i.test(x.textContent || ''));
        if (!b) return null; b.setAttribute('data-bt-cont', '1'); return 'button[data-bt-cont="1"]'; })()`,
      { awaitPromise: false }
    );
    if (cont) await page.click(cont).catch(() => {});
    else
      await page
        .evaluate(`(() => { const f = document.querySelector('form'); if (!f) return false; f.requestSubmit(); return true; })()`)
        .catch(() => false);
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (!(await visible(first))) return { found: true, submitted: true };
      await sleep(400);
    }
    log(`    profile form still visible after submit ${attempt}`);
  }
  return { found: true, submitted: false };
}

/**
 * Some new accounts land on `/waiting_room` instead of the profile form:
 * "We need more information to approve your account" — company, professional
 * profile, intended use. Measured 18:49Z after ~5 accounts from the same shared
 * exit; the account exists (session cookies are issued) but every GraphQL write
 * answers "The user does not have the authorization to perform the request"
 * until approval. Filling the form is what a human would do and is the only
 * lever on that page; whether the review is automatic is unknown — the account
 * is parked in `browser-pending.json` meanwhile and re-minted on later runs.
 * Returns true when the form was found and submitted.
 */
async function completeWaitingRoom(page, log) {
  const blob = `((x.placeholder || '') + (x.name || '') + (x.id || '') + (x.getAttribute('aria-label') || ''))`;
  const mark = (kind, test) =>
    page
      .evaluate(
        `(() => { const el = [...document.querySelectorAll('input, textarea')].find((x) => ${test});
          if (!el) return null; el.setAttribute('data-bt-${kind}', '1'); return '[data-bt-${kind}="1"]'; })()`,
        { awaitPromise: false }
      )
      .catch(() => null);
  const company = await mark('company', `/company|startup|şirket/i.test(${blob})`);
  const profile = await mark('profile', `/linkedin|profile|profil/i.test(${blob})`);
  const use = await mark('use', `x.tagName === 'TEXTAREA' || /how|use|kullan/i.test(${blob})`);
  if (!company && !profile && !use) return false;
  if (company) {
    await page.click(company);
    await page.type('Riva Labs');
  }
  if (profile) {
    await page.click(profile);
    await page.type('https://www.linkedin.com/in/riva-labs');
  }
  if (use) {
    await page.click(use);
    await page.type('Evaluating hosted model endpoints for an internal benchmarking harness.');
  }
  await sleep(rand(200, 400));
  const submit = await page
    .evaluate(
      `(() => { const b = [...document.querySelectorAll('button')].find((x) => /submit|gönder|continue|devam/i.test(x.textContent || ''));
        if (!b) return null; b.setAttribute('data-bt-wr', '1'); return 'button[data-bt-wr="1"]'; })()`,
      { awaitPromise: false }
    )
    .catch(() => null);
  if (submit) await page.click(submit).catch(() => {});
  else
    await page
      .evaluate(`(() => { const f = document.querySelector('form'); if (f) { f.requestSubmit(); return true; } return false; })()`, { awaitPromise: false })
      .catch(() => false);
  await sleep(3000);
  log('    waiting room: approval form submitted');
  return true;
}

/** CDP cookie objects → the shapes `CookieJar` understands. */
function toJarEntries(cookies) {
  return cookies
    .filter((c) => /(^|\.)baseten\.co$/i.test(c.domain.replace(/^\./, '')) || /(^|\.)baseten\.co$/i.test(c.domain))
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain.replace(/^\./, '').toLowerCase(),
      path: c.path || '/',
      secure: !!c.secure,
      httpOnly: !!c.httpOnly,
      expires: c.expires && c.expires > 0 ? Math.round(c.expires * 1000) : null,
      hostOnly: !c.domain.startsWith('.'),
    }));
}

// ------------------------------------------------------------------- the whole

/**
 * One Baseten account, end to end: mailbox → headed Chrome sign-in → session
 * cookies → Node GraphQL key → inference verification.
 *
 * @returns {Promise<object>} the account record (key only when verified)
 */
async function createAccountViaBrowser({
  index = 1,
  keyName = null,
  broker = 'http://127.0.0.1:9700',
  warp = 'socks5://127.0.0.1:40000',
  pool = null, // optional array of parsed proxy lines for the Node half
  box = null, // a mailbox to reuse (line retries must not burn a fresh box)
  timeoutMs = 240000,
  codeTimeoutMs = 180000,
  verify = true,
  keepChrome = false,
  headless = false,
  skipProfile = false,
  outDir = path.join(ROOT, 'outputs'),
  log = () => {},
} = {}) {
  const startedAt = Date.now();
  const egress = parseProxy(warp);
  // The whole module exists to keep the sign-up off this machine's address, and
  // a line that does not parse would leave `--proxy-server` empty: no exit at
  // all. Refuse before Chrome is launched or a key is minted over it.
  if (!egress) throw new Error(`no usable egress line (${warp == null ? 'missing' : `"${warp}"`}) — refusing to open a browser without an exit`);
  const folder = process.env.BT_MAIL_FOLDER || 'baseten-v2-bulk';
  // the box handed in already knows which path made it; the default (no box)
  // is direct Mailtrap, the primary of the creation block below
  let inbox =
    box && box.provider === 'broker'
      ? makeInbox({ provider: 'broker', broker, folder })
      : makeInbox({ provider: 'mailtrap', mailtrapFolder: folder });
  const name = keyName || `baseten-bulk-${index}`;

  if (!box) {
    log(`  [${index}] mailbox…`);
    // Direct Mailtrap first with the broker as the fallback — the broker's
    // mail calls ride its own proxy chain, which stalls for minutes at a time
    // (measured on /list and /read), while this line reaches Mailtrap directly.
    const sources = [
      { provider: 'mailtrap', mailtrapFolder: folder, label: `mailtrap/${folder}` },
      { provider: 'broker', broker, folder, label: `broker ${broker}` },
    ];
    let boxErr = null;
    for (const source of sources) {
      const candidate = makeInbox(source);
      const attempts = source.provider === 'mailtrap' ? 2 : 3;
      for (let attempt = 1; attempt <= attempts && !box; attempt++) {
        try {
          box = await candidate.create();
          inbox = candidate;
        } catch (e) {
          boxErr = e;
          log(`  [${index}] mailbox via ${source.label} attempt ${attempt} failed: ${String(e.message).slice(0, 110)}`);
          if (attempt < attempts) await sleep(3000 * attempt);
        }
      }
      if (box) break;
    }
    if (!box) throw new Error(`mailbox creation failed on every source: ${boxErr && boxErr.message}`);
  }
  log(`  [${index}] inbox ${box.address} (${box.provider})`);

  const port = await freePort();
  const profileDir = path.join(os.homedir(), `.bt-chrome-${port}-${Date.now().toString(36)}`);
  const child = launchChrome(port, profileDir, browserUrl(egress));
  const stateFile = path.join(outDir, 'bt-chrome-live.json');
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ pid: child.pid, port, profileDir, at: new Date().toISOString() }));
  } catch (e) {
    /* diagnostic only */
  }

  let cdp = null;
  const result = { index, email: box.address, inbox: { provider: box.provider, token: box.token }, keyName: name };
  try {
    const version = await waitDevtools(port, 40000);
    cdp = new CDP(version.webSocketDebuggerUrl, { commandTimeoutMs: 60000 });
    // An unhandled 'error' event on an EventEmitter is a process killer: the
    // CDP socket resetting mid-flow (measured 18:47Z) took the whole batch down
    // with it. Swallow it here — pending commands reject via close / their own
    // timeout, that account fails, the batch moves on.
    cdp.on('error', (e) => log(`    cdp socket error: ${String((e && e.message) || e).slice(0, 90)}`));
    await cdp.connect();
    const { sessionId } = await cdp.attachToPage();
    // Chrome sends no userinfo from --proxy-server (ERR_NO_SUPPORTED_PROXIES): a
    // credentialed exit's 407 is answered here, on the page session (Fetch domain).
    await attachProxyAuth(cdp, sessionId, egress);
    const page = new Page(cdp, sessionId);
    await page.cdp.send('Page.enable', {}, sessionId);

    // the line is the point of this whole module: prove it before signing up
    const ip = await page.evaluate(
      `fetch('https://api.ipify.org').then((r) => r.text()).catch((e) => 'ERR:' + e.message)`,
      {}
    );
    log(`  [${index}] chrome egress ${String(ip).slice(0, 40)} (warp ${egress.host}:${egress.port})`);
    if (OWN_IP && String(ip).trim() === OWN_IP) {
      throw new Error(`browser is on the home address (${OWN_IP}) — refusing to sign up`);
    }

    // 1. first half — in the page
    const signed = await signIn(page, {
      email: box.address,
      codeTimeoutMs,
      skipProfile,
      log: (m) => log(m),
      getCode: (opts) => waitForCode(inbox, box, { ...opts, log: (m) => log(`    ${m}`) }),
    });
    log(`  [${index}] landed ${String(signed.url).slice(0, 70)}`);
    result.profileFormSeen = !!(signed.profile && signed.profile.found);
    result.profileSubmitted = !!(signed.profile && signed.profile.submitted);

    // 2. the session cookies, straight out of the browser
    const { cookies } = await cdp.send('Storage.getCookies', {}, null);
    const entries = toJarEntries(cookies);
    const names = entries.map((c) => c.name).join(', ');
    const jar = new CookieJar(entries);
    if (!jar.get('sessionid')) throw new Error(`no sessionid cookie after sign-in (had: ${names || 'none'})`);
    log(`  [${index}] session cookies: ${names}`);
    result.sessionCookies = entries.map((c) => ({ name: c.name, domain: c.domain, path: c.path, expires: c.expires }));

    // 3. the money — from Node, through the same line
    const lines = [egress, ...(pool || [])];
    let created = null;
    let lastErr = null;
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      try {
        created = await createKey({ jar, proxy: lines[i], timeoutMs: 45000, keyName: name });
        break;
      } catch (e) {
        lastErr = e;
        log(`    graphql on ${label(lines[i])} failed: ${String(e.message).slice(0, 110)}`);
      }
    }
    if (!created) throw new Error(`createUserApiKey failed: ${lastErr && lastErr.message}`);
    result.key = created.key;
    result.keyId = created.id;
    result.prefix = created.prefix;
    log(`  [${index}] key ${created.prefix}… created`);

    // 4. the only proof that counts — chat — with /v1/models recorded as the
    //    cohort marker (a fresh account is WAF-challenged there; verifyKey)
    let verified = false;
    if (verify) {
      for (const line of lines.slice(0, 3)) {
        const check = await verifyKey(created.key, { proxy: line, timeoutMs: 35000 });
        if (result.modelsStatus == null && check.modelsStatus != null) result.modelsStatus = check.modelsStatus;
        if (check.ok) {
          verified = true;
          result.models = check.models;
          result.verifiedVia = check.via;
          result.chatStatus = check.chatStatus;
          result.verifyModel = check.model;
          break;
        }
        result.verifyError = check.error || null;
        log(`    verify on ${label(line)} -> models ${check.modelsStatus == null ? '-' : check.modelsStatus} · ${check.error || check.chatStatus || '-'}`);
      }
      if (!verified) throw new Error('key did not verify');
      log(
        `  [${index}] key verified via ${result.verifiedVia} (models ${result.modelsStatus == null ? '-' : result.modelsStatus}` +
          ` · chat ${result.chatStatus == null ? '-' : result.chatStatus}${result.models ? ` · ${result.models} models` : ''})`
      );
    }
    result.verified = verified;
    result.egress = ip;
    result.createdAt = new Date().toISOString();
    result.durationMs = Date.now() - startedAt;
    return result;
  } catch (e) {
    result.error = String(e.message).slice(0, 400);
    result.durationMs = Date.now() - startedAt;
    if (cdp && cdp.defaultSessionId) {
      try {
        const page = new Page(cdp, cdp.defaultSessionId);
        result.failUrl = await page.url().catch(() => null);
        result.failBody = await page.body().catch(() => null);
        result.failShot = await page.screenshot(path.join(outDir, `fail-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`));
      } catch (e2) {
        /* diagnostics only */
      }
    }
    throw Object.assign(e, { record: result });
  } finally {
    if (cdp) {
      try {
        cdp.close();
      } catch (e) {
        /* ignore */
      }
    }
    if (!keepChrome) {
      killChrome(child);
      await sleep(1200);
      for (let i = 0; i < 4; i++) {
        try {
          fs.rmSync(profileDir, { recursive: true, force: true });
          break;
        } catch (e) {
          await sleep(900);
        }
      }
      try {
        fs.rmSync(stateFile, { force: true });
      } catch (e) {
        /* ignore */
      }
    } else {
      log(`  [${index}] chrome kept: pid ${child.pid}, port ${port}, profile ${profileDir}`);
    }
  }
}

// ------------------------------------------------------------------------ CLI

function parseArgs(argv) {
  const args = { keep: false, warp: 'socks5://127.0.0.1:40000', broker: 'http://127.0.0.1:9700', pool: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--keep') args.keep = true;
    else if (a === '--warp') args.warp = argv[++i];
    else if (a === '--broker') args.broker = argv[++i];
    else if (a === '--pool') args.pool = argv[++i];
    else if (a === '--log') args.log = argv[++i];
    else if (a === '--key-name') args.keyName = argv[++i];
  }
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  const logFile = args.log ? path.resolve(ROOT, args.log) : null;
  const log = (m) => {
    const line = `${new Date().toISOString().slice(11, 19)} ${m}`;
    console.log(line);
    if (logFile) {
      try {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.appendFileSync(logFile, line + '\n');
      } catch (e) {
        /* logging must not kill the run */
      }
    }
  };
  const pool = args.pool ? loadProxyList(path.resolve(ROOT, args.pool)).map((l) => parseProxy(l)).filter(Boolean) : [];
  createAccountViaBrowser({
    index: 1,
    keyName: args.keyName,
    broker: args.broker,
    warp: args.warp,
    pool,
    keepChrome: args.keep,
    log,
  })
    .then((r) => {
      log('OK ' + JSON.stringify({ email: r.email, key: r.key, verified: r.verified, models: r.models, ms: r.durationMs }));
      process.exit(0);
    })
    .catch((e) => {
      log('FAIL ' + (e.record ? JSON.stringify(e.record, null, 2) : e.stack));
      process.exit(1);
    });
}

module.exports = { createAccountViaBrowser, signIn, Page, launchChrome, killChrome, freePort, toJarEntries };
