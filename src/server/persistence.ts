// Env-gated persistence for the process store, over the normalized model
// (workspaces / kages / kage_versions — see supabase/migrations/20261024…).
// With DATABASE_URL set it talks plain Postgres; with SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY it calls the same SQL functions through PostgREST
// rpc, so the two backends cannot diverge. WITHOUT those env vars every
// function here is a no-op, so local dev and the test suite run pure in-memory.
//
// Writes are compare-and-swap deltas. mutateStore loads the latest snapshot,
// fingerprints it (baselineOf — taken BEFORE the op runs, because Store.restore
// shares the versions arrays by reference and an op appends in place), applies
// the op, and casSave sends only the changed tail of each kage's version log
// plus the small meta blob. kages_save commits iff the workspace rev still
// matches; the caller retries on conflict. Without a baseline (seeding, tests)
// casSave falls back to a full replace, which is always correct, just bigger.

import type { StoreSnapshot } from "../store/store.ts";
import type { VersionRecord } from "../store/types.ts";
import { pgEnabled, pool } from "./pg.ts";

// Read per call, like DATABASE_URL: tests and scripts set these after the module is imported.
const base = () => process.env.SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
// A hung PostgREST would otherwise hold the request (and every read goes through here) indefinitely.
const REST_TIMEOUT_MS = 10_000;

/** Postgres (DATABASE_URL) wins over Supabase when both are set: it is the
 *  explicit local/self-hosted choice, and the two must never both be written. */
export function persistenceEnabled(): boolean {
  return pgEnabled() || !!(base() && key());
}

function headers(): Record<string, string> {
  return { apikey: key()!, Authorization: `Bearer ${key()!}`, "Content-Type": "application/json" };
}

/** Call a SQL function through PostgREST. Both backends run the same functions,
 *  so rpc here and `select fn(...)` on the pg path behave identically. */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${base()}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: headers(), body: JSON.stringify(args),
    cache: "no-store", signal: AbortSignal.timeout(REST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`workspace storage returned ${res.status}`);
  return (await res.json()) as T;
}

type LoadedRow = {
  rev: number;
  meta: Record<string, unknown>;
  kages: { name: string; versions: VersionRecord[] }[];
} | null;

/** A cheap fingerprint of the version log at load time: per kage, how many
 *  versions were committed and the head's identity INCLUDING its mutable
 *  lifecycle fields — transitions (publish/unpublish/share/…) rewrite
 *  head.state/visibility in place without appending, and a digest-only check
 *  would read that as "unchanged" and lose the revocation. It must be taken
 *  before the op runs — the restored Store appends to the same arrays. */
export type Baseline = Map<string, { n: number; last: string | undefined }>;
const keyOf = (v: VersionRecord | undefined) => (v ? `${v.digest}|${v.state}|${v.visibility}` : undefined);
export function baselineOf(snap: StoreSnapshot): Baseline {
  return new Map((snap.kages ?? []).map((k) => [k.name, { n: k.versions.length, last: keyOf(k.versions.at(-1)) }]));
}

/** The persisted snapshot for a workspace with its current revision, or null when
 *  persistence is off or the workspace is absent. Storage errors throw: treating
 *  an outage as absence would seed over user data. */
export async function loadSnapshotRev(workspace: string): Promise<{ snapshot: StoreSnapshot; rev: number } | null> {
  if (!persistenceEnabled()) return null;
  let row: LoadedRow;
  try {
    row = pgEnabled()
      ? ((await pool().query("select public.kages_load($1) as row", [workspace])).rows[0]?.row as LoadedRow) ?? null
      : await rpc<LoadedRow>("kages_load", { p_ws: workspace });
  } catch (e) {
    throw new Error("workspace storage unavailable", { cause: e });
  }
  if (!row) return null;
  return { snapshot: { ...row.meta, kages: row.kages } as StoreSnapshot, rev: row.rev };
}

