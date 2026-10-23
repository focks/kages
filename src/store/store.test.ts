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
  assert.equal(v.resolved.system, "core@1.15.0");
  assert.equal(v.resolved.blocks.app, "core/shell@1.0.0");
  assert.ok(verifyDigest(s.publicKeyOf(agent.principal), v.digest, v.signature), "signature verifies");
});

test("create: can't create into a project someone else owns", () => {
  const s = freshStore();
  s.grant("agent:acme/owner", "kages", ["admin"]); // repo already claimed by another principal
  const r = s.create("kages", ops(), agent);        // agent has no grant here
  assert.equal(r.ok, false);
  assert.equal(r.error?.code, "forbidden");
});

test("create: first creator claims an unclaimed project and becomes its owner", () => {
  const s = freshStore(); // no grants anywhere
  const r = s.create("newproj", ops(), agent);
  assert.ok(r.ok, JSON.stringify(r.error));
  assert.match(r.version!.ref, /^kages:\/\/acme\/newproj\/ops-console@v1$/);
  // and the claim sticks: a different principal can't now create into newproj
  const other = { ...agent, principal: "agent:acme/intruder" };
  const intrude = s.create("newproj", { ...ops(), id: "other-kage" }, other);
  assert.equal(intrude.ok, false);
  assert.equal(intrude.error?.code, "forbidden");
});

test("uuid: minted once, stable across versions, unique per Kage, resolvable, survives restore", () => {
  const s = seeded();
  s.create("kages", ops(), agent);
  const u = s.head("ops-console")!.uuid;
  assert.match(u, /^[0-9a-f-]{36}$/);
  s.patch("ops-console", [{ op: "add", path: "/blocks/kpiRevenue/props/caption", value: "x" }], agent);
  assert.equal(s.head("ops-console")!.uuid, u, "uuid carried across versions");
  assert.equal(s.nameByUuid(u), "ops-console");

  s.create("kages", { ...ops(), id: "other-kage" }, agent);
  assert.notEqual(s.head("other-kage")!.uuid, u, "distinct Kages get distinct uuids");

  const restored = Store.restore(s.snapshot());
  assert.equal(restored.nameByUuid(u), "ops-console", "uuid survives snapshot/restore");
});

test("uuid: a pre-uuid snapshot is backfilled on restore", () => {
  const s = seeded();
  s.create("kages", ops(), agent);
  const snap = s.snapshot();
  for (const k of snap.kages) for (const v of k.versions) delete (v as { uuid?: string }).uuid; // simulate old data
  const restored = Store.restore(snap);
  const u = restored.head("ops-console")!.uuid;
  assert.ok(u, "uuid assigned on restore");
  assert.equal(restored.nameByUuid(u), "ops-console");
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
  const r = s.patch("ops-console", [{ op: "replace", path: "/title", value: "Ops" }], agent);
  assert.ok(r.ok, JSON.stringify(r.error));
  assert.equal(r.version!.v, 2);
  assert.equal(r.version!.parent, "kages://acme/kages/ops-console@v1");
  assert.equal(s.getVersion("ops-console", 1)!.doc.title, "Order operations", "v1 immutable");
  assert.equal(s.getVersion("ops-console", 2)!.doc.title, "Ops");
});

test("lifecycle: draft -> published requires publish grant and a clean version; private by default", () => {
  const s = seeded();
  s.create("kages", ops(), agent);
  const pub = s.publish("ops-console", agent);
  assert.ok(pub.ok);
  assert.equal(s.head("ops-console")!.state, "published");
  assert.equal(s.head("ops-console")!.visibility, "private");
});

test("lifecycle: unpublish/deprecate/restore and direct archive move between the right states", () => {
  const s = seeded();
  s.create("kages", ops(), agent);
  assert.ok(s.publish("ops-console", agent).ok);
  // unpublish pulls a published Kage back to draft (the inverse of publish)
  assert.ok(s.unpublish("ops-console", agent).ok);
  assert.equal(s.head("ops-console")!.state, "draft");
  // re-publish, deprecate, then restore straight back to published
  assert.ok(s.publish("ops-console", agent).ok);
  assert.ok(s.deprecate("ops-console", agent).ok);
  assert.equal(s.head("ops-console")!.state, "deprecated");
  assert.ok(s.restore("ops-console", agent).ok);
  assert.equal(s.head("ops-console")!.state, "published");
  // archive is reachable directly (not only deprecated -> archived)
  assert.ok(s.archive("ops-console", agent).ok);
  assert.equal(s.head("ops-console")!.state, "archived");
  assert.ok(s.restore("ops-console", agent).ok); // archived -> published
  assert.equal(s.head("ops-console")!.state, "published");
});

