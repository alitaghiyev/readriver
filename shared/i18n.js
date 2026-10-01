// App language (UI texts). The source strings are Turkish: key = source text, value = its English text.
// Shared by classic scripts (content script, popup, options) and the ES module (background): globalThis.RC_I18N.
//   t("Metin {x}", { x: 1 })  → the text in the selected language
//   add({ "Kaydet": "Save" })  → add to the dictionary (the options page adds its own dictionary this way)
//   ready                     → promise resolved once the stored language preference is read
//   translateDom(root) / observe(root) → translates static and later-added text nodes (only for the options/popup HTML)
(() => {
  const EN = {};
  let lang = "tr";

  const browserLang = () => {
    let l = "";
    try { l = chrome.i18n.getUILanguage(); } catch (_) {}
    return String(l || (typeof navigator !== "undefined" && navigator.language) || "en").toLowerCase();
  };
  const resolveLang = (pref) => (pref === "tr" || pref === "en" ? pref : browserLang().startsWith("tr") ? "tr" : "en");
  const prefOf = (settings) => settings?.prefs?.uiLang || "auto";

  const listeners = new Set();
  function setLang(pref) {
    const next = resolveLang(pref);
    if (next === lang) return;
    lang = next;
    listeners.forEach((fn) => { try { fn(lang); } catch (_) {} });
  }

  function t(s, vars) {
    let r = lang === "en" ? EN[s] ?? s : s;
    if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
    return r;
  }

  function add(dict) { Object.assign(EN, dict); }

  // ---- DOM translation (source text → dictionary) ----
  const ATTRS = ["title", "placeholder", "aria-label"];
  const SKIP = new Set(["SCRIPT", "STYLE", "CODE", "TEXTAREA", "PRE"]);

  function trText(node) {
    const raw = node.nodeValue;
    const core = raw.trim();
    if (!core) return;
    const en = EN[core];
    if (en && en !== core) node.nodeValue = raw.replace(core, en);
  }
  function trAttrs(elm) {
    for (const a of ATTRS) {
      const v = elm.getAttribute?.(a);
      if (v && EN[v] && EN[v] !== v) elm.setAttribute(a, EN[v]);
    }
  }
  function translateDom(root) {
    if (lang !== "en" || !root) return;
    if (root.nodeType === 3) return void trText(root);
    if (root.nodeType !== 1) return;
    const walk = (n) => {
      if (SKIP.has(n.tagName)) return;
      trAttrs(n);
      for (const c of n.childNodes) {
        if (c.nodeType === 3) trText(c);
        else if (c.nodeType === 1) walk(c);
      }
    };
    walk(root);
  }
  let observer = null;
  function observe(root) {
    if (observer || typeof MutationObserver === "undefined") return;
    observer = new MutationObserver((muts) => {
      if (lang !== "en") return;
      for (const m of muts) {
        if (m.type === "childList") m.addedNodes.forEach(translateDom);
        else if (m.type === "characterData") trText(m.target);
        else if (m.type === "attributes") trAttrs(m.target);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // Stored preference + live updates (skip silently if the content script is orphaned).
  let ready = Promise.resolve();
  try {
    ready = chrome.storage.local.get("settings").then((r) => setLang(prefOf(r.settings))).catch(() => {});
    chrome.storage.onChanged.addListener((c, area) => {
      if (area === "local" && c.settings) setLang(prefOf(c.settings.newValue));
    });
  } catch (_) {}

  globalThis.RC_I18N = {
    t, add, setLang, ready, translateDom, observe, resolveLang,
    get lang() { return lang; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };

  // ---- Shared dictionary: card, toolbar popup, context menu, common error messages ----
  add({
    // render.js
    "“{q}” çevriliyor…": "Translating “{q}”…",
    "Örnek cümleler": "Example sentences",
    "Dinle": "Listen",
    "☆ Kaydet": "☆ Save",
    "★ Kaydedildi": "★ Saved",
    "örnek cümleler yükleniyor…": "loading example sentences…",
    "örnek cümleler alınamadı": "couldn't load example sentences",
    "🤖 LLM ile detaylandır": "🤖 Elaborate with LLM",
    "önbellekten": "from cache",
    "Chrome yerleşik çeviri bu tarayıcıda yok": "Chrome's built-in translation isn't available in this browser",
    "Yedek mod: Chrome yerleşik çeviri (örnek cümle yok).": "Fallback mode: Chrome built-in translation (no example sentences).",
    "Bilinmeyen hata": "Unknown error",
    "(yedek: {m})": "(fallback: {m})",
    // content.js
    "Çevir": "Translate",
    "Tek tık çeviri açık (Alt+T ile kapat)": "Single-click translation on (Alt+T to turn off)",
    "Tek tık çeviri kapalı": "Single-click translation off",
    "Kaldırmak için tıkla": "Click to remove",
    "Eklenti bu sayfada çalışmıyor": "The extension isn't running on this page",
    // popup
    "Tek tık çeviri": "Single-click translation",
    "Açık: kelimeye tek tıklayınca çevirisi üstüne yazılır (bu sekmede, Alt+T)": "On: clicking a word once writes its translation above it (this tab, Alt+T)",
    "Kelime veya cümle yaz…": "Type a word or sentence…",
    "Çeviri": "Translate",
    "Geçmiş": "History",
    "Kaydedilenler": "Saved",
    "Tekrar": "Review",
    "Ayarlar": "Settings",
    "Sil": "Delete",
    "Tümünü sil": "Delete all",
    "{n} kayıt ": "{n} entries ",
    "Önbellekte kayıt yok. (Ayarlar'da önbellek kapalı olabilir.)": "No cached entries. (The cache may be turned off in Settings.)",
    "Henüz kaydedilmiş kelime yok.": "No saved words yet.",
    "Önce birkaç kelime kaydet (☆ Kaydet).": "Save a few words first (☆ Save).",
    "Bugünlük tekrar bitti 🎉 Sıradaki kart yaklaşık {h} saat sonra.": "Done for today 🎉 The next card is due in about {h} hours.",
    "{n} kart bekliyor · kutu {box}": "{n} cards waiting · box {box}",
    "Cevabı göster": "Show answer",
    "Bilmiyordum": "Didn't know",
    "Biliyordum": "Knew it",
    "Sıfırla": "Reset",
    "Sıfırlanıyor…": "Resetting…",
    "✓ Sıfırlandı. Sayfada yeniden deneyebilirsin.": "✓ Reset. You can try again on the page.",
    "Sıfırlanamadı": "Couldn't reset",
    "Sayfayı yenilemek gerekiyor.": "The page needs to be reloaded.",
    "Sayfayı yenile": "Reload page",
    "⚠ Eklenti bu sayfada çalışmıyor (sayfa, eklenti güncellenmeden önce açılmış olabilir).": "⚠ The extension isn't running on this page (the page may have been opened before the extension was updated).",
    // background
    "ReadRiver ile çevir: “%s”": "Translate with ReadRiver: “%s”",
    "ReadRiver bu sayfada çalışmıyor — tıklayıp “Sıfırla”ya bas": "ReadRiver isn't running on this page — click and press “Reset”",
    "Bu sayfada eklentiler çalışamaz (tarayıcı sayfası ya da mağaza).": "Extensions can't run on this page (browser page or web store).",
    // common provider errors (shown in the card)
    "Boş sorgu": "Empty query",
    "Metin çok uzun (en fazla 1000 karakter)": "Text is too long (max 1000 characters)",
    "Boş sonuç": "Empty result",
    "Hiçbir sağlayıcı ayarlanmamış (Ayarlar sayfasını aç)": "No provider is configured (open the Settings page)",
    "Tüm çeviri kaynakları kapalı (Ayarlar > Hızlı)": "All translation sources are off (Settings > Sources)",
    "Gemini API key girilmemiş": "Gemini API key is missing",
    "Claude API key girilmemiş": "Claude API key is missing",
    "Model adı girilmemiş": "Model name is missing",
    "Base URL girilmemiş": "Base URL is missing",
    "OpenAI uyumlu endpoint girilmemiş": "OpenAI-compatible endpoint is missing",
    "Model JSON döndürmedi": "The model didn't return JSON",
    "boş yanıt": "empty response",
    "MyMemory: günlük limit ya da boş yanıt": "MyMemory: daily limit reached or empty response",
    "Google Cloud Translation boş yanıt": "Google Cloud Translation returned an empty response",
    "Microsoft Translator boş yanıt": "Microsoft Translator returned an empty response",
    "DeepL boş yanıt": "DeepL returned an empty response"
  });
})();
