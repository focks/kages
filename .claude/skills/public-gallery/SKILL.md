---
name: public-gallery
description: "Read before changing public gallery discovery, publication or voting: explicit consent, atomic snapshot projections and cross-workspace authorization."
---

# Public gallery

`/gallery` is public chrome. It only calls operations through `/api/<op>`.
`publish_to_gallery` requires ordinary publish permission and makes the current
valid Kage public. Public visibility alone never opts a Kage into discovery.
`remove_from_gallery` keeps visibility, votes and the original listing date.
Saving a new draft, narrowing visibility, unpublishing, archiving or deleting
withdraws discovery; ordinary later publication must not silently re-enroll it.

## Atomic discovery projection

`StoreSnapshot.gallery` is optional for legacy compatibility. Membership and
votes live in the owner's snapshot. Every snapshot derives each public card
from the current head; eligibility requires explicit opt-in, matching UUID,
published state and public visibility. Restore ignores the persisted card and
recomputes it. Delete purges the record. Do not introduce an asynchronous mirror:
revocation and its discovery projection must commit in the same CAS write.

`src/server/gallery.ts` reads only the gallery JSON projection across workspaces,
using PostgreSQL or paginated Supabase REST (continue until an empty page,
because the backend may impose a smaller page size). Memory mode inspects known
stores. Never fetch documents or signing keys for discovery. The raw projection
contains private voter identities: only `galleryPage`/`galleryCard` may serialize
a public response, exposing counts and the caller's own vote, never voter IDs,
workspace IDs, private artifact names or provenance.

## Cross-workspace reads and votes

`executeOp` resolves UUIDs to the owning workspace only for `get_gallery_kage`
and `vote_gallery_kage`. Read current gallery content only, never earlier
versions that may have been private. Recheck eligibility inside the store for
reads and inside the CAS transaction for writes; UUID lookup alone is not an
authorization decision. All other operations retain normal workspace routing.

A vote sets desired state (1 or 0), never toggles, so retries are idempotent.
Use the authenticated effective principal, deny anon/guest voting, and retain
votes through relisting. The existing persisted discussion throttle applies to
changed votes. A 10,000-voter ceiling bounds snapshot growth; never silently drop
votes to admit a new one. Larger-scale voting needs a separately designed
transactional index, not an unbounded snapshot array or a cached count.

## Verification

- Store tests: explicit/public publication, permission and baseVersion checks,
  lifecycle withdrawal, old snapshots, durable unique votes, no voter leakage.
- Server tests: projection-only queries, Supabase pagination/failure, CAS races,
  revoke-after-lookup, fail-closed persistence. `KAGES_TEST_DATABASE_URL` enables
  the real Postgres roundtrip/concurrent-vote test (use a disposable database).
- CLI tests: publish --gallery and list/upvote/unvote/remove persistence.
- Browser: set `KAGES_GALLERY_E2E_URL` to an isolated local-mode server only.
  The test creates/deletes its fixture and exercises Library → Share → Gallery,
  voting, reload, removal and narrow-screen layout. It refuses cloud mode.
