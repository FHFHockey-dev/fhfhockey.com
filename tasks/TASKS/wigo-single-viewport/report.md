# WiGO implementation and verification

## Result

The wide desktop route uses three bands: eight summary groups, the full comparison matrix, and three bottom regions. All C01–C19 remain mounted together at 1920×1080. The matrix has 37 columns (period + 36 canonical metrics), seven source rows (252 value cells), and one DIFF row (36 slots). Selected metrics update a reserved game-log region; GP is not selectable. Both timeframe selectors and all seven reference controls remain available.

The measured allocation is 260px for summaries, 280px for the matrix, and 396px for the bottom region, with compact navigation and search above. This adjusts the brief's starting budget to leave usable chart space. No scale transform, column pagination or scroll-based desktop workaround was introduced.

Pace uses the original unrounded counting rate × 84 with existing whole-count rounding. Actual totals are unchanged. GP and shooting percentage are not projected. DIFF continues to use `(left − right) / abs(right) × 100`, with count metrics normalized by GP and direct comparisons for rates, times and percentages. Zero/missing baselines retain the existing unavailable rules.

## Evidence

- `evidence/desktop-1920x1080.png`: viewport-only live-data capture. The live radar source returned unavailable; other panels show real sources, including the percentile fallback season.
- `evidence/desktop-radar-fixture-1920x1080.png`: viewport-only interaction-test capture. Only the radar cohort is explicitly fixture data; this proves eight-axis rendering and scale labels despite the live RPC timeout. It is not a production-data screenshot for radar values.
- `evidence/edge-states-1920x1080.png`: long name, absent portrait/bio/radar, individual 0–7 point buckets, and empty selected-stat log.
- `evidence/narrow-1440x900.png`, `narrow-1024x768.png`, `narrow-390x844.png`: existing narrower access. These are not claims of single-viewport parity.
- `evidence/viewport-measurements.json`: browser measurements for the populated desktop interaction state.

The desktop images were visually inspected. Automated assertions check document dimensions, all 19 coverage regions, panel bounds, element overflow, table text clipping, and essential DOM/canvas text at least 12px. Browser content is 1920×1080 at device scale factor 1 with no zoom adjustment.

## C01–C19 coverage

| ID | Location and preserved behavior | Verification |
| --- | --- | --- |
| C01 | Existing navigation; compact WiGO/search/selection toolbar | Search keyboard selection, Clear focus, player URL, viewport/font checks |
| C02 | Top identity: portrait, team branding, full name, number, position | Live capture and long-name/missing-image fixture |
| C03 | Identity bio: age, height, weight, position | Live capture; absent fields remain unavailable |
| C04 | Season points/goals/assists/shots totals and rates | Source season visible; totals tests and capture |
| C05 | Ten-row per-game/84-game pace summary | Raw-rate projection tests, zero/missing-data tests; keyboard-accessible methodology disclosure |
| C06 | Team schedule window | Existing schedule component/calculations retained; live viewport capture |
| C07 | Nine offense/defense/overall ratings | Existing rating tests; nine visible rows; methodology/cohort disclosure |
| C08 | Team 5v5 chance generation | Real value, percentile and assessment; explanation disclosure |
| C09 | Team 5v5 chance suppression | Real value and lower-is-better semantics retained |
| C10 | Team finishing versus expectation | Real GF/xGF value and relative assessment retained |
| C11 | Team special teams | Both PP% and PK%, combined percentile, dates and explanation retained |
| C12 | Full-width 36-metric matrix | Exact header order/252+36 mapping tests; both selectors and L/R text markers; same-row selection |
| C13 | Permanent bottom-left selected-stat log | Metric changes preserve region bounds; seven toggles, date axis, hover; empty/error/history fixtures; time units corrected |
| C14 | Point consistency | Live distribution; fixture with individual 0–7 buckets; GP denominator; Cardio separate; incomplete inputs explicitly unavailable |
| C15 | Eight-axis radar | Fixture-rendered labels/0–100 scale/font checks; actual cohort/season label; live source failure preserved as unavailable |
| C16 | TOI/PPTOI% chart | Mode switch; brush zoom, Shift-drag pan, reset; canvas changes and restoration asserted |
| C17 | Points/game chart | Bars, 5/10-game means, average, dates retained; zoom/pan/reset canvas assertions |
| C18 | Game Score chart | Separate signed plot, 5/10-game means, model disclosure; zoom/pan/reset canvas assertions |
| C19 | Sixteen percentile tiles | Sixteen visible meters/ranks; four strength filters and minimum GP; existing low-GP/fallback tests; requested/applied season visible |

