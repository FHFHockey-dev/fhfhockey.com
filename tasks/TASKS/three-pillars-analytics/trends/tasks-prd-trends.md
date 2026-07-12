# Unified Trends Surface — Implementation and Completion Tasks

## Relevant Files

- `tasks/TASKS/three-pillars-analytics/trends/prd-trends.md` - Recovered canonical Trends PRD.
- `tasks/TASKS/three-pillars-analytics/prd-three-pillars-analytics.md` - Umbrella route ownership and launch dependencies.
- `tasks/TASKS/three-pillars-analytics/rolling-player-metrics/` - Rolling metric contracts, audits, remediation, and evidence.
- `tasks/TASKS/forge-projections/ecosystem-audits/forge-trends-combo-architecture.md` - Shared data/date/loading architecture input; combo implementation remains separate.
- `web/pages/trends/index.tsx` - Current unified Trends route.
- `web/pages/trends/player/[playerId].tsx` - Current player detail/movement route.
- `web/lib/trends/` - Team/skater/goalie metric definitions, percentile/ranking logic, CTPI, SOS, types, and surface helpers.
- `web/pages/api/v1/trends/` - Team, skater, goalie, player, CTPI, and SOS APIs.
- `web/lib/dashboard/dataFetchers.ts` and `web/hooks/useDashboardData.ts` - Shared multi-source loading/caching if current.
- `web/pages/trends/dashboard.module.scss` and `index.module.scss` - Current route styling/state layout.

### Notes

- This pair recovers the previously empty PRD from authoritative neighboring scopes and current implementation.
- All tasks are unchecked until code/data/runtime evidence verifies them.
- Keep FORGE/Start Chart combination implementation in its dedicated initiative; this list owns Trends contracts, movement UX, and safe context integration.
- Complete Supabase reads require pagination until a short page or verified aggregates.

## Tasks

- [ ] 1.0 Reconcile route ownership and current implementation
  - [ ] 1.1 Map every recovered PRD requirement to current page, API, metric registry, loader, style, test, and source table/view.
  - [ ] 1.2 Verify `/trends`, Underlying Stats, Trends Sandbox, FORGE, Start Chart, and SKO ownership boundaries and append conflicting live behavior as `NEW` tasks.
  - [ ] 1.3 Classify `placeholder.tsx`, duplicated styles/components, and legacy prediction helpers as active, compatibility, quarantine, or cleanup candidates with consumer evidence.
  - [ ] 1.4 Record a dependency graph for rolling data, identity, metric definitions, projections, schedule, and section loading.

- [ ] 2.0 Freeze shared entity/metric/window contracts
  - [ ] 2.1 Audit team, skater, and goalie metric registries for directionality, grain, units, source, window, minimum sample, availability, and explanation.
  - [ ] 2.2 Centralize percentile/rank semantics so higher displayed percentile means better after lower-is-better normalization.
  - [ ] 2.3 Define current/prior comparison point, delta, sample/confidence, date/generated time, season, team attribution, and warning fields in typed API contracts.
  - [ ] 2.4 Verify player windows follow player games and team/goalie windows follow documented observations without cross-entity semantic drift.
  - [ ] 2.5 Add deterministic tests for directionality, ties, minimum sample, missing values, window ordering, traded players, and small peer groups.

- [ ] 3.0 Verify complete, fresh, canonical data access
  - [ ] 3.1 Inventory every table/view/RPC read per Trends API/detail route and prove its result bound or add explicit pagination.
  - [ ] 3.2 Reconcile team/player/goalie identity, season, date, position, and team context across rolling, ratings, projections, starts, and metadata.
  - [ ] 3.3 Return coverage counts, source date/generated time, fallback, stale, partial, and unavailable-table state from APIs.
  - [ ] 3.4 Replace or bound player-detail direct client reads that duplicate canonical API logic or risk page-cap truncation.
  - [ ] 3.5 Add API tests for full paging, empty/stale/partial sources, invalid filters, fallback dates, and structured errors.

