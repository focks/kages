// Global registry of publicly shared Kages, so a /k/<uuid> link resolves WITHOUT
// knowing which user's workspace holds it. When a Kage is published to link/public
// its document is upserted here; when visibility narrows it's removed. The /k
// route reads this table directly (service key) — public reads never touch a
// per-user workspace store. Env-gated: with no Supabase, these are no-ops and the
// single local "acme" store serves /k via nameByUuid instead.
//
// Table: public_shares(uuid pk, doc jsonb, updated_at) — see supabase/migrations.

import type { KageDoc } from "../engine/types.ts";
import type { Store } from "../store/store.ts";
import { pgEnabled, pool } from "./pg.ts";

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = "public_shares";

export function sharesEnabled(): boolean {
  return pgEnabled() || !!(BASE && KEY);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: KEY!, Authorization: `Bearer ${KEY!}`, "Content-Type": "application/json", ...extra };
}

export async function getPublicShare(uuid: string): Promise<KageDoc | null> {
  if (!sharesEnabled()) return null;
  if (pgEnabled()) {
    try { return ((await pool().query("select doc from public_shares where uuid = $1", [uuid])).rows[0]?.doc as KageDoc | undefined) ?? null; }
    catch (e) { console.error("getPublicShare (pg) failed:", e); return null; }
  }
  try {
    const res = await fetch(`${BASE}/rest/v1/${TABLE}?uuid=eq.${encodeURIComponent(uuid)}&select=doc`, { headers: headers() });
    if (!res.ok) { console.error(`getPublicShare: ${res.status} ${await res.text()}`); return null; }
    const rows = (await res.json()) as { doc: KageDoc }[];
    return rows[0]?.doc ?? null;
  } catch (e) { console.error("getPublicShare failed:", e); return null; }
}

export async function putPublicShare(uuid: string, doc: KageDoc): Promise<void> {
  if (!sharesEnabled()) return;
  if (pgEnabled()) {
    try { await pool().query("insert into public_shares (uuid, doc, updated_at) values ($1, $2::jsonb, now()) on conflict (uuid) do update set doc = excluded.doc, updated_at = now()", [uuid, JSON.stringify(doc)]); }
    catch (e) { console.error("putPublicShare (pg) failed:", e); }
    return;
  }
  try {
    const res = await fetch(`${BASE}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({ uuid, doc, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) console.error(`putPublicShare: ${res.status} ${await res.text()}`);
  } catch (e) { console.error("putPublicShare failed:", e); }
}

export async function delPublicShare(uuid: string): Promise<void> {
  if (!sharesEnabled()) return;
  if (pgEnabled()) {
    try { await pool().query("delete from public_shares where uuid = $1", [uuid]); }
    catch (e) { console.error("delPublicShare (pg) failed:", e); }
    return;
  }
  try {
    const res = await fetch(`${BASE}/rest/v1/${TABLE}?uuid=eq.${encodeURIComponent(uuid)}`, { method: "DELETE", headers: headers() });
    if (!res.ok) console.error(`delPublicShare: ${res.status} ${await res.text()}`);
  } catch (e) { console.error("delPublicShare failed:", e); }
}

// Ops whose success can change what a /k/<uuid> link should serve. delete_kage is
// handled separately (afterWriteShareSync) because its Kage is gone afterwards.
const SHARE_AFFECTING = new Set([
  "publish_kage", "share_kage", "patch_kage",
  "unpublish_kage", "deprecate_kage", "archive_kage", "restore_kage",
]);
export const isShareAffecting = (op: string): boolean => SHARE_AFFECTING.has(op);

/** After a share-affecting write, mirror the Kage's head into (or out of) the
 *  global registry so /k/<uuid> resolves it across workspaces. */
export async function syncShare(store: Store, name: string): Promise<void> {
  const head = store.head(name);
  if (!head) return;
  const isPublic = head.state === "published" && (head.visibility === "link" || head.visibility === "public");
  if (isPublic) await putPublicShare(head.uuid, head.doc);
  else await delPublicShare(head.uuid);
}

/** The one place both the REST and MCP routes reconcile the public registry after
 *  a successful write. For delete_kage the Kage is already gone, so we purge by the
 *  uuid captured BEFORE the op ran; otherwise we re-sync from the current head. */
export async function afterWriteShareSync(
  store: Store, op: string, name: string | undefined, preDeleteUuid: string | undefined,
): Promise<void> {
  if (op === "delete_kage") { if (preDeleteUuid) await delPublicShare(preDeleteUuid); return; }
  if (name && isShareAffecting(op)) await syncShare(store, name);
}
