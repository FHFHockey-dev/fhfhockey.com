# PRD: FORGE Projection Engine Modularization + Rename (`runProjectionV2.ts` -> `run-forge-projections.ts`)

## Introduction/Overview
The current FORGE projection runner is implemented in a single file: `web/lib/projections/runProjectionV2.ts` (6,811 LOC). It currently mixes data access, orchestration, projection math, type definitions, constants, uncertainty metadata assembly, and persistence writes in one module.

This PRD defines a **no-behavior-change structural refactor** that:
- Renames the entry file to `run-forge-projections.ts`.
- Splits responsibilities into focused modules.
- Preserves all projection outputs and business logic semantics.
- Improves maintainability, testability, and execution efficiency.

This PRD is written to be used directly with ChatGPT 5.3 Codex in VS Code.

## Goals
1. Reduce orchestrator complexity by extracting reusable modules while preserving output parity.
2. Rename `runProjectionV2.ts` to `run-forge-projections.ts` and update all references across code/tests/docs/scripts.
3. Preserve all current model behavior and data contracts (including uncertainty payload shape).
4. Increase test surface for isolated calculators and data-fetch layers.
5. Identify and stage follow-up opportunities for projection accuracy, runtime efficiency, and observability.

## User Stories
- As a developer, I want the projection pipeline split into domain modules so I can change one area without risking unrelated behavior.
- As a developer, I want a stable entrypoint (`run-forge-projections.ts`) with clear stages so I can reason about execution quickly.
- As a maintainer, I want deterministic parity checks and snapshot tests so refactors do not silently alter projection outputs.
- As an operator, I want better observability and caching boundaries to reduce runtime and debugging time.

## Functional Requirements
1. **File Rename + Reference Updates**
1. Rename `web/lib/projections/runProjectionV2.ts` to `web/lib/projections/run-forge-projections.ts`.
2. Update runtime imports/usages at minimum:
- `web/pages/api/v1/db/run-projection-v2.ts`
- `web/lib/projections/runProjectionV2.test.ts` (or rename test file accordingly)
- `fix_terminal.sh`
3. Update repo references in internal docs/tasks where needed to avoid stale onboarding context.

2. **Modularization Targets**
1. Extract types into `web/lib/projections/types/*`:
- game/team/goalie/skater row types
- adjustment/result payload types
- orchestrator IO contract types
2. Extract constants to `web/lib/projections/constants/projection-weights.ts` and related files:
- stale windows, priors, clamps, multipliers, pool thresholds, horizon constants
3. Extract pure utilities to `web/lib/projections/utils/*`:
- numeric (`clamp`, safe conversion, stddev/rate helpers)
- date/horizon helpers (`daysBetweenDates`, bounds, recency parsing)
- collection helpers (`pickLatestByPlayer`, merges)
4. Extract data access layer to `web/lib/projections/queries/*`:
- skater data fetchers
- goalie data fetchers
- team context fetchers
- run lifecycle (`createRun`, `finalizeRun`)
5. Extract calculators to `web/lib/projections/calculators/*`:
- skater adjustments
- goalie starter and save-pct/context adjustments
- team context adjustments
- scenario blending and reconciliation validation helpers
6. Keep orchestration in `web/lib/projections/run-forge-projections.ts` as a top-down pipeline calling extracted modules.

3. **Behavioral Parity Guardrails**
1. Preserve projection math and clamps exactly unless explicitly flagged in a separate “accuracy improvement” phase.
2. Preserve persisted table contracts:
- `forge_player_projections`
- `forge_team_projections`
- `forge_goalie_projections`
- `forge_runs`
3. Preserve uncertainty payload structure and metadata keys.
4. Add parity tests comparing old/new outputs for fixed fixtures (deterministic snapshots).

4. **Required Audit-Driven Refactor Seams**
1. Split `runProjectionV2ForDate` (~line 4130 onward) into stage functions:
- preflight/context loading
- per-game team skater projection stage
- goalie candidate/starter stage
- persistence stage
- metrics finalization
2. Replace large anonymous inline object assembly with typed builders:
- skater uncertainty metadata
- starter model metadata
- goalie uncertainty metadata
3. Remove `any` usage where possible and introduce typed row decoders for Supabase responses.

5. **Performance and Efficiency Requirements**
1. Batch/parallelize independent fetches per team/game where safe.
2. Minimize repeated date parsing and repeated map/set reconstruction in hot loops.
3. Ensure query boundaries support memoization by `(teamId, asOfDate)` and `(playerId, asOfDate)` keys.
4. Keep deadline checks and timeout semantics unchanged.

## Non-Goals (Out of Scope)
- Changing projection business logic in the core refactor phase.
- Altering DB schema/table design.
- Replacing Supabase client stack.
- Introducing new product-facing API endpoints.

## Design Considerations
- Preserve current API entrypoint behavior in `web/pages/api/v1/db/run-projection-v2.ts`.
- Maintain compatibility with existing tests while migrating to new module paths.
- Keep naming convention kebab-case for new extracted files.

