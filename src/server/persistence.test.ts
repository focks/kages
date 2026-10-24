// Postgres persistence: compare-and-swap semantics, delta writes and public-link
// reads against a real database with the normalized model. Skipped unless
// KAGES_TEST_DATABASE_URL is set (run `DATABASE_URL=<url> npm run db:setup`
// first), so the default `npm test` stays hermetic. Never point this at a
// database you care about: it deletes the rows it uses.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { loadSnapshotRev, saveSnapshot, casSave, baselineOf } from "./persistence.ts";
import { getPublicShare, getPublicShareWorkspace } from "./public-shares.ts";
import { closePool, pool } from "./pg.ts";
import { Store } from "../store/store.ts";
import type { KageDoc } from "../engine/types.ts";

const url = process.env.KAGES_TEST_DATABASE_URL;
const skip = url ? false : "KAGES_TEST_DATABASE_URL not set";
const WS = "test-ws-" + process.pid;
const snap = (title: string) => { const s = new Store({ workspace: WS }); (s as any).__marker = title; return { ...s.snapshot(), marker: title } as any; };

before(() => { if (url) process.env.DATABASE_URL = url; });
after(async () => {
  if (url) await pool().query("delete from workspaces where id like 'test-ws-%'"); // cascades to kages/kage_versions
  await closePool();
});

test("a missing workspace loads as null, then seeds at revision 1", { skip }, async () => {
  assert.equal(await loadSnapshotRev(WS), null);
  await saveSnapshot(WS, snap("seed"));
  const loaded = await loadSnapshotRev(WS);
  assert.equal(loaded?.rev, 1); assert.equal((loaded?.snapshot as any).marker, "seed");
});

test("casSave commits only against the revision the caller read", { skip }, async () => {
  assert.equal(await casSave(WS, snap("a"), 1), true, "matching rev commits");
  assert.equal((await loadSnapshotRev(WS))?.rev, 2);
  assert.equal(await casSave(WS, snap("stale"), 1), false, "a stale instance loses");
  assert.equal((await loadSnapshotRev(WS) as any).snapshot.marker, "a", "the stale write changed nothing");
  assert.equal(await casSave(WS, snap("b"), 2), true);
  assert.equal((await loadSnapshotRev(WS))?.rev, 3);
});

test("inserting over an existing workspace is a conflict, and a new one starts at revision 1", { skip }, async () => {
  assert.equal(await casSave(WS, snap("dup"), null), false, "another instance created it first");
  const other = WS + "-new";
  assert.equal(await casSave(other, snap("fresh"), null), true);
  assert.equal((await loadSnapshotRev(other))?.rev, 1);
});

test("concurrent writers from the same revision: exactly one wins", { skip }, async () => {
  const ws = WS + "-race"; await saveSnapshot(ws, snap("base"));
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => casSave(ws, snap("w" + i), 1)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await loadSnapshotRev(ws))?.rev, 2);
});

test("a full store snapshot survives a round trip through the normalized tables", { skip }, async () => {
  const ws = WS + "-store"; const store = new Store({ workspace: ws });
  const doc: KageDoc = { kages: "1.0", id: "k", title: "Café — 日本語", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "héllo 🌍" } } } };
  store.grant("agent:a", "r", ["write", "publish", "review", "admin"]);
  assert.ok(store.create("r", doc, { principal: "agent:a" }).ok);
  await saveSnapshot(ws, store.snapshot());
  const back = Store.restore((await loadSnapshotRev(ws))!.snapshot);
  assert.equal(back.head("k")?.doc.title, "Café — 日本語");
  assert.equal(back.head("k")?.digest, store.head("k")?.digest);
});

