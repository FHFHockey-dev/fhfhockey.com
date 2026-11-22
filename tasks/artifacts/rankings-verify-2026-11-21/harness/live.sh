#!/bin/bash
# Bounded production smoke: exactly 6 sequential GETs, concurrency 1. Stop on non-200 or >30 s.
set -u
OUT=/Users/tim/Code/fhfhockey.com/tasks/artifacts/rankings-verify-2026-11-21/live
BASE=https://fhfhockey.com
Q='entity=skaters&season=20262027&position=all&deployment=all&strength=5v5&min_gp=10&min_toi=300'
MATRIX="/api/v1/contextual-rankings/matrix?entity=skaters&season=20262027&window=season&position=all&deployment=all&strength=5v5&min_gp=10&min_toi=300&sort_metric=points_per_60&sort_direction=desc&page=1&page_size=10&ranking_source=entity_metric_rankings"
TREND="/api/v1/contextual-rankings/trending?$Q&sort_direction=desc&limit=25"
n=0
get() { # name path
  n=$((n+1)); local name=$1 path=$2
  local start=$(python3 -c 'import datetime;print(datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds"))')
  local w=$(curl -sS --max-time 30 -A 'fhfh-rankings-verify/1.0' -D "$OUT/$n-$name.headers" -o "$OUT/$n-$name.json" \
     -w '%{http_code} %{time_starttransfer} %{time_total} %{size_download}' "$BASE$path")
  local rc=$?
  echo "{\"n\":$n,\"name\":\"$name\",\"startedAt\":\"$start\",\"curlExit\":$rc,\"result\":\"$w\",\"path\":\"$path\"}" >> "$OUT/requests.jsonl"
  local code=${w%% *}
  if [ $rc -ne 0 ] || [ "$code" != "200" ]; then echo "STOP at $n $name rc=$rc code=$code"; exit 1; fi
}
: > "$OUT/requests.jsonl"
get matrix "$MATRIX"
IDS=$(python3 -c "import json;d=json.load(open('$OUT/1-matrix.json'));print('%2C'.join(str(r['entity']['id']) for r in d['rows'][:6]))")
COMP="/api/v1/contextual-rankings/comparison?entity=skaters&season=20262027&window=season&position=all&deployment=all&strength=5v5&min_gp=10&min_toi=300&sort_metric=points_per_60&sort_direction=desc&player_ids=$IDS"
get trending-cold1 "$TREND"
get trending-warm1 "$TREND"
get comparison "$COMP"
sleep 90
get trending-cold2 "$TREND"
get trending-warm2 "$TREND"
echo DONE
