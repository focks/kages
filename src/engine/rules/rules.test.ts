import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES, ruleById } from "./index.ts";
import { FIXTURES, FIXTURE_OPTIONS, mk } from "./fixtures.ts";
import { lint, lintDetailed } from "../advice.ts";
import type { KageDoc } from "../types.ts";

test("registry integrity: unique kebab-case ids, documented, with fixtures", () => {
  const ids = RULES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate rule id");
  for (const r of RULES) {
    assert.match(r.id, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, r.id);
    assert.ok(r.summary.length > 10 && r.rationale.length > 20, `${r.id}: summary and rationale are required`);
    assert.ok(["P0", "P1", "P2", "P3"].includes(r.severity));
    assert.ok(FIXTURES[r.id], `${r.id}: missing fixtures`);
  }
  assert.deepEqual(Object.keys(FIXTURES).sort(), [...ids].sort(), "a fixture exists for an unregistered rule");
});

test("every rule fires on its positive fixture and stays quiet on its negative one", () => {
  for (const r of RULES) {
    const pos = lintDetailed(FIXTURES[r.id].pos, FIXTURE_OPTIONS[r.id]).findings.filter((f) => f.rule === r.id);
    assert.ok(pos.length >= 1, `${r.id} did not fire on its positive fixture`);
    const neg = lintDetailed(FIXTURES[r.id].neg, FIXTURE_OPTIONS[r.id]).findings.filter((f) => f.rule === r.id);
    assert.deepEqual(neg, [], `${r.id} fired on its negative fixture`);
  }
});

test("findings carry rule, severity and tier; output is deterministic and severity-ordered", () => {
  const doc = mk({ b: { type: "button", props: { label: "x" } }, v: { type: "video", props: { label: "V", src: "http://x.test/a.mp4" } } }, {
    blocks: { root: { type: "stack", props: {} }, ghost: { type: "text", props: { text: "g" } } } } as never);
  const a = lintDetailed(doc).findings, b = lintDetailed(JSON.parse(JSON.stringify(doc))).findings;
  assert.deepEqual(a, b);
  assert.ok(a.every((f) => f.rule === f.code && f.severity && f.tier));
  const rank = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
  assert.deepEqual(a.map((f) => rank[f.severity!]), [...a.map((f) => rank[f.severity!])].sort((x, y) => x - y));
});

const withWaivers = (ignore: unknown): KageDoc => ({ ...FIXTURES["dead-button"].pos, meta: { kages: { lint: { ignore } } } as never });

test("a waiver with a reason removes the finding but reports it as waived", () => {
  const r = lintDetailed(withWaivers([{ rule: "dead-button", reason: "decorative preview only" }]));
  assert.equal(r.findings.length, 0);
  assert.equal(r.waived.length, 1);
  assert.equal(r.waived[0].rule, "dead-button");
});

test("a block-scoped waiver covers only that block", () => {
  const two = mk({ a: { type: "button", props: { label: "A" } }, b: { type: "button", props: { label: "B" } } }, { meta: { kages: { lint: { ignore: [{ rule: "dead-button", block: "a", reason: "intentionally inert" }] } } } as never });
  const r = lintDetailed(two);
  assert.deepEqual(r.findings.map((f) => f.at), ["/blocks/b"]);
  assert.deepEqual(r.waived.map((f) => f.at), ["/blocks/a"]);
});

test("a short reason, unknown rule or missing rule becomes a bad-waiver finding and waives nothing", () => {
  for (const w of [{ rule: "dead-button", reason: "no" }, { rule: "made-up-rule", reason: "a perfectly fine reason" }, { reason: "no rule named here" }]) {
    const r = lintDetailed(withWaivers([w]));
    assert.ok(r.findings.some((f) => f.code === "bad-waiver" && f.severity === "P3"), JSON.stringify(w));
    assert.ok(r.findings.some((f) => f.code === "dead-button"), "the finding must not be waived");
  }
});

test("workspace ignoreRules, tier filter and severity override apply", () => {
  const doc = FIXTURES["dead-button"].pos;
  assert.equal(lintDetailed(doc, { ignoreRules: ["dead-button"] }).findings.length, 0);
  const deep = lintDetailed(doc, { tier: "deep" }).ran;
  assert.ok(deep.includes("brief-invalid") && deep.every((id) => RULES.find((r) => r.id === id)!.tier === "deep"));
  assert.ok(!deep.includes("dead-button"));
  assert.equal(lintDetailed(doc, { severity: { "dead-button": "P3" } }).findings[0].severity, "P3");
});

test("a mode-gated rule runs only when the Kage declares that mode", () => {
  const gated = { ...RULES[0], id: "persuade-only", modes: ["persuade" as const], check: () => [{ at: "/", msg: "hit" }] };
  const run = (mode?: string) => lintDetailed({ ...FIXTURES["dead-button"].neg, ...(mode ? { brief: { mode } } : {}) } as never, { rules: [gated] }).findings.length;
  assert.equal(run(), 0, "unknown mode: skipped");
  assert.equal(run("read"), 0);
  assert.equal(run("persuade"), 1);
});

test("lint never throws on malformed documents and stays fast on a large one", () => {
  for (const d of [null, {}, { blocks: null }, { blocks: { a: null, b: 3 } }, { blocks: { a: { type: "button" } }, meta: { kages: { lint: { ignore: "x" } } } }])
    assert.doesNotThrow(() => lint(d as never));
  const big: Record<string, never> = {};
  for (let i = 0; i < 1000; i++) (big as Record<string, unknown>)["b" + i] = { type: "text", props: { text: "t" + i } };
  const t0 = Date.now(); lintDetailed(mk(big as never)); assert.ok(Date.now() - t0 < 500);
});
