// Selectable languages: code (Google/MyMemory code) → name, Tatoeba code (ISO 639-3), speech locale,
// differing codes in other services and distinctive letters for direction guessing. Shared by classic scripts (content script,
// popup, settings) and ES modules (settings.js, providers); that is why it writes to globalThis.RC_LANGS.
(() => {
  const CYR = "\\u0400-\\u04FF";
  const ARAB = "\\u0600-\\u06FF";
  // [code, Turkish name, English name (LLM prompt), Tatoeba, TTS, extra fields]
  // ms: Microsoft code, dl: DeepL code (null = not supported by DeepL), chars: distinctive letters
  const rows = [
    ["en", "İngilizce", "English", "eng", "en-US", { dl: "EN-US" }],
    ["tr", "Türkçe", "Turkish", "tur", "tr-TR", { chars: "çğıöşüÇĞİÖŞÜ" }],
    ["az", "Azerbaycan Türkçesi", "Azerbaijani", "aze", "az-AZ", { dl: null, chars: "əƏ" }],
    ["de", "Almanca", "German", "deu", "de-DE", { chars: "äöüßÄÖÜ" }],
    ["fr", "Fransızca", "French", "fra", "fr-FR", { chars: "àâæèéêëîïôœùûÿÀÂÆÈÉÊËÎÏÔŒÙÛŸ" }],
    ["es", "İspanyolca", "Spanish", "spa", "es-ES", { chars: "ñÑ¿¡" }],
    ["it", "İtalyanca", "Italian", "ita", "it-IT"],
    ["pt", "Portekizce", "Portuguese", "por", "pt-BR", { dl: "PT-BR", chars: "ãõÃÕ" }],
    ["nl", "Felemenkçe", "Dutch", "nld", "nl-NL"],
    ["ru", "Rusça", "Russian", "rus", "ru-RU", { chars: CYR }],
    ["uk", "Ukraynaca", "Ukrainian", "ukr", "uk-UA", { chars: "ЄєІіЇїҐґ" }],
    ["pl", "Lehçe", "Polish", "pol", "pl-PL", { chars: "ąćęłńśźżĄĆĘŁŃŚŹŻ" }],
    ["cs", "Çekçe", "Czech", "ces", "cs-CZ", { chars: "ěřůĚŘŮ" }],
    ["sv", "İsveççe", "Swedish", "swe", "sv-SE", { chars: "åÅ" }],
    ["no", "Norveççe", "Norwegian", "nob", "nb-NO", { ms: "nb", dl: "NB", chars: "øæØÆ" }],
    ["da", "Danca", "Danish", "dan", "da-DK", { chars: "øæØÆ" }],
    ["fi", "Fince", "Finnish", "fin", "fi-FI"],
    ["el", "Yunanca", "Greek", "ell", "el-GR", { chars: "\\u0370-\\u03FF" }],
    ["hu", "Macarca", "Hungarian", "hun", "hu-HU", { chars: "őűŐŰ" }],
    ["ro", "Romence", "Romanian", "ron", "ro-RO", { chars: "ășțĂȘȚ" }],
    ["bg", "Bulgarca", "Bulgarian", "bul", "bg-BG", { chars: CYR }],
    ["sr", "Sırpça", "Serbian", "srp", "sr-RS", { ms: "sr-Cyrl", dl: null, chars: CYR }],
    ["hr", "Hırvatça", "Croatian", "hrv", "hr-HR", { dl: null }],
    ["bs", "Boşnakça", "Bosnian", "bos", "bs-BA", { dl: null }],
    ["sq", "Arnavutça", "Albanian", "sqi", "sq-AL", { dl: null }],
    ["ka", "Gürcüce", "Georgian", "kat", "ka-GE", { dl: null, chars: "\\u10A0-\\u10FF" }],
    ["hy", "Ermenice", "Armenian", "hye", "hy-AM", { dl: null, chars: "\\u0530-\\u058F" }],
    ["kk", "Kazakça", "Kazakh", "kaz", "kk-KZ", { dl: null, chars: "ӘәҒғҚқҢңӨөҰұҮүҺһ" }],
    ["uz", "Özbekçe", "Uzbek", "uzb", "uz-UZ", { dl: null }],
    ["ku", "Kürtçe (Kurmancî)", "Kurdish (Kurmanji)", "kmr", "ku", { ms: "kmr", dl: null, chars: "êîûÊÎÛ" }],
    ["ar", "Arapça", "Arabic", "ara", "ar-SA", { chars: ARAB }],
    ["fa", "Farsça", "Persian", "pes", "fa-IR", { dl: null, chars: "پچژگ" }],
    ["ur", "Urduca", "Urdu", "urd", "ur-PK", { dl: null, chars: "ٹڈڑںے" }],
    ["he", "İbranice", "Hebrew", "heb", "he-IL", { chars: "\\u0590-\\u05FF" }],
    ["hi", "Hintçe", "Hindi", "hin", "hi-IN", { dl: null, chars: "\\u0900-\\u097F" }],
    ["bn", "Bengalce", "Bengali", "ben", "bn-IN", { dl: null, chars: "\\u0980-\\u09FF" }],
    ["zh-CN", "Çince (Basitleştirilmiş)", "Chinese (Simplified)", "cmn", "zh-CN", { ms: "zh-Hans", dl: "ZH-HANS", chars: "\\u4E00-\\u9FFF" }],
    ["zh-TW", "Çince (Geleneksel)", "Chinese (Traditional)", "cmn", "zh-TW", { ms: "zh-Hant", dl: "ZH-HANT", chars: "\\u4E00-\\u9FFF" }],
    ["ja", "Japonca", "Japanese", "jpn", "ja-JP", { chars: "\\u3040-\\u30FF" }],
    ["ko", "Korece", "Korean", "kor", "ko-KR", { chars: "\\uAC00-\\uD7AF\\u1100-\\u11FF" }],
    ["vi", "Vietnamca", "Vietnamese", "vie", "vi-VN", { dl: null, chars: "ăđơưĂĐƠƯạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ" }],
    ["th", "Tayca", "Thai", "tha", "th-TH", { dl: null, chars: "\\u0E00-\\u0E7F" }],
    ["id", "Endonezce", "Indonesian", "ind", "id-ID"],
    ["ms", "Malayca", "Malay", "zsm", "ms-MY", { dl: null }],
    ["la", "Latince", "Latin", "lat", "la", { dl: null }],
    ["eo", "Esperanto", "Esperanto", "epo", "eo", { dl: null, chars: "ĉĝĥĵŝŭĈĜĤĴŜŬ" }]
  ];

  const list = rows.map(([code, name, en, iso3, tts, x = {}]) => ({
    code, name, en, iso3, tts,
    ms: x.ms || code,
    dl: x.dl === null ? null : x.dl || code.toUpperCase(),
    chars: x.chars ? new RegExp("[" + x.chars + "]") : null
  }));
  const byCode = new Map(list.map((l) => [l.code.toLowerCase(), l]));

  // Services may spell the returned code differently ("zh-Hans", "ZH", "iw", "nb"): reduce it to the base code.
  const ALIAS = { iw: "he", jw: "jv", nb: "no", nn: "no", ckb: "ku", kmr: "ku" };
  function base(code) {
    const b = String(code || "").toLowerCase().split(/[-_]/)[0];
    return ALIAS[b] || b;
  }
  const get = (code) => byCode.get(String(code || "").toLowerCase()) || null;
  const same = (a, b) => !!a && !!b && base(a) === base(b);

  globalThis.RC_LANGS = {
    list,
    get,
    base,
    same,
    name: (code) => get(code)?.name || code,
    en: (code) => get(code)?.en || code,
    iso3: (code) => get(code)?.iso3 || "",
    tts: (code) => get(code)?.tts || code || "",
    // Does the text contain letters specific to this language? (for direction guessing; false if unknown)
    hints: (code, text) => !!get(code)?.chars?.test(text)
  };
})();
