# Rolling Player Pass 2 Penalties Drawn Metrics

## Sub-task

- `5.2`

## Decision

Implemented both approved penalties-drawn enhancements:

- `penalties_drawn`
- `penalties_drawn_per_60`

## Source contract

- additive source: NST `penalties_drawn`
- weighted-rate source: `sum(penalties_drawn) / sum(toi_seconds) * 3600`
- fallback policy: no WGO fallback was added

This keeps the contract narrow and source-authoritative. If NST counts are missing, the rolling penalties-drawn metrics remain null rather than mixing in a separate WGO discipline surface.

## Storage

Added:

- `migrations/20260314_add_optional_rolling_player_penalties_drawn_metrics.sql`

The migration adds:

- additive rolling `penalties_drawn_*` avg/total fields
- weighted-rate legacy `penalties_drawn_per_60_*` avg/total fields
- canonical weighted-rate aliases:
  - `penalties_drawn_per_60_all`
  - `penalties_drawn_per_60_last3`
  - `penalties_drawn_per_60_last5`
  - `penalties_drawn_per_60_last10`
  - `penalties_drawn_per_60_last20`
  - `penalties_drawn_per_60_season`
  - `penalties_drawn_per_60_3ya`
  - `penalties_drawn_per_60_career`
- historical support fields for numerator and TOI:
  - `penalties_drawn_per_60_penalties_drawn_*`
  - `penalties_drawn_per_60_toi_seconds_*`

Local generated types were updated in `web/lib/supabase/database-generated.types.ts` to match the new fields.

## Writer and contract updates

`fetchRollingPlayerAverages.ts` now:

- treats `penalties_drawn` as a simple additive metric
- treats `penalties_drawn_per_60` as a weighted-rate metric using the existing TOI contract
- emits historical support fields for `penalties_drawn_per_60`

`rollingWindowContract.ts` now classifies:

- `penalties_drawn` as `additive_performance`
- `penalties_drawn_per_60` as `weighted_rate_performance`

## Validation-console updates

`rollingPlayerValidationPayload.ts` and `trendsDebug.tsx` now:

- classify `penalties_drawn*` correctly
- expose formulas for both metrics
- expose weighted-rate support-field reconstruction for `penalties_drawn_per_60`

## Regression coverage

Added or updated tests for:

- counts-only source selection
- additive and weighted-rate writer outputs
- rolling-window family classification
- validation-payload formula metadata
- `trendsDebug.tsx` compatibility through the shared metric-family/formula surfaces

## Verification

- `npm test -- --run lib/supabase/Upserts/rollingPlayerSourceSelection.test.ts lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts lib/supabase/Upserts/rollingWindowContract.test.ts lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/trendsDebug.test.tsx`
- `npx tsc --noEmit --pretty false`
