'use strict';

/**
 * One Baseten account → one API key, over plain HTTP.
 *
 * The whole chain, as captured from the browser (see report.md) and replayed
 * here without a browser:
 *
 *   GET  api.workos.com/user_management/authorize?client_id=…&redirect_uri=…&state=…
 *   →    login.baseten.co/bootstrap → login.baseten.co/?…            (WorkOS AuthKit)
 *   POST login.baseten.co/?…            next-action=<send>   multipart  → e-mail sent
 *   POST login.baseten.co/magic-code?…  next-action=<verify> multipart  → code accepted
 *   GET  login.baseten.co/success?client_redirect_key=…
 *   →    app.baseten.co/api/auth/callback?code=…&state=…   Set-Cookie: sessionid, csrftoken
 *   POST app.baseten.co/graphql/?opName=CreateUserApiKey   → { textKey }
 *   GET  inference.baseten.co/v1/models                    Authorization: Bearer <textKey>
 *
 * Notes that cost real debugging:
 *   · the WorkOS `state` value does not have to be signed by Baseten — the
 *     payload `{"next_url":"/onboarding"}` base64url-encoded is accepted and
 *     keeps us out of app.baseten.co's AWS WAF, whose *page* routes answer a
 *     JS challenge to anything that is not a browser;
 *   · the two AuthKit POSTs are Next.js server actions: multipart bodies with
 *     `_1_<field>` names plus a bound-arguments part, and a `next-action`
 *     header holding the deployment's action id;
 *   · `/graphql/` and `/api/auth/callback` are challenge-free.
 *
 * Zero dependencies. Node.js >= 18.
 */

const fs = require('fs');
const { CookieJar, fetchUrl, sleep } = require('./http');
const { makeInbox, waitForCode } = require('./inbox');

const AUTHORIZE = 'https://api.workos.com/user_management/authorize';
const AUTHKIT = 'https://login.baseten.co';
const APP = 'https://app.baseten.co';
const GRAPHQL = `${APP}/graphql/`;
const MODELS = 'https://inference.baseten.co/v1/models';

const CLIENT_ID = process.env.BASETEN_CLIENT_ID || 'client_01GFS4WX73TQ4NQJPQ9EPCYQY7';
const REDIRECT_URI = `${APP}/api/auth/callback`;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';

/** Next.js server-action ids of the hosted AuthKit deployment. */
const SEND_ACTION = process.env.BASETEN_SEND_ACTION || '409dfdd69397fa9f326db3612977e0aa51bada7cdb';
const VERIFY_ACTION = process.env.BASETEN_VERIFY_ACTION || '407aa320ed3a3d9010c11a0a290f46c737a94ddb35';

const KEY_RE = /^[A-Za-z0-9]{8}\.[A-Za-z0-9]{32}$/;

const CHAT = 'https://inference.baseten.co/v1/chat/completions';
/** The model the verification completion asks for — small, and on every plan. */
const VERIFY_MODEL = process.env.BASETEN_VERIFY_MODEL || 'openai/gpt-oss-120b';
const VERIFY_MODEL_FALLBACK = 'deepseek-ai/DeepSeek-V4.1-Flash';

const CREATE_KEY_MUTATION = `mutation CreateUserApiKey($displayName: String) {
  createUserApiKey: create_user_api_key(display_name: $displayName) {
    id
    textKey: text_key
    created
    prefix
  }
}`;

// --------------------------------------------------------------------- helpers

const b64url = (obj) => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)).toString('base64url');

/**
 * The Radar side of the form — the browser payload captured in
 * `out/bt-post-0.txt`, complete. WorkOS's send action answers
 * `{"code":"invalid_params"}` when Radar's behavioural block (`timings`,
 * `minimalSurface`, `worker`, the four `*Hash` values, `collectionState`) is
 * missing, which is exactly what a hand-built payload gets wrong. Values are
 * this machine's real Chrome fingerprints; only the timestamps are fresh.
 */
