// Workspace design definitions: a named set of token overrides (colour per theme, type, corner radius) layered
// on a base system. A Kage is untrusted data, so a design is too: every value is checked against a closed
// shape before it can become CSS, and the CSS is built only from that checked shape. Nothing an author types is
// ever pasted into a stylesheet — colours are re-serialised from parsed hex, fonts are looked up by name in a
// catalogue, radii are integers. That is what lets a design reach the sandboxed frame without a CSP change.
import tokens from "../../public/ds/tokens.json" with { type: "json" };
import pairs from "../design-system/contrast-pairs.json" with { type: "json" };
import { contrast, hexToRgb, round2 } from "../design-system/contrast.ts";

export const COLOR_ROLES = ["paper", "surface", "sunken", "line", "line-control", "ink", "ink-muted", "accent", "accent-ink", "accent-soft", "wire", "wire-soft", "success", "danger", "danger-soft", "focus"] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];
export type Palette = Record<ColorRole, string>;
export type DesignBase = "core" | "ledger" | "atelier";
export const DESIGN_BASES: DesignBase[] = ["core", "ledger", "atelier"];
export type Mode = "light" | "dark";

export interface DesignFonts { body?: string; display?: string; mono?: string }
export interface DesignRadius { sm?: number; md?: number; lg?: number }
/** What an author writes: only the roles they want to change. Everything else inherits from `base`. */
export interface DesignDef {
  id: string;
  name: string;
  description?: string;
  base: DesignBase;
  colors?: { light?: Partial<Palette>; dark?: Partial<Palette> };
  fonts?: DesignFonts;
  radius?: DesignRadius;
}
/** What a Kage version pins: complete, so a later edit to the design cannot restyle it. */
export interface DesignSnapshot {
  id: string;
  name: string;
  base: DesignBase;
  light: Palette;
  dark: Palette;
  fonts: DesignFonts;
  radius?: Required<DesignRadius>;
}

// --- fonts ---------------------------------------------------------------------------------------------------
// Google Fonts is the only external font origin the frame's CSP allows, so the catalogue is closed. `w` is the
// weight list each family really serves: asking Google for a weight a family lacks fails the whole stylesheet.
export type FontKind = "sans" | "serif" | "mono";
export interface FontSpec { name: string; kind: FontKind; w: string }
export const FONTS: FontSpec[] = [
  { name: "Inter", kind: "sans", w: "400;500;600;700" },
  { name: "IBM Plex Sans", kind: "sans", w: "400;500;600;700" },
  { name: "DM Sans", kind: "sans", w: "400;500;600;700" },
  { name: "Manrope", kind: "sans", w: "400;500;600;700" },
  { name: "Space Grotesk", kind: "sans", w: "400;500;600;700" },
  { name: "Work Sans", kind: "sans", w: "400;500;600;700" },
  { name: "Poppins", kind: "sans", w: "400;500;600;700" },
  { name: "Nunito", kind: "sans", w: "400;600;700" },
  { name: "Outfit", kind: "sans", w: "400;500;600;700" },
  { name: "Plus Jakarta Sans", kind: "sans", w: "400;500;600;700" },
  { name: "Source Sans 3", kind: "sans", w: "400;600;700" },
  { name: "Roboto", kind: "sans", w: "400;500;700" },
  { name: "Bricolage Grotesque", kind: "sans", w: "500;600;700" },
  { name: "Fraunces", kind: "serif", w: "400;500;600" },
  { name: "Playfair Display", kind: "serif", w: "400;500;600;700" },
  { name: "Lora", kind: "serif", w: "400;500;600;700" },
  { name: "Merriweather", kind: "serif", w: "400;700" },
  { name: "Source Serif 4", kind: "serif", w: "400;600;700" },
  { name: "Libre Baskerville", kind: "serif", w: "400;700" },
  { name: "DM Serif Display", kind: "serif", w: "400" },
  { name: "IBM Plex Mono", kind: "mono", w: "400;500;600" },
  { name: "JetBrains Mono", kind: "mono", w: "400;500;700" },
  { name: "Roboto Mono", kind: "mono", w: "400;500;700" },
  { name: "Fira Code", kind: "mono", w: "400;500;600" },
  { name: "Space Mono", kind: "mono", w: "400;700" },
];
const FONT_BY_NAME = new Map(FONTS.map((f) => [f.name, f]));
const FALLBACK: Record<FontKind, string> = {
  sans: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
};
const fontStack = (name: string) => `"${name}", ${FALLBACK[FONT_BY_NAME.get(name)!.kind]}`;

