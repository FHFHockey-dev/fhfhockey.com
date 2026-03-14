# Weighted-Rate Support Path Decision - 2026-03-12

## Decision

Use the payload-level reconstruction path for all-scope and `lastN` weighted-rate support visibility.

Do not add new persisted support columns to `rolling_player_game_metrics`.

## Why

- Historical weighted-rate scopes already have dedicated persisted support columns from [20260311_add_optional_rolling_player_weighted_rate_metrics.sql](/Users/tim/Code/fhfhockey.com/migrations/20260311_add_optional_rolling_player_weighted_rate_metrics.sql).
- `all` and `lastN` scopes can be reconstructed from the current stored surface without schema growth:
  - additive companions such as `goals_total_last5`, `shots_total_last5`, `ixg_total_last5`, `assists_total_last5`, `hits_total_last5`, `blocks_total_last5`
  - TOI companions such as `toi_seconds_total_last5`
- `primary_assists_per_60` and `secondary_assists_per_60` remain the only special cases because they lack additive rolling companions; those numerators are now synthesized in the validation payload from `rate * toi_seconds / 3600`.

## Implemented Path

- Added normalized weighted-rate support aliases in [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts) for:
  - `sog_per_60`
  - `ixg_per_60`
  - `goals_per_60`
  - `assists_per_60`
  - `primary_assists_per_60`
  - `secondary_assists_per_60`
  - `hits_per_60`
  - `blocks_per_60`
- Historical scopes continue to resolve to persisted fields such as:
  - `goals_per_60_goals_season`
  - `goals_per_60_toi_seconds_season`
- `all` and `lastN` scopes now resolve to payload-level support aliases such as:
  - `goals_per_60_goals_total_last5`
  - `goals_per_60_toi_seconds_total_last5`
- When the alias is not physically stored, the payload resolves it from the row’s existing companions instead of adding new schema.
- Comparison-matrix generation now excludes virtual support aliases unless they actually exist as row columns, while the Numerator / Denominator panel still receives them through `supportComparisons`.

## Result

- `trendsDebug.tsx` can now inspect weighted-rate numerators and denominators consistently across historical and rolling scopes.
- No migration was required.
- The pass-2 backlog item for weighted-rate support visibility is now complete.

## Verification

- `npm test -- --run lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/trendsDebug.test.tsx`
- `npx tsc --noEmit --pretty false`
