#!/bin/bash
# Usage: run-e2e.sh <evidence-dir> <json> [playwright args]. Runs the snapshot's spec against the snapshot server on :3140.
H=/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/SS1
cd /private/tmp/fhfh-ss1-t17/web || exit 9
EV=$1; JSON=$2; shift 2
env -u CI -u GIT_DIR PLAYWRIGHT_PORT=3140 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3140 NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=http://supabase.e2e.invalid \
  SOCIAL_SHARE_EVIDENCE_DIR=$EV PLAYWRIGHT_JSON_OUTPUT_NAME=$JSON C7_NET_LOG=$H/t17/node-network.jsonl NODE_OPTIONS="--require $H/net-deny-log.cjs" \
  npx --no-install playwright test e2e/social-share.spec.ts --reporter=list,json --output=$H/t17/test-results "$@"
