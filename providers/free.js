import { isSentence } from "../prompt.js";
import "../shared/langs.js"; // globalThis.RC_LANGS
import { track, recordUsage } from "../usage.js";

// "Fast (free)": needs no key by default. The sources and their details are on the Settings page.
//  - Translation + parts of speech: Google Translate (unofficial endpoint or the user's own official API key),
//    if that fails DeepL and Microsoft (if a key was entered), and finally MyMemory
//  - Example sentences: Tatoeba (sentence pairs translated by real people). Since it can be slow, the translation
//    returns immediately and the examples are loaded separately (fetchExamples).
const L = globalThis.RC_LANGS;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const FREE_DEFAULTS = {
  google: { enabled: true, apiKey: "" },
  microsoft: { enabled: true, apiKey: "", region: "" },
  deepl: { enabled: true, apiKey: "" },
  mymemory: { enabled: true, email: "" },
  tatoeba: { enabled: true }
};

export function withSourceDefaults(sources = {}) {
  const out = {};
  for (const [k, d] of Object.entries(FREE_DEFAULTS)) out[k] = { ...d, ...(sources[k] || {}) };
  return out;
}

// --- Translation engines: all return { text, dict, detected } ---

// Google Translate, unofficial endpoint (no key): translation + parts of speech.
async function gtx(q, tl, sl = "auto") {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + sl + "&tl=" + tl +
    "&dt=t&dt=bd&q=" + encodeURIComponent(q);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Google Translate ${res.status}`);
  const d = await res.json();
  return {
    text: (d[0] || []).map((x) => x[0]).join(""),
    dict: Array.isArray(d[1]) ? d[1] : [],
    detected: typeof d[2] === "string" ? d[2] : ""
  };
}

// Google Cloud Translation v2, official API (the user's own key): gives no parts of speech.
async function googleOfficial(q, tl, sl, key) {
  const params = new URLSearchParams({ q, target: tl, format: "text", key });
  if (sl && sl !== "auto") params.set("source", sl);
  const res = await fetch("https://translation.googleapis.com/language/translate/v2?" + params, {
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`Google Cloud Translation ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const t = (await res.json()).data?.translations?.[0];
  if (!t) throw new Error("Google Cloud Translation boş yanıt");
  return { text: t.translatedText || "", dict: [], detected: t.detectedSourceLanguage || "" };
}

// MyMemory (backup): translation memory; the language pair must be given explicitly, no detection.
async function mymemory(q, tl, sl, email) {
  const params = new URLSearchParams({ q, langpair: `${sl}|${tl}` });
  if (email) params.set("de", email);
  const res = await fetch("https://api.mymemory.translated.net/get?" + params, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`MyMemory ${res.status}`);
  const j = await res.json();
  const text = j.responseData?.translatedText || "";
  if (!text || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(text)) throw new Error("MyMemory: günlük limit ya da boş yanıt");
  const alts = (j.matches || []).map((m) => m.translation).filter((t) => t && t.toLowerCase() !== text.toLowerCase());
  return { text, dict: alts.length ? [["", [...new Set(alts)].slice(0, 4)]] : [], detected: sl };
}

