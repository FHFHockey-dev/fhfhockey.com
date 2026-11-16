#!/bin/zsh
# Migration 155 (physical-totals covering index + date-range body): preflight, two attended apply steps, readback, smoke.
# FAILS CLOSED (exit 7). Each step needs TJ's own approval.
#   --preflight                              read-only checks for the next step (default)
#   --index --confirm idx_wgo_skater_stats_gp1_physical
#                                            step 1: CREATE INDEX CONCURRENTLY (no transaction), then check it is valid;
#                                            a build that ends INVALID is dropped concurrently (cleanup) and the step fails
#   --function --confirm 20261116010000      step 2, only once the index is valid: one transaction replaces the body,
#                                            records the ledger row and reloads PostgREST; then an exact readback
#   --smoke                                  after step 2, read-only: one SQL timing run as service_role (8 s timeout)
#                                            and one PostgREST GET (SMOKE_HTTP=0 skips it)
# PSQL_CMD replaces the pooler wrapper (local self-test only). Outputs go to a private 0700 directory (OUTDIR, default
# ~/forge-pilot/migration-155-<UTC>). Credentials are read from web/.env.local and never printed or put on a command line.
set -u
umask 077
HERE=${0:A:h}
ROOT=${HERE:h:h:h:h}
ENVF=${FHFH_ENV_FILE:-$ROOT/web/.env.local}
MIG=$ROOT/supabase/migrations/20261116010000_forge_physical_totals_covering_index.sql
EXPECT_SHA=7835a06deb5d89ac324df5d586d592e5d7d830ffe5646bcf5f8d748e1c5c887f
VERSION=20261116010000
NAME=forge_physical_totals_covering_index
IDX=idx_wgo_skater_stats_gp1_physical
IDX_DEF='CREATE INDEX idx_wgo_skater_stats_gp1_physical ON public.wgo_skater_stats USING btree (date) INCLUDE (season_id, position_code, toi_per_game, hits, blocked_shots) WHERE ((games_played = 1) AND (toi_per_game > (0)::double precision))'
FN='public.forge_league_skater_physical_totals(integer, date)'
MD5_BEFORE=0eec9782543c02db802b021c950ecf6e
MD5_AFTER=5b67ecb4dee0e75e6285fc5468ef06e7
SMOKE_MS_MAX=${SMOKE_MS_MAX:-2000}
PSQL=(${=PSQL_CMD:-$HERE/pgpool.sh})
OUTDIR=${OUTDIR:-$HOME/forge-pilot/migration-155-$(date -u +%Y%m%dT%H%M%SZ)}

fail() { echo "FAIL: $*" >&2; exit 7; }
mode=preflight; confirm=""
while (( $# )); do
  case $1 in
    --preflight) mode=preflight ;;
    --index) mode=index ;;
    --function) mode=function ;;
    --smoke) mode=smoke ;;
    --confirm) shift; confirm=${1:-} ;;
    *) fail "unknown argument $1" ;;
  esac
  shift
done
mkdir -p $OUTDIR && chmod 700 $OUTDIR || fail "cannot create $OUTDIR"
[[ $(shasum -a 256 $MIG | cut -d' ' -f1) == $EXPECT_SHA ]] || fail "migration file hash differs from $EXPECT_SHA"

if [[ -z ${PSQL_CMD:-} ]]; then
  python3 -I -c "import socket,sys; socket.getaddrinfo(sys.argv[1], 5432)" aws-0-us-east-1.pooler.supabase.com 2>/dev/null \
    || fail "cannot resolve the pooler host"
fi

