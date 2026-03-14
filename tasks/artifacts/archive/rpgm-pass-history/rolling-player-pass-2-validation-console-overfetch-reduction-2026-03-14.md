# Validation Console Overfetch Reduction

Date: `2026-03-14`
Task: `6.2`

## Goal

Reduce `trendsDebug.tsx` overfetch so metric pivots stop reloading stable scope-level data like stored row history, recomputed row history, merged source rows, and diagnostics.

## Implementation

- Added `includeComparisons` to the validation payload request contract and debug route.
- Updated `buildRollingPlayerValidationPayload(...)` so it can still fetch internal stored/recomputed/source data when needed for focused-row selection, window membership, or comparison assembly even if those heavy sections are omitted from the returned payload.
- Split `trendsDebug.tsx` loading into two request classes:
  - scope payload:
    - includes stored rows, recomputed rows, source rows, diagnostics
    - excludes formulas, contracts, windows, and comparisons
  - detail payload:
    - includes formulas, contracts, windows, and comparisons
    - excludes stored rows, recomputed rows, source rows, and diagnostics
- Added in-memory request-key caches for both scope and detail payloads so repeated pivots can reuse prior responses within the current page session.
- Merged the two payloads client-side so the rest of the page still reads a single validation object.

## Result

- Scope-level changes such as player, season, strength, team, or date range still reload the heavy payload.
- Metric pivots now request only the detail payload.
- Focused-row and formula/diff panels stay server-authoritative because the detail request still resolves against server-side focused-row logic.

## Verification

- `npm test -- --run pages/trendsDebug.test.tsx pages/api/v1/debug/rolling-player-metrics.test.ts lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts`
- `npx tsc --noEmit --pretty false`

## Test Coverage Added

- `trendsDebug.test.tsx` now verifies that changing only `Metric / Field` increases detail-request count without increasing heavy-request count.
