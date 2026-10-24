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

**자동 생성된 API 키로 Baseten 계정을 대량 생성 — OpenAI 호환 추론 + 9Router 커넥터.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-12%20served-412991?style=for-the-badge)](https://docs.baseten.co/)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

<<<<<<< Updated upstream
[🛠 빠른 시작](#-quick-start) · [🎁 무료 티어](#-free-tier--how-much-you-get) · [🤖 모델](#-models--all-12-of-them) · [🧪 API 사용하기](#-how-to-use-the-api) · [✅ 검증됨](#-verified-working--every-key-is-tested) · [🧭 작동 방식](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ 옵션](#️-cli-options) · [🛰️ 프록시](#️-behind-a-proxy) · [🐞 이슈](#-issues)
=======
[🛠 빠른 시작](#-quick-start) · [🎁 무료 티어](#-free-tier--how-much-you-get) · [🤖 모델](#-models--all-12-of-them) · [🧪 API 사용법](#-how-to-use-the-api) · [✅ 검증됨](#-verified-working--every-key-is-tested) · [🧭 작동 방식](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ 옵션](#️-cli-options) · [🛰️ 프록시](#️-behind-a-proxy) · [🐞 이슈](#-issues)
>>>>>>> Stashed changes

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ 왜 필요한가

Baseten은 모든 **새 워크스페이스**에 자체 무료 크레딧을 제공하며, API 키는 워크스페이스에 속합니다 — 즉 *N개의 독립적인 키는 N개의 계정을 의미합니다*. 이 도구는 그 전체 수명 주기를 처음부터 끝까지 처리합니다: 받은편지함 → 이메일 코드로 로그인 → 계정 세션 → `create_user_api_key` GraphQL 뮤테이션 → 실제 채팅 완성으로 실시간 검증. 대시보드 클릭도, 손으로 키를 복사-붙여넣기도 필요 없습니다.

## 🎁 무료 티어 — 얼마나 받을 수 있나

**모든 새 Baseten 워크스페이스는 가입 크레딧을 무료로 받습니다 — 카드 불필요, 이메일 가입 — 그리고 크레딧은 키가 아니라 워크스페이스에 있습니다.**

| 항목 | 값 |
| --- | --- |
| 웰컴 허용량 | 가입 시 **새 워크스페이스**마다 부여되는 무료 크레딧 ([app.baseten.co](https://app.baseten.co)에서 잔액 확인) |
| 카드 필요 여부 | **아니오** |
| 키가 가지는 것 | 워크스페이스에 범위가 지정된 `PERSONAL` 키, 모든 **12개 모델 엔드포인트**에서 유효 |
| 가입 | 이메일 + 받은편지함에서 읽은 6자리 코드 |
| 확장 단위 | **워크스페이스 하나 = 키 하나** → `--target N`은 실제로 "N개의 무료 워크스페이스"를 의미 |

> 💡 무료 티어는 Baseten이 정하며 변경될 수 있습니다. 실시간 수치는 [baseten.co](https://baseten.co)에서 확인하세요 — 그리고 도구 자체의 게이트가 판단하게 하세요:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 모델 — 12개 전부

새로 발급된 키는 `/v1/chat/completions`에서 **12개의 모델 API**를 제공합니다 (2026-10-18 측정: 아래 모든 id가 홈 회선과 콜드 프록시 출구 양쪽에서 **200**을 응답):

> ⚠️ `GET /v1/models`는 새 키에 대한 신뢰할 수 있는 상태 확인이 **아닙니다**: 엣지는 새 계정의 키에 **202**, 빈 본문, `x-amzn-waf-action: challenge`를 응답하는 반면, 같은 키가 `/v1/chat/completions`에는 **200**을 응답합니다. 인증 헤더가 없는 키는 평범한 **401**을 받습니다. 따라서 이 도구는 채팅 완성을 증거로 취급하고 그와 함께 `modelsStatus`(보통 `202`)를 기록합니다.

|모델|✓|
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

키 하나의 실시간 프로브 — 이것이 바로 도구가 키를 받아들이기 전에 실행하는 것입니다:

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hi"}]}'
```

## 🧪 API 사용 방법

기본 URL은 **`https://inference.baseten.co/v1`** 입니다 — OpenAI 호환이므로 OpenAI를 지원하는 모든 것이 작동합니다.

**모든 SDK / curl**

```python
from openai import OpenAI
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key="<your key>")
print(client.chat.completions.create(model="zai-org/GLM-5.3-Flash",
      messages=[{"role": "user", "content": "hi"}]).choices[0].message.content)
```

**사용자 지정 기본 URL을 지원하는 모든 에이전트 / 도구** (Cursor, OpenCode, Kilo Code, …): 기본 URL을 `https://inference.baseten.co/v1`로 설정하고, 키를 붙여넣고, 위 표에서 아무 모델 id나 선택하세요.

## 🛠 빠른 시작

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

### 🖱️ 런처

런처는 계정 수, 출력 파일, 받은편지함 백엔드, 선택적 프록시 / 프록시 목록을 묻고, 답변을 `launcher.config.json`에 기억한 뒤, 대신 CLI를 실행합니다.

## ✅ 검증됨 — 모든 키가 테스트됩니다

> **품질 게이트.** 여기의 모든 키는 `keys.txt`에 기록되기 전에 실시간 `chat-200`을 통과했습니다
> (죽은 키는 절대 배포되지 않습니다). 라우터 조합도 모델 수준에서 같은 규칙을 따릅니다: 항목은
> **모델이 `chat-200`을 응답하고 도구 호출이 가능한 경우에만** 추가됩니다 — 도구 지원이 없는 모델,
> 죽은 키, 죽은 제공자는 추가되지 않고 제거됩니다. **9Router와 OmniRoute**에서 작동합니다.

키는 추론 API가 응답한 **후에만** `keys.txt`에 기록됩니다:

| 확인 | 결과 |
| --- | --- |
| `POST https://inference.baseten.co/v1/chat/completions` (`zai-org/GLM-5.3-Flash`)를 실시간 증거로 사용 | **HTTP 200**, 실제 완성 (`finish_reason: "stop"`, `usage` 존재) — 결정적 확인 |
| `GET https://inference.baseten.co/v1/models`, 계정별로 `modelsStatus`로 기록 | 새 키는 `202` + waf 챌린지; 이전 코호트는 `200`; `401`/`403` 최종 → `accounts-rejected.json` |
| 계정 대 키 | 계정당 키 하나 — 어떤 계정도 하나 이상의 키를 제공하지 않음 |

```bash
node src/cli.js --verify-only --out keys.txt   # re-check the whole list at any time
```

## 🧭 작동 방식

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Baseten page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://inference.baseten.co/v1/chat/completions → real content = the key is live
```

| 단계 | 호출 | 비고 |
| --- | --- | --- |
| 로그인 | Chrome 로그인 페이지 → 이메일 → 받은편지함의 6자리 코드 | CDP를 통해 구동, 한 번에 창 하나 |
| 세션 | 계정의 쿠키 | 쿠키를 손에 넣는 즉시 브라우저 종료 |
| 키 | `POST https://app.baseten.co/graphql/` → `CreateUserApiKey` | `{ textKey, prefix }`가 정확히 한 번 반환됨 |
| 확인 | `POST https://inference.baseten.co/v1/chat/completions` | `keys.txt` 이전에 실시간 200 필수 |

## ⚙️ CLI 옵션

**`src/browser-batch.js`** — 계정당 키 경로 (Chrome 가입 + Node 키 발급 + 실시간 검증):

| 플래그 | 기본값 | 의미 |
| --- | --- | --- |
| `--target <n>` | `30` | 목록이 최종적으로 가져야 할 **검증된** 키 수 — 임의의 N, 상한 없음 |
| `--pool-browser <file>` | — | 브라우저 출구용 프록시 목록 (한 줄에 하나) |
| `--per-run <n>` | `5` | 브라우저 세션당 계정 수 |
| `--max-failures <n>` | `5` | 이만큼 연속 실패 후 중지 |
| `--code-timeout <ms>` | `180000` | 매직 코드 메일을 기다리는 시간 |
| `--warp <socks>` | — | 프록시 SOCKS 출구 고정 |
| `--broker <url>` | — | 받은편지함 브로커 엔드포인트 |

**`src/cli.js`** — 이전 HTTP 전용 변형:

| 플래그 | 기본값 | 의미 |
| --- | --- | --- |
| `--count <n>` | `30` | 발급할 계정 수 |
| `--out <file>` | `keys.txt` | 한 줄에 검증된 키 하나 |
| `--accounts <file>` | `accounts.json` | 계정 기록 (이메일, 키, 접두사, 출구, 검증) |
| `--rejected <file>` | `accounts-rejected.json` | 키가 검증되지 않은 계정 |
| `--proxy` / `--proxy-file <file>` | — | 출구, 또는 풀 파일 |
| `--inbox <mode>` · `--broker <url>` | — | 받은편지함 백엔드 |
| `--allow-direct` | 꺼짐 | 호환성을 위해 허용됨 — 프록시 목록 없는 실행은 기본적으로 직접 연결 |
| `--verify-only` | 꺼짐 | 발급 대신 `--out`의 키를 재검증 |

데이터 파일은 `browser-batch.js`에 대해 고정되어 있으며 저장소 루트에 있습니다: `keys.txt`, `accounts.json`, `browser-pending.json`, `browser-accounts.jsonl`.

## 🛰️ 프록시 뒤에서

**선택 사항 — 대규모에서는 권장 (IP당 제한, 차단).** 이 도구는 프록시 없이도 작동합니다: `--proxy`/`--proxy-file`이 없고 (그리고 `proxies.txt` 줄도 없으면) 모든 호출이 자신의 머신에서 나가며 실행은 그 홉을 `direct`로 기록합니다.

```bash
node src/browser-batch.js --target 30 --pool-browser proxies.txt
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

프록시는 줄 단위로 로드되며 (`http://`, `socks5://`, `socks4://`, 또는 맨 `host:port`), 계정별로 순환되고, 죽은 줄에 대해서는 재시도합니다. 프록시 목록 없는 실행은 기본적으로 직접 연결입니다 (`--allow-direct`는 여전히 허용되지만 더 이상 필요하지 않습니다).

## 📄 파일

| 경로 | 내용 |
| --- | --- |
| `keys.txt` | 검증된 키, 한 줄에 하나 — git 무시됨, 절대 커밋되지 않음 |
| `accounts.json` | 계정 기록 (이메일, 키, 접두사) — git 무시됨 |
| `accounts-rejected.json` | 키가 검증되지 않은 계정 — 재시도에 유용 |
| `launcher.config.json` | 런처가 기억하는 것 |
| `src/connect-9router.js` | `keys.txt`의 키를 9Router 연결로 등록 (제로 의존성) |

## 🔌 9Router에 연결

[9Router](https://9router.com)는 자체 호스팅, OpenAI 호환 라우터입니다. Baseten은 OpenAI 호환 엔드포인트를 제공하므로, 한 번 등록하면 모든 키가 하나의 제공자 노드 아래 연결이 됩니다:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

기본값: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. 그러면 모델은 `baseten/<model id>`로 제공되며 모든 키에 걸쳐 로드 밸런싱됩니다. 커넥터를 갱신된 `keys.txt`로 가리키면 더 많은 계정을 추가할 수 있습니다; 노드와 그 모델 목록은 그대로 유지됩니다.

## 🔌 OmniRoute에 연결

<<<<<<< Updated upstream
[OmniRoute](https://omniroute.online)는 자체 호스팅, OpenAI 호환 라우터입니다. Baseten은 OpenAI 호환 엔드포인트를 제공하므로, 한 번 등록하면 모든 키가 하나의 제공자 노드 아래 연결이 됩니다:
=======
[OmniRoute](https://omniroute.online)는 자체 호스팅, OpenAI 호환 라우터입니다. Baseten은 OpenAI 호환 엔드포인트를 제공하므로, 한 번 등록하면 모든 키가 하나의 프로바이더 노드 아래 연결이 됩니다:
>>>>>>> Stashed changes

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

<<<<<<< Updated upstream
기본값: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. 그러면 모델은 `baseten/<model id>`로 제공되며 모든 키에 걸쳐 로드 밸런싱됩니다. 커넥터를 갱신된 `keys.txt`로 가리키면 더 많은 계정을 추가할 수 있습니다; 노드와 그 모델 목록은 그대로 유지됩니다.
=======
기본값: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. 그러면 모델은 `baseten/<model id>`로 제공되고 모든 키에 걸쳐 로드 밸런싱됩니다. 커넥터를 갱신된 `keys.txt`로 향하게 하여 더 많은 계정을 추가하세요; 노드와 그 모델 목록은 그대로 유지됩니다.

>>>>>>> Stashed changes
## 🔑 키 하나로 얻는 것

| | |
| --- | --- |
| 🏢 제공자 | **Baseten** — [baseten.co](https://baseten.co) |
| 🎁 제공자가 주는 것 | 키당 계정(워크스페이스) 하나 — 모든 키가 Model APIs에서 채팅 검증됨 |
| 🔑 키 하나로 얻는 것 | 자체 계정에 범위가 지정된 API 키 하나: 아래 엔드포인트의 12개 모델 id, 요금제 한도 내에서. 할당량은 **계정**에 있으므로, 이 도구가 키당 계정 하나를 생성하는 것입니다 |
| 🌐 API 형태 | OpenAI 호환: `POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 데이터 | baseten.co와 구성한 받은편지함 백엔드만 접촉됩니다; 키는 머신에 남습니다 |

## 🐞 이슈

Baseten이 로그인 흐름, GraphQL 뮤테이션 또는 받은편지함 동작을 변경하면, 도구는 그 단계에서 멈추고 그렇게 알립니다. 실행한 명령과 정확한 출력을 포함하여 **[이슈를 열어주세요](../../issues)**; PR을 환영합니다.

## 📄 라이선스

MIT © 2026 — [LICENSE](LICENSE) 참조.

<div align="center">

**[MIT](LICENSE)** © 2026 baseten-bulk-apikey contributors

</div>

## ⚡ 실행 형태 (프리셋)

`--preset=turbo|balanced|safe`는 워커 수 + 계정 간 일시정지를 설정합니다 (turbo = 5,
balanced = 4, safe = 2); 명시적 `--conc`/`--gap` (또는 저장소 자체 플래그)이 항상 우선하며,
`--preset` 없이는 도구가 기존 형태를 정확히 유지합니다.

Turbo önerilir (5 worker); daha fazlası zayıf bilgisayarda yük/ban riski.