function radarSignals() {
  const now = Date.now();
  return b64url({
    createdAtMs: now,
    timezone: 'Europe/Istanbul',
    language: 'tr-TR',
    hardwareConcurrency: 6,
    webdriver: false,
    userAgent: UA,
    appVersion: UA.replace(/^Mozilla\//, ''),
    platform: 'Win32',
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      windowOuterWidth: 0,
      windowOuterHeight: 0,
      colorDepth: 24,
      pixelDepth: 24,
    },
    rangeErrorLength: 0,
    evalStringLength: 33,
    playwrightDetected: false,
    phantomDetected: false,
    nightmareDetected: false,
    seleniumDetected: false,
    puppeteerDetected: false,
    maxTouchPoints: 0,
    deviceMemory: 16,
    notificationPermission: 'default',
    devicePixelRatio: 1,
    pluginsLength: 5,
    mimeTypesCount: 2,
    documentHidden: true,
    documentVisibilityState: 'hidden',
    mediaPreferences: {
      colorScheme: 'dark',
      reducedMotion: false,
      reducedTransparency: false,
      contrast: 'no-preference',
      colorGamut: 'srgb',
      hdr: false,
      forcedColors: false,
      invertedColors: false,
    },
    webGLVendor: 'Google Inc. (AMD)',
    webGLRenderer: 'ANGLE (AMD, Radeon RX550/550 Series (0x0000699F) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    permissionsState: 'prompt',
    collectedAtMs: now + 436,
    timings: {
      collectorsStarted: 123,
      mathHash: 184,
      intlHash: 184,
      webGLParamsHash: 184,
      windowFeatures: 184,
      cssKeys: 184,
      mediaMime: 184,
      fonts: 184,
      voices: 196,
      minimalSurface: 196,
      audioHash: 269,
      worker: 397,
      canvasHash: 436,
    },
    minimalSurface: {
      windowFeaturesHash: '0xAHK-YKBuozhiH392AiyDr2NiNjLppiB1Pvu2_koVk',
      windowFeaturesCount: 1236,
      cssKeysHash: 'rw6N-ze3twOKRedfSauRidKgM9WDfTfZ23lwe1Im4F0',
      cssKeysCount: 1384,
      mediaMimeHash: 'kZhx7yaWeGtKjuD7WOEr3WTtuDBSuluHtsXg3uGZGSw',
      mediaMimeCount: 9,
      fontsHash: 'GXFgw9Ij-6ulhSMqBJjrx0cow9qDnsipIkwlJ3uG9FY',
      fontsCount: 18,
      voicesHash: 'jEf32Komaqpq4wrSMiRB6kbXJLe286ItK-npajcP82s',
      voicesLocalCount: 1,
      voicesRemoteCount: 19,
      voicesLanguagesCount: 19,
    },
    worker: {
      ok: true,
      hardwareConcurrency: 6,
      platform: 'Win32',
      userAgent: UA,
      language: 'tr-TR',
      webGLRenderer: 'ANGLE (AMD, Radeon RX550/550 Series (0x0000699F) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      webGLVendor: 'Google Inc. (AMD)',
    },
    canvasHash: 'KXqinZgiI4ViCVx39W7vtD3IlQ5Q0cZZJr1Fef2UTk4',
    audioHash: 'xA7aObmDYWsQyPmTGHEJrH4ZiBMzccW4uG8R90E6GI8',
    mathHash: 'zK9Dnt1lDRxVL5kry2U6ScxY6YdeZxVK_WYAmIyFCC8',
    intlHash: 'tPl5hVw-eKSIG-F_5-wGsDytSvSK5YbFybts6TFWOyE',
    webGLParamsHash: 'sJ_IA4iCt1BrxY4EGJzMk1PCw3ITbKutin0m6vAKxRw',
    puppeteerDocumentNotAvailable: false,
    submittedAtMs: now + 656,
    collectionState: 'complete',
  });
}

/** multipart/form-data body for a React server action. */
function serverActionBody(fields, boundary) {
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  chunks.push(`--${boundary}--\r\n`);
  return Buffer.from(chunks.join(''), 'utf8');
}

