-- F6 PREPARED ONLY. NOT EXECUTED. This file performs no model capture.
-- PostgreSQL/psql variables (must be approved before use):
--   from_date = actual first served date (tentatively 2026-10-23)
--   to_date   = fixed end date (tentatively 2026-10-29)
--   season_id = 20262027
-- No credentials, endpoint invocation, mutations, schema changes or automatic retries.
-- Exactly seven SELECT statements, one read-only repeatable-read transaction.
-- Each result has its own sentinel. STOP on error, sentinel, timeout, or missing receipt.
-- The largest allowed date window is 14 calendar days; operator validates before execution.
-- Do not run through an API that may truncate the single JSON cell; any truncation refuses audit.
\set ON_ERROR_STOP on
begin transaction isolation level repeatable read read only;
set local statement_timeout = '15s';
set local lock_timeout = '2s';

-- 1. Run inventory and issuance reconciliation (500 row cap + sentinel).
-- Bridge issued_at is forge_runs.created_at, NOT the 12:30Z snapshot schedule.
-- Include lookback runs referenced by re-aimed rows and all versions, not just Release C.
with bounded as materialized (
  select run_id, as_of_date, git_sha, status, created_at, updated_at
  from public.forge_runs
  where as_of_date between :'from_date'::date - 7 and :'to_date'::date
  order by as_of_date, created_at, run_id
  limit 501
)
select 'runs' as dataset, count(*) as returned_rows, count(*) > 500 as overflow,
       coalesce(jsonb_agg(to_jsonb(bounded) order by as_of_date, created_at, run_id), '[]'::jsonb) as rows
from bounded;

-- 2. Q3/Q4 exact raw ledger export (20,000 + sentinel), including unknown/unsettled rows.
-- Do not filter settled_at/dressed/finite heads or git_sha before the eligibility audit.
-- Q3 weighted biases and Q4 expected-FP NTILE(10) are computed offline in audit.py.
-- Only explicit non-private fields; source/class are never pooled by the evaluator.
with bounded as materialized (
  select served_date, season_id, player_id, game_id, source, player_class,
         team_id, opponent_team_id, is_home, scheduled_at, team_rest_days, opponent_rest_days,
         run_id, source_watermark, method_version, cutoff_at, issued_at, expires_at,
         participation_probability, start_probability,
         exp_goals, exp_assists, exp_pp_points, exp_shots, exp_hits, exp_blocks,
         exp_saves, exp_goals_against, exp_shots_against, exp_win_prob, exp_shutout_prob, exp_fantasy_points,
         act_goals, act_assists, act_pp_points, act_shots, act_hits, act_blocks,
         act_saves, act_goals_against, act_shots_against, act_win, act_shutout, act_fantasy_points,
         dressed, started, settled_at, outcome_source, created_at, updated_at
  from public.forge_served_forecast_ledger
  where served_date between :'from_date'::date and :'to_date'::date
    and season_id = :'season_id'::integer
    and source in ('bridge_exact', 'bridge_reaimed', 'native', 'naive_last5', 'naive_season')
  order by served_date, game_id, player_id, source
  limit 20001
)
select 'ledger' as dataset, count(*) as returned_rows, count(*) > 20000 as overflow,
       coalesce(jsonb_agg(to_jsonb(bounded) order by served_date, game_id, player_id, source), '[]'::jsonb) as rows
from bounded;

-- 3. Q6 h1 projections, all runs within the served-date window, incl failed/duplicate versions.
-- Never add DISTINCT/latest-per-day: audit run identity and retain reissued-run diagnostics.
with bounded as materialized (
  select p.run_id, p.as_of_date, p.horizon_games, p.game_id, p.player_id, p.team_id,
         p.proj_goals_es, p.proj_goals_pp, p.proj_assists_es, p.proj_assists_pp,
         p.proj_shots_es, p.proj_shots_pp, p.proj_hits, p.proj_blocks,
         p.created_at, p.updated_at
  from public.forge_player_projections p
  join public.forge_runs r on r.run_id = p.run_id
  where r.as_of_date between :'from_date'::date and :'to_date'::date and p.horizon_games = 1
  order by r.as_of_date, p.run_id, p.game_id, p.player_id
  limit 10001
)
select 'projections' as dataset, count(*) as returned_rows, count(*) > 10000 as overflow,
       coalesce(jsonb_agg(to_jsonb(bounded) order by as_of_date, run_id, game_id, player_id), '[]'::jsonb) as rows
from bounded;

-- 4. Q5 current rolling ev rows (12,000 + sentinel), with timestamps and raw null/zero values.
-- This table has no git_sha and can be recomputed. It CANNOT prove issue-time inputs.
-- Do not fill NULL with 0, deduplicate silently, or join latest rows as historical inputs.
with bounded as materialized (
  select season, game_date, game_id, player_id, strength_state, updated_at,
         sog_per_60_last5, hits_per_60_last5, blocks_per_60_last5
  from public.rolling_player_game_metrics
  where season = :'season_id'::integer and strength_state = 'ev'
    and game_date between :'from_date'::date - 7 and :'to_date'::date
  order by game_date, game_id, player_id, updated_at
  limit 12001
)
select 'rolling' as dataset, count(*) as returned_rows, count(*) > 12000 as overflow,
       coalesce(jsonb_agg(to_jsonb(bounded) order by game_date, game_id, player_id, updated_at), '[]'::jsonb) as rows
from bounded;

-- 5. Independent calendar membership (250 + sentinel). games has no finality column here.
-- A no-game day is retained in the normalized calendar; it is not a settled game-bearing day.
with bounded as materialized (
  select id as game_id, date, "seasonId" as season_id, "startTime" as start_time,
         "homeTeamId" as home_team_id, "awayTeamId" as away_team_id
  from public.games
  where "seasonId" = :'season_id'::integer and date between :'from_date'::date and :'to_date'::date
  order by date, id
  limit 251
)
select 'schedule' as dataset, count(*) as returned_rows, count(*) > 250 as overflow,
       coalesce(jsonb_agg(to_jsonb(bounded) order by date, game_id), '[]'::jsonb) as rows
from bounded;

-- 6. Independent skater actuals (6,000 + sentinel). Does NOT itself prove complete ingestion.
-- Use historical position_code; never use today's players.position as historical F/D.
-- team_abbrev must be resolved using the approved game-time team receipt, not current_team_*.
with bounded as materialized (
  select season_id, date, game_id, player_id, team_abbrev, position_code,
         goals, assists, pp_points, pp_goals, pp_assists, shots, hits, blocked_shots
  from public.wgo_skater_stats
  where season_id = :'season_id'::integer and date between :'from_date'::date and :'to_date'::date
  order by date, game_id, player_id
  limit 6001
)
select 'skater_actuals' as dataset, count(*) as returned_rows, count(*) > 6000 as overflow,
       coalesce(jsonb_agg(to_jsonb(bounded) order by date, game_id, player_id), '[]'::jsonb) as rows
from bounded;

-- 7. Goalie actuals for Q3 diagnostics only (1,000 + sentinel).
with bounded as materialized (
  select season_id, date, game_id, goalie_id, games_started, saves, goals_against, shots_against, wins, shutouts
  from public.wgo_goalie_stats
  where season_id = :'season_id'::integer and date between :'from_date'::date and :'to_date'::date
  order by date, game_id, goalie_id
  limit 1001
)
select 'goalie_actuals' as dataset, count(*) as returned_rows, count(*) > 1000 as overflow,
       coalesce(jsonb_agg(to_jsonb(bounded) order by date, game_id, goalie_id), '[]'::jsonb) as rows
from bounded;
rollback;
