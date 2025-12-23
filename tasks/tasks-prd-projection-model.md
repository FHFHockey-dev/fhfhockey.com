## Relevant Files

- `tasks/prd-projection-model.md` - Source PRD for the projections engine scope, constraints, and acceptance criteria.
- `web/rules/supabase-table-structure.md` - Inventory of existing Supabase tables/views (e.g., `games`, `players`, `lineCombinations`, `nst_*`, `wgo_*`).
- `web/rules/nst-team-tables-schemas.md` - Team-level NST schemas by situation (5v5/PP/PK/all).
- `web/rules/supabase-sql-tables.md` - Additional schema notes/materialized views used in existing modeling.
- `web/lib/supabase/Upserts/fetchWGOdata.js` - Populates core entities like `games`/`teams`/`seasons` (and related WGO pulls).
- `web/lib/supabase/Upserts/fetchWGOskaterStats.js` - Skater game-log stats used for per-game/player aggregates.
- `web/lib/supabase/Upserts/fetchWGOgoalieStats.js` - Goalie game-log stats for goalie aggregates and starter modeling.
- `web/lib/supabase/Upserts/fetchPbP.ts` - Play-by-play ingestion (`pbp_games`, `pbp_plays`) for event-derived features.
- `web/lib/supabase/Upserts/supabaseShifts.js` - Shift/TOI ingestion (key for ES/PP/PK splits + line inference).
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - Existing rolling feature builder patterns (recent vs baseline, strength configs).
- `web/pages/api/v1/db/update-start-chart-projections.ts` - Existing “projection job” pattern (cron + upsert) to reuse/extend.
- `web/lib/cron/withCronJobAudit.ts` - Cron job audit/logging wrapper for scheduled pipeline runs.
- `migrations/20251223_create_projection_runs_v2.sql` - Adds `projection_runs_v2` for run metadata/status/metrics.
- `migrations/20251223_create_projection_derived_tables_v2.sql` - Adds derived per-game aggregate tables (`*_game_strength_v2`, `goalie_game_v2`).
- `migrations/20251223_create_roster_events.sql` - Adds `roster_events` for structured lineup/news overrides.
- `migrations/20251223_create_projection_outputs_v2.sql` - Adds projection output tables (`*_projections_v2`) keyed by run/game/entity/horizon.
- `migrations/20251223_add_projection_indexes_and_constraints_v2.sql` - Adds query indexes and sanity constraints for v2 tables.
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
- `web/lib/projections/ingest/shifts.ts` - Minimal shiftcharts fetch + PP/ES split via `situationCode` segments, upsert into `shift_charts` totals.
- `web/pages/api/v1/db/ingest-projection-inputs.ts` - Date-range incremental ingestion endpoint (PbP + shift totals).
- `web/lib/projections/derived/situation.ts` - Decodes `situationCode` and maps to ES/PP/PK for a given team.
- `web/lib/projections/derived/buildStrengthTablesV2.ts` - Builds `player_game_strength_v2` and `team_game_strength_v2` from `shift_charts` + `pbp_plays`.
- `web/lib/projections/derived/buildGoalieGameV2.ts` - Builds `goalie_game_v2` from PbP (SA/GA/saves; TOI deferred).
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - Date-range endpoint to populate derived v2 strength tables.
- `web/lib/projections/runProjectionV2.ts` - Baseline horizon=1 projection runner writing `*_projections_v2` and `projection_runs_v2`.
- `web/pages/api/v1/db/run-projection-v2.ts` - Endpoint to trigger a projection run for a date.
- `web/lib/projections/reconcile.test.ts` - Unit tests for reconciliation constraints (new, Vitest).

### Notes

