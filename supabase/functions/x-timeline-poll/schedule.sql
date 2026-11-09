-- NOT a migration. Applied to production 2026-11-05 with TJ's approval. Requires pg_cron and pg_net.
-- The secret was generated inside Postgres, so nobody handles the value:
--   select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
--     'x_timeline_poll_secret', 'x-timeline-poll cron auth; generated in Postgres');
-- The function checks the header with public.x_timeline_poll_secret_matches (migration 20261106012951).
-- Every 2 minutes: 7 FxTwitter requests per run, about 22k function calls a month.
select cron.schedule(
  'x-timeline-poll',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://fyhftlxokyjtpndbkfse.supabase.co/functions/v1/x-timeline-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-fhfh-poll-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'x_timeline_poll_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
-- Stop: select cron.unschedule('x-timeline-poll');

-- Email watchdog (migration 20261106210000_x_timeline_watchdog): every 5 minutes, reads the poller's results and
-- emails TJ through Resend on an outage, a stall or a recovery. Needs Vault 'resend_api_key' and
-- 'x_timeline_alert_recipient', added by TJ.
select cron.schedule('x-timeline-watchdog', '*/5 * * * *', $$select public.x_timeline_watchdog()$$);
-- Stop: select cron.unschedule('x-timeline-watchdog');

-- Poller run history for the cron report (migration 20261106201221_x_timeline_poll_runs, cron-report lane 2): every
-- 5 minutes, copies the poller's results and the job's runs before pg_net's ~6 h retention drops them.
select cron.schedule('x-timeline-poll-capture', '*/5 * * * *', $$select public.x_timeline_capture_poll_runs()$$);
-- Stop: select cron.unschedule('x-timeline-poll-capture');
