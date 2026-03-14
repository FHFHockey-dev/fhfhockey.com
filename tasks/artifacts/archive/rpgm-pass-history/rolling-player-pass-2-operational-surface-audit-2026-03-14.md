# Operational Surface Audit

Date: `2026-03-14`
Task: `5.1`

## Purpose

Audit the current rolling-player + FORGE operational surface and identify where orchestration logic, refresh policy, diagnostics, and UI/debug responsibilities are spread too far across files.

This audit is focused on maintainability and operator efficiency:

- fewer long-term cron / job surfaces
- clearer ownership boundaries
- less repeated freshness and runtime policy
- a process that remains practical for overnight runs and a sub-`4m30s` daily incremental path

## Files Reviewed

### Orchestration / execution surfaces

- [rollingForgePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingForgePipeline.ts)
- [run-rolling-forge-pipeline.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts)
- [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)
- [update-nst-gamelog.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-gamelog.ts)
- [ingest-projection-inputs.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/ingest-projection-inputs.ts)
- [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts)
- [run-forge-projections.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/run-forge-projections.ts)
- [goaliePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/goaliePipeline.ts)
- [withCronJobAudit.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/withCronJobAudit.ts)

### Rolling-player compute / diagnostics / validation surfaces

- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
- [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts)
- [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts)
- [rolling-player-metrics.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.ts)
- [trendsDebug.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsDebug.tsx)

### Downstream compatibility / reader surfaces

- [rollingPlayerMetricCompatibility.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerMetricCompatibility.ts)
- [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx)
- [skater-queries.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/queries/skater-queries.ts)
- [run-forge-projections.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/run-forge-projections.ts)
- [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts)

## Current Ownership Map

### 1. Orchestration ownership

Current files:

- `rollingForgePipeline.ts`
- `run-rolling-forge-pipeline.ts`
- `goaliePipeline.ts`
- `withCronJobAudit.ts`
- multiple first-class DB routes

Current condition:

- the stage graph now exists in one place
- the execution coordinator exists in one place
- but route-level execution policy still leaks into individual routes through duplicated defaults, mode interpretation, and route-specific assumptions
- there are now two pipeline-spec concepts in the repo:
  - goalie / projection pipeline
  - rolling + FORGE coordinator pipeline

Assessment:

- improved versus the pre-pass route sprawl
- still split between orchestration definition, route implementation, and downstream execution assumptions
- candidate for one clearer ownership boundary named around pipeline orchestration

### 2. Rolling compute ownership

Current files:

- `fetchRollingPlayerAverages.ts`
- multiple helper contracts under `web/lib/supabase/Upserts/*`
- `update-rolling-player-averages.ts`

Current condition:

- `fetchRollingPlayerAverages.ts` owns:
  - source fetches
  - merge logic
  - rolling derivation
  - upsert transport
  - runtime logging
  - execution profiling
  - some policy interpretation for incremental vs broad runs
- this file is now both the compute engine and part of the operational control surface

Assessment:

- the helper-contract extraction reduced formula sprawl
- but operational concerns still live too close to compute internals
- candidate for a narrower ownership split between:
  - compute engine
  - execution / runtime policy

### 3. Diagnostics ownership

Current files:

- `rollingPlayerPipelineDiagnostics.ts`
- `rollingPlayerValidationPayload.ts`
- `trendsDebug.tsx`
- live verification scripts
- audit artifacts

Current condition:

- core diagnostic helpers are centralized in `rollingPlayerPipelineDiagnostics.ts`
- but readiness interpretation now exists in several layers:
  - diagnostics helpers
  - validation payload snapshot builder
  - `trendsDebug.tsx` rendering and operator labels
  - standalone verification scripts
- this means freshness / caution / blocker concepts can still drift by presentation layer

Assessment:

- much better than ad hoc script-only inspection
- still spread across helper, payload, UI, and scripts
- candidate for one diagnostics ownership boundary that outputs one operator-facing status model reused everywhere

### 4. Validation ownership

Current files:

- `rollingPlayerValidationPayload.ts`
- `rolling-player-metrics.ts`
- `trendsDebug.tsx`

Current condition:

- server-authoritative payload work is in place
- debug route is now thin
- `trendsDebug.tsx` still contains selector policy, request-splitting policy, and some local field-family behavior

Assessment:

- this is close to the right boundary already
- remaining sprawl is mostly UI policy and selector logic, not server math
- likely needs light consolidation, not another major surface split

