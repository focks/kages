import { test } from "node:test";
import assert from "node:assert/strict";
import { agentPrompt, checkEdits, connectCommands, intakeFrom, starters, uniqueId } from "./guide-model.ts";
import { buildDecisionGuide } from "../../../packs/decision-guide.ts";
import { validate } from "../../../engine/validate.ts";

test("every starting point is offered with what it contains", () => {
  const s = starters();
  assert.deepEqual(s.map((x) => x.key), ["snowflake-reader-accounts", "queue-choice", "redis-hosting"]);
  assert.match(s[1].facts, /^2 questions, 2 numbers to change, 3 setup steps, 2 sources$/);
  assert.match(s[2].facts, /^1 question, 4 numbers/);
});

test("uniqueId avoids collisions and survives an empty title", () => {
  assert.equal(uniqueId("My Guide!", []), "my-guide");
  assert.equal(uniqueId("My Guide", ["my-guide", "my-guide-2"]), "my-guide-3");
  assert.equal(uniqueId("???", []), "guide");
  assert.equal(uniqueId("x".repeat(100), []).length, 48);
});

test("edits override the example, blanks fall back, and the result always builds a valid unverified guide", () => {
  for (const s of starters()) {
    const i = intakeFrom(s.key, { title: "  Our choice  ", reader: "", summary: "A short summary." }, ["our-choice"]);
    assert.equal(i.title, "Our choice"); assert.equal(i.id, "our-choice-2");
    assert.equal(i.reader, s.reader); assert.equal(i.summary, "A short summary.");
    const r = buildDecisionGuide(i);
    assert.deepEqual(r.problems, []);
    assert.deepEqual(validate(r.doc!).errors, []);
    assert.equal(r.doc!.blocks.verify.type, "alert", "an example's facts are not verified by renaming it");
  }
  assert.throws(() => intakeFrom("nope", { title: "", reader: "", summary: "" }, []), /no starting point/);
  const a = intakeFrom("queue-choice", { title: "", reader: "", summary: "" }, []), b = intakeFrom("queue-choice", { title: "Changed", reader: "", summary: "" }, []);
  assert.notEqual(a.title, b.title);
  assert.equal(intakeFrom("queue-choice", { title: "", reader: "", summary: "" }, []).title, a.title, "the shared example is never mutated");
});

test("input limits and the agent text", () => {
  assert.match(checkEdits({ title: "x".repeat(121), reader: "", summary: "" })!, /title/);
  assert.match(checkEdits({ title: "", reader: "", summary: "x".repeat(401) })!, /summary/);
  assert.equal(checkEdits({ title: "ok", reader: "ok", summary: "ok" }), null);
  assert.match(agentPrompt(), /kages-decision-guide skill/);
  assert.match(agentPrompt(), /not yet verified/);
  assert.equal(connectCommands("http://x:1")[0].command, "claude mcp add --transport http kages http://x:1/api/mcp");
});
