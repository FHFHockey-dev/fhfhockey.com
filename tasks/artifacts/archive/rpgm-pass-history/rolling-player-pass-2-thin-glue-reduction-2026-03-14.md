# Thin Glue Reduction

Date: `2026-03-14`
Task: `5.3`

## Goal

Remove thin transport-layer glue that had accumulated across the pass-2 operator-facing routes.

## What Was Reduced

Added:

- [queryParams.ts](/Users/tim/Code/fhfhockey.com/web/lib/api/queryParams.ts)

Moved repeated query-parsing logic into one shared helper for:

- string parsing
- number parsing
- boolean parsing
- positive-integer parsing

## Routes Updated

- [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)
- [run-rolling-forge-pipeline.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts)
- [rolling-player-metrics.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.ts)

## Why This Counts As Organization Work

Before this change, each route carried local copies of small transport helpers:

- `parseStringParam(...)`
- `parseNumberParam(...)`
- `parseBooleanParam(...)`
- `parsePositiveInt(...)`

That kind of repetition is not a huge runtime problem, but it is exactly the sort of low-signal file sprawl that makes the pass-2 surface feel wider than it needs to be.

This cleanup does two things:

- reduces repeated route boilerplate
- makes the operator-facing route layer more obviously about transport and execution, not ad hoc parsing utilities

## Ownership Model Impact

This continues the `5.x` consolidation direction:

- `rollingPlayerOperationalPolicy.ts`
  - owns execution-profile and runtime-budget policy
- `lib/api/queryParams.ts`
  - owns common query transport parsing
- route handlers
  - own request validation, orchestration, and execution only

## Net Outcome

Task `5.3` closes with a small but real reduction in file sprawl:

- one shared query parsing helper
- less repeated glue in the rolling recompute route, coordinator route, and debug validation route
- cleaner ownership separation between transport helpers and route behavior
