# WiGO Charts overhaul: UI passes

One pass at a time (PLAN.md section 7). Fictional offline fixture on an isolated dev server at :3150 (`PLAYWRIGHT_ISOLATED_NEXT=1`, net-deny preload, fictional env). Tools: `tools/capture.cjs`, `tools/compare.cjs`, `tools/crop.cjs`, `tools/errors.cjs`.

## U1: width 95% and fit floor 1280

- **What changed:**
  - **Width:** the one-page workspace is 95% wide on this page only, still centred. The shared `$page-max-width` (90%) is unchanged.
  - **Fit floor:** `WIGO_FIT_MIN_WIDTH` 1200 to 1280. 1200 to 1279 now flow and scroll (document 1808 px tall at 1200x800 and 1279x800).
  - **TOI x-axis:** `autoSkipPadding: 8`, so the date labels no longer touch. They touched before this pass too.
- **Found during the pass:** an intermittent chart.js crash (`_labels` of undefined) caused by S8. Fixed separately in `3227451c8` (datalabels registered on the percentile chart only).
- **Files:** `pages/wigoCharts.tsx`, `styles/wigoCharts.module.scss`, `components/WiGO/ToiLineChart.tsx`.
- **Checks:** CSS pure check OK; ToiLineChart and page vitest 3/3; eslint clean; 6 desktop sizes captured with 0 page errors.
- **Screens:** `screens/u1-1280x800-before-after.png`, `u1-1920x1080-before-after.png`, `u1-1200x800-before-after.png`, `u1-after-1440x790.png`, `u1-after-390x844-comparison.png`.
- **TJ verdict, round 1:** changes requested 2026-11-03: "nothing like the proposed image". The table must be one horizontal band, the radar two rows tall, the doughnut under the headshot. TJ sent the approved prototype (E-proto2 1280). So this pass now also carries U2's grid and band.

### Round 2: TJ's grid and the band (U1 + U2)

- **Grid:** 20 columns. Row 1-2: identity and season production, pace, list, ratings; row 3: doughnut, rate percentiles (pace + list), drivers; radar on the right spans all three. Then the full-width band and one row of four charts (Metric Game Log, TOI, Points/GM, Game Score). Rows by height and width: `auto 90px 66px 156px auto minmax(150px, 1fr)`; 106/72/178 and 180 at 1400 wide and 860 tall; 130/102/232 and 240 at 1800 and 1000. 1440x790 keeps the 1280 rows.
- **Band:** one table. Periods are rows with L and R marks and tinted rows; DIFF is the last row, bold, no decimal, under a rule. Group row Totals (17), Per 60 (15, "/60" dropped, PTS1 last), On-ice (4). Content-sized columns, 1.5/2/3 px padding, pinned opaque period column, side-scroll guard. Selected metric's column is tinted. Header buttons are named by the full label ("G/60"), so Totals G and Per 60 G stay distinct (full U3 semantics come later).
- **Rate percentiles:** 3x6, column-first (6, 5, 5), per PLAN. The prototype image was row-first.
- **Drivers:** partial note "Partial: covered games only"; source dates short ("Apr 4") so each note stays one line at 240 px.
- **Flow (769-1279):** PLAN section 4 order; band side-scrolls with the pinned period.
- **Files:** `components/WiGO/WigoComparisonMatrix.tsx`, `tableUtils.ts` (DIFF digits option), `TeamPerformanceDrivers.tsx`, `styles/wigoCharts.module.scss`, `pages/wigoCharts.tsx`, `ToiLineChart.tsx`; tests `StatsTable.test.tsx`, `TeamPerformanceDrivers.test.tsx`, `e2e/wigo-one-page.spec.ts` (rewritten for the band; adds 1440x790 and 1279x800).
- **Checks:** WiGO vitest 22 files / 146 passed; e2e `wigo-one-page.spec.ts` 11/11 passed against :3150 (`PLAYWRIGHT_BASE_URL` + `PLAYWRIGHT_SKIP_WEB_SERVER=1`), including the +999% DIFF worst case at 1280 with no side-scroll; CSS pure check OK; eslint clean. Axe not run (server down).
- **Measured (fixture):** 1280: band 1214 px wide incl. +999% (budget 1214, no slack). 1440x790 charts 154 px. 1440x900 radar 339x364, charts 208 (PLAN 352x352, ~230). 1920 radar 453x472, charts 257 (PLAN 477x460, ~280).
- **TJ verdict, round 2:** approved 2026-11-03 (pop-up).
- **Screens:** `screens/u1-<size>-before-after.png` (1280x800, 1440x790, 1920x1080, 1200x800), `u1-1440x900.png`, `u1-390x844-overview.png`, `u1-390x844-comparison.png` (phone unchanged in this pass).
- **Commit:** `20fb5474b`.

