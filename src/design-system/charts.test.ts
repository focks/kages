// Batch 4 charts against the served bundle: geometry stays finite for any data,
// text is never markup, every chart keeps a table, and selection is public state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chartExamples } from "../packs/examples.ts";
import { KageSession } from "../engine/session.ts";
import { validate } from "../engine/validate.ts";
const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
const K = window.Kages;
const render = (name: string, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(K[name], props));
const count = (html: string, re: RegExp) => (html.match(re) || []).length;
const CLEAN = /NaN|Infinity|undefined|<script|<img/;

test("the quarterly report renders every chart in every system and validates with the pure engine", () => {
  for (const system of ["core", "ledger", "atelier"]) for (const doc of chartExamples(system)) {
    const html = renderToStaticMarkup(React.createElement(K.KageRenderer, { doc }));
    assert.doesNotMatch(html, /kg-missing|NaN|Infinity|undefined/, system);
    for (const cls of ["kg-combo", "kg-stacked", "kg-funnel", "kg-treemap", "kg-sankey", "kg-map"]) assert.match(html, new RegExp(cls));
    assert.equal(count(html, /View chart data/g), 6, "every chart keeps its data table");
    const v = validate(doc); assert.deepEqual([v.errors, v.warnings], [[], []], system);
  }
});

test("combo chart: bars and lines share one axis; gaps, negatives and hostile names are safe", () => {
  const html = render("CoreComboChart", { label: "C", categories: ["a", "<img src=x onerror=alert(1)>", "c"], series: [{ name: "Bars", kind: "bar", values: [1, -2, 3] }, { name: "Line", kind: "line", values: [2, null, 4] }, { name: "Bad", kind: "bar", values: [NaN, Infinity, 1e308] }, null, { name: "NoValues" }] });
  assert.doesNotMatch(html, CLEAN); assert.match(html, /&lt;img/);
  assert.ok(count(html, /<rect/g) >= 3); assert.ok(count(html, /<path/g) >= 1); assert.ok(count(html, /<circle/g) >= 2);
  assert.match(render("CoreComboChart", { label: "E", categories: [], series: [] }), /No data to show/);
  for (const name of ["CoreTreemap", "CoreFunnelChart", "CoreSankey"]) {
    const huge = render(name, { label: "H", items: [{ label: "a", value: 1e308 }, { label: "b", value: 1 }], stages: [{ label: "a", value: 1e308 }, { label: "b", value: 1 }], nodes: [{ id: "a" }, { id: "b" }], links: [{ from: "a", to: "b", value: 1e308 }] });
    assert.doesNotMatch(huge, CLEAN, name + " with astronomically large values");
  }
  assert.doesNotMatch(render("CoreComboChart", { label: "Z", categories: ["a", "b"], series: [{ name: "z", values: [0, 0] }] }), CLEAN, "all-zero data");
  assert.match(render("CoreComboChart", { label: "L", categories: ["a"], series: Array.from({ length: 8 }, (_, i) => ({ name: "s" + i, values: [i] })) }), /opacity="0\.65"/, "series beyond the palette are distinguished by opacity");
});

test("stacked bars ignore negatives, support percent mode and stay finite", () => {
  const abs = render("CoreStackedBarChart", { label: "S", categories: ["a", "b"], series: [{ name: "x", values: [3, -5] }, { name: "y", values: [2, null] }] });
  assert.doesNotMatch(abs, CLEAN); assert.equal(count(abs, /<rect/g), 2, "b/x (negative) and b/y (missing) draw nothing");
  const pct = render("CoreStackedBarChart", { label: "S", percent: true, categories: ["a"], series: [{ name: "x", values: [1] }, { name: "y", values: [3] }] });
  assert.match(pct, />100</); assert.doesNotMatch(pct, CLEAN);
  assert.doesNotMatch(render("CoreStackedBarChart", { label: "S", percent: true, categories: ["a"], series: [{ name: "x", values: [0] }] }), CLEAN, "an empty stack in percent mode divides by nothing");
});

test("funnel: percentages relate to the first stage; zero, negative and bad stages are handled", () => {
  const html = render("CoreFunnelChart", { label: "F", stages: [{ label: "A", value: 100 }, { label: "B", value: 25 }, { label: "<b>x</b>", value: -3 }, { label: "N", value: NaN }, { label: "Z", value: 0 }] });
  assert.doesNotMatch(html, CLEAN); assert.doesNotMatch(html, /<b>/); assert.match(html, /25%/); assert.match(html, /0%/);
  assert.match(render("CoreFunnelChart", { label: "F", stages: [{ label: "A", value: 0 }] }), /No data to show/);
  assert.equal(count(render("CoreFunnelChart", { label: "F", interactive: true, selected: "A", stages: [{ label: "A", value: 2 }, { label: "B", value: 1 }] }), /role="button"/g), 2);
});

