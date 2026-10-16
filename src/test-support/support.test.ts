import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpDir, withTmp } from "./tmp.ts";
import { runCli } from "./cli.ts";
import { gitRepo } from "./git.ts";
import { fakeHome } from "./harness.ts";
import { readNdjson } from "./ndjson.ts";
import { sampleKage, seedWorkspace } from "./fixtures.ts";
import { spawnKages } from "./spawn.ts";

test("withTmp removes the directory even when the callback throws", async () => {
  let seen = "";
  await assert.rejects(withTmp((d) => { seen = d; assert.ok(existsSync(d)); throw new Error("boom"); }), /boom/);
  assert.equal(existsSync(seen), false);
});

test("runCli captures output and restores process streams", async () => {
  const before = process.stdout.write;
  const r = await runCli(["systems"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /core/);
  assert.equal(process.stdout.write, before);
});

test("runCli leaves streams, env and cwd as it found them after a failing command", async () => {
  const before = { write: process.stdout.write, cwd: process.cwd(), home: process.env.KAGES_HOME };
  const dir = tmpDir();
  // A missing patch file fails the command; success or failure, process state must come back.
  await runCli(["patch", "nope", join(dir, "missing.json")], { cwd: dir, env: { KAGES_HOME: join(dir, ".kages") } }).catch(() => {});
  assert.equal(process.stdout.write, before.write);
  assert.equal(process.cwd(), before.cwd);
  assert.equal(process.env.KAGES_HOME, before.home);
});

test("runCli never uses the real config home", async () => {
  const r = await runCli(["whoami"]);
  assert.doesNotMatch(r.out + r.err, new RegExp((process.env.HOME ?? "/nonexistent") + "/.kages"));
});

test("gitRepo: ignore and tracking are observable", { skip: gitRepo() === null }, () => {
  const repo = gitRepo({ ".gitignore": "secret.txt\n", "a.txt": "a", "secret.txt": "s" }, { commit: true })!;
  assert.equal(repo.isIgnored("secret.txt"), true);
  assert.equal(repo.isIgnored("a.txt"), false);
  assert.deepEqual(repo.trackedFiles().sort(), [".gitignore", "a.txt"]);
});

test("fakeHome isolates HOME and keeps pre-existing settings", () => {
  const prev = process.env.HOME;
  const h = fakeHome({ claude: { "settings.json": '{"a":1}' }, cursor: {} });
  assert.equal(process.env.HOME, h.home);
  assert.notEqual(h.home, prev);
  assert.equal(h.read(".claude/settings.json"), '{"a":1}');
  assert.equal(h.exists(".cursor"), true);
  assert.equal(h.exists(".codex"), false);
});

test("readNdjson parses lines and fails on a torn line", () => {
  const d = tmpDir();
  const good = join(d, "good.ndjson"), torn = join(d, "torn.ndjson"), bad = join(d, "bad.ndjson");
  writeFileSync(good, '{"a":1}\n{"a":2}\n');
  writeFileSync(torn, '{"a":1}\n{"a":');
  writeFileSync(bad, '{"a":1}\nnot json\n');
  assert.deepEqual(readNdjson(good), [{ a: 1 }, { a: 2 }]);
  assert.throws(() => readNdjson(torn), /newline-terminated/);
  assert.throws(() => readNdjson(bad), /:2:/);
});

test("sampleKage is valid and seedWorkspace writes distinct files", async () => {
  const d = tmpDir();
  mkdirSync(join(d, "x"));
  const paths = seedWorkspace(d, 3);
  assert.equal(new Set(paths).size, 3);
  assert.equal(sampleKage({ id: "q" }).id, "q");
  const r = await runCli(["validate", paths[0]]);
  assert.equal(r.code, 0, r.out + r.err);
});

test("spawnKages runs the real binary and enforces the timeout", async () => {
  const ok = await spawnKages(["systems"]);
  assert.equal(ok.code, 0);
  assert.match(ok.out, /core/);
  const slow = await spawnKages(["systems"], { timeoutMs: 1 });
  assert.equal(slow.timedOut, true);
});
