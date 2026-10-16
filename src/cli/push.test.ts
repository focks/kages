import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { push, replaceOps, httpCall, type Call } from "./push-cmd.ts";
import { runCli } from "../test-support/cli.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** A fake server holding Kages by name, speaking the same ok/error shape as the REST route. */
function fake() {
  const kages = new Map<string, Record<string, unknown>>(), calls: string[] = [], published = new Map<string, string>();
  const call: Call = async (op, p) => {
    calls.push(op);
    if (op === "get_kage") { const k = kages.get(String(p.name)); return k ? { ok: true, data: k } : { ok: false, code: "not_found", msg: "no" }; }
    if (op === "create_kage") { const d = p.doc as Record<string, unknown>; kages.set(String(d.id), { ...d, resolved: { stamp: 1 } }); return { ok: true, data: {} }; }
    if (op === "patch_kage") { const k = kages.get(String(p.name))!; for (const o of p.ops as { op: string; path: string; value: unknown }[]) { if (o.op === "remove") delete k[o.path.slice(1)]; else k[o.path.slice(1)] = o.value; } return { ok: true, data: {} }; }
    if (op === "publish_kage") { if (published.has(String(p.name))) return { ok: false, code: "bad_state", msg: "cannot go published -> published" }; published.set(String(p.name), String(p.visibility)); return { ok: true, data: {} }; }
    if (op === "share_kage") { published.set(String(p.name), String(p.visibility)); return { ok: true, data: {} }; }
    return { ok: false, code: "bad", msg: op };
  };
  return { kages, calls, call, published };
}

test("push creates, refuses to overwrite, replaces on request, and is idempotent", async () => {
  const f = fake(), doc = sampleKage({ id: "g" });
  let r = await push(doc, "http://s", f.call);
  assert.deepEqual([r.exit, r.lines[0], r.lines[1]], [0, "created 'g' on http://s", "http://s/artifacts?id=g"]);
  r = await push(doc, "http://s", f.call);
  assert.equal(r.exit, 1); assert.match(r.lines[0], /already exists.*--replace/);
  r = await push(doc, "http://s", f.call, { replace: true });
  assert.match(r.lines[0], /already up to date/);
  assert.ok(!f.calls.includes("patch_kage"), "nothing sent when nothing changed");
  const edited = { ...doc, title: "Changed" };
  r = await push(edited, "http://s/", f.call, { replace: true, publish: true });
  assert.deepEqual(r.lines.map((l) => l.replace(/\(link:.*\)/, "(link)")), ["updated 'g' on http://s/", "published (link)", "http://s/artifacts?id=g"]);
  assert.equal(f.kages.get("g")!.title, "Changed");
  assert.ok(f.calls.includes("publish_kage"));
});

test("replaceOps ignores key order, server stamps and the id; adds missing keys", () => {
  assert.deepEqual(replaceOps({ id: "a", resolved: 1, blocks: { x: { b: 1, a: 2 } } }, { id: "b", kages: "1.0", resolved: 2, blocks: { x: { a: 2, b: 1 } } }), []);
  assert.deepEqual(replaceOps({ blocks: {} }, { blocks: {}, state: { n: 1 } }), [{ op: "add", path: "/state", value: { n: 1 } }]);
});

test("replaceOps removes a field the local Kage dropped, so the server cannot keep a stale one", () => {
  assert.deepEqual(replaceOps({ id: "a", resolved: 1, brief: { mode: "read" }, blocks: {} }, { id: "a", blocks: {} }), [{ op: "remove", path: "/brief" }]);
});

test("push --replace drops a removed field instead of reporting up to date", async () => {
  const f = fake(), doc = sampleKage({ id: "g" });
  await push({ ...doc, brief: { mode: "read" } } as typeof doc, "http://s", f.call);
  const r = await push(doc, "http://s", f.call, { replace: true });
  assert.match(r.lines[0], /updated 'g'/); assert.ok(!("brief" in f.kages.get("g")!));
});

test("--publish still publishes an unchanged draft", async () => {
  const f = fake(), doc = sampleKage({ id: "g" });
  await push(doc, "http://s", f.call);
  const r = await push(doc, "http://s", f.call, { replace: true, publish: true });
  assert.match(r.lines[0], /already up to date/); assert.match(r.lines[1], /^published/); assert.equal(f.published.get("g"), "link");
});

test("an already published Kage gets the visibility that was asked for, and a refusal is reported, not hidden", async () => {
  const f = fake(), doc = sampleKage({ id: "g" });
  await push(doc, "http://s", f.call, { publish: true });
  let r = await push(doc, "http://s", f.call, { replace: true, publish: true });
  assert.ok(r.lines.includes("already published"), "no visibility asked for: nothing to change");
  assert.equal(f.published.get("g"), "link");
  r = await push(doc, "http://s", f.call, { replace: true, publish: true, visibility: "public" });
  assert.equal(r.exit, 0); assert.match(r.lines.join("\n"), /visibility is now public/); assert.equal(f.published.get("g"), "public");
  const refusing: Call = async (op, p) => op === "share_kage" ? { ok: false, code: "forbidden", msg: "no publish grant" } : f.call(op, p);
  r = await push(doc, "http://s", refusing, { replace: true, publish: true, visibility: "workspace" });
  assert.equal(r.exit, 1); assert.match(r.lines.join("\n"), /visibility was not changed.*forbidden/);
});

test("an unreachable server is a message, not a stack trace", async () => {
  const r = await push(sampleKage(), "http://127.0.0.1:1", httpCall("http://127.0.0.1:1"));
  assert.equal(r.exit, 1); assert.match(r.lines[0], /could not reach.*npm run dev/);
});

test("the CLI verb pushes to a real HTTP server and sends the bearer token only when given", async () => {
  const seen: { url: string; auth?: string; body: any }[] = [];
  const srv = createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      seen.push({ url: req.url!, auth: req.headers.authorization, body: JSON.parse(b || "{}") });
      res.setHeader("content-type", "application/json");
      if (req.url!.endsWith("get_kage")) { res.statusCode = 404; res.end(JSON.stringify({ error: { code: "not_found", msg: "no" } })); } else res.end("{}");
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  try {
    const dir = tmpDir("kages-push-"), file = join(dir, "p.kage.json");
    writeFileSync(file, JSON.stringify(sampleKage({ id: "p" })));
    let r = await runCli(["push", file, "--server", url], { cwd: dir });
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, new RegExp(`created 'p' on ${url}\\n${url}/artifacts\\?id=p`));
    assert.deepEqual(seen.map((s) => s.url), ["/api/get_kage", "/api/create_kage"]);
    assert.equal(seen[1].auth, undefined);
    assert.equal(seen[1].body.doc.id, "p");
    r = await runCli(["push", file, "--server", url, "--token", "abc"], { cwd: dir });
    assert.equal(seen.at(-1)!.auth, "Bearer abc");
    r = await runCli(["push"], { cwd: dir });
    assert.notEqual(r.code, 0);
  } finally { srv.close(); }
});
