# Fantasy Hockey Draft Dashboard — Implementation and Completion Tasks

## Relevant Files

- `tasks/TASKS/draft-dashboard-yahoo/prd/prd-draft-dashboard.md` - Source PRD for dashboard functionality, immediate initiatives, weekend priorities, backlog, constraints, and success criteria.
- `tasks/TASKS/draft-dashboard-yahoo/prd/prd-draft-dash-debug.md` - Separate embedded debug/performance checklist; synchronize overlapping fixes without duplicating implementation.
- `tasks/TASKS/draft-dashboard-yahoo/docs/DraftDashboard_Audit.md` - Historical dashboard implementation/quality audit used as evidence, not automatic completion proof.
- `tasks/TASKS/draft-dashboard-yahoo/draft-dashbord-audit.md` - Earlier dashboard inventory and supporting evidence.
- `tasks/TASKS/draft-dashboard-yahoo/prd-yahoo-audit.md` - Yahoo ingestion/mapping audit that owns upstream provider-data remediation.
- `web/components/DraftDashboard/DraftDashboard.tsx` - Main dashboard state and three-panel orchestration.
- `web/components/DraftDashboard/DraftSettings.tsx` - Draft, scoring, source, and roster settings surface.
- `web/components/DraftDashboard/ImportCsvModal.tsx` - Session-local projection CSV import flow.
- `web/components/DraftDashboard/ProjectionsTable.tsx` - Available-player list, filtering, source/value controls, sorting, and diagnostics.
- `web/components/DraftDashboard/DraftBoard.tsx` - Pick grid, ownership, keeper/trade presentation, and draft sequence.
- `web/components/DraftDashboard/MyRoster.tsx` - Current-user roster and keeper configuration surface.
- `web/components/DraftDashboard/SuggestedPicks.tsx` - Need/value/risk recommendation surface.
- `web/components/DraftDashboard/ComparePlayersModal.tsx` - Player comparison workflow.
- `web/components/DraftDashboard/DraftSummaryModal.tsx` - Draft summary/export workflow.
- `web/hooks/useProcessedProjectionsData.tsx` - Projection ingestion, normalization, source blending, and derived data.
- `web/hooks/useProjectionSourceAnalysis.ts` - Per-source coverage/quality analysis.
- `web/hooks/useVORPCalculations.ts` - VORP/VONA/VBD, replacement pools, availability, and position grouping.
- `web/lib/standardization/` - Shared player-name and CSV-column normalization helpers.

### Notes

- This list repairs the missing task-list pair for `prd-draft-dashboard.md`. All rows begin unchecked until current code and runtime behavior are verified against the PRD.
- Keep Yahoo ingestion/mapping remediation in its dedicated initiative; this list owns dashboard consumption, diagnostics, and user-facing fallback behavior.
- Imported CSV data is session-local and must never be written to Supabase or require `AdminOnly`.
- Source-control preferences and other durable UI preferences may use local storage, but imported projection rows must remain tab/session scoped and clearable.
- Preserve the separate embedded tasks in `prd-draft-dash-debug.md`; when one code change satisfies both lists, attach the same verification evidence and synchronize both.
- Add tests for non-trivial parsing, weighting, replacement calculations, pick ownership, keeper allocation, and exclusion logic. Direct visual verification is sufficient for low-risk styling only.

## Tasks

- [ ] 1.0 Verify the claimed dashboard baseline and establish a current implementation map
  - [ ] 1.1 Map the PRD's claimed completed layout, draft management, history/undo, search, roster, leaderboard, projection, VORP/VONA/VBD, keyboard shortcut, scoring-manager, persistence, and responsive behaviors to current files and tests.
  - [ ] 1.2 Identify claims that are incomplete, stale, or contradicted by current runtime behavior and append each as a `NEW` task with evidence.
  - [ ] 1.3 Reconcile dashboard-owned data requirements with the Yahoo ingestion/mapping initiative and document which loading/error/stale states must handle upstream gaps.
  - [ ] 1.4 Confirm all large projection/player reads use explicit pagination or a provably bounded API contract and add remediation tasks for incomplete coverage.

