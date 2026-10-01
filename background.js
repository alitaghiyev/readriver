import { translate, testProvider, listModels, benchModels, loadExamples } from "./providers/index.js";
import { getSettings } from "./settings.js";
import { fetchQuotas } from "./quota.js";
import "./shared/i18n.js"; // globalThis.RC_I18N
const t = (s, v) => RC_I18N.t(s, v);

const MENU_TITLE = "ReadRiver ile çevir: “%s”";
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "rc-translate", title: t(MENU_TITLE), contexts: ["selection"] });
  RC_I18N.ready.then(() => chrome.contextMenus.update("rc-translate", { title: t(MENU_TITLE) }).catch(() => {}));
});
// Update the menu title when the language preference changes (and when the service worker restarts).
RC_I18N.ready.then(() => chrome.contextMenus.update("rc-translate", { title: t(MENU_TITLE) }).catch(() => {}));
RC_I18N.onChange(() => chrome.contextMenus.update("rc-translate", { title: t(MENU_TITLE) }).catch(() => {}));

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "rc-translate" && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: "showCard", text: info.selectionText }).catch(() => {});
  }
});

// One-click mode is per tab; the state lives in each frame's content script. If "on" is not given, the top
// frame's state is toggled. The same value is sent to all frames (including videos/articles in iframes).
async function setTagMode(tabId, on) {
  if (typeof on !== "boolean") {
    const r = await chrome.tabs.sendMessage(tabId, { type: "rcTagMode" }, { frameId: 0 }).catch(() => null);
    if (!r) throw new Error(t("Eklenti bu sayfada çalışmıyor"));
    on = !r.on;
  }
  await chrome.tabs.sendMessage(tabId, { type: "rcTagMode", on }).catch(() => {});
  return { on };
}

chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === "toggle-tag-mode" && tab?.id != null) setTagMode(tab.id).catch(() => {});
});

// A saved word starts in Leitner box 1 and is due for review right away.
async function saveFavorite(entry) {
  const { favorites = [] } = await chrome.storage.local.get("favorites");
  const key = entry.query.toLowerCase();
  const old = favorites.find((f) => f.query.toLowerCase() === key);
  const rest = favorites.filter((f) => f.query.toLowerCase() !== key);
  const now = Date.now();
  await chrome.storage.local.set({
    favorites: [{ box: 1, due: now, ...old, ...entry, ts: now }, ...rest]
  });
}

const session = () => chrome.storage.session;

// For diagnostics: the last translation result (provider, duration or error).
async function recordLast(promise, query) {
  const t0 = Date.now();
  try {
    const r = await promise;
    await session().set({ last: { ok: true, provider: r.provider, cached: !!r.cached, ms: Date.now() - t0, query: query.slice(0, 40), ts: Date.now() } });
    return r;
  } catch (e) {
    await session().set({ last: { ok: false, error: e.message.slice(0, 300), ms: Date.now() - t0, query: query.slice(0, 40), ts: Date.now() } });
    throw e;
  }
}

// For diagnostics: reachability test of the fast sources from the service worker.
async function netTest() {
  const probes = [
    ["Google Translate", "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=tr&dt=t&q=hello"],
    ["Tatoeba", "https://tatoeba.org/en/api_v0/search?from=eng&to=tur&query=hello"],
    ["MyMemory", "https://api.mymemory.translated.net/get?q=hello&langpair=en|tr"]
  ];
  return Promise.all(
    probes.map(async ([name, url]) => {
      const t0 = Date.now();
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        return { name, ok: r.ok, status: r.status, ms: Date.now() - t0 };
      } catch (e) {
        return { name, ok: false, error: e.message, ms: Date.now() - t0 };
      }
    })
  );
}

async function noteHello(origin) {
  const { hello } = await session().get("hello");
  await session().set({ hello: { ts: Date.now(), origin, count: (hello?.count || 0) + 1 } });
}

// ---- Tab state: is the content script running on this page? ("!" badge on the icon + Reset in the popup) ----
// Common cause: the page was opened before the extension was reloaded/updated → the old script is "orphaned" and the card won't open.
const CS_FILES = chrome.runtime.getManifest().content_scripts[0].js;
chrome.action.setBadgeBackgroundColor({ color: "#d93025" }).catch(() => {});

// No extension can run scripts on browser pages and extension stores: don't show a warning.
const STORE = /^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com|microsoftedge\.microsoft\.com\/addons)/;
async function scriptable(url) {
  if (!url || STORE.test(url)) return false;
  if (/^https?:/.test(url)) return true;
  // file:// only when "Allow access to file URLs" is enabled in the extension's settings.
  return url.startsWith("file:") && (await chrome.extension.isAllowedFileSchemeAccess());
}

