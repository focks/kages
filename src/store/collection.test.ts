import { test } from "node:test";
import assert from "node:assert/strict";
import { Collection, isCollectionError, type CollectionError } from "./collection.ts";
import { Store } from "./store.ts";
import legacy from "./__fixtures__/legacy-snapshot.json" with { type: "json" };
import type { StoreSnapshot } from "./store.ts";

interface Note { id: string; kage: string; text: string }
const make = (max?: number) => new Collection<Note>({ prefix: "n", max });
const must = <T>(x: T | CollectionError): T => { assert.ok(!isCollectionError(x)); return x as T; };

test("load tolerates undefined, empty and populated input", () => {
  const c = make();
  c.load(undefined); assert.deepEqual(c.all(), []);
  c.load([]); assert.deepEqual(c.all(), []);
  c.load([{ id: "n7", kage: "a", text: "x" }]);
  assert.equal(must(c.add({ kage: "a", text: "y" })).id, "n8"); // reseeded from the highest suffix
});

test("ids are not reused within a lifetime; a reload reseeds from the highest surviving id", () => {
  const c = make();
  must(c.add({ kage: "a", text: "1" }));
  const b = must(c.add({ kage: "a", text: "2" }));
  c.remove(b.id);
  assert.equal(must(c.add({ kage: "a", text: "3" })).id, "n3"); // n2 stays retired in this process
  // Across a reload only surviving rows are known, so the counter restarts above
  // the highest of THOSE; callers needing stronger guarantees must not delete the newest row.
  const d = make(); d.load(c.dump());
  assert.equal(must(d.add({ kage: "a", text: "4" })).id, "n4");
});

test("max returns a typed error and leaves existing rows intact", () => {
  const c = make(2);
  must(c.add({ kage: "a", text: "1" })); must(c.add({ kage: "a", text: "2" }));
  const r = c.add({ kage: "a", text: "3" });
  assert.ok(isCollectionError(r));
  assert.equal(c.all().length, 2);
});

test("dump returns copies; update cannot change the id; rows are JSON-safe", () => {
  const c = make();
  const a = must(c.add({ kage: "a", text: "1" }));
  const dump = c.dump(); dump[0].text = "mutated";
  assert.equal(c.get(a.id)!.text, "1");
  const u = c.update(a.id, { text: "2", id: "hacked" } as Partial<Note>)!;
  assert.equal(u.id, a.id);
  assert.deepEqual(JSON.parse(JSON.stringify(c.dump())), c.dump());
});

test("purgeWhere removes by predicate and reports the count", () => {
  const c = make();
  must(c.add({ kage: "a", text: "1" })); must(c.add({ kage: "b", text: "2" })); must(c.add({ kage: "a", text: "3" }));
  assert.equal(c.purgeWhere((r) => r.kage === "a"), 2);
  assert.deepEqual(c.all().map((r) => r.kage), ["b"]);
});

// The regression fixture every later collection plan reuses: a snapshot written
// before briefs/critiques existed must keep restoring and re-snapshotting.
test("a legacy snapshot restores and round-trips, gaining only empty new collections", () => {
  const snap = legacy as unknown as StoreSnapshot;
  const again = JSON.parse(JSON.stringify(Store.restore(JSON.parse(JSON.stringify(snap))).snapshot())) as Record<string, unknown>;
  // A collection added after the fixture was captured appears as an empty list;
  // anything else differing means restore lost or altered legacy data.
  for (const k of Object.keys(again)) if (!(k in snap) && Array.isArray(again[k]) && (again[k] as unknown[]).length === 0) delete again[k];
  assert.deepEqual(again, JSON.parse(JSON.stringify(snap)));
});

test("persisting the high-water mark retires deleted ids across reloads", () => {
  const c = make();
  must(c.add({ kage: "a", text: "first" }));
  const last = must(c.add({ kage: "a", text: "deleted" }));
  c.remove(last.id);
  const restored = make(); restored.load(c.dump(), c.sequence);
  assert.equal(must(restored.add({ kage: "a", text: "new" })).id, "n3");
});
