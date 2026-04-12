# PRD: Goalie Underlying Stats Landing Page and Goalie Detail Logs

## Document Status

- Status: Draft, curated for task-list generation
- Owner: TBD
- Primary audience: junior developer implementing the feature and AI assistant generating the task list
- Intended follow-up artifact: `tasks/tasks-prd-goalie-underlying-stats-landing-page.md`

## Current-State Audit

This PRD is not greenfield.

The current player underlying-stats system already includes goalie metrics inside the shared player surface:

- goalie table families already exist in the shared column contract at `web/components/underlying-stats/playerStatsColumns.ts`
- goalie mode, strength filters, score-state filters, scope modifiers, and team or venue filters already exist in the shared landing filter contract at `web/lib/underlying-stats/playerStatsTypes.ts`
- the landing and detail API stack is already shared and mode-driven:
  - `web/pages/api/v1/underlying-stats/players.ts`
  - `web/pages/api/v1/underlying-stats/players/[playerId].ts`
  - `web/pages/api/v1/underlying-stats/players/[playerId]/chart.ts`
- the aggregation pipeline already computes goalie metrics from the shared summary payload path in `web/lib/underlying-stats/playerStatsLandingServer.ts`
- the persisted summary refresh path is already shared and must remain canonical:
  - `web/lib/underlying-stats/playerStatsSummaryRefresh.ts`
  - `web/pages/api/v1/db/update-player-underlying-stats.ts`
  - `web/pages/api/v1/db/update-player-underlying-summaries.ts`

What does not exist yet is a dedicated goalie product surface with goalie-specific information architecture, routing, API naming, copy, default behavior, and validation.

## Findings

1. The current player PRD and implementation already bundle skaters and goalies under one shared product surface, which is the biggest architectural constraint on a goalie branch. Replacing that shared model would be wasteful; the correct move is to split the product surface while reusing the same summary snapshots and aggregation engine.
2. The shared landing pipeline already computes nearly the exact goalie metric set required for this PRD, including:
   - `SV%`
   - `GAA`
   - `GSAA`
   - `xG Against`
   - danger-split shots, saves, goals against, save percentages, GAA, and GSAA
   - rush attempts against
   - rebound attempts against
   - average shot distance
   - average goal distance
3. There is currently no dedicated goalie landing route or dedicated goalie API namespace. The current read surface is player-centric in naming and copy.
4. The existing shared filter contract already supports the required game type, strength, score-state, date range, game range, and team-game range options. That means the goalie PRD should avoid inventing a second incompatible filter model.
5. The current player page supports a `Goalies` mode, but it is not a dedicated goalie experience:
   - the route is still `playerStats`
   - the page copy is player-oriented
   - the product framing is still “players”
   - non-goalie affordances and state transitions still exist because the entire surface is shared

## Assumptions

1. The new dedicated goalie product surface should live at:
   - landing: `pages/underlying-stats/goalieStats`
   - detail: `pages/underlying-stats/goalieStats/{playerId}`
2. The stable identifier remains the existing player identifier from the shared player system, even for goalies.
3. The shared ingestion and summary snapshot pipeline remains canonical. No separate goalie raw ingest pipeline should be introduced.
4. The goalie product surface should reuse the current shared metric math unless a goalie-specific formula audit later proves that a metric needs to change.

## Introduction and Overview

Build a dedicated goalie underlying-stats experience with:

- a landing page at `pages/underlying-stats/goalieStats`
- a goalie detail page at `pages/underlying-stats/goalieStats/{playerId}`

This must be a first-class goalie product surface, not just the current player page with `statMode=goalies` preselected.

The goalie landing page must present a dedicated comparison table for goalies only, using goalie-specific defaults, copy, filters, and routing. The goalie detail page must be the goalie-specific drill-down page for the same analysis context.

The implementation must reuse the existing shared player-underlying summary pipeline wherever practical, so the surface split does not create duplicate ingestion logic or conflicting stat definitions.

## Problem Statement

Users currently can reach goalie metrics only through the general player underlying-stats surface. That creates three problems:

- the product framing is wrong for a dedicated goalie workflow
- the route and API naming remain player-oriented
- the shared UI still carries skater-oriented assumptions even when goalie mode is active

The goal of this feature is to create a dedicated goalie underlying-stats surface that:

- uses goalie-first information architecture
- preserves the existing canonical metric and filter model
- reuses the existing summary snapshot and aggregation pipeline
- remains compatible with current and future player-underlying data refresh jobs

## Goals

1. Create a dedicated landing page for goalie underlying stats.
2. Create a dedicated goalie detail page for drill-down logs.
3. Reuse the shared player-underlying summary pipeline rather than fork ingestion or metric computation.
4. Expose the required goalie counts and goalie rates columns exactly as a goalie-first surface.
5. Support all required game type, strength, score-state, team, venue, TOI, date range, game range, and team-game range filters.
6. Keep every visible table column sortable.
7. Keep the table performant for wide datasets and large result sets.
8. Preserve shareable, recoverable URL state for the goalie surface.

## Non-Goals

1. This PRD does not require replacing the shared player summary snapshot pipeline.
2. This PRD does not require removing goalie mode from the existing player surface immediately.
3. This PRD does not require inventing new goalie metrics beyond the required list below.
4. This PRD does not require changing raw NHL ingest contracts unless a verified blocker is found.

## User Stories

- As a goalie-focused analytics user, I want a dedicated goalie surface so I do not need to use a mixed player page to evaluate goalie results.
- As a user, I want to compare goalies by counts and rates using the same filter model that already works for player underlying stats.
- As a user, I want to isolate specific score states, strengths, and game windows so I can study goalie environment effects.
- As a user, I want to drill from the landing table into a goalie-specific detail page without losing the current filter context.
- As a user, I want the route, copy, and defaults to make it obvious that this surface is about goalies only.

## Functional Requirements

### 1. Routes and Pages

1. The system must provide a goalie landing page at `pages/underlying-stats/goalieStats`.
2. The system must provide a goalie detail page at `pages/underlying-stats/goalieStats/{playerId}`.
3. The goalie landing page must be the primary comparison surface for goalie underlying stats.
4. The goalie detail page must be the goalie-specific drill-down surface.

### 2. Primary Controls

5. The goalie landing page must expose the following primary controls:
   - `From {season}`
   - `Through {season}`
   - season type
   - strength state
   - score state
   - display mode
6. Season type options must be:
   - Regular Season
   - Pre-Season
   - Playoffs
7. Strength options must be:
   - All Strengths
   - 5v5
   - Even Strength
   - Power Play
   - 5 on 4 Power Play
   - Penalty Kill
   - 4 on 5 PK
   - 3 on 3
   - With Empty Net
   - Against Empty Net
8. Score-state options must be:
   - All Scores
   - Tied
   - Up 1
   - Leading
   - Down 1
   - Trailing
   - Within 1
9. Display mode options must be:
   - Counts
   - Rates

### 3. Advanced Filters

10. The goalie landing page must expose an expandable advanced-filter section.
11. Advanced filters must include:
   - Team
   - Home or Away
   - Minimum TOI
   - Date Range
   - Game Range
   - Team Game Range
12. The goalie surface must not expose skater-specific position filters.
13. `Date Range`, `Game Range`, and `Team Game Range` must be mutually exclusive scope modifiers.
14. The active scope modifier must be visually obvious in the UI and URL state.

### 4. Filter Semantics

15. Date Range must filter only within the selected season span.
16. Game Range must compare each goalie using that goalie’s own last X games played.
17. Team Game Range must compare each goalie using the last X games played by that goalie’s active team context, even if the goalie missed some of those games.
18. Team filter must apply to the underlying game sample before aggregation.
19. Venue filter must apply to the underlying game sample before aggregation.
20. Minimum TOI must be applied after aggregation over the active query scope, not before.
21. The UI must prevent invalid season and date combinations.

### 5. Landing Table Families and Columns

22. The goalie landing page must support exactly two table families:
   - Goalie Counts
   - Goalie Rates