// --- base palettes, read from the same tokens the systems are built from ---------------------------------------
type TokenRow = { name: string; value: { light: string; dark: string } };
const colorRows = (tokens as { color: { tokens: TokenRow[] } }).color.tokens;
const prefix = (base: DesignBase) => (base === "core" ? "" : base + "-");

export function basePalette(base: DesignBase, mode: Mode): Palette {
  const out = {} as Palette;
  for (const role of COLOR_ROLES) {
    const row = colorRows.find((r) => r.name === prefix(base) + role);
    out[role] = row ? row.value[mode] : "#000000";
  }
  return out;
}

/** The corner radii a system uses, so a design that leaves radius alone changes nothing about shape. */
export function baseRadius(base: DesignBase): Required<DesignRadius> {
  const px = (n: string) => parseInt((((tokens as { radius: { tokens: { name: string; value: string }[] } }).radius.tokens.find((t) => t.name === n)?.value) ?? "0px"), 10);
  if (base === "ledger") return { sm: px("ledger-radius-sm"), md: px("ledger-radius-sm"), lg: px("ledger-radius-sm") };
  if (base === "atelier") return { sm: px("atelier-radius-md"), md: px("atelier-radius-md"), lg: px("atelier-radius-lg") };
  return { sm: px("radius-sm"), md: px("radius-md"), lg: px("radius-lg") };
}

// --- validation ------------------------------------------------------------------------------------------------
export const MAX_RADIUS = 40;
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const isObj = (v: unknown): v is Record<string, unknown> => v != null && typeof v === "object" && !Array.isArray(v);

/** #rgb / #rrggbb → lowercase #rrggbb, or null. Re-serialising is what keeps injected text out of the stylesheet. */
export function normalizeHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const rgb = hexToRgb(v);
  return rgb ? "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join("") : null;
}

export type DesignResult = { ok: true; design: DesignDef } | { ok: false; errors: string[] };

export function validateDesign(input: unknown): DesignResult {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["a design is an object"] };
  const known = new Set(["id", "name", "description", "base", "colors", "fonts", "radius"]);
  for (const k of Object.keys(input)) if (!known.has(k)) errors.push(`unknown field '${k}'`);
  const id = input.id, name = typeof input.name === "string" ? input.name.trim() : "";
  if (typeof id !== "string" || !ID.test(id)) errors.push("id is 1-40 characters: lowercase letters, digits and hyphens, starting with a letter or digit");
  if (!name || name.length > 60) errors.push("name is required, up to 60 characters");
  if (input.description !== undefined && (typeof input.description !== "string" || input.description.length > 200)) errors.push("description is text of at most 200 characters");
  if (!DESIGN_BASES.includes(input.base as DesignBase)) errors.push(`base is one of ${DESIGN_BASES.join(", ")}`);

  const colors: DesignDef["colors"] = {};
  if (input.colors !== undefined) {
    if (!isObj(input.colors)) errors.push("colors is an object with light and dark");
    else for (const [mode, set] of Object.entries(input.colors)) {
      if (mode !== "light" && mode !== "dark") { errors.push(`colors.${mode}: only light and dark exist`); continue; }
      if (!isObj(set)) { errors.push(`colors.${mode} is an object of role: hex`); continue; }
      const out: Partial<Palette> = {};
      for (const [role, value] of Object.entries(set)) {
        if (!(COLOR_ROLES as readonly string[]).includes(role)) { errors.push(`colors.${mode}.${role}: unknown role (use ${COLOR_ROLES.join(", ")})`); continue; }
        const hex = normalizeHex(value);
        if (!hex) errors.push(`colors.${mode}.${role}: '${String(value).slice(0, 24)}' is not a hex colour like #1a2b3c`);
        else out[role as ColorRole] = hex;
      }
      colors[mode] = out;
    }
  }

  const fonts: DesignFonts = {};
  if (input.fonts !== undefined) {
    if (!isObj(input.fonts)) errors.push("fonts is an object with body, display and mono");
    else for (const [slot, value] of Object.entries(input.fonts)) {
      if (slot !== "body" && slot !== "display" && slot !== "mono") { errors.push(`fonts.${slot}: only body, display and mono exist`); continue; }
      if (typeof value !== "string" || !FONT_BY_NAME.has(value)) errors.push(`fonts.${slot}: '${String(value).slice(0, 30)}' is not in the font list (${FONTS.map((f) => f.name).join(", ")})`);
      else fonts[slot] = value;
    }
  }

  const radius: DesignRadius = {};
  if (input.radius !== undefined) {
    if (!isObj(input.radius)) errors.push("radius is an object with sm, md and lg");
    else for (const [k, v] of Object.entries(input.radius)) {
      if (k !== "sm" && k !== "md" && k !== "lg") { errors.push(`radius.${k}: only sm, md and lg exist`); continue; }
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_RADIUS) errors.push(`radius.${k} is a whole number of pixels from 0 to ${MAX_RADIUS}`);
      else radius[k] = v;
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, design: {
    id: id as string, name, ...(typeof input.description === "string" && input.description ? { description: input.description } : {}), base: input.base as DesignBase,
    ...(Object.keys(colors).length ? { colors } : {}), ...(Object.keys(fonts).length ? { fonts } : {}), ...(Object.keys(radius).length ? { radius } : {}),
  } };
}

