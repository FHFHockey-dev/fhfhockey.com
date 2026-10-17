-- P-B: move job 374 before the 10:40 baseline rebuild and stop blocking readers.
-- PROPOSED ONLY. Not executed. Requires TJ's explicit approval.
-- Apply before 2026-10-18 10:38 UTC to take effect on the next run; never
-- during 2026-10-20 07:00-13:00 ET.

-- 1. Preflight (read-only): current definition and the unique-index precondition.
select jobid, jobname, schedule, active, command
from cron.job
where jobid = 374;
-- expect: '41 10 * * *', true, 'REFRESH MATERIALIZED VIEW internal_stats.player_totals_unified;'

select i.indisunique, i.indisvalid, i.indpred is null as no_predicate,
       i.indexprs is null as no_expressions, pg_get_indexdef(i.indexrelid)
from pg_index i
where i.indexrelid = 'internal_stats.idx_player_totals_unified_pk'::regclass;
-- expect: true, true, true, true, (player_id, season_id)

select ispopulated from pg_matviews
where schemaname = 'internal_stats' and matviewname = 'player_totals_unified';
-- expect: true

-- 2. Change (single catalog row).
select cron.alter_job(
  374,
  schedule := '38 10 * * *',
  command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY internal_stats.player_totals_unified;'
);

-- 3. Readback.
select jobid, schedule, active, command from cron.job where jobid = 374;
-- expect: '38 10 * * *', true, the CONCURRENTLY command

-- ROLLBACK (restores the 2026-10-17 definition):
-- select cron.alter_job(
--   374,
--   schedule := '41 10 * * *',
--   command := 'REFRESH MATERIALIZED VIEW internal_stats.player_totals_unified;'
-- );
