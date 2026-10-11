// Run one operation in a workspace with the full server-side lifecycle. Reads hit
// the cached store directly. Writes go through mutateStore: anonymous callers are
// rejected (read-only when auth is on), then the op is applied under optimistic
// concurrency (persist + public-share reconciliation on commit). Both the REST
// route and the MCP route call this, so the two behave identically.

import { dispatch, isWriteOp, type OpResult } from "../adapters/operations.ts";
import { getStore, mutateStore } from "./store-instance.ts";
import { afterWriteShareSync } from "./public-shares.ts";
import { anonWriteBlocked } from "./identity.ts";
import type { Provenance } from "../store/types.ts";

export async function executeOp(
  workspace: string,
  author: Provenance,
  op: string,
  params: Record<string, unknown>,
): Promise<OpResult> {
  const write = isWriteOp(op);
  if (anonWriteBlocked(author, write))
    return { ok: false, error: { code: "unauthorized", msg: "sign in to write — anonymous access is read-only" } };

  if (!write) {
    const store = await getStore(workspace);
    return dispatch({ store, author }, op, params);
  }

  const name = typeof params.name === "string" ? params.name : undefined;
  return mutateStore(workspace, (store) => {
    // Capture the uuid before a delete removes the Kage, so its /k share can be purged.
    const preDeleteUuid = op === "delete_kage" && name ? store.head(name)?.uuid : undefined;
    const result = dispatch({ store, author }, op, params);
    const after = result.ok ? () => afterWriteShareSync(store, op, name, preDeleteUuid) : undefined;
    return { result, after };
  });
}