function newBoundary() {
  let out = '----WebKitFormBoundary';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 16; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** Pulls the hidden fields the sign-in page carries in its RSC payload. */
function parseLoginPage(html) {
  const grab = (name) => {
    const re = new RegExp(`name=\\\\?"${name}\\\\?"[^>]{0,200}?value=\\\\?"([^"\\\\]{1,300})`, 'i');
    const m = html.match(re);
    return m ? m[1] : null;
  };
  const state = grab('state') || b64url({ next_url: '/onboarding' });
  return {
    client_id: grab('client_id') || CLIENT_ID,
    redirect_uri: grab('redirect_uri') || REDIRECT_URI,
    authorization_session_id: grab('authorization_session_id'),
    state,
  };
}

/** Reads the magic-code page parameters out of a server-action flight payload. */
function parseChallenge(flight) {
  const re =
    /\\?"authentication_challenge_id\\?":\\?"([^"\\]+)\\?",\\?"state\\?":\\?"([^"\\]*)\\?",\\?"redirect_uri\\?":\\?"([^"\\]*)\\?",\\?"authorization_session_id\\?":\\?"([^"\\]*)\\?",\\?"radar_auth_attempt_id\\?":\\?"([^"\\]*)\\?",\\?"radar_auth_attempt_created_at\\?":\\?"([^"\\]*)\\?"/;
  const m = flight.match(re);
  if (!m) return null;
  return {
    authentication_challenge_id: m[1],
    state: m[2],
    redirect_uri: m[3],
    authorization_session_id: m[4],
    radar_auth_attempt_id: m[5],
    radar_auth_attempt_created_at: m[6],
  };
}

// ------------------------------------------------------------------ auth flow

/** Step 1+2: authorize → sign-in page. Returns the page HTML and its fields. */
async function openSignIn({ jar, proxy, timeoutMs, log }) {
  const state = b64url({ next_url: '/onboarding' });
  const url =
    `${AUTHORIZE}?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code&provider=authkit&state=${encodeURIComponent(state)}`;
  const res = await fetchUrl(url, { jar, proxy, timeoutMs });
  if (!/E-mail|E-posta|Continue with|sign/i.test(res.text) || res.text.length < 5000) {
    throw new Error(`sign-in page not reached (${res.status}, ${res.text.length} bytes, final ${res.url.slice(0, 80)})`);
  }
  const fields = parseLoginPage(res.text);
  if (!fields.authorization_session_id) {
    const m = res.url.match(/authorization_session_id=([^&]+)/);
    if (m) fields.authorization_session_id = m[1];
  }
  if (!fields.authorization_session_id) throw new Error('no authorization_session_id on the sign-in page');
  // The action validates the body's `state` against the session's own sealed
  // state (the page sets `__Host-state-<session>`; a fabricated one earns
  // {"code":"invalid_params"}), so the session's value always wins.
  const sealed = (jar.toJSON().find((c) => /^__Host-state-/.test(c.name)) || {}).value || null;
  if (sealed) fields.state = sealed;
  log(`    sign-in page: ${res.url.slice(0, 70)}…${sealed ? ' (sealed state)' : ' (no sealed state cookie!)'}`);
  return { url: res.url, fields };
}

/**
 * Step 3: submit the address; the flight payload names the challenge.
 *
 * The same action accepts two shapes: the JS-enabled browser posts a JSON
 * argument list as `text/plain` (report §1, the wire capture), while a
 * progressive-enhancement form posts multipart `_1_<field>` parts. WorkOS
 * answers `{"code":"invalid_params"}` to the shape it did not expect, so both
 * are tried before giving up.
 */
async function submitEmail({ jar, proxy, timeoutMs, page, email }) {
  const baseHeaders = { accept: 'text/x-component', origin: AUTHKIT, referer: page.url, 'next-action': SEND_ACTION };

  const boundary = newBoundary();
  const form = serverActionBody(
    {
      _1_signals: radarSignals(),
      _1_email: email,
      _1_redirect_uri: page.fields.redirect_uri,
      _1_authorization_session_id: page.fields.authorization_session_id,
      _1_state: page.fields.state,
      0: '["$K1"]',
    },
    boundary
  );

  const shapes = [
    {
      what: 'form',
      body: form,
      headers: { ...baseHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` },
    },
    {
      what: 'json',
      body: [{ email, signals: radarSignals() }],
      headers: { ...baseHeaders, 'content-type': 'text/plain;charset=UTF-8' },
    },
  ];

  let last = null;
  for (const shape of shapes) {
    const res = await fetchUrl(page.url, { method: 'POST', jar, proxy, body: shape.body, timeoutMs, headers: shape.headers });
    if (res.status >= 400) {
      // a shape the server cannot even parse is not a verdict — try the other one
      last = res;
      continue;
    }
    const challenge = parseChallenge(res.text);
    if (challenge) return challenge;
    last = res;
    if (!/invalid_params/.test(res.text)) break; // a different complaint will not improve with the other shape
  }

  try {
    fs.writeFileSync(path.join(__dirname, '..', 'outputs', 'bt-send-response.txt'), last ? last.text : '');
  } catch (e) {
    /* diagnostics only */
  }
  throw new Error(`challenge parameters missing from the send response (${last ? last.status : '?'}, ${last ? last.text.length : 0} bytes): ${last ? last.text.slice(0, 220) : ''}`);
}

/** Step 5: submit the code — same two shapes as the send step. */
async function submitCode({ jar, proxy, timeoutMs, challenge, email, code }) {
  const url = `${AUTHKIT}/magic-code?${new URLSearchParams(challenge).toString()}`;
  const baseHeaders = { accept: 'text/x-component', origin: AUTHKIT, referer: url, 'next-action': VERIFY_ACTION };

  const boundary = newBoundary();
  const form = serverActionBody(
    {
      _1_code: code,
      _1_redirect_uri: challenge.redirect_uri,
      _1_authorization_session_id: challenge.authorization_session_id,
      _1_state: challenge.state,
      _1_email: email,
      _1_authentication_challenge_id: challenge.authentication_challenge_id,
      _1_radar_auth_attempt_id: challenge.radar_auth_attempt_id,
      _1_radar_auth_attempt_created_at: challenge.radar_auth_attempt_created_at,
      0: '["$K1"]',
    },
    boundary
  );

  const shapes = [
    { what: 'json', body: [{ code, email }], headers: { ...baseHeaders, 'content-type': 'text/plain;charset=UTF-8' } },
    { what: 'form', body: form, headers: { ...baseHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` } },
  ];

  let last = null;
  for (const shape of shapes) {
    const res = await fetchUrl(url, { method: 'POST', jar, proxy, body: shape.body, timeoutMs, headers: shape.headers });
    if (res.status >= 400) {
      last = res;
      continue;
    }
    if (/invalid_params/.test(res.text)) {
      last = res;
      continue;
    }
    if (/invalid|incorrect|expired/i.test(res.text.slice(0, 4000)) && !/success/i.test(res.text.slice(0, 4000))) {
      throw new Error(`code rejected (${shape.what}): ${res.text.slice(0, 160)}`);
    }
    return res;
  }
  try {
    fs.writeFileSync(path.join(__dirname, '..', 'outputs', 'bt-verify-response.txt'), last ? last.text : '');
  } catch (e) {
    /* diagnostics only */
  }
  throw new Error(`code submission rejected as invalid_params in both shapes: ${last ? last.text.slice(0, 220) : ''}`);
}

/**
 * Step 6: /success → app callback → the Django session cookies.
 *
 * `/success` answers 200 with a page whose payload carries the callback URL
 * (the browser follows it with JS), so the URL is fished out of the body — and
 * a plain 302 is honoured just as well, in case the deployment ever switches.
 */
async function completeSignIn({ jar, proxy, timeoutMs, authorizationSessionId, log }) {
  const success = `${AUTHKIT}/success?client_redirect_key=${encodeURIComponent(authorizationSessionId)}`;
  const res = await fetchUrl(success, { jar, proxy, timeoutMs, follow: false });
  const candidates = [];
  if (res.headers.location) candidates.push(new URL(res.headers.location, success).toString());
  for (const m of String(res.text).matchAll(/https:\/\/app\.baseten\.co\/api\/auth\/callback\?[^"'\\\s>]+/g)) candidates.push(m[0].replace(/&amp;/g, '&'));
  const callback = candidates.find((u) => /code=/.test(u));
  if (callback) await fetchUrl(callback, { jar, proxy, timeoutMs });
  const sessionid = jar.get('sessionid');
  if (!sessionid) {
    throw new Error(`no session cookie after callback (success ${res.status}, ${candidates.length} candidate urls)`);
  }
  log(`    session established (user_id ${jar.get('user_id') || '?'})`);
  return { sessionid, candidates };
}

// ------------------------------------------------------------------ the money

/** One key, exactly one, for the account this session belongs to. */
async function createKey({ jar, proxy, timeoutMs, keyName }) {
  const res = await fetchUrl(`${GRAPHQL}?opName=CreateUserApiKey`, {
    method: 'POST',
    jar,
    proxy,
    timeoutMs,
    body: { operationName: 'CreateUserApiKey', variables: { displayName: keyName }, query: CREATE_KEY_MUTATION },
    headers: {
      'content-type': 'application/json',
      accept: '*/*',
      origin: APP,
      referer: `${APP}/settings/api_keys`,
    },
  });
  const data = res.json && res.json.data && res.json.data.createUserApiKey;
  const key = data && (data.textKey || data.text_key);
  if (!key) {
    const first = res.json && res.json.errors && res.json.errors[0] && res.json.errors[0].message;
    throw new Error(`create key "${keyName}" -> ${res.status}${first ? `: ${first}` : `: ${res.text.slice(0, 140)}`}`);
  }
  return { key, id: data.id || null, prefix: data.prefix || key.slice(0, 8), raw: data };
}

/**
 * A key is only kept if the inference API answers with it.
 *
 * Two probes, because the edge treats the two routes differently (measured
 * 2026-10-14): a key minted for a brand-new account is handed an AWS-WAF
 * *challenge* — 202, empty body, `x-amzn-waf-action: challenge` — on
 * `GET /v1/models`, while `POST /chat/completions` for the same key answers
 * 200 with real usage. The challenge is attached to the key, not to the line:
 * a no-key request answers a plain 401, and a fresh key gets the same 202 from
 * the home line and from WARP alike. So a 202 on /v1/models means "this
 * account's cohort is challenged on the listing route", it is recorded as
 * `modelsStatus`, and chat is the proof that counts.
 */
async function verifyKey(key, { proxy = null, timeoutMs = 30000, model = VERIFY_MODEL, modelsOnly = false } = {}) {
  const out = {
    ok: false,
    status: 0,
    modelsStatus: null,
    models: null,
    chatStatus: null,
    via: modelsOnly ? 'models' : 'chat',
    model: modelsOnly ? null : model,
  };
  try {
    const res = await fetchUrl(MODELS, { proxy, timeoutMs, headers: { Authorization: `Bearer ${key}`, accept: 'application/json' } });
    out.modelsStatus = res.status;
    out.status = res.status;
    out.models = res.json && Array.isArray(res.json.data) ? res.json.data.length : null;
    if (res.status === 200) {
      out.ok = true;
      out.via = 'models';
      return out;
    }
    if (res.status === 401 || res.status === 403) {
      out.error = `models -> ${res.status}`; // the key itself is refused; chat cannot save it
      return out;
    }
    if (modelsOnly) {
      out.error = `models -> ${res.status}`;
      return out;
    }
  } catch (e) {
    out.error = `models: ${String(e.message).slice(0, 100)}`;
    if (modelsOnly) return out;
  }
  const models = [model, VERIFY_MODEL_FALLBACK].filter((m, i, a) => m && a.indexOf(m) === i).slice(0, 2);
  for (const m of models) {
    try {
      const res = await fetchUrl(CHAT, {
        method: 'POST',
        proxy,
        timeoutMs,
        headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json' },
        body: { model: m, messages: [{ role: 'user', content: 'say ok' }], max_tokens: 8 },
      });
      out.chatStatus = res.status;
      out.status = res.status;
      out.model = m;
      if (res.status === 200 && res.json && Array.isArray(res.json.choices) && res.json.choices.length) {
        out.ok = true;
        out.via = 'chat';
        out.usage = res.json.usage || null;
        out.error = null;
        return out;
      }
      out.error = `chat -> ${res.status}: ${String(res.text || '').replace(/\s+/g, ' ').slice(0, 140)}`;
      if (res.status === 401 || res.status === 403) return out; // key refused — the fallback model will not change that
    } catch (e) {
      out.error = `chat: ${String(e.message).slice(0, 120)}`;
    }
  }
  return out;
}

// ------------------------------------------------------------------ the whole

/**
 * Creates one account and mints its single key.
 *
 * @returns {Promise<{email, inbox, key, prefix, keyId, sessionCookies, verified, createdAt, proxy}>}
 */
async function createAccount({
  index = 1,
  keyName = null,
  proxy = null,
  pool = null,
  inboxProvider = 'broker',
  broker = 'http://127.0.0.1:9700',
  mailtrapToken = null,
  timeoutMs = 180000,
  verify = true,
  log = () => {},
} = {}) {
  const startedAt = Date.now();
  const jar = new CookieJar();
  const inbox = makeInbox({ provider: inboxProvider, proxy, broker, mailtrapToken });

  /** State lives in the cookie jar, not in the line: each request may take the
   *  next pool line, because a free exit rarely survives a whole sign-up. */
  const pick = () => (pool && pool.size && pool.alive() ? pool.next() : proxy);

  /**
   * A free exit drops the odd tunnel without being dead yet, so a step that
   * fails at the transport level gets two more goes — on fresh lines, since the
   * jar carries everything the far side knows. Business errors (an HTTP answer)
   * are final.
   */
  const networkish = /timeout after|ECONN|ECONNRESET|ETIMEDOUT|EPIPE|socket hang|tunnel|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|secureConnect/i;
  const step = async (what, fn) => {
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
      const line = pick();
      try {
        return await fn(line);
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || e);
        if (i === 2 || !networkish.test(msg)) throw e;
        const local = line && /^(127\.0\.0\.1|localhost|\[?::1\]?)$/i.test(line.host);
        if (line && pool && !local) pool.strike(line);
        log(`    ~ ${what} lost ${line ? label(line) : 'its line'}, retry ${i + 1}: ${msg.split('\n')[0].slice(0, 80)}`);
      }
    }
    throw lastErr;
  };

  // The sign-in page is fetched first, on purpose: free exits die by the minute,
  // so the line's first request must not wait for a mailbox to be minted.
  const page = await step('sign-in', (line) => openSignIn({ jar, proxy: line, timeoutMs, log }));

  const box = await inbox.create();
  log(`    inbox ${box.address} (${box.provider})`);

  const challenge = await step('magic-code send', (line) => submitEmail({ jar, proxy: line, timeoutMs, page, email: box.address }));
  log(`    code requested (challenge ${String(challenge.authentication_challenge_id).slice(0, 24)}…)`);

  const { code, subject } = await waitForCode(inbox, box, { timeoutMs, sinceMs: startedAt, log });
  log(`    code ${code} (“${subject}”)`);

  await step('magic-code verify', (line) => submitCode({ jar, proxy: line, timeoutMs, challenge, email: box.address, code }));
  await step('session', (line) => completeSignIn({ jar, proxy: line, timeoutMs, authorizationSessionId: challenge.authorization_session_id, log }));

  const name = keyName || `baseten-bulk-${index}`;
  const created = await step('create key', (line) => createKey({ jar, proxy: line, timeoutMs, keyName: name }));
  log(`    key ${created.prefix}… created`);

  let verified = false;
  if (verify) {
    const check = await verifyKey(created.key, { proxy: pick(), timeoutMs: Math.min(timeoutMs, 45000) });
    verified = check.ok;
    if (!check.ok) log(`    ! key did not verify: ${check.status || check.error}`);
  }

  return {
    email: box.address,
    inbox: { provider: box.provider, token: box.token },
    key: created.key,
    keyId: created.id,
    prefix: created.prefix,
    keyName: name,
    sessionCookies: jar.toJSON().map((c) => ({ name: c.name, domain: c.domain, path: c.path, expires: c.expires })),
    verified,
    createdAt: new Date().toISOString(),
    proxy: proxy ? `${proxy.protocol}://${proxy.host}:${proxy.port}` : null,
  };
}

module.exports = {
  createAccount,
  createKey,
  verifyKey,
  openSignIn,
  submitEmail,
  submitCode,
  completeSignIn,
  parseLoginPage,
  parseChallenge,
  radarSignals,
  serverActionBody,
  KEY_RE,
  CLIENT_ID,
  REDIRECT_URI,
  AUTHORIZE,
  GRAPHQL,
  MODELS,
  CHAT,
  VERIFY_MODEL,
  UA,
};
