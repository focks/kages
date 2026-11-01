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

test('the curated format is the shared default while advanced examples remain addressable', async () => {
  const { RECOMMENDED_EXAMPLES, recommendedExamples, allExamples } = await import('./curated-examples.ts');
  const { starterDocs } = await import('./starters.ts');
  const { introKages } = await import('../server/intro-kages.ts');
  const { lint } = await import('../engine/advice.ts');
  const expected: string[] = RECOMMENDED_EXAMPLES.map(entry => entry.id);
  assert.equal(expected[0], 'review-brief');
  assert.equal(expected.length, 5);
  assert.deepEqual(starterDocs().map(doc => doc.id), [...expected, 'blank']);
  assert.deepEqual(introKages().filter(doc => expected.includes(doc.id)).map(doc => doc.id), expected);
  assert.ok(introKages().length < 10, 'first login is a curated set, not the whole capability library');
  for (const system of ['core', 'ledger', 'atelier']) {
    const files = skillFiles(system), index = files['reference/examples.md'];
    const links = [...index.matchAll(/\]\(examples\/([^/)]+)\.kage\.json\)/g)].map(match => match[1]);
    assert.deepEqual(links, expected);
    assert.match(skillMd(system), /Default to review-brief/);
    assert.match(files['reference/examples-all.md'], /allocation-lab/);
    for (const doc of allExamples(system)) assert.ok(files[`reference/examples/${doc.id}.kage.json`]);
    for (const doc of recommendedExamples(system)) {
      assert.equal(validate(doc).ok, true, doc.id);
      assert.deepEqual(lint(doc), [], doc.id);
    }
    const report = recommendedExamples(system)[0];
    assert.equal(report.blocks.root.type, 'page');
    assert.equal(report.blocks.root.props?.width, 'reading');
    assert.deepEqual(report.blocks.root.slots?.children, ['intro', 'facts', 'findings', 'action', 'verified', 'order', 'footer']);
    assert.ok(Object.values(report.blocks).every(block => !block.on && !block.visible), 'essential content is visible at rest');
  }
});

test('the curated calculator changes its result and resets its assumptions', async () => {
  const { recommendedExamples } = await import('./curated-examples.ts');
  const { KageSession } = await import('../engine/session.ts');
  const doc = recommendedExamples().find(doc => doc.id === 'growth-lab')!;
  const session = new KageSession(doc);
  const baseline = session.read('result')?.value;
  session.dispatch('principal', 'change', { value: 2000 });
  assert.notEqual(session.read('result')?.value, baseline);
  session.dispatch('rate', 'change', { value: 0 });
  assert.equal(session.read('result')?.value, 2000);
  session.dispatch('reset-growth', 'click');
  assert.equal(session.read('result')?.value, baseline);
  assert.ok(!doc.blocks.diagram, 'the result chart already explains the projection');
});
