// Store-level security properties. See oracle/security.feature.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "./store.ts";
import { sampleKage } from "../test-support/fixtures.ts";

const owner = { principal: "user:o" }, anon = { principal: "anon" };
const edit = (n: string) => [{ op: "replace", path: "/blocks/hello/props/text", value: n }] as never;

test("a version quota survives a restore, as a persistent deployment restores a fresh Store per request", () => {
  let t = 1_000_000;
  const opts = { versionQuotaPerHour: 1, clock: () => t };
  const a = new Store({ workspace: "w", ...opts });
  a.grant(owner.principal, "r", ["read", "write", "publish", "admin"]);
  assert.ok(a.create("r", sampleKage({ id: "k" }), owner).ok);
  // The one write this hour has been used: a restored instance must still know it.
  const b = Store.restore(JSON.parse(JSON.stringify(a.snapshot())), opts);
  const second = b.patch("k", edit("two"), owner);
  assert.equal(second.ok, false); assert.equal((second as { error: { code: string } }).error.code, "rate_limited");
  t += 3_600_001; // an hour later the window has passed
  assert.ok(Store.restore(JSON.parse(JSON.stringify(a.snapshot())), opts).patch("k", edit("three"), owner).ok);
});

test("the snapshot carries only the live hour of counters, and older snapshots without them still load", () => {
  let t = 5_000_000;
  const s = new Store({ workspace: "w", versionQuotaPerHour: 5, clock: () => t });
  s.grant(owner.principal, "r", ["read", "write", "publish", "admin"]);
  s.create("r", sampleKage({ id: "k" }), owner);
  assert.equal(s.snapshot().limits!.writes[0][1].length, 1);
  t += 3_600_001;
  assert.equal(s.snapshot().limits, undefined, "nothing stale is persisted");
  const legacy = JSON.parse(JSON.stringify(s.snapshot())); delete legacy.limits;
  assert.doesNotThrow(() => Store.restore(legacy));
});

test("the comment limit survives a restore too", () => {
  let t = 9_000_000;
  const a = new Store({ workspace: "w", clock: () => t });
  a.grant(owner.principal, "r", ["read", "write", "publish", "admin"]);
  a.create("r", sampleKage({ id: "k" }), owner);
  for (let i = 0; i < 60; i++) assert.ok(a.addComment("k", owner, { text: "c" + i }).ok, String(i));
  const b = Store.restore(JSON.parse(JSON.stringify(a.snapshot())), { clock: () => t });
  const r = b.addComment("k", owner, { text: "one too many" });
  assert.equal(r.ok, false); assert.equal((r as { error: { code: string } }).error.code, "rate_limited");
});

test("an old public version is not readable once the head is private or unpublished", () => {
  const s = new Store({ workspace: "w" });
  s.grant(owner.principal, "r", ["read", "write", "publish", "admin"]);
  s.create("r", sampleKage({ id: "k" }), owner);
  assert.ok(s.publish("k", owner, "public").ok);            // v1: published and public (publishing changes the state in place)
  assert.equal(s.authorizeRead("k", anon, 1).ok, true);
  assert.ok(s.patch("k", edit("draft work"), owner).ok);     // v2: back to a private draft head
  assert.equal(s.head("k")!.state, "draft");
  assert.equal(s.authorizeRead("k", anon).ok, false, "the head is private");
  const old = s.authorizeRead("k", anon, 1);
  assert.equal(old.ok, false, "and so is the version that used to be public");
  assert.equal((old as { code: string }).code, "forbidden");
  assert.equal(s.authorizeRead("k", owner, 1).ok, true, "readers with a grant still see history");
  assert.equal(s.nameByUuid(s.head("k")!.uuid), "k");
});

test("a now-public head does not expose an earlier private draft", () => {
  const s = new Store({ workspace: "w" });
  s.grant(owner.principal, "r", ["read", "write", "publish", "admin"]);
  s.create("r", sampleKage({ id: "k" }), owner);            // v1: private draft with its first text
  assert.ok(s.patch("k", edit("polished"), owner).ok);
  assert.ok(s.publish("k", owner, "public").ok);
  assert.equal(s.authorizeRead("k", anon).ok, true);
  assert.equal(s.authorizeRead("k", anon, 1).ok, false, "the earlier draft stays private to readers with a grant");
  assert.equal(s.authorizeRead("k", owner, 1).ok, true);
});

// ---- the event stream is as sensitive as the Kages it describes ---------------------------------
import { dispatch } from "../adapters/operations.ts";

function stream() {
  const s = new Store({ workspace: "w" });
  s.grant(owner.principal, "r", ["read", "write", "publish", "admin"]);
  s.create("r", sampleKage({ id: "secret" }), owner);                     // private
  s.create("r", sampleKage({ id: "open" }), owner); s.publish("open", owner, "public");
  assert.ok(s.addComment("secret", owner, { text: "internal note" }).ok);
  return s;
}
const sub = (s: Store, who: { principal: string }, p: Record<string, unknown> = {}) => (dispatch({ store: s, author: who }, "subscribe", p) as { ok: true; data: { events: { type: string; ref: string }[]; cursor: number } }).data;

test("subscribe shows an anonymous caller only events about Kages it could read", () => {
  const s = stream();
  const all = s.eventLog().length;
  const a = sub(s, anon);
  assert.ok(a.events.length > 0 && a.events.length < all);
  assert.ok(a.events.every((e) => /\/open@v/.test(e.ref)), JSON.stringify(a.events));
  assert.ok(!JSON.stringify(a).includes("secret"), "neither the name, the ref nor the comment event of a private Kage");
  assert.equal(a.cursor, all, "the cursor still counts the whole log, so polling advances");
  assert.equal(sub(s, owner).events.length, all, "a reader of the repo sees everything");
});

test("a stranger with no grants sees what an anonymous caller sees; the type filter and cursor still work", () => {
  const s = stream();
  assert.deepEqual(sub(s, { principal: "user:stranger" }).events, sub(s, anon).events);
  assert.ok(sub(s, owner, { types: ["kage.published"] }).events.every((e) => e.type === "kage.published"));
  assert.equal(sub(s, owner, { since: s.eventLog().length }).events.length, 0);
});

test("unpublishing hides a Kage's earlier events from anonymous callers; deleting leaves them to repo readers", () => {
  const s = stream();
  assert.ok(sub(s, anon).events.length > 0);
  assert.ok(s.unpublish("open", owner).ok);
  assert.equal(sub(s, anon).events.length, 0);
  assert.ok(s.remove("secret", owner).ok);
  assert.ok(sub(s, owner).events.some((e) => e.type === "kage.deleted"));
  assert.ok(!sub(s, anon).events.some((e) => e.type === "kage.deleted"));
});

test("workspace-level events (the brief) are for people with read access, not anonymous callers", () => {
  const s = stream();
  const brief = (s as unknown as { setBrief: (...a: unknown[]) => { ok: boolean } }).setBrief({ users: "u", purpose: "p" }, owner);
  assert.ok(brief.ok, JSON.stringify(brief));
  assert.ok(sub(s, owner).events.some((e) => e.type === "workspace.brief.updated"));
  assert.ok(!sub(s, anon).events.some((e) => e.type === "workspace.brief.updated"));
});
