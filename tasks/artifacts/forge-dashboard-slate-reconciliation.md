# FORGE Dashboard Slate Reconciliation

## Purpose

This artifact reconciles the slate UI against:

- the Start Chart API contract
- the shared Start Chart normalizer
- authoritative source tables for one live audited slate date

The goal is to separate:

- UI honesty
- API honesty
- actual component correctness

## Reconciliation Verdict

- matchup accuracy: `green`
- date-context accuracy: `yellow`
- goalie-context accuracy: `red`
- overall reconciliation result: `yellow`

## Audited Chain

Source tables:

- `games`
- `player_projections`
- `goalie_start_projections`
- `team_power_ratings_daily`
- `team_ctpi_daily`

Serving route:

- [start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts)

Normalization layer:

- [normalizers.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts)

Rendering surfaces:

- [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx)
- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)

## Live Source Evidence

Audited slate date: `2026-03-15`

Aggregate source snapshot:

- `game_count = 6`
- `player_projection_count = 216`
- `goalie_projection_count = 0`
- `team_power_rows_for_slate_teams = 12`
- `ctpi_rows_for_slate_teams = 12`

Per-game snapshot:

| Game | Matchup | Skater projection rows | Goalie projection rows |
| --- | --- | ---: | ---: |
| `2025021057` | `STL @ WPG` | `36` | `0` |
| `2025021058` | `SJS @ OTT` | `36` | `0` |
| `2025021059` | `ANA @ MTL` | `36` | `0` |
| `2025021060` | `TOR @ MIN` | `36` | `0` |
| `2025021061` | `NSH @ EDM` | `36` | `0` |
| `2025021062` | `FLA @ SEA` | `36` | `0` |

## API Contract Check

[start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts):

- fetches games for the requested or resolved date
- joins skater projection rows by `game_id`
- joins goalie rows by `game_id`
- attaches team ratings by team abbreviation and `dateUsed`
- returns enriched `games` plus `dateUsed`

For the audited date, the API contract is internally consistent:

- it would return the correct six games
- it would return skater projection coverage for all six games
- it would return no goalie rows for all six games because the source table has none for that date

So the API is not inventing or swapping slate rows. The issue is missing goalie coverage, not a mismapped payload.

## Normalizer Check

[normalizeStartChartResponse](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts):

- preserves `dateUsed`
- preserves `id`, `homeTeamId`, and `awayTeamId`
- preserves goalie arrays without coercing missing goalie rows into fake values
- preserves `homeRating` and `awayRating` as nullable snapshots

Important outcome:

- the normalizer does not silently flatten missing goalie rows into `0%`
- it passes empty goalie arrays through honestly

That means the current goalie problem is upstream freshness, not a normalizer bug.

## Dashboard Surface Reconciliation

[SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx):

- matchup labels are rendered directly from `awayTeamId` and `homeTeamId` via `getTeamMetaById(...)`
- focused matchup state is selected directly from the normalized `games` list
- power edge is derived from the normalized game object, not from a second source
- goalie lanes render directly from `awayGoalies` and `homeGoalies`
- empty goalie arrays become `No goalie probabilities`
- `Open Start Chart` correctly carries `dateUsed` into the drill-in URL

Result:

- matchup rendering is consistent with the Start Chart payload
- focused-matchup switching is consistent with the API row IDs
- goalie rendering is honest to the payload, but not sufficient for the product promise

## FORGE Preview Reconciliation

[FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx):

- uses the same `normalizeStartChartResponse(...)` path
- uses `dateUsed` for stale-preview messaging
- surfaces away/home start probabilities from the first goalie on each side

Result:

- the preview is also honest to the payload
- but its `Open Start Chart` link does not carry `dateUsed`, so preview date-context continuity is weaker than the dashboard’s slate hero

This is not the main source-accuracy bug, but it is a route-context inconsistency worth tracking.

## Accuracy Conclusions

### Matchup Accuracy: Green

Why:

- `games` source rows exist for the audited date
- each game reconciles to the correct home/away teams
- both UI surfaces render matchup identity directly from the normalized game rows
- no evidence of swapped teams, duplicate games, or missing slate tiles

### Date-Context Accuracy: Yellow

Why:

- `dateUsed` is preserved through the API and normalizer
- dashboard stale-state handling around `dateUsed` is explicit
- FORGE preview stale-state handling is explicit
- but the FORGE preview drill-in link does not carry the resolved date forward
- and mixed-freshness payloads can still look current when `dateUsed` equals the requested date

### Goalie-Context Accuracy: Red

Why:

- every audited `2026-03-15` game had `0` goalie projection rows at the source
- the API therefore returns empty goalie arrays for a current slate date
- the UI honestly renders those empty arrays
- but the component is still failing its intended goalie-context contract for the current slate

This is a true product-level reconciliation failure, even though the UI is technically honest to the payload.

## Existing Verification Coverage

- [dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx)
  - covers focused slate hero behavior
  - covers empty Start Chart states
  - covers fallback messaging using `dateUsed`
- [FORGE.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/FORGE.test.tsx)
  - covers slate preview rendering
  - covers latest-available slate messaging

Current gap:

- there is no automated reconciliation check against live authoritative source counts for games, skater rows, goalie rows, and ratings on the same resolved slate date

## Required Follow-Ups

- add a slate reconciliation check that compares Start Chart API output against source counts for one resolved date
- explicitly surface goalie-source staleness when `games` and `player_projections` are current but goalie rows are absent
- decide whether the FORGE preview should pass `dateUsed` into its Start Chart drill-in URL for better date continuity
