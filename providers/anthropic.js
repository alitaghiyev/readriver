import { buildPrompt, parseModelJson } from "../prompt.js";
import { recordUsage, recordLimits } from "../usage.js";

const BASE = "https://api.anthropic.com/v1";

const headersFor = (cfg) => ({
  "Content-Type": "application/json",
  "x-api-key": cfg.key,
  "anthropic-version": "2023-06-01"
});

// Claude (Anthropic Messages API).
export async function anthropic(query, langA, langB, cfg) {
  if (!cfg.key) throw new Error("Claude API key girilmemiş");
  if (!cfg.model) throw new Error("Model adı girilmemiş");
  const prompt = buildPrompt(query, langA, langB);
  const t0 = Date.now();
  const src = `Claude · ${cfg.model}`;
  const res = await fetch(`${BASE}/messages`, {
    method: "POST",
    headers: headersFor(cfg),
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1024,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    })
  });
  recordLimits(src, res.headers);
  if (!res.ok) {
    recordUsage(src, { ok: false, ms: Date.now() - t0 });
    throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  recordUsage(src, { inTok: data.usage?.input_tokens, outTok: data.usage?.output_tokens, ms: Date.now() - t0 });
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return parseModelJson(text);
}

export async function listAnthropicModels(cfg) {
  if (!cfg.key) throw new Error("Claude API key girilmemiş");
  const res = await fetch(`${BASE}/models?limit=100`, { headers: headersFor(cfg) });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()).data || []).map((m) => m.id);
}
