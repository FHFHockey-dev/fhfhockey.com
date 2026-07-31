-- Postdeploy-only Yahoo reader cutover. Apply this migration only after the
-- security-invoker replacement readers have passed populated Production parity.

do $guard$
begin
  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'yahoo_nhl_player_map_mat'
      and relation.relkind = 'm'
  ) then
    raise exception using
      errcode = '42P01',
      message = 'Legacy Yahoo mapping cache is absent.';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'yahoo_nhl_player_map_read',
        'yahoo_players_with_normalized_history'
      )
      and relation.relkind = 'v'
      and relation.reloptions @> array['security_invoker=true']
  ) <> 2 then
    raise exception using
      errcode = '55000',
      message = 'Canonical Yahoo security-invoker readers are not ready.';
  end if;

  if not pg_catalog.has_table_privilege(
    'anon',
    'public.yahoo_nhl_player_map_read',
    'select'
  ) or not pg_catalog.has_table_privilege(
    'authenticated',
    'public.yahoo_nhl_player_map_read',
    'select'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Canonical Yahoo mapping reader is not browser-readable.';
  end if;
end
$guard$;

revoke all on table public.yahoo_nhl_player_map_mat
  from public, anon, authenticated;

grant select on table public.yahoo_nhl_player_map_mat
  to service_role;

comment on materialized view public.yahoo_nhl_player_map_mat is
  'Legacy service-only Yahoo mapping cache retained temporarily after browser cutover to yahoo_nhl_player_map_read.';
