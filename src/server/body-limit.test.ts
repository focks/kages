import { test } from "node:test";
import assert from "node:assert/strict";
import { readJsonCapped } from "./body-limit.ts";

// A declared length past the cap is refused without reading a byte; an undeclared (chunked)
// body is cut off while streaming. Either way the server never buffers a multi-GB upload.
test("readJsonCapped refuses oversized bodies, declared or streamed, and parses the rest", async () => {
  const declared = new Request("http://x", { method: "POST", body: "{}", headers: { "content-length": "999999999" } });
  assert.deepEqual(await readJsonCapped(declared, 1000), { tooLarge: true });

  let pulled = 0;
  const chunk = new TextEncoder().encode("x".repeat(4096));
  const stream = new ReadableStream<Uint8Array>({ pull(c) { pulled += chunk.length; c.enqueue(chunk); } }, { highWaterMark: 0 });
  const chunked = new Request("http://x", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  assert.deepEqual(await readJsonCapped(chunked, 10_000), { tooLarge: true });
  assert.ok(pulled <= 10_000 + 4096 * 4, `read ${pulled} bytes`);

  assert.deepEqual(await readJsonCapped(new Request("http://x", { method: "POST", body: '{"a":1}' }), 1000), { tooLarge: false, value: { a: 1 } });
  assert.deepEqual(await readJsonCapped(new Request("http://x", { method: "POST", body: "not json" }), 1000), { tooLarge: false, value: undefined });
});
