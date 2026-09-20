# 11 — Team Special Teams

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; depends on 08 shared snapshots.

## Scope and evidence

wgo_team_stats provides season-filtered PP% and PK%. Composite is the arithmetic mean of separate league PP and PK percentiles, not mean raw percentages. The displayed percentage helper infers units from magnitude.

- [TeamPerformanceDrivers.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/TeamPerformanceDrivers.tsx)
- [teamPerformanceDriverModel.ts](/Users/tim/Code/fhfhockey.com/web/components/WiGO/teamPerformanceDriverModel.ts)

## Distinct implementation plan

1. Verify PP goals/opportunities and successful kills/opportunities against canonical team records. Fix the source unit contract before replacing magnitude-based percentage conversion.

2. Validate cohort alignment, latest dates, missing one side and minimum valid sample. Keep this equal-weight team composite separate from the player ratings’ TOI-weighted special-teams result.

3. Reuse shared snapshots; compute both ranks once per snapshot. Show PP%, PK%, combined percentile and the source window without extra fetches.

## Verification and acceptance

Extend teamPerformanceDrivers.test.ts for ties, decimal versus percentage-point contract fixtures, missing PP/PK and known combined percentiles. Acceptance: displayed PP/PK and composite are independently reproducible and team-scoped.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
