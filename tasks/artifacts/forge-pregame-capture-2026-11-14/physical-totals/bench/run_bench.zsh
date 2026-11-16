#!/bin/zsh
# Local benchmark of forge_league_skater_physical_totals on a production-shaped wgo_skater_stats (see gen_data_sql.py).
# Usage: run_bench.zsh <pg bin dir> <socket dir> <port> <data dir> <out file>
# Runs the function and its body as a prepared statement (generic plan, which is how a non-inlined SQL function plans),
# before and after the candidate covering index, cold (server restarted) and warm. Local only; never production.
set -eu
PG=$1 SOCK=$2 PORT=$3 DATA=$4 OUT=$5
HERE=${0:A:h}
P=($PG/psql -X -h $SOCK -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1)
restart() { $PG/pg_ctl -D $DATA -w -m fast restart -o "-p $PORT -k $SOCK -c listen_addresses= -c fsync=off -c shared_buffers=128MB -c random_page_cost=1.1 -c jit=off -c max_parallel_workers_per_gather=1 -c work_mem=3500kB" >/dev/null; }
run() { # label, sql
  local label=$1 sql=$2
  for pass in cold warm; do
    [[ $pass == cold ]] && restart
    print -r -- "### $label ($pass)" >> $OUT
    $P[@] -c "set plan_cache_mode = force_generic_plan" -f $HERE/../sql/bench-prepare.sql -c "$sql" 2>&1 \
      | grep -E 'Scan|Index Cond|Buffers|Execution Time|Planning Time|rows=' | grep -vE 'Values Scan|^ *->  Sort' | head -12 >> $OUT
  done
}
: > $OUT
$P[@] -At -c "select 'table', c.reltuples::bigint, c.relpages, c.relallvisible, pg_size_pretty(pg_relation_size(c.oid)) from pg_class c where c.oid='public.wgo_skater_stats'::regclass" >> $OUT
$P[@] -At -c "select 'stats', attname, null_frac, correlation from pg_stats where tablename='wgo_skater_stats' and attname in ('date','toi_per_game','season_id')" >> $OUT
$P[@] -q -f $HERE/../sql/bench-functions.sql
for v in current candidate; do
  $P[@] -At -c "select '$v', md5(string_agg(row(t.*)::text, '|' order by t.scope, t.position_group)) from public.bench_${v}(20262027, '2026-11-15') t" >> $OUT
done
run "body current, no new index"   "explain (analyze, buffers) execute probe(20262027, '2026-11-15')"
run "body candidate, no new index" "explain (analyze, buffers) execute candidate(20262027, '2026-11-15')"
run "function current, no new index" "explain (analyze, buffers) select * from public.bench_current(20262027, '2026-11-15')"
$P[@] -q -c "create index if not exists idx_wgo_skater_stats_gp1_physical on public.wgo_skater_stats (date) include (season_id, position_code, toi_per_game, hits, blocked_shots) where games_played = 1 and toi_per_game > 0"
$P[@] -q -c "vacuum analyze public.wgo_skater_stats"
$P[@] -q -c "update public.wgo_skater_stats set hits = hits where season_id = 20262027 and date >= date '2026-11-01'"
$P[@] -At -c "select 'index', pg_size_pretty(pg_relation_size('public.idx_wgo_skater_stats_gp1_physical')), (select relallvisible from pg_class where oid='public.wgo_skater_stats'::regclass)" >> $OUT
run "body current, covering index"   "explain (analyze, buffers) execute probe(20262027, '2026-11-15')"
run "body candidate, covering index" "explain (analyze, buffers) execute candidate(20262027, '2026-11-15')"
run "function current, covering index"   "explain (analyze, buffers) select * from public.bench_current(20262027, '2026-11-15')"
run "function candidate, covering index" "explain (analyze, buffers) select * from public.bench_candidate(20262027, '2026-11-15')"
for v in current candidate; do
  $P[@] -At -c "select '$v with index', md5(string_agg(row(t.*)::text, '|' order by t.scope, t.position_group)) from public.bench_${v}(20262027, '2026-11-15') t" >> $OUT
done
