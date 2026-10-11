// Env-gated Supabase persistence for the process store. With SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY set, the store's snapshot() is loaded on cold start
// and saved after each write — through Supabase's REST (PostgREST) API with
// plain fetch, so there's NO SDK dependency to carry. WITHOUT those env vars
// every function here is a no-op, so local dev and the whole test suite run
// exactly as before (pure in-memory). That gate is the guarantee that adding
// cloud persistence cannot change existing behaviour.
//
// Storage shape: a single row in `kages_state(id text pk, snapshot jsonb,
// updated_at timestamptz)` — see supabase/migrations/. The service-role key
// bypasses RLS, and RLS-with-no-policy blocks anon, so the blob is server-only.
//
// Serverless note: each cold instance can hold a stale copy. To stop a stale
// instance from clobbering fresher state (losing a write, or RESURRECTING a
// deleted Kage), mutations use optimistic concurrency: a monotonic `_rev` kept
// INSIDE the snapshot blob (no schema migration needed — PostgREST can filter on
// snapshot->>_rev), and casSave only commits if the row's _rev still matches what
// the caller read. The write path (mutateStore) retries on conflict. Seeding
// stays a plain upsert — two cold starts seed identical content.

import type { StoreSnapshot } from "../store/store.ts";

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = "kages_state";

export function persistenceEnabled(): boolean {
  return !!(BASE && KEY);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: KEY!, Authorization: `Bearer ${KEY!}`, "Content-Type": "application/json", ...extra };
}

// The blob stored in the row is the store snapshot plus a persistence-only _rev.
// Store.restore ignores the extra key, and snapshot() never emits it, so _rev
// stays entirely within this module.
type Stored = StoreSnapshot & { _rev?: number };

/** The persisted snapshot for a workspace with its current revision, or null when
 *  persistence is off or the row is empty. Legacy rows (written before _rev
 *  existed) report rev 0. Any failure logs and returns null so the caller falls
 *  back to a fresh seed — a broken database never takes the app down. */
export async function loadSnapshotRev(workspace: string): Promise<{ snapshot: StoreSnapshot; rev: number } | null> {
  if (!persistenceEnabled()) return null;
  try {
    const res = await fetch(`${BASE}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(workspace)}&select=snapshot`, { headers: headers() });
    if (!res.ok) { console.error(`loadSnapshotRev: ${res.status} ${await res.text()}`); return null; }
    const rows = (await res.json()) as { snapshot: Stored }[];
    const blob = rows[0]?.snapshot;
    if (!blob) return null;
    return { snapshot: blob, rev: typeof blob._rev === "number" ? blob._rev : 0 };
  } catch (e) {
    console.error("loadSnapshotRev failed:", e);
    return null;
  }
}

/** Seed/first-write a workspace's snapshot (plain merge-duplicates upsert). Used
 *  only for seeding a brand-new workspace, where last-wins is harmless (identical
 *  content). Starts the revision at 1. */
export async function saveSnapshot(workspace: string, snap: StoreSnapshot): Promise<void> {
  if (!persistenceEnabled()) return;
  try {
    const res = await fetch(`${BASE}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({ id: workspace, snapshot: { ...snap, _rev: 1 }, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) console.error(`saveSnapshot: ${res.status} ${await res.text()}`);
  } catch (e) {
    console.error("saveSnapshot failed:", e);
  }
}

/** Commit a mutated snapshot IFF the row's revision still matches `expectedRev`
 *  (compare-and-swap). `expectedRev === null` means "there was no row" → insert,
 *  which fails if another instance created it first. Returns true on commit,
 *  false on a revision conflict (caller reloads and retries). */
export async function casSave(workspace: string, snap: StoreSnapshot, expectedRev: number | null): Promise<boolean> {
  if (!persistenceEnabled()) return true;
  const blob: Stored = { ...snap, _rev: (expectedRev ?? 0) + 1 };
  const now = new Date().toISOString();
  try {
    if (expectedRev === null) {
      const res = await fetch(`${BASE}/rest/v1/${TABLE}`, {
        method: "POST", headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ id: workspace, snapshot: blob, updated_at: now }),
      });
      if (res.status === 409) return false; // row already exists → conflict
      if (!res.ok) { console.error(`casSave insert: ${res.status} ${await res.text()}`); return false; }
      return true;
    }
    // Legacy rows have no _rev (null); a known rev matches exactly.
    const revFilter = expectedRev === 0 ? "snapshot->>_rev=is.null" : `snapshot->>_rev=eq.${expectedRev}`;
    const res = await fetch(`${BASE}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(workspace)}&${revFilter}`, {
      method: "PATCH", headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify({ snapshot: blob, updated_at: now }),
    });
    if (!res.ok) { console.error(`casSave update: ${res.status} ${await res.text()}`); return false; }
    const rows = await res.json();
    return Array.isArray(rows) && rows.length === 1; // 0 rows updated → rev moved → conflict
  } catch (e) {
    console.error("casSave failed:", e);
    return false;
  }
}
