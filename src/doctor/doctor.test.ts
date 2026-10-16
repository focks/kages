import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runDoctor, doctorLite, formatDoctor } from "./run.ts";
import { buildDoctorCtx } from "./context.ts";
import { CHECKS } from "./checks.ts";
import { Store } from "../store/store.ts";
import { loadStore, saveStore, owner } from "../cli/workspace.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import { gitRepo } from "../test-support/git.ts";
import { fakeHome } from "../test-support/harness.ts";
import { runCli } from "../test-support/cli.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { skillMd } from "../packs/packs.ts";

const hasGit = gitRepo() !== null;
const ids = (r: { findings: { id: string }[] }) => r.findings.map((f) => f.id).sort();
// A throwaway home on every context: the real one has real installed skills, which the doctor would rightly report.
const ctxFor = (root: string, store: Store | null, extra = {}) => buildDoctorCtx({ dir: join(root, ".kages"), store, author: owner(), configHome: join(root, ".cfg"), home: fakeHome().home, env: {}, ...extra });
const tree = (dir: string): string[] => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => join(d.parentPath, d.name)).sort();

test("a fresh, initialised workspace has no findings", { skip: !hasGit }, async () => {
  const repo = gitRepo({ "package.json": '{"name":"acme"}' }, { commit: true })!;
  writeFileSync(join(repo.dir, "a.json"), JSON.stringify({ users: "u", purpose: "p", absent: "x", voice: "v", constraints: "c" }));
  repo.git("add", "a.json"); repo.git("commit", "-q", "-m", "answers");
  assert.equal((await runCli(["init", "--answers", "a.json"], { cwd: repo.dir })).code, 0);
  const out = await runCli(["doctor", "--json"], { cwd: repo.dir, env: { HOME: fakeHome().home } });
  assert.deepEqual(JSON.parse(out.out).findings, [], out.out);
});

test("every check can run on an empty directory and finds nothing", async () => {
  const root = tmpDir();
  const r = await runDoctor(ctxFor(root, null));
  assert.deepEqual(r.findings, []);
  assert.equal(r.ran.length, CHECKS.length);
});

function seeded(): { root: string; home: string } {
  const repo = gitRepo({ "README.md": "x", ".kages/screenshots/a.png": "png", ".claude/keep": "", "public/ds/bundle.js": "// old bundle" }, { commit: true })!;
  const root = repo.dir, ws = join(root, ".kages"), home = fakeHome().home;
  // A store with a kage, a stale critique and a comment, then damaged by hand.
  const store = new Store(); store.grant(owner().principal, "kages", ["read", "write", "admin"]);
  store.create("kages", sampleKage({ id: "k" }), owner());
  store.saveCritique("k", { fingerprint: store.head("k")!.digest, scores: { 1: 2, 2: 2, 3: 2 } }, owner());
  store.patch("k", [{ op: "replace", path: "/title", value: "Changed" }], owner());
  store.comment("k", "", owner().principal, "hello");
  saveStore(ws, store);
  const snap = JSON.parse(readFileSync(join(ws, "store.json"), "utf8"));
  snap.comments.push({ ...snap.comments[0], id: "c99", kage: "ghost" });
  delete snap.briefs;
  writeFileSync(join(ws, "store.json"), JSON.stringify(snap));
  writeFileSync(join(ws, "config.local.json"), "{ nope");
  writeFileSync(join(ws, "config.json"), JSON.stringify({ version: 1, session: { access_token: "SECRET-TOKEN" }, mystery: 1 }));
  writeFileSync(join(ws, "brief.md"), "# Workspace brief\n\n## Users\n\nHand edited\n\n## Purpose\n\nx\n");
  mkdirSync(join(root, ".cursor"), { recursive: true });
  writeFileSync(join(root, ".cursor/hooks.json"), JSON.stringify({ version: 1, hooks: { afterFileEdit: [{ command: `"${root}/.kages/bin/kages-hook" --harness cursor --event post` }] } }));
  mkdirSync(join(home, ".claude/skills/kages-core"), { recursive: true });
  writeFileSync(join(home, ".claude/skills/kages-core/SKILL.md"), "old skill");
  return { root, home };
}