### 5. Downstream-reader ownership

Current files:

- `rollingPlayerMetricCompatibility.ts`
- trends player page
- projection query layer
- projection execution layer
- start-chart refresh route

Current condition:

- compatibility policy is now centralized
- but the same authoritative-field policy still has to be applied separately in multiple consumers
- that is better than implicit field picks, but it still creates a broad reader surface that can drift if each consumer adds its own exceptions

Assessment:

- acceptable if the compatibility helper remains the single authority
- still a source of maintenance drag because the readers span UI, query, model-runner, and downstream refresh code

## Where Responsibilities Are Still Too Spread Out

### A. Runtime and freshness policy are split across too many layers

Current spread:

- coordinator stage graph
- rolling recompute route defaults
- rolling compute engine behavior
- diagnostics snapshot builder
- debug UI readiness rendering
- verification scripts

Why this matters:

- one conceptual policy change can require touching several files
- that increases the chance of “the cron path says one thing, the debug path says another” drift

### B. Operational surfaces are cleaner than before, but implementation surfaces are still broad

Current spread:

- one coordinator route
- one rolling recompute route
- many supporting builder / ingest routes
- separate reader and debug surfaces

Why this matters:

- operator-facing sprawl is improved
- code ownership sprawl is still high
- that is the risk behind your concern that the process could become expensive to keep fresh overnight even if the cron count itself is reduced

### C. `fetchRollingPlayerAverages.ts` still carries too much mixed responsibility

It currently mixes:

- data acquisition
- derivation
- persistence
- runtime instrumentation
- execution-shape behavior

Why this matters:

- it remains the biggest single maintenance hotspot
- future optimization work will keep landing there unless execution-policy concerns are separated from compute concerns

### D. Diagnostics concepts are repeated across helper, payload, UI, scripts, and artifacts

Repeated concepts:

- readiness
- blockers
- cautions
- target freshness
- PP coverage caveats
- ratio completeness caveats

Why this matters:

- the repo now has better observability, but the same mental model is expressed in too many places
- this is organization sprawl rather than route sprawl

## Recommended Ownership Boundaries

The current repo should converge toward five main ownership areas:

### 1. Pipeline orchestration

Owns:

- stage graph
- phase ordering
- route-to-phase mapping
- daily vs overnight mode policy
- operator-facing runtime budgets

Primary files:

- `web/lib/rollingForgePipeline.ts`
- `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`
- shared cron audit helpers

### 2. Rolling compute engine

Owns:

- source fetch
- merge
- derive
- persist
- helper-contract integration

Primary files:

- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
- helper contracts in the same `Upserts` folder

### 3. Diagnostics and readiness model

Owns:

- freshness summaries
- coverage summaries
- completeness summaries
- suspicious-output summaries
- one reusable readiness model for scripts, API payloads, and UI

Primary files:

- `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts`
- a small shared readiness adapter if needed

### 4. Validation payload and operator UI

Owns:

- validation payload assembly
- debug route transport
- validation console rendering
- copy helpers

Primary files:

- `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts`
- `web/pages/api/v1/debug/rolling-player-metrics.ts`
- `web/pages/trendsDebug.tsx`

### 5. Downstream compatibility readers

Owns:

- canonical-vs-legacy policy
- downstream field resolution
- consumer-specific reads that must stay aligned with the compatibility contract

Primary files:

- `web/lib/rollingPlayerMetricCompatibility.ts`
- downstream readers and query consumers

## Specific Sprawl Findings

1. The cron surface is no longer the main problem; the bigger problem is policy duplication between orchestration, diagnostics, compute, and UI layers.
2. `fetchRollingPlayerAverages.ts` remains overburdened and is the clearest file-level organization hotspot.
3. Readiness semantics are centralized enough to work, but not yet centralized enough to be obviously single-source-of-truth.
4. The coordinator solved operator sprawl, but the repo still lacks a final documentation layer that cleanly tells operators which surfaces are primary, helper-only, and debug-only.
5. Downstream compatibility is in better shape, but still spans enough consumers that future schema cleanup should be grouped as one track rather than scattered follow-ups.

## Net Outcome

Task `5.1` closes with this conclusion:

- the overnight and daily job surface can stay small
- the remaining organization risk is code-ownership sprawl, not just cron-count sprawl
- the next steps should consolidate around fewer ownership boundaries rather than adding more routes, scripts, or mini-helpers
