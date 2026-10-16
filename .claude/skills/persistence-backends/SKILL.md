---
name: persistence-backends
description: "How Kages persists workspaces: in-memory (default), plain Postgres via DATABASE_URL, or Supabase REST. Covers the two tables, compare-and-swap writes, db:setup, the collation gotcha, the NUL-character rule and how to test against a real database. Read before touching src/server/persistence.ts, public-shares.ts or pg.ts."
---

# Persistence backends

One snapshot row per workspace (`kages_state`) plus a public-link registry
(`public_shares`). Backend choice is environment-driven and every function is a
no-op when none is configured, so tests and plain `npm run dev` stay in-memory:

| Env | Backend |
| --- | --- |
| `DATABASE_URL` | plain Postgres through `pg` (wins if Supabase is also set) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Supabase REST |
| neither | in-memory |

## Rules

- **Writes are compare-and-swap.** `mutateStore` loads the latest row, applies the
  op, and `casSave`s against the revision it read (`_rev` lives inside the jsonb
  blob), retrying on conflict. Keep both backends' semantics identical; a legacy
  row without `_rev` is revision 0 (`is not distinct from` in SQL).
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
blob, so a new collection persists in memory, `store.json`, Supabase and Postgres
with no backend change. Checklist before merging a new collection:

- [ ] type, `max` and retention documented; permission model (read / write / admin) stated
- [ ] a `KageEvent` type if others should observe it
- [ ] purge in `Store.remove` if rows reference a Kage
- [ ] legacy-snapshot test (`src/store/__fixtures__/legacy-snapshot.json` must still restore and round-trip) and a Postgres round-trip
- [ ] size budget noted: the snapshot is one jsonb row per workspace

## Failure and concurrency boundaries

- Missing rows return null; database/network errors throw and routes return 503. Never seed after a failed read.
- Initialize with insert-if-absent/CAS and reload a concurrent winner. Never upsert a seed over an existing row.
- Persistent reads reload committed snapshots; process caches are authoritative only in memory mode.
- Claims persist with absolute expiry timestamps. Quotas remain process-local; never describe them as distributed rate limits.
- Public share reads authorize against the latest committed workspace head using UUID containment. The legacy public_shares mirror is not an authorization source. Keep the snapshot GIN index migration with this lookup.
- Collections that use sequential IDs persist their sequence independently of rows, so deletion and reload cannot reuse an ID.
