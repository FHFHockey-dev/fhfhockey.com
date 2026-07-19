# Date Range Matrix Refactor — Completion Tasks

## Relevant Files

- `tasks/TASKS/dead-code-cleanup/prd-drm-refactor.md` - Source PRD, architecture contract, hotfixes, performance guidance, and rollout plan.
- `web/pages/drm.tsx` - Active `/drm` route, page-owned Option-A fixed-window resolver, exact-inclusive Custom mode, scope reporting, and unsupported-card containment.
- `web/components/DateRangeMatrix/useDateRangeMatrixData.ts` - Unified raw/aggregated data hook.
- `web/components/DateRangeMatrix/useDateRangeMatrixData.test.tsx` - Regular/playoff mapping, request ordering, invalidation, rejection, and transition-render masking regressions.
- `web/components/DateRangeMatrix/DateRangeMatrixView.tsx` - Presentational view wrapper with explicit result-state rendering.
- `web/components/DateRangeMatrix/DateRangeMatrixView.test.tsx` - Loading, empty, error, and partial-coverage view regressions.
- `web/__tests__/pages/drm.test.tsx` - Aggregate/date ownership, Option-A filter stability, exact Custom transitions, active-preset, synchronous card-scope invalidation, and timezone-safe calendar regressions.
- `web/components/DateRangeMatrix/fetchAggregatedData.test.ts` - Deterministic pagination, exact fixed/post-filter game-ID scope, exact skater/goalie totals, injured-player appearances, unavailable/contradictory-row handling, fail-closed page/identity/fallback, and bounded-filter regressions.
- `web/components/DateRangeMatrix/utilities.test.ts` - Explicit team/season/type-bound completed-window ownership, deterministic hard bounds, ledger validation, and database-error regressions.
- `web/components/DateRangeMatrix/index.tsx` - Core matrix renderer and legacy wrapper.
- `web/components/DateRangeMatrix/DateRangeMatrixForGames.tsx` - Specialized raw-source wrapper and dead-code candidate.
- `web/components/DateRangeMatrix/fetchAggregatedData.ts` - Complete paginated aggregate reader with optional exact game-ID scope and unique matched-game output.
- `web/components/DateRangeMatrix/lineCombinationHelper.ts` - Shared lines/pairs derivation with pre-existing changes.
- `web/components/DateRangeMatrix/lineCombinationHelper.test.ts` - Sole current focused regression file; one helper happy-path test.
- `web/components/DateRangeMatrix/drm.module.scss` and `index.module.scss` - Page/matrix responsive, datepicker, control, scope-status, and grid styling.
- `web/components/DateRangeMatrix/TeamDropdown.tsx` - Physical selector that must coexist with TeamSelect.
- `web/components/DateRangeMatrix/LinePairGrid.tsx` - Pure canonical-scope consumer of the mapped roster, derived line/pair layout, and exact card metrics.
- `web/components/DateRangeMatrix/LinePairGrid.test.tsx` - Exact supported card values, hidden unsupported values, explicit unavailable coverage, and synchronous loading/empty/error/zero-game reset regressions.
- `web/components/DateRangeMatrix/PlayerCardDRM.tsx` and `GoalieCardDRM.tsx` - Props-only exact-stat cards with no independent global/date-only reads.
- `web/styles/LinePairGrid.module.scss` - Supported goalie-stat layout and scoped unavailable-state styling.
- `web/components/DateRangeMatrix/utilities.ts` - Shared `PlayerData` contract plus explicit bounded completed-team-game resolver.
- `web/lib/supabase/pagination.ts` - Shared ordered short-page and bounded-filter pagination helpers used by the aggregated reader.

### Notes

