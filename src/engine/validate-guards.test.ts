// F8 regression: validate() must reject documents that would throw or misrender,
// so the "a validated doc never throws in any renderer" invariant holds. The
// runtime is defensive too (evaluate never throws on a malformed operator).

import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "./validate.ts";
import { evaluate } from "./expr.ts";
import type { KageDoc } from "./types.ts";

const doc = (blocks: KageDoc["blocks"], root = Object.keys(blocks)[0]): KageDoc => ({
  kages: "1.0", id: "t", title: "T", system: "core@1", root, blocks,
});

test("malformed operator arguments are rejected with bad-expr", () => {
  const r = validate(doc({ t: { type: "text", props: { text: "x" }, visible: { $and: 1 } as never } }));
  assert.ok(r.errors.some((e) => e.code === "bad-expr"), "{$and:1} flagged");

  const r2 = validate(doc({ t: { type: "text", props: { text: "x" }, bind: { text: { $eq: ["a"] } as never } } }));
  assert.ok(r2.errors.some((e) => e.code === "bad-expr"), "{$eq:[a]} flagged");
});

test("the matching malformed expression no longer throws at eval", () => {
  assert.doesNotThrow(() => evaluate({ $and: 1 } as never, {}));
  assert.equal(evaluate({ $or: "nope" } as never, {}), false);
});

test("slot cycles are rejected", () => {
  const r = validate(doc({
    a: { type: "stack", slots: { children: ["b"] } },
    b: { type: "stack", slots: { children: ["a"] } },
  }, "a"));
  assert.ok(r.errors.some((e) => e.code === "slot-cycle"), "a↔b slot cycle flagged");
});

test("valid expressions and trees stay clean", () => {
  const r = validate(doc({
    s: { type: "stack", slots: { children: ["txt"] }, visible: { $and: [{ $eq: ["a", "a"] }, true] } as never },
    txt: { type: "text", props: { text: "ok" } },
  }, "s"));
  assert.ok(!r.errors.some((e) => e.code === "bad-expr" || e.code === "slot-cycle"), "no false positives");
});
