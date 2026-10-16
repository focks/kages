// An unavailable REST backend must never look like an absent workspace.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store/store.ts";
const previous = { base: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, db: process.env.DATABASE_URL };
process.env.SUPABASE_URL = "https://storage.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
delete process.env.DATABASE_URL;
const { loadSnapshotRev, casSave } = await import("./persistence.ts");
const { getPublicShare, putPublicShare, delPublicShare } = await import("./public-shares.ts");
const original = globalThis.fetch;
after(() => {
  globalThis.fetch = original;
  for (const [k, v] of [["SUPABASE_URL", previous.base], ["SUPABASE_SERVICE_ROLE_KEY", previous.key], ["DATABASE_URL", previous.db]]) if (v === undefined) delete process.env[k!]; else process.env[k!] = v;
});

test("REST distinguishes absence, conflicts, transport failures and service errors", async () => {
  const snapshot = new Store().snapshot();
  globalThis.fetch = async () => Response.json([]);
  assert.equal(await loadSnapshotRev("w"), null);
  globalThis.fetch = async () => new Response(null, { status: 503 });
  await assert.rejects(loadSnapshotRev("w"), /storage unavailable/);
  await assert.rejects(casSave("w", snapshot, null), /storage unavailable/);
  await assert.rejects(casSave("w", snapshot, 1), /storage unavailable/);
  globalThis.fetch = async () => { throw new Error("connection reset"); };
  await assert.rejects(loadSnapshotRev("w"), /storage unavailable/);
  globalThis.fetch = async () => new Response(null, { status: 409 });
  assert.equal(await casSave("w", snapshot, null), false);
});

test("REST share reads use the authoritative snapshot and bypass caches", async () => {
  const store = new Store(); const author = { principal: "a" };
  assert.ok(store.create("r", { kages: "1.0", id: "k", title: "K", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "Hi" } } } }, author).ok);
  assert.ok(store.publish("k", author, "link").ok);
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /kages_state\?snapshot=cs\./);
    assert.equal(init?.cache, "no-store");
    return Response.json([{ snapshot: store.snapshot() }]);
  };
  assert.equal((await getPublicShare(store.head("k")!.uuid))?.title, "K");
  store.unpublish("k", author);
  assert.equal(await getPublicShare(store.head("k")!.uuid), null);
});

test("every REST call carries an abort signal so a hung PostgREST cannot hold a request forever", async () => {
  const snapshot = new Store().snapshot();
  const seen: (AbortSignal | null | undefined)[] = [];
  globalThis.fetch = async (_url, init) => { seen.push(init?.signal); return Response.json([]); };
  await loadSnapshotRev("w");
  await casSave("w", snapshot, null);
  await casSave("w", snapshot, 1);
  await getPublicShare("u");
  await putPublicShare("u", snapshot as never);
  await delPublicShare("u");
  assert.equal(seen.length, 6);
  seen.forEach((s, i) => assert.ok(s instanceof AbortSignal, `call ${i} had no signal`));
});
