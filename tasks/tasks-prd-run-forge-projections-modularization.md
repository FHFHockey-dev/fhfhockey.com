## Relevant Files

- `web/lib/projections/run-forge-projections.ts` - Current orchestrator source after rename and decomposition.
- `web/lib/projections/run-forge-projections.ts` - New orchestrator entrypoint after rename; stage-composition only.
- `web/lib/projections/runProjectionV2.test.ts` - Existing test suite importing monolith helpers; update imports and/or rename test file.
- `web/lib/projections/types/*.ts` - Extracted projection row/result/contract types used across modules.
- `web/lib/projections/types/run-forge-projections.types.ts` - Centralized extracted row, adjustment, starter, and orchestrator IO contract types for parity-safe modularization.
- `web/lib/projections/constants/projection-weights.ts` - Extracted projection constants (windows, priors, clamps, multipliers, thresholds).
- `web/lib/projections/constants/projection-weights.ts` - Source-of-truth module for extracted FORGE projection constants imported by orchestrator/calculators.
- `web/lib/projections/utils/*.ts` - Extracted pure helpers for numeric/date/collection logic.
- `web/lib/projections/utils/number-utils.ts` - Extracted numeric/rate/stat helpers (`clamp`, conversions, rate blend, stddev/sigmoid) reused by the orchestrator.
- `web/lib/projections/utils/date-utils.ts` - Extracted date/day-bound/horizon-scalar helpers preserving stale-window and rest-day semantics.
- `web/lib/projections/utils/collection-utils.ts` - Extracted collection helpers for latest-by-player and normalized numeric-array merges.
- `web/lib/projections/utils/projection-metadata-builders.ts` - Typed builders for skater/goalie uncertainty metadata and starter-model metadata assembly.
- `web/lib/projections/queries/*.ts` - Supabase data-access layer and run lifecycle query helpers.
- `web/lib/projections/queries/skater-queries.ts` - Extracted skater fetch paths (rolling metrics, deployment priors, shot/on-ice profiles, sustainability trend bands).
- `web/lib/projections/queries/goalie-queries.ts` - Extracted goalie/starter-context fetch paths and opponent goalie context lookups.
- `web/lib/projections/queries/team-context-queries.ts` - Extracted team context/prior/environment fetchers used by skater and goalie stages.
- `web/lib/projections/queries/run-lifecycle-queries.ts` - Extracted run lifecycle persistence helpers (`createRun`, `finalizeRun`) for `forge_runs` semantics.
- `web/lib/projections/calculators/*.ts` - Extracted skater/goalie/team/scenario calculators.
- `web/lib/projections/calculators/skater-adjustments.ts` - Extracted skater adjustment calculators (shot quality, on-ice/team/opponent context, rest, small-sample shrinkage, strength split conversion rates).
- `web/pages/api/v1/db/run-projection-v2.ts` - API route must keep behavior and endpoint name, but update runner import path.
- `fix_terminal.sh` - Script reference should point to the renamed runner source path.
- `FORGE_EXPLAINED.md` - Update stale source-file references to new runner filename.
- `FORGE_ECOSYSTEM_ELI5_AUDIT.md` - Update stale references to runner filename and architecture description.
- `tasks/prd-run-forge-projections-modularization.md` - Source PRD; maintain alignment for scope guardrails and follow-up phase labeling.
- `tasks/*.md` - Task/docs files that referenced `runProjectionV2.ts`; update where needed to prevent stale onboarding context.
- `tasks/tasks-prd-run-forge-projections-modularization.md` - Active execution checklist, dependency tracking, and frozen reference inventory for this workflow.

### Notes

- Structural refactor only in parity phase: no projection math/business-logic/output-contract changes.
- Any accuracy/math improvements must be captured as explicit post-parity follow-up tasks and not mixed into refactor tasks.
- Keep endpoint path `/api/v1/db/run-projection-v2` and cron job naming stable unless separately approved.
- Place new tests alongside new modules when possible; preserve and migrate existing regression coverage.
- Validation commands should include targeted tests first, then full suite/type/import integrity checks before completing validation parent task.

## Tasks

