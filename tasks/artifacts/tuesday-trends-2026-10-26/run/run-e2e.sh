#!/bin/bash
# Usage: run-e2e.sh <evidence-dir> <json> [playwright args]. Canonical spec against the isolated :3110 server (PLAYWRIGHT_ISOLATED_NEXT=1),
# fictional .invalid Supabase host, and the SS1 network-deny preload (non-loopback connections refused and logged).
A=/Users/tim/Code/fhfhockey.com/tasks/artifacts/tuesday-trends-2026-10-26
cd /Users/tim/Code/fhfhockey.com/web || exit 9
EV=$1; JSON=$2; shift 2
env -u CI -u GIT_DIR PLAYWRIGHT_PORT=3110 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3110 NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=http://supabase.e2e.invalid \
  SOCIAL_SHARE_EVIDENCE_DIR=$EV TUESDAY_EVIDENCE_DIR=$A/screens PLAYWRIGHT_JSON_OUTPUT_NAME=$JSON C7_NET_LOG=$A/run/node-network.jsonl \
  NODE_OPTIONS="--require /Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/SS1/outbox-t17-t18/net-deny.cjs" \
  npx --no-install playwright test e2e/social-share.spec.ts --reporter=list,json --output=$A/run/test-results "$@"
