# Rolling Player Pass-2 Validation Metadata Payload

## Completed in task `2.1`

This step populated the read-only validation payload with server-authoritative metadata so `trendsDebug.tsx` no longer has to remain the source of truth for formulas, helper-contract summaries, or rolling-window membership semantics.

## Implemented changes

- Added `includeWindowMembership` and `includeContractMetadata` request flags to the validation payload builder and debug route.
- Populated `formulas.selectedMetric` in [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts) with:
  - selected field
  - base metric key
  - inferred metric family
  - inferred rolling-window family
  - server-owned formula string
  - formula source classification
  - canonical field
  - legacy fields
  - support fields
- Populated `contracts` in [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts) with:
  - selected metric family
  - selected rolling-window family
  - canonical rolling-window contract
  - helper summaries for:
    - availability / participation
    - PP share
    - PP unit
    - line context
    - TOI source priority and trust ordering
    - additive source selection authority
- Populated `windows` in [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts) with server-side membership lists for:
  - `last3`
  - `last5`
  - `last10`
  - `last20`

## Window-membership behavior

- Availability-family metrics now use the authoritative current-team game ledger from `sourceData.games`.
- Appearance-based additive, ratio, and weighted-rate metrics use recomputed row history when available, otherwise stored row history.
- Window entries now carry:
  - row key
  - game id
  - game date
  - season
  - team id
  - strength
  - source type
  - selected-slot occupancy
  - player appearance flag

## Route and test coverage

- Updated [rolling-player-metrics.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.ts) to parse and forward the new flags.
- Added pure-unit coverage in [rollingPlayerValidationPayload.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts) for:
  - exact formula metadata
  - appearance-based window membership
  - availability/team-game window membership
- Updated [rolling-player-metrics.test.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.test.ts) to verify request parsing for the new metadata flags.

## Verification

- `npx tsc --noEmit --pretty false`
- `npm test -- --run lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/api/v1/debug/rolling-player-metrics.test.ts`
