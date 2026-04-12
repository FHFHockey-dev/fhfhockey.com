# PRD: WiGO Charts Optimization

## 1. Introduction / Overview
The current WiGO Charts experience in [wigoCharts.tsx](/Users/tim/Code/fhfhockey.com/web/pages/wigoCharts.tsx) delivers a wide set of player evaluation views, but the page has grown into a tightly coupled client-side dashboard with repeated data fetching, inconsistent stat normalization, duplicated desktop/mobile layouts, and chart components that independently recompute overlapping player-season context.

This project will optimize WiGO Charts for accuracy, efficiency, maintainability, and presentation quality. The goal is to keep the existing product scope intact while rebuilding the page around shared data contracts, consistent stat semantics, better caching, and a cleaner component architecture.

This PRD is based on an audit of the current upstream WiGO path, including:
- [wigoCharts.tsx](/Users/tim/Code/fhfhockey.com/web/pages/wigoCharts.tsx)
- [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts)
- [fetchWigoPercentiles.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPercentiles.ts)
- [fetchWigoRatingStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoRatingStats.ts)
- [calculateWigoRatings.ts](/Users/tim/Code/fhfhockey.com/web/utils/calculateWigoRatings.ts)
- [StatsTable.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/StatsTable.tsx)
- [StatsTableRowChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/StatsTableRowChart.tsx)
- [PerGameStatsTable.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PerGameStatsTable.tsx)
- [RateStatPercentiles.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/RateStatPercentiles.tsx)
- [PlayerRatingsDisplay.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PlayerRatingsDisplay.tsx)
- [ConsistencyChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/ConsistencyChart.tsx)
- [ToiLineChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/ToiLineChart.tsx)
- [PpgLineChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PpgLineChart.tsx)
- [GameScoreLineChart/index.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/GameScoreLineChart/index.tsx)
- [NameSearchBar.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/NameSearchBar.tsx)
- [OpponentGamelog.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/OpponentGamelog.tsx)
- [PlayerHeader.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PlayerHeader.tsx)
- [TimeframeComparison.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/TimeframeComparison.tsx)
- [tableUtils.ts](/Users/tim/Code/fhfhockey.com/web/components/WiGO/tableUtils.ts)
- [useCurrentSeason.ts](/Users/tim/Code/fhfhockey.com/web/hooks/useCurrentSeason.ts)

## 2. Goals
- Reduce duplicated player and season fetch work across the WiGO page by introducing shared data loading and cache reuse.
- Eliminate known stat normalization ambiguity so every displayed number has one authoritative unit and one calculation path.
- Make percentile and rating outputs reproducible and auditable from source data.
- Simplify the page architecture so desktop and mobile views reuse the same content model instead of duplicating large render trees.
- Improve chart responsiveness, empty states, loading states, and interaction consistency.
- Define a testable contract for WiGO data transforms so future stat changes do not silently break the UI.

## 3. User Stories
- As a fantasy hockey user, I want WiGO charts to load quickly after I select a player so I can compare players without waiting on repeated fetches.
- As a power user, I want stat values and percentiles to be trustworthy so I can make roster decisions from the page.
- As a mobile user, I want the same data and interactions as desktop without tabs feeling like a separate implementation.
- As an internal maintainer, I want WiGO data transforms centralized and typed so I can add or change metrics safely.
- As a junior developer, I want the WiGO page broken into clear data and presentation layers so I can work on one section without breaking unrelated charts.

## 4. Audit Findings

### 4.1 Architecture
- The page component owns too much orchestration: player search, router sync, team branding, aggregate fetch, tab state, and duplicated desktop/mobile rendering all live in [wigoCharts.tsx](/Users/tim/Code/fhfhockey.com/web/pages/wigoCharts.tsx).
- Desktop and mobile views duplicate large blocks of JSX instead of composing shared section components.
- Multiple child components independently fetch overlapping season and player data instead of consuming a shared WiGO page model.

