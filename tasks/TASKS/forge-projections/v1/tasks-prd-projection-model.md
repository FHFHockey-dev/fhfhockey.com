## Relevant Files

- `tasks/prd-projection-model.md` - Source PRD for the projections engine scope, constraints, and acceptance criteria.
- `tasks/TASKS/schema-docs/supabase-context/supabase-table-structure.md` - Inventory of existing Supabase tables/views (e.g., `games`, `players`, `lineCombinations`, `nst_*`, `wgo_*`).
- `tasks/TASKS/schema-docs/supabase-context/nst-team-tables-schemas.md` - Team-level NST schemas by situation (5v5/PP/PK/all).
- `tasks/TASKS/schema-docs/supabase-context/supabase-sql-tables.md` - Additional schema notes/materialized views used in existing modeling.
- `web/lib/supabase/Upserts/fetchWGOdata.js` - Populates core entities like `games`/`teams`/`seasons` (and related WGO pulls).
- `web/lib/supabase/Upserts/fetchWGOskaterStats.js` - Skater game-log stats used for per-game/player aggregates.
- `web/lib/supabase/Upserts/fetchWGOgoalieStats.js` - Goalie game-log stats for goalie aggregates and starter modeling.
- `web/lib/supabase/Upserts/fetchPbP.ts` - Play-by-play ingestion (`pbp_games`, `pbp_plays`) for event-derived features.
- `web/lib/projections/ingest/shifts.ts` - Canonical Shift/TOI ingestion (key for ES/PP/PK splits + line inference); the dormant standalone `supabaseShifts.js` helper was retired under B-DRM NEW 22.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - Existing rolling feature builder patterns (recent vs baseline, strength configs).
- `web/pages/api/v1/db/update-start-chart-projections.ts` - Existing “projection job” pattern (cron + upsert) to reuse/extend.
- `web/lib/cron/withCronJobAudit.ts` - Cron job audit/logging wrapper for scheduled pipeline runs.
- `migrations/20251223_create_projection_runs_v2.sql` - Adds `projection_runs_v2` for run metadata/status/metrics.
- `migrations/20251223_create_projection_derived_tables_v2.sql` - Adds derived per-game aggregate tables (`*_game_strength_v2`, `goalie_game_v2`).
- `migrations/20251223_create_roster_events.sql` - Adds `roster_events` for structured lineup/news overrides.
- `migrations/20251223_create_projection_outputs_v2.sql` - Adds projection output tables (`*_projections_v2`) keyed by run/game/entity/horizon.
- `migrations/20251223_add_projection_indexes_and_constraints_v2.sql` - Adds query indexes and sanity constraints for v2 tables.
- `migrations/20251224_rename_projection_tables_to_forge.sql` - Renames the v2 tables to a shared `forge_` prefix for Supabase grouping.
- `migrations/20251226_add_shift_charts_pk_toi.sql` - Adds `shift_charts.total_pk_toi` so PK TOI can be derived reliably.
- `web/lib/supabase/database-generated.types.ts` - Updated to include the new v2 tables and `roster_events`.
- `functions/` - Optional home for a compute-layer pipeline (Python) if we keep projection compute out of Next.js routes.
- `web/pages/api/v1/projections/players.ts` - Proposed read endpoint for player projections (new).
- `web/pages/api/v1/projections/teams.ts` - Proposed read endpoint for team projections (new).
- `web/pages/api/v1/projections/goalies.ts` - Proposed read endpoint for goalie projections (new).
- `web/pages/api/v1/runs/latest.ts` - Proposed endpoint to fetch latest run metadata (new).
- `web/pages/api/v1/runs/trigger.ts` - Proposed admin endpoint to trigger a compute run (new).
- `web/pages/api/v1/events/index.ts` - Proposed admin endpoint for `roster_events` CRUD (new).
- `web/lib/projections/` - Proposed home for projection-engine logic shared across jobs/endpoints (new).
- `web/lib/projections/adapters/types.ts` - Adapter interfaces and minimal row shapes for schedule/PbP/shifts/goalies.
- `web/lib/projections/adapters/supabaseAdapters.ts` - First concrete adapter implementation backed by Supabase reads.
- `web/lib/projections/ingest/nhleFetch.ts` - Fetch helper with retries/timeouts for NHL endpoints.
- `web/lib/projections/ingest/time.ts` - Clock parsing/format helpers for shift interval math.
- `web/lib/projections/ingest/pbp.ts` - Minimal PbP fetch + upsert into `pbp_games`/`pbp_plays`.
- `web/lib/projections/ingest/shifts.ts` - Minimal shiftcharts fetch + ES/PP/PK split via `situationCode` segments, upsert into `shift_charts` totals.
- `web/pages/api/v1/db/ingest-projection-inputs.ts` - Date-range incremental ingestion endpoint (PbP + shift totals).
- `web/lib/projections/derived/situation.ts` - Decodes `situationCode` and maps to ES/PP/PK for a given team.
- `web/lib/projections/derived/buildStrengthTablesV2.ts` - Builds `player_game_strength_v2` and `team_game_strength_v2` from `shift_charts` + `pbp_plays`.
- `web/lib/projections/derived/buildGoalieGameV2.ts` - Builds `goalie_game_v2` from PbP (SA/GA/saves; TOI deferred).
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - Date-range endpoint to populate derived v2 strength tables.
- `web/lib/projections/run-forge-projections.ts` - Baseline horizon=1 projection runner writing `*_projections_v2` and `projection_runs_v2`.
- `web/lib/projections/skaterRollout.ts` - Versioned skater candidate/baseline rollout and rollback contract.
- `web/lib/projections/promotionGates.ts` - Launch-gate and holdout comparison contracts.
- `web/pages/api/v1/db/run-projection-v2.ts` - Endpoint to trigger a projection run for a date.
- `web/pages/api/v1/db/run-projection-accuracy.ts` - Stored 30-day accuracy, calibration, role, miss-attribution, and baseline-comparison reporting.
- `web/pages/api/v1/db/cron-report.ts` - Projection row/freshness observability in cron audit reporting.
- `web/pages/api/v1/projections/_helpers.ts` - Shared query parsing and “latest run” resolution for projections endpoints.
- `web/pages/api/v1/projections/players.ts` - Read endpoint for v2 player projections (filters + defaults to latest succeeded run).
- `web/pages/api/v1/projections/teams.ts` - Read endpoint for v2 team projections (filters + defaults to latest succeeded run).
- `web/pages/api/v1/projections/goalies.ts` - Read endpoint for v2 goalie projections (filters + defaults to latest succeeded run).
- `web/pages/api/v1/runs/latest.ts` - Read endpoint for latest `projection_runs_v2` row (optionally by date).
- `web/pages/api/v1/runs/[runId].ts` - Read endpoint for detailed FORGE run metadata, row counts, preflight output, warnings, gates, and scan summary.
- `web/__tests__/pages/api/v1/runs/detail.test.ts` - Route test for the FORGE run-detail API response contract.
- `web/pages/api/v1/forge/roster-events.ts` - Admin CRUD endpoint for curated `forge_roster_events`.
- `web/lib/projections/rosterEvents.ts` - Shared helpers for reviewed-tweet-to-roster-event mapping and roster-event preflight gates.
- `web/lib/projections/rosterEvents.test.ts` - Unit tests for roster-event mapping and stale/missing-input preflight gates.
- `tasks/artifacts/forge-prediction-operator-runbook.md` - Operator runbook for daily order, triage, and rollback.
- `web/lib/projections/reconcile.test.ts` - Unit tests for reconciliation constraints (new, Vitest).

