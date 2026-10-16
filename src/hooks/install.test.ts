import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { setupHooks, plan, ALL_HARNESSES, type InstallOptions } from "./install.ts";
import { planInstall, planUninstall, MANIFESTS, MARKER, LAUNCHER_SH } from "./manifest.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { fakeHome } from "../test-support/harness.ts";
import { runCli } from "../test-support/cli.ts";
import type { HarnessId } from "../hooks/harnesses.ts";

const FILE: Record<HarnessId, string> = { claude: ".claude/settings.local.json", cursor: ".cursor/hooks.json", codex: ".codex/hooks.json", copilot: ".github/hooks/kages.json" };
const OTHER: Record<HarnessId, object> = {
  claude: { permissions: { allow: ["Bash(ls)"] }, hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] }], SessionStart: [{ hooks: [{ type: "command", command: "date" }] }] } },
  cursor: { version: 1, hooks: { beforeShellExecution: [{ command: "./audit.sh" }], afterFileEdit: [{ command: "./format.sh" }] } },
  codex: { hooks: { PostToolUse: [{ matcher: "apply_patch", hooks: [{ type: "command", command: "python3 mine.py" }] }] } },
  copilot: { version: 1, hooks: { preToolUse: [{ type: "command", bash: "./policy.sh" }], postToolUse: [{ type: "command", bash: "./log.sh" }] } },
};
const pretty = (o: object) => JSON.stringify(o, null, 2) + "\n";
function env(): { project: string; home: string; o: (h: HarnessId[], extra?: Partial<InstallOptions>) => InstallOptions } {
  const project = tmpDir("kages-proj-"), home = fakeHome().home;
  return { project, home, o: (harnesses, extra = {}) => ({ harnesses, scope: "project", projectDir: project, homeDir: home, yes: true, ...extra }) };
}
const read = (p: string) => readFileSync(p, "utf8");
const put = (root: string, rel: string, text: string) => { mkdirSync(join(root, rel, ".."), { recursive: true }); writeFileSync(join(root, rel), text); };

for (const h of ALL_HARNESSES) {
  test(`${h}: fresh install writes our entries; the same run again changes nothing`, async () => {
    const e = env();
    const first = await setupHooks(e.o([h]));
    assert.equal(first.exit, 0, first.lines.join("\n"));
    const file = join(e.project, FILE[h]);
    const text = read(file);
    assert.ok(text.includes(MARKER) && text.endsWith("\n"));
    assert.ok(existsSync(join(e.project, ".kages/bin", MARKER)));
    assert.equal(statSync(join(e.project, ".kages/bin", MARKER)).mode & 0o111, 0o111, "the launcher is executable");
    const second = await setupHooks(e.o([h]));
    assert.match(second.lines.join("\n"), /already installed/);
    assert.deepEqual(second.changed, []);
    assert.equal(read(file), text);
  });

  test(`${h}: unrelated settings survive install, and uninstall restores the file byte for byte`, async () => {
    const e = env();
    const original = pretty(OTHER[h]);
    put(e.project, FILE[h], original);
    const r = await setupHooks(e.o([h]));
    assert.equal(r.exit, 0);
    const mid = JSON.parse(read(join(e.project, FILE[h])));
    const flat = JSON.stringify(mid);
    for (const keep of JSON.stringify(OTHER[h]).match(/"(echo mine|date|\.\/audit\.sh|\.\/format\.sh|python3 mine\.py|\.\/policy\.sh|\.\/log\.sh|Bash\(ls\))"/g) ?? []) assert.ok(flat.includes(keep.slice(1, -1)), `lost ${keep}`);
    const un = await setupHooks(e.o([h], { uninstall: true }));
    assert.equal(un.exit, 0);
    assert.equal(read(join(e.project, FILE[h])), original, "restored exactly");
  });

  test(`${h}: uninstalling a file we created removes it`, async () => {
    const e = env();
    await setupHooks(e.o([h]));
    await setupHooks(e.o([h], { uninstall: true }));
    assert.equal(existsSync(join(e.project, FILE[h])), false);
  });
}

