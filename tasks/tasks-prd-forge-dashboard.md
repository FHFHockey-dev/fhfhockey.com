## Relevant Files

- `web/pages/forge/dashboard.tsx` - New Forge Dashboard route and page-level composition.
- `web/pages/FORGE.tsx` - Existing Forge page kept active during migration and linked as legacy page.
- `web/pages/__snapshots__/FORGE.test.tsx.snap` - Updated snapshot after adding new dashboard navigation link in legacy Forge page.
- `web/styles/ForgeDashboard.module.scss` - New no-scroll desktop grid and responsive mobile stacking styles.
- `web/styles/vars.scss` - Shared design tokens (colors, typography, spacing, breakpoints) required for dashboard styling consistency.
- `web/styles/_panel.scss` - Shared panel mixins/patterns required for dashboard panel surfaces.
- `fhfh-styles.md` - Canonical FHFH design language guidance for Neon Noir visual and interaction rules.
- `web/lib/dashboard/dataFetchers.ts` - Shared dashboard data loader, endpoint calls, and request caching/dedupe.
- `web/lib/dashboard/clientFetchCache.ts` - Lightweight client-side cache and in-flight dedupe for identical dashboard fetch params.
- `web/lib/dashboard/normalizers.ts` - Response normalization helpers for null safety and contract consistency across dashboard modules.
- `web/hooks/useDashboardData.ts` - React hook managing dashboard data loading/error states.
- `web/components/TopMovers/TopMovers.tsx` - Existing movers component reused in dashboard modules.
- `web/components/forge-dashboard/TeamPowerCard.tsx` - Team power rankings module.
- `web/components/forge-dashboard/SustainabilityCard.tsx` - Sustainable vs unsustainable player module.
- `web/components/forge-dashboard/HotColdCard.tsx` - Hot/cold streak module with reason strings.
- `web/components/forge-dashboard/GoalieRiskCard.tsx` - Goalie starts, win/shutout, volatility/risk module.
- `web/components/forge-dashboard/SlateStripCard.tsx` - Start-chart game slate strip module.
- `web/components/forge-dashboard/TopMoversCard.tsx` - Team/skater movers module using shared TopMovers with lens toggle.
- `web/pages/api/team-ratings.ts` - Team ratings API used by team power module.
- `web/lib/teamRatingsService.ts` - Team rating table access and fallback handling.
- `web/pages/api/v1/trends/team-power.ts` - Team trend source for hot/cold and movers context.
- `web/pages/api/v1/trends/skater-power.ts` - Skater trend source for movers/hot-cold.
- `web/pages/api/v1/sustainability/trend-bands.ts` - Sustainability trend-band source for regression/sustainability module.
- `web/pages/api/v1/start-chart.ts` - Start-chart slate/projection source.
- `web/pages/api/v1/forge/goalies.ts` - Goalie projection/risk source used by Forge page and dashboard module.
- `web/pages/api/v1/projections/goalies.ts` - Alternate goalie endpoint to audit and align/retire as needed.
- `web/pages/api/v1/forge/accuracy.ts` - Model accuracy source for optional confidence context.
- `web/tests/api/dashboard-endpoints.test.ts` - Automated endpoint contract, invariant, and fallback tests.
- `web/tests/audit/dashboard-data-audit.spec.ts` - Data-quality audit checks (accuracy/freshness/consistency).
- `web/lib/dashboard/freshness.ts` - Freshness policy and recency evaluator for dashboard feed timestamps.
- `web/lib/dashboard/perfBudget.ts` - Endpoint payload/performance budget definitions and budget evaluation helpers.
- `web/lib/dashboard/reliability.ts` - Reliability evaluators for fallback integrity and degraded runtime state checks.
- `web/tests/audit/dashboard-freshness-audit.spec.ts` - Freshness/automation recency tests for dashboard sources.
- `web/tests/audit/dashboard-performance-audit.spec.ts` - Optimization tests for payload budget checks and ordering.
- `web/tests/audit/dashboard-reliability-audit.spec.ts` - Reliability tests for fallback correctness and module state coherence.
- `web/tests/pages/forge-dashboard.test.tsx` - Dashboard UI tests for loading/empty/error/interactive states.
- `tasks/artifacts/forge-dashboard-dependency-matrix.md` - Component-to-endpoint-to-Supabase dependency matrix for module audit traceability.
- `tasks/artifacts/forge-dashboard-freshness-policy.md` - Endpoint cadence and max-age policy used for freshness audit.
- `tasks/artifacts/forge-dashboard-optimization-audit.md` - Query scope, payload pressure, and expensive-path optimization assessment.
- `tasks/artifacts/forge-dashboard-reliability-audit.md` - Fallback/degraded-state reliability audit and operational guidance.
- `tasks/artifacts/forge-dashboard-audit-outcomes.md` - Consolidated audit results and remediation checklist before launch sign-off.
- `tasks/prd-forge-dashboard.md` - Source PRD used to derive implementation and audit tasks.