### Notes

- Data already available (or ingested via existing scripts) includes: `games`, `players`, `teams`, `lineCombinations`, `pbp_games`/`pbp_plays`, shift/TOI artifacts, WGO skater/goalie/team game logs, and NST team tables by situation (5v5/PP/PK/all).
- The repo already contains a `player_projections` table and job for the Start Chart; the new engine PRD calls for run-scoped outputs (`projection_runs`, `player_projections`, `team_projections`, `goalie_projections`) plus derived per-game strength tables. Decide whether to extend the existing `player_projections` table or introduce `*_projections_v2` to avoid breaking the Start Chart.
- PRD constraint: Supabase/Postgres is storage + serving only; feature engineering/projections run in a compute layer.
- Tests in `web/` run via `cd web && npm test` (Vitest).
- Decision (Task 1.1): keep existing Start Chart `player_projections` unchanged; add new “engine” tables with `*_v2` names (or new names) to avoid breaking current endpoints and allow phased migration.
- Naming: projection engine tables use the `forge_` prefix (FORGE — Forecasting & Outcome Reconciliation Game Engine).
- Decision (Task 2.1, MVP inputs):
  - Schedule/games: `games` (already ingested).
  - Skater TOI splits: `shift_charts.total_es_toi` + `shift_charts.total_pp_toi` + `shift_charts.total_pk_toi`.
  - Shots/goals/assists by strength: derive from `pbp_plays` using `typeDescKey` + `situationCode` + shooter/scorer/assist ids.
  - Goalie SA/GA/saves: `goaliesGameStats` for per-game values (season priors can come from `wgo_goalie_stats`/`wgo_goalie_stats_totals` later), with starter probabilities from `goalie_start_projections` and overrides from `roster_events`.
