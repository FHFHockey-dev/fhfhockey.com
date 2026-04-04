## Relevant Files

- `tasks/tasks-xg-baseline-options.md` - Execution plan for validating release readiness and evaluating first-pass xG baseline model options.
- `tasks/post-foundation-follow-ups.md` - Source document for the approved post-foundation queue, including baseline-model options.
- `tasks/validation-checklist.md` - Release-gate checklist that must pass before training or rollout work begins.
- `tasks/final-implementation-summary.md` - Current status summary of what is complete, approximate, deferred, and still blocking release.
- `tasks/prd-nhl-api-xg-model.md` - PRD for the NHL API xG data foundation and release-gate requirements.
- `tasks/definitions-and-parity.md` - Canonical rules for exclusions, feature semantics, and versioning that training logic must respect.
- `tasks/data-contract-boundaries.md` - Boundary contract separating raw, normalized, feature, and parity layers.
- `tasks/post-drift-retry-verification.md` - Latest operational verification that raw ingest, schema, and generated types are aligned.
- `tasks/xg-training-dataset-contract.md` - Canonical first-pass training dataset contract defining row grain, label, and split strategy for baseline comparisons.
- `tasks/xg-training-feature-contract.md` - Canonical first-pass feature contract defining mandatory, optional, and excluded shot-feature columns for baseline training.
- `tasks/xg-training-materialization-decision.md` - Decision record that baseline datasets will be stored as versioned artifacts rather than generated only on demand.
- `tasks/artifacts/xg-baseline-validation-2026-03-30.md` - Dated release-gate validation artifact for the intended baseline-training sample.
- `tasks/artifacts/xg-release-blockers-2026-03-30.md` - Dated blocker list for the current baseline-training release-gate review.
- `tasks/artifacts/xg-release-gate-verdict-2026-03-30.md` - Dated release-gate decision for whether baseline-model training may begin.
- `tasks/tasks-xg-release-remediation.md` - Required remediation queue that must be completed before any baseline-model work resumes.
- `tasks/artifacts/xg-release-validation-2026-03-31-v2.md` - Current exception-aware release-validation artifact showing training-use release readiness for the active version tuple.
- `tasks/artifacts/xg-release-blockers-2026-03-31-v2.md` - Current blocker review showing no remaining training-use blockers.
- `tasks/artifacts/xg-release-gate-verdict-2026-03-31-v2.md` - Current dated verdict recording that the training-use release gate is now satisfied.
- `tasks/tasks-xg-release-exception-resolution.md` - Release-policy resolution track that unblocked resumption of baseline-model work.
- `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts` - Current builder for versioned shot-feature rows that baseline models will consume.
- `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts` - Unit tests covering integrated shot-feature assembly.
- `web/lib/xg/baselineDataset.ts` - Baseline dataset shaping and chronological split logic for xG training artifacts.
- `web/lib/xg/binaryLogistic.ts` - Minimal binary logistic trainer used by the first baseline-training harness.
- `web/lib/supabase/Upserts/nhlXgValidation.ts` - Existing validation helpers for normalized-event parity and NST comparison.
- `web/lib/supabase/Upserts/nhlXgValidation.test.ts` - Unit tests for event-count and parity validation helpers.
- `web/scripts/train-nhl-xg-baseline.ts` - Reproducible baseline-training entrypoint that reads validated NHL-derived rows and writes versioned dataset/model artifacts.
- `web/lib/supabase/database-generated.types.ts` - Current generated database types for future feature/training table additions.
- `migrations/XXXXXXXXXXXX_create_nhl_shot_features_tables.sql` - Planned migration slot for derived shot-feature storage if persisted training datasets are added.
- `migrations/XXXXXXXXXXXX_create_nhl_metric_parity_tables.sql` - Planned migration slot for published parity surfaces used during benchmarking comparisons.

### Notes

- Use `npx vitest run [optional/path/to/test/file]` for focused tests and `npm run test:full` in `web/` for the full suite.
- Do not begin model training work unless task `1.0` concludes that the release gate is satisfied for training use.
- Keep baseline-model experimentation separate from parity publication logic and separate from parser/feature versioning.
- Treat logistic regression, regularized logistic regression, and gradient boosting as candidate baselines; do not assume the winner before benchmarking.
- Tasks `2.0` through `8.0` are now active because the updated release verdict in `tasks/artifacts/xg-release-gate-verdict-2026-03-31-v2.md` records `release gate satisfied`.

