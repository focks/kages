// The share link for agents: GET /k/<uuid>.md, or /k/<uuid> with `Accept: text/markdown` (both are rewritten
// here by next.config.ts). An agent fetching the HTML page gets a client-rendered shell; this gives it the
// Kage as text, with how to install and call Kages at the top. Same read rules as the JSON route.

import { readSharedDoc } from "@/server/shared-doc.ts";
import { agentMarkdown } from "@/server/agent-markdown.ts";

export async function GET(req: Request, ctx: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await ctx.params;
  const r = await readSharedDoc(uuid);
  if (!r.ok) return new Response(`# Not available\n\n${r.msg}\n`, { status: r.status, headers: { "content-type": "text/markdown; charset=utf-8" } });
  return new Response(agentMarkdown({ doc: r.doc, origin: new URL(req.url).origin, uuid }), {
    // Vary: the same URL answers HTML or markdown by Accept, so a shared cache must key on it.
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate", vary: "Accept", "x-content-type-options": "nosniff" },
  });
}
