'use strict';

/**
 * Disposable inboxes for the sign-up step, behind one small interface:
 *
 *   create()            -> { address, token, provider }
 *   list(box)           -> [{ id, subject, from, receivedAt, text, html }]
 *   read(box, id)       ->  { id, subject, from, text, html }
 *
 * Three backends, all over the same proxy-aware HTTP layer:
 *
 *   broker    a local inbox broker (`POST /create`, `GET /list`, `GET /read`),
 *             itself backed by Mailtrap or inboxes.com
 *   mailtrap  the Mailtrap inbound API directly (MAILTRAP_TOKEN / ~/.river-mailtrap-token)
 *   inboxes   inboxes.com's public API — any local part on one of its domains is
 *             already an inbox, so nothing has to be created
 *
 * Zero dependencies. Node.js >= 18.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { fetchUrl, sleep } = require('./http');

const MAILTRAP_API = 'https://mailtrap.io/api';
const INBOXES_API = 'https://inboxes.com/api/v2';

const stripTags = (html) =>
  String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

// ------------------------------------------------------------------- mailtrap

class MailtrapInbox {
  constructor({ proxy = null, token = null, folder = 'baseten-bulk' } = {}) {
    this.proxy = proxy;
    this.folder = folder;
    this.token = token || process.env.MAILTRAP_TOKEN || readTokenFile();
    this.folderId = null;
    this.name = 'mailtrap';
  }

  async api(method, endpoint, body) {
    const res = await fetchUrl(`${MAILTRAP_API}${endpoint}`, {
      method,
      body,
      proxy: this.proxy,
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
    });
    if (res.status >= 400) throw new Error(`mailtrap ${method} ${endpoint} -> ${res.status}: ${res.text.slice(0, 160)}`);
    return res.json;
  }

  async ensureFolder() {
    if (this.folderId) return this.folderId;
    const folders = await this.api('GET', '/inbound/folders');
    const list = Array.isArray(folders) ? folders : folders.folders || [];
    const found = list.find((f) => f.name === this.folder);
    if (found) {
      this.folderId = found.id;
      return this.folderId;
    }
    const created = await this.api('POST', '/inbound/folders', { name: this.folder });
    this.folderId = created.id;
    return this.folderId;
  }

  async create() {
    const folderId = await this.ensureFolder();
    const name = `bt${Math.random().toString(36).slice(2, 8)}`;
    const inbox = await this.api('POST', `/inbound/folders/${folderId}/inboxes`, { name });
    return { address: inbox.address, token: String(inbox.id), provider: this.name };
  }

  async list(box) {
    const data = await this.api('GET', `/inbound/inboxes/${box.token}/messages`);
    const list = Array.isArray(data) ? data : data.data || [];
    return list.map((m) => ({
      id: String(m.id),
      subject: m.subject || '',
      from: m.from_email || m.from || '',
      receivedAt: m.created_at || null,
      text: m.text_body || '',
      html: m.html_body || '',
    }));
  }

  async read(box, id) {
    const m = await this.api('GET', `/inbound/inboxes/${box.token}/messages/${id}`);
    return {
      id: String(m.id),
      subject: m.subject || '',
      from: m.from_email || m.from || '',
      receivedAt: m.created_at || null,
      text: m.text_body || '',
      html: m.html_body || '',
    };
  }
}

function readTokenFile() {
  for (const file of [path.join(os.homedir(), '.river-mailtrap-token'), path.join(os.homedir(), '.mailtrap-token')]) {
    try {
      const token = fs.readFileSync(file, 'utf8').trim();
      if (token) return token;
    } catch (e) {
      /* next */
    }
  }
  return null;
}

// -------------------------------------------------------------------- inboxes

/** inboxes.com: no create call — any local part on a published domain exists. */
class InboxesInbox {
  constructor({ proxy = null, domains = null } = {}) {
    this.proxy = proxy;
    this.domains = domains;
    this.name = 'inboxes';
  }

  async pool() {
    if (this.domains) return this.domains;
    const res = await fetchUrl(`${INBOXES_API}/domain`, { proxy: this.proxy });
    const json = res.json || {};
    const list = (json.domains || json || []).map((d) => d.qdn || d.domain || d).filter(Boolean);
    if (!list.length) throw new Error('inboxes.com published no domains');
    this.domains = list;
    return list;
  }

  async create() {
    const domains = await this.pool();
    const address = `bt${Math.random().toString(36).slice(2, 9)}@${domains[Math.floor(Math.random() * domains.length)]}`;
    return { address, token: address, provider: this.name };
  }

  async list(box) {
    const res = await fetchUrl(`${INBOXES_API}/inbox/${box.token}`, { proxy: this.proxy });
    const json = res.json || {};
    return (json.msgs || json.messages || []).map((m) => ({
      id: String(m.uid || m.id),
      subject: m.s || m.subject || '',
      from: m.f || m.from || '',
      receivedAt: m.rd ? new Date(Number(m.rd) * 1000).toISOString() : null,
      text: m.ph || '',
      html: '',
    }));
  }

