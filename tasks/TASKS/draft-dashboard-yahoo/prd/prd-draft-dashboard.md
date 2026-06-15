# Fantasy Hockey Draft Dashboard — Condensed PRD

## Overview
A three-panel Draft Dashboard enabling fast, informed drafting with real‑time projections, VORP/VONA/VBD value metrics, roster tracking, and sortable views.

## Completed (Summary)
- Core layout and responsive settings panel; mobile optimizations, collapsible panels.
- Draft management: team count, snake order, turn tracking, draft/undo history.
- Search/autocomplete; draft progress and roster slot visualization.
- Team leaderboard and contribution/draft board visualization.
- Projections processing: multi‑source ingestion, fantasy points calc, Yahoo data.
- VORP/VONA/VBD engine with replacement logic; per‑position analysis; dynamic baselines.
- ProjectionsTable improvements: zebra striping, fixed layout, value bands, baseline toggle, next‑pick risk (SD control), need weighting with alpha, run‑forecast UI, sort/comparator fixes, preference persistence, tooltips/accessibility.
- Global shortcuts: U (Undo), S (Summary), N (Need weight), B (Baseline). Persisted and input‑safe.
- Settings > Scoring UI split into side‑by‑side Skaters / Goalies subgroups with independent expand/collapse controls. (NEW 2025-08-22)
- Added skater stat manager panel (add/remove dynamic scoring stats) with safeguard for already-added metrics. (NEW 2025-08-22)
- Separate goalie stats expansion state (no longer tied to skater toggle). (NEW 2025-08-22)
- Expand button now auto-spans two grid columns only when alone on its final row (CSS selector optimization). (NEW 2025-08-22)
- Minor styling refinements: vertical divider between skater/goalie sections, per-stat remove button, adjusted number input theming. (NEW 2025-08-22)

## Active Initiatives (Detailed)

1) Client‑Side CSV Import (Session‑Local) — NEW IMMEDIATE
- Goal: Let users import projections CSV (like /pages/db/upsert-projections.tsx) without AdminOnly and without writing to DB. Data should live only for the user’s session.
- UX Decisions (confirmed):
  - Import UI will be a modal accessible from the Draft Dashboard header. All settings (e.g., naming teams) will also follow a modal pattern.
- UI/Flow:
  - Drag‑and‑drop or file picker, header preview, standardization of column names and player names (reuse standardizePlayerName/standardizeColumnName where applicable).
  - Column selection and simple type inference (numeric/text) for parsing only (no schema creation).
  - Mapping helper to align common columns (Player_Name, Team, Position, stat fields) to internal stat keys used in useProcessedProjectionsData/useProjectionSourceAnalysis.
  - Required minimum columns (confirmed): Player_Name, Team, Position, Goals, Assists, plus the minimal projection metrics baseline matching whatever source has the fewest supported metrics (intersection approach).
- Storage (session‑scoped) — confirmed:
  - In‑memory state with optional persistence to sessionStorage fallback; consider IndexedDB only if file is very large. Clearable and isolated per tab.
  - No network writes; no Supabase usage.
- Integration:
  - Merge imported projections into the current projections pipeline for the session and mark as a custom source (e.g., "Custom CSV").
  - Ensure downstream hooks (projections processing, VORP) can include/exclude this source via source toggles (see task 2).
- Validation/UX:
  - Show row counts, skipped rows, and minimal data hygiene (trim, numeric coercion where safe).
  - No admin gate; available from the modal entry point.
- Deliverables:
  - Import modal component, session storage strategy, merge adapter into processing hook, unit tests on parsing and mapping.

2) Projection Source Toggles & Weights — NEW IMMEDIATE
- Goal: Enable/disable sources and assign weights (including 2x or arbitrary factors) when blending projections.
- Requirements (confirmed):
  - UI lists sources with an on/off toggle and a weight control range 0.0–2.0 with 0.1 step. Include the session "Custom CSV" source when present.
  - Default to all sources enabled with normalized equal weights; persist preferences (localStorage).
  - Blending logic updates aggregated projections and flows into VORP/VONA/VBD and Suggested Picks when present.
  - Feedback: show effective weight share per source and indicate if disabling a source materially changes a player’s rank.
- Constraints/Perf:
  - Memoized recompute only on relevant changes (source set/weights). Validate weight inputs; normalize when sum > 0.
- Deliverables:
  - Controls + persistence, integration with useProcessedProjectionsData, unit tests on weighting math and persistence.

3) Missing Players in ProjectionsTable — NEW IMMEDIATE
- Problem: Certain players are not appearing in the available list.
- Hypotheses:
  - Over‑aggressive fuzzy name matching or failed normalization at ingest; multi‑position mapping edge cases; filters (position, hide drafted); ADP‑based exclusions in banding; data gaps from Supabase queries.
