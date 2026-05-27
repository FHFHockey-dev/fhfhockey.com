# PRD: FORGE — Forecasting & Outcome Reconciliation Game Engine (NHL Projections)

> This PRD is written to be executable by ChatGPT Codex (coding agent) in this repo.
> It includes the current implementation status, concrete file pointers, and the
> remaining work prioritized for MVP.

## 1) One-liner
Build a self-consistent NHL player + team projection system that outputs per-game boxscore projections (by strength: ES/PP/PK) and rolls them up for horizons of 1–10 future games with uncertainty bands, updating nightly (“learn as it goes”).

## 2) Goals
### Primary goals (MVP)
- Produce **per-player** projections for the next **1 game** (extendable to 10) for:
  - Skaters: ES/PP/PK splits for TOI, Goals, Assists, Shots, Hits, Blocks, +/- , PIM (minimum MVP: TOI, Shots, Goals, Assists; others phased)
  - Goalies: Shots Against, Saves, Goals Allowed (+ optional win probability later)
- Produce **team** projections derived from reconciled player totals:
  - Team totals must equal sum of player projections (hard constraints for TOI/shots/goals; softer constraints for assists and derived categories if needed)
- Create **uncertainty** outputs (at least quantiles/intervals) that widen naturally with horizon.
- Update projections nightly using new games + lineup/news updates.

### Secondary goals (post-MVP)
- Multi-game simulation (1–10 games) using schedule context (home/away, rest, travel proxy).
- Lineup/goalie start probability modeling + scenario simulation.
- Advanced metrics trend outputs (xG components / on-ice impacts) if data available.

## 3) Non-goals
- Building a full consumer UI. We will expose an API and a minimal admin/debug interface only.
- In-database analytics. **Supabase/Postgres is storage + serving only.** No heavy SQL computations, no SQL-based feature engineering, no window-function pipelines, no “analytics in SQL”.

## 4) Users & use cases
- Fantasy player: wants reliable next-game and next-week player projections for categories scoring.
- Betting analyst: wants team totals + goalie-influenced scoring environment and uncertainty ranges.

## 5) Key constraints (must-follow)
- **All calculations happen outside Supabase** (compute layer). Supabase stores:
  - raw ingested data (optional),
  - derived per-game aggregates (precomputed),
  - final projections + metadata.
- SQL usage is limited to:
  - table definitions,
  - basic inserts/upserts,
  - indexes,
  - simple selects/filters for API responses.
- The system must support re-running pipelines deterministically (idempotent).

## 6) Data sources (abstracted behind adapters)
Implement adapters so sources can be swapped without rewriting the pipeline.
- Schedule + game results
- Boxscores
- Play-by-play events
- Shifts / TOI splits by strength
- (Optional) external advanced metrics (xG), or compute later

> Codex: Implement data-source adapters as interfaces with one concrete implementation to start.

## 7) System architecture (high-level)
### Components
1. **Ingestion service**
   - Fetches raw data for completed games and upcoming schedule
   - Writes raw JSON (or normalized rows) to object storage and/or Supabase raw tables

2. **Compute pipeline (feature + projection engine)**
   - Reads raw data + prior derived tables
   - Produces derived per-game tables + rolling features
   - Produces projections for players/teams/goalies for horizons 1–10
   - Produces uncertainty outputs (quantiles)

3. **Reconciliation layer**
   - Enforces internal accounting constraints:
     - Team ES/PP/PK TOI totals match sum of player TOI splits
     - Team shots/goals match sum of player shots/goals
     - Goalie GA aligns with opponent goals (scenario-based)
     - Assists bounded/consistent (soft constraint acceptable in MVP)

4. **API service**
   - Read-only endpoints for projections and metadata
   - Minimal admin endpoints for triggering pipeline runs and viewing status

5. **News/lineup override input**
   - Manual feed (curated tweets or admin form) parsed into structured “events”
   - Events update lineup/role assumptions and starter probabilities

### Storage strategy
- Use **object storage for large raw artifacts** (e.g., JSON, Parquet) if desired.
- Use **Supabase** for:
  - canonical entities (players/teams/games),
  - derived aggregates (already computed),
  - projections (final outputs),
  - lineup news events (structured).

