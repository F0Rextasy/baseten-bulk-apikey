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

**自動生成された API キーで Baseten アカウントを一括作成 — OpenAI 互換の推論 + 9Router コネクタ。**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-12%20served-412991?style=for-the-badge)](https://docs.baseten.co/)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 クイックスタート](#-quick-start) · [🎁 無料枠](#-free-tier--how-much-you-get) · [🤖 モデル](#-models--all-12-of-them) · [🧪 API の使い方](#-how-to-use-the-api) · [✅ 検証済み](#-verified-working--every-key-is-tested) · [🧭 仕組み](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ オプション](#️-cli-options) · [🛰️ プロキシ](#️-behind-a-proxy) · [🐞 問題](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ なぜこれが存在するのか

Baseten は**新しいワークスペース**ごとに無料クレジットを付与し、API キーはワークスペースに属します — つまり *N 個の独立したキーとは N 個のアカウントを意味します*。このツールはそのライフサイクル全体を端から端まで自動化します: 受信トレイ → メールコードでサインイン → アカウントセッション → `create_user_api_key` GraphQL ミューテーション → 実際のチャット補完によるライブ検証。ダッシュボードをクリックする必要も、手でキーをコピー＆ペーストする必要もありません。

## 🎁 無料枠 — どれだけ得られるか

**新しい Baseten ワークスペースごとに無料のサインアップクレジットが付与されます — カード不要、メールでサインアップ — そしてクレジットはキーではなくワークスペースに紐づきます。**

| 項目 | 値 |
| --- | --- |
| ウェルカム枠 | サインアップ時に**新しいワークスペース**ごとに付与される無料クレジット（残高は [app.baseten.co](https://app.baseten.co) で確認） |
| カード必須 | **いいえ** |
| キーが持つもの | ワークスペースにスコープされた `PERSONAL` キーで、**12 個のモデルエンドポイント**すべてで有効 |
| サインアップ | メール + 受信トレイから読み取る 6 桁コード |
| スケールする単位 | **1 ワークスペース = 1 キー** → `--target N` は実質「N 個の無料ワークスペース」 |

> 💡 無料枠は Baseten が設定するもので、変更される可能性があります。最新の数値は [baseten.co](https://baseten.co) で確認してください — そしてツール自身のゲートに判断を委ねてください:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 モデル — 全 12 個

新しく発行されたキーは `/v1/chat/completions` 上で **12 個のモデル API** を提供します（2026-10-18 に計測: 以下のすべての id が自宅回線とコールドプロキシ出口の両方から **200** を返しました）:

> ⚠️ `GET /v1/models` は新しいキーにとって**信頼できるヘルスチェックではありません**: エッジは真新しいアカウントのキーに対して **202**、空のボディ、`x-amzn-waf-action: challenge` を返しますが、同じキーが `/v1/chat/completions` には **200** を返します。認証ヘッダーのないキーは単純に **401** を受け取ります。そのためツールはチャット補完を証明として扱い、それと併せて `modelsStatus`（通常は `202`）を記録します。

|モデル|✓|
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

1 つのキーのライブプローブ — これはツールがキーを受け入れる前に実行するものとまったく同じです:

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hi"}]}'
```

## 🧪 API の使い方

ベース URL は **`https://inference.baseten.co/v1`** です — OpenAI 互換なので、OpenAI を扱えるものなら何でも動作します。

**任意の SDK / curl**

```python
from openai import OpenAI
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key="<your key>")
print(client.chat.completions.create(model="zai-org/GLM-5.3-Flash",
      messages=[{"role": "user", "content": "hi"}]).choices[0].message.content)
```

**カスタムベース URL を持つ任意のエージェント / ツール**（Cursor、OpenCode、Kilo Code など）: ベース URL を `https://inference.baseten.co/v1` に設定し、キーを貼り付け、上の表から任意のモデル id を選択してください。

## 🛠 クイックスタート

```bash
# clone this repository (or download the ZIP), then:
cd baseten-bulk-apikey
node src/launcher.js          # interactive: mint / verify / settings / help
```

```bash
# account-per-key path (Chrome sign-up + Node key mint + live verification)
node src/browser-batch.js --target 30 --pool-browser proxies.txt   # the pool is optional — no file = direct

# older HTTP-only variant
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt \
            --inbox broker --broker http://127.0.0.1:9700
```

### 🖱️ ランチャー

ランチャーはアカウント数、出力ファイル、受信トレイバックエンド、およびオプションのプロキシ / プロキシリストを尋ね、回答を `launcher.config.json` に記憶し、あなたの代わりに CLI を実行します。

## ✅ 動作検証済み — すべてのキーがテストされています

> **品質ゲート。** ここにあるすべてのキーは、`keys.txt` に書き込まれる前にライブの `chat-200` を通過しています
> （死んだキーは決して出荷されません）。ルーターの組み合わせもモデルレベルで同じルールに従います: エントリは
> **モデルが `chat-200` を返し、ツールを呼び出せる場合にのみ**追加されます — ツールサポートのないモデル、
> 死んだキー、死んだプロバイダーは追加される代わりに除外されます。**9Router と OmniRoute** で動作します。

キーは、推論 API がそれで応答した**後にのみ** `keys.txt` に書き込まれます:

| チェック | 結果 |
| --- | --- |
| `POST https://inference.baseten.co/v1/chat/completions`（`zai-org/GLM-5.3-Flash`）をライブ証明として | **HTTP 200**、実際の補完（`finish_reason: "stop"`、`usage` あり）— 決定的なチェック |
| `GET https://inference.baseten.co/v1/models`、アカウントごとに `modelsStatus` として記録 | 新しいキーには `202` + waf チャレンジ; 古いコホートは `200`; `401`/`403` は最終的に → `accounts-rejected.json` |
| アカウント対キー | アカウントごとに 1 キー — どのアカウントも 1 つ以上のキーを提供しません |

```bash
node src/cli.js --verify-only --out keys.txt   # re-check the whole list at any time
```

## 🧭 仕組み

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Baseten page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://inference.baseten.co/v1/chat/completions → real content = the key is live
```

| ステップ | 呼び出し | 備考 |
| --- | --- | --- |
| サインイン | Chrome サインインページ → メール → 受信トレイからの 6 桁コード | CDP 経由で駆動、一度に 1 ウィンドウ |
| セッション | アカウントの Cookie | Cookie を取得したらすぐにブラウザを閉じる |
| キー | `POST https://app.baseten.co/graphql/` → `CreateUserApiKey` | `{ textKey, prefix }` は一度だけ返される |
| チェック | `POST https://inference.baseten.co/v1/chat/completions` | `keys.txt` の前にライブ 200 が必須 |

## ⚙️ CLI オプション

**`src/browser-batch.js`** — アカウントごとに 1 キーのパス（Chrome サインアップ + Node キー発行 + ライブ検証）:

| フラグ | デフォルト | 意味 |
| --- | --- | --- |
| `--target <n>` | `30` | リストが最終的に持つべき**検証済み**キーの数 — 任意の N、上限なし |
| `--pool-browser <file>` | — | ブラウザの出口用プロキシリスト（1 行に 1 つ） |
| `--per-run <n>` | `5` | ブラウザセッションごとのアカウント数 |
| `--max-failures <n>` | `5` | この回数の連続失敗後に停止 |
| `--code-timeout <ms>` | `180000` | マジックコードメールを待つ時間 |
| `--warp <socks>` | — | プロキシ SOCKS 出口を固定 |
| `--broker <url>` | — | 受信トレイブローカーのエンドポイント |

**`src/cli.js`** — 古い HTTP のみのバリアント:

| フラグ | デフォルト | 意味 |
| --- | --- | --- |
| `--count <n>` | `30` | 発行するアカウント数 |
| `--out <file>` | `keys.txt` | 1 行に 1 つの検証済みキー |
| `--accounts <file>` | `accounts.json` | アカウントレコード（メール、キー、プレフィックス、出口、検証） |
| `--rejected <file>` | `accounts-rejected.json` | キーが検証されなかったアカウント |
| `--proxy` / `--proxy-file <file>` | — | 出口、またはプールファイル |
| `--inbox <mode>` · `--broker <url>` | — | 受信トレイバックエンド |
| `--allow-direct` | オフ | 互換性のために受け入れられる — プロキシリストなしの実行はデフォルトで直接 |
| `--verify-only` | オフ | 発行する代わりに `--out` のキーを再検証 |

データファイルは `browser-batch.js` では固定されており、リポジトリのルートにあります: `keys.txt`、`accounts.json`、`browser-pending.json`、`browser-accounts.jsonl`。

## 🛰️ プロキシの背後で

**オプション — 大規模な場合は推奨（IP ごとの制限、BAN）。** ツールはプロキシなしでも動作します: `--proxy`/`--proxy-file` がなく（`proxies.txt` の行もなく）、すべての呼び出しが自分のマシンから出て、実行はそのホップを `direct` としてログに記録します。

```bash
node src/browser-batch.js --target 30 --pool-browser proxies.txt
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

プロキシは 1 行ごとに読み込まれ（`http://`、`socks5://`、`socks4://`、または素の `host:port`）、アカウントごとにローテーションされ、死んだ回線ではリトライされます。プロキシリストなしの実行はデフォルトで直接です（`--allow-direct` はまだ受け入れられますが、もはや必要ありません）。

## 📄 ファイル

| パス | 内容 |
| --- | --- |
| `keys.txt` | 検証済みキー、1 行に 1 つ — git で無視、決してコミットされない |
| `accounts.json` | アカウントレコード（メール、キー、プレフィックス）— git で無視 |
| `accounts-rejected.json` | キーが検証されなかったアカウント — リトライに便利 |
| `launcher.config.json` | ランチャーが記憶するもの |
| `src/connect-9router.js` | `keys.txt` のキーを 9Router 接続として登録（ゼロ依存） |

## 🔌 9Router に接続

[9Router](https://9router.com) はセルフホスト型の OpenAI 互換ルーターです。Baseten は OpenAI 互換エンドポイントを提供しているので、一度登録すればすべてのキーが 1 つのプロバイダーノードの下の接続になります:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

デフォルト: `--base http://localhost:20128`、`--password 123456`、`--name "Baseten"`、`--prefix baseten`、`--base-url https://inference.baseten.co/v1`、`--model openai/gpt-oss-120b`。モデルは `baseten/<model id>` として提供され、すべてのキーにわたって負荷分散されます。コネクタを更新された `keys.txt` に向けてさらにアカウントを追加してください; ノードとそのモデルリストは同じままです。

## 🔌 OmniRoute に接続

[OmniRoute](https://omniroute.online) はセルフホスト型の OpenAI 互換ルーターです。Baseten は OpenAI 互換エンドポイントを提供しているので、一度登録すればすべてのキーが 1 つのプロバイダーノードの下の接続になります:

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

デフォルト: `--base http://localhost:20128`、`--password 123456`、`--name "Baseten"`、`--prefix baseten`、`--base-url https://inference.baseten.co/v1`、`--model openai/gpt-oss-120b`。モデルは `baseten/<model id>` として提供され、すべてのキーにわたって負荷分散されます。コネクタを更新された `keys.txt` に向けてさらにアカウントを追加してください; ノードとそのモデルリストは同じままです。
## 🔑 1 つのキーで得られるもの

| | |
| --- | --- |
| 🏢 プロバイダー | **Baseten** — [baseten.co](https://baseten.co) |
| 🎁 プロバイダーが提供するもの | キーごとに 1 アカウント（ワークスペース）— すべてのキーが Model APIs でチャット検証済み |
| 🔑 1 つのキーで得られるもの | 独自のアカウントにスコープされた 1 つの API キー: 以下のエンドポイント上の 12 個のモデル id、あなたのプランの制限で。クォータは**アカウント**に紐づき、まさにそれがこのツールがキーごとに 1 アカウントを作成する理由です |
| 🌐 API の形 | OpenAI 互換: `POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 あなたのデータ | 接触するのは baseten.co とあなたが設定した受信トレイバックエンドのみ; キーはあなたのマシンに留まります |

## 🐞 問題

Baseten がサインインフロー、GraphQL ミューテーション、または受信トレイの動作を変更した場合、ツールはそのステップで停止し、その旨を伝えます。実行したコマンドと正確な出力を添えて**[issue を開いてください](../../issues)**; PR も歓迎します。

## 📄 ライセンス

MIT © 2026 — [LICENSE](LICENSE) を参照。

<div align="center">

**[MIT](LICENSE)** © 2026 baseten-bulk-apikey contributors

</div>

## ⚡ 実行形態（プリセット）

`--preset=turbo|balanced|safe` はワーカー数 + アカウント間のポーズを設定します（turbo = 5、
balanced = 4、safe = 2）; 明示的な `--conc`/`--gap`（またはリポジトリ自身のフラグ）が常に優先され、
`--preset` なしではツールは歴史的な形態を正確に保ちます。

Turbo önerilir (5 worker); daha fazlası zayıf bilgisayarda yük/ban riski.