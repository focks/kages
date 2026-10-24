import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchState, fetchTracker } from "./fetch-state.ts";

test("refresh outcomes distinguish live, retained, sample and failed data", () => {
  const action = { do: "fetch", source: "sales", statusInto: "sourceStatus" };
  const now = "2026-10-24T12:00:00Z", older = "2026-10-23T12:00:00Z";
  const success = fetchState(action, { ok: true, value: [5] }, [1], { updatedAt: older }, now);
  assert.deepEqual(success.value, [5]); assert.equal(success.outcome.status, "ready"); assert.equal(success.outcome.updatedAt, now);
  const failure = { ok: false, error: { code: "denied", msg: "Host has not enabled this source." } };
  const stale = fetchState({ ...action, retainOnError: true, mock: [0] }, failure, [1], { updatedAt: older }, now);
  assert.deepEqual(stale.value, [1]); assert.equal(stale.outcome.status, "stale"); assert.equal(stale.outcome.updatedAt, older);
  const sample = fetchState({ ...action, mock: [0] }, failure, null, { updatedAt: older }, now);
  assert.deepEqual(sample.value, [0]); assert.equal(sample.outcome.status, "sample"); assert.equal(sample.outcome.updatedAt, "");
  const error = fetchState(action, failure, null, null, now);
  assert.equal(error.value, null); assert.equal(error.outcome.status, "error"); assert.equal(error.outcome.updatedAt, "");
  assert.equal(fetchState({ ...action, retainOnError: true }, failure, [], { updatedAt: older }, now).outcome.status, "stale");
});

test("late fetch completion cannot supersede a newer request for the same outcome", () => {
  const tracker = fetchTracker();
  const first = tracker.begin("sales"), second = tracker.begin("sales"), unrelated = tracker.begin("stock");
  assert.equal(tracker.current("sales", first), false);
  assert.equal(tracker.current("sales", second), true);
  assert.equal(tracker.current("stock", unrelated), true);
});
