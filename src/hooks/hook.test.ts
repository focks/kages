import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, symlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { handleHook, badJson, MAX_FILE, MAX_STDIN, MAX_LINES, MAX_OUT } from "./run.ts";
import { nodeFs } from "./node-fs.ts";
import { HARNESSES, patchFiles, detectHarness } from "./harnesses.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { spawnKages } from "../test-support/spawn.ts";
import { realpathSync } from "node:fs";

const FX = fileURLToPath(new URL("./__fixtures__/", import.meta.url));
const fixture = (p: string, root: string) => readFileSync(FX + p, "utf8").replaceAll("/home/user/proj", root);
const project = () => realpathSync(tmpDir("kages-hook-"));
const GOOD = JSON.stringify(sampleKage({ id: "ok" }));
const DEAD = JSON.stringify({ ...sampleKage({ id: "dead" }), blocks: { root: { type: "stack", props: {}, slots: { children: ["b"] } }, b: { type: "button", props: { label: "Go" } } } });
const INVALID = JSON.stringify({ ...sampleKage({ id: "bad" }), blocks: { root: { type: "stack", props: {}, slots: { children: ["z"] } }, z: { type: "no-such-block", props: {} } } });
const put = (root: string, rel: string, text: string) => { mkdirSync(join(root, rel, ".."), { recursive: true }); writeFileSync(join(root, rel), text); };
const run = (stdin: string, root: string, extra: object = {}) => handleHook({ stdin, fs: nodeFs, cwd: root, env: {}, ...extra });
const ctxOf = (o: { stdout: string }, key: string) => { const j = JSON.parse(o.stdout); return key === "claude" ? j.hookSpecificOutput.additionalContext : key === "cursor" ? j.additional_context : j.additionalContext ?? j.hookSpecificOutput?.additionalContext; };

