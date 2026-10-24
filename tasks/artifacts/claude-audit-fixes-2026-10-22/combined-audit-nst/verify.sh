#!/bin/sh
# Run from extracted web/ after verifying archive and file hashes. No installation.
set -eu
[ "$(node --version)" = "v22.11.0" ]
[ "$(npm --version)" = "10.9.0" ]
[ -f audit-network-deny.cjs ]
[ -f audit.vitest.config.mts ]
[ -d node_modules ]
mkdir -p .audit-home .audit-tmp
case "${1:-}" in
  affected) set -- npm test -- --run --config audit.vitest.config.mts lib/projections/queries/skater-queries.test.ts lib/projections/runProjectionV2.test.ts scripts/forge-reconstruction-backtest.test.ts lib/rosterScheduleData/forgeDailyBridge.test.ts lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts lib/player-forecasts/servedForecastLedger.test.ts __tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts __tests__/pages/api/v1/db/forge-served-forecast-settle.test.ts tests/api/forge-scoreboard.test.ts __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts __tests__/pages/api/v1/db/update-nst-gamelog.test.ts lib/projections/projectionPipelineState.test.ts lib/integrations/yahoo/rosterPlanning.test.ts lib/integrations/providerSyncAccess.test.ts lib/integrations/providerSyncPaywall.test.ts lib/stats/percentUnits.test.ts lib/stats/teamCountConsumers.test.tsx components/TeamDashboard/AdvancedL10Metrics.test.tsx components/GameStateAnalysis/GameStateAnalysis.test.tsx components/TeamDashboard/TeamDashboard.test.tsx components/GoalieShareChart/GoalieShareChart.test.ts components/GoalieShareChart/GoalieShareChart.pagination.test.tsx hooks/useShotData.test.tsx __tests__/pages/stats/team/teamAbbreviation.test.tsx ;;
  reproductions) set -- npm test -- --run --config audit.vitest.config.mts lib/auditTemporalCutoff.test.ts lib/auditEdgecases.test.ts lib/auditStatsAsync.test.tsx __tests__/pages/api/v1/db/auditNstIndependent.test.ts __tests__/pages/api/v1/db/auditNstR1Additional.test.ts lib/reviewConsumerExposure.test.tsx lib/reviewNegativeExposure.test.tsx ;;
  all-file-types) set -- npx --no-install tsc --noEmit --incremental false ;;
  application-types) set -- npx --no-install tsc --noEmit --incremental false --project audit.application-tsconfig.json ;;
  lint) set -- npx --no-install eslint lib/projections/queries/skater-queries.ts lib/projections/queries/skater-queries.test.ts lib/rosterScheduleData/forgeDailyBridge.ts lib/rosterScheduleData/forgeDailyBridge.test.ts lib/player-forecasts/servedForecastLedger.ts lib/player-forecasts/servedForecastLedger.test.ts pages/api/v1/db/forge-served-forecast-settle.ts pages/api/v1/db/forge-served-forecast-snapshot.ts pages/api/v1/forge/scoreboard.ts __tests__/pages/api/v1/db/forge-served-forecast-settle.test.ts tests/api/forge-scoreboard.test.ts lib/rollingForgePipelineRunState.ts pages/api/v1/db/run-rolling-forge-pipeline.ts __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts lib/integrations/yahoo/rosterPlanning.ts lib/integrations/yahoo/rosterPlanning.test.ts lib/stats/percentUnits.ts lib/stats/percentUnits.test.ts components/GoalieShareChart/index.tsx components/GoalieShareChart/GoalieShareChart.pagination.test.tsx hooks/useShotData.ts hooks/useShotData.test.tsx components/GameStateAnalysis/GameStateAnalysis.tsx components/GameStateAnalysis/GameStateAnalysis.test.tsx components/TeamDashboard/AdvancedL10Metrics.tsx components/TeamDashboard/AdvancedL10Metrics.test.tsx components/TeamDashboard/TeamDashboard.tsx components/TeamDashboard/TeamDashboard.test.tsx lib/stats/teamCountConsumers.test.tsx lib/projections/projectionPipelineState.ts lib/projections/projectionPipelineState.test.ts ;;
  *) echo "Usage: verify.sh affected|reproductions|all-file-types|application-types|lint" >&2; exit 2 ;;
esac
exec env -i PATH=/usr/local/bin:/usr/bin:/bin \
  HOME="$PWD/.audit-home" TMPDIR="$PWD/.audit-tmp" \
  NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
  SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
  NODE_OPTIONS="--require $PWD/audit-network-deny.cjs --max-old-space-size=8192" \
  "$@"
