-- Public links authorize against committed heads, using the UUID containment filter.
create index if not exists kages_state_snapshot_path_idx
  on public.kages_state using gin (snapshot jsonb_path_ops);
