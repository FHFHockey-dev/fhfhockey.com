-- Read-only chain: cron fired → pg_net GET → route response → committed sandbox receipt. Read promptly: pg_net
-- responses expire. The bearer and the runner credential are never selected.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
select json_build_object(
  'request', (select to_jsonb(r) from forge_sandbox_capture.sandbox_get_requests r),
  'cronRuns', (select coalesce(json_agg(json_build_object('runid', d.runid, 'jobid', d.jobid, 'status', d.status,
      'returnMessage', d.return_message, 'start', d.start_time, 'end', d.end_time) order by d.start_time), '[]')
    from cron.job_run_details d where d.jobid = (select jobid from forge_sandbox_capture.sandbox_get_requests)),
  'httpResponse', (select json_build_object('id', h.id, 'statusCode', h.status_code, 'timedOut', h.timed_out, 'error', h.error_msg,
      'created', h.created, 'body', case when h.content ~ '^\s*\{' then h.content::jsonb else to_jsonb(left(h.content, 2000)) end)
    from net._http_response h where h.id = (select request_id from forge_sandbox_capture.sandbox_get_requests)),
  'receipt', forge_sandbox_capture.sandbox_receipt_v1(2099020991),
  'registeredSandboxJobs', (select count(*) from cron.job where jobname like 'forge-sandbox%'),
  'otherCronJobs', (select count(*) from cron.job where jobname not like 'forge-sandbox%'));
