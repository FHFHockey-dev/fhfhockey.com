#!/bin/bash
# C7 ticket 9: SS1-4 pinned byte-stability run. Own isolated server on :3110 under deny preload; skip-server Playwright.
H=/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/C7
E=$H/r9-evidence/ss1-4; P=$H/social-share/c7-net-deny-log.cjs
cd /Users/tim/Code/fhfhockey.com/web || exit 9
echo "start $(date -u +%FT%TZ) pre-listen 3110: $(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ')"
[ "$(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l)" -eq 0 ] || { echo "3110 busy; abort"; exit 8; }
set -m
env -u CI -u GIT_DIR PLAYWRIGHT_ISOLATED_NEXT=1 NEXT_TELEMETRY_DISABLED=1 C7_NET_LOG=$E/node-network.jsonl NODE_OPTIONS="--require $P" \
  npm run dev:stable -- -p 3110 > $E/server.log 2>&1 &
SPID=$!; PGID=$(ps -o pgid= -p $SPID | tr -d ' '); echo "server pgid=$PGID"
ready=0; for i in $(seq 1 90); do code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://127.0.0.1:3110/social-share/game-grid); [ "$code" = 200 ] && { ready=1; break; }; sleep 2; done
echo "ready=$ready listeners: $(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | awk '{print $1"/"$2}' | tr '\n' ' ') 3000=$(lsof -nP -iTCP:3000 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ')"
code=7
if [ $ready = 1 ]; then
  env -u CI -u GIT_DIR PLAYWRIGHT_PORT=3110 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3110 NEXT_TELEMETRY_DISABLED=1 \
    SOCIAL_SHARE_EVIDENCE_DIR=$E/evidence PLAYWRIGHT_JSON_OUTPUT_NAME=$E/results.json C7_NET_LOG=$E/node-network.jsonl NODE_OPTIONS="--require $P" \
    SOCIAL_SHARE_PINNED_GRID_SHA256=7f4cf9c0110514618368fcc3ce87149651bdae5fd2ca20766dce4ea359cf8462 \
    SOCIAL_SHARE_PINNED_EXTRA_SHA256=d91622b66fc47bc3d34f00a53dd74f159fa4c2ecc1a48e79a778216a8a11811e,2676d8b2d5e42a02f0de6978c5d4d9fcd4b87060dec1eb3b1414ab0d76c9abef \
    SOCIAL_SHARE_PINNED_PLAYER_SHA256=4579feb17f26c515d80af15797ef0d680713e932b23e2015e72a5fbfb818a807,1a6eb8a75c1557f4c608113f04bf3bbbc088d79683142fac98094c9154000de4,193ae6a64873103130789b51dd1237089c6d3c939a116f128cf2b03feb712b6c,2b5cd4a38813e6e963d6453181947c56f45d995d71ffb3d02f3bd71a9650e0b1 \
    npx --no-install playwright test e2e/social-share.spec.ts --reporter=list,json --output=$E/test-results
  code=$?
fi
echo "playwright exit=$code $(date -u +%FT%TZ)"
kill -TERM -$PGID 2>/dev/null; for i in $(seq 1 20); do [ "$(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l)" -eq 0 ] && break; sleep 1; done
left=$(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | awk '{print $2}' | sort -u)
for p in $left; do ps -o command= -p $p | grep -q "fhfhockey.com/web" && kill -TERM $p; done; sleep 2
echo "post-listen 3110: $(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ') 3000: $(lsof -nP -iTCP:3000 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ') 3125: $(lsof -nP -iTCP:3125 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ') pgid-procs: $(pgrep -g $PGID | wc -l | tr -d ' ')"
exit $code