- [x] 1.0 Phase 1 - Rename Entrypoint And Build Safety Net
  - [x] 1.1 Inventory all repository references to `runProjectionV2.ts` / `runProjectionV2ForDate` and freeze a checklist for code, tests, scripts, and docs updates. [Deps: none] [Files: `web/**`, `tasks/**`, `*.md`, `fix_terminal.sh`] [AC: checklist enumerates every affected reference class and is attached in this task file or implementation notes]
  - [x] 1.2 Add/confirm parity harness inputs (fixed-date fixtures and deterministic run settings) before structural edits begin. [Deps: 1.1] [Files: `web/lib/projections/runProjectionV2.test.ts` or new parity test file] [AC: test plan asserts old-vs-refactor output parity for player/team/goalie payload fields]
  - [x] 1.3 Rename `web/lib/projections/runProjectionV2.ts` to `web/lib/projections/run-forge-projections.ts` with compatibility export strategy if needed for temporary import continuity during migration. [Deps: 1.2] [Files: `web/lib/projections/run-forge-projections.ts`, optional shim file] [AC: build resolves runner exports without behavior change]
  - [x] 1.4 Update direct runtime/script/test references to new filename, including `web/pages/api/v1/db/run-projection-v2.ts`, `web/lib/projections/runProjectionV2.test.ts` (or renamed test), and `fix_terminal.sh`. [Deps: 1.3] [Files: listed explicit files] [AC: `rg` finds no stale direct imports or hardcoded paths in runtime/test scripts]

- [x] 2.0 Phase 2 - Extract Types And Constants Without Logic Changes
  - [x] 2.1 Create `web/lib/projections/types/` modules for row types, adjustment/result payload types, orchestrator IO contracts, and uncertainty metadata structures. [Deps: 1.4] [Files: `web/lib/projections/types/*.ts`] [AC: no `any` in migrated type surfaces unless documented as unavoidable]
  - [x] 2.2 Introduce typed Supabase row decoders/adapters and replace broad `any` casts in touched extraction seams. [Deps: 2.1] [Files: `web/lib/projections/types/*.ts`, `web/lib/projections/queries/*.ts`, orchestrator imports] [AC: decoded row contracts compile and preserve current null/optional behavior]
  - [x] 2.3 Extract constants into `web/lib/projections/constants/projection-weights.ts` and sibling constant modules (windows, priors, clamps, multipliers, thresholds, horizon constants). [Deps: 2.1] [Files: `web/lib/projections/constants/*.ts`] [AC: constant values match monolith exactly with no numeric drift]
  - [x] 2.4 Update orchestrator/module imports to consume extracted types/constants with no execution-order or default-value changes. [Deps: 2.2, 2.3] [Files: `web/lib/projections/run-forge-projections.ts`, extracted modules] [AC: compile succeeds and test snapshots remain unchanged]

- [x] 3.0 Phase 3 - Extract Pure Utilities And Builders
  - [x] 3.1 Extract numeric helpers (`clamp`, safe conversions, rate/stddev helpers) into `web/lib/projections/utils/number-utils.ts`. [Deps: 2.4] [Files: `web/lib/projections/utils/number-utils.ts`] [AC: helper unit tests cover edge/null/NaN behavior parity]
  - [x] 3.2 Extract date/horizon helpers into `web/lib/projections/utils/date-utils.ts` while preserving current parsing and recency boundaries. [Deps: 2.4] [Files: `web/lib/projections/utils/date-utils.ts`] [AC: no change to stale-window or deadline semantics]
  - [x] 3.3 Extract collection helpers (latest-by-player, merge/reconcile helpers) into `web/lib/projections/utils/collection-utils.ts`. [Deps: 2.4] [Files: `web/lib/projections/utils/collection-utils.ts`] [AC: duplicate-resolution behavior matches baseline fixtures]
  - [x] 3.4 Replace large inline uncertainty/starter metadata object assembly with typed builder helpers. [Deps: 3.1, 3.2, 3.3] [Files: `web/lib/projections/utils/*` or `web/lib/projections/calculators/*`] [AC: metadata key set and shape are byte-for-byte equivalent in parity outputs]

- [x] 4.0 Phase 4 - Extract Query Layer And Preserve Run Lifecycle Contracts
  - [x] 4.1 Create `web/lib/projections/queries/skater-queries.ts` for skater fetch paths currently embedded in monolith. [Deps: 3.4] [Files: `web/lib/projections/queries/skater-queries.ts`] [AC: same filtering, joins, and fallback behavior as baseline]
  - [x] 4.2 Create `web/lib/projections/queries/goalie-queries.ts` and `team-context-queries.ts` for goalie/team context access. [Deps: 3.4] [Files: `web/lib/projections/queries/goalie-queries.ts`, `web/lib/projections/queries/team-context-queries.ts`] [AC: no change in eligible-record selection]
  - [x] 4.3 Create `web/lib/projections/queries/run-lifecycle-queries.ts` for `createRun`/`finalizeRun` and related persistence lifecycle helpers. [Deps: 3.4] [Files: `web/lib/projections/queries/run-lifecycle-queries.ts`] [AC: `forge_runs` writes preserve status fields, timestamps, and error handling semantics]
  - [x] 4.4 Add safe memoization boundaries by `(teamId, asOfDate)` and `(playerId, asOfDate)` where PRD marks as optimization-safe, without changing result order/content. [Deps: 4.1, 4.2] [Files: query modules/orchestrator wiring] [AC: deterministic output parity retained; repeated fetch overhead reduced or equal]