## 8) Data model (Supabase tables; storage-only)
> Note: keep columns minimal and store computed “wide” feature blobs as JSONB where appropriate. No SQL feature computation.
> Schema source of truth: `web/rules/context/forge-tables.md` (keep PRD aligned with that file).

### Naming
All projection-engine tables are prefixed with `forge_` so they group together in Supabase:
- `forge_runs`
- `forge_player_game_strength`
- `forge_team_game_strength`
- `forge_goalie_game`
- `forge_roster_events`
- `forge_player_projections`
- `forge_team_projections`
- `forge_goalie_projections`

### Core entities
- teams: team_id, name, abbrev
- players: player_id, name, position, shoots, team_id_current
- games: game_id, season, date_utc, home_team_id, away_team_id, status, venue

### Raw-ish (optional, depending on ingestion strategy)
- raw_game_blobs: game_id, source, fetched_at, blob_path_or_json

### Derived per-game tables (precomputed externally)
- player_game_strength: (game_id, player_id)
  - toi_es_seconds, toi_pp_seconds, toi_pk_seconds
  - shots_es, shots_pp, shots_pk
  - goals_es, goals_pp, goals_pk
  - assists_es, assists_pp, assists_pk
  - hits, blocks, pim, plus_minus
  - (optional) xg_es, ixg_es, on_ice_xg_es, etc.

- team_game_strength: (game_id, team_id)
  - toi_es_seconds, toi_pp_seconds, toi_pk_seconds
  - shots_es/pp/pk, goals_es/pp/pk
  - (optional) xg_es/pp/pk

- goalie_game: (game_id, goalie_id, team_id)
  - shots_against, goals_allowed, saves, toi_seconds

### Lineup & news events (structured overrides)
- roster_events:
  - event_id, created_at, effective_from, effective_to (nullable)
  - team_id (nullable), player_id (nullable)
  - event_type ENUM: [INJURY_OUT, DTD, RETURN, CALLUP, SENDDOWN, LINE_CHANGE, PP_UNIT_CHANGE, GOALIE_START_CONFIRMED, GOALIE_START_LIKELY]
  - confidence (0–1)
  - payload JSONB (e.g., lines, units, notes)
  - source_text (raw tweet text / admin note)

### Projections outputs
- player_projections:
  - run_id, as_of_date, horizon_games (1..10), game_id (nullable for multi-game rollups), player_id, team_id, opponent_team_id
  - projected splits: toi_es/pp/pk, shots_es/pp/pk, goals_es/pp/pk, assists_es/pp/pk
  - projected hits, blocks, pim, plus_minus (phase later)
  - uncertainty JSONB (e.g., p10/p50/p90 per stat)

- team_projections:
  - run_id, as_of_date, horizon_games, game_id, team_id, opponent_team_id
  - projected toi_es_seconds/pp/pk, shots/goals by strength
  - uncertainty JSONB

- goalie_projections:
  - run_id, as_of_date, horizon_games, game_id, goalie_id, team_id, opponent_team_id
  - starter_probability
  - projected shots_against, saves, goals_allowed
  - projected win_prob, shutout_prob
  - uncertainty JSONB

### Pipeline runs
- projection_runs:
  - run_id, created_at, as_of_date, status, git_sha, notes, metrics JSONB

## 9) Modeling approach (implementation-guided, not academic)
### Principle: opportunity → share → conversion
For each upcoming game:
1) Predict **team opportunities** by strength (ES/PP/PK minutes; shots by strength)
2) Allocate opportunities to players via **shares** (TOI share; shot share; PP1 vs PP2)
3) Convert shots → goals; goals → assists using stable rates + shrinkage
4) Reconcile totals to ensure accounting consistency
5) Estimate goalie win/shutout probabilities using team projected goals for/against
   - Inputs: `forge_team_projections` (projected GF) + opponent projected shots/GA
   - `forge_team_game_strength` provides historical priors for team opportunity baselines
6) Generate uncertainty via sampling + quantiles

### “Learn as it goes”
- Update nightly:
  - role/usage features update quickly (TOI shares, PP shares)
  - talent rates update slowly (shooting %, primary assist involvement)
- Apply shrinkage/priors to avoid whipsawing from small samples.

