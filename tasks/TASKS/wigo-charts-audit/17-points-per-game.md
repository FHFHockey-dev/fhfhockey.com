# 17 — Brush/zoom Points Per Game

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; depends on 00 and 14 game-set agreement.

## Scope and evidence

Points bars plus 5- and 10-game rolling means and a totals-sourced season PPG line. Rolling helper returns null before a full window; within a window it averages available numeric values. Bars turn null points into zero, producing inconsistent missing-data semantics.

- [PpgLineChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PpgLineChart.tsx)
- [formattingUtils.ts](/Users/tim/Code/fhfhockey.com/web/utils/formattingUtils.ts)
- [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts)

## Distinct implementation plan

1. Define windows as the last N actual games played, not calendar days or team games. Decide and document whether missing points invalidate a window or use valid observations; apply consistently to bars and averages.

2. Reconcile season PPG with summed points/valid GP and snapshot/table, including source-lag state when totals and logs update at different times.

3. Reuse canonical logs/totals. Memoize chart data/options before considering rolling-sum optimization; 84 games alone is not evidence that rolling math is a bottleneck.

4. Preserve bars, 5/10-game lines, season line, tooltips and drag/zoom/pan/reset. Make series distinguishable without relying only on color.

## Verification and acceptance

Check games 4/5/9/10, missing values, zero-point streak, outlier game and player switch while zoomed. Acceptance: independent rolling calculations agree, zoom changes the viewport without changing the full-season reference definition, and no redundant totals request.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
