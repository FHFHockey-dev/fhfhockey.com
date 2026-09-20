# 04 — Season production .productionSnapshot

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; depends on 00 and reconciliation with 12.

## Scope and evidence

wgo_skater_stats_totals supplies points, goals, assists, shots and GP. The same component renders both snapshot and pace sections. Query can run before season resolves, using latest totals while the title says “This season”.

- [PerGameStatsTable.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PerGameStatsTable.tsx)
- [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts)

## Distinct implementation plan

1. Reconcile totals to unique completed regular-season player games at the same cutoff. Verify PTS=G+A, traded-player season totals, DNP exclusion and refresh lag. Trace the totals writer before declaring this source authoritative.

2. Gate season-dependent requests or explicitly label any latest-season fallback. Display requested/applied season and missing/stale state consistently with the comparison table.

3. Compute each /GP figure from unrounded counts and valid GP; do not turn absent totals into zero. Reuse the shared totals query for the pace, PPG and TOI panels.

## Verification and acceptance

Extend PerGameStatsTable.test.tsx for zero GP, missing values and unresolved season. Acceptance: all four totals and per-game values match independently reconstructed fixtures and agree with STD when both have the same source cutoff.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
