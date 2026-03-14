# RPGM Forge Bible

This is the singular authoritative reference for the Rolling Player Game Metrics and FORGE pipeline.

Status rules:

- this file is the source of truth for architecture, operations, freshness, validation posture, performance targets, and implementation priorities
- detailed pass artifacts are historical support only
- formula-only metric status remains in [rpm-audit-notes-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md)
- implementation sequencing remains in [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md)

## Mission

The RPGM Forge system has three jobs:

1. keep `rolling_player_game_metrics` correct and fresh
2. keep FORGE projection inputs and outputs fresh with a manageable operator surface
3. make validation and remediation possible without rediscovering the pipeline each time

The operating constraint is now explicit:

- overnight refresh must be a single orchestrated chain
- daily refresh must stay at `4m 30s` or less for the rolling-player path
- the permanent cron surface should stay small:
  - daily coordinator
  - overnight coordinator
  - monitoring

## Current Readout

- daily rolling-player budget target: `4m 30s`
- verified daily rolling-player runtime: `104182ms` (`1m 44s`) on `2026-03-12`
- overnight season-sweep rolling-player benchmark: `21m 45.843s`
- retained validation control status:
  - Brent Burns: `READY`
  - Corey Perry: blocked only by PK source-tail lag
  - Jesper Bratt: blocked only by PK source-tail lag
  - Seth Jones: blocked only by PK source-tail lag
- target write path is repaired and stable on the current PostgREST upsert path
- validation console is implemented in [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx)

## System Boundaries

### Upstream inputs

- core identity and schedule:
  - `players`
  - `games`
- contextual builders:
  - `lineCombinations`
  - `powerPlayCombinations`
- row spine and limited fallback:
  - `wgo_skater_stats`
- primary skater stats:
  - `nst_gamelog_as_counts`
  - `nst_gamelog_as_rates`
  - `nst_gamelog_as_counts_oi`
  - `nst_gamelog_es_counts`
  - `nst_gamelog_es_rates`
  - `nst_gamelog_es_counts_oi`
  - `nst_gamelog_pp_counts`
  - `nst_gamelog_pp_rates`
  - `nst_gamelog_pp_counts_oi`
  - `nst_gamelog_pk_counts`
  - `nst_gamelog_pk_rates`
  - `nst_gamelog_pk_counts_oi`

### Core outputs

- stored rolling target:
  - `rolling_player_game_metrics`
- debug and validation surface:
  - [rolling-player-metrics.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.ts)
  - [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx)
- downstream projection surface:
  - FORGE inputs
  - FORGE run
  - start-chart consumers

## Authoritative Operational Surface

The operator-facing surface is intentionally small.

### Daily job

Run:

- `GET /api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&date=YYYY-MM-DD`

Use this for current-day freshness. It should be the default scheduled refresh path.

### Overnight job

Run:

