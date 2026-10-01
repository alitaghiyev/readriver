// Shared result rendering for the popup and the content card. Uses only textContent (model output is untrusted).
var RC = (() => {
  const t = (s, v) => RC_I18N.t(s, v);
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Turns "**highlight**" marks into <mark>.
  function marked(parent, text) {
    String(text).split("**").forEach((part, i) => {
      if (!part) return;
      if (i % 2) parent.appendChild(el("mark", null, part));
      else parent.appendChild(document.createTextNode(part));
    });
  }

  function speak(text, lang) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = RC_LANGS.tts(lang) || "en-US";
      speechSynthesis.speak(u);
    } catch (_) {}
  }

  function loading(root, query) {
    root.replaceChildren(el("div", "rc-status", t("“{q}” çevriliyor…", { q: query })));
  }

  // Provider errors are written in Turkish: known messages (or "Name: message") are translated into the selected language.
  function tMsg(line) {
    const whole = t(line);
    if (whole !== line) return whole;
    const i = line.indexOf(": ");
    return i > 0 ? line.slice(0, i + 2) + t(line.slice(i + 2)) : line;
  }

  function error(root, message) {
    root.replaceChildren(el("div", "rc-error", String(message).split("\n").map(tMsg).join("\n")));
  }

  function fillExamples(box, examples, max = 3) {
    box.replaceChildren();
    examples = examples.slice(0, max);
    if (!examples.length) return;
    box.append(el("div", "rc-section", t("Örnek cümleler")));
    examples.forEach((ex) => {
      const row = el("div", "rc-example");
      const src = el("div", "rc-src");
      marked(src, ex.src);
      const tgt = el("div", "rc-tgt");
      marked(tgt, ex.tgt);
      row.append(src, tgt);
      box.append(row);
    });
  }

  // If opts.onSave(entry) is given, the "Save" button appears.
  function result(root, r, opts = {}) {
    root.replaceChildren();

    const head = el("div", "rc-head");
    const q = el("span", "rc-query", r.query);
    const spk = el("button", "rc-icon", "🔊");
    spk.title = t("Dinle");
    spk.addEventListener("click", () => speak(r.query, r.from));
    head.append(q, spk);
    if (r.from && r.to) head.append(el("span", "rc-dir", `${r.from.toUpperCase()} → ${r.to.toUpperCase()}`));
    if (opts.onSave) {
      const save = el("button", "rc-save", t("☆ Kaydet"));
      save.addEventListener("click", async () => {
        await opts.onSave({
          query: r.query,
          from: r.from,
          to: r.to,
          translation: r.translations[0]?.text || "",
          example: r.examples[0] || null
        });
        save.textContent = t("★ Kaydedildi");
        save.disabled = true;
      });
      head.append(save);
    }
    root.append(head);

    const tr = el("div", "rc-translations");
    r.translations.forEach((tr1) => {
      const chip = el("button", "rc-chip");
      chip.append(el("span", "rc-chip-text", tr1.text));
      if (tr1.pos) chip.append(el("span", "rc-pos", tr1.pos));
      chip.title = t("Dinle");
      chip.addEventListener("click", () => speak(tr1.text, r.to));
      tr.append(chip);
    });
    root.append(tr);

    if (r.notes) root.append(el("div", "rc-notes", r.notes));

    const exBox = el("div", "rc-examples");
    root.append(exBox);
    if (r.examples.length) {
      fillExamples(exBox, r.examples, opts.maxExamples);
    } else if (r.free && r.needsExamples) {
      // Fast provider: the translation is ready, the example sentences arrive afterwards.
      exBox.append(el("div", "rc-foot", t("örnek cümleler yükleniyor…")));
      chrome.runtime.sendMessage({ type: "examples", query: r.query }, (resp) => {
        if (!exBox.isConnected) return; // the card was refreshed or closed in the meantime
        if (chrome.runtime.lastError || !resp?.ok) return exBox.replaceChildren();
        if (resp.failed) return exBox.replaceChildren(el("div", "rc-foot", t("örnek cümleler alınamadı")));
        r.examples = resp.examples; // "Save" uses this
        r.needsExamples = false;
        fillExamples(exBox, resp.examples, opts.maxExamples);
      });
    }

    if (r.free && opts.onMore) {
      const more = el("button", "rc-more", t("🤖 LLM ile detaylandır"));
      more.addEventListener("click", opts.onMore);
      root.append(more);
    }

    if (r.cached) root.append(el("div", "rc-foot", t("önbellekten")));
    else if (r.provider) root.append(el("div", "rc-foot", r.provider));

    if (opts.autoSpeak) speak(r.query, r.from); // Settings > read aloud when the card opens
  }

  // Chrome's built-in Translator / LanguageDetector APIs (local model, no key needed).
  // They don't work in the service worker, so the fallback is tried here, in the page context.
  async function offline(query) {
    if (!("Translator" in self) || !("LanguageDetector" in self)) {
      throw new Error(t("Chrome yerleşik çeviri bu tarayıcıda yok"));
    }
    const { settings } = await chrome.storage.local.get("settings");
    const langA = settings?.langA || "en";
    const langB = settings?.langB || "tr";
    const detector = await LanguageDetector.create();
    const guess = await detector.detect(query);
    const from = RC_LANGS.same(guess[0]?.detectedLanguage, langB) ? langB : langA;
    const to = from === langA ? langB : langA;
    const translator = await Translator.create({ sourceLanguage: from, targetLanguage: to });
    const text = await translator.translate(query);
    return {
      query, from, to,
      translations: [{ text, pos: "" }],
      examples: [],
      notes: t("Yedek mod: Chrome yerleşik çeviri (örnek cümle yok)."),
      provider: "chrome"
    };
  }

  // Background first (Gemini / OmniRoute); the built-in translator if everything fails.
  function translate(query, opts = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "translate", query, llm: !!opts.llm }, async (resp) => {
        if (!chrome.runtime.lastError && resp?.ok) return resolve({ ok: true, result: resp.result });
        const err = chrome.runtime.lastError?.message || resp?.error || t("Bilinmeyen hata");
        try {
          resolve({ ok: true, result: await offline(query) });
        } catch (e) {
          resolve({ ok: false, error: `${err}\n${t("(yedek: {m})", { m: e.message })}` });
        }
      });
    });
  }

  // Applies the theme and accent color from the preferences to a host element (the shadow root host or <html>).
  function applyAppearance(target, p) {
    if (!target || !p) return;
    if (p.theme === "light" || p.theme === "dark") target.setAttribute("data-theme", p.theme);
    else target.removeAttribute("data-theme");
    if (p.accent && String(p.accent).toLowerCase() !== "#1a73e8") target.style.setProperty("--rc-accent", p.accent);
    else target.style.removeProperty("--rc-accent");
  }

  return { el, loading, error, result, speak, translate, applyAppearance };
})();
