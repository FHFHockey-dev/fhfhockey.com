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
- **Commit:** `4661ec6cb`.

## Step 3: top bar

- **What changed:**
  - **Name:** it now shows in the search box and the identity panel, no longer a third time in the selected-player chip.
  - **Chip:** no box. It keeps the thumbnail, team · position and Clear in plain 12 px text at the far right.
  - **"Player research":** the decorative label is gone (it was hidden from screen readers anyway).
  - **Search box:** capped at 340 px on desktop, 14 px text. The phone keeps 16 px so iOS doesn't zoom on tap. All corners rounded the same.
  - **Clear:** 32 px touch height on phones.
- **Files:** `WigoDashboardSections.tsx`, `styles/wigoCharts.module.scss`, `NameSearchBar.module.scss`.
- **Checks:**
  - WIGO vitest passed: 145 of 145, with no test edits.
  - eslint: clean.
  - CSS pure check passed on both.
  - No-player state checked at 1280.
- **Screens:** `screens/step3-bar-before-after.png`, `screens/step3-phone-before-after.png`.
- **TJ verdict:** approved 2026-10-30 after two edits: narrow the search box (first version was too wide), and keep the "What Is Going On" tagline in its original italic, spaced caps.
- **Commit:** `dacf1a515`.

## Step 4: compare toolbar and matrix

- **What changed:**
  - **Columns:** body tint on the selected timeframes drops to 6% (from 16% and 13%), with the strong blue and gold kept in the header cell. The selected metric row is now the loudest thing in the matrix.
  - **Labels:** metric labels are regular weight; the selected one stays bold and blue.
  - **Selects:** one border instead of a double outline, and a lighter fill. The broken arrow is a proper chevron. The focus ring now shows (the highlight classes used to override it).
  - **Wording:** "TO:" is now "vs". The caption is "DIFF: % change · counts per game", because the selects already name the periods.
  - **DIFF column:** the 2 px accent line is now a subtle neutral one.
  - **Phone table:** selected columns have a 1 px outline and an 8% tint instead of 3 px and 20–25%.
- **Files:** `styles/wigoCharts.module.scss`, `TimeframeComparison.module.scss`, `TimeframeComparison.tsx`, `WigoComparisonMatrix.tsx`.
- **Checks:**
  - WIGO vitest passed: 145 of 145, with no test edits.
  - eslint: clean.
  - CSS pure check passed on both.
  - The e2e-pinned header text ("STDL", "CAR") is unchanged.
- **Screens:** `screens/step4-desktop-before-after.png`, `screens/step4-phone-before-after.png`.
- **TJ verdict:** approved 2026-10-30.
- **Commit:** `f2a36c35b`.

## Step 5: chart row

- **What changed:**
  - **Headers:** title and small controls share one line, with the legend on its own line below. It's CSS only: the toolbar wrappers use `display: contents` and the legend takes a full row.
  - **Reset:** a small ↺. `aria-label="Reset"` and the tooltip stay.
  - **TOI / PP TOI %:** the active button is lit (accent border and tint) instead of looking disabled.
  - **Game log averages:** no boxes, in a four-column grid on two rows, with a coloured underline and bold on active ones. Seven values can't fit one line at 1280, so the audit's "one line" isn't possible.
  - **"Game mean":** 11 px regular instead of 16 px bold.
  - **Wording:** the TOI panel's second title is "PP TOI %" so it fits beside its controls.
  - **Fix from step 2:** the 12 px Season production title made the four tiles overflow at 1280 by a pixel (e2e caught it). The title now has a 14 px line height and 1 px padding.
- **Measured chart height at 1280×800 (panel 187 px):**

  | Panel | Before | After |
  | --- | --- | --- |
  | Game log | 113 | 117 |
  | Time on ice | 131 | 144 |
  | Points / game | 129 | 144 |
  | Game score | 129 | 144 |
  | Category percentiles (from step 2) | 120 | 145 |

- **Files:** `GameScoreSection.tsx`, `PpgLineChart.tsx`, `ToiLineChart.tsx`, `StatsTableRowChart.tsx`, `styles/wigoCharts.module.scss`, `PerGameStatsTable.module.scss`.
- **Checks:**
  - WIGO vitest passed: 145 of 145, with no test edits.
  - `e2e/wigo-one-page.spec.ts` passed: 8 of 8, against the isolated server.
  - eslint: clean.
  - CSS pure check passed on both.
- **Screens:** `screens/step5-charts-before-after.png`, `screens/step5-phone-before-after.png`.
- **TJ verdict:** approved 2026-10-30.
