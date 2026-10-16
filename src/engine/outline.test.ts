// Markdown in, a valid Kage out. The sample article exercises every construct;
// the rest pin the edge cases: limits, hostile input, determinism, and that the
// result validates, lints clean and actually renders.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { outlineToKage } from "./outline.ts";
import { review } from "./advice.ts";
import { validate } from "./validate.ts";

const sample = readFileSync(new URL("./__fixtures__/outline-sample.md", import.meta.url), "utf8");
const types = (doc: { blocks: Record<string, { type: string }> }) => Object.values(doc.blocks).map((b) => b.type);
const make = (md: string, o = {}) => outlineToKage(md, o);

test("the sample article becomes a valid, lint-clean Kage with the right blocks", () => {
  const { doc, stats, notes } = make(sample);
  const r = review(doc); assert.deepEqual([r.errors, r.warnings, r.advice], [[], [], []], JSON.stringify([r.errors, r.advice]));
  assert.equal(doc.title, "Snowflake reader accounts, explained"); assert.equal(doc.id, "snowflake-reader-accounts-explained");
  const t = types(doc);
  for (const need of ["page", "section", "markdown", "alert", "code-tabs", "table", "image", "divider", "accordion", "toc", "anchor", "split"]) assert.ok(t.includes(need), need + " in " + [...new Set(t)]);
  assert.deepEqual([stats.sections, stats.tables, stats.callouts, stats.images, stats.faq], [3, 1, 2, 1, 1]);
  assert.ok(notes.some((n) => /table/.test(n)) && notes.some((n) => /tabs/.test(n)) && notes.some((n) => /accordion/.test(n)) && notes.some((n) => /contents/.test(n)));
});

test("front matter and the first paragraph feed the hero; the H1 is not repeated as body", () => {
  const { doc } = make(sample), hero = doc.blocks.hero.props as any;
  assert.deepEqual([hero.title, hero.eyebrow, hero.description], ["Snowflake reader accounts, explained", "Snowflake · Data sharing", "How to share data with people who don't have a Snowflake account."]);
  assert.ok(!Object.values(doc.blocks).some((b) => b.type === "markdown" && /Ignored when/.test(String((b.props as any).text))));
  const plain = make("# My page\n\nFirst paragraph is the description.\n\nSecond is body.\n").doc;
  assert.equal((plain.blocks.hero.props as any).description, "First paragraph is the description.");
  assert.ok(Object.values(plain.blocks).some((b) => b.type === "markdown" && /Second is body/.test(String((b.props as any).text))));
});

test("callouts pick the right tone from either syntax and render as plain text", () => {
  const md = "# T\n\n> **Tip:** use **bold** and `code` here\n\n> [!DANGER]\n> Never do this\n\n> Just a quote\n";
  const { doc } = make(md), alerts = Object.values(doc.blocks).filter((b) => b.type === "alert").map((b) => b.props as any);
  assert.deepEqual(alerts.map((a) => [a.tone, a.title]), [["success", "Tip"], ["danger", "Danger"]]);
  assert.equal(alerts[0].text, "use bold and code here"); assert.equal(alerts[1].text, "Never do this");
  assert.ok(Object.values(doc.blocks).some((b) => b.type === "markdown" && /> Just a quote/.test(String((b.props as any).text))), "a plain quote stays a quote");
});

test("tables: small become table, large become a filterable data-grid; ragged rows are padded", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => `| r${i} | ${i} |`).join("\n");
  const small = make(`# T\n\n| A | B |\n| - | - |\n${rows(3)}\n`).doc, big = make(`# T\n\n| A | B |\n| - | - |\n${rows(20)}\n`).doc;
  assert.ok(types(small).includes("table")); assert.ok(types(big).includes("data-grid"));
  const grid = Object.values(big.blocks).find((b) => b.type === "data-grid")!.props as any; assert.equal(grid.rows.length, 20); assert.equal(grid.filterable, true);
  const ragged = make("# T\n\n| A | B | C |\n| - | - | - |\n| only |\n| 1 | 2 |\n").doc; const t = Object.values(ragged.blocks).find((b) => b.type === "table")!.props as any;
  assert.deepEqual(t.rows[0], { c0: "only", c1: "", c2: "" }); assert.equal(validate(ragged).ok, true);
  const hostile = make("# T\n\n| A | B |\n| - | - |\n| <script>alert(1)</script> | **b** |\n").doc; const h = Object.values(hostile.blocks).find((b) => b.type === "table")!.props as any;
  assert.equal(h.rows[0].c0, "<script>alert(1)</script>", "cell text is data; the table block renders it literally"); assert.equal(h.rows[0].c1, "b");
});