- This list repairs the missing task pair. The target implementation is clean in the shared worktree and traces to committed partial work at `e0a43320291b54a497c3fcd28da989225ddc31fc`; preserve unrelated dirty work outside the target paths.
- The unified hook/view are claimed implemented, but parity, stability, pagination, and runtime behavior remain unverified.
- Keep both team selectors per the PRD unless a later approved product decision changes scope.
- Delete `DateRangeMatrixForGames` only after current consumers are proven absent and its unique use case is intentionally retired.
- Dependency order after the 2026-07-18 audit: committed-baseline reconciliation → active aggregated playoff/value correctness → async request-state safety → deterministic aggregated fetch/date ownership → explicit last-N semantics → displayed-card scope alignment and stale-consumer reset → typed raw-source rebuild/parity → duplicate-owner/wrapper disposition → accessibility/responsive polish → integrated verification. The first six stages are complete. This temporarily advances B-DRM ahead of not-started Wave-B scopes because the implementation is already partial/in progress.
- Before NEW 10.0 starts, checkpoint the exact reviewed 23-path NEW 12/17/18 implementation, regression, style, source-pair, and canonical-control slice. This Codex desktop task cannot write the shared `.git` metadata, so the checkpoint remains a user-owned exact-path action; never substitute broad staging in the mixed worktree. The strict blocked threshold was reached on the third unchanged checkpoint turn; resume only from exact commit evidence.

## Tasks

