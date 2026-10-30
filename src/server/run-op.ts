import { readGalleryEntries, galleryWorkspace } from "./gallery.ts";
import { authMode } from "./auth-mode.ts";
// Run one operation in a workspace with the full server-side lifecycle. Reads hit
// the latest committed store. Writes go through mutateStore: anonymous callers are
// rejected (read-only when auth is on), then the op is applied under optimistic
// concurrency (persist on commit). Both the REST
// route and the MCP route call this, so the two behave identically.

import { dispatch, isWriteOp, type OpResult } from "../adapters/operations.ts";
import { getStore, getHeadsStore, mutateStore } from "./store-instance.ts";
import { headsSuffice } from "./persistence.ts";
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
  origin?: string,
): Promise<OpResult> {
  try {
    const connection = { mode: authMode() === "local" ? "local" as const : "cloud" as const, origin };
    const write = isWriteOp(op, params);
    if (anonWriteBlocked(author, write))
      return { ok: false, error: { code: "unauthorized", msg: "Sign in to write. Call get_setup for login, workspace and MCP authentication instructions; anonymous access is read-only" } };

    // Only these UUID operations cross workspace boundaries. The selected
    // store still enforces public gallery membership inside the transaction.
    if (op === "vote_gallery_kage" || op === "get_gallery_kage") {
      const target = await galleryWorkspace(String(params?.uuid ?? ""));
      if (!target) return { ok: false, error: { code: "not_found", msg: "No such gallery Kage." } };
      workspace = target;
    }
    if (!write) {
      const galleryEntries = op === "list_gallery" ? await readGalleryEntries() : undefined;
      const store = await (headsSuffice(op, params) ? getHeadsStore(workspace) : getStore(workspace));
      return dispatch({ store, author, adapter, connection, galleryEntries, adviceLog: sink }, op, params);
    }

    return await mutateStore(workspace, (store) => ({ result: dispatch({ store, author, adapter, connection, adviceLog: sink }, op, params) }));
  } catch (e) {
    console.error("workspace operation failed:", e);
    return { ok: false, error: { code: "unavailable", msg: "workspace storage unavailable; retry later" } };
  }
}
