-- NOT APPLIED. Math-audit fix lane L4a (W2-1 D14 / D9 goalie half; rule 5).
-- Apply only with TJ's pop-up approval, singly, then record schema_migrations and migration-authority.json.
--
-- goalie_weekly_aggregates and league_weekly_goalie_averages returned 0 for SV%, GAA, saves/60 and SA/60
-- when the denominator was zero (e.g. a relief week with no shots against), and the league SV% was 0 when
-- every shot count was zero. They are now NULL (unknown). Columns, order and types are unchanged.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

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
            ELSE NULL::numeric
        END AS weekly_sv_pct,
        CASE
            WHEN (sum(wg.time_on_ice_seconds) > (0)::double precision) THEN (((sum(wg.goals_against))::numeric * (3600)::numeric) / (sum(wg.time_on_ice_seconds))::numeric)
            ELSE NULL::numeric
        END AS weekly_gaa,
        CASE
            WHEN (sum(wg.time_on_ice_seconds) > (0)::double precision) THEN (((sum(wg.saves))::numeric * (3600)::numeric) / (sum(wg.time_on_ice_seconds))::numeric)
            ELSE NULL::numeric
        END AS weekly_saves_per_60,
        CASE
            WHEN (sum(wg.time_on_ice_seconds) > (0)::double precision) THEN (((sum(wg.shots_against))::numeric * (3600)::numeric) / (sum(wg.time_on_ice_seconds))::numeric)
            ELSE NULL::numeric
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
            ELSE NULL::numeric
        END AS avg_league_weekly_sv_pct,
        CASE
            WHEN (sum(goalie_weekly_aggregates.weekly_toi_seconds) > (0)::double precision) THEN ((sum(goalie_weekly_aggregates.weekly_ga) * (3600)::numeric) / (sum(goalie_weekly_aggregates.weekly_toi_seconds))::numeric)
            ELSE NULL::numeric
        END AS avg_league_weekly_gaa,
        CASE
            WHEN (sum(goalie_weekly_aggregates.weekly_toi_seconds) > (0)::double precision) THEN ((sum(goalie_weekly_aggregates.weekly_saves) * (3600)::numeric) / (sum(goalie_weekly_aggregates.weekly_toi_seconds))::numeric)
            ELSE NULL::numeric
        END AS avg_league_weekly_saves_per_60,
        CASE
            WHEN (sum(goalie_weekly_aggregates.weekly_toi_seconds) > (0)::double precision) THEN ((sum(goalie_weekly_aggregates.weekly_sa) * (3600)::numeric) / (sum(goalie_weekly_aggregates.weekly_toi_seconds))::numeric)
            ELSE NULL::numeric
        END AS avg_league_weekly_sa_per_60
   FROM public.goalie_weekly_aggregates
  GROUP BY goalie_weekly_aggregates.matchup_season, goalie_weekly_aggregates.week;

commit;

-- READBACK (bounded): select count(*) filter (where weekly_sa = 0) as zero_sa_weeks,
--   count(*) filter (where weekly_sa = 0 and weekly_sv_pct is not null) as still_valued
--   from public.goalie_weekly_aggregates where matchup_season = '2025';   -- expect still_valued = 0
-- ROLLBACK: supabase/tests/l4a_sql_readers_rollback.sql.
