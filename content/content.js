(() => {
  // Previous copy (re-injection via "Reset" in the popup, or an orphaned script left on the page after an extension reload): remove it first.
  try { window.__rcTeardown?.(); } catch (_) {}

  // All page listeners are bound to this signal; teardown() removes them all at once.
  // Old subtitle overlays left on the page by the orphaned copy (the new copy draws its own).
  // If an overlay exists, the old copy had taken over the subtitles (it may be an older version without the marker): take over "hidden" tracks too.
  const staleOverlays = document.querySelectorAll(".rc-native-sub");
  const legacyOrphan = staleOverlays.length > 0;
  staleOverlays.forEach((n) => n.remove());
  const life = new AbortController();
  const sig = life.signal;
  let dead = false;

  // When the extension is reloaded/updated this script is "orphaned" on the page: chrome.* calls throw and the card cannot open.
  const orphaned = () => {
    try { return !chrome.runtime?.id; } catch (_) { return true; }
  };
  // If orphaned, it removes itself silently (the "!" badge on the icon and the Reset button in the popup inform the user).
  function alive() {
    if (dead) return false;
    if (orphaned()) {
      teardown();
      return false;
    }
    return true;
  }

  // Subtitle elements of known players; always treated as subtitles.
  const KNOWN_SUB = ".ytp-caption-segment, .caption-window, .player-timedtext, .vjs-text-track-display, .vjs-text-track-cue, .rc-native-sub";
  // Generic names ("caption", "subtitle"): treated as subtitles only while the mouse is over a <video> (to exclude blog image captions).
  const GENERIC_SUB = "[class*='ubtitle'], [class*='aption']";
  // Container of the line translated with "Shift + hover".
  const LINE_BOX = ".rc-native-sub, .caption-window, .player-timedtext, .vjs-text-track-display, [class*='ubtitle'], [class*='aption']";

  // Diagnostics (Settings > Diagnostics): tell the background that the content script runs on this page (top frame only).
  try {
    if (window === window.top) chrome.runtime.sendMessage({ type: "hello", origin: location.origin }).catch(() => {});
  } catch (_) {}

  // ---- Preferences (from Settings; shared/prefs.js provides defaults and validation) ----
  let opts = RC_PREFS.resolve({});
  let siteOff = false; // this site is on the blocked sites list

  function loadOpts(settings) {
    if (dead) return;
    opts = RC_PREFS.resolve(settings);
    siteOff = RC_PREFS.siteBlocked(opts.blockedSites, location.hostname);
    if (siteOff) dismiss();
    if (siteOff) setTagMode(false);
    else if (hlStyle) hlStyle.textContent = tagStyleText();
    applyLook();
    refreshNative();
    relayout();
  }
  const onStorage = (c, area) => {
    if (area === "local" && c.settings) loadOpts(c.settings.newValue);
  };
  try {
    chrome.storage.local.get("settings").then((r) => loadOpts(r.settings)).catch(() => loadOpts(null));
    chrome.storage.onChanged.addListener(onStorage);
  } catch (_) {
    setTimeout(() => loadOpts(null), 0);
  }

  let host = null;
  let shadow = null;
  let token = 0;
  let pausedVideo = null; // the video we paused during hover
  let lastDbl = 0; // time of the last double-click
  let autoTimer = null; // wait after a selection in "auto translate" mode
  let autoText = "";
  let dblTimer = null; // double-click delay

  const inFullscreen = () => !!document.fullscreenElement;

  // On sites like Netflix subtitles can have pointer-events:none; we enable it so they receive mouse events.
  const pe = document.createElement("style");
  pe.textContent = `
    .player-timedtext, .player-timedtext *, .ytp-caption-segment, .caption-window,
    .vjs-text-track-display *, .vjs-text-track-cue { pointer-events: auto !important; user-select: text !important; }
  `;
  (document.head || document.documentElement).append(pe);

  // Theme and accent color are applied to the card host (the shadow root host).
  function applyLook() {
    if (!host) return;
    RC.applyAppearance(host, opts);
    host.style.setProperty("--rc-tag-bg", opts.tagBg);
    host.style.setProperty("--rc-tag-fg", opts.tagFg);
  }

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement("div");
    host.style.cssText = "all:initial; top:0; left:0; z-index:2147483647; position:" + (inFullscreen() ? "fixed" : "absolute");
    shadow = host.attachShadow({ mode: "closed" });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("shared/result.css");

    const style = document.createElement("style");
    style.textContent = `
      .rc-btn { position:absolute; width:28px; height:28px; border-radius:50%; border:0; cursor:pointer;
        background:var(--rc-accent); color:#fff; font:600 14px system-ui; box-shadow:0 2px 8px rgba(0,0,0,.3); }
      .rc-card { position:absolute; max-width:calc(100vw - 16px); max-height:60vh; overflow:auto;
        background:var(--rc-bg); border:1px solid var(--rc-border); border-radius:10px; padding:12px 14px;
        box-shadow:0 8px 28px rgba(0,0,0,.28); }
      .rc-close { position:absolute; top:6px; right:8px; border:0; background:none; cursor:pointer;
        color:var(--rc-muted); font-size:16px; }
      ${RC_TAGFIT.CSS_TEXT}
      .rc-toast { position:fixed; top:14px; right:14px; padding:7px 12px; border-radius:8px; background:var(--rc-bg);
        color:var(--rc-fg); border:1px solid var(--rc-border); font:500 13px system-ui, sans-serif;
        box-shadow:0 4px 16px rgba(0,0,0,.2); }
    `;
    shadow.append(link, style);
    (document.fullscreenElement || document.documentElement).append(host);
    applyLook();
  }

  // In fullscreen only the fullscreen element's content is visible; move the card there.
  document.addEventListener("fullscreenchange", () => {
    clear();
    if (host && host.isConnected) {
      host.style.position = inFullscreen() ? "fixed" : "absolute";
      (document.fullscreenElement || document.documentElement).append(host);
    }
  }, { signal: sig });

  function clear() {
    token++;
    if (shadow) shadow.querySelectorAll(".rc-btn, .rc-card").forEach((n) => n.remove());
  }

  function pickVideo() {
    const vids = [...document.querySelectorAll("video")].filter((v) => !v.paused && !v.ended);
    return vids.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0] || null;
  }

  function pauseVideo() {
    if (!opts.pauseOnHover || pausedVideo) return;
    const v = pickVideo();
    if (v) {
      v.pause();
      pausedVideo = v;
    }
  }

  function resumeVideo() {
    if (pausedVideo) {
      pausedVideo.play().catch(() => {});
      pausedVideo = null;
    }
  }

  // Closes the card and resumes the video we paused.
  function dismiss() {
    hoverOpen = false;
    clearTimeout(autoTimer);
    clearTimeout(dblTimer);
    clear();
    resumeVideo();
  }

  // The card opens below the target; if there is no room below, above it (the card grows upward).
  function place(node, rect, width, isCard) {
    const fs = inFullscreen();
    const sx = fs ? 0 : window.scrollX;
    const sy = fs ? 0 : window.scrollY;
    const vw = document.documentElement.clientWidth;
    let left = rect.left + sx;
    left = Math.max(sx + 8, Math.min(left, sx + vw - width - 8));
    node.style.left = left + "px";

    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const MARGIN = 16; // gap from the window edge
    if (isCard && below < 320 && above > below) {
      // More room above: the card opens above the target (grows upward); limit its height to the space above.
      node.style.top = rect.top + sy - 8 + "px";
      node.style.transform = "translateY(-100%)";
      node.style.maxHeight = Math.max(160, above - 8 - MARGIN) + "px";
    } else {
      node.style.top = rect.bottom + sy + 8 + "px";
      if (isCard) node.style.maxHeight = Math.max(160, below - 8 - MARGIN) + "px";
    }
  }

  function showButton(text, rect) {
    ensureHost();
    clear();
    const b = document.createElement("button");
    b.className = "rc-btn";
    b.textContent = "R";
    b.title = RC_I18N.t("Çevir");
    place(b, rect, 28, false);
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => showCard(text, rect));
    shadow.append(b);
  }

  function showCard(text, rect) {
    if (!alive()) return;
    ensureHost();
    clear();
    const mine = token;

    const card = document.createElement("div");
    card.className = "rc-card rc-root";
    card.style.width = opts.cardWidth + "px";
    const body = document.createElement("div");
    body.style.zoom = String(opts.fontSize / 14); // font size preference
    const close = document.createElement("button");
    close.className = "rc-close";
    close.textContent = "×";
    close.addEventListener("click", dismiss);
    card.append(close, body);
    place(card, rect, opts.cardWidth, true);
    shadow.append(card);

    load(body, text, mine, false);
  }

  // llm=true: the "Elaborate with LLM" button below the fast result.
  function load(body, text, mine, llm) {
    RC.loading(body, text);
    RC.translate(text, { llm }).then((resp) => {
      if (mine !== token) return;
      if (!resp.ok) return RC.error(body, resp.error);
      RC.result(body, resp.result, {
        onSave: (entry) => chrome.runtime.sendMessage({ type: "save", entry }),
        onMore: () => load(body, text, mine, true),
        maxExamples: opts.maxExamples,
        autoSpeak: opts.autoSpeak && !llm
      });
    });
  }

  // ---- Selection validation (against accidental selections) ----
  const activeEditable = () => {
    const a = document.activeElement;
    return !!a && (!!a.matches?.("input,textarea,select") || a.isContentEditable);
  };

  function acceptText(text) {
    if (text.length < opts.minChars || text.length > opts.maxChars) return false;
    if (opts.ignoreNonLetters && !/\p{L}/u.test(text)) return false;
    return true;
  }

  const modOk = (e) =>
    opts.modifier === "none" ||
    (opts.modifier === "alt" && e.altKey) ||
    (opts.modifier === "ctrl" && e.ctrlKey) ||
    (opts.modifier === "shift" && e.shiftKey);

  function currentSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    if (opts.ignoreEditable && activeEditable()) return null;
    const text = sel.toString().trim();
    if (!text || !acceptText(text)) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    return { text, rect };
  }

  const fromHost = (e) => host && e.composedPath().includes(host);

  // New click: cancel the pending auto translation / double-click delay (triple click, changing the selection…).
  document.addEventListener(
    "mousedown",
    (e) => {
      if (fromHost(e)) return;
      clearTimeout(autoTimer);
      clearTimeout(dblTimer);
      clearTimeout(tagTimer); // second press of a double-click: don't open a one-click label
    },
    { capture: true, signal: sig }
  );

  // Selection: the small R button or (depending on the preference) delayed auto translation. Skipped on double-click.
  // In the capture phase (true): the event reaches us even if the page calls stopPropagation on an ancestor.
  document.addEventListener(
    "mouseup",
    (e) => {
      if (siteOff || fromHost(e) || !alive()) return;
      clearTimeout(autoTimer);
      if (opts.dblclick && e.detail >= 2) return; // the dblclick event handles it
      const allowed = modOk(e);
      setTimeout(() => {
        if (Date.now() - lastDbl < 400) return; // don't replace the double-click card with the R button
        const s = allowed && opts.selectMode !== "off" ? currentSelection() : null;
        if (!s) {
          if (!hoverOpen) dismiss();
        } else if (opts.selectMode === "button") {
          showButton(s.text, s.rect);
        } else {
          // "auto": translate if the selection doesn't change within this time.
          autoText = s.text;
          autoTimer = setTimeout(() => {
            const n = currentSelection();
            if (n && n.text === autoText) showCard(n.text, n.rect);
          }, opts.autoDelay);
        }
      }, 10);
    },
    { capture: true, signal: sig }
  );

  document.addEventListener(
    "dblclick",
    (e) => {
      if (siteOff || !opts.dblclick || fromHost(e) || !modOk(e) || !alive()) return;
      if (opts.ignoreEditable && activeEditable()) return;
      // In user-select:none text such as buttons/links the selection stays empty: find the word from the caret position.
      let s = currentSelection();
      if (!s) {
        const w = wordAtPoint(e.clientX, e.clientY);
        if (w && acceptText(w.text)) s = w;
      }
      if (!s) return;
      lastDbl = Date.now();
      clearTimeout(tagTimer);
      hoverOpen = false;
      clearTimeout(dblTimer);
      const go = () => showCard(s.text, s.rect);
      if (opts.dblDelay > 0) dblTimer = setTimeout(go, opts.dblDelay);
      else go();
    },
    { capture: true, signal: sig }
  );

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    // If a card/button is open, close it first; otherwise remove the one-click labels.
    if (tags.length && !shadow?.querySelector(".rc-card, .rc-btn")) removeTags();
    else dismiss();
  }, { signal: sig });

  // ---- Translate on subtitle hover ----
  let hoverTimer = null;
  let leaveTimer = null;
  let lastHit = "";
  let hoverOpen = false;

  const overVideo = (e) =>
    [...document.querySelectorAll("video")].some((v) => {
      const r = v.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });

  function subtitleAt(e) {
    const t = e.target;
    if (!(t instanceof Element)) return null;
    return t.closest(KNOWN_SUB) || (t.closest(GENERIC_SUB) && overVideo(e) ? t.closest(GENERIC_SUB) : null);
  }

  const WORD_CHAR = /[\p{L}\p{M}'’-]/u;

  // Finds the word under the mouse pointer (only if the pointer is really over the word).
  function wordAtPoint(x, y) {
    let node, offset;
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      if (!p) return null;
      node = p.offsetNode;
      offset = p.offset;
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (!r) return null;
      node = r.startContainer;
      offset = r.startOffset;
    } else return null;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;

    const s = node.textContent;
    let a = offset;
    let b = offset;
    while (a > 0 && WORD_CHAR.test(s[a - 1])) a--;
    while (b < s.length && WORD_CHAR.test(s[b])) b++;
    if (a === b) return null;

    const range = document.createRange();
    range.setStart(node, a);
    range.setEnd(node, b);
    const inside = [...range.getClientRects()].some(
      (r) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2
    );
    const text = s.slice(a, b).replace(/^['’-]+|['’-]+$/g, "");
    return inside && text ? { text, rect: range.getBoundingClientRect(), range } : null;
  }

  // While Shift is held: the whole subtitle line.
  function lineOf(sub) {
    const box = sub.closest(LINE_BOX) || sub;
    const text = (box.innerText || "").replace(/\s+/g, " ").trim();
    return text && text.length <= opts.maxChars ? { text, rect: box.getBoundingClientRect() } : null;
  }

  function scheduleLeave() {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      lastHit = "";
      dismiss();
    }, opts.leaveDelay);
  }

  document.addEventListener(
    "mousemove",
    (e) => {
      if (siteOff || !opts.subtitleHover || !alive()) return;
      if (fromHost(e)) return void clearTimeout(leaveTimer); // mouse is over the card: keep it open

      const sub = subtitleAt(e);
      if (!sub) {
        clearTimeout(hoverTimer);
        lastHit = "";
        if (hoverOpen) scheduleLeave();
        return;
      }
      clearTimeout(leaveTimer);

      let hit = e.shiftKey ? lineOf(sub) : wordAtPoint(e.clientX, e.clientY);
      if (hit && !e.shiftKey && !acceptText(hit.text)) hit = null; // ignore very short words such as "a", "I"
      if (!hit) return void clearTimeout(hoverTimer);
      if (hit.text === lastHit) return;
      lastHit = hit.text;

      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        hoverOpen = true;
        pauseVideo();
        showCard(hit.text, hit.rect);
      }, opts.hoverDelay);
    },
    { passive: true, capture: true, signal: sig }
  );

  // Close the hover card if the mouse leaves the window.
  document.addEventListener("mouseout", (e) => {
    if (!e.relatedTarget && hoverOpen) scheduleLeave();
  }, { signal: sig });

  // ---- Native (HTML5 <track>) subtitles ----
  // Some players deliver subtitles via <track>: the browser draws them itself and there is no DOM element on the page,
  // so they cannot be hovered (YouTube's subtitles, by contrast, are in the DOM). Solution: set the "showing" track to "hidden"
  // and draw the same text in our own hoverable overlay (.rc-native-sub).
  const nativeStates = new WeakMap(); // video -> { tracks:Set, overlay, flips, since }
  const watchedVideos = new Set();
  const isCaptionTrack = (t) => t.kind === "subtitles" || t.kind === "captions";
  const nativeOn = () => opts.nativeSubs && !siteOff;

  function cueText(c) {
    const frag = c.getCueAsHTML ? c.getCueAsHTML() : null;
    return String(frag ? frag.textContent : c.text || "").replace(/\r/g, "").trim();
  }

  function overlayHost(v) {
    const fs = document.fullscreenElement;
    return fs && fs !== v && fs.contains(v) ? fs : document.documentElement;
  }

  function ensureOverlay(v, st) {
    if (!st.overlay) {
      const o = document.createElement("div");
      o.className = "rc-native-sub";
      // Keep the player from going fullscreen / toggling playback when this overlay is double-clicked.
      for (const t of ["click", "dblclick", "mousedown", "mouseup", "contextmenu"]) o.addEventListener(t, (e) => e.stopPropagation());
      st.overlay = o;
    }
    const h = overlayHost(v);
    if (st.overlay.parentNode !== h) h.append(st.overlay);
    return st.overlay;
  }

  function layoutOverlay(v, st) {
    const o = st.overlay;
    if (!o || o.style.display === "none") return;
    const r = v.getBoundingClientRect();
    const fs = Math.max(12, Math.min(60, r.height * 0.045 * opts.subFontScale));
    const set = (k, val) => o.style.setProperty(k, val, "important");
    set("position", "fixed");
    set("z-index", "2147483646");
    set("pointer-events", "auto");
    set("user-select", "text");
    set("-webkit-user-select", "text");
    set("cursor", "text");
    set("text-align", "center");
    set("color", "#fff");
    set("background", `rgba(0,0,0,${opts.subOpacity / 100})`);
    set("padding", "4px 12px");
    set("border-radius", "4px");
    set("font", `600 ${fs}px/1.35 system-ui, "Segoe UI", sans-serif`);
    set("text-shadow", "0 1px 2px #000");
    set("max-width", Math.max(200, r.width * 0.9) + "px");
    set("width", "max-content");
    set("left", "0px");
    set("top", "0px");
    const w = o.offsetWidth;
    const h = o.offsetHeight;
    set("left", Math.max(4, r.left + (r.width - w) / 2) + "px");
    set("top", Math.max(4, r.bottom - h - Math.max(r.height * 0.09, 32)) + "px");
  }

  function renderNative(v, st) {
    const groups = [];
    if (nativeOn() && document.fullscreenElement !== v) {
      for (const t of st.tracks) {
        if (t.mode === "disabled") continue;
        for (const c of t.activeCues || []) {
          const txt = cueText(c);
          if (txt) groups.push(txt);
        }
      }
    }
    if (!groups.length) {
      if (st.overlay) st.overlay.style.setProperty("display", "none", "important");
      return;
    }
    const o = ensureOverlay(v, st);
    o.replaceChildren(
      ...groups.flatMap((g) => g.split("\n")).map((line) => {
        const d = document.createElement("div");
        d.textContent = line;
        return d;
      })
    );
    o.style.setProperty("display", "block", "important");
    layoutOverlay(v, st);
  }

  // showing → hidden: the browser stops drawing, cues still load and cuechange still fires.
  function adoptTracks(v) {
    const st = nativeStates.get(v);
    if (!st || !nativeOn()) return;
    if (document.fullscreenElement === v) return; // the video itself is fullscreen: the overlay cannot be shown, leave it to the browser
    for (const t of v.textTracks) {
      // "hidden" + marker: a track taken over by the orphaned copy (before Reset); the marker is in the DOM, so it survives across worlds.
      const orphanHidden = t.mode === "hidden" && (legacyOrphan || v.hasAttribute("data-rc-adopted"));
      if (!isCaptionTrack(t) || (t.mode !== "showing" && !orphanHidden)) continue;
      if (Date.now() - st.since > 2000) { st.since = Date.now(); st.flips = 0; }
      if (++st.flips > 20) return; // the page keeps flipping the mode back: don't fight it
      t.mode = "hidden";
      v.setAttribute("data-rc-adopted", "");
      if (!st.tracks.has(t)) {
        st.tracks.add(t);
        t.addEventListener("cuechange", () => renderNative(v, st), { signal: sig });
      }
    }
    renderNative(v, st);
  }

  function watchVideo(v) {
    if (nativeStates.has(v)) return;
    nativeStates.set(v, { tracks: new Set(), overlay: null, flips: 0, since: Date.now() });
    watchedVideos.add(v);
    const again = () => adoptTracks(v);
    v.textTracks.addEventListener("addtrack", again, { signal: sig });
    v.textTracks.addEventListener("change", again, { signal: sig });
    v.addEventListener("loadedmetadata", again, { signal: sig });
    adoptTracks(v);
  }

  // When the option is turned off: hand the subtitles back to the browser and hide the overlays.
  function releaseNative() {
    for (const v of watchedVideos) {
      const st = nativeStates.get(v);
      if (!st) continue;
      for (const t of st.tracks) if (t.mode === "hidden") t.mode = "showing";
      st.tracks.clear();
      v.removeAttribute("data-rc-adopted");
      if (st.overlay) st.overlay.style.setProperty("display", "none", "important");
    }
  }

  function scanVideos(root) {
    const list = root.nodeType === 1 && root.matches("video") ? [root] : [];
    if (root.querySelectorAll) list.push(...root.querySelectorAll("video"));
    list.forEach(watchVideo);
  }

  function refreshNative() {
    if (nativeOn()) {
      scanVideos(document);
      watchedVideos.forEach(adoptTracks);
    } else releaseNative();
  }

  const videoObserver = new MutationObserver((muts) => {
    if (!nativeOn()) return;
    for (const m of muts) m.addedNodes.forEach((n) => n.nodeType === 1 && scanVideos(n));
  });
  videoObserver.observe(document.documentElement, { childList: true, subtree: true });

  // ---- One-click mode: a single click on a word writes its translation above the word ----
  // Turned on per tab (popup switch / Alt+T; the background forwards it to all frames), turned off when the page reloads.
  // To avoid clashing with double-click, the label waits for tagDelay: a second mousedown within that time cancels it and the card opens.
  // The word under the mouse is colored with the CSS Custom Highlight API: it doesn't touch the page's DOM or layout.
  let tagMode = false;
  let tagTimer = null;
  let hoverRaf = 0;
  let hlStyle = null; // ::highlight rules must be in the page's stylesheet (they don't work in the shadow root)
  let toastTimer = null;
  const tags = []; // { range, el }
  const HL = "rc-hover";
  const HL_TAGGED = "rc-tagged";
  const hlOk = typeof Highlight === "function" && !!globalThis.CSS?.highlights;

  // Elements that handle their own click: there a single click is left to the page (the link opens, the button works).
  const INTERACTIVE = "a[href], button, input, textarea, select, label, summary, [role='button'], [role='link'], [role='tab'], [role='menuitem']";
  const interactiveAt = (t) => t instanceof Element && (!!t.closest(INTERACTIVE) || t.isContentEditable);

  const tagStyleText = () => RC_TAGFIT.highlightCss(opts);

  function toast(text) {
    ensureHost();
    shadow.querySelector(".rc-toast")?.remove();
    const d = document.createElement("div");
    d.className = "rc-toast";
    d.textContent = text;
    shadow.append(d);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => d.remove(), 1800);
  }

  function setTagMode(on, announce) {
    on = !!on && !siteOff && !dead;
    if (on !== tagMode) {
      tagMode = on;
      clearTimeout(tagTimer);
      if (on && hlOk) {
        hlStyle ||= document.createElement("style");
        hlStyle.textContent = tagStyleText();
        (document.head || document.documentElement).append(hlStyle);
      } else if (!on) {
        removeTags();
        if (hlOk) CSS.highlights.delete(HL);
        hlStyle?.remove();
        hlStyle = null;
      }
    }
    if (announce && window === window.top && !dead) {
      toast(RC_I18N.t(tagMode ? "Tek tık çeviri açık (Alt+T ile kapat)" : "Tek tık çeviri kapalı"));
    }
  }

  // Does the label's range cover the newly clicked word (the "open space between the lines" spacer splits the text node, so
  // the start/end nodes may not match exactly).
  const covers = (a, b) => {
    try {
      return a.compareBoundaryPoints(Range.START_TO_START, b) <= 0 && a.compareBoundaryPoints(Range.END_TO_END, b) >= 0;
    } catch (_) {
      return false;
    }
  };

  // Labeled words are underlined (so you can see which words you clicked).
  function paintTagged() {
    if (!hlOk) return;
    if (tags.length) CSS.highlights.set(HL_TAGGED, new Highlight(...tags.map((t) => t.range)));
    else CSS.highlights.delete(HL_TAGGED);
  }

  // The label sits in document coordinates; it is recomputed when the page layout changes (scrolling inner box, resize).
  // The placement math (fit / open space between the lines / overlay) is in shared/tagfit.js; the settings preview uses it too.
  function positionTag(t) {
    const L = RC_TAGFIT.layout(t, opts);
    if (L?.changed) queueRelayout(); // line opened/closed: the other labels move too
    t.el.style.display = L ? "" : "none";
    if (!L) return;
    const fs = inFullscreen();
    t.el.style.fontSize = L.fontSize + "px";
    t.el.style.left = L.rect.left + L.rect.width / 2 + (fs ? 0 : window.scrollX) + "px";
    t.el.style.top = L.mid + (fs ? 0 : window.scrollY) + "px";
  }

  let relayoutRaf = 0;
  function queueRelayout() {
    if (relayoutRaf) return;
    relayoutRaf = requestAnimationFrame(() => {
      relayoutRaf = 0;
      tags.forEach(positionTag);
    });
  }

  function removeTag(t) {
    const i = tags.indexOf(t);
    if (i >= 0) tags.splice(i, 1);
    t.el.remove();
    if (t.spacer) {
      RC_TAGFIT.unwrap(t);
      queueRelayout(); // line closed again: the other labels shifted
    }
    paintTagged();
  }

  function removeTags() {
    tags.splice(0).forEach((t) => {
      t.el.remove();
      RC_TAGFIT.unwrap(t);
    });
    paintTagged();
  }

  // The sentence the word appears in on the page (stored as the example when saving; the word is marked with **…**, shown bold in the card/popup).
  function contextOf(range) {
    let box = range.startContainer.parentElement;
    while (box && box !== document.body && getComputedStyle(box).display === "inline") box = box.parentElement;
    if (!box) return "";
    const pre = document.createRange();
    pre.setStart(box, 0);
    pre.setEnd(range.startContainer, range.startOffset);
    const full = box.textContent || "";
    const a = pre.toString().length;
    const b = a + range.toString().length;
    // Sentence boundary: previous/next . ! ? … (looks at most ~120 characters away)
    let s = a;
    while (s > 0 && a - s < 120 && !/[.!?…]\s/.test(full.slice(s - 2, s))) s--;
    let e = b;
    while (e < full.length && e - b < 120 && !/[.!?…]/.test(full[e - 1] || "")) e++;
    const clean = (x) => x.replace(/\s+/g, " ");
    const sentence = (clean(full.slice(s, a)).trimStart() + "**" + full.slice(a, b) + "**" + clean(full.slice(b, e))).trim();
    return sentence.length > 3 ? sentence : "";
  }

  // A second click on the same word removes the label; a new word adds a new label (earlier ones stay).
  // Label: [translation ☆] — clicking the translation removes it, ☆ adds the word (with its sentence on the page) to the saved words.
  function toggleTag(w) {
    if (!alive()) return;
    const old = tags.find((t) => covers(t.range, w.range));
    if (old) return removeTag(old);
    ensureHost();
    const el = document.createElement("div");
    el.className = "rc-tag";
    const txt = document.createElement("span");
    txt.textContent = "…";
    txt.title = RC_I18N.t("Kaldırmak için tıkla");
    const star = document.createElement("button");
    star.className = "rc-tag-save";
    star.textContent = "☆";
    star.title = RC_I18N.t("☆ Kaydet");
    star.disabled = true;
    el.append(txt, star);
    const tag = { range: w.range, el };
    const context = contextOf(w.range);
    el.addEventListener("mousedown", (e) => e.preventDefault());
    txt.addEventListener("click", () => removeTag(tag));
    tags.push(tag);
    shadow.append(el);
    positionTag(tag);
    paintTagged();

    const markSaved = () => {
      el.classList.add("rc-saved");
      star.textContent = "★";
      star.title = RC_I18N.t("★ Kaydedildi");
      star.disabled = true;
    };
    RC.translate(w.text, {}).then(async (resp) => {
      if (!tags.includes(tag)) return;
      const r = resp.ok ? resp.result : null;
      const tr = r?.translations?.[0]?.text || "";
      txt.textContent = tr || "?"; // model/service output only via textContent
      el.classList.toggle("rc-tag-err", !tr);
      if (!resp.ok) txt.title = String(resp.error || "") + "\n" + RC_I18N.t("Kaldırmak için tıkla");
      positionTag(tag);
      if (!tr) return star.remove();
      const key = r.query.trim().toLowerCase();
      const { favorites = [] } = await chrome.storage.local.get("favorites").catch(() => ({}));
      if (favorites.some((f) => f.query?.trim().toLowerCase() === key)) return markSaved();
      star.disabled = false;
      star.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!alive()) return;
        star.disabled = true;
        const entry = {
          query: r.query,
          from: r.from,
          to: r.to,
          translation: tr,
          example: context ? { src: context, tgt: "" } : r.examples?.[0] || null
        };
        const res = await chrome.runtime.sendMessage({ type: "save", entry }).catch(() => null);
        if (res?.ok) markSaved();
        else star.disabled = false;
      });
    });
  }

  document.addEventListener(
    "click",
    (e) => {
      if (!tagMode || siteOff || e.button !== 0 || e.detail > 1) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return; // Ctrl+click etc. belong to the page
      if (fromHost(e) || interactiveAt(e.target) || !alive()) return;
      if (opts.ignoreEditable && activeEditable()) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) return; // drag selection: the selection flow handles it
      const w = wordAtPoint(e.clientX, e.clientY);
      if (!w || !acceptText(w.text)) return;
      clearTimeout(tagTimer);
      tagTimer = setTimeout(() => toggleTag(w), opts.dblclick ? opts.tagDelay : 0);
    },
    { capture: true, signal: sig }
  );

  // Color the word under the mouse (once per frame).
  document.addEventListener(
    "mousemove",
    (e) => {
      if (!tagMode || !hlOk) return;
      const { clientX: x, clientY: y, target } = e;
      const skip = fromHost(e) || interactiveAt(target);
      cancelAnimationFrame(hoverRaf);
      hoverRaf = requestAnimationFrame(() => {
        if (!tagMode) return;
        const w = skip ? null : wordAtPoint(x, y);
        if (w && acceptText(w.text)) CSS.highlights.set(HL, new Highlight(w.range));
        else CSS.highlights.delete(HL);
      });
    },
    { passive: true, capture: true, signal: sig }
  );

  const tagResize = new ResizeObserver(() => tags.forEach(positionTag));
  if (document.body) tagResize.observe(document.body);

  const relayout = () => {
    watchedVideos.forEach((v) => { const st = nativeStates.get(v); if (st) layoutOverlay(v, st); });
    tags.forEach(positionTag);
  };
  window.addEventListener("resize", relayout, { signal: sig });
  window.addEventListener("scroll", relayout, { capture: true, signal: sig });
  document.addEventListener("fullscreenchange", () =>
    watchedVideos.forEach((v) => {
      const st = nativeStates.get(v);
      if (!st) return;
      if (document.fullscreenElement === v) {
        // The <video> element itself is fullscreen: a child element cannot be shown, hand the native subtitles back.
        for (const t of st.tracks) if (t.mode === "hidden") t.mode = "showing";
        st.tracks.clear();
        renderNative(v, st);
      } else {
        adoptTracks(v); // container fullscreen or exit: take over again and move the overlay to the right place
      }
    }),
    { signal: sig }
  );

  const onMessage = (msg, _sender, sendResponse) => {
    // The background asks whether we are running in this tab (the "!" badge on the icon).
    if (msg?.type === "rcPing") return void sendResponse({ ok: true });
    // One-click mode: set it if "on" is given, otherwise just report the state.
    if (msg?.type === "rcTagMode") {
      if (typeof msg.on === "boolean") setTagMode(msg.on, true);
      return void sendResponse({ on: tagMode });
    }
    // Context menu: an explicit user request, works even if the site is on the blocked list.
    if (msg?.type !== "showCard") return;
    const s = currentSelection();
    const rect = s ? s.rect : { left: 40, top: 40, bottom: 40, width: 0, height: 0 };
    hoverOpen = false;
    showCard(msg.text || s?.text || "", rect);
  };
  chrome.runtime.onMessage.addListener(onMessage);

  // Removes this copy completely: listeners, card, native subtitle overlays (subtitles are handed back to the browser).
  function teardown() {
    if (dead) return;
    try { dismiss(); } catch (_) {}
    try { releaseNative(); } catch (_) {}
    try { setTagMode(false); } catch (_) {}
    dead = true;
    life.abort();
    videoObserver.disconnect();
    tagResize.disconnect();
    clearTimeout(tagTimer);
    clearTimeout(hoverTimer);
    clearTimeout(leaveTimer);
    for (const v of watchedVideos) nativeStates.get(v)?.overlay?.remove();
    watchedVideos.clear();
    host?.remove();
    pe.remove();
    try {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.storage.onChanged.removeListener(onStorage);
    } catch (_) {}
    if (window.__rcTeardown === teardown) delete window.__rcTeardown;
  }
  window.__rcTeardown = teardown;
})();
