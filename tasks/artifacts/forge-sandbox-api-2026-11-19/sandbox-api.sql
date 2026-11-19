-- Runs inside the sandbox bootstrap as forge_sandbox_owner, after the private schemas are built.

-- Supabase's service_role and postgres bypass RLS. The owner, whose views and SECURITY DEFINER wrappers serve the API,
-- gets that effect only inside the sandbox: one permissive policy per RLS table there.
do $policies$ declare t record; begin
  for t in select n.nspname, c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relrowsecurity and c.relkind in ('r', 'p') and n.nspname like 'forge\_sandbox%' loop
    execute format('create policy forge_sandbox_owner_scope on %I.%I as permissive for all to forge_sandbox_owner using (true) with check (true)',
      t.nspname, t.relname);
  end loop;
end $policies$;

-- The exposed surface. Views carry the capture transport's relation names (CAPTURE_RELATIONS in
-- web/lib/projections/pregameCapture/transport.ts) for each table the fixture has.
do $views$ declare r text; begin
  foreach r in array array['games', 'teams', 'players', 'rosters', 'seasons', 'fhfh_player_identities', 'roster_optimizer_team_games',
    'skatersGameStats', 'goaliesGameStats', 'wgo_skater_stats', 'wgo_goalie_stats', 'wgo_team_stats', 'pbp_games', 'pbp_plays',
    'shift_charts', 'nhl_api_shift_rows', 'lineCombinations', 'expected_goals', 'forge_goalie_game', 'forge_team_game_strength',
    'rolling_player_game_metrics', 'rolling_player_metric_support_payloads', 'player_stats_unified', 'sustainability_trend_bands',
    'nst_team_all', 'nst_team_stats', 'nhl_team_data', 'nhl_xg_team_rolling_aggregates', 'goalie_start_projections',
    'forge_roster_events', 'forge_board_news_events', 'player_forecast_lineup_snapshots', 'player_forecast_goalie_start_observations',
    'player_forecast_observation_conflicts', 'player_forecast_lineup_assignments', 'player_forecast_conflict_resolutions',
    'market_prices_daily', 'prop_market_prices_daily', 'nhl_xg_model_registry'] loop
    if to_regclass(format('forge_sandbox.%I', r)) is not null then
      execute format('create view forge_sandbox_api.%I with (security_barrier) as select * from forge_sandbox.%I', r, r);
    end if;
  end loop;
end $views$;

-- SECURITY DEFINER wrappers with the RPC names the capture and the route call. Each keeps its source's arguments,
-- result and volatility (so the three native-input functions stay GET-callable) and calls only that sandbox function.
do $wrappers$ declare w record; p pg_catalog.pg_proc; call_args text; i int; arg_names text[]; arg_modes text[]; begin
  for w in select * from (values
      ('forge_sandbox', 'forge_pregame_capture_claim_v1', 'forge_pregame_capture_claim_v1'),
      ('forge_sandbox', 'forge_pregame_capture_save_v1', 'forge_pregame_capture_save_v1'),
      ('forge_sandbox', 'forge_pregame_capture_settle_v1', 'forge_pregame_capture_settle_v1'),
      ('forge_sandbox', 'forge_pregame_capture_read_v1', 'forge_pregame_capture_read_v1'),
      ('forge_sandbox', 'forge_pregame_capture_lookup_v1', 'forge_pregame_capture_lookup_v1'),
      ('forge_sandbox', 'forge_pregame_capture_record_witness_v1', 'forge_pregame_capture_record_witness_v1'),
      ('forge_sandbox', 'forge_pregame_capture_record_outcome_v1', 'forge_pregame_capture_record_outcome_v1'),
      ('forge_sandbox', 'forge_latest_rolling_rows', 'forge_latest_rolling_rows'),
      ('forge_sandbox', 'forge_league_skater_physical_totals', 'forge_league_skater_physical_totals'),
      ('forge_sandbox', 'forge_latest_trend_bands', 'forge_latest_trend_bands'),
      ('forge_sandbox', 'forge_sandbox_run_begin_v1', 'forge_sandbox_run_begin_v1'),
      ('forge_sandbox', 'forge_sandbox_run_finish_v1', 'forge_sandbox_run_finish_v1'),
      ('forge_sandbox_capture', 'sandbox_receipt_v1', 'forge_sandbox_receipt_v1')) v(nsp, fn, api) loop
    select pr.* into strict p from pg_catalog.pg_proc pr where pr.pronamespace = w.nsp::regnamespace and pr.proname = w.fn;
    arg_names := p.proargnames; arg_modes := p.proargmodes::text[]; call_args := '';
    for i in 1 .. coalesce(array_length(arg_names, 1), 0) loop
      if arg_modes is null or arg_modes[i] in ('i', 'b') then
        call_args := call_args || case when call_args = '' then '' else ', ' end || format('%1$I => %1$I', arg_names[i]);
      end if;
    end loop;
    execute format($f$create function forge_sandbox_api.%I(%s) returns %s language sql %s security definer set search_path = '' as %L$f$,
      w.api, pg_catalog.pg_get_function_arguments(p.oid), pg_catalog.pg_get_function_result(p.oid),
      case p.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end,
      case when p.proretset then format('select * from %I.%I(%s)', w.nsp, w.fn, call_args)
           else format('select %I.%I(%s)', w.nsp, w.fn, call_args) end);
  end loop;
end $wrappers$;
