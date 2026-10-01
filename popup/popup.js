const out = document.getElementById("out");
const t = (s, v) => RC_I18N.t(s, v);

// Preferences from Settings (theme, accent color, font size, example count, read aloud).
let prefs = RC_PREFS.resolve({});
function applyPrefs(settings) {
  prefs = RC_PREFS.resolve(settings);
  RC.applyAppearance(document.documentElement, prefs);
  out.style.zoom = String(prefs.fontSize / 14);
}
chrome.storage.local.get("settings").then((r) => applyPrefs(r.settings)).catch(() => {});
chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.settings) applyPrefs(c.settings.newValue); });
const input = document.getElementById("q");
const tabs = document.querySelectorAll(".tabs button");

const DAY = 24 * 60 * 60 * 1000;
const INTERVALS = [0, 0, 1, 3, 7, 14, 30]; // days; index = Leitner box
const MAX_BOX = INTERVALS.length - 1;

function setTab(name) {
  tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  if (name === "history") renderHistory();
  else if (name === "saved") renderSaved();
  else if (name === "review") renderReview();
  else out.replaceChildren();
}
tabs.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

async function search(query, llm = false) {
  query = query.trim();
  if (!query) return;
  setTab("search");
  input.value = query;
  RC.loading(out, query);
  const resp = await RC.translate(query, { llm });
  if (!resp.ok) return RC.error(out, resp.error);
  RC.result(out, resp.result, {
    onSave: (entry) => chrome.runtime.sendMessage({ type: "save", entry }),
    onMore: () => search(query, true),
    maxExamples: prefs.maxExamples,
    autoSpeak: prefs.autoSpeak && !llm
  });
}

document.getElementById("form").addEventListener("submit", (e) => {
  e.preventDefault();
  search(input.value);
});

// ---- Is the extension running in this tab? If not, warning + Reset (same check as the "!" badge on the icon) ----
const health = document.getElementById("health");

function showHealth(text, button, ok = false) {
  const t = document.createElement("span");
  t.className = "health-text";
  t.textContent = text;
  health.replaceChildren(t, ...(button ? [button] : []));
  health.classList.toggle("ok", ok);
  health.hidden = false;
}

function healthButton(label, onClick) {
  const b = document.createElement("button");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

async function checkHealth() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const r = await chrome.runtime.sendMessage({ type: "tabHealth", tabId: tab.id }).catch(() => null);
  if (r?.state !== "broken") return;

  const reload = () => {
    chrome.tabs.reload(tab.id);
    window.close();
  };
  const reset = healthButton(t("Sıfırla"), async () => {
    reset.disabled = true;
    reset.textContent = t("Sıfırlanıyor…");
    // activeTab only covers the top page's origin; the video is usually in a cross-origin iframe (e.g. videoplays.cfd).
    // Request permission for all sites during the user's click (once; not asked again).
    const all = { origins: ["https://*/*", "http://*/*"] };
    try {
      if (!(await chrome.permissions.contains(all))) await chrome.permissions.request(all);
    } catch (_) {}
    const res = await chrome.runtime.sendMessage({ type: "resetTab", tabId: tab.id }).catch((e) => ({ ok: false, error: e.message }));
    if (res?.ok && res.state === "ok") {
      showHealth(`${t("✓ Sıfırlandı. Sayfada yeniden deneyebilirsin.")}${res.frames ? ` (${res.frames} ${t("çerçeve")})` : ""}`, null, true);
      setTimeout(() => (health.hidden = true), 2500);
    } else {
      showHealth(`${t("Sıfırlanamadı")}${res?.error ? ": " + res.error : ""}. ${t("Sayfayı yenilemek gerekiyor.")}`, healthButton(t("Sayfayı yenile"), reload));
    }
  });
  showHealth(t("⚠ Eklenti bu sayfada çalışmıyor (sayfa, eklenti güncellenmeden önce açılmış olabilir)."), reset);
}
checkHealth();

// ---- One-click translation (per tab): show the switch if the content script responds ----
async function initTagMode() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const r = await chrome.tabs.sendMessage(tab.id, { type: "rcTagMode" }, { frameId: 0 }).catch(() => null);
  if (!r) return; // chrome:// page or orphaned script: the health warning is shown anyway
  const box = document.getElementById("tagMode");
  box.checked = !!r.on;
  document.getElementById("tagRow").hidden = false;
  box.addEventListener("change", async () => {
    const res = await chrome.runtime.sendMessage({ type: "tagMode", tabId: tab.id, on: box.checked }).catch(() => null);
    if (res?.ok) window.close(); // so the user can go back to the page and click right away
    else box.checked = !box.checked;
  });
}
initTagMode();

