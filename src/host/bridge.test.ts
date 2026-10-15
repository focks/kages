// Host-bridge capability gates, from oracle/runtime-security.feature. Each test
// pins a security boundary: storage scope, ask permission + billing, agent
// registration, connector approval, fetch allowlist, viewer minimalism, emit
// rate limit.

import { test } from "node:test";
import assert from "node:assert/strict";
import { HostBridge } from "./bridge.ts";
import type { KageDoc } from "../engine/types.ts";

const doc = (over: Partial<KageDoc> = {}): KageDoc => ({
  kages: "1.0", id: "k", title: "K", system: "core@1", root: "a", blocks: { a: { type: "shell" } },
  persist: { region: "personal", approvals: "shared" },
  sources: { orders: { from: "url", url: "https://api.shop.com/orders" } as any, evil: { from: "url", url: "https://evil.com/x" } as any },
  ...over,
});

test("storage: only persist keys, in their scope; shared warns", () => {
  const b = new HostBridge(doc());
  assert.equal(b.storageSet("transient", 1).ok, false, "non-persist key refused");
  assert.equal(b.storageSet("region", "west").ok, true);
  assert.equal(b.storageGet("region").value, "west");
  const shared = b.storageSet("approvals", ["ok"]);
  assert.ok(shared.ok);
  assert.match(shared.notice ?? "", /visible to everyone/);
});

test("ask: refused until first-use permission; then billed to the configured payer", async () => {
  const b = new HostBridge(doc(), { billing: "workspace", model: async () => "summary" });
  assert.equal((await b.ask("hi")).ok, false, "needs permission first");
  b.permitAsk();
  const r = await b.ask("hi");
  assert.ok(r.ok);
  assert.equal(r.value, "summary");
  assert.match(r.notice ?? "", /billed to: workspace/);
});

test("agent: only registered agents can be invoked, with the host's runner", async () => {
  const b = new HostBridge(doc(), { registeredAgents: ["acme/fulfilment"], agent: async (_id, input) => ({ got: input }) });
  assert.equal((await b.invokeAgent("acme/rogue", {})).ok, false);
  const r = await b.invokeAgent("acme/fulfilment", { n: 1 });
  assert.deepEqual(r.value, { got: { n: 1 } });
});

test("connectors need viewer approval", () => {
  const b = new HostBridge(doc(), { approvedConnectors: ["shopify"] });
  assert.ok(b.connectorCall("shopify").ok);
  assert.equal(b.connectorCall("stripe").ok, false);
});

test("fetch: only declared sources, only allowlisted URLs", () => {
  const b = new HostBridge(doc(), { fetchAllowlist: ["https://api.shop.com/"] });
  assert.ok(b.fetch("orders").ok, "declared + allowlisted");
  assert.equal(b.fetch("missing").ok, false, "undeclared source");
  assert.equal(b.fetch("evil").ok, false, "declared but off-allowlist");
});

test("viewer profile exposes name + avatar only, and only if offered", () => {
  assert.equal(new HostBridge(doc()).viewerProfile().ok, false);
  const b = new HostBridge(doc(), { viewer: { name: "Ada", avatar: "a.png" } });
  assert.deepEqual(b.viewerProfile().value, { name: "Ada", avatar: "a.png" });
});

test("emit is rate-limited", () => {
  const b = new HostBridge(doc(), { emitLimit: 2 });
  assert.ok(b.emit("x", {}).ok);
  assert.ok(b.emit("x", {}).ok);
  assert.equal(b.emit("x", {}).ok, false);
});

// --- live data: load() adds network hardening on top of the fetch gates -------

const reply = (body: string, type = "application/json", status = 200) => async () => ({ ok: status < 400, status, headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? type : null) }, text: async () => body });
const live = (fetcher: any, source: Record<string, unknown> = {}, cfg: Record<string, unknown> = {}) =>
  new HostBridge(doc({ sources: { s: { from: "url", url: "https://api.shop.com/orders", ...source } as any } }), { fetchAllowlist: ["https://api.shop.com/"], fetcher, ...cfg });

