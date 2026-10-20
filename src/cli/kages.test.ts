// CLI behaviour: arg parsing, offline commands, the workspace lifecycle (which
// proves on-disk persistence), and store snapshot/restore keeping signatures
// verifiable. The CLI is an adapter, so these mirror the operation table — the
// point is the command plumbing and the persistent workspace, not re-testing
// engine logic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./args.ts";
import { runCli } from "../test-support/cli.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { setupSkills } from "./setup.ts";
import { Store } from "../store/store.ts";
import { verifyDigest } from "../store/crypto.ts";
import type { KageDoc } from "../engine/types.ts";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const FIXTURE = join(repoRoot, "public/ds/ops-console.kage.json");

const cli = runCli;
const tmpWorkspace = () => tmpDir("kages-cli-");

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

test("from-markdown: --json together with --create stores the Kage and reports it", async () => {
  const dir = tmpWorkspace(), md = join(dir, "both.md");
  writeFileSync(md, "# Both flags\n\nIntro.\n\n## One\n\nText.\n");
  const run = (...a: string[]) => cli([...a, "--local", "-C", dir]);
  await run("init");
  const r = await run("--json", "from-markdown", md, "--create"); assert.equal(r.code, 0, r.err);
  assert.match(JSON.parse(r.out).created.version.ref, /both-flags@v1/);
  assert.match((await run("ls")).out, /both-flags/, "the Kage was actually stored, not only printed");
});

test("lint: --list names every rule, findings gate on P0/P1, waivers and ignoreRules apply", async () => {
  const dir = tmpWorkspace(), ws = join(dir, ".kages");
  const doc = (extra: object = {}) => JSON.stringify({ kages: "1.0", id: "l", title: "L", system: "core@1", root: "root", blocks: { root: { type: "stack", props: {}, slots: { children: ["b"] } }, b: { type: "button", props: { label: "Go" } } }, ...extra });
  const file = join(dir, "l.kage.json");
  writeFileSync(file, doc());
  const list = await cli(["lint", "--list"]);
  assert.equal(list.code, 0);
  assert.match(list.out, /dead-button\s+P1/);
  const r = await cli(["lint", file, "--json"]);
  assert.equal(r.code, 2, "P1 finding exits 2");
  assert.equal(JSON.parse(r.out).findings[0].rule, "dead-button");
  writeFileSync(file, doc({ meta: { kages: { lint: { ignore: [{ rule: "dead-button", reason: "decorative preview" }] } } } }));
  const waived = await cli(["lint", file]);
  assert.equal(waived.code, 0);
  assert.match(waived.out, /clean \(1 waived\)/);
  writeFileSync(file, doc());
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, "config.json"), JSON.stringify({ version: 1, lint: { ignoreRules: ["dead-button"] } }));
  assert.equal((await cli(["-C", ws, "lint", file])).code, 0, "workspace ignoreRules applies");
  const explain = await cli(["lint", "--explain", "dead-button"]);
  assert.match(explain.out, /Pressing it does nothing/);
});

