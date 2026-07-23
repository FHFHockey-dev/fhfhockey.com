# Game Grid Phase 1 Architecture and Desktop Contract

Date: 2026-07-22

Status: Phases 1–4 evidence complete; Phase 5 remains open.

## Evidence boundary

This contract reconciles the dedicated PRD/task list against the current tracked implementation. It does not infer completion from component names and does not change score formulas, schedules, data sources, rendering, schema, or external state.

Principal evidence:

- `web/components/GameGrid/GameGrid.tsx`
- `web/components/GameGrid/DesktopMasterTable.tsx`
- `web/components/GameGrid/Header.tsx`
- `web/components/GameGrid/TeamRow.tsx`
- `web/components/GameGrid/TransposedGrid.tsx`
- `web/components/GameGrid/OpponentMetricsTable.tsx`
- `web/components/GameGrid/utils/FourWeekGrid.tsx`
- `web/components/GameGrid/utils/useOpponentMetricsData.ts`
- `web/components/GameGrid/SortableHeaders.test.tsx`
- `web/components/GameGrid/utils/FourWeekGrid.test.tsx`
- `web/components/GameGrid/utils/fourWeekGridViews.test.ts`

## Current render-path inventory

| Viewport / state                | Current composition                                                                                | Ownership disposition                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Mobile `<480px`                 | Early mobile return: weekly `Header`/`TeamRow`, then separate OMT, Player Pickup, and 4WG sections | Preserve as separate collapsible/mobile composition through this project.                                                          |
| Tablet `480–1023px`, horizontal | Three-part layout: OMT rail, weekly grid, 4WG rail                                                 | Preserve while applying later shared visual language.                                                                              |
| Tablet `480–1023px`, vertical   | OMT rail, `TransposedGrid`, 4WG rail                                                               | Preserve while applying later shared visual language.                                                                              |
| Desktop `>=1024px`, horizontal  | Existing `DesktopMasterTable`                                                                      | Reconcile to the contract below; its presence alone does not close implementation phases 2–5.                                      |
| Desktop `>=1024px`, vertical    | OMT rail, `TransposedGrid`, 4WG rail                                                               | Open NEW 2 disposition gate: retain as an explicit fallback or retire only with approval before claiming full desktop replacement. |

The route defaults to horizontal orientation. The orientation control can still move desktop users off the master path.

## Current row/data ownership

| Block                 | Current owner and derivation                                                                                                                                                   | Contract rule                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Team identity         | `useTeamsMap()` resolves current name, abbreviation, logo, and Team HQ link. Current-week rows deduplicate by resolved abbreviation.                                           | Reuse one identity cell per row; do not create a second team/logo owner.                       |
| Weekly schedule cells | `useSchedule(start, extended)` feeds `currentSchedule`; `adjustBackToBackGames` runs on the copied schedule and existing `MatchUpCell` rendering owns home/away/icon behavior. | Reuse the same rows/cells and 7-day or 10-day mode; no schedule-query or matchup-logic change. |
| Current GP            | `getTotalGamePlayed(row, excludedDays)`.                                                                                                                                       | Reuse unchanged.                                                                               |
| Current OFF           | `calcTotalOffNights(row, regularNumGamesPerDay, excludedDays)`.                                                                                                                | Reuse unchanged.                                                                               |
| Current Score         | `calcWeekScore(convertTeamRowToWinOddsList(...), calcWeightedOffNights(...), league total GP, team GP)`.                                                                       | Reuse unchanged, including `-100` no-game display semantics.                                   |
| OMT metrics           | `useOpponentMetricsData(teamDataWithAverages)` uses week-1 opponent identities and latest ordered `nst_team_all` rows to derive xGF, xGA, SF, SA, GF, GA, and W%.              | Reuse the hook/calculations. Preserve loading and expose failure truthfully under NEW 1.       |
| Four-week GP/OFF      | `useFourWeekSchedule` aggregates `TeamDataWithTotals.totals`.                                                                                                                  | Reuse unchanged.                                                                               |
| Four-week Opp%        | Four-week opponent identities join `useTeamSummary(currentSeasonId)` point percentages and average the available opponents.                                                    | Reuse unchanged; do not introduce a new source.                                                |
| Four-week Score       | Existing 4WG score is the delta from league-average GP/OFF plus inverse opponent-point-percentage delta.                                                                       | Render the existing score; do not redefine it.                                                 |
| Player Pickup         | `playerPickupWeekData` adapts week 1 plus current week score into `PlayerPickupTable`.                                                                                         | Outside the master row; preserve logic and refresh only its later presentation.                |

