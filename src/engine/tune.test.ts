import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tune, loudness, type TunePlan } from "./tune.ts";
import { validate } from "./validate.ts";
import { applyPatch } from "../collab/patch.ts";
import { tree } from "./rules/fixtures.ts";
import { freeFlowExamples, expressiveExamples, richExamples, appExamples, connectedExamples, chartExamples, contentExamples } from "../packs/examples.ts";
import type { Block, KageDoc } from "./types.ts";

const SYSTEMS = ["core", "ledger", "atelier"];
const docsFor = (id: string): KageDoc[] => [...freeFlowExamples(id), ...expressiveExamples(id), ...richExamples(id), ...appExamples(id), ...connectedExamples(id), ...chartExamples(id), ...contentExamples(id)];
const apply = (d: KageDoc, p: TunePlan): KageDoc => applyPatch(d, p.patch as never);
// The only props a tune may ever write. Anything else in a patch is a bug.
const KNOB_PROPS = new Set(["tone", "inset", "gap", "width", "minSize", "variant"]);

test("every patch touches only knob props of blocks, and the result validates in every system", () => {
  for (const sys of SYSTEMS) for (const d of docsFor(sys)) for (const direction of ["quieter", "bolder"] as const) for (const amount of [1, 2, 3]) {
    const plan = tune(d, { direction, amount });
    for (const op of plan.patch) assert.match(op.path, /^\/blocks\/[^/]+\/props\/(tone|inset|gap|width|minSize|variant)$/, `${sys}/${d.id} ${direction}`);
    for (const k of plan.knobs) assert.ok(KNOB_PROPS.has(k.prop));
    const next = apply(d, plan);
    assert.ok(validate(next, sys).ok, `${sys}/${d.id} ${direction}×${amount}: ${JSON.stringify(validate(next, sys).errors)}`);
    // Everything outside the knobs is byte-identical.
    const strip = (x: KageDoc) => JSON.stringify({ ...x, blocks: Object.fromEntries(Object.entries(x.blocks).map(([id, b]) => [id, { ...b, props: Object.fromEntries(Object.entries((b as Block).props ?? {}).filter(([k]) => !plan.knobs.some((kn) => kn.block === id && kn.prop === k))) }])) });
    assert.equal(strip(next), strip(d), `${sys}/${d.id}: something other than a knob changed`);
  }
});

test("monotonic: quieter never raises the loudness, bolder never lowers it; the reported figures are real", () => {
  for (const d of docsFor("core")) for (const amount of [1, 2, 3]) {
    const q = tune(d, { direction: "quieter", amount }), b = tune(d, { direction: "bolder", amount });
    assert.equal(q.loudness.before, loudness(d));
    assert.equal(q.loudness.after, loudness(apply(d, q)));
    assert.ok(q.loudness.after <= q.loudness.before, `${d.id} quieter×${amount}`);
    assert.ok(b.loudness.after >= b.loudness.before, `${d.id} bolder×${amount}`);
  }
});

test("bounded: repeating a step converges and then reports the floor or ceiling", () => {
  for (const d of docsFor("core")) for (const direction of ["quieter", "bolder"] as const) {
    let cur = d, steps = 0;
    for (; steps < 12; steps++) { const p = tune(cur, { direction }); if (!p.patch.length) { assert.match(p.skipped.at(-1)!.reason, /already at the (floor|ceiling)/); break; } cur = apply(cur, p); }
    assert.ok(steps < 12, `${d.id} ${direction} never converged`);
  }
});

const page = (...ids: string[]): Block => ({ type: "page", props: { width: "reading", gap: 6 }, slots: { children: ids } });
const sec = (props: Record<string, unknown>, ...ids: string[]): Block => ({ type: "section", props: { title: "S", ...props }, ...(ids.length ? { slots: { children: ids } } : {}) });
const btn = (variant?: string): Block => ({ type: "button", props: { label: "Go", ...(variant ? { variant } : {}) }, on: { click: [{ do: "set", path: "x", value: 1 }] } as never });
const withBrief = (d: KageDoc, mode: string): KageDoc => ({ ...d, brief: { mode: mode as never }, state: { x: 0 } });

