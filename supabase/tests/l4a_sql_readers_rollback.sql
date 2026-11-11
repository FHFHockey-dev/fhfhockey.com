-- Rollback for L4a reader migrations 20261111180200..180600. Each block is independent: run only the
-- block(s) for the migration(s) being rolled back, each in its own transaction.

-- 20261111180200 (Game Score): baseline body, 20260731035012 search_path, no comment.
begin;
CREATE OR REPLACE FUNCTION public.get_skater_game_scores_for_season(p_player_id integer, p_season_id integer) RETURNS TABLE(game_date date, game_score numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT sub.game_date, sub.game_score
  FROM (
    SELECT
        wgs.date AS game_date,
        (
          -- *** Your existing game_score calculation remains unchanged ***
          0.75 * wgs.goals +
          0.7 * wgs.total_primary_assists +
          0.55 * wgs.total_secondary_assists +
          0.075 * wgs.shots +
          0.05 * wgs.blocked_shots +
          0.15 * wgs.penalties_drawn -
          0.15 * wgs.penalties +
          0.01 * wgs.total_fow -
          0.01 * wgs.total_fol +
          0.05 * wgs.sat_for -
          0.05 * wgs.sat_against +
          0.15 * (wgs.es_goals_for + wgs.pp_goals_for + wgs.sh_goals_for) -
          0.15 * (wgs.es_goals_against + wgs.pp_goals_against + wgs.sh_goals_against)
        )::numeric AS game_score
    FROM
        "wgo_skater_stats" wgs
    WHERE
        wgs."player_id" = p_player_id
        -- ****** ADD THIS LINE - VERIFY YOUR COLUMN NAME ******
        AND wgs."season_id" = p_season_id
        -- *****************************************************
  ) sub
  WHERE sub.game_score IS NOT NULL
  ORDER BY sub.game_date ASC; -- Order ascending for chart display
  -- No LIMIT clause needed, as we want all games for the season
END;
$$;
COMMENT ON FUNCTION public.get_skater_game_scores_for_season(integer, integer) IS NULL;
commit;

-- 20261111180300 (get_skaters_avg_stats)
begin;
CREATE OR REPLACE FUNCTION public.get_skaters_avg_stats(start_date date, end_date date) RETURNS TABLE(id bigint, avggoals numeric, avgassists numeric, avgplusminus numeric, avgpim numeric, avghits numeric, avgblockedshots numeric, avgpowerplaypoints numeric, avgshots numeric, numgames bigint)
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
    AS $$BEGIN
   RETURN QUERY
      SELECT
       "skatersGameStats"."playerId" AS "id",
       AVG("skatersGameStats"."goals") AS "avgGoals",
       AVG("skatersGameStats"."assists") AS "avgAssists",
       AVG("skatersGameStats"."plusMinus") AS "avgPlusMinus",
       AVG("skatersGameStats"."pim") AS "avgPim",
       AVG("skatersGameStats"."hits") AS "avgHits",
       AVG("skatersGameStats"."blockedShots") AS "avgBlockedShots",
       AVG("skatersGameStats"."powerPlayPoints") AS "avgPowerPlayPoints",
       AVG("skatersGameStats"."shots") AS "avgShots",
       COUNT("skatersGameStats"."playerId") AS "numGames"
   FROM
       "skatersGameStats"
   INNER JOIN
       "games" ON "skatersGameStats"."gameId" = "games"."id"
   WHERE
       "games"."date" >= start_date AND
       "games"."date" <= end_date
   GROUP BY "skatersGameStats"."playerId";
END;$$;
commit;

-- 20261111180400 (nhl_team_data): drop and recreate the baseline view, restore baseline grants.
begin;
DROP VIEW public.nhl_team_data;
CREATE VIEW public.nhl_team_data AS
 WITH latest_standings AS (
         SELECT nhl_standings_details.season_id,
            nhl_standings_details.date,
            nhl_standings_details.team_abbrev,
            nhl_standings_details.conference_abbrev,
            nhl_standings_details.conference_home_sequence,
            nhl_standings_details.conference_l10_sequence,
            nhl_standings_details.conference_name,
            nhl_standings_details.conference_road_sequence,
            nhl_standings_details.conference_sequence,
            nhl_standings_details.division_abbrev,
            nhl_standings_details.division_home_sequence,
            nhl_standings_details.division_l10_sequence,
            nhl_standings_details.division_name,
            nhl_standings_details.division_road_sequence,
            nhl_standings_details.division_sequence,
            nhl_standings_details.game_type_id,
            nhl_standings_details.games_played,
            nhl_standings_details.goal_differential,
            nhl_standings_details.goal_differential_pctg,
            nhl_standings_details.goal_against,
            nhl_standings_details.goal_for,
            nhl_standings_details.goals_for_pctg,
            nhl_standings_details.home_games_played,
            nhl_standings_details.home_goal_differential,
            nhl_standings_details.home_goals_against,
            nhl_standings_details.home_goals_for,
            nhl_standings_details.home_losses,
            nhl_standings_details.home_ot_losses,
            nhl_standings_details.home_points,
            nhl_standings_details.home_regulation_plus_ot_wins,
            nhl_standings_details.home_regulation_wins,
            nhl_standings_details.home_wins,
            nhl_standings_details.l10_games_played,
            nhl_standings_details.l10_goal_differential,
            nhl_standings_details.l10_goals_against,
            nhl_standings_details.l10_goals_for,
            nhl_standings_details.l10_losses,
            nhl_standings_details.l10_ot_losses,
            nhl_standings_details.l10_points,
            nhl_standings_details.l10_regulation_plus_ot_wins,
            nhl_standings_details.l10_regulation_wins,
            nhl_standings_details.l10_wins,
            nhl_standings_details.league_home_sequence,
            nhl_standings_details.league_l10_sequence,
            nhl_standings_details.league_road_sequence,
            nhl_standings_details.league_sequence,
            nhl_standings_details.losses,
            nhl_standings_details.ot_losses,
            nhl_standings_details.place_name,
            nhl_standings_details.point_pctg,
            nhl_standings_details.points,
            nhl_standings_details.regulation_plus_ot_win_pctg,
            nhl_standings_details.regulation_plus_ot_wins,
            nhl_standings_details.regulation_win_pctg,
            nhl_standings_details.regulation_wins,
            nhl_standings_details.road_games_played,
            nhl_standings_details.road_goal_differential,
            nhl_standings_details.road_goals_against,
            nhl_standings_details.road_goals_for,
            nhl_standings_details.road_losses,
            nhl_standings_details.road_ot_losses,
            nhl_standings_details.road_points,
            nhl_standings_details.road_regulation_plus_ot_wins,
            nhl_standings_details.road_regulation_wins,
            nhl_standings_details.road_wins,
            nhl_standings_details.shootout_losses,
            nhl_standings_details.shootout_wins,
            nhl_standings_details.streak_code,
            nhl_standings_details.streak_count,
            nhl_standings_details.team_name_default,
            nhl_standings_details.team_name_fr,
            nhl_standings_details.team_common_name,
            nhl_standings_details.waivers_sequence,
            nhl_standings_details.wildcard_sequence,
            nhl_standings_details.win_pctg,
            nhl_standings_details.wins
           FROM public.nhl_standings_details
          WHERE (nhl_standings_details.date = ( SELECT max(nhl_standings_details_1.date) AS max
                   FROM public.nhl_standings_details nhl_standings_details_1))
        )
 SELECT ls.season_id,
    ls.date,
    ls.team_abbrev,
    ls.games_played,
    ls.win_pctg,
    ls.goal_for,
    ls.goal_against,
        CASE
            WHEN (ls.games_played > 0) THEN ((ls.goal_for)::numeric / (ls.games_played)::numeric)
            ELSE (0)::numeric
        END AS goal_for_per_game,
        CASE
            WHEN (ls.games_played > 0) THEN ((ls.goal_against)::numeric / (ls.games_played)::numeric)
            ELSE (0)::numeric
        END AS goal_against_per_game,
    ns.cf_pct,
    ns.sf_pct,
    ns.xgf,
    ns.xga,
    ns.sf,
    ns.sa,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.xgf)::numeric / (ns.gp)::numeric)
            ELSE (0)::numeric
        END AS xgf_per_game,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.xga)::numeric / (ns.gp)::numeric)
            ELSE (0)::numeric
        END AS xga_per_game,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.sf)::numeric / (ns.gp)::numeric)
            ELSE (0)::numeric
        END AS sf_per_game,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.sa)::numeric / (ns.gp)::numeric)
            ELSE (0)::numeric
        END AS sa_per_game
   FROM (latest_standings ls
     LEFT JOIN public.nst_team_stats ns ON ((ns.team_abbreviation = ls.team_abbrev)));
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.nhl_team_data TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.nhl_team_data TO authenticated;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.nhl_team_data TO service_role;
commit;

