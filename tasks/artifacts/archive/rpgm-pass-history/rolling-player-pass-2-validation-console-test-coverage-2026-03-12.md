# Rolling Player Pass-2 Validation Console Test Coverage

Date: 2026-03-12
Sub-task: `2.7`

## Scope

Extend the route and page tests so the richer validation payload contract is exercised end to end for:

- mismatch summaries
- TOI trust panel data
- mixed-source PP-share windows
- readiness states

## Route Coverage

Updated [rolling-player-metrics.test.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.test.ts) to verify that the debug route returns the richer payload sections needed by the validation console, including:

- readiness with caution-state output
- selected-metric formula metadata
- helper-contract metadata
- rolling-window membership
- family-wide mismatch summary output
- TOI trace rows
- PP-share window provenance

## Page Coverage

Updated [trendsDebug.test.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.test.tsx) to verify that the page renders operator-visible signals from the richer payload, including:

- `BLOCKED` readiness with blocker summaries
- `READY WITH CAUTIONS` readiness with caution summaries
- family mismatch counts
- TOI trust panel content
- mixed-source PP window visibility
- chosen PP-share source visibility
- mismatch cause visibility
- diff-panel code-block content for:
  - `comparisonMatrix`
  - `canonicalVsLegacy`
  - `supportComparisons`

## Verification

- `npm test -- --run pages/trendsDebug.test.tsx pages/api/v1/debug/rolling-player-metrics.test.ts lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts`

## Notes

- Some new assertions intentionally use repeated-text checks because the validation console now surfaces the same readiness or comparison content in both summary rows and diagnostic code blocks.
