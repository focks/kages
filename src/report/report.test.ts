import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { redact, redactDetailed, isSecretName } from "./redact.ts";
import { buildBundle, issueUrl, shownValue, DOC_LIMIT, type ReportInput } from "./bundle.ts";
import { reportCmd, type ReportDeps } from "../cli/report-cmd.ts";
import { runCli } from "../test-support/cli.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import { loadConfig } from "../config/load.ts";

// ---- the redaction corpus: what must go, and what must stay ------------------------------------

const MUST_CHANGE: [string, string, RegExp][] = [
  ["bearer token", "Authorization: Bearer abcdef1234567890abcdef", /Authorization: <redacted>/],
  ["bearer in prose", "sent Bearer abcdef1234567890abcdef to it", /Bearer <redacted>/],
  ["lowercase bearer", "bearer abcdef1234567890abcdef", /Bearer <redacted>/],
  ["authorization basic", "authorization: Basic dXNlcjpwYXNz", /authorization: <redacted>/],
  ["cookie header", "Cookie: sb-access=abc; other=def", /Cookie: <redacted>/],
  ["x-api-key header", "x-api-key: 1234567890", /x-api-key: <redacted>/],
  ["jwt", "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r", /<jwt>/],
  ["postgres url", "DATABASE_URL=postgres://user:hunter2@db.example.com:5432/kages", /<db-url>/],
  ["postgresql url", "postgresql://u:p@host/db?sslmode=require", /<db-url>/],
  ["mongodb srv", "mongodb+srv://a:b@cluster0.mongodb.net/x", /<db-url>/],
  ["redis url", "redis://:pw@cache.internal:6379", /<db-url>/],
  ["https basic auth", "https://bob:s3cret@example.com/path", /https:\/\/<credentials>@example\.com/],
  ["openai key", "key sk-abcdefghijklmnopqrstuvwx", /<api-key>/],
  ["anthropic key", "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123", /<api-key>/],
  ["github pat", "ghp_abcdefghijklmnopqrstuvwxyz0123456789", /<api-key>/],
  ["github fine pat", "github_pat_11ABCDEFG0abcdefghijklmnop_qrstuvwxyz", /<api-key>/],
  ["slack token", "xoxb-1234567890-abcdefghij", /<api-key>/],
  ["aws access key", "AKIAIOSFODNN7EXAMPLE", /<api-key>/],
  ["google key", "AIzaSyA1234567890abcdefghijklmnopqrstuv", /<api-key>/],
  ["supabase secret", "sb_secret_abcdefghijklmnopqrstuv", /<api-key>/],
  ["npm token", "npm_abcdefghijklmnopqrstuvwxyz0123456789", /<api-key>/],
  ["token assignment", "token=abcd1234efgh", /token=<redacted>/],
  ["json secret", '{"anonKey": "abc123def456"}', /"anonKey": "<redacted>"/],
  ["password colon", "password: hunter2hunter2", /password: <redacted>/],
  ["api_key env style", "OPENAI_API_KEY=zzzzzzzz1234", /OPENAI_API_KEY=<redacted>/],
  ["session json", '"session":"eyxxxxxxxx"', /<redacted>/],
  ["email", "contact jane.doe+kages@example.co.uk now", /<email>/],
  ["email in url", "mailto:a@b.io", /mailto:<email>/],
  ["linux home", "/home/alice/projects/kages/.kages/store.json", /^~\/projects/],
  ["mac home", "/Users/bob/Library/x", /^~\/Library/],
  ["windows home", "C:\\Users\\carol\\AppData\\x", /^~\\AppData/],
  ["10.x ip", "connect 10.0.4.17:5432", /<private-ip>:5432/],
  ["192.168 ip", "host 192.168.1.20", /<private-ip>/],
  ["172.16 ip", "172.20.5.9", /<private-ip>/],
  ["uppercase db scheme", "POSTGRES://u:p@h/d", /<db-url>/],
  ["quoted url", `url: "postgres://a:b@h/d"`, /"<db-url>"/],
  ["secret in sentence", "the client_secret is abcdefgh1234", /client_secret is abcdefgh1234|<redacted>/],
  ["private key name", "private_key=MIIEvQIBADANBgkq", /private_key=<redacted>/],
  ["passwd", "passwd=letmein99", /passwd=<redacted>/],
];
for (const [name, input, want] of MUST_CHANGE) test(`redacts: ${name}`, () => {
  const r = redact(input);
  assert.match(r, want, `${input} → ${r}`);
  assert.doesNotMatch(r, /hunter2|abcdef1234567890abcdef|dXNlcjpwYXNz|AKIAIOSFODNN7|s3cret|jane\.doe|alice|letmein99|MIIEvQ/, r);
});

