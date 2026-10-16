import { test } from "node:test";
import assert from "node:assert/strict";
import { diffFindings, findingKey, blockDiff, adviceOnSuccess, parsePolicy, type AdvicePolicy } from "./regressions.ts";
import type { Advice } from "./advice.ts";

const f = (code: string, at: string, severity: Advice["severity"] = "P2", msg = "m"): Advice => ({ level: "lint", at, code, msg, rule: code, severity });
const full: AdvicePolicy = { mode: "full", minSeverity: "P2" }, quiet: AdvicePolicy = { mode: "quiet", minSeverity: "P2" };

test("matching is by rule and block, not message or pointer depth", () => {
  const before = [f("dead-button", "/blocks/a", "P1", "old wording")];
  const after = [f("dead-button", "/blocks/a", "P1", "new wording"), f("empty-chart", "/blocks/c/props/items", "P2")];
  const d = diffFindings(before, after);
  assert.deepEqual(d.added.map((x) => x.code), ["empty-chart"]);
  assert.equal(d.unchanged.length, 1);
  assert.deepEqual(diffFindings(after, []).resolved.map((x) => x.code), ["dead-button", "empty-chart"]);
  assert.equal(findingKey(f("x", "/blocks/a/props/p")), findingKey(f("x", "/blocks/a")), "same rule on the same block is one finding");
  assert.notEqual(findingKey(f("x", "/blocks/a")), findingKey(f("x", "/blocks/b")));
});

test("a block that moves keeps its id, so its findings are not reported twice", () => {
  assert.deepEqual(diffFindings([f("dead-button", "/blocks/a")], [f("dead-button", "/blocks/a")]).added, []);
});

test("blockDiff lists added, removed and changed block ids", () => {
  const a = { blocks: { x: { v: 1 }, y: { v: 1 }, z: { v: 1 } } }, b = { blocks: { x: { v: 2 }, y: { v: 1 }, w: { v: 1 } } };
  assert.deepEqual(blockDiff(a, b), { added: ["w"], removed: ["z"], changed: ["x"] });
});

test("full mode: regressions only for a patch, everything for a first version, ack when clean", () => {
  const existing = f("dead-button", "/blocks/a", "P1"), fresh = f("empty-chart", "/blocks/c", "P2");
  assert.deepEqual(adviceOnSuccess(null, [existing, fresh], full).advice, [existing, fresh]);
  const patch = adviceOnSuccess([existing], [existing, fresh], full);
  assert.deepEqual(patch.advice, [fresh]);
  assert.equal(patch.existing, 1);
  assert.deepEqual(adviceOnSuccess([existing], [existing], full), { ack: "clean", existing: 1 });
  assert.deepEqual(adviceOnSuccess([existing, fresh], [fresh], full), { ack: "clean", resolved: 1, existing: 1 });
  assert.deepEqual(adviceOnSuccess(null, [], full), { ack: "clean" });
  assert.deepEqual(adviceOnSuccess([existing], [existing, fresh], { ...full, all: true }).advice, [existing, fresh]);
});

test("quiet mode: nothing when clean, nothing below the floor, no ack, no counts", () => {
  assert.deepEqual(adviceOnSuccess([], [], quiet), {});
  assert.deepEqual(adviceOnSuccess([], [f("unreachable-block", "/blocks/z", "P3")], quiet), {}, "P3 is below the P2 floor");
  assert.deepEqual(adviceOnSuccess([], [f("dead-button", "/blocks/a", "P1")], quiet), { advice: [f("dead-button", "/blocks/a", "P1")] });
  assert.deepEqual(adviceOnSuccess([f("dead-button", "/blocks/a", "P1")], [f("dead-button", "/blocks/a", "P1")], quiet), {}, "a known finding is never repeated");
  assert.deepEqual(adviceOnSuccess([], [f("unreachable-block", "/blocks/z", "P3")], { mode: "quiet", minSeverity: "P3" }).advice?.length, 1);
  assert.equal(adviceOnSuccess([], [{ level: "hint", at: "/x", code: "slot-max", msg: "m" }], quiet).advice?.length, 1, "a hint counts as P2");
});

test("off returns nothing; the policy parser tolerates junk", () => {
  assert.deepEqual(adviceOnSuccess(null, [f("dead-button", "/blocks/a", "P1")], { mode: "off", minSeverity: "P2" }), {});
  assert.deepEqual(parsePolicy({}), { mode: "full", minSeverity: "P2" });
  assert.deepEqual(parsePolicy({ advice: "quiet", minSeverity: "P1", all: true }), { mode: "quiet", minSeverity: "P1", all: true });
  assert.deepEqual(parsePolicy({ advice: "loud", minSeverity: "P9" }, quiet), quiet);
});

test("a 20-patch session with one persistent finding reports it exactly once", () => {
  const known = f("dead-button", "/blocks/a", "P1");
  let before: Advice[] = [];
  let seen = 0;
  for (let i = 0; i < 20; i++) {
    const after = i === 0 ? [] : [known];
    if (i === 1) { const r = adviceOnSuccess(before, after, quiet); seen += r.advice?.length ?? 0; }
    else seen += adviceOnSuccess(before, after, quiet).advice?.length ?? 0;
    before = after;
  }
  assert.equal(seen, 1);
});