test("load: returns parsed JSON from a declared, allowlisted https source", async () => {
  const r = await live(reply('{"data":{"items":[1,2,3]}}'), { path: "data.items" }).load("s");
  assert.deepEqual(r.value, [1, 2, 3]);
});

test("load: undeclared or off-allowlist sources never reach the network", async () => {
  let calls = 0;
  const f = async () => { calls++; return reply("{}")(); };
  assert.equal((await live(f).load("nope")).error?.code, "unknown_source");
  assert.equal((await new HostBridge(doc(), { fetchAllowlist: ["https://api.shop.com/"], fetcher: f as any }).load("evil")).error?.code, "not_allowlisted");
  assert.equal((await new HostBridge(doc(), { fetcher: f as any }).load("orders")).error?.code, "not_allowlisted", "empty allowlist denies everything");
  assert.equal(calls, 0);
});

test("load: refuses insecure, credentialed and private targets", async () => {
  const f = async () => reply("{}")();
  for (const [url, code] of [["http://api.shop.com/x", "insecure_url"], ["https://u:p@api.shop.com/x", "bad_url"], ["https://127.0.0.1/x", "private_host"], ["https://192.168.1.5/x", "private_host"], ["https://169.254.169.254/x", "private_host"], ["https://localhost/x", "private_host"], ["https://[::1]/x", "private_host"], ["not a url", "bad_url"]] as const) {
    const b = new HostBridge(doc({ sources: { s: { from: "url", url } as any } }), { fetchAllowlist: ["https://", "http://", "not"], fetcher: f as any });
    assert.equal((await b.load("s")).error?.code, code, url);
  }
});

test("load: request carries no credentials, follows no redirects, asks for JSON only", async () => {
  let seen: any;
  await live(async (_u: string, init: any) => { seen = init; return reply("{}")(); }).load("s");
  assert.equal(seen.method, "GET"); assert.equal(seen.credentials, "omit"); assert.equal(seen.redirect, "error"); assert.deepEqual(seen.headers, { accept: "application/json" });
});

test("load: rejects non-JSON, errors, oversized bodies and hangs without throwing", async () => {
  assert.equal((await live(reply("<html>", "text/html")).load("s")).error?.code, "not_json");
  assert.equal((await live(reply("{}", "application/json", 500)).load("s")).error?.code, "http_error");
  assert.equal((await live(reply("x".repeat(50))).load("s")).error?.code, "load_failed", "invalid JSON");
  assert.equal((await live(reply('"' + "x".repeat(50) + '"'), {}, { fetchMaxBytes: 10 }).load("s")).error?.code, "too_large");
  assert.equal((await live(() => { throw new Error("boom"); }).load("s")).error?.code, "load_failed");
  const hang = (_u: string, init: any) => new Promise((_r, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("x"), { name: "AbortError" }))));
  assert.equal((await live(hang, {}, { fetchTimeoutMs: 20 }).load("s")).error?.code, "timeout");
});

test("load: strips prototype keys, bounds arrays and tolerates a missing path", async () => {
  const body = '{"__proto__":{"polluted":true},"constructor":1,"rows":[1,2,3,4,5],"ok":{"__proto__":2,"v":1}}';
  const r = await live(reply(body), {}, {}).load("s");
  const v = r.value as any;
  assert.equal(Object.prototype.hasOwnProperty.call(v, "__proto__"), false); assert.equal(({} as any).polluted, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(v, "constructor"), false); assert.deepEqual(v.ok, { v: 1 });
  assert.deepEqual(((await live(reply(body), { maxItems: 2 }).load("s")).value as any).rows, [1, 2]);
  assert.equal((await live(reply(body), { path: "nope.deeper" }).load("s")).value, null);
});
