#!/bin/zsh
# Migration 151 (public.forge_latest_trend_bands): preflight, apply, readback and smoke. FAILS CLOSED (exit 7).
#   --preflight                          read-only checks only (default)
#   --apply --confirm 20261115190000     TJ-approved apply: gate, one transaction, readback
#   --smoke                              after the apply, read-only: one SQL timing run and one PostgREST GET
# PSQL_CMD replaces the pooler wrapper (local dry runs only); SMOKE_HTTP=0 skips the GET. Outputs go to a private
# 0700 directory (OUTDIR, default ~/forge-pilot/migration-151-<UTC>). Credentials are read from web/.env.local and
# never printed or passed on a command line.
set -u
umask 077
HERE=${0:A:h}
ROOT=${HERE:h:h:h:h}
ENVF=${FHFH_ENV_FILE:-$ROOT/web/.env.local}
MIG=$ROOT/supabase/migrations/20261115190000_forge_latest_trend_bands.sql
EXPECT_SHA=a3e1835fc1dfc1c1562b5b39dd86f535d5acc37b74eee1fac6dcb49cb2049281
VERSION=20261115190000
NAME=forge_latest_trend_bands
# 0326 team 2 (the read that timed out on 2026-11-15), as of its slate date: 18 players x 4 metrics x 2 windows = 144 keys.
SMOKE_IDS='{8478402,8477934,8481617,8476454,8475786,8477953,8477450,8479365,8482703,8486161,8478472,8480029,8478854,8476473,8480803,8475218,8482166,8480834}'
SMOKE_METRICS='{fantasy_score,ixg_per_60,shots_per_60,points_per_60_5v5}'
SMOKE_WINDOWS='{l5,l10}'
SMOKE_AS_OF=2026-11-15
PSQL=(${=PSQL_CMD:-$HERE/pgpool.sh})
OUTDIR=${OUTDIR:-$HOME/forge-pilot/migration-151-$(date -u +%Y%m%dT%H%M%SZ)}

fail() { echo "FAIL: $*" >&2; exit 7; }
mode=preflight; confirm=""
while (( $# )); do
  case $1 in
    --preflight) mode=preflight ;;
    --apply) mode=apply ;;
    --smoke) mode=smoke ;;
    --confirm) shift; confirm=${1:-} ;;
    *) fail "unknown argument $1" ;;
  esac
  shift
done
mkdir -p $OUTDIR && chmod 700 $OUTDIR || fail "cannot create $OUTDIR"

if [[ -z ${PSQL_CMD:-} ]]; then
  for host in aws-0-us-east-1.pooler.supabase.com; do
    python3 -I -c "import socket,sys; socket.getaddrinfo(sys.argv[1], 5432)" $host 2>/dev/null || fail "cannot resolve $host"
  done
fi

# Expected line: active longest waits cron_running ledger_rows functions columns superuser roles
preflight() {
  local out rc line
  out=$(${PSQL[@]} -At -F ' ' -c "begin read only; set local statement_timeout='5s'; select
    (select count(*) from pg_stat_activity where state='active' and pid<>pg_backend_pid()),
    (select coalesce(ceil(max(extract(epoch from clock_timestamp()-query_start))),0)::int from pg_stat_activity where state='active' and pid<>pg_backend_pid()),
    (select count(*) from pg_stat_activity where wait_event_type='Lock'),
    (select count(*) from cron.job_run_details where status in ('running','starting') and start_time > now()-interval '2 hours'),
    (select count(*) from supabase_migrations.schema_migrations where version='$VERSION'),
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='$NAME'),
    (select count(*) from information_schema.columns where table_schema='public' and table_name='sustainability_trend_bands'
       and (column_name, data_type) in (('player_id','integer'),('snapshot_date','date'),('metric_key','text'),('window_code','text'),
         ('value','numeric'),('ci_lower','numeric'),('ci_upper','numeric'),('n_eff','numeric'))),
    (select case when rolsuper then 1 else 0 end from pg_roles where rolname=current_user),
    (select count(*) from pg_roles where rolname in ('service_role','anon','authenticated')); rollback;" 2>&1)
  rc=$?
  line=$(print -r -- "$out" | grep -E '^[0-9]+( [0-9]+){8}$' | head -1)
  (( rc == 0 )) && [[ -n $line ]] || fail "preflight did not answer cleanly (psql exit $rc)"
  read active longest waits cron ledger fns cols superuser roles <<< "$line"
  print -r -- "preflight $(date -u +%H:%M:%SZ): active=$active longest=${longest}s lock_waits=$waits cron_running=$cron ledger_row=$ledger function=$fns columns=$cols/8 superuser=$superuser roles=$roles/3" | tee -a $OUTDIR/preflight.txt
  (( active <= 5 && longest <= 10 && waits == 0 && cron == 0 )) || fail "database busy"
  (( ledger == 0 && fns == 0 )) || fail "migration $VERSION already recorded or function already present"
  (( cols == 8 && superuser == 0 && roles == 3 )) || fail "unexpected table shape, role or superuser session"
}

