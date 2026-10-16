import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildDocs, rewriteLinks, titleOf, type DocsConfig } from "./build.ts";
import { loadDocs } from "./load.ts";
import { cliReferenceMd, operationsMd, fill, START, END } from "./reference.ts";
import { validate } from "../engine/validate.ts";
import { lintDetailed } from "../engine/advice.ts";
import { runCli } from "../test-support/cli.ts";
import type { KageDoc } from "../engine/types.ts";

const dir = fileURLToPath(new URL("../../docs/", import.meta.url));
const built = loadDocs(dir);

test("the real docs build with no problems and every listed page exists", () => {
  assert.deepEqual(built.problems, []);
  assert.equal(built.pages.length, built.config.pages.length);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".md"))) assert.ok(built.config.pages.some((p) => p.file === f), `${f} is not published`);
});

test("every page, and the index, is valid and lint-clean (no findings at all) in all three systems", () => {
  const all: KageDoc[] = [...built.pages.map((p) => p.doc), built.index];
  for (const sys of ["core", "ledger", "atelier"]) for (const d of all) {
    const v = validate(d, sys);
    assert.deepEqual(v.errors, [], `${sys}/${d.id}`);
    assert.deepEqual(lintDetailed(d, { system: sys }).findings, [], `${sys}/${d.id}`);
  }
  assert.ok(built.pages.every((p) => p.doc.system.startsWith("atelier")));
  assert.ok(built.pages.every((p) => p.doc.brief?.mode === "read"), "docs declare the read mode");
});

test("a page with several sections gets a contents sidebar, and ids are unique", () => {
  for (const p of built.pages) {
    const sections = Object.values(p.doc.blocks).filter((b) => b.type === "section").length;
    if (sections >= 3) assert.ok(Object.values(p.doc.blocks).some((b) => b.type === "toc"), p.slug);
  }
  assert.equal(new Set(built.pages.map((p) => p.doc.id)).size, built.pages.length);
});

test("the index links to every page, once", () => {
  const hrefs = Object.values(built.index.blocks).filter((b) => b.type === "link").map((b) => (b.props as { href: string }).href).sort();
  assert.deepEqual(hrefs, built.pages.map((p) => `/docs/${p.slug}`).sort());
});

const cfg: DocsConfig = { system: "atelier", editUrl: "x", pages: [{ file: "a.md", summary: "A", group: "G" }, { file: "b.md", summary: "B", group: "G" }] };

test("link checking: a good link is rewritten; a missing page, a missing heading and a bare path are errors", () => {
  const ok = buildDocs({ "a.md": "# A\n\nSee [b](b.md#target).\n\n## One\n\ntext", "b.md": "# B\n\n## Target\n\ntext\n\n## Two\n\ntext\n\n## Three\n\nmore" }, cfg);
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.pages[0].links, [{ from: "a.md", to: "b", anchor: "target" }]);
  const bad = buildDocs({ "a.md": "# A\n\n[gone](nope.md) and [x](b.md#missing) and [y](somewhere/else.md) and [ok](https://x.test)", "b.md": "# B\n\n## Real\n\ntext\n\n## Other\n\ntext\n\n## Third\n\ntext" }, cfg);
  assert.match(bad.problems.join("\n"), /link to "nope\.md" has no such page/);
  assert.match(bad.problems.join("\n"), /b\.md#missing has no such heading \(headings there: real, other, third\)/);
  assert.match(bad.problems.join("\n"), /"somewhere\/else\.md" is neither an https link nor a page/);
  assert.ok(!bad.problems.join("\n").includes("https://x.test"));
  const probs: string[] = [];
  assert.equal(rewriteLinks("[a](b.md)", "a.md", new Set(["b"]), probs).md, "[a](/docs/b)");
});

test("structure errors: a missing file, a page without a title, an unlisted file", () => {
  const p = buildDocs({ "a.md": "no heading here", "c.md": "# C" }, cfg).problems.join("\n");
  assert.match(p, /a\.md: needs a first-level heading/);
  assert.match(p, /b\.md: listed in docs\.config\.json but the file is missing/);
  assert.match(p, /c\.md: is not listed/);
  assert.equal(titleOf("# The `CLI`\n"), "The CLI");
  assert.equal(buildDocs({ "a.md": "---\ntitle: x\n---\n# A\n\ntext", "b.md": "# B" }, cfg).pages[0].title, "A");
});

test("the generated references equal the committed pages (run npm run docs:gen)", async () => {
  const help = (await runCli(["help"])).out;
  const cli = readFileSync(dir + "cli.md", "utf8"), mcp = readFileSync(dir + "mcp.md", "utf8");
  assert.equal(fill(cli, "cli", cliReferenceMd(help)), cli);
  assert.equal(fill(mcp, "operations", operationsMd()), mcp);
  assert.throws(() => fill("no markers", "cli", "x"), /no "cli" generator markers/);
  assert.ok(cli.includes(START("cli")) && cli.includes(END));
});

test("the CLI reference lists every command group and every operation appears in the operations page", () => {
  const cli = readFileSync(dir + "cli.md", "utf8"), mcp = readFileSync(dir + "mcp.md", "utf8");
  for (const h of ["## Author", "## Manage", "## Inspect & migrate", "## Workspace", "## Install", "## Global flags"]) assert.ok(cli.includes(h), h);
  for (const op of ["get_context", "validate_patch", "set_brief", "migrate_kage"]) assert.ok(mcp.includes(`\`${op}\``), op);
});

test("no page claims a command the CLI does not have", async () => {
  const help = (await runCli(["help"])).out;
  const verbs = new Set([...readFileSync(fileURLToPath(new URL("../cli/kages.ts", import.meta.url)), "utf8").matchAll(/^\s*case "([a-z-]+)"/gm)].map((m) => m[1]));
  for (const p of built.config.pages) {
    const text = readFileSync(dir + p.file, "utf8");
    for (const m of text.matchAll(/^\s*(?:\$ )?kages ([a-z][a-z-]*)/gm)) assert.ok(verbs.has(m[1]), `${p.file}: \`kages ${m[1]}\` is not a command`);
  }
  assert.ok(help.length > 0);
});

test("generated-block markers never reach the reader", () => {
  for (const p of built.pages) {
    const text = JSON.stringify(p.doc);
    assert.ok(!/kages:generated/.test(text), `${p.slug} shows a generator marker`);
  }
});

test("every page has an intro under its title and a group, and titles are not article-led", () => {
  for (const p of built.pages) {
    const body = readFileSync(dir + p.file, "utf8");
    assert.match(body, /^# .+\n\n[^#\s<]/, `${p.file}: a sentence should follow the title, before the first heading`);
    assert.ok(p.group, p.file);
    assert.ok(!/^(the|a|an) /i.test(p.title), `${p.file}: "${p.title}" starts with an article, which sorts and scans badly in a sidebar`);
  }
});
