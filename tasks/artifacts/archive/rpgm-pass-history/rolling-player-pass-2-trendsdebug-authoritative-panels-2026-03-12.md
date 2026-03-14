# Rolling Player Pass-2 `trendsDebug` Authoritative Panels

## Completed in task `2.5`

This step moved the primary validation panels in [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx) off browser-side heuristics and onto the server-authoritative validation payload.

## Panels switched to payload-backed data

- Formula Panel
  - now uses `payload.formulas.selectedMetric`
  - shows:
    - canonical formula
    - formula source
    - window family
    - support fields
    - legacy aliases
    - canonical window-contract summary
- Rolling-Window Membership Panel
  - now uses `payload.windows.memberships`
  - no longer reconstructs `last3/5/10/20` in the browser from row history
  - correctly distinguishes:
    - appearance-row windows
    - team-game windows
- TOI Trust Panel
  - now uses `payload.sourceRows.selectedStrength.toiTraceRows`
  - shows:
    - chosen TOI source
    - fallback seed source
    - trust tier
    - WGO normalization
    - rejected candidates
    - suspicious notes
- PP Context Panel
  - now uses:
    - `payload.sourceRows.selectedStrength.ppShareTraceRows`
    - `payload.sourceRows.selectedStrength.ppShareWindowSummary`
  - shows:
    - chosen PP-share source
    - inferred team PP TOI
    - mixed-source window presence
- Stored-vs-Reconstructed Diff Panel
  - now uses:
    - `payload.comparisons.focusedRow.selectedMetric`
    - `payload.comparisons.focusedRow.comparisonMatrix`
    - `payload.comparisons.focusedRow.canonicalVsLegacy`
    - `payload.comparisons.focusedRow.supportComparisons`
    - `payload.comparisons.familySummary`

## UI behavior changes

- The summary card now shows family-level mismatch counts instead of only one focused diff number.
- The copy helpers now use payload-backed formula and comparison data.
- The comparison block now includes `mismatch cause`.
- The page still preserves lightweight local family inference for selector filtering, but the validation panels no longer own formula or window semantics.

## Compatibility note

`selectedMetric.diff` is still preserved in the payload and consumed by the page as a compatibility alias while the broader diff rendering transitions to the richer comparison object.

## Test coverage

- Updated [trendsDebug.test.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.test.tsx) fixture payloads to include:
  - contracts
  - formulas
  - windows
  - TOI trace rows
  - PP-share provenance
  - family mismatch summary
  - focused comparison matrix
- Verified existing copy-helper and readiness tests still pass against the richer payload.

## Verification

- `npx tsc --noEmit --pretty false`
- `npm test -- --run pages/trendsDebug.test.tsx pages/api/v1/debug/rolling-player-metrics.test.ts lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts`
