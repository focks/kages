// Use real React server rendering against the served bundle: validation alone
// cannot prove that an export exists or that hostile content stays literal.
// Node does not need the untracked originals/ directory to run these checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { contracts, systems } from "../engine/data.ts";
import { freeFlowExamples } from "../packs/examples.ts";

const base = new URL("../../public/ds/", import.meta.url);
const source = readFileSync(new URL("bundle.js", base), "utf8");
const window: any = { React };
runInNewContext(source, { window, console });
const K = window.Kages;
const render = (name: string, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(K[name], props));

test("free-flow: served registry equals the extracted engine registry, and every role has an implementation", () => {
  assert.equal(JSON.stringify(K.contracts), JSON.stringify(contracts));
  assert.equal(JSON.stringify(K.systems), JSON.stringify(systems));
  for (const system of Object.keys(systems)) {
    for (const role of Object.keys(systems[system].components)) {
      assert.equal(typeof K.resolve(system, role).impl, "function", `${system}/${role}`);
    }
  }
  for (const doc of freeFlowExamples()) {
    const markup = render("KageRenderer", { doc });
    assert.doesNotMatch(markup, /kg-missing|kg-shell|kg-side/);
    assert.match(markup, /kg-page/);
  }
});

test("free-flow: executable image schemes are refused and text never becomes markup", () => {
  for (const src of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "data:image/svg+xml;base64,PHN2Zz4=", "//untrusted.example/pic.png", "/\\untrusted.example/pic.png"]) {
    assert.doesNotMatch(render("CoreImage", { src, alt: "Example" }), /<img/);
  }
  for (const src of ["https://example.com/pic.png", "/pic.png", "data:image/png;base64,aGVsbG8="]) {
    assert.match(render("CoreImage", { src, alt: "Example" }), /<img/);
  }
  const hostile = "<script>alert(1)</script>";
  assert.doesNotMatch(render("CoreCode", { code: hostile }), /<script>/);
  assert.match(render("CoreCode", { code: hostile }), /&lt;script&gt;/);
  assert.doesNotMatch(render("CoreList", { items: [hostile] }), /<script>/);
  assert.doesNotMatch(render("CoreSection", { title: hostile }), /<script>/);
});

test("free-flow: dynamic numeric bounds and chart values produce finite geometry", () => {
  const slider = render("CoreSlider", { label: "Value", min: 10, max: -10, step: 0, value: Infinity });
  assert.match(slider, /aria-label="Value"/);
  assert.match(slider, /min="10"/); assert.match(slider, /max="110"/);
  assert.doesNotMatch(slider, /NaN|Infinity/);
  assert.match(render("CoreGrid", { columns: 5 }), /--kg-columns:5/);
  assert.doesNotMatch(render("CoreGrid", { columns: NaN }), /NaN/);
  const chart = render("CoreBarChart", { label: "Comparison", items: [{ label: "Negative", value: -5 }, { label: "Zero", value: 0 }, { label: "Invalid", value: NaN }] });
  assert.match(chart, /-5/); assert.doesNotMatch(chart, /NaN|Infinity|Invalid/);
});

test("free-flow: asset integrity hashes match every served byte", () => {
  const hashes = JSON.parse(readFileSync(new URL("integrity.json", base), "utf8"));
  for (const name of ["bundle.js", "bundle.css", "tokens.css"]) {
    assert.equal(hashes[name], "sha384-" + createHash("sha384").update(readFileSync(new URL(name, base))).digest("base64"), name);
  }
});

test("a stack's fixed columns refit on a narrow canvas, and a stat's row can wrap instead of overflowing", () => {
  const css = readFileSync(new URL("bundle.css", base), "utf8");
  // The inline repeat(N) comes from the oracle's stack; only an !important container rule can override it.
  assert.match(css, /@container \(max-width: 60rem\) \{\s*\.kg-stack\[style\*="grid-template-columns"\] \{[^}]*auto-fit[^}]*!important/);
  assert.match(css, /\.lg-stat__top, \.lg-stat__row \{ flex-wrap: wrap; \}/);
});
