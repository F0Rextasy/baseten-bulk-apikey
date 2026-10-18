<div align="center">

```
██████╗  █████╗ ███████╗███████╗████████╗███████╗███╗   ██╗
██╔══██╗██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔════╝████╗  ██║
██████╔╝███████║███████╗█████╗     ██║   █████╗  ██╔██╗ ██║
██╔══██╗██╔══██║╚════██║██╔══╝     ██║   ██╔══╝  ██║╚██╗██║
██████╔╝██║  ██║███████║███████╗   ██║   ███████╗██║ ╚████║
╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═══╝
```

# baseten-bulk-apikey

**Bulk-create Baseten accounts with auto-generated API keys — OpenAI-compatible inference + 9Router connector.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-12%20served-412991?style=for-the-badge)](https://docs.baseten.co/)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Quick start](#-quick-start) · [🎁 Free tier](#-free-tier--how-much-you-get) · [🤖 Models](#-models--all-12-of-them) · [🧪 Use the API](#-how-to-use-the-api) · [✅ Verified](#-verified-working--every-key-is-tested) · [🧭 How it works](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Options](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Issues](#-issues)

</div>

---

## ✨ Why this exists

Baseten gives every **new workspace** its own free credits, and an API key belongs to the workspace — so *N independent keys means N accounts*. This tool drives that whole lifecycle end to end: inbox → sign-in with the e-mail code → account session → `create_user_api_key` GraphQL mutation → live verification with a real chat completion. No dashboard clicking, no key copy-pasted by hand.

## 🎁 Free tier — how much you get

**Every new Baseten workspace gets free sign-up credits — no card, e-mail sign-up — and the credit lives on the workspace, not on the key.**

| What | Value |
| --- | --- |
| Welcome allowance | free credits granted per **new workspace** at sign-up (balance shown at [app.baseten.co](https://app.baseten.co)) |
| Card required | **No** |
| What the key carries | a `PERSONAL` key scoped to its workspace, valid on all **12 model endpoints** |
| Sign-up | e-mail + 6-digit code read from the inbox |
| The unit that scales | **one workspace = one key** → `--target N` is really "N free workspaces" |

> 💡 The free tier is set by Baseten and can change. Check the live numbers at [baseten.co](https://baseten.co) — and let the tool's own gate decide:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Models — all 12 of them

A freshly minted key serves **12 model APIs** on `/v1/chat/completions` (measured 2026-10-18: every id below answered **200** from both the home line and a cold proxy exit):

> ⚠️ `GET /v1/models` is **not** a reliable health check for a fresh key: the edge answers a brand-new account's key with **202**, an empty body and `x-amzn-waf-action: challenge`, while the same key answers `/v1/chat/completions` with **200**. A key with no auth header gets a plain **401**. The tool therefore treats the chat completion as the proof and records `modelsStatus` (usually `202`) alongside it.

| Family | Model IDs |
| --- | --- |
| **Z.ai (GLM)** | `zai-org/GLM-5.3`, `zai-org/GLM-5.3-Fast`, `zai-org/GLM-5.3-Flash`, `zai-org/GLM-5.2`, `zai-org/GLM-5.2-Fast` |
| **DeepSeek** | `deepseek-ai/DeepSeek-V4.1-Flash`, `deepseek-ai/DeepSeek-V4.1-Flash-Fast`, `deepseek-ai/DeepSeek-V4-Pro-0813`, `deepseek-ai/DeepSeek-V4-Flash-0731` |
| **Moonshot** | `moonshotai/Kimi-K3` |
| **NVIDIA** | `nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B` |
| **OpenAI (open weights)** | `openai/gpt-oss-120b` |

Live probe of one key — this is exactly what the tool runs before it accepts a key:

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hi"}]}'
```

## 🧪 How to use the API

The base URL is **`https://inference.baseten.co/v1`** — OpenAI-compatible, so anything that speaks OpenAI works.

**Any SDK / curl**

```python
from openai import OpenAI
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key="<your key>")
print(client.chat.completions.create(model="zai-org/GLM-5.3-Flash",
      messages=[{"role": "user", "content": "hi"}]).choices[0].message.content)
```

**Any agent / tool with a custom base URL** (Cursor, OpenCode, Kilo Code, …): set base URL `https://inference.baseten.co/v1`, paste a key, pick any model id from the table above.

## 🛠 Quick start

```bash
# clone this repository (or download the ZIP), then:
cd baseten-bulk-apikey
node src/launcher.js          # interactive: mint / verify / settings / help
```

```bash
# account-per-key path (Chrome sign-up + Node key mint + live verification)
node src/browser-batch.js --target 30 --pool-browser proxies.txt

# older HTTP-only variant
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt \
            --inbox broker --broker http://127.0.0.1:9700
```

### 🖱️ The launcher

The launcher asks for the account count, the output file, the inbox backend and an optional proxy / proxy-list, remembers the answers in `launcher.config.json`, and runs the CLI for you.

## ✅ Verified working — every key is tested

A key is written to `keys.txt` **only after** the inference API answers with it:

| Check | Result |
| --- | --- |
| `POST https://inference.baseten.co/v1/chat/completions` (`zai-org/GLM-5.3-Flash`) as the live proof | **HTTP 200**, real completion (`finish_reason: "stop"`, `usage` present) — this is what decides the key |
| `GET https://inference.baseten.co/v1/models`, recorded per account as `modelsStatus` | `202` + `x-amzn-waf-action: challenge` for fresh keys (measured 2026-10-18; the older cohort was recorded at `200` on 2026-10-14) — recorded, **not** a rejection reason; a `401`/`403` is final and sends the account to `accounts-rejected.json` |
| accounts vs keys | one key per account — no account contributes more than one key |

```bash
node src/cli.js --verify-only --out keys.txt   # re-check the whole list at any time
```

## 🧭 How it works

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Baseten page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://inference.baseten.co/v1/chat/completions → real content = the key is live
```

| Step | Call | Notes |
| --- | --- | --- |
| sign-in | Chrome sign-in page → e-mail → 6-digit code from the inbox | driven over CDP, one window at a time |
| session | the account's cookies | the browser is closed as soon as the cookies are in hand |
| key | `POST https://app.baseten.co/graphql/` → `CreateUserApiKey` | `{ textKey, prefix }` returned exactly once |
| check | `POST https://inference.baseten.co/v1/chat/completions` | live 200 required before `keys.txt` |

## ⚙️ CLI options

**`src/browser-batch.js`** — the account-per-key path (Chrome sign-up + Node key mint + live verification):

| Flag | Default | Meaning |
| --- | --- | --- |
| `--target <n>` | `30` | how many **verified** keys the list should end up with — any N, no cap |
| `--pool-browser <file>` | — | proxy list for the browser egress (one per line) |
| `--per-run <n>` | `5` | accounts per browser session |
| `--max-failures <n>` | `5` | stop after this many consecutive failures |
| `--code-timeout <ms>` | `180000` | how long to wait for the magic-code mail |
| `--warp <socks>` | — | pin a WARP SOCKS egress |
| `--broker <url>` | — | inbox broker endpoint |

**`src/cli.js`** — the older HTTP-only variant:

| Flag | Default | Meaning |
| --- | --- | --- |
| `--count <n>` | `30` | accounts to mint |
| `--out <file>` | `keys.txt` | one verified key per line |
| `--accounts <file>` | `accounts.json` | account records (e-mail, key, prefix, exit, verification) |
| `--rejected <file>` | `accounts-rejected.json` | accounts whose key never verified |
| `--proxy` / `--proxy-file <file>` | — | egress, or a pool file |
| `--inbox <mode>` · `--broker <url>` | — | inbox backend |
| `--allow-direct` | off | permit an unproxied run |
| `--verify-only` | off | re-verify the keys in `--out` instead of minting |

Data files are fixed for `browser-batch.js` and live in the repository root: `keys.txt`, `accounts.json`, `browser-pending.json`, `browser-accounts.jsonl`.

## 🛰️ Behind a proxy

**Recommended for anything beyond a handful of accounts.** One account per key means one sign-up per key, and a proxy list gives every sign-up its own exit.

```bash
node src/browser-batch.js --target 30 --pool-browser proxies.txt
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

Proxies are loaded per line (`http://`, `socks5://`, `socks4://`, or bare `host:port`) and rotated per account, with retries on a dead line. `cli.js` refuses to run unproxied unless you pass `--allow-direct`.

## 📄 Files

| Path | Contents |
| --- | --- |
| `keys.txt` | verified keys, one per line — git-ignored, never committed |
| `accounts.json` | account records (e-mail, key, prefix) — git-ignored |
| `accounts-rejected.json` | accounts whose key never verified — useful for retries |
| `launcher.config.json` | what the launcher remembers |
| `src/connect-9router.js` | registers the keys in `keys.txt` as 9Router connections (zero-dep) |

## 🔌 Connect to 9Router

[9Router](https://9router.com) is a self-hosted, OpenAI-compatible router. Baseten ships an OpenAI-compatible endpoint, so register it once and every key becomes a connection under one provider-node:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Defaults: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Models are then served as `baseten/<model id>` and load-balanced across every key. Point the connector at a refreshed `keys.txt` to add more accounts; the node and its model list stay the same.

## 🔑 What one key gets you

| | |
| --- | --- |
| 🏢 Provider | **Baseten** — [baseten.co](https://baseten.co) |
| 🎁 What the provider gives | one account (workspace) per key — every key chat-verified on the Model APIs |
| 🔑 What one key gets you | one API key scoped to its own account: the 12 model ids on the endpoint below, at your plan's limits. The quota lives on the **account**, which is exactly why this tool creates one account per key |
| 🌐 API shape | OpenAI-compatible: `POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 Your data | only baseten.co and the inbox backend you configure are contacted; keys stay on your machine |

## 🐞 Issues

If Baseten changes the sign-in flow, the GraphQL mutation or the inbox behaviour, the tool stops at that step and says so. **[Open an issue](../../issues)** with the command you ran and the exact output; PRs are welcome.

## 📄 License

MIT © 2026 — see [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 baseten-bulk-apikey contributors

</div>
