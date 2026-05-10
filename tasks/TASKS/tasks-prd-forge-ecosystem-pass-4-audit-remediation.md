## Relevant Files

- `tasks/prd-forge-ecosystem-pass-4-audit-remediation.md` - Standalone pass-4 PRD defining the new audit and execution workstream.
- `tasks/tasks-prd-forge-ecosystem-pass-4-audit-remediation.md` - Standalone pass-4 task list and the only active execution list for this run.
- `web/pages/forge/dashboard.tsx` - Main FORGE dashboard page that requires renewed correctness, layout, and styling review.
- `web/pages/skoCharts.tsx` - Legacy inspiration surface to evaluate for salvage, adaptation, or retirement.
- `web/pages/FORGE.tsx` - FORGE landing/preview surface that shares styling, fetch patterns, and route continuity with the dashboard.
- `web/pages/forge/team/[teamId].tsx` - Team drill-in route in the FORGE route family that shares dashboard context and endpoint dependencies.
- `web/pages/forge/player/[playerId].tsx` - Player drill-in route in the FORGE route family that shares dashboard context and projection dependencies.
- `web/components/forge-dashboard/SlateStripCard.tsx` - Main slate hero card for the dashboard, audited for summary truthfulness, date drift, and panel-level presentation quality.
- `web/components/forge-dashboard/TopAddsRail.tsx` - Ownership-aware opportunity rail audited for candidate-universe truncation, control styling, and degraded-state handling.
- `web/components/forge-dashboard/TeamPowerCard.tsx` - Team context panel audited for blended-recency semantics, CTPI/slate warning visibility, and responsive layout behavior.
- `web/components/forge-dashboard/SustainabilityCard.tsx` - Sustainability insight panel audited for ownership-filter suppression behavior, output trust, and card-level styling polish.
- `web/components/forge-dashboard/HotColdCard.tsx` - Player movement panel audited for selected-date truthfulness, ownership degradation behavior, and component styling polish.
- `web/components/forge-dashboard/GoalieRiskCard.tsx` - Goalie risk module in the live dashboard family that shares panel styling and recency/status semantics with the rest of FORGE.
- `web/components/forge-dashboard/TopMoversCard.tsx` - Adjacent dashboard-style movement card audited for shared panel-state styling consistency and possible stale chrome drift.
- `web/components/forge-dashboard/ForgeRouteNav.tsx` - Shared dashboard navigation surface that participates in the FORGE page chrome and command-surface styling.
- `web/styles/ForgeDashboard.module.scss` - Main page-level and component-level style surface for the FORGE dashboard family.
- `web/styles/_panel.scss` - Shared glass-panel and panel-title mixin surface that underpins FORGE container styling and needs to stay aligned with the dashboard blueprint.
- `web/lib/supabase/utils/statistics.ts` - Legacy sKO characteristic-scoring and threshold logic audited for soundness, naming, and possible explainability reuse.
- `web/lib/supabase/utils/calculations.ts` - Legacy sKO game-score formula surface audited for weighting assumptions and reuse risk.
- `web/lib/supabase/utils/dataFetching.ts` - Legacy client-side sKO data-fetch path audited for stale table dependencies and fragile join assumptions.
- `web/lib/supabase/utils/constants.ts` - Legacy sKO rated-stat field and weight definitions audited for metric-selection and weighting assumptions.
- `web/lib/supabase/utils/types.ts` - Legacy sKO type contracts audited to understand combined game-log assumptions and downstream coupling.
- `web/lib/projections/run-forge-projections.ts` - Primary FORGE projection orchestration surface.
- `web/lib/projections/queries/skater-queries.ts` - Key skater query source for projection and dashboard inputs.
- `web/lib/projections/compatibilityInventory.ts` - Reader compatibility metadata used by FORGE-serving endpoints.
- `web/lib/projections/utils/trend-adjustments.ts` - Pure trend-band selection and recency-decay helper added in pass 4 to make projection trend adjustments testable and less stale-priority biased.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - Rolling input fetch/upsert logic feeding downstream FORGE calculations.
- `web/pages/api/v1/db/update-rolling-player-averages.ts` - Rolling player averages refresh route tied to operational validation.
- `web/pages/api/v1/db/run-projection-v2.ts` - Canonical FORGE projection runner route feeding player and goalie surfaces.
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - Derived projection build stage whose outputs feed FORGE readers.
- `web/pages/api/v1/db/ingest-projection-inputs.ts` - Projection input ingest stage in the upstream FORGE pipeline.
- `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` - End-to-end pipeline coordinator that documents and triggers FORGE stage order.
- `web/pages/api/v1/db/update-goalie-projections-v2.ts` - Canonical goalie projection writer feeding goalie-facing FORGE surfaces.
- `web/pages/api/v1/db/update-team-power-ratings.ts` - Team power writer feeding dashboard team-context surfaces.
- `web/pages/api/v1/db/update-team-ctpi-daily.ts` - CTPI writer feeding team-context and start-chart context surfaces.
- `web/pages/api/v1/db/update-power-play-combinations/index.ts` - Upstream contextual builder affecting slate and downstream rolling context.
- `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts` - Per-game contextual builder used by batch repair surfaces.
- `web/pages/api/v1/db/update-line-combinations/index.ts` - Upstream line-combination builder affecting contextual source freshness.
- `web/pages/api/v1/db/update-line-combinations/[id].ts` - Per-game line-combination builder in the FORGE dependency chain.
- `web/pages/api/v1/db/` - Endpoint family for FORGE-adjacent refresh, recompute, and repair routes.
- `web/pages/api/v1/forge/` - Endpoint family serving or supporting FORGE dashboard data.
- `web/pages/api/v1/start-chart.ts` - Slate-serving API used directly by the dashboard and related drill-in surfaces.
- `web/pages/api/team-ratings.ts` - Team power API used by dashboard and team drill-in surfaces.
- `web/pages/api/v1/trends/team-ctpi.ts` - Team CTPI trend API used by team context and team drill-in surfaces.
- `web/pages/api/v1/trends/skater-power.ts` - Skater trend API used by Hot/Cold and related movement surfaces.
- `web/pages/api/v1/sustainability/trends.ts` - Sustainability-serving API used by the dashboard sustainability module.
- `web/pages/api/v1/transactions/ownership-trends.ts` - Ownership trend API used by Top Adds and ownership overlay surfaces.
- `web/pages/api/v1/transactions/ownership-snapshots.ts` - Ownership snapshot API used by overlay and reconciliation surfaces.
- `web/pages/api/v1/projections/_helpers.ts` - Shared projection route helper used by FORGE player/goalie/start-chart readers.
- `web/lib/dashboard/clientFetchCache.ts` - Shared client fetch cache used by dashboard components and route-family pages.
- `web/lib/dashboard/forgeLinks.ts` - Shared route-context builder/parser for preserving date, position, origin, and return paths.
- `web/lib/dashboard/normalizers.ts` - Shared normalization layer for dashboard API payloads.
- `web/lib/dashboard/freshness.ts` - Shared freshness, fallback, and stale-state interpretation layer for dashboard surfaces.
- `web/lib/dashboard/teamContext.ts` - Shared team-context scoring and matchup-edge helper layer.
- `web/lib/dashboard/teamMetadata.ts` - Team metadata mapping helper used across slate and team-context surfaces.
- `web/lib/dashboard/playerOwnership.ts` - Ownership overlay helper used by Top Adds, sustainability, and trend-movement surfaces.
- `web/lib/dashboard/topAddsRanking.ts` - Top Adds ranking helper used to order player opportunity results.
- `web/lib/dashboard/topAddsScheduleContext.ts` - Schedule-context helper used by Top Adds opportunity presentation.
- `web/lib/dashboard/playerInsightContext.ts` - Shared player insight context helper supporting FORGE card and route interpretation.
- `web/lib/dashboard/reliability.ts` - Shared dashboard reliability heuristics surfaced by certain components.
- `web/lib/dashboard/dataFetchers.ts` - Shared dashboard data orchestration layer that appears to overlap with component-local fetch logic and needs pass-4 review.
- `web/lib/dashboard/perfBudget.ts` - Endpoint budget policy for dashboard-serving APIs.
- `web/lib/teamRatingsService.ts` - Team ratings service used by `/api/team-ratings` and start-chart team context.
- `web/lib/trends/ctpi.ts` - CTPI computation helper used by the team-CTPI API.
- `web/lib/trends/skaterMetricConfig.ts` - Skater trend-category configuration used by the movement API.
- `web/lib/api/scanSummary.ts` - Endpoint scan summary helper used by FORGE readers.
- `web/lib/teamsInfo.ts` - Shared team metadata source used by FORGE pages and APIs.
- `fhfh-styles.md` - Repository styling blueprint that informs dashboard polish decisions if no dedicated `styles/fhfh-styles.md` exists.
- `web/styles/vars.scss` - Shared variable source of truth if this is the active SCSS variable surface.
- `web/__tests__/pages/forge/dashboard.test.tsx` - Main dashboard render-state and interaction regression coverage.
- `web/__tests__/pages/FORGE.test.tsx` - Landing-page regression coverage for preview behavior and continuity.
- `web/__tests__/pages/forge/team/[teamId].test.tsx` - Team drill-in regression coverage.
- `web/__tests__/pages/forge/player/[playerId].test.tsx` - Player drill-in regression coverage.
- `web/__tests__/pages/api/v1/forge/players.test.ts` - FORGE player API regression coverage.
- `web/__tests__/pages/api/v1/forge/goalies.test.ts` - FORGE goalie API regression coverage.
- `web/lib/dashboard/normalizers.test.ts` - Dashboard normalizer regression coverage.
- `web/lib/dashboard/freshness.test.ts` - Dashboard freshness regression coverage.
- `web/lib/dashboard/teamContext.test.ts` - Team-context helper regression coverage.
- `web/lib/dashboard/playerOwnership.test.ts` - Ownership helper regression coverage.
- `web/lib/dashboard/topAddsScheduleContext.test.ts` - Schedule-context helper regression coverage.
- `web/lib/dashboard/topAddsRanking.test.ts` - Top Adds ranking helper regression coverage.
- `web/lib/projections/utils/trend-adjustments.test.ts` - Focused regression coverage for trend-band row selection and hard-stale neutralization behavior.

