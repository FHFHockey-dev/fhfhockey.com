# WiGO post-ship critique (2026-11-03)

Critique only; no code changed. Page: `/wigoCharts` at octoberBranch `a0d2a7ef4` (the shipped #406 code). Fixture data (Alex Fictional, 9900001) on the isolated :3150 server.

Skills run: `frontend-design` (FD), `design:design-critique` (DC), `design:design-system` (DS), `unslop` in polish mode (US). TJ's settled choices are out of scope and were not marked down: the "What Is Going On" italic caps tagline, the page width (95% on this page), team colours and the approved layout.

Screens are in `screens/`:
- Full captures: `ps-1280x800.png`, `ps-1440x900.png`, `ps-1920x1080.png`, `ps-390x844-{overview,trends,percentiles,comparison}.png`.
- Crops: `ps-crit-phone-radar-header.png`, `ps-crit-phone-pergame.png`, `ps-crit-phone-ratings-drivers.png`, `ps-crit-1920-top.png`.

Computed sizes come from `tools/measure-postship.cjs`.

**Unslop verdict:** light slop, so polish mode. There are no gradients, glows, emoji, hype copy or looping motion. The signs left are tracking, a few uppercase labels, outlines in every rating colour, and stray hand-set values.

## Findings

| # | Severity | Finding | Where | Screen | Raised by |
|---|---|---|---|---|---|
| 1 | High | The per-game table's number font is invalid CSS: `font-family: "roboto-condensed" sans-serif` has no comma, so the browser drops the declaration. | `web/components/WiGO/PerGameStatsTable.module.scss:121`, `:195` | ps-crit-phone-pergame.png | DS |
| 2 | High | On the phone, per-game numbers are tracked 0.15em (1.8 px), so "0.17" reads as "0 . 1 7". Numbers need tabular figures, not tracking. | `PerGameStatsTable.module.scss:123`, `:197` | ps-crit-phone-pergame.png | US (type), FD |
| 3 | Medium | Phone radar header is upside down: the context line "All skaters · 2025–26 · 0–100" is 16 px and its title "Category percentiles" is 12 px. The phone scope has no size for `.radarContext`. | `web/styles/wigoCharts.module.scss:2672` (12 px rule at `:2009` doesn't reach the phone) | ps-crit-phone-radar-header.png | DC (hierarchy) |
| 4 | Medium | The fallback warning shows raw season IDs ("Showing 20242025 player values … not 20252026") right under a chip that says "2024–25 values, not 2025–26". The same fact appears twice, in two formats. | `web/utils/fetchWigoPercentiles.ts:327` | ps-crit-phone-radar-header.png | US (copy, number format), DC |
| 5 | Medium | At 1920×1080 the top row has dead space. The identity card is half empty, the drivers panel has a gap of about 100 px mid-panel, the consistency doughnut is small in its cell, and per-game rows are 40 px tall with 14 px text. The large tier grows rows but not content. | Grid tiers in `wigoCharts.module.scss` (the 1800w tier) | ps-crit-1920-top.png | DC (whitespace), US (spacing) |
| 6 | Medium | Phone ratings outline all nine boxes in their rating colour (yellow and green), so nothing leads. The colour already sits on the value. | `web/components/WiGO/PlayerRatingsDisplay.tsx:124-127`, `PlayerRatingsDisplay.module.scss:184` | ps-crit-phone-ratings-drivers.png | US ("every element highlighted"), DC |
| 7 | Medium | Driver values change family by viewport: Martian Mono 14 px on the phone, Roboto Condensed 11 px on desktop. The mono face shows up only here. | `web/components/WiGO/TeamPerformanceDrivers.module.scss:42` | ps-crit-phone-ratings-drivers.png | DS, FD (mono for data labels) |
| 8 | Low | The ratings order differs by viewport: desktop rows run Offense, Defense, Overall; phone columns run Offense, Overall, Defense. | `PlayerRatingsDisplay.module.scss:170` (`order: 3`) | ps-crit-phone-ratings-drivers.png vs ps-1280x800.png | DC (consistency) |
| 9 | Low | Uppercase tracked labels remain beyond the tagline. On phone ratings, OFFENSE, OVERALL and DEFENSE carry 1 px tracking. Other rules: `wigoCharts.module.scss:323, 335, 372, 438, 571, 970, 1176, 1276, 1599`; `PerGameStatsTable.module.scss:111, 128`; `TeamPerformanceDrivers.module.scss:52`. Some may be legacy (see #12). | `PlayerRatingsDisplay.module.scss:76` | ps-crit-phone-ratings-drivers.png | US, FD |
| 10 | Low | Colours are hard-coded instead of using tokens: `#3a3a3a`, `#777`, `#555`, `#444`; the compare highlight hexes are redeclared as local variables; TimeframeComparison hard-codes `#07aae2`/`#ffcd56` instead of `WIGO_CHART_ROLES` / `v.$primary-color`. | `wigoCharts.module.scss:488, 501, 678-679, 909, 1195-1196`; `TimeframeComparison.module.scss:108-120` | (none visible) | DS |
| 11 | Low | Spacing is off the 4 px grid in 37 padding, margin or gap values: 3 px ×23, 5 px ×12, plus 15 px and 25 px. Dense tables can keep 2 px nudges, but 3 and 5 px gaps between blocks cause the uneven rhythm. | `wigoCharts.module.scss`, `components/WiGO/*.module.scss` | (none visible) | US (spacing), DS |
| 12 | Low | Dead CSS. `.statsTable` / `.statsTableContainer` (about 220 lines, `wigoCharts.module.scss:648-870, 2514`), `.chartRowExpanded`, `.combinedStatsTableContainer`, `.rateStatBarPercentilesComponent` and `.timeframeComparisonWrapper` are unused. `web/components/WiGO/wigoCharts.module.scss` isn't imported anywhere. The legacy `.chartTitle h3` rules set Lucida Sans with 12 px tracking (`:438-446, :571-577`); the shipped headers look overridden, so verify on removal. `.statsTableNote` is still used by the band and should be renamed. | as listed | (none visible) | DS |
| 13 | Low | The legend row "Cardio: 0.0% (0)" is unexplained apart from a hover title. It reads as a fifth outcome next to 0/1/2/3 pts. | `web/components/WiGO/ConsistencyChart.tsx:94` | ps-1280x800.png (consistency panel) | DC, US (copy) |
| 14 | Low | Meta strings joined with middle dots repeat in every panel ("All skaters · 2025–26 · 0–100", "20 GP · vs 420 skaters with 5+ GP", "Player GP: 20 · all skaters"). That's acceptable in a stats UI, but two or three in one panel get noisy. | `WigoDashboardSections.tsx:328, 390`; `RateStatPercentiles.tsx` | ps-1280x800.png | FD (template chrome) |

## What works (keep)
- One-page fit at 1280×800 with the horizontal band; the band reads as the page's main element (DC).
- Charts have one role colour per series, ink legends and surface rings; no rainbow or glow (US, dataviz).
- Status copy is plain and specific; empty and failed states say why (US copy pass clean).
- Phone tabs follow the plan's grouping; the band scrolls with a pinned period column (DC).

## Suggested pass order if approved
1. Type fixes: #1, #2, #3, #7 and #9's visible labels (small, safe; phone heavy).
2. Copy: #4, #13 (and #14 if wanted).
3. Ratings emphasis and order: #6, #8.
4. 1920 tier: #5 (largest visual change; needs its own screenshots).
5. Cleanup with no visual change: #10, #11, #12.
