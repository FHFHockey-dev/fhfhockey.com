#!/bin/zsh
# Page stored NHL play-by-play by game (scalar columns only; no jsonb) for the
# games listed in a classes CSV. Each batch runs the read-hygiene gate in the
# same psql session and quits before reading if the database is busy.
# Usage: 04-fetch-pbp.sh <classes.csv> <season_id> <out_dir> [batch_size=10]
set -e
CLASSES=$1 SEASON=$2 OUT=$3 BATCH=${4:-10}
mkdir -p $OUT
ids=($(awk -F, -v s=$SEASON 'NR>1 && $2==s {print $1}' $CLASSES | sort -un))
echo "season $SEASON: ${#ids} games, batch $BATCH" >&2
for ((i=1; i<=${#ids}; i+=BATCH)); do
  chunk=(${ids[@]:$((i-1)):$BATCH})
  file=$OUT/pbp-$SEASON-$(printf %05d $i).csv
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
\copy (select game_id, event_id, sort_order, period_number, period_type, time_in_period, time_remaining, situation_code, type_desc_key, event_owner_team_id, penalty_type_code, penalty_desc_key, penalty_duration_minutes, committed_by_player_id, served_by_player_id from nhl_api_pbp_events where game_id in ($list) order by game_id, sort_order, event_id) to '$file.part' with csv header
SQL
  if [[ -f $file.part ]]; then mv $file.part $file; else echo "stopped before batch $i" >&2; exit 3; fi
done
echo "done season $SEASON" >&2
