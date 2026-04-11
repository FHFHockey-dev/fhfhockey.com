## Relevant Files

- `tasks/tasks-xg-baseline-options.md` - Completed baseline-options execution queue through the first decision pass.
- `tasks/artifacts/xg-first-baseline-decision-2026-03-31.md` - Records that no first baseline is approved yet.
- `tasks/artifacts/xg-first-baseline-decision-2026-03-31-repaired.md` - Fresh post-repair approval decision using the leakage-free rerun.
- `tasks/artifacts/xg-baseline-benchmark-summary-2026-03-31.md` - Current benchmark summary with provisional winner/runner-up and rejection reasons.
- `tasks/artifacts/xg-calibration-review-2026-03-31.md` - Current calibration review showing exploratory gains but no adoptable calibrated result.
- `tasks/artifacts/xg-baseline-benchmark-summary-2026-03-31-repaired.md` - Repaired benchmark summary after removing leaked event-class features.
- `tasks/artifacts/xg-calibration-review-2026-03-31-repaired.md` - Repaired calibration review for the leakage-free rerun.
- `tasks/artifacts/xg-calibration-requirement-reassessment-2026-03-31.md` - Explicit reassessment that post-calibration is still required after the repaired rerun.
- `tasks/artifacts/xg-calibration-path-decision-2026-03-31.md` - Decision that `Platt` is the first calibration path to carry forward, without treating it as adopted yet.
- `tasks/artifacts/xg-approval-grade-test-split-policy-2026-03-31.md` - Enforced rule that approval-grade benchmark artifacts must have a non-empty dedicated `test` split.
- `tasks/artifacts/xg-calibration-acceptance-rules-2026-03-31.md` - Explicit holdout-positive and slice-coverage rules for calibration adoptability.
- `tasks/artifacts/xg-rebound-geometry-benchmark-2026-03-31.md` - Benchmark result for the richer rebound geometry rerun.
- `tasks/artifacts/xg-handedness-benchmark-2026-03-31.md` - Benchmark result for shooter/goalie handedness joins and matchup features.
- `tasks/artifacts/xg-roster-position-benchmark-2026-03-31.md` - Benchmark result for shooter roster-position context.
- `tasks/artifacts/xg-deployment-context-2026-03-31.md` - Stable-enough decision and feature surface for coarse deployment and matchup context.
- `tasks/artifacts/xg-shift-fatigue-history-2026-03-31.md` - Stable public-data extension for prior-shift fatigue history features.
- `tasks/artifacts/xg-score-effects-game-time-2026-03-31.md` - Feature-surface addition for score-effects by game-time interaction fields.
- `tasks/artifacts/xg-medium-context-benchmark-2026-03-31.md` - Reference-relative benchmark of deployment, prior-shift fatigue, and score-effects-by-time additions.
- `tasks/artifacts/xg-blocked-shot-cohort-study-2026-03-31.md` - Decision record for keeping blocked shots out of the current binary training cohort.
- `tasks/artifacts/xg-miss-reason-treatment-study-2026-03-31.md` - Decision record for keeping current miss-reason treatment unchanged until approval-grade evidence exists.
- `tasks/artifacts/xg-goalie-follow-up-gate-2026-03-31.md` - Gate record deferring goalie-specific modeling until the skater-shot baseline is approved.
- `tasks/artifacts/xg-downstream-reader-order-2026-03-31.md` - Ordered rollout decision for which readers should consume an approved xG baseline first.
- `tasks/artifacts/xg-calibrated-artifact-storage-decision-2026-03-31.md` - Decision record requiring separate versioned calibration artifact identity from the base model artifact.
- `tasks/artifacts/xg-refresh-cadence-policy-2026-03-31.md` - Policy for weekly retrains, ad hoc repair runs, and benchmark refreshes.
- `tasks/artifacts/xg-rollout-health-checks-2026-03-31.md` - Required rollout health surface for validation drift, calibration drift, and upstream feature-contract drift.
- `tasks/artifacts/xg-second-pass-feature-followups-2026-03-31.md` - Ordered list of feature follow-ups for the next model pass.
- `tasks/artifacts/xg-goalie-baseline-decision-2026-03-31.md` - Decision that goalie-facing work should reuse the skater-shot baseline.
- `tasks/xg-training-feature-contract.md` - Current baseline feature contract that still needs leakage repair.
- `tasks/post-foundation-follow-ups.md` - Broader post-foundation queue that this task list operationalizes.
- `web/lib/xg/baselineDataset.ts` - Baseline dataset shaping and feature encoding.
- `web/lib/xg/deploymentContext.ts` - Coarse on-ice deployment and matchup context derivation.
- `web/lib/supabase/Upserts/nhlContextualFeatures.ts` - Current contextual feature derivation, including fatigue proxies.
- `web/lib/xg/calibration.ts` - Calibration assessment helpers.
- `web/scripts/train-nhl-xg-baseline.ts` - Baseline training entrypoint.
- `web/scripts/benchmark-nhl-xg-baselines.ts` - Shared benchmark runner.