### 4.2 Data Efficiency
- WiGO uses a mix of raw Supabase client calls, ad hoc fetch helpers, and React Query in only one subsection, leading to inconsistent caching behavior.
- [PlayerRatingsDisplay.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PlayerRatingsDisplay.tsx) refetches all strength tables for the entire season on each player change.
- [RateStatPercentiles.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/RateStatPercentiles.tsx) fetches all-player percentile tables by strength on the client and recalculates rankings locally.
- [StatsTable.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/StatsTable.tsx) fetches per-stat game logs on expand, but does not reset previous chart errors before a new fetch and stores only one expanded chart payload.

### 4.3 Accuracy Risks
- [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts) mixes comments such as “assuming” and “double check source data” into live normalization logic, which means some units are not contractually defined.
- Percentage conversion is inconsistent across sources. For example, some helpers convert decimal percentages to 0-100 while others format values as though they are still decimals.
- [PerGameStatsTable.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PerGameStatsTable.tsx) multiplies `shooting_percentage` by 100 even though other WiGO surfaces may already treat the value as display-ready.
- [StatsTableRowChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/StatsTableRowChart.tsx) multiplies percent values by 100 again in chart labels, which can display incorrect values if upstream transforms already scaled them.
- [calculateWigoRatings.ts](/Users/tim/Code/fhfhockey.com/web/utils/calculateWigoRatings.ts) attempts low-GP regression using percentile values that are not yet fully computed for the comparison cohort, so the regression mean can be based on partial or wrong state.
- The ratings panel accepts `minGp` but the prop is currently unused in [PlayerRatingsDisplay.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PlayerRatingsDisplay.tsx), so the UI implies a threshold relationship that does not exist.

### 4.4 UX / Layout Risks
- Loading and empty states vary by chart and are implemented with a mix of overlays, placeholders, and raw text.
- Several chart components use inline styles and bespoke options instead of shared WiGO chart theming.
- The page still uses `next/legacy/image` in [PlayerHeader.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PlayerHeader.tsx).
- Search interaction in [NameSearchBar.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/NameSearchBar.tsx) relies on multiple local guards and side effects instead of a clearer async search state model.

### 4.5 Code Quality / Maintainability Risks
- There are stale comments, path remnants from old machines, and “adjust path” notes throughout the WiGO stack.
- Some imports are unused or vestigial, and several components contain commented-out logic that obscures the active behavior.
- Chart stacks are inconsistent: WiGO uses Chart.js, Recharts, raw RPC data shaping, and manual canvas label plugins in adjacent components.

## 5. Functional Requirements
1. The system must introduce a single WiGO page-level data layer that resolves the selected player, current season, team branding, and core aggregate stat payload once per player selection.
2. The system must replace repeated child-level fetching of overlapping player-season metadata with shared cached selectors or hooks.
3. The system must define and document an authoritative unit contract for each WiGO stat family:
   counts, per-game, per-60, raw percentages, display percentages, TOI seconds, and TOI minutes.
4. The system must normalize each stat exactly once before it reaches chart and table presentation components.
5. The system must refactor the aggregate comparison table so `DIFF` calculations are based on explicit stat metadata rather than hard-coded label lists only.
6. The system must ensure all percentage displays use a single formatting rule and cannot be double-scaled by downstream components.
7. The system must refactor rate percentile calculations so the selected player threshold, cohort filtering, percentile rank, and ordinal rank use one shared implementation.
8. The system must make the ratings panel honor the active minimum games threshold or remove the threshold dependency from that panel.
9. The system must redesign the ratings regression flow so the regression cohort and regression mean are computed from finalized comparison values, not partially built intermediate state.
10. The system must consolidate desktop and mobile WiGO content into shared section components so the same data and section logic render in both layouts.
11. The system must provide a shared chart shell for loading, error, empty, and toolbar states across WiGO charts.
12. The system must standardize chart theming, tooltip formatting, axis formatting, and color semantics across TOI, PPG, Game Score, percentile, consistency, and stat drilldown charts.
13. The system must upgrade player imagery to the non-legacy Next image API where feasible without breaking remote image behavior.
14. The system must reduce client-side all-player Supabase scans where possible by moving heavy percentile and rating aggregation behind reusable cached queries or server endpoints.
15. The system must add regression-safe and formatting-safe tests for aggregate transforms, percentile calculations, rating calculations, and stat display formatting.
16. The system must preserve the existing public route, major WiGO sections, and player selection workflow so the page remains familiar to current users.
17. The system must log or surface fetch failures consistently without leaving stale prior-player data visible as though it belongs to the current player.
18. The system must define a clear WiGO section order and responsive layout model so sections can be rearranged without duplicating markup.

