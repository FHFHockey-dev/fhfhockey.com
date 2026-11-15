#!/bin/zsh
# Migration 152 (public.ranking_publications): preflight, apply, readback and smoke. FAILS CLOSED (exit 7).
# Modelled on the migration-151 operator script (tasks/artifacts/forge-pregame-capture-2026-11-14/operator/).
#   --preflight                          read-only checks only (default)
#   --apply --confirm 20261115210000     TJ-approved apply: gate, one transaction, readback
#   --smoke                              after the apply, read-only: one SQL count as service_role and one PostgREST GET
# PSQL_CMD replaces the pooler wrapper (local self-test only); SMOKE_HTTP=0 skips the GET. Outputs go to a private
# 0700 directory (OUTDIR, default ~/rankings-migration-152-<UTC>). Credentials are read from web/.env.local by
# pgpool.sh and the GET below; they are never printed or passed on a command line.
set -u
umask 077
HERE=${0:A:h}
ROOT=${HERE:h:h:h:h}
ENVF=${FHFH_ENV_FILE:-$ROOT/web/.env.local}
MIG=$ROOT/supabase/migrations/20261115210000_ranking_publications.sql
EXPECT_SHA=ee5e4ee8a93d9c3d36abc50c277bb0a6f5b2ed3d86375304e7487212c06d6090
VERSION=20261115210000
NAME=ranking_publications
PSQL=(${=PSQL_CMD:-$HERE/pgpool.sh})
OUTDIR=${OUTDIR:-$HOME/rankings-migration-152-$(date -u +%Y%m%dT%H%M%SZ)}

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
  python3 -I -c "import socket,sys; socket.getaddrinfo(sys.argv[1], 5432)" aws-0-us-east-1.pooler.supabase.com 2>/dev/null \
    || fail "cannot resolve the pooler host"
fi

# Expected line: active longest waits cron_running ledger_rows table_present superuser roles
preflight() {
  local out rc line
  out=$(${PSQL[@]} -At -F ' ' -c "begin read only; set local statement_timeout='5s'; select
    (select count(*) from pg_stat_activity where state='active' and pid<>pg_backend_pid()),
    (select coalesce(ceil(max(extract(epoch from clock_timestamp()-query_start))),0)::int from pg_stat_activity where state='active' and pid<>pg_backend_pid()),
    (select count(*) from pg_stat_activity where wait_event_type='Lock'),
    (select count(*) from cron.job_run_details where status in ('running','starting') and start_time > now()-interval '2 hours'),
    (select count(*) from supabase_migrations.schema_migrations where version='$VERSION'),
    (select case when to_regclass('public.$NAME') is null then 0 else 1 end),
    (select case when rolsuper then 1 else 0 end from pg_roles where rolname=current_user),
    (select count(*) from pg_roles where rolname in ('service_role','anon','authenticated')); rollback;" 2>&1)
  rc=$?
  line=$(print -r -- "$out" | grep -E '^[0-9]+( [0-9]+){7}$' | head -1)
  (( rc == 0 )) && [[ -n $line ]] || fail "preflight did not answer cleanly (psql exit $rc)"
  read active longest waits cron ledger table superuser roles <<< "$line"
  print -r -- "preflight $(date -u +%H:%M:%SZ): active=$active longest=${longest}s lock_waits=$waits cron_running=$cron ledger_row=$ledger table=$table superuser=$superuser roles=$roles/3" | tee -a $OUTDIR/preflight.txt
  (( active <= 5 && longest <= 10 && waits == 0 && cron == 0 )) || fail "database busy"
  (( ledger == 0 && table == 0 )) || fail "migration $VERSION already recorded or table already present"
  (( superuser == 0 && roles == 3 )) || fail "unexpected role or superuser session"
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
    # Readback: ledger | rls | columns | reader index | svc select,insert,update,delete,truncate | anon select | auth select | public select | comment
    out=$(${PSQL[@]} -At -F '|' -c "begin read only; set local statement_timeout='5s';
      select (select count(*) from supabase_migrations.schema_migrations where version='$VERSION' and name='$NAME'),
        c.relrowsecurity,
        (select count(*) from information_schema.columns where table_schema='public' and table_name='$NAME'),
        to_regclass('public.ranking_publications_reader_idx') is not null,
        has_table_privilege('service_role', c.oid, 'select'), has_table_privilege('service_role', c.oid, 'insert'),
        has_table_privilege('service_role', c.oid, 'update'), has_table_privilege('service_role', c.oid, 'delete'),
        has_table_privilege('service_role', c.oid, 'truncate'),
        has_table_privilege('anon', c.oid, 'select'), has_table_privilege('authenticated', c.oid, 'select'),
        exists (select 1 from aclexplode(c.relacl) a where a.grantee = 0),
        obj_description(c.oid, 'pg_class') is not null
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='$NAME'; rollback;" 2>&1)
    print -r -- "$out" > $OUTDIR/readback.txt
    line=$(print -r -- "$out" | grep -E '^1\|' | head -1)
    print -r -- "readback: $line"
    [[ $line == "1|t|20|t|t|t|t|f|f|f|f|f|t" ]] \
      || fail "readback differs from the expected table, RLS, grants or ledger row; see $OUTDIR/readback.txt"
    echo "applied and read back ($OUTDIR)"
    ;;
  smoke)
    out=$(${PSQL[@]} -At -F ' ' -c "begin read only; set local statement_timeout='5s'; set local role service_role;
      select 'rows', count(*) from public.$NAME; rollback;" 2>&1)
    print -r -- "$out" > $OUTDIR/smoke-sql.txt
    print -r -- "$out" | grep -E '^rows [0-9]+$' | head -1
    print -r -- "$out" | grep -qE '^rows 0$' || fail "SQL smoke did not read an empty table as service_role; see $OUTDIR/smoke-sql.txt"
    if [[ ${SMOKE_HTTP:-1} != 0 ]]; then
      api=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' $ENVF | head -1 | cut -d= -f2- | tr -d '"')
      key=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' $ENVF | head -1 | cut -d= -f2- | tr -d '"')
      [[ -n $api && -n $key ]] || fail "API URL or service key missing from $ENVF"
      hdr=$OUTDIR/.headers
      printf 'apikey: %s\nAuthorization: Bearer %s\nAccept: application/json\n' "$key" "$key" > $hdr
      code=$(curl -sS --max-time 15 -o $OUTDIR/smoke-http.json -w '%{http_code}' -H @$hdr \
        "$api/rest/v1/$NAME?select=surface&limit=1")
      rm -f $hdr
      rows=$(python3 -I -c "import json,sys; d=json.load(open(sys.argv[1])); print(len(d) if isinstance(d, list) else -1)" $OUTDIR/smoke-http.json 2>/dev/null)
      echo "PostgREST GET: HTTP $code, $rows rows"
      [[ $code == 200 && $rows == 0 ]] || fail "PostgREST smoke failed (HTTP $code, rows $rows); see $OUTDIR/smoke-http.json"
    fi
    echo "smoke ok ($OUTDIR)"
    ;;
esac
