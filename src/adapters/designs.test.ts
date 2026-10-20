// Workspace designs through the operation set: who may write them, what a Kage version pins, the default,
// and the failure modes (unknown design, deleted design, hostile values, stale revision, old snapshots).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Store, type StoreSnapshot } from "../store/store.ts";
import { dispatch, type OpContext } from "./operations.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import type { KageDoc } from "../engine/types.ts";
import legacy from "../store/__fixtures__/legacy-snapshot.json" with { type: "json" };

function ctx(grants: Array<"read" | "write" | "admin" | "publish"> = ["read", "write", "publish", "admin"], store = new Store()): OpContext {
  store.grant("agent:t", "kages", grants);
  return { store, author: { principal: "agent:t" } };
}
const data = (r: unknown) => (r as { ok: true; data: any }).data;
const code = (r: unknown) => (r as { ok: false; error: { code: string } }).error.code;
const head = (c: OpContext, n: string) => c.store.head(n)!;
const BRAND = { id: "brand", name: "Brand", base: "ledger", fonts: { body: "Inter" } };

test("only an admin writes designs; any member lists them", () => {
  const admin = ctx();
  const c: OpContext = { store: admin.store, author: { principal: "agent:member" } };
  admin.store.grant("agent:member", "kages", ["read", "write"]);
  assert.equal(code(dispatch(c, "set_design", { definition: BRAND })), "forbidden");
  assert.ok(dispatch(admin, "set_design", { definition: BRAND }).ok);
  assert.deepEqual(data(dispatch(c, "list_designs", {})).designs.map((d: { id: string }) => d.id), ["brand"]);
  assert.equal(code(dispatch(c, "delete_design", { id: "brand" })), "forbidden");
});

test("set_design reports bad values with the field, a stale revision and the cap; a brand colour fills a whole palette", () => {
  const c = ctx();
  const bad = dispatch(c, "set_design", { definition: { ...BRAND, colors: { light: { ink: "red;}" } } } });
  assert.equal(code(bad), "invalid_design"); assert.match(JSON.stringify(bad), /colors\.light\.ink/);
  assert.ok(dispatch(c, "set_design", { definition: BRAND, baseRevision: 0 }).ok);
  assert.equal(code(dispatch(c, "set_design", { definition: BRAND, baseRevision: 0 })), "conflict");
  assert.equal(data(dispatch(c, "set_design", { definition: BRAND, baseRevision: 1 })).revision, 2);
  const g = dispatch(c, "set_design", { definition: { id: "gen", name: "Generated", base: "core" }, brand: "#0b5fff" });
  assert.ok(g.ok); assert.equal(data(g).warnings, undefined, "a generated palette passes every contrast pair");
  assert.equal(data(dispatch(c, "get_design", { id: "gen" })).snapshot.light.accent.length, 7);
  assert.equal(code(dispatch(c, "set_design", { definition: { id: "x", name: "x", base: "core" }, brand: "blue" })), "invalid_params");
});

test("a weak palette is saved with a warning naming the failing pairs; get_design lists them", () => {
  const c = ctx();
  const r = dispatch(c, "set_design", { definition: { id: "pale", name: "Pale", base: "core", colors: { light: { ink: "#dddddd" } } } });
  assert.ok(r.ok); assert.match(data(r).warnings[0], /below their WCAG minimum/);
  assert.ok(data(dispatch(c, "get_design", { id: "pale" })).contrast.failing.length > 0);
});

test("a Kage version pins the design: editing the design restyles only the next version", () => {
  const c = ctx();
  dispatch(c, "set_design", { definition: { id: "d", name: "D", base: "core", colors: { light: { accent: "#112233" } } } });
  assert.ok(dispatch(c, "create_kage", { doc: { ...sampleKage({ id: "k" }), design: "d" } }).ok);
  assert.equal(head(c, "k").doc.resolved?.design?.light.accent, "#112233");
  dispatch(c, "set_design", { definition: { id: "d", name: "D", base: "core", colors: { light: { accent: "#445566" } } } });
  assert.equal(head(c, "k").doc.resolved?.design?.light.accent, "#112233", "the stored version did not move");
  assert.ok(dispatch(c, "patch_kage", { name: "k", ops: [{ op: "replace", path: "/title", value: "Renamed" }] }).ok);
  assert.equal(head(c, "k").doc.resolved?.design?.light.accent, "#445566", "the next version pins the design as it is now");
  assert.equal(head(c, "k").v, 2);
});

