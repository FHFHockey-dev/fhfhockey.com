## Relevant Files

- `tasks/prd-projection-model.md` - Original FORGE projection PRD context and baseline success criteria.
- `tasks/goalie-forge.md` - Reference for parity expectations between goalie and skater modeling sophistication.
- `tasks/tasks-goalie-forge.md` - Process template for phased checklist execution and handoff hygiene.
- `tasks/tasks-skater-forge.md` - Skater optimization checklist and execution log for sequential implementation.
- `web/lib/projections/run-forge-projections.ts` - Main skater + goalie projection orchestrator; current skater model logic lives here.
- `web/lib/projections/runProjectionV2.test.ts` - Unit tests for skater/goalie projection helpers and regression coverage.
- `web/lib/projections/reconcile.ts` - Team-to-player reconciliation constraints for TOI and shot distributions.
- `web/lib/projections/uncertainty.ts` - Skater uncertainty simulation and quantile output.
- `web/lib/projections/promotionGates.ts` - Launch-gate and shadow-mode improvement helpers for skater/FORGE promotion decisions.
- `web/lib/projections/promotionGates.test.ts` - Regression tests for promotion-gate threshold and shadow-mode comparison behavior.
- `web/lib/projections/skaterRollout.ts` - Versioned skater feature flag, rollback selection, and promotion/monitoring governance contract.
- `web/lib/projections/skaterRollout.test.ts` - Regression coverage for default preservation, explicit rollback, and 14-day governance requirements.
- `web/lib/projections/derived/buildStrengthTablesV2.ts` - Derived skater/team strength feature inputs.
- `web/pages/api/v1/db/ingest-projection-inputs.ts` - PbP + shift ingest dependency for skater derived features.
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - Derived table build orchestrator for skater inputs.
- `web/pages/api/v1/db/run-projection-v2.ts` - Projection run endpoint + preflight dependency gates.
- `web/__tests__/pages/api/v1/db/run-projection-v2.test.ts` - Skater freshness/preflight and operator-contract regression coverage.
- `web/pages/api/v1/db/run-projection-accuracy.ts` - Accuracy, calibration, and diagnostics persistence.
- `web/pages/api/v1/db/cron-report.ts` - Cron audit/email projection row and skater-freshness observability.
- `web/pages/api/v1/forge/players.ts` - Skater FORGE read endpoint consumed by UI.
- `web/__tests__/pages/api/v1/forge/players.test.ts` - Contract coverage for skater metadata, confidence drivers, ranges, and fallback diagnostics.
- `web/pages/FORGE.tsx` - FORGE UI surface for skater projections and uncertainty display.
- `web/__tests__/pages/FORGE.test.tsx` - Landing-page regression coverage for skater confidence and disclosure rendering.
- `web/lib/dashboard/topAddsRanking.ts` - Preserves skater confidence drivers through the landing-page waiver ranking pipeline.
- `tasks/TASKS/schema-docs/supabase-context/player-table-schemas.md` - Skater table field inventory (`wgo_skater_stats` and related stats).
- `tasks/TASKS/schema-docs/supabase-context/supabase-table-structure.md` - Broader schema map for team/opponent/lineup context tables.
- `tasks/TASKS/schema-docs/supabase-context/supabase-views.md` - Unified/materialized views and NST-derived signals suitable for model inputs.
- `tasks/TASKS/forge-projections/v1/docs/goalie-forge-operator-runbook.md` - Shared goalie/skater preflight, backfill, validation, and failure-triage runbook.

### Notes

- Goal: bring skater model sophistication to parity with the upgraded goalie pipeline.
- Prioritize measurable uplift in skater MAE/RMSE and interval calibration over purely additive feature count.
- Preserve backward compatibility in `forge_player_projections` schema unless migration is explicitly approved.
- Add tests next to modified model code; avoid shipping heuristic changes without regression coverage.

## Tasks

- [x] 1.0 Harden skater candidate and role assignment hygiene
  - [x] 1.1 Add active-skater filtering guards so stale/inactive skaters are near-eliminated from projection pools.
  - [x] 1.2 Add line-combination recency validation (hard fail/soft fallback) for teams with stale or missing lines.
  - [x] 1.3 Add role tagging (L1/L2/L3/L4, PP1/PP2, D1/D2/D3) from latest line combos with fallback rules.
  - [x] 1.4 Add role continuity features (games in current role over last N) and role-volatility penalties.
  - [x] 1.5 Add injury/availability weighting parity with goalie handling using `forge_roster_events`.
  - [x] 1.6 Persist skater-selection diagnostics in uncertainty metadata (source rows, role, recency, fallback path).
  - [x] 1.7 Add unit tests for stale lineup, inactive skater, and emergency fallback edge cases.

