// Batch 3: cross-block selection, live data and conditional rules. Selection and
// rules run through the headless session; the served bundle proves the charts
// are keyboard-operable; the live source is exercised through the real bridge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { connectedExamples } from "../packs/examples.ts";
import { KageSession } from "../engine/session.ts";
import { HostBridge } from "../host/bridge.ts";
const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
const K = window.Kages;
const render = (name: string, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(K[name], props));
const [explorer, feed, rules] = connectedExamples();

test("connected examples render in every system", () => {
  for (const system of ["core", "ledger", "atelier"]) for (const doc of connectedExamples(system)) {
    const html = renderToStaticMarkup(React.createElement(K.KageRenderer, { doc }));
    assert.doesNotMatch(html, /kg-missing|NaN|Infinity|undefined/, doc.id + " " + system);
  }
});

test("selecting a slice filters another block and selecting it again clears the filter", () => {
  const s = new KageSession(structuredClone(explorer));
  assert.equal((s.read("table")?.rows as any[]).length, 4);
  assert.equal(s.read("mix")?.selected, "");
  s.dispatch("mix", "select", { label: "North", value: 180, index: 0 });
  assert.equal(s.read("mix")?.selected, "North");
  assert.deepEqual((s.read("table")?.rows as any[]).map((r) => r.name), ["Northwind", "Fabrikam"]);
  s.dispatch("mix", "select", { label: "West", value: 45, index: 2 });
  assert.deepEqual((s.read("table")?.rows as any[]).map((r) => r.name), ["Tailspin"]);
  s.dispatch("mix", "select", { label: "West", value: 45, index: 2 });
  assert.equal((s.read("table")?.rows as any[]).length, 4);
});

test("interactive charts expose keyboard-operable, labelled controls only when asked", () => {
  const items = [{ label: "A", value: 1 }, { label: "B", value: 3 }];
  const on = render("CoreDonutChart", { label: "D", items, interactive: true, selected: "B" });
  assert.equal((on.match(/role="button"/g) || []).length, 2); assert.match(on, /tabindex="0"/); assert.match(on, /aria-pressed="true"/);
  assert.doesNotMatch(render("CoreDonutChart", { label: "D", items }), /role="button"/);
  const heat = render("CoreHeatmap", { label: "H", rows: ["r"], columns: ["a", "b"], values: [[1, 2]], interactive: true, selected: { row: "r", column: "b" } });
  assert.equal((heat.match(/<button/g) || []).length, 2); assert.match(heat, /aria-pressed="true"/);
  assert.doesNotMatch(render("CoreHeatmap", { label: "H", rows: ["r"], columns: ["a"], values: [[1]] }), /<button/);
});

test("heatmap cell selection is public state", () => {
  const doc: any = { kages: "1.0", id: "h", title: "H", system: "core@1", root: "m", blocks: { m: { type: "heatmap", props: { label: "H", interactive: true, rows: ["r"], columns: ["c"], values: [[5]] } } } };
  const s = new KageSession(doc);
  assert.equal(s.read("m")?.selected, null);
  s.dispatch("m", "select", { row: "r", column: "c", value: 5 });
  assert.deepEqual(s.read("m")?.selected, { row: "r", column: "c" });
});

test("conditional rules: visibility, disabled state and guarded actions follow the data", () => {
  const s = new KageSession(structuredClone(rules));
  assert.equal(s.visible("minor"), false); assert.equal(s.read("submit")?.disabled, true);
  s.dispatch("age", "change", { value: 16 });
  assert.equal(s.visible("minor"), true);
  s.dispatch("consent", "change", { checked: true });
  assert.equal(s.read("submit")?.disabled, true, "still a minor");
  s.dispatch("submit", "click");
  assert.equal(s.getState().submitted, false, "guard blocks the action even if the click arrives");
  s.dispatch("age", "change", { value: 30 });
  assert.equal(s.visible("minor"), false); assert.equal(s.read("submit")?.disabled, false);
  assert.equal(s.visible("done"), false);
  s.dispatch("submit", "click");
  assert.equal(s.visible("done"), true);
  s.dispatch("age", "change", { value: null });
  assert.equal(s.visible("minor"), false, "an empty age is not a minor");
});

test("live source: without host opt-in the mock is used; with it the real payload lands", async () => {
  const s = new KageSession(structuredClone(feed));
  const log = s.dispatch("load", "click");
  assert.ok(log.some((l) => /fetch/.test(l.msg)));
  assert.equal((s.getState().items as any[]).length, 2, "headless run lands the declared mock");
  assert.equal(new HostBridge(feed).fetch("headlines").ok, false, "default host: empty allowlist denies");
  const bridge = new HostBridge(feed, { fetchAllowlist: ["https://api.example.com/"], fetcher: async () => ({ ok: true, status: 200, headers: { get: () => "application/json" }, text: async () => JSON.stringify({ items: Array.from({ length: 50 }, (_, i) => ({ title: "T" + i })) }) }) });
  const res = await bridge.load("headlines");
  assert.equal((res.value as any[]).length, 20, "maxItems from the source bounds the payload");
});

test("every rich example validates with no errors or warnings in all systems (pure engine)", async () => {
  const { validate } = await import("../engine/validate.ts");
  const { richExamples, appExamples } = await import("../packs/examples.ts");
  for (const system of ["core", "ledger", "atelier"]) for (const doc of [...richExamples(system), ...appExamples(system), ...connectedExamples(system)]) {
    const r = validate(doc);
    assert.deepEqual([r.errors, r.warnings], [[], []], doc.id + " in " + system);
  }
});