## U3: band headers as a metric control

- **What changed:**
  - **Names:** each header button is named by the full metric ("Shots per 60", "Power-play points per 60 power-play minutes"); the short label stays visible. GP is an `abbr` ("Games played"). Names are unique across the 36.
  - **Action:** one shared visually hidden description ("Shows its game log below.") through `aria-describedby`, so no cell is read as "Show … game log".
  - **Keyboard:** roving tabindex. Tab reaches one header button; Left, Right, Home and End move focus only; Enter or Space selects. Focus ring 2 px with a 1 px offset.
  - **Periods:** row headers are spoken in words ("Season to date, left comparison period"; "Difference, left versus right, percent"), while the visible text stays "STD L". The L and R meaning no longer depends on colour.
  - **Live title:** the game-log title is `aria-live="polite"`.
- **Files:** `components/WiGO/WigoComparisonMatrix.tsx`, `styles/wigoCharts.module.scss`; tests `StatsTable.test.tsx`, `e2e/wigo-one-page.spec.ts`.
- **Checks:** WiGO vitest 22 files / 146 passed; e2e 11/11 against :3150; CSS pure check OK; eslint clean; header text contrast #aaa on the header background is about 8:1 (by hand). Axe and screen readers not run.
- **Screens:** `screens/u3-band-focus-1280.png` (keyboard focus two steps right of the selected SOG column), `u3-1280x800.png`, `u3-390x844-comparison.png`.
- **TJ verdict:** approved 2026-11-03 (pop-up).
- **Commit:** `2f6333678`.

## U4: rate percentile slot

- **What changed:**
  - **Filter on two lines:** title, AS/ES/PP/PK and a slider capped at 180 px on line 1; "Player GP: 20 · all skaters" and the chips on line 2. With two chips the chips wrap to a third line and still fit (worst-case shot).
  - **Sparse tiles:** one "—" in the value; "Rank unavailable" is now screen-reader text only (it overflowed 3x6 at 1280).
  - **Cohort:** the panel says "all skaters" (F and D pooled, TJ 11-01).
  - Already in U1+U2: 3x6 column-first tiles, short drivers note.
- **Files:** `components/WiGO/RateStatPercentiles.tsx`, `styles/wigoCharts.module.scss`, `e2e/wigo-one-page.spec.ts` (new worst-case test: two chips, all tiles sparse, 16 meters, title and slider on one line, no overflow).
- **Checks:** WiGO vitest 21 files / 144 passed; e2e 12/12 against :3150; CSS pure check OK; eslint clean.
- **Screens:** `screens/u4-percentiles-before-after-1280.png`, `u4-percentiles-worst-1280.png`, `u4-1280x800.png`, `u4-1440x790.png`, `u4-1920x1080.png`.
- **TJ verdict:** approved 2026-11-03 (pop-up).
- **Commit:** `143536e10`.

## U5: radar and doughnut

- **What changed:**
  - **Radar:** full labels and ring ticks kept; each value printed under its label ("GOALS / 27"); `role="img"` with an `aria-label` listing all eight; fill lightened from 0.65 to 0.28 alpha with a 2 px line, so it does not outrank the table. Canvas fonts carry the sans-serif fallback. Radius about 100 px at 1280 (target at least 90), measured from the screenshot.
  - **Doughnut:** an ordinal brand-blue ramp, dark (0 Pts) to light (6+ Pts), in place of grey, red, blue, teal, yellow, orange. Dataviz validator `--ordinal --mode dark --surface #15171a`: all checks pass (monotone L, adjacent dL >= 0.06, dark end 2.60:1, hue spread 23 degrees). List text is ink with a colour swatch (text never wears the series colour); 2 px gaps between segments; `aria-label` with each share.
