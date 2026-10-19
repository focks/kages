import { test } from "node:test";
import assert from "node:assert/strict";
import { agentsGuide } from "./agents-guide.ts";
import { OPERATIONS } from "../adapters/operations.ts";

test("the guide uses this host and names only operations that exist", () => {
  const md = agentsGuide("https://k.example/path?x=1");
  assert.match(md, /claude mcp add --transport http kages https:\/\/k\.example\/api\/mcp/);
  assert.match(md, /https:\/\/k\.example\/k\/<uuid>\.md/);
  const names = new Set(OPERATIONS.map((o) => o.name));
  const used = [...md.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1]).filter((n) => !["get_catalog_x"].includes(n));
  for (const n of used) assert.ok(names.has(n), `${n} is not an operation`);
  assert.ok(used.length >= 8);
});

test("a hostile origin is not echoed into commands", () => {
  assert.doesNotMatch(agentsGuide("javascript:alert(1)"), /javascript:/);
});