test("code: a single fence is code, adjacent different-language fences are tabs, titles become captions", () => {
  const one = make("# T\n\n```js title=\"Example\"\nconst a = 1;\n```\n").doc, c = Object.values(one.blocks).find((b) => b.type === "code")!.props as any;
  assert.deepEqual([c.language, c.caption, c.code], ["js", "Example", "const a = 1;"]);
  const tabs = make("# T\n\n```sh\nls\n```\n\n```py\nprint(1)\n```\n\n```js\nf()\n```\n").doc, ct = Object.values(tabs.blocks).find((b) => b.type === "code-tabs")!.props as any;
  assert.deepEqual(ct.tabs.map((x: any) => x.label), ["Shell", "Python", "JavaScript"]); assert.equal(new Set(ct.tabs.map((x: any) => x.id)).size, 3);
  const same = make("# T\n\n```sh\na\n```\n\n```sh\nb\n```\n").doc; assert.equal(types(same).filter((x) => x === "code").length, 2, "two fences in the same language stay separate");
  const open = make("# T\n\n```sh\nnever closed\n"); assert.ok(types(open.doc).includes("code"), "an unclosed fence does not swallow or crash");
});

test("images: safe sources become image blocks; everything else is dropped with a note", () => {
  const md = "# T\n\n![ok](https://cdn.example/a.png)\n\n![local](/img/b.png)\n\n![bad](javascript:alert)\n\n![http](http://insecure.example/c.png)\n\n![svg](data:image/svg+xml;base64,AAAA)\n";
  const { doc, notes } = make(md); assert.equal(Object.values(doc.blocks).filter((b) => b.type === "image").length, 2);
  assert.equal(notes.filter((n) => /image was skipped/.test(n)).length, 3); assert.equal(validate(doc).ok, true);
});

test("FAQ sections become an accordion only with at least two questions", () => {
  const faq = make("# T\n\n## FAQ\n\n### One?\n\nYes.\n\n### Two?\n\nNo, *really*.\n").doc, acc = Object.values(faq.blocks).find((b) => b.type === "accordion")!.props as any;
  assert.deepEqual(acc.items.map((i: any) => [i.title, i.body]), [["One?", "Yes."], ["Two?", "No, really."]]); assert.equal(new Set(acc.items.map((i: any) => i.id)).size, 2);
  assert.ok(!types(make("# T\n\n## FAQ\n\n### Only one?\n\nYes.\n").doc).includes("accordion"), "a single question stays prose");
});

test("a contents sidebar appears for three or more sections, and can be forced or suppressed", () => {
  const three = "# T\n\n## A\n\na\n\n## B\n\nb\n\n## C\n\nc\n", two = "# T\n\n## A\n\na\n\n## B\n\nb\n";
  const d3 = make(three).doc; assert.ok(types(d3).includes("toc")); assert.equal((d3.blocks.root.props as any).width, "wide");
  const toc = d3.blocks.toc.props as any; assert.deepEqual(toc.items.map((i: any) => i.label), ["A", "B", "C"]);
  for (const it of toc.items) assert.ok(Object.values(d3.blocks).some((b) => b.type === "anchor" && (b.props as any).name === it.target), "every link has an anchor");
  assert.ok(!types(make(two).doc).includes("toc")); assert.ok(types(make(two, { toc: "always" }).doc).includes("toc")); assert.ok(!types(make(three, { toc: "never" }).doc).includes("toc"));
  assert.deepEqual(review(d3).advice, []);
});

test("options: title, id and system override; ids are slugs", () => {
  const { doc } = make("# Original\n\nText", { title: "Custom Title!", id: "my-id", system: "ledger@2" });
  assert.deepEqual([doc.title, doc.id, doc.system], ["Custom Title!", "my-id", "ledger@2"]); assert.equal(validate(doc).ok, true);
  assert.equal(make("# Café & Crème — déjà vu\n\nx").doc.id, "caf-cr-me-d-j-vu"); assert.equal(make("# ___\n\nx", { id: "Bad ID!" }).doc.id, "untitled", "an unusable id falls back instead of failing");
});

test("it is deterministic and always yields a valid document, whatever the text", () => {
  assert.deepEqual(make(sample), make(sample));
  const inputs = ["just a sentence", "# Only a title", "## no title\n\nbody", "```\n```", "|a|b|\n|-|-|", "> \n> \n", "---\n---\n", "![](x)", "# T\n\n" + "para\n\n".repeat(500), "---\ntitle: [unclosed\n---\n\nx", "# " + "x".repeat(5000), "\u0000\u0001 weird   text", "## A\n## B\n## C\n## D\n"];
  for (const md of inputs) { const { doc } = make(md); const v = validate(doc); assert.equal(v.ok, true, JSON.stringify([md.slice(0, 30), v.errors])); assert.ok(doc.title.length <= 160); }
});

