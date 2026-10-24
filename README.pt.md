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

**Crie contas Baseten em massa com chaves de API geradas automaticamente — inferência compatível com OpenAI + conector 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-12%20served-412991?style=for-the-badge)](https://docs.baseten.co/)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Início rápido](#-quick-start) · [🎁 Camada gratuita](#-free-tier--how-much-you-get) · [🤖 Modelos](#-models--all-12-of-them) · [🧪 Use a API](#-how-to-use-the-api) · [✅ Verificado](#-verified-working--every-key-is-tested) · [🧭 Como funciona](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ Opções](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problemas](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Por que isso existe

A Baseten dá a cada **novo workspace** seus próprios créditos gratuitos, e uma chave de API pertence ao workspace — então *N chaves independentes significa N contas*. Esta ferramenta conduz todo esse ciclo de vida de ponta a ponta: caixa de entrada → login com o código por e-mail → sessão da conta → mutação GraphQL `create_user_api_key` → verificação ao vivo com uma conclusão de chat real. Sem clicar no painel, sem chave copiada e colada à mão.

## 🎁 Camada gratuita — quanto você recebe

**Cada novo workspace Baseten recebe créditos gratuitos de cadastro — sem cartão, cadastro por e-mail — e o crédito fica no workspace, não na chave.**

| O quê | Valor |
| --- | --- |
| Concessão de boas-vindas | créditos gratuitos concedidos por **novo workspace** no cadastro (saldo exibido em [app.baseten.co](https://app.baseten.co)) |
| Cartão exigido | **Não** |
| O que a chave carrega | uma chave `PERSONAL` vinculada ao seu workspace, válida em todos os **12 endpoints de modelo** |
| Cadastro | e-mail + código de 6 dígitos lido da caixa de entrada |
| A unidade que escala | **um workspace = uma chave** → `--target N` é na verdade "N workspaces gratuitos" |

> 💡 A camada gratuita é definida pela Baseten e pode mudar. Confira os números atuais em [baseten.co](https://baseten.co) — e deixe o próprio gate da ferramenta decidir:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modelos — todos os 12

Uma chave recém-criada serve **12 APIs de modelo** em `/v1/chat/completions` (medido em 2026-10-18: cada id abaixo respondeu **200** tanto pela linha local quanto por uma saída de proxy fria):

> ⚠️ `GET /v1/models` **não** é uma verificação de saúde confiável para uma chave nova: a borda responde à chave de uma conta recém-criada com **202**, um corpo vazio e `x-amzn-waf-action: challenge`, enquanto a mesma chave responde `/v1/chat/completions` com **200**. Uma chave sem cabeçalho de autenticação recebe um **401** simples. A ferramenta, portanto, trata a conclusão de chat como a prova e registra `modelsStatus` (geralmente `202`) junto com ela.

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

Teste ao vivo de uma chave — é exatamente isso que a ferramenta executa antes de aceitar uma chave:

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hi"}]}'
```

## 🧪 Como usar a API

A URL base é **`https://inference.baseten.co/v1`** — compatível com OpenAI, então qualquer coisa que fale OpenAI funciona.

**Qualquer SDK / curl**

```python
from openai import OpenAI
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key="<your key>")
print(client.chat.completions.create(model="zai-org/GLM-5.3-Flash",
      messages=[{"role": "user", "content": "hi"}]).choices[0].message.content)
```

**Qualquer agente / ferramenta com URL base personalizada** (Cursor, OpenCode, Kilo Code, …): defina a URL base `https://inference.baseten.co/v1`, cole uma chave, escolha qualquer id de modelo da tabela acima.

## 🛠 Início rápido

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

### 🖱️ O launcher

O launcher pergunta a quantidade de contas, o arquivo de saída, o backend da caixa de entrada e um proxy / lista de proxies opcional, memoriza as respostas em `launcher.config.json` e executa a CLI para você.

## ✅ Verificado e funcionando — toda chave é testada

> **Portões de qualidade.** Toda chave aqui passou por um `chat-200` ao vivo antes de ser gravada em `keys.txt`
> (chaves mortas nunca são entregues). As combinações de roteador seguem a mesma regra no nível do modelo: uma entrada é
> adicionada **somente se o modelo responder `chat-200` e conseguir chamar ferramentas** — um modelo sem suporte a ferramentas,
> uma chave morta ou um provedor morto é descartado em vez de adicionado. Funciona com **9Router e OmniRoute**.

Uma chave é gravada em `keys.txt` **somente depois** que a API de inferência responde com ela:

| Verificação | Resultado |
| --- | --- |
| `POST https://inference.baseten.co/v1/chat/completions` (`zai-org/GLM-5.3-Flash`) como prova ao vivo | **HTTP 200**, conclusão real (`finish_reason: "stop"`, `usage` presente) — a verificação decisiva |
| `GET https://inference.baseten.co/v1/models`, registrado por conta como `modelsStatus` | `202` + desafio waf para chaves novas; coorte mais antiga `200`; `401`/`403` final → `accounts-rejected.json` |
| contas vs chaves | uma chave por conta — nenhuma conta contribui com mais de uma chave |

```bash
node src/cli.js --verify-only --out keys.txt   # re-check the whole list at any time
```

## 🧭 Como funciona

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Baseten page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://inference.baseten.co/v1/chat/completions → real content = the key is live
```

| Etapa | Chamada | Notas |
| --- | --- | --- |
| login | página de login do Chrome → e-mail → código de 6 dígitos da caixa de entrada | conduzido via CDP, uma janela por vez |
| sessão | os cookies da conta | o navegador é fechado assim que os cookies estão em mãos |
| chave | `POST https://app.baseten.co/graphql/` → `CreateUserApiKey` | `{ textKey, prefix }` retornado exatamente uma vez |
| verificação | `POST https://inference.baseten.co/v1/chat/completions` | 200 ao vivo exigido antes de `keys.txt` |

## ⚙️ Opções da CLI

**`src/browser-batch.js`** — o caminho de uma conta por chave (cadastro no Chrome + criação de chave no Node + verificação ao vivo):

| Flag | Padrão | Significado |
| --- | --- | --- |
| `--target <n>` | `30` | quantas chaves **verificadas** a lista deve conter no final — qualquer N, sem limite |
| `--pool-browser <file>` | — | lista de proxies para a saída do navegador (um por linha) |
| `--per-run <n>` | `5` | contas por sessão de navegador |
| `--max-failures <n>` | `5` | parar após esta quantidade de falhas consecutivas |
| `--code-timeout <ms>` | `180000` | quanto tempo esperar pelo e-mail com o código mágico |
| `--warp <socks>` | — | fixar uma saída SOCKS de proxy |
| `--broker <url>` | — | endpoint do broker da caixa de entrada |

**`src/cli.js`** — a variante mais antiga, somente HTTP:

| Flag | Padrão | Significado |
| --- | --- | --- |
| `--count <n>` | `30` | contas a criar |
| `--out <file>` | `keys.txt` | uma chave verificada por linha |
| `--accounts <file>` | `accounts.json` | registros de conta (e-mail, chave, prefixo, saída, verificação) |
| `--rejected <file>` | `accounts-rejected.json` | contas cuja chave nunca foi verificada |
| `--proxy` / `--proxy-file <file>` | — | saída, ou um arquivo de pool |
| `--inbox <mode>` · `--broker <url>` | — | backend da caixa de entrada |
| `--allow-direct` | desligado | aceito por compatibilidade — uma execução sem lista de proxies é direta por padrão |
| `--verify-only` | desligado | reverificar as chaves em `--out` em vez de criar novas |

Os arquivos de dados são fixos para `browser-batch.js` e ficam na raiz do repositório: `keys.txt`, `accounts.json`, `browser-pending.json`, `browser-accounts.jsonl`.

## 🛰️ Atrás de um proxy

**Opcional — recomendado em escala (limites por IP, banimentos).** A ferramenta funciona sem proxy também: sem `--proxy`/`--proxy-file` (e sem linhas em `proxies.txt`) toda chamada sai da sua própria máquina e a execução registra o salto como `direct`.

```bash
node src/browser-batch.js --target 30 --pool-browser proxies.txt
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

Os proxies são carregados por linha (`http://`, `socks5://`, `socks4://`, ou apenas `host:port`) e rotacionados por conta, com novas tentativas em uma linha morta. Uma execução sem lista de proxies é direta por padrão (`--allow-direct` ainda é aceito, mas não é mais necessário).

## 📄 Arquivos

| Caminho | Conteúdo |
| --- | --- |
| `keys.txt` | chaves verificadas, uma por linha — ignorado pelo git, nunca commitado |
| `accounts.json` | registros de conta (e-mail, chave, prefixo) — ignorado pelo git |
| `accounts-rejected.json` | contas cuja chave nunca foi verificada — útil para novas tentativas |
| `launcher.config.json` | o que o launcher memoriza |
| `src/connect-9router.js` | registra as chaves em `keys.txt` como conexões do 9Router (zero dependências) |

## 🔌 Conectar ao 9Router

O [9Router](https://9router.com) é um roteador auto-hospedado e compatível com OpenAI. A Baseten oferece um endpoint compatível com OpenAI, então registre-o uma vez e cada chave se torna uma conexão sob um nó de provedor:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Padrões: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Os modelos são então servidos como `baseten/<model id>` e balanceados entre todas as chaves. Aponte o conector para um `keys.txt` atualizado para adicionar mais contas; o nó e sua lista de modelos permanecem os mesmos.

## 🔌 Conectar ao OmniRoute

<<<<<<< Updated upstream
O [OmniRoute](https://omniroute.online) é um roteador auto-hospedado e compatível com OpenAI. A Baseten oferece um endpoint compatível com OpenAI, então registre-o uma vez e cada chave se torna uma conexão sob um nó de provedor:
=======
O [OmniRoute](https://omniroute.online) é um roteador auto-hospedado e compatível com OpenAI. A Baseten oferece um endpoint compatível com OpenAI, então registre-o uma vez e cada chave se torna uma conexão sob um único nó de provedor:
>>>>>>> Stashed changes

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Padrões: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Os modelos são então servidos como `baseten/<model id>` e balanceados entre todas as chaves. Aponte o conector para um `keys.txt` atualizado para adicionar mais contas; o nó e sua lista de modelos permanecem os mesmos.
<<<<<<< Updated upstream
## 🔑 O que uma chave oferece
=======

## 🔑 O que uma chave te dá
>>>>>>> Stashed changes

| | |
| --- | --- |
| 🏢 Provedor | **Baseten** — [baseten.co](https://baseten.co) |
| 🎁 O que o provedor oferece | uma conta (workspace) por chave — cada chave verificada por chat nas APIs de Modelo |
| 🔑 O que uma chave oferece | uma chave de API vinculada à sua própria conta: os 12 ids de modelo no endpoint abaixo, nos limites do seu plano. A cota fica na **conta**, que é exatamente por isso que esta ferramenta cria uma conta por chave |
| 🌐 Formato da API | Compatível com OpenAI: `POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 Seus dados | apenas baseten.co e o backend de caixa de entrada que você configurar são contatados; as chaves ficam na sua máquina |

## 🐞 Problemas

Se a Baseten mudar o fluxo de login, a mutação GraphQL ou o comportamento da caixa de entrada, a ferramenta para nessa etapa e avisa. **[Abra uma issue](../../issues)** com o comando que você executou e a saída exata; PRs são bem-vindos.

## 📄 Licença

MIT © 2026 — veja [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 baseten-bulk-apikey contributors

</div>

## ⚡ Formato de execução (presets)

`--preset=turbo|balanced|safe` define os workers + a pausa entre contas (turbo = 5,
balanced = 4, safe = 2); `--conc`/`--gap` explícitos (ou as flags do próprio repositório) sempre vencem,
e sem `--preset` a ferramenta mantém exatamente seu formato histórico.

Turbo önerilir (5 worker); daha fazlası zayıf bilgisayarda yük/ban riski.