# One read-only query. Line: active longest waits cron ledger idx_state body owner superuser roles
#   idx_state: 0 absent, 1 valid with the exact definition, 2 present but invalid or different
#   body: 1 = the 137 body, 2 = the 155 body, 0 = anything else
#   owner: 1 when the session may create indexes on wgo_skater_stats (owner or member of the owning role)
state() {
  local out rc line
  out=$(${PSQL[@]} -At -F ' ' -c "begin read only; set local statement_timeout='5s'; select
    (select count(*) from pg_stat_activity where state='active' and pid<>pg_backend_pid()),
    (select coalesce(ceil(max(extract(epoch from clock_timestamp()-query_start))),0)::int from pg_stat_activity where state='active' and pid<>pg_backend_pid()),
    (select count(*) from pg_stat_activity where wait_event_type='Lock'),
    (select count(*) from cron.job_run_details where status in ('running','starting') and start_time > now()-interval '2 hours'),
    (select count(*) from supabase_migrations.schema_migrations where version='$VERSION'),
    (select case when i.indexrelid is null then 0
                 when i.indisvalid and i.indisready and pg_get_indexdef(i.indexrelid) = '$IDX_DEF' then 1 else 2 end
       from (select 1) one left join pg_index i on i.indexrelid = to_regclass('public.$IDX')),
    (select case md5(prosrc) when '$MD5_BEFORE' then 1 when '$MD5_AFTER' then 2 else 0 end from pg_proc
       where oid = '$FN'::regprocedure),
    (select case when pg_has_role(current_user, c.relowner, 'USAGE') then 1 else 0 end from pg_class c
       where c.oid = 'public.wgo_skater_stats'::regclass),
    (select case when rolsuper then 1 else 0 end from pg_roles where rolname=current_user),
    (select count(*) from pg_roles where rolname in ('service_role','anon','authenticated')); rollback;" 2>&1)
  rc=$?
  line=$(print -r -- "$out" | grep -E '^[0-9]+( [0-9]+){9}$' | head -1)
  (( rc == 0 )) && [[ -n $line ]] || fail "state query did not answer cleanly (psql exit $rc): $(print -r -- "$out" | tail -2)"
  read active longest waits cron ledger idx body owner superuser roles <<< "$line"
  print -r -- "state $(date -u +%H:%M:%SZ): active=$active longest=${longest}s lock_waits=$waits cron_running=$cron ledger_row=$ledger index=$idx body=$body may_index=$owner superuser=$superuser roles=$roles/3" | tee -a $OUTDIR/state.txt
  (( superuser == 0 && roles == 3 && owner == 1 )) || fail "superuser session, missing API role, or no index privilege on wgo_skater_stats"
}
quiet() { (( active <= 5 && longest <= 10 && waits == 0 && cron == 0 )) || fail "database busy"; }

case $mode in
  preflight)
    state
    if (( idx == 0 && body == 1 && ledger == 0 )); then echo "next: step 1 (--index)"
    elif (( idx == 1 && body == 1 && ledger == 0 )); then echo "next: step 2 (--function)"
    elif (( idx == 1 && body == 2 && ledger == 1 )); then echo "applied; next: --smoke"
    else fail "unexpected state (index=$idx body=$body ledger=$ledger)"; fi
    echo "preflight ok; nothing changed ($OUTDIR)"
    ;;
  index)
    [[ $confirm == $IDX ]] || fail "--index needs --confirm $IDX"
    state; quiet
    (( idx == 0 && body == 1 && ledger == 0 )) || fail "step 1 needs no index yet and the 137 body (index=$idx body=$body ledger=$ledger)"
    cat > $OUTDIR/index.sql <<SQL
\\set ON_ERROR_STOP on
set statement_timeout = '15min';
set lock_timeout = '10s';
select 'index_start', clock_timestamp();
create index concurrently if not exists $IDX on public.wgo_skater_stats (date)
  include (season_id, position_code, toi_per_game, hits, blocked_shots)
  where games_played = 1 and toi_per_game > 0;
select 'index_done', clock_timestamp();
SQL
    perl -e 'alarm shift; exec @ARGV' 1000 ${PSQL[@]} -X -f $OUTDIR/index.sql > $OUTDIR/index.out 2>&1
    rc=$?
    cat $OUTDIR/index.out
    out=$(${PSQL[@]} -At -F '|' -c "select i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid), pg_size_pretty(pg_relation_size(i.indexrelid))
      from pg_index i where i.indexrelid = to_regclass('public.$IDX')" 2>&1)
    print -r -- "$out" > $OUTDIR/index-readback.txt
    print -r -- "index readback: $out"
    if [[ $out == "t|t|$IDX_DEF|"* ]]; then echo "step 1 done: index valid ($OUTDIR)"; exit 0; fi
    if [[ -n $out && $out != *ERROR* ]]; then
      ${PSQL[@]} -X -c "set lock_timeout = '10s'; drop index concurrently if exists public.$IDX" >> $OUTDIR/index.out 2>&1
      fail "index build ended invalid or different (psql exit $rc); dropped it concurrently; see $OUTDIR"
    fi
    fail "index build failed (psql exit $rc); no index present; see $OUTDIR/index.out"
    ;;
  function)
    [[ $confirm == $VERSION ]] || fail "--function needs --confirm $VERSION"
    state; quiet
    (( idx == 1 )) || fail "step 2 refuses: the index is not present and valid (index=$idx); run step 1 first"
    (( body == 1 && ledger == 0 )) || fail "step 2 needs the 137 body and no ledger row (body=$body ledger=$ledger)"
    cp $MIG $OUTDIR/migration.sql
    [[ $(shasum -a 256 $OUTDIR/migration.sql | cut -d' ' -f1) == $EXPECT_SHA ]] || fail "copied file hash differs"
    # The function part only: from the file's 'begin;' to its 'commit;' (its non-concurrent index line is skipped).
    awk '/^begin;$/{on=1} on && !/^begin;$/ && !/^commit;$/{print} /^commit;$/{on=0}' $OUTDIR/migration.sql > $OUTDIR/function.sql
    grep -q 'create or replace function public.forge_league_skater_physical_totals' $OUTDIR/function.sql || fail "function body not found"
    grep -qi 'create index' $OUTDIR/function.sql && fail "function part unexpectedly contains an index statement"
    cat > $OUTDIR/apply.sql <<SQL
