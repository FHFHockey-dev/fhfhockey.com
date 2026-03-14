# Rolling Player Pass-2 TOI Source Trace Payload

## Completed in task `2.2`

This step added explicit per-row TOI trace output to the validation payload so the debug console can inspect TOI resolution without reconstructing it in the browser.

## Implemented payload output

Added `sourceRows.selectedStrength.toiTraceRows` in [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts).

Each trace row includes:

- `rowKey`
- `gameId`
- `gameDate`
- `strength`
- `rawCandidates`
  - `countsToi`
  - `countsOiToi`
  - `ratesToiPerGp`
  - `wgoToiPerGame`
- `fallbackSeed`
  - `seconds`
  - `source`
  - `rejectedCandidates`
  - `wgoNormalization`
- `resolved`
  - `seconds`
  - `source`
  - `trustTier`
  - `rejectedCandidates`
  - `wgoNormalization`
- `suspiciousNotes`

## Source of truth

The trace is derived server-side from the existing TOI contract in [rollingPlayerToiContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.ts), using:

- `resolveFallbackToiSeed(...)`
- `resolveRollingPlayerToiContext(...)`
- `normalizeWgoToiPerGame(...)`

This keeps the validation payload aligned with the actual writer logic instead of duplicating TOI inference in `trendsDebug.tsx`.

## Behavior notes

- The fallback-seed trace shows the candidate chain used to derive fallback TOI before final resolution.
- The resolved trace shows the final chosen source and trust tier.
- Rejected candidates are preserved separately for both fallback-seed selection and final TOI resolution.
- `suspiciousNotes` flatten those rejection reasons into page-friendly strings for the TOI trust panel.

## Test coverage

- Added a pure-unit test in [rollingPlayerValidationPayload.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts) covering:
  - invalid counts TOI
  - authoritative `counts_oi` fallback selection
  - preserved rejection reasons
  - rendered suspicious notes
- Updated [trendsDebug.test.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.test.tsx) fixture payloads so the page remains compatible with the richer validation payload shape.

## Verification

- `npx tsc --noEmit --pretty false`
- `npm test -- --run lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/api/v1/debug/rolling-player-metrics.test.ts pages/trendsDebug.test.tsx`
