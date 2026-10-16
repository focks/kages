// Prose in, Kage out. An agent that knows what it wants to say should not have to
// know which block says it: this turns markdown into a valid Kage document by
// choosing blocks from what the text contains.
//
//   # Title + first paragraph   → hero section
//   ## Heading + prose/lists    → one markdown block per run of text
//   > **Note** / > [!WARNING]   → alert (info, success, warning, danger)
//   | pipe | tables |           → table (small) or filterable data-grid (large)
//   ```fenced``` code           → code; consecutive fences → code-tabs
//   ![alt](https://…)           → image
//   --- / ***                   → divider
//   ## FAQ + ### questions      → accordion
//   3+ sections                 → a sticky table of contents with anchors
//
// Pure and deterministic: same text, same document. The input is untrusted, so
// size and block counts are capped, unsafe image sources are dropped (and said
// so), and only plain text ever reaches a block that is not markdown. The result
// is validated by the caller; this module never claims validity itself.
// See oracle/outline.feature.

import type { Block, KageDoc } from "./types.ts";

export interface OutlineOptions {
  title?: string;
  id?: string;
  system?: string;
  /** "auto" adds a contents sidebar for three or more sections. */
  toc?: "auto" | "always" | "never";
}

export interface OutlineResult {
  doc: KageDoc;
  /** Plain-language record of the choices made, so an agent can adjust its prose. */
  notes: string[];
  stats: { blocks: number; sections: number; tables: number; code: number; callouts: number; images: number; faq: number };
}

const MAX_CHARS = 100_000, MAX_BLOCKS = 300, MAX_TEXT = 20_000;

type Piece =
  | { kind: "heading"; level: number; text: string }
  | { kind: "text"; lines: string[] }
  | { kind: "fence"; lang: string; title: string; code: string; unclosed?: boolean }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "callout"; tone: "info" | "success" | "warning" | "danger"; title: string; text: string }
  | { kind: "image"; alt: string; src: string }
  | { kind: "hr" };

const slug = (s: string, max = 40) => s.toLowerCase().replace(/[`*_~]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "");
/** Strip inline markdown so text bound for a plain-text prop reads cleanly. */
const plain = (s: string) => s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/(\*\*|__|\*|_|`|~~)/g, "").replace(/\s+/g, " ").trim();

