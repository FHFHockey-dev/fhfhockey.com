select statement_timestamp() as checked_at,
 (select jsonb_agg(to_jsonb(j)) from (
  select id,route_path,contract,status,created_at,updated_at,not_before,lease_until,expires_at,steps,kills,last_status_code,last_operation_status,finished_at
  from public.route_runner_jobs
  where route_path ilike '%nst%' and (status not in ('completed','cancelled','failed','expired') or updated_at>=timestamptz '2026-10-27 00:00:00+00')
  order by updated_at desc limit 25
 ) j) as nst_runner_jobs,
 (select jsonb_agg(to_jsonb(j)) from (
  select jobid,status,start_time,end_time
  from cron.job_run_details
  where jobid in (99,220,328,329,399) and start_time>=statement_timestamp()-interval '15 minutes'
  order by start_time desc limit 30
 ) j) as recent_scheduler_execution