// Microsoft Translator (Azure, the user's own key; the F0 tier is free for 2M characters per month).
// Note: Edge's keyless endpoint (edge.microsoft.com/translate/auth) was shut down in 2026 (404).
async function microsoft(q, tl, sl, key, region) {
  const ms = (c) => L.get(c)?.ms || c;
  const params = new URLSearchParams({ to: ms(tl), "api-version": "3.0" });
  if (sl && sl !== "auto") params.set("from", ms(sl));
  const headers = { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": key };
  if (region) headers["Ocp-Apim-Subscription-Region"] = region;
  const res = await fetch("https://api.cognitive.microsofttranslator.com/translate?" + params, {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers,
    body: JSON.stringify([{ Text: q }])
  });
  if (!res.ok) throw new Error(`Microsoft Translator ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const d = (await res.json())[0];
  const text = d?.translations?.[0]?.text;
  if (!text) throw new Error("Microsoft Translator boş yanıt");
  return { text, dict: [], detected: d.detectedLanguage?.language || (sl !== "auto" ? sl : "") };
}

// DeepL API Free/Pro (the user's own key; a key ending in ":fx" goes to the Free endpoint).
async function deepl(q, tl, sl, key) {
  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const target = L.get(tl) ? L.get(tl).dl : tl.toUpperCase();
  if (!target) throw new Error(`DeepL ${L.name(tl)} dilini desteklemiyor`);
  const body = { text: [q], target_lang: target };
  // The source language takes no region suffix ("EN-US" → "EN", "ZH-HANS" → "ZH").
  if (sl && sl !== "auto") body.source_lang = (L.get(sl)?.dl || sl).split("-")[0].toUpperCase();
  const res = await fetch(host + "/v2/translate", {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json", Authorization: "DeepL-Auth-Key " + key },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}${res.status === 456 ? " (aylık kota doldu)" : ""}`);
  const t = (await res.json()).translations?.[0];
  if (!t?.text) throw new Error("DeepL boş yanıt");
  return { text: t.text, dict: [], detected: (t.detected_source_language || "").toLowerCase() };
}

// Tries the enabled sources in order: Google (official if there is a key), DeepL and Microsoft (if there is a key), MyMemory.
async function engine(q, tl, sl, src, guessSl) {
  const errs = [];
  if (src.google.enabled) {
    if (src.google.apiKey) {
      try {
        return await track("Google (resmi API)", q.length, () => googleOfficial(q, tl, sl, src.google.apiKey));
      } catch (e) {
        errs.push(e.message); // wrong key / quota exhausted: fall back to the keyless endpoint
      }
    }
    try {
      return await track("Google (gtx)", q.length, () => gtx(q, tl, sl));
    } catch (e) {
      errs.push(e.message);
    }
  }
  if (src.deepl.enabled && src.deepl.apiKey) {
    try {
      return await track("DeepL", q.length, () => deepl(q, tl, sl, src.deepl.apiKey));
    } catch (e) {
      errs.push(e.message);
    }
  }
  if (src.microsoft.enabled && src.microsoft.apiKey) {
    try {
      return await track("Microsoft Translator", q.length, () => microsoft(q, tl, sl, src.microsoft.apiKey, src.microsoft.region));
    } catch (e) {
      errs.push(e.message);
    }
  }
  if (src.mymemory.enabled) {
    try {
      return await track("MyMemory", q.length, () => mymemory(q, tl, sl === "auto" ? guessSl : sl, src.mymemory.email));
    } catch (e) {
      errs.push(e.message);
    }
  }
  throw new Error(errs.join(" · ") || "Tüm çeviri kaynakları kapalı (Ayarlar > Hızlı)");
}

// --- Example sentences: Tatoeba ---

// null on error / timeout (so it can be retried later), [] if there are no results.
async function tatoeba(q, from, to) {
  const f = L.iso3(from);
  const t = L.iso3(to);
  if (!f || !t || f === t) return [];
  const url =
    `https://tatoeba.org/en/api_v0/search?from=${f}&to=${t}&query=${encodeURIComponent(q)}` +
    "&orphans=no&unapproved=no&sort=relevance";
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      recordUsage("Tatoeba", { ok: false, chars: q.length, ms: Date.now() - t0 });
      return null;
    }
    const j = await res.json();
    const pairs = [];
    for (const r of j.results || []) {
      const tr = (r.translations || []).flat().find((x) => x.lang === t);
      if (r.text && tr?.text) pairs.push({ src: r.text, tgt: tr.text });
    }
    // Tatoeba matches fuzzily: keep only the sentences that really contain the searched phrase.
    recordUsage("Tatoeba", { chars: q.length, ms: Date.now() - t0 });
    const ql = q.toLowerCase();
    const relevant = pairs.filter((p) => p.src.toLowerCase().includes(ql));
    // Push very short ("Read books.") or very long sentences to the end; the order is preserved.
    const good = relevant.filter((p) => p.src.length >= 15 && p.src.length <= 100);
    const rest = relevant.filter((p) => !good.includes(p));
    return [...good, ...rest].slice(0, 5); // how many are shown is trimmed by Settings > maxExamples
  } catch {
    recordUsage("Tatoeba", { ok: false, chars: q.length, ms: Date.now() - t0 });
    return null;
  }
}