test("seeded corruption: each planted fault is reported with the right id, severity and fix", { skip: !hasGit }, async () => {
  const { root, home } = seeded();
  const store = loadStore(join(root, ".kages"));
  store.setBrief({ users: "u", purpose: "p" }, owner());
  const r = await runDoctor(ctxFor(root, store, { home }));
  const got = new Map(r.findings.map((f) => [f.id, f]));
  for (const id of ["config-invalid-json", "config-secret-in-tracked", "config-unknown-key", "brief-store-mismatch", "store-legacy-snapshot", "store-orphans", "hooks-missing", "hooks-stale", "gitignore-block-missing", "tracked-runtime-file", "critique-stale", "skills-stale", "bundle-drift"]) assert.ok(got.has(id), `missing ${id}; got ${ids(r)}`);
  assert.equal(got.get("store-legacy-snapshot")!.severity, "auto");
  assert.equal(got.get("critique-stale")!.severity, "mention");
  assert.equal(got.get("config-unknown-key")!.severity, "mention");
  assert.equal(got.get("store-orphans")!.fix!.safe, true);
  assert.equal(got.get("gitignore-block-missing")!.fix!.command, "kages gitignore --write");
  assert.match(got.get("tracked-runtime-file")!.fix!.command, /^git rm --cached -- \.kages\/screenshots\/a\.png$/);
  assert.match(got.get("hooks-missing")!.fix!.command, /setup hooks --harness claude/);
  assert.match(got.get("hooks-stale")!.message, /no longer exists/);
  assert.equal(got.get("config-secret-in-tracked")!.severity, "route");
  assert.equal(JSON.stringify(r).includes("SECRET-TOKEN"), false, "a credential is named, never echoed");
});

test("doctor never writes without --fix; --fix applies only safe findings and a second run is a no-op", { skip: !hasGit }, async () => {
  const { root, home } = seeded();
  const before = tree(root).map((f) => [f, readFileSync(f, "utf8")]);
  const dry = await runCli(["doctor", "--json"], { cwd: root, env: { HOME: home } });
  assert.deepEqual(tree(root).map((f) => [f, readFileSync(f, "utf8")]), before, "report only");
  const ids1 = JSON.parse(dry.out).findings.map((f: { id: string }) => f.id);
  assert.ok(ids1.includes("store-orphans") && ids1.includes("gitignore-block-missing"));
  const fixed = await runCli(["doctor", "--fix", "--json"], { cwd: root, env: { HOME: home } });
  const after = JSON.parse(fixed.out);
  assert.ok(after.fixed.length >= 2);
  const left = after.findings.map((f: { id: string }) => f.id);
  assert.ok(!left.includes("store-orphans") && !left.includes("gitignore-block-missing"), left.join());
  assert.ok(left.includes("hooks-stale") && left.includes("brief-store-mismatch") && left.includes("config-invalid-json"), "unsafe findings are left for a person");
  const again = await runCli(["doctor", "--fix", "--json"], { cwd: root, env: { HOME: home } });
  assert.deepEqual(JSON.parse(again.out).fixed, []);
});

test("exit codes: 0 by default, 1 with --strict when something needs action", { skip: !hasGit }, async () => {
  const { root, home } = seeded();
  assert.equal((await runCli(["doctor"], { cwd: root, env: { HOME: home } })).code, 0);
  assert.equal((await runCli(["doctor", "--strict"], { cwd: root, env: { HOME: home } })).code, 1);
  const clean = tmpDir();
  assert.equal((await runCli(["doctor", "--strict"], { cwd: clean, env: { HOME: fakeHome().home } })).code, 0);
});

test("doctor.ignore silences a finding id; --area limits what runs", { skip: !hasGit }, async () => {
  const { root, home } = seeded();
  const ws = join(root, ".kages");
  const cfg = JSON.parse(readFileSync(join(ws, "config.json"), "utf8"));
  delete cfg.session; cfg.doctor = { ignore: ["config-unknown-key", "bundle-drift"] };
  writeFileSync(join(ws, "config.json"), JSON.stringify(cfg));
  const r = JSON.parse((await runCli(["doctor", "--json"], { cwd: root, env: { HOME: home } })).out);
  assert.ok(!r.findings.some((f: { id: string }) => f.id === "config-unknown-key" || f.id === "bundle-drift"));
  const only = JSON.parse((await runCli(["doctor", "--json", "--area", "gitignore"], { cwd: root, env: { HOME: home } })).out);
  assert.ok(only.findings.every((f: { area: string }) => f.area === "gitignore"));
});

