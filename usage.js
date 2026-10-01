// Usage counter (numbers only; no text or keys are kept). chrome.storage.local.usage:
//   { "YYYY-MM-DD": { "<source>": { req, err, chars, inTok, outTok, ms } } } — the last KEEP_DAYS days.
// These values are counted by the extension itself; the provider's real quota/bill may differ.
export const CACHE_KEY = "önbellek"; // requests served from the cache (that never reached the source)
const KEEP_DAYS = 90;

const dayOf = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; // local day
};

let queue = Promise.resolve(); // avoid a read-modify-write race (concurrent requests)

export function recordUsage(source, { ok = true, chars = 0, inTok, outTok, ms = 0 } = {}) {
  queue = queue.then(async () => {
    try {
      const { usage = {} } = await chrome.storage.local.get("usage");
      const day = (usage[dayOf()] ||= {});
      const e = (day[source] ||= { req: 0, err: 0, chars: 0, inTok: 0, outTok: 0, ms: 0 });
      e.req++;
      if (!ok) e.err++;
      e.chars += chars;
      e.inTok += Number(inTok) || 0;
      e.outTok += Number(outTok) || 0;
      e.ms += ms;
      const days = Object.keys(usage).sort();
      for (const d of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) delete usage[d];
      await chrome.storage.local.set({ usage });
    } catch (_) {
      /* a counter error must not break the translation */
    }
  });
  return queue;
}

// Stores the response's limit headers (x-ratelimit-*, ratelimit-*, anthropic-ratelimit-*) as the latest value per source.
const LIMIT_RE = /^(x-ratelimit-|ratelimit-|anthropic-ratelimit-)/i;
export function recordLimits(source, headers) {
  const h = {};
  try {
    for (const [k, v] of headers.entries()) if (LIMIT_RE.test(k)) h[k.toLowerCase()] = String(v).slice(0, 80);
  } catch (_) {
    return queue;
  }
  if (!Object.keys(h).length) return queue;
  queue = queue.then(async () => {
    try {
      const { limits = {} } = await chrome.storage.local.get("limits");
      limits[source] = { ts: Date.now(), h };
      await chrome.storage.local.set({ limits });
    } catch (_) {
      /* a counter error must not break the translation */
    }
  });
  return queue;
}

// Runs fn and counts the duration and the result. pick(r) → { inTok, outTok } can be given to extract tokens from fn's result.
export async function track(source, chars, fn, pick) {
  const t0 = Date.now();
  try {
    const r = await fn();
    recordUsage(source, { ok: true, chars, ms: Date.now() - t0, ...(pick ? pick(r) : {}) });
    return r;
  } catch (e) {
    recordUsage(source, { ok: false, chars, ms: Date.now() - t0 });
    throw e;
  }
}
