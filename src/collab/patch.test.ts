// RFC 6902 patch safety. The security-critical property: a patch can never
// reach the prototype chain, in reads or writes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPatch } from "./patch.ts";

test("prototype keys in a pointer are refused, and nothing is polluted", () => {
  for (const path of ["/__proto__/polluted", "/constructor/polluted", "/a/__proto__/x"]) {
    assert.throws(() => applyPatch({ a: {} }, [{ op: "add", path, value: "yes" }]), /prototype|not found/i);
  }
  assert.equal(({} as Record<string, unknown>).polluted, undefined, "Object.prototype untouched");
});

test("traversal reads own properties only (no inherited keys)", () => {
  // `toString` lives on Object.prototype; a path through it must miss, not resolve.
  assert.throws(() => applyPatch({ a: {} }, [{ op: "replace", path: "/toString/x", value: 1 }]), /not found|prototype/i);
});

test("ordinary edits still work and the input is never mutated", () => {
  const doc = { blocks: { a: { props: { label: "x" } } } };
  const next = applyPatch(doc, [{ op: "replace", path: "/blocks/a/props/label", value: "y" }]);
  assert.equal((next as any).blocks.a.props.label, "y");
  assert.equal(doc.blocks.a.props.label, "x", "original untouched");
});
