#!/bin/bash
# Usage: run-e2e.sh <evidence-dir> <json> [playwright args]; asserts every known pinned hash that is set in the environment.
H=/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/SS1
cd /Users/tim/Code/fhfhockey.com/web || exit 9
EV=$1; JSON=$2; shift 2
env -u CI -u GIT_DIR PLAYWRIGHT_PORT=3110 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3110 NEXT_TELEMETRY_DISABLED=1 \
  SOCIAL_SHARE_PINNED_GRID_SHA256=7f4cf9c0110514618368fcc3ce87149651bdae5fd2ca20766dce4ea359cf8462 \
  SOCIAL_SHARE_PINNED_EXTRA_SHA256=d91622b66fc47bc3d34f00a53dd74f159fa4c2ecc1a48e79a778216a8a11811e,2676d8b2d5e42a02f0de6978c5d4d9fcd4b87060dec1eb3b1414ab0d76c9abef \
  SOCIAL_SHARE_PINNED_PLAYER_SHA256=17f84737929843a5c844bf596a620385c2120acb8bd5935975c404e936d1409f,46c00e2040d774a08855e4f45dad2209f5597457210c14617fccac9b6fb8c5b9,c50ad5f895e6e8cae65255fef764ed1afe06d429590df764637adce31fadfffd,2b5cd4a38813e6e963d6453181947c56f45d995d71ffb3d02f3bd71a9650e0b1 \
  SOCIAL_SHARE_EVIDENCE_DIR=$EV PLAYWRIGHT_JSON_OUTPUT_NAME=$JSON C7_NET_LOG=$H/t7/node-network.jsonl NODE_OPTIONS="--require $H/net-deny-log.cjs" \
  npx --no-install playwright test e2e/social-share.spec.ts --reporter=list,json --output=$H/t7/test-results "$@"
