#!/bin/zsh
# Decision 151 O4: read-only fetch of the NHL HTML Game Summary (which holds the
# Penalty Summary) for exactly the five scrum-mismatch games. Five requests to
# nhl.com, one at a time, 10 s apart; no other provider. Same URL as
# lib/NHL/htmlReports.ts buildNhlGameSummaryReportUrl. Nothing is written to the
# database. Raw pages stay outside the repository.
# Usage: 13-fetch-penalty-summaries.sh <out_dir>
set -e
OUT=$1
mkdir -p $OUT
games=(2026020036 2026020153 2025021248 2025021097 2025030112)
for g in $games; do
  season=$(( g / 1000000 ))$(( g / 1000000 + 1 ))
  url="https://www.nhl.com/scores/htmlreports/${season}/GS${g: -6}.HTM"
  [[ -s $OUT/GS-$g.HTM ]] && { echo "have $g" >&2; continue; }
  code=$(curl -sS -A "Mozilla/5.0" --max-time 30 -o $OUT/GS-$g.HTM -w '%{http_code}' "$url")
  echo "$g $url HTTP $code $(wc -c < $OUT/GS-$g.HTM) bytes" >&2
  [[ $code == 200 ]] || { rm -f $OUT/GS-$g.HTM; echo "stop: HTTP $code" >&2; exit 3; }
  [[ $g == ${games[-1]} ]] || sleep 10
done
