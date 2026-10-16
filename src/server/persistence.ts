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
// uses insert-if-absent; a competing initializer must reload the winner.

import type { StoreSnapshot } from "../store/store.ts";
import { pgEnabled, pool } from "./pg.ts";

// Read per call, like DATABASE_URL: tests and scripts set these after the module is imported, and an
// import-time snapshot silently kept the in-memory path.
const base = () => process.env.SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
// A hung PostgREST would otherwise hold the request (and every read goes through here) indefinitely.
const REST_TIMEOUT_MS = 10_000;
const TABLE = "kages_state";

/** Postgres (DATABASE_URL) wins over Supabase when both are set: it is the
 *  explicit local/self-hosted choice, and the two must never both be written. */
export function persistenceEnabled(): boolean {
  return pgEnabled() || !!(base() && key());
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: key()!, Authorization: `Bearer ${key()!}`, "Content-Type": "application/json", ...extra };
}

// The blob stored in the row is the store snapshot plus a persistence-only _rev.
// Store.restore ignores the extra key, and snapshot() never emits it, so _rev
// stays entirely within this module.
type Stored = StoreSnapshot & { _rev?: number };

/** The persisted snapshot for a workspace with its current revision, or null when
 *  persistence is off or the row is empty. Legacy rows (written before _rev
 *  existed) report rev 0. Storage errors throw: treating an outage as absence would seed over user data. */
export async function loadSnapshotRev(workspace: string): Promise<{ snapshot: StoreSnapshot; rev: number } | null> {
  if (!persistenceEnabled()) return null;
  if (pgEnabled()) {
    try {
      const r = await pool().query("select snapshot from kages_state where id = $1", [workspace]);
      const blob = r.rows[0]?.snapshot as Stored | undefined;
      return blob ? { snapshot: blob, rev: typeof blob._rev === "number" ? blob._rev : 0 } : null;
    } catch (e) { throw new Error("workspace storage unavailable", { cause: e }); }
  }
  try {
    const res = await fetch(`${base()}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(workspace)}&select=snapshot`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(REST_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`workspace storage returned ${res.status}`);
    const rows = (await res.json()) as { snapshot: Stored }[];
    const blob = rows[0]?.snapshot;
    if (!blob) return null;
    return { snapshot: blob, rev: typeof blob._rev === "number" ? blob._rev : 0 };
  } catch (e) {
    throw new Error("workspace storage unavailable", { cause: e });
  }
}

/** Initialization never overwrites a row created by another instance. */
export async function saveSnapshot(workspace: string, snap: StoreSnapshot): Promise<void> {
  await casSave(workspace, snap, null);
}

/** Commit a mutated snapshot IFF the row's revision still matches `expectedRev`
 *  (compare-and-swap). `expectedRev === null` means "there was no row" → insert,
 *  which fails if another instance created it first. Returns true on commit,
 *  false on a revision conflict (caller reloads and retries). */
export async function casSave(workspace: string, snap: StoreSnapshot, expectedRev: number | null): Promise<boolean> {
  if (!persistenceEnabled()) return true;
  const blob: Stored = { ...snap, _rev: (expectedRev ?? 0) + 1 };
  const now = new Date().toISOString();
  if (pgEnabled()) {
    try {
      // `is not distinct from` makes the legacy no-_rev row (expectedRev 0 → null)
      // match exactly like the REST filter does; a moved rev updates zero rows.
      if (expectedRev === null) {
        const r = await pool().query("insert into kages_state (id, snapshot, updated_at) values ($1, $2::jsonb, now()) on conflict (id) do nothing", [workspace, JSON.stringify(blob)]);
        return r.rowCount === 1;
      }
      const r = await pool().query(
        "update kages_state set snapshot = $2::jsonb, updated_at = now() where id = $1 and (snapshot->>'_rev') is not distinct from $3::text",
        [workspace, JSON.stringify(blob), expectedRev === 0 ? null : String(expectedRev)],
      );
      return r.rowCount === 1;
    } catch (e) { throw new Error("workspace storage unavailable", { cause: e }); }
  }
  try {
    if (expectedRev === null) {
      const res = await fetch(`${base()}/rest/v1/${TABLE}`, {
        method: "POST", headers: headers({ Prefer: "return=minimal" }), signal: AbortSignal.timeout(REST_TIMEOUT_MS),
        body: JSON.stringify({ id: workspace, snapshot: blob, updated_at: now }),
      });
      if (res.status === 409) return false; // row already exists → conflict
      if (!res.ok) throw new Error(`workspace storage returned ${res.status}`);
      return true;
    }
    // Legacy rows have no _rev (null); a known rev matches exactly.
    const revFilter = expectedRev === 0 ? "snapshot->>_rev=is.null" : `snapshot->>_rev=eq.${expectedRev}`;
    const res = await fetch(`${base()}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(workspace)}&${revFilter}`, {
      method: "PATCH", headers: headers({ Prefer: "return=representation" }), signal: AbortSignal.timeout(REST_TIMEOUT_MS),
      body: JSON.stringify({ snapshot: blob, updated_at: now }),
    });
    if (!res.ok) throw new Error(`workspace storage returned ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) && rows.length === 1; // 0 rows updated → rev moved → conflict
  } catch (e) {
    throw new Error("workspace storage unavailable", { cause: e });
  }
}
