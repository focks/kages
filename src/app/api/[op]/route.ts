// Next.js REST adapter route. Thin: it wires the request to the framework-free
// handleRest with the process store and a resolved principal. Every operation
// is reachable as /api/<op>. See src/adapters/rest.ts for the logic.

import { handleRest } from "@/adapters/rest.ts";
import { getStore, DEMO_PRINCIPAL } from "@/server/store-instance.ts";

async function handle(req: Request, ctx: { params: Promise<{ op: string }> }) {
  const { op } = await ctx.params;
  return handleRest({ store: getStore(), author: DEMO_PRINCIPAL }, op, req);
}

export const POST = handle;
export const GET = handle;