- Data quality (Task 2.7): `projection_runs_v2.metrics.data_quality` tracks missing PbP/shift totals/line combos, missing rolling metrics, and TOI scaling diagnostics for each projection run.
- Reconciliation evidence (2026-07-11): the newer skater and goalie nested implementations satisfy the older main-list engine/uncertainty/API/ops rows. Horizon support is now consistently clamped to 1–10; scheduled execution is active in the canonical cron inventory; the accuracy job persists per-stat and 7/14/30-day diagnostics plus interval calibration and holdout comparisons; range execution uses bounded time budgets and explicit chunk/resume cursors. The nested skater 14-day shadow-observation row remains independently open and is not hidden by closing these older implementation rows.

### Workflow (per `tasks/TASKS/rules/process-task-list.mdc`)

- Implement **one sub-task at a time**; do not start the next sub-task until explicitly approved (“y/yes”).
- After finishing a sub-task, immediately mark it `[x]` in this file.
- When completing a parent task: run the full test suite, stage changes, remove temp code/files, commit with conventional commits, then mark the parent task `[x]`.

## Tasks

- [x] 1.0 Finalize projection-engine schema & migrations (runs, derived aggregates, outputs)
- [x] 1.1 Decide table naming/versioning strategy (extend existing `player_projections` vs create `player_projections_v2` and new `team_projections`/`goalie_projections`)
- [x] 1.2 Add `projection_runs` table (run_id, as_of_date, status, git_sha, metrics JSONB, timestamps) and any lightweight status enums
- [x] 1.3 Add derived per-game strength aggregate tables (e.g., `player_game_strength`, `team_game_strength`, `goalie_game`) with strict PKs and required columns for MVP stats
- [x] 1.4 Add lineup/news override table (`roster_events`) aligned with PRD (event_type, confidence, effective window, payload JSONB, source_text)
- [x] 1.5 Add projection output tables (players/teams/goalies) keyed by `(run_id, game_id, entity_id, horizon_games)` and include `uncertainty` JSONB for quantiles
- [x] 1.6 Add indexes for common API access patterns (by date/game/team/player/run_id) and constraints to enforce idempotent upserts
- [x] 1.7 Update/regen `web/lib/supabase/database-generated.types.ts` to include new tables (and verify existing code still compiles)
- [x] 2.0 Build/standardize ingestion adapters + derived per-game strength aggregates
- [x] 2.1 Inventory current ingestion coverage (WGO, PbP, shifts) and confirm which sources are authoritative for MVP stats (TOI/shot/goal/assist splits, goalie SA/GA)
- [x] 2.2 Define adapter interfaces (schedule, boxscore, pbp, shifts) and implement a first concrete version reusing existing `web/lib/supabase/Upserts/*` code where possible
- [x] 2.3 Implement an incremental ingestion/orchestration job (date-based, rerunnable) that fills gaps and backfills as needed
- [x] 2.4 Build derived-table builder for `player_game_strength` (TOI ES/PP/PK, shots/goals/assists splits) from the chosen raw sources
- [x] 2.5 Build derived-table builder for `team_game_strength` (minutes/shots/goals by strength) and reconcile against sums of player aggregates (pre-checks)
- [x] 2.6 Build derived-table builder for `goalie_game` (SA, GA, saves, TOI) and map goalie ids to `players`
- [x] 2.7 Add data quality checks (missing games, TOI sanity, duplicate rows, team totals vs player totals) and persist run-level metrics to `projection_runs.metrics`
- [x] 3.0 Implement horizon=1 projection engine (team opportunities → player shares → conversion) + reconciliation
- [x] 3.1 Define MVP feature set + priors (rolling windows, season baselines) and document how each is computed (outside SQL)
- [x] 3.2 Implement team opportunity baseline model by strength (minutes + shots), using existing NST/WGO team tables as inputs where appropriate
- [x] 3.3 Implement player usage/share model by strength (TOI share, shot share, PP usage), leveraging `lineCombinations`/shift signals when available
- [x] 3.4 Implement conversion models (shots→goals, goals→assists) with shrinkage/priors and guardrails for small samples
- [x] 3.5 Implement goalie layer (starter probability from `goalie_start_projections`/`roster_events`; SA from opponent/team context; GA from SA×(1-sv%))
- [x] 3.6 Implement reconciliation pass (hard constraints for team TOI + shots; optional goals constraint) and write unit tests for these invariants
- [x] 3.7 Write the run orchestrator that reads derived tables + events, writes projections for all games on a target date, and upserts under a new `projection_runs` row
- [x] 3.8 Baseline run orchestrator (rolling metrics) writing v2 projections + run logs
- [x] 4.0 Add uncertainty simulation (p10/p50/p90) + horizon>1 schedule scaffolding
- [x] 4.1 Define uncertainty inputs and distributions (team opportunity noise, player share noise, conversion noise, goalie scenario noise)
- [x] 4.2 Implement simulation loop for horizon=1 and extract quantiles per stat into `uncertainty` JSONB (p10/p50/p90 at minimum)
- [x] 4.3 Extend simulation to horizon 2–10 by iterating over the schedule slice (home/away/rest placeholders OK for MVP)
- [x] 4.4 Add interval calibration checks to backtests (coverage vs nominal) and store summary metrics
- [x] 4.5 Validate performance (batching, chunked upserts) so nightly runs complete within the MVP target. **OWNER-APPROVED EVIDENCE EXCEPTION (2026-07-11):** runtime success was not observed on deployed current-date data; model promotion remains blocked until it is.
- [x] 5.0 Ship API + ops (read endpoints, admin triggers/events, nightly scheduler, backtest report)
- [x] 5.1 Implement read endpoints for player/team/goalie projections with filtering (date, game_id, team_id, player_id, horizon, run_id) and stable response schemas
- [x] 5.2 Implement run metadata endpoints (`/runs/latest`, `/runs/{run_id}`) and ensure pagination/limits for large queries
- [x] 5.2a Add v2 read endpoints (players/teams/goalies + runs/latest)
- [x] 5.3 Implement admin endpoints: trigger run for a date, create/update `roster_events`, and (optional) set confirmed starters
- [x] 5.4 Add nightly scheduler (Vercel Cron or GitHub Actions) that triggers the run + persists `cron_job_audit` via `withCronJobAudit`
- [x] 5.5 Add observability: structured logs, `projection_runs.status` transitions, failure capture, and run metrics summaries
- [x] 5.6 Implement backtest report job (at least last 30 days): MAE for shots/goals, interval coverage, and a stored artifact (table row or file path)
- [x] 5.7 Document ops runbooks (how to run locally, how to backfill, how to debug missing data) and keep PRD open questions updated


