# Toenail left-border sweep — 2026-11-04

Report only. No code was changed. Fixes wait for TJ's approval.

**Rule (TJ, 2026-11-04):** a coloured `border-left`, or an inset left `box-shadow` stripe, on a rounded box is banned when the stripe is thinner than the left corner radius. In that case the inner edge curves.
**Approved fix** (`.poolNotice`, `web/components/PlayerPickupTable/PlayerPickupTable.module.scss:625`): `border-left: 4px solid <accent>; border-radius: 4px 6px 6px 4px;`. Set the left radius to the rule width and keep the card's right-hand rounding. Size the rule to the card.

## Method

- **Rendered sweep.** Playwright 1.60 (`web/node_modules/playwright`, headless Chromium) ran against TJ's dev server on `:3000`. Page loads ran one at a time, and no second `next dev` was started.
  - Viewports: 390×844 (mobile emulation) and 1440×900.
  - Each page waited for network idle, was scrolled to the bottom so lazy content would load, then waited 2.5 s.
  - Every element and its `::before`/`::after` was checked against `getComputedStyle`. An element was flagged when its `borderLeftWidth` was above 0 and below max(top-left radius, bottom-left radius), and its left side was an accent: a different colour from the top border, or a wider border than the top. An inset left shadow stripe (x > 0, y = 0, blur = 0) on a rounded box was also flagged.
- **Static scan.** I scanned every `.scss`/`.css` file under `web/components`, `web/styles` and `web/pages` for any rule block that sets a left accent of 2 px or more (or an inset left shadow) together with a non-zero radius. This catches states the render did not show (hover/active, loading, empty, modals, logged-in) and pages outside the sweep.
- **Pages:**
  - `/` and `/game-grid/7-Day-Forecast`.
  - `/forge/dashboard`, which redirects to `/forge/command-center`.
  - `/underlying-stats`, `/stats`, `/trends`, `/nhl-predictions`, `/lines`, `/drm`, `/splits`, `/draft-dashboard`, `/roster-schedule-optimizer`, `/start-chart`, `/wigoCharts`, `/shiftChart`, `/variance/skaters`, `/variance/goalies`, `/blog`, `/podfeed`.
  - Every page returned 200 at both viewports. I also tried `/buy-low-sell-high`, which returned 404: that route only has `preview`/`trade` pages, so BLSH is covered by the static scan alone.
- **Sweep scripts** (scratch, not committed): `/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/b9cfbcc6-dfa8-4b76-b5f1-e94700372c1b/scratchpad/sweep/sweep.cjs` and `static.cjs`.

## Summary

| Result | Pages |
|---|---|
| Clean at both viewports | `/`, `/game-grid/7-Day-Forecast`*, FORGE command center, `/trends`, `/nhl-predictions`, `/lines`, `/drm`, `/splits`, `/start-chart`, `/wigoCharts`, `/shiftChart`, `/variance/skaters`, `/variance/goalies`, `/blog`, `/podfeed`, `/draft-dashboard`* |
| Rendered toenails | `/stats` (6 selectors), `/underlying-stats` (1), `/roster-schedule-optimizer` (2) |
| Static-only toenails (state or page not rendered) | 14 selectors, listed in section B |

\* These pages were flagged by the raw detector, but on inspection the flags are false positives: each is a uniform 1 px outline with the top edge dropped for stacking, not an accent. Details are under "False positives" below.

## A. Rendered toenails (confirmed in the browser)

