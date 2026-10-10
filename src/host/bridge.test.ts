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
