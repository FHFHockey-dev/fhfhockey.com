# Diagnostics Regression Coverage - 2026-03-12

## Scope

This closeout adds helper-level regression coverage for the new pass-2 diagnostics and support-surface behavior introduced in tasks `3.1` through `3.5`.

## Added Coverage

### PP caution states

- Added a `summarizeCoverage(...)` regression case proving the helper distinguishes:
  - latest PP game covered
  - latest PP share covered
  - builder window still incomplete
  - share window still incomplete
- This protects the operator-facing `READY WITH CAUTIONS` path from regressing back into a binary tail-lag-only interpretation.

### Ratio completeness states

- Added a `summarizeDerivedWindowDiagnostics(...)` regression case covering:
  - `complete`
  - `partial`
  - `absent`
  - `invalid`
  - `valuePresentWithoutComponents`
- The test spans multiple ratio families and windows so the diagnostics snapshot can continue mapping those helper outputs into UI-visible completeness states without hidden assumptions.

### Weighted-rate support-surface behavior

- Added a historical-scope weighted-rate regression case in [rollingPlayerValidationPayload.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts).
- This complements the `3.5` rolling-scope tests by proving the payload preserves persisted support aliases such as:
  - `goals_per_60_goals_season`
  - `goals_per_60_toi_seconds_season`

## Files Covered

- [rollingPlayerPipelineDiagnostics.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts)
- [rollingPlayerValidationPayload.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts)

## Verification

- `npm test -- --run lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts`
- `npx tsc --noEmit --pretty false`
