# FORGE Dashboard Observability Review

## Status

- `yellow`

## What Already Exists

### Strong Existing Coverage

- [dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx)
  - broad mocked page-level rendering coverage
  - loading, stale, empty, nav, ownership-band, and tab behavior
- [FORGE.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/FORGE.test.tsx)
  - landing preview rendering
  - fallback messaging
  - partial preview degradation
- [team/[teamId].test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/team/[teamId].test.tsx)
  - team detail happy-path rendering
  - some missing-feed degradation
- [player/[playerId].test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/player/[playerId].test.tsx)
  - player-detail rendering
  - ownership-unavailable degradation
- focused contract/helper coverage:
  - [teamContext.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.test.ts)
  - [topAddsRanking.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.test.ts)
  - [playerOwnership.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.test.ts)
  - [normalizers.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.test.ts)
- audit specs already present:
  - [dashboard-freshness-audit.spec.ts](/Users/tim/Code/fhfhockey.com/web/tests/audit/dashboard-freshness-audit.spec.ts)
  - [dashboard-data-audit.spec.ts](/Users/tim/Code/fhfhockey.com/web/tests/audit/dashboard-data-audit.spec.ts)
  - [dashboard-reliability-audit.spec.ts](/Users/tim/Code/fhfhockey.com/web/tests/audit/dashboard-reliability-audit.spec.ts)
  - [dashboard-performance-audit.spec.ts](/Users/tim/Code/fhfhockey.com/web/tests/audit/dashboard-performance-audit.spec.ts)

### Policy-Level Instrumentation

- [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts)
  - freshness-policy helpers exist
- [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)
  - payload budgets exist for several dashboard endpoints

## Where Observability Is Still Weak

### Live-Freshness Integrity

- current freshness policy does not cover the full audited chain
- notable gaps:
  - no policy entries for `/api/v1/forge/players`
  - no policy entries for `/api/v1/transactions/ownership-trends`
  - no policy entries for `/api/v1/transactions/ownership-snapshots`
  - no route-family mixed-date policy
- existing freshness checks also trust some unsafe timestamps:
  - CTPI uses request-time `generatedAt`
  - skater-power uses request-time `generatedAt`

### Route Continuity

- existing page tests verify links exist
- they do **not** systematically verify that links preserve:
  - selected date
  - resolved fallback date
  - mode
  - originating dashboard context

### Degraded-State Specificity

- component tests often cover:
  - request failure
  - empty payload
  - stale fallback copy
- they rarely cover:
  - stale-but-present data that still renders as current
  - mixed-cadence pages where only one sub-feed is stale
  - silent ownership suppression caused by null ownership

### Reconciliation Automation

- current automated coverage is stronger for mocked rendering than for live source-to-UI reconciliation
- several of the most important audit findings came from:
  - live curl checks
  - source table max-date inspection
  - route-to-source comparison done manually in artifacts

## Runtime / Payload Observability Gaps

[perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts) currently covers:

- `/api/team-ratings`
- `/api/v1/forge/goalies`
- `/api/v1/start-chart`
- `/api/v1/trends/team-ctpi`
- `/api/v1/trends/skater-power`
- `/api/v1/sustainability/trends`

Missing from explicit budget policy:

- `/api/v1/forge/players`
- `/api/v1/transactions/ownership-trends`
- `/api/v1/transactions/ownership-snapshots`
- route-family surfaces as composed pages rather than individual endpoints

## Overall Assessment

The observability baseline is `yellow`.

Why not `red`:

- there is already real test coverage
- there are already dedicated audit specs
- there are already freshness and budget helpers

Why not `green`:

- the current audit has repeatedly found issues that existing checks did not catch
- live freshness integrity for several endpoints is still effectively manual
- route-family and mixed-cadence behavior are under-instrumented

## Required Follow-Ups

- expand freshness policy to cover Top Adds dependencies and route-family context
- stop trusting request-time metadata as proof of source freshness
- add route-continuity checks for date/mode/context preservation
- add degraded-state tests for stale-but-present and mixed-cadence failures
- promote the current manual reconciliation patterns into repeatable checks where possible
