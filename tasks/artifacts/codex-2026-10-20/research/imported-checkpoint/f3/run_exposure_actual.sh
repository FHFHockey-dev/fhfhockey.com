#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-/workspace/shared/fhfhockey.com}"
env -i PATH=/usr/bin:/bin NODE_PATH="$REPO/web" TS_NODE_SKIP_PROJECT=true \
  TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"Node","target":"ES2022","esModuleInterop":true}' \
  /workspace/shared/fhfh-audit-runtime/node-v22.11.0-linux-x64/bin/node \
  --require "$HERE/exposure_offline_guard.cjs" \
  --require "$REPO/web/node_modules/ts-node/register/transpile-only.js" \
  "$HERE/exposure_actual_harness.cjs" "$REPO"
