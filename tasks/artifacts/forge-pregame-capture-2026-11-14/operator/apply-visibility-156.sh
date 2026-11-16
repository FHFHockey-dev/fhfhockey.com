#!/bin/zsh
# wgo_skater_stats visibility: a one-off VACUUM and migration 156 (insert-triggered autovacuum). FAILS CLOSED (exit 7).
# Each changing mode needs TJ's own approval.
#   --preflight                                      read-only checks (default)
#   --vacuum --confirm wgo_skater_stats [--index-cleanup]
#                                                    VACUUM (VERBOSE) public.wgo_skater_stats, outside a transaction (with
#                                                    --index-cleanup: VERBOSE, INDEX_CLEANUP ON, so pages holding dead item
#                                                    identifiers are cleaned even under the 2% bypass), then
#                                                    a read-only readback: all-visible pages and the capture read's heap
#                                                    fetches (the 155 body, generic plan, EXPLAIN ANALYZE)
#   --reloptions --confirm 20261116020000            one transaction: the migration file, the ledger row; exact readback
#   --rollback-reloptions --confirm 20261116020000   resets the two insert options and removes the ledger row
# PSQL_CMD replaces the pooler wrapper (local self-test only). Outputs go to a private 0700 directory (OUTDIR, default
# ~/forge-pilot/visibility-156-<UTC>). Credentials are read from web/.env.local by pgpool.sh and never printed.
set -u
umask 077
HERE=${0:A:h}
ROOT=${HERE:h:h:h:h}
MIG=$ROOT/supabase/migrations/20261116020000_wgo_skater_stats_insert_autovacuum.sql
EXPECT_SHA=3d48946edf0637ca4341edb4cac9b9f5447fa55eec8acec087ab67e850c03b77
M155=$ROOT/supabase/migrations/20261116010000_forge_physical_totals_covering_index.sql
VERSION=20261116020000
NAME=wgo_skater_stats_insert_autovacuum
BEFORE='{autovacuum_analyze_scale_factor=0.002,autovacuum_vacuum_scale_factor=0.01}'
AFTER='{autovacuum_analyze_scale_factor=0.002,autovacuum_vacuum_scale_factor=0.01,autovacuum_vacuum_insert_threshold=1000,autovacuum_vacuum_insert_scale_factor=0}'
VACUUM_STATEMENT_TIMEOUT=${VACUUM_STATEMENT_TIMEOUT:-15min}
PSQL=(${=PSQL_CMD:-$HERE/pgpool.sh})
OUTDIR=${OUTDIR:-$HOME/forge-pilot/visibility-156-$(date -u +%Y%m%dT%H%M%SZ)}

fail() { echo "FAIL: $*" >&2; exit 7; }
mode=preflight; confirm=""; vacopts="verbose"
while (( $# )); do
  case $1 in
    --preflight) mode=preflight ;;
    --vacuum) mode=vacuum ;;
    --reloptions) mode=reloptions ;;
    --rollback-reloptions) mode=rollback ;;
    --index-cleanup) vacopts="verbose, index_cleanup on" ;;
    --confirm) shift; confirm=${1:-} ;;
    *) fail "unknown argument $1" ;;
  esac
  shift
done
mkdir -p $OUTDIR && chmod 700 $OUTDIR || fail "cannot create $OUTDIR"
[[ $(shasum -a 256 $MIG | cut -d' ' -f1) == $EXPECT_SHA ]] || fail "migration 156 file hash differs from $EXPECT_SHA"
if [[ -z ${PSQL_CMD:-} ]]; then
  python3 -I -c "import socket,sys; socket.getaddrinfo(sys.argv[1], 5432)" aws-0-us-east-1.pooler.supabase.com 2>/dev/null \
    || fail "cannot resolve the pooler host"
fi