// History: cached translations, newest first. If the same query exists as both fast and LLM, one row (LLM preferred).
async function renderHistory() {
  const { cache = {} } = await chrome.storage.local.get("cache");
  const byQuery = new Map();
  for (const [key, e] of Object.entries(cache)) {
    const r = e?.result;
    if (!r?.query) continue;
    const k = r.query.trim().toLowerCase();
    const prev = byQuery.get(k);
    if (!prev || key.startsWith("llm|") || (!prev.key.startsWith("llm|") && e.ts > prev.e.ts)) byQuery.set(k, { key, e });
  }
  const items = [...byQuery.values()].sort((a, b) => b.e.ts - a.e.ts);

  out.replaceChildren();
  if (!items.length) {
    out.append(RC.el("div", "empty", t("Önbellekte kayıt yok. (Ayarlar'da önbellek kapalı olabilir.)")));
    return;
  }
  const head = RC.el("div", "rc-foot", t("{n} kayıt ", { n: items.length }));
  const clear = RC.el("button", "link-btn", t("Tümünü sil"));
  clear.addEventListener("click", async () => {
    await chrome.storage.local.remove("cache");
    renderHistory();
  });
  head.append(clear);
  out.append(head);

  for (const { key, e } of items) {
    const r = e.result;
    const row = RC.el("div", "fav");
    const main = RC.el("div", "fav-main");
    const when = new Date(e.ts).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    main.append(
      RC.el("div", "fav-q", r.query),
      RC.el("div", "fav-t", (r.translations || []).slice(0, 3).map((t) => t.text).join(", ")),
      RC.el("div", "fav-d", (key.startsWith("llm|") ? "🤖 LLM · " : "") + when)
    );
    main.addEventListener("click", () => search(r.query));
    const del = RC.el("button", null, "✕");
    del.title = t("Sil");
    del.addEventListener("click", async () => {
      const { cache: c = {} } = await chrome.storage.local.get("cache");
      for (const k of Object.keys(c)) if (c[k]?.result?.query?.trim().toLowerCase() === r.query.trim().toLowerCase()) delete c[k];
      await chrome.storage.local.set({ cache: c });
      renderHistory();
    });
    row.append(main, del);
    out.append(row);
  }
}

const getFavs = async () => (await chrome.storage.local.get("favorites")).favorites || [];
const setFavs = (favorites) => chrome.storage.local.set({ favorites });

async function renderSaved() {
  const favorites = await getFavs();
  out.replaceChildren();
  if (!favorites.length) {
    out.append(RC.el("div", "empty", t("Henüz kaydedilmiş kelime yok.")));
    return;
  }
  favorites.forEach((f) => {
    const row = RC.el("div", "fav");
    const main = RC.el("div", "fav-main");
    main.append(RC.el("div", "fav-q", f.query), RC.el("div", "fav-t", f.translation));
    main.addEventListener("click", () => search(f.query));
    const del = RC.el("button", null, "✕");
    del.title = t("Sil");
    del.addEventListener("click", async () => {
      await setFavs((await getFavs()).filter((x) => x.query !== f.query));
      renderSaved();
    });
    row.append(main, del);
    out.append(row);
  });
}

// Flashcard review (Leitner): if you knew it, the box goes up and the interval grows; if not, it returns to box 1.
async function renderReview() {
  const now = Date.now();
  const favorites = await getFavs();
  const due = favorites
    .filter((f) => (f.due ?? 0) <= now)
    .sort((a, b) => (a.due ?? 0) - (b.due ?? 0));

  out.replaceChildren();
  if (!favorites.length) {
    out.append(RC.el("div", "empty", t("Önce birkaç kelime kaydet (☆ Kaydet).")));
    return;
  }
  if (!due.length) {
    const next = Math.min(...favorites.map((f) => f.due ?? 0));
    const hours = Math.max(1, Math.round((next - now) / 3600000));
    out.append(RC.el("div", "empty", t("Bugünlük tekrar bitti 🎉 Sıradaki kart yaklaşık {h} saat sonra.", { h: hours })));
    return;
  }

  const card = due[0];
  out.append(RC.el("div", "rc-foot", t("{n} kart bekliyor · kutu {box}", { n: due.length, box: card.box || 1 })));

  const front = RC.el("div", "card-front");
  front.append(RC.el("span", "rc-query", card.query));
  const spk = RC.el("button", "rc-icon", "🔊");
  spk.addEventListener("click", () => RC.speak(card.query, card.from));
  front.append(spk);
  out.append(front);

  const answer = RC.el("div", "card-answer");
  const reveal = RC.el("button", "card-btn primary", t("Cevabı göster"));
  reveal.addEventListener("click", () => {
    reveal.remove();
    answer.append(RC.el("div", "rc-chip-text", card.translation));
    if (card.example) {
      const ex = RC.el("div", "rc-example");
      ex.append(RC.el("div", "rc-src", card.example.src.replaceAll("**", "")));
      // For words saved in one-click mode the example is the sentence on the page; it has no translation.
      if (card.example.tgt) ex.append(RC.el("div", "rc-tgt", card.example.tgt.replaceAll("**", "")));
      answer.append(ex);
    }
    const row = RC.el("div", "card-row");
    const no = RC.el("button", "card-btn", t("Bilmiyordum"));
    const yes = RC.el("button", "card-btn primary", t("Biliyordum"));
    no.addEventListener("click", () => grade(card, false));
    yes.addEventListener("click", () => grade(card, true));
    row.append(no, yes);
    answer.append(row);
  });
  out.append(answer, reveal);
}

async function grade(card, known) {
  const favorites = await getFavs();
  const f = favorites.find((x) => x.query === card.query);
  if (f) {
    f.box = known ? Math.min((f.box || 1) + 1, MAX_BOX) : 1;
    // A card you didn't know is scheduled 10 min later so it comes back within the session; one you knew gets its box interval.
    f.due = Date.now() + (known ? INTERVALS[f.box] * DAY : 10 * 60 * 1000);
    await setFavs(favorites);
  }
  renderReview();
}

// Static texts (HTML) are translated into the selected language.
RC_I18N.ready.then(() => { RC_I18N.translateDom(document.body); RC_I18N.observe(document.body); });
