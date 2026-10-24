// Live data outcomes keep provenance separate from values. A fallback sample
// never advances the successful refresh timestamp, and a failed refresh may
// retain the last snapshot only when the author explicitly requested it.
import type { Action, Json } from "../engine/types.ts";
import type { CapResult } from "../host/bridge.ts";

export interface FetchOutcome { status: "ready" | "sample" | "stale" | "error"; source: string; message: string; updatedAt: string }

/** The caller supplies time after a successful response; no clock is read here. */
export function fetchState(action: Action, response: CapResult, previousValue: Json, previousOutcome: Json, now: string): { value: Json; outcome: FetchOutcome } {
  const source = String(action.source ?? "");
  const previousTime = previousOutcome && typeof previousOutcome === "object" && !Array.isArray(previousOutcome) && typeof previousOutcome.updatedAt === "string" ? previousOutcome.updatedAt : "";
  if (response.ok) return { value: response.value ?? null, outcome: { status: "ready", source, message: "Live data loaded successfully.", updatedAt: now } };
  const reason = String(response.error?.msg || "Data could not be loaded.").slice(0, 300);
  if (action.retainOnError === true && previousValue != null) return { value: previousValue, outcome: { status: "stale", source, message: reason + " Showing the previous snapshot.", updatedAt: previousTime } };
  if (action.mock !== undefined) return { value: action.mock, outcome: { status: "sample", source, message: reason + " Showing bundled sample data, not a live update.", updatedAt: "" } };
  return { value: null, outcome: { status: "error", source, message: reason, updatedAt: previousTime } };
}

/** Latest request wins for a declared outcome path; late responses cannot
 * replace a newer snapshot or clear its pending indicator. */
export function fetchTracker() {
  const revisions = new Map<string, number>();
  return {
    begin(key: string) { const revision = (revisions.get(key) ?? 0) + 1; revisions.set(key, revision); return revision; },
    current(key: string, revision: number) { return revisions.get(key) === revision; },
  };
}
