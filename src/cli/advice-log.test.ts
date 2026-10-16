import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { entryFor, type AdviceLogEntry } from "../engine/advice-log.ts";
import { FileSink, chooseSink, rotate, NullSink, MAX_LOG_BYTES } from "./advice-sinks.ts";
import { statsOf, readLog } from "./advice-log-cmd.ts";
import { Store } from "../store/store.ts";
import { dispatch, type OpContext } from "../adapters/operations.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import { readNdjson } from "../test-support/ndjson.ts";
import { runCli } from "../test-support/cli.ts";
import { tmpDir } from "../test-support/tmp.ts";
import type { Advice } from "../engine/advice.ts";
import type { KageDoc } from "../engine/types.ts";

const f = (code: string, at: string, severity: Advice["severity"] = "P2"): Advice => ({ level: "lint", at, code, msg: "SECRET message text", fix: "SECRET fix", rule: code, severity });
const base = { ts: "2026-10-15T12:00:00.000Z", adapter: "cli", principal: "user:ada", op: "patch_kage", mode: "full" as const, minSeverity: "P2" as const, ms: 7.04, waived: [], returned: 1 };

test("entryFor: counts, rule ids, introduced and fixed findings, and nothing else", () => {
  const e = entryFor({ ...base, kage: "snow", version: 4, before: [f("dead-button", "/blocks/a", "P1"), f("empty-chart", "/blocks/c")], after: [f("dead-button", "/blocks/a", "P1"), f("form-unwired", "/blocks/f", "P1")], waived: [f("tpl-private-read", "/blocks/t", "P1")] });
  assert.deepEqual({ ...e }, { v: 1, ts: base.ts, adapter: "cli", principal: "user:ada", op: "patch_kage", kage: "snow", version: 4, mode: "full", tier: "immediate", ms: 7, counts: { P0: 0, P1: 2, P2: 0, P3: 0 }, rules: ["dead-button", "form-unwired"], added: ["form-unwired"], resolved: ["empty-chart"], waived: ["tpl-private-read"], returned: 1, suppressed: 1, policy: { minSeverity: "P2" } });
  assert.equal(JSON.stringify(e).includes("SECRET"), false);
});

test("block ids appear only when asked for, and a long rule list stays under 4 KB", () => {
  const after = Array.from({ length: 200 }, (_, i) => f("rule-" + i, "/blocks/b" + i));
  assert.equal("blocks" in entryFor({ ...base, before: null, after }), false);
  const e = entryFor({ ...base, before: null, after, logBlockIds: true });
  assert.ok(e.blocks!.length <= 40 && e.blocks![0].startsWith("b"));
  assert.ok(JSON.stringify(e).length < 4096, `${JSON.stringify(e).length}`);
});

test("sink choice: off by default, stdout, true → workspace file, a path, and a hosted file is refused", () => {
  assert.equal(chooseSink({}).sink, NullSink);
  assert.equal(chooseSink({ setting: false }).sink, NullSink);
  assert.equal(chooseSink({ setting: true, workspaceDir: "/w" }).path, "/w/advice.log.ndjson");
  assert.equal(chooseSink({ setting: "/var/x.ndjson" }).path, "/var/x.ndjson");
  assert.equal(chooseSink({ setting: true, env: "stdout" }).sink !== NullSink, true, "env wins over config");
  const hosted = chooseSink({ env: "/tmp/x.log", hosted: true });
  assert.equal(hosted.sink, NullSink);
  assert.match(hosted.problem!, /must be "stdout"/);
  assert.equal(chooseSink({ env: "stdout", hosted: true }).problem, undefined);
});

test("rotation: at the size limit the file moves to .1, at most three are kept, no torn lines", () => {
  const dir = tmpDir(), path = join(dir, "advice.log.ndjson");
  const sink = new FileSink(path, 300);
  const e = entryFor({ ...base, before: null, after: [f("dead-button", "/blocks/a", "P1")] });
  for (let i = 0; i < 40; i++) sink.write(e);
  assert.ok(existsSync(path + ".1"));
  assert.ok(!existsSync(path + ".4"));
  assert.ok(statSync(path).size < 300 + JSON.stringify(e).length + 2);
  for (const p of [path, path + ".1", path + ".2", path + ".3"]) if (existsSync(p)) readNdjson(p);
  rotate(join(dir, "missing.log"), 1);
});

