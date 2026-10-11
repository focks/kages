// Next.js REST adapter route. Resolves WHO the request is and WHICH workspace it
// acts in (resolveIdentity — demo admin locally, the signed-in user under auth),
// runs the operation against that workspace's store, then:
//   • persists the workspace snapshot after a successful write, and
//   • keeps the global public_shares registry in sync so /k/<uuid> links resolve
//     across workspaces.
// All of that is a no-op without Supabase env, so local/dev is unchanged.

import { handleRest } from "@/adapters/rest.ts";
import { isWriteOp } from "@/adapters/operations.ts";
import { getStore, persistStore } from "@/server/store-instance.ts";
import { resolveIdentity } from "@/server/identity.ts";
import { isShareAffecting, afterWriteShareSync } from "@/server/public-shares.ts";

async function handle(req: Request, ctx: { params: Promise<{ op: string }> }) {
  const { op } = await ctx.params;
  const { author, workspace } = await resolveIdentity(req);
  const store = await getStore(workspace);

  // Recover the Kage name (and, before a delete removes it, its uuid) from the
  // body BEFORE handleRest consumes it, so the public registry can be reconciled.
  const needsName = isShareAffecting(op) || op === "delete_kage";
  const name = needsName ? await req.clone().json().then((b) => b?.name).catch(() => undefined) : undefined;
  const preDeleteUuid = op === "delete_kage" && name ? store.head(name)?.uuid : undefined;

  const res = await handleRest({ store, author }, op, req);

  if (isWriteOp(op) && res.ok) {
    await persistStore(workspace, store);
    await afterWriteShareSync(store, op, name, preDeleteUuid);
  }
  return res;
}

export const POST = handle;
export const GET = handle;