# Line: active longest waits cron ledger owner superuser see_all vacuums all_visible_pct reloptions
state() {
  local out rc line
  out=$(${PSQL[@]} -At -F '|' -c "begin read only; set local statement_timeout='5s'; select
    (select count(*) from pg_stat_activity where state='active' and pid<>pg_backend_pid()),
    (select coalesce(ceil(max(extract(epoch from clock_timestamp()-query_start))),0)::int from pg_stat_activity where state='active' and pid<>pg_backend_pid()),
    (select count(*) from pg_stat_activity where wait_event_type='Lock'),
    (select count(*) from cron.job_run_details where status in ('running','starting') and start_time > now()-interval '2 hours'),
    (select count(*) from supabase_migrations.schema_migrations where version='$VERSION'),
    (select case when pg_has_role(current_user, c.relowner, 'USAGE') then 1 else 0 end from pg_class c where c.oid = 'public.wgo_skater_stats'::regclass),
    (select case when rolsuper then 1 else 0 end from pg_roles where rolname=current_user),
    (select case when pg_has_role(current_user, 'pg_read_all_stats', 'USAGE') then 1 else 0 end),
    (select count(*) from pg_stat_progress_vacuum where relid = 'public.wgo_skater_stats'::regclass),
    (select round(100.0 * relallvisible / nullif(relpages, 0), 2) from pg_class where oid = 'public.wgo_skater_stats'::regclass),
    (select coalesce(reloptions::text, '{}') from pg_class where oid = 'public.wgo_skater_stats'::regclass); rollback;" 2>&1)
  rc=$?
  line=$(print -r -- "$out" | grep -E '^[0-9]+(\|[0-9]+){8}\|[0-9.]*\|\{' | head -1)
  (( rc == 0 )) && [[ -n $line ]] || fail "state query did not answer cleanly (psql exit $rc): $(print -r -- "$out" | tail -2)"
  IFS='|' read active longest waits cron ledger owner superuser seeall vacuums allvis relopts <<< "$line"
  print -r -- "state $(date -u +%H:%M:%SZ): active=$active longest=${longest}s lock_waits=$waits cron_running=$cron ledger_row=$ledger owner=$owner superuser=$superuser see_all=$seeall vacuums=$vacuums all_visible=${allvis}% reloptions=$relopts" | tee -a $OUTDIR/state.txt
  (( superuser == 0 && owner == 1 && seeall == 1 )) || fail "superuser session, not the table's owner, or blind to other sessions"
}
quiet() { (( active <= 5 && longest <= 10 && waits == 0 && cron == 0 && vacuums == 0 )) || fail "database busy or a vacuum is already running"; }
heap_fetches() {  # the capture read (155 body, generic plan) as service_role, read-only
  python3 -I $HERE/m155_body_sql.py $M155 "(analyze, buffers)" "set local role service_role;" > $OUTDIR/body-plan.sql || return 1
  ${PSQL[@]} -X -f $OUTDIR/body-plan.sql > $OUTDIR/body-plan.out 2>&1 || return 1
  grep -E 'Heap Fetches|Execution Time' $OUTDIR/body-plan.out | sed 's/^ *//' | tr '\n' ' '
}

case $mode in
  preflight)
    state
    stats=$(${PSQL[@]} -At -F ' ' -c "begin read only; set local statement_timeout='5s';
      select 'stats', n_ins_since_vacuum, n_dead_tup, coalesce(to_char(last_vacuum, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), 'none'),
        coalesce(to_char(last_autovacuum, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), 'none'), autovacuum_count
      from pg_stat_user_tables where relid = 'public.wgo_skater_stats'::regclass; rollback;" 2>&1 | grep '^stats ')
    read _ ins dead lastvac lastauto autocount <<< "$stats"
    print -r -- "stats: inserted_since_vacuum=$ins dead=$dead last_vacuum=$lastvac last_autovacuum=$lastauto autovacuum_count=$autocount" | tee -a $OUTDIR/state.txt
    echo "heap fetches now: $(heap_fetches || echo unavailable)"
    echo "preflight ok; nothing changed ($OUTDIR)"
    ;;
  vacuum)
    [[ $confirm == wgo_skater_stats ]] || fail "--vacuum needs --confirm wgo_skater_stats"
    state; quiet
    cat > $OUTDIR/vacuum.sql <<SQL
