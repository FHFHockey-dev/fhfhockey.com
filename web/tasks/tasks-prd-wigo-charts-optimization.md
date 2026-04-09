## Relevant Files

- `web/tasks/prd-wigo-charts-optimization.md` - Source PRD that defines the WiGO optimization scope and acceptance criteria.
- `web/pages/wigoCharts.tsx` - Main WiGO page that needs orchestration and layout refactoring.
- `web/pages/draft-dashboard.tsx` - Non-WiGO page updated to remove a build blocker discovered during parent-task validation.
- `web/hooks/useCurrentSeason.ts` - Shared season lookup hook that should be folded into a more coherent WiGO data-loading flow.
- `web/hooks/useWigoPlayerDashboard.ts` - Proposed new page-level data hook for selected player, season, branding, aggregates, and statuses.
- `web/hooks/useWigoPlayerDashboard.test.ts` - Unit tests for the new page-level WiGO data orchestration hook.
- `web/utils/fetchWigoPlayerStats.ts` - Core WiGO aggregate, totals, and stat drilldown fetch helpers that need normalization cleanup.
- `web/utils/fetchWigoPlayerStats.test.ts` - Unit tests for aggregate transforms, unit normalization, and fallback behavior.
- `web/utils/fetchWigoPercentiles.ts` - Percentile cohort fetch layer that should be optimized and aligned to a canonical stat contract.
- `web/utils/fetchWigoPercentiles.test.ts` - Unit tests for percentile fetch shaping and stat field mapping.
- `web/utils/fetchWigoRatingStats.ts` - Ratings data fetch layer that currently scans all strengths and should be optimized or cached.
- `web/utils/fetchWigoRatingStats.test.ts` - Unit tests for ratings fetch orchestration and result shaping.
- `web/utils/calculateWigoRatings.ts` - Ratings calculation engine that needs regression logic repair and threshold alignment.
- `web/utils/calculateWigoRatings.test.ts` - Unit tests for percentile weighting, regression behavior, and overall rating outputs.
- `web/utils/calculatePercentiles.ts` - Shared percentile and ordinal rank utilities that should become the single source for ranking behavior.
- `web/utils/calculatePercentiles.test.ts` - Unit tests for percentile and ranking semantics, including ties and filtered cohorts.
- `web/components/WiGO/types.ts` - WiGO shared types; likely home for stricter dashboard and stat metadata contracts.
- `web/components/WiGO/statMetadata.ts` - Proposed new stat metadata map for units, formatters, diff rules, and chart semantics.
- `web/components/WiGO/statMetadata.test.ts` - Unit tests for stat metadata completeness and formatting invariants.
- `web/components/WiGO/tableUtils.ts` - Diff and formatting helpers that should be refactored around explicit stat metadata.
- `web/components/WiGO/tableUtils.test.ts` - Unit tests for diff calculations, count/per-game comparisons, and display formatting.
- `web/components/WiGO/StatsTable.tsx` - Comparison table component that needs better expansion state, error resetting, and shared formatting behavior.
- `web/components/WiGO/StatsTable.test.tsx` - Component tests for table rendering, highlighted columns, drilldown expansion, and state resets.
- `web/components/WiGO/StatsTableRowChart.tsx` - Drilldown chart component with current percentage scaling and chart consistency issues.
- `web/components/WiGO/StatsTableRowChart.test.tsx` - Component tests for drilldown chart formatting, average lines, and empty/error states.
- `web/components/WiGO/PerGameStatsTable.tsx` - Per-game summary table with percentage formatting issues and repeated fetch behavior.
- `web/components/WiGO/PerGameStatsTable.test.tsx` - Component tests for per-game rendering and stat formatting consistency.
- `web/components/WiGO/RateStatPercentiles.tsx` - Rate percentile panel that should share canonical ranking logic and optimized data access.
- `web/components/WiGO/RateStatPercentiles.test.tsx` - Component tests for threshold filtering, rank display, and loading/error handling.
- `web/components/WiGO/PlayerRatingsDisplay.tsx` - Ratings panel that needs min-GP alignment and fetch optimization.
- `web/components/WiGO/PlayerRatingsDisplay.test.tsx` - Component tests for ratings states, thresholds, and final value rendering.
- `web/components/WiGO/ConsistencyChart.tsx` - WiGO consistency chart that should adopt shared chart shell and normalized data semantics.
- `web/components/WiGO/ConsistencyChart.test.tsx` - Component tests for consistency distribution rendering and empty/error states.
- `web/components/WiGO/ToiLineChart.tsx` - TOI chart that should move to shared chart shell and standardized formatting.
- `web/components/WiGO/ToiLineChart.test.tsx` - Component tests for TOI and PP TOI% view formatting and chart states.
- `web/components/WiGO/PpgLineChart.tsx` - Points-per-game trend chart that should adopt the shared chart shell and formatting rules.
- `web/components/WiGO/PpgLineChart.test.tsx` - Component tests for rolling averages, placeholders, and tooltip behavior.
- `web/components/WiGO/GameScoreSection.tsx` - Section wrapper that should be aligned to shared WiGO card composition.
- `web/components/WiGO/GameScoreLineChart/index.tsx` - Existing React Query-based chart that can guide standardization for WiGO data fetching.
- `web/components/WiGO/GameScoreLineChart/index.test.tsx` - Component tests for Game Score data loading and chart shell states.
- `web/components/WiGO/NameSearchBar.tsx` - Player search component that should simplify async state and selection behavior.
- `web/components/WiGO/NameSearchBar.test.tsx` - Component tests for search debounce, selection, keyboard navigation, and dropdown states.
- `web/components/WiGO/PlayerHeader.tsx` - Player header that should be upgraded off `next/legacy/image` and aligned to shared card composition.
- `web/components/WiGO/OpponentGamelog.tsx` - Schedule section that should reuse shared page-level season/team context where possible.
- `web/components/WiGO/TimeframeComparison.tsx` - Timeframe selector that should remain aligned to comparison table state after refactor.
- `web/components/WiGO/WigoDashboardSections.tsx` - Shared overview/trends/percentiles/comparison section components that remove duplicated page JSX.
- `web/components/WiGO/WigoSectionCard.tsx` - Proposed shared card/shell wrapper for WiGO sections.
- `web/components/WiGO/WigoSectionCard.test.tsx` - Component tests for shared WiGO shell loading, error, empty, and toolbar states.
- `web/components/CategoryCoverageChart/CategoryCoverageChart.tsx` - Adjacent percentile surface that should be evaluated for contract alignment with the rest of WiGO.
- `web/styles/wigoCharts.module.scss` - Shared WiGO page stylesheet that should be simplified after composition cleanup.

