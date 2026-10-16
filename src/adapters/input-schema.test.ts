// The published contracts must reject malformed inputs before handlers run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPERATIONS } from "./operations.ts";
import { operationSchema, inputErrors } from "./input-schema.ts";
import { mcpTools } from "./surfaces.ts";

test("every operation publishes typed properties and the same executable schema", () => {
  const tools = mcpTools();
  for (const op of OPERATIONS) {
    const schema = operationSchema(op.name, op.params);
    assert.deepEqual(tools.find(t => t.name === op.name)!.inputSchema, schema);
    for (const value of Object.values(schema.properties!)) assert.ok(value.type || value.anyOf);
  }
});

test("input validation flags a bad typed value and accepts an omitted optional", () => {
  assert.ok(inputErrors(operationSchema("get_context", ["full?"]), { full: "false" }).length);
  assert.deepEqual(inputErrors(operationSchema("get_context", ["full?"]), { full: undefined }), []);
});

test("read-only query strings decode typed values before dispatch validation", async () => {
  const { queryParams } = await import("./operations.ts");
  assert.deepEqual(queryParams("get_context", new URLSearchParams("full=false&kage=demo")), { full: false, kage: "demo" });
  assert.deepEqual(queryParams("get_kage", new URLSearchParams("version=2&name=k")), { version: 2, name: "k" });
});