const LANG_LABEL: Record<string, string> = { sh: "Shell", bash: "Shell", shell: "Shell", zsh: "Shell", js: "JavaScript", javascript: "JavaScript", ts: "TypeScript", typescript: "TypeScript", py: "Python", python: "Python", sql: "SQL", json: "JSON", yaml: "YAML", yml: "YAML", go: "Go", rust: "Rust", rb: "Ruby", java: "Java", cs: "C#", curl: "curl", html: "HTML", css: "CSS", txt: "Text", text: "Text" };
const CALLOUTS: { re: RegExp; tone: "info" | "success" | "warning" | "danger"; title: string }[] = [
  { re: /^\[!(note|info)\]/i, tone: "info", title: "Note" }, { re: /^\[!(tip|hint|success)\]/i, tone: "success", title: "Tip" },
  { re: /^\[!important\]/i, tone: "info", title: "Important" }, { re: /^\[!(warning|caution)\]/i, tone: "warning", title: "Warning" }, { re: /^\[!(danger|error)\]/i, tone: "danger", title: "Danger" },
  { re: /^\*{0,2}(note|info)\*{0,2}\s*[:—-]/i, tone: "info", title: "Note" }, { re: /^\*{0,2}(tip|hint)\*{0,2}\s*[:—-]/i, tone: "success", title: "Tip" },
  { re: /^\*{0,2}(important)\*{0,2}\s*[:—-]/i, tone: "info", title: "Important" }, { re: /^\*{0,2}(warning|caution)\*{0,2}\s*[:—-]/i, tone: "warning", title: "Warning" }, { re: /^\*{0,2}(danger|error)\*{0,2}\s*[:—-]/i, tone: "danger", title: "Danger" },
];
// The same sources the image block will render: https, local paths, raster data URLs.
const safeImage = (src: string) => /^(https:\/\/[^\s<>"'\\]+|\/(?!\/)[^\s<>"'\\]*|data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+)$/i.test(src);

function frontMatter(text: string): { meta: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  // A `---` paragraph `---` pair at the top is a thematic break around prose, not metadata.
  // Treating it as front matter discarded the intro without a trace, so it counts only when every
  // non-blank line is `key: value`.
  const lines = m[1].split(/\r?\n/).filter((l) => l.trim());
  if (!lines.every((l) => /^([A-Za-z_][\w-]*):\s*(.*)$/.test(l))) return { meta: {}, body: text };
  for (const line of lines) { const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line); if (kv) meta[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, "").trim().slice(0, 300); }
  return { meta, body: text.slice(m[0].length) };
}

const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
const isDivider = (line: string) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes("-");

/** First pass: lines into typed pieces. Text between special pieces is kept as
 *  runs of lines so a section's prose stays one markdown block. */
function tokenize(body: string): Piece[] {
  const lines = body.replace(/\r\n?/g, "\n").split("\n"), out: Piece[] = [];
  const text = () => { const last = out[out.length - 1]; if (last?.kind === "text") return last; const t: Piece = { kind: "text", lines: [] }; out.push(t); return t; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m: RegExpExecArray | null;
    if ((m = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*(.*)$/.exec(line))) {
      const fence = m[1], code: string[] = []; i++;
      while (i < lines.length && !new RegExp("^\\s*" + fence[0] + "{" + fence.length + ",}\\s*$").test(lines[i])) code.push(lines[i++]);
      const title = /title=["']([^"']+)["']/.exec(m[3])?.[1] ?? "";
      out.push({ kind: "fence", lang: m[2].toLowerCase(), title, code: code.join("\n"), ...(i >= lines.length ? { unclosed: true } : {}) });
      continue;
    }
    if (/^\s*\$\$/.test(line)) { // display math stays in the prose, where the markdown block renders it
      const t = text(); t.lines.push(line);
      if (!/\$\$\s*$/.test(line.trim().slice(2))) { while (++i < lines.length) { t.lines.push(lines[i]); if (/\$\$/.test(lines[i])) break; } }
      continue;
    }
    if ((m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line))) { out.push({ kind: "heading", level: m[1].length, text: m[2] }); continue; }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line) && !/^\s*[-*]\s+\S/.test(line)) { out.push({ kind: "hr" }); continue; }
    if ((m = /^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/.exec(line))) { out.push({ kind: "image", alt: m[1], src: m[2] }); continue; }
    if (line.includes("|") && i + 1 < lines.length && isDivider(lines[i + 1]) && splitRow(line).length >= 2) {
      const header = splitRow(line), rows: string[][] = []; i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]));
      i--; out.push({ kind: "table", header, rows }); continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) q.push(lines[i++].replace(/^\s{0,3}>\s?/, ""));
      i--;
      const first = q[0] ?? "", c = CALLOUTS.find((x) => x.re.test(first));
      if (c) {
        const rest = [first.replace(c.re, "").replace(/^\*{0,2}\s*[:—-]?\s*\*{0,2}\s*/, ""), ...q.slice(1)].join(" ");
        out.push({ kind: "callout", tone: c.tone, title: c.title, text: plain(rest) });
      } else { const t = text(); t.lines.push(...q.map((l) => "> " + l)); }
      continue;
    }
    text().lines.push(line);
  }
  return out;
}

