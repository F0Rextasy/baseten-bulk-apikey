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

**Crea cuentas de Baseten en masa con claves API autogeneradas — inferencia compatible con OpenAI + conector 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-12%20served-412991?style=for-the-badge)](https://docs.baseten.co/)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Inicio rápido](#-quick-start) · [🎁 Nivel gratuito](#-free-tier--how-much-you-get) · [🤖 Modelos](#-models--all-12-of-them) · [🧪 Usar la API](#-how-to-use-the-api) · [✅ Verificado](#-verified-working--every-key-is-tested) · [🧭 Cómo funciona](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ Opciones](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problemas](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Por qué existe esto

Baseten le da a cada **espacio de trabajo nuevo** sus propios créditos gratuitos, y una clave API pertenece al espacio de trabajo — así que *N claves independientes significan N cuentas*. Esta herramienta impulsa todo ese ciclo de vida de principio a fin: bandeja de entrada → inicio de sesión con el código de correo electrónico → sesión de cuenta → mutación GraphQL `create_user_api_key` → verificación en vivo con una finalización de chat real. Sin hacer clic en el panel, sin copiar y pegar claves a mano.

## 🎁 Nivel gratuito — cuánto obtienes

**Cada espacio de trabajo nuevo de Baseten obtiene créditos de registro gratuitos — sin tarjeta, registro por correo electrónico — y el crédito vive en el espacio de trabajo, no en la clave.**

| Qué | Valor |
| --- | --- |
| Asignación de bienvenida | créditos gratuitos otorgados por **espacio de trabajo nuevo** al registrarse (saldo mostrado en [app.baseten.co](https://app.baseten.co)) |
| Tarjeta requerida | **No** |
| Qué lleva la clave | una clave `PERSONAL` limitada a su espacio de trabajo, válida en los **12 endpoints de modelos** |
| Registro | correo electrónico + código de 6 dígitos leído de la bandeja de entrada |
| La unidad que escala | **un espacio de trabajo = una clave** → `--target N` en realidad significa "N espacios de trabajo gratuitos" |

> 💡 El nivel gratuito lo define Baseten y puede cambiar. Consulta los números en vivo en [baseten.co](https://baseten.co) — y deja que la propia puerta de la herramienta decida:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modelos — los 12

Una clave recién creada sirve **12 API de modelos** en `/v1/chat/completions` (medido el 2026-10-18: cada id a continuación respondió **200** tanto desde la línea local como desde una salida de proxy en frío):

> ⚠️ `GET /v1/models` **no** es una verificación de estado confiable para una clave nueva: el edge responde a la clave de una cuenta recién creada con **202**, un cuerpo vacío y `x-amzn-waf-action: challenge`, mientras que la misma clave responde a `/v1/chat/completions` con **200**. Una clave sin encabezado de autenticación recibe un **401** simple. Por lo tanto, la herramienta trata la finalización de chat como la prueba y registra `modelsStatus` (normalmente `202`) junto a ella.

|Modelo|✓|
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

Prueba en vivo de una clave — esto es exactamente lo que ejecuta la herramienta antes de aceptar una clave:

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hi"}]}'
```

## 🧪 Cómo usar la API

La URL base es **`https://inference.baseten.co/v1`** — compatible con OpenAI, así que cualquier cosa que hable OpenAI funciona.

**Cualquier SDK / curl**

```python
from openai import OpenAI
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key="<your key>")
print(client.chat.completions.create(model="zai-org/GLM-5.3-Flash",
      messages=[{"role": "user", "content": "hi"}]).choices[0].message.content)
```

**Cualquier agente / herramienta con una URL base personalizada** (Cursor, OpenCode, Kilo Code, …): establece la URL base `https://inference.baseten.co/v1`, pega una clave, elige cualquier id de modelo de la tabla anterior.

## 🛠 Inicio rápido

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

### 🖱️ El lanzador

El lanzador pregunta por la cantidad de cuentas, el archivo de salida, el backend de la bandeja de entrada y un proxy / lista de proxies opcional, recuerda las respuestas en `launcher.config.json` y ejecuta el CLI por ti.

## ✅ Verificado y funcionando — cada clave se prueba

> **Controles de calidad.** Cada clave aquí pasó un `chat-200` en vivo antes de escribirse en `keys.txt`
> (las claves muertas nunca se entregan). Las combinaciones del router siguen la misma regla a nivel de modelo: una entrada se
> agrega **solo si el modelo responde `chat-200` y puede llamar herramientas** — un modelo sin soporte de herramientas,
> una clave muerta o un proveedor muerto se descarta en lugar de agregarse. Funciona con **9Router y OmniRoute**.

Una clave se escribe en `keys.txt` **solo después** de que la API de inferencia responde con ella:

| Verificación | Resultado |
| --- | --- |
| `POST https://inference.baseten.co/v1/chat/completions` (`zai-org/GLM-5.3-Flash`) como prueba en vivo | **HTTP 200**, finalización real (`finish_reason: "stop"`, `usage` presente) — la verificación decisiva |
| `GET https://inference.baseten.co/v1/models`, registrado por cuenta como `modelsStatus` | `202` + desafío waf para claves nuevas; cohorte anterior `200`; `401`/`403` final → `accounts-rejected.json` |
| cuentas vs claves | una clave por cuenta — ninguna cuenta aporta más de una clave |

```bash
node src/cli.js --verify-only --out keys.txt   # re-check the whole list at any time
```

## 🧭 Cómo funciona

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Baseten page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://inference.baseten.co/v1/chat/completions → real content = the key is live
```

| Paso | Llamada | Notas |
| --- | --- | --- |
| inicio de sesión | página de inicio de sesión de Chrome → correo electrónico → código de 6 dígitos de la bandeja de entrada | controlado por CDP, una ventana a la vez |
| sesión | las cookies de la cuenta | el navegador se cierra tan pronto como se tienen las cookies |
| clave | `POST https://app.baseten.co/graphql/` → `CreateUserApiKey` | `{ textKey, prefix }` devuelto exactamente una vez |
| verificación | `POST https://inference.baseten.co/v1/chat/completions` | se requiere un 200 en vivo antes de `keys.txt` |

## ⚙️ Opciones del CLI

**`src/browser-batch.js`** — la ruta de una cuenta por clave (registro en Chrome + creación de clave en Node + verificación en vivo):

| Opción | Predeterminado | Significado |
| --- | --- | --- |
| `--target <n>` | `30` | con cuántas claves **verificadas** debe terminar la lista — cualquier N, sin límite |
| `--pool-browser <file>` | — | lista de proxies para la salida del navegador (uno por línea) |
| `--per-run <n>` | `5` | cuentas por sesión de navegador |
| `--max-failures <n>` | `5` | detenerse después de esta cantidad de fallos consecutivos |
| `--code-timeout <ms>` | `180000` | cuánto esperar el correo con el código mágico |
| `--warp <socks>` | — | fijar una salida SOCKS de proxy |
| `--broker <url>` | — | endpoint del broker de la bandeja de entrada |

**`src/cli.js`** — la variante anterior solo HTTP:

| Opción | Predeterminado | Significado |
| --- | --- | --- |
| `--count <n>` | `30` | cuentas a crear |
| `--out <file>` | `keys.txt` | una clave verificada por línea |
| `--accounts <file>` | `accounts.json` | registros de cuentas (correo electrónico, clave, prefijo, salida, verificación) |
| `--rejected <file>` | `accounts-rejected.json` | cuentas cuya clave nunca se verificó |
| `--proxy` / `--proxy-file <file>` | — | salida, o un archivo de pool |
| `--inbox <mode>` · `--broker <url>` | — | backend de la bandeja de entrada |
| `--allow-direct` | desactivado | aceptado por compatibilidad — una ejecución sin lista de proxies es directa por defecto |
| `--verify-only` | desactivado | volver a verificar las claves en `--out` en lugar de crearlas |

Los archivos de datos son fijos para `browser-batch.js` y viven en la raíz del repositorio: `keys.txt`, `accounts.json`, `browser-pending.json`, `browser-accounts.jsonl`.

## 🛰️ Detrás de un proxy

**Opcional — recomendado a escala (límites por IP, bloqueos).** La herramienta también funciona sin proxy: sin `--proxy`/`--proxy-file` (y sin líneas en `proxies.txt`) cada llamada sale desde tu propia máquina y la ejecución registra el salto como `direct`.

```bash
node src/browser-batch.js --target 30 --pool-browser proxies.txt
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

Los proxies se cargan por línea (`http://`, `socks5://`, `socks4://`, o `host:port` sin esquema) y se rotan por cuenta, con reintentos en una línea muerta. Una ejecución sin lista de proxies es directa por defecto (`--allow-direct` todavía se acepta pero ya no es necesario).

## 📄 Archivos

| Ruta | Contenido |
| --- | --- |
| `keys.txt` | claves verificadas, una por línea — ignorado por git, nunca confirmado |
| `accounts.json` | registros de cuentas (correo electrónico, clave, prefijo) — ignorado por git |
| `accounts-rejected.json` | cuentas cuya clave nunca se verificó — útil para reintentos |
| `launcher.config.json` | lo que recuerda el lanzador |
| `src/connect-9router.js` | registra las claves en `keys.txt` como conexiones de 9Router (cero dependencias) |

## 🔌 Conectar con 9Router

[9Router](https://9router.com) es un router autoalojado y compatible con OpenAI. Baseten ofrece un endpoint compatible con OpenAI, así que regístralo una vez y cada clave se convierte en una conexión bajo un nodo de proveedor:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Predeterminados: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Los modelos se sirven entonces como `baseten/<model id>` y se balancean la carga entre todas las claves. Apunta el conector a un `keys.txt` actualizado para agregar más cuentas; el nodo y su lista de modelos permanecen igual.

<<<<<<< Updated upstream
## 🔌 Conectar con OmniRoute

[OmniRoute](https://omniroute.online) es un router autoalojado y compatible con OpenAI. Baseten ofrece un endpoint compatible con OpenAI, así que regístralo una vez y cada clave se convierte en una conexión bajo un nodo de proveedor:
=======
## 🔌 Conectar a OmniRoute

[OmniRoute](https://omniroute.online) es un enrutador autohospedado compatible con OpenAI. Baseten ofrece un punto final compatible con OpenAI, así que regístralo una vez y cada clave se convierte en una conexión bajo un nodo proveedor:
>>>>>>> Stashed changes

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

<<<<<<< Updated upstream
Predeterminados: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Los modelos se sirven entonces como `baseten/<model id>` y se balancean la carga entre todas las claves. Apunta el conector a un `keys.txt` actualizado para agregar más cuentas; el nodo y su lista de modelos permanecen igual.
## 🔑 Qué te da una clave
=======
Valores predeterminados: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Los modelos se sirven como `baseten/<id del modelo>` y se balancean entre todas las claves. Apunta el conector a un `keys.txt` actualizado para añadir más cuentas; el nodo y su lista de modelos permanecen iguales.

## 🔑 Qué obtienes con una clave
>>>>>>> Stashed changes

| | |
| --- | --- |
| 🏢 Proveedor | **Baseten** — [baseten.co](https://baseten.co) |
| 🎁 Qué da el proveedor | una cuenta (espacio de trabajo) por clave — cada clave verificada por chat en las API de modelos |
| 🔑 Qué te da una clave | una clave API limitada a su propia cuenta: los 12 ids de modelo en el endpoint a continuación, con los límites de tu plan. La cuota vive en la **cuenta**, que es exactamente por lo que esta herramienta crea una cuenta por clave |
| 🌐 Forma de la API | Compatible con OpenAI: `POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 Tus datos | solo se contacta a baseten.co y al backend de bandeja de entrada que configures; las claves permanecen en tu máquina |

## 🐞 Problemas

Si Baseten cambia el flujo de inicio de sesión, la mutación GraphQL o el comportamiento de la bandeja de entrada, la herramienta se detiene en ese paso y lo indica. **[Abre un issue](../../issues)** con el comando que ejecutaste y la salida exacta; los PR son bienvenidos.

## 📄 Licencia

MIT © 2026 — consulta [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 baseten-bulk-apikey contributors

</div>

## ⚡ Forma de ejecución (presets)

`--preset=turbo|balanced|safe` establece los workers + la pausa entre cuentas (turbo = 5,
balanced = 4, safe = 2); `--conc`/`--gap` explícitos (o las propias opciones del repositorio) siempre tienen prioridad,
y sin `--preset` la herramienta mantiene exactamente su forma histórica.

Turbo önerilir (5 worker); daha fazlası zayıf bilgisayarda yük/ban riski.