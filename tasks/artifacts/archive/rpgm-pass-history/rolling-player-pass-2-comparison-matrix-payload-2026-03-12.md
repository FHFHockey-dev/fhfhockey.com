# Rolling Player Pass-2 Comparison Matrix Payload

## Completed in task `2.4`

This step expanded the validation payload comparison surface beyond a single selected-metric diff.

The payload now includes:

- a family-wide mismatch summary for the selected scope
- a focused-row comparison matrix
- explicit canonical-versus-legacy comparison entries
- explicit support-field comparison entries

## Implemented payload changes

Updated [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts) so `comparisons` now returns:

- `familySummary`
  - `selectedMetricFamily`
  - `rowCountCompared`
  - `fieldCountCompared`
  - `mismatchFieldCount`
  - `mismatchRowCount`
  - `metrics[]`
- `focusedRow`
  - `storedRowKey`
  - `recomputedRowKey`
  - `selectedMetric`
  - `comparisonMatrix[]`
  - `canonicalVsLegacy[]`
  - `supportComparisons[]`

## Selected metric output

The focused selected-metric object now includes:

- `field`
- `storedValue`
- `recomputedValue`
- `diff`
- `absoluteDiff`
- `signedDiff`
- `percentDiff`
- `valuesMatch`
- `mismatchCauseBucket`

`diff` is currently preserved as a compatibility alias for the existing page until the UI is fully migrated in later phase-2 steps.

## Family summary behavior

The summary is built across the selected stored/recomputed row history and filtered to the selected metric family when one is active.

Each family metric summary entry includes:

- field name
- inferred metric family
- compared row count
- mismatched row count
- latest stored value
- latest recomputed value
- latest diff
- latest match state

This provides the server-side mismatch inventory needed for mismatch-only review before drilling into one metric.

## Focused-row matrix behavior

The focused-row matrix compares the stored and recomputed values for all fields present on the focused row pair, then annotates each field with:

- family
- stored value
- recomputed value
- signed diff
- absolute diff
- percent diff
- values-match boolean
- field role:
  - `canonical`
  - `legacy`
  - `support`
  - `other`

The payload also breaks out:

- canonical-vs-legacy drift for the selected metric
- support-field stored-vs-recomputed comparisons for the selected metric

## Mismatch-cause behavior

The selected-metric comparison now classifies mismatch cause at a coarse level using current payload context:

- `stale source`
- `stale target`
- `logic defect`
- `unresolved verification blocker`

This is intentionally heuristic and meant to improve immediate triage in the console without replacing the full audit artifact.

## Test coverage

- Added pure-unit coverage in [rollingPlayerValidationPayload.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts) for:
  - focused-row comparison matrix generation
  - support-field comparison output
  - family-summary counts
  - selected-metric mismatch metadata
- Updated [rolling-player-metrics.test.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.test.ts) fixture payload shape
- Updated [trendsDebug.test.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.test.tsx) fixture payload shape

## Verification

- `npx tsc --noEmit --pretty false`
- `npm test -- --run lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/api/v1/debug/rolling-player-metrics.test.ts pages/trendsDebug.test.tsx`
