#!/bin/sh
set -eu
ROOT=/Users/tim/Code/fhfhockey.com
EVIDENCE="$ROOT/tasks/artifacts/forge-task1-scoreboard-2026-10-22"
CHECK=/tmp/fhfh-task1-scoreboard
[ "$(node --version)" = v22.11.0 ]
[ "$(npm --version)" = 10.9.0 ]
mkdir -p "$CHECK"
cp "$EVIDENCE/vitest.config.mts" "$EVIDENCE/tsconfig.json" "$EVIDENCE/network-deny.cjs" "$CHECK/"
[ -e "$CHECK/node_modules" ] || ln -s "$ROOT/web/node_modules" "$CHECK/node_modules"
cd "$ROOT/web"
case "${1:-}" in
  tests) set -- npm test -- --run --config "$CHECK/vitest.config.mts" lib/player-forecasts/servedForecastLedger.test.ts tests/api/forge-scoreboard.test.ts __tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts __tests__/pages/api/v1/db/forge-served-forecast-settle.test.ts ;;
  types)
    mkdir /private/tmp/fhfh-heavy.lock || exit 75
    trap 'rmdir /private/tmp/fhfh-heavy.lock' EXIT
    set -- npx --no-install tsc --noEmit --incremental false --project "$CHECK/tsconfig.json" ;;
  lint) set -- npx --no-install eslint lib/player-forecasts/servedForecastLedger.ts lib/player-forecasts/servedForecastLedger.test.ts pages/api/v1/forge/scoreboard.ts tests/api/forge-scoreboard.test.ts ;;
  *) echo 'Usage: sh verify-local.sh tests|types|lint' >&2; exit 2 ;;
esac
env -i PATH=/usr/local/bin:/usr/bin:/bin npm_config_cache="$CHECK/npm-cache" \
  NODE_OPTIONS="--require $CHECK/network-deny.cjs --max-old-space-size=8192" \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key "$@"
