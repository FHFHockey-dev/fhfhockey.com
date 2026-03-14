# Focused regression layer for post-audit workflow

## Scope

This pass adds API-boundary regression coverage across the areas most likely to
regress together after the pass-2 implementation work:

- repaired recompute endpoint forwarding
- richer validation payload routing
- canonical-first downstream readers
- optional metric families visible through the validation surface

## Coverage added

### Recompute endpoint

`web/pages/api/v1/db/update-rolling-player-averages.test.ts`

- rejects unsupported methods
- forwards `dryRunUpsert`, `debugUpsertPayload`, and `fastMode` defaults into
  `main(...)`
- preserves failure propagation when the rolling writer throws

### Debug validation route

`web/pages/api/v1/debug/rolling-player-metrics.test.ts`

- continues passing richer payload sections through the API
- now includes an optional-metric regression case for
  `pp_toi_seconds_avg_last5`, including:
  - `pp_usage` family
  - additive window family
  - direct formula metadata
  - focused-row comparison passthrough

### Downstream reader policy

Reused existing query / projection coverage to keep the `6.1` layer focused:

- `web/lib/projections/queries/skater-queries.test.ts`
- `web/pages/api/v1/db/update-start-chart-projections.test.ts`

These continue protecting canonical-first weighted-rate reads while leaving
authoritative additive / TOI legacy semantics intact.

## Verification

- `npm test -- --run pages/api/v1/db/update-rolling-player-averages.test.ts pages/api/v1/debug/rolling-player-metrics.test.ts lib/projections/queries/skater-queries.test.ts pages/api/v1/db/update-start-chart-projections.test.ts`
- `npx tsc --noEmit --pretty false`
