#!/bin/bash
# Approved live check only (needs TJ's direct approval for the exact run). Starts an isolated :3110 server
# under the allowlist/logging preload, waits for the port without any HTTP warm-up GET, runs the serial
# check, then stops the server. Usage: run-live.sh <outDir>
set -u
L=$(cd "$(dirname "$0")" && pwd); OUT=$1; mkdir -p "$OUT"
[ "$(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l)" -eq 0 ] || { echo "3110 busy; abort"; exit 8; }
cd /Users/tim/Code/fhfhockey.com/web || exit 9
set -m
env -u CI -u GIT_DIR PLAYWRIGHT_ISOLATED_NEXT=1 NEXT_TELEMETRY_DISABLED=1 SS1_LIVE_LOG="$OUT/upstream.jsonl" NODE_OPTIONS="--require $L/live-allow-log.cjs" npm run dev:stable -- -p 3110 > "$OUT/server.log" 2>&1 &
PGID=$(ps -o pgid= -p $! | tr -d ' ')
for i in $(seq 1 60); do [ "$(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l)" -gt 0 ] && break; sleep 2; done
node "$L/live-check.cjs" "$OUT"; code=$?
kill -TERM -"$PGID" 2>/dev/null; sleep 3
echo "check exit=$code; 3110 listeners after: $(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ')"
exit $code
