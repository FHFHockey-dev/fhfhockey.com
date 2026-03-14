# Rolling Player Pass-2 Readiness State UI

Date: 2026-03-12
Sub-task: `2.6`

## Scope

Refine [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) so validation readiness is rendered as three explicit operator-facing states:

- `READY`
- `READY WITH CAUTIONS`
- `BLOCKED`

## Implementation

- Added a dedicated readiness display mapper in [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) that converts payload readiness status into:
  - label text
  - summary copy
  - status-pill style
- Updated the player snapshot banner and freshness banner to render the mapped readiness pill instead of flat status text.
- Added a summary line and stat-card coverage so the selected payload advertises:
  - signoff-ready state
  - caution-state review requirement
  - blocker-state refresh / investigation requirement
- Added dedicated readiness pill styles in [trendsDebug.module.scss](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.module.scss):
  - `.pillReady`
  - `.pillCaution`
  - `.pillBlocked`

## Validation Behavior

- `READY`
  - shown when the payload has no blockers and no cautions
  - summary copy indicates the validation slice is inspection-ready
- `READY WITH CAUTIONS`
  - shown when the payload has cautions but no blockers
  - summary copy explicitly warns that the row is not signoff-ready until cautions are reviewed
- `BLOCKED`
  - shown when blocker reasons are present
  - summary copy reports blocker count and keeps the refresh/investigation requirement visible

## Verification

- `npx tsc --noEmit --pretty false`
- `npm test -- --run pages/trendsDebug.test.tsx pages/api/v1/debug/rolling-player-metrics.test.ts lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts`

## Notes

- The readiness summary text now appears in more than one UI location by design, so page tests were updated to assert repeated visibility rather than uniqueness.
