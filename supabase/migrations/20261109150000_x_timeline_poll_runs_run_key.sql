-- Poller run capture keeps every run (fixes 20261106201221_x_timeline_poll_runs). Applied 2026-11-09 by TJ in the SQL editor.
--
-- Why: x_timeline_capture_poll_runs() copies poller bodies from net._http_response keyed by (response_id,
-- source_key). pg_net's response ids are not unique over time: they restarted at 1 on 2026-11-06 20:32, 11-07 23:26,
-- 11-08 00:20 and 11-09 00:08 UTC. After each restart a new run whose id an older captured run already used hit the
-- primary key, and "on conflict do nothing" dropped it without a trace, so the 35-day history kept fewer runs each
-- day. On 2026-11-09 08:10-14:10 pg_net held all 180 poller bodies, but only 45 became rows; the other 135 ids
-- were already taken by earlier captured runs (from 11-07 to 11-09). The cron report then counted those runs as "missed" and showed
-- capture gaps (72 minutes from 02:48 UTC) while the poller ran every 2 minutes and stored posts.
--
-- Fix: the key gains run_at, the response's own pg_net timestamp, so a reused id is a new run. Rows already
-- captured keep their values (the old key was unique, so the new one is too). The function body is the
-- 20261106201221 body with only the conflict target changed; it restates search_path, because CREATE OR REPLACE resets it.
-- Runs dropped before this applies cannot be recovered once pg_net's ~6 h retention has passed; this migration
-- does not backfill.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.x_timeline_poll_runs
  drop constraint x_timeline_poll_runs_pkey,
  add constraint x_timeline_poll_runs_pkey primary key (run_at, response_id, source_key);

comment on table public.x_timeline_poll_runs is
  'Per-account results of each x-timeline-poll run, copied from net._http_response by x_timeline_capture_poll_runs(). One run is (run_at, response_id): pg_net reuses response ids after a restart.';

create or replace function public.x_timeline_capture_poll_runs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
  v_body jsonb;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_count integer;
  v_purged integer;
  v_jobid bigint;
  v_last_runid bigint;
  v_first boolean;
  v_job_runs integer := 0;
  r record;
begin
  -- Re-read a 10-minute overlap; the primary key makes the copy idempotent.
  select coalesce(max(run_at) - interval '10 minutes', now() - interval '7 hours') into v_since
  from public.x_timeline_poll_runs;

  for r in
    select id, created, content from net._http_response
    where created >= v_since and content like '{"ok":%"results":[{"sourceKey"%'
    order by created
  loop
    begin
      v_body := r.content::jsonb;
    exception when others then
      v_skipped := v_skipped + 1;
      continue;
    end;
    insert into public.x_timeline_poll_runs (response_id, source_key, run_at, providers_state, ok, http_status,
      attempts, seen, inserted, hydrated, enqueued, enqueue_error, error, via, gap_state, gap_pages)
    select r.id, x->>'sourceKey', r.created, v_body->>'providers', coalesce((x->>'ok')::boolean, false),
      (x->>'status')::integer, (x->>'attempts')::integer, (x->>'seen')::integer, (x->>'inserted')::integer,
      (x->>'hydrated')::integer, (x->>'enqueued')::integer, x->>'enqueueError', x->>'error',
      x->>'via', x->>'gap', (x->>'gapPages')::integer
    from jsonb_array_elements(v_body->'results') x
    where coalesce(btrim(x->>'sourceKey'), '') <> ''
    on conflict (run_at, response_id, source_key) do nothing;
    get diagnostics v_count = row_count;
    v_inserted := v_inserted + v_count;
  end loop;

  -- Job runs: by runid after the last one copied. The first capture starts at pg_net's oldest stored response, so
  -- started runs and captured bodies cover the same period.
  select jobid into v_jobid from cron.job where jobname = 'x-timeline-poll';
  if v_jobid is not null then
    select max(runid) into v_last_runid from public.x_timeline_poll_job_runs;
    -- First capture: the last 5,000 runids (about 18 hours of all jobs today) keep it an index range scan.
    v_first := v_last_runid is null;
    if v_first then
      select coalesce(max(runid), 0) - 5000 into v_last_runid from cron.job_run_details;
    end if;
    insert into public.x_timeline_poll_job_runs (runid, start_time, status)
    select d.runid, d.start_time, d.status from cron.job_run_details d
    where d.runid > v_last_runid and d.jobid = v_jobid and d.start_time is not null
      and (not v_first or d.start_time >= (select coalesce(min(created), now()) from net._http_response))
    on conflict (runid) do nothing;
    get diagnostics v_job_runs = row_count;
  end if;

  delete from public.x_timeline_poll_runs where run_at < now() - interval '35 days';
  get diagnostics v_purged = row_count;
  delete from public.x_timeline_poll_job_runs where start_time < now() - interval '35 days';
  return jsonb_build_object('since', v_since, 'inserted', v_inserted, 'skipped', v_skipped, 'purged', v_purged,
    'job_runs', v_job_runs, 'jobid', v_jobid);
end;
$$;

revoke all on function public.x_timeline_capture_poll_runs() from public, anon, authenticated;
grant execute on function public.x_timeline_capture_poll_runs() to service_role;
