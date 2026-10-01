import "./shared/prefs.js"; // globalThis.RC_PREFS

// Optional local defaults: git-ignored local-config.json (see local-config.example.json).
// Fetched instead of imported so a missing file doesn't break the service worker.
let LOCAL = {};
let localLoad;
function loadLocal() {
  return (localLoad ||= fetch(chrome.runtime.getURL("local-config.json"))
    .then((r) => r.json())
    .then((j) => { LOCAL = j || {}; })
    .catch(() => {}));
}

// Provider types: "openai" (OpenAI-compatible: OpenAI, OpenRouter, OmniRoute, Groq…), "gemini", "anthropic" (Claude).
export const PRESETS = {
  free: { name: "Hızlı (ücretsiz)", type: "free", baseUrl: "", model: "" },
  omniroute: { name: "OmniRoute", type: "openai", baseUrl: "http://localhost:20128/v1", model: "" },
  openai: { name: "OpenAI", type: "openai", baseUrl: "https://api.openai.com/v1", model: "" },
  openrouter: { name: "OpenRouter", type: "openai", baseUrl: "https://openrouter.ai/api/v1", model: "" },
  groq: { name: "Groq", type: "openai", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  nvidia: { name: "NVIDIA", type: "openai", baseUrl: "https://integrate.api.nvidia.com/v1", model: "meta/muse-glimmer-30b" },
  cerebras: { name: "Cerebras", type: "openai", baseUrl: "https://api.cerebras.ai/v1", model: "llama3.1-8b" },
  mistral: { name: "Mistral", type: "openai", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
  github: { name: "GitHub Models", type: "openai", baseUrl: "https://models.github.ai/inference", model: "openai/gpt-4.1-mini" },
  sambanova: { name: "SambaNova", type: "openai", baseUrl: "https://api.sambanova.ai/v1", model: "Meta-Llama-3.3-70B-Instruct" },
  huggingface: { name: "Hugging Face", type: "openai", baseUrl: "https://router.huggingface.co/v1", model: "meta-llama/Llama-3.3-70B-Instruct" },
  cloudflare: { name: "Cloudflare Workers AI", type: "openai", baseUrl: "https://api.cloudflare.com/client/v4/accounts/HESAP_ID/ai/v1", model: "@cf/meta/llama-3.1-8b-instruct" },
  deepseek: { name: "DeepSeek", type: "openai", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  together: { name: "Together AI", type: "openai", baseUrl: "https://api.together.xyz/v1", model: "" },
  ollama: { name: "Ollama (yerel)", type: "openai", baseUrl: "http://localhost:11434/v1", model: "" },
  lmstudio: { name: "LM Studio (yerel)", type: "openai", baseUrl: "http://localhost:1234/v1", model: "" },
  claude: { name: "Claude", type: "anthropic", baseUrl: "", model: "claude-haiku-4-5-20251001" },
  gemini: { name: "Gemini", type: "gemini", baseUrl: "", model: "gemini-flash-lite-latest" },
  custom: { name: "Özel", type: "openai", baseUrl: "", model: "" }
};

export const newId = () => "p" + Math.random().toString(36).slice(2, 9);

export function makeProvider(presetKey, extra = {}) {
  return { id: newId(), key: "", enabled: true, preset: presetKey, ...PRESETS[presetKey], ...extra };
}

function nvidiaSeed() {
  return makeProvider("nvidia", { id: "seed-nvidia", key: LOCAL.nvidia?.key || "", model: LOCAL.nvidia?.model || PRESETS.nvidia.model });
}

const freeSeed = () => makeProvider("free", { id: "seed-free" });

function defaultProviders() {
  return [
    freeSeed(),
    makeProvider("omniroute", { ...LOCAL.openai, baseUrl: LOCAL.openai?.baseUrl || "" }),
    makeProvider("gemini", { key: LOCAL.gemini?.key || "", model: LOCAL.gemini?.model || "gemini-flash-lite-latest" }),
    ...(LOCAL.nvidia?.key ? [nvidiaSeed()] : [])
  ];
}

// A provider added to local-config later is also added once to previously saved settings.
// If the user deletes it and saves (seedsApplied), it doesn't come back.
function withLateSeeds(providers, s) {
  const applied = s.seedsApplied || [];
  let out = providers;
  // The fast (free) provider goes first: LLMs are slow, so they stay as backups.
  if (!out.some((p) => p.type === "free") && !applied.includes("seed-free")) out = [freeSeed(), ...out];
  const hasNvidia = out.some((p) => (p.baseUrl || "").includes("integrate.api.nvidia.com"));
  if (LOCAL.nvidia?.key && !hasNvidia && !applied.includes("seed-nvidia")) out = [...out, nvidiaSeed()];
  return out;
}

// In the old version the settings were {chain, openai, gemini}; converted once to the new list.
function migrate(s) {
  const legacy = [];
  const byName = { openai: s.openai, gemini: s.gemini };
  for (const name of s.chain || ["openai", "gemini"]) {
    const c = byName[name];
    if (!c) continue;
    legacy.push(
      name === "gemini"
        ? makeProvider("gemini", { key: c.key || "", model: c.model || "gemini-flash-lite-latest" })
        : makeProvider("omniroute", { baseUrl: c.baseUrl || "", key: c.key || "", model: c.model || "" })
    );
  }
  return legacy;
}

export async function getSettings() {
  await loadLocal();
  const { settings } = await chrome.storage.local.get("settings");
  const s = settings || {};
  const providers = Array.isArray(s.providers)
    ? s.providers
    : s.openai || s.gemini
      ? migrate(s)
      : defaultProviders();
  return {
    langA: s.langA || "en",
    langB: s.langB || "tr",
    prefs: globalThis.RC_PREFS.resolve(s),
    providers: withLateSeeds(providers, s)
  };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings: { ...settings, seedsApplied: ["seed-nvidia", "seed-free"] } });
}
