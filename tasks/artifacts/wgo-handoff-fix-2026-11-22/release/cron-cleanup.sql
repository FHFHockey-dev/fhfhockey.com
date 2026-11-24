-- TJ approved removing the date-specific acceptance jobs. 429 (Nov 22) has run; 430 (Nov 27) and 431 (Nov 23) must run first,
-- so a one-shot cleanup job removes them, and itself, on Nov 28 at 12:00 UTC (cron schedules recur yearly otherwise).
select cron.unschedule('forge-daily-acceptance-20261122');
select cron.schedule('forge-daily-acceptance-cleanup-20261128', '0 12 28 11 *', $cmd$
  select cron.unschedule('forge-daily-acceptance-20261123');
  select cron.unschedule('forge-daily-acceptance-20261127');
  select cron.unschedule('forge-daily-acceptance-cleanup-20261128');
$cmd$);
