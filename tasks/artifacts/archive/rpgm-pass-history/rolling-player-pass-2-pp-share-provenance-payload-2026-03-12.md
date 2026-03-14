# Rolling Player Pass-2 PP-Share Provenance Payload

## Completed in task `2.3`

This step added per-game PP-share provenance output to the validation payload so the debug console can distinguish builder-backed PP-share rows from WGO fallback rows and identify mixed-source rolling windows.

## Implemented payload output

Added two new PP-share provenance surfaces to [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts):

- `sourceRows.selectedStrength.ppShareTraceRows`
- `sourceRows.selectedStrength.ppShareWindowSummary`

## `ppShareTraceRows`

Each trace row includes:

- `rowKey`
- `gameId`
- `gameDate`
- `strength`
- `builder`
  - `playerPpToi`
  - `share`
  - `teamPpToiInferred`
  - `valid`
- `wgo`
  - `playerPpToi`
  - `share`
  - `teamPpToiInferred`
  - `valid`
- `chosen`
  - `source`
  - `playerPpToi`
  - `share`
  - `teamPpToiInferred`

The chosen source is one of:

- `builder`
- `wgo`
- `missing`

## `ppShareWindowSummary`

For the focused row, the payload now includes `last3`, `last5`, `last10`, and `last20` PP-share window summaries with:

- `windowSize`
- `sourcesUsed`
- `mixedSourceWindow`
- `missingSourceGameIds`
- `memberSources`

This makes it explicit when a selected PP-share window mixes builder-backed rows with WGO fallback rows, which was the main pass-2 ambiguity called out in the audit backlog.

## Provenance rules implemented

- Builder PP-share is considered valid only when both:
  - `powerPlayCombinations.PPTOI`
  - `powerPlayCombinations.pp_share_of_team`
  can infer team PP TOI.
- WGO PP-share is considered valid only when both:
  - `wgo_skater_stats.pp_toi`
  - `wgo_skater_stats.pp_toi_pct_per_game`
  can infer team PP TOI.
- Per-row provenance never invents builder/WGO hybrids. A row resolves to builder, WGO fallback, or missing.
- Mixed-source detection happens at the selected rolling-window level, not by fabricating a mixed per-row source.

## Test coverage

- Added pure-unit coverage in [rollingPlayerValidationPayload.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts) for:
  - builder-backed PP-share rows
  - WGO fallback PP-share rows
  - inferred team PP TOI reconstruction
  - mixed-source `last3` window detection
- Updated [trendsDebug.test.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.test.tsx) fixtures so the page remains compatible with the richer validation payload shape.

## Verification

- `npx tsc --noEmit --pretty false`
- `npm test -- --run lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/trendsDebug.test.tsx pages/api/v1/debug/rolling-player-metrics.test.ts`
