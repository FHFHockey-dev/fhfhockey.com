# PRD: Player Underlying Stats Landing Page and Player Detail Logs

## Document Status

- Status: Draft, curated for task-list generation
- Owner: TBD
- Primary audience: junior developer implementing the feature and AI assistant generating the task list
- Intended follow-up artifact: `tasks/tasks-prd-player-underlying-stats-landing-page.md`

## Introduction and Overview

Build a production-ready player underlying-stats experience with:

- a landing page at `pages/underlying-stats/playerStats`
- a player detail page at `pages/underlying-stats/playerStats/{playerId}`

The landing page is the comparison surface. It must let users compare skaters and goalies across multiple stat families, season scopes, strength states, score states, and rolling windows from one master table.

The player detail page is the drill-down surface. It must let users click any player from the landing page and view season-level logs for that player under the same general filter model, with the `Team` filter replaced by `Against Specific Team`.

This is a real product page, not a mockup. It must be structured so it can handle wide tables, large result sets, and future extensions without turning into a one-off implementation.

## Problem Statement

Users currently lack a single dedicated player underlying-stats landing page where they can:

- compare skaters and goalies under one shared filter system
- switch cleanly between individual, on-ice, and goalie views
- switch between counts and rates
- drill into a player-specific season-log page from the same workflow

The goal of this feature is to create a canonical underlying-stats player experience that is filter-rich, sortable, drillable, and reusable for future downstream xG and parity-backed stat surfaces.

## Goals

1. Create a single landing page where users can compare players across multiple underlying-stat views.
2. Support filtering by season range, season type, strength state, score state, venue, position, TOI threshold, date range, game range, and team-game range.
3. Support all required table families:
   - Individual Counts
   - Individual Rates
   - On-Ice Counts
   - On-Ice Rates
   - Goalie Counts
   - Goalie Rates
4. Allow every visible column to be sortable.
5. Allow every player row on the landing page to link to a dedicated player detail page.
6. Reuse the same filter philosophy and metric families on the player detail page.
7. Keep the implementation performant and maintainable for wide, query-heavy tables.

## User Stories

- As a fantasy or analytics user, I want to compare players across multiple underlying-stat views from one page so I do not need to jump between disconnected tables.
- As a user, I want to switch between Individual, On-Ice, and Goalie modes so I can analyze the correct stat family for the player type and question I have.
- As a user, I want to switch between Counts and Rates without losing my other filters so I can compare raw totals and normalized production.
- As a user, I want to filter by season type, strength, and score state so I can isolate a specific game environment.
- As a user, I want to compare players by date range, last X personal games, or last X team games so I can analyze recent form under different scopes.
- As a user, I want to combine or split traded-player rows so I can either see one total row or separate team stints.
- As a user, I want every column to be sortable so I can identify leaders quickly.
- As a user, I want to click a player and land on a detail page that preserves the same analysis context so I can drill from comparison to player-specific logs without starting over.

## Functional Requirements

### 1. Routes and Pages

1. The system must provide a landing page at `pages/underlying-stats/playerStats`.
2. The system must provide a player detail page at `pages/underlying-stats/playerStats/{playerId}`.
3. The landing page must be the primary comparison surface.
4. The detail page must be the player-specific drill-down surface.

### 2. Landing Page Primary Controls

5. The landing page must expose the following primary controls:
   - `From {season}`
   - `Through {season}`
   - season type
   - strength state
   - score state
   - stat mode
   - display mode
6. `From {season}` and `Through {season}` must be inclusive.
7. Season type options must be:
   - Regular Season
   - Playoffs
   - Pre-Season
8. Strength options must be:
   - 5v5
   - All Strengths
   - Even Strength
   - Penalty Kill
   - Power Play
   - 5 on 4 PP
   - 4 on 5 PK
   - 3 on 3
   - With Empty Net
   - Against Empty Net
9. Score-state options must be:
   - All Scores
   - Tied
   - Leading
   - Trailing
   - Within 1
   - Up 1
   - Down 1
10. Stat mode options must be:
    - On-Ice
    - Individual
    - Goalies
11. Display mode options must be:
    - Counts
    - Rates

### 3. Expandable Filters

12. The landing page must expose additional filters inside an expandable filter section.
13. Expandable filters must include:
    - Team
    - Position Group
    - Home or Away
    - Minimum Time on Ice
    - Date Range
    - Game Range
    - By Team Games
    - Combine or Split
14. Position Group options must include:
    - Skaters
    - Defensemen
    - Centers
    - Left Wings
    - Right Wings
    - Goalies

### 4. Filter Semantics

15. Date Range must filter only within the selected season span.
16. The UI must prevent invalid season and date combinations.
17. `Game Range` must compare each player using that player's own last X games played.
18. `By Team Games` must compare players using the last X games played by the selected team or by each player's team context, even if the player missed some of those games.
19. `Date Range`, `Game Range`, and `By Team Games` must be treated as mutually exclusive scope modifiers.
20. The UI must make the active scope modifier obvious to the user.
21. `Combine` must aggregate traded-player results into one row across all included teams for the active scope.
22. `Split` must show separate rows for each player-team stint for the active scope.
23. Minimum TOI must be applied after aggregation over the active query scope, not before.
24. Position filtering must use canonical roster-position logic.
25. When `Goalies` mode is selected, the result set must include only goalies.
26. When `Individual` or `On-Ice` mode is selected, goalie-only rows must be excluded.
27. Home or Away filtering must apply to the underlying game sample before final aggregation.