## October 11 private HIT/BLK participation intake checkpoint

This tranche records **accepted private local engineering**. The historical implementation rows above retain their original scope. Actual target participation, predictive qualification, issuance, public serving and the full RSO case are not accepted by this checkpoint.

- [x] OCT11-P1 Implement the private participation intake in `web/lib/projections/privateParticipationScenario.ts` with exact canonical/NHL player, team, game, season and cutoff/evaluation binding; retain original body/hash, source/parser, publication/receipt/created/accepted times, child assignment, expiry and conflict-resolution receipts.
- [x] OCT11-P2 Reuse the existing time/participation validators; preserve unknown appearance and reject missing, future, expired, uncertain/DTD/projected or unresolved contradictory facts. Only an exact accepted observation selection may supersede involved evidence. The numeric 0/1 indicator is explicitly an evidence-policy scenario, with calibrated probability and public admission false.
- [x] OCT11-P3 Close the independently reproduced output-contract defect: every BLOCKED result exposes `validatedEvidence: null`; raw `retainedFacts`/`retainedConflicts` remain available for audit. The valid scenario control still reduces to 1; body-hash mismatch, evaluation-time expiry and canonical-player mismatch each reduce to null downstream.
- [x] OCT11-P4 Freeze and independently review the exact two-file correction. Owner checks passed 29/29 fictional mechanics regressions, scoped pair lint and direct-pair TypeScript. The same reviewer re-ran the byte-identical four-case probe and accepted PRIVATE LOCAL v2. No aggregate suite, capture, producer, ordinary replay or hosted write was performed for this correction.

