// Next.js REST adapter route. Resolves WHO the request is and WHICH workspace it
// acts in (resolveIdentity), parses params from the request, then runs the op
// through executeOp — the one server-side executor shared with the MCP route. It
// enforces the anon-write guard, applies writes under optimistic concurrency, and
// reconciles the public_shares registry. The route only parses the request and
// maps the OpResult to an HTTP status. A no-op without Supabase env, so local/dev
// is unchanged.

import { isWriteOp } from "@/adapters/operations.ts";
import { httpStatus } from "@/adapters/rest.ts";
import { executeOp } from "@/server/run-op.ts";
import { resolveIdentity } from "@/server/identity.ts";

async function handle(req: Request, ctx: { params: Promise<{ op: string }> }) {
  const { op } = await ctx.params;
  const { author, workspace } = await resolveIdentity(req);

  const method = req.method.toUpperCase();
  // A safe method must never mutate, regardless of auth.
  if (method !== "POST" && isWriteOp(op))
    return Response.json({ error: { code: "method_not_allowed", msg: `${op} is a write; use POST` } }, { status: 405, headers: { Allow: "POST" } });

  const params = method === "POST"
    ? await req.json().catch(() => ({}))
    : Object.fromEntries(new URL(req.url).searchParams.entries());

  const r = await executeOp(workspace, author, op, params);
  if (r.ok) return Response.json(r.data, { status: 200 });
  return Response.json({ error: r.error }, { status: httpStatus(r.error.code) });
}

export const POST = handle;
export const GET = handle;
