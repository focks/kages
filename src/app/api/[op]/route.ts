// Next.js REST adapter route. Thin: it wires the request to the framework-free
// handleRest with the process store and a resolved principal. Every operation
// is reachable as /api/<op>. See src/adapters/rest.ts for the logic.
//
// After a SUCCESSFUL write op the store snapshot is persisted (a no-op unless
// Supabase env vars are set), so durability tracks in-memory state without the
// store or the operation table knowing anything about the database.

import { handleRest } from "@/adapters/rest.ts";
import { isWriteOp } from "@/adapters/operations.ts";
import { getStore, persistStore, DEMO_PRINCIPAL } from "@/server/store-instance.ts";

async function handle(req: Request, ctx: { params: Promise<{ op: string }> }) {
  const { op } = await ctx.params;
  const store = await getStore();
  const res = await handleRest({ store, author: DEMO_PRINCIPAL }, op, req);
  if (isWriteOp(op) && res.ok) await persistStore(store);
  return res;
}

export const POST = handle;
export const GET = handle;
