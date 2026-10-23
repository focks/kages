// One link for a whole project (repo). The share record only says "this repo has a link"; what the link shows is
// computed on every read from the Kages that are published right now, so the link can neither reveal a private
// Kage nor go stale. Pure, because the same rule runs against a live Store, a Postgres row and a REST snapshot.

export interface RepoShare { uuid: string; repo: string; title?: string; createdAt: string; createdBy: string }

/** The few fields of a head version the listing needs (never the document), so a SQL query can return only these. */
export interface ShareHead { uuid: string; ref: string; state: string; visibility: string; title?: string; system?: string; mode?: string | null }

export interface RepoListing { repo: string; title: string; items: Array<{ uuid: string; title: string; system: string; mode: string | null }> }

/** `kages://<ws>/<repo>/<name>@vN` → repo. Parsed from the ref, never taken from the caller. */
export function repoOfRef(ref: string): string { return ref.replace(/^kages:\/\//, "").split("/")[1] ?? ""; }

export const isOpenHead = (h: Pick<ShareHead, "state" | "visibility">): boolean =>
  h.state === "published" && (h.visibility === "link" || h.visibility === "public");

/** What a visitor of the folder link sees: the repo's Kages that already have a public link, by title. */
export function repoListing(shares: readonly RepoShare[] | null | undefined, heads: readonly ShareHead[], uuid: string): RepoListing | null {
  const share = (shares ?? []).find((s) => s.uuid === uuid);
  if (!share) return null;
  const items = heads
    .filter((h) => repoOfRef(h.ref) === share.repo && isOpenHead(h))
    .map((h) => ({ uuid: h.uuid, title: h.title || "Untitled", system: h.system ?? "", mode: h.mode ?? null }))
    .sort((a, b) => a.title.localeCompare(b.title) || a.uuid.localeCompare(b.uuid));
  return { repo: share.repo, title: share.title || share.repo, items };
}
