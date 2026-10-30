-- The whole workspace with only each Kage's latest version: kages_load's shape, for
-- reads that never look at history, so their cost stops growing with it.
create or replace function public.kages_load_heads(p_ws text) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'rev', w.rev,
    'meta', w.meta,
    'kages', coalesce((
      select jsonb_agg(jsonb_build_object('name', h.name, 'versions', jsonb_build_array(h.record)) order by h.name)
      from (
        select distinct on (v.name) v.name, v.record
        from public.kage_versions v
        where v.workspace_id = p_ws
        order by v.name, v.seq desc
      ) h), '[]'::jsonb))
  from public.workspaces w where w.id = p_ws
$$;