test("two processes appending 500 lines each leave 1,000 intact lines", async () => {
  const dir = tmpDir(), path = join(dir, "c.ndjson");
  const mod = fileURLToPath(new URL("./advice-sinks.ts", import.meta.url));
  const script = `import(${JSON.stringify(mod)}).then(({FileSink})=>{const s=new FileSink(${JSON.stringify(path)});for(let i=0;i<500;i++)s.write({v:1,ts:"t",adapter:process.argv[1],principal:"p",op:"o",mode:"full",tier:"immediate",ms:1,counts:{P0:0,P1:0,P2:0,P3:0},rules:[],added:[],resolved:[],waived:[],returned:0,suppressed:0,policy:{minSeverity:"P2"}})})`;
  await Promise.all(["a", "b"].map((id) => new Promise<void>((res, rej) => { const c = spawn(process.execPath, ["-e", script, id], { stdio: "ignore" }); c.on("exit", (code) => (code === 0 ? res() : rej(new Error("child failed")))); })));
  const rows = readNdjson<AdviceLogEntry>(path);
  assert.equal(rows.length, 1000);
  assert.equal(rows.filter((r) => r.adapter === "a").length, 500);
});

function ctxWith(path: string, logBlockIds = false): OpContext {
  const store = new Store();
  store.grant("agent:w", "kages", ["read", "write", "admin"]);
  return { store, author: { principal: "agent:w" }, adapter: "mcp", adviceLog: new FileSink(path), logBlockIds };
}

test("privacy: sentinel strings in titles, props, comments, briefs and waiver reasons never reach the log", () => {
  const path = join(tmpDir(), "p.ndjson"), c = ctxWith(path, true);
  const S = "ZZ-SENTINEL";
  const doc: KageDoc = { ...sampleKage({ id: "priv" }), title: `${S} title`, brief: { mode: "read", audience: `${S} audience`, notes: `${S} notes` }, meta: { kages: { lint: { ignore: [{ rule: "dead-button", reason: `${S} reason for waiving` }] } } } as never,
    blocks: { root: { type: "stack", props: {}, slots: { children: ["btn"] } }, btn: { type: "button", props: { label: `${S} label` } } } };
  dispatch(c, "set_brief", { brief: { users: `${S} users`, purpose: `${S} purpose` } });
  dispatch(c, "create_kage", { doc });
  dispatch(c, "patch_kage", { name: "priv", ops: [{ op: "replace", path: "/blocks/btn/props/label", value: `${S} again` }] });
  dispatch(c, "validate_kage", { doc });
  dispatch(c, "lint_kage", { name: "priv" });
  dispatch(c, "validate_patch", { name: "priv", ops: [{ op: "replace", path: "/blocks/btn/props/label", value: `${S} dry` }] });
  const text = readFileSync(path, "utf8");
  assert.ok(text.length > 0);
  assert.equal(text.includes(S), false);
  assert.equal(text.includes("title"), false);
  const rows = readNdjson<AdviceLogEntry>(path);
  assert.deepEqual(rows.map((r) => r.op), ["create_kage", "patch_kage", "validate_kage", "lint_kage", "validate_patch"]);
  assert.ok(rows.every((r) => r.v === 1 && r.adapter === "mcp" && r.principal === "agent:w" && typeof r.ms === "number"));
  assert.deepEqual(rows[0].waived, ["dead-button"], "a waived finding is counted, by rule id only");
  assert.deepEqual(rows[0].blocks, [], "the only finding is waived, so there is nothing to name");
});