- `GET /api/v1/db/run-rolling-forge-pipeline?mode=overnight&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

Use this for catch-up, broad refreshes, and full-chain FORGE freshness.

### Monitoring job

Run:

- `GET /api/v1/db/cron-report`

### What must not become routine cron jobs

- single-game PP builder route
- single-game line route
- debug routes
- repair-only routes
- route-level WGO split jobs as separate operator jobs

## Runtime And Performance Policy

The shared owner for runtime policy is [rollingPlayerOperationalPolicy.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerOperationalPolicy.ts).

### Rolling execution profiles

- `daily_incremental`
  - optimized for current-day correctness and low operator friction
  - current defaults favor higher throughput
- `overnight`
  - optimized for broader refresh safety
  - current defaults reduce upsert pressure relative to daily mode
- `targeted_repair`
  - optimized for narrow reruns and manual repair work

### Budget policy

- rolling route budgets:
  - daily incremental: `4m 30s`
  - overnight: `30m`
  - targeted repair: `10m`
- coordinator budgets:
  - daily incremental: `04:30`
  - overnight: `90:00`
  - targeted repair: `15:00`

### Why the daily path is under budget

The main improvement was narrowing date-scoped incremental runs to the minimal WGO-backed player set instead of scanning the full skater universe.

Observed effect on `2026-03-12`:

- before: `2065` processed players, `128986ms`
- after: `504` processed players, `99763ms`
- verified enforced budget run: `104182ms`

## Freshness Dependency Model

The dependency graph is:

1. core entity freshness
   - games
   - teams
   - players
2. upstream skater-source freshness
   - WGO
   - NST gamelog families
3. contextual builders
   - PP builder
   - line builder
4. rolling-player recompute
5. projection ingest and derived stages
6. FORGE execution
7. downstream consumers and monitoring

Validation rule:

- stale targets are blockers, not evidence
- stale upstream tails are blockers for the affected family only
- current retained blockers are PK source-tail lag, not target freshness failure

## Validation And Audit Model

Validation is split across three authoritative surfaces:

1. formula ledger
   - [rpm-audit-notes-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md)
   - strict metric status and formula entries only
2. implementation backlog
   - [rpm-audit-action-items-pass-2.md](/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md)
   - source for sequencing follow-up work
3. live validation console
   - [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx)
   - backed by [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts)

### Validation status model

- `READY`
- `READY WITH CAUTIONS`
- `BLOCKED`

### What the validation console must expose

- freshness and readiness state
- stored versus recomputed values
- rolling-window membership
- formula metadata
- helper-contract metadata
- TOI trace rows
- PP-share provenance
- family-wide mismatch summaries
- support-field completeness state

## Code Ownership Boundaries

The target structure is a small number of clear owners, not a long list of one-off helpers.

### 1. Operational policy

Owner:

- [rollingPlayerOperationalPolicy.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerOperationalPolicy.ts)

Owns:

- execution-profile definitions
- runtime budgets
- profile inference and defaults

### 2. Orchestration

Owners:

- [rollingForgePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingForgePipeline.ts)
- [run-rolling-forge-pipeline.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts)

Owns:

- stage graph
- coordinator modes
- operator-facing execution surface

### 3. Rolling compute and persistence

Primary owner:

- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)

This is still the main hotspot. It remains the biggest candidate for future decomposition because it still carries compute, persistence, and instrumentation concerns together.

### 4. Diagnostics and validation payload

Owners:

- [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts)
- [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts)
- [rolling-player-metrics.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.ts)

### 5. UI validation surface

Owner:

- [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx)

### 6. Compatibility and downstream readers

Owners:

- [rollingPlayerMetricCompatibility.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerMetricCompatibility.ts)
- downstream reader/query files

## Metric Contract Posture

Current authoritative-field policy:

- canonical-first:
  - ratio families
  - weighted-rate families
  - availability and participation families
- legacy-still-authoritative:
  - additive `avg` and `total` fields where the distinction still means something
  - TOI `avg` and `total` fields where the distinction still means something
- compatibility-only legacy:
  - legacy ratio aliases
  - legacy weighted-rate aliases
  - legacy `gp_pct_*` aliases

Optional metric additions already landed:

- `primary_assists`
- `secondary_assists`
- `penalties_drawn`
- `penalties_drawn_per_60`
- `pp_toi_seconds`

## Current Blockers

Only a small set of issues should still be treated as active blockers:

1. PK source-tail lag on retained blocked validation scopes
   - Corey Perry `pk`
   - Jesper Bratt `pk`
   - Seth Jones `pk`
2. remaining observability cleanup where provenance or support completeness is still weaker than ideal
3. continued decomposition of the rolling compute hotspot if maintainability pressure stays high

## Remaining Backlog Tracks

Open work should be managed as four tracks, not dozens of isolated docs:

1. validation observability and readiness
2. compatibility and semantic cleanup
3. validation-surface productization
4. live-source freshness operations

That grouping is intentional. It prevents pass-style artifact sprawl from turning into planning sprawl.

## Verification Commands

Primary commands:

- `npm run verify:full`
- `npm run verify:rolling-player:targeted`
- `npm run verify:rolling-player:extended`
- `npm run check:rolling-player-runtime-budget -- --profile daily_incremental --date YYYY-MM-DD`

Use the full verification command for code health and the targeted rolling verification command for freshness and parity checks on the retained validation set.

## Archive Policy

Historical pass artifacts have been archived under:

- [archive/rpgm-pass-history](/Users/tim/Code/fhfhockey.com/tasks/artifacts/archive/rpgm-pass-history)

Rule:

- new architecture, operational, or validation guidance should update this Bible
- do not create another top-level swarm of pass documents for the same system
- use the archive only for supporting evidence, dated repro notes, and step-by-step pass history
