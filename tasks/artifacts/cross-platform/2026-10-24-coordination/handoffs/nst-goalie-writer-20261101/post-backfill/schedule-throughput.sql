select statement_timestamp() as checked_at,
(select jsonb_agg(to_jsonb(j)) from (select jobid,jobname,schedule,active from cron.job where jobname in ('update-nst-goalies','route-runner-tick','daily-cron-report') order by jobid limit 10) j) as schedule,
(select jsonb_agg(to_jsonb(a) order by run_time) from (select job_name,run_time,status,rows_affected,
details->>'durationMs' as duration_ms,details->>'statusCode' as status_code,
substring(details->>'response' from '"pendingUrlsProcessed"\s*:\s*([0-9]+)') as pending_urls_processed,
substring(details->>'response' from '"totalQueuedUrls"\s*:\s*([0-9]+)') as total_queued_urls,
substring(details->>'response' from '"datesQueued"\s*:\s*([0-9]+)') as dates_queued,
substring(details->>'response' from '"requestIntervalMs"\s*:\s*([0-9]+)') as interval_ms,
substring(details->>'response' from '"maxPendingUrls"\s*:\s*([0-9]+)') as max_pending_urls,
substring(details->>'response' from '"nextStartDate"\s*:\s*"([^"]+)"') as next_start_date,
details->'responseOutcome' as outcome
from public.cron_job_audit where job_name in ('update-nst-goalies','/api/v1/db/update-nst-goalies') and run_time >= timestamptz '2026-10-27 00:00:00+00' and run_time <= statement_timestamp()
order by run_time desc limit 20) a) as writer_receipts