## Sorting contract

- Initial order is team name ascending.
- Repeated activation toggles the active sortable column; ties fall back to team name ascending.
- Sortable columns are every OMT metric, Team, current GP/OFF/Score, and four-week GP/OFF/Opp%/Score.
- Day/date columns are never sort controls. Their only interactive child is the existing include/exclude switch in 7-day mode.
- Missing numeric values sort after present values in both directions.
- Mobile/tablet fallback tables retain their existing independent sort state until their later visual-alignment phase.

The master defaults to Team ascending, keeps day headers non-sortable, and now exposes sort actions for all intended OMT/current/4WK values, including 4WK GP and 4WK Score.

## Unified desktop column contract

Left to right:

1. Opponent Metrics: `xGF`, `xGA`, `GF`, `GA`, `SF`, `SA`, `W%`.
2. One Team identity/logo column.
3. Schedule days: `Mon`–`Sun`, followed by `nMon`–`nWed` only in existing 10-day mode.
4. Current Week Summary: `GP`, `OFF`, `Score`.
5. Four Week Forecast: `4WK GP`, `4WK OFF`, `Opp %`, `4WK Score`.

The grouped 4WK expand/collapse control sits at the boundary immediately after current Score and before the first four-week value. Expanded state exposes all four values. Collapsed state may replace the group with one narrow marker. The owner-approved default is expanded; Phase 3 must change the current component's collapsed default explicitly and cover it rather than inheriting it silently.

The tracked desktop-horizontal implementation now matches this order. The four-value 4WK group starts expanded and collapses to one narrow marker after current Score.

## Sticky and scroll contract

- On the desktop horizontal master path, all seven OMT metric columns plus Team remain sticky on the left during horizontal scanning.
- Both grouped and metric header rows remain vertically persistent while the table body is in view.
- Day, current-summary, and four-week value columns scroll horizontally.
- Sticky offsets derive from actual rendered column widths; no duplicated shadow table may own different sort/collapse state.
- Phase 4/5 viewport verification may narrow the sticky set only if the complete left block demonstrably prevents usable schedule scanning at the supported desktop breakpoint. Any narrowing must be reviewed as a contract amendment.

## Approved Phase-1 decisions

On 2026-07-22 the owner approved the recommended defaults and authorized Phase 2:

- the desktop 4WK group will start expanded when Phase 3 reconciles the master table;
- top/bottom schedule emphasis will stay on the Score cell plus a restrained edge, not tint the full row;
- desktop vertical orientation remains a named legacy fallback through Phases 2–4;
- the already-live desktop path will be updated directly without a second feature flag.

This approval resolves the NEW 2 disposition decision but does not close NEW 2: the fallback must remain explicitly named and verified through the later structural and breakpoint phases before the initiative can claim complete desktop replacement.

## Phase 2 shell evidence

The tracked shell already satisfies the Phase-2 implementation contract, so no speculative CSS rewrite was required:

- `GameGrid.module.scss` uses the shared flat dark canvas and panel surfaces, compact connected spacing, bordered framing, striped table rows, subtle group separators, and restrained accents.
- `gameGridHeaderContent` and `controlsBar` form the compact title/command plane. Date navigation and the 7/10-day segmented control use the exact `GameGrid` control anatomy named as canonical by `fhfh-styles.md`.
- OMT, weekly, 4WG, and master headers retain the same solid dark surface, uppercase compact typography, border, and sticky treatment.
- Team logos, matchup icons, home/away cues, day-state colors, hover states, and visible keyboard focus remain intact.
- Existing `vars.scss` tokens, the shared panel module, and existing mixins are sufficient; Phase 2 introduces no new token, framework, or dependency.

