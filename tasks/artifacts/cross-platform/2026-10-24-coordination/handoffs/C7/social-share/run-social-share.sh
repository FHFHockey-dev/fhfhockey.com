#!/bin/bash
# C7 SITE-SOCIAL-SHARE evidence run (reviewer-owned). Run from anywhere; cds into web/.
H=/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/C7/social-share
cd /Users/tim/Code/fhfhockey.com/web || exit 9
echo "start $(date -u +%FT%TZ)"; echo "pre-listen 3110: $(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ')"
mkdir -p $H/evidence $H/test-results
env -u CI -u GIT_DIR PLAYWRIGHT_PORT=3110 NEXT_TELEMETRY_DISABLED=1 \
  SOCIAL_SHARE_EVIDENCE_DIR=$H/evidence PLAYWRIGHT_JSON_OUTPUT_NAME=$H/results.json \
  C7_NET_LOG=$H/node-network.jsonl NODE_OPTIONS="--require $H/c7-net-deny-log.cjs" \
  npx --no-install playwright test e2e/social-share.spec.ts --reporter=list,json --trace=on --output=$H/test-results
code=$?
echo "playwright exit=$code end $(date -u +%FT%TZ)"
echo "post-listen 3110: $(lsof -nP -iTCP:3110 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ') 3000: $(lsof -nP -iTCP:3000 -sTCP:LISTEN | tail -n +2 | wc -l | tr -d ' ')"
exit $code