export function outlineToKage(markdown: string, opts: OutlineOptions = {}): OutlineResult {
  if (typeof markdown !== "string" || !markdown.trim()) throw new Error("the markdown is empty");
  const notes: string[] = [];
  let src = markdown;
  if (src.length > MAX_CHARS) { src = src.slice(0, MAX_CHARS); notes.push(`The text was cut at ${MAX_CHARS.toLocaleString("en-US")} characters.`); }
  const { meta, body } = frontMatter(src);
  const pieces = tokenize(body);
  for (const p of pieces) if (p.kind === "fence" && p.unclosed) notes.push(`A code fence${p.lang ? ` (${p.lang})` : ""} was never closed, so everything after it became part of that code block.`);
  const stats = { blocks: 0, sections: 0, tables: 0, code: 0, callouts: 0, images: 0, faq: 0 };

  // --- title and hero ---
  const h1 = pieces.findIndex((p) => p.kind === "heading" && p.level === 1);
  const title = plain(opts.title ?? meta.title ?? (h1 >= 0 ? (pieces[h1] as { text: string }).text : "") ?? "") || "Untitled";
  let heroDescription = meta.description ? plain(meta.description) : "";
  if (h1 >= 0) {
    pieces.splice(h1, 1);
    // The first paragraph under the title is the hero's description, not body copy.
    const next = pieces[h1];
    if (!heroDescription && next?.kind === "text") {
      const para: string[] = [];
      let k = 0;
      while (k < next.lines.length && !next.lines[k].trim()) k++;
      while (k < next.lines.length && next.lines[k].trim() && !/^\s*([-*+]|\d+\.)\s/.test(next.lines[k]) && !/^\s*>/.test(next.lines[k])) para.push(next.lines[k++]);
      if (para.length) { heroDescription = plain(para.join(" ")).slice(0, 400); next.lines.splice(0, k); }
    }
  }

  // --- sections: anchors need the heading list up front ---
  const sectionHeadings = pieces.filter((p): p is Extract<Piece, { kind: "heading" }> => p.kind === "heading" && p.level === 2);
  const wantToc = opts.toc === "always" || (opts.toc !== "never" && sectionHeadings.length >= 3);
  const used = new Set<string>();
  const uid = (base: string) => { let id = base || "x", n = 2; while (used.has(id)) id = `${base}-${n++}`; used.add(id); return id; };
  const blocks: Record<string, Block> = {};
  const content: string[] = [];
  let seq = 0;
  let dropped = false; // a block was refused at the cap; the loop's own check may never see it (last piece)
  const add = (prefix: string, block: Block): string => {
    if (stats.blocks >= MAX_BLOCKS) { dropped = true; return ""; }
    const id = uid(`${prefix}-${++seq}`); blocks[id] = block; content.push(id); stats.blocks++; return id;
  };
  const tocItems: { label: string; target: string; level: number }[] = [];
  const anchorFor = (text: string, level: number) => {
    if (stats.blocks >= MAX_BLOCKS) { dropped = true; return; } // an anchor is a block too; skipping the toc entry with it keeps links honest
    const name = uid("sec-" + (slug(text, 32) || "section")).replace(/^sec-/, "");
    blocks["a-" + name] = { type: "anchor", props: { name } }; content.push("a-" + name); stats.blocks++;
    tocItems.push({ label: plain(text).slice(0, 80), target: name, level });
  };

  // --- FAQ: a ## heading with ### questions becomes an accordion ---
  const isFaq = (t: string) => /\b(faq|questions|q\s*&\s*a|frequently asked)\b/i.test(t);

  let run: string[] = []; // pending prose lines for the current markdown block
  const flush = () => {
    const text = run.join("\n").replace(/^\s*\n+|\n+\s*$/g, "");
    run = [];
    if (!text.trim()) return;
    add("md", { type: "markdown", props: { text: text.slice(0, MAX_TEXT) } });
  };

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (stats.blocks >= MAX_BLOCKS) { dropped = true; break; }

    if (p.kind === "heading") {
      if (p.level === 2 && isFaq(p.text)) {
        // collect ### question headings and their prose until the next ## (or end)
        const items: { id: string; title: string; body: string }[] = [];
        let j = i + 1, cur: { title: string; body: string[] } | null = null;
        const close = () => { if (cur) { items.push({ id: uid("q-" + (slug(cur.title, 24) || "q" + (items.length + 1))), title: plain(cur.title).slice(0, 200), body: plain(cur.body.join(" ")).slice(0, 4000) }); cur = null; } };
        for (; j < pieces.length; j++) {
          const q = pieces[j];
          if (q.kind === "heading" && q.level <= 2) break;
          if (q.kind === "heading") { close(); cur = { title: q.text, body: [] }; }
          else if (q.kind === "text" && cur) cur.body.push(...q.lines.filter((l) => l.trim()));
          else if (q.kind !== "text") { /* only prose answers become accordion bodies */ }
        }
        close();
        if (items.length >= 2) {
          flush(); if (wantToc) anchorFor(p.text, 1);
          add("md", { type: "markdown", props: { text: "## " + plain(p.text) } });
          add("faq", { type: "accordion", props: { items: items.slice(0, 50) } });
          stats.faq++; stats.sections++; notes.push(`"${plain(p.text)}" became an accordion of ${items.length} questions.`);
          i = j - 1; continue;
        }
      }
      if (p.level === 2) { flush(); stats.sections++; if (wantToc) anchorFor(p.text, 1); }
      else if (p.level === 3 && wantToc && sectionHeadings.length) { flush(); anchorFor(p.text, 2); }
      const level = Math.min(p.level, 4) === 1 ? 2 : Math.min(p.level, 3); // markdown renders ##–###; a stray extra # becomes ##
      run.push("#".repeat(level) + " " + plain(p.text), "");
      continue;
    }
    if (p.kind === "text") { run.push(...p.lines); continue; }
    flush();
    if (p.kind === "hr") { add("rule", { type: "divider" }); continue; }
    if (p.kind === "callout") { add("callout", { type: "alert", props: { tone: p.tone, title: p.title, text: p.text.slice(0, 1000) } }); stats.callouts++; continue; }
    if (p.kind === "image") {
      if (!safeImage(p.src)) { notes.push(`An image was skipped because its source is not https, a local path or a raster data URL: ${p.src.slice(0, 60)}`); continue; }
      add("img", { type: "image", props: { src: p.src, alt: plain(p.alt) || "Illustration", ...(plain(p.alt) ? { caption: plain(p.alt) } : {}) } }); stats.images++; continue;
    }
    if (p.kind === "table") {
      const cols = p.header.slice(0, 12).map((h, k) => ({ key: "c" + k, label: plain(h).slice(0, 60) || "Column " + (k + 1) }));
      if (p.header.length > 12) notes.push(`A table had ${p.header.length} columns; only the first 12 were kept.`);
      if (p.rows.length > 500) notes.push(`A table kept 500 of ${p.rows.length} rows; the rest were left out.`);
      const rows = p.rows.slice(0, 500).map((r) => Object.fromEntries(cols.map((c, k) => [c.key, plain(r[k] ?? "").slice(0, 400)])));
      const big = rows.length > 8;
      add(big ? "grid" : "tbl", big ? { type: "data-grid", props: { label: "Table", columns: cols, rows, pageSize: 10, filterable: true } } : { type: "table", props: { columns: cols, rows } });
      stats.tables++; notes.push(`A ${cols.length}-column table with ${rows.length} rows became a ${big ? "filterable data-grid" : "table"}.`); continue;
    }
    if (p.kind === "fence") {
      // Back-to-back fences in different languages are the same example: tabs.
      const group: Extract<Piece, { kind: "fence" }>[] = [p];
      // Blank lines between fences are separate (empty) text pieces; look through them.
      const nextFence = () => { let k = i + 1; while (pieces[k]?.kind === "text" && (pieces[k] as { lines: string[] }).lines.every((l) => !l.trim())) k++; return pieces[k]?.kind === "fence" ? k : -1; };
      for (let k = nextFence(); k >= 0 && (pieces[k] as { lang: string }).lang !== group[group.length - 1].lang; k = nextFence()) { group.push(pieces[k] as Extract<Piece, { kind: "fence" }>); i = k; }
      if (group.length > 8) notes.push(`${group.length} adjacent code blocks: only the first 8 became tabs; the rest were left out.`);
      if (group.length >= 2) {
        const tabs = group.slice(0, 8).map((g) => ({ id: uid("t-" + (g.lang || "text")), label: LANG_LABEL[g.lang] ?? (g.lang || "Text"), language: g.lang || "text", code: g.code.slice(0, 20000) }));
        add("tabs", { type: "code-tabs", props: { ...(p.title ? { caption: p.title } : {}), tabs } }); stats.code++; notes.push(`${group.length} adjacent code blocks became tabs (${tabs.map((t) => t.label).join(", ")}).`);
      } else add("code", { type: "code", props: { code: p.code.slice(0, 20000), language: p.lang || "text", wrap: true, ...(p.title ? { caption: p.title } : {}) } }), stats.code++;
      continue;
    }
  }
  flush();
  if (dropped) notes.push(`Stopped at ${MAX_BLOCKS} blocks; the rest of the text was left out.`);

  // --- assemble ---
  const heroProps: Record<string, string | number> = { title, inset: 0 };
  if (meta.eyebrow) heroProps.eyebrow = plain(meta.eyebrow).slice(0, 80);
  if (heroDescription) heroProps.description = heroDescription;
  blocks.hero = { type: "section", props: heroProps };
  const root: Block = { type: "page", props: { width: wantToc ? "wide" : "reading", gap: 8 }, slots: { children: ["hero"] } };
  if (wantToc && tocItems.length) {
    const small = tocItems.length > 14 ? tocItems.filter((t) => t.level === 1) : tocItems;
    blocks.toc = { type: "toc", props: { title: "On this page", sticky: true, items: small.slice(0, 40).map((t) => ({ label: t.label, target: t.target, level: t.level })) } };
    blocks.layout = { type: "split", props: { ratio: "wide-end", gap: 8 }, slots: { start: ["toc"], end: content } };
    root.slots!.children.push("layout");
    notes.push(`${sectionHeadings.length} sections: added a sticky table of contents with anchors.`);
  } else root.slots!.children.push(...content);
  blocks.root = root;

  const idOk = !!opts.id && /^[a-z0-9][a-z0-9-]{0,62}$/.test(opts.id);
  const id = (idOk ? opts.id! : slug(title, 48)) || "untitled";
  if (opts.id && !idOk) notes.push(`The id "${opts.id}" is not lowercase letters, digits and hyphens, so "${id}" was used instead.`);
  const doc: KageDoc = { kages: "1.0", id, title: title.slice(0, 160), system: opts.system ?? "core@1", root: "root", blocks };
  if (meta.description) (doc as { description?: string }).description = plain(meta.description).slice(0, 300);
  return { doc, notes, stats };
}
