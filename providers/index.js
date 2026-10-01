import { getSettings } from "../settings.js";
import { cacheGet, cacheSet } from "../cache.js";
import { recordUsage, CACHE_KEY } from "../usage.js";
import { free, fetchExamples } from "./free.js";
import { gemini, listGeminiModels } from "./gemini.js";
import { openaiCompat, listModels as listOpenAIModels, listCombos, pingModel } from "./openai-compat.js";
import { anthropic, listAnthropicModels } from "./anthropic.js";

const RUN = {
  free: (q, a, b, cfg) => free(q, a, b, cfg),
  gemini: (q, a, b, cfg) => gemini(q, a, b, cfg),
  openai: (q, a, b, cfg) => openaiCompat(q, a, b, cfg),
  anthropic: (q, a, b, cfg) => anthropic(q, a, b, cfg)
};
const LIST = { gemini: listGeminiModels, openai: listOpenAIModels, anthropic: listAnthropicModels };

// A provider that is disabled or missing settings is skipped without counting as an error.
const configured = (p) =>
  p.enabled !== false &&
  (p.type === "free" ||
    (p.type === "openai" ? !!(p.baseUrl && p.model) : p.type === "gemini" ? !!p.key : !!(p.key && p.model)));

const pendingFree = new Map(); // fast results whose example sentences haven't loaded yet (so it works with the cache off too)
const memoKey = (q) => q.trim().toLowerCase().replace(/\s+/g, " ");

// opts.llm: skip the fast (free) provider and try only the LLMs ("Elaborate with LLM").
export async function translate(query, opts = {}) {
  query = String(query || "").trim();
  if (!query) throw new Error("Boş sorgu");
  if (query.length > 1000) throw new Error("Metin çok uzun (en fazla 1000 karakter)");

  const s = await getSettings();
  const tag = opts.llm ? "llm" : "";
  const cacheOpts = { enabled: s.prefs.cacheEnabled, max: s.prefs.cacheMax };
  // If it was elaborated with an LLM before, the fast lookup returns that result too (no new request).
  const cached =
    (!opts.llm && (await cacheGet(s.langA, s.langB, query, "llm", cacheOpts.enabled))) ||
    (await cacheGet(s.langA, s.langB, query, tag, cacheOpts.enabled));
  if (cached) {
    recordUsage(CACHE_KEY, { chars: query.length });
    return { ...cached, cached: true };
  }

  const errors = [];
  for (const p of s.providers) {
    const run = RUN[p.type];
    if (!run || !configured(p)) continue;
    if (opts.llm && p.type === "free") continue;
    try {
      const r = await run(query, s.langA, s.langB, p);
      if (!r.translations.length) throw new Error("Boş sonuç");
      const { fallbackModel, ...rest } = r;
      const label = (p.name || p.type) + (fallbackModel ? ` · ${fallbackModel} (yedek)` : "");
      const result = { query, provider: label, free: p.type === "free", ...rest };
      await cacheSet(s.langA, s.langB, query, result, tag, cacheOpts);
      // So the example sentences can be merged into this result even with the cache off (in memory only, short-lived).
      if (p.type === "free" && !opts.llm) {
        pendingFree.set(memoKey(query), result);
        if (pendingFree.size > 50) pendingFree.delete(pendingFree.keys().next().value);
      }
      return result;
    } catch (e) {
      errors.push(`${p.name || p.type}: ${e.message}`);
    }
  }
  throw new Error(errors.length ? errors.join("\n") : "Hiçbir sağlayıcı ayarlanmamış (Ayarlar sayfasını aç)");
}

// Example sentences of the fast provider: requested separately after the translation is shown and merged into the cached result.
export async function loadExamples(query) {
  query = String(query || "").trim();
  const s = await getSettings();
  const cacheOpts = { enabled: s.prefs.cacheEnabled, max: s.prefs.cacheMax };
  const cached = pendingFree.get(memoKey(query)) || (await cacheGet(s.langA, s.langB, query, "", cacheOpts.enabled));
  if (!cached?.free) return { examples: [] };
  if (!cached.needsExamples) return { examples: cached.examples };
  const examples = await fetchExamples(cached.query, cached.from, cached.to, cached.translations.map((t) => t.text));
  if (examples === null) return { examples: [], failed: true }; // don't cache it, so it can be retried later
  const done = { ...cached, examples, needsExamples: false };
  pendingFree.set(memoKey(query), done);
  await cacheSet(s.langA, s.langB, query, done, "", cacheOpts);
  return { examples };
}

// "Test" on the Settings page: uses the values in the form, not the saved settings; doesn't use the cache.
export async function testProvider(cfg) {
  const run = RUN[cfg.type];
  if (!run) throw new Error("Bilinmeyen sağlayıcı türü");
  const t0 = Date.now();
  const r = await run("hello", "en", "tr", cfg);
  return { ms: Date.now() - t0, sample: r.translations[0]?.text || "" };
}

// { models: [{ id, combo, label, desc }], combos: { name: { strategy, models } }, note }
export async function listModels(cfg) {
  const list = LIST[cfg.type];
  if (!list) throw new Error("Bu sağlayıcı türünde model listesi yok");
  const models = (await list(cfg))
    .map((m) => (typeof m === "string" ? { id: m, combo: false, label: "", desc: "" } : m))
    .sort((a, b) => a.id.localeCompare(b.id));
  // If there are OmniRoute combos, try to get their contents too (without permission only the names remain).
  const extra = cfg.type === "openai" && models.some((m) => m.combo) ? await listCombos(cfg) : { combos: {}, note: "" };
  return { models, ...extra };
}

// Speed test: sends a short request to the given models (at most 4 at a time) and sorts by duration.
export async function benchModels(cfg, models) {
  if (cfg.type !== "openai") throw new Error("Hız testi yalnızca OpenAI uyumlu sağlayıcılarda var");
  const queue = [...new Set(models)].slice(0, 20);
  const out = [];
  const worker = async () => {
    for (let m = queue.shift(); m; m = queue.shift()) {
      try {
        out.push({ model: m, ok: true, ...(await pingModel(cfg, m)) });
      } catch (e) {
        out.push({ model: m, ok: false, error: e.name === "TimeoutError" ? "zaman aşımı (15 sn)" : e.message.slice(0, 80) });
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return out.sort((a, b) => (a.ok === b.ok ? (a.ms || 0) - (b.ms || 0) : a.ok ? -1 : 1));
}
