// Multi-project membership through the operation set: creating a (possibly empty) project,
// tagging a Kage into extra projects beyond its home repo, how listing counts by membership,
// the permission model (membership is a write on the home repo; creating needs workspace
// membership; it grants no read), snapshot round-trip and back-compat with old snapshots.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Store, type StoreSnapshot } from "../store/store.ts";
import { dispatch, type OpContext } from "./operations.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import legacy from "../store/__fixtures__/legacy-snapshot.json" with { type: "json" };

function ctx(grants: Array<"read" | "write" | "admin" | "publish"> = ["read", "write", "publish", "admin"], store = new Store(), repo = "kages"): OpContext {
  store.grant("agent:t", repo, grants);
  return { store, author: { principal: "agent:t" } };
}
const data = (r: unknown) => (r as { ok: true; data: any }).data;
const code = (r: unknown) => (r as { ok: false; error: { code: string } }).error.code;
const projectsOf = (c: OpContext) => data(dispatch(c, "list_projects", {})).projects as { project: string; count: number }[];
const cardProjects = (c: OpContext, name: string) => (data(dispatch(c, "list_kages", {})) as { name: string; projects: string[] }[]).find((k) => k.name === name)?.projects;

test("an empty project is created, persists, and lists with count 0", () => {
  const c = ctx();
  assert.ok(dispatch(c, "create_project", { name: "roadmap" }).ok);
  assert.deepEqual(projectsOf(c).find((p) => p.project === "roadmap"), { project: "roadmap", count: 0 });
  // Creating is idempotent — making it again is a success, not a conflict.
  assert.ok(dispatch(c, "create_project", { name: "roadmap" }).ok);
  assert.equal(code(dispatch(c, "create_project", { name: "Bad Name!" })), "invalid_name");
});

test("a Kage belongs to its home repo plus any extra projects it is tagged into", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: sampleKage({ id: "k" }), repo: "kages" });
  assert.deepEqual(cardProjects(c, "k"), ["kages"], "home repo is the implicit, always-present project");
  assert.ok(dispatch(c, "set_kage_projects", { name: "k", projects: ["shared", "weekly"] }).ok);
  assert.deepEqual(cardProjects(c, "k"), ["kages", "shared", "weekly"], "home first, extras sorted");
  // The home repo passed in membership is dropped (it is implicit), never duplicated.
  assert.ok(dispatch(c, "set_kage_projects", { name: "k", projects: ["kages", "shared"] }).ok);
  assert.deepEqual(cardProjects(c, "k"), ["kages", "shared"]);
  // An emptied membership leaves only the home repo.
  assert.ok(dispatch(c, "set_kage_projects", { name: "k", projects: [] }).ok);
  assert.deepEqual(cardProjects(c, "k"), ["kages"]);
});

test("listing counts a Kage under every project it is in, and tagging makes a project real", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: sampleKage({ id: "k" }), repo: "kages" });
  dispatch(c, "set_kage_projects", { name: "k", projects: ["shared"] });
  const count = (project: string) => projectsOf(c).find((p) => p.project === project)?.count ?? -1;
  assert.equal(count("kages"), 1, "counted under its home repo");
  assert.equal(count("shared"), 1, "and under the project it was tagged into");
  // A project named only by a membership becomes a registered project (survives with its own entry).
  assert.ok(projectsOf(c).some((p) => p.project === "shared"));
});

test("membership is organizational only: it grants no read, and needs write on the HOME repo", () => {
  const admin = ctx();
  dispatch(admin, "create_kage", { doc: sampleKage({ id: "k" }), repo: "kages" });
  // A principal with write only on a different repo cannot retag a Kage whose home repo it lacks.
  const other: OpContext = { store: admin.store, author: { principal: "agent:other" } };
  admin.store.grant("agent:other", "shared", ["read", "write"]);
  // Concealment: a caller who cannot even READ the home repo must not learn the Kage exists, so forbidden reads as not_found.
  assert.equal(code(dispatch(other, "set_kage_projects", { name: "k", projects: ["shared"] })), "not_found");
  // Even once a Kage is tagged into "shared", a reader of "shared" (not of the home repo) still cannot read it.
  dispatch(admin, "set_kage_projects", { name: "k", projects: ["shared"] });
  assert.equal(code(dispatch(other, "get_kage", { name: "k" })), "not_found", "a project tag is not a read grant");
});

test("creating a project needs workspace membership; an outsider is refused", () => {
  const c = ctx();
  const outsider: OpContext = { store: c.store, author: { principal: "anon" } };
  assert.equal(code(dispatch(outsider, "create_project", { name: "secret" })), "forbidden");
  assert.ok(dispatch(outsider, "list_projects", {}).ok, "listing is a read, like list_repos — it just shows nothing private");
});

test("projects survive a snapshot round trip; a snapshot from before projects restores with none", () => {
  const c = ctx();
  dispatch(c, "create_project", { name: "empty" });
  dispatch(c, "create_kage", { doc: sampleKage({ id: "k" }), repo: "kages" });
  dispatch(c, "set_kage_projects", { name: "k", projects: ["shared"] });
  const snap = JSON.parse(JSON.stringify(c.store.snapshot())) as StoreSnapshot;
  assert.deepEqual([...snap.projects!].sort(), ["empty", "shared"]);
  assert.deepEqual(snap.memberships, [["k", ["shared"]]]);
  const back = ctx(["read", "write", "publish", "admin"], Store.restore(snap));
  assert.deepEqual(cardProjects(back, "k"), ["kages", "shared"]);
  assert.ok(projectsOf(back).some((p) => p.project === "empty" && p.count === 0));
  // An old snapshot with no projects/memberships keys still restores, with an empty registry.
  const old = Store.restore(JSON.parse(JSON.stringify(legacy)) as StoreSnapshot);
  assert.equal((old.snapshot() as { projects?: unknown }).projects, undefined, "an empty registry adds nothing to the snapshot");
  assert.equal((old.snapshot() as { memberships?: unknown }).memberships, undefined);
});
