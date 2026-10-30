# WIGO UI pass: steps

Declutter in place (see `AUDIT-2026-10-30.md`). One local commit per approved step, explicit pathspecs, no push. Screenshots come from the fictional offline fixture (Playwright, network isolated) on an isolated dev server at :3150. They show no real data.

**Order approved by TJ, 2026-10-30:** 1 phone repairs, 2 panel titles, 3 top bar, 4 compare toolbar and matrix, 5 chart row, 6 identity and production, 7 ratings, drivers, schedule, 8 rate percentiles, 9 scale, 10 review.

## Step 1: phone repairs

- **What changed:**
  - **Root cause:** the phone rules sat above the base rules in `wigoCharts.module.scss`, so the base heights and row layout won. They now sit in a block at the end of the file. A dead copy is removed from the old block.
  - **Percentiles tab:** the chart was a 32 px strip. It is now 16 horizontal bars, one row per stat, in a 416 px tall container. Each row shows the same percentile and rank as before ("75% · 104th"). Labels on long bars are dark, so they stay readable on the light bars. Only the phone path uses this chart; one-page mode uses tiles.
  - **Trends tab:** Point Consistency and Category percentiles stack instead of sharing a row. Titles and donut percentages no longer clip. Legends are 12 px on one line, the Reset, TOI and PP TOI % buttons share one style with a 32 px touch height, and the chart panels are a fixed 260 px tall.
  - **Comparison tab:** the L5/L10/L20 note moves out of the wide scrolling table's `<caption>` into a wrapped paragraph tied to the table with `aria-describedby`. The table is 700 px wide, so PPTOI values show in full.
- **Files:** `styles/wigoCharts.module.scss`, `components/WiGO/RateStatPercentiles.tsx`, `components/WiGO/StatsTable.tsx`.
- **Checks:**
  - WIGO vitest passed: 145 of 145, with no test edits.
  - eslint on both tsx files: clean.
  - CSS pure check passed.
  - Desktop 1280×800 screenshot byte-identical before and after.
- **Screens:** `screens/step1-percentiles-before-after.png`, `screens/step1-trends-before-after.png`, `screens/step1-comparison-before-after.png`.
- **TJ verdict:** approved 2026-10-30.
- **Commit:** `864226544`.

## Step 2: one panel title style

- **What changed:**
  - **Titles:** every panel title is 12 px, bold, sentence case, muted, with no letter spacing and the same header background: chart panels, Category percentiles, Rate stat percentiles, the game log, Season production, Per-game / pace, Compare. Wording follows ("Time on ice", "Point consistency", "VAN performance drivers", "Compare").
  - **Category percentiles:** the filled teal band is gone, so the team-colour rail on identity is the only brand accent. The context fits on one line.
  - **Help:** ⓘ alone, with no ▶ (five places). Per-game / pace gets its ⓘ from CSS. Summaries have a visible focus ring.
  - **Seasons:** one format, 2025–26, through a new `formatSeasonRange` helper in `tableUtils.ts`. The Rate percentiles detail line still shows raw ids (tests pin it); step 8 covers it.
- **Files:** `styles/wigoCharts.module.scss`, `PerGameStatsTable.module.scss`, `TimeframeComparison.module.scss`, `ConsistencyChart.tsx`, `GameScoreSection.tsx`, `PpgLineChart.tsx`, `ToiLineChart.tsx`, `RateStatPercentiles.tsx`, `TeamPerformanceDrivers.tsx`, `TimeframeComparison.tsx`, `WigoComparisonMatrix.tsx`, `WigoDashboardSections.tsx`, `PerGameStatsTable.tsx`, `tableUtils.ts`, plus two test strings ("Rate stat percentiles", "2024–25").
- **Checks:**
  - WIGO vitest passed: 145 of 145.
  - eslint on touched files: clean.
  - CSS pure check passed on all three.
- **Screens:** `screens/step2-desktop-before-after.png`, `screens/step2-phone-before-after.png`.
- **TJ verdict:** approved 2026-10-30.