// --- resolution and contrast -----------------------------------------------------------------------------------
export function resolveDesign(def: DesignDef): DesignSnapshot {
  const light = { ...basePalette(def.base, "light"), ...(def.colors?.light ?? {}) };
  const dark = { ...basePalette(def.base, "dark"), ...(def.colors?.dark ?? {}) };
  const r = def.radius && Object.keys(def.radius).length ? { ...baseRadius(def.base), ...def.radius } : undefined;
  return { id: def.id, name: def.name, base: def.base, light, dark, fonts: { ...(def.fonts ?? {}) }, ...(r ? { radius: r } : {}) };
}

export interface ContrastRow { mode: Mode; text: ColorRole; on: ColorRole; min: number; ratio: number; ok: boolean; role: string }
/** The same 21 pairs every built-in system must keep readable, checked for this design in both themes. */
export function designContrast(d: DesignSnapshot): ContrastRow[] {
  const rows: ContrastRow[] = [];
  for (const mode of ["light", "dark"] as const) for (const p of pairs.pairs) {
    const ratio = round2(contrast(d[mode][p.text as ColorRole], d[mode][p.on as ColorRole]));
    rows.push({ mode, text: p.text as ColorRole, on: p.on as ColorRole, min: p.min, ratio, ok: ratio >= p.min, role: p.role });
  }
  return rows;
}

// --- CSS -------------------------------------------------------------------------------------------------------
export function googleFontsUrl(fonts: DesignFonts): string | null {
  const names = [...new Set(Object.values(fonts))];
  if (!names.length) return null;
  return "https://fonts.googleapis.com/css2?" + names.map((n) => `family=${n.replace(/ /g, "+")}:wght@${FONT_BY_NAME.get(n)!.w}`).join("&") + "&display=swap";
}

/** A stylesheet for one design. `.kg-kage.kg-design` out-specifies a system class, and the dark rule out-specifies that,
 *  so every role is complete in both themes and a half-specified design can never show a light colour on a dark page. */
export function designCss(d: DesignSnapshot): string {
  const vars = (p: Palette) => COLOR_ROLES.map((r) => `--kg-${r}:${p[r]};`).join("");
  const type: string[] = [];
  if (d.fonts.body) type.push(`--kg-font-body:${fontStack(d.fonts.body)};--font-sans:${fontStack(d.fonts.body)};`);
  if (d.fonts.display) type.push(`--kg-font-display:${fontStack(d.fonts.display)};--font-display:${fontStack(d.fonts.display)};`);
  if (d.fonts.mono) type.push(`--kg-font-mono:${fontStack(d.fonts.mono)};--font-mono:${fontStack(d.fonts.mono)};`);
  const shape = d.radius ? `--kg-r-sm:${d.radius.sm}px;--kg-r-md:${d.radius.md}px;--kg-r-lg:${d.radius.lg}px;` : "";
  const url = googleFontsUrl(d.fonts);
  return (url ? `@import url("${url}");\n` : "") + `.kg-kage.kg-design{${vars(d.light)}${type.join("")}${shape}}\n.dark .kg-kage.kg-design{${vars(d.dark)}}`;
}

