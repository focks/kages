import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store/store.ts";
import { dispatch } from "../adapters/operations.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import type { JrSpec } from "./json-render.ts";

const owner = { principal: "user:o" };
function twoVersions() {
  const s = new Store({ workspace: "w" });
  s.grant(owner.principal, "r", ["read", "write", "publish", "admin"]);
  s.create("r", sampleKage({ id: "k" }), owner);
  assert.ok(s.patch("k", [{ op: "replace", path: "/blocks/hello/props/text", value: "Second" }], owner).ok);
  return { store: s, author: owner };
}
const call = (c: ReturnType<typeof twoVersions>, p: Record<string, unknown>) => dispatch(c, "to_json_render", { name: "k", ...p }) as { ok: boolean; data?: { version: number; spec: JrSpec }; error?: { code: string; msg: string } };
const text = (r: ReturnType<typeof call>) => (r.data!.spec.elements.hello.props as { text: string }).text;

test("to_json_render exports the requested version, and the head when none is asked for", () => {
  const c = twoVersions();
  assert.deepEqual([call(c, {}).data!.version, text(call(c, {}))], [2, "Second"]);
  assert.deepEqual([call(c, { version: 1 }).data!.version, text(call(c, { version: 1 }))], [1, "Hello"]);
});

test("an unknown or malformed version is refused, never answered with the head", () => {
  const c = twoVersions();
  const missing = call(c, { version: 9 });
  assert.equal(missing.ok, false); assert.equal(missing.error!.code, "not_found"); assert.match(missing.error!.msg, /no version 9 of 'k'/);
  for (const v of [0, -1, 1.5, "abc", null]) { const r = call(c, { version: v }); assert.equal(r.ok, false, String(v)); assert.equal(r.error!.code, "invalid_params", String(v)); }
});

test("a version still obeys read permission", () => {
  const c = twoVersions();
  const r = dispatch({ store: c.store, author: { principal: "user:stranger" } }, "to_json_render", { name: "k", version: 1 }) as { ok: boolean; error?: { code: string } };
  assert.equal(r.ok, false); assert.equal(r.error!.code, "not_found", "a stranger cannot tell a private Kage from a missing one");
});
