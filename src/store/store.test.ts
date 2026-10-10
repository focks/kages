// Artifactory + collab behaviour, from oracle/artifactory.feature and
// oracle/collaboration.feature. A fixed clock keeps versions/quotas/claims
// deterministic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Store } from "./store.ts";
import { verifyDigest } from "./crypto.ts";
import { mergeThreeWay } from "../collab/merge.ts";
import { applyPatch } from "../collab/patch.ts";
import type { KageDoc } from "../engine/types.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const ops = () => JSON.parse(readFileSync(here + "../../public/ds/ops-console.kage.json", "utf8")) as KageDoc;

let t = 1_700_000_000_000;
const freshStore = () => new Store({ clock: () => (t += 1000), versionQuotaPerHour: 3 });

const agent = { principal: "agent:acme/builder", runtime: { framework: "langgraph", model: "x/y", adapter: "rest" }, run: "run_1" };

function seeded() {
  const s = freshStore();
  s.grant(agent.principal, "kages", ["write", "publish", "review"]);
  return s;
}

test("create: immutable signed version with provenance and lockfile", () => {
  const s = seeded();
  const r = s.create("kages", ops(), agent);
  assert.ok(r.ok, JSON.stringify(r.error));
  const v = r.version!;
  assert.equal(v.v, 1);
  assert.equal(v.state, "draft");
  assert.equal(v.visibility, "private");
  assert.match(v.ref, /^kages:\/\/acme\/kages\/ops-console@v1$/);
  assert.equal(v.author.principal, agent.principal);
  assert.equal(v.author.runtime?.framework, "langgraph");
  assert.match(v.digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(v.resolved.system, "core@1.4.0");
  assert.equal(v.resolved.blocks.app, "core/shell@1.0.0");
  assert.ok(verifyDigest(s.publicKeyOf(agent.principal), v.digest, v.signature), "signature verifies");
});

test("create: nothing anonymous — a principal without write is refused", () => {
  const s = freshStore(); // no grants
  const r = s.create("kages", ops(), agent);
  assert.equal(r.ok, false);
  assert.equal(r.error?.code, "forbidden");
});

test("write path validates before commit — an invalid doc is rejected atomically", () => {
  const s = seeded();
  const bad = ops();
  bad.root = "ghost"; // missing-root
  const r = s.create("kages", bad, agent);
  assert.equal(r.ok, false);
  assert.equal(r.error?.code, "invalid_content");
  assert.equal(s.head("ops-console"), undefined, "nothing stored");
});

test("patch: new immutable version; old one is untouched", () => {
  const s = seeded();
  s.create("kages", ops(), agent);
  const r = s.patch("kages", "ops-console", [{ op: "replace", path: "/title", value: "Ops" }], agent);
  assert.ok(r.ok, JSON.stringify(r.error));
  assert.equal(r.version!.v, 2);
  assert.equal(r.version!.parent, "kages://acme/kages/ops-console@v1");
  assert.equal(s.getVersion("ops-console", 1)!.doc.title, "Order operations", "v1 immutable");
  assert.equal(s.getVersion("ops-console", 2)!.doc.title, "Ops");
});

test("lifecycle: draft -> published requires publish grant and a clean version; private by default", () => {
  const s = seeded();
  s.create("kages", ops(), agent);
  const pub = s.publish("kages", "ops-console", agent.principal);
  assert.ok(pub.ok);
  assert.equal(s.head("ops-console")!.state, "published");
  assert.equal(s.head("ops-console")!.visibility, "private");
});

test("RBAC: a reviewer agent physically cannot patch", () => {
  const s = freshStore();
  s.grant("agent:acme/builder", "kages", ["write"]);
  s.grant("agent:acme/reviewer", "kages", ["review"]);
  s.create("kages", ops(), { principal: "agent:acme/builder" });
  const r = s.patch("kages", "ops-console", [{ op: "replace", path: "/title", value: "X" }], { principal: "agent:acme/reviewer" });
  assert.equal(r.ok, false);
  assert.equal(r.error?.code, "forbidden");
});

test("onBehalfOf gets the intersection of grants", () => {
  const s = freshStore();
  s.grant("agent:acme/builder", "kages", ["write"]);
  // user has no write -> delegated write is refused even though the agent has it
  const r = s.create("kages", ops(), { principal: "agent:acme/builder", onBehalfOf: "user:guest" });
  assert.equal(r.ok, false);
  s.grant("user:guest", "kages", ["write"]);
  assert.ok(s.create("kages", ops(), { principal: "agent:acme/builder", onBehalfOf: "user:guest" }).ok);
});

test("quota: runaway writer is rate-limited, not billed", () => {
  const s = seeded(); // quota 3/hour
  s.create("kages", ops(), agent);
  s.patch("kages", "ops-console", [{ op: "replace", path: "/title", value: "a" }], agent);
  s.patch("kages", "ops-console", [{ op: "replace", path: "/title", value: "b" }], agent);
  const r = s.patch("kages", "ops-console", [{ op: "replace", path: "/title", value: "c" }], agent);
  assert.equal(r.ok, false);
  assert.equal(r.error?.code, "rate_limited");
});

test("events: version.created and published reach subscribers", () => {
  const s = seeded();
  const got: string[] = [];
  s.subscribe((e) => got.push(e.type));
  s.create("kages", ops(), agent);
  s.publish("kages", "ops-console", agent.principal);
  assert.ok(got.includes("kage.version.created"));
  assert.ok(got.includes("kage.published"));
});

test("search + card + export/import", () => {
  const s = seeded();
  s.create("kages", ops(), agent);
  assert.equal(s.search({ text: "order operations" }).length, 1);
  assert.equal(s.search({ system: "core" }).length, 1);
  assert.equal(s.search({ system: "ledger" }).length, 0);
  assert.equal(s.card("ops-console")!.blocks, 24);
  const json = s.exportJSON("ops-console")!;
  const s2 = seeded();
  assert.ok(s2.importJSON("kages", json, agent).ok, "re-validates and imports");
});

test("claims: another agent's patch to a claimed block is refused; lease expires", () => {
  let now = 0;
  const s = new Store({ clock: () => now });
  s.grant("agent:a", "kages", ["write"]);
  s.grant("agent:b", "kages", ["write"]);
  s.create("kages", ops(), { principal: "agent:a" });
  assert.ok(s.claims.claim("ops-console", ["kpi*"], "agent:a", 300, now).ok);
  const blocked = s.patch("kages", "ops-console", [{ op: "replace", path: "/blocks/kpiOpen/props/label", value: "X" }], { principal: "agent:b" });
  assert.equal(blocked.error?.code, "claimed");
  now += 301_000; // lease expires
  assert.ok(s.patch("kages", "ops-console", [{ op: "replace", path: "/blocks/kpiOpen/props/label", value: "X" }], { principal: "agent:b" }).ok);
});

test("disjoint-block patches both apply; same-block edits conflict (three-way merge)", () => {
  const base = ops();
  const theirs = applyPatch(base, [{ op: "replace", path: "/blocks/kpiOpen/props/label", value: "Open now" }]);
  const yoursDisjoint = applyPatch(base, [{ op: "replace", path: "/blocks/kpiRevenue/props/label", value: "Revenue" }]);
  const m1 = mergeThreeWay(base, theirs, yoursDisjoint);
  assert.ok(m1.ok, "disjoint merges clean");
  assert.equal(m1.doc!.blocks.kpiOpen.props!.label, "Open now");
  assert.equal(m1.doc!.blocks.kpiRevenue.props!.label, "Revenue");

  const yoursSame = applyPatch(base, [{ op: "replace", path: "/blocks/kpiOpen/props/label", value: "Still open!" }]);
  const m2 = mergeThreeWay(base, theirs, yoursSame);
  assert.equal(m2.ok, false, "same-block edits conflict");
  assert.equal(m2.conflicts[0].blockId, "kpiOpen");
});

test("comments anchor to a block and can carry a suggested patch", () => {
  const s = seeded();
  s.create("kages", ops(), agent);
  const c = s.comment("ops-console", "kpiRevenue", "agent:acme/a11y", "Add a caption", [{ op: "add", path: "/blocks/kpiRevenue/props/caption", value: "vs last week" }]);
  assert.equal(c.block, "kpiRevenue");
  assert.equal(s.comments.forBlock("ops-console", "kpiRevenue").length, 1);
  assert.ok(c.suggestedPatch);
});
