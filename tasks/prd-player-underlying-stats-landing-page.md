# PRD: Player Underlying Stats Landing Page and Player Detail Logs

## Document Status

- Status: Draft
- Owner: TBD
- Primary audience: developer implementing the feature and AI assistant generating the task list
- Intended follow-up artifact: `tasks/tasks-prd-player-underlying-stats-landing-page.md`

## Summary

Build a production-ready underlying stats experience centered on a landing page at `pages/underlying-stats/playerStats` and a player-specific detail page at `pages/underlying-stats/playerStats/{playerId}`.

The landing page should provide a master table of player underlying stats with advanced filtering, sortable columns, support for multiple stat modes, support for counts and rates, and reusable filtering logic that also powers the player detail page.

The page must support:
- skater individual stats
- skater on-ice stats
- goalie stats
- counts and rate versions of each
- season and game-scope filtering
- strength and score-state filtering
- traded-player combine/split behavior
- player drill-down via hyperlink

This is a real product page, not a mockup. The implementation should be scalable, query-efficient, and structured for future extension.

---

## Goals

1. Create a single landing page where users can compare players across multiple underlying-stat views.
2. Support flexible filtering across season range, season type, strength, score state, position, venue, TOI thresholds, and rolling-game contexts.
3. Allow users to click a player and drill into a dedicated player page showing season-level logs using the same metric families and similar filters.
4. Ensure the table architecture is reusable, performant, sortable, and maintainable.
5. Design the feature so it can scale to wide datasets and large season ranges without becoming unmanageable.

---

## Non-Goals

1. This feature does not need to build new visual charts unless required later.
2. This feature does not need to build team pages, line pages, or game pages.
3. This feature does not need to finalize every underlying metric source immediately if some fields require documented approximation or deferred parity work.
4. This feature does not need to include custom saved views, exports, or user accounts unless already supported elsewhere.

---

## Pages in Scope

### 1) Landing Page
Path:
`pages/underlying-stats/playerStats`

Purpose:
- Show a master table of player underlying stats
- Support multiple stat modes and filter dimensions
- Serve as the main entry point for player-level comparison

### 2) Player Detail Page
Path:
`pages/underlying-stats/playerStats/{playerId}`

Purpose:
- Show player-specific season logs
- Preserve the same general metric families and filter philosophy as the landing page
- Replace the Team filter with `Against Specific Team`

---

## User Stories

### Landing Page
- As a user, I want to compare players across seasons and stat views from one page.
- As a user, I want to switch between Individual, On-Ice, and Goalie views.
- As a user, I want to switch between Counts and Rates without losing the rest of my filter context.
- As a user, I want to sort any column to identify leaders quickly.
- As a user, I want to filter by strength and score state so I can isolate specific game environments.
- As a user, I want to compare by last X games played or by last X team games.
- As a user, I want traded-player stats either combined or split by team stint.

### Player Detail Page
- As a user, I want to click a player from the landing table and see that player’s season-by-season logs.
- As a user, I want similar filters on the player page so I can inspect the player under the same lens I used on the landing page.
- As a user, I want to swap the team context on the player page to `Against Specific Team`.

---

## Functional Requirements

## 1. Landing Page Filters

The landing page must expose the following primary controls:

### Primary Dropdowns
- From {season}
- Through {season}
- Season type:
  - Regular Season
  - Playoffs
  - Pre-Season
- Strength:
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
- Score state:
  - All scores
  - Tied
  - Leading
  - Trailing
  - Within 1
  - Up 1
  - Down 1
- Stat mode:
  - On-Ice
  - Individual
  - Goalies
- Display mode:
  - Counts
  - Rates

### Expandable Filters
- Team select
- Position group:
  - Skaters
  - Defensemen
  - Centers
  - Left Wings
  - Right Wings
  - Goalies
- Home or Away
- Minimum Time on Ice
- Date Range
- Game Range
- By Team Games
- Combine or Split traded-player handling

---

## 2. Filter Semantics

### Season Range
- Users must be able to choose a start season and end season.
- The page must support multi-season comparisons where applicable.

### Date Range
- Date range must apply only within the selected season span.
- The UI and query logic must prevent invalid date-season combinations.

### Game Range
- `Game Range` compares players using each player’s own last X games played.
- This is player-centric rolling scope.

### By Team Games
- `By Team Games` compares players over the last X games played by a team.
- If a player missed some of those team games, the range should still be defined by the team’s last X games, not the player’s last X appearances.
- This is team-centric rolling scope.

### Combine or Split
- `Combine` means aggregate a traded player’s stats into one row across all included teams.
- `Split` means show separate rows for each player-team stint.
- This behavior must work consistently across table modes and filters.

### Position Filters
- Position filters must correctly include or exclude players based on canonical roster position logic.
- Goalie mode must only show goalies.

### Minimum TOI
- Minimum TOI must work across counts and rates views.
- The implementation must define whether the threshold applies before or after aggregation and must do so consistently.

---

## 3. Table Modes and Required Columns

## A) Individual Counts
Columns:
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

## B) Individual Rates
Columns:
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

## C) On-Ice Counts
Columns:
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

## D) On-Ice Rates
Columns:
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

## E) Goalies Counts
Columns:
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