### Notes

- This file is the only active execution task list for pass 4.
- Newly discovered bugs, blockers, open questions, legacy reuse opportunities, styling gaps, and optimization work must be appended to the end of this file as new tasks or sub-tasks.
- Manual environment steps, endpoint runs requiring user action, or time-sensitive refreshes must require the exact confirmation `Done, proceed`.
- Pass 4 is correctness-first; styling and visual polish are required, but calculation integrity, endpoint operability, and output trust take priority.
- NST-dependent catch-up, freshness work, and smoke tests currently blocked by Cloudflare validation must be treated as explicit external dependency blockers unless contrary evidence appears.
- Visual inspection scope for this pass is the local dev page plus directly relevant API responses.
- Output vetting must flag results that are directionally questionable, under-reactive, unintuitive, edge-case-sensitive, or misaligned with hockey reality even when the code path appears internally consistent.

## Tasks

- [x] 1.0 Initialize the standalone pass-4 workstream and anchor execution to the new PRD and task list
  - [x] 1.1 Confirm the new pass-4 PRD and new pass-4 task list are the only active planning and execution artifacts for this run, with prior pass artifacts treated as reference-only inputs.
  - [x] 1.2 Review relevant prior FORGE PRDs, task lists, and audit artifacts for carry-forward context without auto-resuming any unfinished work in place.
  - [x] 1.3 Establish the initial pass-4 operating constraints, including correctness-first prioritization, NST external-blocker handling, local-dev visual inspection scope, and output-vetting expectations.