Remaining gates are separate from the accepted local implementation:

- [ ] OCT11-G1 Supply genuine exact-target current confirmed EV or explicit-exclusion receipts, then resolve source validity/expiry, contradictions, later downgrades and supersession at the explicit diagnostic evaluation time. Accepted immutable PRIVATE BLOCKED readiness v3 remains unchanged; its held inputs do not establish current applicability.
- [ ] OCT11-G2 Supply authentic provider eligibility and a common legal slot/date for the two selected players through the RSO owner. Native wing positions, roster membership and stored `game_key=477` do not establish this.
- [ ] OCT11-G3 Obtain separately authorized genuine ordinary issuance/selection with actual clocks and a legitimate new cutoff after later evidence. The morning historical reconstruction keeps its original identity/cutoff and cannot become an issued context through this validator.
- [ ] OCT11-G4 Close the existing full ten-category consumer case only with supported/admitted G/A/PPP/SOG/HIT/BLK and W/GA/SV/SO inputs and actual required context. The retained provisional conditional HIT/BLK mechanics do not close missing heads or qualify predictive accuracy; goals-only team totals and goalie expected-start reports cannot substitute.
- [ ] OCT11-G5 Obtain separate release/public-serving authority and TJ's disposition of the paused RSO goal. No public imports, forecast admission, model-weight change, schema/data publish or goal resumption follows from private engineering acceptance.

Evidence and ownership:

- Correction handoff: `/Users/tim/Documents/Codex/2026-10-11/task/private-participation-intake-v1/correction-v2/HANDOFF-v2.json`, SHA256 `3a16fec974dfa680b7eede8d636c04ae8ac6612aa634fedfb62e7120c3885ffb`.
- Same-reviewer acceptance: `/Users/tim/Documents/Codex/2026-10-10/task-6/oct11-release/independent-reviews/FORGE-ACCEPTANCE-v2.json`, SHA256 `17eb8a365c81d2c222d3b12a8afdd90421ebf334774c2aceb0c7e623cdf597df`.
- Frozen source/test SHA256: `858309b484fde6867c88a74d78efbf158ce4b0cba168fbd911ab3719abff48e8` / `aa2e21ad6d8c1deeac60447233ddbd634627e5296dc472830fc298897b926206`.
- Prior rejected v1, accepted 19-source checkpoint and immutable PRIVATE BLOCKED v3 were preserved. The new pair remains uncommitted/frozen. FORGE claims only its registered source pair and this checklist; Executive owns the central super-goal status, and the RSO owner retains its seven files.
