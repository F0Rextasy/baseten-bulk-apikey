'use strict';

/**
 * The HTTP layer every Baseten account step goes through.
 *
 * `https.request` + `createAgent(proxy)` — not `fetch`, which ignores an
 * `agent` and would silently leak the machine's own address — with a cookie jar
 * for the WorkOS/Django chain and redirect following so a sign-up can be
 * replayed exactly as the browser performs it.
 *
 * Zero dependencies. Node.js >= 18.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { createAgent } = require('./proxy');
const { AsyncLocalStorage } = require('async_hooks');
const { uaPool } = require('./ua-pool');

// Per-account fingerprint (operator standard v3): a task wrapped in withUa()
// sends its own UA from the ua-pool; outside such a task the caller's fixed
// header stays exactly as before. Inside one, the pool UA wins over baseHeaders
// so no two accounts of a fleet share a UA.
const SESS = new AsyncLocalStorage();
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
const activeUa = (dflt) => { const s = SESS.getStore(); return (s && s.ua) || dflt; };
const withUa = (ua, fn) => SESS.run({ ua: ua || uaPool()[0] }, fn);

// --------------------------------------------------------------------- cookies

/** RFC 6265-lite jar: domain/path matching, secure flag, expiry. */
class CookieJar {
  constructor(entries = []) {
    /** @type {Map<string, {name:string, value:string, domain:string, path:string, secure:boolean, expires:number|null, hostOnly:boolean}>} */
    this.cookies = new Map();
    for (const e of entries) this.cookies.set(`${e.domain}\t${e.path}\t${e.name}`, e);
  }

  static fromJSON(list) {
    return new CookieJar(Array.isArray(list) ? list : []);
  }

  toJSON() {
    return Array.from(this.cookies.values());
  }

  /** Stores every `Set-Cookie` a response carried. */
  setFromResponse(url, setCookies) {
    const u = new URL(url);
    for (const raw of setCookies || []) {
      const parts = String(raw).split(';');
      const [name, ...valueBits] = parts[0].split('=');
      if (!name || !name.trim()) continue;
      const value = valueBits.join('=').trim();
      const cookie = {
        name: name.trim(),
        value,
        domain: u.hostname.toLowerCase(),
        path: defaultPath(u.pathname),
        secure: false,
        expires: null,
        hostOnly: true,
      };
      let maxAge = null;
      for (const attr of parts.slice(1)) {
        const [k, ...v] = attr.split('=');
        const key = k.trim().toLowerCase();
        const val = v.join('=').trim();
        if (key === 'domain' && val) {
          cookie.domain = val.replace(/^\./, '').toLowerCase();
          cookie.hostOnly = false;
        } else if (key === 'path' && val) cookie.path = val;
        else if (key === 'secure') cookie.secure = true;
        else if (key === 'httponly') cookie.httpOnly = true;
        else if (key === 'expires' && val) {
          const t = Date.parse(val);
          if (!Number.isNaN(t)) cookie.expires = t;
        } else if (key === 'max-age' && val) {
          const s = parseInt(val, 10);
          if (!Number.isNaN(s)) maxAge = s;
        }
      }
      if (maxAge !== null) cookie.expires = Date.now() + maxAge * 1000;
      if (cookie.expires !== null && cookie.expires <= Date.now()) {
        this.cookies.delete(`${cookie.domain}\t${cookie.path}\t${cookie.name}`);
        continue;
      }
      this.cookies.set(`${cookie.domain}\t${cookie.path}\t${cookie.name}`, cookie);
    }
  }

  /** `Cookie:` header value for a URL, longest path first (RFC 6265 §5.4). */
  header(url) {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const out = [];
    const matches = [];
    for (const c of this.cookies.values()) {
      if (c.expires !== null && c.expires <= Date.now()) continue;
      const domainOk = c.hostOnly ? host === c.domain : host === c.domain || host.endsWith(`.${c.domain}`);
      if (!domainOk) continue;
      if (!u.pathname.startsWith(c.path) && !(c.path === '/' || u.pathname === c.path.replace(/\/$/, ''))) continue;
      if (c.secure && u.protocol !== 'https:') continue;
      matches.push(c);
    }
    matches.sort((a, b) => b.path.length - a.path.length);
    for (const c of matches) out.push(`${c.name}=${c.value}`);
    return out.join('; ');
  }

  get(name) {
    for (const c of this.cookies.values()) if (c.name === name) return c.value;
    return null;
  }
}

