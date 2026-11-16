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
grant usage on schema supabase_migrations to supa_pg; grant select, insert, delete on supabase_migrations.schema_migrations to supa_pg;
grant pg_read_all_stats to supa_pg;  -- production's postgres role can see every session
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
    (array['C','L','R','D'])[1 + i % 4], 1, 300 + i % 900, i % 6, i % 3 from generate_series(1, 120000) i;" || exit 1
$U[@] -f $ROOT/supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql || exit 1
$U[@] -f $ROOT/supabase/migrations/20261112090000_guard_forge_league_skater_physical_totals_cutoff.sql || exit 1
$SU[@] -c "vacuum analyze public.wgo_skater_stats" || exit 1
export PSQL_CMD="$PG/psql -X -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U supa_pg -d postgres" SMOKE_HTTP=0
S=$HERE/apply-migration-155.sh
fails=0
expect() { local want=$1 name=$2; shift 2; OUTDIR=$TMP/out-$RANDOM "$@" >$TMP/run.log 2>&1; local got=$?
  if [[ $want == ok && $got == 0 ]] || [[ $want == fail && $got == 7 ]]; then echo "PASS $name"; else echo "FAIL $name (exit $got)"; cat $TMP/run.log; fails=$((fails+1)); fi; }
expect ok   "preflight passes on the production state (next: step 1)"           zsh $S --preflight
$SU[@] -c "revoke pg_read_all_stats from supa_pg"
expect fail "every mode refuses when the session cannot see other sessions"   zsh $S --preflight
$SU[@] -c "grant pg_read_all_stats to supa_pg"
expect fail "step 1 refuses without --confirm"                                 zsh $S --index
expect fail "step 2 refuses before the index exists"                           zsh $S --function --confirm 20261116010000
expect fail "smoke refuses before both steps"                                  zsh $S --smoke
$SU[@] -c "insert into cron.job_run_details values ('running', now())"
expect fail "step 1 refuses while a cron run is in progress"                   zsh $S --index --confirm idx_wgo_skater_stats_gp1_physical
$SU[@] -c "delete from cron.job_run_details"
$SU[@] -c "begin; select pg_sleep(4); commit;" >/dev/null 2>&1 &
sleep 2
export OLD_XACT_SECONDS=1
expect fail "step 1 refuses while another transaction has been open too long"  zsh $S --index --confirm idx_wgo_skater_stats_gp1_physical
unset OLD_XACT_SECONDS; wait
# A session holding an older snapshot makes the concurrent build wait at its end; a 2 s timeout cancels it there,
# which leaves an INVALID index: the script must drop it and verify it is gone.
$SU[@] -c "select pg_sleep(8)" >/dev/null 2>&1 &
sleep 1
export INDEX_STATEMENT_TIMEOUT=2s
expect fail "step 1: a build cancelled at its end is dropped and verified gone" zsh $S --index --confirm idx_wgo_skater_stats_gp1_physical
unset INDEX_STATEMENT_TIMEOUT
if grep -q "dropped it concurrently and verified it is gone" $TMP/run.log && [[ $($SU[@] -At -c "select to_regclass('public.idx_wgo_skater_stats_gp1_physical') is null") == t ]]; then
  echo "PASS the cancelled build left no index and the script said so"; else echo "FAIL the cancelled build cleanup"; cat $TMP/run.log; fails=$((fails+1)); fi
wait
expect ok   "step 1 builds the index concurrently and reads it back valid"     zsh $S --index --confirm idx_wgo_skater_stats_gp1_physical
expect fail "step 1 refuses a second time"                                     zsh $S --index --confirm idx_wgo_skater_stats_gp1_physical
expect ok   "preflight passes with the index (next: step 2)"                   zsh $S --preflight
expect fail "step 2 refuses a wrong --confirm"                                 zsh $S --function --confirm 20261115190000
$SU[@] -c "update pg_index set indisvalid = false where indexrelid = 'public.idx_wgo_skater_stats_gp1_physical'::regclass"
expect fail "step 2 refuses while the index is invalid"                        zsh $S --function --confirm 20261116010000
$SU[@] -c "update pg_index set indisvalid = true where indexrelid = 'public.idx_wgo_skater_stats_gp1_physical'::regclass"
$SU[@] -c "alter role supa_pg set enable_indexonlyscan = off"
expect fail "step 2 refuses when the plan gate sees no Index Only Scan"       zsh $S --function --confirm 20261116010000
$SU[@] -c "alter role supa_pg reset enable_indexonlyscan"
expect ok   "step 2 replaces the body, records the ledger row and reads back"  zsh $S --function --confirm 20261116010000
expect ok   "smoke: plan first (Index Only Scan, heap fetches), then 4 rows"   zsh $S --smoke
grep -q "Heap Fetches" $TMP/run.log && echo "PASS the smoke reports heap fetches" || { echo "FAIL the smoke reports heap fetches"; cat $TMP/run.log; fails=$((fails+1)); }
expect fail "step 2 refuses a second time"                                     zsh $S --function --confirm 20261116010000
expect fail "timed read refuses without --cutoff"                             zsh $S --timed-read
expect ok   "timed read passes under its limit"                               zsh $S --timed-read --cutoff 2026-11-16
grep -q "timed read (20262027, 2026-11-16)" $TMP/run.log && echo "PASS the timed read used the given cutoff" || { echo "FAIL timed read cutoff"; cat $TMP/run.log; fails=$((fails+1)); }
export TIMED_READ_MS_MAX=0
expect fail "timed read reports no-go above its limit"                        zsh $S --timed-read --cutoff 2026-11-16
unset TIMED_READ_MS_MAX
export SMOKE_MS_MAX=0
expect fail "smoke refuses a call slower than its time cap"                   zsh $S --smoke
unset SMOKE_MS_MAX
expect ok   "preflight reports applied"                                        zsh $S --preflight
expect fail "drop-index refuses while the 155 body is live"                    zsh $S --drop-index --confirm idx_wgo_skater_stats_gp1_physical
expect fail "rollback-function refuses a wrong --confirm"                      zsh $S --rollback-function --confirm idx_wgo_skater_stats_gp1_physical
expect ok   "rollback-function restores the 137 body and removes the ledger row" zsh $S --rollback-function --confirm 20261116010000
expect ok   "drop-index drops concurrently and verifies"                      zsh $S --drop-index --confirm idx_wgo_skater_stats_gp1_physical
expect ok   "preflight is back at step 1"                                      zsh $S --preflight
grep -q "next: step 1" $TMP/run.log && echo "PASS the database is back in the production state" || { echo "FAIL back at step 1"; fails=$((fails+1)); }
export PSQL_CMD="$PG/psql -X -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U postgres -d postgres"
expect fail "a superuser session is refused"                                   zsh $S --preflight
echo "$([[ $fails == 0 ]] && echo OK || echo FAILED): $fails failure(s)"
exit $(( fails > 0 ))
