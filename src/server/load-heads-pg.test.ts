// The heads-only read must agree with the full load on everything a list or a latest-version
// fetch can see. Needs a disposable Postgres with migrations applied.
import { test, after } from "node:test";
import { closePool } from "./pg.ts";
import assert from "node:assert/strict";
import { Store } from "../store/store.ts";
import { dispatch } from "../adapters/operations.ts";
import { casSave, baselineOf, headsSuffice, loadHeadsSnapshot, loadSnapshotRev } from "./persistence.ts";

const url = process.env.KAGES_TEST_DATABASE_URL;
after(async () => { if (url) await closePool(); });
const doc = { kages: "1.0", id: "heads", title: "One", system: "core@1", root: "r", blocks: { r: { type: "text", props: { text: "x" } } } };

test("only latest-version reads use the heads path", () => {
  for (const op of ["list_kages", "search_kages", "get_kage"]) assert.ok(headsSuffice(op, {}), op);
  assert.equal(headsSuffice("get_kage", { version: 1 }), false);
  assert.equal(headsSuffice("list_versions", {}), false);
});

test("a nameless legacy entry is dropped on restore and refused on save", { skip: !url }, async () => {
  const snap = new Store({ workspace: "w" }).snapshot();
  assert.deepEqual(Store.restore({ ...snap, kages: [{ versions: [] } as never] }).list(), []);
  process.env.DATABASE_URL = url;
  await assert.rejects(casSave("nameless-ws", { ...snap, kages: [{ versions: [] } as never] }, null), /no name/);
});

test("heads load matches the full load at the latest version", { skip: !url, timeout: 30000 }, async () => {
  process.env.DATABASE_URL = url;
  const ws = "heads-" + Date.now(), author = { principal: "alice" };
  const store = new Store({ workspace: ws });
  assert.ok(store.create("kages", doc as never, author).ok);
  assert.ok(store.patch("heads", [{ op: "replace", path: "/title", value: "Two" }], author).ok);
  assert.equal(await casSave(ws, store.snapshot(), null), true);

  const full = await loadSnapshotRev(ws), heads = await loadHeadsSnapshot(ws);
  assert.equal(full!.snapshot.kages[0].versions.length, 2);
  assert.equal(heads!.kages[0].versions.length, 1);
  const ctx = (s: Store) => ({ store: s, author });
  const a = dispatch(ctx(Store.restore(full!.snapshot)), "list_kages", {}), b = dispatch(ctx(Store.restore(heads!)), "list_kages", {});
  assert.deepEqual(a, b);
  const got = dispatch(ctx(Store.restore(heads!)), "get_kage", { name: "heads" });
  assert.ok(got.ok && (got.data as { title: string }).title === "Two");
  assert.equal(baselineOf(full!.snapshot).get("heads")?.n, 2);
});
