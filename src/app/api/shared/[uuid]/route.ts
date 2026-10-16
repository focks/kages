// Public read for the /k/<uuid> share link — deliberately OUTSIDE the per-
// workspace operation dispatcher, because a public link must resolve regardless
// of which user's workspace holds the Kage. With persistence it reads the committed workspace head; locally it falls back to the single "acme" store,
// gated to an anonymous principal (so only published link/public Kages resolve).

import { getPublicShare, sharesEnabled } from "@/server/public-shares.ts";
import { getStore } from "@/server/store-instance.ts";

const notFound = () => Response.json({ error: { code: "not_found", msg: "no such shared Kage" } }, { status: 404 });

export async function GET(_req: Request, ctx: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await ctx.params;

  if (sharesEnabled()) {
    try {
      const doc = await getPublicShare(uuid);
      return doc ? Response.json(doc) : notFound();
    } catch {
      return Response.json({ error: { code: "unavailable", msg: "share storage unavailable" } }, { status: 503 });
    }
  }

  const store = await getStore("acme");
  const name = store.nameByUuid(uuid);
  if (!name) return notFound();
  const r = store.authorizeRead(name, { principal: "anon" });
  return r.ok ? Response.json(r.record.doc) : Response.json({ error: { code: r.code, msg: r.msg } }, { status: 403 });
}
