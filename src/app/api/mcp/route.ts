// Remote MCP endpoint (Streamable HTTP, stateless). Auth is Bearer-ONLY (a token
// from `kages auth login` → your workspace; none → anonymous, read-only public).
// It deliberately does NOT honor the browser cookie session: this is an agent/CLI
// endpoint, so refusing cookies removes any cross-site/ambient-credential surface.
// Each MCP tool call runs through executeOp (which enforces the anon-write guard,
// then persists + syncs shares). One POST carries one JSON-RPC message (or a
// batch); we answer with application/json. No session state → scales flat.

import { handleMcpMessage } from "@/adapters/mcp.ts";
import { executeOp } from "@/server/run-op.ts";
import { MAX_MCP_BATCH, runMcpBatch } from "@/server/mcp-batch.ts";
import { resolveIdentity } from "@/server/identity.ts";
import { MAX_REQUEST_BYTES, readJsonCapped } from "@/server/body-limit.ts";

export async function POST(req: Request) {
  const { author, workspace } = await resolveIdentity(req, true); // bearer-only
  const exec = (op: string, params: Record<string, unknown>) => executeOp(workspace, author, op, params, "mcp", new URL(req.url).origin);

  const read = await readJsonCapped(req);
  if (read.tooLarge)
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: `request bodies are limited to ${MAX_REQUEST_BYTES / 1024 / 1024} MB` } }, { status: 413 });
  const body = read.value;
  if (body === undefined)
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, { status: 400 });
  // An empty batch is an invalid request per JSON-RPC 2.0, not "all notifications".
  if (Array.isArray(body) && body.length === 0)
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid request" } }, { status: 400 });

  const messages = Array.isArray(body) ? body : [body];
  const batch = await runMcpBatch(messages, (m) => handleMcpMessage(exec, m as never));
  if (!batch.ok) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: `invalid request: a batch holds at most ${MAX_MCP_BATCH} messages` } }, { status: 400 });
  const replies = batch.replies;
  // All-notifications batch (or a lone notification) → nothing to return.
  if (replies.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? replies : replies[0]);
}

// MCP clients may open a GET for a server→client SSE stream; we're stateless and
// never push, so decline it — the SDK client treats 405 as "no stream" and continues.
export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
