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

- [x] 1.0 Reconcile route ownership and current implementation
  - [x] 1.1 Map every recovered PRD requirement to current page, API, metric registry, loader, style, test, and source table/view.
  - [x] 1.2 Verify `/trends`, Underlying Stats, Trends Sandbox, FORGE, Start Chart, and SKO ownership boundaries and append conflicting live behavior as `NEW` tasks.
  - [x] 1.3 Classify `placeholder.tsx`, duplicated styles/components, and legacy prediction helpers as active, compatibility, quarantine, or cleanup candidates with consumer evidence.
  - [x] 1.4 Record a dependency graph for rolling data, identity, metric definitions, projections, schedule, and section loading.
  - Evidence (1.1–1.4, 2026-07-22): the canonical Sustainability/Trends inventory and dependency map cover 1,052 surfaces, local/API/data edges, every current page/API/registry/loader/test/source, and classify canonical `/trends`, Underlying Stats, the active Sandbox, alternate placeholder, read-only Testing Grounds, player detail, FORGE/Start, and quarantined SKO without duplicating ownership.

- [ ] 2.0 Freeze shared entity/metric/window contracts
  - [x] 2.1 Audit team, skater, and goalie metric registries for directionality, grain, units, source, window, minimum sample, availability, and explanation.
  - [x] 2.2 Centralize percentile/rank semantics so higher displayed percentile means better after lower-is-better normalization.
  - [ ] 2.3 Define current/prior comparison point, delta, sample/confidence, date/generated time, season, team attribution, and warning fields in typed API contracts.
  - [x] 2.4 Verify player windows follow player games and team/goalie windows follow documented observations without cross-entity semantic drift.
  - [x] 2.5 Add deterministic tests for directionality, ties, minimum sample, missing values, window ordering, traded players, and small peer groups.
  - Evidence (2.1/2.2/2.4/2.5, 2026-07-22): audited team/skater/goalie registries and percentile helpers record direction, units, windows, samples, availability, and explanations; lower-is-better normalization, player-game windows, observation-based team/goalie windows, ties/missing/small-sample ordering, and traded-player identity are covered by the published metric/trace regressions.

- [ ] 3.0 Verify complete, fresh, canonical data access
  - [x] 3.1 Inventory every table/view/RPC read per Trends API/detail route and prove its result bound or add explicit pagination.
  - [x] 3.2 Reconcile team/player/goalie identity, season, date, position, and team context across rolling, ratings, projections, starts, and metadata.
  - [ ] 3.3 Return coverage counts, source date/generated time, fallback, stale, partial, and unavailable-table state from APIs.
  - [x] 3.4 Replace or bound player-detail direct client reads that duplicate canonical API logic or risk page-cap truncation.
  - [x] 3.5 Add API tests for full paging, empty/stale/partial sources, invalid filters, fallback dates, and structured errors.
  - Evidence (3.1/3.2/3.4/3.5, 2026-07-22): the dependency map records all five Trends APIs and player-detail reads; team-power and player-detail multi-page traces prove rows beyond 1,000 participate, identities/dates/seasons/positions are reconciled, and focused API regressions cover bounds, invalid inputs, empty/fallback/stale/partial/error contracts.

- [x] 4.0 Complete team movement workflow. Evidence: aligned team metrics, canonical metadata/handoffs, and the current team workspace now jointly provide ranked percentile lines, explicit deltas, labeled risers/fallers, GP sample context, source-update date, and qualified loading/empty states (verified 2026-07-22).
  - [x] 4.1 Verify team offense, defense, PP, PK, pace/control, CTPI, and SOS movement metrics use aligned dates and definitions.
  - [x] 4.2 Provide movers/rank/percentile/delta charts and tables with sample/freshness context and qualified empty states. Evidence: the team workspace renders percentile trend lines, top ranks, arrow/value deltas, labeled five-game risers/fallers, GP context, explicit source update/unavailable copy, and loading/empty branches; the focused page suite passes 2/2 (verified 2026-07-22).
  - [x] 4.3 Keep deeper team diagnosis routed to Underlying Stats while preserving current metric/date/team handoff.
  - [x] 4.4 Verify team metadata/colors/logos are normalized once and not remapped inconsistently per section.
  - Evidence (4.1–4.4, 2026-07-22): exact team traces distinguish aligned movement percentiles, CTPI, SOS, and persisted current-state ratings; `/trends` renders directly tested rank/mover/delta/sample/freshness/empty states and routes deeper diagnosis to Underlying Stats, while shared canonical team identity/metadata supplies colors/logos and date/team handoff.

- [x] 5.0 Complete skater movement workflow
  - [x] 5.1 Verify approved production, shot/xG, playmaking, usage, physical, defense/context, and luck/regression categories against rolling support totals.
  - [x] 5.2 Provide position/group, window, metric, team, and search filters with URL restoration and honest availability.
  - [x] 5.3 Verify player detail shows selected metric/window/date context, explanations, sample/freshness, and linked deeper diagnosis without N+1 reads.
  - [x] 5.4 Add regression coverage for player game-window semantics, denominator-matched rates, traded players, zero/null, and fallback source behavior.
  - Evidence (5.1–5.4, 2026-07-22): player-detail/rolling audits map all category registries to support totals; URL-owned filters and quick views restore context; deterministic pagination avoids N+1/page-cap loss; published rolling regressions cover last-N semantics, denominators, team changes, zero/null, and fallbacks while NEW 10 retains historical repair.

