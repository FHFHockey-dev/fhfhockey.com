# PRD: NHL Projections Engine (Fantasy-first, Betting-capable)

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

## 14) Implementation plan & task breakdown (Codex should execute in this order)
### Phase A — Foundations
- Create repo structure: /ingest, /compute, /api, /shared, /ops
- Define canonical IDs and entity models
- Implement Supabase client + migration scripts (tables above)

### Phase B — Ingestion
- Implement adapters for schedule, boxscore, pbp, shifts
- Store raw artifacts (object storage or raw_game_blobs)
- Build “derived table builder” that outputs player_game_strength/team_game_strength/goalie_game

### Phase C — Projection engine v1 (horizon=1)
- Team opportunity model (very simple baseline first)
- Player share models (baseline: recent rolling averages + shrinkage)
- Conversion model for goals/assists (baseline: shots * rate with priors)
- Goalie layer (starter prob from events + baseline otherwise; GA from shots and save%)
- Reconciliation pass (TOI + shots minimum)

### Phase D — Uncertainty
- Implement simulation + quantile extraction for outputs

### Phase E — API + Ops
- Implement read endpoints
- Implement run triggers + run logging
- Add scheduler (cron/GitHub Actions/server job)

### Phase F — Backtesting
- Automated daily/weekly report with MAE + interval coverage

## 15) Engineering preferences / style
- Keep compute logic in a dedicated compute layer (Python or Node/TS acceptable).
- Prefer columnar files (Parquet) for intermediate artifacts if needed.
- Avoid SQL computations; Postgres is used like a key-value + relational store for serving data.
- Write clear unit tests for:
  - reconciliation constraints
  - feature builders
  - projection schema outputs

## 16) Open questions (Codex may implement sensible defaults)
- Exact data source endpoints/format details (choose one stable source; wrap behind adapter)
- Exact shrinkage strategy (start with simple empirical Bayes / weighted rolling averages)
- Line combination inference method from shifts (start simple: last N games most common partners)

## 17) Deliverables
- Working nightly pipeline
- Supabase schema + migrations
- Compute pipeline producing projections + uncertainty
- API endpoints returning projections
- Run logs + minimal backtest outputs