- Debug Plan:
  - Add diagnostics: count of filtered vs total, and a temporary "Show excluded" toggle listing reasons (e.g., filtered by position, missing ADP, marked drafted, name mismatch).
  - Log unmatched names between projections and player master; surface a small reconciliation report in dev mode.
  - Verify displayPosition parsing (multi‑pos includes G), search debounce and term filters, and ADP/null handling in sorting.
  - Cross‑check Supabase season totals fetch logic doesn’t gate list rendering.
- Acceptance Criteria:
  - Reproduce and document root cause(s); implement targeted fixes; add tests for name normalization and filter logic; verify affected players appear with correct data.

## Highest Priority Additions (This Weekend)
The following three items are highest priority for this weekend and expand the Draft Dashboard's draft-time functionality. Each item includes a concise implementation plan tied to the relevant files.

1) FORWARDS aggregation option (C/LW/RW -> FORWARDS)
- Goal: Offer a user toggle in the Draft Dashboard settings to treat C/LW/RW as separate (current behavior) or grouped into a single FORWARDS pool (new). When selected, VORP/VBD/VONA calculations should use FWD pools rather than separate C/LW/RW pools.
- Files touched: `web/hooks/useVORPCalculations.ts`, `web/components/DraftDashboard/ProjectionsTable.tsx` (settings UI), `web/components/DraftDashboard/DraftBoard.tsx` (visuals consistent with new grouping).
- Steps:
  1. Add a persisted setting (e.g., `groupForwards: boolean`) in the ProjectionsTable settings and settings persistence layer (existing localStorage hooks used in table). Provide a toggle UI with explanatory tooltip.
  2. In `useVORPCalculations.ts`, add a flag parameter (or accept via draftSettings) that when true will collapse eligible position categories: map C,LW,RW -> FWD for grouping. Update all position grouping logic (byPosFull, byPosAvail, idxVORP/idxVOLS and replacement calculation) to handle `FWD` as a position in addition to `D` and `G`.
     - Ensure utility allocation (`utilAdj`) distributes to FWD when grouping is active (or allocate across FWD/D according to existing heuristics).
     - Recompute replacement indices (vorsprank/vostr) using T * starters[FWD] when grouping is active.
  3. Update `ProjectionsTable.tsx` to show banding and VORP/VBD columns aggregated for FWD when the toggle is on. Ensure sorting keys and tooltips reflect the active grouping.
  4. Update UI labels in `DraftBoard.tsx` and any roster visuals that show position columns so they display FWD instead of separate C/LW/RW when grouping is active.
  5. Add unit tests for `useVORPCalculations` covering grouped vs ungrouped outputs for a small synthetic pool.
  6. Roll out behind the toggle and validate with live sample data.

2) Keeper picks pre-load and pick-forfeiting UI
- Goal: Allow users to pre-load keeper players into rosters with an associated kept round; mark the corresponding draft pick as forfeited (owned by that keeper's team) and remove the player from the available projections list and DraftBoard pick sequence/visuals.
- Files touched: `web/components/DraftDashboard/MyRoster.tsx`, `web/components/DraftDashboard/ProjectionsTable.tsx`, `web/components/DraftDashboard/DraftBoard.tsx`.
- Steps:
  1. Add a Keeper import / dialog in `MyRoster.tsx` that accepts N keeper entries: playerId, teamId (owner), and keptRound (integer). Persist these locally (and optionally to server if you already support saved drafts). Provide validation (player exists and not duplicated).
  2. When a keeper is added: attach the player to the specified team's roster state (update `teamStatsList` or the same state structure used by the app), mark that pick slot (round,pickInRound or global pick index) as "forfeited" and visually attribute it to the keeper's team in the `DraftBoard.tsx` pick grid.
     - If your draft model uses a pick list, mark the corresponding pickOwner for that pick to the keeper's team and flag it as a kept pick so subsequent logic treats it as already-completed.
  3. Remove the keeper player from the `ProjectionsTable` available list and from any availability maps used by recommendations (e.g., `availablePlayers`, `byPosAvail`). Ensure `useVORPCalculations` receives the updated available pool so replacement values reflect the reduced pool.
  4. In `MyRoster.tsx` and `DraftBoard.tsx`, update any draft contribution graphs to include a distinct color/annotation for forfeited picks (keepers), and count them in roster progress calculations.
  5. Add a simple import UI to pre-load multiple keepers at once (CSV or JSON paste) for rapid configuration.
  6. Add tests to ensure: when keeper is preloaded the player is removed from availablePlayers, the pick is marked, and replacement calculations update.

3) Custom draft pick trades UI
- Goal: Allow the user to record traded draft picks (i.e., pick at round X originally belonging to Team A was traded to Team B). Update pick ownership for the specific pick and reflect changes across DraftBoard, MyRoster, and ProjectionsTable (recommendations/runs that use draft order).
- Files touched: `web/components/DraftDashboard/DraftBoard.tsx`, `web/components/DraftDashboard/MyRoster.tsx`, `web/components/DraftDashboard/ProjectionsTable.tsx`.
- Steps:
  1. Add a "Manage Trades" modal in the Draft Dashboard that accepts one or more trade entries in the form: { round, pickInRound (optional), originalTeamId, newTeamId } or a global pick index mapping. Validate entries.
  2. When a trade is added, update the internal pick ownership mapping used by `DraftBoard` so the visual grid shows the new team owner for that pick. Persist the trade mapping to localStorage (or server if desired).
  3. Ensure `MyRoster` uses the updated ownership mapping to compute which team is drafting in which turn and to permit pre-assignment of keeper picks to the new owner if needed.
  4. Notify downstream systems (recommendations, expectedRuns, risk calculations) by recomputing any caches that depend on pick order or upcoming owner sequence.
  5. Add tests to verify the mapping updates propagate to visuals and calculations.

