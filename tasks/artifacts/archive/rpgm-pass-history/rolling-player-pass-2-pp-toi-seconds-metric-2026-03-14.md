# `pp_toi_seconds` optional metric implementation

## Scope

- Added additive rolling families for `pp_toi_seconds`.
- Kept the source contract aligned with the existing PP-share semantics:
  - builder `powerPlayCombinations.PPTOI` is authoritative
  - `wgo_skater_stats.pp_toi` is fallback-only
  - metric is defined only for `all` and `pp`

## Storage

- Added migration: `migrations/20260314_add_optional_rolling_player_pp_toi_seconds_metrics.sql`
- Added persisted fields:
  - `pp_toi_seconds_total_all`
  - `pp_toi_seconds_avg_all`
  - `pp_toi_seconds_total_last3`
  - `pp_toi_seconds_avg_last3`
  - `pp_toi_seconds_total_last5`
  - `pp_toi_seconds_avg_last5`
  - `pp_toi_seconds_total_last10`
  - `pp_toi_seconds_avg_last10`
  - `pp_toi_seconds_total_last20`
  - `pp_toi_seconds_avg_last20`
  - `pp_toi_seconds_avg_season`
  - `pp_toi_seconds_avg_3ya`
  - `pp_toi_seconds_avg_career`

## Writer / contract changes

- Added `resolvePlayerPpToiSeconds(...)` to `rollingPlayerPpShareContract.ts` so direct PP deployment and PP-share reconstruction use the same builder-first / WGO-fallback authority.
- Added `pp_toi_seconds` to the rolling writer metric map as `additive_performance`.
- Added `pp_toi_seconds` to the canonical rolling-window family map.

## Validation-console changes

- Added formula metadata: `sum(player_pp_toi_seconds)`
- Classified `pp_toi_seconds*` fields under `pp_usage` in:
  - `rollingPlayerValidationPayload.ts`
  - `trendsDebug.tsx`
- This lets the existing PP validation panels and family filters surface the direct PP deployment metric without adding a second PP-specific UI path.

## Verification

- `npm test -- --run lib/supabase/Upserts/rollingPlayerPpShareContract.test.ts lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts lib/supabase/Upserts/rollingWindowContract.test.ts lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/trendsDebug.test.tsx`
- `npx tsc --noEmit --pretty false`