const MUST_KEEP = [
  "commit 3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39",
  "block id hero-section-2 and rule id no-dead-button",
  "version 1.0.0 and node v22.22.1",
  "public ip 8.8.8.8 and 203.0.113.7",
  "172.32.0.1 is not private, 11.0.0.1 neither",
  "sk-short",
  "ask-me-anything-about-things-that-are-long",
  "the token count is high",
  "at /blocks/stat-1/props/value",
  "kages@1 and atelier@1.7.0",
  "https://github.com/focks/kages/issues/new",
  "user@ is not an email",
];
for (const s of MUST_KEEP) test(`keeps: ${s}`, () => assert.equal(redact(s), s));

test("redaction reports counts per class and replaces the real home directory even when it is not under /home", () => {
  const r = redactDetailed("a@b.co c@d.io /opt/me/x Bearer abcdefghijklmnop", { home: "/opt/me" });
  assert.deepEqual(r.counts, { email: 2, "home-path": 1, bearer: 1 });
  assert.equal(r.text, "<email> <email> ~/x Bearer <redacted>");
  assert.equal(redact("x /secretval1 y", { extra: ["/secretval1"] }), "x <redacted> y");
  assert.equal(redact("short", { extra: ["ab"] }), "short", "tiny extras would mangle ordinary words");
  assert.equal(redact(redact("a@b.co Bearer abcdefghijklmnop")), redact("a@b.co Bearer abcdefghijklmnop"), "idempotent");
});

test("secret names and shown values", () => {
  for (const n of ["session", "anonKey", "DATABASE_URL", "apiKey", "my_token", "client_secret"]) assert.ok(isSecretName(n), n);
  for (const n of ["advice.quiet", "hook.enabled", "screenshot.url"]) assert.ok(!isSecretName(n), n);
  assert.equal(shownValue("advice.quiet", true, false), "<boolean>");
  assert.equal(shownValue("screenshot.url", "http://x", false), "<string>");
  assert.equal(shownValue("screenshot.url", "http://x", true), '"http://x"');
  assert.equal(shownValue("session", "abc", true), "<redacted>", "--include-config-values still hides secrets");
});

// ---- the bundle ---------------------------------------------------------------------------------

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  versions: { kages: "1.0.0", node: "v22.0.0", platform: "linux", arch: "x64", packageManager: "npm/10", install: "bundle" },
  install: { version: "1.0.0", scope: "project", providers: ["claude"], hooks: ["claude"] },
  env: { DATABASE_URL: true, KAGES_TOKEN: false },
  config: { entries: [{ key: "advice.quiet", layer: "local", value: true }, { key: "session", layer: "user", value: "SESSIONSENTINEL" }], problems: [] },
  doctor: { ran: ["config"], findings: [{ id: "x", severity: "mention", area: "config", message: "see /home/alice/x" }] },
  harness: { detected: ["claude"], hooksInstalled: ["claude"] },
  adviceLog: { calls: 3, writes: 2, writesWithRegressions: 1 },
  ...over,
});

test("the markdown for a fixture is stable (snapshot)", () => {
  const md = buildBundle(input(), { home: "/home/alice" }).markdown;
  assert.match(md, /^> Nothing was sent anywhere\./);
  for (const h of ["Versions and environment", "Harness and hooks", "Config (which layer set each key)", "Doctor (1 finding)", "Advice log (counts only)"]) assert.ok(md.includes(`<summary>${h}</summary>`), h);
  assert.match(md, /\| `advice\.quiet` \| local \| <boolean> \|/);
  assert.match(md, /\| `session` \| user \| <redacted> \|/);
  assert.match(md, /`DATABASE_URL` \| yes/);
  assert.match(md, /see ~\/x/);
  assert.match(md, /_Excluded from this report: .*config values.*document text/);
  assert.ok(!md.includes("SESSIONSENTINEL") && !md.includes("alice"));
});

