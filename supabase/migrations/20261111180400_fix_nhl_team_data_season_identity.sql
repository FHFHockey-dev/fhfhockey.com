-- NOT APPLIED. Math-audit fix lane L4a (W2-1 D4, PR-SQL-2, F3; decision 10/20 context, rules 5 and 20).
-- Apply only with TJ's pop-up approval, singly, then record schema_migrations and migration-authority.json.
--
-- nhl_team_data joined the latest standings to nst_team_stats on team only, so it returned one row per
-- stored NST season (96 rows for 32 teams) and readers guessed the season from implied games played; equal
-- implied GP let input order pick the season, and an old season could win on a one-game lag.
-- Change: the NST side joins on exact season identity (ns.season = standings season_id), so there is at
-- most one row per team; a team with no NST row for the standings season keeps its standings columns and
-- NULL NST columns (unknown, never last season). Two columns are appended (existing columns unchanged):
-- nst_season (the NST season actually joined) and nst_updated_at (as-of time of that NST row), so readers
-- can check identity and a historical cutoff. Per-game values are NULL, not 0, when GP is 0.
-- Readers (FORGE team-context-queries.ts, RSO forgeDailyBridge.ts, forge-served-forecast-snapshot.ts)
-- belong to lanes L9a/L11; their GP heuristic becomes a guard, not a selector.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

CREATE OR REPLACE VIEW public.nhl_team_data AS
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
            ELSE NULL::numeric
        END AS goal_for_per_game,
        CASE
            WHEN (ls.games_played > 0) THEN ((ls.goal_against)::numeric / (ls.games_played)::numeric)
            ELSE NULL::numeric
        END AS goal_against_per_game,
    ns.cf_pct,
    ns.sf_pct,
    ns.xgf,
    ns.xga,
    ns.sf,
    ns.sa,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.xgf)::numeric / (ns.gp)::numeric)
            ELSE NULL::numeric
        END AS xgf_per_game,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.xga)::numeric / (ns.gp)::numeric)
            ELSE NULL::numeric
        END AS xga_per_game,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.sf)::numeric / (ns.gp)::numeric)
            ELSE NULL::numeric
        END AS sf_per_game,
        CASE
            WHEN (ns.gp > 0) THEN ((ns.sa)::numeric / (ns.gp)::numeric)
            ELSE NULL::numeric
        END AS sa_per_game,
    ns.season AS nst_season,
    ns.updated_at AS nst_updated_at
   FROM (latest_standings ls
     LEFT JOIN public.nst_team_stats ns ON (((ns.team_abbreviation = ls.team_abbrev) AND (ns.season = ls.season_id))));

commit;

-- READBACK (bounded, about 32 rows):
-- select count(*), count(distinct team_abbrev), count(nst_season), min(nst_season), max(nst_season)
--   from public.nhl_team_data;   -- expect count = count(distinct team_abbrev) = 32; nst_season = standings season_id
-- PRE-APPLY: select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'nhl_team_data';   -- record; rollback re-grants these
-- ROLLBACK: supabase/tests/l4a_sql_readers_rollback.sql. Appended columns cannot be removed by CREATE OR
--   REPLACE, so it drops and recreates the baseline view (no view depends on nhl_team_data) and restores
--   the baseline grants; re-apply any differing pre-apply grants recorded above.
