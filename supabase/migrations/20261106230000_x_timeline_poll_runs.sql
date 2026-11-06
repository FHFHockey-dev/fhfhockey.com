-- Daily cron report support (cron-report lane 2): durable poller-run history and a daily tweet-review backlog
-- snapshot. NOT applied: TJ applies it by hand, then adds the capture cron line from
-- supabase/functions/x-timeline-poll/schedule.sql.
--
-- 1. public.x_timeline_poll_runs: one row per account per x-timeline-poll run. pg_net keeps only about 6 hours of
--    net._http_response, so public.x_timeline_capture_poll_runs() copies the poller's response bodies here. pg_cron
--    runs it every 15 minutes. The bodies are the ones public.x_timeline_watchdog() reads: {"ok","providers","results"}.
--    Bodies from before v5 have no "providers" key, so the filter only requires "results".
--    About 5k rows a day; rows older than 35 days are deleted on each capture.
-- 2. public.tweet_review_backlog_snapshots: one row per UTC day of the review-backlog counts, written by the daily
--    cron report so it can show the change since yesterday.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.x_timeline_poll_runs (
  response_id bigint not null,
  source_key text not null check (btrim(source_key) <> ''),
  run_at timestamptz not null,
  providers_state text,
  ok boolean not null,
  http_status integer,
  attempts integer,
  seen integer,
  inserted integer,
  hydrated integer,
  enqueued integer,
  enqueue_error text,
  error text,
  captured_at timestamptz not null default now(),
  primary key (response_id, source_key)
);

create index if not exists x_timeline_poll_runs_run_at_idx on public.x_timeline_poll_runs (run_at desc);

comment on table public.x_timeline_poll_runs is
  'Per-account results of each x-timeline-poll run, copied from net._http_response by x_timeline_capture_poll_runs().';

alter table public.x_timeline_poll_runs enable row level security;
revoke all on table public.x_timeline_poll_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.x_timeline_poll_runs to service_role;

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
      attempts, seen, inserted, hydrated, enqueued, enqueue_error, error)
    select r.id, x->>'sourceKey', r.created, v_body->>'providers', coalesce((x->>'ok')::boolean, false),
      (x->>'status')::integer, (x->>'attempts')::integer, (x->>'seen')::integer, (x->>'inserted')::integer,
      (x->>'hydrated')::integer, (x->>'enqueued')::integer, x->>'enqueueError', x->>'error'
    from jsonb_array_elements(v_body->'results') x
    where coalesce(btrim(x->>'sourceKey'), '') <> ''
    on conflict (response_id, source_key) do nothing;
    get diagnostics v_count = row_count;
    v_inserted := v_inserted + v_count;
  end loop;

  delete from public.x_timeline_poll_runs where run_at < now() - interval '35 days';
  get diagnostics v_purged = row_count;
  return jsonb_build_object('since', v_since, 'inserted', v_inserted, 'skipped', v_skipped, 'purged', v_purged);
end;
$$;

revoke all on function public.x_timeline_capture_poll_runs() from public, anon, authenticated;
grant execute on function public.x_timeline_capture_poll_runs() to service_role;

create table if not exists public.tweet_review_backlog_snapshots (
  snapshot_date date primary key,
  counts jsonb not null,
  captured_at timestamptz not null default now()
);

comment on table public.tweet_review_backlog_snapshots is
  'Daily tweet-review backlog counts (swipe-trainer queue by type, answer-key labels, unresolved names), written by the cron report.';

alter table public.tweet_review_backlog_snapshots enable row level security;
revoke all on table public.tweet_review_backlog_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.tweet_review_backlog_snapshots to service_role;
