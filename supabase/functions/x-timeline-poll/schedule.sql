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
