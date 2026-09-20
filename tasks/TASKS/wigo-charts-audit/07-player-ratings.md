# 07 — Offense, defense and overall percentile composites

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; depends on 00 cohort contract.

## Scope and evidence

Eight nst_percentile strength/type datasets feed weighted metric percentiles and low-GP regression. Display is offense AS/ES/PP, defense AS/ES/PK, overall AS/ES/Special. Overall AS/ES averages available components; Special weights PP offense and PK defense by TOI. A weighted average of metric percentiles is not automatically the player’s percentile of overall ability.

- [PlayerRatingsDisplay.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PlayerRatingsDisplay.tsx)
- [ratingWeights.ts](/Users/tim/Code/fhfhockey.com/web/components/WiGO/ratingWeights.ts)
- [fetchWigoRatingStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoRatingStats.ts)
- [calculateWigoRatings.ts](/Users/tim/Code/fhfhockey.com/web/utils/calculateWigoRatings.ts)
- [calculatePercentiles.ts](/Users/tim/Code/fhfhockey.com/web/utils/calculatePercentiles.ts)

## Distinct implementation plan

1. Audit every configured weight, field mapping, favorable direction, missing-metric renormalization, GP qualification and regression threshold. Reconstruct one rating by hand. Determine whether position-specific populations are intended; do not introduce them silently.

2. Check whether percentile-named tables contain raw rates or pre-ranked values, unique player/season/strength rows, season completeness and ingestion freshness. Explain 50.0 values from evidence rather than assuming they are placeholders.

3. Resolve the request’s defense PP versus current PK mismatch explicitly before changing semantics. Preserve the existing nine cells in the redesign; any added PP-defense rating must be a deliberate product change.

4. Cache raw cohorts by season independently of player/min-GP; compute target ratings from the cached cohort. Avoid fetching strengths with no used weights if confirmed unnecessary. Optimize repeated cohort ranking in low-GP regression only after profiling.

## Verification and acceptance

Extend calculateWigoRatings.test.ts, fetchWigoRatingStats.test.ts and PlayerRatingsDisplay.test.tsx: ties, inverted defense directions, absent metric, no PP/PK TOI, partial overall, regression and filter changes. Acceptance: explainable numeric reconstruction and no whole-league refetch solely for min-GP changes.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
