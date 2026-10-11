// Run one operation in a workspace with the full server-side lifecycle: dispatch
// against the workspace store, persist the snapshot after a successful write, and
// keep the public_shares registry in sync. The REST route does this inline around
// handleRest; the MCP route uses this directly so both behave identically.

import { dispatch, isWriteOp, type OpResult } from "../adapters/operations.ts";
import { getStore, persistStore } from "./store-instance.ts";
import { afterWriteShareSync } from "./public-shares.ts";
import { anonWriteBlocked } from "./identity.ts";
import type { Provenance } from "../store/types.ts";

export async function executeOp(
  workspace: string,
  author: Provenance,
  op: string,
  params: Record<string, unknown>,
): Promise<OpResult> {
  if (anonWriteBlocked(author, isWriteOp(op)))
    return { ok: false, error: { code: "unauthorized", msg: "sign in to write — anonymous access is read-only" } };
  const store = await getStore(workspace);
  const name = typeof params.name === "string" ? params.name : undefined;
  // Capture the uuid before a delete removes the Kage, so its /k share can be purged.
  const preDeleteUuid = op === "delete_kage" && name ? store.head(name)?.uuid : undefined;
  const r = dispatch({ store, author }, op, params);
  if (r.ok && isWriteOp(op)) {
    await persistStore(workspace, store);
    await afterWriteShareSync(store, op, name, preDeleteUuid);
  }
  return r;
}
