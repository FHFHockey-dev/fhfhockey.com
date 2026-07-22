## Relevant Files

- `web/components/GameGrid/GameGrid.tsx` - Main Game Grid page composition and likely entry point for the desktop master-table refactor.
- `web/components/GameGrid/Header.tsx` - Existing Game Grid header controls that will need the dashboard header redesign.
- `web/components/GameGrid/TeamRow.tsx` - Current row rendering for the weekly grid and a likely source of reusable row logic.
- `web/components/GameGrid/TotalGamesPerDayRow.tsx` - Current day-summary rendering that may need alignment with the new table architecture.
- `web/components/GameGrid/OpponentMetricsTable.tsx` - Current OMT implementation whose metrics must be merged into the unified desktop table.
- `web/components/GameGrid/utils/FourWeekGrid.tsx` - Current 4WG implementation whose metrics and collapse behavior must be integrated into the desktop master table.
- `web/components/GameGrid/TransposedGrid.tsx` - May need alignment or fallback treatment if the page still supports alternate grid orientation during the refactor.
- `web/components/GameGrid/GameGrid.module.scss` - Primary page shell, dashboard layout, and unified table styling entry point.
- `web/components/GameGrid/OpponentMetricsTable.module.scss` - Existing OMT styling reference that will inform merged table styles and smaller-breakpoint treatment.
- `web/components/GameGrid/utils/FourWeekGrid.module.scss` - Existing 4WG styling reference, including grouped metric presentation and collapse cues.
- `web/components/PlayerPickupTable/PlayerPickupTable.module.scss` - Styling file for the later Player Pickup Table refresh.
- `web/components/PlayerPickupTable/PlayerPickupTable.tsx` - Bottom-page table that will receive the later visual refresh.
- `web/pages/game-grid/index.tsx` - Route entry for the page; may need light updates if the rollout introduces page-level framing or migration cleanup.
- `web/styles/vars.scss` - Shared style tokens that should be reused before introducing any new variables.
- `web/styles/_panel.scss` - Shared panel and framing mixins that should inform the redesigned shell and tables.
- `web/components/GameGrid/GameGrid.test.tsx` - Potential component-level regression coverage if the refactor introduces testable rendering or interaction seams.
- `web/components/PlayerPickupTable/PlayerPickupTable.test.tsx` - Potential regression coverage for the later visual-state or interaction updates.
- `tasks/TASKS/three-pillars-analytics/underlying-stats/game-grid/game-grid-master-table-contract.md` - Phase 1 current-path/data/sorting inventory, target column/sticky contract, findings, and review gates.

### Notes

- The implementation should pause between phases for review and should not become a single uninterrupted refactor.
- Preserve all existing score calculations, schedule calculations, data sources, and ranking logic unless a later approved task explicitly changes them.
- The desktop master table is the primary architecture target. Mobile and tablet should keep separate collapsible sections during this project.
- Unit tests should typically be placed alongside the code files they are testing.
- Use `npm test -- --run [optional/path/to/test/file]` to run Vitest once from `web/`.

## Tasks

- [x] 1.0 Audit the current Game Grid architecture and define the unified desktop master-table contract. The current/target path, data, sorting, column, sticky, finding, and review-gate contract is recorded without changing runtime behavior (verified 2026-07-22).
  - [x] 1.1 Inventory the current desktop and mobile/tablet render paths in `GameGrid.tsx`, including where OMT, GG, and 4WG are composed and how orientation changes are handled. The contract distinguishes mobile `<480`, tablet `480–1023`, desktop-horizontal master, and desktop-vertical three-rail paths; NEW 2 preserves the unresolved vertical disposition (verified 2026-07-22).
  - [x] 1.2 Document the current row data dependencies for OMT metrics, weekly schedule cells, current-week summary values, and four-week metrics so the unified table can reuse existing calculations. Exact hook/helper/source owners and unchanged formulas are recorded for every block, including Player Pickup's separate adapter (verified 2026-07-22).
  - [x] 1.3 Identify which current sorting behaviors must be preserved and explicitly mark the day columns as non-sortable in the new contract. Team-ascending default, numeric default direction, alphabetical ties, missing-last behavior, all intended sortable metrics, and switch-only day headers are explicit (verified 2026-07-22).
  - [x] 1.4 Define the final desktop column order and grouped column boundaries, including where the single team identity column, current-week summary block, and 4WG collapse marker will sit. The contract fixes OMT → Team → 7/10 days → current GP/OFF/Score → four-week GP/OFF/Opp%/Score, with the group control at the post-Score boundary (verified 2026-07-22).
  - [x] 1.5 Decide which columns or wrappers should remain sticky during horizontal scrolling on desktop, starting with the left-side summary context and team identity column. All seven OMT columns plus Team stay left-sticky and both header rows stay vertically persistent, subject only to later supported-breakpoint evidence and reviewed amendment (verified 2026-07-22).

