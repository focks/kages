// The project link for agents: GET /r/<uuid>.md, or /r/<uuid> with `Accept: text/markdown` (rewritten in next.config.ts).
import { readSharedRepo } from "@/server/shared-repo.ts";
import { repoMarkdown } from "@/server/agent-markdown.ts";

export async function GET(req: Request, ctx: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await ctx.params;
  const r = await readSharedRepo(uuid);
  if (!r.ok) return new Response(`# Not available\n\n${r.msg}\n`, { status: r.status, headers: { "content-type": "text/markdown; charset=utf-8" } });
  return new Response(repoMarkdown({ listing: r.listing, origin: new URL(req.url).origin }), {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate", vary: "Accept", "x-content-type-options": "nosniff" },
  });
}
