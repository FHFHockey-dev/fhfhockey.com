# 14 — Point Consistency doughnut

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; depends on 00 game-set contract.

## Scope and evidence

wgo_skater_stats supplies points/shots/hits/blocks. Distribution is count in each integer points bucket divided by returned row count. Nulls currently become zero. Cardio means zero points, shots, hits and blocks; it overlaps the zero-point category and is not an additional doughnut segment.

- [ConsistencyChart.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/ConsistencyChart.tsx)
- [fetchWigoPlayerStats.ts](/Users/tim/Code/fhfhockey.com/web/utils/fetchWigoPlayerStats.ts)

## Distinct implementation plan

1. Validate one completed game per row, regular-season filters, missing points and DNP exclusion. Exclude or label unknown values rather than counting them as zero-point or Cardio games.

2. Keep buckets from 0 through observed maximum (including 6+ when needed), with count and percentage. Check their count sum against GP and their percentage sum against 100 before display rounding.

3. Reuse canonical game logs with PPG; memoize distribution by game dataset. Preserve the Cardio supplementary row and explain its overlap to avoid double-count interpretation.

## Verification and acceptance

Check all-zero games, an outlier high-point game, missing one of the Cardio fields, duplicate games and no games. Acceptance: mutually exclusive point buckets sum to valid GP; Cardio is separately labeled and does not inflate the doughnut.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