### Uncertainty
- MVP: produce p10/p50/p90 by stat using stochastic simulation of:
  - lineup/goalie scenarios from roster_events,
  - team opportunity noise,
  - player share noise,
  - conversion noise (goals/assists).
- For horizons >1, simulate sequentially over the schedule slice.

## 10) MVP scope definition (strict)
### Must ship (MVP)
- Data ingestion for schedule + completed games
- Derived tables for: player TOI splits, shots splits, goals/assists splits; team minutes and shots/goals by strength; goalie shots/GA
- Next-game projections (horizon_games=1) for:
  - Skaters: TOI ES/PP/PK, Shots ES/PP/PK, Goals (total ok), Assists (total ok)
  - Teams: minutes/ shots/ goals by strength
  - Goalies: starter_probability + GA from shots against + save model (simplified)
    - Include win_prob/shutout_prob derived from team projected goals for/against
- Reconciliation for TOI and shots; goals optional as hard constraint in MVP if feasible
- API endpoints to query projections by date/game/team/player
- Nightly scheduled run + manual run trigger
- Basic QA + backtest report (at least last 30 days)

### Explicitly deferred (post-MVP)
- Hits/blocks/PIM/+/- with rink adjustments
- Full xG modeling
- Public UI

## Addendum: Projection Accountability + Learning Constraints
### Status (implemented)
- `run-projection-accuracy` endpoint exists and computes FP-based accuracy using `fantasyPointsConfig`.
- Skater accuracy is live (per-day + running aggregates).
- Goalie accuracy includes wins/shutouts via projected win/shutout probabilities.
- Per-stat MAE/RMSE diagnostics are stored in `forge_projection_accuracy_stat_daily`.
- Goalie projections include `proj_win_prob` + `proj_shutout_prob`.
- `run-projection-v2` and `run-projection-accuracy` support `startDate`/`endDate` ranges.

### A) Accountability metrics (daily + rolling + per-player)
We need a consistent way to score “accuracy” when projections are fractional.
Define a single scoring target per player/game, then compare predicted vs actual:

**Primary target: Fantasy Points (FP)**
- Compute FP from actual boxscore using a fixed scoring map.
- Compute projected FP from `forge_player_projections` using the same map.
- Accuracy is a bounded error score (e.g., 1 - normalized error).

**Suggested FP map (example; make configurable):**
- Goals: 3.0
- Assists: 2.0
- Shots: 0.5
- PP points: 1.0 (optional add-on)
- Hits: 0.2 (optional)
- Blocks: 0.2 (optional)
- Goalies: separate map (Saves, GA, Wins if available)
  - Note: wins/shutouts are modeled as probabilities in projections and scored directly in accuracy.

**Accuracy scoring (choose one, keep stable):**
- `accuracy = 1 - min(1, abs(pred - actual) / max(1, actual, pred))`
  - Bounded [0,1]; handles fractional predictions.
- Also track MAE and RMSE for diagnostics.

**Outputs required:**
- Daily accuracy (overall): weighted average across all players who played.
- Rolling accuracy: 7/14/30-day rolling average.
- Per-player accuracy: daily and rolling (per player_id).

### B) Required tables (proposed)
- `forge_projection_results`
  - game_id, player_id, team_id, opponent_team_id, as_of_date (projection date),
    actual_date (game date), predicted_fp, actual_fp, error_abs, error_sq, accuracy
  - source_run_id (forge_runs.run_id), created_at
- `forge_projection_accuracy_daily`
  - date, scope ('overall' | 'skater' | 'goalie'), accuracy_avg, mae, rmse, player_count
- `forge_projection_accuracy_player`
  - date, player_id, accuracy_avg, mae, rmse, games_count
- `forge_projection_accuracy_stat_daily`
  - date, scope ('skater' | 'goalie'), stat_key, mae, rmse, player_count

### C) Data pipeline for accountability
1) For each completed game date:
   - join `forge_player_projections` (as_of_date = projection date, horizon_games=1)
     to actual boxscore stats for that game.
   - `projectionOffsetDays` controls the projection date; for same-day scoring use `0`.
2) Compute FP + error metrics.
3) Store results in accountability tables.
4) Aggregate to daily + rolling summary tables.