test("a Kage summary lists codes and places, never messages or text; the doc appears only when asked, fenced and truncated", () => {
  const kage = { name: "k", system: "core@1", versions: 3, blocks: 2, histogram: { text: 1, page: 1 }, validation: { errors: [{ code: "unknown-prop", at: "/blocks/a/props/x" }], warnings: [] }, lint: [{ rule: "no-dead-button", severity: "P1", at: "/blocks/b" }] };
  const md = buildBundle(input({ kage })).markdown;
  assert.match(md, /Block types: page×1, text×1/);
  assert.match(md, /- `unknown-prop` at `\/blocks\/a\/props\/x`/);
  assert.match(md, /- `no-dead-button` \(P1\) at `\/blocks\/b`/);
  assert.ok(!md.includes("Document (included"));
  const big = buildBundle(input({ kage: { ...kage, doc: "x".repeat(DOC_LIMIT + 10) } })).markdown;
  assert.match(big, /Document \(included at your request\)/);
  assert.match(big, new RegExp(`Truncated to ${DOC_LIMIT} characters of ${DOC_LIMIT + 10}`));
  assert.ok(buildBundle(input({ kage: { ...kage, doc: "a ``` b" } })).markdown.includes("~~~~json"), "a doc containing a fence gets a longer fence");
  assert.ok(!buildBundle(input({ kage: { ...kage, doc: "d" } })).excluded.some((e) => /document text/.test(e)));
});

test("the second pass redacts secrets that slipped into a typed field", () => {
  const b = buildBundle(input({ doctor: { ran: [], findings: [{ id: "x", severity: "route", area: "env", message: "bad postgres://u:pw@h/d and Bearer abcdefghijklmnop and a@b.co" }] } }));
  assert.ok(!/pw@|abcdefghijklmnop|a@b\.co/.test(b.markdown));
  assert.deepEqual(Object.keys(b.redactions).sort(), ["bearer", "db-url", "email"]);
});

test("issueUrl is capped, encoded, and keeps the title", () => {
  const url = issueUrl("https://github.com/o/r/", "[report] x", "y".repeat(20_000));
  assert.ok(url.length <= 7000, String(url.length));
  assert.ok(url.startsWith("https://github.com/o/r/issues/new?title=%5Breport%5D%20x&body="));
  assert.ok(issueUrl("https://github.com/o/r", "t", "short").includes(encodeURIComponent("short")));
});

// ---- the command, with every effect injected ---------------------------------------------------

function deps(over: Partial<ReportDeps> = {}): ReportDeps {
  return {
    versions: input().versions, env: { DATABASE_URL: "postgres://u:ENVSENTINEL@h/d", KAGES_TOKEN: "TOKENSENTINEL1234" }, home: "/home/alice",
    config: loadConfig({ readFile: () => null, userFile: "/x/user.json" }), doctor: null, manifest: null, detectedHarnesses: [], adviceLog: null,
    isTTY: false, confirm: async () => true, open: () => { throw new Error("must not open"); }, ...over,
  };
}
function capture() {
  const ro = process.stdout.write, re = process.stderr.write; let o = "", e = "";
  (process.stdout.write as unknown as (s: string) => boolean) = (s: string) => { o += s; return true; };
  (process.stderr.write as unknown as (s: string) => boolean) = (s: string) => { e += s; return true; };
  return { get out() { return o; }, get err() { return e; }, restore() { process.stdout.write = ro; process.stderr.write = re; } };
}

test("with the network stubbed to throw, report still succeeds and prints no env value", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("network used"); }) as typeof fetch;
  const c = capture();
  try { assert.equal(await reportCmd({}, deps()), 0); } finally { c.restore(); globalThis.fetch = realFetch; }
  assert.ok(!/ENVSENTINEL|TOKENSENTINEL/.test(c.out));
  assert.match(c.out, /`DATABASE_URL` \| yes/);
});

test("--include-doc needs --kage, asks first, and only the document sentinel appears", async () => {
  const doc = sampleKage({ id: "k" }); doc.title = "DOCSENTINEL";
  let c = capture();
  try { assert.equal(await reportCmd({ "include-doc": true }, deps()), 1); } finally { c.restore(); }
  assert.match(c.err, /needs --kage/);
  c = capture();
  try { assert.equal(await reportCmd({ "include-doc": true }, deps({ kage: { name: "k", doc, versions: 2 }, confirm: async () => false })), 1); } finally { c.restore(); }
  assert.ok(!c.out.includes("DOCSENTINEL") && /Not included/.test(c.err));
  c = capture();
  try { assert.equal(await reportCmd({ "include-doc": true }, deps({ kage: { name: "k", doc, versions: 2 } })), 0); } finally { c.restore(); }
  assert.ok(c.out.includes("DOCSENTINEL"));
  assert.ok(!/ENVSENTINEL|TOKENSENTINEL/.test(c.out));
  assert.match(c.err, /adds the full text of 'k'/);
});

