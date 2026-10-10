// The REST adapter, as a framework-free handler so it is testable under
// node --test and reused verbatim by the Next.js route. It translates an HTTP
// request into one dispatch call: the op name is the last path segment, params
// are the JSON body (plus query for GETs). Auth → principal would happen here;
// for now a fixed demo principal. No business logic — same as every adapter.
// See oracle/agent-access.feature.

import { dispatch, isWriteOp, type OpContext } from "./operations.ts";

/** Handle POST /api/<op> (and GET for read-only ops). Returns a Web Response,
 *  so it works in Next route handlers and in tests without any Next import. A
 *  write operation over GET is refused with 405 — a safe method must never
 *  mutate, regardless of auth. */
export async function handleRest(ctx: OpContext, op: string, req: Request): Promise<Response> {
  const method = req.method.toUpperCase();
  if (method !== "POST" && isWriteOp(op)) {
    return Response.json({ error: { code: "method_not_allowed", msg: `${op} is a write; use POST` } }, { status: 405, headers: { Allow: "POST" } });
  }
  let params: Record<string, unknown> = {};
  if (method === "POST") {
    try { params = await req.json(); } catch { params = {}; }
  } else {
    params = Object.fromEntries(new URL(req.url).searchParams.entries());
  }
  const r = dispatch(ctx, op, params);
  if (r.ok) return Response.json(r.data, { status: 200 });
  const status = httpStatus(r.error.code);
  return Response.json({ error: r.error }, { status });
}

/** Map operation error codes to HTTP status, so a REST client sees the right
 *  class of failure (a permission denial is 403, a bad doc is 422). */
function httpStatus(code: string): number {
  switch (code) {
    case "unknown_operation": return 404;
    case "not_found": return 404;
    case "forbidden": return 403;
    case "rate_limited": return 429;
    case "claimed": return 409;
    case "conflict": return 409;
    case "invalid_content":
    case "invalid_patch": return 422;
    default: return 400;
  }
}
