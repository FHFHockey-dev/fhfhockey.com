## Purpose

This artifact inventories the currently relevant refresh entrypoints for keeping rolling-player metrics and FORGE projection surfaces fresh.

It is intentionally not a dump of every `withCronJobAudit` route. The goal is to identify:

- the minimum operational chain that actually controls freshness
- which routes are true first-class refresh surfaces
- which routes are builder/detail helpers that should not become separate cron obligations
- where the current job surface is already wider than it should be for an overnight run plus a sub-`4m30s` daily incremental update

## Operational Framing

The current codebase exposes dozens of auditable DB routes, but the rolling-player plus FORGE freshness problem reduces to a smaller chain:

1. roster / schedule freshness
2. upstream stat ingest
3. contextual builders
4. rolling-player recompute
5. projection input ingest / derived tables
6. FORGE projection runs
7. downstream convenience projection refreshes
8. reporting / monitoring

For organization and runtime control, only a subset of those should remain first-class operational entrypoints.

## Minimum Freshness Chain

### Phase 1. Core roster / schedule freshness

- `/api/v1/db/update-games`
  - file: [update-games.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-games.ts)
  - writes: `games`
  - purpose: refreshes game ledger, dates, and team matchups
  - operational role: first-class dependency
  - notes: rolling availability semantics and projection scheduling both depend on this table

- `/api/v1/db/update-teams`
  - file: [update-teams.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-teams.ts)
  - writes: `teams`
  - purpose: refreshes team metadata referenced by projections and schedule joins
  - operational role: first-class dependency, but low-frequency compared with daily stat refreshes

- `/api/v1/db/update-players`
  - file: [update-players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-players.ts)
  - writes: `players`, `rosters`
  - purpose: refreshes player identity, team assignment, and roster membership
  - operational role: first-class dependency
  - notes: required by rolling-player population and projection preflight

### Phase 2. Upstream stat ingest

- `/api/v1/db/update-nst-gamelog`
  - file: [update-nst-gamelog.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-gamelog.ts)
  - writes: multiple `nst_gamelog_*` tables across counts, rates, and on-ice splits
  - purpose: primary NST skater-game ingest surface for rolling-player source freshness
  - operational role: first-class dependency
  - notes: this is the largest skater-source freshness surface; it should stay a single operational step, not fragment into many independent jobs

- WGO refresh surfaces
  - files:
    - [update-wgo-skaters.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-wgo-skaters.ts)
    - [update-wgo-totals.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-wgo-totals.ts)
    - [update-wgo-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-wgo-averages.ts)
    - [update-wgo-ly.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-wgo-ly.ts)
  - writes: WGO skater/totals/average tables used by rolling fallbacks and historical support
  - purpose: provides the WGO-backed rolling row spine and fallback values
  - operational role: first-class upstream dependency, but currently spread across several routes
  - notes: this is one of the clearest consolidation candidates; operationally it behaves like one freshness phase, not four unrelated jobs

### Phase 3. Contextual builders

- `/api/v1/db/update-line-combinations`
  - file: [update-line-combinations/index.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/index.ts)
  - writes: `lineCombinations`
  - purpose: batch refresh of line context for games missing line-combo rows
  - operational role: first-class contextual builder
  - notes: this is the correct batch surface; the single-game route is a helper, not a separate cron surface

- `/api/v1/db/update-line-combinations/[id]`
  - file: [update-line-combinations/[id].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-line-combinations/[id].ts)
  - writes: `lineCombinations`
  - purpose: targeted single-game rebuild
  - operational role: targeted repair helper only

- `/api/v1/db/update-power-play-combinations/[gameId]`
  - file: [update-power-play-combinations/[gameId].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-power-play-combinations/[gameId].ts)
  - writes: `powerPlayCombinations`
  - purpose: PP usage / unit builder for a single game
  - operational role: targeted builder helper today
  - notes: there is no equivalent batch route in the current code surface, which increases operational sprawl if PP freshness must be maintained at scale

### Phase 4. Rolling-player recompute

- `/api/v1/db/update-rolling-player-averages`
  - file: [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)
  - writes: `rolling_player_game_metrics`
  - purpose: rolling-player recompute and persistence
  - operational role: first-class dependency
  - notes:
    - already exposes the main runtime-tuning controls
    - already supports targeted, date-range, season, resume, full-refresh, and fast-mode execution
    - this is the obvious anchor for daily versus overnight recompute policy

### Phase 5. Projection-input ingest and derived build

- `/api/v1/db/ingest-projection-inputs`
  - file: [ingest-projection-inputs.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/ingest-projection-inputs.ts)
  - writes: `pbp_games`, `pbp_plays`, `shift_charts`
  - purpose: PbP plus shift ingestion used by FORGE
  - operational role: first-class dependency
  - notes:
    - already supports `startDate`, `endDate`, `chunkDays`, `resumeFromDate`, and a built-in `4.5` minute budget
    - this is already shaped like a real incremental job surface