\\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
\\i $OUTDIR/function.sql
insert into supabase_migrations.schema_migrations (version, name) values ('$VERSION', '$NAME');
notify pgrst, 'reload schema';
select 'applied_at', clock_timestamp();
commit;
SQL
    perl -e 'alarm shift; exec @ARGV' 120 ${PSQL[@]} -X -f $OUTDIR/apply.sql > $OUTDIR/apply.out 2>&1
    rc=$?
    cat $OUTDIR/apply.out
    (( rc == 0 )) && grep -q '^COMMIT$' $OUTDIR/apply.out || fail "step 2 did not commit (psql exit $rc); see $OUTDIR/apply.out"
    out=$(${PSQL[@]} -At -F '|' -c "begin read only; set local statement_timeout='5s';
      select (select count(*) from supabase_migrations.schema_migrations where version='$VERSION' and name='$NAME'),
        md5(p.prosrc), p.provolatile, p.prosecdef, array_to_string(p.proconfig, ','),
        has_function_privilege('service_role', p.oid, 'execute'), has_function_privilege('anon', p.oid, 'execute'),
        has_function_privilege('authenticated', p.oid, 'execute'),
        exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'),
        (select i.indisvalid from pg_index i where i.indexrelid = to_regclass('public.$IDX'))
      from pg_proc p where p.oid = '$FN'::regprocedure; rollback;" 2>&1)
    print -r -- "$out" > $OUTDIR/readback.txt
    line=$(print -r -- "$out" | grep -E '^1\|' | head -1)
    print -r -- "readback: $line"
    [[ $line == "1|$MD5_AFTER|s|f|search_path=\"\"|t|f|f|f|t" ]] || fail "readback differs; see $OUTDIR/readback.txt"
    echo "step 2 applied and read back ($OUTDIR)"
    ;;
  smoke)
    state
    (( idx == 1 && body == 2 && ledger == 1 )) || fail "smoke runs only after both steps (index=$idx body=$body ledger=$ledger)"
    out=$(${PSQL[@]} -At -F ' ' -c "begin read only; set local statement_timeout='8s'; set local role service_role;
      explain (analyze, buffers) select * from public.forge_league_skater_physical_totals(20262027, '2026-11-15');
      select scope, position_group, player_games, hits, blocks, round(toi_seconds) from public.forge_league_skater_physical_totals(20262027, '2026-11-15');
      rollback;" 2>&1)
    print -r -- "$out" > $OUTDIR/smoke-sql.txt
    print -r -- "$out" | grep -E 'Execution Time|Buffers|^(prior2|to_date) '
    ms=$(print -r -- "$out" | sed -nE 's/^Execution Time: ([0-9.]+) ms$/\1/p' | head -1)
    rows=$(print -r -- "$out" | grep -cE '^(prior2|to_date) (D|F) [0-9]+ ')
    [[ -n $ms && $rows == 4 ]] || fail "SQL smoke did not return a timing and 4 rows; see $OUTDIR/smoke-sql.txt"
    python3 -I -c "import sys; sys.exit(0 if float(sys.argv[1]) <= float(sys.argv[2]) else 1)" $ms $SMOKE_MS_MAX \
      || fail "SQL smoke took $ms ms (limit $SMOKE_MS_MAX ms)"
    if [[ ${SMOKE_HTTP:-1} != 0 ]]; then
      api=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' $ENVF | head -1 | cut -d= -f2- | tr -d '"')
      key=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' $ENVF | head -1 | cut -d= -f2- | tr -d '"')
      [[ -n $api && -n $key ]] || fail "API URL or service key missing from $ENVF"
      hdr=$OUTDIR/.headers
      printf 'apikey: %s\nAuthorization: Bearer %s\nAccept: application/json\n' "$key" "$key" > $hdr
      code=$(curl -sS --max-time 15 -o $OUTDIR/smoke-http.json -w '%{http_code} %{time_total}' -H @$hdr \
        "$api/rest/v1/rpc/forge_league_skater_physical_totals?p_season_id=20262027&p_cutoff=2026-11-15")
      rm -f $hdr
      n=$(python3 -I -c "import json,sys; d=json.load(open(sys.argv[1])); print(len(d) if isinstance(d, list) else -1)" $OUTDIR/smoke-http.json 2>/dev/null)
      echo "PostgREST GET: HTTP/time $code, $n rows"
      [[ ${code%% *} == 200 && $n == 4 ]] || fail "PostgREST smoke failed ($code, rows $n); see $OUTDIR/smoke-http.json"
    fi
    echo "smoke ok ($OUTDIR)"
    ;;
esac
