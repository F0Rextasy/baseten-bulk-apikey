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

**Cree cuentas de Baseten en masa con claves API generadas automáticamente — inferencia compatible con OpenAI + conector 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-12%20served-412991?style=for-the-badge)](https://docs.baseten.co/)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Inicio rápido](#-inicio-rápido) · [🎁 Capa gratuita](#-capa-gratuita--cuánto-recibes) · [🤖 Modelos](#-modelos--los-12-completos) · [🧪 Usa la API](#-cómo-usar-la-api) · [✅ Verificado](#-funcionando--cada-clave-se-prueba) · [🧭 Cómo funciona](#-cómo-funciona) · [🔌 9Router](#-conectar-a-9router) · [⚙️ Opciones](#️-opciones-cli) · [🛰️ Proxies](#️-detrás-de-un-proxy) · [🐞 Problemas](#-problemas)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>



---

## ✨ Por qué existe esto

Baseten otorga créditos gratuitos a cada **nuevo espacio de trabajo**, y una clave API pertenece al espacio de trabajo — por lo tanto, *N claves independientes significa N cuentas*. Esta herramienta automatiza todo el ciclo de vida: buzón → inicio de sesión con código por correo → sesión de cuenta → mutación GraphQL `create_user_api_key` → verificación activa con una verdadera llamada de chat. Sin hacer clic en el panel, sin copiar claves manualmente.

## 🎁 Capa gratuita — cuánto recibes

**Cada nuevo espacio de trabajo de Baseten recibe créditos gratuitos al registrarse — sin tarjeta, solo correo electrónico — y el crédito permanece en el espacio de trabajo, no en la clave.**

| Qué | Valor |
| --- | --- |
| Crédito de bienvenida | créditos gratuitos otorgados por **nuevo espacio de trabajo** al registrarse (saldo visible en [app.baseten.co](https://app.baseten.co)) |
| Tarjeta requerida | **No** |
| Qué lleva la clave | una clave `PERSONAL` limitada a su espacio de trabajo, válida en los **12 puntos finales de modelos** |
| Registro | correo electrónico + código de 6 dígitos leído desde el buzón |
| Unidad que escala | **un espacio de trabajo = una clave** → `--target N` significa realmente "N espacios de trabajo gratuitos" |

> 💡 La capa gratuita es establecida por Baseten y puede cambiar. Consulta los valores actuales en [baseten.co](https://baseten.co) — y deja que el propio sistema de verificación de la herramienta decida:

```bash
node src/cli.js --verify-only     # cada clave en keys.txt se vuelve a probar con una llamada real de chat
```

## 🤖 Modelos — los 12 completos

Una clave recién creada sirve **12 APIs de modelos** en `/v1/chat/completions` (medido el 2026-10-18: cada ID de abajo respondió **200** desde la línea principal y desde una salida de proxy fría):

> ⚠️ `GET /v1/models` **no** es una verificación confiable para una clave nueva: el borde responde a la clave de una cuenta recién creada con **202**, cuerpo vacío y `x-amzn-waf-action: challenge`, mientras que la misma clave responde `/v1/chat/completions` con **200**. Una clave sin encabezado de autenticación obtiene un **401** claro. Por eso, la herramienta considera la completación de chat como prueba y registra `modelsStatus` (normalmente `202`) junto con ella.

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

Prueba activa de una clave — esto es exactamente lo que ejecuta la herramienta antes de aceptar una clave:

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <una de tus claves>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hola"}]}'
```

## 🧪 Cómo usar la API

La URL base es **`https://inference.baseten.co/v1`** — compatible con OpenAI, por lo que cualquier cosa que entienda OpenAI funcionará.

**Cualquier SDK / curl**

```python
from openai import OpenAI
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key="<tu clave>")
print(client.chat.completions.create(model="zai-org/GLM-5.3-Flash",
      messages=[{"role": "user", "content": "hola"}]).choices[0].message.content)
```

**Cualquier agente / herramienta con URL base personalizada** (Cursor, OpenCode, Kilo Code, …): establece la URL base `https://inference.baseten.co/v1`, pega una clave, elige cualquier ID de modelo de la tabla de arriba.

## 🛠 Inicio rápido

```bash
# clona este repositorio (o descarga el ZIP), luego:
cd baseten-bulk-apikey
node src/launcher.js          # interactivo: crear / verificar / ajustes / ayuda
```

```bash
# ruta cuenta-por-clave (registro con Chrome + creación de clave en Node + verificación activa)
node src/browser-batch.js --target 30 --pool-browser proxies.txt

# variante antigua solo HTTP
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt \
            --inbox broker --broker http://127.0.0.1:9700
```

### 🖱️ El lanzador

El lanzador pregunta por la cantidad de cuentas, el archivo de salida, el backend del buzón y un proxy / lista de proxies opcional, recuerda las respuestas en `launcher.config.json`, y ejecuta el CLI por ti.

## ✅ Funcionando — cada clave se prueba

Una clave se escribe en `keys.txt` **solo después** de que la API de inferencia responda con ella:

| Comprobación | Resultado |
| --- | --- |
| `POST https://inference.baseten.co/v1/chat/completions` (`zai-org/GLM-5.3-Flash`) como prueba activa | **HTTP 200**, completación real (`finish_reason: "stop"`, `usage` presente) — la comprobación decisiva |
| `GET https://inference.baseten.co/v1/models`, registrada por cuenta como `modelsStatus` | `202` + desafío waf para claves nuevas; cohortes antiguas `200`; `401`/`403` final → `accounts-rejected.json` |
| cuentas vs claves | una clave por cuenta — ninguna cuenta aporta más de una clave |

```bash
node src/cli.js --verify-only --out keys.txt   # vuelve a verificar toda la lista en cualquier momento
```

## 🧭 Cómo funciona

```
buzón (una dirección por cuenta)                                  una dirección nueva por cuenta
   │
   ├─▶ registro: página de Baseten → dirección de correo → código / enlace desde el buzón
   ├─▶ sesión: cookies de la cuenta o token de acceso obtenido
   ├─▶ creación de clave: punto final de claves de la cuenta → clave en texto claro devuelta una vez (escrita inmediatamente en disco)
   └─▶ prueba activa: POST https://inference.baseten.co/v1/chat/completions → contenido real = la clave está activa
```

| Paso | Llamada | Notas |
| --- | --- | --- |
| inicio de sesión | página de inicio de sesión de Chrome → correo → código de 6 dígitos desde el buzón | controlado mediante CDP, una ventana a la vez |
| sesión | cookies de la cuenta | el navegador se cierra tan pronto como se obtienen las cookies |
| clave | `POST https://app.baseten.co/graphql/` → `CreateUserApiKey` | `{ textKey, prefix }` devuelto exactamente una vez |
| comprobación | `POST https://inference.baseten.co/v1/chat/completions` | 200 activo requerido antes de `keys.txt` |

## ⚙️ Opciones CLI

**`src/browser-batch.js`** — la ruta cuenta-por-clave (registro con Chrome + creación de clave en Node + verificación activa):

| Bandera | Predeterminado | Significado |
| --- | --- | --- |
| `--target <n>` | `30` | cuántas claves **verificadas** debe tener la lista al final — cualquier N, sin límite |
| `--pool-browser <archivo>` | — | lista de proxies para salida del navegador (uno por línea) |
| `--per-run <n>` | `5` | cuentas por sesión del navegador |
| `--max-failures <n>` | `5` | detenerse tras tantos fallos consecutivos |
| `--code-timeout <ms>` | `180000` | tiempo de espera para el correo con el código mágico |
| `--warp <socks>` | — | fijar una salida SOCKS de WARP |
| `--broker <url>` | — | punto final del broker del buzón |

**`src/cli.js`** — la variante más antigua solo HTTP:

| Bandera | Predeterminado | Significado |
| --- | --- | --- |
| `--count <n>` | `30` | cuentas a crear |
| `--out <archivo>` | `keys.txt` | una clave verificada por línea |
| `--accounts <archivo>` | `accounts.json` | registros de cuenta (correo, clave, prefijo, salida, verificación) |
| `--rejected <archivo>` | `accounts-rejected.json` | cuentas cuya clave nunca se verificó |
| `--proxy` / `--proxy-file <archivo>` | — | salida, o archivo de grupo |
| `--inbox <modo>` · `--broker <url>` | — | backend del buzón |
| `--allow-direct` | desactivado | permitir ejecución sin proxy |
| `--verify-only` | desactivado | volver a verificar las claves en `--out` en lugar de crearlas |

Los archivos de datos son fijos para `browser-batch.js` y están en la raíz del repositorio: `keys.txt`, `accounts.json`, `browser-pending.json`, `browser-accounts.jsonl`.

## 🛰️ Detrás de un proxy

**Recomendado para más que unas pocas cuentas.** Una cuenta por clave significa un registro por clave, y una lista de proxies da a cada registro su propia salida.

```bash
node src/browser-batch.js --target 30 --pool-browser proxies.txt
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

Los proxies se cargan por línea (`http://`, `socks5://`, `socks4://`, o `host:port` simple) y se rotan por cuenta, con reintentos si una línea falla. `cli.js` se niega a ejecutarse sin proxy a menos que pases `--allow-direct`.

## 📄 Archivos

| Ruta | Contenido |
| --- | --- |
| `keys.txt` | claves verificadas, una por línea — ignorado por git, nunca se sube |
| `accounts.json` | registros de cuenta (correo, clave, prefijo) — ignorado por git |
| `accounts-rejected.json` | cuentas cuya clave nunca se verificó — útil para reintentos |
| `launcher.config.json` | lo que recuerda el lanzador |
| `src/connect-9router.js` | registra las claves en `keys.txt` como conexiones 9Router (sin dependencias) |

## 🔌 Conectar a 9Router

[9Router](https://9router.com) es un enrutador autohospedado compatible con OpenAI. Baseten ofrece un punto final compatible con OpenAI, así que regístralo una vez y cada clave se convierte en una conexión bajo un nodo proveedor:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Valores predeterminados: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Los modelos se sirven como `baseten/<id del modelo>` y se balancean entre todas las claves. Apunta el conector a un `keys.txt` actualizado para añadir más cuentas; el nodo y su lista de modelos permanecen iguales.

## 🔑 Qué obtienes con una clave

| | |
| --- | --- |
| 🏢 Proveedor | **Baseten** — [baseten.co](https://baseten.co) |
| 🎁 Qué da el proveedor | una cuenta (espacio de trabajo) por clave — cada clave verificada mediante chat en las APIs de modelos |
| 🔑 Qué obtienes con una clave | una clave API limitada a su propia cuenta: los 12 IDs de modelos en el punto final de abajo, dentro de los límites de tu plan. La cuota reside en la **cuenta**, que es exactamente por qué esta herramienta crea una cuenta por clave |
| 🌐 Formato de API | compatible con OpenAI: `POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 Tus datos | solo se contactan baseten.co y el backend de buzón que configures; las claves permanecen en tu máquina |

## 🐞 Problemas

Si Baseten cambia el flujo de inicio de sesión, la mutación GraphQL o el comportamiento del buzón, la herramienta se detendrá en ese paso y lo indicará. **[Abre un problema](../../issues)** con el comando que ejecutaste y la salida exacta; se aceptan PRs.

## 📄 Licencia

MIT © 2026 — consulta [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 colaboradores de baseten-bulk-apikey

</div>

## ⚡ Forma de ejecución (presets)

`--preset=turbo|balanced|safe` establece trabajadores + pausa entre cuentas (turbo = 5, equilibrado = 4, seguro = 2); `--conc`/`--gap` explícitos (o las propias banderas del repositorio) siempre tienen prioridad, y sin `--preset` la herramienta mantiene exactamente su forma histórica.

Turbo recomendado (5 trabajadores); más puede causar riesgo de carga o bloqueo en equipos débiles.