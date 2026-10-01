import { getSettings, saveSettings, makeProvider, PRESETS } from "../settings.js";
import { withSourceDefaults } from "../providers/free.js";

await RC_I18N.ready; // read the stored language first; then the page texts are translated
const shownLang = RC_I18N.lang;
const t = (s, v) => RC_I18N.t(s, v);
document.title = t("ReadRiver Ayarlar");
document.documentElement.lang = shownLang;
RC_I18N.translateDom(document.body);
RC_I18N.translateDom(document.head.querySelector("title"));
RC_I18N.observe(document.body);
const $ = (id) => document.getElementById(id);
const TYPE_LABEL = { free: "Hızlı (ücretsiz)", openai: "OpenAI uyumlu", gemini: "Gemini", anthropic: "Claude" };
// Hosts allowed in the manifest; for any other address (e.g. a server IP) permission is requested at runtime.
const BUILTIN_HOSTS = chrome.runtime.getManifest().host_permissions.map((m) => m.split("/")[2]);

// Add-provider gallery and card hints. The data (baseUrl, default model) is in settings.js PRESETS.
// Free tier details as of 2026; providers may change their limits.
const GROUPS = [
  ["nokey", "Anahtarsız", "Hemen çalışır, kayıt gerekmez."],
  ["freetier", "Ücretsiz katmanlı LLM", "Ücretsiz hesap açıp anahtar alırsın; kredi kartı istemez, günlük/dakikalık sınır vardır."],
  ["local", "Yerel / kendi sunucun", "Model kendi bilgisayarında ya da sunucunda çalışır."],
  ["paid", "Ücretli", "Kullandıkça öde; bazıları başlangıç kredisi verir."]
];
const CATALOG = {
  free: { group: "nokey", badge: "Ücretsiz", blurb: "Google çevirisi, Tatoeba örnek cümleleri, MyMemory yedeği; istersen DeepL / Microsoft anahtarı eklenir. ~0,3 sn, açıklama yapmaz." },
  gemini: {
    group: "freetier", badge: "Ücretsiz katman", keyUrl: "https://aistudio.google.com/apikey",
    blurb: "Google AI Studio anahtarı. Flash-Lite modeli günde yüzlerce istek ücretsiz; yoğunlukta 503 verebilir.",
    models: ["gemini-flash-lite-latest", "gemini-flash-latest"]
  },
  groq: {
    group: "freetier", badge: "Ücretsiz katman", keyUrl: "https://console.groq.com/keys",
    blurb: "Çok hızlı (~0,5 sn). Ücretsiz: ~30 istek/dk, ~1.000 istek/gün.",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"]
  },
  cerebras: {
    group: "freetier", badge: "Ücretsiz katman", keyUrl: "https://cloud.cerebras.ai",
    blurb: "En hızlılardan. Ücretsiz: günde ~1 milyon token.",
    models: ["llama3.1-8b", "gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507"]
  },
  mistral: {
    group: "freetier", badge: "Ücretsiz katman", keyUrl: "https://console.mistral.ai/api-keys",
    blurb: "“Experiment” planı ücretsiz (telefon doğrulaması ister), cömert aylık limit. Türkçesi iyi.",
    models: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"]
  },
  openrouter: {
    group: "freetier", badge: "Ücretsiz modeller", keyUrl: "https://openrouter.ai/keys",
    blurb: "Tek anahtarla yüzlerce model. Adı “:free” ile bitenler ücretsiz (~20 istek/dk, ~50 istek/gün).",
    models: ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free", "deepseek/deepseek-chat-v3-0324:free"]
  },
  github: {
    group: "freetier", badge: "Ücretsiz katman", keyUrl: "https://github.com/settings/personal-access-tokens/new",
    blurb: "GitHub hesabıyla ücretsiz; anahtar olarak “Models: read” izinli bir token oluştur. Günde ~50–150 istek.",
    models: ["openai/gpt-4.1-mini", "openai/gpt-4o-mini", "meta/Llama-3.3-70B-Instruct"]
  },
  cloudflare: {
    group: "freetier", badge: "Ücretsiz katman", keyUrl: "https://dash.cloudflare.com/profile/api-tokens",
    blurb: "Günde 10.000 “neuron” ücretsiz. Base URL'deki HESAP_ID'yi Cloudflare hesap kimliğinle değiştir; token “Workers AI” izinli olmalı.",
    models: ["@cf/meta/llama-3.1-8b-instruct", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"]
  },
  huggingface: {
    group: "freetier", badge: "Aylık kredi", keyUrl: "https://huggingface.co/settings/tokens",
    blurb: "Aylık küçük ücretsiz kredi; token'da “Inference Providers” izni açık olmalı.",
    models: ["meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen2.5-72B-Instruct"]
  },
  nvidia: {
    group: "freetier", badge: "Ücretsiz katman", keyUrl: "https://build.nvidia.com",
    blurb: "E-postayla ücretsiz anahtar. Model listesi uzun ama çoğu yavaş ya da zaman aşımına düşüyor: “Modelleri getir” → aramayla süz → “⚡ Hız testi” → “En hızlıları kullan”. Zincirin sonunda tut."
  },
  sambanova: {
    group: "freetier", badge: "Deneme kredisi", keyUrl: "https://cloud.sambanova.ai/apis",
    blurb: "Başlangıç kredisiyle gelir; büyük modelleri hızlı çalıştırır.",
    models: ["Meta-Llama-3.3-70B-Instruct", "DeepSeek-V3-0324"]
  },
  ollama: {
    group: "local", badge: "Yerel", keyUrl: "https://ollama.com/download", keyLabel: "Ollama'yı indir",
    blurb: "Bilgisayarında çalışır, metin dışarı çıkmaz. 403 alırsan Ollama'yı OLLAMA_ORIGINS=chrome-extension://* ile başlat.",
    models: ["qwen2.5:7b", "llama3.1:8b", "gemma3:4b"]
  },
  lmstudio: {
    group: "local", badge: "Yerel", keyUrl: "https://lmstudio.ai", keyLabel: "LM Studio'yu indir",
    blurb: "LM Studio > Developer > “Start server”. Metin bilgisayarından çıkmaz."
  },
  omniroute: {
    group: "local", badge: "Sunucu",
    blurb: "Kendi sunucundaki OmniRoute. SSH tüneliyle http://localhost:20128/v1 ya da http://SUNUCU_IP:20128/v1. “Modelleri getir” kombolarını da listeler; kombo seçersen model geçişini OmniRoute yapar. “auto/fast” en hızlı bağlı sağlayıcıyı kendisi seçer.",
    models: ["auto/fast", "auto"]
  },
  custom: { group: "local", badge: "Özel", blurb: "OpenAI uyumlu herhangi bir uç (/v1/chat/completions)." },
  openai: {
    group: "paid", badge: "Ücretli", keyUrl: "https://platform.openai.com/api-keys",
    blurb: "ChatGPT aboneliği API'yi kapsamaz; API kredisi ayrıca alınır.",
    models: ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4.1-nano"]
  },
  claude: {
    group: "paid", badge: "Ücretli", keyUrl: "https://console.anthropic.com/settings/keys",
    blurb: "Claude aboneliği API'yi kapsamaz; Console'dan kredi yüklenir.",
    models: ["claude-haiku-4-5-20251001", "claude-sonnet-5-5"]
  },
  deepseek: {
    group: "paid", badge: "Çok ucuz", keyUrl: "https://platform.deepseek.com/api_keys",
    blurb: "Kullandıkça öde, fiyatı çok düşük; Türkçesi iyi.",
    models: ["deepseek-chat"]
  },
  together: {
    group: "paid", badge: "Ücretli", keyUrl: "https://api.together.xyz/settings/api-keys",
    blurb: "Açık kaynak modeller; kayıtta küçük başlangıç kredisi verebilir."
  }
};
const needsKey = (c) => c.group === "freetier" || c.group === "paid";

// Old records have no "preset": guess it from the type and the Base URL's host.
function presetOf(p) {
  if (p.preset && PRESETS[p.preset]) return p.preset;
  if (p.type === "free") return "free";
  if (p.type === "gemini") return "gemini";
  if (p.type === "anthropic") return "claude";
  let host = "";
  try { host = new URL(p.baseUrl).host; } catch {}
  const hit = Object.entries(PRESETS).find(([k, v]) => k !== "custom" && v.baseUrl && host && new URL(v.baseUrl).host === host);
  return hit ? hit[0] : "custom";
}

let providers = [];
const openIds = new Set(); // open (expanded) cards; preserved across re-renders
const modelCache = new Map(); // provider id → "Fetch models" result (so the list isn't lost on re-render)
const benchCache = new Map(); // provider id → { model: { ok, ms, error } } ("Speed test" result)
// Descriptions of OmniRoute's built-in automatic combos (auto, auto/fast, …).
const AUTO_HINT = {
  "": "Otomatik: bağlı tüm sağlayıcılar arasında dengeli seçim",
  fast: "Otomatik: en düşük gecikmeli sağlayıcıyı seçer (çeviri için önerilir)",
  cheap: "Otomatik: en ucuz sağlayıcı",
  coding: "Otomatik: kaliteye öncelik (kod için)",
  smart: "Otomatik: kaliteye öncelik + yeni modelleri keşfeder",
  offline: "Otomatik: kotası en dolu sağlayıcı",
  lkgp: "Otomatik: en son çalışan sağlayıcıyı tercih eder"
};

function el(tag, props = {}, ...children) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
}

