# Goalie Stats Column Audit (`1.2`)

## Scope

This step compares the currently implemented shared goalie column families in [`web/components/underlying-stats/playerStatsColumns.ts`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/playerStatsColumns.ts:271) against the dedicated goalie PRD requirements in [`tasks/prd-goalie-underlying-stats-landing-page.md`](/Users/tim/Code/fhfhockey.com/tasks/prd-goalie-underlying-stats-landing-page.md).

## Findings

### 1. The current shared goalie counts and goalie rates families already cover the required metric set.

Verified in [`web/components/underlying-stats/playerStatsColumns.ts`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/playerStatsColumns.ts:271) and [`web/components/underlying-stats/playerStatsColumns.ts`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/playerStatsColumns.ts:307):

- `Player`
- `Team`
- `GP`
- `TOI`
- `TOI/GP` for rates
- `Shots Against`
- `Saves`
- `Goals Against`
- `SV%`
- `GAA`
- `GSAA`
- `GSAA/60`
- `xG Against`
- `xG Against/60`
- `HD Shots Against`
- `HD Saves`
- `HD Goals Against`
- `HDSV%`
- `HDGAA`
- `HDGSAA`
- `HDGSAA/60`
- `MD Shots Against`
- `MD Saves`
- `MD Goals Against`
- `MDSV%`
- `MDGAA`
- `MDGSAA`
- `MDGSAA/60`
- `LD Shots Against`
- `LD Saves`
- `LD Goals Against`
- `LDSV%`
- `LDGAA`
- `LDGSAA`
- `LDGSAA/60`
- `Rush Attempts Against`
- `Rush Attempts Against/60`
- `Rebound Attempts Against`
- `Rebound Attempts Against/60`
- `Avg. Shot Distance`
- `Avg. Goal Distance`

Conclusion:

- There are no verified missing goalie metrics relative to the PRD lists for counts or rates.

### 2. The main gaps are label consistency and UI-level presentation, not missing server-side metrics.

The shared columns differ from the PRD wording in a few places:

- `xG Against` is currently labeled `xGA` in both families.
- `HD SV%`, `MD SV%`, and `LD SV%` currently include a space before `SV%`, while the PRD uses `HDSV%`, `MDSV%`, and `LDSV%`.
- `HD GAA`, `MD GAA`, and `LD GAA` currently include a space, while the PRD uses `HDGAA`, `MDGAA`, and `LDGAA`.
- `HD GSAA`, `MD GSAA`, and `LD GSAA` currently include a space, while the PRD uses `HDGSAA`, `MDGSAA`, and `LDGSAA`.
- `Avg Shot Distance` and `Avg Goal Distance` currently omit the periods after `Avg`.

These are naming/presentation mismatches, not missing data fields.

### 3. `Rank` is not part of the shared column-definition families.

- The shared goalie identity columns are currently only `player`, `team`, `gp`, and `toi` in [`web/components/underlying-stats/playerStatsColumns.ts`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/playerStatsColumns.ts:82).
- The PRD requires `Rank` as the leftmost visible column, but this is a table-render concern rather than a server/data-contract metric.

Conclusion:

- The dedicated goalie route can reuse the shared goalie metric families, but it still needs an explicit UI-level rank column in the rendered table.

### 4. The current default sort is already goalie-appropriate.

- `goalieCounts` and `goalieRates` both default to `savePct desc` in [`web/components/underlying-stats/playerStatsColumns.ts`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/playerStatsColumns.ts:363).

Conclusion:

- No verified blocker exists in the current default sort contract, though product may still choose a different goalie-first default later.

## Counts Family Comparison

PRD counts requirement -> current implementation status:

- `Rank` -> not part of shared column definitions; UI-rendered column needed
- `Player` -> exact match
- `Team` -> exact match
- `GP` -> exact match
- `TOI` -> exact match
- `Shots Against` -> exact match
- `Saves` -> exact match
- `Goals Against` -> exact match
- `SV%` -> exact match
- `GAA` -> exact match
- `GSAA` -> exact match
- `xG Against` -> present as `xGA`
- `HD Shots Against` -> exact match
- `HD Saves` -> exact match
- `HD Goals Against` -> exact match
- `HDSV%` -> present as `HD SV%`
- `HDGAA` -> present as `HD GAA`
- `HDGSAA` -> present as `HD GSAA`
- `MD Shots Against` -> exact match
- `MD Saves` -> exact match
- `MD Goals Against` -> exact match
- `MDSV%` -> present as `MD SV%`
- `MDGAA` -> present as `MD GAA`
- `MDGSAA` -> present as `MD GSAA`
- `LD Shots Against` -> exact match
- `LD Saves` -> exact match
- `LD Goals Against` -> exact match
- `LDSV%` -> present as `LD SV%`
- `LDGAA` -> present as `LD GAA`
- `LDGSAA` -> present as `LD GSAA`
- `Rush Attempts Against` -> exact match
- `Rebound Attempts Against` -> exact match
- `Avg. Shot Distance` -> present as `Avg Shot Distance`
- `Avg. Goal Distance` -> present as `Avg Goal Distance`

## Rates Family Comparison

PRD rates requirement -> current implementation status:

- `Rank` -> not part of shared column definitions; UI-rendered column needed
- `Player` -> exact match
- `Team` -> exact match
- `GP` -> exact match
- `TOI` -> exact match
- `TOI/GP` -> exact match
- `Shots Against/60` -> exact match
- `Saves/60` -> exact match
- `SV%` -> exact match
- `GAA` -> exact match
- `GSAA/60` -> exact match
- `xG Against/60` -> present as `xGA/60`
- `HD Shots Against/60` -> exact match
- `HD Saves/60` -> exact match
- `HDSV%` -> present as `HD SV%`
- `HDGAA` -> present as `HD GAA`
- `HDGSAA/60` -> present as `HD GSAA/60`
- `MD Shots Against/60` -> exact match
- `MD Saves/60` -> exact match
- `MDSV%` -> present as `MD SV%`
- `MDGAA` -> present as `MD GAA`
- `MDGSAA/60` -> present as `MD GSAA/60`
- `LD Shots Against/60` -> exact match
- `LD Saves/60` -> exact match
- `LDSV%` -> present as `LD SV%`
- `LDGAA` -> present as `LD GAA`
- `LDGSAA/60` -> present as `LD GSAA/60`
- `Rush Attempts Against/60` -> exact match
- `Rebound Attempts Against/60` -> exact match
- `Avg. Shot Distance` -> present as `Avg Shot Distance`
- `Avg. Goal Distance` -> present as `Avg Goal Distance`

## Recommended Reuse Boundary From This Audit

Safe to reuse as-is from the shared system:

- metric keys
- metric availability
- goalie counts family shape
- goalie rates family shape

Should be adjusted for the dedicated goalie product surface:

- leftmost `Rank` UI column
- column labels to match the dedicated goalie PRD naming exactly
- any goalie-specific default column ordering/pinning decisions at the page or table layer

## Verified vs Inferred

Verified:

- both shared goalie column families exist
- all required goalie metrics are already represented
- the current default sorts are goalie-specific
- the current differences are label/presentation differences, not data gaps

Inferred:

- the dedicated goalie route should prefer PRD label consistency even if the shared player route keeps legacy abbreviations
