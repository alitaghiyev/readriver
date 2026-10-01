<a id="readme-top"></a>

<div align="center">
  <img src="icons/icon128.png" alt="ReadRiver logosu" width="112" height="112">

  <h1>ReadRiver</h1>

  <p>
    <strong>Kelimeleri, cümleleri ve video altyazılarını sayfadan ayrılmadan çevirin.</strong><br>
    Öğrenmek istediklerinizi kaydedin, flashcard ile tekrar edin. Ücretsiz kaynaklar hazır gelir; daha fazlası için kendi LLM'inizi bağlayın.
  </p>

  <p>
    <img src="https://img.shields.io/badge/s%C3%BCr%C3%BCm-0.10.4-1a73e8?style=for-the-badge" alt="Sürüm 0.10.4">
    <img src="https://img.shields.io/badge/Manifest-V3-34a853?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3">
    <img src="https://img.shields.io/badge/Chrome%20%7C%20Brave-destekleniyor-fbbc05?style=for-the-badge&logo=brave&logoColor=white" alt="Chrome ve Brave">
    <img src="https://img.shields.io/badge/derleme%20ad%C4%B1m%C4%B1-yok-555555?style=for-the-badge&logo=javascript&logoColor=white" alt="Derleme adımı yok">
    <a href="LICENSE"><img src="https://img.shields.io/badge/lisans-MIT-8e44ad?style=for-the-badge" alt="MIT Lisansı"></a>
  </p>

  <p>
    <a href="#-hızlı-başlangıç">🚀 Hızlı başlangıç</a>
    ·
    <a href="#-özellikler">✨ Özellikler</a>
    ·
    <a href="#-desteklenen-sağlayıcılar-ve-modeller">🤖 Sağlayıcılar</a>
    ·
    <a href="#-ekran-görüntüleri">🖼️ Ekran görüntüleri</a>
    ·
    <a href="#-gizlilik">🔒 Gizlilik</a>
  </p>

  <p>
    <a href="README.md">English</a> | <strong>Türkçe</strong>
  </p>
</div>

<br>

![Kelimeye çift tıklayınca çeviri kartı açılır](docs/screenshots/card.png)

> Ekran görüntüleri İngilizce arayüzle alındı; arayüz Türkçe olarak da kullanılabilir.

## Neden ReadRiver?

Yabancı dilde okurken bir kelimeye bakmak için sayfadan her ayrılışınızda okuma kopar. ReadRiver cevabı olduğunuz yerde, sayfanın içinde verir ve akılda tutmaya değer kelimeleri hatırlar.

- 🖱️ **Yerinde çeviri**: kelimeye çift tıklayın, cümle seçin, altyazının üzerine gelin ya da sağ tık menüsünü kullanın.
- 🏷️ **Tek tık modu**: okurken kelimelere tıklayın, çevirileri küçük etiketler olarak üzerlerinde kalsın.
- 🎬 **Video altyazıları**: YouTube, Netflix, video.js ve sitenin kendi HTML5 altyazıları.
- 🆓 **Anahtarsız çalışır**: Google Translate, MyMemory ve Tatoeba örnek cümleleri kurar kurmaz hazırdır.
- 🤖 **Kendi LLM'inizi bağlayın**: 18 hazır sağlayıcı ön ayarı (Gemini, Claude, OpenAI, Groq, Ollama, …), otomatik yedeğe düşme.
- 🧠 **Öğrendiğinizi unutmayın**: kelimeleri kaydedin, Leitner flashcard ile tekrar edin.
- 🌍 **46 dil**, Türkçe veya İngilizce arayüz.
- 🔒 **Gizlilik önce gelir**: kendi sunucumuz yok, telemetri yok, anahtarlar tarayıcınızda kalır.
- 🧩 **Düz JavaScript**: derleme adımı ve bağımlılık yok.

> Durum: erken geliştirme (v0.10.4). Henüz Chrome Web Mağazası'nda değil; aşağıdaki gibi paketlenmemiş olarak yüklenir.

## 🚀 Hızlı başlangıç

Derlenecek bir şey yok.