- [ ] 2.0 Verify and finish session-local projection CSV import
  - [ ] 2.1 Verify `ImportCsvModal` is accessible from the dashboard header and supports keyboard focus management, drag/drop, file selection, preview, mapping, validation, cancellation, and clearing.
  - [ ] 2.2 Reuse shared name/column standardization and enforce the minimum common metric set: player name, team, position, goals, assists, plus the verified intersection baseline required by current sources.
  - [ ] 2.3 Report parsed, accepted, skipped, duplicate, and invalid rows with actionable reasons; safely coerce numeric fields and preserve unknown columns only as non-critical metadata.
  - [ ] 2.4 Store imported rows in memory with tab-scoped `sessionStorage` fallback under a versioned key; prove no API/Supabase writes and no cross-tab durable leakage.
  - [ ] 2.5 Register `custom_csv` as an ephemeral projection source and merge it through the same processed-projection and source-analysis contracts as official sources.
  - [ ] 2.6 Add or update focused parser/mapping/session persistence tests, including malformed CSV, duplicate players, multi-position values, missing required columns, and clear/reset behavior.

- [ ] 3.0 Verify and finish projection source toggles and weights
  - [ ] 3.1 Render every official source plus `custom_csv` when present with enabled state and a validated `0.0–2.0` weight control in `0.1` steps.
  - [ ] 3.2 Default to all available sources enabled with normalized equal weights and persist only source-control preferences under a versioned local-storage key.
  - [ ] 3.3 Centralize weight normalization and zero-sum behavior so aggregation, VORP/VONA/VBD, source analysis, ranks, and Suggested Picks use the same effective shares.
  - [ ] 3.4 Show effective share per source and an honest rank-impact indicator when source changes materially alter a player's result.
  - [ ] 3.5 Memoize recomputation around relevant source/weight/data changes and verify the PRD's approximately 200 ms desktop interaction target on representative data.
  - [ ] 3.6 Add focused tests for normalization, disabled sources, zero sum, arbitrary weights, imported-source inclusion/removal, persistence migration, and downstream recalculation.

- [ ] 4.0 Diagnose and close missing-player defects
  - [ ] 4.1 Add a development/diagnostic view that reconciles total source rows, normalized players, included players, and exclusions by reason.
  - [ ] 4.2 Audit fuzzy matching, canonical name normalization, multi-position parsing, goalie detection, drafted-player filtering, search terms, ADP/null handling, season totals, and pagination as independent exclusion causes.
  - [ ] 4.3 Persist or display unmatched source/player-master identities through the Yahoo mapping review contract instead of silently dropping them.
  - [ ] 4.4 Reproduce each verified missing-player case, implement the narrowest root-cause fix, and keep the exclusion reason visible when omission is intentional.
  - [ ] 4.5 Add regression tests for affected identities plus normalization, multi-position, null ADP, source-toggle, drafted, and search-filter behavior.
  - [ ] 4.6 Verify corrected players appear with the right source, stats, position eligibility, value metrics, and availability state.

- [ ] 5.0 Verify and finish the grouped-forwards option
  - [ ] 5.1 Add or verify a persisted, explained `groupForwards` setting that switches C/LW/RW replacement pools to FWD without changing goalie or defense pools.
  - [ ] 5.2 Centralize grouped-position mapping in `useVORPCalculations` and apply it consistently to full/available pools, starters, utility allocation, replacement indices, VORP/VONA/VBD, and run forecasts.
  - [ ] 5.3 Update table bands, sorting, tooltips, Draft Board, roster visuals, and labels to reflect FWD when active and separate positions when inactive.
  - [ ] 5.4 Add deterministic synthetic-pool tests for grouped and ungrouped calculations, utility allocation, multi-position eligibility, scarcity, and toggle persistence.

