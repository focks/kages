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