test("a delta write with a baseline appends only the new tail and round-trips", { skip }, async () => {
  const ws = WS + "-delta"; const store = new Store({ workspace: ws });
  const author = { principal: "agent:a" };
  const doc: KageDoc = { kages: "1.0", id: "k", title: "V1", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "one" } } } };
  assert.ok(store.create("r", doc, author).ok);
  await saveSnapshot(ws, store.snapshot());
  const loaded = (await loadSnapshotRev(ws))!;
  const baseline = baselineOf(loaded.snapshot);
  const next = Store.restore(loaded.snapshot);
  next.patch("k", [{ op: "replace", path: "/title", value: "V2" }], author);
  assert.ok(await casSave(ws, next.snapshot(), loaded.rev, baseline));
  const back = Store.restore((await loadSnapshotRev(ws))!.snapshot);
  assert.equal(back.head("k")?.doc.title, "V2");
  assert.equal(back.versions("k").length, 2, "both versions survive the delta write");
  const count = await pool().query("select count(*)::int as n from kage_versions where workspace_id = $1", [ws]);
  assert.equal(count.rows[0].n, 2);
});

test("an in-place head transition under a baseline persists (publish, then revoke)", { skip }, async () => {
  const ws = WS + "-transition"; const store = new Store({ workspace: ws });
  const author = { principal: "agent:a" };
  const doc: KageDoc = { kages: "1.0", id: "k", title: "K", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "x" } } } };
  assert.ok(store.create("r", doc, author).ok);
  await saveSnapshot(ws, store.snapshot());
  // publish mutates head.state/visibility in place — no version is appended.
  let loaded = (await loadSnapshotRev(ws))!;
  let baseline = baselineOf(loaded.snapshot);
  let next = Store.restore(loaded.snapshot);
  assert.ok(next.publish("k", author, "link").ok);
  assert.ok(await casSave(ws, next.snapshot(), loaded.rev, baseline));
  const uuid = next.head("k")!.uuid;
  assert.equal((await getPublicShare(uuid))?.title, "K", "the delta write carried the state change");
  loaded = (await loadSnapshotRev(ws))!;
  baseline = baselineOf(loaded.snapshot);
  next = Store.restore(loaded.snapshot);
  assert.ok(next.unpublish("k", author).ok);
  assert.ok(await casSave(ws, next.snapshot(), loaded.rev, baseline));
  assert.equal(await getPublicShare(uuid), null, "revocation persisted through the delta write");
});

test("a kage deleted under a baseline disappears from storage and cannot resurrect", { skip }, async () => {
  const ws = WS + "-del"; const store = new Store({ workspace: ws });
  const author = { principal: "agent:a" };
  assert.ok(store.create("r", { kages: "1.0", id: "k", title: "K", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "x" } } } }, author).ok);
  await saveSnapshot(ws, store.snapshot());
  const loaded = (await loadSnapshotRev(ws))!;
  const baseline = baselineOf(loaded.snapshot);
  const next = Store.restore(loaded.snapshot);
  assert.ok(next.remove("k", author).ok);
  assert.ok(await casSave(ws, next.snapshot(), loaded.rev, baseline));
  const back = Store.restore((await loadSnapshotRev(ws))!.snapshot);
  assert.equal(back.head("k"), undefined);
  const count = await pool().query("select count(*)::int as n from kage_versions where workspace_id = $1", [ws]);
  assert.equal(count.rows[0].n, 0);
});

test("public links use committed heads and die with revocation", { skip }, async () => {
  const ws = WS + "-shares";
  const store = new Store({ workspace: ws });
  const author = { principal: "agent:a" };
  const doc: KageDoc = { kages: "1.0", id: "share", title: "Public", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "hello" } } } };
  assert.ok(store.create("r", doc, author).ok);
  assert.ok(store.publish("share", author, "link").ok);
  await saveSnapshot(ws, store.snapshot());
  const uuid = store.head("share")!.uuid;
  assert.equal((await getPublicShare(uuid))?.title, "Public");
  assert.ok(store.unpublish("share", author).ok);
  assert.ok(await casSave(ws, store.snapshot(), 1));
  assert.equal(await getPublicShare(uuid), null, "the committed head is no longer open");
});

test("initialization cannot overwrite an existing workspace or reset its revision", { skip }, async () => {
  const ws = WS + "-seed";
  await saveSnapshot(ws, snap("first"));
  assert.ok(await casSave(ws, snap("user edit"), 1));
  await saveSnapshot(ws, snap("late seed"));
  const loaded = await loadSnapshotRev(ws);
  assert.equal(loaded?.rev, 2);
  assert.equal((loaded?.snapshot as any).marker, "user edit");
});