test("it rejects empty input and bounds huge input", () => {
  for (const bad of ["", "   \n\n ", null as any, 5 as any]) assert.throws(() => make(bad), /empty/);
  const huge = make("# T\n\n" + Array.from({ length: 400 }, (_, i) => `## Section ${i}\n\ntext ${i}\n`).join("\n") + "x".repeat(200000));
  assert.ok(Object.keys(huge.doc.blocks).length < 900, "block count is capped"); assert.ok(huge.notes.some((n) => /cut|Stopped/.test(n))); assert.equal(validate(huge.doc).ok, true);
  const long = make("# T\n\nintro\n\n" + "word ".repeat(30000)), md = Object.values(long.doc.blocks).find((b) => b.type === "markdown")!.props as any; assert.ok(md.text.length <= 20000);
});

test("the generated page renders in every system with no missing blocks", () => {
  const window: any = { React };
  runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
  for (const system of ["core@1", "ledger@2", "atelier@1"]) {
    const { doc } = make(sample, { system }), html = renderToStaticMarkup(React.createElement(window.Kages.KageRenderer, { doc }));
    assert.doesNotMatch(html, /kg-missing|NaN|undefined/, system);
    for (const c of ["kg-toc", "kg-accordion", "kg-codetabs", "kg-alert", "kg-markdown"]) assert.match(html, new RegExp(c), system + " " + c);
    assert.match(html, /<table/); assert.match(html, /kg-math/); assert.equal(review(doc, system.split("@")[0]).advice.length, 0, system);
  }
});

// F6: nothing the outline drops or rewrites may pass without a note, because the notes are how an agent
// learns to adjust its prose.
test("a leading --- paragraph --- is body text, not front matter, and survives", () => {
  const { doc, notes } = make("---\nIntro paragraph that matters.\n---\n# Title\n\nBody.\n");
  assert.ok(JSON.stringify(doc).includes("Intro paragraph that matters."), JSON.stringify(notes));
});

test("real front matter is still read", () => {
  const { doc } = make("---\ntitle: From meta\ndescription: Short\n---\n\n## One\n\ntext\n");
  assert.equal(doc.title, "From meta");
});

test("a table cut to 500 rows or 12 columns says what was lost", () => {
  const rows = Array.from({ length: 700 }, (_, i) => `| ${i} | x |`).join("\n");
  const { notes } = make(`# T\n\n| a | b |\n| - | - |\n${rows}\n`);
  assert.ok(notes.some((n) => /500 of 700 rows/.test(n)), notes.join(" | "));
  const wide = Array.from({ length: 15 }, (_, i) => "c" + i);
  const { notes: n2 } = make(`# T\n\n| ${wide.join(" | ")} |\n| ${wide.map(() => "-").join(" | ")} |\n| ${wide.map(() => "1").join(" | ")} |\n`);
  assert.ok(n2.some((n) => /15 columns; only the first 12/.test(n)), n2.join(" | "));
});

test("more than 8 adjacent code blocks say how many did not become tabs", () => {
  const fences = Array.from({ length: 10 }, (_, i) => "```l" + i + "\ncode " + i + "\n```").join("\n\n");
  const { notes } = make("# T\n\n" + fences + "\n");
  assert.ok(notes.some((n) => /only the first 8/i.test(n) && /10/.test(n)), notes.join(" | "));
});

test("an id that is replaced is reported", () => {
  const { doc, notes } = make("# Hello\n\ntext\n", { id: "My_Doc" });
  assert.equal(doc.id, "hello");
  assert.ok(notes.some((n) => /My_Doc/.test(n) && /hello/.test(n)), notes.join(" | "));
  assert.equal(make("# Hello\n\ntext\n", { id: "my-doc" }).notes.some((n) => /id/i.test(n)), false, "a valid id is silent");
});

test("an unclosed code fence is reported instead of silently swallowing the rest", () => {
  const { notes, stats } = make("# T\n\n## A\n\n```sh\nnpm i\n\n## B\n\nmore\n");
  assert.equal(stats.sections, 1);
  assert.ok(notes.some((n) => /never closed/i.test(n)), notes.join(" | "));
});

test("anchors count against the block cap, and the cut is reported", () => {
  const md = "# T\n\n" + Array.from({ length: 200 }, (_, i) => `## Section ${i}\n\ntext ${i}\n`).join("\n");
  const { doc, stats, notes } = make(md, { toc: "always" });
  const content = Object.keys(doc.blocks).filter((k) => !["hero", "root", "toc", "layout"].includes(k));
  assert.ok(content.length <= 300, `${content.length} content blocks`);
  assert.ok(stats.blocks <= 300);
  assert.ok(notes.some((n) => /Stopped at 300 blocks/.test(n)), notes.join(" | "));
  const r = review(doc); assert.deepEqual(r.errors, [], JSON.stringify(r.errors));
});
