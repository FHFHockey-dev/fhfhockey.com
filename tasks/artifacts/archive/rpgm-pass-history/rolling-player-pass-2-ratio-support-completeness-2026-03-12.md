# Rolling Player Pass-2 Ratio Support Completeness

Date: 2026-03-12
Sub-task: `3.3`

## Scope

Expose explicit ratio-support completeness states for ratio families so validation can distinguish:

- `complete`
- `partial`
- `absent`
- `invalid`
- `valuePresentWithoutComponents`

## Implementation

- Extended [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts) so `diagnostics.snapshot.categories.completeness` now carries:
  - per-ratio-family window completeness maps
  - a selected-metric ratio completeness view keyed to the currently focused metric
  - explicit state labels derived from the raw completeness counters
- The state derivation uses the existing derived-window diagnostics rather than re-implementing ratio support rules in the UI.
- The selected metric completeness family is inferred from the metric base key, with `pp_usage` correctly mapping to `pp_share_pct`.

## UI Changes

- Updated [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) so the Formula Panel now shows:
  - selected support completeness family
  - `last3` / `last5` / `last10` / `last20` support-completeness states for the selected ratio metric
- Updated the Numerator / Denominator Panel to show the underlying completeness counters for each rolling window of the selected ratio metric.

## Test Coverage

- Added payload-unit assertions in [rollingPlayerValidationPayload.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts) for:
  - selected metric ratio completeness mapping
  - `valuePresentWithoutComponents` classification
  - persisted family/window completeness output
- Updated [trendsDebug.test.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.test.tsx) so the validation console asserts the new support-completeness family, state, and count rows.

## Verification

- `npx tsc --noEmit --pretty false`
- `npm test -- --run lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/trendsDebug.test.tsx`

## Notes

- This task does not resolve missing persisted support parity on its own. It makes the current support-trust state explicit so later schema or payload decisions can be evaluated against visible completeness labels instead of inferred from raw diagnostics only.
