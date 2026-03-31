## Relevant Files

- `tasks/tasks-xg-release-remediation.md` - Execution plan for fixing the release blockers that currently prevent baseline-model training.
- `tasks/artifacts/xg-baseline-validation-2026-03-30.md` - Validation evidence showing the current raw-identity and parity failures.
- `tasks/artifacts/xg-release-blockers-2026-03-30.md` - Current minimal blocker list for training-use release approval.
- `tasks/artifacts/xg-release-blockers-2026-03-31.md` - Updated blocker list after the formal release batch, showing that raw validation and metadata packaging are resolved and the remaining blocker is the still-failing formal parity verdict.
- `tasks/artifacts/xg-release-gate-verdict-2026-03-30.md` - Dated decision recording that the release gate is not satisfied.
- `tasks/artifacts/xg-release-gate-verdict-2026-03-31.md` - Updated dated verdict after the formal release batch, recording that the gate is still not satisfied because the release artifact remains in a failed parity state.
- `tasks/artifacts/xg-release-validation-2026-03-31.md` - Formal release-batch validation artifact for the intended training sample, including metadata, pass/fail status, and approved exception references.
- `tasks/artifacts/xg-event-id-root-cause-2026-03-30.md` - Root-cause analysis for the sampled `event_id` validation failure.
- `tasks/artifacts/xg-event-id-remediation-2026-03-30.md` - Dated remediation record showing the event-id validation path is fixed and revalidated.
- `tasks/artifacts/xg-parity-root-causes-2026-03-30.md` - Root-cause analysis for the sampled exact-count parity failures.
- `tasks/artifacts/xg-toi-on-ice-resolution-2026-03-30.md` - Resolution record for duplicate-window TOI inflation and remaining NHL-vs-legacy TOI differences.
- `tasks/artifacts/xg-parity-rerun-2026-03-30.md` - Rerun evidence showing that raw validation now passes but exact skater parity still fails broadly enough that task `2.4` remains open.
- `tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md` - Final exact-family disposition record showing the remaining sampled mismatches are now either fixed or covered by explicit documented NHL-correctness exceptions.
- `tasks/artifacts/xg-on-ice-root-causes-2026-03-30.md` - Representative root-cause analysis for the broad `counts_oi` drift, separating a real zone-start bug from shift-boundary convention differences and validator noise.
- `tasks/artifacts/xg-on-ice-policy-decision-2026-03-30.md` - Dated decision recording that on-ice and zone-start metrics stay in scope but frozen NST-only boundary conventions are retired as approved NHL-correctness divergences.
- `tasks/artifacts/xg-on-ice-rerun-2026-03-30.md` - Post-fix rerun evidence showing the zone-start overcount is resolved and the remaining `counts_oi` drift is now bounded to documented policy differences.
- `tasks/artifacts/xg-individual-root-causes-2026-03-30.md` - Root-cause analysis showing the remaining individual exact-count drift is now mostly frozen-NST versus NHL event-credit or classification disagreement rather than a new parity-engine bug.
- `tasks/artifacts/xg-individual-policy-decision-2026-03-30.md` - Dated decision recording that the remaining investigated individual exact-count residuals are approved NHL-correctness divergences unless a concrete parser or inclusion bug is later shown.
- `tasks/artifacts/xg-individual-rerun-2026-03-30.md` - Rerun evidence showing that no new true-bug individual exact-count drift remains after the root-cause trace and policy decision.
- `tasks/validation-checklist.md` - Formal checklist the remediation work must satisfy before training can begin.
- `web/scripts/run-nhl-xg-release-validation.ts` - Repeatable in-repo release-validation runner that records checklist-required metadata and produces markdown validation reports.
- `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts` - Current parser that must preserve upstream event identity correctly.
- `web/lib/supabase/Upserts/nhlRawGamecenter.mjs` - Current raw-ingest and normalized-upsert path that may be rewriting event identity incorrectly.
- `web/lib/supabase/Upserts/nhlNstParityMetrics.ts` - Current parity engine with exact-metric drift that must be traced and corrected.
- `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts` - Regression coverage for parity reconstruction, including the zone-start fix under NHL-derived on-ice logic.
- `web/lib/supabase/Upserts/nhlOnIceAttribution.ts` - On-ice attribution layer likely involved in TOI and on-ice parity drift.
- `web/lib/supabase/Upserts/nhlShiftStints.ts` - Shift-to-stint logic likely involved in TOI and manpower-segment drift.
- `web/lib/supabase/Upserts/nhlXgValidation.ts` - Validation helpers that should become the formal release-batch runner.

