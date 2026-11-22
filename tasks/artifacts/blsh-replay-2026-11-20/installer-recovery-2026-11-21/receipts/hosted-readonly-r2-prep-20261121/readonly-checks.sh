#!/bin/bash
# Read-only production checks for BLSH R2 prep (TJ 12:05 CT: "already-authorized read-only checks now"). Starts after the Codex slot.
set -u
OUT=$1; PG=/Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-pregame-capture-2026-11-14/operator/pgpool.sh
D=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-replay-2026-11-20/installer-recovery-2026-11-21
while [[ $(date -u +%H%M) < 1816 ]]; do sleep 20; done
echo "start $(date -u +%H:%M:%SZ)" > "$OUT/steps.log"
git -C /Users/tim/Code/fhfhockey.com ls-remote origin refs/heads/master > "$OUT/ls-remote.txt" 2>&1
PGAPPNAME=blsh-r2-readonly "$PG" "sslmode=require" -A -t -q -v app=none -v pid=0 -v bstart=epoch -v astart=epoch -v full=off -f "$D/state-probe.sql" > "$OUT/state-probe.json" 2> "$OUT/state-probe.err"; echo "probe exit $?" >> "$OUT/steps.log"
PGAPPNAME=blsh-r2-readonly "$PG" "sslmode=require" -A -t -q > "$OUT/preflight.json" 2> "$OUT/preflight.err" <<'SQL'
begin transaction read only;
set local statement_timeout = '20s';
select json_build_object(
  'utc', now() at time zone 'UTC',
  'openXactsOlderThan1h', (select count(*) from pg_stat_activity where xact_start < now() - interval '1 hour' and pid <> pg_backend_pid()),
  'blshReplayJobs', (select count(*) from cron.job where jobname like 'blsh-replay-%'),
  'blshJobsActive', (select coalesce(json_agg(json_build_object('jobid',jobid,'jobname',jobname,'active',active,'schedule',schedule) order by jobid),'[]') from cron.job where jobname ilike '%blsh%'),
  'forgeLiveJobs', (select count(*) from cron.job where jobname like 'forge-live-%'),
  'job408Active', (select active from cron.job where jobid = 408),
  'redateMigrationApplied', (select count(*) from supabase_migrations.schema_migrations where version = '20261120143000'),
  'vaultCronSecretRows', (select count(*) from vault.secrets where name = 'cron_secret'),
  'cronTz', current_setting('cron.timezone', true)
);
rollback;
SQL
echo "preflight exit $?" >> "$OUT/steps.log"; echo "end $(date -u +%H:%M:%SZ)" >> "$OUT/steps.log"