function say(node, text, kind) {
  node.textContent = text;
  node.className = "status" + (kind ? " " + kind : "");
}

const link = (href, text) => el("a", { href, target: "_blank", rel: "noopener", textContent: text });

// Must be called from a user click.
async function ensureOrigin(p) {
  if (p.type !== "openai" || !p.baseUrl) return;
  let u;
  try { u = new URL(p.baseUrl); } catch { throw new Error(t("{name}: Base URL geçersiz (http://... ile başlamalı)", { name: p.name })); }
  if (BUILTIN_HOSTS.includes(u.hostname)) return;
  const origin = `${u.protocol}//${u.hostname}/*`;
  if (await chrome.permissions.contains({ origins: [origin] })) return;
  if (!(await chrome.permissions.request({ origins: [origin] }))) {
    throw new Error(t("{host} için erişim izni verilmedi", { host: u.hostname }));
  }
}

const ask = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

function field(label, input) {
  return el("label", {}, label, input);
}

// Password box + show/hide button.
function secretInput(value, onInput) {
  const inp = el("input", { type: "password", autocomplete: "off", spellcheck: false, value: value || "" });
  inp.addEventListener("input", () => onInput(inp.value.trim()));
  const eye = el("button", { type: "button", className: "sec icon eye", textContent: "Göster", title: "Anahtarı göster / gizle" });
  eye.addEventListener("click", () => {
    const show = inp.type === "password";
    inp.type = show ? "text" : "password";
    eye.textContent = show ? "Gizle" : "Göster";
  });
  return { inp, box: el("div", { className: "secret" }, inp, eye) };
}

// Sources of the "Fast (free)" provider: which site, how it's reached, limits, optional key.
const FREE_SOURCES = [
  {
    key: "google",
    name: "Google Translate",
    site: "https://translate.google.com",
    gives: "Çeviri ve sözcük türleri (isim / fiil / sıfat…). Girdinin dilini otomatik algılar.",
    how: "GET https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=<hedef>&dt=t&dt=bd&q=<metin>",
    note: "Anahtarsız uç, Google'ın resmi API'si değil: ücretsiz ve çok hızlı, ama Google ileride sınırlayabilir ya da kapatabilir. Kararlı olsun istersen kendi Google Cloud Translation API anahtarını gir; o zaman resmi uç kullanılır (ayda ilk 500.000 karakter ücretsiz, sonrası ücretli; sözcük türü vermez).",
    inputs: [{ label: "Google Cloud Translation API anahtarı (isteğe bağlı)", prop: "apiKey", secret: true, link: "https://console.cloud.google.com/apis/library/translate.googleapis.com" }]
  },
  {
    key: "deepl",
    name: "DeepL (yedek)",
    needsKey: true,
    site: "https://www.deepl.com/pro-api",
    gives: "Google çalışmazsa yüksek kaliteli yedek çeviri. Sözcük türü vermez.",
    how: "POST https://api-free.deepl.com/v2/translate (anahtar “:fx” ile bitiyorsa Free, değilse Pro ucu)",
    note: "Anahtar girmezsen kullanılmaz. DeepL API Free: ayda 500.000 karakter ücretsiz; kayıtta kart doğrulaması isteyebilir, ücret alınmaz.",
    inputs: [{ label: "DeepL API anahtarı", prop: "apiKey", secret: true, link: "https://www.deepl.com/your-account/keys" }]
  },
  {
    key: "microsoft",
    name: "Microsoft Translator (yedek)",
    needsKey: true,
    site: "https://azure.microsoft.com/products/ai-services/ai-translator",
    gives: "Google ve DeepL çalışmazsa yedek çeviri. Dili otomatik algılar.",
    how: "POST https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=<hedef>",
    note: "Anahtar girmezsen kullanılmaz. Azure'da “Translator” kaynağı oluştur, “F0 (Free)” fiyat katmanını seç: ayda 2 milyon karakter ücretsiz. Azure kaydı kart doğrulaması ister, F0'da ücret alınmaz. Anahtar ve bölge (ör. westeurope) kaynağın “Keys and Endpoint” sayfasında.",
    inputs: [
      { label: "Azure Translator anahtarı", prop: "apiKey", secret: true, link: "https://portal.azure.com/#create/Microsoft.CognitiveServicesTextTranslation" },
      { label: "Bölge (global kaynaksa boş bırak)", prop: "region", type: "text", placeholder: "westeurope" }
    ]
  },
  {
    key: "mymemory",
    name: "MyMemory (son yedek)",
    site: "https://mymemory.translated.net",
    gives: "Diğerleri çalışmazsa yedek çeviri ve alternatif çeviriler (çeviri belleği).",
    how: "GET https://api.mymemory.translated.net/get?q=<metin>&langpair=en|tr",
    note: "Anahtar gerekmez; anonim kullanımda günde yaklaşık 5.000 karakter. E-posta girersen limit yükselir (yaklaşık 50.000). Kalitesi Google'dan düşük olabilir; dil algılamaz.",
    inputs: [{ label: "E-posta (isteğe bağlı, günlük limiti artırır)", prop: "email", type: "email" }]
  },
  {
    key: "tatoeba",
    name: "Tatoeba (örnek cümleler)",
    site: "https://tatoeba.org",
    gives: "Örnek cümleler: gerçek insan çevirisi cümle çiftleri (aranan kelime vurgulanır).",
    how: "GET https://tatoeba.org/en/api_v0/search?from=eng&to=tur&query=<kelime>",
    note: "Anahtar gerekmez. Topluluk çevirisidir, cümleler CC BY 2.0 FR lisanslıdır. Nadir kelimelerde örnek bulunamayabilir; bazen 1–3 sn sürdüğü için çeviriden sonra yüklenir. Yalnızca kelime ve kısa ifadelerde kullanılır."
  }
];
const sourceActive = (s, cfg) => cfg.enabled !== false && (!s.needsKey || !!cfg.apiKey);

function freeSourcesUI(p, refresh) {
  p.sources = withSourceDefaults(p.sources);
  const nodes = [
    el("p", {
      className: "hint",
      textContent: "Kartta “LLM ile detaylandır” düğmesi çıkar. Çeviri kaynakları yukarıdan aşağı yedek olarak denenir; çevirdiğin metin yalnızca açık kaynaklara gider. Ayrıntı için bir kaynağa tıkla."
    })
  ];
  for (const s of FREE_SOURCES) {
    const cfg = p.sources[s.key];
    const on = el("input", { type: "checkbox", checked: cfg.enabled !== false, title: "Açık / kapalı" });
    const state = el("span", { className: "pill" });
    const upd = () => {
      const active = sourceActive(s, cfg);
      state.textContent = active ? "açık" : cfg.enabled === false ? "kapalı" : "anahtar yok";
      state.className = "pill" + (active ? " on" : "");
      refresh();
    };
    on.addEventListener("change", () => { cfg.enabled = on.checked; upd(); });
    const body = [
      el("p", { className: "hint" }, el("b", { textContent: "Ne sağlıyor: " }), s.gives),
      el("p", { className: "hint" }, el("b", { textContent: "Nasıl bağlandık: " }), el("code", { textContent: s.how })),
      el("p", { className: "hint" }, el("b", { textContent: "Not: " }), s.note),
      el("p", { className: "hint" }, link(s.site, s.site.replace("https://", "") + " ↗"))
    ];
    for (const f of s.inputs || []) {
      const set = (v) => { cfg[f.prop] = v; upd(); };
      let inputNode;
      if (f.secret) inputNode = secretInput(cfg[f.prop], set).box;
      else {
        inputNode = el("input", { type: f.type, autocomplete: "off", value: cfg[f.prop] || "", placeholder: f.placeholder || "" });
        inputNode.addEventListener("input", () => set(inputNode.value.trim()));
      }
      const lab = field(f.label, inputNode);
      if (f.link) lab.append(link(f.link, "Anahtar al ↗"));
      body.push(lab);
    }
    const det = el("details", { className: "src" },
      el("summary", {}, on, el("strong", { textContent: s.name }), state), ...body);
    nodes.push(det);
    upd();
  }
  nodes.push(el("details", { className: "src" },
    el("summary", {}, el("strong", { textContent: "Sesli okuma ve Chrome yerleşik çeviri" })),
    el("p", { className: "hint" }, "Telaffuz için tarayıcının yerleşik konuşma motoru (Web Speech API) kullanılır; hiçbir siteye veri gitmez."),
    el("p", { className: "hint" }, "Tüm sağlayıcılar başarısız olursa Chrome'un yerel Translator / LanguageDetector API'leri denenir; metin cihazdan çıkmaz. Brave gibi bazı tarayıcılarda bulunmayabilir.")));
  return nodes;
}