### Notes

- Unit tests should typically be placed alongside the code files they are testing.
- Use `npx jest [optional/path/to/test/file]` to run focused tests during implementation.
- The new WiGO task list assumes the existing `web/tasks/` directory remains the canonical place for PRDs and task lists in this repo.
- Favor introducing shared stat metadata and shared data hooks before editing multiple WiGO view components in parallel.

## Tasks

- [x] 1.0 Define the canonical WiGO data contract and stat metadata layer
  - [x] 1.1 Inventory every stat displayed across WiGO tables and charts, including label, source field, unit, chart unit, display unit, and diff strategy.
  - [x] 1.2 Create a shared stat metadata module that defines formatter rules, count-vs-rate semantics, percentage scaling behavior, and drilldown chart behavior.
  - [x] 1.3 Refactor `tableUtils.ts` to consume the shared stat metadata instead of relying primarily on hard-coded label sets.
  - [x] 1.4 Normalize TOI, PP TOI, and percentage handling in `fetchWigoPlayerStats.ts` so each value is transformed exactly once before reaching presentation components.
  - [x] 1.5 Add unit tests covering diff calculation, count-per-game comparison rules, percentage formatting, TOI formatting, and missing-data fallbacks.

- [x] 2.0 Build a shared WiGO page data layer and remove redundant fetch orchestration
  - [x] 2.1 Create a page-level WiGO dashboard hook or provider that resolves selected player, team branding, current season, aggregate table data, and shared loading/error states.
  - [x] 2.2 Move player-selection URL syncing, auto-load-by-`playerId`, and aggregate fetch orchestration out of `wigoCharts.tsx` into the shared data layer.
  - [x] 2.3 Rework components that currently rediscover the same player/season context so they consume shared data or shared queries instead of independent local fetch flows.
  - [x] 2.4 Standardize WiGO data fetching on one query pattern, using React Query-compatible cache keys where repeated season/player lookups exist.
  - [x] 2.5 Add tests for the shared WiGO dashboard hook covering player switching, season readiness, error propagation, and stale-data prevention.

