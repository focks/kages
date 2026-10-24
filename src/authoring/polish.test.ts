// Presentation proposals must be reversible without replacing facts or behavior.
import { test } from "node:test";
import assert from "node:assert/strict";
import { planPolish, PERSONALITIES } from "./polish.ts";
import { polishExamples } from "../packs/polish-examples.ts";
import { applyPatch } from "../collab/patch.ts";
import { validate } from "../engine/validate.ts";
import { Store } from "../store/store.ts";
import { dispatch, isWriteOp } from "../adapters/operations.ts";

test("all personalities preserve facts, events and bindings and undo exactly", () => {
  for (const system of ["core", "ledger", "atelier"]) for (const personality of PERSONALITIES) {
    const doc = polishExamples(system)[0], original = JSON.stringify(doc);
    const plan = planPolish(doc, { personality });
    assert.deepEqual(validate(plan.preview).errors, []);
    assert.deepEqual(plan.preview.data, doc.data);
    assert.deepEqual(plan.preview.blocks.scenario, doc.blocks.scenario);
    assert.deepEqual(applyPatch(applyPatch(doc, plan.patch), plan.undo), doc);
    assert.equal(JSON.stringify(doc), original);
  }
});

test("wrapping existing roots avoids collisions; advisory checks do not invent metadata", () => {
  const doc = polishExamples()[0];
  doc.blocks.root.type = "stack"; delete doc.blocks.root.props;
  doc.blocks.presentation = { type: "text", props: { text: "Keep me" } };
  doc.blocks.companies.props!.colorDomain = ["Infrastructure", "Applications"];
  delete doc.blocks.budget.props!.unit;
  const plan = planPolish(doc);
  assert.equal(plan.preview.root, "presentation_");
  assert.deepEqual(plan.preview.blocks.presentation, doc.blocks.presentation);
  assert.ok(plan.findings.some(f => f.message.includes("different color position")));
  assert.ok(plan.findings.some(f => f.block === "budget" && f.message.includes("units")));
  assert.deepEqual(applyPatch(applyPatch(doc, plan.patch), plan.undo), doc);
});

test("polish preview is read-only; apply and undo obey version and permission gates", () => {
  const store = new Store(); const author = { principal: "agent:polish/owner" };
  store.grant(author.principal, "kages", ["write", "publish", "review", "admin"]);
  const c = { store, author }, name = "allocation-lab";
  assert.equal(dispatch(c, "create_kage", { doc: polishExamples()[0] }).ok, true);
  const before = store.head(name)!;
  const result = dispatch(c, "polish_kage", { name, personality: "editorial" }) as any;
  assert.equal(result.ok, true); assert.equal(store.head(name)!.v, before.v);
  assert.equal(isWriteOp("polish_kage", { name }), false);
  assert.equal(dispatch(c, "polish_kage", { name, apply: true }).ok, false);
  assert.equal(dispatch(c, "polish_kage", { name, personality: "invalid" }).ok, false);
  const saved = dispatch(c, "polish_kage", { name, personality: "editorial", apply: true, baseVersion: before.v }) as any;
  assert.equal(saved.ok, true); assert.equal(saved.data.version.v, before.v + 1);
  assert.equal(dispatch(c, "polish_kage", { name, apply: true, baseVersion: before.v }).ok, false);
  assert.equal(dispatch({ store, author: { principal: "agent:other/user" } }, "polish_kage", { name }).ok, false);
  assert.equal(dispatch(c, "patch_kage", { name, ops: result.data.undo, baseVersion: saved.data.version.v }).ok, true);
  assert.deepEqual(store.head(name)!.doc.blocks.root, before.doc.blocks.root);
});
