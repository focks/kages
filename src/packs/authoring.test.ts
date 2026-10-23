// A small entry skill is only useful if every deferred reference can actually
// be read. Check delivery across plugins, local installs, CLI exports and MCP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, normalize } from "node:path";
import { readFileSync } from "node:fs";
import { skillFiles, skillMd } from "./packs.ts";
import { filesFor } from "../install/files.ts";
import { generatePlugins } from "../plugin/generate.ts";
import { handleMcpMessage } from "../adapters/mcp.ts";
import { runCli } from "../test-support/cli.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { validate } from "../engine/validate.ts";

test("entry skills have a bounded size and all their local links resolve to generated files", () => {
  for (const system of ["core", "ledger", "atelier"]) {
    const files = skillFiles(system);
    assert.ok(skillMd(system).length < 9000, system);
    for (const [file, content] of Object.entries(files)) if (file.endsWith(".md")) {
      for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
        if (/^(https?:|#)/.test(match[1])) continue;
        assert.ok(Object.hasOwn(files, normalize(join(dirname(file), match[1]))), `${file}: missing ${match[1]}`);
      }
    }
    for (const [file, content] of Object.entries(files)) if (file.endsWith(".kage.json")) assert.equal(validate(JSON.parse(content)).ok, true, file);
  }
});

test("every plugin and local installer includes the references its entry skill links to", () => {
  for (const target of generatePlugins().targets) for (const system of ["core", "ledger", "atelier"]) {
    for (const [file, content] of Object.entries(skillFiles(system))) assert.equal(target.files[`skills/kages-${system}/${file}`], content);
  }
  for (const provider of ["claude", "codex"] as const) {
    const planned = filesFor(provider, "global", { project: "/project", home: "/home/example" }).files;
    const byPath = Object.fromEntries(planned.map(file => [file.path, file.content]));
    for (const file of planned.filter(file => file.kind === "skill" && /name: kages-(core|ledger|atelier)\n/.test(file.content))) {
      for (const link of file.content.matchAll(/\]\(([^)]+)\)/g)) assert.ok(Object.hasOwn(byPath, normalize(join(dirname(file.path), link[1]))), `${provider}: ${link[1]}`);
    }
  }
});

test("MCP can read every advertised authoring reference, including JSON examples", async () => {
  const exec = async () => ({ ok: true as const, data: null });
  const listing: any = await handleMcpMessage(exec, { id: 1, method: "resources/list" });
  const resources = listing.result.resources.filter((r: { uri: string }) => r.uri.startsWith("kages://guide/"));
  assert.ok(resources.length > 12);
  for (const resource of resources) {
    const result: any = await handleMcpMessage(exec, { id: 2, method: "resources/read", params: { uri: resource.uri } });
    assert.ok(result.result.contents[0].text.length > 0, resource.uri);
  }
  const bad: any = await handleMcpMessage(exec, { id: 3, method: "resources/read", params: { uri: "kages://guide/core/../../package.json" } });
  assert.ok(bad.error);
});

test("CLI pack export writes nested references and a usable example", async () => {
  const dir = tmpDir("kages-pack-");
  const result = await runCli(["pack", "core", "-o", dir]);
  assert.equal(result.code, 0, result.err);
  for (const [file, content] of Object.entries(skillFiles("core"))) assert.equal(readFileSync(join(dir, file), "utf8"), content);
});
