import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./load.ts";
import { setKey, unsetKey } from "./write.ts";
import { validateLayer } from "./schema.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { runCli } from "../test-support/cli.ts";

const files = (m: Record<string, string>) => (p: string) => (p in m ? m[p] : null);
const base = { userFile: "/u/config.json", workspaceDir: "/w" };

test("precedence: defaults < user < workspace < local < env < flags", () => {
  const f = files({
    "/u/config.json": '{"advice":{"minSeverity":"P3"}}',
    "/w/config.json": '{"advice":{"minSeverity":"P1"}}',
    "/w/config.local.json": '{"advice":{"minSeverity":"P0"}}',
  });
  const at = (extra: object) => loadConfig({ ...base, readFile: f, ...extra });
  assert.deepEqual([at({}).value.advice?.minSeverity, at({}).sources["advice.minSeverity"]], ["P0", "local"]);
  const env = at({ env: { KAGES_ADVICE_MIN_SEVERITY: "P2" } });
  assert.deepEqual([env.value.advice?.minSeverity, env.sources["advice.minSeverity"]], ["P2", "env"]);
  const flag = at({ env: { KAGES_ADVICE_MIN_SEVERITY: "P2" }, flags: { "advice.minSeverity": "P1" } });
  assert.deepEqual([flag.value.advice?.minSeverity, flag.sources["advice.minSeverity"]], ["P1", "flag"]);
  assert.equal(loadConfig({ ...base, readFile: files({}) }).sources["advice.minSeverity"], "default");
});

test("each lower layer applies when higher ones are silent", () => {
  const r = loadConfig({ ...base, readFile: files({ "/u/config.json": '{"report":{"redact":"none"}}', "/w/config.json": '{"hook":{"quiet":true}}' }) });
  assert.equal(r.value.report?.redact, "none");
  assert.equal(r.sources["report.redact"], "user");
  assert.equal(r.value.hook?.quiet, true);
  assert.equal(r.value.hook?.enabled, true); // from defaults, merged beside the workspace's quiet
});

test("env booleans: 0 is false, not truthy", () => {
  const r = loadConfig({ ...base, readFile: files({}), env: { KAGES_ADVICE_QUIET: "0" } });
  assert.deepEqual([r.value.advice?.quiet, r.sources["advice.quiet"]], [false, "env"]);
});

test("a session in a workspace file is refused and ignored; the user file may hold it", () => {
  const bad = loadConfig({ ...base, readFile: files({ "/w/config.json": '{"session":{"access_token":"t"},"hook":{"quiet":true}}' }) });
  assert.match(bad.problems[0].message, /\/w\/config.json.*session.*user config/);
  assert.equal(bad.value.hook?.quiet, false); // the whole shared file is dropped, not half-applied
  assert.equal(loadConfig({ ...base, readFile: files({ "/u/config.json": '{"session":{"access_token":"t"}}' }) }).problems.length, 0);
});

test("malformed JSON and bad types are reported without throwing", () => {
  const r = loadConfig({ ...base, readFile: files({ "/w/config.json": "{nope", "/w/config.local.json": '{"advice":{"quiet":"yes"}}' }) });
  assert.equal(r.problems.length, 2);
  assert.match(r.problems.map((p) => p.message).join("\n"), /not valid JSON[\s\S]*advice.quiet must be true or false/);
  assert.equal(r.value.advice?.quiet, false);
});

test("unknown keys survive a set", () => {
  const dir = tmpDir(), file = join(dir, "config.json");
  writeFileSync(file, JSON.stringify({ theirs: { keep: 1 } }));
  setKey(file, "advice.quiet", "true");
  const obj = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual(obj.theirs, { keep: 1 });
  assert.equal(obj.advice.quiet, true);
  assert.equal(obj.version, 1);
});

