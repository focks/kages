// Feedback from someone who opened a /k/<uuid> link. Like the read route next to it, this sits
// OUTSIDE the per-workspace dispatcher because the visitor has no workspace: it finds the workspace
// that holds the shared Kage and writes exactly one thing, a guest comment, under a guest principal
// that grants nothing else. The rules are in src/server/guest-feedback.ts.

import { getPublicShareWorkspace, sharesEnabled } from "@/server/public-shares.ts";
import { getStore, mutateStore } from "@/server/store-instance.ts";
import { MAX_BODY, readBodyCapped, submitGuestFeedback } from "@/server/guest-feedback.ts";
import { crossSiteWrite } from "@/server/web-safety.ts";

export async function POST(req: Request, ctx: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await ctx.params;
  if (crossSiteWrite(req)) return Response.json({ error: { code: "forbidden", msg: "feedback must be sent from the shared page itself" } }, { status: 403 });
  const declared = Number(req.headers.get("content-length") ?? 0);
  // Content-Length can be absent (chunked) or a lie, so the cap is enforced while reading.
  const { text: raw, tooLarge } = declared > MAX_BODY ? { text: "", tooLarge: true } : await readBodyCapped(req, MAX_BODY);
  const r = await submitGuestFeedback({
    findWorkspace: async (id) => {
      if (sharesEnabled()) return getPublicShareWorkspace(id);
      return (await getStore("acme")).nameByUuid(id) ? "acme" : null;
    },
    mutate: mutateStore,
  }, uuid, raw, tooLarge ? MAX_BODY + 1 : declared);
  return Response.json(r.body, { status: r.status });
}
