import { test } from "node:test";
import assert from "node:assert/strict";
import { findDeprecated, planMigration, doNotUse, REGISTRY, type Deprecation } from "./deprecations.ts";
import { lintDetailed } from "./advice.ts";
import { validate } from "./validate.ts";
import { applyPatch } from "../collab/patch.ts";
import { tree } from "./rules/fixtures.ts";
import type { Block } from "./types.ts";

const entry = (over: Partial<Deprecation>): Deprecation => ({ id: "e", kind: "prop", target: { role: "text" }, prop: "legacy", since: "core@9", reason: "retired", replacement: { prop: "modern" }, migration: { op: "rename-prop", to: "modern" }, auto: true, ...over });
const doc = (blocks: Record<string, Block>, extra = {}) => tree({ root: { type: "stack", props: {}, slots: { children: Object.keys(blocks) } }, ...blocks }, extra);

test("the shipped registry is empty: deprecating anything is a separate product decision", () => {
  assert.equal(REGISTRY.length, 0);
  assert.deepEqual(lintDetailed(doc({ t: { type: "text", props: { text: "x", legacy: 1 } } })).findings.filter((f) => f.rule === "deprecated-usage"), []);
  assert.deepEqual(doNotUse(), []);
});

test("detector: each kind, positive and negative, including bound props", () => {
  const blocks = { t: { type: "text", props: { text: "x", legacy: 1, variant: "tight" } }, u: { type: "text", props: { text: "y" }, bind: { legacy: { $state: "k" } as never } }, g: { type: "grid", props: {} }, s: { type: "stack", props: {} } } as Record<string, Block>;
  const d = doc(blocks, { meta: { old: 1 } });
  assert.deepEqual(findDeprecated(d, [entry({})]).map((u) => u.at), ["/blocks/t/props/legacy", "/blocks/u/bind/legacy"]);
  assert.deepEqual(findDeprecated(d, [entry({ kind: "role", target: { role: "grid" }, prop: undefined })]).map((u) => u.at), ["/blocks/g"]);
  assert.deepEqual(findDeprecated(d, [entry({ kind: "enum-value", prop: "variant", value: "tight" })]).map((u) => u.at), ["/blocks/t/props/variant"]);
  assert.deepEqual(findDeprecated(d, [entry({ kind: "enum-value", prop: "variant", value: "loose" })]), []);
  assert.deepEqual(findDeprecated(d, [entry({ kind: "doc-field", target: { docField: "meta.old" }, prop: undefined })]).map((u) => u.at), ["/meta/old"]);
  assert.deepEqual(findDeprecated(d, [entry({ kind: "doc-field", target: { docField: "meta.never" }, prop: undefined })]), []);
  assert.deepEqual(findDeprecated(d, [entry({ target: { ref: "core/text@1.0.0" } })]).length, 2, "a ref resolves to its role");
  assert.deepEqual(findDeprecated(d, [entry({ target: { role: "button" } })]), [], "other roles are untouched");
});

test("the lint rule reports use with since, reason and the replacement", () => {
  const f = lintDetailed(doc({ t: { type: "text", props: { text: "x", legacy: 1 } } }), { deprecations: [entry({})] }).findings.filter((x) => x.rule === "deprecated-usage");
  assert.equal(f.length, 1);
  assert.match(f[0].msg, /\(since core@9\): retired/);
  assert.match(f[0].fix!, /Use `modern`.*kages migrate/);
  assert.equal(f[0].severity, "P2");
});

test("planner: every operation leaves no deprecated usage and keeps the document valid", () => {
  const cases: [string, Deprecation, Record<string, Block>][] = [
    ["rename-prop", entry({}), { t: { type: "text", props: { text: "x", legacy: 1 } } }],
    ["rename a bound prop", entry({}), { t: { type: "text", props: { text: "x" }, bind: { legacy: { $state: "k" } as never } } }],
    ["remove-prop", entry({ migration: { op: "remove-prop" }, replacement: null }), { t: { type: "text", props: { text: "x", legacy: 1 } } }],
    ["map-value", entry({ kind: "enum-value", prop: "variant", value: "heading", replacement: null, migration: { op: "map-value", map: { heading: "title" } } }), { t: { type: "text", props: { text: "x", variant: "heading" } } }],
    ["change-role", entry({ kind: "role", target: { role: "badge" }, prop: undefined, replacement: { role: "text" }, migration: { op: "change-role", to: "text" } }), { t: { type: "badge", props: { label: "x" } } }],
  ];
  for (const [name, e, blocks] of cases) {
    const d = doc(blocks, { state: { k: "v" } });
    const plan = planMigration(d, [e]);
    assert.ok(plan.patch.length > 0 && plan.manual.length === 0, name);
    const next = applyPatch(d, plan.patch as never);
    assert.deepEqual(findDeprecated(next, [e]), [], `${name}: still deprecated after migration`);
    if (name !== "change-role") assert.ok(validate(next).ok, `${name}: ${JSON.stringify(validate(next).errors)}`);
    assert.deepEqual(planMigration(next, [e]), { patch: [], manual: [], ids: [] }, `${name}: planning again is empty`);
    assert.deepEqual(plan.ids, ["e"]);
  }
});

test("non-automatic entries, unmapped values and rename collisions become manual steps", () => {
  const d = doc({ t: { type: "text", props: { text: "x", legacy: 1, modern: 2, variant: "odd" } } });
  const manual = planMigration(d, [entry({ auto: false }), entry({ id: "m", kind: "enum-value", prop: "variant", value: "odd", migration: { op: "map-value", map: { a: "b" } } }), entry({ id: "c" })]);
  assert.deepEqual(manual.patch, []);
  assert.equal(manual.manual.length, 3);
  assert.match(manual.manual[0].message, /needs a decision/);
  assert.match(manual.manual.find((m) => m.entry.id === "m")!.message, /no mapping/);
  assert.match(manual.manual.find((m) => m.entry.id === "c")!.message, /already set/);
});

test("hostile documents never throw", () => {
  for (const d of [null, {}, { blocks: null }, { blocks: { a: null, b: 3, c: { type: 5 } } }]) {
    assert.doesNotThrow(() => findDeprecated(d as never, [entry({}), entry({ kind: "doc-field", target: { docField: "a.b" } })]));
    assert.doesNotThrow(() => planMigration(d as never, [entry({})]));
  }
});

test("doNotUse words each entry for packs", () => {
  assert.deepEqual(doNotUse([entry({})]), ["text.legacy: retired Use modern. (since core@9)"]);
});