test("malformed file aborts a write; --force backs it up", () => {
  const dir = tmpDir(), file = join(dir, "config.json");
  writeFileSync(file, "{broken");
  assert.throws(() => setKey(file, "advice.quiet", "true"), /not valid JSON.*--force/);
  assert.equal(readFileSync(file, "utf8"), "{broken");
  setKey(file, "advice.quiet", "true", { force: true });
  assert.equal(readFileSync(file + ".bak", "utf8"), "{broken");
  writeFileSync(file, "{again");
  setKey(file, "advice.quiet", "false", { force: true });
  assert.equal(readFileSync(file + ".bak.1", "utf8"), "{again"); // never overwrite an existing backup
});

test("an interrupted write leaves the old file intact and no temp file", () => {
  const dir = tmpDir(), file = join(dir, "config.json");
  writeFileSync(file, '{"version":1,"advice":{"quiet":false}}\n');
  assert.throws(() => setKey(file, "advice.quiet", "true", {}, { rename: () => { throw new Error("disk gone"); } }), /disk gone/);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).advice.quiet, false);
  assert.deepEqual(readdirSync(dir), ["config.json"]);
});

test("unset removes the key and the containers it empties", () => {
  const dir = tmpDir(), file = join(dir, "config.json");
  setKey(file, "advice.quiet", "true");
  assert.equal(unsetKey(file, "advice.quiet"), true);
  assert.equal("advice" in JSON.parse(readFileSync(file, "utf8")), false);
  assert.equal(unsetKey(file, "advice.quiet"), false);
});

test("lint waivers need a reason", () => {
  assert.equal(validateLayer({ lint: { ignoreBlocks: [{ rule: "r", block: "b", reason: "ok" }] } }, "f").length, 0);
  assert.equal(validateLayer({ lint: { ignoreBlocks: [{ rule: "r", block: "b", reason: " " }] } }, "f").length, 1);
});

test("CLI: set writes shared keys to config.json and machine keys to config.local.json", async () => {
  const dir = tmpDir(), env = { KAGES_HOME: dir };
  assert.equal((await runCli(["config", "set", "advice.quiet", "true"], { env })).code, 0);
  assert.equal((await runCli(["config", "set", "screenshot.chrome", "/opt/chrome"], { env })).code, 0);
  assert.equal(JSON.parse(readFileSync(join(dir, "config.json"), "utf8")).advice.quiet, true);
  assert.equal(JSON.parse(readFileSync(join(dir, "config.local.json"), "utf8")).screenshot.chrome, "/opt/chrome");
  const got = await runCli(["config", "get", "advice.quiet", "--json"], { env });
  assert.deepEqual(JSON.parse(got.out), { key: "advice.quiet", value: true, source: "workspace" });
  const viaEnv = await runCli(["config", "get", "advice.quiet", "--json"], { env: { ...env, KAGES_ADVICE_QUIET: "0" } });
  assert.deepEqual(JSON.parse(viaEnv.out), { key: "advice.quiet", value: false, source: "env" });
});

test("CLI: a token in the workspace file is refused with the file named", async () => {
  const dir = tmpDir(); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "config.json"), '{"session":{"access_token":"x"}}');
  const r = await runCli(["config", "list"], { env: { KAGES_HOME: dir } });
  assert.equal(r.code, 1);
  assert.match(r.out, new RegExp(join(dir, "config.json").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("CLI: --user writes the user file 0600 and keeps existing auth fields", async () => {
  const cfg = tmpDir(), ws = tmpDir();
  writeFileSync(join(cfg, "config.json"), JSON.stringify({ apiUrl: "https://x.test", session: { access_token: "t" } }));
  const r = await runCli(["config", "set", "report.redact", "text", "--user"], { env: { KAGES_CONFIG_HOME: cfg, KAGES_HOME: ws } });
  assert.equal(r.code, 0, r.out + r.err);
  const obj = JSON.parse(readFileSync(join(cfg, "config.json"), "utf8"));
  assert.equal(obj.apiUrl, "https://x.test");
  assert.equal(obj.session.access_token, "t");
  assert.equal(obj.report.redact, "text");
  assert.equal(statSync(join(cfg, "config.json")).mode & 0o777, 0o600);
  assert.equal(existsSync(join(ws, "config.json")), false);
});