### 5. Table Families and Columns

28. The landing page must render the correct column set for the active stat mode and display mode.
29. Individual Counts must show these columns:
    - Player
    - Team
    - Position
    - GP
    - TOI
    - Goals
    - Total Assists
    - First Assists
    - Second Assists
    - Total Points
    - IPP
    - Shots
    - SH%
    - ixG
    - iCF
    - iFF
    - iSCF
    - iHDCF
    - Rush Attempts
    - Rebounds Created
    - PIM
    - Total Penalties
    - Minor
    - Major
    - Misconduct
    - Penalties Drawn
    - Giveaways
    - Takeaways
    - Hits
    - Hits Taken
    - Shots Blocked
    - Faceoffs Won
    - Faceoffs Lost
    - Faceoffs %
30. Individual Rates must show these columns:
    - Player
    - Team
    - Position
    - GP
    - TOI
    - TOI/GP
    - Goals/60
    - Total Assists/60
    - First Assists/60
    - Second Assists/60
    - Total Points/60
    - IPP
    - Shots/60
    - SH%
    - ixG/60
    - iCF/60
    - iFF/60
    - iSCF/60
    - iHDCF/60
    - Rush Attempts/60
    - Rebounds Created/60
    - PIM/60
    - Total Penalties/60
    - Minor/60
    - Major/60
    - Misconduct/60
    - Penalties Drawn/60
    - Giveaways/60
    - Takeaways/60
    - Hits/60
    - Hits Taken/60
    - Shots Blocked/60
    - Faceoffs Won/60
    - Faceoffs Lost/60
    - Faceoffs %
31. On-Ice Counts must show these columns:
    - Player
    - Team
    - Position
    - GP
    - TOI
    - CF
    - CA
    - CF%
    - FF
    - FA
    - FF%
    - SF
    - SA
    - SF%
    - GF
    - GA
    - GF%
    - xGF
    - xGA
    - xGF%
    - SCF
    - SCA
    - SCF%
    - HDCF
    - HDCA
    - HDCF%
    - HDGF
    - HDGA
    - HDGF%
    - MDCF
    - MDCA
    - MDCF%
    - MDGF
    - MDGA
    - MDGF%
    - LDCF
32. On-Ice Rates must show these columns:
    - Player
    - Team
    - Position
    - GP
    - TOI
    - TOI/GP
    - CF/60
    - CA/60
    - CF%
    - FF/60
    - FA/60
    - FF%
    - SF/60
    - SA/60
    - SF%
    - GF/60
    - GA/60
    - GF%
    - xGF/60
    - xGA/60
    - xGF%
    - SCF/60
    - SCA/60
    - SCF%
    - HDCF/60
    - HDCA/60
    - HDCF%
    - HDGF/60
    - HDGA/60
    - HDGF%
    - MDCF/60
    - MDCA/60
    - MDCF%
    - MDGF/60
    - MDGA/60
    - MDGF%
33. Goalie Counts must show these columns:
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
34. Goalie Rates must show these columns:
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

### 6. Counts and Rates Calculation Rules

35. Rates mode must convert count metrics into per-60 versions only where the requested column explicitly requires a per-60 value.
36. Percentage metrics and ratio metrics must remain percentage or ratio values in both Counts and Rates modes where the requested column list keeps them unchanged.
37. Examples of metrics that must remain unchanged between Counts and Rates modes where listed that way include:
    - IPP
    - SH%
    - Faceoffs %
    - CF%
    - FF%
    - SF%
    - GF%
    - xGF%
    - SCF%
    - HDCF%
    - HDGF%
    - MDCF%
    - MDGF%
    - SV%
    - HDSV%
    - MDSV%
    - LDSV%
    - GAA
    - HDGAA
    - MDGAA
    - LDGAA
    - Avg. Shot Distance
    - Avg. Goal Distance

### 7. Sorting

38. Every visible table column must be sortable.
39. Sorting must support both ascending and descending order.
40. Default sort for Individual Counts must be `Total Points` descending.
41. Default sort for Individual Rates must be `Total Points/60` descending.
42. Default sort for On-Ice Counts must be `xGF%` descending.
43. Default sort for On-Ice Rates must be `xGF%` descending.
44. Default sort for Goalie Counts must be `SV%` descending.
45. Default sort for Goalie Rates must be `SV%` descending.
46. If two rows tie on the default sort column, the table must use deterministic tie-breakers so ordering does not jump between renders.

### 8. Row Links and Navigation

47. Every player name on the landing page must be a clickable link.
48. The player link target must be `pages/underlying-stats/playerStats/{playerId}`.
49. The route must use a stable player identifier.
50. Navigation from the landing page to the player detail page must preserve the active landing-page filter context through query params or an equivalent recoverable URL state.

