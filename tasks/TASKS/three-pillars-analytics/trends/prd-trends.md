# PRD: Unified Team, Skater, and Goalie Trends Surface

## Introduction/Overview

`/trends` is FHFH's movement-first analytics surface. It answers what is changing recently for teams, skaters, and goalies through comparable rolling windows, percentiles, ranks, risers/fallers, hot/cold direction, and concise short-horizon context. It must remain distinct from `/underlying-stats` (current-state intelligence and diagnosis) and `/trendsSandbox` (sustainability/expectation lab).

This PRD recovers the previously empty Trends scope from the Three Pillars PRD, rolling-player metrics contracts/remediation, the FORGE/Trends architecture, and current `/trends` code. Current implementation already contains team, skater, and goalie metric registries/APIs, CTPI, strength of schedule, Start Chart context, player detail, and section-level loading/error behavior. The initiative must verify those claims, close entity/data/ownership gaps, harden shared contracts and pagination, and provide a coherent production experience without absorbing deeper Sustainability or FORGE product ownership.

## Goals

1. Provide equally intentional team, skater, and goalie recent-movement workflows.
2. Use stable comparable rolling-window, percentile, rank, delta, sample, and freshness contracts.
3. Preserve team trends on `/trends` while routing deeper current-state diagnosis to Underlying Stats.
4. Keep sustainability bands/meters in `/trendsSandbox`, exposing links/context rather than duplicating the lab.
5. Integrate Start Chart/FORGE context only as concise short-horizon movement context with explicit source/date/model metadata.
6. Make section loading, empty, stale, partial, fallback, and error states independent so one source failure does not blank the page.
7. Ensure complete data coverage through verified pagination/server aggregation and canonical player/team/goalie identity.
8. Provide performant, accessible, URL-restorable discovery and drill-down paths.

## User Stories

- As a fantasy user, I want to see which skaters and goalies are rising or falling over recent games so I can act before the change becomes obvious.
- As a team analyst, I want recent team offense, defense, power-play, and penalty-kill direction without losing the deeper Underlying Stats diagnosis path.
- As a user, I want comparable windows and clear sample/freshness context so percentile changes are not mistaken for certainty.
- As a user, I want short-horizon projection/start context alongside movement when available, but clearly separated from historical trend evidence.
- As a maintainer, I want one typed contract and metric registry per entity rather than page-local formulas that drift.

## Functional Requirements

1. `/trends` must support teams, skaters, and goalies as first-class entity sections with deliberate metric sets and explanations.
2. Teams must expose movement for offense, defense, power play, penalty kill, pace/control, and other approved team categories with current and previous rank/percentile.
3. Skaters must expose recent movement across approved production, shot/xG, playmaking, deployment/usage, physical, defensive/context, and luck/regression metrics when source coverage exists.
4. Goalies must expose recent save quality, workload/share, goals saved/expected context, start-role context, and volatility/confidence without treating starter probability as performance.
5. Each metric definition must specify entity, key, label, directionality, source fields/grain, units, window semantics, minimum sample, availability, and explanation.
6. Rolling windows must follow each entity's actual games/observations as documented and use strict as-of ordering; player windows must not silently become team schedule windows.
7. API outputs must include selected window, current value/rank/percentile, prior comparison point, delta, games/TOI/sample, source date/generated time, season, and warnings.
8. Percentile direction must be normalized so higher displayed percentile consistently means better after lower-is-better handling.
9. Small/partial samples must produce confidence/insufficiency warnings and must not be presented as equally reliable to qualified samples.
10. Team, skater, and goalie APIs must use canonical identity plus complete paginated reads or verified server-side aggregates; no large limit may stand in for completeness.
11. Traded players and changed team context must preserve canonical identity while making current/selected-window team attribution explicit.
12. The page must provide global date/context, team, and search filters plus entity-specific metric, position/group, and window filters.
13. Filter and selected entity/metric/window state must serialize to URL parameters and restore deterministically.
14. Search must resolve teams, skaters, and goalies through canonical identity and navigate to the appropriate movement/detail context.
15. Team cards/charts must link to deeper Underlying Stats team diagnosis; player/goalie rows must link to the appropriate Trends or analytics detail route.
16. Team trend movement must remain on `/trends`; deeper ratings, schedule diagnosis, and current-state intelligence remain owned by `/underlying-stats`.
17. Elasticity bands, sustainability meters, baseline expectation, and experimental threshold work must remain owned by `/trendsSandbox`; `/trends` may show a concise status/link only when the contract is production-approved.
18. Start Chart/FORGE context may add opponent, projection, start probability, or slate information but must include source, model/run, `dateUsed`, freshness, fallback, and uncertainty.
19. Projection context must never overwrite or be blended invisibly into historical trend percentiles/ranks.
20. Legacy projection data may appear only when selected explicitly or when the documented FORGE fallback applies, with a visible source label.
21. The page shell and filters must render independently of data sections; team, skater, goalie, projection, and schedule failures must have section-level retry/error states.
22. When refresh fails after a prior success, the page may preserve last successful data only with a visible stale/error indicator and timestamp.
23. Empty data, no qualified sample, no games, source unavailable, migration/table unavailable, and true zero must be distinguishable.
24. Client loading must deduplicate identical in-flight requests and use bounded TTL caching aligned to source volatility; caches must key all contract-affecting params.
25. SSR may resolve meaningful default date/team context or team snapshot, while heavier trend sections may load client-side; hydration must not change filter semantics.
26. The default date is current America/New_York context. Any source fallback must return `dateUsed`/generated time so mixed recency is visible.
27. The UI must provide scannable movers, charts/sparklines, metric definitions, current/prior values, sample context, and rank/percentile deltas without excessive density.
28. Charts/tables must be keyboard accessible, labeled, color-independent, responsive, and understandable at zoom/mobile widths.
29. Predictions-vs-actual history and candlestick visualization remain deferred from the initial Trends completion unless a later source task explicitly promotes them with data/UX contracts.
30. Non-trivial windowing, percentile, directionality, fallback, identity, and source-alignment logic must have focused tests; visual-only changes may use direct verification.
31. The implementation must preserve compatibility for current FORGE/Command Center links and query-driven metric handoff where approved.

