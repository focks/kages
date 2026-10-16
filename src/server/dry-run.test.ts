// Planning calls are reads. migrate_kage plans by default and writes only with apply:true;
// routing a plan through the write path committed a snapshot (advancing the revision) and refused
// anonymous readers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isWriteOp } from "../adapters/operations.ts";
import { handleRest } from "../adapters/rest.ts";
import { dispatch } from "../adapters/operations.ts";
import { Store } from "../store/store.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import type { KageDoc } from "../engine/types.ts";

test("isWriteOp decides from the params; unknown params are treated as a write", () => {
  const op = "migrate_kage";
  assert.equal(isWriteOp(op, { name: "k" }), false);
  assert.equal(isWriteOp(op, { name: "k", apply: false }), false);
  assert.equal(isWriteOp(op, { name: "k", apply: "true" }), false, "only the boolean true applies, as the operation itself requires");
  assert.equal(isWriteOp(op, { name: "k", apply: true }), true);
  assert.equal(isWriteOp(op), true, "no params: assume the worst");
  assert.equal(isWriteOp("create_kage", {}), true);
  assert.equal(isWriteOp("list_kages", {}), false);
  assert.equal(isWriteOp("no_such_op", {}), true);
});

const doc = (): KageDoc => sampleKage({ id: "plan-me" });
const owner = { principal: "user:planner" }, anon = { principal: "anon" };

test("a plan is a read: it changes nothing in the store and a reader may run it", () => {
  const s = new Store({ workspace: "w" });
  s.grant(owner.principal, "r", ["read", "write", "publish", "admin"]);
  s.create("r", doc(), owner); s.publish("plan-me", owner, "public");
  const before = JSON.stringify(s.snapshot());
  for (const who of [owner, anon]) {
    const c = { store: s, author: who, adapter: "rest" as const };
    assert.ok(dispatch(c, "migrate_kage", { name: "plan-me" }).ok, "planning is a read, allowed even for a reader");
  }
  assert.equal(JSON.stringify(s.snapshot()), before, "planning is a read: the snapshot is byte-identical");
});

test("over REST a plan is allowed on GET and an apply is refused with 405", async () => {
  const s = new Store({ workspace: "w" });
  s.grant(owner.principal, "r", ["read", "write", "publish", "admin"]);
  s.create("r", doc(), owner);
  const c = { store: s, author: owner, adapter: "rest" as const };
  const get = (q: string) => handleRest(c, "migrate_kage", new Request(`http://x/api/migrate_kage?${q}`));
  assert.equal((await get("name=plan-me")).status, 200);
  assert.equal((await get("name=plan-me&apply=true")).status, 405);
});