- [x] 2.0 Expand skater feature set using available Supabase/NST/WGO signals
  - [x] 2.1 Integrate `wgo_skater_stats` deployment features (TOI/GP, ES TOI, PP TOI share) into TOI projection priors.
  - [x] 2.2 Integrate shot-quality features (`ixg`, `ixg_per_60`, rush/rebound chance rates where available).
  - [x] 2.3 Integrate on-ice context (`nst_oi_xgf_per_60`, `nst_oi_xga_per_60`, possession rates) into scoring environment.
  - [x] 2.4 Integrate team-level context (`wgo_team_stats`, `nhl_team_data`, `nst_team_*`) for pace and defensive strength.
  - [x] 2.5 Add opponent-goalie context multiplier (starter quality/uncertainty-aware) to skater scoring conversion.
  - [x] 2.6 Add rest/schedule features (team rest, B2B, travel proxy if available) for TOI and conversion adjustments.
  - [x] 2.7 Add small-sample shrinkage guards and fallback priors for low-minute / call-up players.

- [x] 3.0 Upgrade skater projection math and rate modeling
  - [x] 3.1 Split conversion modeling into separate ES and PP goal/assist processes instead of one shared rate.
  - [x] 3.2 Add hierarchical/Bayesian blending for each rate with adaptive prior strength by sample size.
  - [x] 3.3 Rework PP opportunity modeling using projected team PP time + unit share allocation.
  - [x] 3.4 Add teammate context coupling (assist dependency by line/PP unit) to reduce over-independent outputs.
  - [x] 3.5 Add role-specific ceilings/floors to curb unrealistic TOI/shot spikes for depth skaters.
  - [x] 3.6 Validate team-level reconciliation preserves realistic per-player distributions post-scaling.

- [x] 4.0 Add skater scenario modeling and richer uncertainty outputs
  - [x] 4.1 Build top role-scenarios per skater (e.g., PP1 vs PP2, top-6 vs middle-6) with probabilities.
  - [x] 4.2 Generate scenario-level skater stat lines independently and blend by scenario probability.
  - [x] 4.3 Extend uncertainty simulation to include role/start uncertainty (not only Poisson stat noise).
  - [x] 4.4 Add horizon >1 game support parity using sequential schedule scalars and scenario propagation.
  - [x] 4.5 Persist scenario metadata in `uncertainty.model` (`model_version`, `scenario_count`, top scenario drivers).
  - [x] 4.6 Add unit tests for scenario blending correctness and quantile behavior under uncertainty mixtures.

- [x] 5.0 Strengthen skater accuracy diagnostics, calibration, and launch gates
  - [x] 5.1 Add skater stat diagnostics by role bucket (top line, middle six, PP1, PP2, defense pair tiers).
  - [x] 5.2 Add component-level miss attribution (TOI miss vs shot-rate miss vs conversion miss).
  - [x] 5.3 Add interval calibration diagnostics by stat (`g`, `a`, `pts`, `sog`, `ppp`) and role bucket.
  - [x] 5.4 Add rolling 7/14/30-day skater dashboards in calibration snapshots for trend monitoring.
  - [x] 5.5 Define skater launch gates (sample floor, MAE/RMSE thresholds, coverage/calibration bands).
  - [x] 5.6 Add holdout comparison reports versus current baseline and versus naive prior baselines.

- [x] 6.0 Improve skater API/UI transparency and explainability
  - [x] 6.1 Extend `/api/v1/forge/players` with model metadata (`modelVersion`, `scenarioCount`, `calibrationHints`).
  - [x] 6.2 Add API diagnostics for empty results/fallback behavior matching goalie endpoint observability level.
  - [x] 6.3 Add UI blocks in `FORGE.tsx` for skater confidence drivers (role, PP share, matchup, rest).
  - [x] 6.4 Add uncertainty label consistency and definitions for floor/typical/ceiling across skater outputs.
  - [x] 6.5 Add disclosure notes for skater model limits and data freshness caveats.
  - [x] 6.6 Add regression tests/snapshots for players API schema and skater UI rendering states.