- [x] 3.0 Repair percentile and ratings accuracy while reducing heavy client-side cohort work
  - [x] 3.1 Refactor `calculatePercentiles.ts`, `RateStatPercentiles.tsx`, and related helpers so percentile rank and ordinal rank share one authoritative calculation path.
  - [x] 3.2 Ensure the active `minGp` threshold is either applied consistently to ratings calculations or removed from the ratings UI contract if it should not affect ratings.
  - [x] 3.3 Rebuild low-GP regression in `calculateWigoRatings.ts` so regression means are computed from finalized comparison cohorts rather than partially built intermediate state.
  - [x] 3.4 Optimize `fetchWigoPercentiles.ts` and `fetchWigoRatingStats.ts` by introducing shared cache reuse, thinner payloads, or a server-backed aggregation path for season-wide datasets.
  - [x] 3.5 Add unit tests for percentile ties, filtered cohorts, low-GP regression cases, and overall/offense/defense rating composition.

- [x] 4.0 Refactor WiGO layout into shared section components and standardized chart shells
  - [x] 4.1 Break `wigoCharts.tsx` into reusable section components so desktop and mobile reuse the same rendered content instead of duplicating large JSX blocks.
  - [x] 4.2 Introduce a shared WiGO section card or chart shell component with consistent title, toolbar, loading, empty, and error treatments.
  - [x] 4.3 Update TOI, PPG, Game Score, Consistency, and stat drilldown charts to use the shared shell and unified formatting behavior.
  - [x] 4.4 Replace `next/legacy/image` usage in `PlayerHeader.tsx` with the modern Next image approach while preserving remote headshots and placeholders.
  - [x] 4.5 Simplify `NameSearchBar.tsx` async state handling and verify keyboard, blur, and selection behavior remain correct after the page refactor.

- [x] 5.0 Harden table and drilldown interactions for correctness and maintainability
  - [x] 5.1 Update `StatsTable.tsx` so expanding one stat correctly resets stale game-log errors and loading state before fetching the next stat.
  - [x] 5.2 Ensure `StatsTableRowChart.tsx` uses canonical stat formatting rules and cannot double-scale percentages or mis-handle TOI conversions.
  - [x] 5.3 Review `TimeframeComparison.tsx` and comparison-table highlighting logic so visible columns, diff columns, and drilldown context stay in sync on desktop and mobile.
  - [x] 5.4 Align `PerGameStatsTable.tsx` with the canonical stat metadata so summary values match the comparison table and trend charts.
  - [x] 5.5 Add focused component tests for table expansion, comparison highlighting, stat drilldown formatting, and per-game summary correctness.

- [ ] 6.0 Clean up WiGO technical debt and verify the full page end-to-end
  - [ ] 6.1 Remove stale comments, dead branches, old machine path remnants, and unused imports across the WiGO code path touched by this PRD.
  - [ ] 6.2 Confirm `CategoryCoverageChart.tsx` is either aligned with the new WiGO stat contract or explicitly documented as a separate percentile source.
  - [ ] 6.3 Add integration-level verification for representative forwards and defensemen with different GP levels, usage profiles, and missing-data scenarios.
  - [ ] 6.4 Run targeted Jest suites for transformed utilities and WiGO components, then fix any regressions introduced by the refactor.
  - [ ] 6.5 Perform manual desktop and mobile verification of section order, tab behavior, chart states, and cross-surface stat consistency on `/wigoCharts`.
