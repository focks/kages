// WCAG 2.x contrast maths. Pure, so the system cards, the contrast check and the
// tests all compute ratios the same way. Token colours are all hex strings, so no
// colour-space library is needed; anything else is reported, never guessed.

export type RGB = [number, number, number];

/** #rgb or #rrggbb → [r,g,b] (0–255); null for anything else. */
export function hexToRgb(hex: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function relativeLuminance([r, g, b]: RGB): number {
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio, 1–21. NaN when either colour is not a hex string. */
export function contrast(a: string, b: string): number {
  const x = hexToRgb(a), y = hexToRgb(b);
  if (!x || !y) return NaN;
  const [hi, lo] = [relativeLuminance(x), relativeLuminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
