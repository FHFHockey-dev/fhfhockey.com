# Lane E: WiGO Charts layout and UI critique (2026-11-01)

**Superseded for the top block:** TJ changed it after seeing the first prototype. Read "Revised top block (TJ, 11-01)" at the end first; it replaces the top-block rows, E-03's short labels and E-10's 4x4.

**Verdict.** TJ's layout works with no scroll at viewports of 1280x800 and up, at 95% width, with every panel at or above the 11 px floor. I tested this by injecting the target grid and a real 36-column band into the fixture page at 1280x800, 1440x900 and 1920x1080. Nothing clipped and the document did not scroll.

Three conditions make it hold:

1. The band must use content-sized columns. Equal columns do not fit at 1280 (E-01).
2. The radar needs short labels and no ring ticks at about 155 px, or its radius is only 31 px (E-03).
3. The fit threshold must rise from 1200 to 1280 wide (E-05).

No-scroll cannot hold below 1280 wide or below about 768 tall. Those sizes must flow and scroll.

**How this was checked.**
- All captures use the fictional fixture, on an isolated server at `:3150` (`.next-playwright`, net-deny preload), since stopped by exact PID.
- The prototype is a throwaway stylesheet and table injected at runtime. It is not the real components, and no application file changed.
- Real-data judgments come only from lane D's shots `L1`–`L6`. I made no production reads and no page loads against production.
- Text widths were measured in the DOM in Roboto Condensed with tabular numerals. Only the 300 and 400 faces are declared, so "bold" widths are synthetic bold (E-16).

**Screens** are in `audits/screens/`:
- `E-current-*`: the page today.
- `E-proto-<size>-fixture|high|extreme`: the target grid.
- `E-proto-band-1280-*`: 2x band crops.
- `E-proto-doughnut-radar-*`: the chart pair.
- `E-proto-phone-band-*`: the phone band.

**Not run:**
- **Axe:** the MCP server is still failing to connect (a cached connection failure, not a missing server). No `analyze` or `igt` was run, so every accessibility claim below is by hand or from code.
- **Screen readers:** no VoiceOver or NVDA run. Screen-reader notes come from the DOM and code.
- **Other checks:** forced colours, and live keyboard operation of the prototype.
- **Real-data prototype:** the prototype was never run on real data. The real-data columns below use lane D's shots.

---

## Worst findings

### E-01 — P1 — Equal-width columns cannot hold 36 metrics at 1280, and the current table rule would overprint digits
`web/styles/wigoCharts.module.scss:1651` (`table-layout: fixed`), `web/components/WiGO/WigoComparisonMatrix.tsx:117`.

**Failure.** Carrying the current rule into one band gives 32.6 px per column, or 28.6 px of text room at 2 px padding. `white-space: nowrap` plus right alignment makes a wide value run left into its neighbour, so a user can misread a number. Values that do not fit (widths at 11 px):

| Text | Width | Where |
|---|---|---|
| `PTS1/60` header | 37.81 | On-ice (see E-07) |
| `PTS1%` header | 29.84 | On-ice |
| `100.0%` | 31.59 | S%, PP%, IPP, oiSH%, OZS%, PTS1%. Real: lane D's L3 shows `100.0%` on PTS1%. |
| `120.00` | 30.06 | SOG/60, iCF/60, PPP/60, PPG/60, PPA/60, HIT/60, PIM/60. A low-TOI spike the formatter can emit; L3 shows a real `33.83`. |
| `+999%` | 28.73 | DIFF in any column (over by 0.13) |
| `+3585%` | 34.16 | DIFF in any column |

**Decision.**
- Use `table-layout: auto` with `width: 100%`. Slack is shared out, so padding is only a floor.
- Set the floor at 1.5 px at 1280, 2 px at 1440 and 3 px at 1920, with a 4 px gap between groups.
- Give the band wrapper `overflow-x: auto` as a guard, so a freak value scrolls rather than overprints.
- No DIFF cap is needed. One huge DIFF only widens its own column.
- Set minimum widths by format class (percent, time, two decimals, integer) to reduce column jumping between players. This was not tested.

**Verified:** fixture and prototype. Budget in "Space budget" below.

### E-02 — P1 — Moving the metric buttons into column headers makes screen readers announce "Show SOG/60 game log" on every cell
`web/components/WiGO/WigoComparisonMatrix.tsx:158-170`, caption `:118-122`.

**Failure.** Today `aria-label="Show … game log"` sits on a row header. In the band the same button is the column header, and a table's header name is read out with each cell, so a value reads as "Show SOG/60 game log, 3.15". Shortening also makes 12 headers ambiguous: G, A, PTS, SOG, ixG, iCF, PPP, PPG, PPA, HIT, BLK and PIM each appear twice (Totals and Per 60).

**Fix, the semantics to build:**
- `<colgroup span>` for each group, `<th scope="colgroup">` in the group row, `<th scope="col">` per metric, and `<th scope="row">` for periods.
- The button's name is the full metric with no verb: "Shots per 60". The action goes in one visually hidden description shared through `aria-describedby`, and the state in `aria-pressed`.
- Period labels carry their meaning for screen readers: "Season to date, left comparison period". Today's `L`/`R` letters read as bare letters.
- Rewrite the caption for one table: "36 metrics by period. The last row is the difference between the left and right periods."

