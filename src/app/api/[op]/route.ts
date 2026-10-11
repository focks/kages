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
import { isShareAffecting, syncShare } from "@/server/public-shares.ts";

async function handle(req: Request, ctx: { params: Promise<{ op: string }> }) {
  const { op } = await ctx.params;
  const { author, workspace } = await resolveIdentity(req);
  const store = await getStore(workspace);

  // Clone before handleRest consumes the body — needed to recover the Kage name
  // for public-share sync after the op runs.
  const peek = isShareAffecting(op) ? req.clone() : null;
  const res = await handleRest({ store, author }, op, req);

  if (isWriteOp(op) && res.ok) {
    await persistStore(workspace, store);
    if (peek) {
      const name = await peek.json().then((b) => b?.name).catch(() => undefined);
      if (name) await syncShare(store, name);
    }
  }
  return res;
}

export const POST = handle;
export const GET = handle;
