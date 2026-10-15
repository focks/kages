// Agent-access behaviour: one operation set behind every adapter, the three
// production tiers, generated surfaces, and skill packs. From
// oracle/agent-access.feature. The adapter-equivalence test is the key one:
// the SAME task must succeed identically through REST and CLI (both over the
// same dispatch), which is the whole promise of "any agent, any protocol".

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Store } from "../store/store.ts";
import { dispatch, OPERATIONS, type OpContext } from "./operations.ts";
import { runCli } from "./cli.ts";
import { handleRest } from "./rest.ts";
import { toolDefs, mcpTools, openapi, a2aCard } from "./surfaces.ts";
import { pack, skillMd } from "../packs/packs.ts";
import { toGenerated } from "../engine/generate.ts";
import type { KageDoc } from "../engine/types.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const ops = () => JSON.parse(readFileSync(here + "../../public/ds/ops-console.kage.json", "utf8")) as KageDoc;

function ctx(): OpContext {
  const store = new Store();
  store.grant("agent:acme/demo", "kages", ["write", "publish", "review", "admin"]);
  return { store, author: { principal: "agent:acme/demo" } };
}

test("one operation set: read ops succeed, every op is dispatchable", () => {
  const c = ctx();
  assert.equal((dispatch(c, "list_systems") as any).data.length, 3);
  const cat = dispatch(c, "get_catalog", { system: "core" });
  assert.ok(cat.ok && typeof (cat as any).data === "string");
  assert.equal(dispatch(c, "no_such_op").ok, false);
});

test("tier A: create then patch then publish through dispatch", () => {
  const c = ctx();
  assert.ok(dispatch(c, "create_kage", { doc: ops() }).ok);
  assert.ok(dispatch(c, "patch_kage", { name: "ops-console", ops: [{ op: "replace", path: "/title", value: "Ops" }] }).ok);
  assert.equal((dispatch(c, "get_kage", { name: "ops-console" }) as any).data.title, "Ops");
  assert.ok(dispatch(c, "publish_kage", { name: "ops-console" }).ok);
});

test("tier B: generate from an envelope round-trips to a valid Kage", () => {
  const c = ctx();
  const envelope = toGenerated(ops(), "core");
  const r = dispatch(c, "generate_kage", { system: "core", envelope });
  assert.ok(r.ok, JSON.stringify((r as any).error));
  assert.equal((r as any).data.validation.errors.length, 0);
});

test("cloning preserves ordinary projects and honors an explicit destination for templates", () => {
  const c = ctx();
  assert.ok(dispatch(c, "create_kage", { doc: ops(), repo: "reports" }).ok);
  const ordinary = dispatch(c, "clone_kage", { name: "ops-console", title: "Report copy" }) as any;
  assert.equal(ordinary.ok, true);
  assert.equal(c.store.repoOf(ordinary.data.version.ref), "reports");

  const template = { ...ops(), id: "starter" };
  assert.ok(dispatch(c, "create_kage", { doc: template, repo: "templates" }).ok);
  for (const repo of ["reports", "templates"]) {
    const copied = dispatch(c, "clone_kage", { name: "starter", title: `Copy for ${repo}`, repo }) as any;
    assert.equal(copied.ok, true);
    assert.equal(c.store.repoOf(copied.data.version.ref), repo);
  }
});

test("tier C: generate from raw text with prose + trailing commas", () => {
  const c = ctx();
  const envelope = toGenerated(ops(), "core");
  const text = `Sure! Here is the envelope:\n\n${JSON.stringify(envelope).replace(/}/, " }")},\n\nHope that helps.`;
  const r = dispatch(c, "generate_kage", { system: "core", text });
  assert.ok(r.ok, JSON.stringify((r as any).error));
});

test("describe_kage fences output as untrusted", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: ops() });
  const r = dispatch(c, "describe_kage", { name: "ops-console" });
  assert.match((r as any).data, /^<kage-content untrusted="true">/);
});

test("preview_kage returns resolved outputs and visibility per block", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: ops() });
  const r = dispatch(c, "preview_kage", { name: "ops-console" }) as any;
  assert.equal(r.data.system, "core");
  assert.equal(r.data.blocks.ordersTable.output.rows.length, 8);
  assert.equal(r.data.blocks.customersView.visible, false);
});

test("get_state returns initial app state", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: ops() });
  assert.equal((dispatch(c, "get_state", { name: "ops-console" }) as any).data.region, "all");
});