### D) Immediate next steps
- Backfill accuracy for past dates once actual skater stats are populated.
- Validate matchup coverage (projection ↔ actual join counts) and decide whether to loosen matching (e.g., fallback by player_id/date).
- Consider defaulting `projectionOffsetDays=0` for same-day projections or making it auto-detect.

### E) Current pipeline itinerary (daily run order)
1) update-PbP
2) update-shift-charts
3) update-line-combinations
4) update-rolling-player-averages
5) update-start-chart-projections
6) build-projection-derived-v2
7) run-projection-v2
8) run-projection-accuracy (next day, after actuals land)

### F) “Learn as it goes” (bounded, non-ML first)
Start with lightweight online adjustments that fit the Vercel 4-minute limit:
- Maintain per-player bias terms (last N games) and apply as a correction factor.
- Maintain per-metric shrinkage factors (e.g., shots/goals calibration).
- Update nightly using a single pass over last 7–30 days.
- Persist calibration parameters in a small table, e.g., `forge_calibration_params`.

### G) ML/NN addendum (must fit Vercel 4-minute constraint)
If we introduce ML/NN:
- Training must be offline or incremental; no full retrains in Vercel.
- Runtime inference must complete within 4 minutes total.
- Prefer small, interpretable models:
  - linear regression / ridge / elastic net
  - gradient-boosted trees with shallow depth
  - tiny neural nets (1–2 hidden layers) only if cached and fast
- All features must be precomputed (no heavy joins).
- Use a fixed feature store table (e.g., `forge_feature_cache`).
- Enforce a strict timeout: if exceeded, fall back to the non-ML heuristic model.

---
## Handoff for next Codex session (GPT‑5.2)
You are resuming work on FORGE projection accountability + learning.

**Context**
- Project: `/Users/tim/Desktop/fhfhockey.com`
- Goal: add projection accuracy scoring (fantasy points) + ongoing learning; goalie win/shutout modeling is high priority.
- New API endpoint: `web/pages/api/v1/db/run-projection-accuracy.ts`
  - Computes skater accuracy using `wgo_skater_stats`.
  - Computes goalie accuracy using `goalie_stats_unified`, with fallback to `forge_goalie_game`.
  - Writes to `forge_projection_results`, `forge_projection_accuracy_daily`, `forge_projection_accuracy_player`, `forge_projection_accuracy_stat_daily`.
  - Uses `fantasyPointsConfig.ts` mapping.
  - Skater query optimized to `wgo_skater_stats` by date + player_id.
  - Batch upserts to avoid statement timeout.
- Utility helpers live in `web/lib/projections/accuracy/fantasyPoints.ts`.
- PRD updated with accountability + pipeline itinerary + goalie modeling notes.

**DB changes already applied**
- Created missing view `public.view_active_player_ids_max_season` (NST scripts depend on it).
- Fixed `goalie_stats_unified` to be a materialized view (cron refresh works).
- Created `mv_team_stats_nst_wgo` matview (cron refresh works).
- Added `proj_win_prob` + `proj_shutout_prob` on `forge_goalie_projections`.
- Added `forge_projection_accuracy_stat_daily` for per-stat MAE/RMSE.

**Observed behavior**
- `run-projection-accuracy` supports `startDate`/`endDate`, but defaults to `projectionOffsetDays=1` (use `0` for same-day scoring).
- Range runs can yield zero rows if projection offset doesn't match projection dates.
- Goalie rows now match when actuals exist or fall back to `forge_goalie_game`.

**Known blockers / priorities**
1) Validate projection↔actual join rates (esp. skaters), decide if we should loosen matching by `player_id`+`date`.
2) Decide if `projectionOffsetDays` should default to 0 or auto-detect per run.
3) Learning system (dynamic accuracy improvement):
   - Start with non‑ML calibration (per‑player bias; per‑metric shrinkage).
   - Persist in `forge_calibration_params` or similar.

**Immediate next steps suggested**
- Backfill accuracy for past dates with `projectionOffsetDays=0`.
- Review skater match counts per date and decide on a fallback match strategy.
- Wire learning calibration table + nightly update pass (bounded).

