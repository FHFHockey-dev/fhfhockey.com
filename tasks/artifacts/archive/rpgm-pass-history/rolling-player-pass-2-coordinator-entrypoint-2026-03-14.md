## Purpose

This artifact records the first implementation of the consolidated rolling-player + FORGE orchestration surface from task `2.5`.

## Implemented Surface

- route: [run-rolling-forge-pipeline.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts)
- spec: [rollingForgePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingForgePipeline.ts)

## What It Does

- exposes one coordinator route for:
  - `mode=daily_incremental`
  - `mode=overnight`
  - `mode=targeted_repair`
- returns a shared pipeline spec plus per-stage results
- delegates to existing route handlers instead of duplicating compute logic
- invokes child handlers with cron-style auth headers so existing `adminOnly` and `withCronJobAudit` behavior still works
- records stage-level:
  - status
  - duration
  - underlying step results
  - skipped reasons

## Current Execution Shape

The coordinator currently sequences these stages:

1. core entity freshness
2. upstream skater sources
3. contextual builders
4. rolling-player recompute
5. projection-input ingest
6. projection-derived build
7. projection execution
8. downstream projection consumers
9. monitoring

## Important Implementation Choices

- monitoring remains represented in the pipeline spec but is not recursively invoked from the coordinator
- PP freshness is batched inside the coordinator by listing `games` in the selected date range and replaying the existing single-game PP route
- WGO remains internally split, but the coordinator reports it as one conceptual stage
- daily mode skips `update-wgo-ly` by policy
- downstream accuracy is opt-in for daily mode and on by default for overnight mode

## Why This Is The Right First Step

- it collapses the operator-facing process into one route without introducing a second copy of the compute logic
- it provides the step-level status reporting required for later runtime and runbook work
- it keeps the cron surface reducible to a small number of coordinator jobs plus reporting

## Known Follow-Up Limits

- the coordinator is sequencing existing handlers, not yet optimizing the runtime envelope
- line-context batching still depends on the existing route behavior rather than a date-aware coordinator-native selection policy
- WGO is still implemented through multiple internal handler calls
- monitoring is still a separate reporting surface

Those follow-ups belong in `2.6` and `3.x`, not in this first coordinator landing.
