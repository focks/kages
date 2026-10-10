-- Global registry of publicly shared Kages, keyed by the Kage's opaque uuid, so
-- a /k/<uuid> link resolves without knowing which user's workspace holds it.
-- Written (service key) when a Kage is published to link/public, removed when it
-- narrows. See src/server/public-shares.ts.

create table if not exists public.public_shares (
  uuid       text primary key,
  doc        jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.public_shares enable row level security;
-- No policies: only the service-role key (which bypasses RLS) reads/writes this.
-- The /k route reads it server-side with that key; anon/publishable keys get nothing.
