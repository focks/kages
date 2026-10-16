// The reference pages of the docs are generated from the things they describe, so they cannot
// go stale: the CLI's own help text and the operation table. Hand-written text around them is
// marked off with generator markers, and a test fails when the committed page differs from
// what this module produces.
import { OPERATIONS } from "../adapters/operations.ts";

export const START = (name: string) => `<!-- kages:generated:start ${name} -->`;
export const END = "<!-- kages:generated:end -->";

/** The help text, grouped by its section headings, each group as an aligned text block. */
export function cliReferenceMd(help: string): string {
  const sections: { title: string; lines: string[] }[] = [];
  for (const line of help.split("\n").slice(2)) {
    if (/^\S/.test(line) && !/^(usage|global flags)/.test(line)) { sections.push({ title: line.replace(/\s+\(.*$/, ""), lines: [] }); continue; }
    if (/^global flags/.test(line)) { sections.push({ title: "Global flags", lines: [] }); continue; }
    if (sections.length && line.trim()) sections.at(-1)!.lines.push(line);
  }
  return sections.map((s) => `## ${s.title[0].toUpperCase()}${s.title.slice(1)}\n\n\`\`\`text\n${s.lines.join("\n")}\n\`\`\``).join("\n\n");
}

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function operationsMd(): string {
  const rows = [...OPERATIONS].sort((a, b) => a.name.localeCompare(b.name)).map((o) => `| \`${o.name}\` | ${esc(o.summary)} | ${o.params.length ? o.params.map((p) => `\`${p}\``).join(" ") : "none"} | ${typeof o.write === "function" ? "read; write with apply" : o.write ? "write" : "read"} |`);
  return `${OPERATIONS.length} operations. A trailing \`?\` marks an optional parameter.\n\n| Operation | What it does | Parameters | Access |\n| --- | --- | --- | --- |\n${rows.join("\n")}`;
}

/** Replace the body of a marked region; fails loudly if the markers are missing. */
export function fill(page: string, name: string, body: string): string {
  const a = page.indexOf(START(name)), b = page.indexOf(END, a);
  if (a < 0 || b < 0) throw new Error(`the page has no "${name}" generator markers`);
  return page.slice(0, a + START(name).length) + "\n" + body + "\n" + page.slice(b);
}
