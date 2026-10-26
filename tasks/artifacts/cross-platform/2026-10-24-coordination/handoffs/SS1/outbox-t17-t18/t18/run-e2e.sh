#!/bin/bash
# Usage: run-e2e.sh <evidence-dir> <json> [playwright args]. Snapshot t18 spec against the t18 server on :3140; all output in the outbox.
O=/private/tmp/fhfh-claude-outbox/SS1/t18
cd /private/tmp/fhfh-ss1-t18/web || exit 9
EV=$1; JSON=$2; shift 2
env -u CI -u GIT_DIR PLAYWRIGHT_PORT=3140 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3140 NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=http://supabase.e2e.invalid \
  SOCIAL_SHARE_EVIDENCE_DIR=$EV PLAYWRIGHT_JSON_OUTPUT_NAME=$JSON C7_NET_LOG=$O/node-network.jsonl NODE_OPTIONS="--require /private/tmp/fhfh-claude-outbox/SS1/net-deny.cjs" \
  npx --no-install playwright test e2e/social-share.spec.ts --reporter=list,json --output=$O/test-results "$@"
