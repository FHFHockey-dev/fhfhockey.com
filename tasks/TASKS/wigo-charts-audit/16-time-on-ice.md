# 16 — Brush/zoom TOI and PPTOI%

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; depends on 00 units and 12 reconciliation.

## Scope and evidence

wgo_skater_stats game logs and wgo_skater_stats_totals averages feed two modes. TOI plots per-game total ice time, per-game PP time and season average total TOI. PPTOI% plots usage and season average. The label Total TOI means all-strength ice time within a game, not cumulative season ice time.

- [ToiLineChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/ToiLineChart.tsx)
- [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts)

## Distinct implementation plan

1. Validate seconds end-to-end, mm:ss formatting and equality of chart season average with summed game TOI/GP. Verify PP time≤total game time. Investigate the screenshot’s single plotted date using raw row count/date range before blaming chart styling.

2. Confirm PPTOI% denominator is player share of team PP time, consistent with the aggregate schema comment; it is not automatically player PP time/player total time. Verify ratio-of-sums versus mean-of-game-percentages for the season line and trade/zero-PP games.

3. Share totals and logs with other panels; avoid rebuilding unchanged chart arrays/options where profiling warrants. Ensure player/season and toggle changes reset incompatible zoom state.

4. Preserve both modes, all series, hover values, horizontal drag-to-zoom/pan/pinch and an obvious reset. Current configuration is drag zoom, not a separate persistent overview brush; specify any new brush intentionally.

## Verification and acceptance

Validate seconds/minutes fixtures, zero PP opportunity, null data, one/many games and traded-team denominators. Browser-check each mode and zoom/reset. Acceptance: correct axes/averages, no fabricated points and no totals refetch on toggling mode.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
