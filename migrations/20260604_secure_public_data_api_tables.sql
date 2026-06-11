-- Remediate Supabase Security Advisor findings for public-schema tables.
-- Public hockey/stat tables remain browser-readable, but browser roles can no
-- longer insert, update, delete, or truncate rows. Sensitive Yahoo credentials
-- are removed from browser-facing API access entirely.

DO $$
DECLARE
  table_name TEXT;
  public_read_tables TEXT[] := ARRAY[
    'forge_goalie_game',
    'forge_goalie_projections',
    'forge_player_game_strength',
    'forge_player_projections',
    'forge_projection_accuracy_daily',
    'forge_projection_accuracy_player',
    'forge_projection_accuracy_stat_daily',
    'forge_projection_calibration_daily',
    'forge_projection_results',
    'forge_roster_events',
    'forge_runs',
    'forge_team_game_strength',
    'forge_team_projections',
    'goalie_underlying_summary_partitions',
    'nhl_api_game_payloads_raw',
    'nhl_api_game_roster_spots',
    'nhl_api_pbp_events',
    'nhl_api_shift_rows',
    'nhl_xg_goalie_game_aggregates',
    'nhl_xg_goalie_rolling_aggregates',
    'nhl_xg_player_created_xg_game_aggregates',
    'nhl_xg_player_created_xg_rolling_aggregates',
    'nhl_xg_player_game_aggregates',
    'nhl_xg_player_rolling_aggregates',
    'nhl_xg_rebound_control_goalie_game_aggregates',
    'nhl_xg_rebound_control_player_game_aggregates',
    'nhl_xg_rebound_control_team_game_aggregates',
    'nhl_xg_shot_assist_candidates',
    'nhl_xg_team_game_aggregates',
    'nhl_xg_team_rolling_aggregates',
    'nhl_xg_transition_events',
    'nhl_xg_transition_game_aggregates',
    'nst_gamelog_es_rates',
    'nst_gamelog_es_rates_oi',
    'nst_gamelog_goalie_5v5_counts',
    'nst_gamelog_goalie_5v5_rates',
    'nst_gamelog_goalie_all_counts',
    'nst_gamelog_goalie_all_rates',
    'nst_gamelog_goalie_ev_counts',
    'nst_gamelog_goalie_ev_rates',
    'nst_gamelog_goalie_pk_counts',
    'nst_gamelog_goalie_pk_rates',
    'nst_gamelog_goalie_pp_counts',
    'nst_gamelog_goalie_pp_rates',
    'nst_gamelog_pk_counts',
    'nst_gamelog_pk_counts_oi',
    'nst_gamelog_pk_rates',
    'nst_gamelog_pk_rates_oi',
    'nst_gamelog_pp_counts',
    'nst_gamelog_pp_counts_oi',
    'nst_gamelog_pp_rates',
    'nst_gamelog_pp_rates_oi',
    'nst_percentile_as_defense',
    'nst_percentile_as_defense_filtered',
    'nst_percentile_as_offense',
    'nst_seasonal_individual_counts',
    'nst_seasonal_individual_rates',
    'nst_seasonal_on_ice_counts',
    'nst_seasonal_on_ice_rates',
    'nst_team_5v5',
    'nst_team_all',
    'nst_team_gamelogs_as_counts',
    'nst_team_gamelogs_as_rates',
    'nst_team_gamelogs_es_counts',
    'nst_team_gamelogs_es_rates',
    'nst_team_gamelogs_pk_counts',
    'nst_team_gamelogs_pk_rates',
    'nst_team_gamelogs_pp_counts',
    'nst_team_gamelogs_pp_rates',
    'nst_team_pk',
    'nst_team_pp',
    'nst_team_stats',
    'nst_team_stats_ly',
    'pbp_games',
    'player_priors_cache',
    'player_status_history',
    'player_trend_metrics',
    'power_rankings_store',
    'pp_timeframes',
    'raw_standings_sos',
    'rolling_games',
    'rolling_player_game_metrics',
    'shift_charts',
    'shots_goals_by_coord',
    'sko_pp_stats',
    'sko_skater_stats',
    'sko_skater_years',
    'sko_trends',
    'sos_games',
    'sos_standings',
    'standings',
    'sustainability_player_priors',
    'sustainability_priors',
    'sustainability_projections',
    'sustainability_scores',
    'sustainability_trend_bands',
    'sustainability_window_z',
    'team_abbrev_xwalk',
    'team_ctpi_daily',
    'team_discipline_stats',
    'team_franchise_alias',
    'team_power_ratings_daily__new',
    'team_summary_years',
    'team_underlying_stats_summary',
    'teamsinfo',
    'wgo_avg_career',
    'wgo_avg_three_year',
    'wgo_career_averages',
    'wgo_goalie_stats',
    'wgo_goalie_stats_totals',
    'wgo_skater_stats',
    'wgo_skater_stats_playoffs',
    'wgo_skater_stats_totals',
    'wgo_skater_stats_totals_ly',
    'wgo_skater_stats_totals_playoffs',
    'wgo_team_stats',
    'wgo_teams',
    'wgo_three_year_averages',
    'wigo_career',
    'wigo_counts',
    'wigo_per_game',
    'wigo_rates',
    'wigo_recent',
    'xfs_audit_log',
    'xfs_predictions_10_game',
    'xfs_predictions_5_game',
    'yahoo_game_keys',
    'yahoo_matchup_weeks',
    'yahoo_names',
    'yahoo_nhl_player_map',
    'yahoo_nhl_player_map_unmatched',
    'yahoo_player_draft_analysis_history',
    'yahoo_player_keys',
    'yahoo_player_ownership_daily',
    'yahoo_player_ownership_history'
  ];
BEGIN
  FOREACH table_name IN ARRAY public_read_tables LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM anon, authenticated',
      table_name
    );
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', table_name);

    EXECUTE format('DROP POLICY IF EXISTS "public_read" ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY "public_read" ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      table_name
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Allow read access to wgo_skater_stats_playoffs"
ON public.wgo_skater_stats_playoffs;

ALTER TABLE IF EXISTS public.yahoo_api_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.yahoo_api_credentials FROM anon, authenticated;

DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'public.yahoo_api_credentials'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.yahoo_api_credentials', policy_name);
  END LOOP;
END $$;

