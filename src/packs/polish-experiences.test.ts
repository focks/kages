// These examples are complete tasks, not a catalog of disconnected controls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { polishExamples } from "./polish-examples.ts";
import { validate } from "../engine/validate.ts";
import { lint } from "../engine/advice.ts";
import { KageSession } from "../engine/session.ts";

/** Assert the resolved collection shape before checking linked chart values. */
function rows(session: KageSession, block: string, prop = "items") {
  const value = session.read(block)?.[prop];
  assert.ok(Array.isArray(value));
  return value as Array<Record<string, unknown>>;
}

test("all four polished experiences are valid, portable and lint-clean in every system", () => {
  for (const system of ["core", "ledger", "atelier"]) for (const doc of polishExamples(system)) {
    const result = validate(doc);
    assert.deepEqual(result.errors, [], doc.id); assert.deepEqual(result.warnings, [], doc.id); assert.equal(result.portable, true, doc.id);
    assert.deepEqual(lint(doc), [], doc.id);
  }
});

test("workbench filters, scenario, import and reset keep related views consistent", () => {
  const doc = polishExamples()[1], session = new KageSession(doc);
  assert.equal(rows(session, "line").length, 8);
  session.dispatch("category", "change", { value: "North" });
  session.dispatch("factor", "change", { value: 2 });
  assert.equal(rows(session, "line").length, 4);
  assert.equal(rows(session, "line")[0].y, 48);
  assert.equal(rows(session, "bars")[0].value, 48);
  assert.equal(rows(session, "table", "rows")[0].value, 48);
  const values = session.read("hist")?.values;
  assert.ok(Array.isArray(values));
  assert.equal(values[0], 48);
  session.dispatch("line", "rangeChange", { min: 2, max: 3 });
  session.dispatch("line", "legendChange", { hidden: ["North"] });
  session.dispatch("import", "import", { rows: [{ id: "csv", label: "CSV row", category: "South", x: 1, value: 9 }], columns: [], types: {} });
  assert.equal(rows(session, "line")[0].y, 18);
  assert.equal(session.read("line")?.source, "CSV imported by reader");
  assert.deepEqual(session.read("line")?.hiddenSeries, []);
  session.dispatch("hist", "select", { id: "1", min: 0, max: 10, count: 1 });
  session.dispatch("multiples", "select", { panel: "0", id: "1" });
  session.dispatch("reset", "click");
  assert.deepEqual(session.getState(), doc.state);
});

test("field guide filters preserve evidence identity and review state across chapters", () => {
  const session = new KageSession(polishExamples()[2]);
  session.dispatch("guide", "change", { id: "evidence" });
  assert.equal(session.visible("overview"), false); assert.equal(session.visible("evidence"), true);
  session.dispatch("category", "change", { value: "Interaction" });
  assert.equal(session.read("count")?.text, "1 matching sources");
  session.dispatch("query", "change", { value: "does not match" }); assert.equal(session.visible("empty"), true);
  session.dispatch("clear", "click"); assert.equal(session.read("count")?.text, "3 matching sources");
  session.dispatch("guide", "change", { id: "review" }); session.dispatch("meaning", "change", { checked: true });
  session.dispatch("guide", "change", { id: "overview" }); session.dispatch("guide", "change", { id: "review" });
  assert.equal(session.read("progress")?.text, "1 of 3 review checks recorded");
  session.dispatch("resetReview", "click"); assert.equal(session.read("progress")?.text, "0 of 3 review checks recorded");
});

test("classroom selection explains nodes and the quiz gives feedback with a complete restart", () => {
  const doc = polishExamples()[3], session = new KageSession(doc);
  session.dispatch("graph", "select", { id: "render" });
  const detail = Object.keys(session.instances().blocks).find(key => key.startsWith("detail~"))!;
  assert.equal(session.read(detail)?.title, "Sandboxed rendering");
  session.dispatch("graph", "groupsChange", { groups: ["Inputs"] });
  session.dispatch("controls", "change", { value: "swimlane" });
  session.dispatch("steps", "change", { value: "check" }); assert.equal(session.visible("quiz"), true);
  session.dispatch("answer", "change", { value: "script" }); assert.match(String(session.read("feedback")?.text), /Try again/);
  session.dispatch("answer", "change", { value: "document" }); assert.match(String(session.read("feedback")?.text), /Correct/);
  session.dispatch("reset", "click"); assert.deepEqual(session.getState(), doc.state);
});
