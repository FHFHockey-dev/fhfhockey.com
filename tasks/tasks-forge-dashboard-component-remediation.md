## Relevant Files

- `tasks/prd-forge-dashboard-component-health.md` - Source PRD for the component-health program that produced this remediation tracker.
- `tasks/tasks-prd-forge-dashboard-component-health.md` - Completed audit tracker whose artifacts define the starting evidence set for this implementation phase.
- `tasks/artifacts/forge-dashboard-component-health-matrix.md` - Authoritative final status matrix for all in-scope FORGE components.
- `tasks/artifacts/forge-dashboard-component-health-remediation-backlog.md` - Rolling backlog for newly discovered bugs, optimizations, cron gaps, and verification follow-ups.
- `tasks/artifacts/forge-dashboard-observability-followups.md` - Extracted observability and verification follow-up set from the audit phase.
- `tasks/artifacts/forge-dashboard-slate-health-audit.md` - Slate baseline evidence for freshness, correctness, and degraded-state repair work.
- `tasks/artifacts/forge-dashboard-top-adds-health-audit.md` - Top Adds baseline evidence for ownership-merge, ranking-contract, and opportunity-board repair work.
- `tasks/artifacts/forge-dashboard-team-context-health-audit.md` - Team-context baseline evidence for CTPI, team-power, and mixed-date repair work.
- `tasks/artifacts/forge-dashboard-sustainability-health-audit.md` - Sustainability baseline evidence for stale snapshot, ownership overlay, and trust-label repair work.
- `tasks/artifacts/forge-dashboard-trend-movement-health-audit.md` - Trend-movement baseline evidence for freshness integrity and movement-contract repair work.
- `tasks/artifacts/forge-dashboard-goalie-health-audit.md` - Goalie baseline evidence for requested-date coverage and fallback repair work.
- `tasks/artifacts/forge-dashboard-route-family-health-audit.md` - Route-family baseline evidence for landing-preview, drill-in, and click-contract repair work.
- `tasks/artifacts/forge-dashboard-route-click-contract.md` - Routing and continuity baseline for preserving `date`, `mode`, and resolved fallback context.
- `fhfh-styles.md` - Root design-system blueprint the fourth-pass styling completion must follow.
- `web/pages/forge/dashboard.tsx` - Main dashboard route where mixed-date warnings, degraded-state treatment, and component-level truthfulness will be repaired.
- `web/pages/skoCharts.tsx` - Legacy inspiration surface whose useful concepts must be ported intentionally and whose stale math/runtime assumptions must be retired explicitly.
- `web/pages/FORGE.tsx` - Preview landing route whose preview consistency and CTA continuity need repair.
- `web/pages/forge/team/[teamId].tsx` - Team drill-in route requiring date continuity and stale CTPI safety fixes.
- `web/pages/forge/player/[playerId].tsx` - Player drill-in route requiring week-mode and route-context fixes.
- `web/components/forge-dashboard/SlateStripCard.tsx` - Slate hero component needing goalie freshness and degraded-state repairs.
- `web/components/forge-dashboard/TopAddsRail.tsx` - Top Adds component needing ownership integrity and contract fixes.
- `web/components/forge-dashboard/TeamPowerCard.tsx` - Team-context component needing CTPI freshness and mixed-date repairs.
- `web/components/forge-dashboard/SustainabilityCard.tsx` - Sustainability component needing trust-label and ownership-overlay repairs.
- `web/components/forge-dashboard/HotColdCard.tsx` - Trend-movement component needing true freshness semantics and overlay safety repairs.
- `web/components/forge-dashboard/GoalieRiskCard.tsx` - Goalie component needing coverage-loss, fallback, and requested-date truthfulness repairs.
- `web/components/forge-dashboard/ForgeRouteNav.tsx` - Shared route navigation contract that must preserve dashboard context correctly.
- `web/components/forge-dashboard/TopMoversCard.tsx` - Currently unused dashboard module that needs an explicit integrate-or-retire decision instead of remaining stale surface area.
- `web/lib/dashboard/forgeLinks.ts` - Shared FORGE route-state helper for preserving selected date, mode, and resolved fallback context across nav and drill-ins.
- `web/lib/dashboard/normalizers.ts` - Shared normalization layer where stale coercion and mixed-cadence masking currently occur.
- `web/lib/dashboard/playerOwnership.ts` - Shared Yahoo ownership helper that needs season-resolution and null-overlay repairs.
- `web/lib/dashboard/teamContext.ts` - Team-context scoring helpers whose displayed composite naming and weighting assumptions need re-validation.
- `web/lib/dashboard/topAddsRanking.ts` - Ranking helper that needs final contract cleanup once the ownership universe is fixed.
- `web/lib/dashboard/freshness.ts` - Shared dashboard freshness policy that must stop trusting request-time metadata and cover missing endpoints.
- `web/lib/dashboard/perfBudget.ts` - Shared endpoint-budget policy that still lacks explicit coverage for several ownership and FORGE endpoints.
- `web/lib/supabase/utils/statistics.ts` - Legacy sKO characteristic-scoring math that should inform explainability decisions but not silently bleed into FORGE without re-validation.
- `web/lib/supabase/utils/calculations.ts` - Legacy sKO game-score weighting surface reviewed for salvage versus retirement.
- `web/lib/supabase/utils/dataFetching.ts` - Legacy sKO page fetch path that uses direct client-side Supabase queries and must stay isolated from FORGE runtime assumptions.
- `web/pages/api/v1/start-chart.ts` - Slate-facing API whose goalie leg and date semantics need repair.
- `web/pages/api/v1/forge/players.ts` - Top Adds projection API that needs stronger freshness ownership and stable merge expectations.
- `web/pages/api/v1/forge/goalies.ts` - Goalie API whose requested-date coverage and fallback truthfulness need repair.
- `web/pages/api/team-ratings.ts` - Team-ratings API used by Team Trend Context and team drill-ins.
- `web/pages/api/v1/trends/team-ctpi.ts` - CTPI API requiring freshness, pagination, and metadata integrity fixes.
- `web/pages/api/v1/sustainability/trends.ts` - Sustainability API requiring continuity and degraded-state safety fixes.
- `web/pages/api/v1/trends/skater-power.ts` - Trend-movement API requiring true source-recency metadata and stronger stale handling.
- `web/pages/api/v1/trends/player-trends.ts` - Trend writer/readback surface that currently lacks acceptable scheduled ownership.
- `web/pages/api/v1/transactions/ownership-trends.ts` - Yahoo ownership trend API needing stable-ID, coverage, and truncation fixes.
- `web/pages/api/v1/transactions/ownership-snapshots.ts` - Yahoo ownership snapshot API needing season-alignment fixes.
- `web/styles/vars.scss` - Variable source of truth for the dashboard styling completion pass.
- `web/pages/api/v1/db/update-team-ctpi-daily.ts` - Upstream team-context writer whose schedule order currently conflicts with source freshness.
- `web/pages/api/v1/db/update-team-power-ratings.ts` - Team-power writer requiring schedule-order and source-freshness repair.
- `web/pages/api/v1/db/update-team-power-ratings-new.ts` - Alternate team-power writer that must stay aligned with the main ratings chain.
- `web/pages/api/v1/db/update-goalie-projections-v2.ts` - Goalie-start projection writer whose schedule order is currently misaligned with the goalie pipeline.
- `web/pages/api/v1/db/update-start-chart-projections.ts` - Start Chart writer whose date semantics need to stay aligned with goalie freshness.
- `web/pages/api/v1/db/run-projection-v2.ts` - FORGE projection writer whose outputs feed Top Adds and the goalie band.
- `web/rules/cron-schedule.md` - Runbook and cron ownership surface that needs ordering and missing-owner fixes.
- `web/__tests__/pages/forge/dashboard.test.tsx` - Main page regression coverage that should absorb mixed-date, degraded-state, and ownership-overlay checks.
- `web/__tests__/pages/FORGE.test.tsx` - Landing-route coverage that should absorb preview consistency and CTA continuity checks.
- `web/__tests__/pages/forge/team/[teamId].test.tsx` - Team-route coverage that should absorb dashboard date continuity and stale CTPI checks.
- `web/__tests__/pages/forge/player/[playerId].test.tsx` - Player-route coverage that should absorb week-mode score and route-context checks.

