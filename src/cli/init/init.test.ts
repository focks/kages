import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { scanPackageJson, scanReadme, scanProject, type FsLike } from "./scan.ts";
import { runInterview, pending, ScriptedIo, MAX_QUESTIONS_PER_ROUND, MAX_ANSWER } from "./interview.ts";
import { runInit } from "./index.ts";
import { Store } from "../../store/store.ts";
import { gitRepo } from "../../test-support/git.ts";
import { runCli } from "../../test-support/cli.ts";
import { tmpDir } from "../../test-support/tmp.ts";
import { INIT_PROMPT, INIT_PROMPT_NAME } from "../../packs/init-prompt.ts";
import { handleMcpMessage } from "../../adapters/mcp.ts";

const fsOf = (files: Record<string, string>): FsLike => ({ readText: (p) => files[p] ?? null });

test("scanPackageJson: name and description, tolerant of junk", () => {
  assert.deepEqual(scanPackageJson('{"name":"acme","description":"  Tools   for\\nsupport "}'), { name: "acme", description: "Tools for support" });
  assert.deepEqual(scanPackageJson('{"name":"x"}'), { name: "x" });
  for (const bad of [null, "", "{nope", "[]", '{"name":3,"description":false}']) assert.deepEqual(scanPackageJson(bad), {}, String(bad));
});

test("scanReadme: skips badges, images, HTML and code; stops at the first paragraph", () => {
  const md = '<p align="center"><img src="x.png"></p>\n\n[![CI](https://x/badge.svg)](https://x)\n\n# Acme Console\n\n![logo](logo.png)\n\n```sh\nnpm i\n```\n\nAcme Console helps support teams triage [tickets](https://x) faster.\nIt runs anywhere.\n\n## Install\n\nmore text';
  assert.deepEqual(scanReadme(md), { heading: "Acme Console", paragraph: "Acme Console helps support teams triage tickets faster. It runs anywhere." });
  assert.deepEqual(scanReadme(""), {});
  assert.deepEqual(scanReadme(null), {});
});

test("scanReadme is bounded on hostile input", () => {
  const huge = "# T\n\n" + "word ".repeat(200_000);
  const r = scanReadme(huge);
  assert.ok(r.paragraph!.length <= 400);
  assert.doesNotThrow(() => scanReadme("\u0000\u0001".repeat(10_000)));
});

test("scanProject prefers package.json for purpose and keeps README intro as positioning", () => {
  const h = scanProject(fsOf({ "package.json": '{"name":"acme","description":"Support triage"}', "README.md": "# Acme\n\nA calm inbox for support teams." }));
  assert.deepEqual(h.purpose, { value: "Support triage", source: "package.json description" });
  assert.deepEqual(h.positioning, { value: "A calm inbox for support teams.", source: "README intro" });
  const readmeOnly = scanProject(fsOf({ "README.md": "# Acme\n\nA calm inbox." }));
  assert.equal(readmeOnly.purpose!.source, "README intro");
  assert.deepEqual(scanProject(fsOf({})), { existingKages: [] });
});

test("interview: at most three questions per round, none about visual style", async () => {
  const io = new ScriptedIo({});
  await runInterview({ existingKages: [] }, undefined, io);
  assert.ok(io.asked.length <= MAX_QUESTIONS_PER_ROUND + 2);
  assert.ok(pending({ fields: {}, confirmed: new Set() }, 1).length <= MAX_QUESTIONS_PER_ROUND);
  for (const q of io.asked) assert.doesNotMatch(q.text, /colou?r|font|typeface|layout|style the|theme/i, q.id);
});

test("interview: a confirmed field is not asked again; a scanned one is offered as the suggestion", async () => {
  const io = new ScriptedIo({ users: "Support agents on shift", absent: "testimonials; customer logos" });
  const d = await runInterview({ existingKages: [], purpose: { value: "Support triage", source: "package.json description" } }, undefined, io);
  assert.deepEqual(d.fields.absent, ["testimonials", "customer logos"]);
  assert.equal(d.fields.purpose, "Support triage");
  assert.ok(d.confirmed.has("users") && !d.confirmed.has("purpose"), "an accepted suggestion stays unconfirmed");
  assert.equal(io.asked.find((q) => q.id === "purpose")!.suggestion, "Support triage");
  const again = new ScriptedIo({});
  await runInterview({ existingKages: [] }, { schema: 1, users: "u", purpose: "p", absent: ["x"] }, again);
  assert.deepEqual(again.asked.filter((q) => ["users", "purpose", "absent"].includes(q.id)), []);
});

test("interview: round two happens only when voice and constraints are both missing; an oversize answer is trimmed", async () => {
  const none = new ScriptedIo({ users: "u", purpose: "p", absent: "a" });
  const d = await runInterview({ existingKages: [] }, undefined, none);
  assert.equal(d.rounds, 2);
  assert.deepEqual(none.asked.slice(3).map((q) => q.id), ["voice", "constraints"]);
  const one = new ScriptedIo({ users: "u", purpose: "p", absent: "a", voice: "plain" });
  await runInterview({ existingKages: [] }, undefined, one);
  assert.equal(one.asked.length >= 3, true);
  const big = new ScriptedIo({ users: "x".repeat(MAX_ANSWER + 500), purpose: "p" });
  assert.equal((await runInterview({ existingKages: [] }, undefined, big)).fields.users!.length, MAX_ANSWER);
});

const author = { principal: "user:me", runtime: { adapter: "cli" } };
function freshStore() { const s = new Store(); s.grant("user:me", "kages", ["read", "write", "publish", "admin"]); return s; }

