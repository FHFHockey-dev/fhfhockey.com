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

## Backlog (Brief)
- Suggested Picks module: need‑adjusted VBD + VONA + risk composite ranking with explanations and actions.
- Projection Source Accuracy UI: visualize per‑source quality; toggles for Total vs Per‑Game; future tie‑in to weights.
- Row expanders for prior‑season stats inline in ProjectionsTable.

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

## Prompt for Next LLM (Copy-Paste into VS Code Copilot/ChatGPT-5)
You are GitHub Copilot assisting on a Next.js + TypeScript app (web/ folder) on macOS. Goal: deliver three milestones in the Draft Dashboard without backend writes.

Context
- Paths of interest:
  - web/components/DraftDashboard/ProjectionsTable.tsx
  - web/hooks/useProcessedProjectionsData.tsx
  - web/hooks/useProjectionSourceAnalysis.ts
  - web/pages/db/upsert-projections.tsx (use as reference for CSV parsing/mapping only)
  - lib/standardization/nameStandardization (standardizePlayerName, titleCase, standardizeColumnName)
- Constraints:
  - No AdminOnly requirements; no Supabase writes. All CSV data must be session-only.
  - Persist source toggles/weights to localStorage.
  - Accessibility: modals and toggles must be keyboard and screen-reader friendly.

Tasks
1) Client-side CSV Import Modal (session-only)
- Add a header action “Import Projections (CSV)” that opens an accessible modal.
- Inside the modal: drag-and-drop or file picker; parse CSV with a header row; preview first 50 rows.
- Provide header mapping UI. Require columns: Player_Name, Team, Position, Goals, Assists, plus minimal shared projection metrics baseline across official sources (intersection). Use name/column standardization helpers.
- Store parsed and mapped rows only for this session: keep in memory and persist a copy to sessionStorage under key draft.customCsv.v1. Add a “Remove source” action to clear it.
- Register an ephemeral projection source id custom_csv labeled “Custom CSV”. Integrate it into the projections pipeline.

2) Projection Source Toggles & Weights
- Add UI to list sources (including Custom CSV when present) with an enable toggle and a weight slider 0.0–2.0 (step 0.1). Weight 0 == disabled.
- Persist controls in localStorage under draft.sourceControls.v1; restore on load.
- Normalize nonzero weights and recompute blended projections; propagate through VORP/VONA/VBD and any dependent rankings.
- Show effective weight share per source in the UI.

3) Missing Players Diagnostics & Fix
- Add a temporary “Show excluded” toggle near filters in ProjectionsTable that opens a panel with counts and reasons for exclusions (position filter, drafted, missing ADP, name mismatch, etc.).
- Log unmatched name pairs between projections and player master; verify displayPosition parsing (multi-position including G), search filter, and ADP null handling. Confirm fetching of season totals is not gating list rendering.
- Fix root causes, add tests for name normalization and filter logic, and remove/restrict diagnostics behind a dev flag.

Acceptance Criteria
- Import modal: session-only data; required columns enforced; “Custom CSV” appears as a selectable source; refresh within session restores data; removing source fully reverts.
- Source controls: toggles and 0.0–2.0 weights persist; recomputations reflected in ranking/VORP quickly (<~200ms desktop).
- Missing players: root causes fixed; affected players present; tests added to prevent regression.

Implementation Notes
- Prefer existing helpers for standardization. For CSV parsing, you can use Papa Parse or a small custom parser; be mindful of bundle size.
- Keep state updates memoized to avoid full-table rerenders; avoid unnecessary effect churn.
- Maintain accessibility (focus trap, aria- attributes) and mobile responsiveness.
- If adding new utility modules or tests, place them consistently within web/.

Deliverables
- Import modal component wired into the Draft Dashboard.
- Updated hooks for source blending and persistence (useProcessedProjectionsData/useProjectionSourceAnalysis).
- Diagnostics UI and fixes for missing players with tests.

