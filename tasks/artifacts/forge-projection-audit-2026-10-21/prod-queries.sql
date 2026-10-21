-- FORGE projection audit 2026-10-21 — proposed read-only production queries
-- Project fyhftlxokyjtpndbkfse via Supabase MCP execute_sql. Each query runs ONCE.
-- A query that errors on a column name gets at most one corrected retry; nothing else is retried.
-- No writes, no route calls, no ANALYZE/VACUUM. Column names come from route/migration code and may need adjusting.

-- Q1 FORGE runs since 10-14: status, stamp, horizon mix, row counts (W4-Q1 / W6-Q-B)
select r.run_id, r.as_of_date, r.status, r.git_sha, r.created_at, r.updated_at,
       r.metrics->'resume'->>'scope_key' as scope_key,
       (r.metrics->'resume'->>'invocations')::int as invocations,
       (select count(*) from forge_player_projections p where p.run_id = r.run_id and p.horizon_games = 1) as skater_h1_rows,
       (select count(*) from forge_player_projections p where p.run_id = r.run_id and p.horizon_games <> 1) as skater_other_rows,
       (select count(*) from forge_goalie_projections g where g.run_id = r.run_id) as goalie_rows
from forge_runs r
where r.as_of_date >= '2026-10-14'
order by r.as_of_date desc, r.created_at desc;

-- Q2 Pipeline stage state for the last 3 run dates, including kill companions (W4-Q2)
select scope_key, operation_key, status, cursor_game_id, cursor_date, last_error, lease_expires_at, updated_at, revision
from projection_pipeline_state
where scope_key like 'daily_incremental%' and updated_at >= now() - interval '3 days'
order by scope_key, operation_key;

-- Q3 Cron audit rows for the pipeline family, last 7 days (W4-Q3 + W1-SQL-C)
select run_time, job_name, status, rows_affected,
       details->>'statusCode' as http,
       (details->>'durationMs')::int as duration_ms,
       details->'nstProgress'->'continuation'->>'nextIndex' as nst_next_idx,
       details->'nstProgress'->'continuation'->>'totalUrls' as nst_total_urls,
       left(details->>'url', 160) as url,
       left(details->>'error', 160) as error
from cron_job_audit
where run_time >= now() - interval '7 days'
  and job_name in ('run-rolling-forge-pipeline','update-rolling-player-averages','run-projection-v2',
                   'update-goalie-projections-v2','run-projection-accuracy','update-nst-gamelog')
order by run_time desc;

-- Q4 Does anything write tomorrow's goalie start priors? (tests the next-day gate claim, W4 §3d)
select g.date, count(distinct g.id) as games, count(distinct s.game_id) as games_with_goalie_rows, max(s.updated_at) as last_written
from games g
left join goalie_start_projections s on s.game_id = g.id
where g.date between current_date - 2 and current_date + 2
group by g.date order by g.date;

-- Q5 NST gamelog coverage per game date vs WGO skater-games, 2026-27 (W1-SQL-A)
with gd as (
  select date::date d, count(*) games from games
  where "seasonId" = 20262027 and type = 2 and date >= '2026-10-07' and date < current_date
  group by 1),
w as (select date::date d, count(*) wgo_rows from wgo_skater_stats
      where date >= '2026-10-07' and date < current_date group by 1),
n as (
  select date_scraped::date d, 'as' k, count(*) c from nst_gamelog_as_counts where date_scraped >= '2026-10-07' group by 1
  union all select date_scraped::date, 'es', count(*) from nst_gamelog_es_counts where date_scraped >= '2026-10-07' group by 1
  union all select date_scraped::date, 'pp', count(*) from nst_gamelog_pp_counts where date_scraped >= '2026-10-07' group by 1
  union all select date_scraped::date, '5v5', count(*) from nst_gamelog_5v5_counts where date_scraped >= '2026-10-07' group by 1)
select gd.d, gd.games, w.wgo_rows,
       sum(c) filter (where k='as') nst_as, sum(c) filter (where k='es') nst_es,
       sum(c) filter (where k='pp') nst_pp, sum(c) filter (where k='5v5') nst_5v5
from gd left join w using (d) left join n using (d)
group by 1,2,3 order by 1;

-- Q6 Rolling rows per game_date and strength (expect ≈ wgo_rows per strength) (W1-SQL-B)
select game_date, strength_state, count(*) rolling_rows, max(updated_at) last_write
from rolling_player_game_metrics
where game_date >= '2026-10-07' and game_date < current_date
group by 1,2 order by 1,2;

