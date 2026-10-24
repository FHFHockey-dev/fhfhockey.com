#!/bin/bash
# Run 2: own isolated server on :3110 (deny preload), readiness on the social-share route (not '/', whose SSR calls prod Supabase/NHL).
H=/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/C7/social-share
cd /Users/tim/Code/fhfhockey.com/web || exit 9
G="--require $H/c7-net-deny-log.cjs"
echo "start $(date -u +%FT%TZ) pre-listen 3110: $(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ')"
[ "$(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l)" -eq 0 ] || { echo "3110 busy; abort"; exit 8; }
set -m
env -u CI -u GIT_DIR PLAYWRIGHT_ISOLATED_NEXT=1 NEXT_TELEMETRY_DISABLED=1 C7_NET_LOG=$H/node-network-run2.jsonl NODE_OPTIONS="$G" \
  npm run dev:stable -- -p 3110 > $H/server-run2.log 2>&1 &
SPID=$!; PGID=$(ps -o pgid= -p $SPID | tr -d ' '); echo "server npm pid=$SPID pgid=$PGID"
ready=0; for i in $(seq 1 90); do code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://127.0.0.1:3110/social-share/game-grid); [ "$code" = 200 ] && { ready=1; break; }; sleep 2; done
echo "ready=$ready after ~$((i*2))s; listeners: $(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | awk '{print $1"/"$2}' | tr '\n' ' ') 3000=$(lsof -nP -iTCP:3000 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ')"
code=7
if [ $ready = 1 ]; then
  env -u CI -u GIT_DIR PLAYWRIGHT_PORT=3110 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3110 NEXT_TELEMETRY_DISABLED=1 \
    SOCIAL_SHARE_EVIDENCE_DIR=$H/evidence PLAYWRIGHT_JSON_OUTPUT_NAME=$H/results.json C7_NET_LOG=$H/node-network-run2.jsonl NODE_OPTIONS="$G" \
    npx --no-install playwright test e2e/social-share.spec.ts --reporter=list,json --trace=on --output=$H/test-results
  code=$?
fi
echo "playwright exit=$code $(date -u +%FT%TZ)"
kill -TERM -$PGID 2>/dev/null; for i in $(seq 1 20); do [ "$(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l)" -eq 0 ] && break; sleep 1; done
left=$(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | awk '{print $2}' | sort -u)
for p in $left; do ps -o command= -p $p | grep -q "fhfhockey.com/web" && kill -TERM $p; done; sleep 2
echo "post-listen 3110: $(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ') 3000: $(lsof -nP -iTCP:3000 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ') server-pgid-procs: $(pgrep -g $PGID | wc -l | tr -d ' ')"
exit $code
