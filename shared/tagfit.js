// Placement math of the one-click mode label: shared by the content script (labels on the page) and the settings page (preview).
// Classic script; writes to globalThis.RC_TAGFIT.
(() => {
  const MIN = 8; // px; anything smaller is unreadable
  const LH = 1.12; // label height / font size (line-height 1 + vertical padding)
  let ctx = null;

  // Visible gap (viewport y): slightly below the baseline of the line above → the top of this word's letters.
  // The Range box covers the font's full line-height share (the gap comes out as 2-5 px), so the letters are measured with canvas.
  function inkBand(range, r) {
    const sc = range.startContainer;
    const p = sc.nodeType === 1 ? sc : sc.parentElement; // after wrapping, the start container becomes an element
    const cs = p ? getComputedStyle(p) : null;
    const fsz = parseFloat(cs?.fontSize) || r.height / 1.2;
    const lh = parseFloat(cs?.lineHeight) || fsz * 1.2; // "normal" → ~1.2
    let ascent = fsz * 0.72;
    let descent = r.height * 0.2;
    try {
      ctx ||= document.createElement("canvas").getContext("2d");
      ctx.font = cs.font;
      const m = ctx.measureText(range.toString());
      ascent = m.actualBoundingBoxAscent;
      descent = m.fontBoundingBoxDescent;
    } catch (_) {}
    const baseline = r.bottom - descent;
    return { top: baseline - lh + fsz * 0.15, bottom: baseline - ascent - 1, baseline };
  }

  // Placement (opts.tagLayout):
  //  fit     → sized to fit the visible gap between the lines (at most tagFontSize), centered in the gap. If the gap is very tight
  //            it stays at the minimum size with its bottom edge on the top of the word's letters (slightly overlapping the line above).
  //  overlay → full size, bottom edge at the top of the letters (overlaps the line above).
  //  expand  → full size; the word is wrapped in an inline-block <span> with top padding, so the line box grows.
  //            (A separate spacer element before the word doesn't work: at a line end it can detach from the word and stay on the line above.)
  // t: { range, spacer? }. Returns null (word not visible) or { rect, fontSize, mid (viewport y, center of the label), changed }.
  function layout(t, opts) {
    let changed = false;
    if (opts.tagLayout !== "expand" && t.spacer) {
      unwrap(t);
      changed = true;
    }
    let r = t.range.getBoundingClientRect();
    if (t.range.collapsed || (!r.width && !r.height)) return null;
    const size = opts.tagFontSize;
    const tagH = size * LH;
    let b = inkBand(t.range, r);
    if (opts.tagLayout === "expand") {
      // Open only what is missing: label + margin − the gap already between the lines (b is computed from lh, so the padding doesn't affect it).
      if (wrap(t, Math.ceil(Math.max(0, tagH + 2 - (b.bottom - b.top))))) {
        changed = true;
        r = t.range.getBoundingClientRect();
        b = inkBand(t.range, r);
      }
    }
    let fontSize = size;
    let mid = b.bottom - tagH / 2;
    if (opts.tagLayout === "fit") {
      const room = b.bottom - b.top;
      fontSize = Math.max(MIN, Math.min(size, Math.floor(room / LH)));
      const h = fontSize * LH;
      mid = room >= h ? (b.top + b.bottom) / 2 : b.bottom - h / 2;
    }
    return { rect: r, fontSize, mid, changed };
  }

  // Adds/updates the wrapper; true if the layout changed.
  function wrap(t, pad) {
    if (!t.spacer) {
      const s = document.createElement("span");
      s.setAttribute("data-rc-spacer", "");
      try {
        t.range.surroundContents(s); // the range is within a single text node (wordAtPoint), splitting is safe
      } catch (_) {
        return false;
      }
      t.range.selectNodeContents(s);
      t.spacer = s;
    }
    if (t.spacer.dataset.pad === String(pad)) return false;
    t.spacer.dataset.pad = String(pad);
    t.spacer.style.cssText = `display:inline-block!important;padding-top:${pad}px!important;margin:0!important;border:0!important`;
    return true;
  }

  // Remove the wrapper and put the text back; the range still points to the same text.
  function unwrap(t) {
    const s = t.spacer;
    if (!s) return;
    t.spacer = null;
    const first = s.firstChild;
    const last = s.lastChild;
    s.replaceWith(...s.childNodes);
    if (first && last) {
      t.range.setStartBefore(first);
      t.range.setEndAfter(last);
    }
  }

  // Style of the label box (so the content script's shadow root and the settings preview look the same).
  const CSS_TEXT = `
    .rc-tag { position:absolute; transform:translate(-50%, -50%); max-width:240px; display:flex;
      align-items:center; white-space:nowrap; padding:.05em .35em; border-radius:.3em; cursor:pointer;
      background:var(--rc-tag-bg); color:var(--rc-tag-fg); font:600 12px/1 system-ui, "Segoe UI", sans-serif;
      box-shadow:0 1px 2px rgba(0,0,0,.2); }
    .rc-tag > span { overflow:hidden; text-overflow:ellipsis; }
    .rc-tag-err { opacity:.65; }
    .rc-tag-save { border:0; margin:0 -3px 0 3px; padding:0 2px; background:none; color:inherit; cursor:pointer;
      font:inherit; opacity:.75; }
    .rc-tag-save:hover { opacity:1; transform:scale(1.2); }
    .rc-tag-save:disabled { cursor:default; opacity:.4; transform:none; }
    .rc-tag.rc-saved .rc-tag-save { opacity:1; color:#ffd54a; }
  `;

  // Hovered / labeled word highlight (the ::highlight rule must be in the document's own stylesheet).
  const highlightCss = (opts) =>
    `::highlight(rc-hover) { background-color: ${opts.tagColor}66; }
     ::highlight(rc-tagged) { text-decoration: underline 2px ${opts.tagColor}; }`;

  globalThis.RC_TAGFIT = { MIN, LH, inkBand, layout, wrap, unwrap, CSS_TEXT, highlightCss };
})();
