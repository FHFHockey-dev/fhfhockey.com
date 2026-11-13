-- NOT APPLIED. Math-audit follow-up, lane L4a; owner decision 138 (TJ pop-up 2026-11-13; W2-1 D12, decision 16,
-- rules 5 and 13). Successor to 20261111180800 (order 133, applied 2026-11-12). Apply only with TJ's pop-up
-- approval, singly, then record schema_migrations and migration-authority.json (order 143).
--
-- 133 made percent_games NULL (interim, fail-closed) for any season that shows a team other than the current one:
-- dividing by the current team's games is wrong for a traded player. Decision 138 replaces that NULL with a
-- team-of-record-by-date denominator, "games available": the player's GP over the games his teams played while he
-- was on them. From the per-game rows (skaters wgo_skater_stats.team_abbrev, goalies wgo_goalie_stats.
-- team_abbreviation) between the season's startDate and regularSeasonEndDate, ordered by date, each change of team
-- starts a stint on the date of the player's first game for the new team; the first stint starts at the season's
-- startDate. A stint's games available are its team's regular-season games (games.type = 2, games."seasonId" =
-- season) in [stint start, next stint start); the open last stint gets that team's season GP so far
-- (team_summary_years.games_played, the old denominator's horizon) minus its games before the stint start. A return
-- to an earlier team is a new stint. Rule 13: NULL if any stint's team is not found in teams / team_summary_years,
-- or there are no per-game rows. Assumption: the move happens on the first game for the new team (the per-game
-- data carries no transaction date), so games the old team played between the trade and that debut count for the
-- old team.
-- Unchanged: the 133 detection (skaters: a per-game row with another team in the season's date range; goalies:
-- team_abbrevs lists more than one team), the single-team value GP / team GP, every other column, the column
-- names, order and types. Plan: the denominator is a scalar subquery evaluated only in the multi-team branch,
-- probing wgo_skater_stats (player_id, date) / wgo_goalie_stats (goalie_id, ...) and games (date); no seq scan of
-- wgo_skater_stats. Readers: PlayerPickupTable GP%, the radar (radarSeasonStats.ts, PlayerRadarChart).
--
-- READBACK (bounded; run with set statement_timeout = '30s'):
--   1. Up to five 2025-26 skaters with more than one team (one date-indexed pass over the season's per-game rows):
--      select player_id from public.wgo_skater_stats where date between '2025-10-07' and '2026-04-16'
--       group by player_id having count(distinct team_abbrev) > 1 order by player_id limit 5;
--   2. Their rows plus one single-team control:
--      select player_id, current_team_abbreviation, games_played, percent_games from public.wgo_skater_stats_per_game
--       where season = '20252026' and player_id in (8478402, <ids from step 1>) order by player_id;
--   3. select goalie_id, team_abbrevs, games_played, percent_games from public.wgo_goalie_stats_per_game
--       where season_id = 20252026 and strpos(team_abbrevs, ',') > 0 order by games_played desc limit 5;
--   expect percent_games between 0 and 1 for traded players (NULL under 133) and 8478402 unchanged.
--   4. explain select percent_games from public.wgo_skater_stats_per_game where season = '20252026';
--      expect index scans on wgo_skater_stats, no Seq Scan on wgo_skater_stats.
-- ROLLBACK: supabase/tests/l4a_percent_games_tor_rollback.sql (restores the 133 views).
-- PROOF: LC_ALL=C python3 -I supabase/tests/l4a_percent_games_tor.py (disposable local PostgreSQL 15).
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
              WHERE ((w.player_id = s.player_id) AND (w.date >= se."startDate") AND (w.date <= se."endDate") AND (w.team_abbrev <> s.current_team_abbreviation)))) THEN ((s.games_played)::numeric / NULLIF(( SELECT ( SELECT
                    CASE
                        WHEN (count(*) > 0 AND count(*) = count(stint.available)) THEN sum(stint.available)
                        ELSE NULL::numeric
                    END AS sum
                   FROM ( SELECT
                            CASE
                                WHEN (tm.id IS NULL) THEN NULL::numeric
                                WHEN (b.next_start IS NOT NULL) THEN (( SELECT count(*) AS count
                                   FROM public.games gm
                                  WHERE ((gm."seasonId" = se.id) AND (gm.type = 2) AND (gm.date >= b.stint_start) AND (gm.date < b.next_start) AND ((gm."homeTeamId" = tm.id) OR (gm."awayTeamId" = tm.id)))))::numeric
                                ELSE ((tsl.games_played)::numeric - (( SELECT count(*) AS count
                                   FROM public.games gm
                                  WHERE ((gm."seasonId" = se.id) AND (gm.type = 2) AND (gm.date < b.stint_start) AND ((gm."homeTeamId" = tm.id) OR (gm."awayTeamId" = tm.id)))))::numeric)
                            END AS available
                           FROM ((( SELECT a.team,
                                    a.stint_start,
                                    lead(a.stint_start) OVER (ORDER BY a.stint_start) AS next_start
                                   FROM ( SELECT x.team,
CASE
 WHEN (x.previous_team IS NULL) THEN se."startDate"
 ELSE x.date
END AS stint_start
                                           FROM ( SELECT w.date,
                                                    w.team_abbrev AS team,
                                                    lag(w.team_abbrev) OVER (ORDER BY w.date) AS previous_team
                                                   FROM public.wgo_skater_stats w
                                                  WHERE ((w.player_id = s.player_id) AND (w.date >= se."startDate") AND (w.date <= se."regularSeasonEndDate") AND (w.team_abbrev IS NOT NULL))) x
                                          WHERE (x.previous_team IS DISTINCT FROM x.team)) a) b
                             LEFT JOIN public.teams tm ON (((tm.abbreviation)::text = b.team)))
                             LEFT JOIN public.team_summary_years tsl ON (((tsl.team_full_name = tm.name) AND (tsl.season_id = se.id))))) stint)
               FROM public.seasons se
              WHERE ((se.id)::text = s.season)), (0)::numeric))
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
            WHEN (strpos(g.team_abbrevs, ','::text) > 0) THEN ((g.games_played)::numeric / NULLIF(( SELECT ( SELECT
                    CASE
                        WHEN (count(*) > 0 AND count(*) = count(stint.available)) THEN sum(stint.available)
                        ELSE NULL::numeric
                    END AS sum
                   FROM ( SELECT
                            CASE
                                WHEN (tm.id IS NULL) THEN NULL::numeric
                                WHEN (b.next_start IS NOT NULL) THEN (( SELECT count(*) AS count
                                   FROM public.games gm
                                  WHERE ((gm."seasonId" = se.id) AND (gm.type = 2) AND (gm.date >= b.stint_start) AND (gm.date < b.next_start) AND ((gm."homeTeamId" = tm.id) OR (gm."awayTeamId" = tm.id)))))::numeric
                                ELSE ((tsl.games_played)::numeric - (( SELECT count(*) AS count
                                   FROM public.games gm
                                  WHERE ((gm."seasonId" = se.id) AND (gm.type = 2) AND (gm.date < b.stint_start) AND ((gm."homeTeamId" = tm.id) OR (gm."awayTeamId" = tm.id)))))::numeric)
                            END AS available
                           FROM ((( SELECT a.team,
                                    a.stint_start,
                                    lead(a.stint_start) OVER (ORDER BY a.stint_start) AS next_start
                                   FROM ( SELECT x.team,
CASE
 WHEN (x.previous_team IS NULL) THEN se."startDate"
 ELSE x.date
END AS stint_start
                                           FROM ( SELECT w.date,
                                                    w.team_abbreviation AS team,
                                                    lag(w.team_abbreviation) OVER (ORDER BY w.date) AS previous_team
                                                   FROM public.wgo_goalie_stats w
                                                  WHERE ((w.goalie_id = g.goalie_id) AND (w.date >= se."startDate") AND (w.date <= se."regularSeasonEndDate") AND (w.team_abbreviation IS NOT NULL))) x
                                          WHERE (x.previous_team IS DISTINCT FROM x.team)) a) b
                             LEFT JOIN public.teams tm ON (((tm.abbreviation)::text = b.team)))
                             LEFT JOIN public.team_summary_years tsl ON (((tsl.team_full_name = tm.name) AND (tsl.season_id = se.id))))) stint)
               FROM public.seasons se
              WHERE (se.id = g.season_id)), (0)::numeric))
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
