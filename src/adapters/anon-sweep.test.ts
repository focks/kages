// A systematic privacy sweep: every operation, called by an anonymous reader against a workspace whose only
// Kage is private. Two properties, per operation: (1) nothing the owner wrote (document text, comment, brief,
// critique, names) appears in the answer; (2) the answer for the private Kage is the same as for a Kage that does
// not exist, so a caller cannot probe which private names exist. Operations that write are covered by the
// write-boundary tests; here they must at least not echo private data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store/store.ts";
import { OPERATIONS, dispatch, type OpResult } from "./operations.ts";
import { sampleKage } from "../test-support/fixtures.ts";

const owner = { principal: "user:owner" }, anon = { principal: "anon" };
const SECRET = "TOPSECRETTEXT", NAME = "private-kage", GHOST = "ghost-kage";

function world() {
  const s = new Store({ workspace: "w" });
  s.grant(owner.principal, "r", ["read", "write", "publish", "review", "admin"]);
  const doc = sampleKage({ id: NAME, title: "Private plan " + SECRET });
  (doc.blocks.hello.props as { text: string }).text = SECRET;
  assert.ok(s.create("r", doc, owner).ok);
  assert.ok(s.addComment(NAME, owner, { text: SECRET + " comment" }).ok);
  assert.ok((s.setBrief as (b: unknown, a: unknown) => { ok: boolean })({ users: SECRET + " users", purpose: SECRET + " purpose" }, owner).ok);
  return { s, uuid: (s.head(NAME) as { uuid: string }).uuid };
}

/** Plausible arguments for an operation, naming the target Kage (or a ghost). */
function paramsFor(spec: { params: string[] }, target: string, uuid: string): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  for (const raw of spec.params) {
    const k = raw.replace(/\?$/, "");
    const v: Record<string, unknown> = {
      name: target, kage: target, uuid, text: "probe", repo: "r", system: "core", ref: "core/text@1.0.0", direction: "quieter", ops: [{ op: "replace", path: "/title", value: "x" }],
      doc: sampleKage({ id: "probe" }), id: "c1", value: 1, version: 1, markdown: "# probe\n\nbody text here", title: "probe", scope: "doc", block: "hello", envelope: {}, intake: {}, spec: { root: "a", elements: { a: { type: "Stack", props: {} } } },
      types: [], since: 0, resolved: false, format: "json", blocks: ["hello"], command: "polish", body: "probe", intent: "probe", state: "draft", visibility: "public", apply: false, brief: undefined,
    };
    if (k in v && v[k] !== undefined) p[k] = v[k];
  }
  return p;
}
const norm = (r: OpResult, from: string, to: string) => JSON.stringify(r).split(from).join(to);

test("no operation reveals a private Kage, its comments or the workspace brief to an anonymous caller", () => {
  const { s, uuid } = world();
  const leaks: string[] = [];
  for (const spec of OPERATIONS) {
    const r = dispatch({ store: s, author: anon }, spec.name, paramsFor(spec, NAME, uuid));
    const out = JSON.stringify(r);
    if (out.includes(SECRET)) leaks.push(`${spec.name} leaked document text`);
    if (!spec.params.some((p) => /^(name|kage|uuid)\??$/.test(p)) && out.includes(NAME)) leaks.push(`${spec.name} leaked the private name`);
  }
  assert.deepEqual(leaks, []);
});

test("an anonymous caller cannot tell a private Kage from one that does not exist", () => {
  const { s, uuid } = world();
  const differing: string[] = [];
  for (const spec of OPERATIONS.filter((o) => o.params.some((p) => /^(name|kage)\??$/.test(p)))) {
    const real = dispatch({ store: world().s, author: anon }, spec.name, paramsFor(spec, NAME, uuid));
    const ghost = dispatch({ store: world().s, author: anon }, spec.name, paramsFor(spec, GHOST, uuid));
    // Ignore the target's own name echoed back; everything else must match exactly.
    if (norm(real, NAME, "X") !== norm(ghost, GHOST, "X")) differing.push(`${spec.name}: ${norm(real, NAME, "X").slice(0, 110)}  vs  ${norm(ghost, GHOST, "X").slice(0, 110)}`);
  }
  void s;
  assert.deepEqual(differing, []);
});

test("a public head does not open the private versions behind it, and a private project is not listed", () => {
  const s = new Store({ workspace: "w" });
  s.grant(owner.principal, "r", ["read", "write", "publish", "review", "admin"]);
  s.grant(owner.principal, "secret-project", ["read", "write", "publish", "review", "admin"]);
  assert.ok(s.create("r", sampleKage({ id: "pub" }), owner).ok);
  assert.ok(s.patch("pub", [{ op: "replace", path: "/blocks/hello/props/text", value: "v2 " + SECRET }] as never, owner).ok);
  assert.ok(s.publish("pub", owner, "public").ok); // publishes version 2 only; version 1 stays a draft
  assert.ok(s.create("secret-project", sampleKage({ id: "hidden" }), owner).ok);

  const anonView = dispatch({ store: s, author: anon as never }, "list_versions", { name: "pub" });
  assert.ok(anonView.ok, JSON.stringify(anonView));
  const seen = (anonView as { data: { v: number }[] }).data.map((v) => v.v);
  assert.deepEqual(seen, [2], "only the published version, never the earlier draft");
  const ownerView = dispatch({ store: s, author: owner as never }, "list_versions", { name: "pub" });
  assert.deepEqual((ownerView as { data: { v: number }[] }).data.map((v) => v.v), [1, 2], "a reader with a grant sees the whole history");

  const repos = (who: unknown) => ((dispatch({ store: s, author: who as never }, "list_repos", {}) as { data: { projects: { repo: string; count: number }[] } }).data.projects);
  assert.deepEqual(repos(anon), [{ repo: "r", count: 1 }], "the secret project and its count are not disclosed");
  assert.deepEqual(repos(owner).map((p) => p.repo), ["r", "secret-project"]);
});
