## Purpose

This artifact decides which existing refresh endpoints should remain first-class operational surfaces and which should be treated as internal implementation steps behind a smaller orchestration layer.

This is the policy cut required before building a coordinator.

## Decision Standard

A route remains first-class only if at least one of these is true:

- operators must reasonably trigger it directly as a normal workflow step
- it represents a true phase boundary with meaningful independent status
- it is already the cleanest batch surface for that phase
- it is required for targeted repair work that cannot be sensibly hidden

A route should become implementation detail if:

- it is only one step inside a broader freshness phase
- it exists as a single-game helper while the true operational need is batch freshness
- exposing it directly would increase cron sprawl without improving observability or recovery

## Approved First-Class Operational Surfaces

### 1. Core upstream freshness

- keep `/api/v1/db/update-games`
- keep `/api/v1/db/update-teams`
- keep `/api/v1/db/update-players`

Reason:

- these are stable phase-boundary refreshes
- they are understandable to operators
- they are already batch-oriented and low-ambiguity

### 2. Skater-source freshness

- keep `/api/v1/db/update-nst-gamelog`

Reason:

- this is already the right batch surface for NST freshness
- splitting NST freshness further at the job layer would create unnecessary schedule sprawl

### 3. Context builder batch surfaces

- keep `/api/v1/db/update-line-combinations`
- do not keep `/api/v1/db/update-power-play-combinations/[gameId]` as a first-class batch surface

Reason:

- line combinations already has the correct batch route
- PP freshness currently lacks a batch route, so the route that exists is an implementation primitive, not the final operational surface
- the orchestrator or a future batch wrapper should own PP batch freshness, not a cron list of single-game PP builder calls

### 4. Rolling and projection compute phases

- keep `/api/v1/db/update-rolling-player-averages`
- keep `/api/v1/db/ingest-projection-inputs`
- keep `/api/v1/db/build-projection-derived-v2`
- keep `/api/v1/db/update-goalie-projections-v2`
- keep `/api/v1/db/run-projection-v2`
- keep `/api/v1/db/run-projection-accuracy`
- keep `/api/v1/db/update-start-chart-projections`

Reason:

- each route represents a real compute phase or a downstream refresh boundary
- each already exposes useful range/chunk/runtime controls or clean downstream semantics
- these are the natural units for step-level status reporting

### 5. Monitoring

- keep `/api/v1/db/cron-report`

Reason:

- it is a reporting surface over `cron_job_audit`
- it should remain visible even if orchestration collapses the job graph

## Approved Internal / Helper Surfaces

### 1. Targeted builder / repair helpers

- move `/api/v1/db/update-line-combinations/[id]` into helper-only status
- move `/api/v1/db/update-power-play-combinations/[gameId]` into helper-only status

Reason:

- both are useful for repair and debugging
- neither should remain a normal scheduled operational surface

### 2. Legacy mixed-purpose cron helper

- move `/api/v1/db/cron/update-stats-cron` into helper-only status

Reason:

- it is not part of the clean rolling-player plus FORGE freshness DAG
- it updates game stats, but not in a way that should anchor the modern orchestrated refresh policy

### 3. WGO split routes as operator-facing surfaces

- do not treat:
  - `/api/v1/db/update-wgo-skaters`
  - `/api/v1/db/update-wgo-totals`
  - `/api/v1/db/update-wgo-averages`
  - `/api/v1/db/update-wgo-ly`
  as separate long-term first-class operational surfaces

Reason:

- WGO freshness is conceptually one upstream phase
- the current route split is an implementation detail of that phase
- operators should not need to reason about several WGO jobs just to know whether rolling freshness is healthy

Policy:

- these routes may continue to exist
- but the future orchestrator should expose one WGO freshness phase and one WGO phase status

## Explicit Surface Table

| Route / phase surface | Keep first-class? | Policy |
| --- | --- | --- |
| `/api/v1/db/update-games` | yes | first-class direct step |
| `/api/v1/db/update-teams` | yes | first-class direct step |
| `/api/v1/db/update-players` | yes | first-class direct step |
| `/api/v1/db/update-nst-gamelog` | yes | first-class direct step |
| WGO split routes | no, individually | internal phase steps under one upstream WGO gate |
| `/api/v1/db/update-line-combinations` | yes | first-class contextual batch step |
| `/api/v1/db/update-line-combinations/[id]` | no | targeted repair helper |
| `/api/v1/db/update-power-play-combinations/[gameId]` | no | targeted repair/helper until a batch phase exists |
| `/api/v1/db/update-rolling-player-averages` | yes | first-class recompute step |
| `/api/v1/db/ingest-projection-inputs` | yes | first-class ingest step |
| `/api/v1/db/build-projection-derived-v2` | yes | first-class derive step |
| `/api/v1/db/update-goalie-projections-v2` | yes | first-class projection-prep step |
| `/api/v1/db/run-projection-v2` | yes | first-class execution step |
| `/api/v1/db/run-projection-accuracy` | yes | first-class overnight evaluation step |
| `/api/v1/db/update-start-chart-projections` | yes | first-class downstream refresh step |
| `/api/v1/db/cron/update-stats-cron` | no | legacy helper only |
| `/api/v1/db/cron-report` | yes | first-class monitoring step |

## Resulting Operator Surface

The approved operator-facing surface should converge toward:

1. upstream entity freshness
2. upstream skater-source freshness
3. contextual-builder freshness
4. rolling-player recompute
5. projection-input ingest
6. derived build
7. projection execution
8. downstream consumer refresh
9. monitoring

That is a phase-level surface, not a raw route-level surface.

## Cron Surface Implication

This decision rules out a future where the cron list directly mirrors every existing helper route.

The intended cron shape is:

- a small set of orchestrated phase jobs
- optional targeted repair routes for manual intervention
- one reporting job

This is materially smaller and better aligned with the stated goal of keeping FORGE fresh without an extensive cron list.

## Constraint Alignment

This decision directly supports:

- overnight full-process execution through a compact orchestrated chain
- a constrained daily incremental path
- a sub-`4m30s` target for daily updates by preventing phase fragmentation
- better ownership boundaries, since helper routes stop masquerading as independent jobs

## Output Of Task `2.3`

The route inventory and phase graph now have a concrete policy layer:

- what operators should see
- what the orchestrator should own
- what remains available only for repair/debug use

This is the required input for `2.4` and `2.5`.
