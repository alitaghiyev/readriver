import { buildPrompt, parseModelJson } from "../prompt.js";
import { recordUsage, recordLimits } from "../usage.js";

function headersFor(cfg) {
  const h = { "Content-Type": "application/json" };
  if (cfg.key) h.Authorization = `Bearer ${cfg.key}`;
  return h;
}

const base = (cfg) => cfg.baseUrl.replace(/\/+$/, "");

// Main model + backups (Settings > "Backup models"), deduplicated and in order.
export const modelChain = (cfg) => [...new Set([cfg.model, ...(cfg.fallbacks || [])].map((m) => String(m || "").trim()).filter(Boolean))];

async function complete(cfg, model, content, timeout, count = true) {
  const t0 = Date.now();
  const src = `${cfg.name || "OpenAI uyumlu"} · ${model}`;
  let ok = false;
  let usage;
  try {
    const res = await fetch(base(cfg) + "/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(timeout), // so an unresponsive model doesn't block the chain
      headers: headersFor(cfg),
      body: JSON.stringify({ model, temperature: 0.2, stream: false, messages: [{ role: "user", content }] })
    });
    if (count) recordLimits(src, res.headers); // show the remaining limit on a 429 too
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
    const data = await res.json();
    usage = data.usage;
    ok = true;
    return data.choices?.[0]?.message?.content || "";
  } finally {
    if (count) recordUsage(src, { ok, inTok: usage?.prompt_tokens, outTok: usage?.completion_tokens, ms: Date.now() - t0 });
  }
}

// For OmniRoute, OpenRouter and other OpenAI-compatible endpoints. If the model fails, the next backup is tried.
export async function openaiCompat(query, langA, langB, cfg) {
  if (!cfg.baseUrl) throw new Error("OpenAI uyumlu endpoint girilmemiş");
  const chain = modelChain(cfg);
  if (!chain.length) throw new Error("Model adı girilmemiş");
  const prompt = buildPrompt(query, langA, langB);
  const errs = [];
  for (const [i, model] of chain.entries()) {
    try {
      const r = parseModelJson(await complete(cfg, model, prompt, i ? 20000 : 30000));
      return i ? { ...r, fallbackModel: model } : r; // so the card shows which backup answered
    } catch (e) {
      errs.push(`${model}: ${e.name === "TimeoutError" ? "zaman aşımı" : e.message}`);
    }
  }
  throw new Error(errs.join(" · "));
}

// Speed test: a very short request to a single model; the duration is measured (no JSON parsing expected).
export async function pingModel(cfg, model, timeout = 15000) {
  const t0 = Date.now();
  const text = await complete(cfg, model, 'Translate to Turkish, reply with one word only: "book"', timeout, false); // speed tests are not counted
  if (!text.trim()) throw new Error("boş yanıt");
  return { ms: Date.now() - t0, sample: text.trim().slice(0, 40) };
}

// GET /v1/models: model ids. OmniRoute also returns its combos in the same list with owned_by:"combo"
// (built-in automatic combos such as auto, auto/fast along with your own combos).
export async function listModels(cfg) {
  if (!cfg.baseUrl) throw new Error("Base URL girilmemiş");
  const res = await fetch(base(cfg) + "/models", { headers: headersFor(cfg), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.data || [])
    .filter((m) => m?.id)
    .map((m) => ({
      id: String(m.id),
      combo: m.owned_by === "combo",
      label: typeof m.display_name === "string" ? m.display_name : "",
      desc: typeof m.description === "string" ? m.description : ""
    }));
}

// Contents of OmniRoute combos (strategy + models). /api/combos needs management permission (a key with
// the "manage" scope); a normal chat key gets 401/403, in which case only the names are shown.
export async function listCombos(cfg) {
  let origin;
  try { origin = new URL(cfg.baseUrl).origin; } catch { return { combos: {}, note: "" }; }
  try {
    const res = await fetch(origin + "/api/combos", { headers: headersFor(cfg), signal: AbortSignal.timeout(8000) });
    if (res.status === 401 || res.status === 403) {
      return { combos: {}, note: "Kombo içeriğini (hangi modeller, hangi sırayla) görmek için OmniRoute'ta “manage” yetkili bir anahtar gerekir; çeviri için normal anahtar yeterli." };
    }
    if (!res.ok) return { combos: {}, note: "" };
    const j = await res.json();
    const out = {};
    for (const c of j.combos || []) {
      if (!c?.name) continue;
      const models = (c.models || c.steps || [])
        .map((m) => (typeof m === "string" ? m : m?.model || m?.modelStr || m?.combo || m?.name || ""))
        .filter(Boolean);
      out[c.name] = { strategy: c.strategy || "", models };
    }
    return { combos: out, note: "" };
  } catch {
    return { combos: {}, note: "" }; // not OmniRoute or no such endpoint: skip silently
  }
}
