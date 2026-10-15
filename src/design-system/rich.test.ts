// Renders the served bundle, so passing means the shipped implementation is
// safe, not just that the contract validates. Batch 1 rich roles.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { richExamples } from "../packs/examples.ts";
import { KageSession } from "../engine/session.ts";
const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
const K = window.Kages;
const render = (name: string, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(K[name], props));

test("rich examples render in every system without errors or bad numbers", () => {
  for (const system of ["core", "ledger", "atelier"]) for (const doc of richExamples(system)) {
    const html = renderToStaticMarkup(React.createElement(K.KageRenderer, { doc }));
    assert.doesNotMatch(html, /kg-missing|NaN|Infinity|undefined/, doc.id + " " + system);
    if (doc.id === "metrics-board") for (const cls of ["kg-area", "kg-donut", "kg-gauge", "kg-sparkline", "kg-heatmap", "kg-alert"]) assert.match(html, new RegExp(cls));
    if (doc.id === "launch-flow") for (const cls of ["kg-stepper", "kg-accordion", "kg-timeline"]) assert.match(html, new RegExp(cls));
  }
});

test("charts survive hostile and non-finite data and always expose a data table", () => {
  const bad = [{ x: NaN, y: 1 }, { x: 1e308, y: -1e308 }, { x: -1e308, y: Infinity }, null, { x: 2, y: 3, label: "<img src=x onerror=alert(1)>" }];
  const area = render("CoreAreaChart", { label: "A", items: bad });
  assert.doesNotMatch(area, /NaN|Infinity|<img/); assert.match(area, /<table/); assert.match(area, /&lt;img/);
  assert.match(render("CoreAreaChart", { label: "E", items: [] }), /No data to show/);
  const donut = render("CoreDonutChart", { label: "D", items: [{ label: "Only", value: 5 }, { label: "<b>x</b>", value: -3 }, { label: "Zero", value: 0 }, { label: "Bad", value: NaN }] });
  assert.doesNotMatch(donut, /NaN|Infinity|<b>/); assert.match(donut, /100%/); assert.match(donut, /<path/);
  assert.match(render("CoreDonutChart", { label: "E", items: [{ label: "z", value: 0 }] }), /No data to show/);
  const heat = render("CoreHeatmap", { label: "H", rows: ["a"], columns: ["<script>"], values: [[NaN, 2, 3]] });
  assert.doesNotMatch(heat, /<script|NaN/); assert.match(heat, /–/);
  assert.match(render("CoreSparkline", { label: "S", values: [1] }), /–/);
  assert.doesNotMatch(render("CoreSparkline", { label: "S", values: [1, NaN, 3, 1e308, -1e308] }), /NaN|Infinity/);
});

test("gauge clamps to its range and reports meter semantics", () => {
  const over = render("CoreGauge", { label: "G", value: 500, min: 0, max: 100 });
  assert.match(over, /role="meter"/); assert.match(over, /aria-valuenow="100"/);
  assert.match(render("CoreGauge", { label: "G", value: -5, min: 0, max: 100 }), /aria-valuenow="0"/);
  assert.doesNotMatch(render("CoreGauge", { label: "G", value: NaN, min: 5, max: 5 }), /NaN|Infinity/);
});

test("disclosure and flow blocks keep semantics and render text literally", () => {
  const acc = render("CoreAccordion", { items: [{ id: "a", title: "<i>A</i>", body: "<script>x</script>" }, { id: "b", title: "B", body: "two" }], value: "a" });
  assert.match(acc, /aria-expanded="true"/); assert.match(acc, /aria-expanded="false"/); assert.match(acc, /hidden=""/);
  assert.doesNotMatch(acc, /<script|<i>/);
  const step = render("CoreStepper", { label: "S", value: "b", interactive: true, steps: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }] });
  assert.match(step, /aria-current="step"/); assert.match(step, /<button/); assert.match(step, /✓/);
  assert.doesNotMatch(render("CoreStepper", { label: "S", value: "b", steps: [{ id: "a", label: "A" }] }), /<button/);
  assert.match(render("CoreAlert", { tone: "danger", title: "T" }), /role="alert"/);
  assert.match(render("CoreAlert", { tone: "info", title: "T" }), /role="status"/);
  assert.match(render("CoreTimeline", { label: "T", items: [{ title: "<b>x</b>", time: "Mon" }] }), /&lt;b&gt;/);
  assert.equal(render("CoreModal", { label: "M", open: false }), "");
  const open = render("CoreModal", { label: "M", open: true, closeLabel: "Dismiss" });
  assert.match(open, /role="dialog"/); assert.match(open, /aria-modal="true"/); assert.match(open, /aria-label="Dismiss"/);
});

test("stepper, accordion and modal drive public state through the session", () => {
  const session = new KageSession(richExamples()[1]);
  session.dispatch("stepper", "change", { value: "build" });
  assert.equal(session.getState().step, "build");
  assert.equal(session.read("stepper")?.value, "build");
  session.dispatch("help", "change", { value: "undo" });
  assert.equal(session.getState().faq, "undo");
  assert.equal(session.read("dialog")?.open, false);
  session.dispatch("openConfirm", "click");
  assert.equal(session.read("dialog")?.open, true);
  session.dispatch("go", "click");
  assert.equal(session.read("dialog")?.open, false);
  session.dispatch("dialog", "change", { open: true });
  assert.equal(session.read("dialog")?.open, true);
});
