// validate_patch is the free twin of patch_kage: same verdict, no side effects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store/store.ts";
import { dispatch, type OpContext } from "./operations.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import type { KageDoc } from "../engine/types.ts";
import type { PatchOp } from "../collab/patch.ts";

function setup(clock?: () => number) {
  const store = new Store({ clock });
  store.grant("agent:w", "kages", ["read", "write", "publish", "admin"]);
  store.grant("agent:r", "kages", ["read"]);
  const w: OpContext = { store, author: { principal: "agent:w" } };
  const r: OpContext = { store, author: { principal: "agent:r" } };
  const doc: KageDoc = { ...sampleKage({ id: "k" }), blocks: {
    root: { type: "stack", props: {}, slots: { children: ["a", "b"] } },
    a: { type: "text", props: { text: "A" } }, b: { type: "text", props: { text: "B" } },
  } };
  assert.ok(dispatch(w, "create_kage", { doc }).ok);
  return { store, w, r };
}
const data = (x: unknown) => (x as { ok: true; data: any }).data;

// Fingerprint of everything a dry run must not touch.
const state = (s: Store) => JSON.stringify({ snap: s.snapshot(), events: s.eventLog().length, audit: s.auditLog().length });

const CASES: { name: string; ops: PatchOp[]; base?: number }[] = [
  { name: "valid edit", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "A2" }] },
  { name: "valid add", ops: [{ op: "add", path: "/blocks/c", value: { type: "text", props: { text: "C" } } }, { op: "add", path: "/blocks/root/slots/children/-", value: "c" }] },
  { name: "bad path", ops: [{ op: "replace", path: "/blocks/zzz/props/text", value: "x" }] },
  { name: "second op bad", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "ok" }, { op: "remove", path: "/blocks/nope" }] },
  { name: "unknown block type", ops: [{ op: "replace", path: "/blocks/a/type", value: "no-such-block" }] },
  { name: "structural", ops: [{ op: "replace", path: "/title", value: "Renamed" }] },
  { name: "unknown op", ops: [{ op: "frobnicate", path: "/x" } as never] },
  { name: "test op failing", ops: [{ op: "test", path: "/title", value: "wrong" }] },
  { name: "proto pollution", ops: [{ op: "add", path: "/__proto__/x", value: 1 }] },
  { name: "NUL", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "a\u0000b" }] },
  { name: "missing base", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "x" }], base: 99 },
];

test("differential: validate_patch agrees with patch_kage on every case, and spends nothing", () => {
  for (const c of CASES) {
    const { store, w } = setup();
    const before = state(store);
    const dry = dispatch(w, "validate_patch", { name: "k", ops: c.ops, baseVersion: c.base });
    if (!dry.ok) {
      const real = dispatch(w, "patch_kage", { name: "k", ops: c.ops, baseVersion: c.base });
      assert.ok(!real.ok && real.error.code === dry.error.code, `${c.name}: transport validation agrees`);
      assert.equal(state(store), before);
      continue;
    }
    assert.equal(state(store), before, `${c.name}: a dry run changes nothing`);
    const real = dispatch(w, "patch_kage", { name: "k", ops: c.ops, baseVersion: c.base });
    assert.equal(data(dry).ok, real.ok, `${c.name}: verdict differs (dry ${JSON.stringify(data(dry).error)}, real ${JSON.stringify(real.ok ? "ok" : real.error)})`);
    if (!real.ok) assert.equal(data(dry).error.code, real.error.code, c.name);
    if (real.ok) assert.deepEqual(data(dry).validation, (real as any).data.validation, c.name);
  }
});

test("a dry run reports the next version, the diff and the validation, and leaves history alone", () => {
  const { store, w } = setup();
  const ops: PatchOp[] = [{ op: "replace", path: "/blocks/a/props/text", value: "A2" }];
  for (let i = 0; i < 25; i++) dispatch(w, "validate_patch", { name: "k", ops });
  const d = data(dispatch(w, "validate_patch", { name: "k", ops }));
  assert.equal(d.wouldCreate, 2);
  assert.deepEqual(d.diff, { added: [], removed: [], changed: ["a"], opsApplied: 1 });
  assert.equal(d.validation.ok, true);
  assert.equal(store.list().length, 1);
  assert.equal(data(dispatch(w, "list_versions", { name: "k" })).length, 1);
});

test("a dry run does not spend the version quota", () => {
  let t = 0;
  const store = new Store({ clock: () => t++, versionQuotaPerHour: 2 });
  store.grant("agent:w", "kages", ["read", "write", "admin"]);
  const w: OpContext = { store, author: { principal: "agent:w" } };
  assert.ok(dispatch(w, "create_kage", { doc: sampleKage({ id: "q" }) }).ok);
  const ops: PatchOp[] = [{ op: "replace", path: "/title", value: "T" }];
  for (let i = 0; i < 20; i++) assert.equal(data(dispatch(w, "validate_patch", { name: "q", ops })).ok, true);
  assert.ok(dispatch(w, "patch_kage", { name: "q", ops }).ok, "the second real write is still allowed");
  assert.equal(data(dispatch(w, "validate_patch", { name: "q", ops: [{ op: "replace", path: "/title", value: "U" }] })).error.code, "rate_limited", "and the dry run reports the quota the real one would hit");
});

