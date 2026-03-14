# Compatibility Test Coverage - 2026-03-12

## Scope

Sub-task `4.4`

This closeout extends compatibility-focused regression coverage across the helper policy surface and the currently migrated downstream readers.

## Coverage Added

### Compatibility helper policy

Added explicit tests in [rollingPlayerMetricCompatibility.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerMetricCompatibility.test.ts) for:

- canonical-first family resolution:
  - `ratio`
  - `weighted_rate`
  - `availability`
- legacy-first family resolution:
  - `additive_average`
  - `additive_total`
  - `toi_average`
  - `toi_total`
- compatibility field ordering via `getCompatibilityFieldOrder(...)`
- `gp_semantic_type` interpretation via `interpretLegacyGpSemanticType(...)`

### Downstream reader coverage

The existing reader tests now protect:

- canonical-first weighted-rate query order in [skater-queries.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/queries/skater-queries.test.ts)
- canonical-first weighted-rate select order in [update-start-chart-projections.test.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.test.ts)
- legacy-shaped additive and TOI selection remaining intact where those fields are still authoritative

## Result

The compatibility surface is now protected at three levels:

- helper policy
- projection query clause construction
- simplified projection endpoint query construction

This gives later alias-freeze work a safer baseline because the intended canonical-first versus legacy-first split is now test-visible.

## Verification

- `npm test -- --run lib/rollingPlayerMetricCompatibility.test.ts lib/projections/queries/skater-queries.test.ts pages/api/v1/db/update-start-chart-projections.test.ts`
- `npx tsc --noEmit --pretty false`
