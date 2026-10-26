// Mermaid in, a diagram block out. Mermaid is rendered nowhere in Kages — a
// Kage is data, never executed — so support means compiling the flowchart
// subset into validated `diagram` nodes and edges at authoring time, and
// rejecting everything else loudly. A silent partial import would be worse
// than none: the author would trust a picture that dropped relationships.
//
//   graph/flowchart TD|TB|LR|RL|BT   → layout vertical/horizontal
//   id[Label] id(L) id((L)) id{L} …  → node (shape dropped, said in notes)
//   A --> B, A -->|label| B, A -- label --> B, chains, A & B --> C
//   subgraph Title … end             → group
//   %% comments, blank lines         → ignored
//   style/classDef/class/linkStyle   → dropped with a note (cosmetic)
//   click                            → dropped with a note (interaction is state)
//   any other diagram kind or line   → thrown Error naming the line
//
// Pure and deterministic: same text, same block. The input is untrusted, so
// size is capped at the renderer's own bounds (200 nodes / 400 edges) and
// labels are stripped to plain text. The caller inserts the block into a Kage
// and validates; this module never claims validity itself.

export interface MermaidOptions {
  /** The diagram block's accessible label (its contract requires one). */
  label?: string;
}

export interface MermaidNode { id: string; label: string; group?: string }
export interface MermaidEdge { from: string; to: string; label?: string }

export interface MermaidResult {
  block: { type: "diagram"; props: { label: string; layout: "horizontal" | "vertical"; nodes: MermaidNode[]; edges: MermaidEdge[] } };
  /** Plain-language record of everything dropped or adapted, so an agent can decide whether it mattered. */
  notes: string[];
  stats: { nodes: number; edges: number; groups: number; droppedLines: number };
}

const MAX_CHARS = 100_000, MAX_NODES = 200, MAX_EDGES = 400;

const KNOWN_OTHER = ["sequenceDiagram", "classDiagram", "stateDiagram-v2", "stateDiagram", "erDiagram", "gantt", "pie", "journey", "mindmap", "timeline", "quadrantChart", "gitGraph", "sankey-beta", "xychart-beta"];

// Shape delimiters, longest first so `((` wins over `(`. The shape itself is
// presentation; only the inner text survives.
const SHAPES: [string, string][] = [
  ["([", "])"], ["[[", "]]"], ["[(", ")]"], ["((", "))"], ["{{", "}}"],
  ["[/", "/]"], ["[\\", "\\]"], ["[/", "\\]"], ["[\\", "/]"],
  ["[", "]"], ["(", ")"], ["{", "}"], [">", "]"],
];

// `[` alone is the plain rectangle; anything longer or different is a shape.
const SHAPED = new Set(SHAPES.map(([open]) => open).filter((o) => o !== "["));

const ID_RE = /^[A-Za-z0-9_.-]+/;

