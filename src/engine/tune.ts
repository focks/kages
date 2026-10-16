// Controlled intensity steps: make a page one rung bolder or quieter by moving
// declared semantic props along their ladders, and nothing else. A deterministic
// transform over a finite set of enums is safer and cheaper than asking a model to
// rewrite a page, and its result is a reviewable JSON Patch. Pure.
//
// What it never touches: copy, data, state, wiring, heading levels, alert and badge
// tones, danger buttons, or any prop that is bound (computed). Each ladder clamps, so
// repeating a step converges and then does nothing.
import { modeOf } from "./mode.ts";
import type { Block, KageDoc, Mode } from "./types.ts";

export type Direction = "quieter" | "bolder";
export interface Knob { block: string; prop: string; from: unknown; to: unknown; rule: string }
export interface MigrationPatchOp { op: "add" | "replace"; path: string; value: unknown }
export interface Skipped { block?: string; rule: string; reason: string }
export interface TunePlan {
  direction: Direction; amount: number; scope: string; mode: Mode; modeSource: "declared" | "inferred";
  patch: MigrationPatchOp[]; knobs: Knob[]; skipped: Skipped[]; summary: string[];
  loudness: { before: number; after: number };
}
export interface TuneOptions { direction: Direction; amount?: number; scope?: string }

const STEPS = [0, 1, 2, 3, 4, 6, 8] as const;
const WIDTH = ["reading", "wide", "full"] as const;
const MINSIZE = ["small", "medium", "large"] as const;
const TEXT = ["caption", "muted", "body", "heading", "title", "display"] as const;
const BUTTON = ["quiet", "secondary", "primary"] as const;
/** surface and sunken are the same rung: both are a quiet tint. */
const toneRank = (t: unknown) => (t === "accent" ? 2 : t === "surface" || t === "sunken" ? 1 : 0);
const TONE_AT = ["plain", "surface", "accent"] as const;
const PERSUASIVE: readonly Mode[] = ["persuade", "experience"];

const num = (v: unknown): number | undefined => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined);
/** Step along STEPS keeping the value's type (the document may store 3 or "3"). */
function stepValue(v: unknown, by: number, floor: number, cap: number): unknown {
  const n = num(v);
  if (n === undefined) return v;
  const i = STEPS.indexOf(n as (typeof STEPS)[number]);
  if (i < 0) return v;
  const next = STEPS[Math.max(0, Math.min(STEPS.length - 1, i + by))];
  const clamped = by < 0 ? Math.max(next, Math.min(floor, n)) : Math.min(next, Math.max(cap, n));
  return typeof v === "string" ? String(clamped) : clamped;
}

interface Walk { order: string[]; parent: Map<string, string> }
function walk(doc: KageDoc): Walk {
  const order: string[] = [], parent = new Map<string, string>(), seen = new Set<string>();
  const visit = (id: string) => {
    const b = doc.blocks[id];
    if (!b || seen.has(id)) return;
    seen.add(id); order.push(id);
    for (const kids of Object.values(b.slots ?? {})) if (Array.isArray(kids)) for (const k of kids) { if (!parent.has(k)) parent.set(k, id); visit(k); }
  };
  if (doc.root) visit(doc.root);
  return { order, parent };
}

function subtree(doc: KageDoc, id: string): Set<string> {
  const out = new Set<string>(), go = (x: string) => { if (out.has(x) || !doc.blocks[x]) return; out.add(x); for (const kids of Object.values(doc.blocks[x].slots ?? {})) if (Array.isArray(kids)) kids.forEach(go); };
  go(id);
  return out;
}

/** How loud the page is: a weighted sum of ladder positions. A step along any ladder
 *  changes it in the same direction, which is what the monotonic test relies on. */
