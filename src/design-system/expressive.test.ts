// Render the actual served implementation, so safety checks cannot pass merely
// because the validator accepts a contract with a missing or unsafe export.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expressiveExamples } from "../packs/examples.ts";
const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl });
const K = window.Kages;
const render = (name: string, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(K[name], props));

test("expressive examples render in every system without missing blocks", () => {
  for (const c of Object.values(K.contracts) as any[]) for (const ev of Object.values(c.events) as any[]) assert.equal(typeof ev.handler, "string", c.ref);
  for (const system of ["core", "ledger", "atelier"]) for (const doc of expressiveExamples(system)) {
    const html = render("KageRenderer", { doc });
    assert.doesNotMatch(html, /kg-missing|NaN|Infinity/);
    if (doc.id === "collection-lab") { assert.match(html, /Atlas/); assert.match(html, /Canvas/); assert.match(html, /Compass/); }
    if (doc.id === "growth-lab") { assert.match(html, /<svg/); assert.match(html, /View chart data/); }
    if (doc.id === "event-planner") { assert.match(html, /<form/); assert.match(html, /required=""/); }
  }
});

test("scene vocabulary never forwards executable attributes or markup", () => {
  const html = render("CoreScene", { label: "Scene", shapes: [
    { kind: "script", text: "alert(1)" }, { kind: "foreignObject", html: "<script>alert(1)</script>" },
    { kind: "rect", x: NaN, width: Infinity, onload: "alert(1)", fill: "url(javascript:alert(1))" },
    { kind: "text", text: "<img src=x onerror=alert(1)>" }, { kind: "path", d: '<script>alert(1)</script>' },
  ] });
  assert.doesNotMatch(html, /<script|<foreignObject|<img| onload=|fill="url|NaN|Infinity/);
  assert.match(html, /&lt;img/);
});

test("rich text escapes HTML and links reject executable schemes", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,x", "//example.com", "/\\example.com", "java\nscript:alert(1)"]) {
    assert.doesNotMatch(render("CoreLink", { href, label: "Click" }), /<a/);
    assert.doesNotMatch(render("CoreRichText", { nodes: [{ kind: "paragraph", runs: [{ text: "Click", href }] }] }), /<a/);
  }
  const html = render("CoreRichText", { nodes: [{ kind: "paragraph", runs: [{ text: "<script>hello</script>", bold: true, href: "https://example.com/" }] }] });
  assert.match(html, /<strong>&lt;script&gt;/);
  assert.match(render("CoreLink", { href: "/guide", label: "Guide", newTab: true }), /rel="noopener noreferrer"/);
});

test("charts preserve negative/zero values in accessible tables and finite geometry", () => {
  for (const name of ["CoreLineChart", "CoreScatterChart"]) {
    const html = render(name, { label: "Points", items: [{ x: -1e308, y: -10 }, { x: 0, y: 0 }, { x: 1e308, y: 20 }, { x: NaN, y: Infinity }] });
    assert.match(html, /<table/); assert.match(html, /<td>0<\/td>/); assert.match(html, /<td>-10<\/td>/);
    assert.doesNotMatch(html, /NaN|Infinity/);
    assert.match(render(name, { label: "Empty", items: [] }), /No data to show/);
  }
});

test("new fields expose native types, names and validation constraints", () => {
  assert.match(render("CoreNumberInput", { label: "Amount", name: "amount", min: 1, max: 10, required: true }), /type="number"/);
  assert.match(render("CoreDateInput", { label: "Date", name: "date", required: true }), /type="date"/);
  assert.match(render("CoreTextField", { label: "Email", kind: "email", required: true }), /type="email"/);
  assert.match(render("CoreChoice", { label: "Choose", options: [{ value: "one", label: "One" }] }), /<legend/);
  assert.match(render("CoreMultiselect", { label: "Options", options: [] }), /multiple=""/);
  assert.match(render("CoreScene", { label: "Pick", interactive: true, shapes: [{ kind: "circle", id: "node", label: "Choose node" }] }), /role="button" tabindex="0"/);
});