// Short status in the card header: a warning if a setting is missing, otherwise the model name.
function summaryText(p) {
  if (p.type === "free") {
    const src = withSourceDefaults(p.sources);
    const on = FREE_SOURCES.filter((s) => sourceActive(s, src[s.key])).map((s) => s.name.replace(/ \(.*/, ""));
    return on.length ? { text: on.join(" · ") } : { text: t("Tüm kaynaklar kapalı"), warn: true };
  }
  const c = CATALOG[presetOf(p)] || {};
  const miss = [];
  if (p.type === "openai" && !p.baseUrl) miss.push("Base URL");
  if (/HESAP_ID/.test(p.baseUrl || "")) miss.push(t("hesap kimliği (Base URL)"));
  if (!p.key && (p.type !== "openai" || needsKey(c))) miss.push(t("API anahtarı"));
  if (!p.model && p.type !== "gemini") miss.push(t("model"));
  const fb = p.type === "openai" ? (p.fallbacks || []).filter((m) => m && m !== p.model).length : 0;
  return miss.length ? { text: t("Eksik: {x}", { x: miss.join(", ") }), warn: true } : { text: (p.model || t("hazır")) + (fb ? " " + t("+ {n} yedek", { n: fb }) : "") };
}

function card(p, i) {
  const presetKey = presetOf(p);
  const c = CATALOG[presetKey] || CATALOG.custom;
  const status = el("span", { className: "status" });

  // Searchable model picker that opens after "Fetch models".
  let model; // model box (on LLM cards)
  let fbInput; // backup models box (on OpenAI-compatible cards)
  const setFallbacks = (list) => {
    p.fallbacks = list;
    if (fbInput) fbInput.value = list.join(", ");
  };
  const list = el("button", { type: "button", className: "sec", textContent: "Modelleri getir", title: "Sağlayıcıdaki modelleri listele" });
  const filter = el("input", { type: "search", placeholder: "Modellerde ara…", spellcheck: false });
  const count = el("span", { className: "hint" });
  const items = el("div", { className: "picker-list", role: "listbox" });
  const closeP = el("button", { type: "button", className: "linkbtn", textContent: "Listeyi kapat" });
  const picker = el("div", { className: "picker", hidden: true },
    el("div", { className: "picker-head" }, filter, count, closeP), items);
  closeP.addEventListener("click", () => { modelCache.delete(p.id); drawPicker(); });
  filter.addEventListener("input", () => drawPicker());
  const choose = (m) => {
    model.value = m;
    p.model = m;
    setFallbacks((p.fallbacks || []).filter((f) => f !== m));
    refresh();
    drawPicker();
    markDirty();
    say(status, t("Seçildi: {m}. Çalıştığını görmek için “Test et”e bas.", { m }), "ok");
  };
  const toggleFallback = (m) => {
    const fb = p.fallbacks || [];
    setFallbacks(fb.includes(m) ? fb.filter((f) => f !== m) : [...fb, m]);
    refresh();
    drawPicker();
    markDirty();
  };
  // List matching the filter (combos first). Sorted fastest to slowest if a speed test was run.
  function shownModels() {
    const all = modelCache.get(p.id)?.models || [];
    const q = filter.value.trim().toLowerCase();
    const hit = (m) => !q || m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q);
    const bench = benchCache.get(p.id) || {};
    const rank = (m) => (bench[m.id] ? (bench[m.id].ok ? bench[m.id].ms : 1e9) : 1e10);
    const sort = (list) => (Object.keys(bench).length ? [...list].sort((a, b) => rank(a) - rank(b)) : list);
    return { all, combos: sort(all.filter((m) => m.combo && hit(m))), plain: sort(all.filter((m) => !m.combo && hit(m))) };
  }
  function pickRow(m, info) {
    const bench = benchCache.get(p.id)?.[m.id];
    const isMain = m.id === p.model;
    const isFb = (p.fallbacks || []).includes(m.id);
    const main = el("span", { className: "pick-main" }, el("span", { textContent: (isMain ? "✓ " : "") + (m.label ? `${m.label} (${m.id})` : m.id) }));
    const sub = info?.models?.length
      ? `${info.strategy ? info.strategy + ": " : ""}${info.models.join(" → ")}`
      : m.desc || (/^auto(\/|$)/.test(m.id) ? AUTO_HINT[m.id.split("/")[1] || ""] || "OmniRoute otomatik yönlendirme" : "");
    if (sub) main.append(el("span", { className: "pick-sub", textContent: sub, title: sub }));
    const tags = el("span", { className: "pick-tags" });
    if (m.combo) tags.append(el("span", { className: "badge combo", textContent: "kombo" }));
    if (/:free$/.test(m.id)) tags.append(el("span", { className: "badge freetier", textContent: "ücretsiz" }));
    if (bench) {
      tags.append(bench.ok
        ? el("span", { className: "badge " + (bench.ms < 3000 ? "fast" : "slow"), textContent: t("{s} sn", { s: (bench.ms / 1000).toFixed(1) }) })
        : el("span", { className: "badge fail", textContent: "✗", title: t(bench.error) }));
    }
    const b = el("button", { type: "button", className: "pick" + (isMain ? " sel" : ""), role: "option", title: "Ana model yap" }, main, tags);
    b.addEventListener("click", () => choose(m.id));
    const row = el("div", { className: "pick-row" }, b);
    if (!isMain) {
      const fb = el("button", { type: "button", className: "sec pick-fb", textContent: isFb ? "✓ yedek" : "+ yedek", title: isFb ? "Yedeklerden çıkar" : "Ana model hata verirse sırayla denensin" });
      fb.addEventListener("click", () => toggleFallback(m.id));
      row.append(fb);
    }
    return row;
  }
  function drawPicker() {
    const data = modelCache.get(p.id);
    picker.hidden = !data;
    if (!data) return;
    const { all, combos, plain } = shownModels();
    count.textContent = `${combos.length + plain.length} / ${all.length}`;
    const rows = [];
    if (combos.length) {
      rows.push(el("div", { className: "picker-group", textContent: t("Kombolar ({n})", { n: combos.length }) }));
      if (data.note) rows.push(el("div", { className: "hint", textContent: data.note }));
      rows.push(...combos.map((m) => pickRow(m, data.combos?.[m.id])));
      if (plain.length) rows.push(el("div", { className: "picker-group", textContent: t("Modeller ({n})", { n: plain.length }) }));
    }
    rows.push(...plain.map((m) => pickRow(m)));
    items.replaceChildren(...rows);
    if (!rows.length) items.append(el("div", { className: "hint", textContent: "Eşleşen model yok. Adı biliyorsan yukarıdaki kutuya elle yazabilirsin." }));
  }

  const nameEl = el("strong", { className: "name", textContent: p.name || TYPE_LABEL[p.type] });
  const sub = el("span", { className: "sub" });
  const refresh = () => {
    const s = summaryText(p);
    sub.textContent = (s.warn ? "⚠ " : "") + s.text;
    sub.classList.toggle("warn", !!s.warn);
    nameEl.textContent = p.name || TYPE_LABEL[p.type];
  };
  const bind = (input, key) => {
    input.addEventListener("input", () => { p[key] = input.value.trim(); refresh(); });
    return input;
  };

  const enabled = el("input", { type: "checkbox", checked: p.enabled !== false, title: "Açık / kapalı" });
  enabled.addEventListener("change", () => {
    p.enabled = enabled.checked;
    box.classList.toggle("off", !p.enabled);
  });

  const up = el("button", { type: "button", className: "sec icon", textContent: "↑", title: "Yukarı taşı (önce denenir)", disabled: i === 0 });
  const down = el("button", { type: "button", className: "sec icon", textContent: "↓", title: "Aşağı taşı", disabled: i === providers.length - 1 });
  const del = el("button", { type: "button", className: "sec icon danger", textContent: "✕", title: "Sağlayıcıyı sil" });
  up.addEventListener("click", () => { [providers[i - 1], providers[i]] = [providers[i], providers[i - 1]]; markDirty(); render(); });
  down.addEventListener("click", () => { [providers[i + 1], providers[i]] = [providers[i], providers[i + 1]]; markDirty(); render(); });
  del.addEventListener("click", () => {
    if (!confirm(t("“{name}” silinsin mi? (Kaydet'e basana kadar uygulanmaz.)", { name: p.name || t(TYPE_LABEL[p.type]) }))) return;
    providers.splice(i, 1);
    openIds.delete(p.id);
    markDirty();
    render();
  });

  const summary = el("summary", {},
    el("span", { className: "order", textContent: String(i + 1), title: "Deneme sırası" }),
    enabled,
    el("div", { className: "sum-text" }, el("div", {}, nameEl, el("span", { className: "badge " + c.group, textContent: c.badge })), sub),
    el("div", { className: "sum-actions" }, up, down, del));

  const body = [];
  const intro = el("p", { className: "hint" }, c.blurb || "");
  if (c.keyUrl) intro.append(" ", link(c.keyUrl, (c.keyLabel || "Anahtar al") + " ↗"));
  body.push(intro);
  body.push(field("Görünen ad", bind(el("input", { value: p.name || "", placeholder: TYPE_LABEL[p.type] }), "name")));

  if (p.type === "free") {
    body.push(...freeSourcesUI(p, refresh));
  } else {
    if (presetKey === "custom") {
      const type = el("select", {},
        ...Object.entries(TYPE_LABEL).filter(([v]) => v !== "free").map(([v, t]) => el("option", { value: v, textContent: t, selected: v === p.type })));
      type.addEventListener("change", () => { p.type = type.value; render(); });
      body.push(field("API türü", type));
    }
    if (p.type === "openai") {
      body.push(field("Base URL", bind(el("input", { value: p.baseUrl || "", placeholder: "https://…/v1", spellcheck: false }), "baseUrl")));
    }
    const key = secretInput(p.key, (v) => { p.key = v; refresh(); });
    body.push(field(t("API anahtarı") + (p.type === "openai" && !needsKey(c) ? " " + t("(gerekmiyorsa boş bırak)") : ""), key.box));

    // The model in this box is tried first; if it fails, the "Backup models" are tried in order.
    model = el("input", { value: p.model || "", placeholder: "Listeden seç ya da model adını yaz", spellcheck: false });
    model.addEventListener("input", () => { p.model = model.value.trim(); refresh(); drawPicker(); });
    const modelField = field("Model", el("div", { className: "secret" }, model, list));
    if (c.models?.length) {
      const chips = el("div", { className: "chips" }, el("span", { className: "hint", textContent: "Öneriler:" }));
      for (const m of c.models) {
        const b = el("button", { type: "button", className: "chip", textContent: m });
        b.addEventListener("click", () => choose(m));
        chips.append(b);
      }
      modelField.append(chips);
    }
    body.push(modelField, picker);
    if (p.type === "openai") {
      fbInput = el("input", { value: (p.fallbacks || []).join(", "), placeholder: "boş: yedek yok · listede “+ yedek” ile ekle", spellcheck: false });
      fbInput.addEventListener("input", () => {
        p.fallbacks = fbInput.value.split(",").map((s) => s.trim()).filter(Boolean);
        refresh();
        drawPicker();
      });
      body.push(field("Yedek modeller (ana model hata verirse sırayla denenir; virgülle ayır)", fbInput));
    }
  }
  const test = el("button", { type: "button", className: "sec", textContent: "Test et" });
  // Speed test: if the list is open, the models matching the filter (at most 20); otherwise the main model + backups.
  const bench = el("button", { type: "button", className: "sec", textContent: "⚡ Hız testi", title: "Modellere kısa bir istek atıp yanıt süresini ölçer" });
  const useFastest = el("button", { type: "button", className: "sec", textContent: "En hızlıları kullan", hidden: true, title: "En hızlı modeli ana model, sonraki ikisini yedek yapar" });
  const run = (btn, fn) => btn.addEventListener("click", async () => {
    btn.disabled = true;
    say(status, "…");
    try { await fn(); } catch (e) { say(status, e.message, "err"); } finally { btn.disabled = false; }
  });

  run(list, async () => {
    await ensureOrigin(p);
    const r = await ask({ type: "models", cfg: p });
    if (!r?.ok) throw new Error(r?.error || "Yanıt yok");
    modelCache.set(p.id, { models: r.models, combos: r.combos || {}, note: r.note || "" });
    filter.value = "";
    drawPicker();
    const nc = r.models.filter((m) => m.combo).length;
    say(status, t("{n} model{c} bulundu. Tıklayınca ana model olur; “+ yedek” ile yedeklere eklenir.", { n: r.models.length - nc, c: nc ? " " + t("+ {n} kombo", { n: nc }) : "" }), "ok");
  });
  run(test, async () => {
    await ensureOrigin(p);
    const r = await ask({ type: "test", cfg: p });
    if (!r?.ok) throw new Error(r?.error || "Yanıt yok");
    say(status, t("Çalışıyor ({ms} ms): hello → {sample}", { ms: r.ms, sample: r.sample }), "ok");
  });
  run(bench, async () => {
    const open = modelCache.has(p.id);
    const targets = open
      ? (({ combos, plain }) => [...combos, ...plain].map((m) => m.id))(shownModels())
      : [p.model, ...(p.fallbacks || [])].filter(Boolean);
    if (!targets.length) throw new Error("Test edilecek model yok: önce “Modelleri getir” ya da bir model yaz");
    if (targets.length > 20 && !confirm(t("Listede {n} model var; ilk 20'si test edilecek (her birine 1 kısa istek). Daha azını test etmek için aramayla süz. Devam edilsin mi?", { n: targets.length }))) return;
    await ensureOrigin(p);
    say(status, t("{n} model test ediliyor (her biri en fazla 15 sn)…", { n: Math.min(targets.length, 20) }));
    const r = await ask({ type: "bench", cfg: p, models: targets });
    if (!r?.ok) throw new Error(r?.error || "Yanıt yok");
    benchCache.set(p.id, Object.fromEntries(r.results.map((x) => [x.model, x])));
    const ok = r.results.filter((x) => x.ok);
    useFastest.hidden = !ok.length;
    useFastest.onclick = () => {
      choose(ok[0].model);
      setFallbacks(ok.slice(1, 3).map((x) => x.model));
      refresh();
      drawPicker();
      useFastest.hidden = true;
      say(status, t("Ana model: {m}{fb}. Kaydet'e bas.", { m: ok[0].model, fb: ok.length > 1 ? " · " + t("yedekler: {list}", { list: ok.slice(1, 3).map((x) => x.model).join(", ") }) : "" }), "ok");
    };
    drawPicker();
    if (!ok.length) throw new Error(t("Hiçbir model yanıt vermedi: {x}", { x: r.results.map((x) => `${x.model}: ${t(x.error)}`).join(" · ").slice(0, 300) }));
    const top = ok.slice(0, 3).map((x) => `${x.model} ${t("{s} sn", { s: (x.ms / 1000).toFixed(1) })}`).join(" · ");
    say(status, t("{ok}/{all} yanıt verdi. En hızlılar: {top}", { ok: ok.length, all: r.results.length, top }), "ok");
  });

  const actions = el("div", { className: "row" }, test);
  if (p.type === "openai") actions.append(bench, useFastest);
  actions.append(status);
  const box = el("details", { className: "card" + (p.enabled === false ? " off" : ""), open: openIds.has(p.id) },
    summary, el("div", { className: "card-body" }, ...body, actions));
  box.dataset.id = p.id;
  box.addEventListener("toggle", () => (box.open ? openIds.add(p.id) : openIds.delete(p.id)));
  refresh();
  if (model) drawPicker();
  return box;
}

