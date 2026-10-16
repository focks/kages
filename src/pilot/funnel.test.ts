import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../store/store.ts";
import { pilotStats, summarize, parseStats, type PilotStats } from "./funnel.ts";
import { sampleKage } from "../test-support/fixtures.ts";
import { runCli } from "../test-support/cli.ts";
import { tmpDir } from "../test-support/tmp.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const owner = { principal: "user:o" };
const DAY = 86_400_000;
function world() {
  let now = Date.parse("2026-10-01T10:00:00Z");
  const s = new Store({ workspace: "w", clock: () => now });
  s.grant(owner.principal, "r", ["read", "write", "publish", "review", "admin"]);
  return { s, advance: (days: number) => { now += days * DAY; } };
}

test("an empty workspace has zero everything and no second guide", () => {
  const { s } = world();
  assert.deepEqual(pilotStats(s), { v: 1, guides: 0, daysToSecondGuide: null, shared: 0, withFeedback: 0, guestComments: 0, revisedAfterShare: 0, activeDays: 0, verified: 0 });
});

test("the funnel counts creation, sharing, feedback, revision and return from the store alone", () => {
  const { s, advance } = world();
  assert.ok(s.create("r", sampleKage({ id: "a" }), owner).ok);
  advance(3);
  assert.ok(s.create("r", sampleKage({ id: "b" }), owner).ok);
  assert.ok(s.publish("a", owner, "link").ok);
  const uuid = (s.head("a") as { uuid: string }).uuid;
  assert.ok(s.addGuestComment(uuid, { name: "Dana", text: "nice" }).ok);
  assert.ok(s.addGuestComment(uuid, { name: "Eli", text: "hmm" }).ok);
  advance(1);
  const patched = s.patch("a", [{ op: "replace", path: "/blocks/hello/props/text", value: "Changed after sharing" }], owner);
  assert.ok(patched.ok, JSON.stringify((patched as { error?: unknown }).error));
  const st = pilotStats(s);
  assert.equal(st.guides, 2); assert.equal(st.daysToSecondGuide, 3);
  assert.equal(st.shared, 1); assert.equal(st.withFeedback, 1); assert.equal(st.guestComments, 2);
  assert.equal(st.revisedAfterShare, 1, "a new version after the share counts as revising it");
  assert.equal(st.activeDays, 3, "day 1 (first guide), day 4 (second guide and the share), day 5 (the revision)");
});

test("the stats carry numbers only: no titles, text, names or ids can leak", () => {
  const { s } = world();
  s.create("r", sampleKage({ id: "secret-id" }), owner);
  const json = JSON.stringify(pilotStats(s));
  assert.ok(!/secret|Sample|user:o/.test(json));
  for (const v of Object.values(pilotStats(s))) assert.ok(v === null || typeof v === "number");
});

const base: PilotStats = { v: 1, guides: 1, daysToSecondGuide: null, shared: 0, withFeedback: 0, guestComments: 0, revisedAfterShare: 0, activeDays: 1, verified: 0 };
test("thresholds scale to the number of participants and need every row", () => {
  const ten: PilotStats[] = Array.from({ length: 10 }, (_, i) => ({ ...base, guides: i < 8 ? 1 : 0, daysToSecondGuide: i < 5 ? 2 : null, shared: i < 3 ? 1 : 0, withFeedback: i < 2 ? 1 : 0, activeDays: i < 5 ? 3 : 1 }));
  const r = summarize(ten);
  assert.deepEqual(r.thresholds.map((t) => [t.id, t.need, t.got, t.met]), [["first-guide", 7, 8, true], ["second-guide", 5, 5, true], ["shared", 3, 3, true], ["feedback", 2, 2, true], ["returned", 5, 5, true]]);
  assert.ok(r.allMet);
  assert.equal(summarize(ten.map((s, i) => (i === 0 ? { ...s, shared: 0 } : s))).allMet, false);
  const five = summarize(ten.slice(0, 5));
  assert.equal(five.thresholds[0].need, 4, "seven of ten scales to four of five");
  assert.equal(summarize([]).allMet, false);
});

test("stats files are validated, and the CLI prints, emits JSON, and summarizes files", async () => {
  assert.throws(() => parseStats("{}"), /not a kages pilot stats file/);
  const dir = tmpDir("kages-pilot-");
  writeFileSync(join(dir, "a.kage.json"), JSON.stringify(sampleKage({ id: "a" })));
  assert.equal((await runCli(["create", "a.kage.json", "--local"], { cwd: dir })).code, 0);
  const human = await runCli(["pilot", "--local"], { cwd: dir });
  assert.match(human.out, /guides 1 · shared 0/); assert.match(human.out, /Nothing here contains titles/);
  const json = await runCli(["pilot", "stats", "--json", "--local"], { cwd: dir });
  const stats = JSON.parse(json.out) as PilotStats; assert.equal(stats.guides, 1);
  writeFileSync(join(dir, "s.json"), json.out);
  const sum = await runCli(["pilot", "summarize", join(dir, "s.json"), "--local"], { cwd: dir });
  assert.equal(sum.code, 1); assert.match(sum.out, /1 participant/); assert.match(sum.out, /✗ 0\/1  created another guide within a week/);
});
