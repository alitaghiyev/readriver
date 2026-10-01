// Quota / balance query: only the values reported by the provider itself (real numbers).
//  - DeepL:      GET /v2/usage           → character usage / monthly limit
//  - OpenRouter: GET /api/v1/key         → usage ($), limit, remaining
//  - DeepSeek:   GET /user/balance       → balance
// The others (Groq, Cerebras, OpenAI, Anthropic …) have no quota endpoint; the x-ratelimit-* headers of each response
// are stored with recordLimits() (usage.js) and shown in Settings as the "last seen limit".
// The query only runs when the user presses the button; keys are sent only to their own provider.
import { withSourceDefaults } from "./providers/free.js";

const T = 10000;
const fmt = (n, d = 2) => (Number.isFinite(+n) ? (+n).toLocaleString("en-US", { maximumFractionDigits: d }) : String(n));
const pct = (used, total) => (total > 0 ? ` (%${Math.round((used / total) * 100)})` : "");
const host = (p) => { try { return new URL(p.baseUrl).hostname; } catch { return ""; } };

async function getJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(T) });
  if (res.status === 401 || res.status === 403) throw new Error(`${res.status}: anahtar geçersiz ya da bu bilgiyi görme yetkisi yok`);
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

async function deeplQuota(key) {
  const base = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const d = await getJson(base + "/v2/usage", { Authorization: "DeepL-Auth-Key " + key });
  const used = d.character_count, total = d.character_limit;
  const rows = [["Kullanılan", `${fmt(used, 0)} / ${fmt(total, 0)} karakter${pct(used, total)}`]];
  if (total > 0) rows.push(["Kalan", `${fmt(Math.max(0, total - used), 0)} karakter`]);
  return rows;
}

async function openrouterQuota(key) {
  const d = (await getJson("https://openrouter.ai/api/v1/key", { Authorization: "Bearer " + key })).data || {};
  const rows = [["Kullanılan", `$${fmt(d.usage)}`]];
  if (d.usage_daily != null) rows.push(["Bugün", `$${fmt(d.usage_daily)}`]);
  if (d.limit != null) {
    rows.push(["Limit", `$${fmt(d.limit)}`]);
    rows.push(["Kalan", `$${fmt(d.limit_remaining ?? d.limit - d.usage)}`]);
  }
  rows.push(["Plan", d.is_free_tier ? "Ücretsiz katman (hiç kredi yüklenmemiş)" : "Kredi yüklenmiş"]);
  return rows;
}

async function deepseekQuota(key) {
  const d = await getJson("https://api.deepseek.com/user/balance", { Authorization: "Bearer " + key });
  const rows = (d.balance_infos || []).map((b) => [
    "Bakiye",
    `${fmt(b.total_balance)} ${b.currency} (yüklenen ${fmt(b.topped_up_balance)}, hediye ${fmt(b.granted_balance)})`
  ]);
  if (d.is_available === false) rows.push(["Durum", "Bakiye yetersiz, istekler reddedilebilir"]);
  return rows.length ? rows : [["Bakiye", "–"]];
}

// [{ name, rows: [[label, value]], error? }] — an empty array if no provider can be queried.
export async function fetchQuotas(settings) {
  const jobs = [];
  for (const p of settings.providers || []) {
    if (p.enabled === false) continue;
    if (p.type === "free") {
      const key = withSourceDefaults(p.sources).deepl.apiKey;
      if (key) jobs.push({ name: "DeepL", run: () => deeplQuota(key) });
    } else if (p.type === "openai" && p.key) {
      const h = host(p);
      if (h === "openrouter.ai") jobs.push({ name: p.name || "OpenRouter", run: () => openrouterQuota(p.key) });
      else if (h === "api.deepseek.com") jobs.push({ name: p.name || "DeepSeek", run: () => deepseekQuota(p.key) });
    }
  }
  return Promise.all(
    jobs.map(async (j) => {
      try {
        return { name: j.name, rows: await j.run() };
      } catch (e) {
        return { name: j.name, rows: [], error: e.name === "TimeoutError" ? "zaman aşımı" : e.message };
      }
    })
  );
}