test("treemap: squarified, areas proportional, tiny cells unlabelled, selection operable", () => {
  const items = [{ label: "Big", value: 60 }, { label: "Mid", value: 30 }, { label: "Small", value: 9 }, { label: "Tiny", value: 1 }];
  const html = render("CoreTreemap", { label: "T", items, interactive: true, selected: "Mid" });
  const rects = [...html.matchAll(/<rect[^>]*width="([\d.]+)" height="([\d.]+)"/g)].map((m) => Number(m[1]) * Number(m[2]));
  assert.equal(rects.length, 4); assert.ok(rects[0] > rects[1] && rects[1] > rects[2] && rects[2] > rects[3], "areas follow the values");
  assert.ok(Math.abs(rects.reduce((a, b) => a + b, 0) - 640 * 360) < 640 * 360 * 0.05, "rectangles tile the canvas");
  assert.equal(count(html, /role="button"/g), 4); assert.match(html, /aria-pressed="true"/); assert.match(html, /tabindex="0"/);
  assert.doesNotMatch(render("CoreTreemap", { label: "T", items: [{ label: "<i>", value: 1 }, { label: "n", value: NaN }, { label: "neg", value: -1 }] }), /<i>|NaN/);
  assert.match(render("CoreTreemap", { label: "T", items: [] }), /No data to show/);
  assert.doesNotMatch(render("CoreTreemap", { label: "T", items: Array.from({ length: 500 }, (_, i) => ({ label: "i" + i, value: i + 1 })) }), CLEAN, "bounded to 80 items");
});

test("sankey: layers, forward links only, cycles dropped, flows conserved", () => {
  const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "<u>d</u>" }];
  const html = render("CoreSankey", { label: "S", nodes, links: [{ from: "a", to: "b", value: 5 }, { from: "b", to: "c", value: 3 }, { from: "c", to: "b", value: 9 }, { from: "a", to: "a", value: 1 }, { from: "a", to: "ghost", value: 1 }, { from: "a", to: "<u>d</u>", value: -2 }, { from: "b", to: "<u>d</u>", value: 2 }] });
  assert.doesNotMatch(html, CLEAN); assert.doesNotMatch(html, /<u>/);
  assert.equal(count(html, /<path/g), 3, "a→b, b→c and b→d survive; the cycle, self, dangling and negative links do not");
  assert.match(html, /a → b: 5/);
  assert.match(render("CoreSankey", { label: "S", nodes: [{ id: "a" }, { id: "b" }], links: [{ from: "a", to: "b", value: 1 }, { from: "b", to: "a", value: 1 }] }), /<path/, "a two-node cycle keeps its forward link");
  assert.match(render("CoreSankey", { label: "S", nodes: [], links: [] }), /No data to show/);
  const wide = render("CoreSankey", { label: "S", nodes: Array.from({ length: 60 }, (_, i) => ({ id: "n" + i })), links: Array.from({ length: 59 }, (_, i) => ({ from: "n" + i, to: "n" + (i + 1), value: 1 })) });
  assert.doesNotMatch(wide, CLEAN, "a long chain stays finite");
});

test("map: GeoJSON polygons project to finite paths; bad geometry is skipped; selection works", () => {
  const sq = (x: number, y: number) => ({ type: "Polygon", coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] });
  const html = render("CoreMap", { label: "M", interactive: true, selected: "b", features: [
    { id: "a", name: "A", value: 1, geometry: sq(0, 0) }, { id: "b", name: "<img>", value: 9, geometry: { type: "MultiPolygon", coordinates: [sq(2, 0).coordinates, sq(4, 0).coordinates] } },
    { id: "c", name: "Bad", geometry: { type: "Polygon", coordinates: [[[NaN, 1], [Infinity, 2], [1e9, 1e9]]] } }, { id: "d", name: "Point", geometry: { type: "Point", coordinates: [0, 0] } }, { id: "e", geometry: null }, null] });
  assert.doesNotMatch(html, CLEAN); assert.match(html, /&lt;img&gt;/);
  assert.equal(count(html, /<path/g), 2, "only the two valid regions draw"); assert.match(render("CoreMap", { label: "M", features: [{ id: "a", name: "Wide", geometry: { type: "Polygon", coordinates: [[[0, 0], [20, 0], [20, 10], [0, 10], [0, 0]]] } }] }), /<text[^>]*>Wide</, "a region large enough is named"); assert.match(html, /fill-rule="evenodd"/);
  assert.match(html, /aria-pressed="true"/); assert.match(html, /color-mix/);
  assert.match(render("CoreMap", { label: "M", features: [] }), /No data to show/);
  const big = render("CoreMap", { label: "M", features: [{ id: "x", geometry: { type: "Polygon", coordinates: [Array.from({ length: 50000 }, (_, i) => [i % 180, (i % 80)])] } }] });
  assert.ok(big.length < 400000, "the total point budget bounds the output");
});

test("chart selection is public state and clears when chosen twice", () => {
  const s = new KageSession(structuredClone(chartExamples()[0]));
  assert.equal(s.read("pipeline")?.selected, ""); assert.equal(s.read("regions")?.selected, "");
  s.dispatch("pipeline", "select", { label: "Trials", value: 1200, index: 2 }); assert.equal(s.read("pipeline")?.selected, "Trials");
  s.dispatch("pipeline", "select", { label: "Trials", value: 1200, index: 2 }); assert.equal(s.read("pipeline")?.selected, "");
  s.dispatch("costs", "select", { label: "Sales", value: 24, index: 1 }); assert.equal(s.read("costs")?.selected, "Sales");
  s.dispatch("regions", "select", { id: "east", name: "East", value: 80 }); assert.equal(s.read("regions")?.selected, "east");
});
