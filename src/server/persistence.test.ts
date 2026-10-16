// Postgres persistence: compare-and-swap semantics and the public-share
// registry against a real database. Skipped unless KAGES_TEST_DATABASE_URL is
// set (run `DATABASE_URL=<url> npm run db:setup` first), so the default
// `npm test` stays hermetic. Never point this at a database you care about: it
// deletes the rows it uses.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { loadSnapshotRev, saveSnapshot, casSave } from "./persistence.ts";
import { putPublicShare, getPublicShare, getPublicShareWorkspace, delPublicShare } from "./public-shares.ts";
import { closePool, pool } from "./pg.ts";
import { Store } from "../store/store.ts";
import type { KageDoc } from "../engine/types.ts";

const url = process.env.KAGES_TEST_DATABASE_URL;
const skip = url ? false : "KAGES_TEST_DATABASE_URL not set";
const WS = "test-ws-" + process.pid;
const snap = (title: string) => { const s = new Store({ workspace: WS }); (s as any).__marker = title; return { ...s.snapshot(), marker: title } as any; };

before(() => { if (url) process.env.DATABASE_URL = url; });
after(async () => {
  if (url) { await pool().query("delete from kages_state where id like 'test-ws-%'"); await pool().query("delete from public_shares where uuid like 'test-%'"); }
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

test("inserting over an existing row is a conflict, and a new row starts at revision 1", { skip }, async () => {
  assert.equal(await casSave(WS, snap("dup"), null), false, "another instance created it first");
  const other = WS + "-new";
  assert.equal(await casSave(other, snap("fresh"), null), true);
  assert.equal((await loadSnapshotRev(other))?.rev, 1);
});

test("a legacy row without _rev is revision 0 and is updated by an expectedRev of 0", { skip }, async () => {
  const legacy = WS + "-legacy";
  await pool().query("insert into kages_state (id, snapshot) values ($1, $2::jsonb)", [legacy, JSON.stringify({ marker: "old" })]);
  assert.equal((await loadSnapshotRev(legacy))?.rev, 0);
  assert.equal(await casSave(legacy, snap("new"), 5), false, "wrong rev refused");
  assert.equal(await casSave(legacy, snap("new"), 0), true);
  assert.equal((await loadSnapshotRev(legacy))?.rev, 1);
});

test("concurrent writers from the same revision: exactly one wins", { skip }, async () => {
  const ws = WS + "-race"; await saveSnapshot(ws, snap("base"));
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => casSave(ws, snap("w" + i), 1)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await loadSnapshotRev(ws))?.rev, 2);
});

test("a full store snapshot survives a round trip through jsonb", { skip }, async () => {
  const ws = WS + "-store"; const store = new Store({ workspace: ws });
  const doc: KageDoc = { kages: "1.0", id: "k", title: "Café — 日本語", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "héllo 🌍" } } } };
  store.grant("agent:a", "r", ["write", "publish", "review", "admin"]);
  assert.ok(store.create("r", doc, { principal: "agent:a" }).ok);
  await saveSnapshot(ws, store.snapshot());
  const back = Store.restore((await loadSnapshotRev(ws))!.snapshot);
  assert.equal(back.head("k")?.doc.title, "Café — 日本語");
  assert.equal(back.head("k")?.digest, store.head("k")?.digest);
});

test("public links use committed heads, ignoring stale or resurrected mirrors", { skip }, async () => {
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
  await putPublicShare(uuid, doc); // a delayed older publish finishes after revocation
  assert.equal(await getPublicShare(uuid), null);
  await delPublicShare(uuid);
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
  const other = Store.restore(loaded.snapshot);
  other.patch("k", [{ op: "replace", path: "/title", value: "After" }], author);
  assert.ok(await casSave(ws, other.snapshot(), loaded.rev));
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

test("a public link read transfers the head Kage, not the whole workspace snapshot", { skip }, async () => {
  const ws = WS + "-payload";
  const store = new Store({ workspace: ws });
  const author = { principal: "agent:a" };
  const doc: KageDoc = { kages: "1.0", id: "small", title: "Small", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "hello" } } } };
  assert.ok(store.create("r", doc, author).ok);
  assert.ok(store.publish("small", author, "link").ok);
  // History, comments and audit live in the same row; stand in for them with 300 KB of unrelated data.
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
