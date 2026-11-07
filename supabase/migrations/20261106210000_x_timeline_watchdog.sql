-- Email watchdog for the x-timeline-poll FxTwitter poller (IFTTT-TO-FXTWITTER-CUTOVER debrief). pg_cron runs
-- public.x_timeline_watchdog() every 5 minutes (see supabase/functions/x-timeline-poll/schedule.sql). It reads the
-- poller's own run results from net._http_response and emails TJ through Resend when:
--   poller_stalled            no poller result in 12 minutes (the cron runs every 2);
--   fxtwitter_down            every account failed in each of the last 3 runs (about 6 minutes);
--   account_down:<key>        a switched account (provider 'fxtwitter') failed in each of the last 8 runs;
--   switch_table_unavailable  a recent run could not read tweet_intake_providers;
--   enqueue_failing:<key>     a switched account's queue insert failed in each of the last 3 runs.
-- One email per new incident, a reminder every 6 hours while it lasts, and a recovery email when it clears.
-- Secrets live only in Vault, added by TJ: 'resend_api_key' and 'x_timeline_alert_recipient'. Until both exist, it
-- records state and sends nothing (the pending alert goes out once they are added).
-- Modes: select public.x_timeline_watchdog('dry_run');    -- evaluate only: no state change, no email
--        select public.x_timeline_watchdog('test_email'); -- send one test email
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.x_timeline_alert_state (
  alert_key text primary key check (btrim(alert_key) <> ''),
  active boolean not null default false,
  first_seen_at timestamptz,
  last_sent_at timestamptz,
  cleared_at timestamptz,
  detail jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.x_timeline_alert_state is
  'Open and recent incidents for the x-timeline-poll email watchdog (public.x_timeline_watchdog).';

alter table public.x_timeline_alert_state enable row level security;
revoke all on table public.x_timeline_alert_state from public, anon, authenticated;
grant select, insert, update, delete on table public.x_timeline_alert_state to service_role;

create or replace function public.x_timeline_watchdog(p_mode text default 'run')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent jsonb;
  v_last_run timestamptz;
  v_active jsonb := '{}'::jsonb;
  v_key text;
  v_detail jsonb;
  v_alerts text[];
  v_recovered text[];
  v_api_key text;
  v_recipient text;
  v_subject text;
  v_lines text[] := '{}';
  v_request_id bigint;
  r record;
begin
  if p_mode not in ('run', 'dry_run', 'test_email') then
    raise exception 'x_timeline_watchdog: unknown mode %', p_mode;
  end if;

  -- The poller's responses start with {"ok":..,"providers":..}; other pg_net callers do not.
  select coalesce(jsonb_agg(jsonb_build_object('created', created, 'body', content::jsonb) order by created desc), '[]'::jsonb)
    into v_recent
  from (
    select created, content from net._http_response
    where created > now() - interval '30 minutes' and content like '{"ok":%"providers"%'
    order by created desc
    limit 15
  ) recent;
  select max(created) into v_last_run from net._http_response where content like '{"ok":%"providers"%';

  if not exists (select 1 from jsonb_array_elements(v_recent) e where (e->>'created')::timestamptz > now() - interval '12 minutes') then
    v_active := v_active || jsonb_build_object('poller_stalled', jsonb_build_object(
      'note', 'No poller result in the last 12 minutes (pg_cron runs it every 2).', 'last_result_at', v_last_run));
  end if;

  if (select count(*) from jsonb_array_elements(v_recent) with ordinality t(e, i)
      where i <= 3 and (e->>'created')::timestamptz > now() - interval '12 minutes'
        and jsonb_array_length(coalesce(e->'body'->'results', '[]'::jsonb)) > 0
        and not exists (select 1 from jsonb_array_elements(e->'body'->'results') x where (x->>'ok')::boolean)) = 3 then
    v_active := v_active || jsonb_build_object('fxtwitter_down', jsonb_build_object(
      'note', 'Every account failed in each of the last 3 runs (about 6 minutes): FxTwitter looks down.'));
  end if;

  for r in select source_key from public.tweet_intake_providers where provider = 'fxtwitter' order by source_key loop
    if (select count(*) from jsonb_array_elements(v_recent) with ordinality t(e, i)
        where i <= 8 and (e->>'created')::timestamptz > now() - interval '20 minutes'
          and exists (select 1 from jsonb_array_elements(e->'body'->'results') x
                      where x->>'sourceKey' = r.source_key and not (x->>'ok')::boolean)) = 8 then
      v_active := v_active || jsonb_build_object('account_down:' || r.source_key, jsonb_build_object(
        'note', format('%s is switched to the scraper and failed in each of the last 8 runs (about 16 minutes). '
          'Its IFTTT deliveries are being dropped, so its posts are not reaching the queue.', r.source_key)));
    end if;
    if (select count(*) from jsonb_array_elements(v_recent) with ordinality t(e, i)
        where i <= 3 and (e->>'created')::timestamptz > now() - interval '12 minutes'
          and exists (select 1 from jsonb_array_elements(e->'body'->'results') x
                      where x->>'sourceKey' = r.source_key and x ? 'enqueueError')) = 3 then
      v_active := v_active || jsonb_build_object('enqueue_failing:' || r.source_key, jsonb_build_object(
        'note', format('Queue inserts for %s failed in each of the last 3 runs.', r.source_key)));
    end if;
  end loop;

  if exists (select 1 from jsonb_array_elements(v_recent) with ordinality t(e, i)
             where i <= 3 and e->'body'->>'providers' = 'unavailable') then
    v_active := v_active || jsonb_build_object('switch_table_unavailable', jsonb_build_object(
      'note', 'A recent poller run could not read tweet_intake_providers, so switched accounts were not queued.'));
  end if;

  if p_mode = 'dry_run' then
    return jsonb_build_object('mode', p_mode, 'active', v_active, 'last_result_at', v_last_run,
      'email_configured', exists (select 1 from vault.decrypted_secrets where name = 'resend_api_key')
        and exists (select 1 from vault.decrypted_secrets where name = 'x_timeline_alert_recipient'));
  end if;

  if p_mode = 'run' then
    for v_key, v_detail in select key, value from jsonb_each(v_active) loop
      insert into public.x_timeline_alert_state as s (alert_key, active, first_seen_at, detail, updated_at)
      values (v_key, true, now(), v_detail, now())
      on conflict (alert_key) do update set
        active = true,
        first_seen_at = case when s.active then s.first_seen_at else now() end,
        detail = excluded.detail,
        updated_at = now();
    end loop;
    select coalesce(array_agg(alert_key order by alert_key), '{}') into v_alerts from public.x_timeline_alert_state
    where active and (last_sent_at is null or last_sent_at < first_seen_at or last_sent_at < now() - interval '6 hours');
    -- Recovery mail only for incidents that were actually emailed.
    select coalesce(array_agg(alert_key order by alert_key), '{}') into v_recovered from public.x_timeline_alert_state
    where active and not (v_active ? alert_key) and last_sent_at is not null and last_sent_at >= first_seen_at;
    update public.x_timeline_alert_state set active = false, cleared_at = now(), updated_at = now()
    where active and not (v_active ? alert_key);
    if cardinality(v_alerts) = 0 and cardinality(v_recovered) = 0 then
      return jsonb_build_object('mode', p_mode, 'active', v_active, 'sent', false);
    end if;
  end if;

  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into v_recipient from vault.decrypted_secrets where name = 'x_timeline_alert_recipient';
  if v_api_key is null or v_recipient is null then
    return jsonb_build_object('mode', p_mode, 'active', v_active, 'sent', false, 'email', 'not_configured');
  end if;

  if p_mode = 'test_email' then
    v_subject := '[FHFH] X poller watchdog: test email';
    v_lines := array['This is a test from public.x_timeline_watchdog(). Alerts for the FxTwitter poller will arrive like this.',
      '', 'Currently active conditions: ' || case when v_active = '{}'::jsonb then 'none' else v_active::text end];
  else
    v_subject := '[FHFH] X poller: ' || case when cardinality(v_alerts) > 0
      then 'PROBLEM ' || array_to_string(v_alerts, ', ') else 'recovered ' || array_to_string(v_recovered, ', ') end;
    foreach v_key in array v_alerts loop
      v_lines := v_lines || format('PROBLEM %s: %s', v_key,
        (select detail->>'note' from public.x_timeline_alert_state where alert_key = v_key));
    end loop;
    foreach v_key in array v_recovered loop
      v_lines := v_lines || format('RECOVERED %s', v_key);
    end loop;
    v_lines := v_lines || array['',
      'Last poller result: ' || coalesce(v_last_run::text, 'none in the last 6 hours'),
      'Fall back to IFTTT for a switched account: update public.tweet_intake_providers set provider = ''ifttt'' where source_key = ''<key>'';',
      'Latest runs: select created, left(content, 400) from net._http_response where content like ''{"ok":%"providers"%'' order by created desc limit 5;'];
  end if;

  select net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object('from', 'FHFH X poller <x-poller@fhfhockey.com>', 'to', jsonb_build_array(v_recipient),
      'subject', v_subject, 'text', array_to_string(v_lines, E'\n')),
    params := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_api_key),
    timeout_milliseconds := 10000
  ) into v_request_id;

  if p_mode = 'run' then
    update public.x_timeline_alert_state set last_sent_at = now(), updated_at = now() where alert_key = any(v_alerts);
  end if;
  return jsonb_build_object('mode', p_mode, 'active', v_active, 'sent', true, 'alerted', v_alerts,
    'recovered', coalesce(v_recovered, '{}'), 'request_id', v_request_id);
end;
$$;

revoke all on function public.x_timeline_watchdog(text) from public, anon, authenticated;
grant execute on function public.x_timeline_watchdog(text) to service_role;
