-- TJ pop-up 2026-11-23: read-only acceptance checks for the Tue and Wed natural runs. Each removes itself after queuing its call.
select cron.schedule('forge-daily-acceptance-20261124', '15 11 24 11 *', $cmd$
  select net.http_get(
    url := 'https://fhfhockey.com/api/v1/db/forge-daily-acceptance?runDate=2026-11-24&sourceDate=2026-11-23&kind=control',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 300000);
  select cron.unschedule('forge-daily-acceptance-20261124');
$cmd$);
select cron.schedule('forge-daily-acceptance-20261125', '15 11 25 11 *', $cmd$
  select net.http_get(
    url := 'https://fhfhockey.com/api/v1/db/forge-daily-acceptance?runDate=2026-11-25&sourceDate=2026-11-24&kind=control',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 300000);
  select cron.unschedule('forge-daily-acceptance-20261125');
$cmd$);
