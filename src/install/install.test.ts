import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { install, check, uninstall, readManifest, detectProviders, planFiles, sha, type InstallOpts } from "./run.ts";
import { filesFor, stamp } from "./files.ts";
import { VERSION } from "../version.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { fakeHome } from "../test-support/harness.ts";
import { runCli } from "../test-support/cli.ts";
import { systems } from "../engine/data.ts";

function env() { const project = tmpDir("kages-inst-"), home = fakeHome().home; const o = (extra: Partial<InstallOpts> = {}): InstallOpts => ({ scope: "project", base: { project, home }, yes: true, ...extra }); return { project, home, o }; }
const tree = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => join(d.parentPath, d.name)).sort() : []);
const snapshot = (dir: string) => tree(dir).map((f) => [f, readFileSync(f, "utf8")]);

test("detect: only providers whose directory exists", () => {
  const e = env();
  assert.deepEqual(detectProviders("project", { project: e.project, home: e.home }), []);
  mkdirSync(join(e.project, ".claude")); mkdirSync(join(e.project, ".github/hooks"), { recursive: true }); mkdirSync(join(e.project, ".cursor"));
  assert.deepEqual(detectProviders("project", { project: e.project, home: e.home }), ["claude", "cursor", "copilot"]);
  mkdirSync(join(e.home, ".codex"));
  assert.deepEqual(detectProviders("global", { project: e.project, home: e.home }), ["codex"]);
});

test("nothing detected and nothing named: a helpful message, no writes", async () => {
  const e = env();
  const r = await install(e.o());
  assert.equal(r.exit, 0);
  assert.match(r.lines.join("\n"), /no coding harness found.*--providers claude/);
  assert.deepEqual(tree(e.project), []);
});

test("install for claude writes skills, the improve skill, commands, agents, hooks and a manifest; a second run changes nothing", async () => {
  const e = env();
  mkdirSync(join(e.project, ".claude"));
  const r = await install(e.o());
  assert.equal(r.exit, 0, r.lines.join("\n"));
  for (const id of Object.keys(systems)) assert.match(readFileSync(join(e.project, `.claude/skills/kages-${id}/SKILL.md`), "utf8"), new RegExp(`^---\\nkages-version: ${VERSION.replace(/\./g, "\\.")}\\nname: kages-${id}`));
  assert.ok(existsSync(join(e.project, ".claude/skills/kages-improve/reference/polish.md")));
  assert.ok(existsSync(join(e.project, ".claude/commands/kages-improve-polish.md")));
  assert.ok(existsSync(join(e.project, ".claude/agents/kages-critic.md")));
  assert.ok(readFileSync(join(e.project, ".claude/settings.local.json"), "utf8").includes("kages-hook"));
  const m = readManifest("project", { project: e.project, home: e.home })!;
  assert.equal(m.version, VERSION);
  assert.deepEqual(m.providers, ["claude"]);
  assert.ok(m.files.length > 20 && m.files.every((f) => f.sha256.length === 64));
  assert.match(r.lines.join("\n"), /wire the tools: claude mcp add kages -- kages mcp/);
  const before = snapshot(e.project);
  const again = await install(e.o());
  assert.match(again.lines.join("\n"), /nothing to change/);
  assert.deepEqual(snapshot(e.project), before);
});

test("dry run, no consent, and --no-hooks / --no-skills", async () => {
  const e = env();
  mkdirSync(join(e.project, ".claude"));
  const dry = await install(e.o({ dryRun: true }));
  assert.match(dry.lines.join("\n"), /dry run: nothing was written/);
  assert.deepEqual(tree(e.project), []);
  const noConsent = await install(e.o({ yes: false }));
  assert.match(noConsent.lines.join("\n"), /without consent/);
  assert.deepEqual(tree(e.project), []);
  assert.match((await install({ ...e.o({ yes: false }), confirm: async () => false })).lines.join("\n"), /no changes made/);
  const noHooks = await install(e.o({ hooks: false }));
  assert.equal(noHooks.exit, 0);
  assert.equal(existsSync(join(e.project, ".claude/settings.local.json")), false);
  const e2 = env(); mkdirSync(join(e2.project, ".claude"));
  await install(e2.o({ skills: false }));
  assert.equal(existsSync(join(e2.project, ".claude/skills")), false);
  assert.ok(existsSync(join(e2.project, ".claude/settings.local.json")));
});