### Notes

- This queue starts from the current state: no first baseline is approved yet.
- The first block of work is contract repair, not new feature expansion.
- Do not declare a winner until the repaired feature contract has been rerun through the full benchmark and calibration cycle.

## Tasks

- [x] 1.0 Repair the current baseline contract so approval work can resume on clean evidence
  - [x] 1.1 Remove direct label leakage from the training feature contract, including current-shot event-class usage that trivially reveals the label.
  - [x] 1.2 Update the baseline dataset/training harness so the repaired feature contract is enforced in generated artifacts.
  - [x] 1.3 Regenerate the baseline artifacts for `logistic_unregularized`, `logistic_l2`, and `xgboost_js` on the repaired contract.
  - [x] 1.4 Rerun the benchmark and calibration review on the repaired contract and publish dated artifacts.
  - [x] 1.5 Record a fresh first-baseline approval decision after the repaired rerun.

- [ ] 2.0 Harden calibration and evaluation once the repaired rerun exists
  - [x] 2.1 Reassess whether post-calibration is required under the repaired feature contract.
  - [x] 2.2 Decide whether `Platt`, `isotonic`, or no post-calibration is the first adoptable calibration approach once leakage is removed.
  - [x] 2.3 Require a non-empty dedicated `test` split for future approval-grade benchmark artifacts.
  - [x] 2.4 Add acceptance rules for minimum holdout-positive coverage and slice coverage before a calibration result can be treated as adoptable.

- [x] 3.0 Evaluate the highest-priority second-pass feature additions
  - [x] 3.1 Add richer rebound geometry features and benchmark their impact.
  - [x] 3.2 Add possession-chain context features and benchmark their impact.
  - [x] 3.3 Add score-state context features and benchmark their impact.
  - [x] 3.4 Add shooter/goalie handedness joins and benchmark their impact.
  - [x] 3.5 Add roster-position context and benchmark its impact.
  - [x] 3.6 If the second-pass set is promising, version the expanded feature family under a new training artifact configuration.

- [x] 4.0 Evaluate medium-priority contextual additions after the high-priority set is stable
  - [x] 4.1 Add deployment and matchup context features if on-ice joins are stable enough.
  - [x] 4.2 Add richer shift-fatigue history features beyond current shift age.
  - [x] 4.3 Add score-effects by game-time interaction features.
  - [x] 4.4 Benchmark each addition against the current approved feature set rather than only against raw holdout numbers.

- [x] 5.0 Queue the research-only modeling questions that should not block the next clean approval pass
  - [x] 5.1 Study blocked-shot cohort handling as excluded rows, contextual rows, or separate modeled class.
  - [x] 5.2 Study miss-reason treatment changes only if they materially improve model quality on clean reruns.
  - [x] 5.3 Evaluate goalie-specific additions only after the skater-shot baseline is approved, reusing that baseline as the shot-value engine.

- [x] 6.0 Plan downstream rollout only after a baseline is actually approved
  - [x] 6.1 Choose the first downstream readers that should consume the approved xG baseline.
  - [x] 6.2 Decide whether calibrated outputs need separate persisted model metadata or artifact storage.
  - [x] 6.3 Define refresh cadence and rerun policy for current-season retrains, repair runs, and benchmark refreshes.
  - [x] 6.4 Add rollout health checks for validation drift, calibration drift, and upstream feature-contract drift.
