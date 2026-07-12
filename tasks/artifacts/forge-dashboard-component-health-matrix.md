# FORGE Dashboard Component Health Matrix

## Summary

- `green`: `4`
- `yellow`: `3`
- `red`: `3`

The original all-red audit has been remediated and re-audited. Healthy route and team-context contracts are now green; mixed-source or offseason-safe surfaces are yellow; the three remaining red components have explicit data/ownership gates rather than hidden failures. The remaining constraints are:

- the weekly (`horizon=5`) owner is active and authenticated, but prospective non-zero in-season output is still required before Top Adds promotion
- approved historical sustainability and goalie gaps that must not be reconstructed with later inputs
- offseason trend feeds that are useful only as latest-eligible data and must remain visibly blocked as stale

## Matrix

| Component | Final Status | Cron Ownership | Primary Reason | Evidence |
| --- | --- | --- | --- | --- |
| Dashboard Slate (`SlateStripCard`) | `yellow` | `yellow` | Start Chart is same-day and degraded states are truthful, but the approved historical goalie gap still prevents an unconditional promotion. | [Health Audit](./forge-dashboard-slate-health-audit.md), [Freshness Ownership](./forge-dashboard-slate-freshness-ownership.md), [Reconciliation](./forge-dashboard-slate-reconciliation.md) |
| Top Player Adds (`TopAddsRail`) | `red` | `green` | Option A is deployed and active as Vault-backed job 393 at 10:12 UTC; Top Adds remains red until a prospective non-zero in-season horizon-5 run proves output coverage. | [Health Audit](./forge-dashboard-top-adds-health-audit.md), [Freshness Ownership](./forge-dashboard-top-adds-freshness-ownership.md), [Reconciliation](./forge-dashboard-top-adds-reconciliation.md) |
| Team Trend Context (`TeamPowerCard`) | `green` | `green` | Production writers, source pagination, dependency ordering, and recency metadata reconcile; all 32 current team rows have distinct non-zero `trend10` values. | [Health Audit](./forge-dashboard-team-context-health-audit.md), [Freshness Ownership](./forge-dashboard-team-context-freshness-ownership.md), [Reconciliation](./forge-dashboard-team-context-reconciliation.md) |
| Sustainable vs Unsustainable (`SustainabilityCard`) | `red` | `yellow` | Rendering and ownership degradation are truthful, but the approved 13-day historical `l10` gap remains quarantined pending prospective same-day evidence. | [Health Audit](./forge-dashboard-sustainability-health-audit.md), [Freshness Ownership](./forge-dashboard-sustainability-freshness-ownership.md), [Reconciliation](./forge-dashboard-sustainability-reconciliation.md) |
| Hot / Cold and Trending Up / Down (`HotColdCard`) | `yellow` | `green` | The scheduled writer and source-recency contract are repaired; the offseason feed resolves latest eligible 2026-05-09 data and correctly blocks it as stale instead of claiming currency. | [Health Audit](./forge-dashboard-trend-movement-health-audit.md), [Freshness Ownership](./forge-dashboard-trend-movement-freshness-ownership.md), [Reconciliation](./forge-dashboard-trend-movement-reconciliation.md) |
| Goalie and Risk (`GoalieRiskCard`) | `red` | `yellow` | The route truthfully blocks the approved missing 2026-03-29 historical scope; prospective same-day goalie evidence is still required for promotion. | [Health Audit](./forge-dashboard-goalie-health-audit.md), [Freshness Ownership](./forge-dashboard-goalie-freshness-ownership.md), [Reconciliation](./forge-dashboard-goalie-reconciliation.md) |
| FORGE Landing (`FORGE.tsx`) | `yellow` | `yellow` | Mixed-date warnings and CTA continuity are repaired, but aggregate health inherits the three retained component quarantines and offseason source availability. | [Route Family Audit](./forge-dashboard-route-family-health-audit.md), [Preview Consistency](./forge-dashboard-route-preview-consistency.md), [Route Family Reconciliation](./forge-dashboard-route-family-reconciliation.md) |
| Team Drill-In (`/forge/team/[teamId]`) | `green` | `green` | Selected date and contextual source presentation persist through navigation, with focused route regressions passing. | [Team Route Audit](./forge-dashboard-team-route-health-audit.md), [Route Click Contract](./forge-dashboard-route-click-contract.md), [Route Family Reconciliation](./forge-dashboard-route-family-reconciliation.md) |
| Player Drill-In (`/forge/player/[playerId]`) | `green` | `green` | Date/mode/return context and shared schedule scoring survive handoff; weekly source availability remains owned by the separate Top Adds gate. | [Player Route Audit](./forge-dashboard-player-route-health-audit.md), [Route Click Contract](./forge-dashboard-route-click-contract.md), [Route Family Reconciliation](./forge-dashboard-route-family-reconciliation.md) |
| Route Navigation And Click Contract (`ForgeRouteNav` plus card CTAs) | `green` | `green` | Shared links preserve selected date, mode, team/position filters, fallback context, and encoded return paths across the route family. | [Route Click Contract](./forge-dashboard-route-click-contract.md), [Route Family Audit](./forge-dashboard-route-family-health-audit.md), [Route Family Reconciliation](./forge-dashboard-route-family-reconciliation.md) |

## Cross-Cutting Status

### Observability

- Overall: `green`
- Reason: source-recency, mixed-date, ownership-overlay, route-continuity, and endpoint-budget checks are automated; the remaining weekly-source gap is explicit product data ownership, not hidden observability debt.
- Evidence: [Observability Review](./forge-dashboard-observability-review.md), [Observability Follow-Ups](./forge-dashboard-observability-followups.md)

### Degraded-State Safety

- Overall: `green`
- Reason: stale, mixed-date, missing-overlay, partial-coverage, and blocked-fallback states are explicitly distinguished in the route tests and UI contracts.
- Evidence: [Degraded-State Audit](./forge-dashboard-degraded-state-audit.md)

### Cron And Runtime Health

- Overall: `yellow`
- Reason: team-context, player-trend, and weekly projection owners are deployed, scheduled, and authenticated; approved historical/prospective data-promotion gates remain.
- Evidence: [Cron / Runtime Audit](./forge-dashboard-cron-runtime-health-audit.md)

### Reconciliation Coverage

- Overall: `green`
- Reason: focused reconciliation groups, full Vitest, TypeScript, build, production probes, and explicit source-date checks now provide reusable evidence.
- Evidence: [Reconciliation Gap Audit](./forge-dashboard-reconciliation-gap-audit.md), [Component Evidence Template](./forge-dashboard-component-evidence-template.md)

## Operational Conclusion

The authoritative operational interpretation is now:

1. team-context and route-continuity contracts are healthy
2. stale, mixed, partial, and missing-overlay states are represented truthfully
3. historical sustainability/goalie exceptions remain quarantined pending prospective evidence
4. Top Adds week mode remains blocked on NEW 15 credential rotation and Vault-backed option-A activation

See [Remediation Closeout](./forge-dashboard-component-remediation-closeout.md) for production, verification, and exact-next-action evidence.
