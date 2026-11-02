// Measurements cross the frame boundary as data; the host never inspects frame DOM.
export function measurePage() {
  const de = document.documentElement, vw = window.innerWidth, root = document.querySelector('.kg-kage') || document.body;
  const label = (e) => { const b = e.closest('[data-block]'); return b ? '@' + b.getAttribute('data-block') : e.tagName.toLowerCase(); };
  const over = new Set();
  for (const e of root.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.right > vw + 1 && getComputedStyle(e).position !== 'fixed') over.add(label(e)); if (over.size > 6) break; }
  return {
    innerWidth: vw, scrollWidth: de.scrollWidth,
    // The tallest of three honest answers: a single read of scrollHeight taken
    // while late layout was still settling once cut a page off mid-way.
    scrollHeight: Math.ceil(Math.max(de.scrollHeight, document.body.scrollHeight, ...[...root.querySelectorAll('*')].map((e) => e.getBoundingClientRect().bottom + window.scrollY))),
    blocks: document.querySelectorAll('[data-block]').length,
    missing: [...document.querySelectorAll('.kg-missing, .kg-boundary__error')].map((e) => e.textContent.trim().slice(0, 160)),
    brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => (i.currentSrc || i.src).slice(0, 80)),
    overflowing: [...over],
    clippedText: (() => {
      // Compare in SVG parent coordinates, not viewport coordinates: a contained
      // phone viewport intentionally shows only part of the drawing. Actual font
      // bounds still reveal text leaking out of its own card or canvas.
      const out = [];
      for (const text of root.querySelectorAll('.kg-boundary text')) {
        if (!text.getClientRects().length || !text.getBoundingClientRect().width) continue;
        const rect = text.parentElement.querySelector(':scope > rect');
        if (!rect) continue;
        const box = text.getBBox(), bounds = rect.getBBox();
        if (box.x < bounds.x - 1 || box.y < bounds.y - 1 || box.x + box.width > bounds.x + bounds.width + 1 || box.y + box.height > bounds.y + bounds.height + 1) out.push(label(text) + ': ' + text.textContent.trim().slice(0, 80));
        if (out.length >= 20) break;
      }
      return out;
    })(),
    occludedText: (() => {
      // DOM order is paint order for this trusted SVG vocabulary. Viewport boxes
      // put nested translations in one coordinate space; contained scrolling
      // shifts text and rectangles equally and does not create false overlaps.
      const out = [];
      for (const svg of root.querySelectorAll('.kg-boundary svg')) {
        const rectangles = [...svg.querySelectorAll('rect')].filter(rect => {
          const style = getComputedStyle(rect);
          return rect.getClientRects().length && style.visibility === 'visible' && style.fill !== 'none' && !/rgba\([^)]*,\s*0\s*\)/.test(style.fill) && Number(style.fillOpacity) === 1 && Number(style.opacity) === 1;
        });
        for (const text of svg.querySelectorAll('text')) {
          const box = text.getBoundingClientRect(); if (!box.width || !box.height) continue;
          if (rectangles.some(rect => {
            if (!(text.compareDocumentPosition(rect) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
            const cover = rect.getBoundingClientRect();
            return box.left < cover.right && box.right > cover.left && box.top < cover.bottom && box.bottom > cover.top;
          })) out.push(label(text) + ': ' + text.textContent.trim().slice(0, 80));
          if (out.length >= 20) return out;
        }
      }
      return out;
    })(),
    tinyText: (() => {
      // An SVG with a viewBox scales its text by (rendered width / viewBox width).
      const out = [];
      for (const svg of root.querySelectorAll('svg[viewBox]')) {
        const vb = svg.viewBox.baseVal; if (!vb || !vb.width) continue;
        // Responsive diagrams keep an alternate layout hidden; it has no rendered text.
        const width = svg.getBoundingClientRect().width; if (!width || !svg.getClientRects().length) continue;
        const k = width / vb.width; let min = Infinity;
        for (const t of svg.querySelectorAll('text')) { const fs = parseFloat(t.getAttribute('font-size') || getComputedStyle(t).fontSize) || 16; min = Math.min(min, fs * k); }
        if (min < 8) out.push(label(svg) + ' ' + (Math.round(min * 10) / 10) + 'px');
      }
      return out;
    })(),
  };
}
