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

**Массовое создание аккаунтов Baseten с автоматически сгенерированными API-ключами — OpenAI-совместимый инференс + коннектор 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-12%20served-412991?style=for-the-badge)](https://docs.baseten.co/)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Быстрый старт](#-quick-start) · [🎁 Бесплатный тариф](#-free-tier--how-much-you-get) · [🤖 Модели](#-models--all-12-of-them) · [🧪 Использование API](#-how-to-use-the-api) · [✅ Проверено](#-verified-working--every-key-is-tested) · [🧭 Как это работает](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Опции](#️-cli-options) · [🛰️ Прокси](#️-behind-a-proxy) · [🐞 Проблемы](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Зачем это нужно

Baseten даёт каждому **новому рабочему пространству** собственные бесплатные кредиты, а API-ключ принадлежит рабочему пространству — поэтому *N независимых ключей означает N аккаунтов*. Этот инструмент проводит весь жизненный цикл от начала до конца: почтовый ящик → вход по коду из письма → сессия аккаунта → GraphQL-мутация `create_user_api_key` → живая проверка реальным запросом чат-комплишена. Никаких кликов по дашборду, никакого копирования ключей вручную.

## 🎁 Бесплатный тариф — сколько вы получаете

**Каждое новое рабочее пространство Baseten получает бесплатные кредиты при регистрации — без карты, регистрация по e-mail — и кредит привязан к рабочему пространству, а не к ключу.**

| Что | Значение |
| --- | --- |
| Приветственный лимит | бесплатные кредиты, начисляемые на **новое рабочее пространство** при регистрации (баланс отображается на [app.baseten.co](https://app.baseten.co)) |
| Требуется карта | **Нет** |
| Что несёт ключ | ключ `PERSONAL`, привязанный к своему рабочему пространству, действителен для всех **12 эндпоинтов моделей** |
| Регистрация | e-mail + 6-значный код, считанный из почтового ящика |
| Единица масштабирования | **одно рабочее пространство = один ключ** → `--target N` на самом деле означает «N бесплатных рабочих пространств» |

> 💡 Бесплатный тариф устанавливается Baseten и может измениться. Проверяйте актуальные цифры на [baseten.co](https://baseten.co) — и пусть собственный контроль инструмента решает:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Модели — все 12

Свежесозданный ключ обслуживает **12 API моделей** на `/v1/chat/completions` (измерено 2026-10-18: каждый id ниже ответил **200** как с домашней линии, так и с холодного прокси-выхода):

> ⚠️ `GET /v1/models` — **не** надёжная проверка работоспособности для свежего ключа: edge отвечает на ключ совершенно нового аккаунта **202**, пустым телом и `x-amzn-waf-action: challenge`, тогда как тот же ключ отвечает на `/v1/chat/completions` **200**. Ключ без заголовка авторизации получает обычный **401**. Поэтому инструмент считает доказательством именно чат-комплишен и записывает `modelsStatus` (обычно `202`) рядом с ним.

|Модель|✓|
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

Живая проверка одного ключа — именно это инструмент запускает, прежде чем принять ключ:

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hi"}]}'
```

## 🧪 Как использовать API

Базовый URL — **`https://inference.baseten.co/v1`** — совместим с OpenAI, поэтому работает всё, что говорит на языке OpenAI.

**Любой SDK / curl**

```python
from openai import OpenAI
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key="<your key>")
print(client.chat.completions.create(model="zai-org/GLM-5.3-Flash",
      messages=[{"role": "user", "content": "hi"}]).choices[0].message.content)
```

**Любой агент / инструмент с настраиваемым базовым URL** (Cursor, OpenCode, Kilo Code, …): задайте базовый URL `https://inference.baseten.co/v1`, вставьте ключ, выберите любой id модели из таблицы выше.

## 🛠 Быстрый старт

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

### 🖱️ Лаунчер

Лаунчер запрашивает количество аккаунтов, выходной файл, бэкенд почтового ящика и необязательный прокси / список прокси, запоминает ответы в `launcher.config.json` и запускает CLI за вас.

## ✅ Проверено в работе — каждый ключ протестирован

> **Контроль качества.** Каждый ключ здесь прошёл живой `chat-200`, прежде чем был записан в `keys.txt`
> (мёртвые ключи никогда не попадают в поставку). Комбинации роутера следуют тому же правилу на уровне модели: запись
> добавляется **только если модель отвечает `chat-200` и умеет вызывать инструменты** — модель без поддержки инструментов,
> мёртвый ключ или мёртвый провайдер отбрасывается, а не добавляется. Работает с **9Router и OmniRoute**.

Ключ записывается в `keys.txt` **только после того**, как API инференса ответит с ним:

| Проверка | Результат |
| --- | --- |
| `POST https://inference.baseten.co/v1/chat/completions` (`zai-org/GLM-5.3-Flash`) как живое доказательство | **HTTP 200**, реальный комплишен (`finish_reason: "stop"`, присутствует `usage`) — решающая проверка |
| `GET https://inference.baseten.co/v1/models`, записывается по каждому аккаунту как `modelsStatus` | `202` + waf challenge для свежих ключей; у более старой когорты `200`; `401`/`403` окончательно → `accounts-rejected.json` |
| аккаунты против ключей | один ключ на аккаунт — ни один аккаунт не даёт больше одного ключа |

```bash
node src/cli.js --verify-only --out keys.txt   # re-check the whole list at any time
```

## 🧭 Как это работает

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Baseten page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://inference.baseten.co/v1/chat/completions → real content = the key is live
```

| Шаг | Вызов | Примечания |
| --- | --- | --- |
| вход | страница входа Chrome → e-mail → 6-значный код из почтового ящика | управляется через CDP, по одному окну за раз |
| сессия | cookies аккаунта | браузер закрывается, как только cookies получены |
| ключ | `POST https://app.baseten.co/graphql/` → `CreateUserApiKey` | `{ textKey, prefix }` возвращается ровно один раз |
| проверка | `POST https://inference.baseten.co/v1/chat/completions` | требуется живой 200 перед записью в `keys.txt` |

## ⚙️ Опции CLI

**`src/browser-batch.js`** — путь «аккаунт на ключ» (регистрация в Chrome + создание ключа в Node + живая проверка):

| Флаг | По умолчанию | Значение |
| --- | --- | --- |
| `--target <n>` | `30` | сколько **проверенных** ключей должно получиться в списке — любое N, без ограничения |
| `--pool-browser <file>` | — | список прокси для браузерного выхода (по одному в строке) |
| `--per-run <n>` | `5` | аккаунтов на сессию браузера |
| `--max-failures <n>` | `5` | остановиться после стольких последовательных неудач |
| `--code-timeout <ms>` | `180000` | сколько ждать письмо с магическим кодом |
| `--warp <socks>` | — | закрепить SOCKS-выход прокси |
| `--broker <url>` | — | эндпоинт брокера почтового ящика |

**`src/cli.js`** — более старый вариант только по HTTP:

| Флаг | По умолчанию | Значение |
| --- | --- | --- |
| `--count <n>` | `30` | сколько аккаунтов создать |
| `--out <file>` | `keys.txt` | один проверенный ключ на строку |
| `--accounts <file>` | `accounts.json` | записи аккаунтов (e-mail, ключ, префикс, выход, проверка) |
| `--rejected <file>` | `accounts-rejected.json` | аккаунты, чей ключ так и не прошёл проверку |
| `--proxy` / `--proxy-file <file>` | — | выход или файл пула |
| `--inbox <mode>` · `--broker <url>` | — | бэкенд почтового ящика |
| `--allow-direct` | выкл. | принимается для совместимости — запуск без списка прокси по умолчанию идёт напрямую |
| `--verify-only` | выкл. | перепроверить ключи в `--out` вместо создания новых |

Файлы данных для `browser-batch.js` фиксированы и находятся в корне репозитория: `keys.txt`, `accounts.json`, `browser-pending.json`, `browser-accounts.jsonl`.

## 🛰️ За прокси

**Необязательно — рекомендуется при масштабе (лимиты на IP, баны).** Инструмент работает и без прокси: без `--proxy`/`--proxy-file` (и без строк в `proxies.txt`) каждый вызов уходит с вашей собственной машины, и запуск логирует этот переход как `direct`.

```bash
node src/browser-batch.js --target 30 --pool-browser proxies.txt
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

Прокси загружаются построчно (`http://`, `socks5://`, `socks4://` или просто `host:port`) и ротируются на каждый аккаунт, с повторами при мёртвой линии. Запуск без списка прокси по умолчанию идёт напрямую (`--allow-direct` всё ещё принимается, но больше не нужен).

## 📄 Файлы

| Путь | Содержимое |
| --- | --- |
| `keys.txt` | проверенные ключи, по одному в строке — игнорируется git, никогда не коммитится |
| `accounts.json` | записи аккаунтов (e-mail, ключ, префикс) — игнорируется git |
| `accounts-rejected.json` | аккаунты, чей ключ так и не прошёл проверку — полезно для повторов |
| `launcher.config.json` | то, что запоминает лаунчер |
| `src/connect-9router.js` | регистрирует ключи из `keys.txt` как подключения 9Router (без зависимостей) |

## 🔌 Подключение к 9Router

[9Router](https://9router.com) — это самостоятельно размещаемый роутер, совместимый с OpenAI. Baseten предоставляет OpenAI-совместимый эндпоинт, поэтому зарегистрируйте его один раз, и каждый ключ станет подключением под одним узлом-провайдером:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Значения по умолчанию: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Затем модели обслуживаются как `baseten/<model id>` и балансируются между всеми ключами. Направьте коннектор на обновлённый `keys.txt`, чтобы добавить больше аккаунтов; узел и его список моделей останутся прежними.

## 🔌 Подключение к OmniRoute

[OmniRoute](https://omniroute.online) — это самостоятельно размещаемый роутер, совместимый с OpenAI. Baseten предоставляет OpenAI-совместимый эндпоинт, поэтому зарегистрируйте его один раз, и каждый ключ станет подключением под одним узлом-провайдером:

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Значения по умолчанию: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Затем модели обслуживаются как `baseten/<model id>` и балансируются между всеми ключами. Направьте коннектор на обновлённый `keys.txt`, чтобы добавить больше аккаунтов; узел и его список моделей останутся прежними.
## 🔑 Что даёт один ключ

| | |
| --- | --- |
| 🏢 Провайдер | **Baseten** — [baseten.co](https://baseten.co) |
| 🎁 Что даёт провайдер | один аккаунт (рабочее пространство) на ключ — каждый ключ проверен чатом на Model APIs |
| 🔑 Что даёт один ключ | один API-ключ, привязанный к своему аккаунту: 12 id моделей на эндпоинте ниже, в пределах лимитов вашего тарифа. Квота привязана к **аккаунту**, именно поэтому этот инструмент создаёт один аккаунт на ключ |
| 🌐 Форма API | совместим с OpenAI: `POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 Ваши данные | связь только с baseten.co и настроенным вами бэкендом почтового ящика; ключи остаются на вашей машине |

## 🐞 Проблемы

Если Baseten изменит процесс входа, GraphQL-мутацию или поведение почтового ящика, инструмент остановится на этом шаге и сообщит об этом. **[Откройте issue](../../issues)** с командой, которую вы запустили, и точным выводом; PR приветствуются.

## 📄 Лицензия

MIT © 2026 — см. [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 baseten-bulk-apikey contributors

</div>

## ⚡ Режим запуска (пресеты)

`--preset=turbo|balanced|safe` задаёт число воркеров + паузу между аккаунтами (turbo = 5,
balanced = 4, safe = 2); явные `--conc`/`--gap` (или собственные флаги репозитория) всегда
имеют приоритет, а без `--preset` инструмент сохраняет свою историческую конфигурацию в точности.

Рекомендуется turbo (5 воркеров); больше — риск нагрузки/бана на слабом компьютере.