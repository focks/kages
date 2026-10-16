// Signatures must distinguish every JSON-owned key, including prototype-looking keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalize, digest } from "./crypto.ts";

test("canonicalization preserves __proto__ as data and remains key-order independent", () => {
  const hostile = JSON.parse('{"__proto__":{"x":1},"a":2}');
  assert.notEqual(digest(hostile), digest({ a: 2 }));
  assert.deepEqual(JSON.parse(canonicalize(hostile)), hostile);
  assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
  assert.equal(({} as Record<string, unknown>).x, undefined);
});
