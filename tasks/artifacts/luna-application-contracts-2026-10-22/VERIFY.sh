#!/bin/sh
set -eu
repo=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
cd "$repo/web"
out="$repo/tasks/artifacts/luna-application-contracts-2026-10-22"
guard="$repo/tasks/artifacts/luna-ifttt-readiness-2026-10-22/network-guard.cjs"
inert_npm="$repo/tasks/artifacts/luna-ifttt-readiness-2026-10-22/empty-global.npmrc"
offline() {
  env -i PATH="$PATH" TMPDIR=/tmp NODE_OPTIONS="--require=$guard" \
    npm_config_update_notifier=false npm_config_audit=false npm_config_fund=false \
    npm_config_userconfig=/dev/null npm_config_globalconfig="$inert_npm" \
    npm_config_cache=/tmp/fhfh-luna-readiness-npm "$@"
}
offline npx --no-install vitest run \
  --config ../tasks/artifacts/luna-ifttt-readiness-2026-10-22/vitest.config.mjs \
  lib/sources/playerIdentitySnapshotEvidence.test.ts lib/sources/tweetIdentityReplacementReview.test.ts \
  --reporter=default --reporter=json --outputFile="$out/test-results.json" > "$out/tests.log" 2>&1
offline npx --no-install tsc --noEmit -p "$out/tsconfig.json" > "$out/tsc.log" 2>&1
offline npx --no-install eslint lib/sources/playerIdentitySnapshotEvidence.ts \
  lib/sources/playerIdentitySnapshotEvidence.test.ts lib/sources/tweetIdentityReplacementReview.ts \
  lib/sources/tweetIdentityReplacementReview.test.ts > "$out/lint.log" 2>&1
if rg -n 'Network forbidden|Offline network guard rejected' "$out/tests.log" "$out/tsc.log" "$out/lint.log"; then
  exit 1
fi
