// The per-Kage brief through the operation set: declared mode, the envelope
// hazard (generate_kage must re-attach it), and the labels adapters show.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store/store.ts";
import { dispatch, type OpContext } from "./operations.ts";
import { toGenerated, fromGenerated } from "../engine/generate.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import type { KageDoc } from "../engine/types.ts";

function ctx(grants: Array<"read" | "write" | "admin" | "publish"> = ["read", "write", "publish", "admin"]): OpContext {
  const store = new Store();
  store.grant("agent:t", "kages", grants);
  return { store, author: { principal: "agent:t" } };
}
const data = (r: unknown) => (r as { ok: true; data: any }).data;
const head = (c: OpContext, n: string) => c.store.head(n)!.doc as KageDoc;

test("create_kage accepts brief or the mode shorthand and stores it in the signed document", () => {
  const c = ctx();
  assert.ok(dispatch(c, "create_kage", { doc: sampleKage({ id: "a" }), brief: { mode: "read", audience: "Partners" } }).ok);
  assert.deepEqual(head(c, "a").brief, { mode: "read", audience: "Partners" });
  assert.ok(dispatch(c, "create_kage", { doc: sampleKage({ id: "b" }), mode: "operate" }).ok);
  assert.deepEqual(head(c, "b").brief, { mode: "operate" });
  assert.equal(head(c, "b") && c.store.head("b")!.digest.startsWith("sha256:"), true);
});

test("a bad brief is refused with the reasons, and nothing is stored", () => {
  const c = ctx();
  const r = dispatch(c, "create_kage", { doc: sampleKage({ id: "x" }), brief: { mode: "loud", surprise: 1 } });
  assert.ok(!r.ok && ["invalid_brief", "invalid_params"].includes(r.error.code));
  assert.match(JSON.stringify(r), /brief\/mode/);
  assert.equal(c.store.head("x"), undefined);
});

test("set_kage_brief is one new version, whether the brief is new or replaced", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: sampleKage({ id: "k" }) });
  assert.ok(dispatch(c, "set_kage_brief", { name: "k", brief: { mode: "persuade" } }).ok);
  assert.ok(dispatch(c, "set_kage_brief", { name: "k", brief: { mode: "read", job: "Understand sharing" } }).ok);
  assert.deepEqual(head(c, "k").brief, { mode: "read", job: "Understand sharing" });
  const versions = data(dispatch(c, "list_versions", { name: "k" })) as unknown[];
  assert.equal(versions.length, 3);
  assert.equal(dispatch(c, "set_kage_brief", { name: "k", brief: { mode: "nope" } }).ok, false);
  assert.equal(data(dispatch(c, "list_versions", { name: "k" })).length, 3, "a rejected brief spends no version");
});

test("set_kage_brief needs write access", () => {
  const c = ctx(["read", "write"]);
  dispatch(c, "create_kage", { doc: sampleKage({ id: "k" }) });
  const reader = { store: c.store, author: { principal: "agent:ro" } };
  c.store.grant("agent:ro", "kages", ["read"]);
  const r = dispatch(reader, "set_kage_brief", { name: "k", brief: { mode: "read" } });
  assert.ok(!r.ok && r.error.code === "forbidden");
});

test("the generation envelope drops the brief; generate_kage re-attaches it", () => {
  const original = { ...sampleKage({ id: "g" }), brief: { mode: "experience" as const } };
  const roundTrip = fromGenerated(toGenerated(original), "core");
  assert.equal(roundTrip.brief, undefined, "documents the hazard: the envelope cannot carry a brief");
  const c = ctx();
  assert.ok(dispatch(c, "generate_kage", { system: "core", envelope: toGenerated(original), mode: "experience" }).ok);
  const stored = c.store.list()[0].doc;
  assert.deepEqual(stored.brief, { mode: "experience" });
});

test("outline_to_kage records a mode only when asked", () => {
  const c = ctx();
  const md = "# Guide\n\nSome prose.\n\n## One\n\nText.";
  assert.equal(data(dispatch(c, "outline_to_kage", { markdown: md })).doc.brief, undefined);
  assert.deepEqual(data(dispatch(c, "outline_to_kage", { markdown: md, mode: "read" })).doc.brief, { mode: "read" });
  assert.ok(!dispatch(c, "outline_to_kage", { markdown: md, mode: "bogus" }).ok);
});

test("list_kages carries the declared mode (null when none) and describe_kage labels it", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: sampleKage({ id: "d" }), mode: "read" });
  dispatch(c, "create_kage", { doc: sampleKage({ id: "u" }) });
  const cards = data(dispatch(c, "list_kages")) as { name: string; mode: string | null }[];
  assert.equal(cards.find((x) => x.name === "d")!.mode, "read");
  assert.equal(cards.find((x) => x.name === "u")!.mode, null);
  assert.match(data(dispatch(c, "describe_kage", { name: "d" })), /^<kage-content untrusted="true">\nmode: read \(declared\)\n/);
  assert.match(data(dispatch(c, "describe_kage", { name: "u" })), /\nmode: \w+ \(inferred, (low|medium) confidence\)\n/);
});

test("clone keeps the brief", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: sampleKage({ id: "orig" }), mode: "operate" });
  assert.ok(dispatch(c, "clone_kage", { name: "orig", title: "Copy of orig" }).ok);
  const copy = c.store.list().find((v) => v.name !== "orig")!;
  assert.equal(copy.doc.brief?.mode, "operate");
});

test("claims: the workspace brief's absent list escalates, and get_context raises UNSOURCED_CLAIMS in persuade mode only", () => {
  const c = ctx();
  const doc = (id: string, mode: "persuade" | "operate"): KageDoc => ({ ...sampleKage({ id }), brief: { mode }, blocks: { root: { type: "stack", props: {}, slots: { children: ["q"] } }, q: { type: "text", props: { text: "“It changed how we work every single day.” — Jane Doe, CTO at Acme" } } } });
  dispatch(c, "create_kage", { doc: doc("pitch", "persuade") });
  dispatch(c, "create_kage", { doc: doc("tool", "operate") });
  const sev = () => data(dispatch(c, "lint_kage", { name: "pitch" })).findings.find((f: { rule: string }) => f.rule === "unsourced-claim")?.severity;
  assert.equal(sev(), "P2");
  dispatch(c, "set_brief", { brief: { users: "Buyers", purpose: "Sell", absent: ["testimonials"] } });
  assert.equal(sev(), "P1", "the workspace says testimonials must not be invented");
  const dirs = (name: string) => data(dispatch(c, "get_context", { kage: name })).directives.map((d: { code: string }) => d.code);
  assert.ok(dirs("pitch").includes("UNSOURCED_CLAIMS"));
  assert.ok(dirs("pitch").includes("LINT_P1"));
  assert.ok(!dirs("tool").includes("UNSOURCED_CLAIMS"), "operate surfaces are not marketing");
  dispatch(c, "set_kage_brief", { name: "pitch", brief: { mode: "persuade", evidence: [{ block: "q", source: "signed quote from Jane Doe, 2026-09-30" }] } });
  assert.ok(!dirs("pitch").includes("UNSOURCED_CLAIMS"), "recording a source clears it");
});