### 9. Player Detail Page

51. The player detail page must show season-level logs for the selected player.
52. The player detail page must use one row per season by default.
53. If `Split` is selected and the player had multiple team stints within a season, the detail page may show one row per season-team stint for that season rather than forcing a single combined row.
54. The player detail page must reuse the same general metric families as the landing page:
    - Individual Counts
    - Individual Rates
    - On-Ice Counts
    - On-Ice Rates
    - Goalie Counts
    - Goalie Rates
55. The player detail page must reuse the same primary filters where they make sense.
56. On the player detail page, the landing-page `Team` filter must be replaced by `Against Specific Team`.
57. The player detail page must preserve sortable columns.
58. The player detail page must feel like a direct continuation of the landing page, not a separate product surface.

### 10. URL and State Behavior

59. All data-shaping filters must sync to the URL so views are shareable and recoverable.
60. Pure UI state, such as whether the expandable filter section is open, does not need to sync to the URL.
61. Changing stat mode must reset or coerce incompatible filters only when necessary.
62. If a filter becomes incompatible because of a mode change, the UI must make the reset behavior clear.

### 11. Loading, Empty, and Error States

63. The page must show a clear loading state while results are being fetched or recalculated.
64. The page must show a clear empty state when no rows match the active filter set.
65. The empty state must explain that the result set is empty because of the current filters rather than silently rendering a blank table.
66. The page must show a visible error state when data cannot be loaded.
67. The page must provide a reset-filters action.

### 12. Performance and Scalability

68. The landing page must be designed for wide datasets and large result sets.
69. The master table must use a scalable rendering strategy, such as server-side pagination with horizontally scrollable columns, with virtualization added if needed for row volume.
70. Sorting and filtering must occur on the server whenever client-side handling would be too expensive or would require loading an impractically large result set into the browser.
71. The implementation must avoid unnecessary refetches and unnecessary re-renders.
72. The landing page and player detail page must share reusable filter and table abstractions where practical.

### 13. Data Contract and Metric Source Rules

73. The implementation must document the canonical source for each metric family.
74. If a metric is derived, approximated, or still on an interim source, that must be documented explicitly.
75. The implementation must not silently mix incompatible data sources inside the same table without documentation.
76. Traded-player combine and split behavior must be consistent across all modes.
77. Rate calculations must use the same denominator rules everywhere they appear.

### 14. Validation and Testing

78. The implementation must include validation for correct column rendering by mode.
79. The implementation must include validation for correct filter interactions.
80. The implementation must include validation for default sorting.
81. The implementation must include validation for rate calculations.
82. The implementation must include validation for combine versus split traded-player behavior.
83. The implementation must include validation for Game Range versus By Team Games behavior.
84. The implementation must include validation for position filtering.
85. The implementation must include validation for player hyperlink routing.
86. The implementation must include validation for player detail rendering.
87. The implementation must include validation for loading, empty, and error states.
88. The implementation must include validation for large-result-set behavior.

## Non-Goals

1. This feature does not include charts or visualizations beyond the table-based experience.
2. This feature does not include exports, saved views, or user-specific presets.
3. This feature does not include team, line, or game detail pages.
4. This feature does not require every future underlying metric family to exist on day one if the current canonical stat contract is documented clearly.
5. This feature does not include goalie-specific modeling work beyond consuming the approved stat surface.

## Design Considerations

- The landing page should present the primary filters prominently and keep the advanced filters collapsed by default.
- The table should support wide-column usability with sticky identifying columns if practical.
- The page should make active filters easy to scan.
- Landing-page and detail-page layouts should feel visually related and should not read like different product surfaces.
- The detail page should prioritize continuity with the landing page over introducing a different interaction model.

## Technical Considerations

- The implementation should favor reusable table and filter abstractions rather than page-specific logic.
- The implementation should favor canonical underlying-stat sources over legacy or duplicated logic.
- Query design must handle:
  - wide column sets
  - large result sets
  - server-side sorting
  - rolling player-game windows
  - rolling team-game windows
  - combine and split traded-player grouping
- The implementation should be designed so the landing page can become an early downstream reader of approved xG and parity-backed stat surfaces without a full page rewrite.

## Success Metrics

1. The landing page exists and functions at `pages/underlying-stats/playerStats`.
2. The player detail page exists and functions at `pages/underlying-stats/playerStats/{playerId}`.
3. Users can switch between all six table families without breaking filter state.
4. Users can apply every required filter and get coherent results.
5. Every visible column is sortable.
6. Default sorting behaves as defined in this PRD.
7. Player drill-down works correctly from landing page to detail page.
8. The page remains usable under real-world row counts and wide-column layouts.
9. Implementation tasks can be generated directly from this PRD without major requirement ambiguity.

## Open Questions

1. Which canonical source or view should back each metric family on day one for the landing page versus the player detail page?
2. Should the first implementation ship with a single shared backend query surface for landing and detail pages, or two reader-specific query surfaces that share a lower-level aggregation layer?
3. Does the current data layer already support every requested goalie distance-bucket metric in canonical form, or will some require documented interim derivation?
