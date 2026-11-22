#!/bin/zsh
# Read-only live acceptance for one natural daily FORGE run.
# Usage: check.sh <runDate YYYY-MM-DD> <sourceDate YYYY-MM-DD> <control|offday>
# Requests: 2 NHL schedule GETs (api-web), 1 read-only DB session, 2 sequential production reader GETs
# (Start Chart, Daily RSO). Writes nothing anywhere except files under acceptance/<runDate>/.
set -e
RUN=$1 SRC=$2 KIND=$3
[[ $RUN == 2026-* && $SRC == 2026-* && ( $KIND == control || $KIND == offday ) ]] || { echo "usage: check.sh <runDate> <sourceDate> <control|offday>" >&2; exit 2; }
HERE=${0:A:h}; OUT=$HERE/$RUN; mkdir -p $OUT
PG=/Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-pregame-capture-2026-11-14/operator/pgpool.sh

curl -s -m 10 "https://api-web.nhle.com/v1/schedule/$RUN" > $OUT/schedule-run.json
curl -s -m 10 "https://api-web.nhle.com/v1/schedule/$SRC" > $OUT/schedule-source.json

$PG -qAt > $OUT/db.json <<SQL
set default_transaction_read_only=on;
select json_build_object(
 'at', now(),
 'pipeline', (select json_agg(json_build_object('scope',scope_key,'stage',operation_key,'status',status,'revision',revision,
     'cursor_date',cursor_date,'last_error',last_error,'updated_at',updated_at) order by updated_at)
   from projection_pipeline_state where pipeline_key='rolling_forge_pipeline' and scope_key like '%:$RUN'),
 'nst', (select json_agg(json_build_object('run_time',run_time,'status',status,'rows',rows_affected,
     'state',details->'nstProgress'->>'state','verifiedOffDates',details->'nstProgress'->'verifiedOffDates',
     'missingScheduleDates',details->'nstProgress'->'missingScheduleDates','planned',details->'nstProgress'->'plannedRequestCount',
     'networkAttempts',details->'nstProgress'->'networkAttempts') order by run_time)
   from cron_job_audit where job_name='update-nst-gamelog' and run_time >= timestamptz '$RUN 09:30:00+00' and run_time < timestamptz '$RUN 14:00:00+00'),
 'runs', (select json_agg(json_build_object('run_id',run_id,'status',status,'git_sha',git_sha,'created_at',created_at,
     'scope',metrics->'execution_scope') order by created_at) from forge_runs where as_of_date='$RUN'),
 'player_rows', (select json_object_agg(k,c) from (select run_id::text||':'||game_id k, count(*) c
   from forge_player_projections where as_of_date='$RUN' group by 1) x)
)::text;
SQL

curl -s -m 30 -D $OUT/sc.headers -o $OUT/startchart.json "https://fhfhockey.com/api/v1/start-chart?date=$RUN"
curl -s -m 30 -D $OUT/rso.headers -o $OUT/rso.json \
  "https://fhfhockey.com/api/v1/roster-schedule-optimizer/data?seasonId=20262027&startDate=$RUN&endDate=$RUN"

# Raw receipts stay in $OUT whatever the verdict; a failed or pending evaluation never deletes them.
python3 -I $HERE/summarize.py $OUT $RUN $SRC $KIND