### Notes

- Do not start any model-family work from `tasks/tasks-xg-baseline-options.md` until this remediation list is complete and the release gate is re-evaluated as satisfied.
- Treat raw event identity and exact-count parity as blocking correctness issues, not approximation-policy issues.
- The final remediation package must produce a complete formal validation artifact with the metadata required by `tasks/validation-checklist.md`.

## Tasks

- [x] 1.0 Fix raw event identity alignment between raw play-by-play and normalized event rows
  - [x] 1.1 Inspect the current parser and ingest path to identify why stored `nhl_api_pbp_events.event_id` does not equal upstream raw `play-by-play` `eventId`.
  - [x] 1.2 Correct the parser and/or ingest contract so normalized `event_id` preserves the upstream raw event identity.
  - [x] 1.3 Re-ingest a representative sample and prove that raw-vs-normalized validation now passes event-id reconciliation, not just count reconciliation.
  - [x] 1.4 Record the fix, affected versions, and validation evidence in a dated artifact.

- [x] 2.0 Fix exact-subset parity drift on the sampled legacy-overlap set
  - [x] 2.1 Trace representative exact-count mismatches back to root causes across parsing, inclusion rules, on-ice attribution, and TOI segmentation.
  - [x] 2.2 Correct skater exact-count drift for shot, faceoff, hit, giveaway/takeaway, assist/point, and penalty families.
  - [x] 2.3 Correct TOI and on-ice exact-count drift caused by shift normalization, stint reconstruction, or strength-segment overlap logic.
  - [x] 2.4 Re-run sampled parity validation and prove that exact families pass or have explicitly approved, documented exceptions.

- [ ] 3.0 Turn the current validation package into a formal release-batch record
  - [x] 3.1 Build or formalize a repeatable validation runner that captures the metadata required by `tasks/validation-checklist.md`.
  - [x] 3.2 Run the full release validation batch on the intended training sample with explicit `parser_version`, `strength_version`, `feature_version`, `parity_version`, environment, season range, and commit SHA.
  - [x] 3.3 Publish a dated release-validation artifact that records pass/fail status, approved exceptions if any, and links to supporting audit evidence.

- [ ] 4.0 Re-evaluate the training-use release gate after remediation
  - [x] 4.1 Re-review the validation artifact against `tasks/validation-checklist.md` and list any remaining blockers.
  - [x] 4.2 Record a new dated release-gate verdict for training use.
  - [ ] 4.3 If and only if the verdict is satisfied, resume `tasks/tasks-xg-baseline-options.md` at task `2.0`.

- [ ] 5.0 Resolve broad `nst_gamelog_as_counts_oi` exact-parity drift on the legacy-overlap set
  - [x] 5.1 Trace representative `cf/ca`, `ff/fa`, `sf/sa`, `gf/ga`, and zone-start mismatches back to on-ice attribution, event inclusion, or frozen-NST definition differences.
  - [x] 5.2 Decide whether frozen NST on-ice and zone-start definitions must still be matched exactly or should be retired as approved NHL-correctness divergences.
  - [ ] 5.3 If exact matching remains required, correct the on-ice and zone-start parity logic and rerun sampled validation.

- [x] 6.0 Resolve the remaining individual exact-count parity drift after the shift-layer fixes
  - [x] 6.1 Trace the residual `shots_blocked`, `shots`, `icf`, `iff`, faceoff, penalty, hit, giveaway, and takeaway mismatches to exact event-definition differences.
  - [x] 6.2 Decide which remaining residual mismatches are true bugs versus approved NHL-correctness divergences and document the decision.
  - [x] 6.3 Correct any remaining true-bug exact-count drift and rerun sampled validation.

- [ ] 7.0 Normalize legacy null-versus-zero comparison rules in parity validation where the frozen NST surface stores unset exact-count fields as `NULL`
  - [x] 7.1 Decide whether `NULL` and `0` should compare equal for legacy `counts_oi.shots_blocked`.
  - [ ] 7.2 If approved, update the parity validator and rerun the sampled comparison so `shots_blocked` does not inflate the on-ice error surface artificially.

- [x] 8.0 Fix real on-ice implementation bugs while keeping NHL-derived boundary behavior as the source of truth
  - [x] 8.1 Correct the zone-start logic so it no longer treats every on-ice faceoff as a zone start.
  - [x] 8.2 Rerun sampled on-ice parity and document which remaining `counts_oi` drifts are now limited to approved NHL-correctness divergences.
