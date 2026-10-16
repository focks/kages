// The prose of a document: the strings a reader reads as sentences, with where each
// one lives. Copy-level rules (claims today, voice and tone later) share it so none
// of them re-derives "what is text". Data is not prose: chart series, table cells
// and grid rows are numbers and labels a reader takes from the data, not assertions
// the author typed, and bound props are computed, not written.
import type { Block } from "../types.ts";

export interface Prose { at: string; text: string; block: string; type: string }

/** Props that are identifiers, addresses or formats, whatever their type says. */
const DENY = new Set(["src", "href", "url", "name", "id", "language", "code", "format", "key", "poster", "kind", "month", "target", "tex", "accept"]);
/** Blocks whose arrays are data, not copy. */
const DATA_BLOCKS = new Set(["area-chart", "donut-chart", "heatmap", "combo-chart", "stacked-bar-chart", "funnel-chart", "treemap", "sankey", "map", "bar-chart", "line-chart", "scatter-chart", "sparkline", "table", "data-grid", "kanban", "calendar", "tree", "scene", "diagram", "gauge", "math", "code", "code-tabs"]);

const stripFences = (s: string): string => s.replace(/```[\s\S]*?```/g, " ").replace(/~~~[\s\S]*?~~~/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " ");

function collect(v: unknown, at: string, block: string, type: string, out: Prose[], enums: ReadonlySet<string>, depth = 0): void {
  if (depth > 6) return;
  if (typeof v === "string") { const t = type === "markdown" ? stripFences(v) : v; if (t.trim()) out.push({ at, text: t, block, type }); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => collect(x, `${at}/${i}`, block, type, out, enums, depth + 1)); return; }
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!DENY.has(k)) collect(x, `${at}/${k}`, block, type, out, enums, depth + 1);
}

/** Every string a reader reads in this block. `enumProps` names the props that take a fixed set of values. */
export function proseOf(id: string, b: Block, enumProps: ReadonlySet<string>): Prose[] {
  if (!b || typeof b !== "object" || DATA_BLOCKS.has(b.type)) return [];
  const out: Prose[] = [];
  for (const [k, v] of Object.entries((b.props ?? {}) as Record<string, unknown>)) {
    if (DENY.has(k) || enumProps.has(k) || (b.bind && k in b.bind)) continue;
    if (b.type === "stat" && k === "value") continue; // stat values are judged by their own rule
    collect(v, `/blocks/${id}/props/${k}`, id, b.type, out, enumProps);
  }
  return out;
}
