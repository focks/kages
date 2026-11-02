// Named palettes are compiled into the bundle, never accepted as arbitrary CSS.
// The same recipes colour sections and diagram nodes, keeping their meaning
// stable across an artifact and their text readable in both themes.
import { paletteFromBrand, COLOR_ROLES } from "../engine/design.ts";
import { contrast, hexToRgb } from "./contrast.ts";

// A section places links and focus rings directly on accent-soft, a ground the
// workspace palette generator does not check for those roles. Move the accent
// toward the already-readable ink until it clears every region ground.
function regionColors(brand: string) {
  const palette = paletteFromBrand(brand)!;
  for (const mode of ["light", "dark"] as const) {
    const p = palette[mode], original = hexToRgb(p.accent)!, ink = hexToRgb(p.ink)!;
    const grounds = [p.paper, p.surface, p.sunken, p["accent-soft"]];
    for (let step = 0; step <= 100 && grounds.some(g => contrast(p.accent, g) < 4.5); step++) {
      p.accent = "#" + original.map((value, i) => Math.round(value + (ink[i] - value) * step / 100).toString(16).padStart(2, "0")).join("");
    }
    p["accent-ink"] = contrast("#ffffff", p.accent) >= 4.5 ? "#ffffff" : "#111111";
    p.focus = p.accent;
    p["line-control"] = p["ink-muted"];
  }
  return palette;
}

export const PRESENTATION_PALETTES = {
  ocean: regionColors("#2563eb"),
  mint: regionColors("#0d9488"),
  violet: regionColors("#7c3aed"),
  amber: regionColors("#d97706"),
  rose: regionColors("#e11d48"),
};

/** Every region resets all colour roles, so a nested palette cannot inherit a mismatched text or focus colour. */
export function presentationCss(): string {
  return Object.entries(PRESENTATION_PALETTES).flatMap(([name, palette]) =>
    (["light", "dark"] as const).map(theme => `${theme === "dark" ? ".dark " : ""}.kg-kage .kg-palette-${name} {\n${COLOR_ROLES.map(role => `  --kg-${role}: ${palette[theme][role]};`).join("\n")}\n}`)
  ).join("\n");
}

// Technical drawings share a quiet neutral canvas and two semantic channels:
// blue for requests, amber for writes. Kept outside the region palette enum so
// adding this form cannot restyle existing sections or graph nodes. The warm
// cell text stays separate from the cool neutral text on the main canvas.
export const BOUNDARY_PALETTE = {
  light: { ...PRESENTATION_PALETTES.ocean.light, 'write-text': '#454f5d', paper: '#f7f8fa', surface: '#ffffff', sunken: '#eceff3', ink: '#202630', 'ink-muted': '#454f5d', line: '#cbd1d9', 'line-control': '#65717f', accent: '#875000', 'accent-soft': '#fff0d9', 'accent-ink': '#ffffff', wire: '#2453a4', 'wire-soft': '#e0eaff', focus: '#2453a4' },
  dark: { ...PRESENTATION_PALETTES.ocean.dark, 'write-text': '#d2c9c6', paper: '#181b22', surface: '#181b22', sunken: '#20252b', ink: '#e9edf2', 'ink-muted': '#c5cad2', line: '#30363f', 'line-control': '#8d96a2', accent: '#e9ad56', 'accent-soft': '#382710', 'accent-ink': '#181b22', wire: '#84a7ff', 'wire-soft': '#222b45', focus: '#84a7ff' },
};

/** Scope the technical palette to its new role so old artifacts keep their
 * original colours. Every paint still comes from a checked theme token. */
export function boundaryCss(): string {
  return (['light', 'dark'] as const).map(theme => `${theme === 'dark' ? '.dark ' : ''}.kg-kage:not(.kg-design) .kg-boundary {\n${COLOR_ROLES.map(role => `  --kg-${role}: ${BOUNDARY_PALETTE[theme][role]};`).join('\n')}\n  --kg-boundary-write-text: ${BOUNDARY_PALETTE[theme]['write-text']};\n}`).join('\n');
}