test("quieter rules: tones step down, the persuasive hero keeps its tone at amount 1, insets floor at 2, one primary, one display, grids narrow", () => {
  const d = withBrief(tree({ root: page("a", "b", "g", "h1", "h2", "p1", "p2"), a: sec({ tone: "accent", inset: 8 }), b: sec({ tone: "accent", inset: 3 }), g: { type: "grid", props: { minSize: "large" } },
    h1: { type: "text", props: { text: "H", variant: "display" } }, h2: { type: "text", props: { text: "H2", variant: "display" } }, p1: btn("primary"), p2: btn("primary") }), "persuade");
  const q1 = tune(d, { direction: "quieter" });
  const at = (p: TunePlan, id: string, prop: string) => p.knobs.find((k) => k.block === id && k.prop === prop)?.to;
  assert.equal(at(q1, "a", "tone"), undefined, "hero keeps its tone at amount 1 in persuade");
  assert.equal(at(q1, "b", "tone"), "surface");
  assert.equal(at(q1, "a", "inset"), 6);
  assert.equal(at(q1, "b", "inset"), 2, "3 steps down to the floor of 2, and no further");
  assert.equal(at(tune(d, { direction: "quieter", amount: 3 }), "b", "inset"), 2, "the floor holds however large the amount");
  assert.equal(at(q1, "g", "minSize"), "medium");
  assert.equal(at(q1, "h1", "variant"), undefined);
  assert.equal(at(q1, "h2", "variant"), "title");
  assert.equal(at(q1, "p1", "variant"), undefined);
  assert.equal(at(q1, "p2", "variant"), "secondary");
  const q2 = tune(d, { direction: "quieter", amount: 2 });
  assert.equal(at(q2, "a", "tone"), "plain", "amount 2 reaches the hero too");
  assert.ok(q1.skipped.some((s) => s.block === "a" && /hero keeps its tone/.test(s.reason)));
});

test("bolder rules: persuasive pages get a louder hero and a display line; operate pages only gain hierarchy", () => {
  const blocks = { root: page("hero", "t", "p1", "p2"), hero: sec({ inset: 4 }), t: { type: "text", props: { text: "T", variant: "title" } } as Block, p1: btn(), p2: btn() };
  const pers = tune(withBrief(tree(blocks), "persuade"), { direction: "bolder" });
  const at = (p: TunePlan, id: string, prop: string) => p.knobs.find((k) => k.block === id && k.prop === prop)?.to;
  assert.equal(at(pers, "hero", "tone"), "surface");
  assert.equal(at(pers, "hero", "inset"), 6);
  assert.equal(at(pers, "root", "width"), "wide");
  assert.equal(at(pers, "t", "variant"), "display");
  assert.equal(at(pers, "p1", "variant"), "primary");
  assert.equal(at(pers, "p2", "variant"), undefined, "one promotion per container");
  const op = tune(withBrief(tree(blocks), "operate"), { direction: "bolder" });
  assert.equal(at(op, "hero", "tone"), undefined);
  assert.equal(at(op, "root", "width"), undefined);
  assert.equal(at(op, "t", "variant"), "display");
  assert.equal(at(op, "p1", "variant"), "primary");
  assert.ok(op.skipped.some((s) => /hierarchy, not decoration/.test(s.reason)));
});

test("a page keeps at most one accent section: bolder never creates a second", () => {
  const d = withBrief(tree({ root: page("a", "b"), a: sec({ tone: "surface" }), b: sec({ tone: "accent" }) }), "persuade");
  const p = tune(d, { direction: "bolder" });
  assert.equal(p.knobs.find((k) => k.prop === "tone"), undefined);
  assert.ok(p.skipped.some((s) => /another section is already the accent/.test(s.reason)));
});