### Notes

- This tracker is for repair and verification, not new feature expansion.
- New issues discovered while executing this tracker must be appended to `tasks/artifacts/forge-dashboard-component-health-remediation-backlog.md`.
- Quarantine removals should only happen after source evidence, route behavior, and rendered UI all reconcile.

## Tasks

- [ ] 1.0 Repair freshness integrity and mixed-cadence truthfulness across the dashboard route family
  - [ ] 1.1 Fix source-recency reporting for `/api/v1/trends/team-ctpi` and `/api/v1/trends/skater-power` so dashboard freshness does not rely on request-time timestamps.
  - [ ] 1.2 Add page-level mixed-date detection and warnings for `web/pages/forge/dashboard.tsx` and `web/pages/FORGE.tsx` when modules resolve to materially different source dates.
  - [ ] 1.3 Repair `l10` sustainability continuity and confirm `/api/v1/sustainability/trends` stops falling back across large mid-season gaps for current-date requests.
  - [ ] 1.4 Restore current requested-date goalie coverage for both Start Chart and FORGE goalie paths, then verify the slate and goalie bands stop relying on partial fallback dates.
  - [ ] 1.5 Re-run source-to-UI reconciliation for slate, sustainability, trend movement, and goalie surfaces after freshness repairs land.

- [ ] 2.0 Repair ownership integrity and Top Adds contract correctness
  - [ ] 2.1 Fix the projection-to-Yahoo merge contract so Top Adds and other player-discovery surfaces use stable IDs first and no longer rely on normalized-name fallback as the primary path.
  - [ ] 2.2 Remove ownership-source truncation and season-resolution mismatches in `/api/v1/transactions/ownership-trends.ts`, `/api/v1/transactions/ownership-snapshots.ts`, and `web/lib/dashboard/playerOwnership.ts`.
  - [ ] 2.3 Align dashboard ownership filters with Yahoo position semantics and ensure null ownership is treated as a degraded overlay state instead of silently filtering rows.
  - [ ] 2.4 Correct the Top Adds displayed scoring/labeling contract, including point-vs-percent labeling and week-mode consistency with the player-detail route.
  - [ ] 2.5 Re-run reconciliation for Top Adds, sustainability, and trend-movement ownership overlays after the fixes land.