test("dry run shows the diff and writes nothing", async () => {
  const e = env();
  const r = await setupHooks(e.o(["claude"], { dryRun: true }));
  assert.match(r.lines.join("\n"), /\+ +"PostToolUse"/);
  assert.match(r.lines.join("\n"), /dry run: nothing was written/);
  assert.equal(existsSync(join(e.project, ".claude")), false);
  assert.equal(existsSync(join(e.project, ".kages")), false);
});

test("a malformed existing file aborts every harness and is untouched; --force backs it up, never over an earlier backup", async () => {
  const e = env();
  put(e.project, FILE.claude, "{ not json");
  const r = await setupHooks(e.o(["claude", "cursor"]));
  assert.equal(r.exit, 1);
  assert.match(r.lines.join("\n"), /claude: .*not valid JSON.*--force/);
  assert.equal(read(join(e.project, FILE.claude)), "{ not json");
  assert.equal(existsSync(join(e.project, FILE.cursor)), false, "nothing is written when any harness has a problem");
  const forced = await setupHooks(e.o(["claude"], { force: true }));
  assert.equal(forced.exit, 0);
  assert.equal(read(join(e.project, FILE.claude) + ".bak"), "{ not json");
  assert.ok(read(join(e.project, FILE.claude)).includes(MARKER));
  put(e.project, FILE.claude, "{ broken again");
  await setupHooks(e.o(["claude"], { force: true }));
  assert.equal(read(join(e.project, FILE.claude) + ".bak.1"), "{ broken again");
  assert.equal(read(join(e.project, FILE.claude) + ".bak"), "{ not json", "an existing backup is never overwritten");
});

test("consent: accepted and declined are remembered; non-interactive without --yes writes nothing; --no-hooks records nothing", async () => {
  const e = env();
  const remembered: string[] = [];
  const no = await setupHooks({ ...e.o(["claude"], { yes: false }), confirm: async () => false, recordConsent: (v) => remembered.push(v) });
  assert.equal(existsSync(join(e.project, FILE.claude)), false);
  assert.deepEqual(remembered, ["declined"]);
  assert.match(no.lines.join("\n"), /no changes made/);
  const yes = await setupHooks({ ...e.o(["claude"], { yes: false }), confirm: async () => true, recordConsent: (v) => remembered.push(v) });
  assert.equal(yes.exit, 0);
  assert.deepEqual(remembered, ["declined", "accepted"]);
  const e2 = env();
  const nonTty = await setupHooks(e2.o(["claude"], { yes: false }));
  assert.match(nonTty.lines.join("\n"), /without consent/);
  assert.equal(existsSync(join(e2.project, FILE.claude)), false);
  const skipped: string[] = [];
  const nh = await setupHooks({ ...e2.o(["claude"], { noHooks: true }), recordConsent: (v) => skipped.push(v) });
  assert.deepEqual(skipped, []);
  assert.equal(nh.skipped, true);
});

test("an interrupted write leaves the old file intact and no temp file behind", async () => {
  const e = env();
  const original = pretty(OTHER.claude);
  put(e.project, FILE.claude, original);
  await assert.rejects(setupHooks(e.o(["claude"], { rename: () => { throw new Error("disk gone"); } })), /disk gone/);
  assert.equal(read(join(e.project, FILE.claude)), original);
  assert.deepEqual(readdirSync(join(e.project, ".claude")).filter((f) => f.endsWith(".tmp")), []);
});

test("file mode is preserved when we rewrite an existing config", async () => {
  const e = env();
  put(e.project, FILE.claude, pretty(OTHER.claude));
  chmodSync(join(e.project, FILE.claude), 0o600);
  await setupHooks(e.o(["claude"]));
  assert.equal(statSync(join(e.project, FILE.claude)).mode & 0o777, 0o600);
});