- [ ] 4.0 Complete team movement workflow
  - [ ] 4.1 Verify team offense, defense, PP, PK, pace/control, CTPI, and SOS movement metrics use aligned dates and definitions.
  - [ ] 4.2 Provide movers/rank/percentile/delta charts and tables with sample/freshness context and qualified empty states.
  - [ ] 4.3 Keep deeper team diagnosis routed to Underlying Stats while preserving current metric/date/team handoff.
  - [ ] 4.4 Verify team metadata/colors/logos are normalized once and not remapped inconsistently per section.

- [ ] 5.0 Complete skater movement workflow
  - [ ] 5.1 Verify approved production, shot/xG, playmaking, usage, physical, defense/context, and luck/regression categories against rolling support totals.
  - [ ] 5.2 Provide position/group, window, metric, team, and search filters with URL restoration and honest availability.
  - [ ] 5.3 Verify player detail shows selected metric/window/date context, explanations, sample/freshness, and linked deeper diagnosis without N+1 reads.
  - [ ] 5.4 Add regression coverage for player game-window semantics, denominator-matched rates, traded players, zero/null, and fallback source behavior.

- [ ] 6.0 Complete goalie movement workflow
  - [ ] 6.1 Verify goalie performance/workload/start-role metric separation and source coverage.
  - [ ] 6.2 Add comparable windows, rank/percentile deltas, movers, workload/share, volatility/confidence, and qualified state communication.
  - [ ] 6.3 Ensure starter probability is labeled as role context and never blended silently into save-performance percentiles.
  - [ ] 6.4 Add goalie identity, minimum sample, lower-is-better, fallback, missing start source, and volatility tests.

- [ ] 7.0 Integrate short-horizon context without corrupting trends
  - [ ] 7.1 Verify Start Chart/FORGE rows include aligned `dateUsed`, model/run, source, freshness, fallback, and uncertainty.
  - [ ] 7.2 Keep projection/start/opponent context visually and mathematically separate from historical trend ranks/percentiles.
  - [ ] 7.3 Apply mixed-recency invalidation/downgrade when projection, CTPI, team power, and trend dates are not safely aligned.
  - [ ] 7.4 Preserve query-driven handoff from FORGE to the relevant Trends player/metric context.

- [ ] 8.0 Harden page filters, loading, error, stale, and cache behavior
  - [ ] 8.1 Serialize/restore global and entity filters deterministically and validate unsupported combinations.
  - [ ] 8.2 Make team, skater, goalie, projection, and schedule sections independently load/retry/fail without blanking the shell.
  - [ ] 8.3 Preserve last-success data only with visible stale/error time/source state.
  - [ ] 8.4 Deduplicate in-flight requests and verify cache keys/TTLs include every contract-affecting parameter.
  - [ ] 8.5 Prevent hydration/filter/date mismatch between SSR defaults and client state.

- [ ] 9.0 Verify UX, accessibility, responsive behavior, and performance
  - [ ] 9.1 Align movement-first hierarchy, entity grammar, metric explanations, sample/date labels, drill-ins, and sustainability-lab links.
  - [ ] 9.2 Verify keyboard filters/search/tables/charts, focus, labels/tooltips, color-independent movement, contrast, zoom, and mobile layouts.
  - [ ] 9.3 Measure API/query volume, page load, filter changes, chart/table rendering, and bundle/runtime cost; remediate verified bottlenecks.
  - [ ] 9.4 Run focused unit/API/component checks, TypeScript/build validation, and browser verification across representative states.
  - [ ] 9.5 Synchronize the recovered PRD, this list, Three Pillars, rolling metrics, FORGE handoff, and master ledger with evidence.

## NEW Tasks

- [ ] NEW 10.0 Append every verified data gap, metric conflict, pagination defect, mixed-recency issue, UX/accessibility finding, and optimization discovered during execution here before closure.