23. Goalie Counts must show these columns:
   - Rank
   - Player
   - Team
   - GP
   - TOI
   - Shots Against
   - Saves
   - Goals Against
   - SV%
   - GAA
   - GSAA
   - xG Against
   - HD Shots Against
   - HD Saves
   - HD Goals Against
   - HDSV%
   - HDGAA
   - HDGSAA
   - MD Shots Against
   - MD Saves
   - MD Goals Against
   - MDSV%
   - MDGAA
   - MDGSAA
   - LD Shots Against
   - LD Saves
   - LD Goals Against
   - LDSV%
   - LDGAA
   - LDGSAA
   - Rush Attempts Against
   - Rebound Attempts Against
   - Avg. Shot Distance
   - Avg. Goal Distance

24. Goalie Rates must show these columns:
   - Rank
   - Player
   - Team
   - GP
   - TOI
   - TOI/GP
   - Shots Against/60
   - Saves/60
   - SV%
   - GAA
   - GSAA/60
   - xG Against/60
   - HD Shots Against/60
   - HD Saves/60
   - HDSV%
   - HDGAA
   - HDGSAA/60
   - MD Shots Against/60
   - MD Saves/60
   - MDSV%
   - MDGAA
   - MDGSAA/60
   - LD Shots Against/60
   - LD Saves/60
   - LDSV%
   - LDGAA
   - LDGSAA/60
   - Rush Attempts Against/60
   - Rebound Attempts Against/60
   - Avg. Shot Distance
   - Avg. Goal Distance

### 6. Metric Calculation Rules

25. Count metrics must remain raw totals unless the column explicitly requires a rate version.
26. Rate metrics must use the same TOI denominator rules as the existing shared player-underlying system.
27. `SV%`, `HDSV%`, `MDSV%`, and `LDSV%` must remain percentage metrics in both Counts and Rates modes.
28. `GAA`, `HDGAA`, `MDGAA`, and `LDGAA` must remain GAA-style values in both Counts and Rates modes.
29. `Avg. Shot Distance` and `Avg. Goal Distance` must remain distance values in both Counts and Rates modes.
30. `GSAA` must remain based on the current shared goalie definition unless a dedicated formula audit changes that definition in a later milestone.

### 7. Sorting

31. Every visible table column must be sortable.
32. Sorting must support ascending and descending order.
33. Default sort for Goalie Counts must be `SV%` descending.
34. Default sort for Goalie Rates must be `SV%` descending.
35. The `Rank` column must always render as visual row order `1..n` after the current sort is applied.
36. Ties must use deterministic tie-breakers so ordering does not jump between renders.

### 8. Navigation and Detail Surface

37. Every goalie name on the landing page must link to `pages/underlying-stats/goalieStats/{playerId}`.
38. The goalie detail route must preserve the active landing-page filter context through recoverable URL state.
39. The goalie detail page must use the same general filter model where applicable.
40. On the goalie detail page, the landing-page `Team` filter may be replaced with `Against Specific Team` only if that matches the existing detail-surface pattern and does not weaken the goalie workflow.

### 9. URL and State Behavior

41. All data-shaping filters must sync to the URL.
42. Pure UI state does not need to sync to the URL.
43. Changing display mode or scope must reset only incompatible state.
44. Reset behavior must be explicit and predictable.

### 10. Loading, Empty, and Error States

45. The goalie landing page must show a clear loading state.
46. The page must show a clear empty state when no rows match the active filters.
47. The page must show a visible error state when data cannot be loaded.
48. The page must provide a reset-filters action.
49. For staged landing loads, the UI must show progress clearly enough that the user can tell whether data is still loading.

### 11. Performance and Scalability

50. The goalie landing page must be designed for wide tables and large result sets.
51. The table must remain horizontally scrollable.
52. The table may use staged loading, pagination, virtualization, or a hybrid approach, but the implementation must feel responsive on first load.
53. Server-side aggregation and sorting must remain the canonical path unless a verified optimization changes that contract.
54. The goalie surface must reuse the current summary snapshot and aggregate cache strategy wherever practical.