function render() {
  const list = $("list");
  list.replaceChildren();
  if (!providers.length) list.append(el("div", { className: "empty", textContent: "Sağlayıcı yok. Aşağıdan ekle." }));
  providers.forEach((p, i) => list.append(card(p, i)));
}

// ---- Add-provider gallery ----
function buildGallery() {
  const g = $("gallery");
  g.replaceChildren();
  for (const [group, title, desc] of GROUPS) {
    const tiles = el("div", { className: "tiles" });
    for (const [key, c] of Object.entries(CATALOG)) {
      if (c.group !== group) continue;
      const t = el("button", { type: "button", className: "tile" },
        el("div", { className: "tile-head" }, el("strong", { textContent: PRESETS[key].name }), el("span", { className: "badge " + group, textContent: c.badge })),
        el("span", { className: "hint", textContent: c.blurb }));
      t.addEventListener("click", () => addProvider(key));
      tiles.append(t);
    }
    g.append(el("h4", { textContent: title }), el("p", { className: "hint", textContent: desc }), tiles);
  }
}

function addProvider(key) {
  const p = makeProvider(key);
  providers.push(p);
  openIds.add(p.id);
  $("gallery").hidden = true;
  $("add").textContent = "+ Sağlayıcı ekle";
  markDirty();
  render();
  const node = document.querySelector(`.card[data-id="${p.id}"]`);
  node?.scrollIntoView({ behavior: "smooth", block: "start" });
  (node?.querySelector(".secret input") || node?.querySelector(".card-body input"))?.focus({ preventScroll: true });
}

