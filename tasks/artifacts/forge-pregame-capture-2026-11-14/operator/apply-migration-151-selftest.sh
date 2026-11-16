#!/bin/zsh
# Local self-test of apply-migration-151.sh against a disposable PostgreSQL 15 that mimics the production shape the
# script checks (non-superuser owner, supabase_migrations ledger, cron.job_run_details, the trend-band table).
# Never touches a hosted database: PSQL_CMD points every call at the local server and the HTTP smoke is skipped.
set -u
export LC_ALL=C  # the postmaster refuses to start under a multithreaded locale setup
HERE=${0:A:h}
PG=/opt/homebrew/opt/postgresql@15/bin
PORT=55544
TMP=$(mktemp -d /tmp/m151.XXXXXX)
trap '$PG/pg_ctl -D $TMP/data -m immediate stop >/dev/null 2>&1; rm -rf $TMP' EXIT
$PG/initdb -D $TMP/data -U postgres -A trust --no-sync >/dev/null || exit 1
$PG/pg_ctl -D $TMP/data -l $TMP/log -w -o "-p $PORT -k $TMP -c listen_addresses= -c fsync=off" start >/dev/null || exit 1
$PG/psql -X -q -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U postgres -d postgres <<'SQL' || exit 1
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role supa_pg login nosuperuser; grant service_role to supa_pg;
grant create, usage on schema public to supa_pg; grant usage on schema public to service_role;
create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key,
  statements text[], name text, created_by text, idempotency_key text, rollback text[]);
grant usage on schema supabase_migrations to supa_pg; grant select, insert on supabase_migrations.schema_migrations to supa_pg;
create schema cron; create table cron.job_run_details (status text, start_time timestamptz);
grant usage on schema cron to supa_pg; grant select on cron.job_run_details to supa_pg;
create table public.sustainability_trend_bands (player_id integer not null, season_id integer, snapshot_date date not null,
  metric_key text not null, window_code text not null, value numeric not null, ci_lower numeric not null, ci_upper numeric not null,
  n_eff numeric, primary key (player_id, snapshot_date, metric_key, window_code));
grant select on public.sustainability_trend_bands to service_role, supa_pg;
insert into public.sustainability_trend_bands (player_id, snapshot_date, metric_key, window_code, value, ci_lower, ci_upper, n_eff)
select p, date '2026-11-14', m, w, 5, 4, 6, 6
from unnest('{8478402,8477934,8481617}'::int[]) p, unnest('{fantasy_score,ixg_per_60,shots_per_60,points_per_60_5v5}'::text[]) m,
  unnest('{l5,l10}'::text[]) w;
SQL
export PSQL_CMD="$PG/psql -X -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U supa_pg -d postgres" SMOKE_HTTP=0
S=$HERE/apply-migration-151.sh
fails=0
expect() { local want=$1 name=$2; shift 2; OUTDIR=$TMP/out-$RANDOM "$@" >$TMP/run.log 2>&1; local got=$?
  if [[ $want == ok && $got == 0 ]] || [[ $want == fail && $got == 7 ]]; then echo "PASS $name"; else echo "FAIL $name (exit $got)"; cat $TMP/run.log; fails=$((fails+1)); fi; }
expect ok   "preflight passes on a clean database"                          zsh $S --preflight
expect fail "apply refuses without --confirm"                               zsh $S --apply
expect fail "apply refuses a wrong --confirm"                               zsh $S --apply --confirm 20261115000000
expect fail "smoke fails before the function exists"                        zsh $S --smoke
$PG/psql -X -q -h $TMP -p $PORT -U postgres -d postgres -c "insert into cron.job_run_details values ('running', now())"
expect fail "apply refuses while a cron run is in progress"                 zsh $S --apply --confirm 20261115190000
$PG/psql -X -q -h $TMP -p $PORT -U postgres -d postgres -c "delete from cron.job_run_details"
expect ok   "apply commits, records the ledger row and reads back"          zsh $S --apply --confirm 20261115190000
expect ok   "SQL smoke returns 144 keys as service_role"                    zsh $S --smoke
expect fail "preflight refuses once the ledger row and function exist"      zsh $S --preflight
expect fail "a second apply refuses"                                        zsh $S --apply --confirm 20261115190000
$PG/psql -X -q -h $TMP -p $PORT -U supa_pg -d postgres -f $HERE/../../../../supabase/tests/forge_latest_trend_bands_rollback.sql
$PG/psql -X -q -h $TMP -p $PORT -U postgres -d postgres -c "delete from supabase_migrations.schema_migrations"
export PSQL_CMD="$PG/psql -X -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U postgres -d postgres"
expect fail "a superuser session is refused"                                zsh $S --preflight
echo "$([[ $fails == 0 ]] && echo OK || echo FAILED): $fails failure(s)"
exit $(( fails > 0 ))
