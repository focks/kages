// Play the guide as a document: chapter selection must preserve working controls,
// and filtered evidence must keep the identity of its expandable entries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guideExamples } from "./guide-examples.ts";
import { KageSession } from "../engine/session.ts";
import { validate } from "../engine/validate.ts";
import { describe } from "../engine/describe.ts";
import { lint } from "../engine/advice.ts";
import { toGenerated, fromGenerated } from "../engine/generate.ts";

test("field guide is portable, lint-clean and oracle-faithful in every system", () => {
  for (const system of ["core", "ledger", "atelier"]) {
    const doc = guideExamples()[0];
    const golden = JSON.parse(readFileSync(new URL(`../engine/__fixtures__/golden-${doc.id}-${system}.json`, import.meta.url), "utf8"));
    assert.deepEqual(validate(doc, system), golden.validation); assert.equal(golden.validation.portable, true); assert.deepEqual(golden.validation.errors, []);
    assert.equal(describe(doc, system), golden.description); assert.deepEqual(toGenerated(doc, system), golden.envelope);
    assert.deepEqual(fromGenerated(golden.envelope, system).blocks, doc.blocks); assert.deepEqual(lint(guideExamples(system)[0]), []);
  }
});

test("chapter changes preserve checklist state and reset restores its baseline", () => {
  const s = new KageSession(guideExamples()[0]);
  s.dispatch("guide", "change", { id: "checklist" }); assert.equal(s.visible("overview"), false); assert.equal(s.visible("checklist"), true);
  s.dispatch("check-content", "change", { checked: true }); assert.equal(s.read("check-score")?.value, 1);
  s.dispatch("guide", "change", { id: "overview" }); s.dispatch("guide", "change", { id: "checklist" });
  assert.equal(s.read("check-content")?.checked, true);
  s.dispatch("check-reset", "click"); assert.equal(s.read("check-score")?.value, 0);
});

test("evidence filters combine, expose an empty state, and preserve disclosure identity", () => {
  const s = new KageSession(guideExamples()[0]);
  const entries = () => Object.keys(s.instances().blocks).filter(id => id.startsWith("entry~"));
  const id = entries()[0]; s.dispatch(id, "change", { open: true });
  s.dispatch("category", "change", { value: "Interactions" }); assert.equal(entries().length, 2);
  s.dispatch("query", "change", { value: "reset" }); assert.equal(entries().length, 1);
  s.dispatch("query", "change", { value: "unmatched" }); assert.equal(entries().length, 0); assert.equal(s.visible("empty"), true);
  s.dispatch("filter-reset", "click"); assert.equal(entries().length, 4); assert.equal(s.visible("empty"), false); assert.equal(s.read(id)?.open, true);
});

test("scenario and map choices change their explanations", () => {
  const s = new KageSession(guideExamples()[0]);
  s.dispatch("scenario", "change", { value: "debug" });
  let id = Object.keys(s.instances().blocks).find(id => id.startsWith("scenario-result~"))!;
  assert.equal(s.read(id)?.title, "A searchable troubleshooting catalog");
  s.dispatch("flow", "select", { id: "reader" });
  id = Object.keys(s.instances().blocks).find(id => id.startsWith("layer-detail~"))!;
  assert.equal(s.read(id)?.palette, "mint");
});
