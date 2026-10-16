import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast, hexToRgb, round2 } from "./contrast.ts";

test("WCAG reference vectors", () => {
  assert.equal(round2(contrast("#000000", "#ffffff")), 21);
  assert.equal(round2(contrast("#ffffff", "#ffffff")), 1);
  assert.equal(round2(contrast("#777777", "#ffffff")), 4.48, "the classic just-fails-AA grey");
  assert.ok(contrast("#767676", "#ffffff") >= 4.5, "#767676 is the lightest grey that passes AA on white");
  assert.equal(contrast("#abc", "#aabbcc"), 1, "short hex expands");
});

test("symmetric, and anything that is not hex is NaN rather than a wrong number", () => {
  assert.equal(contrast("#123456", "#fedcba"), contrast("#fedcba", "#123456"));
  for (const bad of ["red", "rgb(0,0,0)", "#12", "#gggggg", ""]) assert.ok(Number.isNaN(contrast(bad, "#fff")), bad);
  assert.deepEqual(hexToRgb("#FFF"), [255, 255, 255]);
});
