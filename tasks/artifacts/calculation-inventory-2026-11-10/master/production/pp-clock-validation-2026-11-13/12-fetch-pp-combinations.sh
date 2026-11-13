#!/bin/zsh
# Decision 151 O1: page the stored PP numerator (powerPlayCombinations, scalar
# columns only) by game for one season/game type in a classes CSV, with the
# same in-session hygiene gate as 04-fetch-pbp.sh. Read-only.
# Usage: 12-fetch-pp-combinations.sh <classes.csv> <season_id> <game_type> <out_dir> [batch_size=10]
set -e
CLASSES=$1 SEASON=$2 TYPE=$3 OUT=$4 BATCH=${5:-10}
mkdir -p $OUT
ids=($(awk -F, -v s=$SEASON -v t=$TYPE 'NR>1 && $2==s && $3==t {print $1}' $CLASSES | sort -un))
echo "season $SEASON type $TYPE: ${#ids} games" >&2
for ((i=1; i<=${#ids}; i+=BATCH)); do
  chunk=(${ids[@]:$((i-1)):$BATCH})
  file=$OUT/ppcombos-$SEASON-$TYPE-$(printf %05d $i).csv
  [[ -s $file ]] && continue
  list=${(j:,:)chunk}
  $TMPDIR/pgpool.sh -q <<SQL
set statement_timeout = '10s';
select (count(*) filter (where state='active' and pid<>pg_backend_pid()) > 5
     or coalesce(max(extract(epoch from now()-query_start)) filter (where state='active' and pid<>pg_backend_pid()),0) > 10) as busy
from pg_stat_activity where datname = current_database() and backend_type = 'client backend' \gset
\if :busy
\echo STOP: database busy
\quit
\endif
\copy (select "gameId" as game_id, "playerId" as player_id, unit, "PPTOI" as pptoi, pp_unit_relative_toi, pp_share_of_team from "powerPlayCombinations" where "gameId" in ($list) order by 1, 2) to '$file.part' with csv header
SQL
  if [[ -f $file.part ]]; then mv $file.part $file; else echo "stopped before batch $i" >&2; exit 3; fi
done
echo "done" >&2
