// Public links resolve against the committed workspace head. The legacy mirror
// remains available for migrations, but it cannot authorize reads: delayed writes
// to that table must never resurrect a revoked share.

import type { KageDoc } from "../engine/types.ts";
import type { Store } from "../store/store.ts";
import { pgEnabled, pool } from "./pg.ts";

// Read per call, like DATABASE_URL: tests and scripts set these after the module is imported, and an
// import-time snapshot silently kept the in-memory path.
const base = () => process.env.SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
// A hung PostgREST would otherwise hold the request (and every read goes through here) indefinitely.
const REST_TIMEOUT_MS = 10_000;
const TABLE = "public_shares";

// The row also holds every version, comment and audit entry of the workspace, and these reads are
// unauthenticated and uncached. `@>` finds the row through the GIN index; the jsonpath then hands back
// only the head version whose uuid matches, so a page view costs the Kage, not the whole history.
// The caller still checks state and visibility on that head: the path only selects, it never authorizes.
const HEAD_BY_UUID = "$.kages[*].versions[last] ? (@.uuid == $uuid)";
const headQuery = (cols: string) => `select ${cols}jsonb_path_query_first(snapshot, '${HEAD_BY_UUID}', jsonb_build_object('uuid', $2::text)) as head from kages_state where snapshot @> $1::jsonb`;
type Head = { uuid: string; state: string; visibility: string; doc: KageDoc };
const isOpen = (head: Head | null | undefined, uuid: string) => !!head && head.uuid === uuid && head.state === "published" && (head.visibility === "link" || head.visibility === "public");

export function sharesEnabled(): boolean {
  return pgEnabled() || !!(base() && key());
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: key()!, Authorization: `Bearer ${key()!}`, "Content-Type": "application/json", ...extra };
}

/** Resolve visibility from committed workspace heads, never a best-effort copy.
 * A delayed publish mirror must not resurrect a revoked or deleted public link. */
export async function getPublicShare(uuid: string): Promise<KageDoc | null> {
  if (!sharesEnabled()) return null;
  const contains = { kages: [{ versions: [{ uuid }] }] };
  if (pgEnabled()) {
    const r = await pool().query(headQuery(""), [JSON.stringify(contains), uuid]);
    for (const row of r.rows as { head: Head | null }[]) if (isOpen(row.head, uuid)) return row.head!.doc;
    return null;
  }
  const filter = encodeURIComponent(JSON.stringify(contains));
  const res = await fetch(`${base()}/rest/v1/kages_state?snapshot=cs.${filter}&select=snapshot`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(REST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`public share storage returned ${res.status}`);
  const snapshots = ((await res.json()) as { snapshot: import("../store/store.ts").StoreSnapshot }[]).map(r => r.snapshot);
  for (const snapshot of snapshots) for (const k of snapshot.kages) {
    const head = k.versions.at(-1);
    if (head?.uuid === uuid && head.state === "published" && (head.visibility === "link" || head.visibility === "public")) return head.doc;
  }
  return null;
}

export async function putPublicShare(uuid: string, doc: KageDoc): Promise<void> {
  if (!sharesEnabled()) return;
  if (pgEnabled()) {
    try { await pool().query("insert into public_shares (uuid, doc, updated_at) values ($1, $2::jsonb, now()) on conflict (uuid) do update set doc = excluded.doc, updated_at = now()", [uuid, JSON.stringify(doc)]); }
    catch (e) { console.error("putPublicShare (pg) failed:", e); }
    return;
  }
  try {
    const res = await fetch(`${base()}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates" }), signal: AbortSignal.timeout(REST_TIMEOUT_MS),
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
    const res = await fetch(`${base()}/rest/v1/${TABLE}?uuid=eq.${encodeURIComponent(uuid)}`, { method: "DELETE", headers: headers(), signal: AbortSignal.timeout(REST_TIMEOUT_MS) });
    if (!res.ok) console.error(`delPublicShare: ${res.status} ${await res.text()}`);
  } catch (e) { console.error("delPublicShare failed:", e); }
}

// Ops whose success can change what a /k/<uuid> link should serve. delete_kage is
// handled separately (afterWriteShareSync) because its Kage is gone afterwards.
const SHARE_AFFECTING = new Set([
  "publish_to_gallery", "publish_kage", "share_kage", "patch_kage",
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

/** The workspace row that holds a published link/public Kage, so a visitor's feedback is written to the right store. Same rule as getPublicShare: committed heads only. */
export async function getPublicShareWorkspace(uuid: string): Promise<string | null> {
  if (!sharesEnabled()) return null;
  const contains = { kages: [{ versions: [{ uuid }] }] };
  if (pgEnabled()) {
    const r = await pool().query(headQuery("id, "), [JSON.stringify(contains), uuid]);
    for (const row of r.rows as { id: string; head: Head | null }[]) if (isOpen(row.head, uuid)) return row.id;
    return null;
  }
  const filter = encodeURIComponent(JSON.stringify(contains));
  const res = await fetch(`${base()}/rest/v1/kages_state?snapshot=cs.${filter}&select=id,snapshot`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(REST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`public share storage returned ${res.status}`);
  const rows = (await res.json()) as { id: string; snapshot: import("../store/store.ts").StoreSnapshot }[];
  for (const row of rows) for (const k of row.snapshot.kages) {
    const head = k.versions.at(-1);
    if (head?.uuid === uuid && head.state === "published" && (head.visibility === "link" || head.visibility === "public")) return row.id;
  }
  return null;
}