- **Files:** `components/CategoryCoverageChart/CategoryCoverageChart.tsx`, `components/WiGO/ConsistencyChart.tsx`, `styles/wigoColors.ts`, `styles/wigoCharts.module.scss`.
- **Checks:** vitest 23 files / 147 passed; e2e 12/12; CSS pure check OK; eslint clean; dataviz ordinal validator PASS.
- **Not done here:** printed values add precision to small samples; the 5+ GP cohort floor (D12) and the sample line already go with them.
- **Screens:** `screens/u5-radar-before-after-1280.png`, `u5-radar-doughnut-before-after-1280.png`, `u5-1280x800.png`, `u5-1440x900.png`, `u5-1920x1080.png`.
- **TJ verdict:** approved 2026-11-03 (pop-up).
- **Commit:** `04a91564b`.

## U6: chart row consistency

- **What changed:**
  - **Headers:** title, legend, then controls on the right, on one line in all four (the 10-30 rule had put the legend on its own line). TOI's "PP TOI %" button reads "PP%"; its legend "Avg (min)" reads "┄Avg" (values are mm:ss).
  - **Dates and ticks:** MM/DD on all four (the game log read "10-23"); 12 px ticks in Roboto Condensed with the sans-serif fallback on every chart (shared `CHART_TICK_FONT`); date auto-skip padding 8 px on the canvas charts.
  - **Grid:** the game log's dashed Recharts grid becomes the same solid hairline as the others.
  - **TOI:** ticks on whole 5-minute multiples (was 33:20, 25:00, 16:40, 08:20).
  - **Game log chips:** one row of plain toggles (STD LY CA 3YA L5 L10 L20); each value moves to the chip's title. Y axis 48 px so "120.00" fits at 12 px.
- **Not done:** an 11/12/13 tick tier by viewport (E-13 suggestion); ticks stay 12 px everywhere. Game Score's -5 to 5 axis on fixture data was not changed (not checked on real data).
- **Files:** `ToiLineChart.tsx`, `PpgLineChart.tsx`, `GameScoreLineChart/index.tsx`, `StatsTableRowChart.tsx`, `styles/wigoColors.ts`, `styles/wigoCharts.module.scss`; tests `StatsTableRowChart.test.tsx`, `e2e/wigo-one-page.spec.ts` (measure reads SVG text).
- **Checks:** vitest 23 files / 147 passed; e2e 12/12; CSS pure check OK; eslint clean.
- **Screens:** `screens/u6-charts-before-after-1280.png`, `u6-1280x800.png`, `u6-1440x790.png`, `u6-1440x900.png`, `u6-1920x1080.png`.
- **TJ verdict:** approved 2026-11-03 (pop-up).
- **Commit:** `f375d5736`.

## U7: Metric Game Log

- **What changed:**
  - **Counts are bars** (Goals, SOG, PPP...: `tableType` COUNTS from `isWigoCountChartStat`), with rounded tops.
  - **Rates are straight segments** with a 2 px dot per game, `connectNulls` off, so a missing game is a gap, as Game Score's help already says. The 0.9-opacity area fill under the line is gone.
  - **Game mean** moves from the plot into the title line ("SOG/60 game log 2025–26 games · Game mean: 2.13"); no text is drawn over the marks. The phone chart keeps its on-line label.
  - **Round y ticks** from zero (`niceGameLogTicks`: 0, 1, 2, 3, 4; whole numbers for counts) instead of quarters of the maximum (3.40, 2.55, 1.70, 0.85). Toggled reference lines extend the axis if needed.
  - The mean helpers move to `gameLogMean.ts`, so the title line does not load Recharts with the page.
- **Files:** `StatsTableRowChart.tsx`, `gameLogMean.ts` (new), `WigoComparisonMatrix.tsx`, `styles/wigoCharts.module.scss`; tests `StatsTableRowChart.test.tsx`, `e2e/wigo-one-page.spec.ts` (bars for Goals, a curve-free path for SOG/60, mean in the title, no reference-line text).
- **Checks:** vitest 23 files / 149 passed; e2e 12/12; CSS pure check OK; eslint clean.
- **Screens:** `screens/u7-sog60-before-after-1280.png`, `u7-after-goals-1280.png`, `u7-1280x800.png`, `u7-1920x1080.png`.
- **TJ verdict:** approved 2026-11-03 (pop-up).
- **Commit:** `a0c304f30`.