### Notes

- Unit tests should typically be placed alongside code files they validate where practical.
- Use `npx jest [optional/path/to/test/file]` to run tests; omit path to run all tests.
- Keep naming free of "v2" or "2.0" in routes, components, and labels.
- Dashboard styling must use `vars.scss` tokens and avoid ad-hoc hard-coded values for color/spacing where token equivalents exist.
- Dashboard panel containers should use shared `styles/panel` mixins for visual consistency.

## Tasks

- [x] 1.0 Build the Forge Dashboard route and layout foundation
  - [x] 1.1 Create `web/pages/forge/dashboard.tsx` with page shell, head metadata, and top-level dashboard container.
  - [x] 1.2 Implement desktop no-scroll layout constraints that satisfy `1440x900+` requirement.
  - [x] 1.3 Implement responsive mobile/tablet layout behavior (`mobile-also`) with stacked modules and touch-safe controls.
  - [x] 1.4 Add shared dashboard state scaffolding for selected date and global filters.
  - [x] 1.5 Add navigation/linking path between legacy `FORGE.tsx` and new `forge/dashboard` route.

- [x] 2.0 Implement MVP dashboard modules and shared filter/state wiring
  - [x] 2.1 Build Team Power Rankings card using existing team power logic and trend indicators.
  - [x] 2.2 Build Sustainable vs Unsustainable players card using trend-band outputs and confidence context.
  - [x] 2.3 Build Hot/Cold streaks card with concise reason text and compact sparkline presentation.
  - [x] 2.4 Build Goalie Start + Risk card including starter %, win %, shutout %, volatility, and blowup risk.
  - [x] 2.5 Build Start-Chart Slate Strip card with matchup context and goalie bars.
  - [x] 2.6 Integrate Top Movers card(s) for at least one team and one skater lens.
  - [x] 2.7 Ensure all modules consume shared filters consistently and update without full-page reload.
  - [x] 2.8 Implement loading, empty, stale-data, and error states for each module.

- [x] 3.0 Integrate and normalize dashboard data dependencies across endpoints
  - [x] 3.1 Extend/adjust `web/lib/dashboard/dataFetchers.ts` to cover all MVP module payloads in one orchestrated loader.
  - [x] 3.2 Verify and normalize response contracts used by modules (field names, null handling, numeric parsing).
  - [x] 3.3 Resolve goalie endpoint duplication risk by defining a single canonical source for dashboard goalie data.
  - [x] 3.4 Add module-level `generatedAt`/`asOfDate` timestamp handling and display rules.
  - [x] 3.5 Implement guardrails for cross-endpoint date drift (requested date vs resolved fallback date).
  - [x] 3.6 Add lightweight client caching and dedupe to prevent duplicate fetches for identical params.

- [x] 4.0 Execute full data audit (accuracy, automation, optimization, reliability) for all modules
  - [x] 4.1 Create module-by-module dependency matrix (component -> endpoint -> Supabase table).
  - [x] 4.2 Validate endpoint accuracy with invariant checks (ranges, monotonic fields, probability bounds, required keys).
  - [x] 4.3 Validate freshness/automation by confirming update cadence and timestamp recency expectations per endpoint.
  - [x] 4.4 Validate optimization by reviewing query scope, payload size, and expensive path frequency.
  - [x] 4.5 Validate reliability through fallback behavior checks, partial failure handling, and degraded UI states.
  - [x] 4.6 Document audit outcomes and required remediations before launch sign-off.

- [ ] 5.0 Add automated endpoint validation tests and dashboard UI state tests
  - [ ] 5.1 Implement endpoint contract tests for: `/api/team-ratings`, `/api/v1/trends/team-power`, `/api/v1/trends/skater-power`, `/api/v1/sustainability/trend-bands`, `/api/v1/start-chart`, `/api/v1/forge/goalies`.
  - [ ] 5.2 Add tests for invalid query params and expected `4xx` behavior on all relevant endpoints.
  - [ ] 5.3 Add invariant tests for probability bounds, required fields, and stable type shape.
  - [ ] 5.4 Add fallback tests for no-same-day-data paths where endpoints are expected to backfill.
  - [ ] 5.5 Add dashboard render tests for loading, empty, error, and partial-data scenarios.
  - [ ] 5.6 Add interaction tests for global filters and module updates.

- [ ] 6.0 Complete QA, performance validation, and rollout readiness checks
  - [ ] 6.1 Execute manual QA checklist for desktop no-scroll behavior and visual integrity.
  - [ ] 6.2 Execute manual QA checklist for mobile/tablet usability and interaction quality.
  - [ ] 6.3 Measure initial dashboard load and key endpoint p95 times against PRD targets.
  - [ ] 6.4 Fix critical/high-priority defects found during QA or automated testing.
  - [ ] 6.5 Confirm launch gate: manual QA pass + automated endpoint suite pass.
  - [ ] 6.6 Publish rollout notes including known limitations and post-launch monitoring actions.