function highlight(pair, query, terms) {
  const src = pair.src.replace(new RegExp("(" + escapeRe(query) + ")", "ig"), "**$1**");
  let tgt = pair.tgt;
  const low = tgt.toLowerCase();
  const hit = [...terms].sort((a, b) => b.length - a.length).find((t) => t && low.includes(t.toLowerCase()));
  if (hit) tgt = tgt.replace(new RegExp("(" + escapeRe(hit) + ")", "i"), "**$1**");
  return { src, tgt };
}

// Translation + parts of speech (fast). needsExamples is set for the example sentences.
export async function free(query, langA, langB, cfg = {}) {
  const src = withSourceDefaults(cfg.sources);
  const other = (l) => (l === langB ? langA : langB);
  const sentence = isSentence(query);
  const same = (x) => x.text.trim().toLowerCase() === query.trim().toLowerCase();

  // If the text contains letters specific to B only (e.g. Turkish ğ, Cyrillic) the target is A, otherwise B.
  // If the detected language equals the target, the direction is flipped.
  let tl = L.hints(langB, query) && !L.hints(langA, query) ? langA : langB;
  let r = await engine(query, tl, "auto", src, other(tl));
  if (L.same(r.detected, tl)) {
    tl = other(tl);
    r = await engine(query, tl, "auto", src, other(tl));
  }
  // Map the service's code ("zh-Hans", "iw") to the code in the settings; a language other than A/B stays as is.
  let from = [langA, langB].find((l) => L.same(l, r.detected)) || r.detected;
  // Wrong detection on short words ("elma" or "Buch" taken for English and returned unchanged): ask again
  // with an explicit source language; first in the same direction (input in the other language), then reversed (input in the target language).
  if (same(r)) {
    for (const [s, t] of [[other(tl), tl], [tl, other(tl)]]) {
      if (L.same(s, r.detected)) continue; // already tried with this source language
      try {
        const r2 = await engine(query, t, s, src, s);
        if (!same(r2)) {
          r = r2;
          from = s;
          tl = t;
          break;
        }
      } catch {
        /* continue with the first result */
      }
    }
  }
  from = from && !L.same(from, tl) ? from : other(tl);
  const to = tl;

  const seen = new Set();
  const translations = [];
  const add = (raw, pos) => {
    const text = String(raw || "").trim();
    const k = text.toLowerCase();
    if (!text || seen.has(k)) return;
    seen.add(k);
    translations.push({ text, pos });
  };
  add(r.text, ""); // main translation first
  if (!sentence) {
    for (const e of r.dict) (e[1] || []).slice(0, 4).forEach((text) => add(text, e[0] || ""));
  }
  // If the main translation is also in the dictionary, carry its type (noun/verb) over to the main translation.
  const main = r.dict.find((e) => (e[1] || []).some((t) => t.toLowerCase() === r.text.toLowerCase()));
  if (main) translations[0].pos = main[0] || "";

  return {
    from,
    to,
    translations: translations.slice(0, 9),
    examples: [],
    notes: "",
    needsExamples: src.tatoeba.enabled && !sentence && query.length <= 40 && !!L.iso3(from) && !!L.iso3(to) && L.iso3(from) !== L.iso3(to)
  };
}

// Example sentences (can be slow): null = could not be fetched, [] = none found.
export async function fetchExamples(query, from, to, terms) {
  const pairs = await tatoeba(query, from, to);
  return pairs === null ? null : pairs.map((p) => highlight(p, query, terms));
}