- [ ] 3.0 Repair team-context and trend-source cron ownership
  - [ ] 3.1 Reorder team-context cron/runbook entries so NST and WGO team sources update before CTPI and team-power writers execute.
  - [ ] 3.2 Fix `/api/v1/trends/team-ctpi` pagination and freshness semantics so current rows are actually served for current dashboard dates.
  - [ ] 3.3 Repair team-power trend freshness so `/api/team-ratings` stops serving flat `trend10` values for all teams on current dates.
  - [ ] 3.4 Give `player_trend_metrics` an explicit scheduled owner and verify `/api/v1/trends/player-trends` and `/api/v1/trends/skater-power` are backed by current data.
  - [ ] 3.5 Re-run team-context and trend-movement reconciliation after the source and cron repairs land.

- [ ] 4.0 Repair degraded-state behavior and route continuity
  - [ ] 4.1 Add first-class degraded messaging for ownership-overlay failure, goalie coverage loss, and fallback-driven partial surfaces so “empty” and “stale” do not masquerade as each other.
  - [ ] 4.2 Preserve selected dashboard `date`, `mode`, and resolved fallback context across landing previews, panel CTAs, row-level links, team drill-ins, and player drill-ins.
  - [ ] 4.3 Fix team drill-in date continuity and stale-CTPI presentation so current ratings chips do not mask stale momentum data.
  - [ ] 4.4 Fix player drill-in week-mode score continuity so the destination matches the Top Adds contract that sent the user there.
  - [ ] 4.5 Re-run route-family reconciliation after continuity and degraded-state fixes land.

