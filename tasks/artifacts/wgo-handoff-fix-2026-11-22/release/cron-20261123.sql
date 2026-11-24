select cron.schedule('forge-daily-acceptance-20261123', '15 11 23 11 *', $cmd$
  select net.http_get(
    url := 'https://fhfhockey.com/api/v1/db/forge-daily-acceptance?runDate=2026-11-23&sourceDate=2026-11-22&kind=control',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 300000);
$cmd$);