**Verified:** code. The announcement itself is inferred from the markup, not heard.

### E-03 — P1 — The radar has a 31 px radius at about 155 px tall, and its values are unreachable on desktop
`web/components/CategoryCoverageChart/CategoryCoverageChart.tsx:181-187` (12 px labels, ring ticks on), title and context in `web/components/WiGO/WigoDashboardSections.tsx:300-303`.

**Failure.**
- At 240 px wide, "Category percentiles" plus "Skaters · 2025–26 · 0–100" wraps to two lines, taking the canvas down to 238x117.
- The `100` and `50` ticks sit on top of the shape (`E-proto-doughnut-radar-1280-as-is.png`).
- The compact radar has no `role` or `aria-label`, and shows values only on hover. The phone radar prints them. So keyboard and screen-reader users on desktop get nothing, and tooltip-only values are a `dataviz` anti-pattern.

Radius measured by running Chart.js at the real canvas sizes:

| Canvas | Options | Radius |
|---|---|---|
| 238x117 | as is | **31 px** |
| 238x131 | title on one line | 38 px |
| 238x131 | + 11 px labels | 39 px |
| 238x131 | + short labels (G, A, PPP, SOG, +/-, PIM, BLK, HIT) | 39 px |
| 238x131 | + short labels, ring ticks off | **47 px** |
| 268x153 (1440) | as is → short, no ticks | 49 → 58 px |
| 360x189 (1920) | as is | 67 px |

**Fix.**
- Keep the title on one line by moving "Skaters · 2025–26" to the help note. Short labels and no ring ticks at the 1280 tier.
- Add the value to each label ("G 27") if it still fits; that fit was not measured.
- Add an `aria-label` listing all eight values.

The doughnut beside it holds: canvas 80x123, list on the right. Five rows rendered. Seven rows (McDavid in L2) come to about 105 px against a 126 px body, by calculation only.

**Verified:** Chart.js measurement, code, fixture. Label-plus-value not tested.

### E-04 — P1 — Colours mean different things in adjacent charts, and lines disappear on bars
`web/components/WiGO/StatsTableRowChart.tsx:58-66`, `web/components/WiGO/PpgLineChart.tsx:97-157,273`, `web/components/WiGO/GameScoreLineChart/index.tsx:144`, `web/styles/wigoColors.ts:75-82,116`.

**Failures, all made worse by the new row, where charts sit side by side under the table:**
- **L and R clash.** In the table, blue means the left period and amber the right. In the Metric Game Log directly below, CA is blue and STD is red. So with the default STD vs CA, the left period's chart colour (STD) is red and the right period's (CA) is blue.
- **One colour, several meanings.** Orange is 10-GM on Points and Game Score, but PP on TOI, next door. Teal is 5-GM on Points and Game Score, but Total on TOI. Colour should follow the entity.
- **Lines over bars.** Teal on bar blue is 1.35:1, orange 1.44:1 and the red average 1.03:1. These fail 1.4.11 wherever a line crosses a bar. Fixture season shots show the 5-GM line dissolving into the bars.
- **Validator** (`dataviz/validate_palette.js`, dark mode):
  - Trend series FAIL the normal-vision floor (teal and blue ΔE 10.4) and the lightness band.
  - Game-log references (7 hues) FAIL the lightness band, chroma floor and normal-vision floor, checked with `#4bc0c0` and `#66ccff` standing in for the slots I had not yet read. The actual hexes differ, so re-run at implementation.
  - The doughnut set FAILS CVD: 0 Pts grey and 1 Pt red are ΔE 1.8 for protan.
- **Legend text wears series colours.** The legends use glyphs such as `▮Pts` in series colour. Text should stay in ink with a coloured mark beside it.

**Fix.**
- Bars become a recessive neutral so the lines carry the signal.
- One meaning per colour across the row. Season, 5-GM and 10-GM keep their roles.
- Game-log references take blue and amber when they are the L and R periods.
- Doughnut: an ordinal ramp, because 0–5+ points is ordered. `CONSISTENCY_6` repeats the 1 Pt red (`wigoColors.ts:98,104`), a cycled hue. Keep the doughnut, which is TJ's decision.

**Verified:** validator and contrast were computed; code; shots.

### E-05 — P1 — "No-scroll at 1280x800" only holds for that literal viewport, and the code's fit threshold allows an overflowing band
`web/pages/wigoCharts.tsx:26-27`.

**Failure.**
- `WIGO_FIT_MIN_WIDTH = 1200` turns on the fit layout at 1200 wide. There the band has about 1,138 px, but a fairly ordinary case needs 1,167 at 2 px padding (every column at `-100%` width), or 1,128 at 1.5 px, which leaves little room. It would then side-scroll inside a one-page layout.
- Height: the minimum stack is 36 context + 156 + 156 top + 191 band + 150 charts = 689 px, so the existing 700 height floor is right.
- At 1366x768 the available height is 694 (768 − 68 − 6), so the page flows. A 1280x800 laptop in a real browser has less than 800 inner height (chrome not measured), so it flows too.