## F) Goalies Rates
Columns:
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

---

## 4. Sorting Requirements

- Every visible column must be sortable.
- Default sorting:
  - Individual Counts: Total Points descending
  - Individual Rates: Total Points/60 descending
  - On-Ice Counts: Total Points is not applicable, so implementation must define a sensible default or follow the skater-mode convention only where appropriate
  - On-Ice Rates: implementation must define a sensible default if Points/60 is not applicable
  - Goalies Counts: SV% descending
  - Goalies Rates: SV% descending

### Sorting Clarification Requirement
Because the user explicitly specified default sort rules for skaters and goalies, the implementation must document and apply a reasonable default sort for On-Ice modes if Total Points or Points/60 is not present in those views.

---

## 5. Player Hyperlink Behavior

- Every player name in the landing table must be a clickable hyperlink.
- Route target:
  `pages/underlying-stats/playerStats/{playerId}`
- The route must use a stable player identifier.
- The navigation should preserve relevant context where reasonable via query params or equivalent state.

---

## 6. Player Detail Page Requirements

The player detail page must:
- show player-specific season logs
- show one row per season
- preserve the same general filter philosophy as the landing page where appropriate
- replace the Team filter with `Against Specific Team`
- reuse the same stat-mode and display-mode logic where possible
- maintain sortable columns

The player page should feel like a natural continuation of the landing page, not a separate disconnected feature.

---

## Data and Query Requirements

## 1. Data Model Expectations
The feature must support:
- season-level filtering
- season-type filtering
- strength-state filtering
- score-state filtering
- player-level aggregation
- team-level and player-team-level grouping
- rolling game-window logic
- team-game-window logic
- combine/split traded-player behavior
- skater and goalie stat families
- both counts and rate stats

## 2. Query Design Expectations
The implementation must account for:
- large result sets
- wide tables
- sortable numeric columns
- filter combinations that meaningfully change aggregation scope
- consistent rate calculations
- position filtering
- player/team grouping logic
- player-specific page reuse

## 3. Source-of-Truth Expectations
The implementation must document where each metric comes from and how it is calculated or aggregated.
If any metric is approximated, derived, or not yet available from the current pipeline, that must be explicitly documented rather than hidden.

---

## UX Requirements

1. The page must make it easy to understand which mode and filters are active.
2. Expandable filters should not overwhelm the user by default.
3. The table must remain usable despite having many columns.
4. The page should support horizontal overflow gracefully.
5. Loading states must be clear.
6. Empty states must clearly explain when no data matches the filter combination.
7. Error states must be visible and actionable.
8. The filter set should support reset behavior.
9. Query-param or URL-state handling should be considered so views are shareable and state is recoverable.

---

## Performance Requirements

1. The table architecture must be designed for wide datasets.
2. The implementation must consider pagination, virtualization, or similar strategies for performance.
3. Expensive filters and sorts should be evaluated for whether they happen server-side, client-side, or through hybrid behavior.
4. The implementation should avoid unnecessary re-renders and repeated refetches.
5. Landing page and player page should share reusable table/filter abstractions where practical.

---

## Validation and Testing Requirements

The implementation must include tasks for validating:
- correct column rendering per mode
- correct filter interactions
- correct default sorting
- correct rate calculations
- correct handling of combine vs split for traded players
- correct handling of Game Range vs By Team Games
- correct position filtering
- correct hyperlink routing
- correct player detail rendering
- correct empty/loading/error states
- correct behavior for large result sets

Tests should cover both happy paths and edge cases.

---

## Edge Cases

The implementation must explicitly account for:
- traded players with multiple team stints
- players with partial seasons
- players with very low TOI
- players with zero values in denominator-sensitive rate stats
- players missing games in team-game windows
- empty result sets from narrow filters
- On-Ice modes lacking obvious default-sort stats from the skater rules
- season/date-range incompatibilities
- players whose listed positions complicate grouping
- goalie/skater mode mismatches

---

## Open Questions to Resolve During Task Generation

1. What should the default sort be for On-Ice Counts and On-Ice Rates?
2. Should pagination, infinite scroll, virtualization, or a hybrid be the default table strategy?
3. Which metrics already exist in the current pipeline versus requiring new aggregation work?
4. Which filters should sync to the URL?
5. Should some filters reset when stat mode changes between Individual, On-Ice, and Goalies?
6. How should multi-season player-detail rows behave if some filters are incompatible with season-log presentation?
7. What is the exact minimum TOI eligibility logic for Counts vs Rates?

These should not block PRD creation; they should become explicit tasks or implementation decisions.

---

## Success Criteria

The feature is successful when:
1. The landing page exists at `pages/underlying-stats/playerStats`.
2. Users can switch between Individual, On-Ice, and Goalie views.
3. Users can switch between Counts and Rates.
4. All required columns appear correctly for each mode.
5. All required filters are supported.
6. Every column is sortable.
7. Default sort behavior is implemented sensibly and documented.
8. Players link to `pages/underlying-stats/playerStats/{playerId}`.
9. The player detail page shows season-level logs and uses the adjusted filter model.
10. The implementation is performant enough for real usage and backed by tests.

---

## Recommended Output File

`tasks/prd-player-underlying-stats-landing-page.md`