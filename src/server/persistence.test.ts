// Postgres persistence: compare-and-swap semantics and the public-share
// registry against a real database. Skipped unless KAGES_TEST_DATABASE_URL is
// set (run `DATABASE_URL=<url> npm run db:setup` first), so the default
// `npm test` stays hermetic. Never point this at a database you care about: it
// deletes the rows it uses.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { loadSnapshotRev, saveSnapshot, casSave } from "./persistence.ts";
import { putPublicShare, getPublicShare, delPublicShare } from "./public-shares.ts";
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

test("public share registry: put, get, overwrite, delete", { skip }, async () => {
  const d = (t: string): KageDoc => ({ kages: "1.0", id: "p", title: t, system: "core@1", root: "t", blocks: { t: { type: "text" } } });
  assert.equal(await getPublicShare("test-none"), null);
  await putPublicShare("test-1", d("one")); assert.equal((await getPublicShare("test-1"))?.title, "one");
  await putPublicShare("test-1", d("two")); assert.equal((await getPublicShare("test-1"))?.title, "two");
  await delPublicShare("test-1"); assert.equal(await getPublicShare("test-1"), null);
});
