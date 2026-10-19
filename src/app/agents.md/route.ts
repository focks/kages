// GET /agents.md — the site guide for agents, with this deployment's own URLs. Public and static in content.
import { agentsGuide } from "@/server/agents-guide.ts";

export function GET(req: Request) {
  return new Response(agentsGuide(new URL(req.url).origin), {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" },
  });
}