- [ ] 5.0 Expand observability, reconciliation automation, and runtime-budget coverage
  - [ ] 5.1 Add freshness-policy coverage in `web/lib/dashboard/freshness.ts` for FORGE players and Yahoo ownership endpoints.
  - [ ] 5.2 Add missing endpoint budgets in `web/lib/dashboard/perfBudget.ts` for `/api/v1/forge/players`, `/api/v1/transactions/ownership-trends`, and `/api/v1/transactions/ownership-snapshots`.
  - [ ] 5.3 Add automated checks for mixed effective dates versus rendered date labels across dashboard and landing routes.
  - [ ] 5.4 Add automated ownership-overlay verification that distinguishes healthy empties from null suppression, truncation, or merge failure.
  - [ ] 5.5 Add regression coverage for route continuity, resolved fallback context propagation, and goalie coverage-loss warnings.

- [ ] 6.0 Close the quarantine list and verify operational trust
  - [ ] 6.1 Re-audit each quarantined endpoint after its owning fixes land and remove only the endpoints that have current source evidence, correct route behavior, and truthful UI rendering.
  - [ ] 6.2 Rebuild the authoritative health matrix and confirm which components can finally move to `yellow` or `green`.
  - [ ] 6.3 Run the full verification suite, including `npm test -- --run`, `npx tsc --noEmit --pretty false`, and `npm run build`, and capture any new failures or warnings into the rolling remediation backlog.
  - [ ] 6.4 Update the runbook and cron schedule documentation to reflect the repaired ownership chains and runtime-budget expectations.
  - [ ] 6.5 Produce a closeout artifact summarizing what moved out of quarantine, what remains blocked, and what new optimization work should follow the trust-repair phase.

- [x] 7.0 Execute the fourth-pass living audit, remediation expansion, output vetting, and styling completion workflow
  - [x] 7.1 Complete the required early `web/pages/skoCharts.tsx` lineage review, recording which legacy concepts should be adopted for FORGE explainability and which legacy formulas/runtime assumptions should be explicitly retired.
  - [x] 7.2 Repair dashboard route continuity end-to-end so `ForgeRouteNav`, dashboard back-links, and player/team drill-ins preserve selected `date`, `mode`, and resolved fallback context instead of resetting users onto generic routes.
  - [x] 7.3 Resolve dashboard drill-in contract drift by deciding whether movement cards should stay inside the FORGE route family, and either route `HotColdCard` into FORGE detail context or explicitly document and style the cross-route handoff.
  - [x] 7.4 Re-audit displayed dashboard scoring contracts, including `computeTeamPowerScore` naming/weights and the duplicated ownership-band controls between the dashboard shell and `TopAddsRail`, then fix or rename any composite that overstates what its inputs actually contain.
  - [x] 7.5 Finish the page-level and component-level styling pass for `web/pages/forge/dashboard.tsx` and the individual dashboard modules using `fhfh-styles.md` plus `web/styles/vars.scss`, with special attention to rail density, spacing, hierarchy, overflow, and degraded/loading state polish.
  - [x] 7.6 Smoke-test the live FORGE/dashboard endpoint family under the stated runtime and rate-limit rules, capture any stale-table blockers that require manual catch-up, and append optimization work for any scenario that misses the `4m30s` target.
  - [x] 7.7 Perform output vetting and Chromium visual inspection for each dashboard band, append any newly discovered component/output issues, and make an explicit integrate-or-retire decision for stale dashboard surfaces such as `web/components/forge-dashboard/TopMoversCard.tsx`.
  - [x] 7.8 Repair the FORGE page-test module-resolution blocker so the route-family Vitest suites can execute again instead of failing before collection on `lib/dashboard/*` imports.
  - [x] 7.9 Teach the Trends player detail route to understand forwarded FORGE context (`date`, origin, and return path) so cross-route handoffs preserve operator context instead of becoming one-way jumps.