function defaultPath(pathname) {
  if (!pathname || !pathname.startsWith('/')) return '/';
  const idx = pathname.lastIndexOf('/');
  if (idx <= 0) return '/';
  return pathname.slice(0, idx);
}

// --------------------------------------------------------------------- agents

/**
 * One agent per proxy line, kept alive: a free exit dies by the minute and every
 * fresh tunnel through it is another chance to lose the account mid-flow, so the
 * sign-up's back-to-back requests to the same host reuse one tunnel. Idle
 * tunnels are closed by the agent after a few seconds, and a tunnel that dies is
 * noticed on the next request, exactly as before.
 */
const agents = new Map();

function agentFor(proxy) {
  const key = `${proxy.protocol}//${proxy.host}:${proxy.port}:${proxy.connectTimeoutMs || ''}:${proxy.timeoutMs || ''}`;
  let agent = agents.get(key);
  if (!agent) {
    agent = createAgent(proxy, { keepAlive: true, maxSockets: 4 });
    agents.set(key, agent);
  }
  return agent;
}

// --------------------------------------------------------------------- request

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One request, following redirects, keeping cookies.
 *
 * @returns {Promise<{url:string, status:number, headers:object, setCookies:string[], text:string, json:any, chain:string[]}>}
 */
async function fetchUrl(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    jar = null,
    proxy = null,
    timeoutMs = 45000,
    follow = true,
    maxRedirects = 10,
    agent = undefined,
  } = options;

  const chain = [];
  let current = url;
  let currentMethod = method;
  let currentBody = body;
  let redirects = 0;

  for (;;) {
    const u = new URL(current);
    const payload =
      currentBody === undefined || currentBody === null
        ? null
        : Buffer.isBuffer(currentBody)
          ? currentBody
          : Buffer.from(typeof currentBody === 'string' ? currentBody : JSON.stringify(currentBody));

    const finalHeaders = {
      'User-Agent': activeUa(DEFAULT_UA),
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      ...headers,
    };
    // A per-account context UA overrides whatever the caller pinned.
    const sessUa = SESS.getStore() && SESS.getStore().ua;
    if (sessUa) finalHeaders['User-Agent'] = sessUa;
    if (payload && !hasHeader(finalHeaders, 'content-length')) finalHeaders['Content-Length'] = String(payload.length);
    if (payload && typeof currentBody !== 'string' && !Buffer.isBuffer(currentBody) && !hasHeader(finalHeaders, 'content-type')) {
      finalHeaders['Content-Type'] = 'application/json';
    }
    if (jar) {
      const cookie = jar.header(current);
      if (cookie) finalHeaders.Cookie = cookie;
    }

    const res = await new Promise((resolve, reject) => {
      const lib = u.protocol === 'http:' ? http : https;
      const req = lib.request(
        {
          method: currentMethod,
          host: u.hostname,
          port: u.port || (u.protocol === 'http:' ? 80 : 443),
          path: u.pathname + u.search,
          agent: agent !== undefined ? agent : proxy ? agentFor(proxy) : undefined,
          headers: finalHeaders,
        },
        resolve
      );
      req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs}ms: ${currentMethod} ${current}`)));
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });

    const setCookies = res.headers['set-cookie'] || [];
    chain.push(`${res.statusCode} ${currentMethod} ${current}`);
    if (jar) jar.setFromResponse(current, setCookies);

    let text = '';
    res.setEncoding('utf8');
    await new Promise((resolve, reject) => {
      res.on('data', (c) => (text += c));
      res.on('end', resolve);
      res.on('error', reject);
    });

    const location = res.headers.location;
    const isRedirect = [301, 302, 303, 307, 308].includes(res.statusCode) && location;
    if (follow && isRedirect && redirects < maxRedirects) {
      redirects += 1;
      current = new URL(location, current).toString();
      if (res.statusCode === 303 || ((res.statusCode === 301 || res.statusCode === 302) && currentMethod === 'POST')) {
        currentMethod = 'GET';
        currentBody = undefined;
      }
      continue;
    }

    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      /* html or plain text */
    }
    return {
      url: current,
      status: res.statusCode,
      headers: res.headers,
      setCookies,
      text,
      json,
      chain,
    };
  }
}

function hasHeader(headers, name) {
  const want = name.toLowerCase();
  return Object.keys(headers).some((h) => h.toLowerCase() === want);
}

async function fetchJson(url, options = {}) {
  const res = await fetchUrl(url, options);
  return res;
}

module.exports = { CookieJar, fetchUrl, fetchJson, sleep, activeUa, withUa, DEFAULT_UA };
