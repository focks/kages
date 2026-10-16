import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCritique, trend, critiqueToMd, openCounts, MAX_PER_KAGE, MAX_SAVES_PER_HOUR, type Critique } from "./critique.ts";
import { Store } from "./store.ts";
import { dispatch, type OpContext } from "../adapters/operations.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import legacy from "./__fixtures__/legacy-snapshot.json" with { type: "json" };
import type { StoreSnapshot } from "./store.ts";
import type { Provenance } from "./types.ts";
import { runCli } from "../test-support/cli.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const all = (n: number) => Object.fromEntries(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].map((k) => [k, n]));
const ok = (input: object) => { const r = validateCritique(input as never); assert.ok(r.ok, JSON.stringify(r)); return r.ok ? r.value : (null as never); };
const bad = (input: object, re: RegExp, doc?: never) => { const r = validateCritique(input as never, doc); assert.ok(!r.ok, "should be rejected"); assert.match((r as { errors: string[] }).errors.join(" | "), re); };

test("totals: all ten, two n/a (the maximum scales), and n/a everywhere is refused", () => {
  assert.deepEqual([ok({ scores: all(3) }).total, ok({ scores: all(3) }).max], [30, 40]);
  const two = ok({ scores: { ...all(3), 7: null, 10: null }, naReasons: { 7: "static page", 10: "no help needed" } });
  assert.deepEqual([two.total, two.max], [24, 32]);
  bad({ scores: { 1: null, 2: null, 3: null, 4: null }, naReasons: { 1: "a", 2: "a", 3: "a", 4: "a" } }, /at least 3/);
  bad({ scores: { 1: 4, 2: 4 } }, /at least 3/);
});

test("validation matrix", () => {
  bad({ scores: all(5) }, /integer 0 to 4/);
  bad({ scores: { ...all(2), 3: 2.5 } }, /heuristic 3 must be an integer/);
  bad({ scores: { ...all(2), 3: "high" } }, /heuristic 3/);
  bad({ scores: { ...all(2), 11: 3 } }, /unknown heuristic "11"/);
  bad({ scores: { ...all(2), 7: null } }, /heuristic 7 is n\/a but has no reason/);
  bad({ scores: { ...all(2), 7: null }, naReasons: { 7: "  " } }, /no reason/);
  bad({ scores: all(2), method: "degraded" }, /must say why/);
  bad({ scores: all(2), method: "quantum" }, /method must be/);
  bad({ scores: all(2), body: "x".repeat(21 * 1024) }, /body must be/);
  bad({ scores: all(2), body: "a\u0000b" }, /body must be/);
  const p = (x: object) => ({ scores: all(2), priorities: [{ sev: "P1", title: "T", fix: "F", ...x }] });
  bad(p({ sev: "P9" }), /sev must be/);
  bad(p({ title: "" }), /title/);
  bad(p({ title: "x".repeat(141) }), /title/);
  bad(p({ fix: "" }), /fix is required/);
  bad(p({ command: "rm-rf" }), /not an improve command/);
  bad(p({ status: "maybe" }), /status must be/);
  bad({ scores: all(2), priorities: Array.from({ length: 9 }, () => ({ sev: "P2", title: "T", fix: "F" })) }, /at most 8/);
  bad({ scores: all(2), priorities: "no" }, /list/);
  assert.equal(ok({ scores: all(2), priorities: [{ sev: "P2", title: "T", fix: "F", command: "polish" }, { sev: "P0", title: "U", fix: "G", command: "" }] }).counts.P0, 1);
  const doc = sampleKage({ id: "d" });
  bad(p({ block: "ghost" }), /no block "ghost"/, doc as never);
  assert.ok(validateCritique(p({ block: "hello" }) as never, doc).ok);
});

