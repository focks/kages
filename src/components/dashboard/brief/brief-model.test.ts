import { test } from "node:test";
import assert from "node:assert/strict";
import { toForm, fromForm, changedFields, problems, missingRequired, BRIEF_FORM_FIELDS } from "./brief-model.ts";
import { validateBrief } from "../../../store/brief.ts";

const brief = { schema: 1, users: "Partners", purpose: "Self-serve", absent: ["testimonials", "customer logos"], voice: "Plain", evidence: [{ kind: "link", ref: "https://x.test/status", note: "uptime page" }, { kind: "data", ref: "q3.csv" }], inferred: ["purpose"] };

test("every brief field has a form field (a new field cannot be forgotten)", () => {
  const keys = BRIEF_FORM_FIELDS.map((f) => f.key).sort();
  assert.deepEqual(keys, ["absent", "brandCommitments", "constraints", "evidence", "openDecisions", "operatingContext", "positioning", "principles", "purpose", "users", "voice"]);
});

test("form round trip is lossless and produces a brief the server accepts", () => {
  const form = toForm(brief);
  assert.equal(form.absent, "testimonials\ncustomer logos");
  assert.equal(form.evidence, "link | https://x.test/status | uptime page\ndata | q3.csv");
  const back = fromForm(form, ["purpose"]);
  assert.deepEqual(back, brief);
  assert.ok(validateBrief(back).ok);
});

test("clearing a field removes it; blank lines are dropped; edited drafts stop being inferred", () => {
  const form = { ...toForm(brief), voice: "   ", absent: "a\n\n  b  \n" };
  const out = fromForm(form, ["purpose", "voice"]);
  assert.equal("voice" in out, false);
  assert.deepEqual(out.absent, ["a", "b"]);
  assert.deepEqual(out.inferred, ["purpose"], "a cleared field cannot stay in inferred");
  assert.deepEqual(changedFields(toForm(brief), { ...toForm(brief), purpose: "New purpose" }), ["purpose"]);
  assert.deepEqual(changedFields(toForm(brief), toForm(brief)), []);
});

test("problems: required fields, bad evidence, limits", () => {
  assert.deepEqual(problems(toForm(brief)), []);
  assert.deepEqual(problems(toForm({})).map((p) => p.key), ["users", "purpose"]);
  const bad = problems({ ...toForm(brief), evidence: "rumor | x\nlink |", absent: Array.from({ length: 21 }, (_, i) => "a" + i).join("\n") });
  assert.equal(bad.filter((p) => p.key === "evidence").length, 2);
  assert.ok(bad.some((p) => p.key === "absent" && /at most 20/.test(p.message)));
  assert.ok(problems({ ...toForm(brief), users: "x".repeat(2001) }).some((p) => p.key === "users"));
});

test("missingRequired drives the empty-state prompt", () => {
  assert.deepEqual(missingRequired(null), ["Who uses it", "What it is for"]);
  assert.deepEqual(missingRequired({ users: "u" }), ["What it is for"]);
  assert.deepEqual(missingRequired(brief), []);
});
