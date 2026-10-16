import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDecisionGuide, checkIntake, type Intake } from "./decision-guide.ts";
import { EXAMPLES, snowflakeReaderAccounts as sf, queueChoice } from "./decision-guide-examples.ts";
import { validate } from "../engine/validate.ts";
import { lintDetailed } from "../engine/advice.ts";
import { KageSession } from "../engine/session.ts";

const built = Object.entries(EXAMPLES).map(([k, i]) => [k, i, buildDecisionGuide(i)] as const);

for (const [k, , r] of built) test(`${k}: builds a valid guide with no errors, warnings or lint findings`, () => {
  assert.deepEqual(r.problems, []);
  const v = validate(r.doc!);
  assert.deepEqual(v.errors, []); assert.deepEqual(v.warnings, []);
  assert.deepEqual(lintDetailed(r.doc!, { system: "atelier" }).findings, []);
  assert.equal(r.doc!.brief?.mode, "read");
});

test("the pack is repeatable: three unrelated subjects share one structure", () => {
  const shapes = built.map(([, , r]) => ["hero", "toc", "layout", "root", "step", "ready", "assumed", "verify"].every((id) => id in r.doc!.blocks));
  assert.deepEqual(shapes, [true, true, true]);
  assert.equal(new Set(built.map(([, , r]) => r.doc!.id)).size, 3);
});

test("the recommendation follows the answers, for every combination", () => {
  const r = buildDecisionGuide(sf).doc!;
  const shown = (s: KageSession) => Object.keys(r.blocks).filter((id) => id.startsWith("rec-") && s.visible(id)).map((id) => (r.blocks[id].props as { title: string }).title);
  const s = new KageSession(r, "atelier");
  assert.ok(s.visible("pending"));
  assert.deepEqual(shown(s), []);
  for (const [a, b, title] of [["yes", "no", "Share directly, no reader account needed"], ["no", "no", "A reader account fits"], ["no", "yes", "Reader accounts are query-only"]]) {
    const t = new KageSession(r, "atelier");
    t.dispatch("q-hasAccount", "change", { value: a }); t.dispatch("q-needsOwn", "change", { value: b });
    assert.deepEqual(shown(t), [title]); assert.ok(!t.visible("pending"));
  }
});

test("the calculator recomputes when an assumption changes, and the stepper switches the code shown", () => {
  const r = buildDecisionGuide(sf).doc!, s = new KageSession(r, "atelier");
  assert.equal(s.read("out-0")?.value, 10 * 20 * 3);
  assert.equal(s.read("out-1")?.value, 10 * 20 * 3 * 12);
  s.dispatch("in-readers", "change", { value: 25 });
  assert.equal(s.read("out-0")?.value, 25 * 20 * 3);
  assert.ok(s.visible("code-create") && !s.visible("code-share"));
  s.dispatch("step", "change", { value: "share" });
  assert.ok(!s.visible("code-create") && s.visible("code-share"));
  assert.equal(s.read("ready")?.value, 0);
  s.dispatch("check1", "change", { checked: true });
  assert.equal(s.read("ready")?.value, 20);
  const q = new KageSession(buildDecisionGuide(queueChoice).doc!, "atelier");
  assert.equal(q.read("out-0")?.value, 50 * 0.4 * 30);
});

test("a guide with no verification says so; with one it names who checked and when", () => {
  const unverified = buildDecisionGuide(sf).doc!;
  assert.equal(unverified.blocks.verify.type, "alert");
  const ok = buildDecisionGuide({ ...sf, verified: { by: "Priya", on: "2026-10-16" } }).doc!;
  assert.equal(ok.blocks.verify.type, "text");
  assert.match(String((ok.blocks.verify.props as { text: string }).text), /checked by Priya on 2026-10-16/);
});

const bad = (over: Partial<Intake>) => checkIntake({ ...queueChoice, ...over }).join("\n");
test("the intake is refused, with the reason, when it cannot make an honest guide", () => {
  assert.match(bad({ sources: [] }), /at least one source/);
  assert.match(bad({ sources: [{ label: "x", href: "http://insecure.example" }] }), /https:\/\//);
  assert.match(bad({ recommendations: queueChoice.recommendations.slice(0, 3) }), /no recommendation covers replay=yes, team=no/);
  assert.match(bad({ recommendations: [...queueChoice.recommendations, { when: { replay: "maybe" }, title: "t", text: "x" }] }), /replay=maybe, which is not an answer/);
  assert.match(bad({ outputs: [{ label: "x", product: ["nope"] }] }), /"nope", which is not an assumption/);
  assert.match(bad({ assumptions: [{ id: "messages", label: "m", value: 5000, min: 1, max: 10 }, queueChoice.assumptions[1]] }), /must lie within/);
  assert.match(bad({ checklist: ["only one"] }), /at least two checklist/);
  assert.match(bad({ steps: [queueChoice.steps[0]] }), /two to eight/);
  assert.match(bad({ questions: [{ id: "Bad id", label: "q", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }] }), /camelCase/);
  assert.match(bad({ curve: { vary: "messages", at: [1, 2], xLabel: "x", yLabel: "y" } }), /at least three points/);
  assert.equal(buildDecisionGuide({ ...queueChoice, sources: [] }).doc, null);
});
