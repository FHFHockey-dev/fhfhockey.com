-- High-visibility emails for the x-timeline-poll watchdog (replaces public.x_timeline_watchdog from
-- 20261106210000_x_timeline_watchdog.sql; detection rules, state and modes are unchanged). TJ asked for alerts that
-- cannot be missed: problem emails get a 🚨 subject and a red HTML banner with what to do; reminders say STILL BROKEN;
-- recoveries (✅) and tests (🧪) stay calm. No IFTTT fallback is offered: TJ is removing IFTTT, and the fallback
-- is a second scraper (in design).
-- Plain text is kept alongside the HTML. New mode 'test_alert' sends a
-- sample problem email, marked SAMPLE, without touching alert state:
--   select public.x_timeline_watchdog('test_alert');
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- A readable name for an alert key.
create or replace function public.x_timeline_watchdog_label(p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_key = 'poller_stalled' then 'The X poller has stopped'
    when p_key = 'fxtwitter_down' then 'FxTwitter is down for every account'
    when p_key = 'switch_table_unavailable' then 'The intake switch table cannot be read'
    when p_key like 'account_down:%' then split_part(p_key, ':', 2) || ' is not getting posts'
    when p_key like 'enqueue_failing:%' then split_part(p_key, ':', 2) || ' posts are failing to queue'
    when p_key = 'test' then 'Test'
    else p_key end;
$$;

revoke all on function public.x_timeline_watchdog_label(text) from public, anon, authenticated;
grant execute on function public.x_timeline_watchdog_label(text) to service_role;

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
  v_new text[];
  v_reminders text[];
  v_recovered text[];
  v_since timestamptz;
  v_notes jsonb := '{}'::jsonb;
  v_api_key text;
  v_recipient text;
  v_subject text;
  v_lines text[] := '{}';
  v_html text;
  v_items text := '';
  v_request_id bigint;
  r record;
begin
  if p_mode not in ('run', 'dry_run', 'test_email', 'test_alert') then
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
          'Its posts are not reaching the queue; the poller queues the ones it missed once FxTwitter answers again '
          '(up to 20 per account).', r.source_key)));
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
    select coalesce(array_agg(alert_key order by alert_key) filter (where last_sent_at is null or last_sent_at < first_seen_at), '{}'),
           coalesce(array_agg(alert_key order by alert_key) filter (where last_sent_at >= first_seen_at), '{}'),
           min(first_seen_at)
      into v_new, v_reminders, v_since
    from public.x_timeline_alert_state where alert_key = any(v_alerts);
    -- Recovery mail only for incidents that were actually emailed.
    select coalesce(array_agg(alert_key order by alert_key), '{}') into v_recovered from public.x_timeline_alert_state
    where active and not (v_active ? alert_key) and last_sent_at is not null and last_sent_at >= first_seen_at;
    update public.x_timeline_alert_state set active = false, cleared_at = now(), updated_at = now()
    where active and not (v_active ? alert_key);
    if cardinality(v_alerts) = 0 and cardinality(v_recovered) = 0 then
      return jsonb_build_object('mode', p_mode, 'active', v_active, 'sent', false);
    end if;
    select coalesce(jsonb_object_agg(alert_key, detail), '{}'::jsonb) into v_notes
    from public.x_timeline_alert_state where alert_key = any(v_alerts);
  elsif p_mode = 'test_alert' then
    v_alerts := array['account_down:nhl_rosters'];
    v_new := v_alerts;
    v_recovered := '{}';
    v_since := now();
    v_notes := jsonb_build_object('account_down:nhl_rosters', jsonb_build_object('note',
      'SAMPLE ONLY, nothing is wrong. A real alert would say: nhl_rosters is switched to the scraper and failed in each of the last 8 runs.'));
  end if;

  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into v_recipient from vault.decrypted_secrets where name = 'x_timeline_alert_recipient';
  if v_api_key is null or v_recipient is null then
    return jsonb_build_object('mode', p_mode, 'active', v_active, 'sent', false, 'email', 'not_configured');
  end if;

  if p_mode = 'test_email' then
    v_subject := '🧪 TEST: FHFH X poller watchdog';
    v_lines := array['🧪 Test email from public.x_timeline_watchdog(). Nothing is wrong.',
      'Real problems arrive with a 🚨 ACTION NEEDED subject and a red banner.',
      '', 'Currently active conditions: ' || case when v_active = '{}'::jsonb then 'none' else v_active::text end];
    v_html := '<div style="font-family:Arial,sans-serif;max-width:640px">'
      || '<div style="background:#1f4e8c;color:#fff;padding:16px 20px;border-radius:6px;font-size:20px;font-weight:bold">'
      || '🧪 Test: FHFH X poller watchdog</div>'
      || '<p style="font-size:15px">Nothing is wrong. Real problems arrive with a <b>🚨 ACTION NEEDED</b> subject and a red banner like this:</p>'
      || '<div style="background:#c62828;color:#fff;padding:10px 16px;border-radius:6px;font-weight:bold">'
      || '🚨🚨 ACTION NEEDED: example 🚨🚨</div></div>';
  elsif cardinality(v_alerts) > 0 then
    v_subject := case when p_mode = 'test_alert' then '[SAMPLE] ' else '' end
      || case when cardinality(v_new) > 0 then '🚨 ACTION NEEDED: ' else '⏰🚨 STILL BROKEN: ' end
      || 'FHFH X poller: ' || (select string_agg(public.x_timeline_watchdog_label(a), '; ' order by a) from unnest(v_alerts) a);
    v_lines := array[case when cardinality(v_new) > 0 then '🚨🚨🚨 ACTION NEEDED 🚨🚨🚨'
      else '⏰🚨 STILL BROKEN (reminder, every 6 hours while it lasts) 🚨⏰' end, ''];
    foreach v_key in array v_alerts loop
      v_detail := coalesce(v_notes->v_key, '{}'::jsonb);
      v_lines := v_lines || format('⚠️ %s: %s', public.x_timeline_watchdog_label(v_key), v_detail->>'note');
      v_items := v_items || format('<li style="margin:8px 0"><b>⚠️ %s</b><br>%s</li>',
        public.x_timeline_watchdog_label(v_key), v_detail->>'note');
    end loop;
    foreach v_key in array v_recovered loop
      v_lines := v_lines || format('✅ Recovered: %s', public.x_timeline_watchdog_label(v_key));
      v_items := v_items || format('<li style="margin:8px 0;color:#2e7d32"><b>✅ Recovered:</b> %s</li>',
        public.x_timeline_watchdog_label(v_key));
    end loop;
    v_lines := v_lines || array['',
      '👉 WHAT TO DO',
      '1. Check FxTwitter: https://api.fxtwitter.com/2/profile/NHL_Rosters/statuses?count=1',
      '2. Missed posts are not lost yet: when FxTwitter answers again, the poller queues the posts it missed (up to 20 per account).',
      '3. If it stays down for hours, especially near game time, start the fallback scraper or ask Claude to.',
      '4. Latest poller runs: select created, left(content, 400) from net._http_response where content like ''{"ok":%"providers"%'' order by created desc limit 5;',
      '',
      'Problem since: ' || coalesce(to_char(v_since at time zone 'America/New_York', 'Mon DD HH12:MI AM') || ' ET', 'unknown')
        || '. Last poller result: ' || coalesce(to_char(v_last_run at time zone 'America/New_York', 'Mon DD HH12:MI AM') || ' ET', 'none in 6 hours') || '.'];
    v_html := '<div style="font-family:Arial,sans-serif;max-width:640px">'
      || '<div style="background:#c62828;color:#fff;padding:18px 20px;border-radius:6px;font-size:22px;font-weight:bold">'
      || case when cardinality(v_new) > 0 then '🚨🚨 ACTION NEEDED: FHFH X poller 🚨🚨'
           else '⏰🚨 STILL BROKEN: FHFH X poller' end || '</div>'
      || case when p_mode = 'test_alert' then '<p style="color:#555;font-size:13px">🧪 Sample of a real alert. Nothing is wrong.</p>' else '' end
      || '<ul style="font-size:15px;padding-left:20px">' || v_items || '</ul>'
      || '<div style="border-left:4px solid #c62828;border-radius:4px 6px 6px 4px;background:#fff4f4;padding:12px 16px;font-size:15px">'
      || '<b>👉 What to do</b><ol style="margin:8px 0 0 0;padding-left:20px">'
      || '<li>Check FxTwitter: <a href="https://api.fxtwitter.com/2/profile/NHL_Rosters/statuses?count=1">api.fxtwitter.com</a></li>'
      || '<li>Missed posts are not lost yet: when FxTwitter answers again, the poller queues the posts it missed (up to 20 per account).</li>'
      || '<li><b>If it stays down for hours</b>, especially near game time, start the fallback scraper or ask Claude to.</li>'
      || '<li>Look at the latest poller runs in <code>net._http_response</code>.</li></ol></div>'
      || '<p style="color:#555;font-size:13px">Problem since '
      || coalesce(to_char(v_since at time zone 'America/New_York', 'Mon DD HH12:MI AM') || ' ET', 'unknown')
      || '. Last poller result '
      || coalesce(to_char(v_last_run at time zone 'America/New_York', 'Mon DD HH12:MI AM') || ' ET', 'none in 6 hours')
      || '.</p></div>';
  else
    v_subject := '✅ Resolved: FHFH X poller: '
      || (select string_agg(public.x_timeline_watchdog_label(a), '; ' order by a) from unnest(v_recovered) a);
    v_lines := array['✅ Resolved. The X poller is healthy again.', ''];
    foreach v_key in array v_recovered loop
      v_lines := v_lines || format('✅ %s: cleared', public.x_timeline_watchdog_label(v_key));
      v_items := v_items || format('<li>✅ %s: cleared</li>', public.x_timeline_watchdog_label(v_key));
    end loop;
    v_html := '<div style="font-family:Arial,sans-serif;max-width:640px">'
      || '<div style="background:#2e7d32;color:#fff;padding:14px 20px;border-radius:6px;font-size:18px;font-weight:bold">'
      || '✅ Resolved: FHFH X poller</div><ul style="font-size:15px">' || v_items || '</ul></div>';
  end if;

  select net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object('from', 'FHFH X poller <x-poller@fhfhockey.com>', 'to', jsonb_build_array(v_recipient),
      'subject', v_subject, 'text', array_to_string(v_lines, E'\n'), 'html', v_html),
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
