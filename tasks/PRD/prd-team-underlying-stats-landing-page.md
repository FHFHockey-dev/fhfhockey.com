# PRD: Team Underlying Stats Landing Page

## Document Status
- Status: Draft, curated for task-list generation
- Owner: TBD
- Primary audience: junior developer implementing the feature and AI assistant generating the task list
- Intended follow-up artifact: `tasks/tasks-prd-team-underlying-stats-landing-page.md`

## Introduction and Overview
Build a production-ready team underlying-stats experience with:
- a landing page at `pages/underlying-stats/teamStats`
- (Optional/TBD) a team detail page at `pages/underlying-stats/teamStats/{teamId}`

The landing page must let users compare NHL teams across Counts and Rates, season scopes, strength states, score states, and rolling windows. It will match the design and filter philosophy of the `playerStats` and `goalieStats` pages to ensure continuity.

## Problem Statement
While users can analyze individual player and goalie underlying metrics, there is no unified dashboard to evaluate team-level performance metrics (Counts and Rates) under specific context filters (strength, score state). A dedicated team metrics page is needed to provide this macro-level view using the exact same robust filtering system as the player and goalie pages.

## Goals
1. Create a single landing page where users can evaluate teams across comprehensive underlying-stat views.
2. Support filtering by season type, strength state, score state, team, opponent, home/away, minimum TOI, date range, game range, and team-game range.
3. Support two main table families: Team Counts and Team Rates.
4. Provide parity with `playerStats` and `goalieStats` in layout, table behavior, and URL state sync.
5. Create necessary Supabase tables for aggregated team data.
6. Build API catch-up and backfill logic specific to team stats (similar to `catch-up-player-underlying.ts`).

## User Stories
- As an analytics user, I want to compare teams across Counts and Rates so I can evaluate total production vs per-60 production.
- As a user, I want to filter team stats by strength and score state to understand performance in specific game environments (e.g., 5v5 Tied).
- As a user, I want to filter by an opponent to see how all teams perform against a specific team.
- As a user, I want to filter by Date Range or Game Range to see recent team trends.
- As a user, I want every column to be sortable so I can easily identify league leaders in any specific metric.

## Functional Requirements

### 1. Routes and Pages
1. The system must provide a landing page at `pages/underlying-stats/teamStats`.
2. The page must share the unified UI/UX layout seen in `playerStats` and `goalieStats` (`index.tsx`).

### 2. Primary Controls
3. The landing page must expose the following primary controls:
   - `From {season}`
   - `Through {season}`
   - Season type (Regular Season, Pre-Season, Playoffs)
   - Strength state (All Strengths, 5v5, Even Strength, Power Play, 5 on 4 Power Play, Penalty Kill, 4 on 5 PK, 3 on 3, w/Empty Net, Against Empty Net)
   - Score state (All Scores, Tied, Up 1, Leading, Down 1, Trailing, within 1)
   - Display mode (Counts, Rates)

### 3. Expandable Filters
4. Expandable filters must include:
   - Team
   - Opponent Filter (All teams data *against* a specific team)
   - Home or Away
   - Minimum Time on Ice (TOI)
   - Date Range
   - Game Range
   - Team Game Range

### 4. Table Families and Columns
5. The landing page must render the correct column set for the active display mode.
6. **Team Counts** must show these columns:
   `Rank, Team, GP, TOI, W, L, OTL, ROW, Points, Point %, CF, CA, CF%, FF, FA, FF%, SF, SA, SF%, GF, GA, GF%, xGF, xGA, xGF%, SCF, SCA, SCF%, SCSF, SCSA, SCSF%, SCGF, SCGA, SCGF%, SCSH%, SCSV%, HDCF, HDCA, HDCF%, HDSF, HDSA, HDSF%, HDGF, HDGA, HDGF%, HDSH%, HDSV%, MDCF, MDCA, MDCF%, MDSF, MDSA, MDSF%, MDGF, MDGA, MDGF%, MDSH%, MDSV%, LDCF, LDCA, LDCF%, LDSF, LDSA, LDSF%, LDGF, LDGA, LDGF%, LDSH%, LDSV%, SH%, SV%, PDO`
7. **Team Rates** must show these columns:
   `Rank, Team, GP, TOI/GP, W, L, OTL, ROW, Points, Point %, CF/60, CA/60, CF%, FF/60, FA/60, FF%, SF/60, SA/60, SF%, GF/60, GA/60, GF%, xGF/60, xGA/60, xGF%, SCF/60, SCA/60, SCF%, SCSF/60, SCSA/60, SCSF%, SCGF/60, SCGA/60, SCGF%, SCSH%, SCSV%, HDCF/60, HDCA/60, HDCF%, HDSF/60, HDSA/60, HDSF%, HDGF/60, HDGA/60, HDGF%, HDSH%, HDSV%, MDCF/60, MDCA/60, MDCF%, MDSF/60, MDSA/60, MDSF%, MDGF/60, MDGA/60, MDGF%, MDSH%, MDSV%, LDCF/60, LDCA/60, LDCF%, LDSF/60, LDSA/60, LDSF%, LDGF/60, LDGA/60, LDGF%, LDSH%, LDSV%, SH%, SV%, PDO`

### 5. Data Pipeline & Backend
8. **Supabase Tables:** The database must include bespoke tables for Team data to store aggregated metrics, distinct from player or goalie tables.
9. **API Endpoints:** Implement a team-specific backfill/catch-up logic endpoint (e.g., `catch-up-team-underlying.ts` and `backfill-team-underlying-season.ts`) mirroring the design of `catch-up-player-underlying.ts`.

### 6. State Behavior & Sorting
10. All data-shaping filters must sync to the URL.
11. Every visible column must be sortable ascending and descending.
12. Default sorting logic must be defined (e.g., Points or xGF%).

## Non-Goals
1. Visualizations/charts are excluded from this initial landing page scope.
2. Generating individual game-log tables for teams is deferred unless a Team Detail route is explicitly scoped in later tasks.

## Design and Technical Considerations
- **Continuity:** The page layout, filter UI components, loading states, and empty states must mirror `playerStats` and `goalieStats` perfectly. The component `PlayerUnderlyingStatsLandingPage` should ideally be refactored or wrapped to elegantly support `variant="team"`.
- **Scalability:** Just like the player tables, handle wide columns gracefully with horizontal scrolling and sticky identifier columns.

## Success Metrics
1. The `pages/underlying-stats/teamStats` route is live and renders Team data accurately.
2. Users can seamlessly switch between Counts and Rates without breaking active filters.
3. The new backend catch-up scripts populate the bespoke team tables without degrading existing player/goalie data pipelines.

## Open Questions
1. Do we need a dedicated `teamStats/{teamId}` detail page right now, or is the landing table sufficient for v1?
2. What should the default sort column be? (Assuming `Points` or `xGF%` until confirmed).
3. Should selecting a Team and an Opponent explicitly trigger a Head-to-Head query?