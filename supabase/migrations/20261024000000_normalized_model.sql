-- Normalized workspace model. Replaces the one-blob-per-workspace kages_state
-- row with three tables: workspaces (rev + small meta blob), kages (identity +
-- head pointer) and kage_versions (the immutable, signed version log — where
-- the documents actually live). Wins:
--   * writes send deltas (new versions + meta), not the whole workspace;
--   * public /k/<uuid> and /r/<uuid> reads are indexed lookups, not snapshot scans;
--   * CAS stays workspace-level (rev column) so the store's semantics are unchanged.
-- All load/save/lookup logic lives in SQL functions so the plain-Postgres and
-- Supabase REST (PostgREST rpc) backends share one implementation.
-- kages_state and public_shares remain as legacy rollback copies; drop them in a
-- later migration once the new model has been live for a release.

create table if not exists public.workspaces (
  id          text primary key,
  rev         bigint not null,
  meta        jsonb not null default '{}'::jsonb, -- snapshot minus kages: grants, keys, audit, events, comments, gallery, …
  updated_at  timestamptz not null default now()
);

create table if not exists public.kages (
  workspace_id  text not null references public.workspaces(id) on delete cascade,
  name          text not null,
  head_seq      bigint not null,
  primary key (workspace_id, name)
);

create table if not exists public.kage_versions (
  workspace_id  text not null,
  name          text not null,
  seq           bigint not null,
  uuid          text,            -- extracted for the public-link index; may be null on pre-uuid legacy versions
  state         text,
  visibility    text,
  record        jsonb not null,  -- the full signed VersionRecord
  created_at    timestamptz not null default now(),
  primary key (workspace_id, name, seq),
  foreign key (workspace_id, name) references public.kages(workspace_id, name) on delete cascade
);

create index if not exists kage_versions_uuid_idx on public.kage_versions (uuid);
-- Gallery discovery and repo-share lookup filter on meta containment.
create index if not exists workspaces_meta_idx on public.workspaces using gin (meta jsonb_path_ops);

-- Service-role only, same posture as kages_state: RLS on, no policies.
alter table public.workspaces enable row level security;
alter table public.kages enable row level security;
alter table public.kage_versions enable row level security;

-- The whole workspace as the store's snapshot shape, or null when absent.
create or replace function public.kages_load(p_ws text) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'rev', w.rev,
    'meta', w.meta,
    'kages', coalesce((
      select jsonb_agg(jsonb_build_object('name', g.name, 'versions', g.versions) order by g.name)
      from (
        select v.name, jsonb_agg(v.record order by v.seq) as versions
        from public.kage_versions v
        where v.workspace_id = p_ws
        group by v.name
      ) g), '[]'::jsonb))
  from public.workspaces w where w.id = p_ws
$$;