- [x] 2.0 Review `web/pages/skoCharts.tsx` as an early legacy inspiration surface and convert reuse or retirement findings into pass-4 tasks
  - [x] 2.1 Audit `web/pages/skoCharts.tsx` calculations, transformations, assumptions, and incomplete logic for current soundness and downstream relevance.
  - [x] 2.2 Evaluate `web/pages/skoCharts.tsx` for salvageable data views, ranking patterns, filters, presentation concepts, or debug affordances worth porting or adapting into FORGE.
  - [x] 2.3 Append explicit pass-4 tasks for each meaningful `skoCharts.tsx` adoption, adaptation, reference-only, ignore, or retirement decision.
- [x] 3.0 Audit the full FORGE ecosystem from upstream inputs through dashboard rendering, challenging formulas, dependencies, and assumptions file-by-file
  - [x] 3.1 Build the pass-4 FORGE file inventory by tracing imports and dependencies across dashboard pages, components, calculations, queries, upserts, routes, helpers, styling surfaces, and relevant tests.
  - [x] 3.2 Audit upstream rolling, projection, query, and derived-metric files for formula integrity, fallback behavior, edge cases, observability, and rate-limit safety.
  - [x] 3.3 Audit page-level assembly and dashboard component files, including `web/pages/forge/dashboard.tsx`, for data wiring, state handling, UX clarity, and correctness risks.
  - [x] 3.4 Audit styling and shared design-system surfaces affecting the FORGE dashboard, including the active style blueprint and variable source-of-truth files.
