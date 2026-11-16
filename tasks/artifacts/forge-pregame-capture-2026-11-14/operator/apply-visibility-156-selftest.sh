#!/bin/zsh
# Local self-test of apply-visibility-156.sh against a disposable PostgreSQL 15: non-superuser table owner, ledger,
# cron.job_run_details, the baseline wgo_skater_stats with order 93's reloptions, and order 155 applied. Some rows are
# written after a vacuum, so the capture read has heap fetches before --vacuum and none after. Never touches a hosted
# database: PSQL_CMD points every call at the local server.
set -u
export LC_ALL=C
HERE=${0:A:h}
ROOT=${HERE:h:h:h:h}
PG=/opt/homebrew/opt/postgresql@15/bin
PORT=55547
TMP=$(mktemp -d /tmp/v156.XXXXXX)
trap '$PG/pg_ctl -D $TMP/data -m immediate stop >/dev/null 2>&1; rm -rf $TMP' EXIT
$PG/initdb -D $TMP/data -U postgres -A trust --no-sync >/dev/null || exit 1
$PG/pg_ctl -D $TMP/data -l $TMP/log -w -o "-p $PORT -k $TMP -c listen_addresses= -c fsync=off -c autovacuum=off" start >/dev/null || exit 1
SU=($PG/psql -X -q -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U postgres -d postgres)
$SU[@] <<'SQL' || exit 1
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role supa_pg login nosuperuser; grant service_role to supa_pg; grant pg_read_all_stats to supa_pg;
grant create, usage on schema public to supa_pg; grant usage on schema public to service_role;
create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key,
  statements text[], name text, created_by text, idempotency_key text, rollback text[]);
grant usage on schema supabase_migrations to supa_pg; grant select, insert, delete on supabase_migrations.schema_migrations to supa_pg;
create schema cron; create table cron.job_run_details (status text, start_time timestamptz);
grant usage on schema cron to supa_pg; grant select on cron.job_run_details to supa_pg;
SQL
python3 -I - $ROOT/supabase/migrations/20260716112908_production_schema_baseline.sql > $TMP/table.sql <<'PY' || exit 1
import re, sys
print(re.search(r"CREATE TABLE public\.wgo_skater_stats \(\n.*?\n\);\n", open(sys.argv[1]).read(), re.S).group(0))
PY
U=($PG/psql -X -q -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U supa_pg -d postgres)
$U[@] -f $TMP/table.sql || exit 1
$U[@] -c "grant select on public.wgo_skater_stats to service_role;
  alter table public.wgo_skater_stats set (autovacuum_analyze_scale_factor = 0.002, autovacuum_vacuum_scale_factor = 0.01);
  insert into public.wgo_skater_stats (id, player_id, player_name, date, season_id, position_code, games_played, toi_per_game, hits, blocked_shots)
  select i, 8470000 + i % 900, 'p', date '2024-09-01' + (i % 800), case when date '2024-09-01' + (i % 800) < date '2025-09-01' then 20242025
    when date '2024-09-01' + (i % 800) < date '2026-09-01' then 20252026 else 20262027 end,
    (array['C','L','R','D'])[1 + i % 4], 1, 300 + i % 900, i % 6, i % 3 from generate_series(1, 120000) i;" || exit 1
$U[@] -f $ROOT/supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql || exit 1
$U[@] -f $ROOT/supabase/migrations/20261112090000_guard_forge_league_skater_physical_totals_cutoff.sql || exit 1
$U[@] -f $ROOT/supabase/migrations/20261116010000_forge_physical_totals_covering_index.sql || exit 1
$SU[@] -c "vacuum analyze public.wgo_skater_stats" || exit 1
# Rows written after the vacuum: this season, so the capture read must visit their heap pages.
$U[@] -c "insert into public.wgo_skater_stats (id, player_id, player_name, date, season_id, position_code, games_played, toi_per_game, hits, blocked_shots)
  select 200000 + i, 8480000 + i, 'n', date '2026-10-10' + (i % 30), 20262027, (array['C','L','R','D'])[1 + i % 4], 1, 600, 1, 1
  from generate_series(1, 3000) i;" || exit 1
export PSQL_CMD="$PG/psql -X -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U supa_pg -d postgres"
S=$HERE/apply-visibility-156.sh
fails=0
expect() { local want=$1 name=$2; shift 2; OUTDIR=$TMP/out-$RANDOM "$@" >$TMP/run.log 2>&1; local got=$?
  if [[ $want == ok && $got == 0 ]] || [[ $want == fail && $got == 7 ]]; then echo "PASS $name"; else echo "FAIL $name (exit $got)"; cat $TMP/run.log; fails=$((fails+1)); fi; }
saw() { grep -qE "$1" $TMP/run.log && echo "PASS $2" || { echo "FAIL $2"; cat $TMP/run.log; fails=$((fails+1)); }; }
expect ok   "preflight passes and reports the capture read's heap fetches"     zsh $S --preflight
saw "heap fetches now: Heap Fetches: [1-9]" "rows written after the last vacuum show as heap fetches"
expect fail "vacuum refuses without --confirm"                                 zsh $S --vacuum
$SU[@] -c "insert into cron.job_run_details values ('running', now())"
expect fail "vacuum refuses while a cron run is in progress"                   zsh $S --vacuum --confirm wgo_skater_stats
$SU[@] -c "delete from cron.job_run_details"
expect ok   "vacuum runs and reads back"                                       zsh $S --vacuum --confirm wgo_skater_stats
saw "heap fetches after: Heap Fetches: 0 " "after the vacuum the capture read has no heap fetches"
saw "all_visible=100.00%" "after the vacuum every page is all-visible"
$U[@] -c "update public.wgo_skater_stats set hits = hits + 0 where id % 50 = 0 and date >= date '2026-09-01'"
expect ok   "vacuum --index-cleanup runs with INDEX_CLEANUP ON"               zsh $S --vacuum --confirm wgo_skater_stats --index-cleanup
saw "vacuum \\(verbose, index_cleanup on\\) done" "the index-cleanup option reached the VACUUM statement"
saw "heap fetches after: Heap Fetches: 0 " "after the index-cleaning vacuum the capture read has no heap fetches"
expect ok   "preflight reports vacuum statistics"                              zsh $S --preflight
saw "stats: inserted_since_vacuum=[0-9]+ dead=[0-9]+ last_vacuum=20[0-9-]+T" "the stats line shows the manual vacuum's time"
expect fail "reloptions refuses a wrong --confirm"                             zsh $S --reloptions --confirm 20261116010000
expect ok   "reloptions applies the insert trigger and records the ledger row" zsh $S --reloptions --confirm 20261116020000
saw "autovacuum_vacuum_insert_threshold=1000,autovacuum_vacuum_insert_scale_factor=0" "readback shows both insert options next to order 93's"
expect fail "reloptions refuses a second time"                                 zsh $S --reloptions --confirm 20261116020000
expect ok   "rollback resets the insert options and removes the ledger row"    zsh $S --rollback-reloptions --confirm 20261116020000
expect fail "rollback refuses a second time"                                   zsh $S --rollback-reloptions --confirm 20261116020000
export PSQL_CMD="$PG/psql -X -v ON_ERROR_STOP=1 -h $TMP -p $PORT -U postgres -d postgres"
expect fail "a superuser session is refused"                                   zsh $S --preflight
echo "$([[ $fails == 0 ]] && echo OK || echo FAILED): $fails failure(s)"
exit $(( fails > 0 ))