**Decision.** Raise the width floor to 1280 and keep 700. Under that, flow with a side-scrolling band and a pinned period column. Tell TJ plainly that no-scroll means inner viewport size, not screen size.

**Verified:** code, measurement.

### E-06 — P1 — Sparse players get a blank DIFF row with no reason, and 16 repeats of "Rank unavailable"
`web/pages/wigoCharts.tsx:35` (default right = CA), `web/components/WiGO/RateStatPercentiles.tsx:494`.

**Failure, real data.**
- Lane D's L4 (Bystedt, 2 GP): LY, CA and 3YA are all `-`. With the default STD vs CA, every DIFF is `-`. In the band, DIFF is one headline row, so a fully blank row reads as broken, and three more blank rows sit above it.
- L3 and L4 show "Rank unavailable" 16 times.

**Fix.**
- One line in the toolbar, such as "No career average yet. Pick another period." Optionally default R to the first period that has data; this is a decision for TJ, not assumed here.
- Tiles show `—` and one reason line for the panel. This belongs with the data fix in C-23: copy cannot fix the wall of 50s C-23 describes.

**Verified:** L3 and L4 shots, code.

### E-07 — P1 — The group row's labels don't match what's under them, and `PTS1/60` breaks the rule that groups let headers drop "/60"
`web/components/WiGO/statMetadata.ts:15-52` (order), `web/components/WiGO/WigoComparisonMatrix.tsx:27-39`.

**Failure.**
- `PTS1/60` falls in On-ice by metric order, so it keeps "/60", is the widest header (37.81) and takes the widest column (41.8–48.8 px rendered).
- IPP and PTS1% are shares of the player's own production, not on-ice measures.
- "Totals" holds ATOI, S% and PP%, none of which are totals. Its CA and 3YA rows are per-season averages (C-31). PP% is also a share of team power-play time (lane A).

**Recommendation, for a TJ pop-up since TJ named the groups:** move `PTS1/60` into Per 60 as `PTS1`, which saves about 13 px and keeps the rule. Keep the three group names unless TJ wants others; "Totals" and "On-ice" stay loose but short, and the help note covers the exceptions.

**Verified:** code, measurement.

### E-08 — P1 — Metric Game Log misrepresents discrete games
`web/components/WiGO/StatsTableRowChart.tsx:241,275-290,298-304`.

**Failure.**
- `type="monotone"` draws smooth curves through whole-number games. Goals and SOG read as values between games, and L3's SOG/60 peaks show curves over single spikes.
- `connectNulls` bridges missing games, while Game Score's help says "missing scores remain gaps".
- `CartesianGrid strokeDasharray="3 3"` uses Recharts' default stroke, giving the heavy dashed box in every shot. Dashed grids are a `dataviz` anti-pattern.
- "Game mean: 2.13" prints over the lines. It was accepted on 10-30 as small; it now has room to move.
- It is the only Recharts chart in the row. Dates read `10-23` against `10/08` beside it, and ticks are 11 px against 12 px (`fill` mode). Y ticks are `3.40, 2.55, 1.70, 0.85`.
- The other chart library sits in the same page (D-07), so aligning this chart would also help load.

**Fix.**
- Bars for counts and straight segments for rates, with no smoothing and real gaps.
- Solid hairline grid, one date format, round ticks.
- Mean goes in the chart title line.

**Verified:** code, shots. The bars-versus-lines call is my recommendation, not yet shown to TJ.

### E-09 — P3 — 35 tab stops in one row, on a smaller target than the 10-30 pass accepted
`web/components/WiGO/WigoComparisonMatrix.tsx:162-170`.

**Failure.** Each metric is a tab stop before the charts, as today. Measured header buttons at 1280 run from 23.5 to 48.8 px wide and 15 px tall, against the 65x13 accepted on 10-30.

**Fix.**
- Roving tabindex: Tab lands on the selected metric, Left and Right move, Home and End jump, Enter or Space selects. Tab then leaves the table.
- Add a visible focus ring inside the cell.
- Pointer convenience: clicking any cell in a column selects it. The header stays the keyboard control.
- `GP` remains plain text, and needs to look different from the buttons.
- Announce the change: the chart title updates, so give it `aria-live="polite"`.

**Verified:** measurement, code. Not operated by keyboard.

### E-10 — P3 — Tiles and filters need rearranging for the wide slot
`web/components/WiGO/RateStatPercentiles.tsx:411-485`, `web/styles/wigoCharts.module.scss` (`percentileTileGrid`).

- 8x2 fails at 1280: 91 px per tile, against label + value + rank of 90.4 with no padding (`iHDCF/60` 42.09, `100%` 23.27, `403rd` 25). **4x4 fits at all three sizes**, including `Rank unavailable` (42.09 + 23.27 + 73.08 = 138 in a 182 px tile).
- In the prototype the Min GP slider stretched to about 500 px. TJ's 10-30 note says not to widen controls to fill space, so cap it at about 180.
- Two chips (L2) need the second line at 1280; title, pills and slider stay on the first.

**Verified:** measurement, prototype. Chip widths are read off the L2 shot.