- [x] 4.0 Expand the pass-4 task list continuously with newly discovered bugs, blockers, optimizations, styling defects, and output-vetting follow-ups
  - [x] 4.1 Append every meaningful audit finding to the end of this task list as a new task or sub-task instead of leaving it only in prose.
  - [x] 4.2 Keep the Relevant Files section current as pass-4 touches or discovers additional FORGE surfaces.
  - [x] 4.3 Mark blockers explicitly when discovered, including externally blocked NST-dependent catch-up, smoke-test, or freshness work.
- [x] 5.0 Execute remediation work across FORGE calculations, data assembly, dashboard components, and page-level implementation
  - [x] 5.1 Implement high-priority correctness and maintainability fixes across FORGE calculations, selectors, serializers, or assembly helpers discovered during the audit.
  - [x] 5.2 Implement dashboard page and component fixes required to resolve data, rendering, state, or UX defects discovered during the audit.
  - [x] 5.3 Integrate or retire worthwhile `skoCharts.tsx` legacy ideas where pass-4 review shows they materially improve FORGE or reduce confusion.
- [x] 6.0 Perform smoke-test and performance validation for relevant FORGE endpoints within the defined external-blocker and rate-limit constraints
  - [x] 6.1 Identify which FORGE-adjacent endpoints can be meaningfully smoke tested in this pass without requiring NST-blocked catch-up work.
  - [x] 6.2 Run permitted endpoint smoke tests and record runtime, operability, and output behavior against the intended 4m30s threshold where applicable.
  - [x] 6.3 Append and document any blocked, slow, or optimization-worthy endpoint findings, clearly separating NST external dependency blockers from internal failures.
- [x] 7.0 Vet dashboard outputs component-by-component for both code-path correctness and hockey-facing plausibility
  - [x] 7.1 Trace each relevant dashboard component output back to its source inputs and transformation path after remediation and smoke testing.
  - [x] 7.2 Flag outputs that appear directionally questionable, under-reactive, unintuitive, edge-case-sensitive, or misaligned with hockey reality, then append corrective follow-up tasks.
  - [x] 7.3 Prepare a compact set of outputs requiring user expectation confirmation if component results remain ambiguous after code and data-path review.
