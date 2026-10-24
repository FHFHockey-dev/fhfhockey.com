#!/bin/sh
set -eu
repo=/Users/tim/Code/fhfhockey.com
out="$repo/tasks/artifacts/luna-r1-independent-review-2026-10-22"
scratch=$(cat "$out/scratch-path.txt")
cd "$scratch/web"
export PATH=/usr/local/bin:/usr/bin:/bin
[ "$(node --version)" = v22.11.0 ]
guard="$repo/tasks/artifacts/luna-ifttt-readiness-2026-10-22/network-guard.cjs"
inert_npm="$repo/tasks/artifacts/luna-ifttt-readiness-2026-10-22/empty-global.npmrc"
offline() {
 env -i PATH="$PATH" TMPDIR=/tmp NODE_OPTIONS="--require=$guard" npm_config_update_notifier=false npm_config_audit=false npm_config_fund=false npm_config_userconfig=/dev/null npm_config_globalconfig="$inert_npm" npm_config_cache=/tmp/fhfh-luna-independent-npm "$@"
}
case "$1" in
 all) offline npx --no-install vitest run --config review.vitest.config.mjs lib/sources/playerIdentitySnapshotEvidence.test.ts lib/sources/tweetIdentityReplacementReview.test.ts lib/sources/review-contracts.test.ts --reporter=verbose --reporter=json --outputFile="$out/tests.json" > "$out/tests.log" 2>&1 ;;
 adversarial) offline npx --no-install vitest run --config review.vitest.config.mjs lib/sources/review-contracts.test.ts --reporter=verbose --reporter=json --outputFile="$out/adversarial-tests.json" > "$out/adversarial-tests.log" 2>&1 ;;
 tsc) offline npx --no-install tsc --noEmit -p review.tsconfig.json > "$out/tsc.log" 2>&1 ;;
 lint) offline npx --no-install eslint lib/sources/tweetIdentityReplacementReview.ts lib/sources/tweetIdentityReplacementReview.test.ts > "$out/lint.log" 2>&1 ;;
 *) exit 2 ;;
esac