case $mode in
  preflight)
    [[ $(shasum -a 256 $MIG | cut -d' ' -f1) == $EXPECT_SHA ]] || fail "migration file hash differs from $EXPECT_SHA"
    preflight
    echo "preflight ok; nothing changed ($OUTDIR)"
    ;;
  apply)
    [[ $confirm == $VERSION ]] || fail "--apply needs --confirm $VERSION"
    cp $MIG $OUTDIR/migration.sql
    [[ $(shasum -a 256 $OUTDIR/migration.sql | cut -d' ' -f1) == $EXPECT_SHA ]] || fail "migration file hash differs from $EXPECT_SHA"
    preflight
    cat > $OUTDIR/apply.sql <<SQL
\\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
\\i $OUTDIR/migration.sql
insert into supabase_migrations.schema_migrations (version, name) values ('$VERSION', '$NAME');
notify pgrst, 'reload schema';
select 'applied_at', clock_timestamp();
commit;
SQL
    perl -e 'alarm shift; exec @ARGV' 120 ${PSQL[@]} -X -f $OUTDIR/apply.sql > $OUTDIR/apply.out 2>&1
    rc=$?
    cat $OUTDIR/apply.out
    (( rc == 0 )) && grep -q '^COMMIT$' $OUTDIR/apply.out || fail "apply did not commit (psql exit $rc); see $OUTDIR/apply.out"
    # Readback: ledger, then volatile security config owner args svc anon auth public_execute commented
    out=$(${PSQL[@]} -At -F '|' -c "begin read only; set local statement_timeout='5s';
      select (select count(*) from supabase_migrations.schema_migrations where version='$VERSION' and name='$NAME'),
        p.provolatile, p.prosecdef, array_to_string(p.proconfig, ','), pg_get_userbyid(p.proowner), pg_get_function_identity_arguments(p.oid),
        has_function_privilege('service_role', p.oid, 'execute'), has_function_privilege('anon', p.oid, 'execute'),
        has_function_privilege('authenticated', p.oid, 'execute'),
        exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'),
        obj_description(p.oid, 'pg_proc') is not null
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='$NAME'; rollback;" 2>&1)
    print -r -- "$out" > $OUTDIR/readback.txt
    line=$(print -r -- "$out" | grep -E '^1\|' | head -1)
    print -r -- "readback: $line"
    [[ $line == "1|s|f|search_path=pg_catalog|"*"|p_player_ids integer[], p_metric_keys text[], p_window_codes text[], p_as_of date|t|f|f|f|t" ]] \
      || fail "readback differs from the expected function, grants or ledger row; see $OUTDIR/readback.txt"
    echo "applied and read back ($OUTDIR)"
    ;;
  smoke)
    out=$(${PSQL[@]} -At -F ' ' -c "begin read only; set local statement_timeout='8s'; set local role service_role;
      select count(*), count(snapshot_date) from public.forge_latest_trend_bands('$SMOKE_IDS', '$SMOKE_METRICS', '$SMOKE_WINDOWS', '$SMOKE_AS_OF');
      explain (analyze, buffers) select * from public.forge_latest_trend_bands('$SMOKE_IDS', '$SMOKE_METRICS', '$SMOKE_WINDOWS', '$SMOKE_AS_OF');
      rollback;" 2>&1)
    print -r -- "$out" > $OUTDIR/smoke-sql.txt
    print -r -- "$out" | grep -E '^144 [0-9]+$|Execution Time|Buffers' | head -4
    print -r -- "$out" | grep -qE '^144 [0-9]+$' || fail "SQL smoke did not return 144 keys; see $OUTDIR/smoke-sql.txt"
    if [[ ${SMOKE_HTTP:-1} != 0 ]]; then
      api=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' $ENVF | head -1 | cut -d= -f2- | tr -d '"')
      key=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' $ENVF | head -1 | cut -d= -f2- | tr -d '"')
      [[ -n $api && -n $key ]] || fail "API URL or service key missing from $ENVF"
      hdr=$OUTDIR/.headers
      printf 'apikey: %s\nAuthorization: Bearer %s\nAccept: application/json\n' "$key" "$key" > $hdr
      code=$(curl -sS --max-time 15 -o $OUTDIR/smoke-http.json -w '%{http_code}' -H @$hdr \
        "$api/rest/v1/rpc/$NAME?p_player_ids=$SMOKE_IDS&p_metric_keys=$SMOKE_METRICS&p_window_codes=$SMOKE_WINDOWS&p_as_of=$SMOKE_AS_OF" -g)
      rm -f $hdr
      rows=$(python3 -I -c "import json,sys; d=json.load(open(sys.argv[1])); print(len(d) if isinstance(d, list) else -1)" $OUTDIR/smoke-http.json 2>/dev/null)
      echo "PostgREST GET: HTTP $code, $rows rows"
      [[ $code == 200 && $rows == 144 ]] || fail "PostgREST smoke failed (HTTP $code, rows $rows); see $OUTDIR/smoke-http.json"
    fi
    echo "smoke ok ($OUTDIR)"
    ;;
esac
