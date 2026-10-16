import type { Finding, Rule } from "./types.ts";

export const CHARTS = new Set(["area-chart", "donut-chart", "heatmap", "combo-chart", "stacked-bar-chart", "funnel-chart", "treemap", "sankey", "map", "bar-chart", "line-chart", "scatter-chart"]);
const SELECTABLE = new Set(["donut-chart", "heatmap", "funnel-chart", "treemap", "map"]);
const DATA_PROP: Record<string, string> = { "area-chart": "items", "donut-chart": "items", "heatmap": "values", "combo-chart": "series", "stacked-bar-chart": "series", "funnel-chart": "stages", "treemap": "items", "sankey": "links", "map": "features", "bar-chart": "items", "line-chart": "items", "scatter-chart": "items" };

export const emptyChart: Rule = {
  id: "empty-chart", category: "content", severity: "P2", tier: "immediate",
  summary: "A chart with no data and no binding.",
  rationale: "It can only ever render \"No data\".",
  check({ blocks }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      if (!CHARTS.has(b.type)) continue;
      const key = DATA_PROP[b.type], p = (b.props ?? {}) as Record<string, unknown>;
      if (Array.isArray(p[key]) && (p[key] as unknown[]).length === 0 && !(b.bind && key in b.bind))
        out.push({ at: `/blocks/${id}/props/${key}`, msg: `\`${id}\` (${b.type}) has an empty \`${key}\` and no binding, so it will only show "No data".`, fix: `Provide ${key} or bind.${key} from data/state.` });
    }
    return out;
  },
};

export const selectionUnused: Rule = {
  id: "selection-unused", category: "wiring", severity: "P2", tier: "immediate",
  summary: "An interactive chart whose selection nothing reads.",
  rationale: "Clicking it changes nothing visible, which invites readers to think the page is broken.",
  check({ blocks, handled, reads }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      const p = (b.props ?? {}) as Record<string, unknown>;
      if (CHARTS.has(b.type) && SELECTABLE.has(b.type) && p.interactive === true && !handled.has(id + ":select") && ![...reads].some((r) => r.split(".")[0] === id))
        out.push({ at: "/blocks/" + id, msg: `\`${id}\` is interactive but nothing reads its selection, so clicking it changes nothing visible.`, fix: `Read {"$block":"${id}.selected"} in another block's bind, or add on.select.` });
    }
    return out;
  },
};
