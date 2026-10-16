import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { applyBlock, renderBlock, status, ensureRuntimeDir } from "./gitignore.ts";
import { gitRepo } from "../test-support/git.ts";
import { runCli } from "../test-support/cli.ts";
import { tmpDir } from "../test-support/tmp.ts";

const block = renderBlock();
const hasGit = gitRepo() !== null;

test("applyBlock: append, idempotent, replace in place, never touch other lines", () => {
  const base = "node_modules\n.env\n";
  const a = applyBlock(base, block);
  assert.ok(a.changed && a.text.startsWith(base));
  assert.equal(applyBlock(a.text, block).changed, false, "second apply is a no-op");
  const edited = a.text.replace("**/.kages/cache/", "**/.kages/hacked/");
  assert.equal(status(edited, block), "stale");
  const fixed = applyBlock(edited + "after-the-block\n", block);
  assert.equal(status(fixed.text, block), "current");
  assert.ok(fixed.text.endsWith("after-the-block\n") && fixed.text.startsWith(base));
});

test("applyBlock keeps CRLF, handles a missing trailing newline and an empty file", () => {
  const crlf = applyBlock("a\r\nb\r\n", block).text;
  assert.ok(!/(^|[^\r])\n/.test(crlf), "no bare LF in a CRLF file");
  assert.ok(crlf.startsWith("a\r\nb\r\n"));
  const noNl = applyBlock("a", block).text;
  assert.ok(noNl.startsWith("a\n\n# kages-ignore-start"));
  assert.equal(applyBlock("", block).text, block.join("\n") + "\n");
});

test("an older block version reads as stale, a half block as unbalanced", () => {
  const old = block.join("\n").replace("start v1", "start v0");
  assert.equal(status(old, block), "stale");
  assert.equal(status("# kages-ignore-start v1\nfoo\n", block), "unbalanced");
  assert.throws(() => applyBlock("# kages-ignore-end\n", block), /unbalanced/);
});

test("--track-store leaves store.json out of the block", () => {
  assert.ok(renderBlock().some((l) => l.endsWith("store.json")));
  assert.ok(!renderBlock({ trackStore: true }).some((l) => l.endsWith("store.json")));
});

test("ensureRuntimeDir makes a folder that ignores itself", () => {
  const d = join(tmpDir(), "shots");
  ensureRuntimeDir(d);
  assert.equal(readFileSync(join(d, ".gitignore"), "utf8"), "*\n");
  writeFileSync(join(d, ".gitignore"), "custom\n");
  ensureRuntimeDir(d);
  assert.equal(readFileSync(join(d, ".gitignore"), "utf8"), "custom\n", "never overwrites");
});

test("git: ignored runtime files are ignored, shared artifacts are not", { skip: !hasGit }, async () => {
  const repo = gitRepo({ "README.md": "x" }, { commit: true })!;
  let r = await runCli(["gitignore"], { cwd: repo.dir });
  assert.equal(r.code, 2, r.out);
  r = await runCli(["gitignore", "--write"], { cwd: repo.dir });
  assert.equal(r.code, 0, r.out);
  const before = readFileSync(join(repo.dir, ".gitignore"), "utf8");
  await runCli(["gitignore", "--write"], { cwd: repo.dir });
  assert.equal(readFileSync(join(repo.dir, ".gitignore"), "utf8"), before, "byte-identical on rewrite");
  assert.equal((await runCli(["gitignore"], { cwd: repo.dir })).code, 0);
  for (const p of ["store.json", "config.local.json", "screenshots/a.png", "cache/x", "review/x", "report/x", "advice.log.ndjson", "advice.log.ndjson.1", "hook.cache.json", "hook.pending.json"])
    assert.equal(repo.isIgnored(`.kages/${p}`), true, p);
  for (const p of ["config.json", "brief.md", "critique/2026.md"]) assert.equal(repo.isIgnored(`.kages/${p}`), false, p);
});

test("git: a nested workspace matches through **/", { skip: !hasGit }, async () => {
  const repo = gitRepo({ "apps/web/package.json": "{}" }, { commit: true })!;
  await runCli(["gitignore", "--write"], { cwd: repo.dir });
  assert.equal(repo.isIgnored("apps/web/.kages/store.json"), true);
  assert.equal(repo.isIgnored("apps/web/.kages/config.json"), false);
});

test("git: already-tracked ephemeral files get a printed hint and are left alone", { skip: !hasGit }, async () => {
  const repo = gitRepo({ ".kages/screenshots/a.png": "png" }, { commit: true })!;
  const r = await runCli(["gitignore", "--write"], { cwd: repo.dir });
  assert.match(r.out, /git rm --cached -- \.kages\/screenshots\/a\.png/);
  assert.deepEqual(repo.trackedFiles(), [".kages/screenshots/a.png"], "nothing was untracked for the user");
});

test("outside a git repo nothing is written and the exit is 0", async () => {
  const d = tmpDir();
  mkdirSync(d, { recursive: true });
  const r = await runCli(["gitignore", "--write"], { cwd: d, env: { GIT_CEILING_DIRECTORIES: join(d, "..") } });
  assert.equal(r.code, 0);
  assert.match(r.out, /not inside a git repository/);
  assert.equal(existsSync(join(d, ".gitignore")), false);
});
