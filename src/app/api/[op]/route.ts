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
import { putPublicShare, delPublicShare } from "@/server/public-shares.ts";

// Ops whose success can change what a /k/<uuid> link should serve.
const SHARE_AFFECTING = new Set(["publish_kage", "share_kage", "patch_kage", "submitForReview", "deprecate", "archive"]);

async function handle(req: Request, ctx: { params: Promise<{ op: string }> }) {
  const { op } = await ctx.params;
  const { author, workspace } = await resolveIdentity(req);
  const store = await getStore(workspace);

  // Clone before handleRest consumes the body — needed to recover the Kage name
  // for public-share sync after the op runs.
  const peek = SHARE_AFFECTING.has(op) ? req.clone() : null;
  const res = await handleRest({ store, author }, op, req);

  if (isWriteOp(op) && res.ok) {
    await persistStore(workspace, store);
    if (peek) await syncPublicShare(peek, store);
  }
  return res;
}

async function syncPublicShare(peek: Request, store: Awaited<ReturnType<typeof getStore>>) {
  let name: string | undefined;
  try { name = (await peek.json())?.name; } catch { return; }
  if (!name) return;
  const head = store.head(name);
  if (!head) return;
  const isPublic = head.state === "published" && (head.visibility === "link" || head.visibility === "public");
  if (isPublic) await putPublicShare(head.uuid, head.doc);
  else await delPublicShare(head.uuid);
}

export const POST = handle;
export const GET = handle;
