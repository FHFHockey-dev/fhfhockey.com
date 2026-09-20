# 19 — Bottom rate/category percentile bars

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; depends on 00 cohort and 07 ranking contract.

## Scope and evidence

AS/ES/PP/PK plus min-GP filter rank 16 metrics, including TOI/GP and percentages as well as per-60. Fetch joins offense rows with defense metadata; defense-only players are not added. Completeness heuristic may replace the whole dataset with a prior season while canonical GP remains from the requested season. Lower-level errors become empty arrays.

- [RateStatPercentiles.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/RateStatPercentiles.tsx)
- [fetchWigoPercentiles.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPercentiles.ts)
- [calculatePercentiles.ts](/Users/tim/Code/fhfhockey.com/web/utils/calculatePercentiles.ts)

## Distinct implementation plan

1. Verify unique player-season-strength keys, positive exposure, raw-rate versus pre-ranked meaning, join completeness, traded players and numeric types. Evaluate completeness using valid metric coverage, not GP alone; a high GP cohort can still have missing/stale metric columns.

2. Keep requested/applied season visible: current implementation substitutes both target and cohort from the prior season, not just a benchmark population. Align player GP messaging with that source and distinguish fetch failure from genuine incomplete data.

3. Validate midrank percentile, ordinal rank, finite inputs and the policy retaining the selected player below min GP. Treat TOI/GP and percentage metrics with their own labels; never describe all bars as per-60.

4. Cache season/strength cohorts apart from selected-player canonical GP; calculate rank and percentile together instead of scanning twice per metric if worthwhile. Keep AS/ES/PP/PK and min-GP interactions local when inputs are cached.

## Verification and acceptance

Extend fetchWigoPercentiles.test.ts, calculatePercentiles.test.ts and RateStatPercentiles.test.tsx for ties, singleton, defense-only row, fallback target/GP mismatch, source errors and low-GP target. Acceptance: all 16 bars have valid source/units/cohort, accurate percentile and rank, and conspicuous fallback status.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