## 6. Non-Goals (Out of Scope)
- This project will not redesign the full WiGO visual identity from scratch.
- This project will not add brand-new analytics sections beyond the current WiGO feature set.
- This project will not replace all charts in the wider application outside WiGO.
- This project will not rework the underlying database schemas unless a small compatibility change is required to support the optimized WiGO data contract.
- This project will not build a new player search system for the whole site; only the WiGO search experience is in scope.

## 7. Design Considerations
- Preserve the current WiGO mental model:
  player search, player card, per-game summary, opponent log, ratings, trend charts, percentile charts, and comparison table.
- Reduce visual clutter by turning each WiGO panel into a shared card pattern with:
  title row, optional controls, content body, and consistent status state.
- Mobile should not be a copy of desktop. Mobile should render the same section components inside a tabbed or stacked navigation shell.
- The comparison table should remain dense but should improve legibility through consistent header highlighting, fixed stat labels, and clearer drilldown affordances.
- Chart labels and tooltips should use one numeric formatting system so a stat reads the same in bars, tables, and tooltips.

## 8. Technical Considerations

### 8.1 Proposed Architecture
- Create a WiGO page container hook, for example `useWigoPlayerDashboard`, that returns:
  selected player context, season context, team context, aggregate table data, totals data, and fetch statuses.
- Split WiGO into section components that receive typed data instead of fetching internally where practical.
- Use one query library pattern consistently. Since [GameScoreLineChart/index.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/GameScoreLineChart/index.tsx) already uses React Query, the preferred direction is to standardize on React Query for WiGO fetches.

### 8.2 Data Contracts
- Introduce stat metadata describing:
  label, source key, stat family, display unit, chart unit, diff strategy, and formatter.
- Remove ambiguous “assuming” conversions from live fetch helpers and encode those decisions in typed metadata or documented adapters.
- Distinguish raw source values from display-ready values. A component should never guess whether a percentage is decimal or 0-100.

### 8.3 Heavy Query Areas
- [fetchRawStatsForAllStrengths](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoRatingStats.ts) and [fetchAllPlayerStatsForStrength](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPercentiles.ts) are the largest client-side cost centers.
- Prefer one of these approaches:
  1. Server endpoint returning pre-ranked percentile/rating payloads.
  2. Shared cached query keyed by season and strength.
  3. Precomputed table or materialized view if the current percentile tables are still too heavy.

### 8.4 Testing Targets
- Unit tests for `computeDiffColumn`, percentage formatting, TOI conversions, percentile ranking, rating regression, and per-game fallbacks.
- Component tests for comparison table expansion, min GP threshold behavior, and chart empty/loading/error state handling.
- Optional snapshot or story coverage for shared WiGO section cards and chart shell states.

## 9. Success Metrics
- WiGO initial player load triggers fewer duplicate network/database requests than the current implementation.
- All WiGO stat surfaces show consistent values for the same metric across table, chart, and tooltip contexts.
- Ratings and percentile outputs are reproducible from test fixtures without hidden scaling corrections.
- The WiGO page has no duplicated desktop/mobile section logic for the major content blocks.
- Junior developers can trace a WiGO metric from source fetch to final display through one documented transform path.
- Post-refactor regressions are caught by automated tests for transforms and critical components.

