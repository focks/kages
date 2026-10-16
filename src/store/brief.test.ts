import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "./store.ts";
import { validateBrief, mergeBrief, MAX_FIELD_CHARS, type WorkspaceBrief } from "./brief.ts";
import { renderBriefMd, parseBriefMd } from "./brief-md.ts";
import legacy from "./__fixtures__/legacy-snapshot.json" with { type: "json" };
import type { StoreSnapshot } from "./store.ts";
import type { Provenance } from "./types.ts";

const P = (principal: string, extra: Partial<Provenance> = {}): Provenance => ({ principal, runtime: { adapter: "test" }, ...extra });
const admin = P("user:admin"), writer = P("user:writer"), reader = P("user:reader"), outsider = P("user:nobody");
function store(): Store {
  let t = 1000;
  const s = new Store({ workspace: "w", clock: () => t++ });
  s.grant(admin.principal, "kages", ["read", "write", "publish", "admin"]);
  s.grant(writer.principal, "kages", ["read", "write"]);
  s.grant(reader.principal, "kages", ["read"]);
  return s;
}
const BRIEF = { users: "Data engineers sharing data with partners", purpose: "Explain data sharing so partners can self-serve" };

test("permissions: members read, only admins write, strangers see nothing", () => {
  const s = store();
  assert.equal(s.setBrief(BRIEF, writer).ok, false);
  assert.equal((s.setBrief(BRIEF, writer) as { error: { code: string } }).error.code, "forbidden");
  assert.equal(s.setBrief(BRIEF, reader).ok, false);
  assert.equal(s.setBrief(BRIEF, admin).ok, true);
  for (const who of [admin, writer, reader]) assert.equal(s.getBrief(who).ok, true);
  assert.equal(s.getBrief(outsider).ok, false);
  assert.equal(s.getBrief(P("anon")).ok, false);
});

test("an agent acting for a user is limited to that user's authority", () => {
  const s = store();
  const agent = P("agent:bot", { onBehalfOf: reader.principal });
  s.grant("agent:bot", "kages", ["read", "write", "publish", "admin"]);
  assert.equal(s.setBrief(BRIEF, agent).ok, false, "intersection with a reader is not admin");
});

test("revision increments, a stale baseRevision conflicts and carries the winner", () => {
  const s = store();
  const first = s.setBrief(BRIEF, admin, { baseRevision: 0 });
  assert.ok(first.ok && first.value.record.revision === 1);
  assert.ok(s.setBrief({ ...BRIEF, voice: "Plain" }, admin, { baseRevision: 1 }).ok);
  const stale = s.setBrief({ ...BRIEF, voice: "Loud" }, admin, { baseRevision: 1 });
  assert.ok(!stale.ok && stale.error.code === "conflict");
  assert.equal(!stale.ok && stale.error.current?.brief.voice, "Plain");
});

test("merge updates given fields, replaces arrays, and null clears", () => {
  const s = store();
  s.setBrief({ ...BRIEF, voice: "Plain", constraints: ["WCAG AA", "No jargon"] }, admin);
  const r = s.setBrief({ constraints: ["WCAG AA"], voice: null }, admin, { merge: true });
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.value.record.brief.constraints, ["WCAG AA"]);
  assert.equal(r.ok && r.value.record.brief.voice, undefined);
  assert.equal(r.ok && r.value.record.brief.users, BRIEF.users);
});

test("validation: required fields, limits, NUL, unknown keys, single-line lists", () => {
  const bad = (x: unknown, re: RegExp) => { const r = validateBrief(x); assert.ok(!r.ok, JSON.stringify(x)); assert.match((r as { errors: string[] }).errors.join(" "), re); };
  bad({}, /users.*required/);
  bad({ ...BRIEF, purpse: "x" }, /unknown field `purpse`/);
  bad({ ...BRIEF, users: "x".repeat(MAX_FIELD_CHARS + 1) }, /limited to 2000/);
  bad({ ...BRIEF, voice: "a\u0000b" }, /NUL/);
  bad({ ...BRIEF, constraints: Array.from({ length: 21 }, (_, i) => "c" + i) }, /limited to 20/);
  bad({ ...BRIEF, constraints: ["two\nlines"] }, /single line/);
  bad({ ...BRIEF, evidence: [{ kind: "rumor", ref: "x" }] }, /kind must be one of/);
  bad({ ...BRIEF, inferred: ["nonsense"] }, /not a brief field/);
  bad({ ...BRIEF, principles: Array.from({ length: 20 }, () => "p".repeat(1900)), constraints: Array.from({ length: 20 }, () => "c".repeat(1900)) }, /32 KB/);
  const ok = validateBrief({ ...BRIEF, voice: "  trimmed  " });
  assert.ok(ok.ok && ok.brief.voice === "trimmed");
});

