// The MCP HTTP handler must answer EVERY shape of input with a JSON-RPC reply and
// never throw — one malformed element in a batch must not take down the rest. These
// lock the error-mapping and the id/notification rules (the stdio transport shares
// the same leaf builders, so covering the message handler covers both).

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMcpMessage } from "./mcp.ts";

const exec = async () => ({ ok: true as const, data: { ok: true } });
const call = (msg: unknown) => handleMcpMessage(exec, msg as never) as Promise<any>;

test("handleMcpMessage: malformed shapes answer -32600 with null id, never throw", async () => {
  for (const bad of [null, 42, "x", []]) {
    const r = await call(bad);
    assert.equal(r.error.code, -32600);
    assert.equal(r.id, null);
  }
  // missing method on an object with an id is also an invalid request
  assert.equal((await call({ id: 1 })).error.code, -32600);
});

test("handleMcpMessage: notifications return null; id:0 is a real request", async () => {
  assert.equal(await call({ method: "notifications/initialized" }), null);
  assert.equal(await call({ method: "nope" }), null); // unknown notification ignored
  // id:0 must NOT be mistaken for a notification
  assert.deepEqual(await call({ id: 0, method: "ping" }), { jsonrpc: "2.0", id: 0, result: {} });
});

test("handleMcpMessage: error mapping (unknown method, missing params)", async () => {
  assert.equal((await call({ id: 1, method: "nope" })).error.code, -32601);
  assert.equal((await call({ id: 2, method: "tools/call", params: {} })).error.code, -32602);
  assert.equal((await call({ id: 3, method: "prompts/get", params: {} })).error.code, -32602);
  assert.equal((await call({ id: 4, method: "resources/read", params: {} })).error.code, -32602);
});

test("handleMcpMessage: initialize echoes a supported version, falls back for an unknown one", async () => {
  assert.equal((await call({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })).result.protocolVersion, "2025-06-18");
  assert.notEqual((await call({ id: 2, method: "initialize", params: { protocolVersion: "9999-99-99" } })).result.protocolVersion, "9999-99-99");
  assert.equal((await call({ id: 3, method: "tools/list" })).result.tools.length > 0, true);
});
