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
  - toi_es, toi_pp, toi_pk
  - shots_es, shots_pp, shots_pk
  - goals_es, goals_pp, goals_pk
  - assists_es, assists_pp, assists_pk
  - hits, blocks, pim, plus_minus
  - (optional) xg_es, ixg_es, on_ice_xg_es, etc.

- team_game_strength: (game_id, team_id)
  - minutes_es, minutes_pp, minutes_pk
  - shots_es/pp/pk, goals_es/pp/pk
  - (optional) xg_es/pp/pk

- goalie_game: (game_id, goalie_id, team_id)
  - shots_against, goals_allowed, saves, toi

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
  - projected minutes_es/pp/pk, shots/goals by strength
  - uncertainty JSONB

- goalie_projections:
  - run_id, as_of_date, horizon_games, game_id, goalie_id, team_id, opponent_team_id
  - starter_probability
  - projected shots_against, saves, goals_allowed
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
5) Generate uncertainty via sampling + quantiles

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
- Reconciliation for TOI and shots; goals optional as hard constraint in MVP if feasible
- API endpoints to query projections by date/game/team/player
- Nightly scheduled run + manual run trigger
- Basic QA + backtest report (at least last 30 days)

### Explicitly deferred (post-MVP)
- Hits/blocks/PIM/+/- with rink adjustments
- Full xG modeling
- Public UI

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
  - Returns `durationMs`, `gamesTotal`, and `skipReasons` to explain “skipped” behavior.
- Derived-table builders exist to populate strength aggregates:
  - `web/pages/api/v1/db/build-projection-derived-v2.ts`
  - Builds `forge_player_game_strength`, `forge_team_game_strength`, `forge_goalie_game`
  - Supports `startDate`, `endDate`, and `maxDurationMs` (default 270000) + returns `durationMs`.
- Baseline horizon=1 projection runner exists (writes FORGE outputs + run logs):
  - `web/pages/api/v1/db/run-projection-v2.ts`
  - Writes `forge_runs` + `forge_player_projections`/`forge_team_projections`/`forge_goalie_projections`
  - Returns `durationMs` and persists `metrics.data_quality` in `forge_runs.metrics` (missing inputs, TOI scaling diagnostics).
- Read endpoints exist for v2/forge data:
  - `web/pages/api/v1/projections/players.ts`
  - `web/pages/api/v1/projections/teams.ts`
  - `web/pages/api/v1/projections/goalies.ts`
  - `web/pages/api/v1/runs/latest.ts`
  - Each returns `durationMs` and defaults to “latest succeeded run” for that date if `runId` not provided.

### Known limitations (intentional for MVP scaffolding)
- PK TOI split is currently not populated (PP/ES split is computed; PK deferred).
- `forge_goalie_game.toi_seconds` is not populated yet.
- Baseline projection runner uses `rolling_player_game_metrics` + `lineCombinations` and simple priors; it does not yet fully use the derived strength tables or `forge_roster_events` overrides.
- Reconciliation is not yet implemented as a strict invariant (Task 3.6 remains).

## 15) Cron-first execution model (Vercel)

The project triggers compute via URL hits (GET or POST). Each endpoint includes `durationMs` in its JSON response to monitor Vercel’s ~5 minute limit.

Suggested nightly sequence for a given date:
1. Ingest inputs:
   - `/api/v1/db/ingest-projection-inputs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
2. Build derived:
   - `/api/v1/db/build-projection-derived-v2?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
3. Run projections:
   - `/api/v1/db/run-projection-v2?date=YYYY-MM-DD`

### Runbook (recommended flags)
- Incremental/default: no `force=true` (skips games that already have PbP + shift totals).
- Debug ingestion decisions: add `&debug=true` (optional `&debugLimit=50`).
- Rebuild after a bugfix/backfill: add `&force=true` for a small date range (stay under 5 minutes).
- Keep within Vercel limit: `&maxDurationMs=270000` (default) and check `timedOut` in the response.

### Interpreting ingestion “skip”
The ingest endpoint considers a game “complete” and will skip when:
- `pbp_games` already contains the game row, and
- `shift_charts` already has at least one row for that `game_id`.

## 16) Updated MVP definition (what’s left)

### Must ship next (highest priority)
1. **Reconciliation (Task 3.6)**:
   - Enforce hard constraints so `forge_team_projections` equals sum of `forge_player_projections` for TOI + shots (by strength) per game/team.
   - Add unit tests for reconciliation invariants.
2. **`forge_roster_events` integration**:
   - Use roster events to adjust player availability/usage (and goalie starter probability) before projection.
3. **Uncertainty outputs**:
   - Add simulation and quantiles (p10/p50/p90) into `uncertainty` JSONB fields.
4. **Backtest report**:
   - Automated report (last 30 days) with MAE + interval coverage and run-level summary metrics stored in `forge_runs.metrics`.

## 17) Troubleshooting notes

- If ingestion returns many `"Cannot read properties of null (reading 'trim')"` errors, ensure `web/lib/projections/ingest/time.ts` includes the null-safe `parseClockToSeconds(clock: string | null | undefined)` fix.
- If ingestion reports `skipped > 0` with `gamesProcessed: 0`, that usually means PbP and shift totals already exist for all games in the date range (use `debug=true` to confirm per-game).