### E-11 — P3 — Period tints must be opaque where the column is pinned
`web/styles/wigoCharts.module.scss` (`[data-left]`, `[data-right]` at `rgba`).

**Failure.** A sticky period column with `rgba` tints lets digits show through while side-scrolling. The phone prototype's opaque pin scrolled cleanly (`E-proto-phone-band-scrolled.png`). Also, the scroll wrapper needs `tabindex="0"`, `role="region"` and a name, or keyboard users cannot scroll it (axe's `scrollable-region-focusable`, not run).

### E-12 — P3 — The DIFF decimal drop creates `+0%` and `-0%`
`web/components/WiGO/tableUtils.ts:104-107`; a second formatter at `web/components/WiGO/StatsTable.tsx:289-291`.

**Failure.** A sign taken from the raw value gives `+0%` for +0.4 (the prototype shows it on PTS1%). **Fix:** round first, then take the sign, so it shows `0%`. Use one formatter for desktop and phone. The exact value goes in `title` and the screen-reader text.

### E-13 — P3 — Chart row polish
`web/components/WiGO/ToiLineChart.tsx:205-260,329`, `web/components/WiGO/PpgLineChart.tsx:273`, `web/components/WiGO/StatsTableRowChart.tsx:186-233`.

- TOI ticks are `33:20, 25:00, 16:40, 08:20`, multiples of 500 seconds. Use 5-minute steps.
- In the prototype the legend sits on its own line under the title even with room to share it, costing about 18 px at 301 wide.
- Game log chips take two rows (287x36) at 1280 and repeat values already in the band for rates. For counts they show per-game values the band doesn't, so make them plain toggles ("STD LY CA 3YA L5 L10 L20") on one row and keep the values in `title`. Saves about 18 px.
- Chart text is fixed at 12 px while table text is 14 px at 1920. Add an 11/12/13 tier.
- Fixture y-axis on Game Score runs −5 to 5 for data of 0–2, wasting half the plot. This was not checked on real data for a star.

### E-14 — P3 — Phone table is the old transposed form in a different typeface
`web/components/WiGO/StatsTable.tsx:168-300`, `web/styles/vars.scss:307`.

Cells are Martian Mono at 12 px. Only three periods show, DIFF is off-screen, there is no scroll cue, and the header doesn't carry the L and R markers. See "Phone" below for the replacement.

### E-15 — P3 — Copy that remains after the 10-30 pass

| Where | Now | Suggested |
|---|---|---|
| `RateStatPercentiles.tsx:473` (phone) | "Requested 20252026 · Applied 20242025" | "2024–25 values, not 2025–26": the desktop chip's wording |
| `RateStatPercentiles.tsx:395` | "Loading Player Data..." | "Loading percentiles…" |
| `RateStatPercentiles.tsx:511` | "Calculating..." | "Calculating…" |
| `PlayerRatingsDisplay.tsx:83` | "Loading Ratings..." | "Loading ratings…" |
| `WigoComparisonMatrix.tsx:227` | "Failed to load game log for X." | "Couldn't load the X game log." Pinned by tests. |
| `ConsistencyChart.tsx:204` | "No game data found..." | "No games found for this season." |
| Radar context | "Skaters · 2025–26 · 0–100" | Move to the help note (E-03) |
| Band chart title | "SOG/60 game log" | Keep the full metric name; it is what tells the two `SOG` columns apart |
| Band toolbar caption | "DIFF: % change · counts per game" | Keep; it is short and correct |

Also: phone ratings run Offense, Overall, Defense, while desktop runs Offense, Defense, Overall. Pick one (shots).

### E-16 — P3 — Bold is synthesized
`web/styles/globals.css:1-2`.

Only Roboto Condensed 300 and 400 are declared, yet the page uses weight 700 for headers and DIFF. The browser fakes it. It reads acceptably at 11 px, and adding a real 700 face is a site-wide change with wider text, so I don't propose it here. If it is ever added, re-measure the band.

---

## Space budget

Measured in the prototype. Rects include the panel border. Content height is the viewport minus the 68 px site header and gutters.

### Height (px)

| Row | 1280x800 (722) | 1440x900 (822) | 1920x1080 (1002) |
|---|---|---|---|
| Context bar | 36 | 36 | 36 |
| Top block 1: identity + production, pace, schedule, doughnut, radar | 156 | 178 | 214 |
| Top block 2: rate percentiles, ratings, drivers | 156 | 178 | 214 |
| Band: toolbar 36, group + header, 7 periods, DIFF | 191 | 201 | 221 |
| Charts (remainder) | 183 | 229 | 317 |

Band rows are 15, 16 and 18 px. Text is 11, 12 and 14 px, as in today's tiers.

### Panels (width x height, px)

