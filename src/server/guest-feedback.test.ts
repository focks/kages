import { test } from "node:test";
import assert from "node:assert/strict";
import { submitGuestFeedback, readBodyCapped, MAX_BODY, type FeedbackDeps } from "./guest-feedback.ts";
import { Store } from "../store/store.ts";
import { sampleKage } from "../test-support/fixtures.ts";

const owner = { principal: "user:o" };
function shared() {
  const s = new Store({ workspace: "w" });
  s.grant(owner.principal, "r", ["read", "write", "publish", "admin"]);
  s.create("r", sampleKage({ id: "k" }), owner); s.publish("k", owner, "link");
  return { s, uuid: (s.head("k") as { uuid: string }).uuid };
}
const body = (o: unknown) => JSON.stringify(o);

test("a committed comment is acknowledged with its id", async () => {
  const { s, uuid } = shared();
  const deps: FeedbackDeps = { findWorkspace: async () => "w", mutate: async (_w, apply) => apply(s).result };
  const r = await submitGuestFeedback(deps, uuid, body({ name: "Ann", text: "hi" }));
  assert.deepEqual([r.status, (r.body as { ok: boolean }).ok], [201, true]);
  assert.equal(s.comments.all("k").length, 1);
});

test("a save that never committed is not acknowledged: lost races report 503, never an id", async () => {
  const { s, uuid } = shared();
  // The in-memory attempt succeeded, but the store reports the commit lost every race.
  const deps: FeedbackDeps = { findWorkspace: async () => "w", mutate: async (_w, apply) => { apply(s); return { ok: false, error: { code: "conflict", msg: "workspace changed concurrently; please retry" } }; } };
  const r = await submitGuestFeedback(deps, uuid, body({ name: "Ann", text: "hi" }));
  assert.equal(r.status, 503);
  assert.equal((r.body as { error: { code: string } }).error.code, "conflict");
  assert.ok(!JSON.stringify(r.body).includes('"id"'));
});

test("refusals map to the right status; storage failures are a 503, not a stack trace", async () => {
  const { s, uuid } = shared();
  const ok: FeedbackDeps = { findWorkspace: async () => "w", mutate: async (_w, apply) => apply(s).result };
  assert.equal((await submitGuestFeedback(ok, uuid, body({ name: "", text: "x" }))).status, 400);
  assert.equal((await submitGuestFeedback(ok, uuid, "not json")).status, 400);
  assert.equal((await submitGuestFeedback(ok, uuid, body({ name: "a", text: "x", block: "ghost" }))).status, 400);
  assert.equal((await submitGuestFeedback(ok, "nope", body({ name: "a", text: "x" }))).status, 404);
  assert.equal((await submitGuestFeedback({ ...ok, findWorkspace: async () => null }, uuid, body({ name: "a", text: "x" }))).status, 404);
  assert.equal((await submitGuestFeedback(ok, uuid, "x".repeat(MAX_BODY + 1))).status, 413);
  assert.equal((await submitGuestFeedback(ok, uuid, "", MAX_BODY + 1)).status, 413);
  const boom: FeedbackDeps = { findWorkspace: async () => "w", mutate: async () => { throw new Error("db down"); } };
  const realErr = console.error; console.error = () => {};
  try { const r = await submitGuestFeedback(boom, uuid, body({ name: "a", text: "x" })); assert.equal(r.status, 503); assert.ok(!JSON.stringify(r.body).includes("db down")); } finally { console.error = realErr; }
});

test("readBodyCapped stops reading at the limit when the request has no Content-Length", async () => {
  let pulled = 0;
  const chunk = new TextEncoder().encode("x".repeat(4096));
  // A chunked upload: no length is declared, and the source would happily send 1 GB.
  const stream = new ReadableStream<Uint8Array>({ pull(c) { pulled += chunk.length; c.enqueue(chunk); if (pulled > 1e9) c.close(); } }, { highWaterMark: 0 });
  const req = new Request("http://x/feedback", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  assert.equal(req.headers.get("content-length"), null);
  const r = await readBodyCapped(req, MAX_BODY);
  assert.equal(r.tooLarge, true);
  assert.ok(pulled <= MAX_BODY + 4096 * 4, `read ${pulled} bytes from the stream`);
  const small = await readBodyCapped(new Request("http://x", { method: "POST", body: '{"a":1}' }), MAX_BODY);
  assert.deepEqual(small, { text: '{"a":1}', tooLarge: false });
  const empty = await readBodyCapped(new Request("http://x", { method: "POST" }), MAX_BODY);
  assert.deepEqual(empty, { text: "", tooLarge: false });
});

test("a pin travels as x and y fractions with the block; a half pin is refused", async () => {
  const { s, uuid } = shared();
  const deps: FeedbackDeps = { findWorkspace: async () => "w", mutate: async (_w, apply) => apply(s).result };
  const ok = await submitGuestFeedback(deps, uuid, body({ name: "Ann", text: "here", block: "root", x: 0.1, y: 0.9 }));
  assert.equal(ok.status, 201);
  assert.deepEqual(s.comments.all("k")[0].pos, { x: 0.1, y: 0.9 });
  assert.equal((await submitGuestFeedback(deps, uuid, body({ name: "Ann", text: "x", block: "root", x: 0.1 }))).status, 400, "y is missing");
  assert.equal((await submitGuestFeedback(deps, uuid, body({ name: "Ann", text: "x", block: "root", x: "abc", y: 1 }))).status, 400);
});
