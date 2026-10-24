import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inferMode, modeOf } from "./mode.ts";
import { briefIssues } from "./brief.ts";
import { lintDetailed } from "./advice.ts";
import { validate } from "./validate.ts";
import { mk } from "./rules/fixtures.ts";
import { freeFlowExamples, expressiveExamples, richExamples, appExamples, connectedExamples, chartExamples, contentExamples } from "../packs/examples.ts";
import { GUIDE_MODES } from "../packs/guide-examples.ts";
import { SHOWCASE_MODES } from "../packs/showcase-examples.ts";
import { USE_CASE_MODES } from "../packs/use-case-examples.ts";
import { POLISH_MODES } from "../packs/polish-examples.ts";
import type { KageDoc } from "./types.ts";

const ops = JSON.parse(readFileSync(new URL("../../public/ds/ops-console.kage.json", import.meta.url), "utf8")) as KageDoc;
const shipped = [...freeFlowExamples(), ...expressiveExamples(), ...richExamples(), ...appExamples(), ...connectedExamples(), ...chartExamples(), ...contentExamples()];

test("every shipped example declares a mode, and inference agrees with it", () => {
  for (const d of shipped) {
    assert.ok(d.brief?.mode, `${d.id} has no declared mode`);
    // The use-case examples are interactive pages that serve other goals (a pricing page has inputs but is there to persuade),
    // which the block-type heuristic cannot see: for them the declaration is the truth, so only the declared value is checked.
    const declared = USE_CASE_MODES[d.id] ?? SHOWCASE_MODES[d.id] ?? GUIDE_MODES[d.id] ?? POLISH_MODES[d.id];
    if (declared) { assert.equal(d.brief!.mode, declared, d.id); continue; }
    assert.equal(inferMode(d).mode, d.brief!.mode, `${d.id}: declared ${d.brief!.mode}, inferred ${inferMode(d).mode} (${inferMode(d).reasons})`);
  }
  assert.equal(inferMode(ops).mode, "operate");
});

test("a declared brief never changes validation, and shipped docs stay lint-clean", () => {
  for (const d of shipped) {
    const { brief: _b, ...bare } = d;
    assert.deepEqual(validate(d), validate(bare as KageDoc), d.id);
    assert.deepEqual(lintDetailed(d).findings, [], d.id);
  }
});

test("modeOf prefers the declaration and labels a guess as inferred", () => {
  const doc = mk({ b: { type: "text", props: { text: "hi" } } });
  assert.deepEqual(modeOf({ ...doc, brief: { mode: "persuade" } }), { mode: "persuade", source: "declared" });
  assert.equal(modeOf(doc).source, "inferred");
});

test("signals that conflict lower confidence; an empty doc is low-confidence read", () => {
  assert.equal(inferMode(mk({})).confidence, "low");
  const mixed = mk({ f: { type: "form", props: { label: "F" } }, m: { type: "markdown", props: { text: "x" } }, v: { type: "video", props: { label: "V", src: "https://x.test/v.mp4" } } });
  assert.equal(inferMode(mixed).confidence, "low");
});

test("hostile documents never throw", () => {
  for (const d of [null, {}, { blocks: null }, { blocks: { a: null, b: 3, c: { type: 7 } } }]) assert.doesNotThrow(() => inferMode(d as never));
});

test("briefIssues: bad mode, unknown field, oversize, NUL, evidence shape", () => {
  const bad = (b: unknown, re: RegExp) => assert.match(briefIssues(b).join(" "), re);
  assert.deepEqual(briefIssues(undefined), []);
  assert.deepEqual(briefIssues({ mode: "read", evidence: ["a note", { claim: "99.9% uptime", source: "status page" }] }), []);
  bad({ mode: "loud" }, /mode must be one of/);
  bad({ mode: "read", extra: 1 }, /unknown brief field `extra`/);
  bad({ mode: "read", audience: "x".repeat(2001) }, /2000/);
  bad({ mode: "read", notes: "a\u0000" }, /NUL/);
  bad({ mode: "read", evidence: [{ claim: "x" }] }, /needs a `source`/);
  bad("read", /must be an object/);
});

test("a mode-gated rule uses the declared mode, and a confident guess when none is declared", () => {
  const hit = { id: "gate", category: "system" as const, severity: "P3" as const, tier: "immediate" as const, modes: ["operate" as const], summary: "s".repeat(12), rationale: "r".repeat(24), check: () => [{ at: "/", msg: "hit" }] };
  const run = (d: KageDoc) => lintDetailed(d, { rules: [hit] }).findings.length;
  assert.equal(run({ ...mk({ b: { type: "text", props: { text: "t" } } }), brief: { mode: "operate" } }), 1, "declared");
  assert.equal(run(shipped.find((d) => d.id === "event-planner")!), 1, "declared on a shipped example");
  const { brief: _b, ...undeclared } = shipped.find((d) => d.id === "event-planner")!;
  assert.equal(run(undeclared as KageDoc), 1, "medium-confidence inference counts");
  const { brief: _c, ...tiny } = shipped.find((d) => d.id === "live-feed")!;
  assert.equal(run(tiny as KageDoc), 0, "low-confidence inference does not");
});