| Panel | 1280x800 | 1440x900 | 1920x1080 | Holds at floor? |
|---|---|---|---|---|
| Identity | 240x86 | 270x102 | 362x122 | Yes. Same width as today at 1280, so long names behave as now. |
| Season production | 240x62 | 270x68 | 362x84 | Yes |
| Per-game pace | 240x152 | 270x174 | 362x210 | Yes |
| Date/opponent list | 244x152 | 274x174 | 366x210 | Yes |
| Rate percentiles | 732x154 | 823x176 | 1097x212 | Yes, as 4x4 (E-10) |
| Doughnut | 240x152 (canvas 80x123) | 270x174 (92x145) | 362x210 (127x181) | Yes |
| Radar | 240x152 (238x117) | 270x174 (268x153) | 362x210 (360x189) | **Only with E-03 at 1280** |
| Ratings | 203x152 | 229x174 | 305x210 | Yes |
| Team drivers | 281x152 | 316x174 | 423x210 | Yes |
| Band | 1216x187 | 1368x197 | 1824x217 | Yes, with E-01 |
| Metric Game Log | 301x180 | 339x226 | 453x314 | Yes |
| TOI, Points/GM, Game Score | 305x184 each (canvas 295x141) | 343x230 (333x187) | 457x318 (447x275) | Yes |

**Season density.** At 82 games, the plot has about 3.2 px per game at 1280 (about 265 px wide), up from about 1.8 today. Six date ticks need about 28 px each and get about 49.

**Check on real panels.** The document stayed at viewport size at all three sizes, and no leaf text passed a panel edge, on fixture data only. Real-data states such as long error text were not rendered in the prototype.

### Band fit (11 px)

Widest values and headers, measured:

| Group | Headers (bold width) | Widest value (width) |
|---|---|---|
| Totals | GP 12.61, ATOI 20.59, PTS 17.45, G 6.5, A 6.34, SOG 18.83, S% 12.67, PPP 18.3, PPG 18.7, PPA 17.8, PPTOI 27.14, PP% 19.16, HIT 15.16, BLK 17.25, PIM 17.16, ixG 13.86, iCF 14.06 | `28:59` and `06:30` 24.3; `100.0%` 31.59; three digits 16.3; `78.9` 19.2; two digits 10.88 |
| Per 60 | G 6.5, A 6.34, PTS 17.45, SOG 18.83, ixG 13.86, iCF 14.06, PPP 18.3, PPG 18.7, PPA 17.8, iHDCF 27.16, iSCF 19.77, HIT 15.16, BLK 17.25, PIM 17.16 | `33.83` 24.63; extreme `120.00` 30.06 |
| On-ice | IPP 14.95, oiSH% 27.55, OZS% 24.91, PTS1% 29.84, PTS1/60 37.81 | `100.0%` 31.59; `24.00` 24.63 |
| DIFF (no decimal) | n/a | `-100%` 25.98; `+999%` 28.73; `+3585%` 34.16; `+12000%` 39.59. With a decimal `+102.8%` is 37.06. |
| Period | `3YA L` 24.81; `DIFF` 19.63 | n/a |

The widest-value list is my estimate of realistic ceilings by format, plus real values seen in L2–L5. It is not a production maximum.

Total width against the 1,214 px available at 1280:

| Case | Pad 3 | Pad 2 | Pad 1.5 | Pad 1 | Source |
|---|---|---|---|---|---|
| Fixture values | 1117 | 1043 | 1006 | 969 | Rendered |
| Every column `+999%`, widest values | n/a | **1225 (over by 11)** | 1188 | n/a | Rendered |
| Every column `-100%` width | 1245 | 1167 | 1128 | 1089 | Calculated |
| Headers and values only | 1105 | 1027 | 988 | 949 | Calculated |
| Every column `+999%` plus extreme `120.00` | 1332 | 1254 | 1215 | 1176 | Calculated |
| Every column `+3585%` (not a realistic case) | 1495 | 1417 | 1378 | 1339 | Calculated |
| Keeping DIFF's decimal, `+102.8%` | 1597 | 1519 | 1480 | 1441 | Calculated |
| Full headers with "/60", `+999%` | 1376 | 1298 | 1259 | 1220 | Calculated |

The calculated rows run about 20 px high, because they count a DIFF for GP and allow 3 px on the period column.

**One band fits at 1280** with the group row, short labels and no DIFF decimal, at a 1.5 px floor. TJ's two space-savers are both needed: keeping either the decimal or the "/60" overflows. At 1440 (1,366 available) the same case fits at 2 px: 1344 calculated. At 1920 (1,822) it fits at 3 px: 1619.

### Grid proposal

Nest the grid. A flat 60-track grid can't carry gaps, so use `3fr 2fr` for the top block with its own sub-grids.

```
Context  ─────────────────────────────── full width, auto
Top      │ bio 3fr                        │ right 2fr                │
         │ identity │ pace    │ schedule  │ doughnut │ radar         │   row 1
         │ prod     │ pace    │ schedule  │ doughnut │ radar         │
         │ rate percentiles (4x4)         │ ratings  │ drivers       │   row 2
Band     ─────────────────────────────── full width, auto height
Charts   │ game log │ TOI │ Points/GM │ Game Score │   four equal, remaining height
```

| Breakpoint | Rows | Band padding floor |
|---|---|---|
| 1280x800 | `auto 90px 66px 156px auto minmax(150px,1fr)` | 1.5 px |
| 1440x900 | `auto 106px 72px 178px auto minmax(180px,1fr)` | 2 px |
| 1920x1080 | `auto 126px 88px 214px auto minmax(240px,1fr)` | 3 px |