$("add").addEventListener("click", () => {
  const g = $("gallery");
  g.hidden = !g.hidden;
  $("add").textContent = g.hidden ? "+ Sağlayıcı ekle" : "Kapat";
});
$("collapse-all").addEventListener("click", () => {
  const cards = [...document.querySelectorAll("#list > .card")];
  const open = !cards.some((c) => c.open);
  cards.forEach((c) => (c.open = open));
});

$("diag").addEventListener("click", async (e) => {
  const btn = e.target;
  const out = $("diag-out");
  btn.disabled = true;
  out.replaceChildren(el("div", { className: "diag", textContent: "Kontrol ediliyor…" }));
  const rows = [];
  const row = (ok, text) => rows.push(el("div", { className: "diag " + (ok === true ? "ok" : ok === false ? "err" : ""), textContent: (ok === true ? "✓ " : ok === false ? "✗ " : "• ") + t(text) }));
  const help = (text) => rows.push(el("div", { className: "diag help", textContent: t(text) }));

  const ua = navigator.userAgent.match(/(Chrome|Edg)\/[\d.]+/)?.[0] || navigator.userAgent;
  let brave = false;
  try { brave = !!(await navigator.brave?.isBrave?.()); } catch {}
  row(null, t("Sürüm {v} · {b} ({ua})", { v: chrome.runtime.getManifest().version, b: brave ? "Brave" : t("Tarayıcı"), ua }));

  const ping = await ask({ type: "ping" });
  if (ping?.ok) row(true, "Arka plan (service worker) çalışıyor");
  else {
    row(false, "Arka plan yanıt vermiyor");
    help("brave://extensions (ya da chrome://extensions) sayfasında eklentiyi yenile (⟳), yine olmazsa “Hataları” (Errors) ya da “service worker” bağlantısını aç ve hata mesajını bana yaz.");
  }

  const net = await ask({ type: "nettest" });
  if (net?.ok) {
    for (const r of net.results) row(r.ok, `${r.name}: ${r.ok ? t("erişilebilir ({ms} ms)", { ms: r.ms }) : t("ERİŞİLEMİYOR ({x})", { x: r.status || r.error })}`);
    if (net.results.some((r) => !r.ok)) help("Erişilemeyen kaynak varsa çeviri otomatik olarak sıradaki kaynağa/LLM'e düşer (yavaşlar). VPN, güvenlik duvarı, reklam engelleyici ya da tarayıcı gizlilik ayarları engelliyor olabilir.");
  }

  const d = await ask({ type: "diag" });
  if (d?.hello) {
    const secs = Math.round((Date.now() - d.hello.ts) / 1000);
    row(true, t("İçerik betiği sayfalarda çalışıyor (son: {o}, {secs} sn önce; bu oturumda {n} sayfa)", { o: d.hello.origin.replace(/^https?:\/\//, ""), secs, n: d.hello.count }));
  } else {
    row(false, "İçerik betiği bu oturumda hiçbir sayfada çalışmamış");
    help("Önce bir web sitesi aç ve yenile (F5); sonra tanıyı tekrar çalıştır. Yine ✗ ise: tarayıcı adres çubuğundaki yapboz simgesinden ReadRiver > “Site erişimi”ni ya da brave://extensions > Ayrıntılar > “Site erişimi”ni “Tüm sitelerde” yap.");
  }
  if (d?.last) {
    const l = d.last;
    row(l.ok, l.ok
      ? t("Son çeviri: “{q}” · {p}{c} · {ms} ms", { q: l.query, p: l.provider, c: l.cached ? " " + t("(önbellek)") : "", ms: l.ms })
      : t("Son çeviri BAŞARISIZ: “{q}” · {e}", { q: l.query, e: l.error }));
  } else {
    row(null, "Bu oturumda henüz çeviri yapılmamış");
  }

  out.replaceChildren(...rows);
  btn.disabled = false;
});

$("clear-cache").addEventListener("click", async () => {
  await chrome.storage.local.remove("cache");
  say($("c-msg"), "Önbellek temizlendi", "ok");
});

// ---- Usage counter (chrome.storage.local.usage written by usage.js) ----
const fmtN = (n) => (n ? n.toLocaleString(shownLang === "tr" ? "tr-TR" : "en-US") : "–");
async function renderUsage() {
  const days = Number($("u-range").value) || 30;
  const { usage = {} } = await chrome.storage.local.get("usage");
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const z = (n) => String(n).padStart(2, "0");
  const min = `${from.getFullYear()}-${z(from.getMonth() + 1)}-${z(from.getDate())}`;
  const sum = {};
  for (const [day, srcs] of Object.entries(usage)) {
    if (day < min) continue;
    for (const [name, e] of Object.entries(srcs)) {
      const a = (sum[name] ||= { req: 0, err: 0, chars: 0, inTok: 0, outTok: 0, ms: 0 });
      for (const k of Object.keys(a)) a[k] += e[k] || 0;
    }
  }
  const rows = Object.entries(sum).sort((x, y) => y[1].req - x[1].req);
  if (!rows.length) return $("u-out").replaceChildren(el("p", { className: "hint", textContent: t("Bu aralıkta kayıt yok.") }));
  const head = ["Kaynak", "İstek", "Hata", "Karakter", "Token (giriş / çıkış)", "Ort. süre"];
  const th = el("tr", {}, ...head.map((h) => el("th", { textContent: t(h) })));
  const body = rows.map(([name, a]) => {
    const cache = name === CACHE_NAME;
    const ok = a.req - a.err;
    return el("tr", {},
      el("td", { textContent: cache ? t("Önbellek (kaynağa gitmedi)") : name }),
      el("td", { textContent: fmtN(a.req) }),
      el("td", { textContent: fmtN(a.err) }),
      el("td", { textContent: fmtN(a.chars) }),
      el("td", { textContent: a.inTok || a.outTok ? `${fmtN(a.inTok)} / ${fmtN(a.outTok)}` : "–" }),
      el("td", { textContent: !cache && ok > 0 ? `${Math.round(a.ms / a.req)} ms` : "–" })
    );
  });
  $("u-out").replaceChildren(el("table", { className: "usage" }, th, ...body));
}
const CACHE_NAME = "önbellek"; // same as CACHE_KEY in usage.js
$("u-range").addEventListener("change", renderUsage);
$("u-reset").addEventListener("click", async () => {
  if (!confirm(t("Tüm kullanım sayaçları silinsin mi?"))) return;
  await chrome.storage.local.remove("usage");
  say($("u-msg"), t("Sayaçlar sıfırlandı"), "ok");
  renderUsage();
});
chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.usage) renderUsage(); });
renderUsage();

// ---- Quota: real values reported by the provider (quota.js) + limit headers from the latest responses ----
async function renderLimits() {
  const { limits = {} } = await chrome.storage.local.get("limits");
  const items = Object.entries(limits).sort((a, b) => b[1].ts - a[1].ts);
  if (!items.length) return $("l-out").replaceChildren();
  const blocks = items.map(([name, v]) => {
    const when = new Date(v.ts).toLocaleString(shownLang === "tr" ? "tr-TR" : "en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return el("div", { className: "qblock" },
      el("strong", { textContent: name }), el("span", { className: "hint", textContent: ` · ${t("son yanıt")}: ${when}` }),
      el("table", { className: "usage" }, ...Object.entries(v.h).map(([k, val]) =>
        el("tr", {}, el("td", { textContent: k.replace(/^(x-)?ratelimit-|^anthropic-ratelimit-/, "") }), el("td", { textContent: val }))))
    );
  });
  $("l-out").replaceChildren(el("h3", { textContent: t("Son yanıtlardaki limit bilgisi") }),
    el("p", { className: "hint", textContent: t("Groq, Cerebras, OpenAI, Claude gibi sağlayıcılar her yanıtla kalan istek/token hakkını bildirir; buradaki bilgi o sağlayıcıyla yapılan son çeviriden gelir.") }), ...blocks);
}
$("q-run").addEventListener("click", async () => {
  const btn = $("q-run");
  btn.disabled = true;
  say($("q-msg"), t("Sorgulanıyor…"));
  try {
    const r = await ask({ type: "quota" });
    if (!r?.ok) throw new Error(r?.error || "Yanıt yok");
    if (!r.quotas.length) {
      $("q-out").replaceChildren();
      return say($("q-msg"), t("Kotası sorgulanabilen etkin sağlayıcı yok (DeepL anahtarı, OpenRouter ya da DeepSeek ekle)."));
    }
    say($("q-msg"), "");
    $("q-out").replaceChildren(...r.quotas.map((q) => el("div", { className: "qblock" },
      el("strong", { textContent: q.name }),
      q.error
        ? el("div", { className: "status err", textContent: t("Alınamadı: {e}", { e: q.error }) })
        : el("table", { className: "usage" }, ...q.rows.map(([k, v]) => el("tr", {}, el("td", { textContent: t(k) }), el("td", { textContent: t(v) })))))));
  } catch (e) {
    say($("q-msg"), e.message, "err");
  } finally {
    btn.disabled = false;
  }
});
chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.limits) renderLimits(); });
renderLimits();