- [x] 7.0 Improve skater pipeline reliability and freshness guarantees
  - [x] 7.1 Add skater-specific preflight gates in `run-projection-v2` (line freshness, role coverage, derived freshness).
  - [x] 7.2 Add stale-data detectors for missing recent skater derived rows and stale role priors by team.
  - [x] 7.3 Add resumable/chunked backfill strategy for skater-heavy date ranges with clear restart semantics.
  - [x] 7.4 Add skater-focused observability metrics to cron audit + cron report email components.
  - [x] 7.5 Add operator runbook section for skater backfills, validations, and common failure triage.

- [x] 8.0 Rollout, experimentation, and governance
  - [x] 8.1 Introduce model versioning + feature flags for skater model rollout safety.
  - [x] 8.2 Run shadow-mode comparisons for at least 14 days before default switch. **OWNER-APPROVED EVIDENCE EXCEPTION (2026-07-11):** 14 elapsed matched dates were not observed. The default must not be switched/promoted until that evidence exists.
  - [x] 8.3 Define acceptance criteria and rollback triggers for production enablement.
  - [x] 8.4 Publish post-launch monitoring checklist and weekly recalibration cadence.

## Progress Snapshot (For Next Codex Chat)

- Completed: `1.1` (active-skater filtering guards: team/position checks + metric recency staleness handling).
- Completed: `1.2` (line-combination recency assessment + fallback skater pool + hard-fail when fallback unavailable).
- Completed: `1.3` (role tagging from line combinations with TOI-ranked fallback tagging and role metadata in uncertainty payloads).
- Completed: `1.4` (role-history continuity signals over recent line combos with volatility-based stability multipliers and uncertainty metadata).
- Completed: `1.5` (expanded roster-event availability weighting, unavailable filtering counters, and skater availability event metadata in uncertainty payloads).
- Completed: `1.6` (skater-selection diagnostics now persisted with source rows, fallback path, active-pool counts, line-combo recency class, and per-player metric recency details).
- Completed: `1.7` (added edge-case tests for stale lineup boundaries, inactive skater filtering, and emergency fallback role assignment).
- Completed: `2.1` (`wgo_skater_stats` deployment TOI priors now blend with rolling EV/PP TOI in `runProjectionV2ForDate`, with data-quality counters and helper tests).
- Completed: `2.2` (added `player_stats_unified` shot-quality priors using `nst_ixg_per_60`, `nst_shots_per_60`, rush/rebound rates to adjust shot generation and conversion with bounded multipliers + diagnostics/tests).
- Completed: `2.3` (added `player_stats_unified` on-ice context priors using `nst_oi_xgf_per_60`, `nst_oi_xga_per_60`, and possession rates to adjust shot/goal/assist environment with bounded multipliers + diagnostics/tests).
- Completed: `2.4` (added team-level pace/defense context from `nhl_team_data`, `wgo_team_stats`, and `nst_team_*` into skater shot/goal/assist multipliers with diagnostics/tests).
- Completed: `2.5` (added opponent-goalie quality/uncertainty multiplier from `goalie_start_projections` to skater goal/assist conversion with diagnostics/tests).
- Completed: `2.6` (added rest/schedule multipliers from team/opponent rest days + home/away proxy to TOI, shot rate, goal rate, and assist rate with diagnostics/tests).
- Completed: `2.7` (added explicit small-sample shrinkage and call-up fallback priors for TOI, shot rates, and conversion rates using evidence-weighted blending + diagnostics/tests).
- Completed: `3.1` (split conversion into ES/PP-specific goal and assist rates, updated projection math/output diagnostics, and added helper tests).
- Completed: `3.2` (added adaptive Bayesian-style prior strength by sample size for ES/PP goal and assist rates, replacing fixed prior strengths).
- Completed: `3.3` (reworked PP opportunity modeling by allocating team PP target seconds across skaters using role-weighted unit shares, with diagnostics and tests).
- Completed: `3.4` (added teammate-context assist coupling using line-group and PP-share dependency, applied to ES/PP assist rates with diagnostics/tests).
- Completed: `3.5` (added role-specific usage ceilings/floors for TOI and shot rates to curb depth-skater spikes, with diagnostics/tests).
- Completed: `3.6` (added reconciliation distribution validation/stabilization with share guardrails, renormalization to targets, and observability metrics/tests).
- Completed: `4.1` (added role-scenario generation per skater with normalized probabilities, plus uncertainty and data-quality diagnostics/tests).
- Completed: `4.2` (added scenario-level skater stat line generation and probability-weighted blending for goals/assists, with scenario stat-line diagnostics/tests).
- Completed: `4.3` (extended skater uncertainty simulation with scenario-mixture sampling from role scenario stat-lines, so quantiles reflect role uncertainty in addition to Poisson noise).
- Completed: `4.4` (added horizon-aware scenario propagation using sequential game scalars and role reversion over horizon, with per-game scenario summaries and tests).
- Completed: `4.5` (persisted scenario metadata to skater uncertainty model payload: model version, scenario count, and top scenario drivers).
- Completed: `4.6` (added explicit unit tests for scenario blend math correctness and uncertainty quantile behavior under scenario mixtures).
- Completed: `5.1` (added skater role-bucket diagnostics to projection-accuracy pipeline with MAE/RMSE by bucket/stat, calibration summary persistence, and calibration snapshot scope).
- Completed: `5.2` (added skater component-level miss attribution in projection accuracy: TOI miss vs shot-rate miss vs conversion miss, included in calibration summary, daily calibration snapshots, and endpoint response payload).
- Completed: `5.3` (added role-bucket interval calibration diagnostics for `g/a/pts/sog/ppp`, persisted in calibration snapshots, included in run calibration summary, and surfaced in API response).
- Completed: `5.4` (added skater rolling dashboard diagnostics with 7/14/30-day stat windows, persisted in daily calibration snapshots, and surfaced in calibration summary/API response; also added skater stat-daily rows for `points` and `pp_points` to support rolling windows).
- Completed: `5.5` (defined skater launch gates with explicit sample, MAE/RMSE, and interval-calibration thresholds in the shared promotion-gate contract).
- Completed: `5.6` (persisted scenario-free current-model and fixed league-prior baselines in skater uncertainty metadata; the accuracy job now emits and stores sample-aware MAE/RMSE holdout comparisons with honest insufficient-data states).
- Completed: `6.1`–`6.6` (players API now returns version/scenario/calibration metadata, explicit ready/empty/fallback/error diagnostics, per-player role/PP/matchup/rest drivers, P10/P50/P90 floor/typical/ceiling definitions, freshness/model disclosures, and matching API/landing regression coverage).
- Completed: `7.1`–`7.5` (projection preflight now blocks hard-stale/thin-role/missing-derived scheduled teams, existing chunk/resume semantics are documented, skater row/freshness metrics feed cron reporting, and the shared operator runbook covers repair/resume/validation paths).
- Completed: `8.1`, `8.3`, and `8.4` (versioned candidate/baseline server flag, schema-compatible rollback, explicit promotion/rollback gates, and daily/weekly monitoring plus recalibration cadence).
- Exception closure: `8.2` lacks 14 elapsed matched shadow dates by explicit owner approval on 2026-07-11. Code/documentation are ready, but promotion/default switching remains blocked until evidence exists.
- Suggested first implementation file: `web/lib/projections/run-forge-projections.ts` (candidate/role hygiene foundation).