export function loudness(doc: KageDoc): number {
  let sum = 0;
  for (const raw of Object.values(doc.blocks ?? {})) {
    const b = raw as Block;
    if (!b || typeof b !== "object") continue;
    const p = (b.props ?? {}) as Record<string, unknown>;
    if (b.type === "section") { sum += toneRank(p.tone) * 3; sum += stepIndex(p.inset); }
    if (b.type === "page") { sum += stepIndex(p.gap); sum += Math.max(0, WIDTH.indexOf(p.width as never)) * 2; }
    if (b.type === "grid") sum += Math.max(0, MINSIZE.indexOf(p.minSize as never)) * 0.5;
    if (b.type === "text") sum += Math.max(0, TEXT.indexOf(p.variant as never)) * 0.5;
    if (b.type === "button") sum += Math.max(0, BUTTON.indexOf((p.variant ?? "secondary") as never)) * 1.5;
  }
  return Math.round(sum * 100) / 100;
}
const stepIndex = (v: unknown) => { const n = num(v); const i = n === undefined ? -1 : STEPS.indexOf(n as never); return i < 0 ? 0 : i; };

export function tune(doc: KageDoc, opts: TuneOptions): TunePlan {
  const amount = Math.max(1, Math.min(3, Math.floor(opts.amount ?? 1)));
  const scope = opts.scope && opts.scope !== "doc" ? opts.scope : "doc";
  const m = modeOf(doc);
  const mode = m.mode;
  const persuasive = PERSUASIVE.includes(mode);
  const { order, parent } = walk(doc);
  const inScope = scope === "doc" ? new Set(order) : subtree(doc, scope);
  const knobs: Knob[] = [], skipped: Skipped[] = [], patch: MigrationPatchOp[] = [];
  const planned = new Map<string, unknown>(); // "block.prop" → value after earlier rules in this run
  const blocks = doc.blocks as Record<string, Block>;
  const get = (id: string, prop: string) => (planned.has(id + "." + prop) ? planned.get(id + "." + prop) : (blocks[id].props as Record<string, unknown> | undefined)?.[prop]);
  const set = (id: string, prop: string, to: unknown, rule: string): boolean => {
    const b = blocks[id];
    if (b.bind && prop in b.bind) { skipped.push({ block: id, rule, reason: `${prop} is bound, so it is computed` }); return false; }
    const from = get(id, prop);
    if (from === to) return false;
    const had = b.props && prop in b.props;
    const prior = knobs.find((k) => k.block === id && k.prop === prop);
    if (prior) { prior.to = to; const op = patch.find((o) => o.path === `/blocks/${id}/props/${prop}`); if (op) op.value = to; }
    else { knobs.push({ block: id, prop, from, to, rule }); patch.push({ op: had ? "replace" : "add", path: `/blocks/${id}/props/${prop}`, value: to }); }
    planned.set(id + "." + prop, to);
    return true;
  };
  const sections = order.filter((id) => blocks[id].type === "section" && inScope.has(id));
  const pages = order.filter((id) => blocks[id].type === "page" && inScope.has(id));
  const hero = sections[0];
  const typeOf = (id: string) => blocks[id].type;

  if (opts.direction === "quieter") {
    // 1. section tone down a rung per amount; the hero keeps its identity at amount 1 in persuasive pages.
    for (const id of sections) {
      if (id === hero && persuasive && amount === 1) { if (toneRank(get(id, "tone")) > 0) skipped.push({ block: id, rule: "section-tone", reason: "the hero keeps its tone at amount 1 on a persuasive page" }); continue; }
      const r = toneRank(get(id, "tone")), to = TONE_AT[Math.max(0, r - amount)];
      if (r > 0) set(id, "tone", to === "plain" ? "plain" : to, "section-tone");
    }
    // 2. breathing room: inset and page gap down a step, never below 2.
    for (const id of sections) { const v = get(id, "inset"); if (num(v) !== undefined && (num(v) as number) > 2) set(id, "inset", stepValue(v, -amount, 2, 99), "section-inset"); }
    for (const id of pages) { const v = get(id, "gap"); if (num(v) !== undefined && (num(v) as number) > 2) set(id, "gap", stepValue(v, -amount, 2, 99), "page-gap"); }
    // 3. exactly one primary button per container: the first stays, the rest become secondary.
    const byParent = new Map<string, string[]>();
    for (const id of order) if (typeOf(id) === "button" && inScope.has(id) && get(id, "variant") === "primary") { const p = parent.get(id) ?? ""; byParent.set(p, [...(byParent.get(p) ?? []), id]); }
    for (const ids of byParent.values()) for (const id of ids.slice(1)) set(id, "variant", "secondary", "one-primary");
    // 4. one display heading: every display after the first becomes a title.
    const displays = order.filter((id) => typeOf(id) === "text" && inScope.has(id) && get(id, "variant") === "display");
    for (const id of displays.slice(1)) set(id, "variant", "title", "one-display");
    // 5. grids ask for narrower columns less aggressively.
    for (const id of order) if (typeOf(id) === "grid" && inScope.has(id) && get(id, "minSize") === "large") set(id, "minSize", "medium", "grid-min-size");
  } else {
    const hierarchyOnly = !persuasive; // read and operate surfaces must not gain decoration
    if (hero) {
      if (hierarchyOnly) skipped.push({ block: hero, rule: "section-tone", reason: `${mode} pages gain hierarchy, not decoration` });
      else {
        const r = toneRank(get(hero, "tone"));
        const otherAccent = order.some((id) => id !== hero && typeOf(id) === "section" && get(id, "tone") === "accent");
        if (r >= 2) skipped.push({ block: hero, rule: "section-tone", reason: "already at the ceiling" });
        else if (otherAccent) skipped.push({ block: hero, rule: "section-tone", reason: "another section is already the accent; a page has one" });
        else set(hero, "tone", TONE_AT[Math.min(2, r + amount)], "section-tone");
        const inset = get(hero, "inset");
        if (num(inset) !== undefined) set(hero, "inset", stepValue(inset, amount, 0, 8), "hero-inset");
      }
      for (const id of pages) {
        if (hierarchyOnly) continue;
        const w = get(id, "width"), gap = get(id, "gap");
        if (w === "reading") set(id, "width", "wide", "page-width");
        if (num(gap) !== undefined && (num(gap) as number) < 6) set(id, "gap", stepValue(gap, amount, 0, 6) as never, "page-gap");
      }
    }
    // The first title under the hero becomes the display line.
    const firstTitle = order.find((id) => typeOf(id) === "text" && inScope.has(id) && get(id, "variant") === "title");
    const hasDisplay = order.some((id) => typeOf(id) === "text" && get(id, "variant") === "display");
    if (firstTitle && !hasDisplay) set(firstTitle, "variant", "display", "display-title");
    // Promote the first action in a container that has no primary yet.
    const containers = new Map<string, string[]>();
    for (const id of order) if (typeOf(id) === "button" && inScope.has(id)) { const p = parent.get(id) ?? ""; containers.set(p, [...(containers.get(p) ?? []), id]); }
    for (const ids of containers.values()) {
      const eff = (id: string) => (get(id, "variant") ?? "secondary") as string;
      if (ids.some((id) => eff(id) === "primary")) continue;
      if (eff(ids[0]) === "secondary") set(ids[0], "variant", "primary", "promote-primary");
    }
  }

  // Applying the plan to a copy gives the "after" loudness without trusting the rules to have said so.
  const after = structuredClone(doc) as KageDoc;
  for (const k of knobs) { const b = after.blocks[k.block] as Block; b.props = { ...(b.props ?? {}), [k.prop]: k.to as never }; }
  const before = loudness(doc), afterL = loudness(after);
  if (!knobs.length) skipped.push({ rule: "all", reason: opts.direction === "quieter" ? "already at the floor: nothing left to quieten" : "already at the ceiling: nothing left to amplify" });
  return {
    direction: opts.direction, amount, scope, mode, modeSource: m.source, patch, knobs, skipped,
    summary: knobs.map((k) => `${k.block}.${k.prop}: ${JSON.stringify(k.from ?? null)} → ${JSON.stringify(k.to)} (${k.rule})`),
    loudness: { before, after: afterL },
  };
}