test("restoring the persistent store preserves active leases and their original expiry", { skip }, async () => {
  const ws = WS + "-leases";
  const s = new Store({ workspace: ws, clock: () => 1000 });
  s.claims.claim("k", ["t"], "agent:a", 60, 1000);
  await saveSnapshot(ws, s.snapshot());
  const restored = Store.restore((await loadSnapshotRev(ws))!.snapshot);
  assert.equal(restored.claims.canWrite("k", "t", "agent:b", 2000), false);
  assert.equal(restored.claims.canWrite("k", "t", "agent:b", 61000), true);
});

test("persistent reads observe another instance and storage errors never trigger seeding", { skip }, async () => {
  const { getStore } = await import("./store-instance.ts");
  const ws = WS + "-reads";
  const s = new Store({ workspace: ws });
  const author = { principal: "agent:a" };
  s.create("r", { kages: "1.0", id: "k", title: "Before", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "hello" } } } }, author);
  await saveSnapshot(ws, s.snapshot());
  const first = await getStore(ws);
  const loaded = (await loadSnapshotRev(ws))!;
  const baseline = baselineOf(loaded.snapshot);
  const other = Store.restore(loaded.snapshot);
  other.patch("k", [{ op: "replace", path: "/title", value: "After" }], author);
  assert.ok(await casSave(ws, other.snapshot(), loaded.rev, baseline));
  assert.equal(first.head("k")?.doc.title, "Before");
  assert.equal((await getStore(ws)).head("k")?.doc.title, "After");
  const db = pool(); const query = db.query;
  db.query = (() => { throw new Error("injected read outage"); }) as typeof db.query;
  try { await assert.rejects(getStore(ws), /storage unavailable/); }
  finally { db.query = query; }
  assert.equal((await getStore(ws)).head("k")?.doc.title, "After");
});

test("a lease committed by one executor blocks the next persistent writer", { skip }, async () => {
  const { mutateStore } = await import("./store-instance.ts");
  const { dispatch } = await import("../adapters/operations.ts");
  const ws = WS + "-executor";
  const store = new Store({ workspace: ws });
  const a = { principal: "agent:a" }, b = { principal: "agent:b" };
  assert.ok(store.create("r", { kages: "1.0", id: "k", title: "K", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "Hi" } } } }, a).ok);
  store.grant(b.principal, "r", ["write"]);
  await saveSnapshot(ws, store.snapshot());
  const claim = await mutateStore(ws, s => ({ result: dispatch({ store: s, author: a }, "claim_blocks", { kage: "k", blocks: ["t"] }) }));
  assert.ok(claim.ok);
  const patch = await mutateStore(ws, s => ({ result: dispatch({ store: s, author: b }, "patch_kage", { name: "k", ops: [{ op: "replace", path: "/blocks/t/props/text", value: "Conflict" }] }) }));
  assert.ok(!patch.ok && patch.error.code === "claimed");
  assert.equal(Store.restore((await loadSnapshotRev(ws))!.snapshot).head("k")!.doc.blocks.t.props!.text, "Hi");
});

test("a public link read transfers the head Kage, not the whole workspace", { skip }, async () => {
  const ws = WS + "-payload";
  const store = new Store({ workspace: ws });
  const author = { principal: "agent:a" };
  const doc: KageDoc = { kages: "1.0", id: "small", title: "Small", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "hello" } } } };
  assert.ok(store.create("r", doc, author).ok);
  assert.ok(store.publish("small", author, "link").ok);
  // Comments, audit and events live in the meta blob; stand in for them with 300 KB of unrelated data.
  await saveSnapshot(ws, { ...store.snapshot(), history: "x".repeat(300_000) } as any);
  const uuid = store.head("small")!.uuid;
  const p = pool() as any, original = p.query.bind(p);
  let bytes = 0;
  p.query = async (...a: unknown[]) => { const r = await original(...a); bytes += JSON.stringify(r.rows).length; return r; };
  try {
    assert.equal((await getPublicShare(uuid))?.title, "Small");
    assert.equal(await getPublicShareWorkspace(uuid), ws);
    assert.equal(await getPublicShare("test-not-a-uuid"), null);
  } finally { p.query = original; }
  assert.ok(bytes < 20_000, `transferred ${bytes} bytes for two small public reads`);
});
