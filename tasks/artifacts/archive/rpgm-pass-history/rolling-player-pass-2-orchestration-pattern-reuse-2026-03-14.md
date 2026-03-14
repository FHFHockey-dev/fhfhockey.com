## Purpose

This artifact defines how the existing orchestration patterns in the repo should be reused to support:

- one overnight full-process flow
- one daily incremental flow
- a smaller cron/job surface

The goal is not to invent a new orchestration system. It is to reuse the two patterns that already exist:

- `withCronJobAudit(...)` for step-level observability
- pipeline-spec style files such as [goaliePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/goaliePipeline.ts) for phase ordering and dependency display

## Existing Reusable Patterns

### 1. `withCronJobAudit(...)`

Source:

- [withCronJobAudit.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/withCronJobAudit.ts)

What it already gives us:

- a uniform audit row in `cron_job_audit`
- inferred success/failure
- inferred rows affected
- captured method, URL, status code, duration, and serialized response

Why it should be reused:

- every coordinator step can keep using normal API surfaces
- the orchestrator can emit one top-level job audit while still invoking audited sub-steps
- we do not need a second logging or metrics mechanism just to coordinate existing routes

### 2. Pipeline-spec style graph files

Source:

- [goaliePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/goaliePipeline.ts)

What it already gives us:

- stable stage IDs
- explicit order
- labels
- endpoint mapping
- produced tables
- dependency edges

Why it should be reused:

- it is already the cleanest expression of the FORGE dependency graph
- the rolling-player plus FORGE orchestration problem is also fundamentally a stage graph
- operators, routes, and debug tooling all benefit from one shared stage vocabulary

## Recommended Reuse Shape

### A. Add one new unified pipeline-spec surface

Recommended new concept:

- `rollingForgePipeline.ts` or equivalent

This should not replace `goaliePipeline.ts` immediately. It should extend the pattern to cover the full approved phase graph:

1. `core_entity_freshness`
2. `upstream_skater_sources`
3. `contextual_builders`
4. `rolling_player_recompute`
5. `projection_input_ingest`
6. `projection_derived_build`
7. `projection_execution`
8. `downstream_projection_consumers`
9. `monitoring`

Required fields per stage:

- stage ID
- order
- label
- mode applicability:
  - `overnight`
  - `daily_incremental`
  - `targeted_repair`
- operator-facing surface name
- underlying routes invoked
- tables produced
- dependencies
- whether the stage is skippable in daily mode
- whether the stage is blocking versus cautionary

### B. Keep route handlers as the execution primitives

The orchestrator should call existing routes or shared handlers rather than duplicate their business logic.

Reason:

- route logic already exists
- route-level tests already exist for many surfaces
- route responses already provide useful audit payloads
- direct reuse keeps the implementation smaller and lowers the risk of orchestration drift

### C. Introduce only two top-level scheduled flows

Approved orchestrated flows:

- `overnight`
- `daily_incremental`

Optional future flow:

- `targeted_repair`

These flows should be modes of the same coordinator surface, not three unrelated orchestrators.

## Overnight Flow Definition

### Purpose

- recover all freshness dependencies needed for next-day projections and validation confidence

### Stages

1. core entity freshness
2. upstream skater sources
3. contextual builders
4. rolling-player recompute
5. projection-input ingest
6. projection-derived build
7. projection execution
8. downstream projection consumers
9. monitoring

### Scheduling guidance

- one scheduled coordinator job should own the sequence
- stage-level status should still be visible independently through `cron_job_audit`
- helper routes should not be scheduled individually if they are already invoked by the coordinator

## Daily Incremental Flow Definition

### Purpose

- keep current-day rolling and FORGE outputs fresh within the `4m30s` runtime envelope

### Stages

1. core entity freshness, only when stale
2. upstream skater sources, current freshness window only
3. contextual builders, only for affected current-day / recent games
4. rolling-player recompute, minimal recompute slice only
5. projection-input ingest, recent dates only
6. projection-derived build, recent dates only
7. projection execution
8. optional downstream projection consumers
9. monitoring

### Scheduling guidance

- one scheduled coordinator job should own the sequence
- every stage must accept range / slice / skip policy from the coordinator
- the coordinator should stop treating historical backfill work as part of the hot path

## What Should Not Be Reused

### 1. Raw cron timeline as the authoritative orchestration model

Source showing current sprawl:

- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md)

Why not:

- the current timeline is route-centric, not phase-centric
- it schedules too many route-level jobs
- it mixes current operational jobs, historical ideas, broken jobs, and convenience refreshes

### 2. Helper routes as independent scheduled units

Do not make these standalone scheduled jobs in the new shape:

- `/api/v1/db/update-line-combinations/[id]`
- `/api/v1/db/update-power-play-combinations/[gameId]`
- `/api/v1/db/cron/update-stats-cron`

## Coordinator Behavior Expectations

The future coordinator should:

- accept `mode=overnight|daily_incremental|targeted_repair`
- evaluate the shared stage graph
- run only the stages required for the chosen mode
- capture per-stage:
  - start/end time
  - duration
  - skip reason
  - blocking failure versus caution
  - route invoked
  - key row counts or payload summary
- return one operator-facing summary response
- still rely on underlying `withCronJobAudit` route instrumentation for durable sub-step auditing

## Minimal Cron Surface Target

After reuse of the existing patterns, the intended cron surface is:

- one `rolling-forge overnight` coordinator
- one `rolling-forge daily incremental` coordinator
- one `cron-report` job

Optional:

- one separate `projection-accuracy` job if operationally kept decoupled from the main overnight flow

This is the desired direction, even if the first implementation still invokes some existing routes directly underneath.

## Why This Supports The Runtime Goal

The daily runtime target is not compatible with a cron surface that schedules each helper route separately.

Reusing the current patterns helps because:

- the pipeline spec prevents accidental phase sprawl
- the audit wrapper preserves observability without extra infrastructure
- the coordinator can choose smaller daily slices while preserving the full overnight graph
- route-level reuse avoids a second implementation of the same compute work

## Output Of Task `2.4`

The approved reuse strategy is:

- keep `withCronJobAudit(...)` as the step-audit mechanism
- extend the pipeline-spec pattern to the full rolling-player + FORGE chain
- build one coordinator with multiple modes rather than more scheduled helper routes
- treat the current raw cron list as legacy context, not the design target
