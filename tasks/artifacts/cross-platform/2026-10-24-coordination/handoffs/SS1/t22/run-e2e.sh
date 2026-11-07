#!/bin/bash
# Usage: run-e2e.sh <evidence-dir> <json> [playwright args]. Canonical spec against the isolated :3110 server.
H=/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/SS1
cd /Users/tim/Code/fhfhockey.com/web || exit 9
EV=$1; JSON=$2; shift 2
env -u CI -u GIT_DIR PLAYWRIGHT_PORT=3110 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3110 NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=http://supabase.e2e.invalid \
  SOCIAL_SHARE_EVIDENCE_DIR=$EV PLAYWRIGHT_JSON_OUTPUT_NAME=$JSON C7_NET_LOG=$H/t22/node-network-2.jsonl NODE_OPTIONS="--require /Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/SS1/outbox-t17-t18/net-deny.cjs" \
  npx --no-install playwright test e2e/social-share.spec.ts --reporter=list,json --output=$H/t22/test-results "$@"