/** A snapshot read back from a stored document is data like any other; rebuild it through the same checks. */
export function readSnapshot(v: unknown): DesignSnapshot | undefined {
  if (!isObj(v) || !isObj(v.light) || !isObj(v.dark)) return undefined;
  const parsed = validateDesign({ id: v.id, name: v.name, base: v.base, colors: { light: v.light, dark: v.dark }, ...(isObj(v.fonts) ? { fonts: v.fonts } : {}), ...(isObj(v.radius) ? { radius: v.radius } : {}) });
  if (!parsed.ok) return undefined;
  return resolveDesign(parsed.design);
}

// --- brand colour → full palette ---------------------------------------------------------------------------------
type HSL = [number, number, number];
function rgbToHsl([r, g, b]: [number, number, number]): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToHex([h, s, l]: HSL): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
}
/** Move a colour's lightness away from its grounds in 1% steps until it clears `min` against all of them. */
function reach(hsl: HSL, grounds: string[], min: number, toward: 1 | -1): string {
  let [h, s, l] = hsl;
  for (let i = 0; i <= 100; i++) {
    const hex = hslToHex([h, s, l]);
    if (grounds.every((g) => contrast(hex, g) >= min)) return hex;
    l = Math.max(0, Math.min(1, l + toward * 0.01));
  }
  return hslToHex([h, s, toward === 1 ? 1 : 0]);
}

/** One brand colour → a complete, contrast-checked palette for both themes, in the way shadcn-style generators do:
 *  hold the hue, derive the grounds and lines from it, then nudge each text colour until its pairs pass. */
export function paletteFromBrand(brand: string): { light: Palette; dark: Palette } | null {
  const hex = normalizeHex(brand);
  if (!hex) return null;
  const [h, s0] = rgbToHsl(hexToRgb(hex)!);
  const tint = Math.min(0.25, Math.max(0.05, s0 * 0.25)); // brand-tinted neutrals, never garish
  const build = (mode: Mode): Palette => {
    const dk = mode === "dark";
    const paper = hslToHex([h, tint, dk ? 0.08 : 0.96]);
    const surface = hslToHex([h, tint, dk ? 0.11 : 0.995]);
    const sunken = hslToHex([h, tint, dk ? 0.14 : 0.92]);
    const grounds = [paper, surface, sunken];
    const toward: 1 | -1 = dk ? 1 : -1;
    const ink = reach([h, tint, dk ? 0.93 : 0.1], grounds, 12, toward);
    const inkMuted = reach([h, tint * 0.6, dk ? 0.7 : 0.38], grounds, 4.6, toward);
    const accent = reach([h, Math.max(0.45, s0), dk ? 0.65 : 0.4], grounds, 4.6, toward);
    const accentInk = contrast("#ffffff", accent) >= 4.5 ? "#ffffff" : contrast("#111111", accent) >= 4.5 ? "#111111" : reach([h, 0.2, dk ? 0.05 : 0.98], [accent], 4.5, dk ? -1 : 1);
    const accentSoft = reach([h, Math.max(0.35, s0 * 0.6), dk ? 0.2 : 0.9], [ink], 4.5, dk ? -1 : 1);
    const success = reach([140, 0.55, dk ? 0.65 : 0.3], grounds, 4.6, toward);
    const danger = reach([2, 0.65, dk ? 0.68 : 0.42], grounds, 4.6, toward);
    const dangerSoft = reach([2, 0.5, dk ? 0.22 : 0.92], [ink], 4.5, dk ? -1 : 1);
    const lineControl = reach([h, tint * 0.8, dk ? 0.5 : 0.55], [paper, surface], 3.1, toward);
    const line = hslToHex([h, tint * 0.8, dk ? 0.22 : 0.84]);
    const wire = reach([h, Math.max(0.3, s0 * 0.7), dk ? 0.6 : 0.45], [paper], 3.1, toward);
    const wireSoft = reach([h, Math.max(0.25, s0 * 0.5), dk ? 0.2 : 0.9], [ink], 4.5, dk ? -1 : 1);
    return { paper, surface, sunken, line, "line-control": lineControl, ink, "ink-muted": inkMuted, accent, "accent-ink": accentInk, "accent-soft": accentSoft, wire, "wire-soft": wireSoft, success, danger, "danger-soft": dangerSoft, focus: reach([h, Math.max(0.5, s0), dk ? 0.68 : 0.42], [paper, surface], 3.1, toward) };
  };
  return { light: build("light"), dark: build("dark") };
}
