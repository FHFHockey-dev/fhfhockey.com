# Rolling Player Pass-2 Surface Confirmation

## Purpose

This artifact confirms the working file surface for pass 2 so later subtasks do not miss implementation areas that changed after the first-pass remediation.

It distinguishes between:

- confirmed existing implementation surfaces
- confirmed existing tests
- confirmed migrations that shape the current row contract
- confirmed downstream consumers
- planned-but-not-yet-present surfaces that later implementation tasks may create

## Confirmed Existing Core Rolling Surfaces

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
- `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingWindowContract.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpUnitContract.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricScaleContract.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/database-generated.types.ts`

## Confirmed Existing Debug and Downstream Surfaces

- `/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx`
- `/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.module.scss`
- `/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx`
- `/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerMetricCompatibility.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/projections/queries/skater-queries.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/projections/run-forge-projections.ts`
- `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts`

## Confirmed Existing Upstream Builder Surfaces

- `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts`
- `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts`
- `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts`

## Confirmed Existing Tests

Pipeline and contract tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingWindowContract.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerHelperContracts.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`

Contract-specific tests that should not be missed in pass 2:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpShareContract.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpUnitContract.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerLineContextContract.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts`

Downstream compatibility tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerMetricCompatibility.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/projections/queries/skater-queries.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.test.ts`

## Confirmed Existing Migrations Touching the Current Row Contract

- `/Users/tim/Code/fhfhockey.com/migrations/20260227_add_truncate_rolling_player_game_metrics_rpc.sql`
- `/Users/tim/Code/fhfhockey.com/migrations/20260309_add_explicit_historical_averages_to_rolling_player_game_metrics.sql`
- `/Users/tim/Code/fhfhockey.com/migrations/20260310_remediate_rolling_player_metrics_gp_pct.sql`
- `/Users/tim/Code/fhfhockey.com/migrations/20260311_add_canonical_rolling_player_metric_contract_fields.sql`
- `/Users/tim/Code/fhfhockey.com/migrations/20260311_add_optional_rolling_player_pp_context_fields.sql`
- `/Users/tim/Code/fhfhockey.com/migrations/20260311_add_optional_rolling_player_support_metrics.sql`
- `/Users/tim/Code/fhfhockey.com/migrations/20260311_add_optional_rolling_player_weighted_rate_metrics.sql`

## Planned or Prospective Surfaces Not Yet Present

These were referenced earlier as likely implementation targets, but they do not exist in the repo yet:

- `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.ts`
- `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.test.ts`
- `/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.test.tsx`

Pass-2 consequence:

- later implementation tasks may create these files
- audit scaffolding and task tracking should treat them as future deliverables, not as existing test coverage

## Pass-2 Implications

- `rollingPlayerMetricCompatibility.ts` is a confirmed downstream compatibility surface and must be included in schema / alias impact review
- `rollingMetricScaleContract.ts` is a confirmed diagnostics dependency and must be considered when auditing suspicious-output warnings and scale semantics
- contract-specific tests exist for PP share, PP unit, line context, TOI, source selection, metric math, and scale semantics; later validation work should use them as contract evidence
- the relevant migration surface begins before the March 10 GP migration, because the current table contract also depends on the March 9 historical-average migration and the truncate RPC migration