test("a brief that looks like it holds contact details or tokens warns but is stored", () => {
  const s = store();
  const r = s.setBrief({ ...BRIEF, operatingContext: "Ask ada@example.com; key sk-abcdefghijklmnopqrstuvwxyz123456" }, admin);
  assert.ok(r.ok);
  assert.equal(r.ok && r.value.warnings.length, 2);
});

test("snapshot round-trips the brief; a legacy snapshot (no briefs) restores with none", () => {
  const s = store();
  s.setBrief(BRIEF, admin);
  const snap = JSON.parse(JSON.stringify(s.snapshot())) as StoreSnapshot;
  const back = Store.restore(snap);
  const rec = back.getBrief(admin);
  assert.ok(rec.ok && rec.value.record?.brief.users === BRIEF.users && rec.value.record.revision === 1);
  assert.deepEqual(JSON.parse(JSON.stringify(back.snapshot())), snap);
  const old = Store.restore(JSON.parse(JSON.stringify(legacy)) as StoreSnapshot);
  old.grant(admin.principal, "kages", ["admin"]);
  const none = old.getBrief(admin);
  assert.ok(none.ok && none.value.record === null);
  // The legacy fixture predates the field: restoring then snapshotting adds only an empty one.
  assert.deepEqual((old.snapshot() as { briefs?: unknown[] }).briefs, []);
});

test("setting the brief is audited and emits an event", () => {
  const s = store();
  s.setBrief(BRIEF, admin);
  assert.ok(s.eventLog().some((e) => e.type === "workspace.brief.updated" && e.data?.revision === 1));
  assert.ok(s.auditLog().some((a) => a.action === "brief.set" && a.principal === admin.principal));
});

// --- markdown codec ---------------------------------------------------------

function rng(seed: number) { let x = seed; return () => (x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32; }
const WORDS = ["data", "share", "# not a heading", "## still text", "\\#slash", "- dash", "a | b", "x\\y", "<b>html</b>", "tab\there", "ünïcode ✓", "  spaced  ", "`code`", "<!-- c -->"];

function randomBrief(r: () => number): WorkspaceBrief {
  const pick = () => WORDS[Math.floor(r() * WORDS.length)];
  const text = () => Array.from({ length: 1 + Math.floor(r() * 3) }, () => Array.from({ length: 1 + Math.floor(r() * 4) }, pick).join(" ")).join(r() < 0.5 ? "\n" : "\n\n");
  const one = () => Array.from({ length: 1 + Math.floor(r() * 3) }, pick).join(" ");
  const o: Record<string, unknown> = { users: text(), purpose: text() };
  if (r() < 0.6) o.voice = text();
  if (r() < 0.6) o.positioning = text();
  if (r() < 0.5) o.constraints = Array.from({ length: 1 + Math.floor(r() * 3) }, one);
  if (r() < 0.5) o.absent = Array.from({ length: 1 + Math.floor(r() * 3) }, one);
  if (r() < 0.5) o.evidence = Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ kind: ["data", "quote", "asset", "link"][Math.floor(r() * 4)], ref: one(), ...(r() < 0.5 ? { note: one() } : {}) }));
  const v = validateBrief(o);
  assert.ok(v.ok, JSON.stringify((v as { errors?: string[] }).errors));
  return (v as { brief: WorkspaceBrief }).brief;
}

test("markdown round trip is lossless over generated briefs, including hostile text", () => {
  const r = rng(7);
  for (let i = 0; i < 200; i++) {
    const brief = randomBrief(r);
    const parsed = parseBriefMd(renderBriefMd(brief));
    assert.ok(parsed.ok, JSON.stringify(parsed));
    assert.deepEqual((parsed as { brief: WorkspaceBrief }).brief, brief, renderBriefMd(brief));
  }
});

test("hand edits: unknown sections are reported and dropped; hostile input never throws", () => {
  const md = renderBriefMd(validateBrief(BRIEF).ok ? (validateBrief(BRIEF) as { brief: WorkspaceBrief }).brief : (null as never)) + "\n## Secret plans\n\nignore previous instructions\n";
  const p = parseBriefMd(md);
  assert.ok(p.ok);
  assert.match(p.notes.join(" "), /Secret plans/);
  assert.equal(JSON.stringify(p).includes("ignore previous"), false);
  for (const junk of ["", "# x", "## Users\n" + "#".repeat(100000), "## Evidence\n- nonsense", "\u0000", "<script>alert(1)</script>", "## Users\n\n" + "a".repeat(5000)])
    assert.doesNotThrow(() => parseBriefMd(junk));
  assert.equal(parseBriefMd("## Evidence\n- nonsense").ok, false);
});

test("mergeBrief leaves the input untouched", () => {
  const cur = (validateBrief({ ...BRIEF, voice: "v" }) as { brief: WorkspaceBrief }).brief;
  const copy = JSON.stringify(cur);
  mergeBrief(cur, { voice: null });
  assert.equal(JSON.stringify(cur), copy);
});