test("an edited file is kept; an untouched one updates; --force overwrites the edited one", async () => {
  const e = env();
  mkdirSync(join(e.project, ".claude"));
  await install(e.o({ hooks: false }));
  const edited = join(e.project, ".claude/skills/kages-core/SKILL.md"), untouched = join(e.project, ".claude/skills/kages-ledger/SKILL.md");
  writeFileSync(edited, "my own notes");
  // Pretend the packaged content changed since: the recorded hash still matches the untouched file.
  const m = readManifest("project", { project: e.project, home: e.home })!;
  writeFileSync(untouched, "older generated text");
  writeFileSync(join(e.project, ".kages/install.json"), JSON.stringify({ ...m, files: m.files.map((f) => (f.path === untouched ? { ...f, sha256: sha("older generated text") } : f)) }));
  const r = await install(e.o({ hooks: false }));
  assert.match(r.lines.join("\n"), /kept your edited .*kages-core\/SKILL\.md/);
  assert.equal(readFileSync(edited, "utf8"), "my own notes");
  assert.match(readFileSync(untouched, "utf8"), /^---\nkages-version/);
  const forced = await install(e.o({ hooks: false, force: true }));
  assert.equal(forced.exit, 0);
  assert.match(readFileSync(edited, "utf8"), /^---\nkages-version/);
});

test("check: not installed, current, a hand edit (reported, not failing), a missing file and a version bump (failing)", async () => {
  const e = env(); const b = { project: e.project, home: e.home };
  assert.equal(check("project", b).exit, 1);
  mkdirSync(join(e.project, ".claude"));
  await install(e.o({ hooks: false }));
  assert.deepEqual([check("project", b).exit, check("project", b).lines[0]], [0, `Kages ${VERSION} is installed and current (${readManifest("project", b)!.files.length} files, claude)`]);
  writeFileSync(join(e.project, ".claude/skills/kages-core/SKILL.md"), "mine");
  const edited = check("project", b);
  assert.equal(edited.exit, 0);
  assert.match(edited.lines.join("\n"), /edited by hand/);
  rmSync(join(e.project, ".claude/agents/kages-critic.md"));
  const missing = check("project", b);
  assert.equal(missing.exit, 1);
  assert.match(missing.lines.join("\n"), /missing: .*kages-critic\.md/);
  const m = readManifest("project", b)!;
  writeFileSync(join(e.project, ".kages/install.json"), JSON.stringify({ ...m, version: "0.9.0" }));
  assert.match(check("project", b).lines.join("\n"), /installed 0\.9\.0, this CLI is/);
});

test("uninstall removes exactly the manifest files, keeps edits, restores hook config and tidies empty folders", async () => {
  const e = env(); const b = { project: e.project, home: e.home };
  mkdirSync(join(e.project, ".claude"));
  const settings = join(e.project, ".claude/settings.local.json");
  const original = JSON.stringify({ permissions: { allow: ["Bash(ls)"] } }, null, 2) + "\n";
  writeFileSync(settings, original);
  writeFileSync(join(e.project, ".claude/agents-mine.md"), "not ours");
  await install(e.o());
  writeFileSync(join(e.project, ".claude/skills/kages-core/SKILL.md"), "edited");
  const r = await uninstall({ scope: "project", base: b, yes: true });
  assert.match(r.lines.join("\n"), /kept .*kages-core\/SKILL\.md \(edited by hand\)/);
  assert.equal(readFileSync(settings, "utf8"), original, "hook config restored byte for byte");
  assert.equal(readFileSync(join(e.project, ".claude/agents-mine.md"), "utf8"), "not ours");
  assert.equal(existsSync(join(e.project, ".claude/skills/kages-ledger")), false);
  assert.equal(existsSync(join(e.project, ".claude/agents")), false, "an emptied folder is removed");
  assert.equal(readFileSync(join(e.project, ".claude/skills/kages-core/SKILL.md"), "utf8"), "edited");
  assert.equal(readManifest("project", b), null);
  assert.match((await uninstall({ scope: "project", base: b, yes: true })).lines[0], /nothing recorded/);
});

test("codex: global prompts only; project scope says why nothing is installed", async () => {
  const e = env();
  mkdirSync(join(e.project, ".codex"));
  const p = await install(e.o({ hooks: false }));
  assert.match(p.lines.join("\n"), /prompts are only read from your home directory/);
  assert.equal(existsSync(join(e.project, ".codex/prompts")), false);
  mkdirSync(join(e.home, ".codex"));
  const g = await install({ ...e.o({ scope: "global", hooks: false }) });
  assert.equal(g.exit, 0);
  assert.ok(existsSync(join(e.home, ".codex/prompts/kages-core.md")));
  assert.ok(existsSync(join(e.home, ".kages/install.json")), "the global manifest lives under the home directory");
});