test("scope: global writes under the (fake) home, never the real one; cursor has no verified global location", async () => {
  const e = env();
  const r = await setupHooks(e.o(["claude", "cursor"], { scope: "global" }));
  assert.ok(existsSync(join(e.home, ".claude/settings.json")));
  assert.match(r.lines.join("\n"), /cursor: no verified global-scope location/);
  assert.ok(existsSync(join(e.home, ".kages/bin", MARKER)));
  assert.equal(existsSync(join(e.project, ".claude")), false);
});

test("the commands name the launcher and the harness; the shared copilot file uses a relative path", () => {
  const e = env();
  const claude = plan(e.o(["claude"])).changes[0].after!;
  assert.ok(claude.includes(`\\"${e.project}/.kages/bin/${MARKER}\\" --harness claude --event post`), claude);
  assert.match(claude, /--event pre/);
  assert.match(claude, /"matcher": "Edit\|Write\|MultiEdit"/);
  const copilot = plan(e.o(["copilot"])).changes[0].after!;
  assert.match(copilot, new RegExp(`"bash": "\\./\\.kages/bin/${MARKER} --harness copilot --event post"`));
  assert.match(plan(e.o(["codex"])).changes[0].after!, /"matcher": "apply_patch"/);
  assert.match(plan(e.o(["cursor"])).changes[0].after!, /"afterFileEdit"/);
});

test("pure planners: indentation and a missing trailing newline are kept; re-planning is a no-op", () => {
  const tabbed = '{\n\t"hooks": {\n\t\t"Stop": []\n\t}\n}';
  const p = planInstall({ harness: "claude", command: () => `x/${MARKER}` }, tabbed);
  assert.match(p.after!, /\n\t"hooks"/);
  assert.equal(planInstall({ harness: "claude", command: () => `x/${MARKER}` }, p.after).changed, false);
  assert.deepEqual(planUninstall("claude", null), { after: null, changed: false, actions: [] });
  assert.throws(() => planInstall({ harness: "claude", command: () => "x" }, "[]", "f.json"), /must be a JSON object/);
  for (const h of ALL_HARNESSES) assert.ok(MANIFESTS[h].trust.length > 20);
});

test("the launcher: silent exit 0 when kages is missing, and it passes args and stdin to a real one", () => {
  const dir = tmpDir("kages-launch-");
  const sh = join(dir, MARKER);
  writeFileSync(sh, LAUNCHER_SH); chmodSync(sh, 0o755);
  const clean = spawnSync(sh, ["--event", "post"], { cwd: dir, env: { PATH: "/usr/bin:/bin", HOME: dir } as unknown as NodeJS.ProcessEnv, input: "payload", encoding: "utf8" });
  assert.deepEqual([clean.status, clean.stdout, clean.stderr], [0, "", ""]);
  const bin = join(dir, "bin"); mkdirSync(bin);
  writeFileSync(join(bin, "kages"), '#!/bin/sh\necho "ran: $@"; cat\n'); chmodSync(join(bin, "kages"), 0o755);
  const real = spawnSync(sh, ["--event", "post"], { cwd: dir, env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir } as unknown as NodeJS.ProcessEnv, input: "payload", encoding: "utf8" });
  assert.equal(real.stdout, "ran: hook --event post\npayload");
  void execFileSync;
});

test("CLI: setup hooks --dry-run through the real command", async () => {
  const e = env();
  const r = await runCli(["setup", "hooks", "--harness", "claude", "--dry-run"], { cwd: e.project });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /claude: .*settings\.local\.json \(new file\)/);
  const bad = await runCli(["setup", "hooks", "--harness", "grok", "--dry-run"], { cwd: e.project });
  assert.equal(bad.code, 1);
  assert.match(bad.err, /grok has no verified hook format/);
});