-- 20261111180500 (gameOutcomes)
begin;
CREATE OR REPLACE VIEW public."gameOutcomes" AS
 SELECT "teamOne"."gameId",
    "teamOne"."teamId",
        CASE
            WHEN ("teamOne".score > "teamTwo".score) THEN 'WIN'::text
            WHEN ("teamOne".score < "teamTwo".score) THEN 'LOSS'::text
            ELSE 'TIE'::text
        END AS outcome
   FROM (public."teamGameStats" "teamOne"
     JOIN public."teamGameStats" "teamTwo" ON ((("teamOne"."gameId" = "teamTwo"."gameId") AND ("teamOne"."teamId" <> "teamTwo"."teamId"))));
COMMENT ON VIEW public."gameOutcomes" IS NULL;
commit;

-- 20261111180600 (goalie weekly views)
begin;
CREATE OR REPLACE VIEW public.goalie_weekly_aggregates AS
 SELECT yw.season AS matchup_season,
    yw.week,
    yw.start_date AS week_start_date,
    yw.end_date AS week_end_date,
    wg.goalie_id,
    (array_agg(wg.goalie_name ORDER BY wg.date DESC))[1] AS goalie_name,
    (array_agg(wg.team ORDER BY wg.date DESC))[1] AS team,
    wg.season AS goalie_game_season,
    sum(wg.games_played) AS weekly_gp,
    sum(wg.games_started) AS weekly_gs,
    sum(wg.wins) AS weekly_wins,
    sum(wg.losses) AS weekly_losses,
    sum(wg.ot_losses) AS weekly_ot_losses,
    sum(wg.saves) AS weekly_saves,
    sum(wg.shots_against) AS weekly_sa,
    sum(wg.goals_against) AS weekly_ga,
    sum(wg.shutouts) AS weekly_so,
    sum(wg.time_on_ice_seconds) AS weekly_toi_seconds,
        CASE
            WHEN (sum(wg.shots_against) > 0) THEN ((sum(wg.saves))::numeric / (sum(wg.shots_against))::numeric)
            ELSE (0)::numeric
        END AS weekly_sv_pct,
        CASE
            WHEN (sum(wg.time_on_ice_seconds) > (0)::double precision) THEN (((sum(wg.goals_against))::numeric * (3600)::numeric) / (sum(wg.time_on_ice_seconds))::numeric)
            ELSE (0)::numeric
        END AS weekly_gaa,
        CASE
            WHEN (sum(wg.time_on_ice_seconds) > (0)::double precision) THEN (((sum(wg.saves))::numeric * (3600)::numeric) / (sum(wg.time_on_ice_seconds))::numeric)
            ELSE (0)::numeric
        END AS weekly_saves_per_60,
        CASE
            WHEN (sum(wg.time_on_ice_seconds) > (0)::double precision) THEN (((sum(wg.shots_against))::numeric * (3600)::numeric) / (sum(wg.time_on_ice_seconds))::numeric)
            ELSE (0)::numeric
        END AS weekly_sa_per_60
   FROM (public.wigo_goalies wg
     JOIN public.yahoo_matchup_weeks yw ON (((wg.date >= yw.start_date) AND (wg.date <= yw.end_date) AND ("substring"((wg.season)::text, 1, 4) = yw.season))))
  WHERE (wg.time_on_ice_seconds > (0)::double precision)
  GROUP BY yw.season, yw.week, yw.start_date, yw.end_date, wg.goalie_id, wg.season;

