-- Public views must honor the caller's underlying table permissions and RLS.
do $$
declare
  view_name text;
begin
  for view_name in
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
  loop
    execute format(
      'alter view public.%I set (security_invoker = true)',
      view_name
    );
  end loop;
end
$$;

-- These catalog views are administrative surfaces, not browser APIs.
revoke all on table
  public.admin__column_catalog,
  public.admin__table_profile,
  public.admin__table_summary
from public, anon, authenticated, service_role;

grant select on table
  public.admin__column_catalog,
  public.admin__table_profile,
  public.admin__table_summary
to service_role;

-- Snapshot and intermediate materialized views have no browser consumers.
revoke all on table
  public.goalie_stats_unified_snapshot,
  public.goalie_totals_unified_snapshot,
  public.mv_team_stats_nst_wgo,
  public.player_gamelogs_unified
from public, anon, authenticated;

-- Freeze routine name resolution without changing the existing public/extension
-- lookup order. pg_temp is last so temporary objects cannot shadow trusted ones.
do $$
declare
  function_oid oid;
begin
  for function_oid in
    select p.oid
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'acquire_lock',
        'delete_duplicate_players_in_rosters',
        'execute_sql',
        'get_aggregated_player_stats',
        'get_skater_game_scores_for_season',
        'get_skaters_avg_stats',
        'get_skaters_info_by_game_id',
        'get_unprocessed_line_combinations',
        'insert_into_statsupdatestatus',
        'prevent_nhl_api_game_payloads_raw_mutation',
        'process_team_goalie_projections',
        'refresh_team_power_ratings',
        'rpc_sko_player_series',
        'safe_z',
        'set_contextual_snapshot_updated_at',
        'touch_updated_at',
        'trg_touch_updated_at',
        'update_team_discipline_stats',
        'update_updated_at_column',
        'upsert_current_roster_membership',
        'upsert_players_batch',
        'upsert_yahoo_players_v3'
      ])
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) setting
        where setting like 'search_path=%'
      )
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, public, extensions, pg_temp',
      function_oid::regprocedure
    );
  end loop;
end
$$;
