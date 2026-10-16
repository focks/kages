// The /api/mcp batch loop, split from the route so it can be tested without Next.
//
// Messages run sequentially: tool calls that write all go through mutateStore against ONE
// workspace row with a few compare-and-swap attempts each, so running a batch with Promise.all made a
// client's own writes race each other and some came back as `conflict` for no fault of the client.
// The length is capped because one authenticated POST would otherwise fan out into an unbounded
// number of workspace loads.

export const MAX_MCP_BATCH = 50;

export async function runMcpBatch<M>(messages: M[], handle: (m: M) => Promise<object | null>): Promise<{ ok: true; replies: object[] } | { ok: false }> {
  if (messages.length > MAX_MCP_BATCH) return { ok: false };
  const replies: object[] = [];
  for (const m of messages) { const r = await handle(m); if (r) replies.push(r); }
  return { ok: true, replies };
}