**Goalie accuracy checklist (SQL)**
```sql
-- Are there goalie projections for the date?
select count(*) as goalie_proj_rows
from forge_goalie_projections
where as_of_date = 'YYYY-MM-DD'
  and horizon_games = 1;

-- Are there goalie actuals for the date?
select count(*) as goalie_actual_rows
from goalie_stats_unified
where date = 'YYYY-MM-DD';

-- Do IDs match between projections and actuals?
select count(*) as matched_goalies
from forge_goalie_projections gp
join goalie_stats_unified ga
  on ga.player_id = gp.goalie_id
 and ga.date = 'YYYY-MM-DD'
where gp.as_of_date = 'YYYY-MM-DD'
  and gp.horizon_games = 1;
```

## 11) API requirements
Read-only endpoints (REST or server functions):
- GET /projections/players?date=YYYY-MM-DD&horizon=1
- GET /projections/teams?date=YYYY-MM-DD&horizon=1
- GET /projections/goalies?date=YYYY-MM-DD&horizon=1
- GET /projections/player/{player_id}?date=...&horizon=...
- GET /runs/latest and GET /runs/{run_id}

Admin endpoints (protected):
- POST /runs/trigger (manual run)
- POST /events (create roster_event)
- GET /events?team_id=...

## 12) Operational requirements
- Idempotency: re-running the same as_of_date/run should not duplicate rows.
- Observability: structured logs + run status updates in projection_runs.
- Data quality checks:
  - TOI by strength totals sanity
  - team totals vs sum(player totals) before reconciliation and after
  - missing games/players detection
- Performance: MVP should run nightly within reasonable time on a small server.

## 13) Acceptance criteria (definition of done)
MVP is considered done when:
- A nightly run writes projections for all scheduled games on the next day.
- For a sampled set of games, team ES/PP/PK minutes and shots equal sum of player projections (within tolerance or exact if reconciled).
- API returns stable schemas and has basic pagination/filtering.
- Backtest report exists and is generated automatically (at minimum: MAE for shots/goals, calibration check for intervals).

## 14) Current implementation status (repo reality)

### Shipped (as of now)
- Supabase migrations for FORGE tables exist under `migrations/` and have been applied.
- A minimal ingestion endpoint exists (cron-friendly; GET or POST) to populate PbP + shift totals:
  - `web/pages/api/v1/db/ingest-projection-inputs.ts`
  - Supports `startDate`, `endDate`, `force`, `maxDurationMs` (default 270000), and `debug`/`debugLimit`.
  - Returns `durationMs` (MM:SS), `gamesTotal`, and `skipReasons` to explain “skipped” behavior.
- Derived-table builders exist to populate strength aggregates:
  - `web/pages/api/v1/db/build-projection-derived-v2.ts`
  - Builds `forge_player_game_strength`, `forge_team_game_strength`, `forge_goalie_game`
  - Supports `startDate`, `endDate`, and `maxDurationMs` (default 270000) + returns `durationMs` (MM:SS).
- Baseline horizon=1 projection runner exists (writes FORGE outputs + run logs):
  - `web/pages/api/v1/db/run-projection-v2.ts`
  - Writes `forge_runs` + `forge_player_projections`/`forge_team_projections`/`forge_goalie_projections`
  - Returns `durationMs` (MM:SS) and persists `metrics.data_quality` in `forge_runs.metrics` (missing inputs, TOI scaling diagnostics).
  - Includes Task 3.6 reconciliation (team ES/PP TOI + shots are hard-constrained to match player sums) and applies basic `forge_roster_events` overrides (skater availability + goalie starter override).
- Read endpoints exist for v2/forge data:
  - `web/pages/api/v1/projections/players.ts`
  - `web/pages/api/v1/projections/teams.ts`
  - `web/pages/api/v1/projections/goalies.ts`
  - `web/pages/api/v1/runs/latest.ts`
  - Each returns `durationMs` (MM:SS) and defaults to “latest succeeded run” for that date if `runId` not provided.

### Known limitations (intentional for MVP scaffolding)
- `forge_goalie_game.toi_seconds` is not populated yet.
- Baseline projection runner uses `rolling_player_game_metrics` + `lineCombinations` and simple priors; it does not yet fully use the derived strength tables for opportunity baselines.
- PK TOI requires `shift_charts.total_pk_toi` (added in `migrations/20251226_add_shift_charts_pk_toi.sql`) + a rebuild/backfill run.