- `/api/v1/db/build-projection-derived-v2`
  - file: [build-projection-derived-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/build-projection-derived-v2.ts)
  - writes:
    - `forge_player_game_strength`
    - `forge_team_game_strength`
    - `forge_goalie_game`
  - purpose: derives the tables that projection runs actually consume
  - operational role: first-class dependency
  - notes:
    - already supports range, chunking, resume, and `4.5` minute timeout semantics
    - this should remain one explicit build phase, not split further

### Phase 6. FORGE run surfaces

- `/api/v1/db/update-goalie-projections-v2`
  - file: [update-goalie-projections-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-goalie-projections-v2.ts)
  - writes: `goalie_start_projections`
  - purpose: builds goalie start priors used by FORGE
  - operational role: first-class dependency

- `/api/v1/db/run-projection-v2`
  - file: [run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts)
  - writes:
    - `forge_runs`
    - `forge_player_projections`
    - `forge_team_projections`
    - `forge_goalie_projections`
  - purpose: executes the main FORGE projection run
  - operational role: first-class dependency
  - notes:
    - already contains explicit preflight gates for roster, line, ingest, derived, and goalie-prior freshness
    - already references the pipeline-spec model in [goaliePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/goaliePipeline.ts)

- `/api/v1/db/run-projection-accuracy`
  - file: [run-projection-accuracy.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-accuracy.ts)
  - writes accuracy/calibration tables
  - purpose: post-run evaluation and backtesting
  - operational role: first-class overnight or next-day follow-up, not part of the hot daily freshness path

### Phase 7. Downstream convenience projection refreshes

- `/api/v1/db/update-start-chart-projections`
  - file: [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts)
  - writes: `start_chart_projections`
  - purpose: convenience downstream projection surface driven from rolling metrics and team context
  - operational role: downstream consumer refresh
  - notes: this should stay downstream of rolling freshness, not become a peer dependency competing for schedule priority

## Current Surfaces That Matter But Should Not All Become Cron Jobs

- `/api/v1/db/cron/update-stats-cron`
  - file: [update-stats-cron.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron/update-stats-cron.ts)
  - role: legacy multi-game stats updater
  - assessment: useful as a targeted helper, but not part of the clean rolling-player + FORGE freshness chain

- `/api/v1/db/cron-report`
  - file: [cron-report.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron-report.ts)
  - role: monitoring / reporting surface over `cron_job_audit`
  - assessment: should remain reporting-only; it is not a freshness phase

- `/api/v1/db/update-power-play-combinations/[gameId]`
  - assessment: operationally important, but the lack of a batch route means the current implementation shape encourages fragmented triggering

- WGO split routes
  - assessment: these are upstream-critical, but the current route count is higher than the number of conceptual phases

## Existing Pipeline-Spec Signal

The strongest existing organizational model is [goaliePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/goaliePipeline.ts), which defines a compact seven-stage graph:

1. `core_roster_schedule`
2. `line_combinations`
3. `projection_input_ingest`
4. `projection_derived_v2`
5. `goalie_start_priors_v2`
6. `projection_run_v2`
7. `projection_accuracy`

That model is already closer to the desired operational shape than the raw route list. The missing piece is to add rolling-player freshness and PP-context freshness into the same graph without turning every helper endpoint into an independently scheduled job.

## Inventory Conclusions For Consolidation

### Routes that should remain first-class operational surfaces

- `/api/v1/db/update-games`
- `/api/v1/db/update-teams`
- `/api/v1/db/update-players`
- `/api/v1/db/update-nst-gamelog`
- one consolidated WGO freshness surface or phase
- one line-context batch surface
- one PP-context batch surface or orchestrated phase
- `/api/v1/db/update-rolling-player-averages`
- `/api/v1/db/ingest-projection-inputs`
- `/api/v1/db/build-projection-derived-v2`
- `/api/v1/db/update-goalie-projections-v2`
- `/api/v1/db/run-projection-v2`
- `/api/v1/db/run-projection-accuracy`
- `/api/v1/db/update-start-chart-projections`
- `/api/v1/db/cron-report`

### Routes that should be treated as helper or repair surfaces

- `/api/v1/db/update-line-combinations/[id]`
- `/api/v1/db/update-power-play-combinations/[gameId]` in its current single-game form
- `/api/v1/db/cron/update-stats-cron`

## Efficiency / Organization Readout

The main organizational problem is not raw file count by itself. It is that several conceptual phases still map to multiple operational surfaces:

- WGO freshness is spread across multiple routes
- PP builder freshness is exposed only as a single-game route
- line freshness has both a batch and a repair route, which is fine, but only the batch route should matter operationally
- rolling freshness and FORGE freshness are conceptually connected but still exposed as separate route families without a single coordinator

For the overnight and daily-budget goals, the inventory implies a target operating model:

- overnight: one orchestrated chain across the first-class phases
- daily incremental: one smaller orchestrated chain that limits date windows and skips non-critical backfill work
- cron surface: a small number of orchestrator jobs plus monitoring, not a long list of builder-specific URLs

This inventory is the input for `2.2` and `2.3`, where the route list should be collapsed into one explicit dependency graph and a smaller approved job surface.
