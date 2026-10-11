// Run one operation in a workspace with the full server-side lifecycle: dispatch
// against the workspace store, persist the snapshot after a successful write, and
// keep the public_shares registry in sync. The REST route does this inline around
// handleRest; the MCP route uses this directly so both behave identically.

import { dispatch, isWriteOp, type OpResult } from "../adapters/operations.ts";
import { getStore, persistStore } from "./store-instance.ts";
import { isShareAffecting, syncShare } from "./public-shares.ts";
import type { Provenance } from "../store/types.ts";

export async function executeOp(
  workspace: string,
  author: Provenance,
  op: string,
  params: Record<string, unknown>,
): Promise<OpResult> {
  const store = await getStore(workspace);
  const r = dispatch({ store, author }, op, params);
  if (r.ok && isWriteOp(op)) {
    await persistStore(workspace, store);
    if (isShareAffecting(op) && typeof params.name === "string") await syncShare(store, params.name);
  }
  return r;
}