/** Strip quotes, break tags and any other markup a Mermaid label may carry; blocks take plain text only. */
function cleanLabel(raw: string): string {
  let s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
  return s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** One endpoint token → id plus optional bracketed label. Throws on a token that is not a node. */
function parseNode(token: string): { id: string; label?: string; shaped: boolean } {
  const t = token.trim();
  const m = ID_RE.exec(t);
  if (!m) throw new Error(`cannot read a node from '${t}'`);
  const id = m[0], rest = t.slice(id.length).trim();
  if (!rest) return { id, shaped: false };
  for (const [open, close] of SHAPES) {
    if (rest.startsWith(open) && rest.endsWith(close) && rest.length >= open.length + close.length)
      return { id, label: cleanLabel(rest.slice(open.length, rest.length - close.length)), shaped: SHAPED.has(open) };
  }
  throw new Error(`cannot read a node from '${t}'`);
}

type Segment = { connector: string; label?: string };

/** Split one statement line into endpoint groups and the connectors between them. */
function splitEdges(line: string): { endpoints: string[][]; segments: Segment[] } {
  // Normalise the `-- label -->` spelling into `-->|label|` first, so one
  // tokenizer handles both. The inline form is the only place a label sits
  // between dashes instead of pipes.
  const norm = line.replace(/(^|\s)([-=.]{2,})\s+([^-=|<>]+?)\s+([-=.]{2,}[xo>]?)/g, (_a, pre: string, _b, label: string, post: string) => `${pre}${post}|${label.trim()}|`);
  const parts: string[] = []; const segments: Segment[] = [];
  let rest = norm;
  const conn = /([-=.]{2,}[xo>]?)(\|([^|]*)\|)?/;
  for (;;) {
    const m = conn.exec(rest);
    if (!m || m.index === 0) break;
    parts.push(rest.slice(0, m.index).trim());
    segments.push({ connector: m[1], label: m[3] !== undefined ? cleanLabel(m[3]) : undefined });
    rest = rest.slice(m.index + m[0].length);
  }
  parts.push(rest.trim());
  return { endpoints: parts.map((p) => p.split("&").map((s) => s.trim()).filter(Boolean)), segments };
}

/**
 * Compile Mermaid flowchart text into one static `diagram` block.
 * Guarantees: every relationship in the output exists in the input; anything
 * the block cannot represent is either named in `notes` (cosmetics) or thrown
 * (semantics) — never a silent partial import.
 */
export function mermaidToDiagram(text: string, opts: MermaidOptions = {}): MermaidResult {
  if (typeof text !== "string" || !text.trim()) throw new Error("empty input: expected Mermaid flowchart text");
  if (text.length > MAX_CHARS) throw new Error(`input too large (${text.length} chars; limit ${MAX_CHARS})`);

  const lines = text.split(/\r?\n/).map((l) => l.replace(/;\s*$/, "").trim()).filter((l) => l && !l.startsWith("%%"));
  const errors: string[] = []; const notes: string[] = [];
  const header = /^(graph|flowchart)\s*(TD|TB|LR|RL|BT)?$/i.exec(lines[0] ?? "");
  if (!header) {
    const kind = KNOWN_OTHER.find((k) => (lines[0] ?? "").startsWith(k));
    throw new Error(kind
      ? `${kind} is not supported: only flowchart/graph compiles to a diagram block. Model sequences with a stepper beside a diagram, timelines with the timeline block.`
      : `first line must be 'graph' or 'flowchart' with an optional direction; got '${lines[0] ?? ""}'`);
  }
  const dir = (header[2] ?? "TD").toUpperCase();
  const layout: "horizontal" | "vertical" = dir === "LR" || dir === "RL" ? "horizontal" : "vertical";
  if (dir === "RL" || dir === "BT") notes.push(`direction ${dir} is not supported; edges keep their stated from→to and the diagram lays out ${layout === "horizontal" ? "left to right" : "top down"}.`);

  const nodes = new Map<string, MermaidNode>(); const edges: MermaidEdge[] = [];
  const groups: string[] = []; let droppedLines = 0; const flags = { shape: false, soft: false }; const styleKinds = new Set<string>();

  const touch = (token: string): string => {
    const { id, label, shaped } = parseNode(token);
    if (shaped) flags.shape = true;
    const existing = nodes.get(id);
    const group = groups.length ? groups[groups.length - 1] : undefined;
    if (!existing) nodes.set(id, { id, label: label ?? id, ...(group ? { group } : {}) });
    else if (label) existing.label = label;
    return id;
  };

  for (const line of lines.slice(1)) {
    const cosmetic = /^(style|classDef|linkStyle)\b/.exec(line) ?? /^(class)\s/.exec(line);
    if (cosmetic) { styleKinds.add(cosmetic[1]); droppedLines++; continue; }
    if (/^click\s/.test(line)) { notes.push("click bindings dropped: interaction in a Kage is wired through state, not URL handlers."); droppedLines++; continue; }
    if (/^direction\s/.test(line)) { droppedLines++; continue; }
    const sub = /^subgraph\s+(.+)$/.exec(line);
    if (sub) {
      const titled = /^[A-Za-z0-9_.-]+\s*\[(.+)\]$/.exec(sub[1]);
      if (groups.length) notes.push("nested subgraphs flatten to the innermost group; a diagram node has one group.");
      groups.push(cleanLabel(titled ? titled[1] : sub[1]));
      continue;
    }
    if (line === "end") { if (groups.length) groups.pop(); else errors.push("'end' without a subgraph"); continue; }
    try {
      const { endpoints, segments } = splitEdges(line);
      if (endpoints.some((g) => !g.length)) throw new Error(`dangling connector in '${line}'`);
      if (!segments.length) { for (const token of endpoints[0]) touch(token); continue; }
      for (let i = 0; i < segments.length; i++) {
        const from = endpoints[i].map(touch), to = endpoints[i + 1].map(touch);
        const seg = segments[i];
        if (/[.=]/.test(seg.connector)) flags.soft = true;
        if (/[xo]$/.test(seg.connector)) notes.push("cross/circle arrowheads dropped: edges render with a plain arrow.");
        else if (!/>$/.test(seg.connector)) notes.push("undirected links render as arrows in their written order.");
        for (const f of from) for (const t of to) edges.push({ from: f, to: t, ...(seg.label ? { label: seg.label } : {}) });
      }
    } catch (e) {
      const msg = (e as Error).message;
      errors.push(msg.includes(line) ? msg : `unsupported syntax: '${line}'`);
    }
  }
  if (groups.length) errors.push(`subgraph '${groups[groups.length - 1]}' is never closed with 'end'`);
  if (errors.length) throw new Error(`cannot compile this Mermaid:\n- ${errors.join("\n- ")}`);
  if (nodes.size === 0) throw new Error("no nodes found after the header");
  if (nodes.size > MAX_NODES) throw new Error(`${nodes.size} nodes exceed the diagram bound of ${MAX_NODES}`);
  if (edges.length > MAX_EDGES) throw new Error(`${edges.length} edges exceed the diagram bound of ${MAX_EDGES}`);

  if (flags.shape) notes.push("node shapes (rounded, circle, diamond, …) are presentation in Mermaid and have no diagram equivalent; the labels were kept.");
  if (flags.soft) notes.push("dotted and thick line styles dropped: a diagram edge has one weight.");
  for (const kw of [...styleKinds].sort()) notes.push(`'${kw}' lines dropped: color in a Kage comes from node palettes, assigned by role.`);
  notes.push("the block is static; add palettes by role and a caption with the takeaway, and climb to interactive only if the selection will drive another block (graph-interaction-levels).");

  const groupCount = new Set([...nodes.values()].map((n) => n.group).filter(Boolean)).size;
  return {
    block: { type: "diagram", props: { label: opts.label ?? "Imported from Mermaid", layout, nodes: [...nodes.values()], edges } },
    notes: [...new Set(notes)],
    stats: { nodes: nodes.size, edges: edges.length, groups: groupCount, droppedLines },
  };
}