- [ ] 6.0 Complete goalie movement workflow
  - [x] 6.1 Verify goalie performance/workload/start-role metric separation and source coverage.
  - [ ] 6.2 Add comparable windows, rank/percentile deltas, movers, workload/share, volatility/confidence, and qualified state communication.
  - [x] 6.3 Ensure starter probability is labeled as role context and never blended silently into save-performance percentiles.
  - [x] 6.4 Add goalie identity, minimum sample, lower-is-better, fallback, missing start source, and volatility tests.
  - Evidence (6.1/6.3/6.4, 2026-07-22): the goalie registry/API and exact Dostal trace keep save performance, workload, and start role separate; starter probability remains labeled context, and focused contracts cover identity, minimum sample, lower-is-better normalization, missing/fallback source, and volatility/uncertainty.

- [ ] 7.0 Integrate short-horizon context without corrupting trends
  - [x] 7.1 Verify Start Chart/FORGE rows include aligned `dateUsed`, model/run, source, freshness, fallback, and uncertainty.
  - [x] 7.2 Keep projection/start/opponent context visually and mathematically separate from historical trend ranks/percentiles.
  - [ ] 7.3 Apply mixed-recency invalidation/downgrade when projection, CTPI, team power, and trend dates are not safely aligned.
  - [x] 7.4 Preserve query-driven handoff from FORGE to the relevant Trends player/metric context.
  - Evidence (7.1/7.2/7.4, 2026-07-22): canonical Start Chart/FORGE readers expose requested/resolved date, run/model/source/freshness/fallback/uncertainty; `/trends` presents this as a separate runway from historical percentiles, and FORGE/player links preserve date/player/metric query context.

- [x] 8.0 Harden page filters, loading, error, stale, and cache behavior. Evidence: five named sections load and settle independently, scoped retries execute only their owned sources, last-success data retains explicit attempt/source context, and valid query dates own both SSR and client state (verified 2026-07-22).
  - [x] 8.1 Serialize/restore global and entity filters deterministically and validate unsupported combinations.
  - [x] 8.2 Make team, skater, goalie, projection, and schedule sections independently load/retry/fail without blanking the shell. Evidence: each section owns a lazy request group, settles without awaiting slower peers, reports stable failure state, and exposes a section-only retry; the hook regression proves team data renders while schedule is still pending (verified 2026-07-22).
  - [x] 8.3 Preserve last-success data only with visible stale/error time/source state. Evidence: failed fields merge over the prior section snapshot, while the page names the failed section, last-success timestamp, resolved parameters, and retry state instead of clearing the shell or exposing raw errors (verified 2026-07-22).
  - [x] 8.4 Deduplicate in-flight requests and verify cache keys/TTLs include every contract-affecting parameter.
  - Evidence (8.1–8.5, 2026-07-22): page/player URL state deterministically owns entity/window/metric/team/search selection; API and aggregate-loader traces verify parameterized cache keys, TTLs, and in-flight dedupe; focused hook/page regressions prove independent settlement, stale retention, scoped retry, and SSR query-date ownership.
  - [x] 8.5 Prevent hydration/filter/date mismatch between SSR defaults and client state. Evidence: one strict calendar-date normalizer owns both server query resolution and client route synchronization; invalid query dates fall back before render (verified 2026-07-22).

- [ ] 9.0 Verify UX, accessibility, responsive behavior, and performance
  - [x] 9.1 Align movement-first hierarchy, entity grammar, metric explanations, sample/date labels, drill-ins, and sustainability-lab links.
  - Evidence (9.1, 2026-07-22): the canonical route audit records the movement-first team/skater/goalie hierarchy, shared metric explanations and date/sample context, Underlying Stats/player/FORGE drill-ins, and the separate Sustainability Lab link/ownership boundary.
  - [ ] 9.2 Verify keyboard filters/search/tables/charts, focus, labels/tooltips, color-independent movement, contrast, zoom, and mobile layouts.
  - [ ] 9.3 Measure API/query volume, page load, filter changes, chart/table rendering, and bundle/runtime cost; remediate verified bottlenecks.
  - [ ] 9.4 Run focused unit/API/component checks, TypeScript/build validation, and browser verification across representative states.
  - [ ] 9.5 Synchronize the recovered PRD, this list, Three Pillars, rolling metrics, FORGE handoff, and master ledger with evidence.

## NEW Tasks

- [ ] NEW 10.0 Append every verified data gap, metric conflict, pagination defect, mixed-recency issue, UX/accessibility finding, and optimization discovered during execution here before closure.
- [x] NEW 11.0 **P2 scoped-retry eager-source execution:** the first resilience draft constructed every source promise before checking its selected section, causing non-selected retries to issue requests and rejected promises to escape. Request groups are now lazy; the focused regression proves a team retry does not start unrelated sources and the final 5-test group has zero unhandled errors (verified 2026-07-22).