- [x] 5.0 Phase 5 - Extract Calculators And Recompose Orchestrator Stages
  - [x] 5.1 Extract skater adjustment calculators into `web/lib/projections/calculators/skater-adjustments.ts`. [Deps: 4.4] [Files: `web/lib/projections/calculators/skater-adjustments.ts`] [AC: rounding points and clamps exactly preserved]
  - [x] 5.2 Extract goalie starter/save-pct/context calculators into dedicated goalie calculator modules. [Deps: 4.4] [Files: `web/lib/projections/calculators/goalie-*.ts`] [AC: starter probabilities, uncertainty shape, and context adjustments remain parity-consistent]
  - [x] 5.3 Extract team context and scenario blending/reconciliation validators into dedicated calculator helpers. [Deps: 4.4] [Files: `web/lib/projections/calculators/team-context-adjustments.ts`, `web/lib/projections/calculators/scenario-blending.ts`] [AC: reconciliation guard behavior and output contracts unchanged]
  - [x] 5.4 Refactor `runProjectionV2ForDate` implementation into stage-oriented orchestration in `run-forge-projections.ts` (preflight/context load, per-game skater stage, goalie stage, persistence stage, metrics finalization). [Deps: 5.1, 5.2, 5.3] [Files: `web/lib/projections/run-forge-projections.ts`] [AC: orchestrator becomes top-down composition; deadlines/timeouts unchanged]

- [x] 6.0 Phase 6 - Reference Hygiene And Post-Parity Follow-Up Separation
  - [x] 6.1 Update internal docs/tasks/script references from `runProjectionV2.ts` to `run-forge-projections.ts` where they describe source file location (excluding intentional historical mentions). [Deps: 5.4] [Files: `FORGE_EXPLAINED.md`, `FORGE_ECOSYSTEM_ELI5_AUDIT.md`, `tasks/*.md`, `fix_terminal.sh`] [AC: no misleading active-path references remain]
  - [x] 6.2 Verify API route naming remains stable (`run-projection-v2.ts` endpoint unchanged) while import path points to new orchestrator module. [Deps: 1.4, 5.4] [Files: `web/pages/api/v1/db/run-projection-v2.ts`] [AC: endpoint contract/backward compatibility preserved]
  - [x] 6.3 Create explicit post-parity backlog entries for approved/non-approved math or accuracy improvements listed in PRD (assist recency counter fix, uncertainty calibration, configurable weights, recency-decay refinements, goalie context linkage). [Deps: 6.1] [Files: `tasks/prd-run-forge-projections-modularization.md` or dedicated follow-up task doc] [AC: no accuracy-change work is included in parity-phase implementation tasks]

- [x] 7.0 Phase 7 - Validation, Parity Evidence, And Execution Readiness
  - [x] 7.1 Run targeted unit/module tests for extracted utils, queries, calculators, and orchestrator entrypoint imports. [Deps: 5.4] [Files: test files under `web/lib/projections/**`] [AC: targeted tests pass with updated paths]
  - [x] 7.2 Run deterministic parity checks comparing baseline vs modularized outputs for fixed fixture dates, covering `forge_player_projections`, `forge_team_projections`, `forge_goalie_projections`, and uncertainty metadata payload keys. [Deps: 7.1] [Files: parity test artifacts] [AC: no meaningful drift; any tolerated epsilon must be explicitly documented and approved]
  - [x] 7.3 Run repository-level type/import integrity validation (`tsc`/build/lint as applicable) to confirm no unresolved imports after rename and extraction. [Deps: 7.1] [Files: repo config + touched modules] [AC: zero unresolved import/type errors in touched scope]
  - [x] 7.4 Capture migration report summary (files moved/created, import updates, validation outcomes, unresolved risks) and attach to PR/task notes for implementation workflow handoff. [Deps: 7.2, 7.3] [Files: PR description or task notes] [AC: report includes parity evidence and explicit residual-risk list]

