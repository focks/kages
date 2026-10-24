// Cross-workspace discovery reads only the gallery projection written atomically
// with each snapshot. It never scans documents, signing keys or audit history,
// and it never authorizes a vote from a cached listing.
import type { GallerySnapshot } from '../store/gallery.ts';
import { sharesEnabled, getPublicShareWorkspace } from './public-shares.ts';
import { pgEnabled, pool } from './pg.ts';
import { memoryGalleryStores } from './store-instance.ts';

/** The server may inspect voter IDs to calculate myVote, but the operation's
 * galleryPage strips them before any response. Paginate rows so PostgREST's
 * default response cap cannot silently omit a workspace from global ranking. */
export async function readGalleryEntries(): Promise<GallerySnapshot[]> {
  if (!sharesEnabled()) return (await memoryGalleryStores()).flatMap(s => s.galleryEntries());
  if (pgEnabled()) {
    const result = await pool().query("select meta->'gallery' as gallery from workspaces where meta @> $1::jsonb", [JSON.stringify({ gallery: [{ listed: true }] })]);
    return result.rows.flatMap((r: { gallery: GallerySnapshot[] }) => r.gallery ?? []);
  }
  const base = process.env.SUPABASE_URL!, key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const filter = encodeURIComponent(JSON.stringify({ gallery: [{ listed: true }] }));
  const entries: GallerySnapshot[] = [];
  for (let offset = 0; ; ) {
    const res = await fetch(`${base}/rest/v1/workspaces?meta=cs.${filter}&select=gallery:meta->gallery&order=id.asc&offset=${offset}&limit=100`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw Error(`gallery storage returned ${res.status}`);
    const rows = await res.json() as { gallery: GallerySnapshot[] }[];
    if (!rows.length) return entries;
    entries.push(...rows.flatMap(row => row.gallery ?? []));
    offset += rows.length;
  }
}

/** Resolve a global UUID to the owning workspace. The subsequent store read or
 * CAS vote rechecks opt-in/publication, covering revocation after this lookup. */
export async function galleryWorkspace(uuid: string): Promise<string | null> {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(uuid)) return null;
  if (sharesEnabled()) return getPublicShareWorkspace(uuid);
  return (await memoryGalleryStores()).find(s => s.isInGallery(uuid))?.workspace ?? null;
}
