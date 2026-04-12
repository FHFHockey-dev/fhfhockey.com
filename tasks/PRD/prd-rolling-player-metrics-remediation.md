# PRD: Rolling Player Metrics Remediation

## Introduction/Overview

This workstream remediates the rolling player metrics pipeline so stored rolling metrics match the product meaning described in [tasks/rolling-player-metrics-audit-notes.md](/Users/tim/Code/fhfhockey.com/tasks/rolling-player-metrics-audit-notes.md). The current pipeline has proven semantic and correctness defects, most notably in GP% handling for traded players, mixed `lastN` window contracts across metric families, and ambiguity around authoritative PP share semantics. The goal is to make the rolling metrics table correct, internally consistent, testable, and auditable even where that requires changing current behavior or introducing schema support fields.

## Goals

- Make all-strength GP% season metrics correct for traded players by aggregating across current-season stints instead of current-team-only buckets.
- Redefine rolling GP% windows as current-team chronological team-game windows.
- Split all-strength availability semantics from split-strength positive-TOI participation semantics.
- Redefine ratio-family and weighted-rate `lastN` behavior to use fixed appearance windows instead of last valid-observation windows.
- Establish one authoritative denominator contract for `pp_share_pct`.
- Preserve or add raw numerator/denominator support where the audit requires it for GP%, PP share, and opaque ratio families.
- Keep helper responsibilities coherent so rolling logic is defined once and reused consistently.
- Add focused automated coverage for each audited semantic fix.

## User Stories

- As a site user, I want season availability metrics to stay meaningful after a player trade so season metrics still reflect the player’s full season path.
- As a site user, I want rolling availability metrics to represent the last N team games for the player’s current team so recent availability is interpretable.
- As a site user, I want rolling performance ratios to use the player’s last N appearances so “last10” performance metrics refer to a fixed recency window instead of a hidden valid-row filter.
- As a data consumer, I want PP share metrics to have one clear team-share definition so I can compare rows without reverse-engineering denominators.
- As an engineer, I want raw numerator and denominator support for key ratio families so future audits and debugging can validate stored ratios directly.
- As an engineer, I want helper logic to encode metric contracts explicitly so orchestration code does not hide scope rules or window semantics.

## Functional Requirements

1. The system must treat [tasks/rolling-player-metrics-audit-notes.md](/Users/tim/Code/fhfhockey.com/tasks/rolling-player-metrics-audit-notes.md) as the authoritative contract for this remediation.
2. The system must preserve the API endpoint role of [web/pages/api/v1/db/update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts) as request parsing and delegation only unless audit-driven operational changes are required.
3. The system must update [web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts) so rolling window membership is driven by explicit metric-family contracts rather than mixed implicit behavior.
4. The system must implement all-strength GP% season-to-date semantics as player-centered aggregates across all current-season stints in scope.
5. The system must implement rolling all-strength GP% semantics as current-team last-N chronological team-game windows ending at the current row date.
6. The system must preserve row-scope numerator and denominator counts for GP% and, where required by the redesign, add raw support fields for season, career, three-year, and rolling GP% windows.
7. The system must define split-strength EV/PP/PK availability as participation-in-state based on positive TOI, not as ordinary games played, and must encode that distinction clearly in code and persisted outputs.
8. The system must redesign ratio-family and weighted-rate rolling windows so `lastN` uses fixed last-N appearances in the relevant strength state, then aggregates numerators and denominators inside that fixed window.
9. The system must stop allowing ratio-family `lastN` windows to silently shrink to last N valid observations because of denominator presence alone.
10. The system must keep additive counting metrics on appearance-window semantics unless the audit explicitly requires a different contract.
11. The system must resolve `pp_share_pct` against one authoritative team-share denominator source after comparing current WGO-inferred share logic with upstream PP builder fields.
12. The system must keep PP team-share semantics separate from PP unit-relative role context such as `pp_unit`, `percentageOfPP`, `pp_unit_usage_index`, `pp_unit_relative_toi`, and `pp_vs_unit_avg`.
13. The system must prefer direct raw ixG accumulation over fallback rate reconstruction wherever audited source coverage allows it.
14. The system must update directly relevant helpers if the new contract belongs in helper logic rather than inline orchestration, including GP% history, ratio aggregation, TOI normalization, PP share reconstruction, and diagnostics.
15. The system must add or update schema support when existing columns cannot represent the intended semantics cleanly, including migrations if new raw support fields or renamed/replacement fields are required.
16. The system must search and update dependent code paths so changed helper contracts, fields, or semantics stay coherent across the repository.
17. The system must add or update focused tests covering GP% redesign, traded-player season handling, ratio-family `lastN` semantics, PP share authority, and helper-level aggregation behavior.
18. The system must run relevant tests after each parent implementation task and the full `web` test suite after each parent task is complete.
19. The system must finish with a full re-read of the audit notes and verify that all actionable remediation items are addressed.

## Non-Goals (Out of Scope)

- Redesigning unrelated line-combination context logic beyond changes required to keep rolling-player rows coherent.
- Reworking unrelated endpoint infrastructure or cron audit wrappers.
- Shipping optional metric additions from the audit before core correctness issues are resolved.
- Large UI/API contract migrations beyond the minimum changes required to support correct storage and tested semantics in this workstream.
- Treating existing stored values as correct solely for backward compatibility when the audit has already proven the semantics wrong.

## Design Considerations

- The endpoint wrapper should remain thin; metric logic belongs in helpers and the rolling pipeline.
- Naming should reflect meaning. If legacy columns remain for compatibility, the implementation should still establish canonical internal semantics and raw support fields.
- Helper boundaries should remain explicit:
  - `fetchRollingPlayerAverages.ts` owns orchestration and metric-family contracts.
  - `rollingMetricAggregation.ts` owns ratio aggregation and rolling ratio window behavior.
  - `rollingHistoricalAverages.ts` owns historical simple averages and GP% history.
  - `rollingPlayerMetricMath.ts` owns component reconstruction for weighted metrics and share metrics.
  - diagnostics remain observability infrastructure, not metric math.

## Technical Considerations

- Existing GP% history is team-bucketed by `season:teamId`; that must change for season semantics across stints.
- Existing ratio rolling windows only accumulate rows with valid denominators; that helper likely requires contract-aware fixed-window support.
- Rolling GP% and ratio-family windows currently follow different models; the redesign should make those models explicit and testable.
- Schema changes may be required to:
  - preserve raw GP% numerators and denominators by scope
  - preserve raw ratio-family numerators and denominators where auditability is required
  - separate availability from split-strength participation semantics
- Existing target-table resume and upsert logic must remain operational after any schema changes.
- Validation should emphasize refreshed-row correctness over preserving current stored outputs.

## Success Metrics

- Fresh recomputes match the audit’s intended GP% semantics for traded-player scenarios, including the canonical Corey Perry case.
- Fresh recomputes match fixed-appearance-window ratio-family `lastN` semantics for validated ratio families.
- `pp_share_pct` has one documented, tested authoritative denominator contract.
- Focused helper tests cover the semantic contracts that were previously implicit or wrong.
- Full `web` test runs pass after each parent remediation task.
- Final audit re-read finds no unaddressed required remediation items.

## Open Questions

- Whether legacy alias GP% columns should remain populated as compatibility aliases or be deprecated immediately if schema changes make canonical replacements available.
- Whether raw numerator/denominator persistence for non-GP ratio families should be limited to the highest-value audited families in this change set or expanded to the broader recommended set if migrations are already required.
- Whether split-strength participation should be implemented only as clarified semantics behind existing columns in this workstream or accompanied by new clearer field names in the same migration.
