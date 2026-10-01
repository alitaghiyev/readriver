// User preferences: defaults + validation. Shared by classic scripts (content script, popup) and ES modules
// (settings.js, options); that is why it writes to globalThis.RC_PREFS.
(() => {
  const defaults = {
    uiLang: "auto", // UI language: auto (browser language) | tr | en
    // Triggers
    selectMode: "button", // button: small R button | auto: translate automatically on selection | off: disabled
    autoDelay: 500, // ms; wait after the selection is released in "auto" mode (no translation if the selection changes meanwhile)
    dblclick: true,
    dblDelay: 0, // ms; wait after a double-click (avoids a wrong translation while triple-clicking to select a paragraph)
    tagDelay: 250, // ms; wait before the label opens in one-click mode (a second click within this time means a double-click)
    tagColor: "#fbbf24", // highlight color of the word under the mouse in one-click mode
    tagFontSize: 12, // px; size of the translation in the label (shrinks in "fit" if the gap is tight)
    tagLayout: "fit", // fit: fit between the lines | expand: open space between the lines | overlay: draw over the line above
    tagBg: "#1a73e8", // label background
    tagFg: "#ffffff", // label text
    modifier: "none", // none | alt | ctrl | shift: this key must be held for selection and double-click
    minChars: 2,
    maxChars: 300,
    ignoreEditable: true, // don't run in text fields
    ignoreNonLetters: true, // ignore selections without letters
    blockedSites: "", // the extension is disabled on these sites (domains separated by lines/commas)
    // Subtitles
    subtitleHover: true,
    hoverDelay: 300,
    leaveDelay: 450,
    pauseOnHover: true,
    nativeSubs: true,
    subFontScale: 1,
    subOpacity: 72, // background opacity of the native subtitle overlay (%)
    // Appearance
    theme: "auto", // auto | light | dark
    accent: "#1a73e8",
    fontSize: 14,
    cardWidth: 340,
    maxExamples: 3,
    autoSpeak: false,
    // Cache
    cacheEnabled: true,
    cacheMax: 500
  };

  const limits = {
    autoDelay: [0, 2000], dblDelay: [0, 1000], tagDelay: [0, 600], tagFontSize: [8, 20], minChars: [1, 20], maxChars: [20, 1000],
    hoverDelay: [100, 1500], leaveDelay: [100, 2000], subFontScale: [0.6, 2], subOpacity: [0, 100],
    fontSize: [11, 20], cardWidth: [280, 560], maxExamples: [1, 5], cacheMax: [50, 5000]
  };
  const enums = {
    selectMode: ["button", "auto", "off"],
    modifier: ["none", "alt", "ctrl", "shift"],
    tagLayout: ["fit", "expand", "overlay"],
    theme: ["auto", "light", "dark"],
    uiLang: ["auto", "tr", "en"]
  };

  function resolve(settings) {
    const s = settings || {};
    const stored = s.prefs || {};
    const p = { ...defaults, ...stored };
    // v0.3 and earlier: preferences were flat keys at the root of settings.
    for (const k of ["dblclick", "subtitleHover", "pauseOnHover", "nativeSubs"]) {
      if (stored[k] === undefined && s[k] !== undefined) p[k] = s[k];
    }
    for (const [k, [lo, hi]] of Object.entries(limits)) {
      const n = Number(p[k]);
      p[k] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : defaults[k];
    }
    for (const [k, list] of Object.entries(enums)) if (!list.includes(p[k])) p[k] = defaults[k];
    for (const k of Object.keys(defaults)) if (typeof defaults[k] === "boolean") p[k] = !!p[k];
    for (const k of ["accent", "tagColor", "tagBg", "tagFg"]) {
      if (!/^#[0-9a-f]{6}$/i.test(String(p[k]))) p[k] = defaults[k];
    }
    p.blockedSites = String(p.blockedSites || "");
    return p;
  }

  // "a.com, b.org" → host match (including subdomains).
  function siteBlocked(list, hostname) {
    const host = String(hostname || "").toLowerCase();
    return String(list || "")
      .split(/[\s,;]+/)
      .map((h) => h.trim().toLowerCase().replace(/^\*?\./, ""))
      .filter(Boolean)
      .some((h) => host === h || host.endsWith("." + h));
  }

  globalThis.RC_PREFS = { defaults, limits, enums, resolve, siteBlocked };
})();