- [x] 1.0 Reconcile the committed partial implementation with the PRD architecture. Evidence: route/hook/view/raw/aggregated/renderer/style/test ownership and the exact `e0a43320291b54a497c3fcd28da989225ddc31fc` baseline are mapped; every verified defect is appended below as NEW 8.0–16.0 (2026-07-18).
  - [x] 1.1 Inspected status/history and mapped the active `/drm` route, unified hook/view, legacy/raw wrappers, aggregated reader, renderer, helper, styles, and sole focused test to the PRD.
  - [x] 1.2 Verified the current contracts and recorded the missing error/coverage/source states, incorrect playoff bucket, stale-request risks, raw-schema drift, and numeric-type drift as NEW 8.0–11.0/16.0.
  - [x] 1.3 Identified triplicated line/pair derivation, duplicate date-range ownership, the dormant mixed-source default wrapper, and the unconsumed raw wrapper; targeted disposition remains under NEW 12.0/13.0.
  - [x] 1.4 Confirmed every DRM target path was clean before edits, preserved all unrelated shared changes, and recorded the committed partial baseline and dependency reorder in the canonical diary.

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
- [x] NEW 8.0 **P1 — Fix active playoff and aggregate value mapping.** The page now passes explicit season type; the unified mapper selects `regularSeasonData` or `playoffData`, converts `totalTOI` and relationship values to finite numeric contracts, derives canonical team/franchise identity, rejects invalid player IDs, and keeps a stable default aggregate reference. Focused regular/playoff/identity/hook regressions pass 4/4; the combined DRM helper group passes 2 files/5 tests, full TypeScript and scoped ESLint pass, and the changed hook/new test pass Prettier (2026-07-18).
- [x] NEW 9.0 **P1 — Prevent stale or permanently loading DRM results.** Exact request identities now suppress late raw/date/aggregate completions and synchronously mask prior roster/derived state during changed-input renders; invalid inputs and failed/empty last-N lookups clear old dates/data; the hook/view expose deterministic loading/empty/error/partial/stale/source/coverage metadata. Focused hook/view/page/helper verification passes 4 files/14 tests, full TypeScript and scoped diff checks pass, scoped legacy ESLint has zero errors and only three pre-existing page dependency warnings, and the changed hook plus all three new tests pass Prettier (2026-07-18).
- [ ] NEW 10.0 **P1 — Rebuild the promised raw `shift_charts` source against the generated schema.** Remove `@ts-nocheck`, use a typed narrow deterministic short-page reader, normalize nullable/JSON fields, aggregate one roster row per player and one pair/game fact, derive canonical team/ATOI/coverage, and fail closed on page errors.
- [x] NEW 11.0 **P1 — Make the active aggregated reader complete and fail closed.** The page now owns one explicit team/season/date/season-type request; the generated-schema reader uses the shared ordered short-page helper, constrains `team_id`/`season_id`/`game_type` plus exact dates and optional filters, and rejects any page error. Player fallbacks use ordered 200-ID chunks and reject any failed chunk; database failures in last-N date resolution propagate to the page error state; nullable player identities reject instead of becoming silent partial success; and the unused duplicate player reader is removed. The focused DRM/pagination group passes 7 files/31 tests, full TypeScript and scoped diff checks pass, scoped legacy ESLint has zero errors and the same three pre-existing page dependency warnings, the two new tests plus existing page test pass Prettier, and independent final review found no NEW 11 blocker (2026-07-18).
- [x] NEW 12.0 **P2 — Encode owner-approved Option-A last-N plus home/opponent semantics.** L7/L14/L30 now resolve the selected team's exact completed-game IDs first from a page-owned team/season/type-bound WGO request; deterministic `date`/`game_id`/`id` ordering, exact `0..N-1` range, strict ledger validation, and insufficient/error fail-closed behavior define the fixed window. The fully paginated aggregate reader receives those exact IDs and only then applies Home/Away/Opponent, while unique filtered IDs drive truthful `x matching games within last N team games` copy. Manual date edits enter visible exact-inclusive Custom; team/filter changes preserve it, season/type or preset selection exits it, missing/reversed ranges issue no request, active-preset re-clicks are safe no-ops, and paired local-calendar parse/format logic passes full-ISO boundaries in New York and Auckland. The page unmounts unsupported line/goalie cards for Custom/loading/error/empty without claiming NEW 17 or NEW 18 complete. Verification: 7 files/43 focused tests, page 11/11 in both `America/New_York` and `Pacific/Auckland`, full TypeScript, bundled-runtime Sass, Prettier, scoped diff integrity, scoped legacy ESLint with zero errors and the same three pre-existing hook warnings, and independent data/logic re-review pass (2026-07-18).
- [ ] NEW 13.0 **P2 — Consolidate data and derivation ownership.** Remove write-only page state and triplicated line/pair work, make `LinePairGrid` a canonical props consumer, and retain/remove the two dormant wrappers only through the recorded consumer/approval disposition.
- [ ] NEW 14.0 **P2 — Restore selector and matrix accessibility.** Associate labels/IDs, forward control props, add keyboard/focus/pressed semantics, expose a page heading and accessible grid/cell names, and replace hover-only meaning with keyboard/screen-reader-accessible text.
- [ ] NEW 15.0 **P2 — Repair responsive and DatePicker styling contracts.** Use global library selectors where required, make controls and LinePairGrid collapse correctly, preserve visible focus, and provide a readable horizontal-scroll matrix surface at representative mobile/desktop widths.
- [ ] NEW 16.0 **P2 — Validate and restore deterministic URL/season/source state.** Sanitize team/mode values, prevent current-season initialization from overwriting restored dates, persist season/timeframe/source QA state, and ensure the selected season actually constrains data.
- [x] NEW 17.0 **P1 — Align visible LinePairGrid skater/goalie card metrics to the canonical matrix scope.** Exact skater/goalie rows are now fetched only for the aggregate reader's post-filter matched IDs and each player's exact scoped appearances through ordered, bounded, inclusive pagination. Missing, duplicate, malformed, unsafe-identity, and internally contradictory rows stay unavailable instead of becoming zero. Skaters retain exact G/A/PTS/PPP/SOG/HITS/BLKS/+/-; goalies retain exact GP/SV/weighted SV%/weighted GAA while unsupported Record/QS%/SO/GS and all Custom cards are hidden. Filtered, sparse-opponent, injured-player, exact-value, corrupt-row, Custom-hide, and bounded-query regressions pass (2026-07-18).
- [x] NEW 18.0 **P1 — Clear stale LinePairGrid results across unresolved and empty scopes.** One canonical team/season/type/timeframe/date/game-ID/venue/opponent key masks mismatched page results on the first render; late aggregate completions remain sequence-rejected; `LinePairGrid` and both cards are pure props consumers with no retained async state and return empty for incomplete/loading/error/empty/zero-game contracts. Focused A-to-B loading, page-filter invalidation, nonzero-to-zero, empty, and error regressions pass. Combined evidence for NEW 17/18: 8 files/56 tests, 12/12 page tests in New York and Auckland, full TypeScript, bundled-Node Sass, Prettier, diff integrity, zero scoped ESLint errors with the same three pre-existing page warnings, and two independent final audits pass (2026-07-18).