## Process Rules (Use `process-task-list.mdc`)

- In the next chat, explicitly follow `tasks/TASKS/rules/process-task-list.mdc`.
- Execute one unchecked sub-task at a time.
- After each sub-task:
- update this checklist file;
- run relevant lint/tests/typecheck;
- report exact file changes and validation executed;
- stop and wait for user confirmation before moving to the next sub-task.
- When all sub-tasks of a parent task are complete:
- run full test suite (`cd web && npm test`);
- commit completed parent-task changes with a conventional commit message;
- mark parent task `[x]`;
- then wait for confirmation to continue.

## Skater FORGE Freshness Itinerary

Run in this order for date/range processing:

1. `/api/v1/db/update-games`
2. `/api/v1/db/update-teams`
3. `/api/v1/db/update-players`
4. `/api/v1/db/update-line-combinations`
5. `/api/v1/db/update-rolling-player-averages`
6. `/api/v1/db/ingest-projection-inputs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
7. `/api/v1/db/build-projection-derived-v2?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
8. `/api/v1/db/update-goalie-projections-v2?date=YYYY-MM-DD` (required for opponent-goalie context parity)
9. `/api/v1/db/run-projection-v2?date=YYYY-MM-DD&horizonGames=1`
10. `/api/v1/db/run-projection-accuracy?date=YYYY-MM-DD`

Operational notes:

- Use `chunkDays` + `resumeFromDate` for long backfills on ingest/derived/projection endpoints.
- Use `bypassMaxDuration=true` for manual long-range ingestion/derived runs when needed.
- Use `bypassPreflight=true` only in controlled manual scenarios.