-- Compare-and-swap delta write. p_expected_rev null means "insert a new
-- workspace" (loses if one exists). p_upserts: [{name, base, versions}] — for
-- each kage, delete stored versions with seq >= base and append `versions`
-- from there (base = count of untouched prefix versions; append-only writes
-- send only the new tail). p_replace true means p_upserts is the complete
-- kage list: anything else is deleted (used when the caller has no baseline).
-- Returns false on a revision conflict; the caller reloads and retries. The
-- row update under CAS locks the workspace row, serializing the delta writes.
create or replace function public.kages_save(
  p_ws text, p_expected_rev bigint, p_meta jsonb, p_upserts jsonb, p_deletions jsonb, p_replace boolean
) returns boolean language plpgsql as $$
declare u jsonb;
begin
  if p_expected_rev is null then
    insert into public.workspaces (id, rev, meta) values (p_ws, 1, p_meta) on conflict (id) do nothing;
    if not found then return false; end if;
  else
    update public.workspaces set rev = p_expected_rev + 1, meta = p_meta, updated_at = now()
      where id = p_ws and rev = p_expected_rev;
    if not found then return false; end if;
  end if;
  if p_replace then
    delete from public.kages where workspace_id = p_ws
      and name not in (select x->>'name' from jsonb_array_elements(p_upserts) x);
  elsif jsonb_array_length(p_deletions) > 0 then
    delete from public.kages where workspace_id = p_ws
      and name in (select jsonb_array_elements_text(p_deletions));
  end if;
  for u in select * from jsonb_array_elements(p_upserts) loop
    insert into public.kages (workspace_id, name, head_seq)
      values (p_ws, u->>'name', (u->>'base')::bigint + jsonb_array_length(u->'versions') - 1)
      on conflict (workspace_id, name) do update set head_seq = excluded.head_seq;
    delete from public.kage_versions
      where workspace_id = p_ws and name = u->>'name' and seq >= (u->>'base')::bigint;
    insert into public.kage_versions (workspace_id, name, seq, uuid, state, visibility, record)
      select p_ws, u->>'name', (u->>'base')::bigint + t.ord - 1,
             t.r->>'uuid', t.r->>'state', t.r->>'visibility', t.r
      from jsonb_array_elements(u->'versions') with ordinality t(r, ord);
  end loop;
  return true;
end $$;

-- The committed head serving a /k/<uuid> link: published and link/public only.
-- The caller re-checks state and visibility; this filter selects, never authorizes alone.
create or replace function public.kages_public_head(p_uuid text) returns jsonb
language sql stable as $$
  select jsonb_build_object('workspace', v.workspace_id, 'record', v.record)
  from public.kage_versions v
  join public.kages k on k.workspace_id = v.workspace_id and k.name = v.name and k.head_seq = v.seq
  where v.uuid = p_uuid
    and v.record->>'state' = 'published'
    and v.record->>'visibility' in ('link', 'public')
  limit 1
$$;

-- Rows backing a /r/<uuid> project link: the owning workspace's repoShares plus
-- trimmed heads (only the fields the listing needs leave the database).
create or replace function public.kages_repo_rows(p_uuid text) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'shares', w.meta->'repoShares',
    'heads', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'uuid', v.record->'uuid', 'ref', v.record->'ref', 'state', v.record->'state',
        'visibility', v.record->'visibility', 'title', v.record->'doc'->'title',
        'system', v.record->'doc'->'system', 'mode', v.record->'doc'->'brief'->'mode')), '[]'::jsonb)
      from public.kage_versions v
      join public.kages k on k.workspace_id = v.workspace_id and k.name = v.name and k.head_seq = v.seq
      where v.workspace_id = w.id))), '[]'::jsonb)
  from public.workspaces w
  where w.meta @> jsonb_build_object('repoShares', jsonb_build_array(jsonb_build_object('uuid', p_uuid)))
$$;

-- One-shot backfill from the legacy blob. Idempotent: existing rows win.
insert into public.workspaces (id, rev, meta, updated_at)
select id, coalesce((snapshot->>'_rev')::bigint, 0), (snapshot - 'kages' - '_rev'), coalesce(updated_at, now())
from public.kages_state
on conflict (id) do nothing;

insert into public.kages (workspace_id, name, head_seq)
select s.id, k->>'name', jsonb_array_length(k->'versions') - 1
from public.kages_state s, jsonb_array_elements(s.snapshot->'kages') k
where jsonb_array_length(k->'versions') > 0
on conflict (workspace_id, name) do nothing;

insert into public.kage_versions (workspace_id, name, seq, uuid, state, visibility, record)
select s.id, k->>'name', t.ord - 1, t.r->>'uuid', t.r->>'state', t.r->>'visibility', t.r
from public.kages_state s,
     jsonb_array_elements(s.snapshot->'kages') k,
     jsonb_array_elements(k->'versions') with ordinality t(r, ord)
on conflict (workspace_id, name, seq) do nothing;

-- Supabase: make PostgREST pick up the new rpc functions without a restart.
notify pgrst, 'reload schema';
