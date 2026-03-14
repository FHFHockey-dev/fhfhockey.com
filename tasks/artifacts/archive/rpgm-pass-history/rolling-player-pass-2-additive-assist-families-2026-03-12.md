# Rolling Player Pass 2 Additive Assist Families

## Sub-task

- `5.1`

## Decision

Implemented additive rolling families for:

- `primary_assists`
- `secondary_assists`

The persisted rolling contract uses the public metric names above while sourcing values from upstream raw columns:

- `first_assists`
- `second_assists`

## Storage

Added a new migration:

- `migrations/20260312_add_optional_rolling_player_additive_assist_metrics.sql`

The migration adds the same additive rolling surface used by other count metrics:

- `*_total_all`
- `*_total_last3`
- `*_total_last5`
- `*_total_last10`
- `*_total_last20`
- `*_avg_all`
- `*_avg_last3`
- `*_avg_last5`
- `*_avg_last10`
- `*_avg_last20`
- `*_avg_season`
- `*_avg_3ya`
- `*_avg_career`

Local generated types were updated in `web/lib/supabase/database-generated.types.ts` to match the new columns.

## Writer contract

`fetchRollingPlayerAverages.ts` now:

- derives additive `primary_assists` from NST `first_assists`
- derives additive `secondary_assists` from NST `second_assists`
- falls back to WGO `total_primary_assists` and `total_secondary_assists` only for all-strength rows when NST counts are missing
- tracks primary / secondary assist WGO fallback usage in source-tracking summaries

## Validation-console contract

The validation and debug surfaces now:

- classify `primary_assists*` and `secondary_assists*` as `surface_counts`
- expose exact formulas:
  - `sum(first_assists)`
  - `sum(second_assists)`
- treat both metrics as additive rolling-window metrics under the canonical additive window contract

## Regression coverage

Added or updated tests for:

- source selection and WGO fallback behavior
- additive writer outputs
- rolling window family classification
- validation-payload formula metadata
- `trendsDebug.tsx` compatibility through the shared metric-base-key fix

## Additional fix discovered during implementation

While adding the new additive families, legacy metric base-key parsing was corrected in:

- `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts`
- `web/pages/trendsDebug.tsx`

The previous order of suffix stripping could mis-parse legacy fields like `*_avg_last5` into `*_avg` instead of the true base key.

## Verification

- `npm test -- --run lib/supabase/Upserts/rollingPlayerSourceSelection.test.ts lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts lib/supabase/Upserts/rollingWindowContract.test.ts lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/trendsDebug.test.tsx`
- `npx tsc --noEmit --pretty false`