## Technical Considerations
- Current file characteristics observed during audit:
- 6,811 lines, high concentration of constants, types, fetchers, and calculators in one module.
- Extensive `toFixed` rounding occurs throughout; preserve rounding points to avoid output drift.
- Multiple `any` casts from Supabase rows; convert to typed adapters.
- Existing tests import many pure helpers from monolith; migrate to stable module exports.

### Known Repo References to Update (confirmed)
- `web/pages/api/v1/db/run-projection-v2.ts` (import path)
- `web/lib/projections/runProjectionV2.test.ts` (import path; optionally rename file)
- `fix_terminal.sh` (hardcoded file path)
- Documentation/task markdown files that reference old filename

### Accuracy Improvement Opportunities (post-parity phase)
1. Fix learning counter inconsistency: `assistRecent` currently increments off `goalsRecent` signal (should likely use assist recency signal).
2. Improve uncertainty calibration by validating scenario mixture weights against realized outcomes.
3. Replace fixed heuristic weights with configuration-driven calibration set and backtest harness.
4. Add recency decay curves by stat family (shots/goals/assists) instead of shared decay patterns.
5. Introduce stronger goalie context linkage between confirmed starters and opponent skater scoring adjustments.

### Explicit Post-Parity Backlog (Tracking Only)
All items below are explicitly out of scope for structural parity refactor implementation and must be executed only in a separate post-parity phase.

| Backlog ID | Improvement | Approval For Parity Phase | Post-Parity Backlog Status | Notes |
| --- | --- | --- | --- | --- |
| PP-ACC-001 | Fix `assistRecent` learning counter to use assist-recency signal (not goals-recency signal). | Not approved | Approved for follow-up tracking | Behavioral/math change; requires parity baseline lock before implementation. |
| PP-ACC-002 | Calibrate uncertainty scenario-mixture weights against realized outcomes. | Not approved | Approved for follow-up tracking | Requires backtest design and acceptance thresholds. |
| PP-ACC-003 | Move fixed heuristic weights to configuration-driven calibrated weight sets. | Not approved | Approved for follow-up tracking | Requires config schema + tuning workflow + guardrails. |
| PP-ACC-004 | Introduce stat-family-specific recency decay curves (shots/goals/assists). | Not approved | Approved for follow-up tracking | Expected output drift; must be isolated from modularization commits. |
| PP-ACC-005 | Strengthen confirmed-starter goalie context linkage into opponent skater adjustments. | Not approved | Approved for follow-up tracking | Coupled skater/goalie logic update; requires targeted parity deltas and rollback plan. |

### Optimization Opportunities
1. Parallelize compatible Supabase queries inside per-team stage.
2. Move repeated metadata object construction into factory helpers to reduce allocations and surface errors earlier.
3. Centralize conversion/rounding utilities for consistency and lower duplication.
4. Add lightweight runtime profiling counters per stage to identify bottlenecks.

## Success Metrics
1. Structural:
- `run-forge-projections.ts` orchestrator reduced to stage composition file.
- Monolith split into typed modules (`types`, `constants`, `utils`, `queries`, `calculators`).
2. Behavioral:
- Parity tests pass with no meaningful drift on fixture dates.
- Existing unit tests pass after import migration.
3. Operational:
- No regression in API response shape or DB write contracts.
- Runtime equal or improved for same date-range execution.

## Open Questions
1. Should this PRD include strict numeric tolerance for parity snapshots (exact vs epsilon by field)?
2. Should markdown docs under `/tasks` be updated in this refactor PR, or deferred to a follow-up docs sweep?
3. Do we want to rename `web/pages/api/v1/db/run-projection-v2.ts` endpoint in this effort, or keep endpoint naming stable for backward compatibility?

---

## Codex 5.3 Execution Prompt (Copy/Paste)

You are ChatGPT 5.3 Codex in VS Code. Execute this PRD exactly.

### Objective
Refactor `web/lib/projections/runProjectionV2.ts` into a modular architecture and rename it to `web/lib/projections/run-forge-projections.ts` **without changing projection outputs or DB payload semantics**.

### Constraints
- Preserve all current math/business logic and output fields.
- No schema changes.
- Keep API behavior unchanged.
- Keep deadline/timeout behavior unchanged.
- Maintain current rounding points unless explicitly documented and approved.

### Required Steps
1. Rename file and update all repo references/imports.
2. Extract types, constants, utilities, query functions, and calculators into dedicated modules.
3. Refactor `runProjectionV2ForDate` into stage-oriented orchestration using extracted modules.
4. Keep public export name callable by existing API route (or provide temporary compatibility export while migrating).
5. Update and/or add tests to ensure parity and module-level correctness.
6. Produce a migration summary with:
- files created/moved
- imports updated
- tests added/updated
- any unresolved risks

### Mandatory Validation
- Run existing relevant tests and new parity tests.
- Verify no unresolved imports.
- Verify API route compiles and still calls the projection runner successfully.

### Deliverables
- Modularized projection code under `web/lib/projections/`
- Renamed orchestrator `run-forge-projections.ts`
- Updated references across repo
- Test updates with parity evidence
- Concise implementation report