- [x] 2.0 Redesign the page shell, `dashboardHeader`, and shared table visual language using existing style tokens and required button/toggle rules. The tracked shell already implements the approved compact dark dashboard language; static contract review, focused regressions, TypeScript, Sass-through-route compilation, and a development HTTP 200 verify the implementation without inventing a parallel style system (verified 2026-07-22).
  - [x] 2.1 `GameGrid.module.scss` uses the shared flat dark canvas/surfaces, bordered panel framing, alternating rows, and restrained separators from `vars.scss` and `_panel.scss`; the compiled route preserves those styles (verified 2026-07-22).
  - [x] 2.2 The compact title/control plane and date/mode/orientation controls use the style guide's canonical `GameGrid` button and segmented-toggle anatomy, including bordered accent states and visible focus treatment (verified 2026-07-22).
  - [x] 2.3 OMT, schedule, 4WG, and master headers share compact uppercase typography, dark solid surfaces, borders, and sticky-header treatment across the retained compositions (verified 2026-07-22).
  - [x] 2.4 Existing team logos, matchup home/away cues, day-state colors, and control iconography remain intact with the current dense spacing, contrast, hover, and focus treatments (verified 2026-07-22).
  - [x] 2.5 Existing shared tokens and mixins are sufficient; Phase 2 adds no new SCSS variables, hard-coded canonical tokens, dependency, or style framework (verified 2026-07-22).

- [ ] 3.0 Build the unified desktop master-table scaffold with the agreed column order, sorting behavior, and single team identity column.
  - [ ] 3.1 Create the desktop master-table structure in `GameGrid.tsx` using one row per team and one shared header row for all desktop columns.
  - [ ] 3.2 Arrange the desktop column groups in the approved order: OMT metrics, team identity, day columns, current-week summary, and 4WG columns.
  - [ ] 3.3 Remove redundant repeated team-logo columns from the merged desktop layout and preserve a single `firstcolumnContent`-style identity area for each row.
  - [ ] 3.4 Wire alphabetical-by-team default sorting into the unified desktop table and enable clickable sorting for intended non-day columns only.
  - [ ] 3.5 Keep the day columns visible but intentionally non-sortable, including any necessary header-state treatment so that behavior is clear.
  - [ ] 3.6 Keep the previous mobile/tablet composition intact while scoping the master-table scaffold to desktop behavior only.

- [ ] 4.0 Merge OMT, GG, and 4WG presentation into the desktop master table, including grouped 4WG collapse behavior and score highlighting.
  - [ ] 4.1 Reuse current OMT metric data in the unified desktop row model without changing the underlying opponent-metric query or calculations.
  - [ ] 4.2 Reuse the existing weekly schedule cell rendering and current-week summary values (`GP`, `OFF`, `Score`) inside the desktop master table without changing scoring behavior.
  - [ ] 4.3 Reuse the existing four-week values in the unified row model and place the 4WG group to the right of the current-week summary block.
  - [ ] 4.4 Add a grouped 4WG expand/collapse affordance at the approved boundary, and ensure the control clearly communicates the collapsed versus expanded state.
  - [ ] 4.5 Add subtle top-10 and bottom-10 score highlighting using restrained green/red treatments that do not overwhelm row readability.
  - [ ] 4.6 Verify that the desktop unified table still retains logos, key schedule icons, and readable group separation once all three data areas are merged.

- [ ] 5.0 Polish the experience across breakpoints and refresh the Player Pickup Table styling to match the new dashboard UI.
  - [ ] 5.1 Update the separate mobile/tablet collapsible sections so they inherit the new dashboard shell, header styling, row striping, and spacing without adopting the desktop master-table structure.
  - [ ] 5.2 Align `OpponentMetricsTable.module.scss` and `FourWeekGrid.module.scss` with the final shared visual language for smaller breakpoints and any remaining fallback desktop states.
  - [ ] 5.3 Refresh `PlayerPickupTable.tsx` and `PlayerPickupTable.module.scss` so the bottom table matches the updated page shell, table typography, borders, and control styling.
  - [ ] 5.4 Run targeted regression checks for sorting, collapse behavior, score display, sticky headers, and layout behavior across desktop, tablet, and mobile breakpoints.
  - [ ] 5.5 Add or update component-level regression tests if the refactor introduces stable seams for interaction or rendering coverage.

- [ ] NEW 1.0 **P1 desktop master opponent-metrics failure is indistinguishable from legitimate missing values:** `useOpponentMetricsData` exposes a stable error, but `GameGrid` passes only loading/data into `DesktopMasterTable`, which renders ordinary dashes after failure. Preserve the schedule/4WG row while exposing a value-free unavailable state and add a focused failure regression before closing the merged desktop path (discovered 2026-07-22).
- [ ] NEW 2.0 **P2 desktop vertical orientation bypasses the master-table contract:** `>=1024px` horizontal uses `DesktopMasterTable`, while the existing orientation control routes vertical users back to separate OMT/TransposedGrid/4WG rails. The owner approved retaining this as a named legacy fallback through Phases 2–4; preserve that boundary and verify it across later structural/breakpoint work before claiming complete desktop replacement (decision recorded 2026-07-22).
- [x] NEW 3.0 **P3 stale Jest verification instruction:** the task list now names the repository-owned Vitest one-shot command, and the focused current-contract group passes 3 files/9 tests (verified 2026-07-22).