### 1.1 Frozen Reference Inventory Checklist

- Runtime import + symbol usage:
  - `web/pages/api/v1/db/run-projection-v2.ts:59` imports `runProjectionV2ForDate` from `lib/projections/runProjectionV2`.
  - `web/pages/api/v1/db/run-projection-v2.ts:725` and `:802` invoke `runProjectionV2ForDate(...)`.
- Source export definition:
  - `web/lib/projections/runProjectionV2.ts:4130` exported `runProjectionV2ForDate` (historical pre-rename snapshot).
- Test import coverage:
  - `web/lib/projections/runProjectionV2.test.ts:41` imports from `./runProjectionV2`.
- Script hardcoded path coverage:
  - `fix_terminal.sh:2` referenced `web/lib/projections/runProjectionV2.ts` (historical pre-rename snapshot).
- Docs/task references requiring review for active-path staleness:
  - `FORGE_EXPLAINED.md`
  - `FORGE_ECOSYSTEM_ELI5_AUDIT.md`
  - `tasks/tasks-prd-projection-model.md`
  - `tasks/tasks-goalie-forge.md`
  - `tasks/tasks-skater-forge.md`
  - `tasks/goalie-forge-implementation-plan.md`
  - `tasks/prd-run-forge-projections-modularization.md` (historical PRD context; keep intentional mentions, update only where needed for active guidance)

### 1.2 Frozen Parity Harness Inputs (Pre-Refactor Baseline)

- Deterministic fixture dates for parity runs:
  - `2026-01-24` (mid-range date from existing operator runbook flows)
  - `2026-01-31` (range end fixture from existing operator runbook flows)
  - `2026-02-08` (single-date fixture from existing operator runbook flows)
- Deterministic run settings (apply to both baseline and modularized runner):
  - Endpoint: `/api/v1/db/run-projection-v2`
  - Query: `date=YYYY-MM-DD&horizonGames=1&maxDurationMs=270000&bypassPreflight=true`
  - Keep endpoint path and handler behavior unchanged; compare runner internals only.
- Baseline capture protocol (before structural refactor starts):
  - Run one projection per fixture date against current `runProjectionV2` implementation.
  - Persist baseline snapshots keyed by date and entity ID for:
    - `forge_player_projections` (`as_of_date`, `player_id`)
    - `forge_team_projections` (`as_of_date`, `team_id`)
    - `forge_goalie_projections` (`as_of_date`, `goalie_id`)
  - Include uncertainty metadata payload and key-set snapshots in baseline artifacts.
- Parity assertions required after modularization:
  - Row-count parity by table/date.
  - Identity-key parity by table/date (no missing/extra entity keys).
  - Field parity for numeric/stat outputs and uncertainty payload shape/keys.
  - If any numeric epsilon is needed, document and approve explicitly before accepting drift.
- Current test-suite status note:
  - `web/lib/projections/runProjectionV2.test.ts` currently covers many pure helpers but does not yet provide full end-to-end old-vs-new table parity coverage; this is intentionally staged under Phase 7 parity execution tasks.

### 7.2 Parity Evidence (In Progress)

- Artifact files:
  - `tasks/artifacts/forge-projections-parity-report-2026-fixtures.json`
  - `tasks/artifacts/forge-projections-parity-delta-summary.json`
  - `tasks/artifacts/forge-projections-parity-report-2026-fixtures.md`
- Baseline run source for deterministic comparison: pre-modularization commit `a3f6173` executed against the same current DB state via `/api/v1/db/run-projection-v2`.
- Current outcome: row-count parity `PASS`, identity-key parity `PASS`, uncertainty key-shape parity `PASS`, scalar exact parity `FAIL` with max absolute scalar delta `0.005`.
- Approved epsilon for this parity gate: `<= 0.005` absolute scalar delta (user-approved on 2026-03-03), so `7.2` is accepted.

### 7.3 Integrity Evidence

- `npx tsc --noEmit` (in `web`) passed.
- Stale runtime import scan for `runProjectionV2` paths in `web/**` (excluding markdown) returned no matches.
- `npx vitest --run lib/projections/module-imports.test.ts` passed.
- `npm run build` currently fails due pre-existing unrelated lint error(s) outside touched projection scope (for example `pages/FORGE.tsx` `react/no-unescaped-entities`), so build was not used as gating for touched-scope import/type integrity.
