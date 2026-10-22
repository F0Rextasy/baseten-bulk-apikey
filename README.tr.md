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

**Otomatik oluşturulan API anahtarlarıyla toplu Baseten hesabı oluşturma — OpenAI uyumlu çıkarım + 9Router bağlayıcısı.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-12%20served-412991?style=for-the-badge)](https://docs.baseten.co/)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Hızlı başlangıç](#-quick-start) · [🎁 Ücretsiz katman](#-free-tier--how-much-you-get) · [🤖 Modeller](#-models--all-12-of-them) · [🧪 API'yi kullanma](#-how-to-use-the-api) · [✅ Doğrulandı](#-verified-working--every-key-is-tested) · [🧭 Nasıl çalışır](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Seçenekler](#️-cli-options) · [🛰️ Proxy'ler](#️-behind-a-proxy) · [🐞 Sorunlar](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Bu neden var

Baseten her **yeni çalışma alanına** kendi ücretsiz kredilerini verir ve bir API anahtarı çalışma alanına aittir — yani *N bağımsız anahtar, N hesap demektir*. Bu araç tüm bu yaşam döngüsünü uçtan uca yönetir: gelen kutusu → e-posta koduyla oturum açma → hesap oturumu → `create_user_api_key` GraphQL mutasyonu → gerçek bir sohbet tamamlama ile canlı doğrulama. Panelde tıklama yok, elle kopyala-yapıştır anahtar yok.

## 🎁 Ücretsiz katman — ne kadar alıyorsunuz

**Her yeni Baseten çalışma alanı ücretsiz kayıt kredisi alır — kart yok, e-posta ile kayıt — ve kredi anahtarda değil, çalışma alanında bulunur.**

| Ne | Değer |
| --- | --- |
| Hoş geldin ödeneği | kayıt sırasında her **yeni çalışma alanı** için verilen ücretsiz krediler (bakiye [app.baseten.co](https://app.baseten.co) adresinde gösterilir) |
| Kart gerekli mi | **Hayır** |
| Anahtarın taşıdığı şey | çalışma alanına kapsamlı bir `PERSONAL` anahtar, **12 model uç noktasının** tümünde geçerli |
| Kayıt | e-posta + gelen kutusundan okunan 6 haneli kod |
| Ölçeklenen birim | **bir çalışma alanı = bir anahtar** → `--target N` aslında "N ücretsiz çalışma alanı" demektir |

> 💡 Ücretsiz katman Baseten tarafından belirlenir ve değişebilir. Güncel sayıları [baseten.co](https://baseten.co) adresinden kontrol edin — ve kararı aracın kendi kapısına bırakın:

```bash
node src/cli.js --verify-only     # keys.txt içindeki her anahtar gerçek bir sohbet çağrısıyla yeniden test edilir
```

## 🤖 Modeller — 12'sinin tamamı

Yeni oluşturulmuş bir anahtar `/v1/chat/completions` üzerinde **12 model API'sine** hizmet eder (2026-10-18'de ölçüldü: aşağıdaki her kimlik hem ana hat üzerinden hem de soğuk bir proxy çıkışından **200** yanıtı verdi):

> ⚠️ `GET /v1/models` yeni bir anahtar için **güvenilir bir sağlık kontrolü değildir**: uç nokta yepyeni bir hesabın anahtarına **202**, boş bir gövde ve `x-amzn-waf-action: challenge` yanıtı verirken, aynı anahtar `/v1/chat/completions` isteğine **200** yanıtı verir. Yetkilendirme başlığı olmayan bir anahtar düz **401** alır. Bu nedenle araç, sohbet tamamlamayı kanıt olarak kabul eder ve yanında `modelsStatus` (genellikle `202`) kaydeder.

|Model|✓|
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

Bir anahtarın canlı testi — araç bir anahtarı kabul etmeden önce tam olarak bunu çalıştırır:

```bash
curl https://inference.baseten.co/v1/chat/completions \
  -H "Authorization: Bearer <one of your keys>" \
  -H "Content-Type: application/json" \
  -d '{"model":"zai-org/GLM-5.3-Flash","messages":[{"role":"user","content":"hi"}]}'
```

## 🧪 API nasıl kullanılır

Temel URL **`https://inference.baseten.co/v1`** — OpenAI uyumlu, yani OpenAI konuşan her şey çalışır.

**Herhangi bir SDK / curl**

```python
from openai import OpenAI
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key="<your key>")
print(client.chat.completions.create(model="zai-org/GLM-5.3-Flash",
      messages=[{"role": "user", "content": "hi"}]).choices[0].message.content)
```

**Özel temel URL kullanan herhangi bir ajan / araç** (Cursor, OpenCode, Kilo Code, …): temel URL'yi `https://inference.baseten.co/v1` olarak ayarlayın, bir anahtar yapıştırın, yukarıdaki tablodan herhangi bir model kimliği seçin.

## 🛠 Hızlı başlangıç

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

### 🖱️ Başlatıcı

Başlatıcı hesap sayısını, çıktı dosyasını, gelen kutusu arka ucunu ve isteğe bağlı bir proxy / proxy listesini sorar, yanıtları `launcher.config.json` içinde hatırlar ve sizin için CLI'yi çalıştırır.

## ✅ Doğrulandı — her anahtar test edilir

> **Kalite kapıları.** Buradaki her anahtar `keys.txt` dosyasına yazılmadan önce canlı bir `chat-200` testini geçti
> (ölü anahtarlar asla gönderilmez). Yönlendirici kombinasyonları model düzeyinde aynı kuralı izler: bir giriş
> **yalnızca model `chat-200` yanıtı veriyorsa ve araçları çağırabiliyorsa** eklenir — araç desteği olmayan bir model,
> ölü bir anahtar veya ölü bir sağlayıcı eklenmek yerine çıkarılır. **9Router ve OmniRoute** ile çalışır.

Bir anahtar `keys.txt` dosyasına **yalnızca** çıkarım API'si onunla yanıt verdikten sonra yazılır:

| Kontrol | Sonuç |
| --- | --- |
| Canlı kanıt olarak `POST https://inference.baseten.co/v1/chat/completions` (`zai-org/GLM-5.3-Flash`) | **HTTP 200**, gerçek tamamlama (`finish_reason: "stop"`, `usage` mevcut) — belirleyici kontrol |
| `GET https://inference.baseten.co/v1/models`, hesap başına `modelsStatus` olarak kaydedilir | yeni anahtarlar için `202` + waf challenge; daha eski grup `200`; `401`/`403` kesin → `accounts-rejected.json` |
| hesaplar ile anahtarlar | hesap başına bir anahtar — hiçbir hesap birden fazla anahtar sağlamaz |

```bash
node src/cli.js --verify-only --out keys.txt   # re-check the whole list at any time
```

## 🧭 Nasıl çalışır

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Baseten page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://inference.baseten.co/v1/chat/completions → real content = the key is live
```

| Adım | Çağrı | Notlar |
| --- | --- | --- |
| oturum açma | Chrome oturum açma sayfası → e-posta → gelen kutusundan 6 haneli kod | CDP üzerinden yönetilir, aynı anda bir pencere |
| oturum | hesabın çerezleri | çerezler alınır alınmaz tarayıcı kapatılır |
| anahtar | `POST https://app.baseten.co/graphql/` → `CreateUserApiKey` | `{ textKey, prefix }` tam olarak bir kez döndürülür |
| kontrol | `POST https://inference.baseten.co/v1/chat/completions` | `keys.txt` öncesinde canlı 200 gerekli |

## ⚙️ CLI seçenekleri

**`src/browser-batch.js`** — hesap başına anahtar yolu (Chrome kaydı + Node anahtar oluşturma + canlı doğrulama):

| Bayrak | Varsayılan | Anlamı |
| --- | --- | --- |
| `--target <n>` | `30` | listenin sonunda kaç **doğrulanmış** anahtar olması gerektiği — herhangi bir N, üst sınır yok |
| `--pool-browser <file>` | — | tarayıcı çıkışı için proxy listesi (her satırda bir tane) |
| `--per-run <n>` | `5` | tarayıcı oturumu başına hesap sayısı |
| `--max-failures <n>` | `5` | bu kadar ardışık hatadan sonra dur |
| `--code-timeout <ms>` | `180000` | sihirli kod e-postası için ne kadar bekleneceği |
| `--warp <socks>` | — | bir proxy SOCKS çıkışı sabitle |
| `--broker <url>` | — | gelen kutusu aracı uç noktası |

**`src/cli.js`** — daha eski yalnızca HTTP varyantı:

| Bayrak | Varsayılan | Anlamı |
| --- | --- | --- |
| `--count <n>` | `30` | oluşturulacak hesap sayısı |
| `--out <file>` | `keys.txt` | satır başına bir doğrulanmış anahtar |
| `--accounts <file>` | `accounts.json` | hesap kayıtları (e-posta, anahtar, önek, çıkış, doğrulama) |
| `--rejected <file>` | `accounts-rejected.json` | anahtarı hiç doğrulanmayan hesaplar |
| `--proxy` / `--proxy-file <file>` | — | çıkış veya bir havuz dosyası |
| `--inbox <mode>` · `--broker <url>` | — | gelen kutusu arka ucu |
| `--allow-direct` | kapalı | uyumluluk için kabul edilir — proxy listesi olmayan bir çalıştırma varsayılan olarak doğrudandır |
| `--verify-only` | kapalı | oluşturmak yerine `--out` içindeki anahtarları yeniden doğrula |

Veri dosyaları `browser-batch.js` için sabittir ve depo kökünde bulunur: `keys.txt`, `accounts.json`, `browser-pending.json`, `browser-accounts.jsonl`.

## 🛰️ Proxy arkasında

**İsteğe bağlı — ölçekte önerilir (IP başına limitler, yasaklar).** Araç proxy olmadan da çalışır: `--proxy`/`--proxy-file` olmadan (ve `proxies.txt` satırı olmadan) her çağrı kendi makinenizden çıkar ve çalıştırma bu atlamayı `direct` olarak kaydeder.

```bash
node src/browser-batch.js --target 30 --pool-browser proxies.txt
node src/cli.js --count 30 --out keys.txt --proxy-file proxies.txt
```

Proxy'ler satır başına yüklenir (`http://`, `socks5://`, `socks4://` veya çıplak `host:port`) ve hesap başına döndürülür, ölü bir satırda yeniden denemelerle. Proxy listesi olmayan bir çalıştırma varsayılan olarak doğrudandır (`--allow-direct` hâlâ kabul edilir ancak artık gerekli değildir).

## 📄 Dosyalar

| Yol | İçerik |
| --- | --- |
| `keys.txt` | doğrulanmış anahtarlar, satır başına bir tane — git tarafından yok sayılır, asla işlenmez |
| `accounts.json` | hesap kayıtları (e-posta, anahtar, önek) — git tarafından yok sayılır |
| `accounts-rejected.json` | anahtarı hiç doğrulanmayan hesaplar — yeniden denemeler için kullanışlıdır |
| `launcher.config.json` | başlatıcının hatırladıkları |
| `src/connect-9router.js` | `keys.txt` içindeki anahtarları 9Router bağlantıları olarak kaydeder (sıfır bağımlılık) |

## 🔌 9Router'a bağlan

[9Router](https://9router.com) kendi kendine barındırılan, OpenAI uyumlu bir yönlendiricidir. Baseten OpenAI uyumlu bir uç nokta sunar, bu yüzden bir kez kaydedin ve her anahtar tek bir sağlayıcı düğümü altında bir bağlantı haline gelir:

```bash
node src/connect-9router.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Varsayılanlar: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Modeller daha sonra `baseten/<model id>` olarak sunulur ve her anahtar arasında yük dengelenir. Daha fazla hesap eklemek için bağlayıcıyı yenilenmiş bir `keys.txt` dosyasına yönlendirin; düğüm ve model listesi aynı kalır.

## 🔌 OmniRoute'a bağlan

[OmniRoute](https://omniroute.online) kendi kendine barındırılan, OpenAI uyumlu bir yönlendiricidir. Baseten OpenAI uyumlu bir uç nokta sunar, bu yüzden bir kez kaydedin ve her anahtar tek bir sağlayıcı düğümü altında bir bağlantı haline gelir:

```bash
node src/connect-omniroute.js \
  --base http://localhost:20128 --password 123456 \
  --keys-file keys.txt
```

Varsayılanlar: `--base http://localhost:20128`, `--password 123456`, `--name "Baseten"`, `--prefix baseten`, `--base-url https://inference.baseten.co/v1`, `--model openai/gpt-oss-120b`. Modeller daha sonra `baseten/<model id>` olarak sunulur ve her anahtar arasında yük dengelenir. Daha fazla hesap eklemek için bağlayıcıyı yenilenmiş bir `keys.txt` dosyasına yönlendirin; düğüm ve model listesi aynı kalır.
## 🔑 Bir anahtar size ne kazandırır

| | |
| --- | --- |
| 🏢 Sağlayıcı | **Baseten** — [baseten.co](https://baseten.co) |
| 🎁 Sağlayıcının verdiği | anahtar başına bir hesap (çalışma alanı) — her anahtar Model API'lerinde sohbet ile doğrulanır |
| 🔑 Bir anahtar size ne kazandırır | kendi hesabına kapsamlı bir API anahtarı: aşağıdaki uç noktada 12 model kimliği, planınızın limitlerinde. Kota **hesapta** bulunur, bu aracın anahtar başına bir hesap oluşturmasının nedeni tam olarak budur |
| 🌐 API şekli | OpenAI uyumlu: `POST https://inference.baseten.co/v1/chat/completions` |
| 🔒 Verileriniz | yalnızca baseten.co ve yapılandırdığınız gelen kutusu arka ucuyla iletişim kurulur; anahtarlar makinenizde kalır |

## 🐞 Sorunlar

Baseten oturum açma akışını, GraphQL mutasyonunu veya gelen kutusu davranışını değiştirirse, araç o adımda durur ve bunu bildirir. Çalıştırdığınız komut ve tam çıktıyla birlikte **[bir sorun açın](../../issues)**; PR'lar memnuniyetle karşılanır.

## 📄 Lisans

MIT © 2026 — bkz. [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 baseten-bulk-apikey contributors

</div>

## ⚡ Çalıştırma şekli (ön ayarlar)

`--preset=turbo|balanced|safe` worker sayısını + hesaplar arasındaki duraklamayı ayarlar (turbo = 5,
balanced = 4, safe = 2); açık `--conc`/`--gap` (veya deponun kendi bayrakları) her zaman kazanır
ve `--preset` olmadan araç tarihsel şeklini tam olarak korur.

Turbo önerilir (5 worker); daha fazlası zayıf bilgisayarda yük/ban riski.