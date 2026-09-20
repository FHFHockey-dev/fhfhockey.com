# 13 — Expanded stat game-log charts

Status: in progress; request identity/caching subtask completed September 19, 2026. Remaining calculation and browser acceptance tasks are tracked in [the task list](../../tasks-README.md). Priority/dependencies: P1; depends on 12 metric contracts.

## Scope and evidence

One stat row expands at a time; GP is not expandable. The chart loads current-season games and can toggle STD, LY, 3YA, CA, L5/L10/L20 reference lines. Manual promises have no selection guard, and the fetch helper suppresses errors as empty arrays. PTS1% returns a fraction while display metadata expects percentage points; standard percentage normalization is commented out.

- [StatsTable.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/StatsTable.tsx)
- [StatsTableRowChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/StatsTableRowChart.tsx)
- [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts)

## Distinct implementation plan

1. Key log data by player/season/stat using existing query infrastructure or a scoped request guard; reset expansion on context changes and prevent slow old responses replacing newer data. Cache completed log requests and propagate errors.

2. Normalize each mapped column to the same unit as table references. Explicitly verify PTS1%, S%, PP%, IPP and on-ice percentages, PP per-60 mappings and whether date_scraped denotes game date.

3. Label the chart’s actual game season and reference periods. Keep current behavior explicit unless multi-season log navigation is intentionally added. For count references divide by matching GP; for rates and percentages avoid unweighted mean-of-games masquerading as pooled season rates.

4. Preserve all row expansion controls and seven reference toggles; load logs on demand and reuse compatible game-log data. Keep null observations distinct from zero.

## Verification and acceptance

Extend StatsTable.test.tsx, StatsTableRowChart.test.tsx and fetchWigoPlayerStats.test.ts with out-of-order promises, player switches, rejected requests, percent scaling and unequal-TOI games. Acceptance: no stale plot, distinct empty/error states, and per-game points/reference lines have compatible units.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