-- Q7 Line / PP context coverage per completed game date (W1-SQL-D)
with g as (select id, date::date d from games where "seasonId" = 20262027 and type = 2 and date >= '2026-10-07' and date < current_date),
l as (select "gameId", count(distinct "teamId") teams from "lineCombinations" group by 1),
p as (select "gameId", count(distinct "teamId") teams from "powerPlayCombinations" group by 1)
select g.d, count(*) games,
       count(*) filter (where coalesce(l.teams,0) >= 2) games_with_lines,
       count(*) filter (where coalesce(p.teams,0) >= 2) games_with_pp
from g left join l on l."gameId" = g.id left join p on p."gameId" = g.id
group by 1 order by 1;

-- Q8 Accuracy daily table, last 14 days: is the 11:30Z pg_cron job producing rows? (W6-Q-A)
select date, scope, player_count, round(accuracy_avg::numeric, 4) as acc, round(mae::numeric, 3) as mae, round(rmse::numeric, 3) as rmse, updated_at
from forge_projection_accuracy_daily
where date >= current_date - 14
order by date desc, scope;

-- Q9 Null-head share per as_of_date on h1 rows of succeeded runs (W6-Q-D; F6 magnitude today)
select p.as_of_date, count(*) as rows,
       count(*) filter (where p.proj_goals_es is null or p.proj_goals_pp is null) as withheld_goal_heads,
       count(*) filter (where p.proj_hits is null) as null_hits,
       count(*) filter (where p.proj_blocks is null) as null_blocks
from forge_player_projections p
join forge_runs r on r.run_id = p.run_id and r.status = 'succeeded'
where p.horizon_games = 1 and p.as_of_date >= current_date - 14
group by 1 order by 1 desc;

-- Q10 Table health: live/dead tuples, vacuum/analyze times, total size (W2)
select relname, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
       pg_size_pretty(pg_total_relation_size(relid)) as total_size
from pg_stat_user_tables
where relname in ('rolling_player_game_metrics','rolling_player_metric_support_payloads','forge_player_projections',
                  'forge_goalie_projections','forge_runs','wgo_skater_stats','nst_gamelog_es_counts','cron_job_audit')
order by pg_total_relation_size(relid) desc;

-- Q11 Index sizes and scan counts on the rolling and FORGE tables (W2)
select relname, indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) as index_size, idx_scan, idx_tup_read
from pg_stat_user_indexes
where relname in ('rolling_player_game_metrics','rolling_player_metric_support_payloads','forge_player_projections','forge_goalie_projections')
order by pg_relation_size(indexrelid) desc;

-- Q12 Live pg_cron schedule (job names and active flags only; no command text, which may carry auth)
select jobid, jobname, schedule, active
from cron.job
order by schedule, jobname;

