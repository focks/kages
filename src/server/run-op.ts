// Run one operation in a workspace with the full server-side lifecycle. Reads hit
// the latest committed store. Writes go through mutateStore: anonymous callers are
// rejected (read-only when auth is on), then the op is applied under optimistic
// concurrency (persist on commit). Both the REST
// route and the MCP route call this, so the two behave identically.

import { dispatch, isWriteOp, type OpResult } from "../adapters/operations.ts";
import { getStore, mutateStore } from "./store-instance.ts";
import { anonWriteBlocked } from "./identity.ts";
import type { Provenance } from "../store/types.ts";
import { chooseSink } from "../cli/advice-sinks.ts";

// Hosted deployments have no durable disk, so only "stdout" is honoured there; anything else is
// reported once and the log stays off.
const choice = chooseSink({ env: process.env.KAGES_ADVICE_LOG, hosted: !!process.env.VERCEL || process.env.NODE_ENV === "production" });
if (choice.problem) console.error(`[kages] ${choice.problem}`);
const sink = choice.sink;

export async function executeOp(
  workspace: string,
  author: Provenance,
  op: string,
  params: Record<string, unknown>,
  adapter: "rest" | "mcp" = "rest",
): Promise<OpResult> {
  try {
    const write = isWriteOp(op, params);
    if (anonWriteBlocked(author, write))
      return { ok: false, error: { code: "unauthorized", msg: "sign in to write — anonymous access is read-only" } };

    if (!write) {
      const store = await getStore(workspace);
      return dispatch({ store, author, adapter, adviceLog: sink }, op, params);
    }

    return await mutateStore(workspace, (store) => ({ result: dispatch({ store, author, adapter, adviceLog: sink }, op, params) }));
  } catch (e) {
    console.error("workspace operation failed:", e);
    return { ok: false, error: { code: "unavailable", msg: "workspace storage unavailable; retry later" } };
  }
}