  async read(box, id) {
    const res = await fetchUrl(`${INBOXES_API}/message/${id}`, { proxy: this.proxy });
    const m = res.json || {};
    return {
      id: String(m.uid || id),
      subject: m.s || m.subject || '',
      from: m.f || m.from || '',
      receivedAt: m.rd ? new Date(Number(m.rd) * 1000).toISOString() : null,
      text: m.text || '',
      html: m.html || '',
    };
  }
}

// --------------------------------------------------------------------- broker

/**
 * Talks to a local inbox broker (`as-inbox-broker.js`), which is the
 * way a Mailtrap token or a provider that needs a browser can be shared by
 * several machines. Contract: POST /create -> { address, token }.
 *
 * The broker listens on loopback, so its calls are never sent through the
 * account's proxy: a tunnelled request to 127.0.0.1 would be resolved by the
 * *proxy* and hit its machine, not this one. The broker reaches Mailtrap on its
 * own, which also keeps mail independent of proxy churn.
 */
class BrokerInbox {
  constructor({ broker = 'http://127.0.0.1:9700', folder = null } = {}) {
    this.broker = String(broker).replace(/\/$/, '');
    this.folder = folder;
    this.name = 'broker';
  }

  async create() {
    // the broker may walk its own proxy chain first: give it the full window
    const res = await fetchUrl(`${this.broker}/create`, {
      method: 'POST',
      body: this.folder ? { folder: this.folder } : {},
      timeoutMs: 180000,
    });
    if (res.status >= 400 || !res.json) throw new Error(`broker /create -> ${res.status}: ${res.text.slice(0, 140)}`);
    return { address: res.json.address, token: res.json.token, provider: `broker:${res.json.provider || 'unknown'}` };
  }

  async list(box) {
    const res = await fetchUrl(`${this.broker}/list?token=${encodeURIComponent(box.token)}`);
    return (res.json && res.json.messages) || [];
  }

  async read(box, id) {
    const res = await fetchUrl(`${this.broker}/read?id=${encodeURIComponent(id)}&token=${encodeURIComponent(box.token)}`);
    return res.json || {};
  }
}

// --------------------------------------------------------------------- shared

function makeInbox({ provider = 'broker', proxy = null, broker = null, folder = null, mailtrapToken = null, mailtrapFolder = null } = {}) {
  if (provider === 'mailtrap') {
    return new MailtrapInbox({ proxy, token: mailtrapToken, folder: mailtrapFolder || 'baseten-bulk' });
  }
  if (provider === 'inboxes' || provider === 'inboxes.com') return new InboxesInbox({ proxy });
  if (broker) return new BrokerInbox({ broker, folder });
  return new BrokerInbox({ folder });
}

/**
 * Polls the inbox until a 6-digit Baseten code shows up.
 *
 * The mail is sent by `support@mail.baseten.co` with the subject "Create your
 * Baseten account" and the code is the only six-digit number in the body; the
 * matching is tolerant to near-misses (localised subjects, HTML-only bodies)
 * because the mailbox provider decides what the body looks like.
 */
async function waitForCode(inbox, box, { sinceMs = 0, timeoutMs = 120000, pollMs = 3000, log = () => {} } = {}) {
  const deadline = Date.now() + timeoutMs;
  const inspected = new Map();
  while (Date.now() < deadline) {
    let messages = [];
    try {
      messages = await inbox.list(box);
    } catch (e) {
      log(`    inbox list failed: ${e.message}`);
      await sleep(pollMs);
      continue;
    }
    for (const m of messages) {
      const at = m.receivedAt ? Date.parse(m.receivedAt) : Date.now();
      if (sinceMs && at && at < sinceMs - 120000) continue;
      if (!/baseten/i.test(`${m.subject} ${m.from}`) && !/code/i.test(m.subject)) continue;
      let hit = matchCode(`${m.subject}\n${m.text}\n${stripTags(m.html)}`);
      // List endpoints often carry only metadata; the body lives in the detail
      // call, so an entry without a code is re-read once, never twice.
      if (!hit && !inspected.has(m.id)) {
        inspected.set(m.id, Date.now());
        try {
          const full = await inbox.read(box, m.id);
          hit = matchCode(`${full.subject || m.subject}\n${full.text}\n${stripTags(full.html)}`);
          if (hit) return { code: hit, subject: full.subject || m.subject, from: full.from || m.from, id: m.id };
        } catch (e) {
          log(`    inbox read ${m.id} failed: ${e.message}`);
        }
      } else if (hit) {
        return { code: hit, subject: m.subject, from: m.from, id: m.id };
      }
    }
    await sleep(pollMs);
  }
  throw new Error(`no magic code in ${box.address} within ${Math.round(timeoutMs / 1000)}s`);
}

function matchCode(blob) {
  const match = String(blob).match(/(?:^|\D)(\d{6})(?:\D|$)/);
  return match ? match[1] : null;
}

module.exports = { makeInbox, waitForCode, MailtrapInbox, InboxesInbox, BrokerInbox, stripTags };