## U8: colour roles

- **What changed:** one meaning per colour across the chart row (`WIGO_CHART_ROLES` in `wigoColors.ts`).
  - **Bars** (Points, Game Score, game-log counts): one recessive slate `#34495a`, no border, behind the lines.
  - **Blue `#14a2d2`:** the primary series (5-GM, TOI total) and the band's left period. **Amber `#c98500`:** the right period only. **Magenta `#d55181`:** the second series (10-GM, power play). **Dashed ink:** every average. **Grey:** other reference periods. Red and green stay DIFF-only.
  - **Game log:** the series is ink, so its reference lines can use L blue and R amber like the band; the game mean is a faint dotted ink line; the chips' active border uses the same role colour. The left period's line starts on.
  - **Crossings:** each rolling line over bars gets a 2 px surface ring (dataviz overlap rule), since magenta is 2.37:1 against the bars; blue 3.17:1, amber 3.04:1. Rings are hidden from tooltips.
  - **Legends:** text in ink; only the mark (▮ ━ ┄) carries the colour. Fills under the rolling lines are gone; the TOI fill is lighter.
- **Validator (dark, surface #15171a):** blue/magenta all pass (CVD dE 12.4, normal 27.7); blue/amber all pass (22.5, 26.4). Rejected: light blue/orange (outside the dark L band), blue/violet (CVD dE 3.6), blue/aqua (normal-vision 14.6).
- **Not done:** the left reference line does not switch on again when the compare pair changes after load; its colour does.
- **Files:** `styles/wigoColors.ts`, `PpgLineChart.tsx`, `GameScoreLineChart/index.tsx`, `GameScoreSection.tsx`, `ToiLineChart.tsx`, `StatsTableRowChart.tsx`, `WigoComparisonMatrix.tsx`, `StatsTable.tsx`; test `GameScoreLineChart/index.test.tsx`.
- **Checks:** vitest 21 WiGO files / 146 passed; e2e 12/12; eslint clean.
- **Screens:** `screens/u8-charts-before-after-1280.png`, `u8-1280x800.png`, `u8-1920x1080.png`, `u8-390x844-trends.png`.
- **TJ verdict:** approved 2026-11-03 (pop-up).
- **Commit:** `2f8336b2e`.

## U9: honest states

- **What changed:**
  - **As of:** the band toolbar shows "As of Sep 17": the older of the `wigo_career` and `wigo_recent` dates (D9).
  - **Stale STD:** when STD's GP disagrees with this season's totals, the label reads "STD*" ("stale row" for screen readers) and a note says "STD is stale: its GP is 69, this season 8 played".
  - **Found while checking:** a stale STD row was filling its blanks from this season's totals (PPP 3, HIT 3 beside a 69-GP row). The totals fallback is now off for a stale row (`buildWigoAggregatedStatsResult`), with a test.
  - **Empty compared period:** "No CA data yet, so DIFF is blank" when the left or right period has no data at all (rookie shape).
  - **Schedule list:** a visible "VAN team schedule" caption; "player participation is not guaranteed" stays for screen readers.
  - Plain "no data yet" copy for AS percentiles and ratings landed in D7 and D8.
- **Files:** `WigoComparisonMatrix.tsx`, `WigoDashboardSections.tsx`, `pages/wigoCharts.tsx`, `OpponentGamelog.tsx`, `OpponentGameLog.module.scss`, `styles/wigoCharts.module.scss`, `utils/fetchWigoPlayerStats.ts`; tests `WigoComparisonMatrix.test.tsx`, `OpponentGamelog.test.tsx`, `utils/fetchWigoPlayerStats.test.ts`.
- **Checks:** vitest WiGO + fetch + hook passed; e2e 12/12; CSS pure check OK on both stylesheets; eslint clean.
- **Not done:** the phone table does not show the as-of or stale notes yet (U10 builds the phone band).
- **Screens:** `screens/u9-band-stale-bedard-shape-1280.png` (fixture with Bedard's stale shape injected), `u9-band-toolbar-1280.png`, `u9-schedule-1280.png`, `u9-1280x800.png`.
- **TJ verdict:** approved 2026-11-03 (pop-up).
- **Commit:** `8c64d0c57`.

## U10: phone band

- **What changed:**
  - **Same band on phone:** the Comparison tab renders the band component (`phone` variant) instead of the old transposed `StatsTable` with 35 "+" expanders. `StatsTable.tsx` and its expander tests are deleted; the band tests move to `WigoComparisonBand.test.tsx`.
  - **Phone variant:** Totals / Per 60 / On-ice jump buttons (32 px); the band is a focusable side-scrolling region ("Comparison band, scrolls sideways") with a 2 px focus ring; 13 px text, 28 px rows, 32 px header, 45 px pinned opaque period column; an edge fade while more columns remain, dropped at the end; group titles stay in view beside the pinned column; the L5/L10/L20 note; the Metric Game Log below (280 px).
  - **Pinned cell:** row tints are layered over an opaque base, so scrolled values never show through STD and CA.
  - **Shared band styles** move from the one-page block to the panel's scope so both layouts use them; desktop is unchanged (capture diff within noise).
  - The phone now also gets the U9 as-of and stale notes.
- **Not done:** the old `.statsTable*` rules in `wigoCharts.module.scss` are now unused; left in place for a separate cleanup.
- **Files:** `WigoComparisonMatrix.tsx`, `WigoDashboardSections.tsx`, `pages/wigoCharts.tsx`, `styles/wigoCharts.module.scss`; deleted `StatsTable.tsx`, `StatsTable.test.tsx`; new `WigoComparisonBand.test.tsx`; tests `WigoComparisonMatrix.test.tsx`, `e2e/wigo-one-page.spec.ts` (new phone test).
- **Checks:** vitest 22 WiGO files / 146 passed; e2e 13/13; CSS pure check OK; eslint clean.
- **Screens:** `screens/u10-phone-comparison-before-after.png`, `u10-band-jumps-390.png` (after Per 60, after On-ice), `u10-band-start-390.png`, `u10-1280x800.png`.
- **TJ verdict:** approved 2026-11-03 (pop-up).
- **Commit:** `11366ec6a`.

## U11: phone tab regrouping

- **What changed (PLAN section 4):**
  - **Overview:** identity, season production, per-game / pace, team schedule. The production tiles drop their "/ GP" line on phone, since the pace table below gives per-game values.
  - **Trends:** point consistency, TOI, Points / game, Game score. The radar moves out.
  - **Percentiles:** category radar, rate percentiles, player ratings, team drivers.
  - **Comparison:** the band from U10.
  - Each panel appears once (test: Overview C02 C03 C06; Trends C14 C16 C17 C18; Percentiles C15 C19 C07 C08-C11). `?tab=` unchanged.
  - **Ratings help on phone (A-13):** ratings and drivers are now one shared panel each; the ratings card carries the same ⓘ help on phone as on desktop. The phone ratings slot is 260 px so three rows of boxes fit under the card header.
  - **Radar on phone:** its printed values were 10 px weight 100 in a serif fallback; now 12 px Roboto Condensed with the sans-serif fallback (11 px floor).
- **Files:** `WigoDashboardSections.tsx`, `pages/wigoCharts.tsx`, `PerGameStatsTable.module.scss`, `styles/wigoCharts.module.scss`, `CategoryCoverageChart.tsx`; test `WigoDashboardSections.test.tsx`.
- **Checks:** vitest 23 files / 148 passed; e2e 13/13; CSS pure check OK on both stylesheets; eslint clean.
- **Screens:** `screens/u11-overview-before-after.png`, `u11-trends-before-after.png`, `u11-390x844-percentiles.png`, `u11-1280x800.png`.
- **TJ verdict:** approved 2026-11-03 (pop-up).
- **Commit:** `77f85c6fa`.

## U12: copy, definitions and final accessibility

- **What changed:**
  - **Definitions:** header hover text adds the meaning where the label does not say it (PP%, PTS1%, PTS1/60, OZS%, IPP, oiSH%, and PPP/PPG/PPA per 60 "per 60 minutes of power-play time, not all ice time"). The band help note adds CA, 3YA, PP%, PTS1% and OZS%. `design:ux-copy` review: "primary assists" (matches PTS1 and the writer's G + A1) and "excludes this one" for CA.
  - **E-15 copy:** "Loading percentiles…", "Calculating…", "Loading ratings…", "No games found for this season.", "Couldn't load the SOG/60 game log.", and the phone percentile line "Player GP: 78 · 2024–25 values, not 2025–26" (was raw season ids). Ratings order is now one component everywhere (Offense, Overall, Defense). The radar context line stays (TJ approved it in U1+U2).
  - **Accessibility:** the game log's text alternative is a one-line summary (games with a value, range, game mean); the full-size phone radar gets the same `aria-label` as the compact one; the selected band header is white on its tint (was 4.38:1); phone band header buttons have a 24 px minimum width.
- **Axe:** the Axe MCP server is still down. I ran the axe-core 4.11.0 library locally through Playwright (`tools/axe-run.cjs`, WCAG 2.0/2.1 A and AA tags) on the fixture page: desktop 1280 and all four phone tabs. One serious violation found and fixed (phone radar canvas without a name); after the fix **0 violations** in all five views. axe marks colour contrast "incomplete" over gradients and tints (79 desktop, 242 phone comparison); the composited hand check (`tools/a11y-hand.cjs`) leaves one item: the ▮ legend mark for bars is 2.04:1, the same recessive slate as the bars, left as is. Desktop band header buttons stay under 24 px wide (no WCAG 2.1 AA criterion; no room at 1280). No screen-reader run.
- **Files:** `WigoComparisonMatrix.tsx`, `StatsTableRowChart.tsx`, `RateStatPercentiles.tsx`, `PlayerRatingsDisplay.tsx`, `ConsistencyChart.tsx`, `CategoryCoverageChart.tsx`, `styles/wigoCharts.module.scss`; tests `StatsTableRowChart.test.tsx`, `RateStatPercentiles.test.tsx`, `ConsistencyChart.test.tsx`, `e2e/wigo-one-page.spec.ts`. Results: `axe-results.json`.
- **Checks:** vitest 55 files / 450 passed (WiGO, radar, hooks, fetchers); e2e 13/13; CSS pure check OK; eslint clean.
- **Screens:** `screens/u12-band-help-1280.png`, `u12-1280x800.png`, `u12-390x844-percentiles.png`.
- **TJ verdict:** approved 2026-11-03 (pop-up).

## Post-ship pass A: type and copy (2026-11-03)
- Findings #1–4, #7, #9 (visible rating headers), #13 from POST-SHIP-CRITIQUE.md.
- Per-game numbers: valid `"Roboto Condensed", sans-serif`, tabular figures, no 0.15em tracking. Drivers: same family on phone (was Martian Mono). Phone rating headers: sentence case, no tracking. Phone radar context 11 px under its 12 px title.
- Fallback warning uses season labels ("2024–25", "2025–26"). Cardio row sits under 0 Pts as a muted ↳ sub-row.
- Checks: 5 test files / 39 tests pass; CSS pure check OK; wigo-one-page e2e 13/13 on :3150.
- Screens: pa-1280x800.png, pa-390x844-{overview,percentiles}.png; crops pa-phone-radar-header.png, pa-phone-pergame.png, pa-phone-ratings-drivers.png, pa-1280-consistency.png (compare ps-crit-*).

## Post-ship pass A: verdict
- TJ approved 2026-11-03 (pop-up). Commit 73d4f4907.

## Post-ship pass B: ratings emphasis and order (2026-11-03)
- Findings #6 and #8. Phone rating boxes keep the rating colour on the value only; outlines are the neutral secondary border. Offense, Defense, Overall order now applies on every layout (moved the `order` rule from the one-page scope to the base `.ratingSection`).
- Desktop unchanged (crop pb-1280-ratings.png vs ps-1280-ratings.png).
- Checks: PlayerRatingsDisplay tests 7/7; CSS pure check OK; wigo-one-page e2e 13/13.
- Screens: pb-1280x800.png, pb-390x844-percentiles.png; crops pb-phone-ratings.png, pb-1280-ratings.png.
- TJ (pop-up): "The ratings should have a more prominent visual component element. It is meant as a visualization. Bar charts, gauges, something other than a plain simple small bar."

## Post-ship pass B, round 2: rating gauges (2026-11-03)
- Each of the nine ratings is now a 0–100 semicircle gauge: neutral track, fill in the existing rating colour, a surface-coloured notch at 50 (cohort middle), value in the bowl, label under it. `PlayerRatingsDisplay.tsx` renders the nine boxes through one `renderBox` helper; the 2 px underline bar and the per-box coloured borders are gone.
- Phone: boxes 84 px tall with a neutral hairline; ratings card 372 px (was 260 px) so all three rows show. Order stays Offense, Defense, Overall everywhere.
- Checks: PlayerRatingsDisplay tests 7/7; CSS pure check OK; wigo-one-page e2e 13/13.
- Screens: pb2-1280-ratings.png, pb2-1440-ratings.png, pb2-1920-ratings.png, pb2-phone-ratings.png; full pages pb2-1280x800.png, pb2-1920x1080.png, pb2-390x844-percentiles.png.
- TJ approved 2026-11-03 (pop-up). Commit 765ac80a8.

## Post-ship pass C: large-screen fill (2026-11-03)
- Finding #5. In the 1800w × 1000h tier only: identity card headshot 96×112 (was 52×64), name 28 px, team and role 14 px, biography values 16 px with 12 px labels; consistency doughnut column 46% with 14 px legend rows; driver cards get padding, a faint surface step, 16 px titles and 14 px values and bands, so the drivers panel has no mid-panel gap.
- Smaller tiers unchanged.
- Checks: CSS pure check OK; wigo-one-page e2e 13/13 (includes the 1920×1080 one-screen fit); 1800×1000 capture shows no page scroll.
- Screens: pc-1920x1080.png, pc-1800x1000.png; crop pc-1920-top.png (before: pc0-1920-top.png).
- TJ approved 2026-11-03 (pop-up). Commit 7f8ff084b.

## Post-ship pass D: cleanup (2026-11-03)
- Findings #10–12, #14.
- Dead CSS removed from `styles/wigoCharts.module.scss` (386 lines: `.statsTable*`, `.chartRowExpanded`, `.combinedStatsTableContainer`, `.rateStatBarPercentilesComponent`, `.timeframeComparisonWrapper`, including the legacy Lucida Sans chart-title rules nested in `.statsTable`). Deleted the unimported `components/WiGO/wigoCharts.module.scss`. `.statsTableNote` renamed `.bandNote`.
- Tokens: compare colours are `s.$compare-left` / `s.$compare-right` in `components/WiGO/_scale.scss` (same hex), used by the band and TimeframeComparison. Greys now use site tokens (#3a3a3a and #444 → `v.$border-primary` #404040, #555 → `v.$color-grey-dark` #505050, #777 → `v.$color-grey-medium` #808080), so those shift by a few percent of lightness.
- Spacing: block gaps and margins moved to the 4 px grid (3 and 5 → 4, 15 → 16, 25 → 24). Cell paddings inside the dense tables stay at 3 px to protect the 1280×800 fit.
- Copy: radar sample line drops the middle dot ("20 GP vs 420 skaters with 5+ GP"). The other dot-joined meta lines stay; they separate three facts in one short line.
- Checks: WiGO and radar vitest 26 files / 207 tests pass; CSS pure check OK; wigo-one-page e2e 13/13. Pixel diff against the previous pass: 0.80% of pixels at 1280×800, 0.58% at 1920×1080; phone pages 1 px shorter.
- Screens: pd-1280x800.png, pd-1920x1080.png, pd-390x844-{overview,percentiles,comparison}.png; stacked before/after pd-compare-1280.png, pd-compare-1920.png.
- TJ approved 2026-11-03 (pop-up). Commit 7f8ff084b.
- TJ approved 2026-11-03 (pop-up). Commit 1b3b12b5c.

## Post-ship closing check (2026-11-03)
- Axe MCP server failed to connect this session, so `tools/axe-run.cjs` (axe-core 4.11, WCAG 2.0/2.1 A and AA) ran locally on the fixture page: 0 violations on desktop 1280 and all four phone tabs. Colour contrast stays "incomplete" over gradients and tints (71 desktop, 242 phone comparison), as before. Not run: the Axe MCP itself, a screen reader, real data.