test("adapter equivalence: REST and CLI yield the same result as dispatch", async () => {
  // Three contexts, same seeded task, three protocols -> identical outcome.
  const direct = ctx(); dispatch(direct, "create_kage", { doc: ops() });
  const viaCli = ctx(); runCli(viaCli, ["create_kage", "--doc", JSON.stringify(ops())]);
  const viaRest = ctx();
  await handleRest(viaRest, "create_kage", new Request("http://x/api/create_kage", { method: "POST", body: JSON.stringify({ doc: ops() }) }));

  const read = (c: OpContext) => (dispatch(c, "get_kage", { name: "ops-console" }) as any).data.title;
  assert.equal(read(direct), "Order operations");
  assert.equal(read(viaCli), read(direct));
  assert.equal(read(viaRest), read(direct));
});

test("CLI reports operation errors with a non-zero exit code", () => {
  const r = runCli(ctx(), ["get_kage", "--name", "nope"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /not_found/);
});

test("REST maps error codes to HTTP status", async () => {
  const res = await handleRest(ctx(), "get_kage", new Request("http://x/api/get_kage?name=nope"));
  assert.equal(res.status, 404);
});

test("REST refuses a write operation over GET (405)", async () => {
  const c = ctx();
  const res = await handleRest(c, "publish_kage", new Request("http://x/api/publish_kage?name=ops-console", { method: "GET" }));
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("Allow"), "POST");
  // read over GET still works
  dispatch(c, "create_kage", { doc: ops() });
  const read = await handleRest(c, "get_kage", new Request("http://x/api/get_kage?name=ops-console", { method: "GET" }));
  assert.equal(read.status, 200);
});

test("subscribe returns serializable events + a cursor (no functions)", () => {
  const c = ctx();
  dispatch(c, "create_kage", { doc: ops() });
  const r = dispatch(c, "subscribe", {}) as any;
  assert.ok(Array.isArray(r.data.events));
  assert.equal(typeof r.data.cursor, "number");
  // JSON round-trip proves nothing non-serializable leaked.
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(r.data)));
});

test("generated surfaces cover every operation exactly once", () => {
  const names = OPERATIONS.map((o) => o.name).sort();
  assert.deepEqual(toolDefs().map((t: any) => t.function.name).sort(), names);
  assert.deepEqual(mcpTools().map((t: any) => t.name).sort(), names);
  assert.deepEqual(Object.keys((openapi() as any).paths).map((p) => p.slice(1)).sort(), names);
});

test("A2A card advertises the three delegation skills", () => {
  const skills = (a2aCard() as any).skills.map((s: any) => s.id);
  assert.deepEqual(skills, ["build-kage", "revise-kage", "describe-kage"]);
});

test("skill packs are generated per system and carry the untrusted-data rule", () => {
  for (const sys of ["core", "ledger", "atelier"]) {
    const p = pack(sys);
    assert.ok(p["SKILL.md"].includes(sys === "core" ? "Kages Core" : sys));
    assert.ok(p.rules.some((r) => /UNTRUSTED DATA/.test(r)), "prompt-injection rule present");
  }
  assert.match(skillMd("core"), /## Components/);
});

test("list_kages cards carry a bounded description and the characteristic block types", async () => {
  const { kindsOf, describeCard } = await import("./operations.ts");
  const doc = { blocks: { a: { type: "page" }, b: { type: "table" }, c: { type: "table" }, d: { type: "bar-chart" }, e: { type: "text" }, f: { type: "stat" }, g: { type: "stat" }, h: { type: "gauge" }, i: { type: "map" } } } as any;
  assert.deepEqual(kindsOf(doc), ["stat", "table", "bar-chart", "gauge"], "structural blocks are ignored; most frequent first, ties alphabetical, at most four");
  assert.deepEqual(kindsOf({ blocks: { a: { type: "page" }, b: { type: "text" } } }), []);
  assert.equal(describeCard({ description: "  Own   description ", blocks: {} }), "Own description");
  assert.equal(describeCard({ blocks: { s: { type: "section", props: { description: "From a section" } }, t: { type: "text" } } }), "From a section");
  assert.equal(describeCard({ blocks: { s: { type: "section", props: { description: 42 } } } as any }), "");
  assert.equal(describeCard({ description: "x".repeat(500), blocks: {} }).length, 160);
});
