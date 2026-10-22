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

**Créez en masse des comptes Baseten avec des clés API générées automatiquement — inférence compatible OpenAI + connecteur 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-12%20served-412991?style=for-the-badge)](https://docs.baseten.co/)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Démarrage rapide](#-quick-start) · [🎁 Offre gratuite](#-free-tier--how-much-you-get) · [🤖 Modèles](#-models--all-12-of-them) · [🧪 Utiliser l'API](#-how-to-use-the-api) · [✅ Vérifié](#-verified-working--every-key-is-tested) · [🧭 Comment ça marche](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Options](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problèmes](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Pourquoi cet outil existe

Baseten offre à chaque **nouvel espace de travail** ses propres crédits gratuits, et une clé API appartient à l'espace de travail — donc *N clés indépendantes signifie N comptes*. Cet outil pilote tout ce cycle de vie de bout en bout : boîte de réception → connexion avec le code reçu par e-mail → session du compte → mutation GraphQL `create_user_api_key` → vérification en direct avec une vraie complétion de chat. Aucun clic dans le tableau de bord, aucune clé copiée-collée à la main.

## 🎁 Offre gratuite — ce que vous obtenez

**Chaque nouvel espace de travail Baseten reçoit des crédits gratuits à l'inscription — sans carte, inscription par e-mail — et le crédit est rattaché à l'espace de travail, pas à la clé.**

| Élément | Valeur |
| --- | --- |
| Allocation de bienvenue | crédits gratuits accordés par **nouvel espace de travail** à l'inscription (solde affiché sur [app.baseten.co](https://app.baseten.co)) |
| Carte requise | **Non** |
| Ce que porte la clé | une clé `PERSONAL` limitée à son espace de travail, valable sur les **12 points de terminaison de modèles** |
| Inscription | e-mail + code à 6 chiffres lu dans la boîte de réception |
| L'unité qui se multiplie | **un espace de travail = une clé** → `--target N` signifie en réalité « N espaces de travail gratuits » |

> 💡 L'offre gratuite est définie par Baseten et peut changer. Consultez les chiffres en direct sur [baseten.co](https://baseten.co) — et laissez le contrôle de l'outil trancher :

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modèles — les 12 au complet

Une clé fraîchement générée sert **12 API de modèles** sur `/v1/chat/completions` (mesuré le 2026-10-18 : chaque identifiant ci-dessous a répondu **200** depuis la ligne locale et depuis une sortie proxy froide) :

> ⚠️ `GET /v1/models` n'est **pas** un contrôle de santé fiable pour une clé fraîche : le edge répond à la clé d'un tout nouveau compte avec **202**, un corps vide et `x-amzn-waf-action: challenge`, tandis que la même clé répond à `/v1/chat/completions` avec **200**. Une clé sans en-tête d'authentification reçoit un simple **401**. L'outil considère donc la complétion de chat comme la preuve et enregistre `modelsStatus` (généralement `202`) à côté.

|Modèle|✓|
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

Test en direct d'une clé — c'est exactement ce que l'outil exécute avant d'accepter une clé :

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hi"}]}'
```

## 🧪 Comment utiliser l'API

L'URL de base est **`https://inference.baseten.co/v1`** — compatible OpenAI, donc tout ce qui parle OpenAI fonctionne.

**N'importe quel SDK / curl**

```python
from openai import OpenAI
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key="<your key>")
print(client.chat.completions.create(model="zai-org/GLM-5.3-Flash",
      messages=[{"role": "user", "content": "hi"}]).choices[0].message.content)
```

**N'importe quel agent / outil avec une URL de base personnalisée** (Cursor, OpenCode, Kilo Code, …) : définissez l'URL de base `https://inference.baseten.co/v1`, collez une clé, choisissez n'importe quel identifiant de modèle dans le tableau ci-dessus.

## 🛠 Démarrage rapide

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

### 🖱️ Le lanceur

Le lanceur demande le nombre de comptes, le fichier de sortie, le backend de boîte de réception et un proxy / une liste de proxies facultatif, mémorise les réponses dans `launcher.config.json` et exécute la CLI pour vous.

## ✅ Vérifié et fonctionnel — chaque clé est testée

Une clé n'est écrite dans `keys.txt` **qu'après** que l'API d'inférence ait répondu avec elle :

| Contrôle | Résultat |
| --- | --- |
| `POST https://inference.baseten.co/v1/chat/completions` (`zai-org/GLM-5.3-Flash`) comme preuve en direct | **HTTP 200**, vraie complétion (`finish_reason: "stop"`, `usage` présent) — le contrôle décisif |
| `GET https://inference.baseten.co/v1/models`, enregistré par compte comme `modelsStatus` | `202` + challenge waf pour les clés fraîches ; cohorte plus ancienne `200` ; `401`/`403` définitif → `accounts-rejected.json` |
| comptes vs clés | une clé par compte — aucun compte ne fournit plus d'une clé |

```bash
node src/cli.js --verify-only --out keys.txt   # re-check the whole list at any time
```

## 🧭 Comment ça marche

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Baseten page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://inference.baseten.co/v1/chat/completions → real content = the key is live
```

| Étape | Appel | Remarques |
| --- | --- | --- |
| connexion | page de connexion Chrome → e-mail → code à 6 chiffres depuis la boîte de réception | piloté via CDP, une fenêtre à la fois |
| session | les cookies du compte | le navigateur est fermé dès que les cookies sont en main |
| clé | `POST https://app.baseten.co/graphql/` → `CreateUserApiKey` | `{ textKey, prefix }` renvoyé exactement une fois |
| contrôle | `POST https://inference.baseten.co/v1/chat/completions` | un 200 en direct requis avant `keys.txt` |

## ⚙️ Options de la CLI

**`src/browser-batch.js`** — le chemin un compte par clé (inscription Chrome + génération de clé Node + vérification en direct) :

| Option | Défaut | Signification |
| --- | --- | --- |
| `--target <n>` | `30` | combien de clés **vérifiées** la liste doit contenir au final — n'importe quel N, sans plafond |
| `--pool-browser <file>` | — | liste de proxies pour la sortie du navigateur (une par ligne) |
| `--per-run <n>` | `5` | comptes par session de navigateur |
| `--max-failures <n>` | `5` | arrêter après ce nombre d'échecs consécutifs |
| `--code-timeout <ms>` | `180000` | combien de temps attendre l'e-mail contenant le code magique |
| `--warp <socks>` | — | épingler une sortie proxy SOCKS |
| `--broker <url>` | — | point de terminaison du broker de boîte de réception |

**`src/cli.js`** — la variante plus ancienne en HTTP uniquement :

| Option | Défaut | Signification |
| --- | --- | --- |
| `--count <n>` | `30` | comptes à créer |
| `--out <file>` | `keys.txt` | une clé vérifiée par ligne |
| `--accounts <file>` | `accounts.json` | enregistrements de comptes (e-mail, clé, préfixe, sortie, vérification) |
| `--rejected <file>` | `accounts-rejected.json` | comptes dont la clé n'a jamais été vérifiée |
| `--proxy` / `--proxy-file <file>` | — | sortie, ou un fichier de pool |
| `--inbox <mode>` · `--broker <url>` | — | backend de boîte de réception |
| `--allow-direct` | désactivé | autoriser une exécution sans proxy |
| `--verify-only` | désactivé | revérifier les clés dans `--out` au lieu d'en générer |

Les fichiers de données sont fixes pour `browser-batch.js` et se trouvent à la racine du dépôt : `keys.txt`, `accounts.json`, `browser-pending.json`, `browser-accounts.jsonl`.

## 🛰️ Derrière un proxy

**Recommandé pour tout ce qui dépasse une poignée de comptes.** Un compte par clé signifie une inscription par clé, et une liste de proxies donne à chaque inscription sa propre sortie.

```bash
node src/browser-batch.js --target 30 --pool-browser proxies.txt
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

Les proxies sont chargés ligne par ligne (`http://`, `socks5://`, `socks4://`, ou `host:port` nu) et mis en rotation à chaque compte, avec des tentatives répétées sur une ligne morte. `cli.js` refuse de s'exécuter sans proxy sauf si vous passez `--allow-direct`.

## 📄 Fichiers

| Chemin | Contenu |
| --- | --- |
| `keys.txt` | clés vérifiées, une par ligne — ignoré par git, jamais commité |
| `accounts.json` | enregistrements de comptes (e-mail, clé, préfixe) — ignoré par git |
| `accounts-rejected.json` | comptes dont la clé n'a jamais été vérifiée — utile pour les nouvelles tentatives |
| `launcher.config.json` | ce que le lanceur mémorise |
| `src/connect-9router.js` | enregistre les clés de `keys.txt` comme connexions 9Router (zéro dépendance) |

## 🔌 Connexion à 9Router

[9Router](https://9router.com) est un routeur auto-hébergé compatible OpenAI. Baseten fournit un point de terminaison compatible OpenAI, donc enregistrez-le une fois et chaque clé devient une connexion sous un même nœud fournisseur :

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Valeurs par défaut : `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Les modèles sont alors servis sous `baseten/<model id>` et répartis en charge entre toutes les clés. Pointez le connecteur vers un `keys.txt` actualisé pour ajouter des comptes ; le nœud et sa liste de modèles restent identiques.

## 🔑 Ce qu'une clé vous apporte

| | |
| --- | --- |
| 🏢 Fournisseur | **Baseten** — [baseten.co](https://baseten.co) |
| 🎁 Ce que le fournisseur donne | un compte (espace de travail) par clé — chaque clé vérifiée par chat sur les API de modèles |
| 🔑 Ce qu'une clé vous apporte | une clé API limitée à son propre compte : les 12 identifiants de modèles sur le point de terminaison ci-dessous, aux limites de votre offre. Le quota est rattaché au **compte**, ce qui explique précisément pourquoi cet outil crée un compte par clé |
| 🌐 Forme de l'API | compatible OpenAI : `POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 Vos données | seuls baseten.co et le backend de boîte de réception que vous configurez sont contactés ; les clés restent sur votre machine |

## 🐞 Problèmes

Si Baseten modifie le flux de connexion, la mutation GraphQL ou le comportement de la boîte de réception, l'outil s'arrête à cette étape et le signale. **[Ouvrez un ticket](../../issues)** avec la commande que vous avez exécutée et la sortie exacte ; les PR sont bienvenues.

## 📄 Licence

MIT © 2026 — voir [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 baseten-bulk-apikey contributors

</div>

## ⚡ Forme d'exécution (préréglages)

`--preset=turbo|balanced|safe` définit les workers + la pause entre les comptes (turbo = 5,
balanced = 4, safe = 2) ; les `--conc`/`--gap` explicites (ou les options propres du dépôt) l'emportent toujours,
et sans `--preset` l'outil conserve exactement sa forme historique.

Turbo önerilir (5 worker) ; daha fazlası zayıf bilgisayarda yük/ban riski.