test("errors point at the failing op", () => {
  const { w } = setup();
  const d = data(dispatch(w, "validate_patch", { name: "k", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "ok" }, { op: "remove", path: "/blocks/nope" }, { op: "remove", path: "/blocks/b" }] }));
  assert.equal(d.ok, false);
  assert.equal(d.error.code, "invalid_patch");
  assert.equal(d.error.opIndex, 1);
  assert.match(d.error.msg, /^op 1 \(remove \/blocks\/nope\)/);
  const real = dispatch(w, "patch_kage", { name: "k", ops: [{ op: "remove", path: "/blocks/nope" }] });
  assert.ok(!real.ok && /^op 0 \(remove \/blocks\/nope\)/.test(real.error.msg));
});

test("new findings are reported as regressions; existing ones are not", () => {
  const { w } = setup();
  const addBtn: PatchOp[] = [{ op: "add", path: "/blocks/btn", value: { type: "button", props: { label: "Go" } } }, { op: "add", path: "/blocks/root/slots/children/-", value: "btn" }];
  const d = data(dispatch(w, "validate_patch", { name: "k", ops: addBtn }));
  assert.deepEqual(d.regressions.map((f: { code: string }) => f.code), ["dead-button"]);
  assert.ok(dispatch(w, "patch_kage", { name: "k", ops: addBtn }).ok);
  const again = data(dispatch(w, "validate_patch", { name: "k", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "A3" }] }));
  assert.deepEqual(again.regressions, [], "the dead button is already there; this edit did not cause it");
  assert.equal(again.advice.some((f: { code: string }) => f.code === "dead-button"), true, "but advice still lists everything");
});

test("merge path: a base behind head merges disjoint edits and reports overlapping ones", () => {
  const { w } = setup();
  assert.ok(dispatch(w, "patch_kage", { name: "k", ops: [{ op: "replace", path: "/blocks/b/props/text", value: "B2" }] }).ok);
  const disjoint = data(dispatch(w, "validate_patch", { name: "k", baseVersion: 1, ops: [{ op: "replace", path: "/blocks/a/props/text", value: "A2" }] }));
  assert.equal(disjoint.ok, true);
  assert.equal(disjoint.merged, true);
  const overlap = data(dispatch(w, "validate_patch", { name: "k", baseVersion: 1, ops: [{ op: "replace", path: "/blocks/b/props/text", value: "B3" }] }));
  assert.equal(overlap.ok, false);
  assert.equal(overlap.error.code, "conflict");
  assert.deepEqual(overlap.conflicts.blocks, ["b"]);
});

test("claims held by someone else are reported, with the holder only to writers", () => {
  const { store, w } = setup();
  store.grant("agent:other", "kages", ["read", "write"]);
  assert.ok(dispatch({ store, author: { principal: "agent:other" } }, "claim_blocks", { kage: "k", blocks: ["a"], ttl: 600 }).ok);
  const d = data(dispatch(w, "validate_patch", { name: "k", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "x" }] }));
  assert.equal(d.ok, false);
  assert.equal(d.error.code, "claimed");
  assert.deepEqual(d.claims, [{ block: "a", heldBy: "agent:other" }]);
  const mine = dispatch({ store, author: { principal: "agent:other" } }, "validate_patch", { name: "k", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "x" }] });
  assert.equal(data(mine).ok, true, "the holder may edit their own block");
});

test("permissions: a reader gets the picture with ok:false/forbidden; strangers get what get_kage gives", () => {
  const { store, r } = setup();
  const ops: PatchOp[] = [{ op: "replace", path: "/blocks/a/props/text", value: "x" }];
  const d = data(dispatch(r, "validate_patch", { name: "k", ops }));
  assert.equal(d.ok, false);
  assert.equal(d.error.code, "forbidden");
  assert.equal(d.diff.changed[0], "a");
  const stranger: OpContext = { store, author: { principal: "agent:nobody" } };
  assert.deepEqual(dispatch(stranger, "validate_patch", { name: "k", ops }).ok, dispatch(stranger, "get_kage", { name: "k" }).ok);
  assert.equal(dispatch(stranger, "validate_patch", { name: "k", ops }).ok, false);
  assert.equal(dispatch(r, "validate_patch", { name: "missing", ops }).ok, false);
});

