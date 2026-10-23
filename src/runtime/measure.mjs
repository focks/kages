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
    missing: [...document.querySelectorAll('.kg-missing')].map((e) => e.textContent.trim().slice(0, 160)),
    brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => (i.currentSrc || i.src).slice(0, 80)),
    overflowing: [...over],
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
