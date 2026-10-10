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
// Serverless note: each cold instance loads its own copy and writes last-wins.
// That's fine for a reference deployment; a busy multi-instance deploy would add
// an optimistic version column and retry on conflict. ponytail: last-wins blob.

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

/** The persisted snapshot for a workspace, or null when persistence is off or
 *  the row is empty. The row id is the WORKSPACE, so each user's workspace is an
 *  isolated row. Any failure logs and returns null so the caller falls back to a
 *  fresh seed — a broken database never takes the app down, it just loses
 *  durability. */
export async function loadSnapshot(workspace: string): Promise<StoreSnapshot | null> {
  if (!persistenceEnabled()) return null;
  try {
    const res = await fetch(`${BASE}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(workspace)}&select=snapshot`, { headers: headers() });
    if (!res.ok) { console.error(`loadSnapshot: ${res.status} ${await res.text()}`); return null; }
    const rows = (await res.json()) as { snapshot: StoreSnapshot }[];
    return rows[0]?.snapshot ?? null;
  } catch (e) {
    console.error("loadSnapshot failed:", e);
    return null;
  }
}

/** Upsert a workspace's snapshot (merge-duplicates on the primary key).
 *  Best-effort: a failure logs but doesn't throw, so a write that succeeded in
 *  memory still returns success even if the durable copy lagged. */
export async function saveSnapshot(workspace: string, snap: StoreSnapshot): Promise<void> {
  if (!persistenceEnabled()) return;
  try {
    const res = await fetch(`${BASE}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({ id: workspace, snapshot: snap, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) console.error(`saveSnapshot: ${res.status} ${await res.text()}`);
  } catch (e) {
    console.error("saveSnapshot failed:", e);
  }
}