## 15) Cron-first execution model (Vercel)

The project triggers compute via URL hits (GET or POST). Each endpoint includes `durationMs` (MM:SS) in its JSON response to monitor Vercel’s ~5 minute limit.

### End-to-end call order (append-only runbook)
This is the canonical “start to finish” order of API calls for a single-date run. We will append to this list as new steps are added (e.g., backtests, horizon>1, simulations).

1. **Ingest inputs (PbP + shift totals)**
   - `/api/v1/db/ingest-projection-inputs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
   - Optional flags:
     - `force=true` (re-fetch + overwrite for that date range)
     - `debug=true&debugLimit=50` (sampling/trace)
     - `maxDurationMs=270000` (budget; stay under Vercel limit)

2. **Build derived strength tables**
   - `/api/v1/db/build-projection-derived-v2?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
   - Optional flags:
     - `maxDurationMs=270000`

3. **Run projections (horizon=1)**
   - `/api/v1/db/run-projection-v2?date=YYYY-MM-DD`
   - `/api/v1/db/run-projection-v2?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
   - Optional flags:
     - `maxDurationMs=270000`

4. **Run projection accuracy (after actuals land)**
   - `/api/v1/db/run-projection-accuracy?date=YYYY-MM-DD`
   - `/api/v1/db/run-projection-accuracy?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
   - Optional flags:
     - `projectionOffsetDays=0` (same-day projections)
     - `maxDurationMs=240000` (range runs)

5. **Read outputs (latest succeeded run by default)**
   - `/api/v1/runs/latest?date=YYYY-MM-DD`
   - `/api/v1/projections/teams?date=YYYY-MM-DD&horizon=1`
   - `/api/v1/projections/players?date=YYYY-MM-DD&horizon=1`
   - `/api/v1/projections/goalies?date=YYYY-MM-DD&horizon=1`

Suggested nightly sequence for a given date:
1. Ingest inputs:
   - `/api/v1/db/ingest-projection-inputs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
2. Update rolling averages (required for MVP baseline):
   - `/api/v1/db/update-rolling-player-averages?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
