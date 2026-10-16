import { test } from "node:test";
import assert from "node:assert/strict";
import { chipFor, needsAttention, sortedBacklog, banners, scoreRows, type BacklogItem, type CritiqueView } from "./critique-model.ts";

const sum = (over = {}) => ({ score: 28, max: 40, stale: false, open: { P0: 0, P1: 0 }, ...over });

test("chip: absent without a critique; good when clean, attention with open P0/P1, muted when stale", () => {
  assert.equal(chipFor(null), null);
  assert.equal(chipFor(undefined), null);
  assert.deepEqual(chipFor(sum()), { text: "28/40", title: "28 of 40 on the last critique", tone: "good" });
  assert.equal(chipFor(sum({ open: { P0: 1, P1: 2 } }))!.tone, "attention");
  assert.match(chipFor(sum({ open: { P0: 1, P1: 2 } }))!.title, /3 open P0\/P1/);
  const stale = chipFor(sum({ stale: true, open: { P0: 5, P1: 0 } }))!;
  assert.equal(stale.tone, "muted");
  assert.match(stale.title, /written before the latest changes/);
});

test("needsAttention ignores stale critiques: an old backlog is not a current problem", () => {
  assert.equal(needsAttention(sum({ open: { P0: 1, P1: 0 } })), true);
  assert.equal(needsAttention(sum({ open: { P0: 0, P1: 1 } })), true);
  assert.equal(needsAttention(sum({ open: { P0: 0, P1: 0 } })), false);
  assert.equal(needsAttention(sum({ stale: true, open: { P0: 3, P1: 3 } })), false);
  assert.equal(needsAttention(null), false);
});

test("backlog: open items first, by severity, keeping the store's index", () => {
  const item = (sev: BacklogItem["sev"], status: BacklogItem["status"] = "open"): BacklogItem => ({ sev, title: sev + status, fix: "f", status });
  const sorted = sortedBacklog([item("P2"), item("P0", "fixed"), item("P1"), item("P0"), item("P3", "wontfix")]);
  assert.deepEqual(sorted.map((s) => s.index), [3, 2, 0, 1, 4]);
});

const view = (over: Partial<CritiqueView> = {}): CritiqueView => ({ id: "q1", version: 1, method: "dual-agent", total: 30, max: 40, scores: { 1: 3, 7: null }, naReasons: { 7: "static page" }, priorities: [], body: "", state: "open", createdAt: "x", author: "a", stale: false, ...over });

test("banners: stale, degraded with its reason, single, closed", () => {
  assert.deepEqual(banners(view()), []);
  assert.match(banners(view({ stale: true }))[0].text, /changed since/);
  const d = banners(view({ method: "degraded", degradedReason: "no sub-agents available" }));
  assert.equal(d[0].tone, "warn");
  assert.match(d[0].text, /no sub-agents available/);
  assert.match(banners(view({ method: "single" }))[0].text, /one pass/);
  assert.match(banners(view({ state: "closed" }))[0].text, /Closed/);
});

test("scoreRows names the heuristics and carries the reason for n/a", () => {
  const rows = scoreRows(view());
  assert.deepEqual(rows.map((r) => [r.id, r.name, r.score]), [[1, "Visibility of system status", 3], [7, "Flexibility and efficiency", null]]);
  assert.equal(rows[1].reason, "static page");
});
