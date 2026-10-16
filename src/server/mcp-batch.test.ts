import { test } from "node:test";
import assert from "node:assert/strict";
import { runMcpBatch, MAX_MCP_BATCH } from "./mcp-batch.ts";

test("runMcpBatch runs messages one at a time, in order, so a batch of writes cannot race itself", async () => {
  let running = 0, peak = 0;
  const order: number[] = [];
  const handle = async (m: { id: number }) => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); order.push(m.id); running--; return m.id === 2 ? null : { id: m.id }; };
  const r = await runMcpBatch(Array.from({ length: 6 }, (_, id) => ({ id })), handle);
  assert.equal(peak, 1, "never two handlers at once");
  assert.deepEqual(order, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(r, { ok: true, replies: [{ id: 0 }, { id: 1 }, { id: 3 }, { id: 4 }, { id: 5 }] }, "notifications (null) are dropped");
});

test("runMcpBatch refuses a batch over the cap without running any message", async () => {
  let calls = 0;
  const r = await runMcpBatch(new Array(MAX_MCP_BATCH + 1).fill({}), async () => { calls++; return {}; });
  assert.equal(r.ok, false);
  assert.equal(calls, 0);
});