3. Build derived:
   - `/api/v1/db/build-projection-derived-v2?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
4. Run projections:
   - `/api/v1/db/run-projection-v2?date=YYYY-MM-DD`
5. Run accuracy (next day after actuals land):
   - `/api/v1/db/run-projection-accuracy?date=YYYY-MM-DD&projectionOffsetDays=0`

### Runbook (recommended flags)
- Incremental/default: no `force=true` (skips games that already have PbP + shift totals).
- Debug ingestion decisions: add `&debug=true` (optional `&debugLimit=50`).
- Rebuild after a bugfix/backfill: add `&force=true` for a small date range (stay under 5 minutes).
- Keep within Vercel limit: `&maxDurationMs=270000` (default) and check `timedOut` in the response.
- Accuracy: use `projectionOffsetDays=0` for same-day projections; keep `1` only if projections are produced for the next day.

### Interpreting ingestion “skip”
The ingest endpoint considers a game “complete” and will skip when:
- `pbp_games` already contains the game row, and
- `shift_charts` already has at least one row for that `game_id`.

## 16) Updated MVP definition (what’s left)

### Must ship next (highest priority)
1. **Uncertainty outputs**:
   - Add simulation and quantiles (p10/p50/p90) into `uncertainty` JSONB fields.
   - Baseline quantile scaffolding is implemented (approximate p10/p50/p90 around means); simulation-based uncertainty is still TBD.
2. **Backtest report**:
   - Automated report (last 30 days) with MAE + interval coverage and run-level summary metrics stored in `forge_runs.metrics`.

## 17) Task list (FORGE model + UI)

### Task 1: Make uncertainty and outputs understandable to laypeople
- [x] Parent task complete.
- [x] Translate uncertainty ranges into plain-language labels and explanations on the FORGE page.
- [x] Replace raw P10/P50/P90 blocks with a short "low/typical/high" presentation and a tooltip/legend.

### Task 2: Add model accuracy transparency (priority)
- [x] Parent task complete.
- [x] Add a 0–100% accuracy line chart section on the FORGE page (data wiring + placeholder if needed).
- [x] Add API/service wiring to surface accuracy data for the chart.

### Task 3: Introduce learn-as-it-goes ML updates
- [x] Parent task complete.
- [x] Define a simple online-learning loop (rolling reweighting / Bayesian update) for player rates.
- [x] Persist learning metadata in `forge_runs.metrics` and/or a new table for model update history.

### Task 4: Uncertainty simulation + horizon>1 scaffolding
- [x] Define uncertainty inputs and distributions (team opportunity noise, player share noise, conversion noise, goalie scenario noise).
- [x] Implement simulation loop for horizon=1 and extract p10/p50/p90 into `uncertainty` JSONB.
- [x] Extend simulation to horizon 2–10 by iterating over schedule slices (home/away/rest placeholders OK).
- [x] Add interval calibration checks to backtests and store summary metrics.
- [ ] Validate performance (batching, chunked upserts) so nightly runs stay within time limits.

### Task 5: Ops + backtest reporting
- [ ] Implement `/runs/{run_id}` detail endpoint for run metadata.
- [ ] Implement admin endpoints for run triggers and `forge_roster_events` CRUD.
- [ ] Add nightly scheduler wiring (Vercel cron or GitHub Actions) with `withCronJobAudit`.
- [ ] Implement backtest report job (last 30 days, MAE + interval coverage) and store a report artifact.
## Relevant files
- `tasks/prd-projection-model.md` - PRD and tracked task list for FORGE model work.
- `web/pages/FORGE.tsx` - FORGE projections page UI.
- `web/pages/api/v1/forge/accuracy.ts` - API endpoint for accuracy series data.
- `web/lib/projections/uncertainty.ts` - Uncertainty bands + simulation quantiles for FORGE projections.
- `web/pages/api/v1/db/run-projection-accuracy.ts` - Backtest/accuracy job with interval calibration metrics.
- `web/styles/Forge.module.scss` - Styling for the FORGE projections page.
- `web/rules/context/forge-tables.md` - Supabase table definitions for FORGE outputs.

## 17) Troubleshooting notes

- If ingestion returns many `"Cannot read properties of null (reading 'trim')"` errors, ensure `web/lib/projections/ingest/time.ts` includes the null-safe `parseClockToSeconds(clock: string | null | undefined)` fix.
- If ingestion reports `skipped > 0` with `gamesProcessed: 0`, that usually means PbP and shift totals already exist for all games in the date range (use `debug=true` to confirm per-game).
- If derived ES/PP/PK splits look wrong (e.g., ES shots all 0), ensure `situationCode` parsing is correct and re-run ingestion + derived builds for the affected dates.


## SCHEDULED CRON LIST 

```sql
----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:20 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:20 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-yahoo-matchup-dates',
--     '20 7 * * *', -- 08:55 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-yahoo-weeks?game_key=nhl',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 240000 -- 4 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:25 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:25 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||   16 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- WORKING 1/6/26
-- SELECT cron.schedule(
--     'update-nst-gamelog',
--     '25 7 * * *', -- 07:25 UTC

--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-nst-gamelog', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 240000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-skaters',
--     '30 7 * * *', -- 07:30 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-wgo-skaters?action=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:35 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:35 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-goalies',
--     '35 7 * * *', -- 07:35 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-wgo-goalies?action=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-skater-totals',
--     '40 7 * * *', -- 07:40 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-wgo-totals?season=current', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- STATUS: 404 NOT FOUND

-- SELECT cron.schedule(
--     'update-shift-charts',
--     '45 7 * * *', -- 07:45 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-shifts?action=all',
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-rolling-player-averages',
--     '45 7 * * *', -- 07:45 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-rolling-player-averages',
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-player-unified-matview',
--     '50 7 * * *', -- 07:50 UTC
--     'REFRESH MATERIALIZED VIEW player_stats_unified;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-power-play-timeframes',
--     '55 7 * * *', -- 07:55 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/powerPlayTimeFrame?gameId=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-line-combinations-all',
--     '00 8 * * *', -- 08:00 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-line-combinations', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    1 URL    |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-yearly-summary',
--     '05 08 * * *', -- 10:00 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-yearly-summary',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 240000 -- 4 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:10 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:10 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    4 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-tables-all',
--     '10 8 * * *', -- 08:10 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/Teams/nst-team-stats?date=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-standings-details',
--     '15 8 * * *', -- 08:15 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-standings-details?date=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:20 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:20 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-goalie-totals',
--     '20 8 * * *', -- 08:20 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-wgo-goalie-totals', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:25 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:25 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-expected-goals',
--     '25 8 * * *', -- 08:25 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-expected-goals?date=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||   10 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-goalies',
--     '30 8 * * *', -- 08:30 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-nst-goalies', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:35 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:35 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- -- WORKING
-- SELECT cron.schedule(
--     'update-pbp',
--     '51 20 * * *', -- 08:35 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-PbP?gameId=recent',
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-yahoo-players',
--     '40 08 * * *', -- 08:40 UTC
--     $$
--         SELECT net.http_get(
--         url := 'https://fhfhockey.com/api/v1/db/update-yahoo-players?gameId=465',
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    4 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-current-season',
--     '45 8 * * *', -- 08:45 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-current-season',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 240000 -- 4 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-wigo-table-stats',
--     '50 8 * * *', -- 08:50 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/calculate-wigo-stats',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 240000 -- 4 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'sync-yahoo-players-to-sheet',
--     '55 08 * * *', -- 08:55 UTC
--     $$  
--         SELECT net.http_get(
--         url := 'https://fhfhockey.com/api/internal/sync-yahoo-players-to-sheet?gameId=465',
--         headers := '{"Authorization":"Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-rolling-player-averages',
--     '00 9 * * *', -- 09:00 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/update-rolling-player-averages',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000 -- 5 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-goalie-unified-matview',
--     '05 9 * * *', -- 09:05 UTC
--     'REFRESH MATERIALIZED VIEW goalie_stats_unified;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:10 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:10 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-ctpi-daily',
--     '10 9 * * *', -- 09:10 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-ctpi-daily',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-power-ratings',
--     '15 9 * * *', -- 09:15 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-power-ratings',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000 -- 5 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:20 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:20 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-power-ratings-new',
--     '20 9 * * *', -- 09:20 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-power-ratings-new',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000 -- 5 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-goalie-projections-v2',
--     '30 9 * * *', -- 09:30 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/update-goalie-projections-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:35 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:35 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-wgo-teams',
--     '35 9 * * *', -- 09:35 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/run-fetch-wgo-data', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-start-chart-projections',
--     '40 9 * * *', -- 09:40 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/update-start-chart-projections',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- 09:50 UTC  (after rolling averages + goalie starts)
-- SELECT cron.schedule(
--     'build-forge-derived-v2',
--     '50 09 * * *',
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/build-projection-derived-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- -- 10:05 UTC  (after derived tables are built)
-- SELECT cron.schedule(
--     'run-forge-projection-v2',
--     '05 10 * * *',
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/run-projection-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- 11:30 UTC  (after results + actuals land)
-- SELECT cron.schedule(
--     'run-forge-projection-accuracy',
--     '30 11 * * *',
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/run-projection-accuracy?projectionOffsetDays=0',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    8 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-team-daily',
--     '55 9 * * *', -- 09:55 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-team-daily',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-matview',
--     '0 10 * * *', -- 10:00 UTC
--     'REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;'
-- );



----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--   'refresh-team-power-ratings-daily',
--   '15 10 * * *', -- 10:15 UTC
--   $$
--     WITH s AS (
--       SELECT *
--       FROM public.seasons
--       ORDER BY id DESC
--       LIMIT 1
--     )
--     SELECT public.refresh_team_power_ratings(
--       (SELECT startDate FROM s),
--       LEAST(
--         (now() AT TIME ZONE 'America/New_York')::date,
--         (SELECT regularSeasonEndDate FROM s)
--       )
--     );
--   $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  13:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--    'daily-cron-report',
--    '00 13 * * *',  -- 13:00 UTC
--    $$
--      SELECT net.http_get(
--        url       := 'https://fhfhockey.com/api/v1/db/cron-report',
--        headers   := '{"Authorization":"Bearer fhfh-cron-mima-233"}'::jsonb,
--        timeout_milliseconds := 240000
--      );
--    $$
--  );
```
