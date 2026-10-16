import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store/store.ts";
import { dispatch, type OpContext } from "./operations.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import { findDeprecated, type Deprecation } from "../engine/deprecations.ts";
import { validate } from "../engine/validate.ts";
import type { KageDoc } from "../engine/types.ts";
import { runCli } from "../test-support/cli.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const REG: Deprecation[] = [
  { id: "text-variant-heading", kind: "enum-value", target: { role: "text" }, prop: "variant", value: "heading", since: "core@9", reason: "headings are titles now", replacement: { prop: "variant" }, migration: { op: "map-value", map: { heading: "title" } }, auto: true },
  { id: "text-tone", kind: "prop", target: { role: "text" }, prop: "tone", since: "core@9", reason: "tone moved to the system", replacement: null, auto: false },
];
const withHeading = (id = "m"): KageDoc => ({ ...sampleKage({ id }), blocks: { root: { type: "stack", props: {}, slots: { children: ["h"] } }, h: { type: "text", props: { text: "Title", variant: "heading" } } } });
function ctx(extra: Partial<OpContext> = {}): OpContext {
  const store = new Store(); store.grant("agent:t", "kages", ["read", "write", "admin"]);
  return { store, author: { principal: "agent:t" }, registry: REG, ...extra };
}
const data = (r: unknown) => (r as { ok: true; data: any }).data;

test("migrate_kage plans without writing, then applies as one version marked as a migration", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: withHeading() });
  const plan = data(dispatch(c, "migrate_kage", { name: "m" }));
  assert.equal(plan.applied, false);
  assert.equal(plan.wouldCreate, "v2");
  assert.deepEqual(plan.migrations, ["text-variant-heading"]);
  assert.equal(c.store.head("m")!.v, 1, "planning wrote nothing");
  const done = data(dispatch(c, "migrate_kage", { name: "m", apply: true }));
  assert.equal(done.applied, true);
  const head = c.store.head("m")!;
  assert.equal(head.v, 2);
  assert.equal(head.change.kind, "migration");
  assert.equal(head.change.summary, "migrate: text-variant-heading");
  assert.deepEqual(findDeprecated(head.doc, REG), []);
  assert.ok(validate(head.doc).ok);
  assert.equal(data(dispatch(c, "migrate_kage", { name: "m", apply: true })).applied, false, "idempotent: nothing left to do");
});

test("manual entries are named, never guessed", () => {
  const c = ctx();
  const doc = withHeading("x"); (doc.blocks.h.props as Record<string, unknown>).tone = "loud";
  dispatch(c, "create_kage", { doc });
  const plan = data(dispatch(c, "migrate_kage", { name: "x" }));
  assert.equal(plan.manual.length, 1);
  assert.match(plan.manual[0].message, /tone moved to the system/);
  assert.match(plan.manual[0].message, /needs a decision/);
});

test("a stored version that uses a deprecated feature keeps validating and rendering after the registry gains the entry", () => {
  const c = ctx({ registry: [] });
  dispatch(c, "create_kage", { doc: withHeading("old") });
  const stored = c.store.head("old")!;
  const afterRegistry = { ...c, registry: REG };
  assert.equal(findDeprecated(stored.doc, REG).length, 1);
  assert.ok(validate(stored.doc).ok, "deprecation never breaks the past");
  assert.equal(data(dispatch(afterRegistry, "preview_kage", { name: "old" })).blocks.h.visible, true);
  assert.equal(stored.validation.ok, true);
});

test("block-new refuses a write that introduces deprecated usage and allows untouched legacy", () => {
  const legacy = ctx({ registry: [] });
  dispatch(legacy, "create_kage", { doc: withHeading("l") });
  const strict: OpContext = { ...legacy, registry: REG, deprecations: "block-new" };
  const add: unknown[] = [{ op: "add", path: "/blocks/h2", value: { type: "text", props: { text: "More", variant: "heading" } } }, { op: "add", path: "/blocks/root/slots/children/-", value: "h2" }];
  const r = dispatch(strict, "patch_kage", { name: "l", ops: add });
  assert.ok(!r.ok && r.error.code === "deprecated_usage");
  assert.equal((r as any).error.details.usages.length, 1);
  assert.equal(legacy.store.head("l")!.v, 1, "nothing was written");
  assert.ok(dispatch(strict, "patch_kage", { name: "l", ops: [{ op: "replace", path: "/blocks/h/props/text", value: "Edited" }] }).ok, "the legacy block was already there and is untouched in kind");
  assert.ok(dispatch(strict, "create_kage", { doc: withHeading("fresh") }).ok === false, "a new Kage may not start with deprecated usage");
  const warn = { ...strict, deprecations: "warn" as const };
  assert.ok(dispatch(warn, "patch_kage", { name: "l", ops: add }).ok, "warn mode only reports");
});

test("get_context raises DEPRECATED_USED with the command", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: withHeading("g") });
  const d = data(dispatch(c, "get_context", { kage: "g" }));
  const dir = d.directives.find((x: { code: string }) => x.code === "DEPRECATED_USED");
  assert.match(dir.command, /kages migrate g/);
});

test("CLI: migrate says nothing is deprecated while the shipped registry is empty", async () => {
  const dir = tmpDir(), ws = ["-C", join(dir, ".kages")], kf = join(dir, "k.kage.json");
  writeFileSync(kf, JSON.stringify(sampleKage({ id: "k" })));
  await runCli([...ws, "create", kf, "--local"]);
  const one = await runCli([...ws, "migrate", "k", "--local"]);
  assert.match(one.out, /k: nothing deprecated/);
  const all = await runCli([...ws, "migrate", "--all", "--local"]);
  assert.match(all.out, /nothing deprecated in any Kage/);
});