- [x] 8.0 Complete the styling and visual inspection pass for `web/pages/forge/dashboard.tsx` and its individual components
  - [x] 8.1 Complete the page-level styling review and remediation for `web/pages/forge/dashboard.tsx` using the established style blueprint and variables.
  - [x] 8.2 Complete component-level styling review and remediation across the individual FORGE dashboard panels, cards, charts, tables, and state wrappers.
  - [x] 8.3 Run browser-based visual inspection on the local dev page plus directly relevant API responses, then append and address any remaining visual defects discovered.

- [x] 9.0 Triage the legacy sKO calculation stack for safe reuse, containment, or retirement based on the pass-4 lineage review
  - [x] 9.1 Decide whether `web/pages/skoCharts.tsx` should remain a developer-only legacy surface, be formally quarantined, or be retired, because it still depends on direct client-side Supabase reads from legacy `sko_*` tables and is not part of the live FORGE runtime.
  - [x] 9.2 If any sKO characteristic logic is reused for FORGE explainability, re-derive the metric with consistent PA-to-SA ratio handling, explicit sample-size guards, and honest naming instead of treating weighted z-score magnitude as “CV”.
  - [x] 9.3 If any stability-adjusted game-score concept is reused, redesign the confidence adjustment so negative games are not artificially improved by the multiplier and exact-date WGO/SKO join gaps cannot silently distort the signal.

- [x] 10.0 Adapt the useful `skoCharts` interaction concepts into FORGE-safe audit and explainability surfaces where justified
  - [x] 10.1 Evaluate whether FORGE should gain a player-level diagnostic detail view that charts a selected component signal over time with honest thresholds and source-date context.
  - [x] 10.2 Evaluate whether selected FORGE components should expose an “actual vs adjusted” or “raw vs normalized” comparison affordance so output vetting is easier during audits and operator review.
  - [x] 10.3 Evaluate whether FORGE should add a compact inspector table or debug drawer for key component inputs, transformations, and freshness metadata to support output vetting without relying on legacy sKO UI code.

- [x] 11.0 Reconcile overlapping FORGE dashboard data-assembly surfaces discovered during the pass-4 inventory
  - [x] 11.1 Audit whether `web/lib/dashboard/dataFetchers.ts` is still a live dashboard dependency or a stale parallel fetch layer now bypassed by component-local `fetchCachedJson` calls.
  - [x] 11.2 If the overlapping fetch orchestration is stale or drifted, consolidate, retire, or clearly isolate it so dashboard API contracts and freshness logic do not diverge across duplicate client data paths.

- [x] 12.0 Re-audit projection trend-band adjustment selection so stale or low-quality signals do not outrank fresher evidence by priority alone
  - [x] 12.1 Review `fetchLatestSkaterTrendAdjustments` in `web/lib/projections/queries/skater-queries.ts` and decide whether metric/window priority should dominate recency when multiple trend-band rows exist for a player.
  - [x] 12.2 If stale trend-band rows can still materially move projections, redesign the chooser and confidence decay so very old signals decay toward neutral instead of continuing to apply bounded multipliers with only a soft confidence discount.
  - [x] 12.3 Add projection-run observability for missing or errored trend-band loads, because the current `console.warn` + empty-map fallback can silently remove the adjustment layer without a first-class run-quality signal.

- [x] 13.0 Re-audit projection fallback truthfulness when line combinations are missing, empty, or hard stale
  - [x] 13.1 Review the fallback path in `web/lib/projections/run-forge-projections.ts` that swaps hard-stale or missing line combinations for ranked fallback skater pools, and decide whether current outputs remain trustworthy enough to serve as normal projections.
  - [x] 13.2 If fallback projections remain user-visible, propagate stronger degraded-state metadata to downstream readers and dashboard components so TOI-ranked emergency pools do not masquerade as normal line-driven context.
  - [x] 13.3 Re-validate whether the current stale thresholds and fallback-recovery rules in `web/lib/projections/constants/projection-weights.ts` are still hockey-sound for current FORGE usage, especially the soft/hard stale day cutoffs and minimum valid skater-pool assumptions.