test("the dry-run limit holds across restored instances, as a persistent deployment restores one per request", () => {
  Store.resetDryRunLimits();
  let t = 0;
  const { store } = setup(() => t++);
  const ops: PatchOp[] = [{ op: "replace", path: "/title", value: "T" }];
  let last: any;
  for (let i = 0; i < 301; i++) {
    const fresh = Store.restore(store.snapshot(), { clock: () => t++ }); // a new instance for every call
    last = dispatch({ store: fresh, author: { principal: "agent:w" } }, "validate_patch", { name: "k", ops });
  }
  assert.ok(!last.ok && last.error.code === "rate_limited", "300 per hour is enforced even though no instance saw more than one call");
  Store.resetDryRunLimits();
});

test("the dry-run rate limit is its own budget", () => {
  Store.resetDryRunLimits();
  let t = 0;
  const { w } = setup(() => t++);
  const ops: PatchOp[] = [{ op: "replace", path: "/title", value: "T" }];
  let last: any;
  for (let i = 0; i < 301; i++) last = dispatch(w, "validate_patch", { name: "k", ops });
  assert.ok(!last.ok && last.error.code === "rate_limited");
});

// --- advice on success (#51) --------------------------------------------------

const deadBtn: PatchOp[] = [{ op: "add", path: "/blocks/btn", value: { type: "button", props: { label: "Go" } } }, { op: "add", path: "/blocks/root/slots/children/-", value: "btn" }];

test("create returns everything; a clean create says so in full mode and nothing in quiet mode", () => {
  const store = new Store();
  store.grant("agent:w", "kages", ["read", "write", "admin"]);
  const w: OpContext = { store, author: { principal: "agent:w" } };
  const btnDoc: KageDoc = { ...sampleKage({ id: "b1" }), blocks: { root: { type: "stack", props: {}, slots: { children: ["x"] } }, x: { type: "button", props: { label: "Go" } } } };
  const full = data(dispatch(w, "create_kage", { doc: btnDoc }));
  assert.deepEqual(full.advice.map((f: { code: string }) => f.code), ["dead-button"]);
  assert.equal(data(dispatch(w, "create_kage", { doc: sampleKage({ id: "c1" }) })).ack, "clean");
  const quiet = data(dispatch(w, "create_kage", { doc: sampleKage({ id: "c2" }), advice: "quiet" }));
  assert.deepEqual(Object.keys(quiet).sort(), ["validation", "version"], "quiet and clean returns exactly the old shape");
  assert.equal("advice" in data(dispatch(w, "create_kage", { doc: { ...btnDoc, id: "b2" }, advice: "off" })), false);
});

test("patch reports only what it introduced, once; later unrelated patches stay silent", () => {
  const { w } = setup();
  const first = data(dispatch(w, "patch_kage", { name: "k", ops: deadBtn }));
  assert.deepEqual(first.advice.map((f: { code: string }) => f.code), ["dead-button"]);
  const second = data(dispatch(w, "patch_kage", { name: "k", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "A2" }] }));
  assert.equal(second.ack, "clean");
  assert.equal(second.existing, 1);
  assert.equal("advice" in second, false, "the dead button is not repeated");
  const fixed = data(dispatch(w, "patch_kage", { name: "k", ops: [{ op: "add", path: "/blocks/btn/on", value: { click: [{ do: "set", path: "x", value: 1 }] } }, { op: "add", path: "/state", value: { x: 0 } }] }));
  assert.equal(fixed.resolved, 1);
  const quietClean = data(dispatch(w, "patch_kage", { name: "k", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "A3" }], advice: "quiet" }));
  assert.deepEqual(Object.keys(quietClean).sort(), ["validation", "version"]);
});

test("a failed write is never quieted: errors and their advice come back in every mode", () => {
  const { w } = setup();
  for (const advice of ["full", "quiet", "off"]) {
    const r = dispatch(w, "patch_kage", { name: "k", ops: [{ op: "replace", path: "/blocks/a/type", value: "no-such-type" }], advice });
    assert.ok(!r.ok && r.error.code === "invalid_content", advice);
    assert.ok(Array.isArray((r as any).error.details.errors), advice);
  }
});

test("the context default and a request param both choose the policy; the param wins", () => {
  const { store } = setup();
  const quietCtx: OpContext = { store, author: { principal: "agent:w" }, advicePolicy: { mode: "quiet", minSeverity: "P2" } };
  assert.equal("ack" in data(dispatch(quietCtx, "patch_kage", { name: "k", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "Q" }] })), false);
  assert.equal(data(dispatch(quietCtx, "patch_kage", { name: "k", ops: [{ op: "replace", path: "/blocks/a/props/text", value: "R" }], advice: "full" })).ack, "clean");
});

test("set_kage_brief and generate_kage return advice too", () => {
  const { w } = setup();
  assert.equal(data(dispatch(w, "set_kage_brief", { name: "k", brief: { mode: "read" } })).ack, "clean");
});
