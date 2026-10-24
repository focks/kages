// An unavailable REST backend must never look like an absent workspace. The REST
// path calls the same SQL functions as the pg path, through PostgREST rpc.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store/store.ts";
const previous = { base: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, db: process.env.DATABASE_URL };
process.env.SUPABASE_URL = "https://storage.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
delete process.env.DATABASE_URL;
const { loadSnapshotRev, casSave } = await import("./persistence.ts");
const { getPublicShare } = await import("./public-shares.ts");
const original = globalThis.fetch;
after(() => {
  globalThis.fetch = original;
  for (const [k, v] of [["SUPABASE_URL", previous.base], ["SUPABASE_SERVICE_ROLE_KEY", previous.key], ["DATABASE_URL", previous.db]]) if (v === undefined) delete process.env[k!]; else process.env[k!] = v;
});

test("REST distinguishes absence, conflicts, transport failures and service errors", async () => {
  const snapshot = new Store().snapshot();
  globalThis.fetch = async () => Response.json(null); // kages_load: no such workspace
  assert.equal(await loadSnapshotRev("w"), null);
  globalThis.fetch = async () => new Response(null, { status: 503 });
  await assert.rejects(loadSnapshotRev("w"), /storage unavailable/);
  await assert.rejects(casSave("w", snapshot, null), /storage unavailable/);
  await assert.rejects(casSave("w", snapshot, 1), /storage unavailable/);
  globalThis.fetch = async () => { throw new Error("connection reset"); };
  await assert.rejects(loadSnapshotRev("w"), /storage unavailable/);
  globalThis.fetch = async () => Response.json(false); // kages_save: revision moved
  assert.equal(await casSave("w", snapshot, null), false);
  assert.equal(await casSave("w", snapshot, 3), false);
});

test("REST share reads resolve committed heads through rpc and bypass caches", async () => {
  const store = new Store(); const author = { principal: "a" };
  assert.ok(store.create("r", { kages: "1.0", id: "k", title: "K", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "Hi" } } } }, author).ok);
  assert.ok(store.publish("k", author, "link").ok);
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /rpc\/kages_public_head$/);
    assert.equal(init?.cache, "no-store");
    const head = store.head("k")!;
    return Response.json({ workspace: store.workspace, record: head });
  };
  assert.equal((await getPublicShare(store.head("k")!.uuid))?.title, "K");
  // The caller re-checks state/visibility: a head the SQL filter would have
  // excluded (e.g. returned by a stale replica) must still read as absent.
  store.unpublish("k", author);
  assert.equal(await getPublicShare(store.head("k")!.uuid), null);
});

test("every REST call carries an abort signal so a hung PostgREST cannot hold a request forever", async () => {
  const snapshot = new Store().snapshot();
  const seen: (AbortSignal | null | undefined)[] = [];
  globalThis.fetch = async (_url, init) => { seen.push(init?.signal); return Response.json(null); };
  await loadSnapshotRev("w");
  await casSave("w", snapshot, null);
  await casSave("w", snapshot, 1);
  await getPublicShare("u");
  assert.equal(seen.length, 4);
  seen.forEach((s, i) => assert.ok(s instanceof AbortSignal, `call ${i} had no signal`));
});
