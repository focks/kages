// CLI behaviour: arg parsing, offline commands, the workspace lifecycle (which
// proves on-disk persistence), and store snapshot/restore keeping signatures
// verifiable. The CLI is an adapter, so these mirror the operation table — the
// point is the command plumbing and the persistent workspace, not re-testing
// engine logic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./args.ts";
import { main } from "./kages.ts";
import { setupSkills } from "./setup.ts";
import { Store } from "../store/store.ts";
import { verifyDigest } from "../store/crypto.ts";
import type { KageDoc } from "../engine/types.ts";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const FIXTURE = join(repoRoot, "public/ds/ops-console.kage.json");

// Isolate from any real ~/.kages session so the CLI stays in local mode (never
// hits the network) regardless of whether the test machine is signed in.
process.env.KAGES_CONFIG_HOME = mkdtempSync(join(tmpdir(), "kages-cfg-"));

/** Run the CLI capturing stdout/stderr and the exit code. */
async function cli(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const realOut = process.stdout.write.bind(process.stdout);
  const realErr = process.stderr.write.bind(process.stderr);
  let out = "", err = "";
  (process.stdout.write as unknown as (s: string) => boolean) = (s: string) => { out += s; return true; };
  (process.stderr.write as unknown as (s: string) => boolean) = (s: string) => { err += s; return true; };
  try {
    const code = await main(argv);
    return { code, out, err };
  } finally {
    process.stdout.write = realOut;
    process.stderr.write = realErr;
  }
}

const tmpWorkspace = () => mkdtempSync(join(tmpdir(), "kages-cli-"));

test("parseArgs: positionals, flags, aliases, JSON values", () => {
  const p = parseArgs(["create", "a.json", "--repo", "kages", "-s", "ledger", "--json"]);
  assert.deepEqual(p.positionals, ["create", "a.json"]);
  assert.equal(p.flags.repo, "kages");
  assert.equal(p.flags.system, "ledger"); // -s alias
  assert.equal(p.flags.json, true);
  const q = parseArgs(["--days", "7", "--ops", "[1,2]"]);
  assert.equal(q.flags.days, 7); // numeric JSON
  assert.deepEqual(q.flags.ops, [1, 2]); // array JSON
  assert.equal(parseArgs(["x", "--", "--not-a-flag"]).positionals.at(-1), "--not-a-flag");
});

test("parseArgs: a repeated flag collects into an array; single use stays scalar", () => {
  const p = parseArgs(["setup", "skills", "--harness", "codex", "--harness", "claude"]);
  assert.deepEqual(p.flags.harness, ["codex", "claude"]);
  assert.equal(parseArgs(["--harness", "codex"]).flags.harness, "codex");
});

test("setup skills installs one SKILL.md per system into the harness dir", () => {
  const home = mkdtempSync(join(tmpdir(), "kages-home-"));
  process.env.HOME = home; // homedir() reads $HOME
  assert.equal(setupSkills(["claude"]), 0);
  const skill = readFileSync(join(home, ".claude/skills/kages-core/SKILL.md"), "utf8");
  assert.match(skill, /name: kages-core/);
});

test("help and version exit 0", async () => {
  assert.equal((await cli([])).code, 0);
  assert.equal((await cli(["help"])).code, 0);
  const v = await cli(["version"]);
  assert.equal(v.code, 0);
  assert.match(v.out, /kages 1\.0\.0/);
});

test("systems --json lists three design systems", async () => {
  const r = await cli(["systems", "--json"]);
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.out).length, 3);
});

test("validate: clean file exits 0, invalid file exits 1", async () => {
  const ok = await cli(["validate", FIXTURE]);
  assert.equal(ok.code, 0);
  assert.match(ok.out, /valid/);

  const badPath = join(tmpdir(), "bad.kage.json");
  writeFileSync(badPath, JSON.stringify({ kages: "1.0", id: "bad", title: "x", system: "core@1", root: "ghost", blocks: {} }));
  const bad = await cli(["validate", badPath]);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /missing-root/);
});

test("contract and catalog resolve, unknowns error", async () => {
  assert.equal((await cli(["contract", "core/stat@1.0.0", "--json"])).code, 0);
  assert.equal((await cli(["catalog", "core"])).code, 0);
  assert.equal((await cli(["contract", "nope/x@1"])).code, 1);
  assert.equal((await cli(["catalog", "nope"])).code, 1);
});

test("workspace lifecycle persists to disk across commands", async () => {
  const dir = tmpWorkspace();
  const w = ["--workspace", dir];

  assert.equal((await cli(["create", FIXTURE, ...w])).code, 0);

  // A fresh `ls` reloads the store from disk — proves the create was persisted.
  const ls = await cli(["ls", "--json", ...w]);
  const cards = JSON.parse(ls.out);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].name, "ops-console");
  assert.equal(cards[0].state, "draft");

  // Patch → new version; publish → state change.
  const patchPath = join(dir, "p.json");
  writeFileSync(patchPath, JSON.stringify([{ op: "replace", path: "/title", value: "Ops v2" }]));
  assert.equal((await cli(["patch", "ops-console", patchPath, ...w])).code, 0);
  assert.equal((await cli(["publish", "ops-console", "--visibility", "workspace", ...w])).code, 0);

  const versions = JSON.parse((await cli(["versions", "ops-console", "--json", ...w])).out);
  assert.equal(versions.length, 2);
  assert.equal(versions[1].state, "published");

  const got = JSON.parse((await cli(["get", "ops-console", "--json", ...w])).out) as KageDoc;
  assert.equal(got.title, "Ops v2");
});

