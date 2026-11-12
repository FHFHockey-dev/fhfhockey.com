-- NOT APPLIED. Math-audit fix lane L4a (W2-1 D12, interim fail-closed; decision 16, rules 5 and 16).
-- Apply only with TJ's pop-up approval, singly, then record schema_migrations and migration-authority.json.
--
-- percent_games divided a player's season GP by his CURRENT team's GP. For a traded player, or a past
-- season played for another team, that denominator is the wrong team. Until a team-of-record-by-date
-- denominator ("games available", decision 16) exists, percent_games is NULL (unknown) whenever the season
-- shows another team:
--   skaters: any wgo_skater_stats game in the season's date range (seasons.startDate..endDate) whose
--            team_abbrev differs from the current team (index wgo_skater_stats (player_id, date));
--   goalies: team_abbrevs lists more than one team.
-- Single-team seasons keep the old value. A skater season with no per-game rows cannot be checked and
-- keeps the old value (known gap). Columns, order and types are unchanged. Readers: PlayerPickupTable
-- GP%, radar (radarSeasonStats.ts, PlayerRadarChart).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

CREATE OR REPLACE VIEW public.wgo_skater_stats_per_game AS
 SELECT s.player_id,
    s.player_name,
    s.season,
    s.shoots_catches,
    s.position_code,
    s.games_played,
    s.current_team_abbreviation,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM (public.wgo_skater_stats w
                 JOIN public.seasons se ON (((se.id)::text = s.season)))
              WHERE ((w.player_id = s.player_id) AND (w.date >= se."startDate") AND (w.date <= se."endDate") AND (w.team_abbrev <> s.current_team_abbreviation)))) THEN NULL::numeric
            ELSE ((s.games_played)::numeric / (NULLIF(ts.games_played, 0))::numeric)
        END AS percent_games,
    ((s.points)::numeric / (NULLIF(s.games_played, 0))::numeric) AS points,
    ((s.goals)::numeric / (NULLIF(s.games_played, 0))::numeric) AS goals,
    ((s.assists)::numeric / (NULLIF(s.games_played, 0))::numeric) AS assists,
    ((s.shots)::numeric / (NULLIF(s.games_played, 0))::numeric) AS shots,
    ((s.ot_goals)::numeric / (NULLIF(s.games_played, 0))::numeric) AS ot_goals,
    ((s.gw_goals)::numeric / (NULLIF(s.games_played, 0))::numeric) AS gw_goals,
    ((s.pp_points)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_points,
    ((s.blocked_shots)::numeric / (NULLIF(s.games_played, 0))::numeric) AS blocked_shots,
    ((s.empty_net_goals)::numeric / (NULLIF(s.games_played, 0))::numeric) AS empty_net_goals,
    ((s.empty_net_points)::numeric / (NULLIF(s.games_played, 0))::numeric) AS empty_net_points,
    ((s.giveaways)::numeric / (NULLIF(s.games_played, 0))::numeric) AS giveaways,
    ((s.hits)::numeric / (NULLIF(s.games_played, 0))::numeric) AS hits,
    ((s.missed_shots)::numeric / (NULLIF(s.games_played, 0))::numeric) AS missed_shots,
    ((s.takeaways)::numeric / (NULLIF(s.games_played, 0))::numeric) AS takeaways,
    ((s.d_zone_faceoffs)::numeric / (NULLIF(s.games_played, 0))::numeric) AS d_zone_faceoffs,
    ((s.ev_faceoffs)::numeric / (NULLIF(s.games_played, 0))::numeric) AS ev_faceoffs,
    ((s.n_zone_faceoffs)::numeric / (NULLIF(s.games_played, 0))::numeric) AS n_zone_faceoffs,
    ((s.o_zone_faceoffs)::numeric / (NULLIF(s.games_played, 0))::numeric) AS o_zone_faceoffs,
    ((s.pp_faceoffs)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_faceoffs,
    ((s.sh_faceoffs)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_faceoffs,
    ((s.total_faceoffs)::numeric / (NULLIF(s.games_played, 0))::numeric) AS total_faceoffs,
    ((s.d_zone_fol)::numeric / (NULLIF(s.games_played, 0))::numeric) AS d_zone_fol,
    ((s.d_zone_fow)::numeric / (NULLIF(s.games_played, 0))::numeric) AS d_zone_fow,
    ((s.ev_fol)::numeric / (NULLIF(s.games_played, 0))::numeric) AS ev_fol,
    ((s.ev_fow)::numeric / (NULLIF(s.games_played, 0))::numeric) AS ev_fow,
    ((s.n_zone_fol)::numeric / (NULLIF(s.games_played, 0))::numeric) AS n_zone_fol,
    ((s.n_zone_fow)::numeric / (NULLIF(s.games_played, 0))::numeric) AS n_zone_fow,
    ((s.o_zone_fol)::numeric / (NULLIF(s.games_played, 0))::numeric) AS o_zone_fol,
    ((s.o_zone_fow)::numeric / (NULLIF(s.games_played, 0))::numeric) AS o_zone_fow,
    ((s.pp_fol)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_fol,
    ((s.pp_fow)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_fow,
    ((s.sh_fol)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_fol,
    ((s.sh_fow)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_fow,
    ((s.total_fol)::numeric / (NULLIF(s.games_played, 0))::numeric) AS total_fol,
    ((s.total_fow)::numeric / (NULLIF(s.games_played, 0))::numeric) AS total_fow,
    ((s.es_goals_against)::numeric / (NULLIF(s.games_played, 0))::numeric) AS es_goals_against,
    ((s.es_goals_for)::numeric / (NULLIF(s.games_played, 0))::numeric) AS es_goals_for,
    ((s.pp_goals_against)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_goals_against,
    ((s.pp_goals_for)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_goals_for,
    ((s.sh_goals_against)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_goals_against,
    ((s.sh_goals_for)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_goals_for,
    ((s.game_misconduct_penalties)::numeric / (NULLIF(s.games_played, 0))::numeric) AS game_misconduct_penalties,
    ((s.major_penalties)::numeric / (NULLIF(s.games_played, 0))::numeric) AS major_penalties,
    ((s.match_penalties)::numeric / (NULLIF(s.games_played, 0))::numeric) AS match_penalties,
    ((s.minor_penalties)::numeric / (NULLIF(s.games_played, 0))::numeric) AS minor_penalties,
    ((s.misconduct_penalties)::numeric / (NULLIF(s.games_played, 0))::numeric) AS misconduct_penalties,
    ((s.penalties)::numeric / (NULLIF(s.games_played, 0))::numeric) AS penalties,
    ((s.penalties_drawn)::numeric / (NULLIF(s.games_played, 0))::numeric) AS penalties_drawn,
    ((s.penalty_minutes)::numeric / (NULLIF(s.games_played, 0))::numeric) AS penalty_minutes,
    ((s.sh_assists)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_assists,
    ((s.sh_goals)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_goals,
    ((s.sh_points)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_points,
    ((s.sh_primary_assists)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_primary_assists,
    ((s.sh_secondary_assists)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_secondary_assists,
    ((s.sh_individual_sat_for)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_individual_sat_for,
    ((s.sh_shots)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sh_shots,
    ((s.pp_assists)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_assists,
    ((s.pp_goals)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_goals,
    ((s.pp_individual_sat_for)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_individual_sat_for,
    ((s.pp_primary_assists)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_primary_assists,
    ((s.pp_secondary_assists)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_secondary_assists,
    ((s.pp_shots)::numeric / (NULLIF(s.games_played, 0))::numeric) AS pp_shots,
    ((s.sat_against)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sat_against,
    ((s.sat_for)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sat_for,
    ((s.sat_total)::numeric / (NULLIF(s.games_played, 0))::numeric) AS sat_total,
    ((s.usat_against)::numeric / (NULLIF(s.games_played, 0))::numeric) AS usat_against,
    ((s.usat_for)::numeric / (NULLIF(s.games_played, 0))::numeric) AS usat_for,
    ((s.usat_total)::numeric / (NULLIF(s.games_played, 0))::numeric) AS usat_total,
    ((s.assists_5v5)::numeric / (NULLIF(s.games_played, 0))::numeric) AS assists_5v5,
    ((s.goals_5v5)::numeric / (NULLIF(s.games_played, 0))::numeric) AS goals_5v5,
    ((s.points_5v5)::numeric / (NULLIF(s.games_played, 0))::numeric) AS points_5v5,
    ((s.primary_assists_5v5)::numeric / (NULLIF(s.games_played, 0))::numeric) AS primary_assists_5v5,
    ((s.secondary_assists_5v5)::numeric / (NULLIF(s.games_played, 0))::numeric) AS secondary_assists_5v5,
    ((s.total_primary_assists)::numeric / (NULLIF(s.games_played, 0))::numeric) AS total_primary_assists,
    ((s.total_secondary_assists)::numeric / (NULLIF(s.games_played, 0))::numeric) AS total_secondary_assists,
    s.toi_per_game,
    s.pp_toi_per_game,
    s.pp_toi_pct_per_game
   FROM (public.wgo_skater_stats_totals s
     LEFT JOIN public.team_summary_years ts ON (((s.current_team_name = ts.team_full_name) AND (s.season = (ts.season_id)::text))));

CREATE OR REPLACE VIEW public.wgo_goalie_stats_per_game AS
 SELECT g.goalie_id,
    g.goalie_name,
    g.season_id,
    g.shoots_catches,
    g.games_played,
    g.games_started,
        CASE
            WHEN (strpos(g.team_abbrevs, ','::text) > 0) THEN NULL::numeric
            ELSE ((g.games_played)::numeric / (NULLIF(ts.games_played, 0))::numeric)
        END AS percent_games,
    ((g.wins)::numeric / (NULLIF(g.games_played, 0))::numeric) AS wins,
    ((g.losses)::numeric / (NULLIF(g.games_played, 0))::numeric) AS losses,
    ((g.saves)::numeric / (NULLIF(g.games_played, 0))::numeric) AS saves,
    ((g.shots_against)::numeric / (NULLIF(g.games_played, 0))::numeric) AS shots_against,
    ((g.shutouts)::numeric / (NULLIF(g.games_played, 0))::numeric) AS shutouts,
    ((g.quality_start)::numeric / (NULLIF(g.games_played, 0))::numeric) AS quality_start,
    g.goals_against_avg,
    g.save_pct,
    g.team_abbrevs,
    g.current_team_abbreviation
   FROM ((public.wgo_goalie_stats_totals g
     LEFT JOIN public.teams tm ON ((
        CASE
            WHEN (strpos(g.team_abbrevs, ','::text) > 0) THEN g.current_team_abbreviation
            ELSE g.team_abbrevs
        END = (tm.abbreviation)::text)))
     LEFT JOIN public.team_summary_years ts ON (((tm.name = ts.team_full_name) AND (g.season_id = ts.season_id))));

commit;

-- READBACK (bounded): select player_id, season, current_team_abbreviation, percent_games
--   from public.wgo_skater_stats_per_game where player_id = 8478402 and season in ('20242025', '20252026');
--   -- single-team seasons keep a value; a traded player's season shows NULL
-- explain select percent_games from public.wgo_skater_stats_per_game where season = '20252026';
--   -- expect index probes on wgo_skater_stats (player_id, date), not a seq scan
-- ROLLBACK: supabase/tests/l4a_percent_games_rollback.sql.