| # | Page / viewport | Element (sample text) | SCSS module : line, selector | Left width / left radius | Proposed fix |
|---|---|---|---|---|---|
| A1 | `/stats` mobile + desktop | Quick-stat cards ("POINTS LEADER Connor McDavid", ".945 SAVE PERCENTAGE"), 350×68 | `web/styles/Stats.module.scss:73-81` `.quickStatCard.scoring / .goaltending / .league` (`border-left: 4px`); radius comes from `.quickStatCard` (`:56`, `:462`), rendered as 12px | 4px / 12px | Keep `border-left: 4px`; add `border-radius: 4px 12px 12px 4px` to the three variant rules (or once on `.quickStatCard` if every card has an accent). |
| A2 | `/stats` mobile | Active filter pill "All Players", 161×44: `::before` overlay | `web/styles/Stats.module.scss:193-199` `.filterButtonActive::before` (`border-left: 4px solid $warning-color; border-radius: inherit`), with the 8px radius inherited from `.filterButton` | 4px / 8px | Set `border-radius: 4px 0 0 4px` on the `::before` (instead of `inherit`) and on the active pill's left corners: `.filterButtonActive { border-radius: 4px 8px 8px 4px; }`. Or drop the overlay stripe, since the pill is already filled with the primary colour. |
| A3 | `/stats` mobile | Mobile leaderboard cards ("POINTS PTS 1 CONNOR MCDAVID…"), 334×378 | `web/styles/Stats.module.scss:1850-1859` `.mobileLeaderboardCard` (`border-left: 3px; border-radius: $border-radius-md` = 8px) | 3px / 8px | This is a large card, so scale up: `border-left: 6px solid $primary-color; border-radius: 6px 8px 8px 6px;`. Or keep 4px with `4px 8px 8px 4px`. |
| A4 | `/stats` mobile | Mobile leader rows 1–5 inside those cards, 298×52 | `web/styles/Stats.module.scss:1937-1976` `.mobileLeaderItem` `&:nth-child(1..5)` (`border-left: 3px` green/lime/amber/red); radius `$border-radius-sm` = 4px (`:1945`) | 3px / 4px | Change each nth-child rule to `border-left: 4px`. The radius is already 4px, so the width change alone flattens the inner edge. |
| A5 | `/stats` desktop | Left-sidebar leader rows ("LEON DRAISAITL EDM…"), 353×75, 24 rows | `web/styles/Stats.module.scss:1347-1386` `.leaderRow` `&:nth-child(1..5)` (`border-left: 3px`); radius `$border-radius-sm` = 4px (`:1355`). Also `:142-150` (4px, overridden) | 3px / 4px | Same as A4: make the five nth-child rules `border-left: 4px`, which brings the width up to the 4px radius. |
| A6 | `/stats` desktop | Expanded leader row (McDavid) | `web/styles/Stats.module.scss:1396-1402` `.leaderRowExpanded` (4px, but the mobile media query sets it to 3px); rendered as 3px | 3px / 4px | Delete the mobile `border-left-width: 3px` override so it stays at 4px. |
| A7 | `/underlying-stats` mobile + desktop | Active power-leader button ("1 CAR Carolina Hurricanes 124.9"), 340×50 | `web/components/underlying-stats/UnderlyingStatsDashboard.module.scss:741-744` `.itemActive` (`box-shadow: inset 3px 0 0 $accent`) on `.powerLeader` (radius `$radius-panel` = 10px, `:583`) | 3px inset shadow / 10px | An inset shadow can never be flat on a rounded box. Replace it with `border-left: 4px solid $accent; border-radius: 4px 10px 10px 4px;`, compensating padding by −3px left. Check whether `.itemActive` is used on other rounded items before changing the shared class. |
| A8 | `/roster-schedule-optimizer` mobile + desktop | "STREAMING PLAN" itinerary card, 356×87 | `web/components/RosterScheduleOptimizer/StreamingItinerary.module.scss:5` `.itinerary` (`border-left: 4px; border-radius: s.$radius-small` = 6px) | 4px / 6px | `border-radius: 4px 6px 6px 4px;` (this exactly matches the approved pattern). |
| A9 | `/roster-schedule-optimizer` desktop | "Review and confirm planning inputs…" gate in the candidate panel, 340×27 | `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss:643` `.candidatePanel .confirmGate` (`border-left-width: 3px`) over `:584` `.confirmGate` (4px, radius 6px) | 3px / 6px (base rule 4px / 6px) | In the base rule `:584`, use `border-radius: 4px 6px 6px 4px`; in `:643`, drop `border-left-width: 3px` (or set the left radius to 3px, but 4px matches the approved card size). |

## B. Static-only toenails (not rendered during the sweep)

These were found in SCSS. The radius values are resolved from `web/styles/vars.scss`: `$border-radius-sm` 4, `$border-radius-md` 8, `$radius-sm`/`$radius-control`/`s.$radius-small` 6, `$radius-md`/`$radius-card`/`$radius-panel` 10. I did not check them in the browser, because each one appears only in a state or page the sweep did not reach.

