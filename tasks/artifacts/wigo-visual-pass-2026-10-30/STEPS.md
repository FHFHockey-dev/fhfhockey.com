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
- **Commit:** see `git log` ("WIGO UI pass step 1").
