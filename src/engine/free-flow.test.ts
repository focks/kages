// The extended oracle pins new compositions before the engine, packs or store
// consume them. These checks preserve the pure-engine and immutable-contract
// boundary while verifying complete authoring flows. See oracle/free-flow.feature.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freeFlowExamples } from "../packs/examples.ts";
import { skillMd } from "../packs/packs.ts";
import { introTemplates } from "../server/templates.ts";
import { validate } from "./validate.ts";
import { describe } from "./describe.ts";
import { generationSchema, fromGenerated, toGenerated } from "./generate.ts";
import { resolve } from "./resolve.ts";
import { KageSession } from "./session.ts";
import { dispatch } from "../adapters/operations.ts";
import { Store } from "../store/store.ts";

for (const system of ["core", "ledger", "atelier"]) {
  test(`free-flow: complete reading, landing and interactive artifacts match the oracle in ${system}`, () => {
    for (const doc of freeFlowExamples()) {
      const golden = JSON.parse(readFileSync(new URL(`./__fixtures__/golden-${doc.id}-${system}.json`, import.meta.url), "utf8"));
      assert.deepEqual(validate(doc, system), golden.validation);
      assert.equal(golden.validation.ok, true);
      assert.equal(golden.validation.portable, true);
      assert.deepEqual(golden.validation.warnings, []);
      assert.equal(describe(doc, system), golden.description);
      assert.deepEqual(toGenerated(doc, system), golden.envelope);
      const back = fromGenerated(golden.envelope, system);
      assert.deepEqual(back.blocks, doc.blocks);
      assert.deepEqual(validate(back, system), golden.validation);
    }
  });
}

test("free-flow: every installed role is available to structured generation and all systems", () => {
  const roles = ["page", "section", "grid", "split", "image", "code", "list", "divider", "textarea", "slider", "checkbox", "bar-chart"];
  for (const system of ["core", "ledger", "atelier"]) {
    const variants = generationSchema(system).properties.blocks.items.anyOf;
    for (const role of roles) {
      assert.equal(resolve(system, role).ref, `core/${role}@1.0.0`);
      assert.ok(variants.some((v: any) => v.properties.type.enum[0] === role));
    }
    assert.match(skillMd(system), /Navigation is optional/);
    assert.doesNotMatch(skillMd(system), /that is the sidebar's job|Root block of any multi-region artifact|core\/html@1/);
  }
});

test("free-flow: native inputs expose live local outputs without custom handlers", () => {
  const doc = freeFlowExamples()[2];
  delete doc.blocks.draft.bind; delete doc.blocks.draft.on;
  delete doc.blocks.confidence.bind; delete doc.blocks.confidence.on;
  const session = new KageSession(doc);
  session.dispatch("draft", "change", { value: "A new draft" });
  session.dispatch("confidence", "change", { value: 85 });
  session.dispatch("details", "change", { checked: true });
  assert.equal(session.read("draft")?.value, "A new draft");
  assert.equal(session.read("confidence")?.value, 85);
  assert.equal(session.read("details")?.checked, true);
  assert.equal(session.visible("structured"), true);
});

test("free-flow: wired controls update text, charts and visibility in one transaction", () => {
  const session = new KageSession(freeFlowExamples()[2]);
  session.dispatch("draft", "change", { value: "A flowing artifact" });
  session.dispatch("confidence", "change", { value: 80 });
  session.dispatch("details", "change", { checked: true });
  assert.match(String(session.read("summary")?.text), /A flowing artifact/);
  assert.match(String(session.read("summary")?.text), /80%/);
  assert.equal((session.read("comparison")?.items as any[])[1].value, 80);
  assert.equal(session.visible("structured"), true);
});

test("free-flow: starters validate and create/clone/publish through the operation table", () => {
  const store = new Store({ clock: () => 1_000 });
  const ctx = { store, author: { principal: "agent:acme/author" } };
  for (const doc of introTemplates()) {
    assert.equal(validate(doc).ok, true, doc.id);
    assert.deepEqual(validate(doc).warnings, [], doc.id);
    assert.equal(dispatch(ctx, "create_kage", { doc, repo: "templates" }).ok, true);
  }
  assert.equal(dispatch(ctx, "clone_kage", { name: "idea-lab", title: "My lab" }).ok, true);
  assert.equal(dispatch(ctx, "publish_kage", { name: "idea-lab" }).ok, true);
  const templates = dispatch(ctx, "search_templates", {}) as any;
  assert.equal(templates.data.length, introTemplates().length + 1); // clone remains an ordinary searchable Kage
});
