# 10 — Team Finishing

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P1; depends on 08 shared snapshots.

## Scope and evidence

Finishing displays 100×GF/xGF at five-on-five and ranks GF/xGF across teams. The explanatory text correctly describes over/under-performance context rather than permanent talent.

- [TeamPerformanceDrivers.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/TeamPerformanceDrivers.tsx)
- [teamPerformanceDriverModel.ts](/Users/tim/Code/fhfhockey.com/web/components/WiGO/teamPerformanceDriverModel.ts)

## Distinct implementation plan

1. Confirm actual GF and expected GF use identical strength, date cutoff and season. Treat zero/missing xGF as unavailable, never an infinite or fabricated percentile.

2. Check league midrank, tied ratios, valid cohort size and display: GF/xGF=1.10 should read 110.0%, while its percentile is a separate number.

3. Reuse snapshots from plan 08. Preserve the distinction between team finishing context and a player shooting/finishing rating in labels and tooltips.

## Verification and acceptance

Extend teamPerformanceDrivers.test.ts with GF=xGF, above/below expectation and zero denominator. Acceptance: ratio, percentile, status and explanation agree and remain visible in the redesigned layout.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
