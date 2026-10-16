// The published contracts must reject malformed inputs before handlers run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatch, OPERATIONS } from "./operations.ts";
import { operationSchema, inputErrors } from "./input-schema.ts";
import { mcpTools } from "./surfaces.ts";
import { Store } from "../store/store.ts";

test("every operation publishes typed properties and the same executable schema", () => {
  const tools = mcpTools();
  for (const op of OPERATIONS) {
    const schema = operationSchema(op.name, op.params);
    assert.deepEqual(tools.find(t => t.name === op.name)!.inputSchema, schema);
    for (const value of Object.values(schema.properties!)) assert.ok(value.type || value.anyOf);
  }
});

test("nested critique errors have field pointers and do not mutate storage", () => {
  const store = new Store();
  const before = JSON.stringify(store.snapshot());
  const r = dispatch({ store, author: { principal: "a" } }, "save_critique", { kage: "k", fingerprint: "digest", scores: { 1: 8 }, priorities: [{ sev: "oops", title: "x", fix: "y" }] });
  assert.ok(!r.ok && r.error.code === "invalid_params");
  assert.match(JSON.stringify(r), /scores\/1/);
  assert.match(JSON.stringify(r), /priorities\/0\/sev/);
  assert.equal(JSON.stringify(store.snapshot()), before);
  assert.ok(inputErrors(operationSchema("get_context", ["full?"]), { full: "false" }).length);
  assert.deepEqual(inputErrors(operationSchema("get_context", ["full?"]), { full: undefined }), []);
});

test("read-only query strings decode typed values before dispatch validation", async () => {
  const { queryParams } = await import("./operations.ts");
  assert.deepEqual(queryParams("get_context", new URLSearchParams("full=false&kage=demo")), { full: false, kage: "demo" });
  assert.deepEqual(queryParams("get_kage", new URLSearchParams("version=2&name=k")), { version: 2, name: "k" });
});