## Tasks

- [x] 1.0 Test the current data foundation and verify whether the release gate is satisfied
  - [x] 1.1 Run the formal validation package against the intended training sample, including raw-vs-normalized checks, parity checks, and manual-audit references.
  - [x] 1.2 Review `tasks/validation-checklist.md`, `tasks/final-implementation-summary.md`, and the latest verification artifacts to list any unresolved release blockers.
  - [x] 1.3 Record an explicit verdict of `release gate satisfied` or `release gate not satisfied` for training use, with dated rationale and approved exceptions if any.
  - [x] 1.4 If the gate is not satisfied, stop baseline-model work and create remediation tasks before proceeding.

- [ ] 2.0 If and only if the release gate is satisfied, define the first training dataset contract
  - [x] 2.1 Lock the canonical training-row grain, label definition, and season split strategy for the first xG baseline comparison.
  - [x] 2.2 Define which shot-feature columns are mandatory, optional, or excluded for baseline training.
  - [x] 2.3 Specify dataset lineage requirements, including `parser_version`, `strength_version`, `feature_version`, and source commit SHA.
  - [x] 2.4 Decide whether training datasets will be generated on demand or stored in a versioned table/file artifact.

- [ ] 3.0 Build the shared baseline-training harness before fitting any model family
  - [x] 3.1 Create a reproducible baseline-training entrypoint that reads validated shot-feature rows and outputs versioned model artifacts.
  - [x] 3.2 Add configuration for feature selection, data splits, and seed control so baseline runs are repeatable.
  - [x] 3.3 Add evaluation output for log loss, Brier score, calibration, and split-specific reporting.
  - [x] 3.4 Add focused tests for dataset shaping, split logic, and artifact metadata generation.

- [x] 4.0 Train and evaluate the simplest baseline first: unregularized logistic regression
  - [x] 4.1 Fit the baseline on the validated training dataset and save coefficients plus metadata.
  - [x] 4.2 Evaluate the model on holdout data across overall, strength-state, rebound, and rush slices.
  - [x] 4.3 Document strengths, weaknesses, and obvious feature gaps from the baseline result.

- [x] 5.0 Train and evaluate the second baseline: regularized logistic regression
  - [x] 5.1 Add L1/L2 or elastic-net regularization options and fit the regularized baseline.
  - [x] 5.2 Compare regularized performance against the unregularized logistic baseline.
  - [x] 5.3 Document coefficient stability, feature shrinkage, and any practical deployment advantages.

- [x] 6.0 Train and evaluate the third baseline: gradient boosting
  - [x] 6.1 Define the first boosting configuration and fit the model on the same validated training dataset.
  - [x] 6.2 Compare boosting performance against both logistic baselines using the same holdout and reporting contract.
  - [x] 6.3 Document feature importance behavior, overfitting risk, calibration behavior, and operational tradeoffs.

- [x] 7.0 Benchmark, calibrate, and compare the baseline options under one evaluation contract
  - [x] 7.1 Run a uniform benchmark suite across all candidate baselines with identical splits and metrics.
  - [x] 7.2 Evaluate whether post-calibration is required for each baseline and test isotonic and/or Platt calibration where justified.
  - [x] 7.3 Produce a benchmark artifact summarizing winner, runner-up, calibration outcomes, and reasons for rejection of weaker baselines.

- [x] 8.0 Decide the first approved xG baseline and queue next-phase work
  - [x] 8.1 Choose the first approved baseline model for future integration or further tuning.
  - [x] 8.2 List any follow-up feature additions needed before a stronger second-pass model is attempted.
  - [x] 8.3 Decide whether goalie-facing modeling should reuse the chosen skater-shot baseline or wait for a dedicated goalie pass.
  - [x] 8.4 Create follow-up tasks for calibration hardening, historical benchmarking, advanced features, and rollout planning after the first baseline decision.