test("bound props are never patched and say why; scope limits the change to a subtree", () => {
  const bound: Block = { type: "section", props: { title: "S", tone: "accent" }, bind: { tone: { $state: "t" } as never } };
  const d = withBrief(tree({ root: page("a", "b", "c"), a: bound, b: sec({ tone: "accent" }, "bc"), bc: sec({ tone: "accent" }), c: sec({ tone: "accent" }) }), "read");
  const p = tune(d, { direction: "quieter", amount: 3 });
  assert.equal(p.knobs.find((k) => k.block === "a"), undefined);
  assert.ok(p.skipped.some((s) => s.block === "a" && /bound/.test(s.reason)));
  const scoped = tune(d, { direction: "quieter", amount: 3, scope: "b" });
  assert.deepEqual([...new Set(scoped.knobs.map((k) => k.block))].sort(), ["b", "bc"]);
});

test("semantic props are untouched: heading level, danger buttons, alert and badge tones, copy", () => {
  const d = withBrief(tree({ root: page("s", "d", "al", "bg"), s: sec({ tone: "accent", level: 2 }), d: btn("danger"), al: { type: "alert", props: { tone: "danger", title: "T", text: "X" } }, bg: { type: "badge", props: { label: "L", tone: "accent" } } }), "operate");
  for (const direction of ["quieter", "bolder"] as const) for (const amount of [1, 3]) {
    const p = tune(d, { direction, amount });
    assert.ok(!p.knobs.some((k) => ["d", "al", "bg"].includes(k.block) && k.prop !== "variant"), "no alert or badge tone");
    assert.ok(!p.knobs.some((k) => k.block === "d"), "a danger button is semantic");
    assert.ok(!p.knobs.some((k) => k.prop === "level" || k.prop === "text" || k.prop === "label" || k.prop === "title"));
  }
});

test("string-typed steps stay strings; unknown values are left alone", () => {
  const d = withBrief(tree({ root: page("a"), a: sec({ inset: "6", tone: "surface" }) }), "read");
  const p = tune(d, { direction: "quieter" });
  assert.equal(p.knobs.find((k) => k.prop === "inset")!.to, "4");
  const odd = withBrief(tree({ root: page("a"), a: sec({ inset: 5, tone: "surface" }) }), "read");
  assert.equal(tune(odd, { direction: "quieter" }).knobs.find((k) => k.prop === "inset"), undefined);
});

test("hostile documents never throw", () => {
  for (const d of [{}, { blocks: {} }, { blocks: { root: null }, root: "root" }, { blocks: { root: { type: "section", props: null } }, root: "root" }]) {
    assert.doesNotThrow(() => tune(d as never, { direction: "quieter" }));
    assert.doesNotThrow(() => tune(d as never, { direction: "bolder", amount: 99 }));
  }
});

// Golden patches pin three representative documents so a rule change is a deliberate diff.
//   UPDATE_GOLDEN=1 node --test src/engine/tune.test.ts
test("golden patches for a read, an operate and a persuade document", () => {
  const pick = (id: string) => docsFor("core").find((d) => d.id === id)!;
  const out: Record<string, unknown> = {};
  for (const id of ["field-notes", "metrics-board", "open-studio"]) for (const direction of ["quieter", "bolder"] as const) { const p = tune(pick(id), { direction }); out[`${id}:${direction}`] = { mode: p.mode, patch: p.patch, skipped: p.skipped.map((s) => s.rule + ":" + s.reason), loudness: p.loudness }; }
  const file = fileURLToPath(new URL("./__fixtures__/tune-golden.json", import.meta.url));
  if (process.env.UPDATE_GOLDEN || !existsSync(file)) writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  assert.deepEqual(JSON.parse(JSON.stringify(out)), JSON.parse(readFileSync(file, "utf8")), "tune output changed; if intended run with UPDATE_GOLDEN=1");
});