The focused contract group remains 3 files / 9 tests. Full TypeScript passes. The development server compiles `/game-grid/7-Day-Forecast` and returns HTTP 200. Automated Chromium screenshots are blocked by the documented macOS sandbox (`MachPortRendezvousServer ... Permission denied`) even with the repository's workspace browser fallback; visual, sticky-scroll, and responsive browser proof therefore remain Phase-3/5 review evidence and are not claimed here.

## Findings and review gates

- NEW 1: closed. The master consumes `statsError`, presents a value-free unavailable notice, avoids showing metric emphasis/value remnants, and preserves schedule/current/4WK content.
- NEW 2: desktop vertical orientation bypasses the master architecture. The owner approved retaining it as a named legacy fallback through Phases 2–4; later structural and breakpoint verification still must prove that boundary before closure.
- NEW 3: the task list's obsolete Jest command is corrected to the repository's Vitest command and closed as documentation-only work.
- NEW 4: the Phase-3/4 page now renders the declared typed `VALID_TABS` constant; Next type checking and optimized compilation no longer fail on the stale identifier.
- Phase-1 review resolved initial 4WK state, Score-cell highlight scope, NEW 2 orientation disposition, and feature-flag strategy. The owner then authorized Phases 3–4 as one implementation/review cohort; Phase 5 remains separately gated.

## Phases 3–4 implementation evidence

- Desktop-horizontal uses one ordered table: xGF/xGA/GF/GA/SF/SA/W% → Team → 7/10 days → current GP/OFF/Score → 4WK GP/OFF/Opp%/Score.
- Team remains the ascending default; every intended non-day value is sortable, missing values remain last, ties remain Team-ascending, and day/date headers remain non-sortable.
- 4WK starts expanded, exposes four sortable values, and collapses through an independently accessible boundary control.
- Current Score alone receives top/bottom-ten fill, with a restrained left-edge marker; the previous full-row tint is removed.
- The vertical desktop control is explicitly `Legacy Vertical`, returns through `Master Table`, and introduces no feature flag.
- Focused verification passes 3 files/11 tests, full TypeScript passes, and the compiled `/game-grid/7-Day-Forecast` route returns HTTP 200. Phase 5 still owns cross-breakpoint browser/visual proof and Player Pickup alignment.

## Verification

- `npm test -- --run components/GameGrid/SortableHeaders.test.tsx components/GameGrid/utils/FourWeekGrid.test.tsx components/GameGrid/utils/fourWeekGridViews.test.ts`
- Result: 3 files / 9 tests passed on 2026-07-22.
- `npx tsc --noEmit`
- Result: passed on 2026-07-22.
- `npm run dev:stable` plus `curl http://localhost:3000/game-grid/7-Day-Forecast`
- Result: Next.js compiled the route and returned HTTP 200 on 2026-07-22.
- The proof covers the existing shell/control implementation, stable non-day sort/switch semantics, and the current four-week summary/detail data contract. It is not visual, sticky-scroll, master-order, collapse, or responsive browser proof; Chromium launch was sandbox-blocked and those remain later phase work.

## Downstream style-overhaul reconciliation

The approved Phase-1 defaults, completed Phase-2 shell evidence, and earlier Game Grid semantic-control cleanup satisfy 16 previously unchecked rows in the separate 52-row Draft Dashboard style-overhaul list. The imported closure covers token/helper sufficiency; implemented shell/header style children except narrow-width proof; existing dense schedule-grid styling except cross-breakpoint visual proof; Transposed Grid surfaces/sticky separator/token fills; obsolete paired CSS import classification; switch/toggle visual states; and targeted command/test execution. The current focused group is 4 files / 11 tests passing.

The style source remains 16/52. Narrow-width control usability, complete hit-target proof, baseline screenshots, broad raw-color/local-token cleanup, side tables and Player Pickup, complete Transposed responsiveness, remaining toggle literals, PDHC overlays, full accessibility/visual review, end-to-end behavior parity, and final synchronization stay open. This downstream reconciliation does not satisfy or authorize B-GAMEGRID Phase 3.

Exact checkpoint `6792f37faaea877cc637cec70442e6b46e40a430` publishes the 16-row style reconciliation with source/master 16/52 and global 4,420/4,874 parity.