test("runInit with answers: writes config, brief, export, and a second run changes nothing", async () => {
  const proj = tmpDir(), dir = join(proj, ".kages");
  writeFileSync(join(proj, "package.json"), '{"name":"acme","description":"Support triage"}');
  const store = freshStore();
  const answers = { users: "Support agents on shift", absent: ["testimonials"], voice: "Plain and calm", constraints: "WCAG AA" };
  const a = await runInit({ dir, cwd: proj, store, author, answers, noGitignore: true });
  assert.ok(a.briefWritten && a.revision === 1);
  assert.deepEqual(a.inferred, ["purpose"], "the purpose came from package.json and is still unconfirmed");
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "config.json"), "utf8")), { version: 1 });
  assert.match(readFileSync(join(dir, "brief.md"), "utf8"), /## Inferred\n\n- purpose/);
  const b = await runInit({ dir, cwd: proj, store, author, answers, noGitignore: true });
  assert.equal(b.changed, false);
  assert.match(b.lines.join("\n"), /nothing to change/);
  assert.equal(store.getBrief(author).ok && (store.getBrief(author) as any).value.record.revision, 1);
});

test("runInit: non-interactive without answers writes no brief and still succeeds", async () => {
  const proj = tmpDir();
  const r = await runInit({ dir: join(proj, ".kages"), cwd: proj, store: freshStore(), author, noGitignore: true });
  assert.equal(r.briefWritten, false);
  assert.match(r.lines.join("\n"), /brief not written: run `kages init` in a terminal/);
});

test("runInit --yes keeps drafts inferred and reports what is still missing", async () => {
  const proj = tmpDir();
  writeFileSync(join(proj, "package.json"), '{"description":"Support triage"}');
  const r = await runInit({ dir: join(proj, ".kages"), cwd: proj, store: freshStore(), author, yes: true, noGitignore: true });
  assert.equal(r.briefWritten, false);
  assert.match(r.lines.join("\n"), /still missing users/);
});

test("an edited brief.md is never overwritten", async () => {
  const proj = tmpDir(), dir = join(proj, ".kages");
  const store = freshStore();
  await runInit({ dir, cwd: proj, store, author, answers: { users: "u", purpose: "p" }, noGitignore: true });
  const mine = readFileSync(join(dir, "brief.md"), "utf8") + "\nMy own notes.\n";
  writeFileSync(join(dir, "brief.md"), mine);
  const r = await runInit({ dir, cwd: proj, store, author, answers: { users: "different users", purpose: "p" }, refresh: true, noGitignore: true });
  assert.equal(readFileSync(join(dir, "brief.md"), "utf8"), mine);
  assert.ok(existsSync(join(dir, "brief.md.new")));
  assert.match(r.lines.join("\n"), /brief\.md\.new/);
});

test("--refresh with an identical answer set does not mint a revision", async () => {
  const proj = tmpDir(), dir = join(proj, ".kages");
  const store = freshStore();
  const answers = { users: "u", purpose: "p", absent: "a", voice: "v", constraints: "c" };
  await runInit({ dir, cwd: proj, store, author, answers, noGitignore: true });
  const again = await runInit({ dir, cwd: proj, store, author, answers, refresh: true, noGitignore: true });
  assert.match(again.lines.join("\n"), /brief unchanged \(revision 1\)/);
});

test("git: init leaves only the intended files, and ignores everything else", { skip: gitRepo() === null }, async () => {
  const repo = gitRepo({ "package.json": '{"name":"acme","description":"Support triage"}' }, { commit: true })!;
  writeFileSync(join(repo.dir, "answers.json"), JSON.stringify({ users: "Agents", absent: "testimonials", voice: "v", constraints: "c" }));
  repo.git("add", "answers.json"); repo.git("commit", "-q", "-m", "answers");
  const r = await runCli(["init", "--answers", "answers.json"], { cwd: repo.dir });
  assert.equal(r.code, 0, r.out + r.err);
  mkdirSync(join(repo.dir, ".kages", "screenshots"), { recursive: true });
  writeFileSync(join(repo.dir, ".kages", "screenshots", "a.png"), "x");
  const status = repo.git("status", "--porcelain", "-uall").split("\n").filter(Boolean).map((l) => l.slice(3)).sort();
  assert.deepEqual(status, [".gitignore", ".kages/brief.md", ".kages/config.json"]);
  const ctx = JSON.parse((await runCli(["context", "--json", "--local"], { cwd: repo.dir })).out);
  assert.ok(!ctx.directives.some((d: { code: string }) => d.code === "NO_BRIEF"));
  const again = await runCli(["init", "--answers", "answers.json"], { cwd: repo.dir });
  assert.match(again.out, /nothing to change/);
  assert.match(r.out, /^initialized workspace at /, "the original first line is kept for scripts");
});

test("the MCP prompt kages-init exists and states the three questions and the no-visual-questions rule", async () => {
  const list = (await handleMcpMessage(async () => ({ ok: true, data: null }) as never, { jsonrpc: "2.0", id: 1, method: "prompts/list" })) as any;
  assert.ok(list.result.prompts.some((p: { name: string }) => p.name === INIT_PROMPT_NAME));
  const got = (await handleMcpMessage(async () => ({ ok: true, data: null }) as never, { jsonrpc: "2.0", id: 2, method: "prompts/get", params: { name: INIT_PROMPT_NAME } })) as any;
  assert.equal(got.result.messages[0].content.text, INIT_PROMPT);
  assert.match(INIT_PROMPT, /at most three questions/);
  assert.match(INIT_PROMPT, /Do not ask about visual style/);
  assert.match(INIT_PROMPT, /hypothesis, not approval/);
});