## Non-Goals (Out of Scope)

- Replacing `/underlying-stats` as the team intelligence landing or raw table explorer.
- Moving team movement out of `/trends`.
- Duplicating the full Sustainability Barometer or experimental lab on `/trends`.
- Blending projection values into historical trend rankings without an explicit separate metric contract.
- Rebuilding rolling-player storage when current verified contracts satisfy the required grain/coverage.
- Treating predictions-vs-actual candlesticks as an initial completion requirement.
- Broad architecture replacement when targeted contract and query fixes suffice.

## Design Considerations

- Movement-first hierarchy: leading movers and direction should be faster to scan than deep explanation.
- Entity sections should share card/table/filter grammar but may use distinct metrics and uncertainty language.
- Positive/negative movement must not rely on red/green alone; include arrows, labels, values, and accessible text.
- Always display window, sample, season/date, source freshness, and fallback context near the result.
- Preserve FHFH Neon Noir styling, responsive density, keyboard focus, readable charts, and section-level state communication.

## Technical Considerations

- Current sources include `team-power`, `team-ctpi`, `team-sos`, `skater-power`, `goalie-power`, `player-trends`, rolling player metrics, Start Chart, FORGE, and dashboard data loaders.
- Metric registries should remain domain modules under `web/lib/trends` with shared response types and directionality helpers.
- The current page imports Start Chart rows; mixed-recency validation must prevent old projections and current trend data from appearing as one aligned snapshot.
- Direct client Supabase reads in player detail should be replaced or bounded behind canonical APIs when they risk incomplete coverage or duplicate contracts.
- Complete historical reads need `.range()` pagination loops, RPC pagination, or documented bounded queries and verification counts.
- Cache TTL: movement endpoints may use multi-minute CDN/client caching; projection/schedule snapshots need shorter freshness and explicit invalidation keys.

## Success Metrics

- Team, skater, and goalie sections each provide qualified movers, filters, explanations, and drill-ins from verified current data.
- Same inputs produce deterministic metric/rank/percentile outputs and restored URLs reproduce the view.
- Full coverage checks prove no page-cap truncation for scoped trend sources.
- Section failures do not blank unrelated sections and stale/partial/fallback data is labeled with dates/sources.
- Team diagnosis and Sustainability lab links preserve clear route ownership.
- Targeted unit/API tests, type checks, and browser verification pass for desktop/mobile/accessibility states.
- Current FORGE/Start Chart handoffs preserve date/model/source metadata without hidden recency mixing.

## Open Questions

1. Predictions-vs-actual and candlestick work remains deferred until its own data/visual contract is promoted.
2. Sustainability states may graduate into concise Trends badges only after the Sustainability initiative approves stable entity coverage and labels.
3. Any odds/props comparison belongs to the broader Three Pillars/market initiative unless the Trends PRD is explicitly expanded.
