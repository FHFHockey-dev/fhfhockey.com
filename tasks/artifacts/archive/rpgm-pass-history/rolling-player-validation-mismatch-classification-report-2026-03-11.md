# Rolling Player Validation Mismatch Classification Report

Date: March 11, 2026

## Purpose

This artifact records the remaining non-pass validation outcomes, if any, using the PRD-required cause buckets:

- stale source
- stale target
- logic defect
- schema-contract issue
- external blocker

It is based on the live validation evidence captured in:

- [rolling-player-validation-freshness-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-validation-freshness-report-2026-03-11.md)
- [rolling-player-refresh-actions-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-refresh-actions-report-2026-03-11.md)
- [rolling-player-family-reconstruction-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-family-reconstruction-report-2026-03-11.md)
- [rolling-player-disputed-metrics-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-disputed-metrics-report-2026-03-11.md)
- [rolling-player-context-label-validation-report-2026-03-11.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-context-label-validation-report-2026-03-11.md)

## Classification Summary

### Stale Source

Recorded residual items:

- Corey Perry (`8470621`), PK-sensitive validation surfaces
  - classification: `stale source`
  - evidence:
    - WGO latest date: `2026-03-10`
    - latest PK NST counts/rates/counts-on-ice dates remained `2026-03-08`
    - narrow refresh actions completed successfully but did not advance the PK tail
  - scope impact:
    - PK-specific family validation remains blocked
    - all-strength, EV, PP, GP/availability, disputed metrics, and context labels were still validated successfully
  - current cause judgment:
    - upstream source freshness lag, not a stored-row mismatch

### Stale Target

Recorded residual items:

- none

Evidence:

- the freshness workflow explicitly found that target `rolling_player_game_metrics` dates matched the latest WGO dates for the validation players
- the validation workflow did not rely on stale target rows as correctness evidence

### Logic Defect

Recorded residual items:

- none in the March 11, 2026 live validation set

Evidence:

- ready-case family reconstruction passed for Brent Burns and Jesper Bratt
- disputed-metric validation passed for Corey Perry, Brent Burns, and Jesper Bratt in the ready scopes
- context-label validation passed for all four validation cases

Interpretation:

- no remaining stored-vs-recomputed validation failure in this signoff set currently points to an unclassified live logic defect
- previously discovered logic issues were remediated earlier in the workstream and did not reappear in the post-remediation validation runs

### Schema-Contract Issue

Recorded residual items:

- none in the post-migration-aligned validation set

Evidence:

- the canonical availability, participation, ratio, weighted `/60`, and support-field surfaces compared cleanly in stored-vs-recomputed validation
- no live validation failure pointed to missing, misnamed, or semantically inconsistent columns in the validated environment after the applied schema fixes

Note:

- earlier environment drift around missing canonical availability columns was a runtime environment issue during refresh operations, but it was not a remaining validation mismatch in the final post-remediation evidence set

### External Blocker

Recorded residual items:

- Seth Jones (`8477495`), PK-sensitive validation surfaces
  - classification: `external blocker`
  - evidence:
    - WGO latest date: `2026-01-02`
    - latest PK NST counts/rates/counts-on-ice dates remained `2025-12-30`
    - the current endpoint surface does not provide a narrow refresh path that cleanly advances this retained proxy case without a broader historical forward crawl
  - scope impact:
    - Jones remains intentionally blocked for PK-sensitive validation
    - Jones still remains valid as the incomplete-source-tail proxy case required by the PRD

## Remaining Non-Pass Items

The only remaining non-pass items are:

- Corey Perry PK-sensitive validation: `stale source`
- Seth Jones PK-sensitive validation: `external blocker`

No remaining non-pass item is classified as:

- `stale target`
- `logic defect`
- `schema-contract issue`

## Signoff Interpretation

For the March 11, 2026 validation pass:

- all completed stored-vs-recomputed comparisons passed
- all remaining non-pass items were classified
- the remaining non-pass items are freshness-related blockers, not unexplained mismatches
- the blocked items are explicitly documented rather than silently skipped

## Conclusion

`7.7` mismatch-classification status:

- classification completed
- no unresolved unbucketed mismatches remain
- residual blockers are fully explained as:
  - Corey Perry PK tail: `stale source`
  - Seth Jones PK proxy case: `external blocker`
