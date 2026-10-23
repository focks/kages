import { test } from "node:test";
import assert from "node:assert/strict";
import { wheelPixels } from "./scroll.ts";

test("comment overlay preserves trackpad precision and normalizes line/page mouse wheels", () => {
  assert.deepEqual(wheelPixels({ deltaX: .5, deltaY: 2.25, deltaMode: 0 }, 600), { left: .5, top: 2.25 });
  assert.deepEqual(wheelPixels({ deltaX: -1, deltaY: 3, deltaMode: 1 }, 600), { left: -16, top: 48 });
  assert.deepEqual(wheelPixels({ deltaX: 0, deltaY: -1, deltaMode: 2 }, 600), { left: 0, top: -600 });
  assert.deepEqual(wheelPixels({ deltaX: NaN, deltaY: Infinity, deltaMode: 0 }, 600), { left: 0, top: 0 });
});
