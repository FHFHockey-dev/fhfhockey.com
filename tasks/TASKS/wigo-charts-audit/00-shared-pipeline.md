# 00 — Shared pipeline and responsive shell

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; establish contracts before downstream changes.

## Scope and evidence

Current season and selected player feed the dashboard. Aggregate data is keyed only by player; totals and game logs use several independent query keys. Desktop and mobile trees are simultaneously mounted and CSS controls visibility. Mobile tabs initialize from window.location once rather than tracking all URL changes.

- [wigoCharts.tsx](/Users/tim/Code/fhfhockey.com/web/pages/wigoCharts.tsx)
- [useWigoPlayerDashboard.ts](/Users/tim/Code/fhfhockey.com/web/hooks/useWigoPlayerDashboard.ts)
- [useCurrentSeason.ts](/Users/tim/Code/fhfhockey.com/web/hooks/useCurrentSeason.ts)
- [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts)
- [wigoCharts.module.scss](/Users/tim/Code/fhfhockey.com/web/styles/wigoCharts.module.scss)

## Distinct implementation plan

1. Record an explicit context contract: player/team identity, requested/applied season, regular-season versus playoffs, strength, as-of date, source completeness and unit for every response. Resolve season before labeling data “This season”; preserve intentionally historical comparisons.

2. Identify refresh jobs and last_updated/source dates for wgo_skater_stats, totals, wigo_career/recent/rates, percentile tables and both RPCs. Trace only the writers actually serving this page. Missing writer/deployed SQL evidence is a blocked validation item, not permission to infer correctness.

3. Measure cold load, warm revisit, player switch, row expansion, min-GP change and mobile tab change: request count, payload bytes, table-ready and all-panels-ready time, chart mounts and calculation time. Set a performance budget from this baseline.

4. Share narrowly scoped React Query inputs: player/season totals; compatible season game logs; season/strength league cohorts with player selection and min-GP filtering downstream. Preserve explicit errors and provenance. Choose stale times by refresh cadence; do not add a universal data framework.

5. Remove hidden duplicate chart/effect work with a single responsive tree or hydration-safe conditional mounts. Keep all table content available on mobile. Track tab URL changes and player/season changes consistently.

## Verification and acceptance

Extend useWigoPlayerDashboard.test.tsx and relevant panel tests. Verify rapid A→B→A selection, URL back/forward, season rollover, failed season lookup, cold/warm loads and mobile/desktop breakpoints. Acceptance: no wrong-context data, no redundant fetch for identical shared inputs during one fresh-cache interaction, and measured improvement with full feature parity.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
