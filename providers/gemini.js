import { buildPrompt, parseModelJson } from "../prompt.js";
import { recordUsage } from "../usage.js";

// If the selected model is overloaded (503/429) or unavailable (404), these are tried in order.
const FALLBACK_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.5-flash-lite"];
const TRANSIENT = new Set([429, 500, 503]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callModel(model, key, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const init = {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
    })
  };
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(url, init);
    if (res.ok || !TRANSIENT.has(res.status)) break;
    await sleep(500);
  }
  return res;
}

export async function listGeminiModels(cfg) {
  if (!cfg.key) throw new Error("Gemini API key girilmemiş");
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    headers: { "x-goog-api-key": cfg.key }
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()).models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
}

export async function gemini(query, langA, langB, cfg) {
  if (!cfg.key) throw new Error("Gemini API key girilmemiş");
  const prompt = buildPrompt(query, langA, langB);
  const models = [cfg.model, ...FALLBACK_MODELS].filter((m, i, a) => m && a.indexOf(m) === i);

  let last = "";
  for (const model of models) {
    const t0 = Date.now();
    const res = await callModel(model, cfg.key, prompt);
    if (res.ok) {
      const data = await res.json();
      const u = data.usageMetadata;
      recordUsage(`Gemini · ${model}`, { inTok: u?.promptTokenCount, outTok: u?.candidatesTokenCount, ms: Date.now() - t0 });
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
      return parseModelJson(text);
    }
    recordUsage(`Gemini · ${model}`, { ok: false, ms: Date.now() - t0 });
    last = `Gemini ${res.status} (${model}): ${(await res.text()).slice(0, 160)}`;
    // An auth / request error (400, 401, 403) is not fixed by switching models.
    if (!TRANSIENT.has(res.status) && res.status !== 404) break;
  }
  throw new Error(last);
}
