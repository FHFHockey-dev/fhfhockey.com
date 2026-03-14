# Rolling Player Pass-2 `on_ice_sv_pct` Support Path

Date: 2026-03-12
Sub-task: `3.4`

## Decision

Chose the payload-only helper path rather than a schema change.

Rationale:

- the row surface already persists enough additive companions to reconstruct `on_ice_sv_pct`
  - `oi_sa_*`
  - `oi_ga_*`
- the missing gap was not arithmetic capability; it was the lack of a first-class validation trace for:
  - shots against
  - goals against
  - derived saves
- adding more persisted columns would duplicate data already available through the additive companion surface

## Implementation

- Extended [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts) so `inferMetricMetadata(...)` now maps `on_ice_sv_pct` to scope-appropriate additive support fields:
  - `oi_sa_total_*` / `oi_ga_total_*` for `all` and `lastN`
  - `oi_sa_avg_*` / `oi_ga_avg_*` for `season`, `3ya`, and `career`
- Added payload-only derived support comparisons for:
  - shots against
  - goals against
  - `on_ice_sv_pct_saves_*` as `oi_sa - oi_ga`
- Updated [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) so the Numerator / Denominator Panel now renders support comparisons when they exist, including payload-derived support traces such as `on_ice_sv_pct_saves_*`.

## Result

`on_ice_sv_pct` validation no longer depends on back-solving the support path mentally from raw additive fields alone. The validation console now surfaces the exact support component bundle needed for manual inspection without adding persisted support columns.

## Test Coverage

- Added payload-unit coverage in [rollingPlayerValidationPayload.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts) for:
  - support-field inference
  - payload-derived `saves` support comparison output
- Added page coverage in [trendsDebug.test.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.test.tsx) to verify that the support panel renders:
  - `oi_sa_*`
  - `oi_ga_*`
  - `on_ice_sv_pct_saves_*`

## Verification

- `npx tsc --noEmit --pretty false`
- `npm test -- --run lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/trendsDebug.test.tsx`

## Notes

- This keeps the schema unchanged and aligns with the audit recommendation to reserve persisted-column additions for narrow support-parity gaps only when payload-level reconstruction is insufficient.