## Changed application files

Paths below are relative to `web/`.

- Composition: `pages/wigoCharts.tsx`, `styles/wigoCharts.module.scss`, `components/WiGO/WigoDashboardSections.tsx`, new `components/WiGO/WigoComparisonMatrix.tsx`.
- Scoped shell: `components/Layout/Layout.tsx`, `Layout.module.scss`, `components/Layout/Header/Header.tsx`, `Header.module.scss`.
- Identity/search/summary: `components/WiGO/NameSearchBar.tsx`, `PlayerHeader.tsx`, `PerGameStatsTable.tsx`, `PerGameStatsTable.module.scss`, `OpponentGameLog.module.scss`, `PlayerRatingsDisplay.tsx`, `PlayerRatingsDisplay.module.scss`, `TeamPerformanceDrivers.tsx`, `TeamPerformanceDrivers.module.scss`, `TimeframeComparison.module.scss`.
- Charts: `components/WiGO/StatsTableRowChart.tsx`, `ConsistencyChart.tsx`, `ToiLineChart.tsx`, `PpgLineChart.tsx`, `GameScoreSection.tsx`, `GameScoreLineChart/index.tsx`, `GameScoreLineChart/RollingAverageChart.tsx`, `RateStatPercentiles.tsx`, `components/CategoryCoverageChart/CategoryCoverageChart.tsx`, `CategoryCoverageChart.module.scss`.
- Source/format safeguards: `components/WiGO/statMetadata.ts`, `hooks/usePercentileRank.ts`, `utils/fetchWigoPlayerStats.ts`.
- Verification: existing `StatsTable.test.tsx`, `StatsTableRowChart.test.tsx`, `PerGameStatsTable.test.tsx`, `tableUtils.test.ts`, `hooks/usePercentileRank.test.tsx`, `utils/fetchWigoPlayerStats.test.ts`; new `e2e/wigo-single-viewport.spec.ts`.

## Checks actually run

- **Passed:** eight targeted Vitest files, 25 tests: matrix/table, selected-stat references, projection, DIFF, metadata, radar hook, stat-log queries and search. A subsequent three-file run passed 10 tests covering projection, ratings and percentile low-GP/fallback behavior. These runs overlap and are not additive. The final projection-only rerun passed 3/3 after the methodology disclosure change.
- **Passed:** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`. The initial default-heap attempt exhausted Node's heap; the increased-heap run completed without diagnostics.
- **Passed:** targeted ESLint on changed TypeScript sources/tests. The broader changed-file run reported one existing Header `<img>` optimization warning and no errors; the final changed-file follow-up had no diagnostics.
- **Passed:** all four Playwright scenarios across final focused runs. The final full-file run passed edge states, narrow access, and source failure/missing history; its desktop case exposed an 11px empty-selection label. After correcting that label, the desktop case passed in 25.2s. It verifies all matrix counts, metric selection without layout movement, both selectors, seven references, TOI mode, three charts' actual zoom/pan/reset rendering, radar axes, sixteen percentile entries/filters, hover, keyboard search, Clear, URLs and viewport bounds.
- **Passed:** `git diff --check`; final screenshots visually inspected. The measured document is exactly `[1920, 1080]`; out-of-bounds regions, overflowing elements, clipped matrix cells and undersized text lists are empty.
- **Not run:** full suite, local production build, remote build or deployment. None is required for this scoped client layout verification.

Browser command: `PLAYWRIGHT_BASE_URL=http://localhost:3000 PLAYWRIGHT_SKIP_WEB_SERVER=1 npx playwright test e2e/wigo-single-viewport.spec.ts`; final focused rerun added `--grep 'complete desktop'`. Tests used the already-running local dev server.

## Explicit limitations

- The real `get_skaters_avg_stats` RPC returned HTTP 500 / PostgreSQL `57014` (statement timeout). The application displays unavailable; no synthetic radar data enters application code. Backend optimization is outside this redesign. Functional radar evidence uses a named test fixture.
- Real sources include unusual recent-window rates and an IPP above 100%; their existing values/calculations were preserved. Percentile cohorts can fall back to the previous season, and the dashboard exposes that context.
- Smaller screens retain the existing tabbed/vertical comparison workflow, including its existing horizontal table constraint. No phone single-viewport parity is claimed. No new goalie calculation model was added.
- This is local verification against the existing dev server. No production build, full application suite, deployment, commit, push, migration or data publication was performed. Unrelated `tasks/TASKS/wigo-charts-audit/` work was preserved.
