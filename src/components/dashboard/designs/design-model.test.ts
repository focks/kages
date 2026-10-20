import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_GROUPS, blankState, previewDoc, slugify, snapshotOf, stateFromRecord, toDefinition } from "./design-model.ts";
import { COLOR_ROLES, basePalette, resolveDesign, validateDesign } from "../../../engine/design.ts";
import { validate } from "../../../engine/validate.ts";
import { lint } from "../../../engine/advice.ts";

const basePal = (b: "core" | "ledger" | "atelier") => ({ light: basePalette(b, "light"), dark: basePalette(b, "dark") });

test("every colour role is offered exactly once in the editor", () => {
  assert.deepEqual(ROLE_GROUPS.flatMap((g) => g.roles.map((r) => r.role)).sort(), [...COLOR_ROLES].sort());
});

test("only changed roles are sent, so the rest keep inheriting", () => {
  const snap = resolveDesign({ id: "x", name: "x", base: "ledger" });
  const s = { ...blankState("ledger", snap), id: "x", name: "X" };
  assert.deepEqual(toDefinition(s, basePal("ledger")), { id: "x", name: "X", base: "ledger" });
  s.light.accent = "#112233"; s.fonts.body = "Inter"; s.radius.on = true;
  const d = toDefinition(s, basePal("ledger"));
  assert.deepEqual(d.colors, { light: { accent: "#112233" } });
  assert.deepEqual(d.fonts, { body: "Inter" });
  assert.deepEqual(d.radius, { sm: 3, md: 6, lg: 10 });
  assert.ok(validateDesign(d).ok);
});

test("a saved design loads back into the same editor state", () => {
  const def = { id: "a", name: "A", base: "atelier" as const, colors: { dark: { accent: "#ffcc00" } }, fonts: { display: "Lora" } };
  const snap = resolveDesign(def);
  const s = stateFromRecord({ def, revision: 3, default: true }, snap);
  assert.equal(s.dark.accent, "#ffcc00"); assert.equal(s.fonts.display, "Lora"); assert.equal(s.revision, 3); assert.equal(s.isDefault, true); assert.equal(s.radius.on, false);
  assert.deepEqual(toDefinition(s, basePal("atelier")), def);
  assert.deepEqual(snapshotOf(s).dark.accent, "#ffcc00");
});

test("slugs are valid design ids", () => {
  assert.equal(slugify("Brand Blue!"), "brand-blue");
  assert.equal(slugify("  Émile's  Theme  "), "emile-s-theme");
  assert.equal(slugify("!!!"), "");
  assert.ok(slugify("x".repeat(100)).length <= 40);
  assert.ok(validateDesign({ id: slugify("Ünï Cödé 2"), name: "n", base: "core" }).ok);
});

test("the preview page is a valid, lint-clean Kage in every base system", () => {
  for (const base of ["core", "ledger", "atelier"] as const) {
    const doc = previewDoc(base);
    const v = validate(doc);
    assert.deepEqual(v.errors, [], base);
    assert.deepEqual(lint(doc).filter((f: any) => f.severity === "P0" || f.severity === "P1"), [], base);
  }
});