test("--out writes mode 0600, refuses to overwrite without --force, and --verify prints counts", async () => {
  const file = join(tmpDir("kages-report-"), "r.md");
  let c = capture();
  try { assert.equal(await reportCmd({ out: file, verify: true }, deps()), 0); } finally { c.restore(); }
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(c.out, "", "nothing on stdout when writing to a file");
  assert.match(c.err, /Redacted: /);
  assert.ok(!readFileSync(file, "utf8").includes("ENVSENTINEL"));
  c = capture();
  try { assert.equal(await reportCmd({ out: file }, deps()), 1); } finally { c.restore(); }
  assert.match(c.err, /pass --force/);
  c = capture();
  try { assert.equal(await reportCmd({ out: file, force: true }, deps()), 0); } finally { c.restore(); }
});

test("--open refuses without a terminal, opens only after consent, and never includes the report in the URL", async () => {
  let c = capture();
  try { assert.equal(await reportCmd({ open: true }, deps()), 1); } finally { c.restore(); }
  assert.match(c.err, /needs an interactive terminal/);
  const opened = [] as string[];
  c = capture();
  try { assert.equal(await reportCmd({ open: true }, deps({ isTTY: true, confirm: async () => false, open: (u) => opened.push(u) })), 0); } finally { c.restore(); }
  assert.equal(opened.length, 0);
  c = capture();
  try { assert.equal(await reportCmd({ open: true }, deps({ isTTY: true, open: (u) => opened.push(u) })), 0); } finally { c.restore(); }
  assert.equal(opened.length, 1);
  assert.ok(opened[0].length <= 7000 && opened[0].startsWith("https://github.com/focks/kages/issues/new?"));
  assert.ok(!/ENVSENTINEL|TOKENSENTINEL|Doctor/.test(decodeURIComponent(opened[0])));
});

// ---- the real CLI in a seeded workspace --------------------------------------------------------

test("sentinel run: secrets in env, user config, workspace config, a document, a comment and the brief never appear; the acceptance case passes", async () => {
  const proj = tmpDir("kages-rp-"), ws = join(proj, ".kages"), cfgHome = tmpDir("kages-rpcfg-");
  mkdirSync(ws, { recursive: true });
  const env = { KAGES_CONFIG_HOME: cfgHome, DATABASE_URL: "postgres://dbuser:DBSENTINEL@db.internal/kages", KAGES_TOKEN: "TOKSENTINEL-abcdef123456" };
  writeFileSync(join(cfgHome, "config.json"), JSON.stringify({ session: "USERSENTINEL-eyabcdef", advice: { quiet: true } }));
  writeFileSync(join(ws, "config.json"), JSON.stringify({ hook: { quiet: true } }));
  const doc = sampleKage({ id: "secret-page" }); doc.title = "DOCSENTINEL title";
  writeFileSync(join(proj, "secret-page.kage.json"), JSON.stringify(doc));
  const run = (args: string[]) => runCli(args, { cwd: proj, env });
  assert.equal((await run(["create", "secret-page.kage.json", "--local"])).code, 0);
  writeFileSync(join(proj, "brief.json"), JSON.stringify({ users: "BRIEFSENTINEL people", purpose: "BRIEFSENTINEL purpose" }));
  const briefed = await run(["brief", "set", "--file", "brief.json", "--local"]);
  assert.equal(briefed.code, 0, briefed.err);
  assert.equal((await run(["comment", "secret-page", "root", "COMMENTSENTINEL please", "--local"])).code, 0);
  // Prove the sentinels really are in the workspace, so their absence from the report means something.
  const stored = readFileSync(join(ws, "store.json"), "utf8");
  for (const s of ["BRIEFSENTINEL", "COMMENTSENTINEL", "DOCSENTINEL"]) assert.ok(stored.includes(s), `${s} was not seeded`);

  const realFetch = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("network used"); }) as typeof fetch;
  let r;
  try { r = await run(["report", "--kage", "secret-page", "--verify", "--include-config-values"]); } finally { globalThis.fetch = realFetch; }
  assert.equal(r.code, 0, r.err);
  for (const s of ["DBSENTINEL", "TOKSENTINEL", "USERSENTINEL", "DOCSENTINEL", "BRIEFSENTINEL", "COMMENTSENTINEL", "dbuser"]) assert.ok(!r.out.includes(s) && !r.err.includes(s), `${s} leaked`);
  assert.match(r.out, /`DATABASE_URL` \| yes/);
  assert.match(r.out, /Kage `secret-page`/);
  assert.match(r.out, /advice\.quiet` \| user \| true/);
  assert.match(r.err, /Excluded:/);
  assert.ok(!existsSync(join(proj, "report.md")), "nothing is written unless --out");
});