\\set ON_ERROR_STOP on
set statement_timeout = '$VACUUM_STATEMENT_TIMEOUT';
set lock_timeout = '10s';
select 'vacuum_start', clock_timestamp();
vacuum ($vacopts) public.wgo_skater_stats;
select 'vacuum_done', clock_timestamp();
SQL
    perl -e 'alarm shift; exec @ARGV' 1000 ${PSQL[@]} -X -f $OUTDIR/vacuum.sql > $OUTDIR/vacuum.out 2>&1
    rc=$?
    grep -vE '^(SET)$' $OUTDIR/vacuum.out | tail -25
    (( rc == 0 )) && grep -q 'vacuum_done' $OUTDIR/vacuum.out || fail "vacuum did not finish (psql exit $rc); see $OUTDIR/vacuum.out"
    state
    echo "heap fetches after: $(heap_fetches || echo unavailable)"
    echo "vacuum ($vacopts) done ($OUTDIR)"
    ;;
  reloptions)
    [[ $confirm == $VERSION ]] || fail "--reloptions needs --confirm $VERSION"
    state; quiet
    (( ledger == 0 )) && [[ $relopts == $BEFORE ]] || fail "reloptions step needs no ledger row and exactly $BEFORE (ledger=$ledger reloptions=$relopts)"
    cp $MIG $OUTDIR/migration.sql
    [[ $(shasum -a 256 $OUTDIR/migration.sql | cut -d' ' -f1) == $EXPECT_SHA ]] || fail "copied file hash differs"
    cat > $OUTDIR/apply.sql <<SQL
\\set ON_ERROR_STOP on
begin;
set local statement_timeout = '30s';
\\i $OUTDIR/migration.sql
insert into supabase_migrations.schema_migrations (version, name) values ('$VERSION', '$NAME');
select 'applied_at', clock_timestamp();
commit;
SQL
    perl -e 'alarm shift; exec @ARGV' 120 ${PSQL[@]} -X -f $OUTDIR/apply.sql > $OUTDIR/apply.out 2>&1
    rc=$?
    cat $OUTDIR/apply.out
    (( rc == 0 )) && grep -q '^COMMIT$' $OUTDIR/apply.out || fail "reloptions step did not commit (psql exit $rc)"
    state
    (( ledger == 1 )) && [[ $relopts == $AFTER ]] || fail "readback differs (ledger=$ledger reloptions=$relopts)"
    echo "reloptions applied and read back ($OUTDIR)"
    ;;
  rollback)
    [[ $confirm == $VERSION ]] || fail "--rollback-reloptions needs --confirm $VERSION"
    state
    (( ledger == 1 )) && [[ $relopts == $AFTER ]] || fail "nothing to roll back (ledger=$ledger reloptions=$relopts)"
    ${PSQL[@]} -X -v ON_ERROR_STOP=1 -c "begin; set local lock_timeout = '5s'; set local statement_timeout = '30s';
      alter table public.wgo_skater_stats reset (autovacuum_vacuum_insert_threshold, autovacuum_vacuum_insert_scale_factor);
      delete from supabase_migrations.schema_migrations where version = '$VERSION' and name = '$NAME'; commit;" > $OUTDIR/rollback.out 2>&1 \
      || fail "rollback did not commit; see $OUTDIR/rollback.out"
    state
    (( ledger == 0 )) && [[ $relopts == $BEFORE ]] || fail "rollback readback differs (ledger=$ledger reloptions=$relopts)"
    echo "reloptions rolled back ($OUTDIR)"
    ;;
esac