These three items are highest priority for this weekend. After implementing the UI + state plumbing, we should run an integrated smoke test: create a mock draft with grouped forwards enabled, pre-load keepers, apply a trade, and verify VORP/banding, roster counts, and DraftBoard visuals update consistently.

## Backlog (Brief)
- Suggested Picks module: need‑adjusted VBD + VONA + risk composite ranking with explanations and actions.
- Projection Source Accuracy UI: visualize per‑source quality; toggles for Total vs Per‑Game; future tie‑in to weights.
- Row expanders for prior‑season stats inline in ProjectionsTable.
- Dynamic scoring stat management enhancements (skater manager COMPLETE; goalie manager backlog). (UPDATED 2025-08-22)
- JS-driven detection for expand button width in responsive auto-fill grids if future layout changes remove fixed 8-col grid. (NEW BACKLOG 2025-08-22)

## Success Criteria
- CSV import requires zero backend and persists only for session; integrated into blended projections via a modal workflow.
- Source toggles/weights (0.0–2.0, step 0.1) update rankings and VORP instantly and persist across reloads.
- Missing players issue resolved with tests preventing regression.

## Next Steps & Direction
- Milestone 1: Client-side CSV Import Modal (session-only)
  - Build an accessible modal launched from Draft Dashboard header.
  - Parse CSV (header row required), preview first 50 rows, map headers to internal stat keys.
  - Require columns: Player_Name, Team, Position, Goals, Assists, plus the minimal shared metric baseline across official sources.
  - Store data in memory with sessionStorage fallback under key draft.customCsv.v1. Register ephemeral source id custom_csv.
  - No AdminOnly, no Supabase writes.
- Milestone 2: Source Toggles & Weights
  - UI with on/off toggle and 0.0–2.0 slider (step 0.1) per source (including Custom CSV).
  - Persist to localStorage at draft.sourceControls.v1. Normalize nonzero weights.
  - Recompute blended projections and propagate into VORP/VONA/VBD.
- Milestone 3: Missing Players Diagnostics & Fix
  - Add temporary “Show excluded” toggle; list counts and reasons per exclusion.
  - Log unmatched names and validate normalization, filters, ADP null handling, and multi-position parsing.
  - Implement targeted fixes and add regression tests.

## Important Context & Connections
- Files/Modules
  - web/components/DraftDashboard/ProjectionsTable.tsx — table rendering, filters, search; target for diagnostics toggle.
  - web/hooks/useProcessedProjectionsData.tsx — aggregation/blending pipeline; integrate source toggles/weights and Custom CSV.
  - web/hooks/useProjectionSourceAnalysis.ts — per-source stats/coverage; reflect Custom CSV and weighting.
  - web/pages/db/upsert-projections.tsx — reference for CSV parsing/mapping and standardization patterns (no Admin gate here).
  - web/pages/api/v1/db/upsert-csv.ts — reference only; no API calls in client-side import.
  - lib/standardization/nameStandardization — reuse standardizePlayerName/titleCase/standardizeColumnName.
  - tasks/prd-draft-dashboard.md — this plan; keep updated as work proceeds.
- Storage & Persistence
  - Session data for imported CSV: memory with sessionStorage fallback (draft.customCsv.v1), tab-isolated, clearable.
  - Source toggles/weights: localStorage (draft.sourceControls.v1), restored on load.
  - Other prefs (existing): keep using current keys; avoid breaking changes.
- Constraints
  - No Supabase writes; no AdminOnly gating.
  - Keep UI accessible: keyboard focus trap in modal, aria-labelledby/aria-describedby, aria-expanded on toggles.
  - Performance: recompute projections within ~200ms on desktop after control changes; memoize appropriately.
- Baseline/Mapping
  - Determine minimal shared metrics set by intersecting official sources; enforce at import.
  - Map CSV headers to internal stat keys used by useProcessedProjectionsData/useProjectionSourceAnalysis.

## Recent Updates Changelog
- 2025-08-22: Implemented split Skaters/Goalies scoring subgroups side-by-side; independent expand buttons.
- 2025-08-22: Added skater scoring stat manager (add/remove, prevents duplicates).
- 2025-08-22: Added conditional grid-span behavior for expand button (spans two columns only when solitary in last row).
- 2025-08-22: Added per-stat removal control and styling refinements (divider, inputs, badges).

