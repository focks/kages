---
name: persistence-backends
description: "How Kages persists workspaces: in-memory (default), plain Postgres via DATABASE_URL, or Supabase REST. Covers the normalized tables (workspaces/kages/kage_versions), compare-and-swap delta writes, db:setup, the collation gotcha, the NUL-character rule and how to test against a real database. Read before touching src/server/persistence.ts, public-shares.ts or pg.ts."
---

# Persistence backends

Normalized model: `workspaces` (rev + small `meta` jsonb — everything except the
version log), `kages` (identity + `head_seq` pointer) and `kage_versions` (the
immutable signed version log, one row per version — where the documents live).
All load/save/lookup logic lives in SQL functions (`kages_load`, `kages_save`,
`kages_public_head`, `kages_repo_rows` — see
`supabase/migrations/20261024000000_normalized_model.sql`); the plain-pg backend
runs `select fn(...)` and the Supabase backend calls the same functions through
PostgREST rpc, so the two cannot diverge. `kages_state`/`public_shares` are
legacy rollback copies, backfilled from at migration time and no longer read.
Backend choice is environment-driven and every function is a
no-op when none is configured, so tests and plain `npm run dev` stay in-memory:

| Env | Backend |
| --- | --- |
| `DATABASE_URL` | plain Postgres through `pg` (wins if Supabase is also set) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Supabase REST |
| neither | in-memory |

## Rules

- **Writes are compare-and-swap deltas.** `mutateStore` loads the latest snapshot,
  fingerprints it with `baselineOf` BEFORE applying the op (`Store.restore` shares
  the versions arrays by reference — the op appends in place, so a late baseline
  would diff to "unchanged" and lose the write), applies the op, and `casSave`s
  against the `workspaces.rev` it read, retrying on conflict. Only each kage's
  appended version tail plus the meta blob travel; without a baseline `casSave`
  falls back to a full replace (p_replace), which is correct but bigger.
- **The pool lives on `globalThis`.** Next dev re-evaluates modules per route
  compile; a module-level pool would leak connections.
- **No NUL characters.** jsonb rejects `\u0000`, which would lose the whole write,
  and stripping it would break the signed digest, so `Store.writeVersion` refuses
  such documents for every backend.
- **Backfill, don't reseed.** A persisted workspace is seeded once;
  `backfillExamples` adds newly shipped example templates on load without touching
  existing documents.

## Local setup

```
DATABASE_URL='postgres:///kages_dev?host=/var/run/postgresql' npm run db:setup
echo "DATABASE_URL=postgres:///kages_dev?host=/var/run/postgresql" > .env.local
```

`db:setup` creates the database from `template0` with `C.UTF-8` on purpose:
after an OS upgrade `template1` can carry a stale glibc collation version and
`create database` refuses to run. Refreshing it would change shared server
state, so avoid that. It then applies `supabase/migrations/*.sql` (same files
Supabase uses) and records them in `schema_migrations`; re-running is a no-op.

## Testing

`src/server/persistence.test.ts` runs only when `KAGES_TEST_DATABASE_URL` points
at a throwaway database (create one with `db:setup`); otherwise it skips. It
deletes the rows it uses, so never aim it at data you care about.

## Adding a persisted collection (briefs, critiques, …)

Use `src/store/collection.ts` (`Collection<T>`): optional snapshot field, tolerant
`load(undefined)`, ids reseeded from the highest surviving suffix plus a persisted sequence high-water mark, a hard `max`
that returns a typed error. The persistence layers treat the snapshot as an opaque
blob (collections live in `workspaces.meta`), so a new collection persists in
memory, `store.json`, Supabase and Postgres with no backend change. Checklist before merging a new collection:

- [ ] type, `max` and retention documented; permission model (read / write / admin) stated
- [ ] a `KageEvent` type if others should observe it
- [ ] purge in `Store.remove` if rows reference a Kage
- [ ] legacy-snapshot test (`src/store/__fixtures__/legacy-snapshot.json` must still restore and round-trip) and a Postgres round-trip
- [ ] size budget noted: collections share the one `meta` jsonb blob per workspace

## Failure and concurrency boundaries

- Missing rows return null; database/network errors throw and routes return 503. Never seed after a failed read.
- Initialize with insert-if-absent/CAS and reload a concurrent winner. Never upsert a seed over an existing row.
- Persistent reads reload committed snapshots; process caches are authoritative only in memory mode.
- Claims persist with absolute expiry timestamps. Quotas remain process-local; never describe them as distributed rate limits.
- Public share reads resolve the committed head from `kage_versions` (uuid index + head_seq join) via `kages_public_head`; the TS caller re-checks state/visibility. There is no mirror table; the legacy public_shares copy is never read. Keep the `workspaces.meta` GIN index with the gallery and repo-share containment lookups.
- Collections that use sequential IDs persist their sequence independently of rows, so deletion and reload cannot reuse an ID.
