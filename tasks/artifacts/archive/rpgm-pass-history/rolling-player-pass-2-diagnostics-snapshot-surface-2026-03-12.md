# Rolling Player Pass-2 Diagnostics Snapshot Surface

Date: 2026-03-12
Sub-task: `3.1`

## Scope

Promote diagnostics from ad hoc helper output into a reusable validation payload surface that can be consumed consistently by:

- `trendsDebug.tsx`
- test fixtures
- future CLI or route consumers

## Implementation

- Added a normalized `diagnostics.snapshot` section to [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts).
- The snapshot is built server-side from the existing diagnostics helpers:
  - coverage summary
  - source-tail freshness summary
  - derived-window completeness summary
  - suspicious-output summary
  - target freshness summary
- The snapshot now exposes:
  - `overallStatus`
  - `blockerCount`
  - `cautionCount`
  - top-level `highlights`
  - category-level status, issue counts, and highlights for:
    - coverage
    - freshness
    - completeness
    - suspicious outputs
    - target freshness

## UI Changes

- Updated [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) so the diagnostics panel renders snapshot-first status rows instead of relying only on raw warning arrays.
- The diagnostics panel now exposes explicit operator-facing statuses for:
  - diagnostics overall
  - coverage
  - freshness
  - completeness
- The panel also surfaces snapshot highlights before the raw diagnostic JSON block.

## Test Coverage

- Added unit coverage for `buildDiagnosticsSnapshot(...)` in [rollingPlayerValidationPayload.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts).
- Updated [trendsDebug.test.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.test.tsx) so the blocked validation case asserts the new diagnostics snapshot output and panel rendering.

## Verification

- `npx tsc --noEmit --pretty false`
- `npm test -- --run lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/trendsDebug.test.tsx`

## Notes

- This task does not yet add PP-specific “window fully covered” cautions or ratio-support completeness badges. Those remain follow-up work in `3.2` and `3.3`, but both now have a stable snapshot surface to extend instead of adding a second diagnostics model.
