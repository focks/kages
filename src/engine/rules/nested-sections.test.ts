import { test } from "node:test";
import assert from "node:assert/strict";
import { lintDetailed } from "../advice.ts";
import { tree } from "./fixtures.ts";
import { freeFlowExamples, expressiveExamples, richExamples, appExamples, connectedExamples, chartExamples, contentExamples } from "../../packs/examples.ts";
import { systems } from "../data.ts";
import type { Block } from "../types.ts";

const nested = (blocks: Record<string, Block>, extra = {}) => lintDetailed(tree(blocks, extra)).findings.filter((f) => f.rule === "nested-sections");
const kids = (...ids: string[]) => ({ children: ids });
const page = (...ids: string[]): Block => ({ type: "page", props: {}, slots: kids(...ids) });
const card = (...ids: string[]): Block => ({ type: "card", props: { title: "C" }, ...(ids.length ? { slots: kids(...ids) } : {}) });
const sec = (tone: string | undefined, ...ids: string[]): Block => ({ type: "section", props: { title: "S", ...(tone ? { tone } : {}) }, ...(ids.length ? { slots: kids(...ids) } : {}) });

test("positive: card in card, card in a toned section, through layout blocks, inside tab panels", () => {
  assert.deepEqual(nested({ root: page("a"), a: card("b"), b: card() }).map((f) => f.at), ["/blocks/b"]);
  assert.equal(nested({ root: page("s"), s: sec("surface", "c"), c: card() }).length, 1);
  assert.equal(nested({ root: page("s"), s: sec("accent", "k"), k: { type: "stack", props: {}, slots: kids("t") }, t: sec("surface") }).length, 1);
  assert.equal(nested({ root: page("a"), a: card("g"), g: { type: "grid", props: {}, slots: kids("b") }, b: card() }).length, 1);
  assert.equal(nested({ root: page("a"), a: card("p"), p: { type: "tab-panel", props: { label: "P", tabs: [{ id: "x", label: "X" }] }, slots: { panel1: ["b"] } }, b: card() }).length, 1);
  assert.equal(nested({ root: page("a"), a: sec("sunken", "b"), b: card() }).length, 1);
});

test("negative: plain sections, siblings, overlays, shell regions, a plain-page composition", () => {
  assert.equal(nested({ root: page("s"), s: sec(undefined, "c"), c: card() }).length, 0, "a plain section is not a container");
  assert.equal(nested({ root: page("s"), s: sec("plain", "c"), c: card() }).length, 0);
  assert.equal(nested({ root: page("a", "b"), a: card(), b: card() }).length, 0, "siblings");
  assert.equal(nested({ root: page("a"), a: card("m"), m: { type: "modal", props: { label: "M" }, slots: kids("b") }, b: card() }).length, 0, "an overlay is a new layer");
  assert.equal(nested({ root: { type: "shell", props: {}, slots: { main: ["a"] } }, a: card() }).length, 0, "shell regions are chrome");
  assert.equal(nested({ root: page("g"), g: { type: "grid", props: {}, slots: kids("a", "b") }, a: card(), b: card() }).length, 0);
});

test("a three-deep chain yields two findings, each naming its ancestors", () => {
  const f = nested({ root: page("a"), a: card("b"), b: card("c"), c: card() });
  assert.deepEqual(f.map((x) => x.at).sort(), ["/blocks/b", "/blocks/c"]);
  assert.match(f.find((x) => x.at === "/blocks/c")!.msg, /page#root › card#a › card#b › card#c/);
  assert.match(f[0].fix!, /plain/);
});

test("repeat templates count once, not once per instance", () => {
  const rep: Block = { ...card("i"), repeat: { each: { $data: "rows" } as never, key: "id" } };
  const f = nested({ root: page("a"), a: rep, i: card() }, { data: { rows: [{ id: 1 }, { id: 2 }, { id: 3 }] } });
  assert.equal(f.length, 1);
});

test("compositions: analysed on their own, and a container-rooted composition nests at its use-site", () => {
  const withComp = (root: Block) => ({ compositions: { tile: { inputs: {}, root: "r", blocks: { r: root, i: card() } } } });
  assert.equal(nested({ root: page("x"), x: { type: "composition", props: { name: "tile" } } }, withComp({ ...card("i") })).length, 1, "the card inside the composition's own card");
  assert.equal(nested({ root: page("a"), a: card("c"), c: { type: "composition", props: { name: "tile" } } }, { compositions: { tile: { inputs: {}, root: "r", blocks: { r: { type: "card", props: { title: "T" } } } } } }).length, 1, "a card-rooted composition inside a card");
  assert.equal(nested({ root: page("a"), a: card("c"), c: { type: "composition", props: { name: "tile" } } }, { compositions: { tile: { inputs: {}, root: "r", blocks: { r: { type: "stack", props: {} } } } } }).length, 0, "a stack-rooted composition is not a box");
});

test("a waiver naming the block suppresses exactly that finding", () => {
  const doc = tree({ root: page("a"), a: card("b", "c"), b: card(), c: card() }, { meta: { kages: { lint: { ignore: [{ rule: "nested-sections", block: "b", reason: "dense data pane, reviewed" }] } } } as never });
  const r = lintDetailed(doc);
  assert.deepEqual(r.findings.filter((f) => f.rule === "nested-sections").map((f) => f.at), ["/blocks/c"]);
  assert.deepEqual(r.waived.map((f) => f.at), ["/blocks/b"]);
});

test("corpus guard: no shipped example nests containers, in any system", () => {
  for (const id of Object.keys(systems)) {
    const docs = [...freeFlowExamples(id), ...expressiveExamples(id), ...richExamples(id), ...appExamples(id), ...connectedExamples(id), ...chartExamples(id), ...contentExamples(id)];
    for (const d of docs) assert.deepEqual(lintDetailed(d, { system: id }).findings.filter((f) => f.rule === "nested-sections"), [], `${id}/${d.id}`);
  }
});

test("performance: a 5,000-block document lints quickly", () => {
  const blocks: Record<string, Block> = { root: page(...Array.from({ length: 5000 }, (_, i) => "b" + i)) };
  for (let i = 0; i < 5000; i++) blocks["b" + i] = i % 2 ? card() : { type: "text", props: { text: "t" } };
  const t0 = Date.now();
  assert.equal(nested(blocks).length, 0);
  assert.ok(Date.now() - t0 < 1000);
});
