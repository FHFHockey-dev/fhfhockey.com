-- TJ-approved (pop-up, 2026-11-22 ~02:1xZ): two pg_cron jobs calling the read-only acceptance route once each.
-- Pattern copied from job 361 (vault cron_secret). Schedules are date-specific; remove both after Nov 27.
select cron.schedule('forge-daily-acceptance-20261122', '15 11 22 11 *', $cmd$
  select net.http_get(
    url := 'https://fhfhockey.com/api/v1/db/forge-daily-acceptance?runDate=2026-11-22&sourceDate=2026-11-21&kind=control',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 300000);
$cmd$);
select cron.schedule('forge-daily-acceptance-20261127', '15 11 27 11 *', $cmd$
  select net.http_get(
    url := 'https://fhfhockey.com/api/v1/db/forge-daily-acceptance?runDate=2026-11-27&sourceDate=2026-11-26&kind=offday',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 300000);
$cmd$);