test("store snapshot/restore keeps versions and verifiable signatures", () => {
  const store = new Store({ workspace: "local" });
  store.grant("user:focks", "kages", ["write", "publish"]);
  const doc = JSON.parse(readFileSync(FIXTURE, "utf8")) as KageDoc;
  const created = store.create("kages", doc, { principal: "user:focks" });
  assert.ok(created.ok);

  const restored = Store.restore(store.snapshot());
  const head = restored.head("ops-console")!;
  assert.equal(head.v, 1);
  assert.equal(head.doc.title, doc.title);
  // The signer travelled in the snapshot, so the digest still verifies.
  assert.ok(verifyDigest(restored.publicKeyOf("user:focks"), head.digest, head.signature));
});

test("discussion commands: comment, pin, reply, list as a thread, resolve, and the self-vote rule", async () => {
  const dir = tmpWorkspace();
  const run = (...a: string[]) => cli([...a, "--local", "-C", dir]);
  await run("init");
  assert.equal((await run("create", FIXTURE)).code, 0);
  const first = await run("comment", "ops-console", "-", "Great start overall"); assert.equal(first.code, 0, first.err); assert.match(first.out, /comment c1$/m);
  const pinned = await run("comment", "ops-console", "kpiRevenue", "Needs a caption", "--at", "0.25,0.75"); assert.equal(pinned.code, 0, pinned.err); assert.match(pinned.out, /comment c2 on kpiRevenue/);
  assert.equal((await run("reply", "ops-console", "c2", "Added one")).code, 0);
  const listed = await run("comments", "ops-console"); assert.equal(listed.code, 0);
  assert.match(listed.out, /c2 user:\S+ @kpiRevenue \(0\.25,0\.75\)/); assert.match(listed.out, /^ {2}c3 /m, "the reply is indented under its parent"); assert.match(listed.out, /Needs a caption/);
  assert.equal((await run("resolve", "c2")).out.trim(), "c2 resolved"); assert.match((await run("comments", "ops-console")).out, /✓resolved/);
  assert.equal((await run("resolve", "c2", "--reopen")).out.trim(), "c2 reopened");
  const self = await run("vote", "c1", "up"); assert.notEqual(self.code, 0, "you cannot vote on your own comment"); assert.match(self.err, /own comment/);
  assert.notEqual((await run("vote", "c1", "sideways")).code, 0);
  assert.notEqual((await run("comment", "ops-console", "ghostBlock", "x")).code, 0, "an unknown block is refused");
  assert.notEqual((await run("comment", "ops-console", "kpiRevenue", "x", "--at", "2,0.5")).code, 0, "an out-of-range pin is refused");
  assert.notEqual((await run("comment", "ops-console", "-", "x", "--at", "banana")).code, 0);
  assert.match((await run("comments", "nothing-here")).err, /./);
});

test("from-markdown: prose to a Kage file, then stored with --create, with notes on stderr", async () => {
  const dir = tmpWorkspace(), md = join(dir, "guide.md"), out = join(dir, "guide.kage.json");
  writeFileSync(md, "# CLI guide\n\nHow to use it.\n\n## Install\n\n```sh\nnpm i\n```\n\n```py\npip install\n```\n\n## Use\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n## Done\n\n> **Tip:** that is all\n");
  const run = (...a: string[]) => cli([...a, "--local", "-C", dir]);
  await run("init");
  const wrote = await run("from-markdown", md, "-o", out); assert.equal(wrote.code, 0, wrote.err);
  assert.match(wrote.err, /became tabs/); assert.match(wrote.err, /sticky table of contents/);
  const doc = JSON.parse(readFileSync(out, "utf8")); assert.equal(doc.id, "cli-guide"); assert.equal(doc.blocks.hero.props.description, "How to use it.");
  assert.equal((await run("validate", out)).code, 0);
  const made = await run("from-markdown", md, "--create"); assert.equal(made.code, 0, made.err); assert.match(made.out, /created kages:\/\/local\/kages\/cli-guide@v1/);
  assert.equal((await run("from-markdown", md, "--title", "Renamed", "--id", "renamed", "--create")).code, 0);
  assert.match((await run("ls")).out, /renamed/);
  const empty = join(dir, "empty.md"); writeFileSync(empty, "  \n"); assert.notEqual((await run("from-markdown", empty)).code, 0);
  const json = await run("from-markdown", md, "--json"); assert.equal(JSON.parse(json.out).validation.ok, true);
});
