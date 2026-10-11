// Remote MCP endpoint (Streamable HTTP, stateless). Same auth and dispatch as
// the REST adapter: resolveIdentity derives the principal + workspace (a Bearer
// token → your workspace; none → anonymous, read-only public), then each MCP
// tool call runs through executeOp (persist + share-sync on writes). One POST
// carries one JSON-RPC message (or a batch); we answer with application/json.
// No session state is kept, so it scales flat on serverless.

import { handleMcpMessage } from "@/adapters/mcp.ts";
import { executeOp } from "@/server/run-op.ts";
import { resolveIdentity } from "@/server/identity.ts";

export async function POST(req: Request) {
  const { author, workspace } = await resolveIdentity(req);
  const exec = (op: string, params: Record<string, unknown>) => executeOp(workspace, author, op, params);

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, { status: 400 });
  }

  const messages = Array.isArray(body) ? body : [body];
  const replies = (await Promise.all(messages.map((m) => handleMcpMessage(exec, m as never)))).filter(Boolean);
  // All-notifications batch (or a lone notification) → nothing to return.
  if (replies.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? replies : replies[0]);
}

// MCP clients may open a GET for a server→client SSE stream; we're stateless and
// never push, so decline it — the SDK client treats 405 as "no stream" and continues.
export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