- [x] 14.0 Re-audit rolling recompute execution defaults against pass-4 operational expectations
  - [x] 14.1 Review whether the implicit 14-day `daily_incremental` window in `web/pages/api/v1/db/update-rolling-player-averages.ts` is still the right default for operator intent and smoke-test validation, or whether it obscures true one-day operational behavior.
  - [x] 14.2 Review whether `bypassFreshnessBlockers=true` needs stricter downstream signaling or audit logging so blocked upstream freshness states cannot be mistaken for healthy recompute success.

- [x] 15.0 Repair dashboard page and component data-contract drift discovered during the pass-4 assembly audit
  - [x] 15.1 Fix `HotColdCard` so the rendered signal honestly reflects the selected dashboard date, or explicitly relabel and isolate it as a current-only feed instead of a date-aware dashboard module.
  - [x] 15.2 Fix `TopAddsRail` so the candidate universe is not silently truncated to the ownership-trends riser/faller response limit before ranking, and so missing ownership rows do not quietly erase otherwise valid projection candidates without degraded-state signaling.
  - [x] 15.3 Strengthen page-level drift detection so `web/pages/forge/dashboard.tsx` can surface stale or fallback context for every materially date-sensitive module, including Top Adds and movement surfaces, rather than only the current subset of resolved-date callbacks.
  - [x] 15.4 Rework `TeamPowerCard` stale and warning semantics so CTPI freshness and slate-context recency cannot be masked behind a single team-ratings resolved date.
  - [x] 15.5 Rework ownership-overlay filtering in `SustainabilityCard` and `HotColdCard` so partial null ownership coverage is shown as degraded context rather than silently suppressing players from the insight cards.
  - [x] 15.6 Fix `SlateStripCard` summary truthfulness so the displayed game count and slate framing do not imply the full slate is shown when the card is slicing to a smaller visible subset.

- [x] 16.0 Repair dashboard styling-system drift and responsive layout defects uncovered during the pass-4 styling audit
  - [x] 16.1 Remove or reconcile stale layout classes in `web/styles/ForgeDashboard.module.scss`, including unused pre-band surfaces such as `dashboardGrid` and `slateRailPanel`, so the active dashboard style surface reflects the current page architecture instead of preserving dead styling branches.
  - [x] 16.2 Fix the contradictory small-screen override for `teamContextSpotlightGrid` in `web/styles/ForgeDashboard.module.scss`, because the mobile rules first collapse the grid to one column and then later re-expand it to two columns inside the same breakpoint block.
  - [x] 16.3 Bring FORGE control-state styling back in line with `fhfh-styles.md` for compact dashboard actions, especially the active `TopAddsRail` mode toggle and related segmented controls that still read weaker than the repo’s canonical highlighted dashboard button treatment.
  - [x] 16.4 Consolidate duplicate and legacy drift-prone tokens in `web/styles/vars.scss`, because the active FORGE style surface depends on that file while it still contains overlapping aliases and repeated chart token definitions that can reintroduce styling inconsistency during pass-4 completion.

- [x] 17.0 Track the external NST / Cloudflare dependency blocker separately from internal FORGE defects during pass 4
  - [x] 17.1 Record which FORGE freshness, catch-up, and smoke-test paths remain blocked because Natural Stat Trick access is currently failing Cloudflare validation, so later validation does not misclassify those gaps as internal correctness regressions.
  - [x] 17.2 During the smoke-test phase, distinguish endpoints that can still be exercised locally from endpoints whose meaningful validation remains blocked by the NST dependency, and carry that status through the final pass-4 report.

- [x] 18.0 Distinguish neutralized trend-band rows from actively applied trend modifiers in projection output metadata
  - [x] 18.1 Update projection-run player metadata so a row whose trend-band signal was selected but fully neutralized by recency decay does not read the same as an actively applied trend modifier during output vetting or downstream debugging.

