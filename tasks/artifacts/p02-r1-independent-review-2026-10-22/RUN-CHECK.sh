#!/bin/sh
set -eu
repo=/Users/tim/Code/fhfhockey.com
out="$repo/tasks/artifacts/p02-r1-independent-review-2026-10-22"
web=$(cat "$out/scratch-path.txt")
cd "$web"
export PATH=/usr/local/bin:/usr/bin:/bin
[ "$(node --version)" = v22.11.0 ]
offline() {
 env -i PATH="$PATH" TMPDIR=/tmp \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
  NODE_OPTIONS="--require=$web/audit-network-deny.cjs" \
  npm_config_update_notifier=false npm_config_audit=false npm_config_fund=false \
  npm_config_userconfig=/dev/null \
  npm_config_globalconfig="$repo/tasks/artifacts/luna-ifttt-readiness-2026-10-22/empty-global.npmrc" \
  npm_config_cache=/tmp/fhfh-p02-independent-npm "$@"
}
case "$1" in
 owner) offline npx --no-install vitest run --config audit.vitest.config.mts \
  components/PlayerStats/playerStatsContract.test.ts components/PlayerStats/PlayerContextualStats.test.tsx \
  lib/NHL/statsPageFetch.test.ts components/StatsPage/LeaderboardCategoryGoalie.test.tsx \
  components/StatsPage/MobileTabInterface.test.tsx __tests__/pages/stats/index.test.tsx \
  --reporter=default --reporter=json --outputFile="$out/owner-tests.json" > "$out/owner-tests.log" 2>&1 ;;
 focused) offline npx --no-install vitest run --config audit.vitest.config.mts \
  components/PlayerStats/p02-independent.test.tsx components/PlayerStats/PlayerGoalieSummaries.test.tsx \
  --reporter=verbose --reporter=json --outputFile="$out/focused-tests.json" > "$out/focused-tests.log" 2>&1 ;;
 tsc) offline npx --no-install tsc --noEmit -p tsconfig.p02.json > "$out/tsc.log" 2>&1 ;;
 lint) offline npx --no-install eslint components/PlayerStats/PlayerSummaryStrip.tsx components/PlayerStats/PlayerStatsSummary.tsx components/PlayerStats/PlayerGoalieSummaries.test.tsx > "$out/lint.log" 2>&1 ;;
 *) exit 2 ;;
esac
