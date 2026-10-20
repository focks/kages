import { test } from "node:test";
import assert from "node:assert/strict";
import { lintDetailed } from "../advice.ts";
import { systems } from "../data.ts";
import { tree } from "./fixtures.ts";
import { freeFlowExamples, expressiveExamples, richExamples, appExamples, connectedExamples, chartExamples, contentExamples } from "../../packs/examples.ts";
import type { Block } from "../types.ts";

const hits = (blocks: Record<string, Block>) => lintDetailed(tree(blocks)).findings.filter((f) => f.rule === "fixed-columns");
const page: Block = { type: "page", props: {}, slots: { children: ["s"] } };
const stack = (columns?: number | string): Block => ({ type: "stack", props: columns === undefined ? {} : { columns }, slots: { children: [] } });

test("a stack with four or more fixed columns is reported and points at grid", () => {
  const f = hits({ root: page, s: stack(4) });
  assert.deepEqual(f.map((x) => x.at), ["/blocks/s/props/columns"]);
  assert.match(f[0].fix ?? "", /grid/);
});

test("three columns, no columns, a grid and non-numeric values are left alone", () => {
  assert.equal(hits({ root: page, s: stack(3) }).length, 0);
  assert.equal(hits({ root: page, s: stack() }).length, 0);
  assert.equal(hits({ root: page, s: stack("4") }).length, 0);
  assert.equal(hits({ root: page, s: { type: "grid", props: { columns: 4 }, slots: { children: [] } } }).length, 0);
});

test("corpus guard: no shipped example fixes four or more stack columns", () => {
  for (const id of Object.keys(systems)) {
    const docs = [...freeFlowExamples(id), ...expressiveExamples(id), ...richExamples(id), ...appExamples(id), ...connectedExamples(id), ...chartExamples(id), ...contentExamples(id)];
    for (const d of docs) assert.deepEqual(lintDetailed(d, { system: id }).findings.filter((f) => f.rule === "fixed-columns"), [], `${id}/${d.id}`);
  }
});
