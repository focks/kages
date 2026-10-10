// Golden tests: the TS engine must match the oracle bundle's outputs on the
// reference fixtures. Goldens were captured from window.Kages (scripts/golden).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { resolve } from "./resolve.ts";
import { validate } from "./validate.ts";
import { describe } from "./describe.ts";
import { catalog } from "./catalog.ts";
import { generationSchema, toGenerated, fromGenerated } from "./generate.ts";
import type { KageDoc } from "./types.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(here + p, "utf8"));
const ops = read("__fixtures__/../../../public/ds/ops-console.kage.json") as KageDoc;
const broken = read("__fixtures__/broken.kage.json") as KageDoc;

test("resolve: bare role through the Kage system", () => {
  assert.equal(resolve("ledger", "dropdown").ref, "ledger/dropdown@2.0.0");
  assert.equal(resolve("core", "dropdown").ref, "core/dropdown@1.3.0");
});

test("resolve: inherited role falls through to the parent", () => {
  assert.equal(resolve("ledger", "table").ref, "core/table@1.0.0");
  assert.equal(resolve("atelier", "stack").ref, "core/stack@1.0.0");
});

test("resolve: cross-system pin overrides the Kage system", () => {
  assert.equal(resolve("ledger", "core/dropdown@1").ref, "core/dropdown@1.3.0");
});

test("resolve: major pin mismatch errors", () => {
  assert.match(resolve("core", "dropdown@2").error ?? "", /installed/);
  assert.match(resolve("core", "nope").error ?? "", /not a component/);
});

test("validate: broken fixture yields exactly 6 errors + 1 warning (matches the card)", () => {
  const golden = read("__fixtures__/golden-validate-broken.json");
  const r = validate(broken);
  assert.deepEqual(r.errors, golden.errors);
  assert.deepEqual(r.warnings, golden.warnings);
  assert.equal(r.errors.length, 6);
  assert.equal(r.warnings.length, 1);
  assert.deepEqual(r.errors.map((e) => e.code), ["slot-max", "missing-prop", "unknown-event", "unresolved-type", "private-output", "unknown-command"]);
  assert.deepEqual(r.warnings.map((e) => e.code), ["limit"]);
});

test("validate: ops-console passes with 0/0 and portable in all three systems", () => {
  for (const sys of ["core", "ledger", "atelier"] as const) {
    const golden = read(`__fixtures__/golden-validate-ops-${sys}.json`);
    const r = validate(ops, sys);
    assert.deepEqual(r, golden, `${sys} matches golden`);
    assert.equal(r.errors.length, 0);
    assert.equal(r.warnings.length, 0);
    assert.equal(r.portable, true);
  }
});

test("describe: matches the oracle text view", () => {
  const golden = read("__fixtures__/golden-describe-ops.json");
  assert.equal(describe(ops), golden);
});

test("catalog: matches the oracle text", () => {
  const golden = read("__fixtures__/golden-catalog-core.json");
  assert.equal(catalog("core"), golden);
});

test("toGenerated: matches the oracle envelope", () => {
  const golden = read("__fixtures__/golden-togenerated-ops.json");
  assert.deepEqual(toGenerated(ops), golden);
});

test("round trip: document -> envelope -> document validates clean in all three systems", () => {
  for (const sys of ["core", "ledger", "atelier"] as const) {
    const back = fromGenerated(toGenerated(ops, sys), sys);
    const r = validate(back, sys);
    assert.equal(r.errors.length, 0, `${sys} round-trip errors`);
    assert.equal(r.warnings.length, 0, `${sys} round-trip warnings`);
  }
});

test("generationSchema: strict — every object closed, every key required, no bare optionals", () => {
  const schema = generationSchema("core");
  const seen: string[] = [];
  (function walk(s: any, path: string) {
    if (!s || typeof s !== "object") return;
    if (s.type === "object" || (Array.isArray(s.type) && s.type.includes("object"))) {
      if (s.properties) {
        assert.equal(s.additionalProperties, false, `closed at ${path}`);
        const keys = Object.keys(s.properties);
        assert.deepEqual([...(s.required ?? [])].sort(), keys.sort(), `all required at ${path}`);
      }
    }
    seen.push(path);
    for (const k of Object.keys(s)) walk(s[k], path + "/" + k);
  })(schema, "");
  assert.ok(seen.length > 10);
});