test("brief: set → show → export → import round-trips, and a stale revision conflicts", async () => {
  const dir = tmpWorkspace(), ws = ["-C", join(dir, ".kages")];
  const jf = join(dir, "b.json"), md = join(dir, "brief.md");
  writeFileSync(jf, JSON.stringify({ users: "Partners who query shared data", purpose: "Help them self-serve", constraints: ["WCAG AA"], absent: ["testimonials"] }));
  assert.equal((await cli([...ws, "init"])).code, 0);
  const set = await cli([...ws, "brief", "set", "--file", jf, "--local"]);
  assert.equal(set.code, 0, set.out + set.err);
  assert.match(set.out, /revision 1/);
  assert.match((await cli([...ws, "brief", "show", "--local"])).out, /Partners who query shared data/);
  assert.equal((await cli([...ws, "brief", "export", "-o", md, "--local"])).code, 0);
  assert.match(readFileSync(md, "utf8"), /## Absent\n\n- testimonials/);
  const again = await cli([...ws, "brief", "import", "--file", md, "--base-revision", "1", "--local"]);
  assert.match(again.out, /revision 2/, again.out + again.err);
  const same = await cli([...ws, "brief", "show", "--json", "--local"]);
  assert.deepEqual(JSON.parse(same.out).brief, { schema: 1, users: "Partners who query shared data", purpose: "Help them self-serve", constraints: ["WCAG AA"], absent: ["testimonials"] });
  const stale = await cli([...ws, "brief", "set", "--file", jf, "--base-revision", "1", "--local"]);
  assert.equal(stale.code, 1);
  assert.match(stale.err, /conflict/);
});

test("brief: show on an empty workspace says how to start", async () => {
  const dir = tmpWorkspace();
  const r = await cli(["-C", join(dir, ".kages"), "brief", "show", "--local"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /no workspace brief yet/);
});

test("from-markdown --mode records a declared mode; describe labels declared and inferred", async () => {
  const dir = tmpWorkspace(), md = join(dir, "g.md"), out = join(dir, "g.kage.json");
  writeFileSync(md, "# Guide\n\nSome prose.\n\n## One\n\nText.\n");
  assert.equal((await cli(["from-markdown", md, "-o", out, "--mode", "read"])).code, 0);
  assert.equal(JSON.parse(readFileSync(out, "utf8")).brief.mode, "read");
  assert.match((await cli(["describe", out])).out, /^mode: read \(declared\)\n/);
  const plain = join(dir, "p.kage.json");
  assert.equal((await cli(["from-markdown", md, "-o", plain])).code, 0);
  assert.equal(JSON.parse(readFileSync(plain, "utf8")).brief, undefined, "no mode is recorded unless asked");
  assert.match((await cli(["describe", plain])).out, /^mode: \w+ \(inferred, (low|medium) confidence\)\n/);
  const bad = await cli(["from-markdown", md, "--mode", "loud"]);
  assert.equal(bad.code, 1);
  assert.match(bad.err, /mode must be one of/);
});

test("system card and contrast commands", async () => {
  const card = await cli(["system", "card", "ledger"]);
  assert.equal(card.code, 0);
  assert.match(card.out, /^---\nsystem: ledger\nversion: /);
  assert.match(card.out, /## Known issues\n\nNone/);
  const tokens = await cli(["system", "card", "atelier", "--tokens"]);
  assert.match(tokens.out, /^system: atelier/);
  assert.doesNotMatch(tokens.out, /## Colour/);
  const c = await cli(["system", "contrast", "core"]);
  assert.equal(c.code, 0);
  assert.match(c.out, /all declared pairs pass/);
  assert.equal(JSON.parse((await cli(["system", "contrast", "core", "--json"])).out).failing, 0);
  assert.equal((await cli(["system", "card", "nope"])).code, 1);
});

test("context: a fresh workspace says what to do first; a brief clears it; a Kage adds its findings", async () => {
  const dir = tmpWorkspace(), ws = ["-C", join(dir, ".kages")];
  const first = await cli([...ws, "context", "--local"]);
  assert.equal(first.code, 0, first.err);
  assert.match(first.out, /\[warn\] NO_BRIEF:/);
  assert.match(first.out, /run: kages init/);
  const jf = join(dir, "b.json");
  writeFileSync(jf, JSON.stringify({ users: "Partners", purpose: "Self-serve" }));
  await cli([...ws, "brief", "set", "--file", jf, "--local"]);
  const kf = join(dir, "k.kage.json");
  writeFileSync(kf, JSON.stringify({ kages: "1.0", id: "k", title: "K", system: "core@1", root: "root", blocks: { root: { type: "stack", props: {}, slots: { children: ["b"] } }, b: { type: "button", props: { label: "Go" } } } }));
  await cli([...ws, "create", kf, "--local"]);
  const j = JSON.parse((await cli([...ws, "context", "k", "--json", "--local"])).out);
  assert.ok(!j.directives.some((d: { code: string }) => d.code === "NO_BRIEF"));
  assert.deepEqual(j.kage.findings.top.map((f: { code: string }) => f.code), ["dead-button"]);
  assert.ok(j.directives.some((d: { code: string }) => d.code === "LINT_P1"));
});

test("patch --dry-run reports the verdict and writes nothing", async () => {
  const dir = tmpWorkspace(), ws = ["-C", join(dir, ".kages")];
  const kf = join(dir, "k.kage.json"), pf = join(dir, "p.json"), bad = join(dir, "bad.json");
  writeFileSync(kf, JSON.stringify({ kages: "1.0", id: "k", title: "K", system: "core@1", root: "root", blocks: { root: { type: "stack", props: {}, slots: { children: ["t"] } }, t: { type: "text", props: { text: "hi" } } } }));
  writeFileSync(pf, JSON.stringify([{ op: "replace", path: "/blocks/t/props/text", value: "hello" }]));
  writeFileSync(bad, JSON.stringify([{ op: "remove", path: "/blocks/ghost" }]));
  await cli([...ws, "create", kf, "--local"]);
  const ok = await cli([...ws, "patch", "k", pf, "--dry-run", "--local"]);
  assert.equal(ok.code, 0, ok.out + ok.err);
  assert.match(ok.out, /would create v2 \(nothing was written\)/);
  assert.match(ok.out, /~1 changed \(t\)/);
  const refused = await cli([...ws, "patch", "k", bad, "--dry-run", "--local"]);
  assert.equal(refused.code, 1);
  assert.match(refused.out, /would be refused: invalid_patch: op 0 \(remove \/blocks\/ghost\)/);
  assert.match((await cli([...ws, "versions", "k", "--local"])).out, /^V\s.*\nv1 /m);
  assert.doesNotMatch((await cli([...ws, "versions", "k", "--local"])).out, /v2/, "no version was created");
});

test("create and patch print new findings once; --advice quiet is silent when clean", async () => {
  const dir = tmpWorkspace(), ws = ["-C", join(dir, ".kages")];
  const kf = join(dir, "k.kage.json"), p1 = join(dir, "p1.json"), p2 = join(dir, "p2.json");
  writeFileSync(kf, JSON.stringify({ kages: "1.0", id: "k", title: "K", system: "core@1", root: "root", blocks: { root: { type: "stack", props: {}, slots: { children: ["t"] } }, t: { type: "text", props: { text: "hi" } } } }));
  writeFileSync(p1, JSON.stringify([{ op: "add", path: "/blocks/b", value: { type: "button", props: { label: "Go" } } }, { op: "add", path: "/blocks/root/slots/children/-", value: "b" }]));
  writeFileSync(p2, JSON.stringify([{ op: "replace", path: "/blocks/t/props/text", value: "hello" }]));
  const created = await cli([...ws, "create", kf, "--local"]);
  assert.match(created.out, /created kages:\/\/local\/kages\/k@v1\n  ✓ no new findings/);
  const bad = await cli([...ws, "patch", "k", p1, "--local"]);
  assert.match(bad.out, /P1 \/blocks\/b {2}dead-button/);
  const next = await cli([...ws, "patch", "k", p2, "--local"]);
  assert.doesNotMatch(next.out, /dead-button/, "already reported, not repeated");
  assert.match(next.out, /no new findings, 1 existing not repeated/);
  const quiet = await cli([...ws, "patch", "k", p2, "--advice", "quiet", "--local"]);
  assert.equal(quiet.out.trim().split("\n").length, 1, "quiet and clean prints only the result line");
});

test("help lists every command the CLI handles (a command nobody can discover is not shipped)", async () => {
  const src = readFileSync(fileURLToPath(new URL("./kages.ts", import.meta.url)), "utf8");
  const verbs = [...src.matchAll(/^\s*case "([a-z-]+)"/gm)].map((m) => m[1]).filter((v) => !["version", "help", "list"].includes(v));
  const help = (await cli(["help"])).out;
  const missing = [...new Set(verbs)].filter((v) => !new RegExp(`^\\s+${v}\\b`, "m").test(help) && !help.includes(` | ${v}`) && !new RegExp(`\\| ${v}\\b`).test(help));
  assert.deepEqual(missing, []);
});

test("screenshot: -o file.png with several widths is refused before any browser starts", async () => {
  const r = await cli(["screenshot", FIXTURE, "-o", join(tmpWorkspace(), "a.png"), "--width", "390,1200"]);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /one --width/);
});

test("resolveDoc reads only regular *.kage.json files, so a Kage name cannot be used to probe other files", async () => {
  const dir = tmpWorkspace();
  const secret = join(dir, "notes.txt"); writeFileSync(secret, "not json but secret-token-123");
  const probe = await cli(["validate", secret]);
  assert.notEqual(probe.code, 0);
  assert.doesNotMatch(probe.out + probe.err, /secret-token-123/, "the file's content must not appear in a parse error");
  assert.match(probe.err, /no file or stored Kage/);
  mkdirSync(join(dir, "ops.kage.json"));
  const asDir = await cli(["validate", join(dir, "ops.kage.json")]);
  assert.notEqual(asDir.code, 0);
  assert.doesNotMatch(asDir.err, /EISDIR/, "a directory is not read as a file");
  assert.equal((await cli(["validate", FIXTURE])).code, 0, "a real *.kage.json still works");
});

test("designs: set from a brand colour, list, show, use on a Kage, delete", async () => {
  const dir = tmpWorkspace(), ws = ["-C", join(dir, ".kages")];
  const empty = await cli([...ws, "designs", "list", "--local"]);
  assert.match(empty.out, /no designs yet/);
  const set = await cli([...ws, "designs", "set", "--name", "Brand Blue", "--brand", "#0b5fff", "--base", "ledger", "--default", "--local"]);
  assert.equal(set.code, 0, set.out + set.err); assert.match(set.out, /design 'brand-blue' saved \(revision 1\)/);
  assert.doesNotMatch(set.out, /^!/m, "a generated palette passes every contrast pair");
  assert.match((await cli([...ws, "designs", "list", "--local"])).out, /\* brand-blue\s+ledger\s+rev 1\s+Brand Blue/);
  assert.match((await cli([...ws, "designs", "show", "brand-blue", "--local"])).out, /all 42 contrast checks pass/);
  assert.match((await cli([...ws, "designs", "show", "brand-blue", "--css", "--local"])).out, /^\.kg-kage\.kg-design\{--kg-paper:#/m);
  const stale = await cli([...ws, "designs", "set", "--name", "Brand Blue", "--brand", "#0b5fff", "--base-revision", "5", "--local"]);
  assert.equal(stale.code, 1); assert.match(stale.err + stale.out, /revision/);
  // A Kage created after a default exists starts in it; `use` changes it later and `none` removes it.
  assert.equal((await cli([...ws, "create", FIXTURE, "--local"])).code, 0);
  const use = await cli([...ws, "designs", "use", "ops-console", "none", "--local"]);
  assert.equal(use.code, 0, use.out + use.err); assert.match(use.out, /design removed/);
  assert.match((await cli([...ws, "designs", "use", "ops-console", "none", "--local"])).out, /already has no design/);
  assert.match((await cli([...ws, "designs", "use", "ops-console", "brand-blue", "--keep-system", "--local"])).out, /now uses 'brand-blue'/);
  assert.equal((await cli([...ws, "designs", "use", "ops-console", "ghost", "--local"])).code, 1);
  assert.equal((await cli([...ws, "designs", "set", "--id", "x", "--name", "X", "--local"])).code, 0, "a design with nothing overridden is valid: it is just the base system");
  assert.equal((await cli([...ws, "designs", "delete", "x", "--local"])).code, 0);
  assert.equal((await cli([...ws, "designs", "delete", "x", "--local"])).code, 1, "a second delete is not_found");
});
