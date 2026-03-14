# Projection Reader Policy Alignment - 2026-03-12

## Scope

Sub-task `4.3`

This change aligns the projection query layer and the current projection readers with the pass-2 authoritative-field policy.

## Updated Surfaces

### [skater-queries.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/queries/skater-queries.ts)

- `ROLLING_ROW_SELECT_CLAUSE` is now built with helper-driven field order for weighted-rate families.
- The clause remains intentionally legacy-shaped for:
  - `toi_seconds_avg_last5`
  - `toi_seconds_avg_all`
  - additive totals such as `goals_total_last5`

### [run-forge-projections.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/run-forge-projections.ts)

- weighted-rate reads now use `resolveNullableCompatibilityValue("weighted_rate", ...)`
- this replaces implicit canonical-first behavior with explicit family-policy resolution
- additive totals and TOI average reads remain unchanged because they are still authoritative on their legacy surfaces

### [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts)

- weighted-rate query selection now uses helper-driven canonical-first ordering
- weighted-rate value reads now use `resolveFiniteCompatibilityValue("weighted_rate", ...)`
- TOI average fallback now uses `resolveNullableCompatibilityValue("toi_average", ...)`, which keeps TOI on its intended legacy-first semantics
- additive average reads remain legacy-shaped

## Resulting Policy

### Canonical-first now

- weighted-rate fields in projection readers and query clauses:
  - `sog_per_60_*`
  - `hits_per_60_*`
  - `blocks_per_60_*`

### Still legacy-first by design

- additive totals:
  - `goals_total_*`
  - `shots_total_*`
  - `assists_total_*`
- additive averages in start-chart:
  - `goals_avg_*`
  - `assists_avg_*`
  - `points_avg_*`
- TOI averages:
  - `toi_seconds_avg_*`

## Verification

- `npm test -- --run lib/projections/queries/skater-queries.test.ts pages/api/v1/db/update-start-chart-projections.test.ts lib/rollingPlayerMetricCompatibility.test.ts`
- `npx tsc --noEmit --pretty false`
