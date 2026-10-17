-- P-B recovery verification. READ-ONLY. Run once after 2026-10-18 10:55 UTC.
-- Replace the date literals for later days. Recovery is verified only if all
-- four checks pass.
begin read only;
set local statement_timeout = '8s';

-- 1. Matview refresh finished before the baseline rebuild started.
select status, start_time, end_time, (end_time < '2026-10-18 10:40:00+00') as before_baselines
from cron.job_run_details
where jobid = 374 and start_time >= '2026-10-18' and start_time < '2026-10-19'
limit 2;

-- 2. Route receipt (cron_job_audit has no index: one bounded scan).
select run_time, status, rows_affected, details::jsonb->>'statusCode' as code,
       left(details::jsonb->>'response', 200) as response_head
from cron_job_audit
where job_name = '/api/v1/db/sustainability/rebuild-baselines'
  and run_time >= '2026-10-18' and run_time < '2026-10-19'
limit 2;

-- 3. Complete snapshot: baseline rows equal the route's candidate player set.
select
  (select count(*) from public.player_baselines where snapshot_date = '2026-10-18') as baselines,
  (select count(distinct player_id) from public.player_stats_unified
    where date >= '2025-10-18' and player_id is not null) as candidates;

-- 4. Window-z coverage for the snapshot (sum of the three Vercel offsets).
select sum((substring(details::jsonb->>'response' from '"processed_players":([0-9]+)'))::int) as window_z_players
from cron_job_audit
where job_name = '/api/v1/sustainability/rebuild-window-z'
  and run_time >= '2026-10-18 10:40' and run_time < '2026-10-18 11:00';

commit;
