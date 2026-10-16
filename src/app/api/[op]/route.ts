// Next.js REST adapter route. Resolves WHO the request is and WHICH workspace it
// acts in (resolveIdentity), parses params from the request, then runs the op
// through executeOp — the one server-side executor shared with the MCP route. It
// enforces the anon-write guard, applies writes under optimistic concurrency, and
// reconciles the public_shares registry. The route only parses the request and
// maps the OpResult to an HTTP status. A no-op without Supabase env, so local/dev
// is unchanged.

import { asParams, isWriteOp, queryParams } from "@/adapters/operations.ts";
import { httpStatus } from "@/adapters/rest.ts";
import { executeOp } from "@/server/run-op.ts";
import { resolveIdentity } from "@/server/identity.ts";
import { crossSiteWrite } from "@/server/web-safety.ts";

async function handle(req: Request, ctx: { params: Promise<{ op: string }> }) {
  const { op } = await ctx.params;
  // A cookie rides along on a cross-site form post, so a write must come from this app's own pages (or carry a bearer token).
  if (crossSiteWrite(req)) return Response.json({ error: { code: "forbidden", msg: "cross-site requests cannot change anything" } }, { status: 403 });
  const { author, workspace } = await resolveIdentity(req);

  const method = req.method.toUpperCase();
  // A safe method must never mutate, regardless of auth.
  const params = method === "POST"
    ? asParams(await req.json().catch(() => ({})))
    : queryParams(op, new URL(req.url).searchParams);
  if (method !== "POST" && isWriteOp(op, params))
    return Response.json({ error: { code: "method_not_allowed", msg: `${op} is a write; use POST` } }, { status: 405, headers: { Allow: "POST" } });

  const r = await executeOp(workspace, author, op, params);
  if (r.ok) return Response.json(r.data, { status: 200 });
  return Response.json({ error: r.error }, { status: httpStatus(r.error.code) });
}

export const POST = handle;
export const GET = handle;