- [ ] 6.0 Implement and verify keeper preloading with forfeited-pick semantics
  - [ ] 6.1 Define a stable keeper contract with canonical player ID, owning team ID, kept round/pick, validation state, and persistence version.
  - [ ] 6.2 Provide an accessible single/bulk keeper import flow with player/team/round validation, duplicate prevention, and clear conflict messaging.
  - [ ] 6.3 Add keepers to the correct roster, mark the corresponding pick as completed/forfeited and owned by that team, and remove the player from all availability/recommendation pools.
  - [ ] 6.4 Ensure keeper picks update replacement values, roster progress, turn sequence, contribution graphs, Draft Board visuals, undo/reset behavior, and summary/export output consistently.
  - [ ] 6.5 Define and test conflicts among keepers, traded picks, invalid rounds, duplicate players, and already-completed draft state.
  - [ ] 6.6 Add focused state/calculation/component tests and run an integrated keeper smoke scenario.

- [ ] 7.0 Implement and verify custom draft-pick trades
  - [ ] 7.1 Define a versioned pick-ownership mapping keyed by stable global pick identity with original and current team ownership.
  - [ ] 7.2 Build an accessible Manage Trades modal supporting single and bulk entries, validation, edit/remove, reset, and conflict display.
  - [ ] 7.3 Apply ownership changes to Draft Board, current turn, My Roster, keeper allocation, upcoming owner sequence, recommendations, run/risk forecasts, and summary/export behavior.
  - [ ] 7.4 Persist trades locally without corrupting older saved settings and recompute only caches dependent on pick order/ownership.
  - [ ] 7.5 Add tests for traded snake-round picks, keeper/trade conflicts, multiple trades, undo/reset, persistence, visuals, and downstream calculations.

- [ ] 8.0 Verify and finish Suggested Picks and projection-source accuracy surfaces
  - [ ] 8.1 Verify Suggested Picks ranks only available eligible players using the documented need-adjusted VBD, VONA, and next-pick risk inputs.
  - [ ] 8.2 Provide concise explanations and draft/compare actions whose state updates remain consistent with the table, roster, and board.
  - [ ] 8.3 Build or finish a per-source accuracy/coverage view with clear Total versus Per-Game semantics and no retrospective data leakage into draft-time weighting.
  - [ ] 8.4 Keep manual source weights distinct from evidence-based source quality until a documented automatic weighting policy is approved.
  - [ ] 8.5 Add focused ranking/explanation/empty-state tests for Suggested Picks and accuracy summaries.

- [ ] 9.0 Complete remaining dashboard productivity and scoring backlog
  - [ ] 9.1 Verify or implement prior-season inline row expansion without issuing one network request per row.
  - [ ] 9.2 Bring the goalie dynamic scoring-stat manager to parity with the completed skater manager, including duplicate safeguards and independent expansion state.
  - [ ] 9.3 Verify Compare Players modal data, selection limits, reset behavior, accessibility, and downstream state consistency; synchronize the embedded debug checklist.
  - [ ] 9.4 Verify Draft Summary captures teams, picks, keepers, trades, source settings, custom projections metadata, and value metrics without exposing session CSV contents unexpectedly.
  - [ ] 9.5 Decide from measured layout evidence whether JavaScript expand-button width detection is necessary; retain CSS-only behavior when it remains correct.

- [ ] 10.0 Run integrated correctness, performance, accessibility, and resilience verification
  - [ ] 10.1 Add/update tests for parsing, identity reconciliation, source weighting, VORP/VONA/VBD, grouped forwards, keepers, trades, recommendations, persistence, and meaningful failure branches.
  - [ ] 10.2 Verify loading, empty, upstream-error, stale-data, partial-source, invalid-import, and no-enabled-source states without presenting fabricated zero values.
  - [ ] 10.3 Verify keyboard operation, focus trapping/restoration, shortcut input safety, labels/descriptions, table semantics, color-independent state cues, and responsive/mobile usability.
  - [ ] 10.4 Run a representative integrated draft: import CSV, adjust weights, toggle grouped forwards, preload keepers, apply trades, draft/undo players, compare players, inspect suggestions, and review the summary.
  - [ ] 10.5 Measure initial load, projection recompute, filtering/search, and large-table interaction; remediate verified bottlenecks without speculative architecture replacement.
  - [ ] 10.6 Synchronize all overlapping rows in `prd-draft-dash-debug.md`, this task list, and the master ledger and record verification evidence.

## NEW Tasks

- [ ] NEW 11.0 Append every verified implementation gap, regression, open question, manual/provider dependency, and optimization discovered during execution here before closing the initiative.