- [x] 19.0 Make FORGE recompute smoke tests more deterministic when endpoint defaults still expand beyond one-day validation intent
  - [x] 19.1 Add or document an explicit bounded smoke-test mode for `web/pages/api/v1/db/update-team-power-ratings.ts`, because an empty `team_power_ratings_daily` table currently causes the route to backfill from season start instead of behaving like a one-day operational probe.

- [x] 20.0 Tighten reader freshness truthfulness where pass-4 smoke tests still exposed stale fallback behavior on live FORGE-facing routes
  - [x] 20.1 Rework `web/pages/api/v1/trends/skater-power.ts` so a request for a recent dashboard date cannot silently resolve to an extremely old scope date like `2025-10-16` without a stronger degraded or blocked contract.
  - [x] 20.2 Re-audit `web/pages/api/v1/start-chart.ts` and `web/pages/api/v1/forge/goalies.ts` fallback behavior when requested dates still have scheduled games but the readers resolve to older goalie/start-chart data, so stale priors do not masquerade as same-day readiness.
  - [ ] 20.3 Either populate or explicitly retire the missing goalie uncertainty metadata surfaced during smoke tests, because `/api/v1/forge/goalies` currently reports missing model-version and starter-scenario-count notes in its scan summary.
  - [x] 20.4 Revisit sustainability reader truthfulness when `/api/v1/sustainability/trends` serves a months-old snapshot for a newer request date, so the dashboard can distinguish “latest available but badly stale” from normal fallback.

- [ ] 21.0 Repair output-level plausibility defects surfaced during the component vetting pass
  - [x] 21.1 Fix `web/pages/api/v1/sustainability/trends.ts` and its scoring inputs so impossible-looking outputs like `s_100 = 0` with `luck_pressure` above `25000` or `63000` cannot reach the dashboard without sample-size guards, clipping, or hard invalidation.
  - [ ] 21.2 Re-audit `web/pages/api/v1/trends/skater-power.ts` percentile and delta math for tiny-game samples, because pass-4 smoke data showed three-to-six game rows producing `100` percentile plus triple-digit deltas, which reads as edge-case-sensitive and hockey-misleading even before the stale-date issue.
  - [ ] 21.3 Rework goalie fallback presentation so rows with blanket `0.50` starter probabilities and null recommendation/confidence fields do not surface as ordinary lead-card decisions in `GoalieRiskCard`.
  - [ ] 21.4 Add stronger mixed-recency invalidation or downgrade rules to `web/components/forge-dashboard/TeamPowerCard.tsx`, because current output composition can blend team ratings from `2026-02-07`, start-chart matchup context from `2026-02-05`, and CTPI generated on `2026-03-29` into one visible ranking surface.

- [ ] 22.0 Retire or isolate the remaining orphaned legacy sKO chart artifacts that survived the route quarantine
  - [ ] 22.1 Decide whether `web/components/GameScoreChart/GameScoreChart.tsx` and `web/components/GameScoreChart/GameLogTable.tsx` should be deleted, moved under a legacy namespace, or explicitly documented as quarantine-only artifacts now that `web/pages/skoCharts.tsx` no longer renders the old runtime.
  - [ ] 22.2 Decide whether the legacy `CombinedGameLog` / `fetchGameLogs` path under `web/lib/supabase/utils/` should be further narrowed, renamed, or moved so future FORGE work cannot mistake it for an approved shared data contract.

- [ ] 23.0 Strengthen the FORGE-to-Trends diagnostic handoff instead of creating a duplicate player-diagnostic route
  - [ ] 23.1 Add query-driven metric-group and metric-selection handoff support to `web/pages/trends/player/[playerId].tsx` so FORGE cards can open the player diagnostic page with the relevant signal family already focused.
  - [ ] 23.2 Update FORGE drill-in links from surfaces like `HotColdCard` and `SustainabilityCard` so they pass honest source context, date context, and the most relevant diagnostic metric family when sending a user into the Trends player page.
