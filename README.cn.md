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

**批量创建 Baseten 账户并自动生成 API 密钥 — 兼容 OpenAI 的推理 + 9Router 连接器。**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-12%20served-412991?style=for-the-badge)](https://docs.baseten.co/)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 快速开始](#-quick-start) · [🎁 免费额度](#-free-tier--how-much-you-get) · [🤖 模型](#-models--all-12-of-them) · [🧪 使用 API](#-how-to-use-the-api) · [✅ 已验证](#-verified-working--every-key-is-tested) · [🧭 工作原理](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ 选项](#️-cli-options) · [🛰️ 代理](#️-behind-a-proxy) · [🐞 问题反馈](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ 为什么会有这个项目

Baseten 为每个**新工作区**提供独立的免费额度，而 API 密钥属于工作区——所以 *N 个独立密钥意味着 N 个账户*。这个工具端到端地驱动整个生命周期：收件箱 → 用邮件验证码登录 → 账户会话 → `create_user_api_key` GraphQL 变更 → 用真实的聊天补全进行实时验证。无需点击仪表盘，无需手动复制粘贴密钥。

## 🎁 免费额度 — 你能获得多少

**每个新的 Baseten 工作区在注册时都会获得免费额度——无需信用卡，邮箱注册即可——额度属于工作区，而不是密钥。**

| 项目 | 值 |
| --- | --- |
| 欢迎额度 | 注册时每个**新工作区**获得的免费额度（余额可在 [app.baseten.co](https://app.baseten.co) 查看） |
| 是否需要信用卡 | **否** |
| 密钥承载的内容 | 一个作用域为其工作区的 `PERSONAL` 密钥，在全部 **12 个模型端点**上有效 |
| 注册方式 | 邮箱 + 从收件箱读取的 6 位验证码 |
| 可扩展的单位 | **一个工作区 = 一个密钥** → `--target N` 实际上就是「N 个免费工作区」 |

> 💡 免费额度由 Baseten 设定，可能发生变化。请查看 [baseten.co](https://baseten.co) 上的实时数据——并让工具自身的关卡来做判断：

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 模型 — 全部 12 个

新生成的密钥可在 `/v1/chat/completions` 上使用 **12 个模型 API**（测量于 2026-10-18：以下每个 id 从本地线路和冷代理出口均返回 **200**）：

> ⚠️ `GET /v1/models` **不是**新密钥的可靠健康检查：边缘节点对全新账户的密钥返回 **202**、空响应体和 `x-amzn-waf-action: challenge`，而同一个密钥对 `/v1/chat/completions` 却返回 **200**。没有认证头的密钥会得到普通的 **401**。因此工具以聊天补全作为证明，并同时记录 `modelsStatus`（通常为 `202`）。

|模型|✓|
|---|---|
|`zai-org/GLM-5.3`|✓|
|`zai-org/GLM-5.3-Fast`|✓|
|`zai-org/GLM-5.3-Flash`|✓|
|`zai-org/GLM-5.2`|✓|
|`zai-org/GLM-5.2-Fast`|✓|
|`deepseek-ai/DeepSeek-V4.1-Flash`|✓|
|`deepseek-ai/DeepSeek-V4.1-Flash-Fast`|✓|
|`deepseek-ai/DeepSeek-V4-Pro-0813`|✓|
|`deepseek-ai/DeepSeek-V4-Flash-0731`|✓|
|`moonshotai/Kimi-K3`|✓|
|`nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B`|✓|
|`openai/gpt-oss-120b`|✓|

对单个密钥的实时探测——这正是工具在接受密钥之前所运行的：

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hi"}]}'
```

## 🧪 如何使用 API

基础 URL 是 **`https://inference.baseten.co/v1`**——兼容 OpenAI，因此任何支持 OpenAI 的工具都能使用。

**任意 SDK / curl**

```python
from openai import OpenAI
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key="<your key>")
print(client.chat.completions.create(model="zai-org/GLM-5.3-Flash",
      messages=[{"role": "user", "content": "hi"}]).choices[0].message.content)
```

**任何支持自定义基础 URL 的 agent / 工具**（Cursor、OpenCode、Kilo Code 等）：设置基础 URL 为 `https://inference.baseten.co/v1`，粘贴一个密钥，从上面的表格中选择任意模型 id。

## 🛠 快速开始

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

### 🖱️ 启动器

启动器会询问账户数量、输出文件、收件箱后端以及可选的代理 / 代理列表，将答案记录在 `launcher.config.json` 中，并为你运行 CLI。

## ✅ 已验证可用 — 每个密钥都经过测试

只有当推理 API 用该密钥成功响应后，密钥才会被写入 `keys.txt`：

| 检查 | 结果 |
| --- | --- |
| `POST https://inference.baseten.co/v1/chat/completions`（`zai-org/GLM-5.3-Flash`）作为实时证明 | **HTTP 200**，真实补全（`finish_reason: "stop"`，存在 `usage`）——决定性检查 |
| `GET https://inference.baseten.co/v1/models`，按账户记录为 `modelsStatus` | 新密钥为 `202` + waf 挑战；较早批次为 `200`；`401`/`403` 最终 → `accounts-rejected.json` |
| 账户与密钥 | 每个账户一个密钥——没有任何账户贡献超过一个密钥 |

```bash
node src/cli.js --verify-only --out keys.txt   # re-check the whole list at any time
```

## 🧭 工作原理

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Baseten page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://inference.baseten.co/v1/chat/completions → real content = the key is live
```

| 步骤 | 调用 | 说明 |
| --- | --- | --- |
| 登录 | Chrome 登录页 → 邮箱 → 从收件箱获取 6 位验证码 | 通过 CDP 驱动，一次一个窗口 |
| 会话 | 账户的 cookies | 一旦拿到 cookies 就立即关闭浏览器 |
| 密钥 | `POST https://app.baseten.co/graphql/` → `CreateUserApiKey` | `{ textKey, prefix }` 仅返回一次 |
| 检查 | `POST https://inference.baseten.co/v1/chat/completions` | 写入 `keys.txt` 前必须实时返回 200 |

## ⚙️ CLI 选项

**`src/browser-batch.js`** — 每密钥一账户的路径（Chrome 注册 + Node 生成密钥 + 实时验证）：

| 标志 | 默认值 | 含义 |
| --- | --- | --- |
| `--target <n>` | `30` | 列表最终应包含多少个**已验证**密钥——任意 N，无上限 |
| `--pool-browser <file>` | — | 浏览器出口的代理列表（每行一个） |
| `--per-run <n>` | `5` | 每个浏览器会话的账户数 |
| `--max-failures <n>` | `5` | 连续失败达到此数量后停止 |
| `--code-timeout <ms>` | `180000` | 等待魔法验证码邮件的时间 |
| `--warp <socks>` | — | 固定一个 WARP SOCKS 出口 |
| `--broker <url>` | — | 收件箱 broker 端点 |

**`src/cli.js`** — 较早的纯 HTTP 变体：

| 标志 | 默认值 | 含义 |
| --- | --- | --- |
| `--count <n>` | `30` | 要生成的账户数 |
| `--out <file>` | `keys.txt` | 每行一个已验证密钥 |
| `--accounts <file>` | `accounts.json` | 账户记录（邮箱、密钥、前缀、出口、验证） |
| `--rejected <file>` | `accounts-rejected.json` | 密钥从未通过验证的账户 |
| `--proxy` / `--proxy-file <file>` | — | 出口，或代理池文件 |
| `--inbox <mode>` · `--broker <url>` | — | 收件箱后端 |
| `--allow-direct` | 关闭 | 允许无代理运行 |
| `--verify-only` | 关闭 | 重新验证 `--out` 中的密钥，而不是生成新密钥 |

`browser-batch.js` 的数据文件是固定的，位于仓库根目录：`keys.txt`、`accounts.json`、`browser-pending.json`、`browser-accounts.jsonl`。

## 🛰️ 在代理之后

**只要账户数量超过少数几个，就推荐使用。** 每个密钥一个账户意味着每个密钥一次注册，而代理列表让每次注册都有自己的出口。

```bash
node src/browser-batch.js --target 30 --pool-browser proxies.txt
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

代理按行加载（`http://`、`socks5://`、`socks4://` 或裸 `host:port`），并按账户轮换，线路失效时会重试。`cli.js` 拒绝在无代理的情况下运行，除非你传入 `--allow-direct`。

## 📄 文件

| 路径 | 内容 |
| --- | --- |
| `keys.txt` | 已验证的密钥，每行一个——已被 git 忽略，绝不提交 |
| `accounts.json` | 账户记录（邮箱、密钥、前缀）——已被 git 忽略 |
| `accounts-rejected.json` | 密钥从未通过验证的账户——可用于重试 |
| `launcher.config.json` | 启动器记住的内容 |
| `src/connect-9router.js` | 将 `keys.txt` 中的密钥注册为 9Router 连接（零依赖） |

## 🔌 连接到 9Router

[9Router](https://9router.com) 是一个自托管、兼容 OpenAI 的路由器。Baseten 提供兼容 OpenAI 的端点，因此只需注册一次，每个密钥都会成为同一个 provider 节点下的一个连接：

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

默认值：`--base http://localhost:20128`、`--password 123456`、`--name "Baseten"`、`--prefix baseten`、`--base-url https://inference.baseten.co/v1`、`--model openai/gpt-oss-120b`。模型随后以 `baseten/<model id>` 的形式提供，并在所有密钥之间负载均衡。将连接器指向刷新后的 `keys.txt` 即可添加更多账户；节点及其模型列表保持不变。

## 🔑 一个密钥能给你什么

| | |
| --- | --- |
| 🏢 提供商 | **Baseten** — [baseten.co](https://baseten.co) |
| 🎁 提供商提供的内容 | 每个密钥一个账户（工作区）——每个密钥都在 Model APIs 上经过聊天验证 |
| 🔑 一个密钥能给你什么 | 一个作用域为其自身账户的 API 密钥：下方端点上的 12 个模型 id，受你的套餐限制。配额属于**账户**，这正是本工具为每个密钥创建一个账户的原因 |
| 🌐 API 形态 | 兼容 OpenAI：`POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 你的数据 | 仅联系 baseten.co 和你配置的收件箱后端；密钥保留在你的机器上 |

## 🐞 问题反馈

如果 Baseten 更改了登录流程、GraphQL 变更或收件箱行为，工具会在该步骤停止并说明原因。**[提交 issue](../../issues)**，附上你运行的命令和确切输出；欢迎 PR。

## 📄 许可证

MIT © 2026 — 见 [LICENSE](LICENSE)。

<div align="center">

**[MIT](LICENSE)** © 2026 baseten-bulk-apikey contributors

</div>

## ⚡ 运行形态（预设）

`--preset=turbo|balanced|safe` 设置 worker 数量 + 账户之间的暂停时间（turbo = 5，
balanced = 4，safe = 2）；显式的 `--conc`/`--gap`（或仓库自身的标志）始终优先，
而不带 `--preset` 时，工具完全保持其历史形态。

Turbo önerilir (5 worker); daha fazlası zayıf bilgisayarda yük/ban riski.