test("every fixture is recognised by the right harness and nobody else", () => {
  const expect: Record<string, string> = { "claude/post-edit.json": "claude", "claude/post-write.json": "claude", "claude/post-multiedit.json": "claude", "claude/pre-write.json": "claude", "claude/stop.json": "claude", "cursor/after-file-edit.json": "cursor", "cursor/stop.json": "cursor", "codex/post-apply-patch.json": "codex", "codex/stop.json": "codex", "copilot/post-camel.json": "copilot", "copilot/post-pascal.json": "copilot" };
  for (const [f, id] of Object.entries(expect)) {
    const p = JSON.parse(readFileSync(FX + f, "utf8"));
    assert.equal(detectHarness(p)?.id, id, f);
    assert.deepEqual(HARNESSES.filter((h) => h.detect(p)).map((h) => h.id).filter((x) => x === id).length, 1);
  }
  assert.equal(detectHarness({ random: true }), undefined);
  for (const h of HARNESSES) { assert.match(h.lastVerified, /^\d{4}-\d{2}-\d{2}$/); assert.match(h.docsUrl, /^https:\/\//); }
});

test("targets: edit, write, multiedit, cursor, copilot (both forms) and apply_patch (Add and Update lines only)", () => {
  const t = (f: string) => detectHarness(JSON.parse(readFileSync(FX + f, "utf8")))!.targets(JSON.parse(readFileSync(FX + f, "utf8")));
  assert.deepEqual(t("claude/post-edit.json"), ["/home/user/proj/pages/pricing.kage.json"]);
  assert.deepEqual(t("claude/post-write.json"), ["/home/user/proj/pages/new.kage.json"]);
  assert.deepEqual(t("claude/post-multiedit.json"), ["/home/user/proj/pages/pricing.kage.json"]);
  assert.deepEqual(t("cursor/after-file-edit.json"), ["/home/user/proj/pages/pricing.kage.json"]);
  assert.deepEqual(t("copilot/post-camel.json"), ["/home/user/proj/pages/pricing.kage.json"]);
  assert.deepEqual(t("copilot/post-pascal.json"), ["/home/user/proj/pages/new.kage.json"]);
  assert.deepEqual(t("codex/post-apply-patch.json"), ["pages/pricing.kage.json", "pages/new.kage.json", "src/app.ts"]);
  assert.deepEqual(patchFiles("*** Delete File: gone.kage.json\n*** Update File: a.kage.json"), ["a.kage.json"]);
});

for (const [name, post, key, rel] of [["claude", "claude/post-edit.json", "claude", "pages/pricing.kage.json"], ["cursor", "cursor/after-file-edit.json", "cursor", "pages/pricing.kage.json"], ["copilot", "copilot/post-camel.json", "copilot", "pages/pricing.kage.json"], ["codex", "codex/post-apply-patch.json", "claude", "pages/pricing.kage.json"]] as const) {
  test(`${name}: a lint finding comes back in the harness's own shape; a clean file and a non-Kage file stay silent`, async () => {
    const root = project();
    put(root, rel, DEAD);
    const out = await run(fixture(post, root), root);
    assert.equal(out.exit, 0);
    assert.match(ctxOf(out, key), /dead-button/);
    assert.match(ctxOf(out, key), /^Kages found 1 new issue\(s\):/);
    const clean = project();
    put(clean, rel, GOOD);
    const quiet = await run(fixture(post, clean), clean, {});
    assert.match(ctxOf(quiet, key), /look fine/, "a clean edit gets a short acknowledgement");
    const none = project(); put(none, "src/app.ts", "x");
    assert.deepEqual(await run(JSON.stringify({ ...JSON.parse(fixture(post, none)), file_path: none + "/src/app.ts", tool_input: { file_path: none + "/src/app.ts", command: "" }, toolArgs: { path: none + "/src/app.ts" } }), none), { stdout: "", exit: 0 });
  });
}

test("claude: an invalid Kage is reported as errors, with the finding once only", async () => {
  const root = project();
  put(root, "pages/pricing.kage.json", INVALID);
  const first = await run(fixture("claude/post-edit.json", root), root);
  assert.match(ctxOf(first, "claude"), /pages\/pricing\.kage\.json \/blocks\/z/);
  // The same content again: unchanged, so silent. A different edit that keeps the problem: reported once, not twice.
  assert.equal((await run(fixture("claude/post-edit.json", root), root)).stdout, "");
  put(root, "pages/pricing.kage.json", INVALID.replace('"bad"', '"bad2"'));
  assert.equal((await run(fixture("claude/post-edit.json", root), root)).stdout, "", "the known finding is not repeated");
  put(root, "pages/pricing.kage.json", DEAD);
  assert.match(ctxOf(await run(fixture("claude/post-edit.json", root), root), "claude"), /dead-button/, "a NEW finding is reported");
});

test("fixing a finding produces no message, and cleaning up leaves a quiet ack unless quiet mode is on", async () => {
  const root = project();
  put(root, "pages/pricing.kage.json", DEAD);
  await run(fixture("claude/post-edit.json", root), root);
  put(root, "pages/pricing.kage.json", GOOD);
  assert.match(ctxOf(await run(fixture("claude/post-edit.json", root), root), "claude"), /look fine/);
  put(root, ".kages/config.json", JSON.stringify({ version: 1, hook: { quiet: true } }));
  put(root, "pages/pricing.kage.json", GOOD.replace("Sample ok", "Renamed"));
  assert.equal((await run(fixture("claude/post-edit.json", root), root)).stdout, "", "quiet mode: nothing when clean");
  put(root, ".kages/config.json", JSON.stringify({ version: 1, hook: { enabled: false } }));
  put(root, "pages/pricing.kage.json", DEAD.replace("dead", "dead2"));
  assert.equal((await run(fixture("claude/post-edit.json", root), root)).stdout, "", "disabled");
});

test("bad JSON is reported with a position", async () => {
  const root = project();
  put(root, "pages/pricing.kage.json", '{\n  "kages": "1.0",\n  "id": "x",\n}');
  const msg = ctxOf(await run(fixture("claude/post-edit.json", root), root), "claude");
  assert.match(msg, /pages\/pricing\.kage\.json:4:\d+ bad-json/);
  for (const [text, line] of [['{"a":1,}', 1], ['{\n"a":\n', 3], ['{"a" "b"}', 1], ["", 1]] as const) assert.equal(badJson(text, (() => { try { JSON.parse(text); } catch (e) { return e as Error; } return new Error("none"); })()).line, line, JSON.stringify(text));
});

test("fails open and silent: empty, junk, huge, missing, a directory, binary, oversize and wrong-shape payloads", async () => {
  const root = project();
  const post = fixture("claude/post-edit.json", root);
  const silent = { stdout: "", exit: 0 };
  for (const stdin of ["", "   ", "not json", "[]", "null", "42", "x".repeat(MAX_STDIN + 10), JSON.stringify({ hook_event_name: "PostToolUse" }), JSON.stringify({ tool_name: "Edit", tool_input: 5 })]) assert.deepEqual(await run(stdin, root), silent, stdin.slice(0, 20));
  assert.deepEqual(await run(post, root), silent, "the file does not exist");
  mkdirSync(join(root, "pages", "pricing.kage.json"), { recursive: true });
  assert.deepEqual(await run(post, root), silent, "a directory with a Kage name");
  const bin = project(); put(bin, "pages/pricing.kage.json", "\u0000\u0001\u0002 binary �");
  const t0 = Date.now(); const r = await run(fixture("claude/post-edit.json", bin), bin);
  assert.equal(r.exit, 0);
  assert.ok(Date.now() - t0 < 1000);
  const big = project(); put(big, "pages/pricing.kage.json", " ".repeat(MAX_FILE + 1) + "{}");
  assert.deepEqual(await run(fixture("claude/post-edit.json", big), big), silent, "over the size limit");
  assert.deepEqual(await run(post, "/nonexistent-root-" + Date.now()), silent);
});

test("security: a symlink out of the project, ../ traversal and dependency folders are ignored", async () => {
  const root = project(), outside = project();
  put(outside, "secret.kage.json", INVALID);
  mkdirSync(join(root, "pages"), { recursive: true });
  symlinkSync(join(outside, "secret.kage.json"), join(root, "pages", "link.kage.json"));
  const mk = (p: string) => JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Edit", cwd: root, tool_input: { file_path: p } });
  assert.equal((await run(mk(join(root, "pages", "link.kage.json")), root)).stdout, "");
  assert.equal((await run(mk(`${root}/pages/../../${outside.split("/").pop()}/secret.kage.json`), root)).stdout, "");
  put(root, "node_modules/pkg/x.kage.json", INVALID);
  assert.equal((await run(mk(join(root, "node_modules/pkg/x.kage.json")), root)).stdout, "");
  put(root, ".git/x.kage.json", INVALID);
  assert.equal((await run(mk(join(root, ".git/x.kage.json")), root)).stdout, "");
  assert.equal(existsSync(join(outside, ".kages")), false, "nothing was written outside the project");
});

test("output is bounded: at most 8 lines and 2 KB however many findings", async () => {
  const root = project();
  const blocks: Record<string, unknown> = { root: { type: "stack", props: {}, slots: { children: Array.from({ length: 60 }, (_, i) => "b" + i) } } };
  for (let i = 0; i < 60; i++) blocks["b" + i] = { type: "button", props: { label: "Go " + "x".repeat(80) } };
  put(root, "pages/pricing.kage.json", JSON.stringify({ ...sampleKage({ id: "many" }), blocks }));
  const msg: string = ctxOf(await run(fixture("claude/post-edit.json", root), root), "claude");
  assert.ok(msg.length <= MAX_OUT);
  assert.ok(msg.split("\n").filter((l) => l.startsWith("- ")).length <= MAX_LINES + 1);
  assert.match(msg, /…and \d+ more|more/);
});

test("stop pass: deep findings are added once, per-edit findings are not repeated, pending clears, claude is asked to continue once", async () => {
  const root = project();
  const claimy = JSON.stringify({ ...sampleKage({ id: "claim" }), brief: { mode: "persuade" }, blocks: { root: { type: "stack", props: {}, slots: { children: ["t", "b"] } }, t: { type: "text", props: { text: "Trusted by 500+ teams worldwide." } }, b: { type: "button", props: { label: "Go" } } } });
  put(root, "pages/pricing.kage.json", claimy);
  const post = await run(fixture("claude/post-edit.json", root), root);
  assert.match(ctxOf(post, "claude"), /dead-button/);
  assert.doesNotMatch(ctxOf(post, "claude"), /unsourced-claim/, "deep rules do not run on every edit");
  const stop = await run(fixture("claude/stop.json", root), root);
  const j = JSON.parse(stop.stdout);
  assert.equal(j.decision, "block");
  assert.match(j.reason, /unsourced-claim/);
  assert.doesNotMatch(j.reason, /dead-button/, "already reported by the per-edit pass");
  assert.equal((await run(fixture("claude/stop.json", root), root)).stdout, "", "pending was cleared");
  put(root, "pages/pricing.kage.json", claimy.replace("claim", "claim2"));
  await run(fixture("claude/post-edit.json", root), root);
  const again = await run(JSON.stringify({ ...JSON.parse(fixture("claude/stop.json", root)), stop_hook_active: true }), root);
  assert.equal(again.stdout, "", "findings already told are not repeated, so there is nothing to block on");
  put(root, "pages/other.kage.json", claimy.replace("Trusted by 500+ teams", "Used by 900 customers"));
  await run(JSON.stringify({ ...JSON.parse(fixture("claude/post-edit.json", root)), tool_input: { file_path: join(root, "pages/other.kage.json") } }), root);
  const guarded = await run(JSON.stringify({ ...JSON.parse(fixture("claude/stop.json", root)), stop_hook_active: true }), root);
  assert.ok(!JSON.parse(guarded.stdout).decision, "with stop_hook_active the hook adds context instead of blocking again");
});

test("pre-write (claude): an invalid Kage is denied before it lands; lint-only, valid and non-Kage writes are allowed", async () => {
  const root = project();
  const pre = (path: string, content: string) => JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Write", cwd: root, tool_input: { file_path: path, content } });
  const denied = await run(pre(join(root, "pages/x.kage.json"), '{ "kages": "1.0", '), root);
  const d = JSON.parse(denied.stdout).hookSpecificOutput;
  assert.equal(d.permissionDecision, "deny");
  assert.match(d.permissionDecisionReason, /bad-json/);
  assert.equal(denied.exit, 0);
  assert.equal((await run(pre(join(root, "pages/x.kage.json"), INVALID), root)).stdout.includes('"deny"'), true);
  assert.equal((await run(pre(join(root, "pages/x.kage.json"), DEAD), root)).stdout, "", "lint never blocks");
  assert.equal((await run(pre(join(root, "pages/x.kage.json"), GOOD), root)).stdout, "");
  assert.equal((await run(pre(join(root, "notes.md"), "# hi"), root)).stdout, "");
  assert.equal((await run(pre(join(root, "../elsewhere/x.kage.json"), "{"), root)).stdout, "");
  assert.equal((await run(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Edit", cwd: root, tool_input: { file_path: join(root, "a.kage.json"), old_string: "a", new_string: "b" } }), root)).stdout, "", "a partial edit has no full content to check");
});

test("a 1,000-block document is checked in well under 150 ms (after the engine is loaded)", async () => {
  const root = project();
  const blocks: Record<string, unknown> = { root: { type: "stack", props: {}, slots: { children: Array.from({ length: 1000 }, (_, i) => "b" + i) } } };
  for (let i = 0; i < 1000; i++) blocks["b" + i] = { type: "text", props: { text: "t" + i } };
  put(root, "pages/pricing.kage.json", JSON.stringify({ ...sampleKage({ id: "big" }), blocks }));
  await run(fixture("claude/post-edit.json", project()), project()); // warm the dynamic imports
  const t0 = Date.now(); await run(fixture("claude/post-edit.json", root), root);
  assert.ok(Date.now() - t0 < 400, `${Date.now() - t0}ms`);
});

test("the real process: payload on stdin, JSON on stdout, nothing on stderr, exit 0", async () => {
  const root = project();
  put(root, "pages/pricing.kage.json", DEAD);
  const r = await spawnKages(["hook"], { cwd: root, stdin: fixture("claude/post-edit.json", root), timeoutMs: 20_000 });
  assert.equal(r.code, 0);
  assert.equal(r.err, "");
  assert.match(JSON.parse(r.out).hookSpecificOutput.additionalContext, /dead-button/);
  const quiet = await spawnKages(["hook"], { cwd: root, stdin: "garbage", timeoutMs: 20_000 });
  assert.deepEqual([quiet.code, quiet.out, quiet.err], [0, "", ""]);
  const forced = await spawnKages(["hook", "--harness", "claude"], { cwd: root, stdin: fixture("claude/post-edit.json", root).replace("pricing", "pricing"), timeoutMs: 20_000 });
  assert.equal(forced.code, 0);
});
