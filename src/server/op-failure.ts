// What a caller sees when an operation throws. The cause stays in the server log.
import type { OpResult } from "../adapters/operations.ts";
import { MisconfiguredError } from "../store/crypto.ts";

// Persistence wraps failures as a storage error with the original as its cause.
function isMisconfigured(e: unknown): boolean {
  for (let cur = e, depth = 0; cur instanceof Error && depth < 5; cur = cur.cause, depth++)
    if (cur instanceof MisconfiguredError) return true;
  return false;
}

/** A missing setting is not an outage: "retry later" would send operators looking at the database.
 *  The setting's name is withheld; callers learn only that retrying will not help. */
export function failureResult(e: unknown): OpResult {
  if (isMisconfigured(e))
    return { ok: false, error: { code: "misconfigured", msg: "the server is misconfigured; its operator must check the server logs" } };
  return { ok: false, error: { code: "unavailable", msg: "workspace storage unavailable; retry later" } };
}