test("--mcp write adds the server to .mcp.json without disturbing others, and only once", async () => {
  const e = env();
  mkdirSync(join(e.project, ".claude"));
  writeFileSync(join(e.project, ".mcp.json"), JSON.stringify({ mcpServers: { other: { command: "x" } } }));
  await install(e.o({ hooks: false, skills: false, mcp: "write" }));
  const j = JSON.parse(readFileSync(join(e.project, ".mcp.json"), "utf8"));
  assert.deepEqual(Object.keys(j.mcpServers).sort(), ["kages", "other"]);
  assert.deepEqual(j.mcpServers.kages, { command: "kages", args: ["mcp"] });
  writeFileSync(join(e.project, ".mcp.json"), "{ nope");
  const bad = await install(e.o({ hooks: false, skills: false, mcp: "write", force: true }), null);
  assert.match(bad.lines.join("\n"), /is not valid JSON; left alone/);
  assert.equal(readFileSync(join(e.project, ".mcp.json"), "utf8"), "{ nope");
});

test("an unknown provider is refused; grok is named as unverified", async () => {
  const r = await install(env().o({ providers: ["grok"] }));
  assert.equal(r.exit, 1);
  assert.match(r.lines[0], /unknown provider 'grok'.*grok has no verified format/);
});

test("no network is used: fetch throws and install still works", async () => {
  const e = env(); mkdirSync(join(e.project, ".claude"));
  const real = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("network used"); }) as never;
  try { assert.equal((await install(e.o())).exit, 0); } finally { globalThis.fetch = real; }
});

test("generated files agree with the packs and stamp their version", () => {
  const f = filesFor("claude", "project", { project: "/p", home: "/h" }).files;
  assert.ok(f.some((x) => x.path === "/p/.claude/agents/kages-critic.md"));
  assert.match(stamp("---\nname: x\n---\n"), /^---\nkages-version: /);
  assert.equal(planFiles(["claude"], "project", { project: tmpDir(), home: tmpDir() }, null).writes.every((w) => w.status === "new"), true);
});

test("CLI: install --dry-run, check and uninstall through the real commands", async () => {
  const e = env(); mkdirSync(join(e.project, ".claude"));
  const dry = await runCli(["install", "--dry-run"], { cwd: e.project, env: { HOME: e.home } });
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /providers: claude \(detected\)/);
  assert.equal((await runCli(["check"], { cwd: e.project, env: { HOME: e.home } })).code, 1);
  assert.equal((await runCli(["install", "--yes"], { cwd: e.project, env: { HOME: e.home } })).code, 0);
  assert.equal((await runCli(["check"], { cwd: e.project, env: { HOME: e.home } })).code, 0);
  assert.equal((await runCli(["update", "--check"], { cwd: e.project, env: { HOME: e.home } })).code, 0);
  assert.match((await runCli(["uninstall", "--yes"], { cwd: e.project, env: { HOME: e.home } })).out, /removed \d+ file/);
  assert.equal((await runCli(["update"], { cwd: e.project, env: { HOME: e.home } })).code, 1);
});

// The regression this whole plan exists for: a published CLI must run on a Node with no TypeScript support.
const npmOk = (() => { try { execFileSync("npm", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();
test("the packed tarball holds a self-contained CLI that runs on a Node without type stripping", { skip: !npmOk && "npm not available" }, () => {
  const root = fileURLToPath(new URL("../../", import.meta.url)), dest = tmpDir("kages-pack-");
  const out = execFileSync("npm", ["pack", "--json", "--pack-destination", dest], { cwd: root, encoding: "utf8", timeout: 120_000 });
  const info = JSON.parse(out.slice(out.indexOf("[")))[0] as { filename: string; files: { path: string }[] };
  const paths = info.files.map((f) => f.path);
  assert.ok(paths.includes("dist/kages.mjs"));
  assert.ok(paths.some((p) => p.startsWith("plugins/kages/")));
  assert.ok(!paths.some((p) => p.startsWith("src/") || p.startsWith("node_modules/") || p.startsWith("reference/")), "no source or oracle in the package");
  execFileSync("tar", ["-xzf", join(dest, info.filename), "-C", dest]);
  const cli = join(dest, "package/dist/kages.mjs");
  const run = (args: string[], input = "") => spawnSync(process.execPath, ["--no-experimental-strip-types", cli, ...args], { encoding: "utf8", input, timeout: 30_000, cwd: dest });
  assert.equal(run(["--version"]).stdout.trim(), `kages ${VERSION}`);
  const sample = join(dest, "k.kage.json");
  writeFileSync(sample, JSON.stringify({ kages: "1.0", id: "k", title: "K", system: "core@1", root: "root", blocks: { root: { type: "text", props: { text: "hi" } } } }));
  assert.match(run(["validate", sample]).stdout, /valid/);
  assert.match(run(["lint", "--list"]).stdout, /dead-button/);
  assert.equal(run(["hook"], "not json").status, 0);
  const inst = run(["install", "--dry-run", "--providers", "claude", "-C", join(dest, "ws")]);
  assert.equal(inst.status, 0, inst.stderr);
  assert.match(inst.stdout, /dry run: nothing was written/);
});