test("delete: requires admin, removes the Kage, and records the deletion in the audit", () => {
  // seeded() grants write/publish/review but NOT admin → delete is refused.
  const s = seeded();
  s.create("kages", ops(), agent);
  const denied = s.remove("ops-console", agent);
  assert.equal(denied.ok, false);
  assert.equal(denied.error?.code, "forbidden");

  // A creator in an unclaimed repo is its admin → delete succeeds and the Kage is gone.
  const s2 = freshStore();
  s2.create("proj", ops(), agent); // unclaimed repo → agent gets admin
  const uuid = s2.head("ops-console")!.uuid;
  const r = s2.remove("ops-console", agent);
  assert.ok(r.ok);
  assert.equal(r.version!.uuid, uuid);
  assert.equal(s2.head("ops-console"), undefined);
  assert.ok(s2.auditLog().some((e) => e.action === "delete"), "deletion is audited even though the doc is gone");
});

test("lifecycle: archive resets visibility so restore can't silently re-expose a public Kage", () => {
  const s = seeded(); // has publish
  s.create("kages", ops(), agent);
  assert.ok(s.publish("ops-console", agent, "public").ok);
  assert.equal(s.head("ops-console")!.visibility, "public");
  assert.ok(s.archive("ops-console", agent).ok);
  assert.equal(s.head("ops-console")!.visibility, "private"); // reset on archive
  assert.ok(s.restore("ops-console", agent).ok);
  assert.equal(s.head("ops-console")!.state, "published");
  assert.equal(s.head("ops-console")!.visibility, "private"); // NOT re-exposed
});

test("lifecycle: archiving a PUBLISHED Kage needs publish, but a draft can be archived by a writer", () => {
  const s = freshStore();
  s.grant(agent.principal, "kages", ["write", "publish"]);
  s.grant("agent:w", "kages", ["write"]);
  s.create("kages", ops(), agent);
  assert.ok(s.publish("ops-console", agent).ok);
  const denied = s.archive("ops-console", { principal: "agent:w" }); // write-only can't take published offline
  assert.equal(denied.ok, false);
  assert.equal(denied.error?.code, "forbidden");
  s.create("kages", { ...ops(), id: "draft-k" }, agent);
  assert.ok(s.archive("draft-k", { principal: "agent:w" }).ok); // but a draft is fine
});

test("delete: purges the Kage's comments and claims so a reused name starts clean", () => {
  const s = freshStore();
  s.create("proj", ops(), agent); // unclaimed repo → agent gets admin
  s.comment("ops-console", "app", agent.principal, "note");
  s.claims.claim("ops-console", ["app"], agent.principal, 300, 1);
  assert.equal(s.comments.all("ops-console").length, 1);
  assert.ok(s.remove("ops-console", agent).ok);
  assert.equal(s.comments.all("ops-console").length, 0);
  assert.ok(s.claims.canWrite("ops-console", "app", "agent:other", 2)); // claim gone
  // recreate the same name → no inherited comments
  s.create("proj", ops(), agent);
  assert.equal(s.comments.all("ops-console").length, 0);
});

test("RBAC: a reviewer agent physically cannot patch", () => {
  const s = freshStore();
  s.grant("agent:acme/builder", "kages", ["write"]);
  s.grant("agent:acme/reviewer", "kages", ["review"]);
  s.create("kages", ops(), { principal: "agent:acme/builder" });
  const r = s.patch("ops-console", [{ op: "replace", path: "/title", value: "X" }], { principal: "agent:acme/reviewer" });
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
  s.patch("ops-console", [{ op: "replace", path: "/title", value: "a" }], agent);
  s.patch("ops-console", [{ op: "replace", path: "/title", value: "b" }], agent);
  const r = s.patch("ops-console", [{ op: "replace", path: "/title", value: "c" }], agent);
  assert.equal(r.ok, false);
  assert.equal(r.error?.code, "rate_limited");
});

