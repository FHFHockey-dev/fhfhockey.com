# 09 — Team Chance Suppression

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; depends on 08 shared snapshots.

## Scope and evidence

Suppression is team 5v5 xGA/GP; lower is better. The model reverses the midrank percentile. It is not a player’s defensive isolated impact or xGA/60.

- [TeamPerformanceDrivers.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/TeamPerformanceDrivers.tsx)
- [teamPerformanceDriverModel.ts](/Users/tim/Code/fhfhockey.com/web/components/WiGO/teamPerformanceDriverModel.ts)

## Distinct implementation plan

1. Verify xGA and GP cover the same season, game type and snapshot window, using the validated shared team dataset from plan 08.

2. Check lower-is-better inversion, ties, zero GP, missing/negative source values and minimum valid cohort size. Keep displayed xGA/GP separate from its percentile and status.

3. Reuse shared snapshot and derived cohorts. Preserve the explanation and team identification in any new layout.

## Verification and acceptance

Extend teamPerformanceDrivers.test.ts with ordered and tied xGA/GP fixtures and insufficient valid data. Acceptance: fewer expected goals allowed always improves percentile within an unchanged cohort; no separate network request for this card.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
