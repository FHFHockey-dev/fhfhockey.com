# Date Range Matrix Refactor — Completion Tasks

## Relevant Files

- `tasks/TASKS/dead-code-cleanup/prd-drm-refactor.md` - Source PRD, architecture contract, hotfixes, performance guidance, and rollout plan.
- `web/pages/drm.tsx` - Current route and pre-existing active refactor changes.
- `web/components/DateRangeMatrix/useDateRangeMatrixData.ts` - Unified raw/aggregated data hook.
- `web/components/DateRangeMatrix/DateRangeMatrixView.tsx` - Presentational view wrapper.
- `web/components/DateRangeMatrix/index.tsx` - Core matrix renderer and legacy wrapper.
- `web/components/DateRangeMatrix/DateRangeMatrixForGames.tsx` - Specialized raw-source wrapper and dead-code candidate.
- `web/components/DateRangeMatrix/fetchAggregatedData.ts` - Aggregated read/normalization path with pre-existing changes.
- `web/components/DateRangeMatrix/lineCombinationHelper.ts` - Shared lines/pairs derivation with pre-existing changes.
- `web/components/DateRangeMatrix/lineCombinationHelper.test.ts` - Current regression coverage added in the dirty tree.
- `web/components/DateRangeMatrix/drm.module.scss` and `index.module.scss` - Page/matrix responsive, datepicker, control, and grid styling.
- `web/components/DateRangeMatrix/TeamDropdown.tsx` - Physical selector that must coexist with TeamSelect.
- `web/components/DateRangeMatrix/LinePairGrid.tsx` - Secondary consumer of aggregated/derived contracts.

### Notes

- This list repairs the missing task pair. Several target files already contain pre-existing uncommitted work; inspect and preserve those diffs before editing.
- The unified hook/view are claimed implemented, but parity, stability, pagination, and runtime behavior remain unverified.
- Keep both team selectors per the PRD unless a later approved product decision changes scope.
- Delete `DateRangeMatrixForGames` only after current consumers are proven absent and its unique use case is intentionally retired.

## Tasks

- [ ] 1.0 Reconcile current dirty implementation with the PRD architecture
  - [ ] 1.1 Inspect status/diffs and map current route, hook, view, renderer, raw/aggregated fetchers, helper, styles, and tests to each PRD requirement.
  - [ ] 1.2 Verify hook input/output types and stable ownership for loading, errors, team identity, roster, TOI, home/away, ATOI, lines, and pairs.
  - [ ] 1.3 Identify duplicated fetching/derivation still present in page, core renderer, LinePairGrid, or specialized wrapper and add targeted consolidation tasks.
  - [ ] 1.4 Confirm no unrelated user changes are overwritten and record the exact active implementation baseline.

- [ ] 2.0 Make raw and aggregated data paths complete, stable, and parity-testable
  - [ ] 2.1 Verify raw shift-chart and aggregated inputs share canonical player/team/date/mode semantics and identity mapping.
  - [ ] 2.2 Add explicit pagination for any potentially complete-table Supabase reads and verify returned counts until a short page.
  - [ ] 2.3 Stabilize hook dependencies and memoize aggregated rows to eliminate update-depth loops without hiding real data changes.
  - [ ] 2.4 Centralize lines/pairs calculation for both sources and test ordering, thresholds, multi-position/goalie handling, missing rows, and ties.
  - [ ] 2.5 Add a bounded QA comparison path for representative teams/date ranges and document expected source differences rather than forcing false equality.
  - [ ] 2.6 Return explicit loading, empty, partial, stale, and error state plus source/coverage metadata.

- [ ] 3.0 Finish page/view wiring and controls
  - [ ] 3.1 Ensure `drm.tsx` uses the unified hook and props-only view without duplicate derivation or unstable object construction.
  - [ ] 3.2 Preserve both horizontal TeamSelect and physical TeamDropdown with synchronized canonical abbreviation state and accessible labels.
  - [ ] 3.3 Keep date range, season type, mode, and source/QA URL state deterministic and restorable.
  - [ ] 3.4 Fix datepicker clipping with portal and/or scoped overflow/z-index behavior that works on desktop and mobile.
  - [ ] 3.5 Verify invalid ranges, no schedule/data, team changes, source changes, and rapid control changes do not leave stale or mixed results.

- [ ] 4.0 Complete presentation, accessibility, and performance polish
  - [ ] 4.1 Align typography, spacing, colors, controls, page header, loading/empty states, and focus styles with current FHFH tokens without redesigning the matrix.
  - [ ] 4.2 Add horizontal-scroll affordance, readable sticky layers, contrast/tooltips/aria labels for matrix cells, and keyboard-visible focus.
  - [ ] 4.3 Memoize measured heavy transforms and stable props; remove/gate debug logs and avoid speculative virtualization below demonstrated roster-size need.
  - [ ] 4.4 Measure representative load/interaction/render behavior and append any verified bottleneck as a `NEW` task.

- [ ] 5.0 Resolve specialized wrapper and duplicate-code disposition
  - [ ] 5.1 Search all imports/routes/tests/docs for `DateRangeMatrixForGames` and identify any planned game-detail use.
  - [ ] 5.2 Keep it as a thin typed wrapper when a supported consumer exists; otherwise record the retirement decision and remove only after approval if route/product scope changes.
  - [ ] 5.3 Reconcile `useTOIData`, LinePairGrid fetches, and legacy default wrapper paths with the unified contract and remove only proven duplicates.

- [ ] 6.0 Run targeted and integrated verification
  - [ ] 6.1 Run focused helper/hook/component tests, TypeScript checks, and SCSS/build validation using current package commands.
  - [ ] 6.2 Browser-verify representative regular/playoff date ranges, raw/aggregated QA, modes, both selectors, datepicker, loading/empty/error, and responsive widths.
  - [ ] 6.3 Confirm no maximum-update-depth error, duplicate fetch storm, missing player, mixed source, stale result, console error, or sticky/overflow regression.
  - [ ] 6.4 Update the PRD, this list, Relevant Files, dead-code disposition, and master ledger with parity/performance/test evidence.

## NEW Tasks

- [ ] NEW 7.0 Append every verified parity defect, pagination gap, stale-state issue, consumer conflict, accessibility problem, and optimization discovered during execution here before closure.
