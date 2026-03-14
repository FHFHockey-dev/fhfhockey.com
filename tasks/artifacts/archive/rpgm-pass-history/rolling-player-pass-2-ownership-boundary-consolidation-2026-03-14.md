# Ownership Boundary Consolidation

Date: `2026-03-14`
Task: `5.2`

## Goal

Start collapsing the pass-2 operational surface around fewer ownership boundaries instead of leaving execution policy duplicated across routes, scripts, and orchestration helpers.

## What Was Consolidated

### Shared operational policy module

Added:

- [rollingPlayerOperationalPolicy.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerOperationalPolicy.ts)

This module now owns:

- execution-profile type
- rolling execution defaults
- rolling execution runtime budgets
- rolling + FORGE coordinator runtime budgets
- execution-profile parsing
- rolling execution-profile inference

### Callers moved to the shared boundary

Updated:

- [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)
- [run-rolling-forge-pipeline.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts)
- [check-rolling-player-runtime-budget.ts](/Users/tim/Code/fhfhockey.com/web/scripts/check-rolling-player-runtime-budget.ts)
- [rollingForgePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingForgePipeline.ts)

## Why This Boundary Matters

Before this change, execution-profile policy was spread across:

- the rolling recompute route
- the rolling runtime-budget script
- the coordinator route
- the pipeline-spec surface

That meant a single policy change could require several edits and risk drift between:

- operator-facing budgets
- route defaults
- runtime-budget checks
- orchestration mode handling

After this change, that policy has one clear owner.

## Ownership Model Impact

This is the first concrete consolidation move for the ownership model identified in task `5.1`:

- `rollingPlayerOperationalPolicy.ts`
  - owns execution profile and budget policy
- `rollingForgePipeline.ts`
  - owns phase graph / stage ordering
- route handlers
  - own transport and execution only
- scripts
  - consume policy rather than re-declare it

## What This Does Not Yet Solve

- `fetchRollingPlayerAverages.ts` is still too broad and remains the main compute hotspot
- readiness semantics still span diagnostics, payload, UI, and scripts
- downstream compatibility still spans several readers, even though policy is centralized better than before

## Net Outcome

Task `5.2` closes with one real ownership-boundary reduction:

- execution-profile and runtime-budget policy now have a single shared module
- route and script surfaces are thinner
- the next organization steps can focus on repeated freshness/readiness logic and remaining thin glue layers