test("an unknown design is refused; a deleted one keeps the snapshot its version pinned", () => {
  const c = ctx();
  assert.equal(code(dispatch(c, "create_kage", { doc: { ...sampleKage({ id: "a" }), design: "nope" } })), "not_found");
  assert.equal(c.store.head("a"), undefined);
  dispatch(c, "set_design", { definition: BRAND });
  dispatch(c, "create_kage", { doc: { ...sampleKage({ id: "k" }), design: "brand" } });
  assert.ok(dispatch(c, "delete_design", { id: "brand" }).ok);
  assert.ok(dispatch(c, "patch_kage", { name: "k", ops: [{ op: "replace", path: "/title", value: "Still editable" }] }).ok);
  assert.equal(head(c, "k").doc.resolved?.design?.id, "brand");
  assert.equal(code(dispatch(c, "set_kage_design", { name: "k", design: "brand" })), "not_found");
  assert.equal(code(dispatch(c, "create_kage", { doc: { ...sampleKage({ id: "m" }), design: "brand" } })), "not_found");
  assert.equal(code(dispatch(c, "create_kage", { doc: { ...sampleKage({ id: "bad" }), design: 7 as never } })), "invalid_content");
});

test("the default design is for new Kages only, and design:\"\" opts out", () => {
  const c = ctx();
  dispatch(c, "set_design", { definition: BRAND, default: true });
  dispatch(c, "set_design", { definition: { id: "two", name: "Two", base: "core" }, default: true });
  assert.deepEqual(data(dispatch(c, "list_designs", {})).default, "two");
  assert.equal(data(dispatch(c, "list_designs", {})).designs.filter((d: { default: boolean }) => d.default).length, 1);
  dispatch(c, "create_kage", { doc: sampleKage({ id: "plain" }) });
  assert.equal(head(c, "plain").doc.design, "two");
  dispatch(c, "create_kage", { doc: { ...sampleKage({ id: "none" }), design: "" } });
  assert.equal(head(c, "none").doc.design, undefined); assert.equal(head(c, "none").doc.resolved?.design, undefined);
  dispatch(c, "set_design", { definition: { id: "three", name: "Three", base: "core" }, default: true });
  assert.equal(head(c, "plain").doc.design, "two", "an existing Kage does not follow a new default");
  assert.equal(data(dispatch(c, "set_design", { definition: { id: "three", name: "Three", base: "core" } })).default, true, "an edit keeps the default flag");
});

test("set_kage_design changes the design later, follows the base system, and removes it", () => {
  const c = ctx();
  dispatch(c, "set_design", { definition: { id: "serif", name: "Serif", base: "atelier", fonts: { display: "Lora" } } });
  dispatch(c, "create_kage", { doc: sampleKage({ id: "k" }) });
  const r = dispatch(c, "set_kage_design", { name: "k", design: "serif" });
  assert.ok(r.ok);
  assert.equal(head(c, "k").doc.design, "serif"); assert.match(head(c, "k").doc.system, /^atelier/);
  assert.equal(head(c, "k").doc.resolved?.design?.fonts.display, "Lora");
  assert.equal(data(dispatch(c, "set_kage_design", { name: "k", design: "serif", keepSystem: true })).version.v, 3, "re-applying is a new version that re-pins");
  assert.ok(dispatch(c, "set_kage_design", { name: "k", design: "" }).ok);
  assert.equal(head(c, "k").doc.design, undefined); assert.equal(head(c, "k").doc.resolved?.design, undefined);
  assert.equal(data(dispatch(c, "set_kage_design", { name: "k", design: "" })).unchanged, true);
});

test("designs survive a snapshot round trip; a snapshot from before designs restores with none", () => {
  const c = ctx();
  dispatch(c, "set_design", { definition: BRAND, default: true });
  const snap = JSON.parse(JSON.stringify(c.store.snapshot())) as StoreSnapshot;
  const back = ctx(["read", "write", "publish", "admin"], Store.restore(snap));
  assert.equal(data(dispatch(back, "list_designs", {})).default, "brand");
  const old = ctx(["read"], Store.restore(JSON.parse(JSON.stringify(legacy)) as StoreSnapshot));
  assert.deepEqual(data(dispatch(old, "list_designs", {})).designs, []);
  assert.equal((Store.restore(JSON.parse(JSON.stringify(legacy)) as StoreSnapshot).snapshot() as { designs?: unknown }).designs, undefined, "an empty set adds nothing to a snapshot");
});

test("a design is a member-readable record: anonymous callers see none", () => {
  const c = ctx();
  dispatch(c, "set_design", { definition: BRAND });
  const anon: OpContext = { store: c.store, author: { principal: "anon" } };
  assert.equal(code(dispatch(anon, "list_designs", {})), "forbidden");
  assert.equal(code(dispatch(anon, "get_design", { id: "brand" })), "forbidden");
});
