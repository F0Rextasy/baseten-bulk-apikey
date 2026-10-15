<div align="center">

```
███████╗ ██████╗ ██████╗ ███████╗██╗  ██╗████████╗ █████╗ ███████╗██╗   ██╗
██╔════╝██╔═████╗██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝██╔══██╗██╔════╝╚██╗ ██╔╝
█████╗  ██║██╔██║██████╔╝█████╗   ╚███╔╝    ██║   ███████║███████╗ ╚████╔╝
██╔══╝  ████╔╝██║██╔══██╗██╔══╝   ██╔██╗    ██║   ██╔══██║╚════██║  ╚██╔╝
██║     ╚██████╔╝██║  ██║███████╗██╔╝ ██╗   ██║   ██║  ██║███████║   ██║
╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝   ╚═╝
```

# baseten-bulk-apikey

**One Baseten account → one API key. Mint as many as you need — accounts, keys and verification, without touching the dashboard.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/model%20APIs-12-412991?style=for-the-badge&logo=openai&logoColor=white)](https://docs.baseten.co/)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Quick start](#-quick-start) · [✅ Verified](#-verified-working--every-key-is-tested) · [🧭 How it works](#-how-it-works) · [🤖 Models & free tier](#-models--free-tier) · [🔑 What one key gets you](#-what-one-key-gets-you) · [⚙️ Options](#️-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Issues](#-issues)

</div>

---

> **Mint as many accounts/keys as you need — there is no cap.** `--target N` / `--count N` (default `30`)
> accepts any N.

## ✨ Why this exists

Baseten gives every **new workspace** its own free credits, and an API key belongs to the workspace —
so *N independent keys means N accounts*. This tool drives that whole lifecycle end to end: inbox →
sign-in with the e-mail code → account session → `create_user_api_key` GraphQL mutation → live
verification with a real chat completion. No dashboard clicking, no key copy-pasted by hand.

## 🤖 Models & free tier

A freshly minted key answers `GET https://inference.baseten.co/v1/models` with **12 model APIs**:

| Model ID | Notes |
| --- | --- |
| `zai-org/GLM-5.3`, `zai-org/GLM-5.3-Fast`, `zai-org/GLM-5.3-Flash` | GLM 5.3 family, fast + flash variants |
| `zai-org/GLM-5.2`, `zai-org/GLM-5.2-Fast` | previous GLM generation |
| `deepseek-ai/DeepSeek-V4.1-Flash`, `deepseek-ai/DeepSeek-V4.1-Flash-Fast` | DeepSeek V4.1 flash |
| `deepseek-ai/DeepSeek-V4-Pro-0813`, `deepseek-ai/DeepSeek-V4-Flash-0731` | DeepSeek V4 pro / flash |
| `moonshotai/Kimi-K3` | Moonshot Kimi K3 |
| `nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B` | NVIDIA Nemotron 3 Ultra |
| `openai/gpt-oss-120b` | OpenAI's open-weight 120B |

**The free tier is a workspace, not a key.** Baseten hands every **new workspace** free credits at
sign-up (e-mail sign-up, **no card**), and the credits live on the workspace. That is exactly the unit
this tool multiplies: **one account per key**, each account being a fresh workspace with its own
sign-up credits — so `--target N` is really "N free workspaces".

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hi"}]}'
```

> 💡 Credit amounts, model prices and rate limits are set by Baseten on your plan and change over time.
> The remaining balance is shown in the dashboard at [app.baseten.co](https://app.baseten.co) — free
> credits are a sign-up bonus, not an endless supply, so check the balance before you burn through it.

## 🔑 What one key gets you

| | |
| --- | --- |
| 🏢 Provider | **Baseten** — [baseten.co](https://baseten.co) · dashboard at [app.baseten.co](https://app.baseten.co) |
| 🎁 What the provider gives | A free workspace (e-mail sign-up, **no card**) with free credits on the workspace, plus OpenAI-compatible **Model APIs** |
| 🔑 What one key gets you | A `PERSONAL` key scoped to its workspace: all **12 model endpoints above**, at your plan's limits. Credit lives on the **workspace**, which is exactly why this tool creates one account per key |
| 🌐 API shape | OpenAI-compatible: `POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 Your data | Only the inbox broker, the sign-in host, `app.baseten.co/graphql/` and `inference.baseten.co` are contacted; keys stay on your machine |

## 🧭 How it works

```
inbox (broker: Mailtrap / inboxes.com, one address per account)      a fresh address per account
   │
   ├─▶ Chrome: sign-in page → e-mail → 6-digit code from the inbox
   ├─▶ Chrome: code → account session cookies
   ├─▶ Node:   POST https://app.baseten.co/graphql/  → CreateUserApiKey → { textKey, prefix }
   │        (the key text is returned exactly once — it is written to disk immediately)
   └─▶ Node:   POST https://inference.baseten.co/v1/chat/completions  → real content = key is live
```

The sign-up half runs in a real Chrome (driven over CDP, one window at a time, closed as soon as the
session cookies are in hand) because the sign-in page issues its own request; the key-minting and
verification half is plain Node over HTTP. `browser-batch.js` is that account-per-key path;
`cli.js` is an older pure-HTTP variant kept for reference.

## 🛠 Quick start

```bash
git clone https://github.com/F0Rextasy/baseten-bulk-apikey.git
cd baseten-bulk-apikey
node launcher.js          # interactive: mint / verify / settings / help
```

### 🖱️ The launcher

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  ███████╗ ██████╗ ██████╗ ███████╗██╗  ██╗████████╗ █████╗ ███████╗██╗   ██╗  ║
║  ██╔════╝██╔═████╗██╔══██╗██╔════╝╚██╗██╔╝╚══██╔══╝██╔══██╗██╔════╝╚██╗ ██╔╝  ║
║  █████╗  ██║██╔██║██████╔╝█████╗   ╚███╔╝    ██║   ███████║███████╗ ╚████╔╝   ║
║  ██╔══╝  ████╔╝██║██╔══██╗██╔══╝   ██╔██╗    ██║   ██╔══██║╚════██║  ╚██╔╝    ║
║  ██║     ╚██████╔╝██║  ██║███████╗██╔╝ ██╗   ██║   ██║  ██║███████║   ██║     ║
║  ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝   ╚═╝     ║
║  baseten-bulk-apikey                                                          ║
║  one account → one key, any number                                            ║
╚═══════════════════════════════════════════════════════════════════════════════╝
  github.com/F0Rextasy · x.com/bigbullapp
```

It asks for the account count, the output file, the inbox backend and an optional proxy / proxy-list,
remembers the answers in `launcher.config.json`, and runs the CLI for you.

### ⌨️ Directly

```bash
# account-per-key path (Chrome sign-up + Node key mint + live verification)
node browser-batch.js --target 30 --pool-browser proxies.txt

# older HTTP-only variant
node cli.js --count 30 --out keys.txt --proxy-file proxies.txt \
            --inbox broker --broker http://127.0.0.1:9700
```

```
  accounts  : 0/30 · inbox broker · 1 proxy line(s)
  [1] <your-mailtrap-inbox> · magic code 7310… · key <key> → chat 200
  …
  accounts  : 30/30 · verified 30 · keys.txt (one key per line)
```

`--target` / `--count` take any number; the file already on disk counts towards it, so a re-run
continues where the last one stopped.

## ✅ Verified working — every key is tested

A key is written to `keys.txt` **only after** the inference API answers with it:

| Check | Result |
| --- | --- |
| `GET https://inference.baseten.co/v1/models` for **every** key right after creation | recorded per account in `accounts.json`; a key that fails goes to `accounts-rejected.json` instead of the list |
| `POST https://inference.baseten.co/v1/chat/completions` (`zai-org/GLM-5.3-Flash`) as the live proof | **HTTP 200**, real completion (`content: "ok"`, `finish_reason: "stop"`) |
| Accounts vs keys | one key per account — no account contributes more than one key |

```bash
node cli.js --verify-only --out keys.txt   # re-check the whole list at any time
```

## ⚙️ Options

| Flag | Default | Meaning |
| --- | --- | --- |
| `--target <n>` | `30` | how many **verified** keys the list should end up with — any N, no cap |
| `--out <file>` | `keys.txt` | one verified key per line |
| `--accounts <file>` | `accounts.json` | account records (e-mail, key, prefix, exit, verification) |
| `--pool-browser <file>` | — | proxy list for the browser egress (one per line) |
| `--max-failures <n>` | `5` | stop after this many consecutive failures |
| `--code-timeout <ms>` | `180000` | how long to wait for the magic-code mail |
| `--verify-only` | off | re-verify the keys in `--out` instead of minting |

The older `cli.js` path takes `--count`, `--out`, `--proxy` / `--proxy-file`, `--inbox`, `--broker`
and `--allow-direct`.

A key is written to `keys.txt` **only after** the live chat check passes; accounts whose mint or
verification failed are kept in `browser-pending.json` / `accounts.json` so nothing is lost.

## 🛰️ Behind a proxy

**Recommended for anything beyond a handful of accounts.** One account per key means one sign-up per
key, and a proxy list gives every sign-up its own exit.

```bash
node browser-batch.js --target 30 --pool-browser proxies.txt
node cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

Proxies are loaded per line (`http://`, `socks5://`, `socks4://`, or bare `host:port`) and rotated per
account, with retries on a dead line. `cli.js` refuses to run unproxied unless you pass
`--allow-direct`, so there is no accidental leak of your own address.

## 📄 Files

| Path | Contents |
| --- | --- |
| `keys.txt` | verified keys, one per line — git-ignored, never committed |
| `accounts.json` | account records (e-mail, key, prefix) — git-ignored |
| `accounts-rejected.json` | accounts whose key never verified — useful for retries |
| `launcher.config.json` | what the launcher remembers |

## 🐞 Issues

If Baseten changes the sign-in flow, the GraphQL mutation or the inbox behaviour, the tool stops at
that step and says so. **[Open an issue](https://github.com/F0Rextasy/baseten-bulk-apikey/issues)**
with the command you ran and the exact output; PRs are welcome.

## 📄 License

MIT © 2026 — see [LICENSE](LICENSE). Baseten's own terms and rate limits apply to whatever you do with
the keys; use this for your own accounts.

<div align="center">

**[github.com/F0Rextasy](https://github.com/F0Rextasy)** · **[x.com/bigbullapp](https://x.com/bigbullapp)**

</div>
