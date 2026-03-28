# FORGE Dashboard Component Health Matrix

## Summary

- `green`: `0`
- `yellow`: `0`
- `red`: `10`

The audit result is intentionally severe. The dashboard family is feature-complete enough to use, but it is not yet trustworthy enough to classify any in-scope component as healthy. The main repeating failure modes are:

- stale or mixed-cadence source chains presented as current
- cron/runbook ordering that does not match the real dependency graph
- request-time freshness metadata masking stale upstream data
- ownership overlays suppressing valid player rows without truthful degraded messaging
- route continuity dropping `date`, `mode`, or resolved fallback context

## Matrix

| Component | Final Status | Cron Ownership | Primary Reason | Evidence |
| --- | --- | --- | --- | --- |
| Dashboard Slate (`SlateStripCard`) | `red` | `yellow` | Matchups reconcile, but the goalie leg was stale or empty on the audited slate while the hero still read as current. | [Health Audit](./forge-dashboard-slate-health-audit.md), [Freshness Ownership](./forge-dashboard-slate-freshness-ownership.md), [Reconciliation](./forge-dashboard-slate-reconciliation.md) |
| Top Player Adds (`TopAddsRail`) | `red` | `yellow` | The opportunity board is ranking surviving rows coherently, but the live ownership merge is unhealthy, truncated, and still leaning on normalized-name fallback. | [Health Audit](./forge-dashboard-top-adds-health-audit.md), [Freshness Ownership](./forge-dashboard-top-adds-freshness-ownership.md), [Reconciliation](./forge-dashboard-top-adds-reconciliation.md) |
| Team Trend Context (`TeamPowerCard`) | `red` | `red` | Current team ratings are being mixed with stale CTPI and flat team-power trend data, while the panel still presents itself as one current snapshot. | [Health Audit](./forge-dashboard-team-context-health-audit.md), [Freshness Ownership](./forge-dashboard-team-context-freshness-ownership.md), [Reconciliation](./forge-dashboard-team-context-reconciliation.md) |
| Sustainable vs Unsustainable (`SustainabilityCard`) | `red` | `red` | The dashboard truthfully falls back to stale sustainability snapshots, but `l10` continuity gaps plus null ownership suppression make the rendered board untrustworthy. | [Health Audit](./forge-dashboard-sustainability-health-audit.md), [Freshness Ownership](./forge-dashboard-sustainability-freshness-ownership.md), [Reconciliation](./forge-dashboard-sustainability-reconciliation.md) |
| Hot / Cold and Trending Up / Down (`HotColdCard`) | `red` | `red` | The movement UI is coherent, but it depends on stale or unscheduled trend data while request-time freshness metadata makes the surface look current. | [Health Audit](./forge-dashboard-trend-movement-health-audit.md), [Freshness Ownership](./forge-dashboard-trend-movement-freshness-ownership.md), [Reconciliation](./forge-dashboard-trend-movement-reconciliation.md) |
| Goalie and Risk (`GoalieRiskCard`) | `red` | `red` | The band renders uncertainty drivers honestly, but the live route is fallback-driven and only covers a partial resolved slate instead of the requested goalie window. | [Health Audit](./forge-dashboard-goalie-health-audit.md), [Freshness Ownership](./forge-dashboard-goalie-freshness-ownership.md), [Reconciliation](./forge-dashboard-goalie-reconciliation.md) |
| FORGE Landing (`FORGE.tsx`) | `red` | `red` | The preview route mixes current and fallback module states, drops some resolved date continuity, and does not summarize mixed-date risk at the page level. | [Route Family Audit](./forge-dashboard-route-family-health-audit.md), [Preview Consistency](./forge-dashboard-route-preview-consistency.md), [Route Family Reconciliation](./forge-dashboard-route-family-reconciliation.md) |
| Team Drill-In (`/forge/team/[teamId]`) | `red` | `red` | Team clicks can drop selected dashboard date, and the route still anchors its visible date chips to current ratings while stale CTPI remains hidden underneath. | [Team Route Audit](./forge-dashboard-team-route-health-audit.md), [Route Click Contract](./forge-dashboard-route-click-contract.md), [Route Family Reconciliation](./forge-dashboard-route-family-reconciliation.md) |
| Player Drill-In (`/forge/player/[playerId]`) | `red` | `red` | The route inherits stale/fallback projection context, drops some dashboard date and mode continuity, and does not fully honor the dashboard week-mode add-score contract. | [Player Route Audit](./forge-dashboard-player-route-health-audit.md), [Route Click Contract](./forge-dashboard-route-click-contract.md), [Route Family Reconciliation](./forge-dashboard-route-family-reconciliation.md) |
| Route Navigation And Click Contract (`ForgeRouteNav` plus card CTAs) | `red` | `red` | Row-level destinations are often cleaner than panel CTAs, but date, mode, and resolved fallback context are still inconsistently preserved across the route family. | [Route Click Contract](./forge-dashboard-route-click-contract.md), [Route Family Audit](./forge-dashboard-route-family-health-audit.md), [Route Family Reconciliation](./forge-dashboard-route-family-reconciliation.md) |

## Cross-Cutting Status

### Observability

- Overall: `yellow`
- Reason: mocked page-level coverage is strong, but live freshness integrity, mixed-date detection, and ownership-overlay verification are still too manual.
- Evidence: [Observability Review](./forge-dashboard-observability-review.md), [Observability Follow-Ups](./forge-dashboard-observability-followups.md)

### Degraded-State Safety

- Overall: `red`
- Reason: obvious hard failures are usually handled, but stale-but-present and mixed-cadence states still too often read as current.
- Evidence: [Degraded-State Audit](./forge-dashboard-degraded-state-audit.md)

### Cron And Runtime Health

- Overall: `red`
- Reason: several component chains are scheduled, but not in dependency-safe order, and key serving endpoints still lack explicit budget policy.
- Evidence: [Cron / Runtime Audit](./forge-dashboard-cron-runtime-health-audit.md)

### Reconciliation Coverage

- Overall: `red`
- Reason: the audit proved many issues, but too much of that proof still required manual ad hoc checking rather than reusable verification paths.
- Evidence: [Reconciliation Gap Audit](./forge-dashboard-reconciliation-gap-audit.md), [Component Evidence Template](./forge-dashboard-component-evidence-template.md)

## Operational Conclusion

The authoritative operational interpretation of the FORGE dashboard family is:

1. the surfaces are implemented and partially instrumented
2. the rendering layer is usually honest to the APIs it consumes
3. the bigger failures are upstream freshness, mixed-cadence safety, route continuity, and ownership integrity
4. the next phase should prioritize trust repairs over new UI expansion
