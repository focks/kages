// A hosted deploy without KAGES_SIGNING_KEY_SECRET took every read down: each read
// backfills missing examples, and saving that backfill must encrypt signer keys.
// Reads must serve the committed data; writes must say the server is misconfigured.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store/store.ts";
import { MisconfiguredError } from "../store/crypto.ts";
import { httpStatus } from "../adapters/rest.ts";
import { failureResult } from "./op-failure.ts";

const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "NODE_ENV", "KAGES_SIGNING_KEY_SECRET"] as const;
const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
const env = process.env as Record<string, string | undefined>;
env.SUPABASE_URL = "https://storage.invalid";
env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
delete env.DATABASE_URL;
delete env.KAGES_SIGNING_KEY_SECRET;
const { getStore, getHeadsStore, mutateStore } = await import("./store-instance.ts");
const original = globalThis.fetch;
after(() => {
  globalThis.fetch = original;
  for (const k of keys) if (previous[k] === undefined) delete env[k]; else env[k] = previous[k];
});

const author = { principal: "user:owner", runtime: { framework: "next", adapter: "rest" as const } };
const doc = (id: string) => ({ kages: "1.0", id, title: id, system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "Hi" } } } });

/** A workspace written before encryption: plaintext signer keys, no shipped examples. */
function legacyRow() {
  delete env.NODE_ENV;
  const store = new Store({ workspace: "ws-owner" });
  assert.ok(store.create("notes", doc("kept-note"), author).ok);
  const { kages, ...meta } = store.snapshot();
  env.NODE_ENV = "production";
  return { rev: 4, meta, kages };
}

/** PostgREST: loads answer with `row`; saves are counted and answered by `save`. */
function serve(row: unknown, save: () => Response) {
  const saves: string[] = [];
  globalThis.fetch = async (url) => {
    const fn = String(url).split("/rpc/")[1];
    if (fn === "kages_save") { saves.push(fn); return save(); }
    return Response.json(row);
  };
  return saves;
}

test("without the signing secret, reads serve stored data and a write reports a misconfiguration", async () => {
  const saves = serve(legacyRow(), () => Response.json(true));
  for (const load of [getStore, getHeadsStore]) {
    const store = await load("ws-owner");
    assert.ok(store.head("kept-note"), `${load.name} lost the stored Kage`);
    assert.equal(store.list().some((k: { name: string }) => k.name !== "kept-note"), false, `${load.name} served uncommitted examples`);
  }
  assert.equal(saves.length, 0, "an unencryptable backfill must never reach storage");

  const write = await mutateStore("ws-owner", (s) => ({ result: s.create("notes", doc("new-note"), author) as never })).then(() => null, (e) => e);
  assert.ok(write, "the write must not report success");
  const result = failureResult(write);
  assert.equal(!result.ok && result.error.code, "misconfigured");
  assert.doesNotMatch(JSON.stringify(result), /KAGES_SIGNING_KEY_SECRET/, "the setting's name stays in the server log");
  assert.equal(httpStatus("misconfigured"), 500);
});

test("an absent workspace is never served from an unsaved seed", async () => {
  delete env.KAGES_SIGNING_KEY_SECRET;
  env.NODE_ENV = "production";
  const saves = serve(null, () => Response.json(true));
  await assert.rejects(getStore("ws-new"), MisconfiguredError);
  assert.equal(saves.length, 0);
});

test("a storage outage while saving the backfill still serves the stored data", async () => {
  const row = legacyRow();
  env.KAGES_SIGNING_KEY_SECRET = "ab".repeat(32);
  const saves = serve(row, () => new Response(null, { status: 503 }));
  assert.ok((await getStore("ws-owner")).head("kept-note"));
  assert.ok(saves.length > 0, "the backfill was attempted");
  delete env.KAGES_SIGNING_KEY_SECRET;
});

test("a storage outage on load still fails, and reads as unavailable", async () => {
  globalThis.fetch = async () => new Response(null, { status: 503 });
  const e = await getStore("ws-owner").then(() => null, (err) => err);
  assert.ok(e);
  const result = failureResult(e);
  assert.equal(!result.ok && result.error.code, "unavailable");
});
