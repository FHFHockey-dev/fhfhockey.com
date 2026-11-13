#!/bin/zsh
# Decision 152 Part B (F11): when the stored powerPlayCombinations rows were
# first written (created_at; upserts don't change it) and which writer runs the
# cron audit recorded. Guarded, bounded, read-only; scalar columns only, plus
# one extracted text field (details->>'url') from at most 500 audit rows.
#   16-fetch-numerator-provenance.sh <classes.csv> <out_dir>
set -e
CLASSES=$1 OUT=$2
mkdir -p $OUT
guard='set statement_timeout = '"'"'10s'"'"';
select (count(*) filter (where state='"'"'active'"'"' and pid<>pg_backend_pid()) > 5
     or coalesce(max(extract(epoch from now()-query_start)) filter (where state='"'"'active'"'"' and pid<>pg_backend_pid()),0) > 10) as busy
from pg_stat_activity where datname = current_database() and backend_type = '"'"'client backend'"'"' \gset
\if :busy
\echo STOP: database busy
\quit
\endif'
ids=($(awk -F, 'NR>1 && $2=="20262027" && $3=="2" {print $1}' $CLASSES | sort -un))
for ((i=1; i<=${#ids}; i+=50)); do
  file=$OUT/created-$(printf %05d $i).csv
  [[ -s $file ]] && continue
  list=${(j:,:)${ids[@]:$((i-1)):50}}
  $TMPDIR/pgpool.sh -q <<SQL
$guard
\copy (select "gameId" as game_id, "playerId" as player_id, created_at from "powerPlayCombinations" where "gameId" in ($list) order by 1, 2) to '$file.part' with csv header
SQL
  if [[ -f $file.part ]]; then mv $file.part $file; else echo "stopped before batch $i" >&2; exit 3; fi
done
file=$OUT/cron-audit-pp-combinations.csv
if [[ ! -s $file ]]; then
  $TMPDIR/pgpool.sh -q <<SQL
$guard
\copy (select run_time, job_name, status, rows_affected, details->>'url' as url from cron_job_audit where job_name ilike '%power-play-combination%' and run_time >= '2026-10-01' order by run_time limit 500) to '$file.part' with csv header
SQL
  if [[ -f $file.part ]]; then mv $file.part $file; else echo "stopped before audit read" >&2; exit 3; fi
fi
echo done >&2