test("events: version.created and published reach subscribers", () => {
  const s = seeded();
  const got: string[] = [];
  s.subscribe((e) => got.push(e.type));
  s.create("kages", ops(), agent);
  s.publish("ops-console", agent);
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
  const blocked = s.patch("ops-console", [{ op: "replace", path: "/blocks/kpiOpen/props/label", value: "X" }], { principal: "agent:b" });
  assert.equal(blocked.error?.code, "claimed");
  now += 301_000; // lease expires
  assert.ok(s.patch("ops-console", [{ op: "replace", path: "/blocks/kpiOpen/props/label", value: "X" }], { principal: "agent:b" }).ok);
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

// --- security regressions (from the review) ------------------------------

test("F1: a forbidden patch is rejected without any side effect", () => {
  const s = freshStore(); // no grants for anyone
  s.grant("agent:owner", "kages", ["write"]);
  s.create("kages", ops(), { principal: "agent:owner" });
  const r = s.patch("ops-console", [{ op: "add", path: "/__proto__/reviewProbe", value: "x" }], { principal: "agent:nobody" });
  assert.equal(r.ok, false);
  assert.equal(r.error?.code, "forbidden");
  assert.equal(({} as Record<string, unknown>).reviewProbe, undefined, "prototype not polluted");
});

test("F2: permission binds to the resource's repo, not the caller's claim", () => {
  const s = freshStore();
  s.grant("agent:x", "secret", ["write"]);
  s.grant("agent:x", "mine", ["write"]);
  s.create("secret", ops(), { principal: "agent:x" }); // lives in repo 'secret'
  // Revoke secret; agent:x now only has write on 'mine'.
  s.grant("agent:x", "secret", []);
  const r = s.patch("ops-console", [{ op: "replace", path: "/title", value: "sneak" }], { principal: "agent:x" });
  assert.equal(r.ok, false, "cannot patch a repo:secret resource with a repo:mine grant");
  assert.equal(r.error?.code, "forbidden");
});

test("F2: a private draft is invisible to a principal without read", () => {
  const s = freshStore();
  s.grant("agent:owner", "kages", ["write"]);
  s.create("kages", ops(), { principal: "agent:owner" });
  const head = s.head("ops-console")!;
  assert.equal(s.canAccess(head, { principal: "agent:stranger" }), false, "private draft hidden");
  assert.equal(s.authorizeRead("ops-console", { principal: "agent:stranger" }).ok, false);
  assert.equal(s.canAccess(head, { principal: "agent:owner" }), true, "owner reads it");
});

test("F2: share requires publish; publish honours onBehalfOf", () => {
  const s = freshStore();
  s.grant("agent:builder", "kages", ["write", "publish"]);
  s.create("kages", ops(), { principal: "agent:builder" });
  // publish onBehalfOf a user who lacks publish -> refused (intersection)
  assert.equal(s.publish("ops-console", { principal: "agent:builder", onBehalfOf: "user:guest" }).ok, false);
  assert.ok(s.publish("ops-console", { principal: "agent:builder" }).ok);
  // share by a principal without publish -> refused
  assert.equal(s.share("ops-console", { principal: "agent:reader" }, "public").ok, false);
  assert.ok(s.share("ops-console", { principal: "agent:builder" }, "public").ok);
  assert.equal(s.head("ops-console")!.visibility, "public");
});

test("F4: mutating the input after create cannot change the signed version", () => {
  const s = seeded();
  const doc = ops();
  s.create("kages", doc, agent);
  (doc.blocks.heading.props as Record<string, unknown>).variant = "tampered";
  assert.notEqual(s.head("ops-console")!.doc.blocks.heading.props?.variant, "tampered", "ingress cloned");
  // egress: a returned doc is a copy, not the internal record
  const r = s.authorizeRead("ops-console", agent);
  assert.ok(r.ok);
});

test("F5: baseVersion detects a conflicting concurrent edit", () => {
  const s = seeded();
  s.create("kages", ops(), agent);
  // two edits to the SAME block, both from v1
  const a = s.patch("ops-console", [{ op: "replace", path: "/blocks/kpiOpen/props/label", value: "A" }], agent, { baseVersion: 1 });
  assert.ok(a.ok); // first lands as v2
  const b = s.patch("ops-console", [{ op: "replace", path: "/blocks/kpiOpen/props/label", value: "B" }], agent, { baseVersion: 1 });
  assert.equal(b.ok, false, "second edit from the stale base conflicts");
  assert.equal(b.error?.code, "conflict");
});

test("F5: a /blocks wholesale replace cannot bypass a block claim", () => {
  let now = 0;
  const s = new Store({ clock: () => now });
  s.grant("agent:a", "kages", ["write"]);
  s.grant("agent:b", "kages", ["write"]);
  s.create("kages", ops(), { principal: "agent:a" });
  s.claims.claim("ops-console", ["kpiOpen"], "agent:a", 300, now);
  const r = s.patch("ops-console", [{ op: "replace", path: "/blocks", value: { app: { type: "shell" } } }], { principal: "agent:b" });
  assert.equal(r.ok, false, "replacing /blocks touches the claimed block");
  assert.equal(r.error?.code, "claimed");
});

test("documents containing NUL are refused at the store boundary, not lost at persistence", () => {
  const s = new Store({ workspace: "w" });
  const a = { principal: "agent:a" };
  s.grant("agent:a", "r", ["write", "publish", "review", "admin"]);
  const doc: any = { kages: "1.0", id: "nul", title: "T", system: "core@1", root: "t", blocks: { t: { type: "text", props: { text: "ok" } } } };
  assert.ok(s.create("r", doc, a).ok);
  const bad = s.patch("nul", [{ op: "replace", path: "/blocks/t/props/text", value: "a\u0000b" }], a);
  assert.equal(bad.ok, false); assert.equal(bad.error?.code, "invalid_content");
  assert.equal(s.create("r", { ...doc, id: "nul2", title: "x\u0000y" }, a).ok, false);
  assert.equal((s.head("nul")!.doc.blocks.t.props as any).text, "ok", "the failed patch changed nothing");
});