// ---- Preferences: schema → form (defaults and limits come from shared/prefs.js) ----
let prefs = { ...RC_PREFS.defaults };
let dirty = false;

const SCHEMA = {
  behavior: [
    { key: "selectMode", type: "select", label: "Metin seçince (sürükleyerek)",
      options: [["button", "Küçük R butonu göster (önerilen)"], ["auto", "Gecikmeli otomatik çevir"], ["off", "Hiçbir şey yapma (yalnızca çift tıklama / sağ tık)"]] },
    { key: "autoDelay", type: "range", label: "Otomatik çeviri gecikmesi", min: 0, max: 2000, step: 50, unit: " ms", showIf: (p) => p.selectMode === "auto",
      hint: "Seçimi bıraktıktan sonra bu kadar bekler. Bu sürede seçim değişirse ya da bir yere tıklarsan çevrilmez. 0 = hemen." },
    { key: "dblclick", type: "checkbox", label: "Kelimeye çift tıklayınca çevir" },
    { key: "dblDelay", type: "range", label: "Çift tıklama gecikmesi", min: 0, max: 1000, step: 50, unit: " ms", showIf: (p) => p.dblclick,
      hint: "Üç kez tıklayıp paragraf seçerken yanlışlıkla kart açılmasını önler. 0 = hemen." },
    { key: "modifier", type: "select", label: "Seçim ve çift tıklamada şu tuş basılıyken çevir",
      options: [["none", "Tuş gerekmez"], ["alt", "Alt"], ["ctrl", "Ctrl"], ["shift", "Shift"]],
      hint: "Yanlışlıkla seçimlerde kart açılmasın istiyorsan bir tuş seç. Altyazı üzerine gelmeyi etkilemez." },
    { key: "minChars", type: "number", label: "En az karakter", min: 1, max: 20, hint: "Bundan kısa seçimler (ör. tek harf) çevrilmez." },
    { key: "maxChars", type: "number", label: "En çok karakter", min: 20, max: 1000, hint: "Bundan uzun seçimler (ör. tüm paragraf) çevrilmez." },
    { key: "ignoreNonLetters", type: "checkbox", label: "Harf içermeyen seçimleri yok say (yalnız sayı, simge)" },
    { key: "ignoreEditable", type: "checkbox", label: "Yazı alanlarında (input, textarea, düzenlenebilir alan) çalışma" },
    { key: "maxExamples", type: "range", label: "Gösterilecek örnek cümle sayısı", min: 1, max: 5, step: 1 },
    { key: "autoSpeak", type: "checkbox", label: "Kart açılınca kelimeyi sesli oku" }
  ],
  tag: [
    { key: "tagLayout", type: "select", label: "Çevirinin yeri",
      options: [["fit", "Satır arasına sığdır (gerekirse küçült)"], ["expand", "Satır arasını aç (tam boyut, satır aşağı kayar)"], ["overlay", "Tam boyut, üstteki satırın üzerine yaz"]],
      hint: "Satır arasını aç: çevirinin olduğu satır, çeviri sığacak kadar aşağı itilir. Kelime görünmez bir <span> ile sarılır; etiket kalkınca geri alınır." },
    { key: "tagFontSize", type: "range", label: "Çeviri yazı boyutu", min: 8, max: 20, step: 1, unit: " px",
      hint: "“Sığdır” seçiliyken bu en büyük boydur; satır arası dar olan sayfalarda küçülür." },
    { key: "tagBg", type: "color", label: "Etiket rengi" },
    { key: "tagFg", type: "color", label: "Etiket yazı rengi" },
    { key: "tagColor", type: "color", label: "Fare altındaki kelimenin vurgu rengi" },
    { key: "tagDelay", type: "range", label: "Etiket gecikmesi", min: 0, max: 600, step: 25, unit: " ms",
      hint: "Bu süre içinde ikinci tık gelirse çift tıklama sayılır ve kart açılır; çift tıklamanın kaçtığını görürsen artır." }
  ],
  subtitle: [
    { key: "subtitleHover", type: "checkbox", label: "Altyazı üzerine gelince çevir (YouTube, Netflix, video oynatıcılar)" },
    { key: "hoverDelay", type: "range", label: "Bekleme süresi (kart açılmadan önce)", min: 100, max: 1500, step: 50, unit: " ms", showIf: (p) => p.subtitleHover,
      hint: "Fareyi kelimenin üzerinde bu kadar tutunca çevirir. Kısa tutarsan kartlar sık açılır." },
    { key: "leaveDelay", type: "range", label: "Kapanma gecikmesi", min: 100, max: 2000, step: 50, unit: " ms", showIf: (p) => p.subtitleHover,
      hint: "Fareyi altyazıdan ve karttan çekince kart bu kadar sonra kapanır." },
    { key: "pauseOnHover", type: "checkbox", label: "Kart açılınca videoyu duraklat, fareyi çekince devam ettir", showIf: (p) => p.subtitleHover },
    { key: "nativeSubs", type: "checkbox", label: "Sitenin kendi video altyazısını (HTML5 <track>) kelime kelime üstüne gelinebilir yap",
      hint: "Bazı oynatıcıların altyazısını tarayıcı kendisi çizer ve üzerine gelinemez. Bu seçenek açıkken o altyazı gizlenir, aynı metin eklentinin kendi katmanında gösterilir. Site tam ekranda videonun kendisini (kapsayıcısını değil) tam ekran yaparsa tarayıcının kendi altyazısı geri gelir." },
    { key: "subFontScale", type: "range", label: "Altyazı katmanı yazı boyutu", min: 0.6, max: 2, step: 0.1, fmt: (v) => "×" + Number(v).toFixed(1), showIf: (p) => p.nativeSubs },
    { key: "subOpacity", type: "range", label: "Altyazı katmanı arka plan koyuluğu", min: 0, max: 100, step: 5, unit: " %", showIf: (p) => p.nativeSubs }
  ],
  look: [
    { key: "uiLang", type: "select", label: "Uygulama dili", options: [["auto", "Tarayıcı diliyle aynı"], ["tr", "Türkçe"], ["en", "English"]],
      hint: "Kart, araç çubuğu penceresi ve bu sayfanın dili. Kaydedince sayfa yenilenir." },
    { key: "theme", type: "select", label: "Tema", options: [["auto", "Sistemle aynı"], ["light", "Açık"], ["dark", "Koyu"]] },
    { key: "accent", type: "color", label: "Vurgu rengi", hint: "Düğmeler, bağlantılar ve R butonu. #1a73e8 varsayılan renktir." },
    { key: "fontSize", type: "range", label: "Kart yazı boyutu", min: 11, max: 20, step: 1, unit: " px" },
    { key: "cardWidth", type: "range", label: "Kart genişliği", min: 280, max: 560, step: 10, unit: " px" }
  ],
  advanced: [
    { key: "cacheEnabled", type: "checkbox", label: "Çevirileri önbelleğe al", hint: "Aynı kelimeyi tekrar arayınca anında gelir. Kapatırsan her arama kaynağa gider." },
    { key: "cacheMax", type: "number", label: "Önbellekte tutulacak en çok kayıt", min: 50, max: 5000, showIf: (p) => p.cacheEnabled },
    { key: "blockedSites", type: "textarea", label: "Bu sitelerde eklenti kapalı", placeholder: "mail.google.com\ndocs.google.com",
      hint: "Her satıra ya da virgülle ayırarak bir alan adı yaz. Alt alan adları dahildir. Sağ tık menüsü yine çalışır." }
  ]
};

