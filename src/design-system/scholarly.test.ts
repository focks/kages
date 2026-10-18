// Scholarly reading against the served bundle: citations, references, glossary,
// attributed quotes, captioned figures and highlighted code. The hostile cases
// pin the rules that keep these blocks data-only: no HTML string, no author text
// as a DOM id, only passive links.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { contentExamples } from "../packs/examples.ts";
import { KageSession } from "../engine/session.ts";
import { lint } from "../engine/advice.ts";
import { mk } from "../engine/rules/fixtures.ts";

const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
const K = window.Kages;
const render = (name: string, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(K[name], props));
const count = (html: string, re: RegExp) => (html.match(re) || []).length;
const brief = contentExamples().find((d) => d.id === "research-brief")!;

test("code: tokens are spans of literal text, per language, and highlighting can be turned off", () => {
  const js = render("CoreCode", { language: "ts", code: "// note\nconst x = \"a<b\" + 42;" });
  assert.match(js, /kg-tok--c">\/\/ note</); assert.match(js, /kg-tok--k">const</); assert.match(js, /kg-tok--s">&quot;a&lt;b&quot;</); assert.match(js, /kg-tok--n">42</);
  assert.match(render("CoreCode", { language: "sh", code: "echo hi # c" }), /kg-tok--c">#/);
  assert.match(render("CoreCode", { language: "json", code: "{\"a\": [true, null, 1.5]}" }), /kg-tok--k">true</);
  assert.match(render("CoreCode", { language: "sql", code: "SELECT a FROM t -- x" }), /kg-tok--k">SELECT</);
  assert.doesNotMatch(render("CoreCode", { language: "plaintext", code: "const x = 1" }), /kg-tok/, "an unknown language stays plain");
  assert.doesNotMatch(render("CoreCode", { code: "const x = 1" }), /kg-tok/, "no language, no colour");
  assert.doesNotMatch(render("CoreCode", { language: "ts", code: "const x = 1", highlight: false }), /kg-tok/);
});

test("code: hostile and unterminated source stays text, keeps every character and finishes fast", () => {
  const evil = "</code><script>alert(1)</script> \"unterminated\n/* open";
  const html = render("CoreCode", { language: "js", code: evil });
  assert.doesNotMatch(html, /<script/); assert.match(html, /&lt;script&gt;/);
  const text = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
  const body = (h: string) => text(/<code>([\s\S]*)<\/code>/.exec(h)![1]);
  assert.equal(body(html).includes("unterminated"), true);
  const code = "/*".repeat(9000) + "'" .repeat(2000);
  const t = Date.now(); const big = render("CoreCode", { language: "js", code });
  assert.ok(Date.now() - t < 1500, "pathological input does not blow up");
  assert.equal(body(big), code, "the visible text is exactly the source");
  assert.doesNotMatch(render("CoreCode", { language: "js", code: "a".repeat(20001) }), /kg-tok/, "over the cap it renders plain");
});

test("rich-text: a cite run is a superscript link to a namespaced reference id", () => {
  const html = render("CoreRichText", { nodes: [{ kind: "paragraph", runs: [{ text: "Claim" }, { text: "2", cite: "Dora!" }] }] });
  assert.match(html, /<sup class="kg-cite"><a href="#kg-a-ref-dora" aria-label="Source 2">2<\/a><\/sup>/);
  assert.doesNotMatch(render("CoreRichText", { nodes: [{ kind: "paragraph", runs: [{ text: "1", cite: "\"><script>" }] }] }), /<script|onerror/);
  assert.doesNotMatch(render("CoreRichText", { nodes: [{ kind: "paragraph", runs: [{ text: "1", cite: "!!!" }] }] }), /<sup/, "an id with no usable characters is not a link");
});

test("rich-text: attribution sits in a figcaption outside the blockquote; links stay passive", () => {
  const html = render("CoreRichText", { nodes: [{ kind: "quote", text: "Quote", attribution: "A. Person", href: "https://example.com/x" }] });
  assert.match(html, /<figure class="kg-quote"><blockquote>Quote<\/blockquote><figcaption><a href="https:\/\/example\.com\/x"/);
  const bad = render("CoreRichText", { nodes: [{ kind: "quote", text: "Quote", attribution: "A. Person", href: "javascript:alert(1)" }] });
  assert.doesNotMatch(bad, /javascript:/); assert.match(bad, /<figcaption>A\. Person<\/figcaption>/);
  assert.doesNotMatch(render("CoreRichText", { nodes: [{ kind: "quote", text: "Quote" }] }), /figure/, "no attribution keeps the plain blockquote");
});

test("scene and diagram: the caption is the visible text; the label stays the accessible name", () => {
  const scene = render("CoreScene", { label: "Branch graph", caption: "Branches rejoin within a day.", shapes: [] });
  assert.match(scene, /<figcaption>Branches rejoin within a day\.<\/figcaption>/); assert.match(scene, /aria-label="Branch graph"/);
  assert.match(render("CoreScene", { label: "Only label", shapes: [] }), /<figcaption>Only label<\/figcaption>/, "without a caption the label is shown, as before");
  assert.match(render("CoreDiagram", { label: "Flow", caption: "Takeaway.", nodes: [{ id: "a", label: "A" }] }), /<figcaption>Takeaway\.<\/figcaption>/);
});

test("references and glossary: numbered, jumpable and literal", () => {
  const refs = render("CoreReferences", { title: "Sources", items: [{ id: "a", label: "A <b>doc</b>", href: "https://example.com/a", detail: "Org" }, { id: "b", label: "B", href: "javascript:alert(1)" }, { id: "!!!", label: "dropped" }, { label: "no id" }] });
  assert.equal(count(refs, /<li /g), 2, "items without a usable id are dropped");
  assert.match(refs, /<ol class="kg-references__list">/); assert.match(refs, /id="kg-a-ref-a"/); assert.match(refs, /A &lt;b&gt;doc/);
  assert.doesNotMatch(refs, /javascript:|<b>/); assert.match(refs, /rel="noopener noreferrer"/);
  assert.equal(render("CoreReferences", { items: [] }), "");
  const terms = render("CoreGlossary", { items: [{ term: "Trunk", definition: "The <i>one</i> branch" }, { term: "", definition: "x" }] });
  assert.match(terms, /<dl class="kg-glossary__list"><div[^>]*><dt>Trunk<\/dt><dd>The &lt;i&gt;one/); assert.equal(count(terms, /<dt>/g), 1); assert.doesNotMatch(terms, /<i>/);
  assert.equal(count(render("CoreGlossary", { items: Array.from({ length: 500 }, (_, i) => ({ term: "t" + i, definition: "d" })) }), /<dt>/g), 200, "bounded");
});

test("the research brief renders in every system, lints clean and its ticks add up", () => {
  for (const system of ["core", "ledger", "atelier"]) {
    const doc = contentExamples(system).find((d) => d.id === "research-brief")!;
    const html = renderToStaticMarkup(React.createElement(K.KageRenderer, { doc }));
    assert.doesNotMatch(html, /kg-missing|NaN|Infinity|undefined/, system);
    for (const c of ["kg-toc", "kg-cite", "kg-quote", "kg-glossary", "kg-references", "kg-tok", "<figcaption>Branches rejoin"]) assert.match(html, new RegExp(c), system + " " + c);
    assert.deepEqual(lint(doc).filter((f: any) => f.severity === "P0" || f.severity === "P1" || f.rule === "dangling-cite"), [], system);
  }
  const s = new KageSession(structuredClone(brief));
  assert.equal(s.read("score")?.value, 0);
  s.dispatch("k1", "change", { checked: true }); s.dispatch("k3", "change", { checked: true });
  assert.equal(s.read("score")?.value, 2);
  for (const k of ["k2", "k4"]) s.dispatch(k, "change", { checked: true });
  assert.equal(s.read("score")?.value, 4);
});

test("dangling-cite: a missing source and a wrong number are both reported", () => {
  const doc = (text: string, cite: string) => mk({ t: { type: "rich-text", props: { nodes: [{ kind: "paragraph", runs: [{ text, cite }] }] } }, r: { type: "references", props: { items: [{ id: "a", label: "A" }, { id: "b", label: "B" }] } } });
  const hits = (d: any) => lint(d).filter((f: any) => f.rule === "dangling-cite");
  assert.equal(hits(doc("2", "b")).length, 0);
  assert.match(hits(doc("1", "b"))[0].msg, /number 2/);
  assert.match(hits(doc("1", "zzz"))[0].msg, /no matching item/);
});
