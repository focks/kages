import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store/store.ts";
import { dispatch, type OpContext } from "./operations.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import { runCli } from "../test-support/cli.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { KageDoc } from "../engine/types.ts";

const loud: KageDoc = { ...sampleKage({ id: "loud" }), brief: { mode: "read" }, blocks: {
  root: { type: "page", props: { width: "wide", gap: 8 }, slots: { children: ["a", "b"] } },
  a: { type: "section", props: { title: "A", tone: "accent", inset: 8 }, slots: { children: ["t"] } },
  b: { type: "section", props: { title: "B", tone: "accent", inset: 6 } },
  t: { type: "text", props: { text: "Hi", variant: "display" } },
} };
function ctx(grants: Array<"read" | "write" | "admin"> = ["read", "write", "admin"]): OpContext {
  const store = new Store(); store.grant("agent:t", "kages", grants);
  return { store, author: { principal: "agent:t" } };
}
const data = (r: unknown) => (r as { ok: true; data: any }).data;

test("tune_kage is a dry run by default: the plan, the validation, and no write", () => {
  const c = ctx();
  assert.ok(dispatch(c, "create_kage", { doc: loud }).ok);
  const before = JSON.stringify(c.store.snapshot());
  const d = data(dispatch(c, "tune_kage", { name: "loud", direction: "quieter" }));
  assert.equal(d.applied, false);
  assert.equal(d.wouldCreate, "v2");
  assert.ok(d.knobs.length > 0);
  assert.equal(d.validation.ok, true);
  assert.ok(d.loudness.after < d.loudness.before);
  assert.equal(JSON.stringify(c.store.snapshot()), before, "nothing was written");
});

test("apply creates exactly one version marked as a tune; at the floor it does nothing", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: loud });
  const done = data(dispatch(c, "tune_kage", { name: "loud", direction: "quieter", amount: 3, apply: true }));
  assert.equal(done.applied, true);
  const head = c.store.head("loud")!;
  assert.equal(head.v, 2);
  assert.equal(head.change.kind, "tune");
  assert.equal(head.change.summary, "tune quieter ×3 (scope: doc)");
  for (let i = 0; i < 6; i++) dispatch(c, "tune_kage", { name: "loud", direction: "quieter", amount: 3, apply: true });
  const floor = data(dispatch(c, "tune_kage", { name: "loud", direction: "quieter", apply: true }));
  assert.equal(floor.applied, false);
  assert.deepEqual(floor.knobs, []);
  assert.match(floor.skipped.at(-1).reason, /already at the floor/);
  const versions = c.store.head("loud")!.v;
  dispatch(c, "tune_kage", { name: "loud", direction: "quieter", apply: true });
  assert.equal(c.store.head("loud")!.v, versions, "no empty versions");
});

test("validation of the request, scope and permissions", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: loud });
  assert.equal(dispatch(c, "tune_kage", { name: "loud", direction: "louder" }).ok, false);
  assert.equal(dispatch(c, "tune_kage", { name: "loud", direction: "bolder", scope: "ghost" }).ok, false);
  assert.equal(dispatch(c, "tune_kage", { name: "missing", direction: "bolder" }).ok, false);
  const scoped = data(dispatch(c, "tune_kage", { name: "loud", direction: "quieter", amount: 3, scope: "b" }));
  assert.ok(scoped.knobs.every((k: { block: string }) => k.block === "b"));
  const reader: OpContext = { store: c.store, author: { principal: "agent:ro" } };
  c.store.grant("agent:ro", "kages", ["read"]);
  assert.equal(data(dispatch(reader, "tune_kage", { name: "loud", direction: "quieter" })).applied, false, "a reader may plan");
  const denied = dispatch(reader, "tune_kage", { name: "loud", direction: "quieter", apply: true });
  assert.ok(!denied.ok && denied.error.code === "forbidden");
});

test("CLI: dry run prints the knob table; --apply writes; both flags at once is refused", async () => {
  const dir = tmpDir(), ws = ["-C", join(dir, ".kages")], kf = join(dir, "k.kage.json");
  writeFileSync(kf, JSON.stringify(loud));
  await runCli([...ws, "create", kf, "--local"]);
  const dry = await runCli([...ws, "tune", "loud", "--quieter", "--local"]);
  assert.match(dry.out, /loud: quieter ×1 · mode read \(declared\)/);
  assert.match(dry.out, /dry run: nothing was written/);
  assert.match(dry.out, /b\s+tone\s+"accent" → "surface"/);
  assert.doesNotMatch((await runCli([...ws, "versions", "loud", "--local"])).out, /v2/);
  const applied = await runCli([...ws, "tune", "loud", "--quieter", "--apply", "--local"]);
  assert.match(applied.out, /applied as one new version/);
  assert.match((await runCli([...ws, "versions", "loud", "--local"])).out, /v2/);
  const both = await runCli([...ws, "tune", "loud", "--quieter", "--bolder", "--local"]);
  assert.equal(both.code, 1);
  assert.match(both.err, /exactly one of/);
});