1. Depoyu klonlayın:
   ```bash
   git clone https://github.com/alitaghiyev/readriver.git
   ```
2. `chrome://extensions` (veya `brave://extensions`) sayfasını açıp **Geliştirici modu**'nu etkinleştirin.
3. **Paketlenmemiş öğe yükle**'ye tıklayıp proje klasörünü seçin.
4. Herhangi bir sayfada **bir kelimeye çift tıklayın**.

Bu kadar. Ücretsiz kaynaklar anahtar istemez. LLM eklemek için pencereyi açın (`Alt+R`) → **Ayarlar** → **Kaynaklar** → **+ Sağlayıcı ekle**.

| Kısayol | İşlev |
|---|---|
| `Alt+R` | ReadRiver penceresini aç |
| `Alt+T` | Bu sekmede tek tık modunu aç/kapat |
| `Esc` | Kartı kapat; açık kart yoksa tek tık etiketlerini kaldır |

`Alt+R` ve `Alt+T`, `chrome://extensions/shortcuts` sayfasından değiştirilebilir.

## 🖼️ Ekran görüntüleri

### Tek tık modu

`Alt+T`'ye basın, okurken kelimelere tıklayın. Çeviri kelimenin hemen üzerinde çıkar ve orada kalır; ☆ kelimeyi geçtiği cümleyle birlikte kaydeder.

![Tek tık modu: tıklanan kelimelerin üzerinde çeviri etiketleri](docs/screenshots/one-click.png)

### Video altyazıları

Altyazıdaki bir kelimenin üzerine gelince çevirisi açılır. Kart açıkken video duraklar, fare çekilince devam eder.

![Altyazı kelimelerinin üzerine gelince çeviri kartı açılır ve video duraklar](docs/screenshots/subtitles.gif)

<sub>Video: <a href="https://durian.blender.org">Sintel</a>, © telif hakkı Blender Foundation, <a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a> lisanslı.</sub>

### Araç çubuğu penceresi ve flashcard

<table>
  <tr>
    <td width="50%" valign="top"><img src="docs/screenshots/popup-translate.png" alt="Pencere: kelime çevirisi"></td>
    <td width="50%" valign="top"><img src="docs/screenshots/popup-review.png" alt="Pencere: flashcard tekrarı"></td>
  </tr>
  <tr>
    <td align="center"><strong>Çeviri</strong>: kelime ya da cümle arayın, dinleyin, kaydedin</td>
    <td align="center"><strong>Tekrar</strong>: kaydettiğiniz kelimeler için Leitner flashcard</td>
  </tr>
</table>

### Sağlayıcılar

Otomatik yedeğe düşen sıralı bir zincir. Her sağlayıcının kendi modeli, yedek modelleri, **Test** düğmesi ve **⚡ Hız testi** vardır.

![Ayarlar: sağlayıcı zinciri ve açık bir sağlayıcı kartı](docs/screenshots/settings-sources.png)

### Sağlayıcı galerisi

**+ Sağlayıcı ekle**, size maliyetine göre gruplanmış bir galeri açar: anahtarsız, ücretsiz katman, yerel, ücretli.

<p align="center">
  <img src="docs/screenshots/provider-gallery.png" alt="Sağlayıcı galerisi" width="720">
</p>

### Görünüm

Tema, vurgu rengi, kart yazı boyutu ve genişliği; canlı önizlemeyle.

![Ayarlar: canlı önizlemeli görünüm](docs/screenshots/settings-appearance.png)

## 🤖 Desteklenen sağlayıcılar ve modeller

ReadRiver listenizdeki sağlayıcıları yukarıdan aşağıya dener; biri hata verirse, kapalıysa ya da ayarı eksikse sıradakine geçer. Önce hızlı sağlayıcı yanıt verir; karttaki **🤖 LLM ile detaylandır** düğmesi anlamlar, notlar ve örneklerle daha zengin bir yanıt için LLM'e sorar.

### Çeviri kaynakları (LLM'siz)

Yerleşik **Hızlı (ücretsiz)** sağlayıcıyı bunlar oluşturur.

