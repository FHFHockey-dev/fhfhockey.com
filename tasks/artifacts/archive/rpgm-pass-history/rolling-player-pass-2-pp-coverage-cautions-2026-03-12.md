# Rolling Player Pass-2 PP Coverage Cautions

Date: 2026-03-12
Sub-task: `3.2`

## Scope

Add explicit PP coverage caution reporting that distinguishes:

- latest PP game covered
- latest PP share game covered
- full selected-window PP builder coverage
- full selected-window PP share coverage

## Implementation

- Extended [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts) so `summarizeCoverage(...)` now returns dedicated `ppCoverage` details:
  - `expectedGameIds`
  - `missingPpGameIds`
  - `missingPpShareGameIds`
  - `latestExpectedPpGameId`
  - `latestBuilderGameCovered`
  - `latestShareGameCovered`
  - `windowBuilderCoverageComplete`
  - `windowShareCoverageComplete`
- Updated [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts) so:
  - readiness stays `READY_WITH_CAUTIONS` when `ppTailLag = 0` but the selected PP window still has missing builder or share coverage
  - `nextRecommendedAction` points to PP coverage inspection instead of a stale-tail refresh when the latest game is already present
  - `diagnostics.snapshot.categories.coverage` carries the PP coverage state forward for UI consumption
- Updated [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) so the diagnostics panel now exposes:
  - latest PP game covered
  - PP window fully covered
  - latest PP share covered
  - PP share window fully covered
  - missing PP builder game IDs
  - missing PP share game IDs

## Test Coverage

- Added diagnostics-helper coverage in [rollingPlayerPipelineDiagnostics.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts) for the new `ppCoverage` output.
- Added payload coverage in [rollingPlayerValidationPayload.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts) for the explicit `READY_WITH_CAUTIONS` PP-coverage case where the latest game is covered but the window is still incomplete.
- Updated [trendsDebug.test.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.test.tsx) so the caution-state UI asserts the new PP coverage status rows and missing-game visibility.

## Verification

- `npx tsc --noEmit --pretty false`
- `npm test -- --run lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/trendsDebug.test.tsx`

## Notes

- This task does not yet add per-window PP completeness badges outside the diagnostics panel. It establishes the authoritative PP coverage contract that later PP and ratio-support tasks can reuse.