function buildField(f, container) {
  const wrap = el("div", { className: "field-row" });
  const update = (v) => { prefs[f.key] = v; refreshUI(); };
  if (f.type === "checkbox") {
    const input = el("input", { type: "checkbox", checked: !!prefs[f.key] });
    input.addEventListener("change", () => update(input.checked));
    wrap.append(el("label", { className: "check" }, input, f.label));
  } else {
    const head = el("div", { className: "field-head" }, el("span", { textContent: f.label }));
    const label = el("label", {}, head);
    if (f.type === "select") {
      const sel = el("select");
      for (const [v, t] of f.options) sel.append(el("option", { value: v, textContent: t, selected: prefs[f.key] === v }));
      sel.addEventListener("change", () => update(sel.value));
      label.append(sel);
    } else if (f.type === "range") {
      const out = el("output");
      const show = (v) => (out.textContent = (f.fmt ? f.fmt(v) : v) + (f.unit || ""));
      const r = el("input", { type: "range", min: f.min, max: f.max, step: f.step || 1, value: prefs[f.key] });
      show(prefs[f.key]);
      r.addEventListener("input", () => { const v = Number(r.value); show(v); update(v); });
      head.append(out);
      label.append(r);
    } else if (f.type === "number") {
      const n = el("input", { type: "number", min: f.min, max: f.max, value: prefs[f.key] });
      n.addEventListener("input", () => { if (n.value !== "") update(Number(n.value)); });
      label.append(n);
    } else if (f.type === "color") {
      const c = el("input", { type: "color", value: prefs[f.key] });
      c.addEventListener("input", () => update(c.value));
      label.append(c);
    } else if (f.type === "textarea") {
      const t = el("textarea", { value: prefs[f.key], placeholder: f.placeholder || "" });
      t.addEventListener("input", () => update(t.value));
      label.append(t);
    }
    wrap.append(label);
  }
  if (f.hint) wrap.append(el("p", { className: "hint", textContent: f.hint }));
  wrap._showIf = f.showIf;
  container.append(wrap);
}

const SAMPLE = {
  query: "book", from: "en", to: "tr", provider: "Önizleme",
  translations: [{ text: "kitap", pos: "noun" }, { text: "defter", pos: "noun" }, { text: "rezervasyon yapmak", pos: "verb" }],
  examples: [
    { src: "I read the **book** twice.", tgt: "**Kitabı** iki kez okudum." },
    { src: "Can we **book** a table for two?", tgt: "İki kişilik bir masa **ayırtabilir** miyiz?" },
    { src: "She wrote a **book** about travel.", tgt: "Seyahat hakkında bir **kitap** yazdı." },
    { src: "This **book** is on sale.", tgt: "Bu **kitap** indirimde." },
    { src: "He left his **book** at home.", tgt: "**Kitabını** evde unuttu." }
  ],
  notes: ""
};

function renderPreview() {
  const box = $("preview");
  box.style.width = prefs.cardWidth + "px";
  box.style.maxWidth = "100%";
  box.replaceChildren();
  const inner = el("div");
  inner.style.zoom = String(prefs.fontSize / 14);
  box.append(inner);
  RC.result(inner, SAMPLE, { maxExamples: prefs.maxExamples });
}

// ---- One-click mode preview: sample article + labels; same placement as the content script (shared/tagfit.js) ----
const TAG_PV_TEXT = [
  "Every morning the old farmer walks slowly down to the river and watches the birds carefully before he starts his long day of work in the fields.",
  "Reading things you enjoy is one of the best ways to learn a language: click any word here to see its translation right above it."
];
const TAG_PV_START = [["farmer", "çiftçi", false], ["river", "nehir", true], ["carefully", "dikkatlice", false]];
const TAG_WORD = /[\p{L}\p{M}'’-]/u;
const pvTags = []; // { range, el, spacer? }
let pvHl = null;
let pvReady = false;

function pvRange(node, a, b) {
  const r = document.createRange();
  r.setStart(node, a);
  r.setEnd(node, b);
  return r;
}

function pvFind(word) {
  for (const p of $("tag-pv-text").children) {
    const n = p.firstChild;
    const i = n?.textContent.indexOf(word) ?? -1;
    if (i >= 0) return pvRange(n, i, i + word.length);
  }
  return null;
}

// Simplified version of wordAtPoint from the content script.
function pvWordAt(x, y) {
  const p = document.caretPositionFromPoint?.(x, y);
  const node = p?.offsetNode;
  if (!node || node.nodeType !== Node.TEXT_NODE || !$("tag-pv-text").contains(node)) return null;
  const s = node.textContent;
  let a = p.offset;
  let b = p.offset;
  while (a > 0 && TAG_WORD.test(s[a - 1])) a--;
  while (b < s.length && TAG_WORD.test(s[b])) b++;
  if (b - a < 2) return null;
  const range = pvRange(node, a, b);
  const inside = [...range.getClientRects()].some((r) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2);
  return inside ? range : null;
}

function pvAdd(range, translation, saved) {
  const t = { range, el: el("div", { className: "rc-tag" + (saved ? " rc-saved" : "") }) };
  const txt = el("span", { textContent: translation || "…", title: "Kaldırmak için tıkla" });
  const star = el("button", { className: "rc-tag-save", textContent: saved ? "★" : "☆", title: "Önizleme: gerçekten kaydetmez" });
  star.addEventListener("click", (e) => {
    e.stopPropagation();
    t.el.classList.add("rc-saved");
    star.textContent = "★";
  });
  txt.addEventListener("click", () => pvRemove(t));
  t.el.append(txt, star);
  $("tag-pv-wrap").append(t.el);
  pvTags.push(t);
  if (!translation) {
    RC.translate(range.toString(), {}).then((resp) => {
      txt.textContent = (resp.ok && resp.result?.translations?.[0]?.text) || "?";
      pvLayout();
    });
  }
  pvLayout();
}

function pvRemove(t) {
  pvTags.splice(pvTags.indexOf(t), 1);
  t.el.remove();
  RC_TAGFIT.unwrap(t);
  pvLayout();
}

function pvLayout() {
  if (!pvReady) return;
  const wrap = $("tag-pv-wrap");
  wrap.style.setProperty("--rc-tag-bg", prefs.tagBg);
  wrap.style.setProperty("--rc-tag-fg", prefs.tagFg);
  pvHl.textContent = RC_TAGFIT.highlightCss(prefs);
  // "Open space between the lines" changes the layout: if anything changed, do one more pass (the other labels shifted).
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const t of pvTags) {
      const L = RC_TAGFIT.layout(t, prefs);
      t.el.style.display = L ? "" : "none";
      if (!L) continue;
      changed ||= L.changed;
      const w = wrap.getBoundingClientRect();
      t.el.style.fontSize = L.fontSize + "px";
      t.el.style.left = L.rect.left + L.rect.width / 2 - w.left - wrap.clientLeft + "px";
      t.el.style.top = L.mid - w.top - wrap.clientTop + "px";
    }
    if (!changed) break;
  }
  if (globalThis.CSS?.highlights && typeof Highlight === "function") {
    if (pvTags.length) CSS.highlights.set("rc-tagged", new Highlight(...pvTags.map((t) => t.range)));
    else CSS.highlights.delete("rc-tagged");
  }
}

function initTagPreview() {
  const text = $("tag-pv-text");
  const base = document.createElement("style");
  base.textContent = RC_TAGFIT.CSS_TEXT;
  pvHl = document.createElement("style");
  document.head.append(base, pvHl);
  for (const s of TAG_PV_TEXT) text.append(el("p", { textContent: s }));
  const applyText = () => {
    text.style.lineHeight = $("tag-pv-lh").value;
    text.style.fontSize = $("tag-pv-fs").value + "px";
    pvLayout();
  };
  $("tag-pv-lh").addEventListener("change", applyText);
  $("tag-pv-fs").addEventListener("change", applyText);
  text.addEventListener("mousemove", (e) => {
    if (!globalThis.CSS?.highlights) return;
    const r = pvWordAt(e.clientX, e.clientY);
    if (r) CSS.highlights.set("rc-hover", new Highlight(r));
    else CSS.highlights.delete("rc-hover");
  });
  text.addEventListener("mouseleave", () => globalThis.CSS?.highlights?.delete("rc-hover"));
  text.addEventListener("click", (e) => {
    const r = pvWordAt(e.clientX, e.clientY);
    if (!r) return;
    const old = pvTags.find((t) => {
      try {
        return t.range.compareBoundaryPoints(Range.START_TO_START, r) <= 0 && t.range.compareBoundaryPoints(Range.END_TO_END, r) >= 0;
      } catch (_) {
        return false;
      }
    });
    if (old) pvRemove(old);
    else pvAdd(r, "", false);
  });
  pvReady = true;
  applyText();
  for (const [w, tr, saved] of TAG_PV_START) {
    const r = pvFind(w);
    if (r) pvAdd(r, tr, saved);
  }
  // Nothing can be measured while the tab is hidden; re-place when it becomes visible (the size changes).
  new ResizeObserver(() => pvLayout()).observe($("tag-pv-wrap"));
}
initTagPreview();

