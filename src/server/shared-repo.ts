// Resolves a project link (/r/<uuid>) to the list of Kages it shows. Like readSharedDoc for a single Kage, this is
// the one place the rule lives, so the JSON route and the markdown route cannot disagree. The link is found in the
// committed workspace meta and the list is computed from the heads published at this moment, never from a mirror.
// kages_repo_rows does the trimming in SQL for both backends: only the share metadata and a few head fields leave
// the database, never documents, comments or history.
import { repoListing, type RepoListing, type RepoShare, type ShareHead } from "../store/repo-share.ts";
import { pgEnabled, pool } from "./pg.ts";
import { sharesEnabled } from "./public-shares.ts";
import { getStore } from "./store-instance.ts";

export type SharedRepo = { ok: true; listing: RepoListing } | { ok: false; status: number; code: string; msg: string };
const notFound: SharedRepo = { ok: false, status: 404, code: "not_found", msg: "no such shared project" };
const REST_TIMEOUT_MS = 10_000;

type RepoRow = { shares: RepoShare[] | null; heads: ShareHead[] };

export async function readSharedRepo(uuid: string): Promise<SharedRepo> {
  // The uuid only ever reaches SQL as a bound parameter, but a malformed one cannot match anything.
  if (!/^[A-Za-z0-9-]{8,64}$/.test(uuid)) return notFound;
  if (!sharesEnabled()) {
    const store = await getStore("acme");
    const listing = store.sharedRepo(uuid);
    return listing ? { ok: true, listing } : notFound;
  }
  try {
    let rows: RepoRow[];
    if (pgEnabled()) {
      const r = await pool().query("select public.kages_repo_rows($1) as rows", [uuid]);
      rows = (r.rows[0]?.rows as RepoRow[]) ?? [];
    } else {
      const base = process.env.SUPABASE_URL!, key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const res = await fetch(`${base}/rest/v1/rpc/kages_repo_rows`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_uuid: uuid }),
        cache: "no-store", signal: AbortSignal.timeout(REST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`share storage returned ${res.status}`);
      rows = ((await res.json()) as RepoRow[]) ?? [];
    }
    for (const row of rows) {
      const listing = repoListing(row.shares, row.heads, uuid);
      if (listing) return { ok: true, listing };
    }
    return notFound;
  } catch {
    return { ok: false, status: 503, code: "unavailable", msg: "share storage unavailable" };
  }
}
