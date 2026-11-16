#!/bin/zsh
# Local self-test of apply-migration-155.sh against a disposable PostgreSQL 15 shaped like production for what the
# script checks: non-superuser table owner, supabase_migrations ledger, cron.job_run_details, the baseline
# wgo_skater_stats table and the 137 function body. Never touches a hosted database: PSQL_CMD points every call at the
# local server and the HTTP smoke is skipped.
set -u
export LC_ALL=C  # the postmaster refuses to start under a multithreaded locale setup
HERE=${0:A:h}
ROOT=${HERE:h:h:h:h}
PG=/opt/homebrew/opt/postgresql@15/bin
PORT=55545
TMP=$(mktemp -d /tmp/m155.XXXXXX)
trap '$PG/pg_ctl -D $TMP/data -m immediate stop >/dev/null 2>&1; rm -rf $TMP' EXIT
$PG/initdb -D $TMP/data -U postgres -A trust --no-sync >/dev/null || exit 1
$PG/pg_ctl -D $TMP/data -l $TMP/log -w -o "-p $PORT -k $TMP -c listen_addresses= -c fsync=off" start >/dev/null || exit 1
SU=($PG/psql -X -q -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U postgres -d postgres)
$SU[@] <<'SQL' || exit 1
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role supa_pg login nosuperuser; grant service_role to supa_pg;
grant create, usage on schema public to supa_pg; grant usage on schema public to service_role;
create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key,
  statements text[], name text, created_by text, idempotency_key text, rollback text[]);
grant usage on schema supabase_migrations to supa_pg; grant select, insert on supabase_migrations.schema_migrations to supa_pg;
create schema cron; create table cron.job_run_details (status text, start_time timestamptz);
grant usage on schema cron to supa_pg; grant select on cron.job_run_details to supa_pg;
SQL
python3 -I - $ROOT/supabase/migrations/20260716112908_production_schema_baseline.sql > $TMP/table.sql <<'PY' || exit 1
import re, sys
m = re.search(r"CREATE TABLE public\.wgo_skater_stats \(\n.*?\n\);\n", open(sys.argv[1]).read(), re.S)
print(m.group(0))
PY
U=($PG/psql -X -q -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U supa_pg -d postgres)
$U[@] -f $TMP/table.sql || exit 1
$U[@] -c "grant select on public.wgo_skater_stats to service_role;
  insert into public.wgo_skater_stats (id, player_id, player_name, date, season_id, position_code, games_played, toi_per_game, hits, blocked_shots)
  select i, 8470000 + i % 900, 'p', date '2024-09-01' + (i % 800), case when date '2024-09-01' + (i % 800) < date '2025-09-01' then 20242025
    when date '2024-09-01' + (i % 800) < date '2026-09-01' then 20252026 else 20262027 end,
    (array['C','L','R','D'])[1 + i % 4], 1, 300 + i % 900, i % 6, i % 3 from generate_series(1, 20000) i;" || exit 1
$U[@] -f $ROOT/supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql || exit 1
$U[@] -f $ROOT/supabase/migrations/20261112090000_guard_forge_league_skater_physical_totals_cutoff.sql || exit 1
export PSQL_CMD="$PG/psql -X -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U supa_pg -d postgres" SMOKE_HTTP=0
S=$HERE/apply-migration-155.sh
fails=0
expect() { local want=$1 name=$2; shift 2; OUTDIR=$TMP/out-$RANDOM "$@" >$TMP/run.log 2>&1; local got=$?
  if [[ $want == ok && $got == 0 ]] || [[ $want == fail && $got == 7 ]]; then echo "PASS $name"; else echo "FAIL $name (exit $got)"; cat $TMP/run.log; fails=$((fails+1)); fi; }
expect ok   "preflight passes on the production state (next: step 1)"           zsh $S --preflight
expect fail "step 1 refuses without --confirm"                                 zsh $S --index
expect fail "step 2 refuses before the index exists"                           zsh $S --function --confirm 20261116010000
expect fail "smoke refuses before both steps"                                  zsh $S --smoke
$SU[@] -c "insert into cron.job_run_details values ('running', now())"
expect fail "step 1 refuses while a cron run is in progress"                   zsh $S --index --confirm idx_wgo_skater_stats_gp1_physical
$SU[@] -c "delete from cron.job_run_details"
expect ok   "step 1 builds the index concurrently and reads it back valid"     zsh $S --index --confirm idx_wgo_skater_stats_gp1_physical
expect fail "step 1 refuses a second time"                                     zsh $S --index --confirm idx_wgo_skater_stats_gp1_physical
expect ok   "preflight passes with the index (next: step 2)"                   zsh $S --preflight
expect fail "step 2 refuses a wrong --confirm"                                 zsh $S --function --confirm 20261115190000
$SU[@] -c "update pg_index set indisvalid = false where indexrelid = 'public.idx_wgo_skater_stats_gp1_physical'::regclass"
expect fail "step 2 refuses while the index is invalid"                        zsh $S --function --confirm 20261116010000
$SU[@] -c "update pg_index set indisvalid = true where indexrelid = 'public.idx_wgo_skater_stats_gp1_physical'::regclass"
expect ok   "step 2 replaces the body, records the ledger row and reads back"  zsh $S --function --confirm 20261116010000
expect ok   "smoke: SQL timing as service_role returns 4 rows"                 zsh $S --smoke
expect fail "step 2 refuses a second time"                                     zsh $S --function --confirm 20261116010000
expect ok   "preflight reports applied"                                        zsh $S --preflight
export PSQL_CMD="$PG/psql -X -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U postgres -d postgres"
expect fail "a superuser session is refused"                                   zsh $S --preflight
echo "$([[ $fails == 0 ]] && echo OK || echo FAILED): $fails failure(s)"
exit $(( fails > 0 ))