// The hottest reads, none of which look behind a Kage's latest version.
const HEADS_ONLY = new Set(["list_kages", "list_repos", "list_projects", "search_kages", "get_kage", "describe_kage", "preview_kage", "get_state", "lint_kage", "export_kage"]);
export const headsSuffice = (op: string, params: Record<string, unknown>) => HEADS_ONLY.has(op) && !params?.version && !(op === "export_kage" && params?.format === "card");

/** The snapshot with only each Kage's latest version, for reads that never look further
 *  back. Loading every version of every Kage on each request grows with history, not with
 *  what the caller asked for. Null means use the full load: persistence is off, the
 *  workspace is absent, or this database has not had the migration yet. Never commit a
 *  store built from this; it has no history to carry forward. */
export async function loadHeadsSnapshot(workspace: string): Promise<StoreSnapshot | null> {
  if (!persistenceEnabled()) return null;
  let row: LoadedRow;
  try {
    row = pgEnabled()
      ? ((await pool().query("select public.kages_load_heads($1) as row", [workspace])).rows[0]?.row as LoadedRow) ?? null
      : await rpc<LoadedRow>("kages_load_heads", { p_ws: workspace });
  } catch {
    return null;
  }
  return row ? ({ ...row.meta, kages: row.kages } as StoreSnapshot) : null;
}

/** Initialization never overwrites a workspace created by another instance. */
export async function saveSnapshot(workspace: string, snap: StoreSnapshot): Promise<void> {
  await casSave(workspace, snap, null);
}

/** Commit a mutated snapshot IFF the workspace revision still matches
 *  `expectedRev` (compare-and-swap). `expectedRev === null` means "there was no
 *  workspace" → insert, which fails if another instance created it first. With a
 *  `prev` baseline only the delta travels: appended versions per kage, deleted
 *  kage names and the meta blob. Returns true on commit, false on a revision
 *  conflict (caller reloads and retries). */
export async function casSave(
  workspace: string, snap: StoreSnapshot, expectedRev: number | null, prev?: Baseline | null,
): Promise<boolean> {
  if (!persistenceEnabled()) return true;
  const { kages = [], ...meta } = snap as StoreSnapshot & Record<string, unknown>;
  const replace = prev == null;
  const upserts: { name: string; base: number; versions: VersionRecord[] }[] = [];
  const deletions: string[] = [];
  for (const k of kages as StoreSnapshot["kages"]) {
    // Store.restore drops legacy nameless entries and writes now refuse a bad id, so
    // one here is a new bug. Skipping it would report a commit while losing the document.
    if (typeof k.name !== "string") throw new Error("refusing to save a Kage with no name");
    const old = prev?.get(k.name);
    let from = 0;
    // Non-head versions are immutable (signed); only the head's lifecycle
    // fields can change in place. So: head fingerprint intact → send only the
    // appended tail; fingerprint moved → rewrite from the old head onward.
    if (old && k.versions.length >= old.n && old.n > 0) {
      if (keyOf(k.versions[old.n - 1]) === old.last) {
        if (k.versions.length === old.n) continue; // unchanged
        from = old.n;
      } else {
        from = old.n - 1; // a lifecycle transition mutated the committed head
      }
    } else if (old && old.n === 0 && k.versions.length === 0) continue;
    upserts.push({ name: k.name, base: from, versions: k.versions.slice(from) });
  }
  if (prev) for (const name of prev.keys()) if (!kages.some((k: { name: string }) => k.name === name)) deletions.push(name);
  try {
    if (pgEnabled()) {
      const r = await pool().query("select public.kages_save($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6) as ok",
        [workspace, expectedRev, JSON.stringify(meta), JSON.stringify(upserts), JSON.stringify(deletions), replace]);
      return r.rows[0]?.ok === true;
    }
    return (await rpc<boolean>("kages_save", {
      p_ws: workspace, p_expected_rev: expectedRev, p_meta: meta,
      p_upserts: upserts, p_deletions: deletions, p_replace: replace,
    })) === true;
  } catch (e) {
    throw new Error("workspace storage unavailable", { cause: e });
  }
}
