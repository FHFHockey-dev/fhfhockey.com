-- Read-only production definition captured 2026-10-02; regression fixture only.
CREATE VIEW public.vw_goalie_stats_unified WITH (security_invoker=true) AS
WITH nst_supported_seasons AS (
         SELECT DISTINCT s.season
           FROM ( SELECT nst_gamelog_goalie_5v5_counts.season
                   FROM nst_gamelog_goalie_5v5_counts
                UNION
                 SELECT nst_gamelog_goalie_5v5_rates.season
                   FROM nst_gamelog_goalie_5v5_rates
                UNION
                 SELECT nst_gamelog_goalie_all_counts.season
                   FROM nst_gamelog_goalie_all_counts
                UNION
                 SELECT nst_gamelog_goalie_all_rates.season
                   FROM nst_gamelog_goalie_all_rates
                UNION
                 SELECT nst_gamelog_goalie_ev_counts.season
                   FROM nst_gamelog_goalie_ev_counts
                UNION
                 SELECT nst_gamelog_goalie_ev_rates.season
                   FROM nst_gamelog_goalie_ev_rates
                UNION
                 SELECT nst_gamelog_goalie_pk_counts.season
                   FROM nst_gamelog_goalie_pk_counts
                UNION
                 SELECT nst_gamelog_goalie_pk_rates.season
                   FROM nst_gamelog_goalie_pk_rates
                UNION
                 SELECT nst_gamelog_goalie_pp_counts.season
                   FROM nst_gamelog_goalie_pp_counts
                UNION
                 SELECT nst_gamelog_goalie_pp_rates.season
                   FROM nst_gamelog_goalie_pp_rates) s
          WHERE s.season IS NOT NULL
        )
 SELECT src.assists,
    src.complete_game_pct,
    src.complete_games,
    src.date,
    src.games_played,
    src.games_played_days_rest_0,
    src.games_played_days_rest_1,
    src.games_played_days_rest_2,
    src.games_played_days_rest_3,
    src.games_played_days_rest_4_plus,
    src.games_started,
    src.goals,
    src.goals_against,
    src.goals_against_avg,
    src.has_nst_5v5_counts,
    src.has_nst_5v5_rates,
    src.has_nst_all_counts,
    src.has_nst_all_rates,
    src.has_nst_ev_counts,
    src.has_nst_ev_rates,
    src.has_nst_pk_counts,
    src.has_nst_pk_rates,
    src.has_nst_pp_counts,
    src.has_nst_pp_rates,
    src.incomplete_games,
    src.losses,
    src.nst_5v5_counts_avg_goal_distance,
    src.nst_5v5_counts_avg_shot_distance,
    src.nst_5v5_counts_gaa,
    src.nst_5v5_counts_goals_against,
    src.nst_5v5_counts_gsaa,
    src.nst_5v5_counts_hd_gaa,
    src.nst_5v5_counts_hd_gsaa,
    src.nst_5v5_counts_hd_saves,
    src.nst_5v5_counts_hd_shots_against,
    src.nst_5v5_counts_hd_sv_percentage,
    src.nst_5v5_counts_ld_gaa,
    src.nst_5v5_counts_ld_gsaa,
    src.nst_5v5_counts_ld_shots_against,
    src.nst_5v5_counts_ld_sv_percentage,
    src.nst_5v5_counts_md_gaa,
    src.nst_5v5_counts_md_goals_against,
    src.nst_5v5_counts_md_gsaa,
    src.nst_5v5_counts_md_saves,
    src.nst_5v5_counts_md_shots_against,
    src.nst_5v5_counts_md_sv_percentage,
    src.nst_5v5_counts_rebound_attempts_against,
    src.nst_5v5_counts_rush_attempts_against,
    src.nst_5v5_counts_saves,
    src.nst_5v5_counts_shots_against,
    src.nst_5v5_counts_sv_percentage,
    src.nst_5v5_counts_toi,
    src.nst_5v5_counts_xg_against,
    src.nst_5v5_rates_gaa,
    src.nst_5v5_rates_gsaa_per_60,
    src.nst_5v5_rates_hd_gaa,
    src.nst_5v5_rates_hd_gsaa_per_60,
    src.nst_5v5_rates_hd_saves_per_60,
    src.nst_5v5_rates_hd_shots_against_per_60,
    src.nst_5v5_rates_hd_sv_percentage,
    src.nst_5v5_rates_ld_gaa,
    src.nst_5v5_rates_ld_gsaa_per_60,
    src.nst_5v5_rates_ld_saves_per_60,
    src.nst_5v5_rates_ld_shots_against_per_60,
    src.nst_5v5_rates_ld_sv_percentage,
    src.nst_5v5_rates_md_gaa,
    src.nst_5v5_rates_md_gsaa_per_60,
    src.nst_5v5_rates_md_saves_per_60,
    src.nst_5v5_rates_md_shots_against_per_60,
    src.nst_5v5_rates_md_sv_percentage,
    src.nst_5v5_rates_rebound_attempts_against_per_60,
    src.nst_5v5_rates_rush_attempts_against_per_60,
    src.nst_5v5_rates_saves_per_60,
    src.nst_5v5_rates_shots_against_per_60,
    src.nst_5v5_rates_sv_percentage,
    src.nst_5v5_rates_xg_against_per_60,
    src.nst_all_counts_avg_goal_distance,
    src.nst_all_counts_avg_shot_distance,
    src.nst_all_counts_gaa,
    src.nst_all_counts_goals_against,
    src.nst_all_counts_gsaa,
    src.nst_all_counts_hd_gaa,
    src.nst_all_counts_hd_gsaa,
    src.nst_all_counts_hd_saves,
    src.nst_all_counts_hd_shots_against,
    src.nst_all_counts_hd_sv_percentage,
    src.nst_all_counts_ld_gaa,
    src.nst_all_counts_ld_gsaa,
    src.nst_all_counts_ld_shots_against,
    src.nst_all_counts_ld_sv_percentage,
    src.nst_all_counts_md_gaa,
    src.nst_all_counts_md_goals_against,
    src.nst_all_counts_md_gsaa,
    src.nst_all_counts_md_saves,
    src.nst_all_counts_md_shots_against,
    src.nst_all_counts_md_sv_percentage,
    src.nst_all_counts_rebound_attempts_against,
    src.nst_all_counts_rush_attempts_against,
    src.nst_all_counts_saves,
    src.nst_all_counts_shots_against,
    src.nst_all_counts_sv_percentage,
    src.nst_all_counts_toi,
    src.nst_all_counts_xg_against,
    src.nst_all_rates_gaa,
    src.nst_all_rates_gsaa_per_60,
    src.nst_all_rates_hd_gaa,
    src.nst_all_rates_hd_gsaa_per_60,
    src.nst_all_rates_hd_saves_per_60,
    src.nst_all_rates_hd_shots_against_per_60,
    src.nst_all_rates_hd_sv_percentage,
    src.nst_all_rates_ld_gaa,
    src.nst_all_rates_ld_gsaa_per_60,
    src.nst_all_rates_ld_saves_per_60,
    src.nst_all_rates_ld_shots_against_per_60,
    src.nst_all_rates_ld_sv_percentage,
    src.nst_all_rates_md_gaa,
    src.nst_all_rates_md_gsaa_per_60,
    src.nst_all_rates_md_saves_per_60,
    src.nst_all_rates_md_shots_against_per_60,
    src.nst_all_rates_md_sv_percentage,
    src.nst_all_rates_rebound_attempts_against_per_60,
    src.nst_all_rates_rush_attempts_against_per_60,
    src.nst_all_rates_saves_per_60,
    src.nst_all_rates_shots_against_per_60,
    src.nst_all_rates_sv_percentage,
    src.nst_all_rates_xg_against_per_60,
    src.nst_ev_counts_avg_goal_distance,
    src.nst_ev_counts_avg_shot_distance,
    src.nst_ev_counts_gaa,
    src.nst_ev_counts_goals_against,
    src.nst_ev_counts_gsaa,
    src.nst_ev_counts_hd_gaa,
    src.nst_ev_counts_hd_gsaa,
    src.nst_ev_counts_hd_saves,
    src.nst_ev_counts_hd_shots_against,
    src.nst_ev_counts_hd_sv_percentage,
    src.nst_ev_counts_ld_gaa,
    src.nst_ev_counts_ld_gsaa,
    src.nst_ev_counts_ld_shots_against,
    src.nst_ev_counts_ld_sv_percentage,
    src.nst_ev_counts_md_gaa,
    src.nst_ev_counts_md_goals_against,
    src.nst_ev_counts_md_gsaa,
    src.nst_ev_counts_md_saves,
    src.nst_ev_counts_md_shots_against,
    src.nst_ev_counts_md_sv_percentage,
    src.nst_ev_counts_rebound_attempts_against,
    src.nst_ev_counts_rush_attempts_against,
    src.nst_ev_counts_saves,
    src.nst_ev_counts_shots_against,
    src.nst_ev_counts_sv_percentage,
    src.nst_ev_counts_toi,
    src.nst_ev_counts_xg_against,
    src.nst_ev_rates_gaa,
    src.nst_ev_rates_gsaa_per_60,
    src.nst_ev_rates_hd_gaa,
    src.nst_ev_rates_hd_gsaa_per_60,
    src.nst_ev_rates_hd_saves_per_60,
    src.nst_ev_rates_hd_shots_against_per_60,
    src.nst_ev_rates_hd_sv_percentage,
    src.nst_ev_rates_ld_gaa,
    src.nst_ev_rates_ld_gsaa_per_60,
    src.nst_ev_rates_ld_saves_per_60,
    src.nst_ev_rates_ld_shots_against_per_60,
    src.nst_ev_rates_ld_sv_percentage,
    src.nst_ev_rates_md_gaa,
    src.nst_ev_rates_md_gsaa_per_60,
    src.nst_ev_rates_md_saves_per_60,
    src.nst_ev_rates_md_shots_against_per_60,
    src.nst_ev_rates_md_sv_percentage,
    src.nst_ev_rates_rebound_attempts_against_per_60,
    src.nst_ev_rates_rush_attempts_against_per_60,
    src.nst_ev_rates_saves_per_60,
    src.nst_ev_rates_shots_against_per_60,
    src.nst_ev_rates_sv_percentage,
    src.nst_ev_rates_xg_against_per_60,
    src.nst_pk_counts_avg_goal_distance,
    src.nst_pk_counts_avg_shot_distance,
    src.nst_pk_counts_gaa,
    src.nst_pk_counts_goals_against,
    src.nst_pk_counts_gsaa,
    src.nst_pk_counts_hd_gaa,
    src.nst_pk_counts_hd_gsaa,
    src.nst_pk_counts_hd_saves,
    src.nst_pk_counts_hd_shots_against,
    src.nst_pk_counts_hd_sv_percentage,
    src.nst_pk_counts_ld_gaa,
    src.nst_pk_counts_ld_gsaa,
    src.nst_pk_counts_ld_shots_against,
    src.nst_pk_counts_ld_sv_percentage,
    src.nst_pk_counts_md_gaa,
    src.nst_pk_counts_md_goals_against,
    src.nst_pk_counts_md_gsaa,
    src.nst_pk_counts_md_saves,
    src.nst_pk_counts_md_shots_against,
    src.nst_pk_counts_md_sv_percentage,
    src.nst_pk_counts_rebound_attempts_against,
    src.nst_pk_counts_rush_attempts_against,
    src.nst_pk_counts_saves,
    src.nst_pk_counts_shots_against,
    src.nst_pk_counts_sv_percentage,
    src.nst_pk_counts_toi,
    src.nst_pk_counts_xg_against,
    src.nst_pk_rates_gaa,
    src.nst_pk_rates_gsaa_per_60,
    src.nst_pk_rates_hd_gaa,
    src.nst_pk_rates_hd_gsaa_per_60,
    src.nst_pk_rates_hd_saves_per_60,
    src.nst_pk_rates_hd_shots_against_per_60,
    src.nst_pk_rates_hd_sv_percentage,
    src.nst_pk_rates_ld_gaa,
    src.nst_pk_rates_ld_gsaa_per_60,
    src.nst_pk_rates_ld_saves_per_60,
    src.nst_pk_rates_ld_shots_against_per_60,
    src.nst_pk_rates_ld_sv_percentage,
    src.nst_pk_rates_md_gaa,
    src.nst_pk_rates_md_gsaa_per_60,
    src.nst_pk_rates_md_saves_per_60,
    src.nst_pk_rates_md_shots_against_per_60,
    src.nst_pk_rates_md_sv_percentage,
    src.nst_pk_rates_rebound_attempts_against_per_60,
    src.nst_pk_rates_rush_attempts_against_per_60,
    src.nst_pk_rates_saves_per_60,
    src.nst_pk_rates_shots_against_per_60,
    src.nst_pk_rates_sv_percentage,
    src.nst_pk_rates_xg_against_per_60,
    src.nst_pp_counts_avg_goal_distance,
    src.nst_pp_counts_avg_shot_distance,
    src.nst_pp_counts_gaa,
    src.nst_pp_counts_goals_against,
    src.nst_pp_counts_gsaa,
    src.nst_pp_counts_hd_gaa,
    src.nst_pp_counts_hd_gsaa,
    src.nst_pp_counts_hd_saves,
    src.nst_pp_counts_hd_shots_against,
    src.nst_pp_counts_hd_sv_percentage,
    src.nst_pp_counts_ld_gaa,
    src.nst_pp_counts_ld_gsaa,
    src.nst_pp_counts_ld_shots_against,
    src.nst_pp_counts_ld_sv_percentage,
    src.nst_pp_counts_md_gaa,
    src.nst_pp_counts_md_goals_against,
    src.nst_pp_counts_md_gsaa,
    src.nst_pp_counts_md_saves,
    src.nst_pp_counts_md_shots_against,
    src.nst_pp_counts_md_sv_percentage,
    src.nst_pp_counts_rebound_attempts_against,
    src.nst_pp_counts_rush_attempts_against,
    src.nst_pp_counts_saves,
    src.nst_pp_counts_shots_against,
    src.nst_pp_counts_sv_percentage,
    src.nst_pp_counts_toi,
    src.nst_pp_counts_xg_against,
    src.nst_pp_rates_gaa,
    src.nst_pp_rates_gsaa_per_60,
    src.nst_pp_rates_hd_gaa,
    src.nst_pp_rates_hd_gsaa_per_60,
    src.nst_pp_rates_hd_saves_per_60,
    src.nst_pp_rates_hd_shots_against_per_60,
    src.nst_pp_rates_hd_sv_percentage,
    src.nst_pp_rates_ld_gaa,
    src.nst_pp_rates_ld_gsaa_per_60,
    src.nst_pp_rates_ld_saves_per_60,
    src.nst_pp_rates_ld_shots_against_per_60,
    src.nst_pp_rates_ld_sv_percentage,
    src.nst_pp_rates_md_gaa,
    src.nst_pp_rates_md_gsaa_per_60,
    src.nst_pp_rates_md_saves_per_60,
    src.nst_pp_rates_md_shots_against_per_60,
    src.nst_pp_rates_md_sv_percentage,
    src.nst_pp_rates_rebound_attempts_against_per_60,
    src.nst_pp_rates_rush_attempts_against_per_60,
    src.nst_pp_rates_saves_per_60,
    src.nst_pp_rates_shots_against_per_60,
    src.nst_pp_rates_sv_percentage,
    src.nst_pp_rates_xg_against_per_60,
    src.ot_losses,
    src.player_id,
    src.player_name,
    src.position_code,
    src.quality_start,
    src.quality_starts_pct,
    src.regulation_losses,
    src.regulation_wins,
    src.save_pct,
    src.save_pct_days_rest_0,
    src.save_pct_days_rest_1,
    src.save_pct_days_rest_2,
    src.save_pct_days_rest_3,
    src.save_pct_days_rest_4_plus,
    src.saves,
    src.season_id,
    src.shoots_catches,
    src.shots_against,
    src.shots_against_per_60,
    src.shutouts,
    src.time_on_ice,
    src.wins,
    team_map.resolved_team_id AS team_id,
    src.materialized_at AS view_generated_at,
    src.season_id IS NOT NULL AS wgo_has_season_id,
    season_check.nst_supported_season,
    nst_diag.nst_any_match,
        CASE
            WHEN src.season_id IS NULL THEN 'wgo_missing_season'::text
            WHEN season_check.nst_supported_season IS FALSE THEN 'season_outside_nst_coverage'::text
            WHEN nst_diag.nst_any_match IS FALSE THEN 'no_nst_match'::text
            WHEN nst_diag.nst_match_family_count = 10 THEN 'full_nst_match'::text
            ELSE 'partial_nst_match'::text
        END AS nst_match_status,
        CASE
            WHEN tm.id IS NOT NULL AND w.team_abbreviation IS NOT NULL THEN 'wgo_team_abbreviation'::text
            WHEN src.team_id IS NOT NULL THEN 'players_team_id_fallback'::text
            ELSE 'unmapped'::text
        END AS team_id_source
   FROM vw_goalie_stats_unified_source src
     LEFT JOIN wgo_goalie_stats w ON w.goalie_id = src.player_id AND w.date = src.date
     LEFT JOIN teams tm ON tm.abbreviation::text = w.team_abbreviation
     LEFT JOIN LATERAL ( SELECT COALESCE(tm.id, src.team_id) AS resolved_team_id) team_map ON true
     LEFT JOIN LATERAL ( SELECT (EXISTS ( SELECT 1
                   FROM nst_supported_seasons nss
                  WHERE nss.season = src.season_id)) AS nst_supported_season) season_check ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(src.has_nst_5v5_counts, false) OR COALESCE(src.has_nst_5v5_rates, false) OR COALESCE(src.has_nst_all_counts, false) OR COALESCE(src.has_nst_all_rates, false) OR COALESCE(src.has_nst_ev_counts, false) OR COALESCE(src.has_nst_ev_rates, false) OR COALESCE(src.has_nst_pk_counts, false) OR COALESCE(src.has_nst_pk_rates, false) OR COALESCE(src.has_nst_pp_counts, false) OR COALESCE(src.has_nst_pp_rates, false) AS nst_any_match,
                CASE
                    WHEN COALESCE(src.has_nst_5v5_counts, false) THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(src.has_nst_5v5_rates, false) THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(src.has_nst_all_counts, false) THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(src.has_nst_all_rates, false) THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(src.has_nst_ev_counts, false) THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(src.has_nst_ev_rates, false) THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(src.has_nst_pk_counts, false) THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(src.has_nst_pk_rates, false) THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(src.has_nst_pp_counts, false) THEN 1
                    ELSE 0
                END +
                CASE
                    WHEN COALESCE(src.has_nst_pp_rates, false) THEN 1
                    ELSE 0
                END AS nst_match_family_count) nst_diag ON true;