test("block ids are logged for findings only when the operator opted in", () => {
  const btnDoc: KageDoc = { ...sampleKage({ id: "ids" }), blocks: { root: { type: "stack", props: {}, slots: { children: ["btn"] } }, btn: { type: "button", props: { label: "Go" } } } };
  const on = join(tmpDir(), "on.ndjson"), off = join(tmpDir(), "off.ndjson");
  dispatch(ctxWith(on, true), "create_kage", { doc: btnDoc });
  dispatch(ctxWith(off, false), "create_kage", { doc: btnDoc });
  assert.deepEqual(readNdjson<AdviceLogEntry>(on)[0].blocks, ["btn"]);
  assert.equal("blocks" in readNdjson<AdviceLogEntry>(off)[0], false);
});

test("disabled by default: no file is created and ops behave identically", () => {
  const dir = tmpDir();
  const store = new Store(); store.grant("agent:w", "kages", ["read", "write", "admin"]);
  const c: OpContext = { store, author: { principal: "agent:w" } };
  assert.ok(dispatch(c, "create_kage", { doc: sampleKage({ id: "q" }) }).ok);
  assert.equal(existsSync(join(dir, "advice.log.ndjson")), false);
  const off = chooseSink({ workspaceDir: dir });
  assert.equal(off.sink, NullSink);
});

test("stats: waiver rate per rule is the headline, with regression rate and percentiles", () => {
  const mk = (over: Partial<AdviceLogEntry>): AdviceLogEntry => ({ ...entryFor({ ...base, before: null, after: [] }), ...over });
  const es = [
    mk({ op: "patch_kage", rules: ["dead-button"], added: ["dead-button"], ms: 4 }),
    mk({ op: "patch_kage", rules: ["unsourced-claim"], waived: ["unsourced-claim"], ms: 6 }),
    mk({ op: "patch_kage", rules: ["unsourced-claim"], waived: ["unsourced-claim"], ms: 8 }),
    mk({ op: "create_kage", rules: [], ms: 10 }),
    mk({ op: "validate_kage", rules: ["dead-button"], ms: 2 }),
  ];
  const s = statsOf(es, 7, Date.parse("2026-10-16T00:00:00Z"));
  assert.equal(s.calls, 5);
  assert.equal(s.writes, 4);
  assert.equal(s.regressionRate, 0.25);
  assert.deepEqual(s.rules.map((r) => r.rule), ["unsourced-claim", "dead-button"]);
  assert.equal(s.rules[0].waiverRate, 2 / 4);
  assert.deepEqual(s.ms, { p50: 6, p95: 10 });
  assert.equal(statsOf(es, 7, Date.parse("2027-01-01T00:00:00Z")).calls, 0, "outside the window");
});

test("CLI: enable the log by config, write twice, read it back; nothing sensitive in the file", async () => {
  const dir = tmpDir(), ws = join(dir, ".kages");
  const env = { KAGES_HOME: ws };
  assert.equal((await runCli(["config", "set", "advice.auditLog", "true"], { env })).code, 0);
  const kf = join(dir, "k.kage.json");
  writeFileSync(kf, JSON.stringify({ kages: "1.0", id: "k", title: "Confidential title", system: "core@1", root: "root", blocks: { root: { type: "stack", props: {}, slots: { children: ["b"] } }, b: { type: "button", props: { label: "Confidential label" } } } }));
  assert.equal((await runCli(["create", kf, "--local"], { env })).code, 0);
  const log = join(ws, "advice.log.ndjson");
  const rows = readNdjson<AdviceLogEntry>(log);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].added, ["dead-button"]);
  assert.equal(readFileSync(log, "utf8").includes("Confidential"), false);
  const stats = await runCli(["advice-log", "stats"], { env });
  assert.match(stats.out, /1 call\(s\)/);
  assert.match(stats.out, /dead-button\s+1\s+0/);
  const tail = await runCli(["advice-log", "tail", "--json"], { env });
  assert.equal(JSON.parse(tail.out).length, 1);
  const empty = await runCli(["advice-log", "stats", "--path", join(dir, "none.ndjson")], { env });
  assert.match(empty.out, /Turn the log on/);
  assert.equal(readLog(log).skipped, 0);
  void MAX_LOG_BYTES;
});