The prototype used a 4 px gap. Today's gap is 6 px; keeping it takes about 8 px from the charts at 1280. The 95% must stay page-local: `$page-max-width` is shared with other pages (`web/styles/vars.scss:337`).

---

## Hierarchy and scanning with 36 columns

From the band crop (`E-proto-band-1280-fixture.png`). It reads better than I expected.

- **What works:** rows are short enough to scan, and 7 periods plus DIFF stay in view. DIFF as a bold bottom row under a rule is clear. L and R on the row labels are stronger than the old header markers, because the whole row tints.
- **Separators:** the 4 px group gap is too quiet at 1280, since Totals, Per 60 and On-ice blur at the join. Use a stronger group gap with a one-step-lighter background on the middle group. No drawn lines are needed.
- **Selected metric:** a tinted column plus a header underline follows the old row treatment and finds the eye quickly. Contrast passes: `#ccc` on the selected column 7.50:1, and on the selected column crossing the R row 6.74:1.
- **Distance:** a metric at the far right is about 1,200 px from the game log at far left. The chart title carries the full name, so this is acceptable. Consider putting the game log directly beneath wherever TJ prefers; the settled order is kept here.
- **L label contrast:** `#14a2d2` on its 16% tint is 4.54:1, just passing. Keep the lightened blue from 10-30. Amber is 7.25:1.

---

## Phone (390x844)

Measured with a prototype band on the Comparison tab: 13 px Roboto Condensed, 6 px padding, 28 px rows, 32 px header. Table 1502x278, pinned column 45 px, 8 metric columns on the first screen, about 4.2 screens of scroll. The band starts at y=342 and ends at y=620, leaving about 224 px for the chart before the fold, less the site's bottom nav (not measured).

**Better than today:** all periods and DIFF are visible at once. Today DIFF is off-screen.

**What it needs:**
- Group labels that stick. This worked in the prototype, though two labels can show at once.
- Jump buttons "Totals, Per 60, On-ice" above the table.
- Scrolling the selected column into view on load.
- An edge fade or similar scroll cue.
- Opaque pin (E-11).

**Header targets:** 32 px tall by at least about 30 wide passes the 24 px minimum. It is under 44 px, as is true of most of this dense table. TJ decided on side-scroll, so this is a known tradeoff.

**Recommended regrouping:**

| Tab | Contents | Change |
|---|---|---|
| Overview | Identity, production, pace, schedule | Ratings and drivers leave, saving about 490 px of 1,806 (read off the shot). Production and pace repeat G, A, PTS and SOG per game; drop the repeats from one of them. |
| Trends | Doughnut, TOI, Points/GM, Game Score | Radar leaves. Doughnut stays because it describes games. |
| Percentiles | Radar, rate percentiles, ratings, drivers | One tab for "how does this player rank". Keep the printed radar values. |
| Comparison | Compare dropdowns, band, Metric Game Log, then the L5/L10/L20 note | The game log moves here because the table drives it, and replaces the 35 "+" expanders. |

This is a judgment call, and TJ has not seen it.

---

## Accessibility left after the 10-30 pass

| # | Issue | WCAG | Severity | Finding |
|---|---|---|---|---|
| 1 | Column header name read on every cell | 1.3.1, 4.1.2 | Major | E-02 |
| 2 | Radar has no text alternative; values hover-only | 1.1.1, 2.1.1 | Major | E-03 |
| 3 | Lines over bars under 3:1 | 1.4.11 | Major | E-04 |
| 4 | 35 stops in one row | 2.4.3 | Minor | E-09 |
| 5 | Scroll wrapper not focusable (new, phone and flow) | 2.1.1 | Major | E-11 |
| 6 | Doughnut canvas has no name; its list covers the content | 1.1.1 | Minor | Add `aria-hidden` or a label at `ConsistencyChart.tsx:213` |
| 7 | Game log's `aria-label` is "SOG/60 by game", with no values | 1.1.1 | Minor | Add a one-line summary |

---

## UI passes, one at a time

Each is one approve-or-edit step for TJ, with before and after shots. Data lanes' fixes are separate, and the percentiles tile's real look depends on C-23.

| # | Pass | What TJ sees | Findings |
|---|---|---|---|
| 1 | Width and thresholds | 95% on this page only; fit floor 1280 | E-05 |
| 2 | New grid with the band | The whole target layout: band, group row, L and R on rows, DIFF without decimal, auto columns. The one big step, since neither fits without the other. `e2e/wigo-one-page.spec.ts` will need updating (not read in detail). | E-01, E-07, E-12 |
| 3 | Header as the metric control | Selected column, focus ring, arrow keys, screen-reader names | E-02, E-09 |
| 4 | Bio group wide slot | 4x4 tiles, capped slider, filter line | E-10 |
| 5 | Doughnut and radar pair | One-line title, short labels, ticks off, radar values | E-03 |
| 6 | Chart row consistency | Dates, ticks, grid, legend on the title line, one-row chips, type tiers | E-13 |
| 7 | Metric Game Log honesty | Bars or straight segments, real gaps, mean moved to the title | E-08 |
| 8 | Chart colour roles | Recessive bars, one meaning per colour, L and R match the table, legend in ink | E-04 |
| 9 | Sparse players | DIFF note, `—` tiles with one reason | E-06 |
| 10 | Phone band | Comparison tab: pinned band, jump buttons, game log below | E-11, E-14 |
| 11 | Phone regrouping | Tabs reorganised | Phone section |
| 12 | Copy and final accessibility | Copy table; Axe if the server is back; a VoiceOver run | E-15, A11y table |