| Kaynak | Görevi | Anahtar |
|---|---|---|
| **Google Translate** | Ana çeviri, sözcük türleri, dil algılama | Gerekmez (isteğe bağlı Google Cloud anahtarıyla resmi API kullanılır) |
| **DeepL** | Yedek çeviri | İsteğe bağlı (ücretsiz ya da pro anahtar) |
| **Microsoft Azure Translator** | Yedek çeviri | İsteğe bağlı |
| **MyMemory** | Son yedek | Gerekmez |
| **Tatoeba** | Örnek cümleler; çeviriden sonra yüklenir | Gerekmez |
| **Chrome yerleşik çevirmeni** | Her şey başarısız olursa cihaz içi yedek | Gerekmez (Chrome'un sunduğu yerlerde) |

### LLM sağlayıcıları

| Sağlayıcı | Katman | API | Önerilen modeller |
|---|---|---|---|
| **Gemini** | Ücretsiz katman | Gemini | `gemini-flash-lite-latest` (varsayılan), `gemini-flash-latest` |
| **Groq** | Ücretsiz katman | OpenAI uyumlu | `llama-3.3-70b-versatile` (varsayılan), `llama-3.1-8b-instant`, `openai/gpt-oss-120b` |
| **Cerebras** | Ücretsiz katman | OpenAI uyumlu | `llama3.1-8b` (varsayılan), `gpt-oss-120b`, `qwen-3-235b-a22b-instruct-2507` |
| **Mistral** | Ücretsiz katman | OpenAI uyumlu | `mistral-small-latest` (varsayılan), `mistral-medium-latest`, `mistral-large-latest` |
| **OpenRouter** | Ücretsiz modeller | OpenAI uyumlu | `meta-llama/llama-3.3-70b-instruct:free`, `google/gemma-3-27b-it:free`, `deepseek/deepseek-chat-v3-0324:free` |
| **GitHub Models** | Ücretsiz katman | OpenAI uyumlu | `openai/gpt-4.1-mini` (varsayılan), `openai/gpt-4o-mini`, `meta/Llama-3.3-70B-Instruct` |
| **Cloudflare Workers AI** | Ücretsiz katman | OpenAI uyumlu | `@cf/meta/llama-3.1-8b-instruct` (varsayılan), `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| **Hugging Face** | Aylık kredi | OpenAI uyumlu | `meta-llama/Llama-3.3-70B-Instruct` (varsayılan), `Qwen/Qwen2.5-72B-Instruct` |
| **NVIDIA NIM** | Ücretsiz katman | OpenAI uyumlu | **Modelleri getir** + **⚡ Hız testi** ile seçin (listedeki modellerin çoğu yavaş) |
| **SambaNova** | Deneme kredisi | OpenAI uyumlu | `Meta-Llama-3.3-70B-Instruct` (varsayılan), `DeepSeek-V3-0324` |
| **Ollama** | Yerel | OpenAI uyumlu | `qwen2.5:7b`, `llama3.1:8b`, `gemma3:4b` |
| **LM Studio** | Yerel | OpenAI uyumlu | Yüklü olan model |
| **OmniRoute** | Kendi sunucunuz | OpenAI uyumlu | `auto/fast`, `auto` ya da herhangi bir kombo |
| **OpenAI** | Ücretli | OpenAI | `gpt-4.1-mini`, `gpt-4o-mini`, `gpt-4.1-nano` |
| **Claude** | Ücretli | Anthropic | `claude-haiku-4-5-20251001` (varsayılan), `claude-sonnet-5-5` |
| **DeepSeek** | Ücretli, çok ucuz | OpenAI uyumlu | `deepseek-chat` |
| **Together AI** | Ücretli | OpenAI uyumlu | **Modelleri getir** ile seçin |
| **Özel** | Her şey | OpenAI uyumlu | `/v1/chat/completions` sunan herhangi bir uç |

Model adları ayarlar sayfasında gösterilen önerilerdir; sağlayıcının sunduğu her model elle yazılabilir ya da **Modelleri getir** listesinden seçilebilir. Ücretsiz katman sınırlarını sağlayıcılar belirler ve zamanla değişir.

**Sağlayıcı başına araçlar**

- **Model yedek zinciri**: ana model ve sırayla denenen yedek modeller.
- **Modelleri getir**: anahtarınızın gerçekten kullanabildiği modelleri listeler.
- **⚡ Hız testi**: her modele kısa bir istek atıp yanıt süresini ölçer, en hızlılarını seçebilir.
- **Test**: anahtarı ve modeli gerçek bir istekle dener.
- **Kota ve bakiye**: DeepL, OpenRouter ve DeepSeek için gerçek kalan kotayı okur.

## ✨ Özellikler

### Kart modu (her zaman açık)
- Kelimeye **çift tıklayınca** çeviri kartı açılır. İsteğe bağlı gecikme, üç tıklamayla paragraf seçerken kartın yanlışlıkla açılmasını önler.
- **Metin seçince** yanında küçük bir **R** düğmesi çıkar ya da seçim kısa bir beklemeden sonra otomatik çevrilir. Kapatılabilir.
- **Sağ tık menüsü**: seçili metinde "Çevir".
- **Tuş şartı** (isteğe bağlı): yalnızca Alt / Ctrl / Shift basılıyken çevir.
- **Filtreler**: en az/en çok karakter, harf içermeyen seçimleri yok sayma, yazı alanlarını atlama, site bazlı engelleme listesi.
- `user-select: none` kullanan ya da yazıyı düğme içine koyan sitelerde ve iframe'lerde de çalışır.

### Tek tık modu (`Alt+T`)
- Sekme başına `Alt+T` ile ya da penceredeki anahtardan açılır; sayfa yenilenince kapanır.
- Fare altındaki kelime vurgulanır; tıklayınca çevirisi kelimenin hemen üzerinde bir etikette çıkar.
- Etiketler, kelimeye yeniden tıklayana ya da `Esc`'ye basana dek sayfada kalır.
- Çift tıklama yine tam kartı açar; bağlantı, düğme, yazı alanı ve sürükleyerek seçim her zamanki gibi çalışır.
- Etiketin yeri: *satır arasına sığdır*, *satır arasını aç* ya da *üst satırın üzerine yaz*. Renkler, yazı boyutu ve tık gecikmesi ayarlanabilir.

### Çeviri kartı
- Kelime, yön (ör. `EN → TR`), sözcük türüyle birden çok çeviri, LLM notları ve örnek cümleler.
- Kelime ve her çeviri için 🔊 seslendirme; istenirse otomatik okuma.
- ☆ Kelimeyi çevirisi ve bir örnek cümleyle kaydeder.
- Kapalı Shadow DOM içinde çizilir; sayfanın CSS'i kartı bozamaz.

### Video altyazıları
- **YouTube / Netflix / video.js** altyazılarının üzerine gelince çeviri. Kart açıkken video duraklayabilir, fare çekilince devam eder.
- Sitenin kendi HTML5 `<video><track>` altyazısı bir katmanda yeniden çizilir, böylece her kelimenin üzerine gelinebilir. Yazı boyutu ve arka plan koyuluğu ayarlanabilir.

### Araç çubuğu penceresi (`Alt+R`)
- **Çeviri**, **Geçmiş** (önbellekteki son çeviriler), **Kaydedilenler** ve **Tekrar** (Leitner flashcard: kartlar kutular arasında ilerler, zamanı gelince yeniden sorulur).
- **Sekme sağlığı**: sayfa açıkken eklenti yenilendiyse ikonda kırmızı `!` çıkar; pencere, sayfayı yenilemeden betikleri yeniden yükleyen **Sıfırla** düğmesini gösterir.

### Ayarlar ve bakım
- Boyutu ayarlanabilen **kalıcı önbellek**.
- **Kullanım sayacı**: kaynak başına istek, hata, karakter ve token; günlük, son 90 gün.
- **Yedekleme**: ayarları, sağlayıcıları ve kaydedilen kelimeleri JSON olarak dışa/içe aktarma. API anahtarları siz seçmedikçe dahil edilmez.
- **Tanı**: arka plan, her kaynağa erişim, içerik betiğinin geçerli sayfada çalışıp çalışmadığı, son çeviri.

## 🌍 Diller

Kaynak ve hedef dil seçilebilir, ⇄ ile yer değiştirilir; çeviri yönü metinden tahmin edilir.

İngilizce, Türkçe, Azerbaycan Türkçesi, Almanca, Fransızca, İspanyolca, İtalyanca, Portekizce, Felemenkçe, Rusça, Ukraynaca, Lehçe, Çekçe, İsveççe, Norveççe, Danca, Fince, Yunanca, Macarca, Romence, Bulgarca, Sırpça, Hırvatça, Boşnakça, Arnavutça, Gürcüce, Ermenice, Kazakça, Özbekçe, Kürtçe (Kurmancî), Arapça, Farsça, Urduca, İbranice, Hintçe, Bengalce, Çince (Basitleştirilmiş), Çince (Geleneksel), Japonca, Korece, Vietnamca, Tayca, Endonezce, Malayca, Latince ve Esperanto.

Arayüz dili: **Türkçe** veya **English** (ya da tarayıcı diliyle aynı).

## 🔒 Gizlilik

- Çevrilen metin **yalnızca** açık bıraktığınız kaynaklara gider: Google Translate ucu, Tatoeba, MyMemory, DeepL / Azure ya da seçtiğiniz LLM.
- Telemetri yok, kendi sunucumuz yok.
- API anahtarları yalnızca `chrome.storage.local`'da tutulur. Web sayfaları ve içerik betiği anahtarları görmez.
- Yerel bir sağlayıcıyla (Ollama, LM Studio) LLM'e sorduğunuz metin bilgisayarınızdan çıkmaz.

## 🛠️ Geliştirme

Kodu değiştirince eklentideki yenile (⟳) simgesine basın **ve açık sekmeleri yenileyin**; içerik betiği sayfa yüklenirken enjekte edilir. Ayarlar sayfası yüklü sürümü gösterir.

Yerel geliştirmede varsayılan anahtarları `local-config.js` içine yazabilirsiniz. Bu dosya **git tarafından yok sayılır; asla commit etmeyin**.

```
manifest.json
background.js        Servis işçisi: mesajlar (translate, examples, save, …), sağ tık menüsü, kısayollar, sekme sağlığı
settings.js          Sağlayıcı listesi + tercihler, göçler
prompt.js            LLM prompt'u + JSON ayrıştırma
cache.js             Kalıcı çeviri önbelleği
usage.js, quota.js   Kullanım sayacı, kota sorgusu
providers/           free (Google/DeepL/Azure/MyMemory/Tatoeba), gemini, anthropic, openai-compat
shared/              prefs.js (tercihler), langs.js (diller), i18n*.js (arayüz metinleri), render.js (kart), result.css (temalar)
content/content.js   Sayfa içi davranış: seçim, çift tıklama, tek tık modu, altyazı, kart
popup/               Araç çubuğu penceresi: arama, geçmiş, kaydedilenler, flashcard
options/             Ayarlar sayfası
docs/screenshots/    Bu README'deki görseller
```

## ⚠️ Bilinen sınırlamalar

- Ücretsiz katman resmi olmayan Google `gtx` ucunu kullanır; istek sınırına takılabilir.
- `chrome://` sayfalarında ve Chrome Web Mağazası'nda çalışmaz.
- Çok küçük iframe'lerde kart kırpılabilir.
- Tatoeba örnek cümleleri her dil çifti için bulunmayabilir.

## 🗺️ Yol haritası

- [ ] Chrome Web Mağazası / Firefox yayını
- [ ] Otomatik testler
- [ ] Kaydedilen kelimeleri Anki'ye aktarma

## 🤝 Katkı

Issue ve pull request'ler memnuniyetle karşılanır. Kod düz JavaScript'tir, derleme adımı yoktur. Arayüzün yeni dillere çevirileri de memnuniyetle karşılanır.

## 📄 Lisans

[MIT Lisansı](LICENSE) ile yayınlanmıştır.

<p align="right"><a href="#readme-top">↑ Başa dön</a></p>
