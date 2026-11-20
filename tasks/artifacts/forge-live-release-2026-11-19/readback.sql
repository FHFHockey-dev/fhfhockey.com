-- Read-only receipt for one live run: approval, cron runs, pg_net responses (read promptly: they expire), custody,
-- verdict, publication, readers. psql variable: game.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
select jsonb_pretty(jsonb_build_object(
  'receipt', forge_pregame_capture.live_receipt_v1(:'game'::bigint),
  'cronRuns', (select coalesce(jsonb_agg(jsonb_build_object('jobid', d.jobid, 'status', d.status, 'message', d.return_message,
      'start', d.start_time, 'end', d.end_time) order by d.start_time), '[]')
    from cron.job_run_details d where d.jobid in (select jobid from forge_pregame_capture.live_requests where game_id = :'game'::bigint)),
  'httpResponses', (select coalesce(jsonb_agg(jsonb_build_object('stage', q.stage, 'requestId', h.id, 'statusCode', h.status_code,
      'timedOut', h.timed_out, 'error', h.error_msg, 'created', h.created,
      'body', case when h.content ~ '^\s*\{' then h.content::jsonb else to_jsonb(left(h.content, 2000)) end) order by q.fired_at), '[]')
    from forge_pregame_capture.live_requests q left join net._http_response h on h.id = q.request_id where q.game_id = :'game'::bigint),
  'remainingLiveJobs', (select count(*) from cron.job where jobname like 'forge-live-%'),
  'job408Active', (select active from cron.job where jobid = 408)));
