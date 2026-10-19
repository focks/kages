// Public read for the /k/<uuid> share link — deliberately OUTSIDE the per-
// workspace operation dispatcher, because a public link must resolve regardless
// of which user's workspace holds the Kage. The lookup lives in shared-doc.ts so the markdown
// view of the same link applies the same rules.

import { readSharedDoc } from "@/server/shared-doc.ts";

export async function GET(_req: Request, ctx: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await ctx.params;
  const r = await readSharedDoc(uuid);
  return r.ok ? Response.json(r.doc) : Response.json({ error: { code: r.code, msg: r.msg } }, { status: r.status });
}