CREATE OR REPLACE VIEW public.league_weekly_goalie_averages AS
 SELECT goalie_weekly_aggregates.matchup_season,
    goalie_weekly_aggregates.week,
    sum(goalie_weekly_aggregates.weekly_saves) AS total_league_saves,
    sum(goalie_weekly_aggregates.weekly_sa) AS total_league_sa,
    sum(goalie_weekly_aggregates.weekly_ga) AS total_league_ga,
    sum(goalie_weekly_aggregates.weekly_toi_seconds) AS total_league_toi_seconds,
    avg(goalie_weekly_aggregates.weekly_gp) AS avg_league_weekly_gp,
    avg(goalie_weekly_aggregates.weekly_gs) AS avg_league_weekly_gs,
    avg(goalie_weekly_aggregates.weekly_wins) AS avg_league_weekly_wins,
    avg(goalie_weekly_aggregates.weekly_losses) AS avg_league_weekly_losses,
    avg(goalie_weekly_aggregates.weekly_ot_losses) AS avg_league_weekly_ot_losses,
    avg(goalie_weekly_aggregates.weekly_saves) AS avg_league_weekly_saves,
    avg(goalie_weekly_aggregates.weekly_sa) AS avg_league_weekly_sa,
    avg(goalie_weekly_aggregates.weekly_ga) AS avg_league_weekly_ga,
    avg(goalie_weekly_aggregates.weekly_so) AS avg_league_weekly_so,
    avg(goalie_weekly_aggregates.weekly_toi_seconds) AS avg_league_weekly_toi_seconds,
        CASE
            WHEN (sum(goalie_weekly_aggregates.weekly_sa) > (0)::numeric) THEN (sum(goalie_weekly_aggregates.weekly_saves) / sum(goalie_weekly_aggregates.weekly_sa))
            ELSE (0)::numeric
        END AS avg_league_weekly_sv_pct,
        CASE
            WHEN (sum(goalie_weekly_aggregates.weekly_toi_seconds) > (0)::double precision) THEN ((sum(goalie_weekly_aggregates.weekly_ga) * (3600)::numeric) / (sum(goalie_weekly_aggregates.weekly_toi_seconds))::numeric)
            ELSE (0)::numeric
        END AS avg_league_weekly_gaa,
        CASE
            WHEN (sum(goalie_weekly_aggregates.weekly_toi_seconds) > (0)::double precision) THEN ((sum(goalie_weekly_aggregates.weekly_saves) * (3600)::numeric) / (sum(goalie_weekly_aggregates.weekly_toi_seconds))::numeric)
            ELSE (0)::numeric
        END AS avg_league_weekly_saves_per_60,
        CASE
            WHEN (sum(goalie_weekly_aggregates.weekly_toi_seconds) > (0)::double precision) THEN ((sum(goalie_weekly_aggregates.weekly_sa) * (3600)::numeric) / (sum(goalie_weekly_aggregates.weekly_toi_seconds))::numeric)
            ELSE (0)::numeric
        END AS avg_league_weekly_sa_per_60
   FROM public.goalie_weekly_aggregates
  GROUP BY goalie_weekly_aggregates.matchup_season, goalie_weekly_aggregates.week;
commit;