| # | Where it shows | SCSS module : line, selector | Left width / radius | Proposed fix |
|---|---|---|---|---|
| B1 | Mobile nav menu, active link (all pages, menu open) | `web/components/Layout/MobileMenu/MobileMenu.module.scss:321` `a` (`border-left: 3px solid transparent; border-radius: 5px`); `&[aria-current]` sets `border-left-color: $primary-color` | 3px / 5px | `border-left: 4px solid transparent; border-radius: 4px 5px 5px 4px;`, or round all corners to 4px. |
| B2 | `/stats` mobile loading skeleton | `web/styles/Stats.module.scss:2086` `.mobileLeaderboardCardSkeleton` | 3px / 8px | Match A3. |
| B3 | `/stats` desktop loading skeleton | `web/styles/Stats.module.scss:2256` `.leaderRowSkeleton` | 3px / 4px | Match A5 (4px). |
| B4 | Player pages (`/stats/player/...`): cards and the streak card | `web/components/PlayerStats/PlayerStats.module.scss:28` `%card-base` and `:1728` `.streak` (`border-left-width: 6px; border-radius: $radius-md`) | 6px / 10px | `border-radius: 6px 10px 10px 6px;` |
| B5 | Player page shell metric tiles | `web/components/PlayerStats/PlayerPageShell.module.scss:155` `.metric` | 6px / 10px | `border-radius: 6px 10px 10px 6px;` |
| B6 | RSO page notice | `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss:58` `.notice` | 4px / 6px | `border-radius: 4px 6px 6px 4px;` |
| B7 | RSO toast | `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss:600` `.toastSlot` | 3px / 6px | `border-left: 4px …; border-radius: 4px 6px 6px 4px;` |
| B8 | RSO healthy-reserve alert | `web/components/RosterScheduleOptimizer/HealthyReserveAlert.module.scss:5` `.alert` | 4px / 6px | `border-radius: 4px 6px 6px 4px;` |
| B9 | Draft dashboard, Yahoo live-draft info notice | `web/components/DraftDashboard/YahooLiveDraftPanel.module.scss:397` `.infoNotice` | 3px / 6px | `border-left: 4px …; border-radius: 4px 6px 6px 4px;` |
| B10 | Draft settings points input | `web/components/DraftDashboard/DraftSettings.module.scss:531` `.pointsInput` | 2px / 10px | This is an input field, so a stripe is odd here; prefer a uniform focus outline. If the stripe stays: `border-left: 4px …; border-radius: 4px 10px 10px 4px;` |
| B11 | BLSH trade page evidence panel | `web/components/blshTrade/BlshTrade.module.scss:89` `.evidence` | 4px / 6px | `border-radius: 4px 6px 6px 4px;` |
| B12 | BLSH trade page retrospective | `web/components/blshTrade/BlshTrade.module.scss:120` `.retrospective` | 4px / 6px | `border-radius: 4px 6px 6px 4px;` |
| B13 | Team schedule calendar sidebar (team pages) | `web/components/TeamScheduleCalendar/TeamScheduleCalendar.module.scss:183` `.gameStatsSidebar` | 4px / 8px | `border-radius: 4px 8px 8px 4px;` |
| B14 | Blog post blockquotes | `web/styles/Post.module.scss:149` `blockquote` | 3px / 8px | `border-left: 4px …; border-radius: 4px 8px 8px 4px;` |

**Game Grid: owned by the audit session, so I only note this one.** `web/components/GameGrid/GameGrid.module.scss:2690` and `:2721` set `> td:first-child` to `border-left: 2px solid $schedule-green / $schedule-red` with `border-top-left-radius: $border-radius-sm` (4px), which gives 2px / 4px. This did not render as a hit on `/game-grid/7-Day-Forecast` at either viewport, so it is probably state-specific. Passing it to the Game Grid audit session.

**Static hits that pass the rule (no action):**

| Selector | Left width / radius |
|---|---|
| `LegacySurfaceNotice.module.scss:9 .notice` | 4 / 4 |
| `PlayerPickupTable.module.scss:625 .poolNotice` (the approved reference) | 4 / 4 |
| `PlayerPageShell.module.scss:42 .topbar` | 10 / 10 |
| `RosterScheduleOptimizer.module.scss:188 .topbar, .metrics article` | 10 / 10 |
| `SuggestedPicks.module.scss:147 .card` | 10 / 10 |
| `GameGrid.module.scss:3132 .titleRow` | 12 / 4 |
| `useGoals.module.scss:12 .goalIndicator` (bottom corners 0) | 2 / 2 |

## False positives from the raw detector (not toenails)

- `/game-grid/7-Day-Forecast` mobile, `GameGrid.module.scss:3221` `.mobileGameGridAll .scheduleGridContainer`: a uniform 1px `$border-subtle` outline on the right, bottom and left; the top edge comes from a different rule. Not an accent.
- `/game-grid/7-Day-Forecast` mobile, `PlayerPickupTable.module.scss:582` `.metricsDisclosure`: a uniform 1px outline, with the top border removed on stacked rows (`& + &`).
- `/draft-dashboard` desktop, `MyRoster.module.scss:173-187` `.slotPlayer, .benchSlot` (empty slots): a uniform 1px position-colour outline, with `border-top-width: 0` for stacking.

So `/game-grid/7-Day-Forecast` comes back clean as expected, apart from the static-only `td:first-child` note above.

## Limits

- Logged-out session only. Yahoo-connected, draft-in-progress, modal and hover states were not rendered; the static scan covers them only when the accent and the radius are in the same rule block.
- The static scan misses cases where the accent and the radius come from different rules, for example a radius set by a mixin and a stripe set by a modifier class. A1, A3–A5 and A7 were only found because they rendered.
- Player, team, game and blog-post detail pages were not rendered. B4, B5, B13 and B14 come from the static scan only.