- Data already available (or ingested via existing scripts) includes: `games`, `players`, `teams`, `lineCombinations`, `pbp_games`/`pbp_plays`, shift/TOI artifacts, WGO skater/goalie/team game logs, and NST team tables by situation (5v5/PP/PK/all).
- The repo already contains a `player_projections` table and job for the Start Chart; the new engine PRD calls for run-scoped outputs (`projection_runs`, `player_projections`, `team_projections`, `goalie_projections`) plus derived per-game strength tables. Decide whether to extend the existing `player_projections` table or introduce `*_projections_v2` to avoid breaking the Start Chart.
- PRD constraint: Supabase/Postgres is storage + serving only; feature engineering/projections run in a compute layer.
- Tests in `web/` run via `cd web && npm test` (Vitest).
- Decision (Task 1.1): keep existing Start Chart `player_projections` unchanged; add new “engine” tables with `*_v2` names (or new names) to avoid breaking current endpoints and allow phased migration.
- Decision (Task 2.1, MVP inputs):
  - Schedule/games: `games` (already ingested).
  - Skater TOI splits: `shift_charts.total_es_toi` + `shift_charts.total_pp_toi` (PK split deferred unless/ until available).
  - Shots/goals/assists by strength: derive from `pbp_plays` using `typeDescKey` + `situationCode` + shooter/scorer/assist ids.
  - Goalie SA/GA/saves: `goaliesGameStats` for per-game values (season priors can come from `wgo_goalie_stats`/`wgo_goalie_stats_totals` later), with starter probabilities from `goalie_start_projections` and overrides from `roster_events`.
- Data quality (Task 2.7): `projection_runs_v2.metrics.data_quality` tracks missing PbP/shift totals/line combos, missing rolling metrics, and TOI scaling diagnostics for each projection run.

### Workflow (per `web/rules/process-task-list.mdc`)

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
- [ ] 3.0 Implement horizon=1 projection engine (team opportunities → player shares → conversion) + reconciliation
- [ ] 3.1 Define MVP feature set + priors (rolling windows, season baselines) and document how each is computed (outside SQL)
- [ ] 3.2 Implement team opportunity baseline model by strength (minutes + shots), using existing NST/WGO team tables as inputs where appropriate
- [ ] 3.3 Implement player usage/share model by strength (TOI share, shot share, PP usage), leveraging `lineCombinations`/shift signals when available
- [ ] 3.4 Implement conversion models (shots→goals, goals→assists) with shrinkage/priors and guardrails for small samples
- [ ] 3.5 Implement goalie layer (starter probability from `goalie_start_projections`/`roster_events`; SA from opponent/team context; GA from SA×(1-sv%))
- [ ] 3.6 Implement reconciliation pass (hard constraints for team TOI + shots; optional goals constraint) and write unit tests for these invariants
- [ ] 3.7 Write the run orchestrator that reads derived tables + events, writes projections for all games on a target date, and upserts under a new `projection_runs` row
- [x] 3.8 Baseline run orchestrator (rolling metrics) writing v2 projections + run logs
- [ ] 4.0 Add uncertainty simulation (p10/p50/p90) + horizon>1 schedule scaffolding
- [ ] 4.1 Define uncertainty inputs and distributions (team opportunity noise, player share noise, conversion noise, goalie scenario noise)
- [ ] 4.2 Implement simulation loop for horizon=1 and extract quantiles per stat into `uncertainty` JSONB (p10/p50/p90 at minimum)
- [ ] 4.3 Extend simulation to horizon 2–10 by iterating over the schedule slice (home/away/rest placeholders OK for MVP)
- [ ] 4.4 Add interval calibration checks to backtests (coverage vs nominal) and store summary metrics
- [ ] 4.5 Validate performance (batching, chunked upserts) so nightly runs complete within the MVP target
- [ ] 5.0 Ship API + ops (read endpoints, admin triggers/events, nightly scheduler, backtest report)
- [ ] 5.1 Implement read endpoints for player/team/goalie projections with filtering (date, game_id, team_id, player_id, horizon, run_id) and stable response schemas
- [ ] 5.2 Implement run metadata endpoints (`/runs/latest`, `/runs/{run_id}`) and ensure pagination/limits for large queries
- [ ] 5.3 Implement admin endpoints: trigger run for a date, create/update `roster_events`, and (optional) set confirmed starters
- [ ] 5.4 Add nightly scheduler (Vercel Cron or GitHub Actions) that triggers the run + persists `cron_job_audit` via `withCronJobAudit`
- [ ] 5.5 Add observability: structured logs, `projection_runs.status` transitions, failure capture, and run metrics summaries
- [ ] 5.6 Implement backtest report job (at least last 30 days): MAE for shots/goals, interval coverage, and a stored artifact (table row or file path)
- [ ] 5.7 Document ops runbooks (how to run locally, how to backfill, how to debug missing data) and keep PRD open questions updated
