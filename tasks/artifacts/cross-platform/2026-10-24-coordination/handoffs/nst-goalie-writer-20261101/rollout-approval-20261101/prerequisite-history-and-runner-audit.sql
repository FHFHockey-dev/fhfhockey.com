-- One bounded read: named migration history and at most twelve receipts from this one legacy job window.
select statement_timestamp() as checked_at,
 (select coalesce(jsonb_agg(jsonb_build_object('version',to_jsonb(m)->>'version','name',to_jsonb(m)->>'name')),'[]'::jsonb)
  from (select * from supabase_migrations.schema_migrations where version in ('20261020224500','20261022133743','20261101161622') order by version limit 3) m) as migration_history,
 (select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
  select job_name,run_time,status,rows_affected,details->>'statusCode' as status_code,
   details->>'responseTruncated' as response_truncated,
   substring(details->>'response' from '"pendingUrlsProcessed":([0-9]+)') as pending_urls_processed,
   substring(details->>'response' from '"totalQueuedUrls":([0-9]+)') as queued_urls,
   substring(details->>'response' from '"nextStartDate":("[0-9-]+"|null)') as next_start_date,
   substring(details->>'response' from '"stoppedEarly":(true|false)') as stopped_early,
   left(regexp_replace(regexp_replace(details->>'response','https?://[^[:space:]"<>]+','[URL]','g'),'[A-Za-z0-9_-]{80,}','[REDACTED]','g'),1800) as response_preview_redacted
  from public.cron_job_audit where job_name in ('/api/v1/db/update-nst-goalies','update-nst-goalies')
   and run_time>=timestamptz '2026-11-01 14:39:00+00' and run_time<=timestamptz '2026-11-01 15:10:00+00'
  order by run_time desc limit 12
 ) r) as bounded_audits;
