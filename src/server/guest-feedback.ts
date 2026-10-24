// The decision logic of the public feedback endpoint, with its effects injected so it can be tested
// without a server or a database. The one rule worth a module of its own: a comment is acknowledged
// (201 with an id) only when the commit is reported as done. After repeated lost races mutateStore
// returns a conflict, and the last in-memory attempt, which was never saved, must not be reported
// to a visitor as saved.
import type { Store } from "../store/store.ts";
import type { OpResult } from "../adapters/operations.ts";
export { readBodyCapped } from "./body-limit.ts";

export const MAX_BODY = 16_384;
export interface FeedbackReply { status: number; body: unknown }
export interface FeedbackDeps {
  /** The workspace holding this shared Kage, or null when there is none. */
  findWorkspace: (uuid: string) => Promise<string | null>;
  mutate: (workspace: string, apply: (store: Store) => { result: OpResult }) => Promise<OpResult>;
}

const err = (status: number, code: string, msg: string): FeedbackReply => ({ status, body: { error: { code, msg } } });
const STATUS: Record<string, number> = { rate_limited: 429, not_found: 404, forbidden: 403, conflict: 503, unavailable: 503 };

export async function submitGuestFeedback(deps: FeedbackDeps, uuid: string, raw: string, declaredLength = 0): Promise<FeedbackReply> {
  if (declaredLength > MAX_BODY || raw.length > MAX_BODY) return err(413, "invalid_comment", "feedback is limited to 16 KB");
  let body: { name?: unknown; text?: unknown; block?: unknown; x?: unknown; y?: unknown } | null;
  try { body = JSON.parse(raw); } catch { body = null; }
  if (!body || typeof body.name !== "string" || typeof body.text !== "string") return err(400, "invalid_comment", "send { name, text }");
  const name = body.name, text = body.text, block = typeof body.block === "string" && body.block ? body.block : undefined;
  // A pin is the click inside a block as two fractions; both or neither, validated again by the store.
  const pos = body.x !== undefined || body.y !== undefined ? { x: Number(body.x), y: Number(body.y) } : undefined;
  try {
    const workspace = await deps.findWorkspace(uuid);
    if (!workspace) return err(404, "not_found", "no such shared Kage");
    const res = await deps.mutate(workspace, (store) => {
      const r = store.addGuestComment(uuid, { name, text, ...(block ? { block } : {}), ...(pos ? { pos } : {}) });
      return { result: r.ok ? { ok: true, data: { id: r.value.id } } : { ok: false, error: r.error } };
    });
    if (res.ok) return { status: 201, body: { ok: true, id: (res.data as { id: string }).id } };
    return err(STATUS[res.error.code] ?? 400, res.error.code, res.error.msg);
  } catch (e) {
    console.error("guest feedback failed:", e);
    return err(503, "unavailable", "feedback storage unavailable; retry later");
  }
}
