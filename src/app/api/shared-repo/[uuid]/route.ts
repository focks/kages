// Public read for the /r/<uuid> project link, outside the per-workspace dispatcher for the same reason as
// /api/shared/<uuid>: the link must resolve whichever workspace holds the project.
import { readSharedRepo } from "@/server/shared-repo.ts";

export async function GET(_req: Request, ctx: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await ctx.params;
  const r = await readSharedRepo(uuid);
  return r.ok ? Response.json(r.listing) : Response.json({ error: { code: r.code, msg: r.msg } }, { status: r.status });
}
