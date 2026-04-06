# Goalie Stats Shared Pipeline Extension (`NEW 1.6`)

## Findings

- The shared public contract already exposed the requested goalie-only strength states and non-`allScores` score states, but the shared implementation stopped short of that contract.
- The parity generator in [nhlNstParityMetrics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlNstParityMetrics.ts) only emitted `all`, `ev`, `fiveOnFive`, `pp`, and `pk` before this step.
- The shared landing-summary path in [playerStatsLandingServer.ts](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts) partitioned persisted rows only by `mode + strength`, and summary rows did not carry `scoreState`.
- Legacy persisted summary rows without `scoreState` still need to remain readable, because the repo already contains `allScores`-only rows generated before this extension.
- Goalie bucket xG / HD-MD-LD goal math also needed state-aware shot filtering. Before this step, goalie contexts carried whole-game `shotFeatures`, which could have mixed whole-game shot data back into a filtered strength or score-state row.

## What Changed

### Shared parity generator

- Extended the shared parity split keys to support:
  - `fiveOnFourPP`
  - `fourOnFivePK`
  - `threeOnThree`
  - `withEmptyNet`
  - `againstEmptyNet`
- Added optional `scoreState` filtering to `buildNstParityMetrics(...)`.
- Added team-relative strength-state resolution and score-state matching so both skater and goalie parity can be filtered against the same public contract.
- Kept `allScores` TOI behavior unchanged while making non-`allScores` TOI state-aware.

### Shared landing-summary path

- Expanded `PlayerStatsSupportedStrength` to the full shared public strength contract.
- Added `scoreState` to `PlayerStatsLandingSummaryRow`.
- Extended summary identity keys and summary partitions to use `mode + strength + scoreState`.
- Kept `allScores` partition URLs backward-compatible:
  - `derived://underlying-player-summary-v2/{mode}/{strength}/{gameId}`
- Added explicit score-state partition URLs for non-`allScores`:
  - `derived://underlying-player-summary-v2/{mode}/{strength}/{scoreState}/{gameId}`
- Normalized legacy persisted rows without `scoreState` to `allScores` at parse time so old payloads remain readable.
- Updated summary-row matching for landing/detail/chart reads so `scoreState` is part of the filter contract.
- Updated summary snapshot generation to emit every supported score-state partition.

### Goalie-context consistency

- Filtered goalie `shotFeatures` at context-build time using the active strength and score-state selection, so goalie bucket metrics now stay aligned with the filtered row instead of the whole game.

## Verified

- `npx vitest run /Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.test.ts`
- Result:
  - `2` files passed
  - `33` tests passed

### New targeted coverage added

- [nhlNstParityMetrics.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts)
  - extended goalie strength splits
  - goalie score-state filtering buckets
- [playerStatsLandingServer.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.test.ts)
  - legacy persisted-row `scoreState` normalization
  - score-state-aware summary partition source URLs

## Assumptions

- `leading` and `trailing` remain separate from `upOne` and `downOne`; a one-goal lead belongs to `upOne`, not `leading`.
- `allScores` partition URLs stay on the legacy-compatible path so previously stored all-situations partitions continue to resolve without a forced historical rewrite.

## Scope Notes

- This step upgraded the shared pipeline only. It did not create the dedicated `/underlying-stats/goalieStats` route or goalie APIs yet.
- `1.0` remains open because `NEW 1.7` is still pending.
