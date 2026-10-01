// Persistent translation cache (chrome.storage.local). Can be turned off and size-limited in the settings.
// tag: "" (fast/normal) or "llm": keeps an LLM result from being overwritten by a fast result.
const keyOf = (a, b, q, tag = "") => `${tag}|${a}|${b}|${q.trim().toLowerCase().replace(/\s+/g, " ")}`;

export async function cacheGet(a, b, q, tag, enabled = true) {
  if (!enabled) return null;
  const { cache = {} } = await chrome.storage.local.get("cache");
  return cache[keyOf(a, b, q, tag)]?.result || null;
}

export async function cacheSet(a, b, q, result, tag, { enabled = true, max = 500 } = {}) {
  if (!enabled) return;
  const { cache = {} } = await chrome.storage.local.get("cache");
  cache[keyOf(a, b, q, tag)] = { ts: Date.now(), result };
  const keys = Object.keys(cache);
  if (keys.length > max) {
    keys.sort((x, y) => cache[x].ts - cache[y].ts);
    for (const k of keys.slice(0, keys.length - max)) delete cache[k];
  }
  await chrome.storage.local.set({ cache });
}
