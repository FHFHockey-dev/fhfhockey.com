# Rolling Player Audit Re-Read Completeness Report

Date: March 11, 2026

## Purpose

This artifact fulfills the PRD’s final audit re-read requirement by re-reading [rolling-player-metrics-audit-notes.md](/Users/tim/Code/fhfhockey.com/tasks/rolling-player-metrics-audit-notes.md) and classifying every actionable remediation item as one of:

- implemented
- intentionally deferred as optional
- intentionally deferred as follow-up
- unresolved

This check is limited to actionable remediation items from the audit itself.
Operational side findings discovered later but not defined as audit remediation items are not treated as audit-completion blockers here.

## Re-Read Outcome

### Implemented

The following audit-defined remediation areas are implemented:

1. Source precedence and merge-contract hardening
   - WGO row-spine preserved
   - additive-family source precedence centralized
   - source-presence and fallback state made explicit
   - coverage and source-tracking summaries retained and expanded
   - evidence:
     - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
     - [rollingPlayerSourceSelection.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts)
2. GP% / availability redesign
   - all-strength availability separated from split-strength participation
   - traded-player season semantics fixed
   - current-team rolling team-game windows preserved and regression-tested
   - raw GP numerator / denominator support fields emitted
   - evidence:
     - [rollingPlayerAvailabilityContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts)
     - [rollingHistoricalAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts)
     - [rolling-player-disputed-metrics-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-disputed-metrics-report-2026-03-11.md)
3. Ratio-family `lastN` redesign
   - canonical window families defined in code
   - ratio and weighted `/60` windows forced onto fixed appearance-window semantics
   - missing-component rules made explicit
   - denominator-null vs denominator-zero behavior made explicit
   - evidence:
     - [rollingWindowContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingWindowContract.ts)
     - [rollingMetricAggregation.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts)
4. `pp_share_pct` semantic cleanup
   - authoritative contract moved to builder `pp_share_of_team` plus `PPTOI`
   - unit-relative semantics explicitly separated from team-share semantics
   - PP context inputs sanitized before rolling use
   - evidence:
     - [rollingPlayerPpShareContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts)
     - [rollingPlayerPpUnitContract.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpUnitContract.ts)
5. `ixg_per_60` fallback hardening
   - raw ixG preference made explicit
   - rate reconstruction made explicit and diagnosable
   - validation confirmed current-code parity on ready cases
   - evidence:
     - [rollingPlayerMetricMath.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts)
     - [rolling-player-disputed-metrics-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-disputed-metrics-report-2026-03-11.md)
6. Schema and naming cleanup
   - canonical availability, participation, ratio, and weighted `/60` fields introduced
   - misleading alias families documented and compatibility-managed
   - generated Supabase types aligned locally with the migration surface
   - evidence:
     - [20260311_add_canonical_rolling_player_metric_contract_fields.sql](/Users/tim/Code/fhfhockey.com/migrations/20260311_add_canonical_rolling_player_metric_contract_fields.sql)
     - [rolling-player-metrics-migration-plan.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-metrics-migration-plan.md)
     - [rolling-player-game-metrics-schema-surface-audit.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-game-metrics-schema-surface-audit.md)
7. Raw numerator / denominator support for opaque ratio families
   - support fields added and populated for the audited ratio and weighted `/60` families
   - evidence:
     - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
     - [rolling-player-disputed-metrics-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-disputed-metrics-report-2026-03-11.md)
8. Context-label validation
   - `pp_unit`, `line_combo_slot`, and `line_combo_group` validated against refreshed builder outputs
   - fields preserved as contextual labels rather than arithmetic metrics
   - evidence:
     - [rolling-player-context-label-validation-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-context-label-validation-report-2026-03-11.md)
9. Observability and run-quality improvements
   - coverage, suspicious-output, unknown-game, GP-window, ratio-window, TOI, stale-tail, run-summary, and phase logs expanded
   - diagnostic noise from raw support fields removed
   - evidence:
     - [rollingPlayerPipelineDiagnostics.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts)
     - [rolling-player-validation-mismatch-classification-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-validation-mismatch-classification-report-2026-03-11.md)
10. Required live validation framework
   - freshness checks added
   - refresh-action workflow executed
   - family-level comparison completed
   - disputed metrics validated explicitly
   - mismatch cause buckets recorded
   - evidence:
     - [rolling-player-validation-freshness-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-validation-freshness-report-2026-03-11.md)
     - [rolling-player-refresh-actions-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-refresh-actions-report-2026-03-11.md)
     - [rolling-player-family-reconstruction-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-family-reconstruction-report-2026-03-11.md)
     - [rolling-player-disputed-metrics-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-disputed-metrics-report-2026-03-11.md)

### Intentionally Deferred as Optional

The audit explicitly separated these as optional post-correctness enhancements, and they remain deferred intentionally:

1. `on_ice_sv_pct`
2. raw zone-start counts
3. raw on-ice goal / shot counts
4. `goals_per_60`
5. `assists_per_60`
6. first- and second-assist rate families
7. PP unit-relative role fields on rolling rows:
   - `pp_unit_usage_index`
   - `pp_unit_relative_toi`
   - `pp_vs_unit_avg`
8. explicit rolling `pp_share_of_team` field

These map directly to the audit’s optional additions section and the task list’s `8.0` phase.

### Intentionally Deferred as Follow-Up

The following items are not unresolved audit-remediation gaps, but they remain follow-up work after the required remediation:

1. Freshness-blocked validation surfaces
   - Corey Perry PK-sensitive validation remains blocked by stale upstream PK NST source tails
   - Seth Jones remains the intentional incomplete-tail proxy with an external PK freshness blocker
   - these were explicitly classified in:
     - [rolling-player-validation-mismatch-classification-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-validation-mismatch-classification-report-2026-03-11.md)
2. Broad historical coverage completion
   - current-season coverage is complete
   - all-time historical coverage improved materially but is still an operational backfill concern, not an audit-defined correctness-contract blocker
3. Any future operational remediation for post-audit side findings
   - for example, the later-discovered unknown-`game_id` team-game-slot collision should be tracked separately from this audit signoff because it was not one of the original audit-defined remediation items

### Unresolved

Required actionable audit items still unresolved:

- none

## Traceability Summary

Audit remediation-plan area to final disposition:

- GP% redesign: `implemented`
- ratio-family `lastN` cleanup: `implemented`
- `pp_share_pct` denominator decision: `implemented`
- `ixg_per_60` fallback hardening: `implemented`
- alias / schema simplification: `implemented`
- raw numerator / denominator support fields: `implemented`
- observability persistence / exportability: `implemented`
- long-run progress visibility: `implemented`
- optional support-metric additions: `intentionally deferred as optional`
- optional richer PP role fields: `intentionally deferred as optional`

## Completion Rule Result

Result:

- no required actionable audit item remains unresolved
- the remaining deferred items are either:
  - explicitly optional by audit design
  - explicitly follow-up / external-blocker items in the validation workflow

## Conclusion

`7.8` final audit re-read result:

- required audit remediation items: addressed
- optional audit additions: intentionally deferred to the optional phase
- follow-up validation / operational items: explicitly documented
- unresolved required audit items: none