// Appearance preferences are applied to this page too; conditional fields are shown/hidden.
function refreshUI() {
  RC.applyAppearance(document.documentElement, prefs);
  document.querySelectorAll(".field-row").forEach((w) => { if (w._showIf) w.hidden = !w._showIf(prefs); });
  renderPreview();
  pvLayout();
}

function rebuildPrefsUI() {
  for (const [tab, fields] of Object.entries(SCHEMA)) {
    const box = $("f-" + tab);
    box.replaceChildren();
    fields.forEach((f) => buildField(f, box));
  }
  refreshUI();
}

// ---- Tabs ----
const TABS = ["sources", "behavior", "subtitle", "look", "advanced"];
function showTab(name) {
  if (!TABS.includes(name)) name = "sources";
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== name));
  history.replaceState(null, "", "#" + name);
}
$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (b) showTab(b.dataset.tab);
});

// ---- Unsaved changes warning ----
function markDirty() {
  dirty = true;
  say($("msg"), "Kaydedilmemiş değişiklikler var");
}
$("main").addEventListener("input", markDirty);
$("main").addEventListener("change", markDirty);
window.addEventListener("beforeunload", (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ""; }
});

// ---- Backup ----
// Personal fields of the fast provider: removed on keyless export, preserved on import.
const SOURCE_SECRETS = [["google", "apiKey"], ["deepl", "apiKey"], ["microsoft", "apiKey"], ["mymemory", "email"]];
$("export").addEventListener("click", async () => {
  const out = $("d-msg");
  try {
    const includeKeys = $("exp-keys").checked;
    const { favorites = [] } = await chrome.storage.local.get("favorites");
    const scrub = (p) => {
      if (includeKeys) return { ...p };
      const c = { ...p, key: "" };
      if (c.sources) {
        c.sources = { ...c.sources };
        for (const [src, prop] of SOURCE_SECRETS) c.sources[src] = { ...c.sources[src], [prop]: "" };
      }
      return c;
    };
    const payload = {
      app: "ReadRiver",
      version: chrome.runtime.getManifest().version,
      exportedAt: new Date().toISOString(),
      settings: {
        langA: $("langA").value || "en",
        langB: $("langB").value || "tr",
        prefs: RC_PREFS.resolve({ prefs }),
        providers: providers.map(scrub)
      },
      favorites
    };
    const a = el("a", {
      href: URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })),
      download: `readriver-backup-${new Date().toISOString().slice(0, 10)}.json`
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say(out, t(includeKeys ? "Dışa aktarıldı ({n} kelime, anahtarlar dahil)" : "Dışa aktarıldı ({n} kelime, anahtarlar hariç)", { n: favorites.length }), "ok");
  } catch (e) {
    say(out, e.message, "err");
  }
});

$("import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const out = $("d-msg");
  try {
    const data = JSON.parse(await file.text());
    // Backups made before the rename carry the old app name.
    if (!["ReadRiver", "Reverbo"].includes(data.app) || !data.settings) throw new Error("Bu bir ReadRiver yedek dosyası değil");
    if (!confirm(t("Ayarlar ve sağlayıcılar yedekteki ile değiştirilsin mi? (Kaydedilen kelimeler mevcutlarla birleştirilir.)"))) return;

    // If the backup has no keys (keyless export), keep the existing keys.
    const incoming = (data.settings.providers || []).map((p) => {
      const old = providers.find((c) => c.id === p.id) || providers.find((c) => c.name === p.name && c.type === p.type);
      const m = { ...p };
      if (!m.key && old?.key) m.key = old.key;
      if (m.sources && old?.sources) {
        m.sources = { ...m.sources };
        for (const [src, prop] of SOURCE_SECRETS) {
          const v = old.sources[src]?.[prop];
          if (v && !m.sources[src]?.[prop]) m.sources[src] = { ...m.sources[src], [prop]: v };
        }
      }
      return m;
    });
    if (incoming.length) providers = incoming;
    prefs = RC_PREFS.resolve({ prefs: data.settings.prefs });
    setLangs(data.settings.langA || "en", data.settings.langB || "tr");

    const { favorites = [] } = await chrome.storage.local.get("favorites");
    const have = new Set(favorites.map((f) => f.query.toLowerCase()));
    const added = (data.favorites || []).filter((f) => f && f.query && !have.has(f.query.toLowerCase()));
    await chrome.storage.local.set({ favorites: [...favorites, ...added] });

    rebuildPrefsUI();
    render();
    markDirty();
    say(out, t("İçe aktarıldı ({n} yeni kelime). Ayarları uygulamak için Kaydet'e bas.", { n: added.length }), "ok");
  } catch (err) {
    say(out, err.message, "err");
  }
});

$("reset").addEventListener("click", () => {
  if (!confirm(t("Tüm tercihler (tetikleme, altyazı, görünüm, önbellek) varsayılana dönsün mü? Sağlayıcılar ve kaydedilen kelimeler etkilenmez."))) return;
  prefs = { ...RC_PREFS.defaults };
  rebuildPrefsUI();
  markDirty();
});

// ---- Languages (the list comes from shared/langs.js) ----
const langName = (l) => (shownLang === "en" && l.en ? l.en : l.name);
function setLangs(a, b) {
  for (const [id, val] of [["langA", a], ["langB", b]]) {
    const sel = $(id);
    const opts = RC_LANGS.list
      .slice()
      .sort((x, y) => langName(x).localeCompare(langName(y), shownLang))
      .map((l) => el("option", { value: l.code, textContent: `${langName(l)} (${l.code})` }));
    // Don't lose an old/manually entered code that isn't in the list.
    if (val && !RC_LANGS.get(val)) opts.unshift(el("option", { value: val, textContent: t("{code} (listede yok)", { code: val }) }));
    sel.replaceChildren(...opts);
    sel.value = val;
  }
  langNote();
}

function langNote() {
  const a = $("langA").value;
  const b = $("langB").value;
  const note = [];
  if (a === b) note.push(t("⚠ İki dil aynı olamaz."));
  const noDeepl = [a, b].filter((c) => RC_LANGS.get(c) && !RC_LANGS.get(c).dl).map((c) => langName(RC_LANGS.get(c)));
  if (noDeepl.length) note.push(t("DeepL {x} dilini desteklemiyor (Google/Microsoft/MyMemory destekler).", { x: noDeepl.join(", ") }));
  if (!RC_LANGS.iso3(a) || !RC_LANGS.iso3(b)) note.push(t("Bu dil için Tatoeba örnek cümlesi yok; örnekler yalnızca LLM ile gelir."));
  $("lang-note").textContent = note.join(" ");
  $("lang-note").classList.toggle("err", a === b);
}

$("langA").addEventListener("change", langNote);
$("langB").addEventListener("change", langNote);
$("lang-swap").addEventListener("click", () => {
  setLangs($("langB").value, $("langA").value);
  markDirty();
});

// ---- Save ----
$("save").addEventListener("click", async () => {
  const msg = $("msg");
  try {
    if ($("langA").value === $("langB").value) throw new Error("Dil A ile Dil B aynı olamaz (Kaynaklar > Diller)");
    for (const p of providers) await ensureOrigin(p);
    prefs = RC_PREFS.resolve({ prefs }); // apply the limits
    await saveSettings({
      langA: $("langA").value || "en",
      langB: $("langB").value || "tr",
      prefs,
      providers: providers.map((p) => ({ ...p, name: p.name || TYPE_LABEL[p.type] }))
    });
    dirty = false;
    if (RC_I18N.resolveLang(prefs.uiLang) !== shownLang) return location.reload(); // language changed: re-translate the page texts
    rebuildPrefsUI();
    say(msg, "Kaydedildi", "ok");
  } catch (e) {
    say(msg, e.message, "err");
  }
});

(async () => {
  const s = await getSettings();
  providers = s.providers.map((p) => ({ ...p }));
  prefs = s.prefs;
  setLangs(s.langA, s.langB);
  $("ver").textContent = t("sürüm {v}", { v: chrome.runtime.getManifest().version });
  rebuildPrefsUI();
  buildGallery();
  render();
  showTab(location.hash.slice(1));
})();
