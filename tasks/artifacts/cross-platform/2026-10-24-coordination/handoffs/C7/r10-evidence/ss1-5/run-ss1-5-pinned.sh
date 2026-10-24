#!/bin/bash
# C7 ticket 10: SS1-5 pinned byte-stability run. Own isolated server on :3110 under deny preload; skip-server Playwright.
H=/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/C7
E=$H/r10-evidence/ss1-5; P=$H/social-share/c7-net-deny-log.cjs
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
    SOCIAL_SHARE_PINNED_PLAYER_SHA256=17f84737929843a5c844bf596a620385c2120acb8bd5935975c404e936d1409f,46c00e2040d774a08855e4f45dad2209f5597457210c14617fccac9b6fb8c5b9,c50ad5f895e6e8cae65255fef764ed1afe06d429590df764637adce31fadfffd,2b5cd4a38813e6e963d6453181947c56f45d995d71ffb3d02f3bd71a9650e0b1 \
    npx --no-install playwright test e2e/social-share.spec.ts --reporter=list,json --output=$E/test-results
  code=$?
fi
echo "playwright exit=$code $(date -u +%FT%TZ)"
kill -TERM -$PGID 2>/dev/null; for i in $(seq 1 20); do [ "$(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l)" -eq 0 ] && break; sleep 1; done
left=$(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | awk '{print $2}' | sort -u)
for p in $left; do ps -o command= -p $p | grep -q "fhfhockey.com/web" && kill -TERM $p; done; sleep 2
echo "post-listen 3110: $(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ') 3000: $(lsof -nP -iTCP:3000 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ') 3125: $(lsof -nP -iTCP:3125 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ') pgid-procs: $(pgrep -g $PGID | wc -l | tr -d ' ')"
exit $code
