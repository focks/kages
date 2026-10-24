// Behavioral checks use served contracts, including the old refs, so stable
// colors cannot be achieved by silently changing a published implementation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { validate } from "../engine/validate.ts";
import { KageSession } from "../engine/session.ts";
import type { KageDoc } from "../engine/types.ts";

const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
const K = window.Kages;
const render = (ref: string, props: object) => renderToStaticMarkup(React.createElement(K.implementation(ref), props));
const domain = ["Explore", "Compare", "Explain"];

test("treemap color identity survives rank changes, filtering and a different chart geometry", () => {
  const items = [{ label: "Explore", value: 10 }, { label: "Compare", value: 30 }];
  const a = render("core/treemap@1.1.0", { label: "Mix", items, colorDomain: domain, interactive: true });
  const b = render("core/treemap@1.1.0", { label: "Mix", items: [{ label: "Compare", value: 5 }, { label: "Explore", value: 40 }], colorDomain: domain, interactive: true });
  const c = render("core/donut-chart@1.2.0", { label: "Mix", items: [items[0]], colorDomain: domain, interactive: true });
  for (const html of [a, b]) {
    assert.match(html, /aria-label="Explore:[^"]*"[^>]*fill="var\(--kg-data-0\)"/);
    assert.match(html, /aria-label="Compare:[^"]*"[^>]*fill="var\(--kg-data-1\)"/);
  }
  assert.match(c, /fill="var\(--kg-data-0\)"[^>]*aria-label="Explore:/);
  assert.doesNotMatch(a, /fill="var\(--kg-(?:danger|success|accent)\)"/);
  assert.match(render("core/treemap@1.0.0", { label: "Old", items }), /fill="var\(--kg-accent\)"/);
});

test("shared chart context exposes availability and source without inventing freshness", () => {
  const props = { label: "Capacity", items: [{ label: "A", value: 4 }], source: "Illustrative data", unit: "Tasks", takeaway: "A worked example.", updatedAt: "2026-10-24", status: "stale" };
  const html = render("core/bar-chart@1.1.0", props);
  for (const text of ["Tasks", "A worked example.", "Source: Illustrative data", "Updated: 2026-10-24", "out of date", "View chart data"]) assert.ok(html.includes(text), text);
  const failed = render("core/bar-chart@1.1.0", { ...props, status: "error", statusMessage: "Refresh failed" });
  assert.match(failed, /role="alert"/); assert.match(failed, /Refresh failed/); assert.doesNotMatch(failed, /kg-analytical-bars__bar/);
  assert.match(render("core/bar-chart@1.1.0", { ...props, status: "loading" }), /aria-busy="true"/);
});

test("analytical bars handle negative and huge values and expose selection through the engine", () => {
  const html = render("core/bar-chart@1.1.0", { label: "Signed", interactive: true, colorBy: "category", colorDomain: domain, items: [{ label: "Explore", value: -1e308 }, { label: "Compare", value: 1e308 }, { label: "Bad", value: Infinity }] });
  assert.doesNotMatch(html, /NaN|Infinity|undefined/); assert.equal((html.match(/type="button"/g) || []).length, 2);
  assert.match(html, /width:50%/);
  const doc: KageDoc = { kages: "1.0", id: "bars", title: "Bars", system: "core@1", root: "bars", blocks: { bars: { type: "bar-chart", props: { label: "Budget", interactive: true, colorBy: "category", colorDomain: ["Services"], items: [{ label: "Team A", category: "Services", value: 10 }] } } } };
  assert.deepEqual(validate(doc).errors, []);
  const s = new KageSession(doc);
  s.dispatch("bars", "select", { label: "Team A", value: 10, index: 0 }); assert.equal(s.read("bars")?.selected, "Team A");
  s.dispatch("bars", "select", { label: "Team A", value: 10, index: 0 }); assert.equal(s.read("bars")?.selected, "");
});

test("canvas personalities are valid portable contracts with safe literal text", () => {
  for (const system of ["core", "ledger", "atelier"]) for (const personality of ["analytical", "editorial", "exploratory", "teaching", "showcase"]) {
    const doc: KageDoc = { kages: "1.0", id: "canvas", title: "Canvas", system, root: "root", blocks: { root: { type: "canvas", props: { title: "<script>not code</script>", personality, appearance: "dark" } } } };
    assert.deepEqual(validate(doc).errors, [], system + personality);
    const html = renderToStaticMarkup(React.createElement(K.KageRenderer, { doc }));
    assert.match(html, new RegExp("kg-canvas--" + personality)); assert.doesNotMatch(html, /<script>/); assert.match(html, /data-appearance="dark"/);
  }
});

test("Cartesian charts expose point and range selections, contextual axes and supplied bounds", () => {
  const doc: KageDoc = { kages: "1.0", id: "plot", title: "Plot", system: "core", root: "plot", blocks: { plot: { type: "line-chart", props: {
    label: "Scenario", xLabel: "Period", yLabel: "Tasks", interactive: true, rangeControls: true,
    items: [{ id: "a", x: 1, y: 20, lower: 15, upper: 24, series: "Baseline" }, { id: "b", x: 2, y: 40, lower: 32, upper: 45, series: "Baseline" }],
    annotations: [{ axis: "y", value: 30, label: "Reference" }], colorDomain: ["Baseline"]
  } } } };
  assert.deepEqual(validate(doc).errors, []);
  const html = render("core/line-chart@1.2.0", doc.blocks.plot.props!);
  for (const text of ["Period", "Tasks", "Reference", "supplied lower/upper bounds", "Reset range", "View chart data"]) assert.ok(html.includes(text), text);
  assert.match(html, /role="button"/);
  const s = new KageSession(doc);
  s.dispatch("plot", "select", { id: "b", label: "B", x: 2, y: 40, index: 1 });
  assert.equal(s.read("plot")?.selected, "b");
  s.dispatch("plot", "rangeChange", { min: 1.2, max: 2 });
  assert.deepEqual(s.read("plot")?.range, { min: 1.2, max: 2 });
  s.dispatch("plot", "legendChange", { hidden: ["Baseline"] });
  assert.deepEqual(s.read("plot")?.hiddenSeries, ["Baseline"]);
  assert.doesNotMatch(render("core/line-chart@1.2.0", { ...doc.blocks.plot.props, hiddenSeries: ["Baseline"] }), /data-point-id=/);
  assert.doesNotMatch(render("core/scatter-chart@1.2.0", { label: "Extreme", xMin: 0, xMax: 1, yMin: 0, yMax: 1, items: [{ x: -1e308, y: 1e308 }, { x: 1e308, y: -1e308 }] }), /NaN|Infinity|undefined/);
  assert.doesNotMatch(render("core/line-chart@1.0.0", doc.blocks.plot.props!), /kg-chart-frame|Reset range/);
});

test("graph groups preserve external relationships and the legacy graph keeps its original controls", () => {
  const props = { label: "System", explore: true, layout: "swimlane", nodes: [{ id: "a", label: "Collect", group: "Inputs" }, { id: "b", label: "Clean", group: "Inputs" }, { id: "c", label: "Explain", group: "Outputs" }], edges: [{ from: "a", to: "b" }, { from: "a", to: "c" }, { from: "b", to: "c" }], collapsedGroups: ["Inputs"] };
  const html = render("core/diagram@1.3.0", props);
  for (const text of ["Find a node", "Fit graph", "Inputs · 2 nodes", "2 connections", "Expand Inputs", "Explain"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, />Collect<|>Clean</);
  const doc: KageDoc = { kages: "1.0", id: "graph", title: "Graph", system: "core", root: "g", blocks: { g: { type: "diagram", props } } };
  assert.deepEqual(validate(doc).errors, []);
  const { collapsedGroups: initialGroups, ...unbound } = props;
  assert.deepEqual(initialGroups, ["Inputs"]);
  const s = new KageSession({ ...doc, blocks: { g: { ...doc.blocks.g, props: unbound } } });
  s.dispatch("g", "groupsChange", { groups: ["Outputs"] });
  assert.deepEqual(s.read("g")?.collapsedGroups, ["Outputs"]);
  s.dispatch("g", "select", { id: "c" }); assert.equal(s.read("g")?.selected, "c");
  assert.doesNotMatch(render("core/diagram@1.2.0", props), /Find a node|Fit graph/);
});

test("statistical charts preserve counts, totals and comparable panel scales", () => {
  const histogram = render("core/histogram-chart@1.0.0", { label: "Distribution", values: [0, 0, 1, 2, 3, 4], bins: 2 });
  assert.equal((histogram.match(/<td>3<\/td>/g) || []).length, 2, "each bin contains three observations including the final edge");
  assert.match(histogram, /6 observations/);
  assert.doesNotMatch(render("core/histogram-chart@1.0.0", { label: "Extreme", values: [-1e308, 1e308] }), /NaN|Infinity/);
  const waterfall = render("core/waterfall-chart@1.0.0", { label: "Changes", items: [{ label: "Start", value: 120, total: true }, { label: "Cost", value: -30 }, { label: "Adjustment", value: -20 }, { label: "End", value: 70, total: true }] });
  assert.match(waterfall, /Final value: 70/);
  assert.match(render("core/waterfall-chart@1.0.0", { label: "Overflow", items: [{ label: "A", value: 1e308 }, { label: "B", value: 1e308 }] }), /Rescale the units/);
  assert.match(render("core/box-plot@1.0.0", { label: "Invalid summary", items: [{ label: "Bad", min: 10, q1: 4, median: 5, q3: 6, max: 7 }] }), /No data to show/);
  const small = render("core/small-multiples@1.0.0", { label: "Comparison", panels: [{ label: "First", items: [{ id: "shared", x: 0, y: 20 }, { x: 1, y: 40 }] }, { label: "Second", items: [{ id: "shared", x: 0, y: 20 }, { x: 1, y: 80 }] }] });
  const positions = [...small.matchAll(/data-point-id="shared" cx="[^"]+" cy="([^"]+)"/g)].map(m => m[1]);
  assert.equal(positions.length, 2); assert.equal(positions[0], positions[1], "the same value occupies the same position in both panels");
  assert.equal((small.match(/View chart data/g) || []).length, 2);
});

test("CSV preview preserves identifiers and quoted text, validates types and rejects unsafe headers", () => {
  const parse = (text: string, types?: object) => JSON.parse(JSON.stringify(K.parseCsvPreview(text, types)));
  const parsed = parse('id,name,value,active\r\n001,"A, B",12,true\r\n002,"Two ""quotes""\nand a newline",18,false');
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.types, { id: "string", name: "string", value: "number", active: "boolean" });
  assert.deepEqual(parsed.rows[0], { id: "001", name: "A, B", value: 12, active: true });
  assert.equal(parsed.rows[1].name, 'Two "quotes"\nand a newline');
  assert.equal(parse("code\n=SUM(A1:A4)").rows[0].code, "=SUM(A1:A4)", "cell strings are never evaluated");
  assert.ok(parse("__proto__,value\na,1").errors.length);
  assert.ok(parse("a,a\n1,2").errors.length);
  assert.ok(parse('a,b\n"unclosed,1').errors.length);
  assert.ok(parse("a,b\n1,2,3").errors.length);
  assert.deepEqual(parse("amount\nhello", { amount: "number" }).rows, []);
  assert.ok(parse("a".repeat(1000001)).errors.length);
  const doc: KageDoc = { kages: "1.0", id: "csv", title: "Import", system: "core", root: "csv", blocks: { csv: { type: "csv-import", props: { label: "Import sample" } } } };
  assert.deepEqual(validate(doc).errors, []);
  const s = new KageSession(doc);
  assert.deepEqual(s.read("csv")?.rows, []);
  s.dispatch("csv", "import", { rows: parsed.rows, columns: parsed.columns, types: parsed.types });
  assert.deepEqual(s.read("csv")?.rows, parsed.rows);
});


test("routed graph connections avoid intervening node boxes and preserve full edge text", () => {
  for (const vertical of [false, true]) {
    const nodes = [0, 1, 2].map(i => ({ x: vertical ? 20 : 20 + i * 328, y: vertical ? 20 + i * 184 : 20 }));
    for (const [from, to] of [[0, 2], [2, 0], [0, 1]]) {
      const route = K.diagramRoute(nodes[from], nodes[to], vertical, 1);
      assert.doesNotMatch(route.path, /NaN|Infinity/);
      for (let i = 1; i < route.points.length; i++) {
        const a = route.points[i - 1], b = route.points[i];
        for (const node of nodes) {
          const crosses = a[0] === b[0]
            ? a[0] > node.x && a[0] < node.x + 208 && Math.max(a[1], b[1]) > node.y && Math.min(a[1], b[1]) < node.y + 96
            : a[1] > node.y && a[1] < node.y + 96 && Math.max(a[0], b[0]) > node.x && Math.min(a[0], b[0]) < node.x + 208;
          assert.equal(crosses, false, `${vertical}/${from}/${to}: ${route.path}`);
        }
      }
    }
  }
  const props = { label: "Flow", nodes: [{ id: "a", label: "Collect" }, { id: "b", label: "Explain" }], edges: [{ from: "a", to: "b", label: "A complete relationship label that is longer than a chip" }] };
  const html = render("core/diagram@1.4.0", props);
  assert.match(html, /View connections/); assert.match(html, /<td>A complete relationship label that is longer than a chip<\/td>/);
  assert.doesNotMatch(render("core/diagram@1.3.0", props), /View connections/);
});

test("source status never calls an unstarted or sample refresh live data", () => {
  const idle = render("core/source-status@1.0.0", { label: "Source" });
  assert.match(idle, /Not refreshed/); assert.doesNotMatch(idle, /Live data|completed successfully/);
  const sample = render("core/source-status@1.0.0", { label: "Source", status: "sample", refreshable: true });
  assert.match(sample, /Sample data/); assert.match(sample, /not a successful live refresh/); assert.match(sample, /Refresh data/);
  const loading = render("core/source-status@1.0.0", { label: "Source", loading: true, refreshable: true });
  assert.match(loading, /aria-busy="true"/); assert.match(loading, /disabled=""/);
  assert.match(render("core/source-status@1.0.0", { label: "Source", status: "error" }), /role="alert"/);
});
