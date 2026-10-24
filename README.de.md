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
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

<<<<<<< Updated upstream
[🛠 Quick start](#-quick-start) · [🎁 Free tier](#-free-tier--how-much-you-get) · [🤖 Models](#-models--all-12-of-them) · [🧪 Use the API](#-how-to-use-the-api) · [✅ Verified](#-verified-working--every-key-is-tested) · [🧭 How it works](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Options](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Issues](#-issues)
=======
[🛠 Schnellstart](#-quick-start) · [🎁 Free-Tier](#-free-tier--how-much-you-get) · [🤖 Modelle](#-models--all-12-of-them) · [🧪 API verwenden](#-how-to-use-the-api) · [✅ Verifiziert](#-verified-working--every-key-is-tested) · [🧭 So funktioniert es](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ Optionen](#️-cli-options) · [🛰️ Proxys](#️-behind-a-proxy) · [🐞 Probleme](#-issues)
>>>>>>> Stashed changes

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Warum es das gibt

Baseten gibt jedem **neuen Workspace** eigene kostenlose Credits, und ein API-Schlüssel gehört zum Workspace — also bedeuten *N unabhängige Schlüssel N Konten*. Dieses Tool steuert diesen gesamten Lebenszyklus von Anfang bis Ende: Posteingang → Anmeldung mit dem E-Mail-Code → Kontositzung → `create_user_api_key`-GraphQL-Mutation → Live-Verifizierung mit einer echten Chat-Vervollständigung. Kein Klicken im Dashboard, kein von Hand kopierter Schlüssel.

## 🎁 Kostenlose Stufe — wie viel du bekommst

**Jeder neue Baseten-Workspace erhält kostenlose Anmelde-Credits — keine Karte, E-Mail-Anmeldung — und das Guthaben liegt am Workspace, nicht am Schlüssel.**

| Was | Wert |
| --- | --- |
| Willkommensguthaben | kostenlose Credits pro **neuem Workspace** bei der Anmeldung (Guthaben wird unter [app.baseten.co](https://app.baseten.co) angezeigt) |
| Karte erforderlich | **Nein** |
| Was der Schlüssel mitbringt | ein `PERSONAL`-Schlüssel, der auf seinen Workspace beschränkt ist und auf allen **12 Modell-Endpunkten** gültig ist |
| Anmeldung | E-Mail + 6-stelliger Code aus dem Posteingang |
| Die Einheit, die skaliert | **ein Workspace = ein Schlüssel** → `--target N` bedeutet wirklich „N kostenlose Workspaces" |

> 💡 Die kostenlose Stufe wird von Baseten festgelegt und kann sich ändern. Prüfe die aktuellen Zahlen unter [baseten.co](https://baseten.co) — und lass das Gate des Tools selbst entscheiden:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modelle — alle 12

Ein frisch erzeugter Schlüssel bedient **12 Modell-APIs** unter `/v1/chat/completions` (gemessen am 18.10.2026: jede unten stehende ID antwortete mit **200**, sowohl über die Heimleitung als auch über einen kalten Proxy-Ausgang):

> ⚠️ `GET /v1/models` ist **kein** zuverlässiger Gesundheitscheck für einen frischen Schlüssel: Der Edge antwortet dem Schlüssel eines brandneuen Kontos mit **202**, einem leeren Body und `x-amzn-waf-action: challenge`, während derselbe Schlüssel auf `/v1/chat/completions` mit **200** antwortet. Ein Schlüssel ohne Auth-Header erhält ein einfaches **401**. Das Tool betrachtet daher die Chat-Vervollständigung als Beweis und zeichnet `modelsStatus` (üblicherweise `202`) daneben auf.

|Modell|✓|
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

Live-Test eines Schlüssels — genau das führt das Tool aus, bevor es einen Schlüssel akzeptiert:

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hi"}]}'
```

## 🧪 So verwendest du die API

Die Basis-URL ist **`https://inference.baseten.co/v1`** — OpenAI-kompatibel, also funktioniert alles, was OpenAI spricht.

**Beliebiges SDK / curl**

```python
from openai import OpenAI
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key="<your key>")
print(client.chat.completions.create(model="zai-org/GLM-5.3-Flash",
      messages=[{"role": "user", "content": "hi"}]).choices[0].message.content)
```

**Beliebiger Agent / beliebiges Tool mit eigener Basis-URL** (Cursor, OpenCode, Kilo Code, …): Basis-URL `https://inference.baseten.co/v1` setzen, einen Schlüssel einfügen, eine beliebige Modell-ID aus der obigen Tabelle wählen.

## 🛠 Schnellstart

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

### 🖱️ Der Launcher

Der Launcher fragt nach der Kontoanzahl, der Ausgabedatei, dem Posteingangs-Backend und einem optionalen Proxy / einer Proxy-Liste, merkt sich die Antworten in `launcher.config.json` und führt die CLI für dich aus.

## ✅ Verifiziert funktionierend — jeder Schlüssel wird getestet

> **Qualitätsgates.** Jeder Schlüssel hier hat ein Live-`chat-200` bestanden, bevor er in `keys.txt` geschrieben wurde
> (tote Schlüssel werden nie ausgeliefert). Router-Kombinationen folgen derselben Regel auf Modellebene: Ein Eintrag wird
> **nur hinzugefügt, wenn das Modell `chat-200` antwortet und Tools aufrufen kann** — ein Modell ohne Tool-Unterstützung,
> ein toter Schlüssel oder ein toter Anbieter wird verworfen statt hinzugefügt. Funktioniert mit **9Router und OmniRoute**.

Ein Schlüssel wird **erst dann** in `keys.txt` geschrieben, **nachdem** die Inferenz-API damit geantwortet hat:

| Prüfung | Ergebnis |
| --- | --- |
| `POST https://inference.baseten.co/v1/chat/completions` (`zai-org/GLM-5.3-Flash`) als Live-Beweis | **HTTP 200**, echte Vervollständigung (`finish_reason: "stop"`, `usage` vorhanden) — die entscheidende Prüfung |
| `GET https://inference.baseten.co/v1/models`, pro Konto als `modelsStatus` aufgezeichnet | `202` + WAF-Challenge für frische Schlüssel; ältere Kohorte `200`; `401`/`403` endgültig → `accounts-rejected.json` |
| Konten vs. Schlüssel | ein Schlüssel pro Konto — kein Konto steuert mehr als einen Schlüssel bei |

```bash
node src/cli.js --verify-only --out keys.txt   # re-check the whole list at any time
```

## 🧭 Wie es funktioniert

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Baseten page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://inference.baseten.co/v1/chat/completions → real content = the key is live
```

| Schritt | Aufruf | Hinweise |
| --- | --- | --- |
| Anmeldung | Chrome-Anmeldeseite → E-Mail → 6-stelliger Code aus dem Posteingang | über CDP gesteuert, ein Fenster nach dem anderen |
| Sitzung | die Cookies des Kontos | der Browser wird geschlossen, sobald die Cookies vorliegen |
| Schlüssel | `POST https://app.baseten.co/graphql/` → `CreateUserApiKey` | `{ textKey, prefix }` wird genau einmal zurückgegeben |
| Prüfung | `POST https://inference.baseten.co/v1/chat/completions` | Live-200 erforderlich vor `keys.txt` |

## ⚙️ CLI-Optionen

**`src/browser-batch.js`** — der Konto-pro-Schlüssel-Pfad (Chrome-Anmeldung + Node-Schlüsselerzeugung + Live-Verifizierung):

| Flag | Standard | Bedeutung |
| --- | --- | --- |
| `--target <n>` | `30` | wie viele **verifizierte** Schlüssel die Liste am Ende enthalten soll — beliebiges N, keine Obergrenze |
| `--pool-browser <file>` | — | Proxy-Liste für den Browser-Ausgang (eine pro Zeile) |
| `--per-run <n>` | `5` | Konten pro Browser-Sitzung |
| `--max-failures <n>` | `5` | nach so vielen aufeinanderfolgenden Fehlern abbrechen |
| `--code-timeout <ms>` | `180000` | wie lange auf die Magic-Code-Mail gewartet wird |
| `--warp <socks>` | — | einen Proxy-SOCKS-Ausgang festlegen |
| `--broker <url>` | — | Posteingangs-Broker-Endpunkt |

**`src/cli.js`** — die ältere reine HTTP-Variante:

| Flag | Standard | Bedeutung |
| --- | --- | --- |
| `--count <n>` | `30` | zu erzeugende Konten |
| `--out <file>` | `keys.txt` | ein verifizierter Schlüssel pro Zeile |
| `--accounts <file>` | `accounts.json` | Kontodatensätze (E-Mail, Schlüssel, Präfix, Ausgang, Verifizierung) |
| `--rejected <file>` | `accounts-rejected.json` | Konten, deren Schlüssel nie verifiziert wurde |
| `--proxy` / `--proxy-file <file>` | — | Ausgang oder eine Pool-Datei |
| `--inbox <mode>` · `--broker <url>` | — | Posteingangs-Backend |
| `--allow-direct` | aus | aus Kompatibilität akzeptiert — ein Lauf ohne Proxy-Liste ist standardmäßig direkt |
| `--verify-only` | aus | die Schlüssel in `--out` erneut verifizieren statt neue zu erzeugen |

Datendateien sind für `browser-batch.js` fest und liegen im Repository-Stamm: `keys.txt`, `accounts.json`, `browser-pending.json`, `browser-accounts.jsonl`.

## 🛰️ Hinter einem Proxy

**Optional — bei Skalierung empfohlen (Limits pro IP, Sperren).** Das Tool funktioniert auch ohne Proxy: Ohne `--proxy`/`--proxy-file` (und ohne `proxies.txt`-Zeilen) verlässt jeder Aufruf deinen eigenen Rechner und der Lauf protokolliert den Hop als `direct`.

```bash
node src/browser-batch.js --target 30 --pool-browser proxies.txt
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

Proxies werden zeilenweise geladen (`http://`, `socks5://`, `socks4://` oder bloßes `host:port`) und pro Konto rotiert, mit Wiederholungen bei einer toten Leitung. Ein Lauf ohne Proxy-Liste ist standardmäßig direkt (`--allow-direct` wird weiterhin akzeptiert, ist aber nicht mehr nötig).

## 📄 Dateien

| Pfad | Inhalt |
| --- | --- |
| `keys.txt` | verifizierte Schlüssel, einer pro Zeile — von Git ignoriert, nie committet |
| `accounts.json` | Kontodatensätze (E-Mail, Schlüssel, Präfix) — von Git ignoriert |
| `accounts-rejected.json` | Konten, deren Schlüssel nie verifiziert wurde — nützlich für Wiederholungen |
| `launcher.config.json` | was sich der Launcher merkt |
| `src/connect-9router.js` | registriert die Schlüssel in `keys.txt` als 9Router-Verbindungen (zero-dep) |

## 🔌 Mit 9Router verbinden

[9Router](https://9router.com) ist ein selbst gehosteter, OpenAI-kompatibler Router. Baseten bietet einen OpenAI-kompatiblen Endpunkt, also registriere ihn einmal und jeder Schlüssel wird zu einer Verbindung unter einem Provider-Node:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Standardwerte: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Modelle werden dann als `baseten/<model id>` bereitgestellt und über alle Schlüssel lastverteilt. Richte den Connector auf eine aktualisierte `keys.txt`, um weitere Konten hinzuzufügen; der Node und seine Modellliste bleiben gleich.

## 🔌 Mit OmniRoute verbinden

<<<<<<< Updated upstream
[OmniRoute](https://omniroute.online) ist ein selbst gehosteter, OpenAI-kompatibler Router. Baseten bietet einen OpenAI-kompatiblen Endpunkt, also registriere ihn einmal und jeder Schlüssel wird zu einer Verbindung unter einem Provider-Node:
=======
[OmniRoute](https://omniroute.online) ist ein selbst gehosteter, OpenAI-kompatibler Router. Baseten bietet einen OpenAI-kompatiblen Endpunkt, also registriere ihn einmal und jeder Schlüssel wird zu einer Verbindung unter einem Provider-Knoten:
>>>>>>> Stashed changes

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

<<<<<<< Updated upstream
Standardwerte: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Modelle werden dann als `baseten/<model id>` bereitgestellt und über alle Schlüssel lastverteilt. Richte den Connector auf eine aktualisierte `keys.txt`, um weitere Konten hinzuzufügen; der Node und seine Modellliste bleiben gleich.
=======
Standardwerte: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Modelle werden dann als `baseten/<model id>` bereitgestellt und über alle Schlüssel lastverteilt. Richte den Connector auf eine aktualisierte `keys.txt`, um weitere Konten hinzuzufügen; der Knoten und seine Modellliste bleiben gleich.

>>>>>>> Stashed changes
## 🔑 Was ein Schlüssel dir bringt

| | |
| --- | --- |
| 🏢 Anbieter | **Baseten** — [baseten.co](https://baseten.co) |
| 🎁 Was der Anbieter gibt | ein Konto (Workspace) pro Schlüssel — jeder Schlüssel chat-verifiziert auf den Model APIs |
| 🔑 Was ein Schlüssel dir bringt | einen API-Schlüssel, der auf sein eigenes Konto beschränkt ist: die 12 Modell-IDs am unten stehenden Endpunkt, im Rahmen der Limits deines Tarifs. Das Kontingent liegt am **Konto**, weshalb dieses Tool genau ein Konto pro Schlüssel erstellt |
| 🌐 API-Form | OpenAI-kompatibel: `POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 Deine Daten | nur baseten.co und das von dir konfigurierte Posteingangs-Backend werden kontaktiert; Schlüssel bleiben auf deinem Rechner |

## 🐞 Probleme

Wenn Baseten den Anmeldeablauf, die GraphQL-Mutation oder das Posteingangsverhalten ändert, stoppt das Tool an diesem Schritt und sagt es. **[Öffne ein Issue](../../issues)** mit dem ausgeführten Befehl und der exakten Ausgabe; PRs sind willkommen.

## 📄 Lizenz

MIT © 2026 — siehe [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 baseten-bulk-apikey contributors

</div>

## ⚡ Lauf-Form (Presets)

`--preset=turbo|balanced|safe` legt Worker + die Pause zwischen Konten fest (turbo = 5,
balanced = 4, safe = 2); explizite `--conc`/`--gap` (oder die eigenen Flags des Repos) gewinnen immer,
und ohne `--preset` behält das Tool exakt seine bisherige Form.

Turbo önerilir (5 worker); daha fazlası zayıf bilgisayarda yük/ban riski.