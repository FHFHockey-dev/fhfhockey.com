# 15 — Category Percentile Radar

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; diagnose separately from layout; depends on 00.

## Scope and evidence

Legacy get_skaters_avg_stats RPC joins skatersGameStats with games over season dates. Axes: Goals, Assists, PPP, SOG, +/−, PIM, BLK, HITS. The hook returns zeros for missing target, uses first tied index/N rather than WiGO midrank, has no error result for UI, and retains old data when selection becomes invalid. RPC baseline returns numgames while local type calls it count.

- [CategoryCoverageChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/CategoryCoverageChart/CategoryCoverageChart.tsx)
- [usePercentileRank.ts](/Users/tim/Code/fhfhockey.com/web/hooks/usePercentileRank.ts)
- [20260716112908_production_schema_baseline.sql](/Users/tim/Code/fhfhockey.com/supabase/migrations/20260716112908_production_schema_baseline.sql)

## Distinct implementation plan

1. Reproduce the failure with response/error inspection: date boundaries (including preseason start>end), selected ID, game coverage, RPC permissions, row limits and source freshness. Verify the deployed function; do not claim the screenshot identifies the root cause.

2. Choose an explicit category-average cohort and minimum games; validate per-game basis, ties, finite values and position policy. Preserve fantasy-category interpretation of PIM and +/−. Adopt the shared ranking helper only after agreeing on compatible semantics.

3. Replace missing-player zeros with explicit no-data state; clear stale player results and surface errors. Render actual zero labels (current truthiness check hides them). Pass data declaratively where practical and remove reliance on private Chart.js label internals if implicated.

4. Cache the league averages by date/season window, derive target locally and avoid duplicate legacy RPC effects across responsive mounts. A migrated source must preserve all eight categories and undergo parity verification.

## Verification and acceptance

Test missing target, valid zero, all tied, top/bottom, rejected RPC, offseason dates, rapid selection and cleared selection. Browser acceptance: visible polygon for a known valid response, readable eight axes and explicit empty/error/loading states. The exact production failure remains unverified.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