## Data Pipeline and Source-of-Truth Requirements

### 12. Canonical Pipeline

55. The goalie surface must reuse the existing player-underlying raw ingest and summary refresh pipeline:
   - raw Gamecenter ingest via the current player-underlying refresh jobs
   - persisted summary snapshots in `nhl_api_game_payloads_raw`
   - landing and detail aggregation via the shared player-underlying aggregation engine
56. No separate goalie-only raw ingest pipeline should be introduced unless a verified blocker is found.
57. Any new goalie route or API layer should initially wrap or specialize the shared aggregation engine rather than duplicate it.

### 13. Canonical Read Surfaces

58. The dedicated goalie landing surface should expose a dedicated API route:
   - `pages/api/v1/underlying-stats/goalies.ts`
59. The dedicated goalie detail surface should expose a dedicated API route:
   - `pages/api/v1/underlying-stats/goalies/{playerId}.ts`
60. If the expandable row chart pattern is reused, the dedicated goalie chart surface should expose:
   - `pages/api/v1/underlying-stats/goalies/{playerId}/chart.ts`
61. These dedicated goalie routes may delegate internally to the existing shared player-underlying aggregation code as long as the response contract is goalie-specific and stable.

### 14. Provenance and Metric Rules

62. The implementation must document that the goalie metrics are derived from the shared player-underlying summary payload path unless and until a dedicated goalie source is introduced.
63. The implementation must document any interim or inferred formulas explicitly.
64. The implementation must not silently mix incompatible source paths within the same goalie table.

## Current Repo Reuse Plan

The dedicated goalie PRD should assume reuse of the following current assets:

- shared filter and URL-state logic:
  - `web/lib/underlying-stats/playerStatsFilters.ts`
  - `web/lib/underlying-stats/playerStatsQueries.ts`
  - `web/lib/underlying-stats/playerStatsTypes.ts`
- shared aggregation logic:
  - `web/lib/underlying-stats/playerStatsLandingServer.ts`
- shared summary refresh and cache warm path:
  - `web/lib/underlying-stats/playerStatsSummaryRefresh.ts`
- existing goalie column definitions as the baseline contract:
  - `web/components/underlying-stats/playerStatsColumns.ts`

The dedicated goalie PRD should assume new goalie-specific page and API wrappers rather than immediate deep pipeline divergence.

## Open Product and Engineering Decisions

1. Should the initial goalie detail page be a dedicated copy and route wrapper over the current shared detail implementation, or should it ship only after the dedicated landing page is stable?
2. Should the current player surface retain goalie mode after the dedicated goalie surface ships, or should goalie mode eventually redirect to the dedicated route?
3. Should the dedicated goalie surface use the exact current goalie metric formulas at launch, or should a goalie-specific formula audit be a prerequisite milestone?

## Success Criteria

1. Users can access a dedicated goalie landing page and a dedicated goalie detail page.
2. The goalie landing page exposes the required counts and rates tables with the required filters.
3. The implementation reuses the current shared summary snapshot pipeline rather than creating a second ingestion path.
4. The goalie page is clearly goalie-first in routing, copy, defaults, and information architecture.
5. The page remains performant for wide tables and large result sets.
6. The route and API surface are stable enough to support future goalie-only extensions without further product-level restructuring.

## Validation and Testing Requirements

1. Validate correct column rendering for Goalie Counts and Goalie Rates.
2. Validate all primary filter options:
   - season type
   - strength
   - score state
   - display mode
3. Validate advanced filters:
   - team
   - venue
   - minimum TOI
   - date range
   - game range
   - team game range
4. Validate default sorting.
5. Validate rate calculations and unchanged ratio metrics.
6. Validate URL-state persistence and recovery.
7. Validate goalie hyperlink routing to the dedicated goalie detail page.
8. Validate loading, empty, and error states.
9. Validate large-result-set behavior and staged loading behavior if used.
10. Validate that dedicated goalie routes and pages do not break the existing shared player-underlying refresh pipeline.
