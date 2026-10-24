// Public links resolve against committed heads in the normalized version log
// (kage_versions joined to each kage's head pointer). There is no mirror table
// any more: the head a /k/<uuid> link serves is the same row the workspace
// write committed, so a revoked or deleted share can never be resurrected by a
// delayed copy. kages_public_head filters to published link/public heads, and
// the caller re-checks — the SQL only selects, it never authorizes alone.

import type { KageDoc } from "../engine/types.ts";
import type { VersionRecord } from "../store/types.ts";
import { pgEnabled, pool } from "./pg.ts";

// Read per call, like DATABASE_URL: tests and scripts set these after the module is imported.
const base = () => process.env.SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
// A hung PostgREST would otherwise hold the request (and every read goes through here) indefinitely.
const REST_TIMEOUT_MS = 10_000;

export function sharesEnabled(): boolean {
  return pgEnabled() || !!(base() && key());
}

type PublicHead = { workspace: string; record: VersionRecord } | null;
const isOpen = (r: VersionRecord | undefined, uuid: string) =>
  !!r && r.uuid === uuid && r.state === "published" && (r.visibility === "link" || r.visibility === "public");

async function publicHead(uuid: string): Promise<PublicHead> {
  if (!sharesEnabled()) return null;
  if (pgEnabled()) {
    const r = await pool().query("select public.kages_public_head($1) as row", [uuid]);
    return (r.rows[0]?.row as PublicHead) ?? null;
  }
  const res = await fetch(`${base()}/rest/v1/rpc/kages_public_head`, {
    method: "POST",
    headers: { apikey: key()!, Authorization: `Bearer ${key()!}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_uuid: uuid }),
    cache: "no-store", signal: AbortSignal.timeout(REST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`public share storage returned ${res.status}`);
  return ((await res.json()) as PublicHead) ?? null;
}

/** The document a /k/<uuid> link serves, from the committed head only. */
export async function getPublicShare(uuid: string): Promise<KageDoc | null> {
  const head = await publicHead(uuid);
  return isOpen(head?.record, uuid) ? head!.record.doc : null;
}

/** The workspace that owns a published link/public Kage, so a visitor's
 *  feedback or vote is written to the right store. Committed heads only. */
export async function getPublicShareWorkspace(uuid: string): Promise<string | null> {
  const head = await publicHead(uuid);
  return isOpen(head?.record, uuid) ? head!.workspace : null;
}
