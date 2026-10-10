-- Kages durable state: one row holding the store's JSON snapshot.
-- The app reads/writes this via the service-role key only (see
-- src/server/persistence.ts); RLS with no policy blocks anon/public access,
-- and the service role bypasses RLS.

create table if not exists public.kages_state (
  id         text primary key,
  snapshot   jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.kages_state enable row level security;
-- No policies on purpose: only the service-role key (which bypasses RLS) may
-- touch this table. The anon/publishable keys get nothing.