Pass 2 touches a stylesheet: run the CSS Modules pure-selector check, which Vitest misses.

**Decisions for TJ, by pop-up:**
- Move `PTS1/60` to Per 60 (E-07). Recommended: yes.
- Bars for counts in the game log (E-08). Recommended: yes.
- Rookie default comparison when CA is empty (E-06). Recommended: keep STD vs CA and show the note.
- The phone regrouping above.

---

## Re-verified old items

| Item | State |
|---|---|
| 10-30 #7 tab state | Fixed (`aria-current`, `wigoCharts.tsx:102`) |
| 10-30 #8 canvas text | Fixed for TOI, Points, Game Score and phone percentiles. **Radar and doughnut were not in that list and remain open** (E-03). |
| 10-30 radar `100`/`50` overlap | Still open (E-03) |
| 10-30 game mean label over lines | Still open; accepted then, fixable now (E-08) |
| 10-30 loading placeholders in `WigoDashboardSections` | Fixed for charts; three others remain (E-15) |
| 10-30 "Failed to load game log" copy | Still open (E-15) |
| 10-25 A/B/C data items (A-02, B-05 and others) | Not in this lane; see A–D |
| A: TOI legend "Avg (min)" with mm:ss values | Still open, seen in shots |

## Not checked

- Axe (`analyze`, `igt`): server down. VoiceOver or NVDA, forced colours, live keyboard use.
- The real components in the new layout. The prototype moves real panels but the band table is a stand-in, and Chart.js radar tests ran outside the page.
- The prototype with real data. Long names and error text are judged from L1–L6 at today's panel sizes.
- Viewports between the three tested sizes, and 769–1279 flow.
- No-player state in the new layout.
- Production maximums for the widest values.

---

## Revised top block (TJ, 11-01)

**Grid tested**, on the same fixture-only setup:

```
row 1: identity + production | pace                       | date/opponent list | ratings | RADAR
row 2: doughnut              | rate percentiles (pace + list)                  | drivers | RADAR
```

**Verdict.** It holds with no scroll at all three sizes, and it is better than the first version: the radar goes from a 31 px radius to 108 px and needs no compromises. The document stayed at viewport size each time.

**Three things don't hold as first guessed:**
1. **Pace at 230 px clips** its `Pace/84` header (39 in 37 px) at 1280. It needs 236, which I took from the radar.
2. **4x4 tiles fail** at 1280 and 1440. Use **3x6**.
3. **"Rank unavailable" does not fit in 3x6** at 1280 (10 of 16 tiles overflow) or 1440 (2 of 16). Sparse tiles must show `—` instead. Without that, the labels overprint.

Drivers also get cramped at 1280 when the partial-coverage note shows (see section 4).

**Screens:** `E-proto2-<size>-fixture.png`, and `E-proto2-<size>-high.png` for the worst case. The worst case uses every DIFF at `+999%`, widest values, a long name, two chips, sparse tiles, 7 doughnut rows and all three driver notes.

### 1. Grid per breakpoint

Panel widths at a 4 px gap. The prototype's margins make some rects up to 4 px wider than these.

| Breakpoint | Identity, doughnut | Pace | List | Ratings, drivers | Radar | Rows (top) | Radar panel | Charts height |
|---|---|---|---|---|---|---|---|---|
| 1280x800 | 230 | 236 | 190 | 240 | 304 | `90px 66px 156px` | 304x308 | 180–184 |
| 1440x900 | 258 | 258 | 214 | 270 | 352 | `106px 72px 178px` | 352x352 | 226–230 |
| 1920x1080 | 343 | 343 | 285 | 360 | 477 | `130px 102px 232px` | 477x460 | 278–282 |

- Full row template: `auto <top rows> auto minmax(<150|180|240>px, 1fr)`. The band row is unchanged at 187, 197 and 217 px.
- Identity and production share the first 156 px cell at 1280 (86 + 62 px panels), and hold.
- Today's 6 px gap would take 8 px from the radar's width at 1280.
- Band padding floors stay 1.5, 2 and 3 px.
- Sizes between these three were not tested. Scale in proportion, and keep pace at 236 or more.

### 2. Radar

Measured by running Chart.js at the real canvas size (6 px padding, 12 px labels).

| Canvas | Full labels + ring ticks | + values on a second line | + values on the same line |
|---|---|---|---|
| 302x287 (1280) | **108 px** | 95 px | 91 px |
| 350x331 (1440) | 132 px | 117 px | 115 px |
| 475x439 (1920) | 186 px | 171 px | 178 px |

