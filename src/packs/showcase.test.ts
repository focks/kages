// The showcase is a usable tool, so exercise outcomes and reset states instead
// of treating a successful render as evidence that its interactions work.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { showcaseExamples } from "./showcase-examples.ts";
import { KageSession } from "../engine/session.ts";
import { validate } from "../engine/validate.ts";
import { describe } from "../engine/describe.ts";
import { toGenerated, fromGenerated } from "../engine/generate.ts";
import { lint } from "../engine/advice.ts";

test("showcase matches the oracle, is portable and lint-clean in all systems", () => {
  for (const system of ["core", "ledger", "atelier"]) {
    const doc = showcaseExamples()[0];
    const golden = JSON.parse(readFileSync(new URL(`../engine/__fixtures__/golden-${doc.id}-${system}.json`, import.meta.url), "utf8"));
    assert.deepEqual(validate(doc, system), golden.validation);
    assert.equal(golden.validation.ok, true); assert.equal(golden.validation.portable, true);
    assert.equal(describe(doc, system), golden.description);
    assert.deepEqual(toGenerated(doc, system), golden.envelope);
    assert.deepEqual(fromGenerated(golden.envelope, system).blocks, doc.blocks);
    assert.deepEqual(lint(showcaseExamples(system)[0]), [], system);
  }
});

test("consumer needs select all three recommendations and reset restores the starting route", () => {
  const s = new KageSession(showcaseExamples()[0]);
  assert.equal(s.read("recommendation")?.title, "Explore a reader account");
  s.dispatch("account", "change", { value: "existing" });
  assert.equal(s.read("recommendation")?.title, "Use their existing account");
  s.dispatch("own-data", "change", { checked: true });
  assert.equal(s.read("recommendation")?.title, "Use a full consumer account");
  s.dispatch("account", "change", { value: "new" });
  assert.equal(s.read("recommendation")?.title, "Use a full consumer account", "own data takes precedence for both account states");
  s.dispatch("reset-choice", "click");
  assert.equal(s.read("recommendation")?.palette, "mint");
  assert.equal(s.getState().ownData, false);
});

test("diagram selection changes the explanation and the colour to match the selected role", () => {
  const s = new KageSession(showcaseExamples()[0]);
  s.dispatch("flow", "select", { id: "provider" });
  const id = Object.keys(s.instances().blocks).find(id => id.startsWith("detail~"))!;
  assert.equal(s.read("flow")?.selected, "provider");
  assert.equal(s.read(id)?.title, "You own the relationship");
  assert.equal(s.read(id)?.palette, "violet");
});

test("calculator and chart follow inputs, handle zero and restore illustrative assumptions", () => {
  const s = new KageSession(showcaseExamples()[0]);
  assert.equal(s.read("total")?.value, 44);
  s.dispatch("hours", "change", { value: 8 });
  assert.equal(s.read("total")?.value, 176);
  assert.deepEqual(s.read("bars")?.items, [{ label: "This scenario", value: 176 }, { label: "Planning allowance", value: 100 }]);
  s.dispatch("rate", "change", { value: 2.5 }); assert.equal(s.read("total")?.value, 440);
  s.dispatch("days", "change", { value: 0 }); assert.equal(s.read("total")?.value, 0); assert.equal(s.visible("zero"), true);
  s.dispatch("reset-usage", "click"); assert.equal(s.read("total")?.value, 44); assert.equal(s.visible("zero"), false);
});
