# Game Grid Phase 1 Architecture and Desktop Contract

Date: 2026-07-22

Status: Phase 1 evidence complete; Phase 2 requires the PRD review checkpoint.

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

The current master already defaults to Team ascending and keeps day headers non-sortable, but current 4WK GP has no sort action and 4WK Score is computed but not rendered. Base tasks 3.4 and 4.3 own those already-specified gaps.

## Unified desktop column contract

Left to right:

1. Opponent Metrics: `xGF`, `xGA`, `GF`, `GA`, `SF`, `SA`, `W%`.
2. One Team identity/logo column.
3. Schedule days: `Mon`–`Sun`, followed by `nMon`–`nWed` only in existing 10-day mode.
4. Current Week Summary: `GP`, `OFF`, `Score`.
5. Four Week Forecast: `4WK GP`, `4WK OFF`, `Opp %`, `4WK Score`.

The grouped 4WK expand/collapse control sits at the boundary immediately after current Score and before the first four-week value. Expanded state exposes all four values. Collapsed state may replace the group with one narrow marker, but the default expanded/collapsed choice remains a Phase-2 review decision from the PRD; it must not be silently inferred from the current component's collapsed default.

Current tracked code differs from this contract: its OMT order is xGF/xGA/SF/SA/GF/GA/W%, it places the three-column 4WK group before current GP/OFF/Score, it omits 4WK Score, and its 4WK GP header is only a collapse control. These are already owned by base implementation rows 3.2, 3.4, 4.3, and 4.4.

## Sticky and scroll contract

- On the desktop horizontal master path, all seven OMT metric columns plus Team remain sticky on the left during horizontal scanning.
- Both grouped and metric header rows remain vertically persistent while the table body is in view.
- Day, current-summary, and four-week value columns scroll horizontally.
- Sticky offsets derive from actual rendered column widths; no duplicated shadow table may own different sort/collapse state.
- Phase 4/5 viewport verification may narrow the sticky set only if the complete left block demonstrably prevents usable schedule scanning at the supported desktop breakpoint. Any narrowing must be reviewed as a contract amendment.

## Findings and review gates

- NEW 1: the master path consumes `statsLoading` but drops `statsError`; a failed OMT query becomes ordinary `-` values. Later implementation must expose a stable, value-free unavailable state while preserving the rest of the master row.
- NEW 2: desktop vertical orientation bypasses the master architecture. The owner must approve retaining it as a named fallback or retiring it before Phase 3 can claim complete desktop replacement.
- NEW 3: the task list's obsolete Jest command is corrected to the repository's Vitest command and closed as documentation-only work.
- PRD review still needs the initial 4WK collapsed/expanded choice, Score-cell versus full-row highlight scope, and NEW 2 orientation disposition before Phase 2/3 behavior is finalized.

## Verification

- `npm test -- --run components/GameGrid/SortableHeaders.test.tsx components/GameGrid/utils/FourWeekGrid.test.tsx components/GameGrid/utils/fourWeekGridViews.test.ts`
- Result: 3 files / 9 tests passed on 2026-07-22.
- The proof covers stable non-day sort/switch semantics and the existing four-week summary/detail data contract. It is not visual, sticky-scroll, master-order, collapse, or breakpoint runtime proof; those remain later phase work.
