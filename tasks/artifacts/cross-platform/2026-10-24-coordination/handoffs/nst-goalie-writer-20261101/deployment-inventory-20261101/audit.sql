with recent as materialized (
 select job_name,run_time,status,rows_affected,
   details->>'durationMs' as duration_ms,details->>'statusCode' as status_code,
   details->>'trigger' as trigger_label
 from public.cron_job_audit
 where run_time >= timestamptz '2026-10-27 00:00:00+00' and run_time <= statement_timestamp()
   and (job_name ilike '%nst%' or job_name ilike '%fetch_team_table%' or job_name ilike '%cron-report%' or job_name ilike '%rolling-forge%')
 order by run_time desc limit 200
), grouped as (
 select job_name,count(*) as receipts_in_bounded_sample,min(run_time) as first_in_sample,max(run_time) as latest_in_sample,
   count(*) filter(where status='success') as success_receipts,array_agg(distinct status) as statuses
 from recent group by job_name
)
select statement_timestamp() as checked_at,
 (select count(*) from recent) as sample_rows,
 (select jsonb_agg(to_jsonb(g)) from grouped g) as receipt_groups,
 (select jsonb_agg(to_jsonb(r)) from (select * from recent order by run_time desc limit 30) r) as latest_receipts,
 (select jsonb_agg(to_jsonb(c)) from (
   select table_name,column_name,data_type,is_nullable from information_schema.columns
   where table_schema='public' and table_name='route_runner_jobs' order by ordinal_position limit 30
 ) c) as runner_columns,
 (select command ~* '^\s*refresh\s+materialized\s+view' from cron.job where jobid=271) as job271_is_matview_refresh
