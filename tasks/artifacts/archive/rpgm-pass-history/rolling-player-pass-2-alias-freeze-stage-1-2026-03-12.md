# Rolling Player Pass 2 Alias Freeze Stage 1

## Scope

This step formalizes the first non-breaking alias-freeze follow-up required by the pass-2 audit.

- no columns are removed
- the writer still emits legacy compatibility fields
- current readers continue to work
- the freeze is implemented as an explicit policy and guardrail layer

## Stage-1 policy

The following legacy surfaces are now treated as compatibility-only freeze candidates:

- legacy ratio aliases such as `shooting_pct_avg_last5` and `cf_pct_total_career`
- legacy weighted-rate aliases such as `sog_per_60_avg_last5` and `blocks_per_60_total_last10`
- legacy GP aliases such as `gp_pct_avg_season` and `gp_pct_total_last20`

These fields remain writable for compatibility, but new readers should not be added against them.

## Explicit non-freeze surfaces

The following legacy-looking surfaces are intentionally excluded from the stage-1 freeze set because they still carry live meaning or short-term compatibility value:

- additive `avg` fields
- additive `total` fields
- TOI `avg` fields
- TOI `total` fields
- convenience GP mirrors such as `games_played` and `team_games_played`

## Implementation

`web/lib/rollingPlayerMetricCompatibility.ts` now exposes:

- `getCompatibilityOnlyLegacyFamily(field)`
- `isCompatibilityOnlyLegacyField(field)`
- `describeLegacyFieldLifecycle(field)`

These helpers make the pass-2 freeze policy explicit in code so downstream readers and later migrations can share one classification source.

## Current guidance

- keep writing compatibility-only legacy aliases for now
- prevent new reader adoption of those aliases
- route surviving reads through compatibility helpers
- stage any later write-stop or column-retirement work behind downstream cleanup and migration review

## Verification

- `npm test -- --run lib/rollingPlayerMetricCompatibility.test.ts`
- `npx tsc --noEmit --pretty false`