## 10. Proposed Implementation Phases

### Phase 1: Data Contract and Audit Lock-In
- Inventory each displayed WiGO stat and define its canonical unit and formatter.
- Add a stat metadata map and remove scattered label-based assumptions where possible.
- Document unresolved source-of-truth questions before UI refactors begin.

### Phase 2: Shared Data Layer
- Build a shared WiGO dashboard hook or provider.
- Centralize selected player, season, totals, and aggregate table fetches.
- Migrate child components off redundant fetch patterns where the data overlaps.

### Phase 3: Accuracy Repairs
- Fix percentage scaling and TOI conversion inconsistencies.
- Rework percentile and rating calculations to use explicit cohort contracts.
- Ensure `minGp` behavior is correct and visible wherever the UI exposes it.

### Phase 4: UI Composition and Layout Cleanup
- Extract shared section components used by both desktop and mobile.
- Create a shared chart shell and standardize status states.
- Replace legacy image usage and remove stale comments and dead branches.

### Phase 5: Verification
- Add unit and component test coverage.
- Validate a representative set of players across positions and usage profiles.
- Confirm mobile and desktop parity for section order, data, and interactions.

## 11. Open Questions
- Should WiGO ratings respect the same `minGp` slider as rate percentiles, or should ratings use a separate internal threshold model?
- Do we want percentile and rating heavy calculations to remain client-side if cache reuse is good enough, or should they move behind a dedicated API immediately?
- Should the comparison drilldown chart continue using Recharts while the rest of WiGO uses Chart.js, or should WiGO converge on one charting library?
- Is the existing `CategoryCoverageChart` percentile source the intended long-term percentile source for WiGO, or should it also be aligned to the new WiGO percentile data contract?
- Should WiGO keep the current tab names and section grouping on mobile, or should mobile be reorganized after the shared-section refactor is complete?

## 12. Relevant Files
- [wigoCharts.tsx](/Users/tim/Code/fhfhockey.com/web/pages/wigoCharts.tsx)
- [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts)
- [fetchWigoPercentiles.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPercentiles.ts)
- [fetchWigoRatingStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoRatingStats.ts)
- [calculateWigoRatings.ts](/Users/tim/Code/fhfhockey.com/web/utils/calculateWigoRatings.ts)
- [calculatePercentiles.ts](/Users/tim/Code/fhfhockey.com/web/utils/calculatePercentiles.ts)
- [tableUtils.ts](/Users/tim/Code/fhfhockey.com/web/components/WiGO/tableUtils.ts)
- [StatsTable.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/StatsTable.tsx)
- [StatsTableRowChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/StatsTableRowChart.tsx)
- [PerGameStatsTable.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PerGameStatsTable.tsx)
- [RateStatPercentiles.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/RateStatPercentiles.tsx)
- [PlayerRatingsDisplay.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PlayerRatingsDisplay.tsx)
- [ConsistencyChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/ConsistencyChart.tsx)
- [ToiLineChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/ToiLineChart.tsx)
- [PpgLineChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PpgLineChart.tsx)
- [GameScoreLineChart/index.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/GameScoreLineChart/index.tsx)
- [NameSearchBar.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/NameSearchBar.tsx)
- [PlayerHeader.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PlayerHeader.tsx)
- [OpponentGamelog.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/OpponentGamelog.tsx)
- [TimeframeComparison.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/TimeframeComparison.tsx)
- [useCurrentSeason.ts](/Users/tim/Code/fhfhockey.com/web/hooks/useCurrentSeason.ts)

## 13. Assumptions
- The current WiGO feature scope and route remain publicly available.
- Existing Supabase tables remain the source of truth for WiGO until a new server endpoint or precomputation layer is introduced.
- The first milestone is optimization and correctness, not a net-new feature expansion.
