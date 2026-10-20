// The pure side of the design editor: form shape, role labels, slugs and the sample page the live preview renders.
// Kept free of React so the rules (what counts as a valid id, what a role is for) are tested without a browser.
import { COLOR_ROLES, resolveDesign, type ColorRole, type DesignBase, type DesignDef, type DesignSnapshot, type Mode, type Palette } from "../../../engine/design.ts";
import type { KageDoc } from "../../../engine/types.ts";

export interface RoleGroup { title: string; roles: { role: ColorRole; label: string; help: string }[] }
export const ROLE_GROUPS: RoleGroup[] = [
  { title: "Surfaces", roles: [
    { role: "paper", label: "Page", help: "Behind everything" },
    { role: "surface", label: "Card", help: "Cards, inputs, menus" },
    { role: "sunken", label: "Recessed", help: "Code blocks, table headers" },
    { role: "line", label: "Divider", help: "Hairlines between regions" },
    { role: "line-control", label: "Control border", help: "Input and button outlines (3:1)" },
  ] },
  { title: "Text", roles: [
    { role: "ink", label: "Text", help: "Body copy (4.5:1)" },
    { role: "ink-muted", label: "Muted text", help: "Captions and secondary labels (4.5:1)" },
  ] },
  { title: "Accent", roles: [
    { role: "accent", label: "Accent", help: "Links, primary buttons, highlights (4.5:1)" },
    { role: "accent-ink", label: "On accent", help: "Label on a filled accent button (4.5:1)" },
    { role: "accent-soft", label: "Accent tint", help: "Soft accent fills" },
    { role: "wire", label: "Wire", help: "Diagram and chart strokes (3:1)" },
    { role: "wire-soft", label: "Wire tint", help: "Soft wire fills" },
    { role: "focus", label: "Focus ring", help: "Keyboard focus (3:1)" },
  ] },
  { title: "Status", roles: [
    { role: "success", label: "Success", help: "Positive text (4.5:1)" },
    { role: "danger", label: "Danger", help: "Error text (4.5:1)" },
    { role: "danger-soft", label: "Danger tint", help: "Soft danger fills" },
  ] },
];

export const RADIUS_PRESETS: { label: string; sm: number; md: number; lg: number }[] = [
  { label: "Sharp", sm: 0, md: 0, lg: 0 },
  { label: "Soft", sm: 3, md: 6, lg: 10 },
  { label: "Round", sm: 8, md: 14, lg: 22 },
];

export interface EditorState {
  id: string;
  name: string;
  description: string;
  base: DesignBase;
  light: Palette;
  dark: Palette;
  fonts: { body: string; display: string; mono: string };
  radius: { on: boolean; sm: number; md: number; lg: number };
  isDefault: boolean;
  /** null = a new design */
  revision: number | null;
}

/** A blank editor starts from a system's own palette, so "new" already looks like something. */
export function blankState(base: DesignBase, snap: DesignSnapshot): EditorState {
  return { id: "", name: "", description: "", base, light: { ...snap.light }, dark: { ...snap.dark }, fonts: { body: "", display: "", mono: "" }, radius: { on: false, sm: 3, md: 6, lg: 10 }, isDefault: false, revision: null };
}

export function stateFromRecord(rec: { def: DesignDef; revision: number; default?: boolean }, snap: DesignSnapshot): EditorState {
  return {
    id: rec.def.id, name: rec.def.name, description: rec.def.description ?? "", base: rec.def.base, light: { ...snap.light }, dark: { ...snap.dark },
    fonts: { body: rec.def.fonts?.body ?? "", display: rec.def.fonts?.display ?? "", mono: rec.def.fonts?.mono ?? "" },
    radius: { on: !!rec.def.radius, sm: snap.radius?.sm ?? 3, md: snap.radius?.md ?? 6, lg: snap.radius?.lg ?? 10 },
    isDefault: !!rec.default, revision: rec.revision,
  };
}