test("trend: equal maxima, differing maxima, single, empty and the last five", () => {
  const c = (total: number, max: number, day: number) => ({ total, max, createdAt: `2026-01-${String(day).padStart(2, "0")}T00:00:00Z` });
  assert.equal(trend([]).line, "No critiques yet.");
  assert.equal(trend([c(24, 40, 1)]).line, "First critique for this Kage, no trend yet.");
  assert.equal(trend([c(24, 40, 1), c(28, 40, 2), c(32, 40, 3)]).line, "24 → 28 → 32 (out of 40)");
  const mixed = trend([c(24, 32, 1), c(30, 40, 2)]);
  assert.equal(mixed.comparable, false);
  assert.match(mixed.line, /^24\/32 → 30\/40 \(scored different heuristic sets/);
  assert.deepEqual(trend(Array.from({ length: 9 }, (_, i) => c(10 + i, 40, i + 1))).points.map((p) => p.score), [14, 15, 16, 17, 18], "the last five, oldest first");
  assert.equal(trend([c(32, 40, 3), c(24, 40, 1)]).line, "24 → 32 (out of 40)", "input order does not matter");
});

const P = (principal: string): Provenance => ({ principal, runtime: { adapter: "test" } });
function setup(clock?: () => number) {
  const store = new Store({ clock });
  store.grant("w", "kages", ["read", "write", "admin"]); store.grant("r", "kages", ["read"]);
  const W: OpContext = { store, author: P("w") }, R: OpContext = { store, author: P("r") }, X: OpContext = { store, author: P("x") };
  assert.ok(dispatch(W, "create_kage", { doc: sampleKage({ id: "k" }) }).ok);
  return { store, W, R, X };
}
const data = (x: unknown) => (x as { ok: true; data: any }).data;
const save = (c: OpContext, extra: object = {}) => dispatch(c, "save_critique", { kage: "k", fingerprint: c.store.head("k")!.digest, scores: all(3), body: "Report", method: "single", ...extra });

test("save, list, get: totals computed server-side, tied to the head digest", () => {
  const { store, W } = setup();
  const r = save(W, { total: 999, max: 1, counts: { P0: 99 }, priorities: [{ sev: "P0", title: "Dead CTA", fix: "Wire it", command: "polish", block: "hello" }] });
  assert.ok(r.ok);
  const c = data(r) as Critique;
  assert.deepEqual([c.id, c.total, c.max, c.counts.P0, c.fingerprint, c.version], ["q1", 30, 40, 1, store.head("k")!.digest, 1]);
  assert.equal(data(dispatch(W, "list_critiques", { kage: "k" })).trend.line, "First critique for this Kage, no trend yet.");
  assert.equal(data(dispatch(W, "get_critique", { id: "q1" })).stale, false);
});

test("staleness flips after a patch; closing only touches the targeted id; a newer critique is untouched", () => {
  const { W } = setup();
  save(W); // q1
  dispatch(W, "patch_kage", { name: "k", ops: [{ op: "replace", path: "/blocks/hello/props/text", value: "Changed" }] });
  assert.equal(data(dispatch(W, "get_critique", { id: "q1" })).stale, true);
  save(W, { scores: all(4) }); // q2 on v2
  assert.equal(data(dispatch(W, "get_critique", { id: "q2" })).stale, false);
  const closed = data(dispatch(W, "close_critique", { id: "q1", reason: "cleared" }));
  assert.deepEqual([closed.state, closed.closedBy, closed.closedReason], ["closed", "w", "cleared"]);
  const list = data(dispatch(W, "list_critiques", { kage: "k" })).critiques;
  assert.deepEqual(list.map((x: Critique) => [x.id, x.state]), [["q2", "open"], ["q1", "closed"]]);
  assert.equal(data(dispatch(W, "list_critiques", { kage: "k" })).trend.line, "30 → 40 (out of 40)");
});

test("permissions: writers save and close, readers read, strangers see nothing", () => {
  const { W, R, X } = setup();
  save(W);
  assert.equal(save(R).ok, false);
  assert.equal(dispatch(R, "close_critique", { id: "q1" }).ok, false);
  assert.equal(dispatch(R, "set_critique_priority", { id: "q1", index: 0, status: "fixed" }).ok, false);
  assert.equal(dispatch(R, "get_critique", { id: "q1" }).ok, true);
  assert.equal(dispatch(R, "list_critiques", { kage: "k" }).ok, true);
  for (const op of ["get_critique", "export_critique"]) assert.equal(dispatch(X, op, { id: "q1" }).ok, false, op);
  assert.equal(dispatch(X, "list_critiques", { kage: "k" }).ok, false);
  assert.equal(dispatch(W, "get_critique", { id: "q99" }).ok, false);
  assert.equal(save(W, { kage: "missing" }).ok, false);
});

test("the backlog can be worked item by item, and the open counts follow", () => {
  const { W } = setup();
  save(W, { priorities: [{ sev: "P0", title: "A", fix: "a" }, { sev: "P1", title: "B", fix: "b" }] });
  assert.deepEqual(openCounts(data(dispatch(W, "get_critique", { id: "q1" })).critique), { P0: 1, P1: 1 });
  assert.ok(dispatch(W, "set_critique_priority", { id: "q1", index: 0, status: "fixed" }).ok);
  assert.deepEqual(openCounts(data(dispatch(W, "get_critique", { id: "q1" })).critique), { P0: 0, P1: 1 });
  assert.equal(dispatch(W, "set_critique_priority", { id: "q1", index: 5, status: "fixed" }).ok, false);
  assert.equal(dispatch(W, "set_critique_priority", { id: "q1", index: 0, status: "later" }).ok, false);
});

test("rate limit, retention (closed first), and purge on delete", () => {
  let t = Date.parse("2026-01-01T00:00:00Z");
  const { store, W } = setup(() => (t += 1000));
  for (let i = 0; i < MAX_SAVES_PER_HOUR; i++) assert.ok(save(W).ok, `save ${i}`);
  const limited = save(W);
  assert.ok(!limited.ok && limited.error.code === "rate_limited");
  t += 2 * 3_600_000;
  // Fill past the retention cap in hour-sized steps.
  let n = MAX_SAVES_PER_HOUR;
  while (n < MAX_PER_KAGE + 5) { for (let i = 0; i < MAX_SAVES_PER_HOUR && n < MAX_PER_KAGE + 5; i++, n++) assert.ok(save(W).ok); t += 2 * 3_600_000; }
  const rows = data(dispatch(W, "list_critiques", { kage: "k", limit: 100 })).critiques;
  assert.equal(rows.length, MAX_PER_KAGE);
  assert.ok(store.eventLog().some((e) => e.type === "kage.critique.saved"));
  // A closed critique is evicted before an open one.
  dispatch(W, "close_critique", { id: rows[10].id });
  t += 2 * 3_600_000;
  save(W);
  assert.equal(dispatch(W, "get_critique", { id: rows[10].id }).ok, false, "the closed one went first");
  assert.equal(dispatch(W, "get_critique", { id: rows[49].id }).ok, true, "the oldest open one survived");
  assert.ok(dispatch(W, "delete_kage", { name: "k" }).ok);
  assert.deepEqual(store.snapshot().critiques, [], "deleting a Kage deletes its critiques");
});

test("snapshots: round trip including closed state; a legacy snapshot restores with none", () => {
  const { store, W } = setup();
  save(W, { priorities: [{ sev: "P2", title: "T", fix: "F" }] });
  dispatch(W, "close_critique", { id: "q1", reason: "done" });
  const snap = JSON.parse(JSON.stringify(store.snapshot())) as StoreSnapshot;
  const back = Store.restore(snap);
  back.grant("w", "kages", ["read", "write"]);
  const got = back.getCritique("q1", P("w"));
  assert.ok(got.ok && got.value.critique.state === "closed" && got.value.critique.closedReason === "done");
  assert.ok(back.saveCritique("k", { scores: all(2), fingerprint: back.head("k")!.digest }, P("w")).ok, "ids continue after a reload (q2)");
  assert.equal((back.listCritiques("k", P("w")) as any).value[0].id, "q2");
  const old = Store.restore(JSON.parse(JSON.stringify(legacy)) as StoreSnapshot);
  assert.deepEqual((old.snapshot() as { critiques?: unknown[] }).critiques, []);
});

test("export renders frontmatter, scores and backlog; context and the Library card carry the newest critique", () => {
  const { W } = setup();
  save(W, { scores: { ...all(3), 7: null }, naReasons: { 7: "static" }, priorities: [{ sev: "P1", title: "Hero button dead", fix: "Wire it", command: "polish", block: "hello" }], body: "## Notes\nok" });
  const md = data(dispatch(W, "export_critique", { id: "q1" })) as string;
  assert.match(md, /^---\ncritique: q1\nkage: k\nversion: 1\nfingerprint: sha256:/);
  assert.match(md, /score: 27\nmax: 36/);
  assert.match(md, /\| 7 \| n\/a \(static\) \|/);
  assert.match(md, /- \[open\] P1: Hero button dead \(hello\) — Wire it \(kages improve polish\)/);
  const card = data(dispatch(W, "list_kages")).find((x: { name: string }) => x.name === "k");
  assert.deepEqual(card.critique, { score: 27, max: 36, stale: false, open: { P0: 0, P1: 1 } });
  const ctx = data(dispatch(W, "get_context", { kage: "k" }));
  assert.equal(ctx.kage.latestCritique.score, 27);
  assert.ok(ctx.directives.some((d: { code: string }) => d.code === "CRITIQUE_OPEN"));
  dispatch(W, "patch_kage", { name: "k", ops: [{ op: "replace", path: "/blocks/hello/props/text", value: "X" }] });
  assert.ok(data(dispatch(W, "get_context", { kage: "k" })).directives.some((d: { code: string }) => d.code === "CRITIQUE_STALE"));
});

test("CLI: save a critique from a file, read the trend, export and close it", async () => {
  const dir = tmpDir(), ws = ["-C", join(dir, ".kages")], kf = join(dir, "k.kage.json"), cf = join(dir, "c.json");
  writeFileSync(kf, JSON.stringify(sampleKage({ id: "k" })));
  writeFileSync(cf, JSON.stringify({ scores: all(3), body: "Report", method: "single", priorities: [{ sev: "P0", title: "T", fix: "F" }] }));
  await runCli([...ws, "create", kf, "--local"]);
  const reviewed = JSON.parse((await runCli([...ws, "critique", "k", "--json", "--local"])).out);
  const payload = JSON.parse(readFileSync(cf, "utf8"));
  writeFileSync(cf, JSON.stringify({ ...payload, fingerprint: reviewed.target.digest }));
  const saved = await runCli([...ws, "critique", "save", "k", "--file", cf, "--local"]);
  assert.match(saved.out, /saved q1: 30\/40 \(P0 1, P1 0, P2 0, P3 0\)/);
  const list = await runCli([...ws, "critiques", "k", "--local"]);
  assert.match(list.out, /First critique/);
  assert.match(list.out, /q1\s+v1\s+30\/40\s+open P0 1 P1 0\s+single/);
  assert.match((await runCli([...ws, "critique", "export", "q1", "--local"])).out, /^---\ncritique: q1/);
  assert.match((await runCli([...ws, "critique", "close", "q1", "--reason", "all fixed", "--local"])).out, /closed q1/);
  assert.match((await runCli([...ws, "critiques", "k", "--local"])).out, /closed/);
  const badSave = await runCli([...ws, "critique", "save", "k", "--file", cf, "--local"]);
  assert.equal(badSave.code, 0);
});

test("a review cannot be saved against a head it did not assess", () => {
  const { store, W } = setup();
  const fingerprint = store.head("k")!.digest;
  assert.ok(store.patch("k", [{ op: "replace", path: "/title", value: "Changed" }], W.author).ok);
  const before = JSON.stringify(store.snapshot());
  const stale = save(W, { fingerprint });
  assert.ok(!stale.ok && stale.error.code === "conflict");
  assert.equal(JSON.stringify(store.snapshot()), before);
  const missing = save(W, { fingerprint: undefined });
  assert.ok(!missing.ok);
});