- **Full labels and ring ticks stay.** The title and context fit on one line, so E-03's short labels and ticks-off are no longer needed.
- **Print the values:** yes, two-line labels like the phone's ("27" over "GOALS") cost about 13–15 px of radius and solve the hover-only problem. This was measured in standalone Chart.js and not rendered in the page. Still add the `aria-label`.
- **New concern:** the radar is now the largest and most saturated thing on the page, above identity and the table. Lighten its fill so it doesn't outrank them. Printed values also add precision to small-sample percentiles (C-28), so they should wait on or go with that fix.

### 3. Rate percentiles (434x154 at 1280)

| Layout | 1280 | 1440 (480x176) | 1920 (636x230) |
|---|---|---|---|
| 4x4, normal tiles | **Fails**: 97.5 px tile, needs up to 127. 6 of 16 overflow. | **Fails**: 110.5, needs 129. 1 of 16 overflows. | Fits |
| 3x6, normal tiles | **Fits**: 134.7x15.5 | Fits: 150x19.2 | Fits: 202x28.2 |
| 3x6, `—` tiles, two chips | **Fits** | Fits | Fits |
| 3x6, "Rank unavailable" | **Fails**: 10 of 16 overflow (needs 149) | **Fails**: 2 of 16 | Fits |

The 4x4 figures come from the first run of this grid at 428 px wide; the 6 px since added doesn't change the result.

- **Filter area:** two lines, 50 px. Title, strength pills and slider go on line 1, with the slider capped at 173–180 px. Player GP and chips go on line 2, including both real chips from L2.
- **1280 is tight:** the tile is 15.5 px against 15.2 needed (13.2 text + 2 for the meter). It fits but has no slack, so check it on real data.
- **`— —`:** in my worst-case shot a sparse tile shows two dashes. Show one.
- **Order:** 16 tiles in 3 columns leaves two cells empty. Column-first flow (6, 5, 5) keeps today's order. The prototype used row-first.

### 4. Ratings and drivers

- **Ratings at 240:** no clipping and no wrapping at any size. Wider than today's 189.
- **Drivers at 240, normal state:** no clipping and no wrapping. Note this is narrower than today's 285.
- **Drivers at 240x152, with all three source notes:** stays inside the panel, but the note runs to five lines and squeezes the cards until the status lines touch the next row's labels (`E-proto2-1280x800-high.png`). The notes are long-hand strings I injected to the shape of `TeamPerformanceDrivers.tsx:88-98`. Shorten the partial note to fit one line, such as "Partial: covered games only". I did not re-measure with the shorter copy.
- My automatic clip check skips text blocks containing a `<br>`, so the note was judged from the screenshot.

### 5. Doughnut at 230x156, 7 rows

**Holds.** Canvas 77x123, list 127x98, 17 px spare at the bottom of the panel at 1280 (28 px at 1440, 55 px at 1920). The seven rows were cloned into the list to McDavid's count. The ring itself still drew the fixture's four segments, and the label colours on the cloned rows are not meaningful.

### 6. Band after moving `PTS1/60` to Per 60 as `PTS1`

**Still fits.** Rendered total width in px, against available width:

| Size (available) | Case | Pad 3 | Pad 2 | Pad 1.5 | Pad 1 |
|---|---|---|---|---|---|
| 1280 (1214) | Fixture | 1106 | 1032 | **995** | 958 |
| 1280 (1214) | Every DIFF `+999%`, widest values | 1290 | 1216 (over by 1.5) | **1179** | 1142 |
| 1440 (1366) | Fixture | 1186 | **1112** | 1075 | 1038 |
| 1440 (1366) | Every DIFF `+999%`, widest values | 1386 (over by 20) | **1312** | 1275 | 1238 |
| 1920 (1822) | Fixture | **1346** | 1272 | 1235 | 1198 |
| 1920 (1822) | Every DIFF `+999%`, widest values | **1579** | 1505 | 1468 | 1431 |

The move saves about 10 px at 1280 in the worst case (1225 to 1216 at pad 2). I put `PTS1` last in Per 60. This closes the `PTS1/60` part of E-07.

### Changes to the UI passes

| Pass | Change |
|---|---|
| 2, grid and band | Use the grid above. `PTS1` move is decided (TJ). Pace minimum 236. |
| 4, bio group wide slot | Rename "Rate percentiles slot". **3x6, not 4x4**, column-first. The `—` for sparse tiles moves here from pass 9, because the layout depends on it at 1280 and 1440. Add the shortened drivers note here too. |
| 5, doughnut and radar pair | Rename "Radar and doughnut". **Keep full labels and ring ticks; drop the short labels and ticks-off.** Add printed values (timing tied to C-28), the `aria-label` and a lighter fill. The doughnut's own step becomes small: no changes needed for fit. |
| 9, sparse players | Keeps the DIFF note only. |
| 3, 6, 7, 8, 10, 11, 12 | Unchanged. The phone is not affected by this grid. |

### Not checked in this rerun

Same limits as above: no Axe (still not connected), no real data in the prototype, and no sizes between the three tested. Real long error text in the ratings panel and the chips' real wording were not rendered. Isolated server stopped by exact PID (63259, 63258); no application changes and no git.
