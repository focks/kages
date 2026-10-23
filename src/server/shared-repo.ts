// Resolves a project link (/r/<uuid>) to the list of Kages it shows. Like readSharedDoc for a single Kage, this is
// the one place the rule lives, so the JSON route and the markdown route cannot disagree. The link is found in the
// committed workspace row and the list is computed from the Kages published at this moment, never from a mirror.
import { repoListing, type RepoListing, type RepoShare, type ShareHead } from "../store/repo-share.ts";
import type { StoreSnapshot } from "../store/store.ts";
import { pgEnabled, pool } from "./pg.ts";
import { sharesEnabled } from "./public-shares.ts";
import { getStore } from "./store-instance.ts";

export type SharedRepo = { ok: true; listing: RepoListing } | { ok: false; status: number; code: string; msg: string };
const notFound: SharedRepo = { ok: false, status: 404, code: "not_found", msg: "no such shared project" };
const REST_TIMEOUT_MS = 10_000;

// Only the fields the list needs leave the database: a workspace row also holds every version and comment.
// `@>` finds the row through the GIN index; the lateral aggregate trims each head to a few fields.
const ROW_QUERY = `select s.snapshot->'repoShares' as shares, (
  select coalesce(jsonb_agg(jsonb_build_object('uuid', h->'uuid', 'ref', h->'ref', 'state', h->'state', 'visibility', h->'visibility', 'title', h->'doc'->'title', 'system', h->'doc'->'system', 'mode', h->'doc'->'brief'->'mode')), '[]'::jsonb)
  from jsonb_path_query(s.snapshot, '$.kages[*].versions[last]') h) as heads
  from kages_state s where s.snapshot @> $1::jsonb`;

const headOf = (v: StoreSnapshot["kages"][number]["versions"][number]): ShareHead => ({ uuid: v.uuid, ref: v.ref, state: v.state, visibility: v.visibility, title: v.doc.title, system: v.doc.system, mode: v.doc.brief?.mode ?? null });

export async function readSharedRepo(uuid: string): Promise<SharedRepo> {
  // The uuid only ever reaches SQL as a bound parameter or inside JSON, but a malformed one cannot match anything.
  if (!/^[A-Za-z0-9-]{8,64}$/.test(uuid)) return notFound;
  if (!sharesEnabled()) {
    const store = await getStore("acme");
    const listing = store.sharedRepo(uuid);
    return listing ? { ok: true, listing } : notFound;
  }
  const contains = { repoShares: [{ uuid }] };
  try {
    if (pgEnabled()) {
      const r = await pool().query(ROW_QUERY, [JSON.stringify(contains)]);
      for (const row of r.rows as { shares: RepoShare[] | null; heads: ShareHead[] }[]) {
        const listing = repoListing(row.shares, row.heads, uuid);
        if (listing) return { ok: true, listing };
      }
      return notFound;
    }
    const base = process.env.SUPABASE_URL!, key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const filter = encodeURIComponent(JSON.stringify(contains));
    const res = await fetch(`${base}/rest/v1/kages_state?snapshot=cs.${filter}&select=snapshot`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(REST_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`share storage returned ${res.status}`);
    for (const { snapshot } of (await res.json()) as { snapshot: StoreSnapshot }[]) {
      const heads = snapshot.kages.flatMap((k) => (k.versions.at(-1) ? [headOf(k.versions.at(-1)!)] : []));
      const listing = repoListing(snapshot.repoShares, heads, uuid);
      if (listing) return { ok: true, listing };
    }
    return notFound;
  } catch {
    return { ok: false, status: 503, code: "unavailable", msg: "share storage unavailable" };
  }
}