/** Only what differs from the base is sent, so a design keeps inheriting whatever it did not change. */
export function toDefinition(s: EditorState, basePal: Record<Mode, Palette>): DesignDef {
  const diff = (mode: Mode) => Object.fromEntries(COLOR_ROLES.filter((r) => s[mode][r].toLowerCase() !== basePal[mode][r].toLowerCase()).map((r) => [r, s[mode][r]])) as Partial<Palette>;
  const light = diff("light"), dark = diff("dark");
  const fonts = Object.fromEntries(Object.entries(s.fonts).filter(([, v]) => v)) as DesignDef["fonts"];
  return {
    id: s.id, name: s.name.trim(), ...(s.description.trim() ? { description: s.description.trim() } : {}), base: s.base,
    ...(Object.keys(light).length || Object.keys(dark).length ? { colors: { ...(Object.keys(light).length ? { light } : {}), ...(Object.keys(dark).length ? { dark } : {}) } } : {}),
    ...(fonts && Object.keys(fonts).length ? { fonts } : {}),
    ...(s.radius.on ? { radius: { sm: s.radius.sm, md: s.radius.md, lg: s.radius.lg } } : {}),
  };
}

export function snapshotOf(s: EditorState): DesignSnapshot {
  return resolveDesign({ id: s.id || "preview", name: s.name || "Preview", base: s.base, colors: { light: s.light, dark: s.dark }, ...(Object.values(s.fonts).some(Boolean) ? { fonts: Object.fromEntries(Object.entries(s.fonts).filter(([, v]) => v)) } : {}), ...(s.radius.on ? { radius: { sm: s.radius.sm, md: s.radius.md, lg: s.radius.lg } } : {}) });
}

/** "Brand Blue!" → "brand-blue"; the id a person would type anyway. */
export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/** A page that touches every colour role, both type families and the corner radii: a card with a heading and mono
 *  figure, a chart-free stat row, form controls, a table with a recessed header, a status alert and code. */
export function previewDoc(base: DesignBase): KageDoc {
  return {
    kages: "1", id: "design-preview", title: "Design preview", system: `${base}@1`, root: "page",
    state: { name: "Ada", plan: "pro" },
    blocks: {
      page: { type: "page", props: { width: "full", gap: 4 }, slots: { children: ["hero", "stats", "controls", "table", "note", "snippet"] } },
      hero: { type: "section", props: { title: "Quarterly review", description: "Muted text sits under a heading; the link below uses the accent." }, slots: { children: ["heroLink"] } },
      heroLink: { type: "link", props: { label: "Read the full report", href: "#" } },
      stats: { type: "grid", props: { columns: 3, minSize: "small", gap: 3 }, slots: { children: ["s1", "s2", "s3"] } },
      s1: { type: "stat", props: { label: "Revenue", value: 48200, format: "currency", delta: 0.12, caption: "vs last quarter" } },
      s2: { type: "stat", props: { label: "Active users", value: 1840, format: "number", delta: -0.04, caption: "30 days" } },
      s3: { type: "stat", props: { label: "Plan", value: "Pro", format: "text", caption: "renews monthly" } },
      controls: { type: "stack", props: { direction: "row", gap: 3, wrap: true, align: "end" }, slots: { children: ["field", "pick", "go", "ghost", "tag"] } },
      field: { type: "text-input", props: { label: "Name", placeholder: "Type here" }, bind: { value: { $state: "name" } } },
      pick: { type: "dropdown", props: { label: "Plan", options: [{ value: "free", label: "Free" }, { value: "pro", label: "Pro" }] }, bind: { value: { $state: "plan" } } },
      go: { type: "button", props: { label: "Save changes", variant: "primary" }, on: { click: [{ do: "set", path: "name", value: "Saved" }] } },
      ghost: { type: "button", props: { label: "Cancel", variant: "secondary" }, on: { click: [{ do: "set", path: "name", value: "" }] } },
      tag: { type: "badge", props: { label: "Beta", tone: "accent" } },
      table: { type: "table", props: { columns: [{ key: "team", label: "Team" }, { key: "owner", label: "Owner" }, { key: "score", label: "Score", align: "right" }], rows: [{ team: "Platform", owner: "Ada", score: 92 }, { team: "Growth", owner: "Lin", score: 78 }] } },
      note: { type: "alert", props: { tone: "danger", title: "Heads up", text: "Danger text and its tint use the status colours." } },
      snippet: { type: "code", props: { language: "ts", code: "const total = items.reduce((a, b) => a + b.price, 0); // mono" } },
    },
  } as KageDoc;
}
