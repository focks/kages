// Data that validates and renders, but not as the author meant: the renderer drops it or
// shows a blank without complaint, so neither validate nor a passing render reveals it.
import { walkExpr } from "../expr.ts";
import type { Finding, Rule } from "./types.ts";

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const rowsOf = (v: unknown): Row[] => (Array.isArray(v) ? v.filter(isRow) : []);
const props = (b: { props?: unknown }) => (b.props ?? {}) as Row;

export const diagramDanglingEdge: Rule = {
  id: "diagram-dangling-edge", category: "content", severity: "P1", tier: "immediate",
  summary: "A diagram edge that names a node the diagram does not have.",
  rationale: "The renderer drops such an edge without a word, so the picture silently misses a relationship the author wrote.",
  check({ blocks }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      if (b.type !== "diagram") continue;
      const p = props(b);
      if (!Array.isArray(p.nodes) || !Array.isArray(p.edges)) continue;
      const nodes = new Set(rowsOf(p.nodes).map((n) => n.id));
      p.edges.forEach((e, i) => {
        if (!isRow(e)) return;
        for (const end of ["from", "to"]) if (!nodes.has(e[end])) out.push({ at: `/blocks/${id}/props/edges/${i}`, msg: `Edge ${i} of \`${id}\` has \`${end}\` "${String(e[end])}", which is not a node, so the edge will not be drawn.`, fix: `Add a node with that id or correct the edge's \`${end}\`.` });
      });
    }
    return out;
  },
};

export const tableColumnNoData: Rule = {
  id: "table-column-no-data", category: "content", severity: "P2", tier: "immediate",
  summary: "A table column no row has a value for, or a cell holding an object.",
  rationale: "The first renders as an empty column, which reads as missing data. The second cannot be shown as a cell.",
  check({ blocks }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      if (b.type !== "table" && b.type !== "data-grid") continue;
      const p = props(b), rows = rowsOf(p.rows);
      if (!rows.length) continue;
      for (const c of rowsOf(p.columns)) {
        const key = String(c.key);
        if (!rows.some((r) => r[key] !== undefined)) out.push({ at: `/blocks/${id}/props/columns`, msg: `No row of \`${id}\` has a value for column \`${key}\`.`, fix: `Rename the column's key to match the rows, or add \`${key}\` to them.` });
        else if (rows.some((r) => isRow(r[key]))) out.push({ at: `/blocks/${id}/props/rows`, msg: `Column \`${key}\` of \`${id}\` has a cell holding an object.`, fix: "Put a string or number in the cell." });
      }
    }
    return out;
  },
};

const CHART_VALUES: Record<string, string[]> = { "bar-chart": ["value"], "donut-chart": ["value"], "line-chart": ["x", "y"], "scatter-chart": ["x", "y"], "area-chart": ["x", "y"] };

export const chartNonNumericValue: Rule = {
  id: "chart-nonnumeric-value", category: "content", severity: "P1", tier: "immediate",
  summary: "A chart item whose value is not a number.",
  rationale: "\"12%\" looks right in the document, but a chart can only plot a number.",
  check({ blocks }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      const keys = CHART_VALUES[b.type];
      if (!keys) continue;
      rowsOf(props(b).items).forEach((item, i) => {
        for (const k of keys) if (item[k] !== undefined && typeof item[k] !== "number") out.push({ at: `/blocks/${id}/props/items/${i}/${k}`, msg: `\`${k}\` of item ${i} in \`${id}\` is ${JSON.stringify(item[k])}, not a number.`, fix: "Use a plain number; set `format` or `unit` for how it displays." });
      });
    }
    return out;
  },
};

export const sumMissingField: Rule = {
  id: "sum-missing-field", category: "content", severity: "P1", tier: "immediate",
  summary: "A $sum over a field no row has.",
  rationale: "It evaluates to a confident 0, which reads as a real total.",
  check({ doc, blocks }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      walkExpr([b.props, b.bind], (op, arg) => {
        if (op !== "$sum" || !Array.isArray(arg)) return;
        const source = arg[0] as { $data?: unknown } | null;
        if (!source || typeof source.$data !== "string") return;
        const rows = rowsOf((doc.data ?? {})[source.$data]);
        if (rows.length && !rows.some((r) => r[String(arg[1])] !== undefined)) out.push({ at: `/blocks/${id}`, msg: `$sum in \`${id}\` reads \`${String(arg[1])}\`, which no row of \`${source.$data}\` has, so it totals 0.`, fix: `Use one of: ${Object.keys(rows[0]).join(", ")}.` });
      });
    }
    return out;
  },
};

// Both a bold run and a list line: one alone is common in ordinary prose and code samples.
const MARKDOWN = /\*\*[^*\n]+\*\*[\s\S]*^\s*[-*] /m;

export const markdownInText: Rule = {
  id: "markdown-in-text", category: "copy", severity: "P2", tier: "immediate",
  summary: "Markdown syntax in a text block.",
  rationale: "A text block shows its string literally, so the reader sees the asterisks.",
  check({ blocks }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      if (b.type !== "text") continue;
      const t = props(b).text;
      if (typeof t === "string" && MARKDOWN.test(t)) out.push({ at: `/blocks/${id}/props/text`, msg: `\`${id}\` holds Markdown that will show literally.`, fix: "Use a `markdown` block, or `rich-text` with runs." });
    }
    return out;
  },
};
