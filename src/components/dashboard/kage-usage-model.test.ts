import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanOrigin, fileStem, usageGroups } from "./kage-usage-model.ts";

const all = (g: ReturnType<typeof usageGroups>) => g.flatMap((x) => x.steps.map((s) => s.command));

test("every Kage gets install, CLI, MCP and REST groups", () => {
  const g = usageGroups({ origin: "https://k.example", name: "Q3 Plan!", uuid: "abc-123" });
  assert.deepEqual(g.map((x) => x.id), ["install", "cli", "mcp", "rest"]);
  const cmds = all(g);
  assert.ok(cmds.includes("curl -fsSL https://k.example/api/shared/abc-123 -o q3-plan.kage.json"));
  assert.ok(cmds.includes("claude mcp add --transport http kages https://k.example/api/mcp"));
  assert.ok(cmds.some((c) => c.includes('uuid: "abc-123"')));
});

test("without a share link the commands use the name, not a download", () => {
  const cmds = all(usageGroups({ origin: "http://localhost:3000", name: "ops-console" }));
  assert.ok(cmds.some((c) => c.startsWith("npx kages get ops-console")));
  assert.ok(!cmds.some((c) => c.includes("/api/shared/")));
});

test("hostile input cannot inject shell: origin must be http(s), uuid and names are sanitised", () => {
  assert.equal(cleanOrigin("javascript:alert(1)"), "");
  assert.equal(cleanOrigin("https://a.example/path?x=1"), "https://a.example");
  const cmds = all(usageGroups({ origin: "https://a.example", name: "x'; rm -rf / #\"", uuid: "a b;rm" }));
  const rest = cmds.find((c) => c.startsWith("curl -s") && c.includes(" -d "))!;
  assert.equal((rest.match(/'/g) || []).length, 2, "the quoted body cannot be closed early: " + rest);
  assert.ok(!cmds.some((c) => c.startsWith("npx kages") && /[;'"]/.test(c.replace(/ && /g, " "))), "file names are slugs");
  assert.ok(!cmds.some((c) => /api\/shared\/a b/.test(c)));
  assert.equal(fileStem("../../etc/passwd"), "etc-passwd");
});