test("the database check names no part of the connection string and only runs online", async () => {
  const root = tmpDir();
  const url = "postgres://user:hunter2@db.example.test:5432/kages";
  const calls: string[] = [];
  const off = await runDoctor(ctxFor(root, null, { env: { DATABASE_URL: url }, ping: undefined }));
  assert.deepEqual(off.findings, []);
  const down = await runDoctor(ctxFor(root, null, { env: { DATABASE_URL: url }, ping: async (u: string) => { calls.push(u); return "connection refused"; } }));
  assert.deepEqual(down.findings.map((f) => f.id), ["env-db-unreachable"]);
  assert.equal(JSON.stringify(down).includes("hunter2"), false);
  assert.equal(JSON.stringify(down).includes("db.example.test"), false);
  const up = await runDoctor(ctxFor(root, null, { env: { DATABASE_URL: url }, ping: async () => null }));
  assert.deepEqual(up.findings, []);
});

test("old node and a stale harness verification date are reported", async () => {
  const root = tmpDir();
  const old = await runDoctor({ ...ctxFor(root, null), nodeVersion: "16.20.0" });
  assert.deepEqual(old.findings.map((f) => f.id), ["env-node"]);
  const far = await runDoctor({ ...ctxFor(root, null), now: Date.parse("2027-12-01") });
  assert.ok(far.findings.some((f) => f.id === "hooks-schema-old"));
});

test("an installed skill that matches this version is fine; one that does not is stale", async () => {
  const root = tmpDir(), home = fakeHome().home;
  mkdirSync(join(home, ".claude/skills/kages-core"), { recursive: true });
  writeFileSync(join(home, ".claude/skills/kages-core/SKILL.md"), skillMd("core"));
  assert.deepEqual((await runDoctor({ ...ctxFor(root, null), home })).findings, []);
  writeFileSync(join(home, ".claude/skills/kages-core/SKILL.md"), skillMd("core") + "\nold");
  assert.deepEqual(ids(await runDoctor({ ...ctxFor(root, null), home })), ["skills-stale"]);
});

test("doctorLite is cheap and leaves out the slow and the merely informational", { skip: !hasGit }, async () => {
  const { root } = seeded();
  const t0 = Date.now();
  const lite = await doctorLite(ctxFor(root, null));
  assert.ok(Date.now() - t0 < 500);
  const got = lite.map((f) => f.id);
  assert.ok(got.includes("gitignore-block-missing"));
  assert.ok(!got.includes("store-orphans") && !got.includes("critique-stale"), "no store walk");
});

test("the formatter groups by area, shows the fix and says which are safe", async () => {
  const text = formatDoctor({ version: 1, ran: ["x"], findings: [
    { id: "gitignore-block-missing", severity: "route", area: "gitignore", message: "no block", fix: { command: "kages gitignore --write", safe: true } },
    { id: "critique-stale", severity: "mention", area: "critique", message: "old" },
    { id: "store-legacy-snapshot", severity: "auto", area: "store", message: "later" },
  ] });
  assert.match(text, /^gitignore\n  ✗ gitignore-block-missing: no block\n      → kages gitignore --write   \(doctor --fix does this\)/);
  assert.match(text, /1 to act on, 1 to know about, 1 that fix themselves\./);
  assert.match(formatDoctor({ version: 1, ran: ["a", "b"], findings: [] }), /^✓ No drift found \(a, b\)\.$/);
  assert.equal(existsSync(join(tmpDir(), "none")), false);
});

test("kages context carries a CONTEXT_STALE directive when the cheap checks find drift, and none on a healthy project", { skip: !hasGit }, async () => {
  const stale = gitRepo({ "package.json": "{}" }, { commit: true })!;
  mkdirSync(join(stale.dir, ".kages"), { recursive: true });
  const env = { HOME: fakeHome().home };
  const a = JSON.parse((await runCli(["context", "--json", "--local"], { cwd: stale.dir, env })).out);
  assert.ok(a.directives.some((d: { code: string; command: string }) => d.code === "CONTEXT_STALE" && d.command === "kages doctor"));
  assert.match(a.text, /CONTEXT_STALE/);
  writeFileSync(join(stale.dir, "ans.json"), JSON.stringify({ users: "u", purpose: "p" }));
  await runCli(["init", "--answers", "ans.json"], { cwd: stale.dir, env });
  const b = JSON.parse((await runCli(["context", "--json", "--local"], { cwd: stale.dir, env })).out);
  assert.ok(!b.directives.some((d: { code: string }) => d.code === "CONTEXT_STALE"));
});