-- ===== Backtest cohort export (TJ approved 2026-10-21 ~19:05Z; run once each via read-only psql; outputs to scratchpad JSON, not printed) =====
-- s1_runs
select coalesce(json_agg(t), '[]'::json) from (-- S1 cohort runs (~10-30 rows, <10 KB)
select run_id, as_of_date, git_sha, created_at,
       metrics->>'horizon_games' as horizon_games,
       metrics->'resume'->>'scope_key' as scope_key
from forge_runs
where status = 'succeeded' and as_of_date between '2026-10-13' and '2026-10-21'
  and (metrics->>'horizon_games' = '1'
       or (metrics->>'horizon_games' is null
           and coalesce(metrics->'resume'->>'scope_key','h1:') like 'h1:%'))
order by as_of_date, created_at desc) t;
-- s2_projections
select coalesce(json_agg(t), '[]'::json) from (-- S2 projection rows, needed paths only (~3,000-3,400 rows, ~1.2-1.6 KB each => ~4-5 MB JSON)
with runs as (
  select distinct on (as_of_date) run_id, as_of_date, git_sha
  from forge_runs
  where status = 'succeeded' and as_of_date between '2026-10-13' and '2026-10-21'
    and (metrics->>'horizon_games' = '1'
         or (metrics->>'horizon_games' is null
             and coalesce(metrics->'resume'->>'scope_key','h1:') like 'h1:%'))
  order by as_of_date, (git_sha is not null and git_sha not like 'local:%') desc, created_at desc)
select p.run_id, p.as_of_date, r.git_sha, p.game_id, p.player_id, p.team_id, p.opponent_team_id,
  p.proj_shots_es, p.proj_shots_pp, p.proj_goals_es, p.proj_goals_pp, p.proj_assists_es, p.proj_assists_pp,
  m->'rollout'->>'mode' as rollout_mode,
  m->'holdout_baselines'->'current_baseline' as current_baseline,
  s->'season_bootstrap' as season_bootstrap,
  s->'conversion_rates' as conversion_rates,
  s->'small_sample'->'sample_weight' as sample_weight,
  s->'rest_schedule' as rest_schedule,
  s->'shot_quality'->'goal_rate_multiplier' as sq_goal,
  s->'on_ice_context' - 'source_date' - 'possession_pct' as on_ice,
  s->'team_level_context' as team_level,
  s->'opponent_goalie_context' as opp_goalie,
  s->'trend_adjustment'->'multipliers' as trend_mult,
  s->'teammate_context' as teammate,
  s->'es_role' as es_role,
  s->'role_continuity'->'volatility_index' as volatility,
  s->'role_scenarios'->'scenarios' as scenarios,
  (select jsonb_object_agg(st||'.'||pr||'.'||w, jsonb_build_array(
            s->'conversion_count_support'->st->'pairs'->pr->w->'numerator',
            s->'conversion_count_support'->st->'pairs'->pr->w->'denominator'))
     from unnest(array['ev','pp']) st, unnest(array['goalPerShot','assistPerGoal']) pr,
          unnest(array['all','last5']) w) as support_counts
from runs r
join forge_player_projections p on p.run_id = r.run_id and p.as_of_date = r.as_of_date and p.horizon_games = 1
join games g on g.id = p.game_id and g.date = p.as_of_date
cross join lateral (select p.uncertainty->'model' as m) mm
cross join lateral (select mm.m->'skater_selection' as s) ss
order by p.as_of_date, p.game_id, p.player_id) t;
-- s3_actuals
select coalesce(json_agg(t), '[]'::json) from (-- S3 actuals (~2,800-3,200 rows, ~80 B each => ~0.3 MB)
select game_id, player_id, date, goals, assists, pp_points, shots
from wgo_skater_stats
where date between '2026-10-13' and '2026-10-21') t;
-- s4_games
select coalesce(json_agg(t), '[]'::json) from (-- S4 games + independent rest context (~70-90 rows, <15 KB)
select g.id, g.date, g."homeTeamId", g."awayTeamId",
  (select max(h.date) from games h where h.date < g.date
     and g."homeTeamId" in (h."homeTeamId", h."awayTeamId")) as home_prev_date,
  (select max(h.date) from games h where h.date < g.date
     and g."awayTeamId" in (h."homeTeamId", h."awayTeamId")) as away_prev_date
from games g
where g.date between '2026-10-13' and '2026-10-21'
order by g.date, g.id) t;
-- s2 retry (cast fix): ((s->'on_ice_context')::jsonb - 'source_date'::text - 'possession_pct'::text)

-- ===== PP diagnosis (proposed 2026-10-21; run once each via read-only psql only if TJ approves; outputs to scratchpad JSON) =====
-- S5 actual PP split for the cohort dates (~2,231 rows, ~0.2 MB)
select game_id, player_id, date, pp_goals, pp_assists, pp_points, pp_shots, pp_toi
from wgo_skater_stats
where date between '2026-10-13' and '2026-10-21';
-- S6 predicted PP usage for the cohort's projection rows (~2,268 rows, ~0.3 MB): PP TOI column + the stored PP-allocation bookkeeping
select p.run_id, p.game_id, p.player_id, p.proj_toi_es_seconds, p.proj_toi_pp_seconds,
       p.uncertainty->'model'->'skater_selection'->'pp_opportunity' as pp_opportunity,
       p.uncertainty->'model'->'skater_selection'->'es_role' as es_role
from forge_player_projections p
where p.horizon_games = 1 and p.as_of_date between '2026-10-13' and '2026-10-21';

-- ===== PP minutes diagnosis, round 2 (proposed 2026-10-21; once each via read-only psql if TJ approves) =====
-- S8 team strength rows behind the PP targets, with game type (~500 rows): does the last-10 window include preseason, and what PK share is left out?
select s.team_id, s.game_id, s.game_date, s.toi_es_seconds, s.toi_pp_seconds, s.toi_pk_seconds, s.shots_es, s.shots_pp, g.type as game_type
from forge_team_game_strength s join games g on g.id = s.game_id
where s.game_date between '2026-09-15' and '2026-10-21'
order by s.team_id, s.game_date;
-- S7 WGO season-to-date PP TOI per player per date before each cohort game (~3,000 rows): the deployment-prior evidence for the allocation counterfactual
select player_id, date, game_id, season_id, pp_toi_per_game, pp_toi
from wgo_skater_stats
where date between '2026-09-15' and '2026-10-21';

-- S9 (TJ-approved with the reconstruction backtest; once, read-only psql): hits/blocks actuals for scoring
select coalesce(json_agg(t),'[]'::json) from (select game_id, player_id, date, hits, blocked_shots from wgo_skater_stats where date between '2026-10-13' and '2026-10-20') t;
