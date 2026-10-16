// The documentation is a set of Kages: markdown in docs/ goes through the same
// outline-to-Kage converter agents use, so the docs exercise the product (and any
// converter limitation shows up as an ugly page, which is fixed in the converter, not
// papered over here). Pure: sources in, Kages and a list of problems out. Links between
// pages are written as ordinary relative markdown (`cli.md#flags`), rewritten to routes,
// and every one is checked against the target page's anchors, so a broken link is a build
// error rather than a surprise.
import { outlineToKage } from "../engine/outline.ts";
import type { Block, KageDoc } from "../engine/types.ts";

export interface DocsConfig { system: string; editUrl: string; pages: { file: string; summary: string; group: string }[] }
export interface DocLink { from: string; to: string; anchor?: string }
export interface DocPage { slug: string; file: string; title: string; summary: string; group: string; doc: KageDoc; anchors: string[]; links: DocLink[] }
export interface DocsBuild { pages: DocPage[]; index: KageDoc; problems: string[] }

const slugOf = (file: string) => file.replace(/\.md$/, "");
const stripFrontMatter = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n/, "");

export function titleOf(md: string): string | null { const m = /^#\s+(.+?)\s*$/m.exec(md); return m ? m[1].replace(/[`*_]/g, "") : null; }

/** Rewrite `](name.md#frag)` to `](/docs/name#frag)` and report each internal link. */
export function rewriteLinks(md: string, from: string, known: Set<string>, problems: string[]): { md: string; links: DocLink[] } {
  const links: DocLink[] = [];
  const out = md.replace(/\]\(([^)\s]+)\)/g, (whole, href: string) => {
    if (/^(https?:|mailto:|#)/.test(href)) return whole;
    const m = /^(?:\.\/)?([a-z0-9-]+)\.md(?:#([a-z0-9-]+))?$/.exec(href);
    if (!m) { if (!href.startsWith("/")) problems.push(`${from}: link "${href}" is neither an https link nor a page in this folder`); return whole; }
    if (!known.has(m[1])) { problems.push(`${from}: link to "${m[1]}.md" has no such page`); return whole; }
    links.push({ from, to: m[1], ...(m[2] ? { anchor: m[2] } : {}) });
    return `](/docs/${m[1]}${m[2] ? "#" + m[2] : ""})`;
  });
  return { md: out, links };
}

export function buildDocs(sources: Record<string, string>, config: DocsConfig): DocsBuild {
  const problems: string[] = [];
  const known = new Set(config.pages.map((p) => slugOf(p.file)));
  const pages: DocPage[] = [];
  for (const entry of config.pages) {
    const raw = sources[entry.file];
    if (raw === undefined) { problems.push(`${entry.file}: listed in docs.config.json but the file is missing`); continue; }
    // Generated-block markers are for the generator, not the reader: left in, they print as literal text.
    const slug = slugOf(entry.file), body = stripFrontMatter(raw).replace(/^<!--[\s\S]*?-->[ \t]*\n?/gm, "");
    const title = titleOf(body);
    if (!title) { problems.push(`${entry.file}: needs a first-level heading for its title`); continue; }
    const { md, links } = rewriteLinks(body, entry.file, known, problems);
    const built = outlineToKage(md, { title, id: `docs-${slug}`, system: config.system, toc: "auto" });
    const anchors = Object.values(built.doc.blocks as Record<string, Block>).filter((b) => b.type === "anchor").map((b) => String((b.props as { name?: string }).name));
    pages.push({ slug, file: entry.file, title, summary: entry.summary, group: entry.group, doc: { ...built.doc, brief: { mode: "read" } } as KageDoc, anchors, links });
  }
  for (const f of Object.keys(sources)) if (f.endsWith(".md") && !config.pages.some((p) => p.file === f)) problems.push(`${f}: is not listed in docs.config.json, so it would never be published`);
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  for (const p of pages) for (const l of p.links) {
    const target = bySlug.get(l.to);
    if (l.anchor && target && !target.anchors.includes(l.anchor)) problems.push(`${p.file}: link to ${l.to}.md#${l.anchor} has no such heading (headings there: ${target.anchors.join(", ") || "none"})`);
  }
  return { pages, index: buildIndex(pages, config), problems };
}

/** "Getting started" reads as "Read getting started"; "CLI reference" and "FAQ" keep their capitals. */
const lowerFirst = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

function buildIndex(pages: DocPage[], config: DocsConfig): KageDoc {
  const blocks: Record<string, Block> = {
    root: { type: "page", props: { width: "wide", gap: 8 }, slots: { children: ["hero", "grid"] } },
    hero: { type: "section", props: { eyebrow: "Documentation", title: "Kages, explained", description: "Build versioned, interactive pages with agents, check them, review them and ship them. Pick a page to start.", tone: "accent", inset: 6 } },
    grid: { type: "grid", props: { columns: 3, minSize: "medium", gap: 4 }, slots: { children: pages.map((p) => "c-" + p.slug) } },
  };
  for (const p of pages) {
    blocks["c-" + p.slug] = { type: "card", props: { title: p.title, subtitle: p.summary }, slots: { children: ["l-" + p.slug] } };
    blocks["l-" + p.slug] = { type: "link", props: { label: `Read ${lowerFirst(p.title)}`, href: `/docs/${p.slug}` } };
  }
  return { kages: "1.0", id: "docs-index", title: "Kages documentation", system: `${config.system}@1`, root: "root", blocks, brief: { mode: "read" } } as KageDoc;
}