async function pingTab(tabId) {
  try {
    const r = await Promise.race([
      chrome.tabs.sendMessage(tabId, { type: "rcPing" }, { frameId: 0 }),
      new Promise((res) => setTimeout(res, 1500, null))
    ]);
    return !!r?.ok;
  } catch {
    return false;
  }
}

// "ok" | "broken" | "unsupported" | "loading"
async function tabHealth(tabId) {
  let tab;
  try { tab = await chrome.tabs.get(tabId); } catch { return "unsupported"; }
  if (!(await scriptable(tab.url))) return "unsupported";
  if (tab.status !== "complete") return "loading";
  if (await pingTab(tabId)) return "ok";
  await new Promise((r) => setTimeout(r, 700)); // the script (document_idle) may still be loading: ask once more
  return (await pingTab(tabId)) ? "ok" : "broken";
}

async function markTab(tabId) {
  const state = await tabHealth(tabId);
  if (state === "loading") return state;
  const broken = state === "broken";
  chrome.action.setBadgeText({ tabId, text: broken ? "!" : "" }).catch(() => {});
  chrome.action
    .setTitle({ tabId, title: broken ? t("ReadRiver bu sayfada çalışmıyor — tıklayıp “Sıfırla”ya bas") : "ReadRiver" })
    .catch(() => {});
  return state;
}

// Re-injects the script into the tab (the new copy removes the old one itself). Called from the popup: the activeTab permission is enough.
async function resetTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!(await scriptable(tab.url))) throw new Error(t("Bu sayfada eklentiler çalışamaz (tarayıcı sayfası ya da mağaza)."));
  // Inject frame by frame: if one is unreachable (common in Brave) the others are still reset (the video is usually in an iframe).
  let frames = [];
  try { frames = (await chrome.webNavigation.getAllFrames({ tabId })) || []; } catch {}
  const ids = frames.length ? frames.map((f) => f.frameId) : [0];
  const results = await Promise.allSettled(
    ids.map((frameId) => chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: CS_FILES }))
  );
  const done = results.filter((r) => r.status === "fulfilled").length;
  if (!done) throw new Error(results[0]?.reason?.message || t("Betik enjekte edilemedi."));
  // The script was injected even if the page is still loading (tab.status !== "complete"): check the ping directly, not tabHealth.
  let ok = false;
  for (let i = 0; i < 4 && !ok; i++) {
    if (i) await new Promise((r) => setTimeout(r, 300));
    ok = await pingTab(tabId);
  }
  chrome.action.setBadgeText({ tabId, text: ok ? "" : "!" }).catch(() => {});
  if (ok) chrome.action.setTitle({ tabId, title: "ReadRiver" }).catch(() => {});
  return { state: ok ? "ok" : "broken", frames: `${done}/${ids.length}` };
}

chrome.tabs.onActivated.addListener(({ tabId }) => markTab(tabId));
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "complete") setTimeout(() => markTab(tabId), 500);
});
// When the extension is reloaded/updated, the scripts in open tabs are orphaned: flag them all.
chrome.runtime.onInstalled.addListener(async () => {
  for (const t of await chrome.tabs.query({})) markTab(t.id);
});

const respond = (promise, sendResponse, pick = (x) => x) =>
  promise
    .then((v) => sendResponse({ ok: true, ...pick(v) }))
    .catch((e) => sendResponse({ ok: false, error: e.message }));

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg?.type) {
    case "translate":
      respond(recordLast(translate(msg.query, { llm: !!msg.llm }), msg.query), sendResponse, (result) => ({ result }));
      return true;
    case "examples":
      respond(loadExamples(msg.query), sendResponse, (r) => r);
      return true;
    case "save":
      respond(saveFavorite(msg.entry), sendResponse, () => ({}));
      return true;
    case "test":
      respond(testProvider(msg.cfg), sendResponse, (r) => r);
      return true;
    case "models":
      respond(listModels(msg.cfg), sendResponse, (r) => r);
      return true;
    case "quota":
      getSettings().then(fetchQuotas).then((quotas) => sendResponse({ ok: true, quotas })).catch((e) => sendResponse({ ok: false, error: e.message }));
      return true;
    case "bench":
      respond(benchModels(msg.cfg, msg.models || []), sendResponse, (results) => ({ results }));
      return true;
    case "ping":
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
      return;
    case "hello":
      noteHello(msg.origin);
      return;
    case "nettest":
      respond(netTest(), sendResponse, (results) => ({ results }));
      return true;
    case "tabHealth":
      respond(markTab(msg.tabId).then((state) => ({ state })), sendResponse);
      return true;
    case "tagMode":
      respond(setTagMode(msg.tabId, msg.on), sendResponse);
      return true;
    case "resetTab":
      respond(resetTab(msg.tabId), sendResponse);
      return true;
    case "diag":
      session().get(["hello", "last"]).then((d) => sendResponse({ ok: true, ...d }));
      return true;
  }
});
