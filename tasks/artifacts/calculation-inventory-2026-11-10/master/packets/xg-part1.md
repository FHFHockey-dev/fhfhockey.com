# Audit packet: xG (part 1 of 2)

Master entries M-XG-001 to M-XG-060 (60 of 70 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-XG-001 | xG model: includes/excludes | Both | 0 | 10 |
| M-XG-002 | Platt and isotonic calibrators | Both | 0 | 4 |
| M-XG-003 | Calibration requirement and cross-validated method selection | Both | 0 | 5 |
| M-XG-004 | xG offline challengers (LightGBM / CatBoost / XGBoost) with Platt cal… | Both | 0 | 3 |
| M-XG-005 | Power-play age and shift-fatigue features | Both | 0 | 4 |
| M-XG-006 | East-west / north-south movement and royal-road crossing | Both | 0 | 3 |
| M-XG-007 | Shot coordinate normalization to attacking direction | Both | 0 | 4 |
| M-XG-008 | Prior-event context (time, distance, speed from previous event) | Both | 0 | 3 |
| M-XG-009 | Rebound shot definition and rebound geometry | Both | 0 | 4 |
| M-XG-010 | Rush shot definition | Both | 0 | 4 |
| M-XG-011 | Score state context | Both | 0 | 3 |
| M-XG-012 | Goalie-on-ice flags and shot outcome flags | Both | 0 | 2 |
| M-XG-013 | Shot distance and angle | Both | 0 | 4 |
| M-XG-014 | Shooter/goalie handedness, roster position and deployment buckets | Both | 0 | 3 |
| M-XG-015 | Rich rebound labels (offline) | Both | 0 | 2 |
| M-XG-016 | Team travel / rest / fatigue features | Both | 0 | 3 |
| M-XG-017 | Baseline dataset encoding (feature families, imputation, one-hot, lab… | Both | 0 | 7 |
| M-XG-018 | Train/validation/test game splits (chronological and out-of-time) | Both | 0 | 3 |
| M-XG-019 | Binary logistic regression trainer (in-house gradient descent) | Both | 0 | 5 |
| M-XG-020 | Python challenger models (LightGBM / CatBoost / XGBoost, global and p… | Both | 0 | 2 |
| M-XG-021 | Numeric feature standardization | Both | 0 | 2 |
| M-XG-022 | xgboost_js boosted-tree family (third-party @fractal-solutions/xgboos… | Both | 0 | 4 |
| M-XG-023 | xG-adjusted player impact (shot-level ridge, 'RAPM-like') | Both | 0 | 6 |
| M-XG-024 | Created xG (shot-assist + transition) | Both | 0 | 3 |
| M-XG-025 | Quality of teammates / competition (QoT/QoC) percentiles | Both | 0 | 4 |
| M-XG-026 | Rebound-control aggregates (expected vs actual rebounds; goalie rebou… | Both | 0 | 3 |
| M-XG-027 | Rebound head outputs (danger / second-chance xG) | Both | 0 | 1 |
| M-XG-028 | Lagged residual shooter/goalie skill layer | Both | 0 | 4 |
| M-XG-029 | Shot-assist candidates / expected primary assists | Both | 0 | 3 |
| M-XG-030 | Transition proxies (controlled entry/exit, transition-created xG) | Both | 0 | 5 |
| M-XG-031 | xG denominator semantics (xSh%, shooting above expected, shot quality) | Both | 0 | 2 |
| M-XG-032 | Player-trend expected shooting % (NST ixG/iFF) | Both | 0 | 2 |
| M-XG-033 | Team/player/goalie game xG aggregation and goalie GSAx | Both | 0 | 5 |
| M-XG-034 | Flurry-adjusted xG | Both | 0 | 2 |
| M-XG-035 | Shot xG scoring (prediction) | Both | 0 | 3 |
| M-XG-036 | xG baseline trainer: chronological / out-of-time game splits | Both | 0 | 2 |
| M-XG-037 | xG baseline trainer: train-only z-score standardization | Both | 0 | 2 |
| M-XG-038 | xG baseline trainer: logistic / elastic-net / xgboost-js model fit | Both | 0 | 2 |
| M-XG-039 | NST-parity goalie metrics (Sv%, GAA, 'gsaa', danger splits) | Both | 0 | 4 |
| M-XG-040 | NST-parity heuristic xG and danger buckets | Both | 0 | 5 |
| M-XG-041 | NST-parity skater individual and on-ice counts/rates | Both | 0 | 6 |
| M-XG-042 | Adjusted-impact held-out validation and leakage gate | Both | 0 | 2 |
| M-XG-043 | Artifact drift and NST team-surface drift reports | Both | 0 | 2 |
| M-XG-044 | Probability metrics: log loss, Brier, calibration bins, slice evaluat… | Both | 0 | 4 |
| M-XG-045 | Feature coverage profile and scoring-row drift audit | Both | 0 | 1 |
| M-XG-046 | Segment calibration audit and internal benchmark surfaces | Both | 0 | 2 |
| M-XG-047 | AUC (rank-based) for offline heads and challengers | Both | 0 | 2 |
| M-XG-048 | xG team aggregate reconciliation (xGF/xGA symmetry) and operations al… | Opus only | 0 | 2 |
| M-XG-049 | xG shot scoring route stage (artifact-gated) | Opus only | 0 | 1 |
| M-XG-050 | xG post-calibration selection on validation split | Opus only | 0 | 1 |
| M-XG-051 | xG evaluation metrics: log loss, Brier, calibration bins, slice evalu… | Opus only | 0 | 1 |
| M-XG-052 | Shot map coordinate folding, hexbin and density heatmap | Opus only | 0 | 3 |
| M-XG-053 | Event inclusion / empty-net / OT / rare-manpower flags | Opus only | 0 | 2 |
| M-XG-054 | Missed-shot reason buckets | Opus only | 0 | 1 |
| M-XG-055 | Rebound-control outcome labels (creates rebound / goalie freeze / no-… | Opus only | 0 | 2 |
| M-XG-056 | Shift stints and on-ice attribution | Opus only | 0 | 1 |
| M-XG-057 | Game-clock hydration and seconds-since-previous-event | Opus only | 0 | 2 |
| M-XG-058 | Strength state and exact manpower | Opus only | 0 | 3 |
| M-XG-059 | xG model specification as trained (includes / excludes) | Opus only | 0 | 4 |
| M-XG-060 | Rebound-creation model and offline rebound heads | Opus only | 0 | 1 |

## M-XG-001 xG model: includes/excludes

- **Match:** Both; Opus XG-001; Codex XG-10, XG-12, XG-RUNTIME
- **Purpose:** Explicit checklist of what the production-candidate FHFH xG model includes and excludes.
- **Where:** `web/lib/xg/baselineDataset.ts:214 (BASELINE_FEATURE_FAMILY_PRESETS)`; `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`; `web/scripts/train-nhl-xg-baseline.ts:1750 (main)`; `web/lib/xg/shotFeaturePersistence.ts:611 (scoring)`; `web/lib/xg/baselineDataset.ts:465 buildEncodedBaselineDataset`; `web/lib/xg/baselineDataset.ts:214 BASELINE_FEATURE_FAMILY_PRESETS`; `web/scripts/train-nhl-xg-baseline.ts:1750 main`; `web/scripts/train_nhl_xg_challengers.py:177 build_model`; `web/lib/xg/shotFeaturePersistence.ts:575 predictLogistic`; `web/lib/xg/shotFeaturePersistence.ts:593 predictXgBoost`; `web/lib/xg/shotFeaturePersistence.ts:611 predictShotGoalProbabilities`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: unblocked attempts, shots on goal; generation: research, current
- **Opus view (XG-001):**
  - Method: SHOT UNIVERSE: INCLUDED unblocked attempts (goal, SOG, missed); EXCLUDED blocked shots, own goals, penalty shots, shootout, 'delayed-penalty' event rows — web/lib/xg/baselineDataset.ts:281, web/lib/supabase/Upserts/nhlEventInclusion.ts:106 \| X,Y + RINK/SIDE NORMALIZATION: INCLUDED (mirror both x and y when team attacks left, using homeTeamDefendingSide; net at (89,0)); normalizedX/normalizedY are model inputs; EXCLUDED arena/rink-bias adjustment — web/lib/supabase/Upserts/nhlCoordinates.ts:51 \| DISTANCE: INCLUDED, linear feet to (89,0), z-scored — web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:182 \| ANGLE: INCLUDED, abs degrees atan2(\|y\|,\|89-x\|), z-scored; behind-net not distinguished — web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:192 \| SHOT TYPE: INCLUDED one-hot (backhand, bat, between-legs, cradle, deflected, poke, slap, snap, tip-in, wrap-around, wrist) — web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:176 \| REBOUND: INCLUDED boolean isReboundShot = immediately previous event is same-team SOG/missed/blocked attempt, same period, 0<dt<=3 s, no distance limit; rebound geometry/speed features EXCLUDED from production family — web/lib/supabase/Upserts/nhlRebounds.ts:173 \| RUSH: INCLUDED boolean isRushShot = within 10 s after own takeaway/faceoff or opponent giveaway/blocked-shot in shooter's D/N zone, no intervening shot/stoppage, not a rebound, no distance/speed requirement; rush distance/speed EXCLUDED from production — web/lib/supabase/Upserts/nhlRush.ts:149 \| FLURRY: INCLUDED boolean isFlurryShot (future-dependent); flurry-adjusted xG applied only in aggregates — web/lib/supabase/Upserts/nhlFlurries.ts:137, web/lib/xg/flurryAdjusted.ts:22 \| PRIOR EVENT: INCLUDED previousEventTypeDescKey (one-hot), previousEventSameTeam, timeSincePreviousEventSeconds, distanceFromPreviousEvent; speed EXCLUDED — web/lib/supabase/Upserts/nhlPriorEventContext.ts:51 \| MOVEMENT: INCLUDED eastWestMovementFeet, northSouthMovementFeet, crossedRoyalRoad — web/lib/supabase/Upserts/nhlContextualFeatures.ts:277 \| STRENGTH STATE: INCLUDED one-hot strengthState (owner-relative EV/PP/SH/EN) AND strengthExact (away-v-home string, not owner-relative) — web/lib/supabase/Upserts/nhlStrengthState.ts:71 \| EMPTY NET: INCLUDED (isEmptyNetEvent boolean; EN state does not distinguish shooting-at-empty-net vs own-goalie-pulled); EN shots are in training and scoring — web/lib/supabase/Upserts/nhlEventInclusion.ts:106 \| GAME TIME: INCLUDED periodNumber, periodSecondsElapsed, gameSecondsElapsed (linear), isOvertimeEvent, ownerPowerPlayAgeSeconds, shooterShiftAgeSeconds — web/lib/xg/baselineDataset.ts:70 \| ZONE: INCLUDED zoneCode one-hot (O/N/D) — web/lib/xg/baselineDataset.ts:170 (DEFAULT_CATEGORICAL_FEATURE_KEYS) \| SCORE STATE: EXCLUDED from production first_pass_v1 (available only in expanded_v2: score diffs, ownerScoreDiffBucket, late-game flags); no score/venue adjustment of outputs — web/lib/xg/baselineDataset.ts:178 (EXPANDED_V2_NUMERIC_FEATURE_KEYS) \| SHOOTER EFFECTS: EXCLUDED from model (no shooter id, handedness, position in first_pass_v1); a separate lagged residual shooter-finishing layer exists for diagnostics (n/(n+200), min 50) — web/lib/xg/residualSkill.ts:32 \| GOALIE EFFECTS: EXCLUDED from model (no goalie id/catch hand); goalie only via GSAx = xGA - GA in aggregates and residual layer — web/lib/xg/aggregates.ts:618 \| TRAINING SET & SEASONS: corrected candidate = season 20252026 only, chronological game split 70/15/15 (seed 42), test 17,834 shots / 1,295 goals; out-of-time multi-season split supported but not used by the approved artifact — web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json \| MODEL TYPE: in-house L2 logistic regression (logistic_l2), full-batch gradient descent 800 iters, lr 0.05, l2 0.01, z-scored numerics, 0-imputation, 65 encoded features; alternatives: logistic_unregularized/elastic_net, xgboost_js (broken probability mapping), Python LightGBM/CatBoost/XGBoost challengers offline — web/lib/xg/binaryLogistic.ts:84, web/scripts/train-nhl-xg-baseline.ts:931 \| CALIBRATION: post-calibration fit on validation split only when \|mean gap\|>=0.02 or 10-bin max gap>=0.10; CV-chosen among raw/Platt/isotonic; corrected candidate selectedMethod = raw (no calibration applied); earlier approved leaky run used isotonic — web/lib/xg/calibration.ts:491 \| VALIDATION METRICS: log loss, Brier, 10 equal-width calibration bins, slices by strength/rebound/rush; AUC NOT computed for shot_goal model — web/scripts/train-nhl-xg-baseline.ts:1459
  - Inputs/units: feet, degrees, seconds, booleans, categorical; sources: nhl_xg_shot_features, nhl_api_pbp_events, nhl_api_shift_rows
  - Output scale: probability 0-1 per unblocked shot; writes: nhl_xg_shot_predictions
  - Status: live — corrected candidate approved=true in artifact; deployed artifact chosen by env path in update-nhl-xg-shot-predictions.ts (not verifiable read-only)
  - Consumers: nhl_xg_*_aggregates; adjusted impact; created xG; FORGE team context; homepage analytics; MetricsTimeline; /underlying-stats/xg
- **Codex view (XG-10, calculation, location; Codex family 'Expected goals'):** Baseline feature encoding and chronological splits
  - Purpose: Build shot-goal/rebound classification training examples.
  - Inputs/units: NhlShotFeatureRow numeric values, booleans, categories; labels; game/date and split ratios.
  - Output scale: Encoded feature vectors, levels, train/validation/test game assignments.
  - Version/status: Three feature-family presets. Production deployment/active database state not checked.
- **Codex view (XG-12, calculation, location; Codex family 'Expected goals'):** Boosted-tree xG baseline and Python challengers
  - Purpose: Train nonlinear alternative classifiers on same encoded shot contract.
  - Inputs/units: Encoded shot vectors/labels; train/validation/test partitions, seed and estimator settings.
  - Output scale: Goal or rebound probabilities; feature importance/evaluation artifacts.
  - Version/status: xgboost_js and offline challenger families. Production deployment/active database state not checked.
- **Codex view (XG-RUNTIME, calculation, location; Codex family 'Expected goals'):** Persisted-artifact xG inference and calibration selection
  - Purpose: Score shot rows using the serialized selected model.
  - Inputs/units: Encoded features; persisted model family, logistic weights/bias or tree nodes/learning rate; serialized calibration.
  - Output scale: Raw probability, optional calibrated probability and xg; probability clipped 1e-9 to 1−1e-9.
  - Version/status: Runtime scoring implementation; active artifact unknown. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/xg/baselineDataset.ts:4 and :307 comments (P(goal \| shot features), label = observed outcome); web/lib/xg/shotFeaturePersistence.ts:615 comment; docs/player-projections/model-inventory.json:1110 entry; tasks/artifacts/xg-*.md (62 decision/benchmark notes, not read)
  - Intended contract (Codex XG-10): shot_goal means P(goal \| this shot), not future-goals projection; first_pass_v1/expanded_v2/speed_context_v3 feature lists and forbidden leakage keys. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - Intended contract (Codex XG-12): TS @fractal-solutions/xgboost-js; Python LightGBM, CatBoost and XGBoost use reference contract alignment. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - Intended contract (Codex XG-RUNTIME): Logistic sigmoid(dot(weights,features)+bias); tree scorer starts at .5 and sums learningRate*leaf then sigmoid; xg chooses calibrated output only when artifact.calibration.applied is true. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Evolving-Hockey xG (XGBoost per strength, Fenwick, multi-season, AUC ~0.77-0.78 at 5v5); MoneyPuck xG (GBM, arena-adjusted, rebound/rush/speed/flurry, shooter talent adjustment); HockeyViz (Micah McCurdy, location-smoothed); NST xG (Fenwick, distance/angle/type/rebound/rush)
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`; `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`; `web/scripts/output/xg-approval-run-20260522/`; `web/scripts/output/xg-baselines/`; `web/scripts/output/xg-rebound-baselines/`; `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
  - Tests: `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`; `web/lib/xg/baselineDataset.test.ts`; `web/lib/xg/binaryLogistic.test.ts`; `web/lib/xg/calibration.test.ts`; `web/lib/xg/shotFeaturePersistence.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) no score-state, shooter or goalie terms; single-season training; linear distance/angle
  - (opus) isFlurryShot uses future events (leakage risk)
  - (opus) 0-imputation of missing coordinates places shots at the crease/center ice
  - (opus) EN shots modeled jointly with a single boolean
  - (opus) approved earlier artifact (cfg9bac2706, isotonic) leaked missReasonBucket — check which artifact the deployed MODEL_ARTIFACT_PATH env points to
  - (opus) corrected candidate log loss 0.2434 vs base-rate ~0.260 (weak lift)
  - (opus) blocked-shot owner semantics may misassign rebounds/rush sources
  - (codex:XG-10) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:XG-12) Active model/approval not verified; third-party learner internals are dependencies, not in-house formulas.
  - (codex:XG-RUNTIME) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-002 Platt and isotonic calibrators

- **Match:** Both; Opus XG-004; Codex XG-14, XG-15
- **Purpose:** Map raw probabilities to calibrated probabilities.
- **Where:** `web/lib/xg/calibration.ts:101 (logit)`; `web/lib/xg/calibration.ts:292 (fitPlattCalibrator)`; `web/lib/xg/calibration.ts:318 (fitIsotonicCalibrator)`; `web/lib/xg/calibration.ts:368 (fitProbabilityCalibrator)`; `web/lib/xg/calibration.ts:401 (predictWithSerializedCalibrator)`; `web/lib/xg/calibration.ts:416 (predictIsotonicProbability)`; `web/lib/xg/calibration.ts:368 fitProbabilityCalibrator`; `web/lib/xg/calibration.ts:401 predictWithSerializedCalibrator`; `web/lib/xg/calibration.ts:491 assessCalibration`; `web/lib/xg/calibration.ts:106 evaluateProbabilityMetrics`; `web/lib/xg/hardeningAudit.ts:112 buildXgSegmentCalibrationAudit`; `web/scripts/train_nhl_xg_challengers.py:20 metrics`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, current
- **Opus view (XG-004):**
  - Method: Platt: in-house logistic on logit(p) (400 iters, lr 0.05, l2 0.001), needs >=10 rows and both classes. Isotonic: pool-adjacent-violators on predictions sorted ascending, blocks store max prediction & mean label; predict = first block whose maxPrediction >= p (step function, no interpolation); above last block -> last block mean.
  - Inputs/units: probability 0-1; sources: —
  - Output scale: probability 0-1; writes: artifact calibration.model
  - Status: live (offline) — run manually via `tsx web/scripts/train-nhl-xg-baseline.ts`; produced artifacts consumed by update-nhl-xg-shot-predictions via artifact path env; applied at scoring when artifact.calibration.applied
  - Consumers: predictShotGoalProbabilities
- **Codex view (XG-14, calculation, location; Codex family 'Expected goals'):** Probability calibration: raw, Platt and isotonic
  - Purpose: Fit calibration mapping and choose/report calibrated output.
  - Inputs/units: Validation predictions [0,1], binary labels and calibrator family.
  - Output scale: Calibrated probabilities [0,1], model parameters and eligibility/warnings.
  - Version/status: Raw/platt/isotonic coexist; artifact determines use. Production deployment/active database state not checked.
- **Codex view (XG-15, calculation, location; Codex family 'Expected goals'):** Probability evaluation and calibration bins
  - Purpose: Compute evaluation measures already implemented for xG models.
  - Inputs/units: Predictions [0,1] and binary observed outcomes; segment keys.
  - Output scale: Log loss, Brier, count, positive rate, mean prediction, bin gaps; Python adds ROC AUC/ECE.
  - Version/status: Evaluation tools inventoried only. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-14): Serialized raw/Platt/isotonic models; held-out positive/rush/rebound minimum gates. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - Intended contract (Codex XG-15): Metrics functions and segment taxonomies, not a newly performed audit. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: sklearn CalibratedClassifierCV / IsotonicRegression
  - Fixtures/test data: `web/scripts/output/xg-approval-run-20260522/`
  - Tests: `web/lib/xg/calibration.test.ts`; `web/lib/xg/hardeningAudit.test.ts`
- **Leads (not audited):**
  - (opus) isotonic blocks can return exactly 0 or 1 (clipped to 1e-9) for extreme bins
  - (opus) Platt via GD may be unconverged
  - (codex:XG-14) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:XG-15) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-003 Calibration requirement and cross-validated method selection

- **Match:** Both; Opus XG-005; Codex XG-14
- **Purpose:** Decide whether post-calibration is needed and pick raw/Platt/isotonic.
- **Where:** `web/lib/xg/calibration.ts:218 (estimateMaximumCalibrationGap)`; `web/lib/xg/calibration.ts:242 (determineCalibrationRequirement)`; `web/lib/xg/calibration.ts:273 (assignFoldIndices)`; `web/lib/xg/calibration.ts:428 (runCrossValidatedCalibrationMethod)`; `web/lib/xg/calibration.ts:468 (pickBestMethod)`; `web/lib/xg/calibration.ts:491 (assessCalibration)`; `web/scripts/train-nhl-xg-baseline.ts:1532 (buildValidationCalibration)`; `web/lib/xg/calibration.ts:368 fitProbabilityCalibrator`; `web/lib/xg/calibration.ts:401 predictWithSerializedCalibrator`; `web/lib/xg/calibration.ts:491 assessCalibration`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, current
- **Opus view (XG-005):**
  - Method: Requires post-calibration if \|mean pred - goal rate\| >= 0.02 or any 10-equal-width-bin gap >= 0.10 (bins with >=5 rows). Folds = min(5, max(2, positives)), stratified round-robin by sorted rowId. Compare raw vs CV Platt vs CV isotonic by log loss then Brier. Calibrator fit on VALIDATION split only, then applied to all splits.
  - Inputs/units: probabilities 0-1; sources: —
  - Output scale: probability 0-1; writes: model-artifact.json calibration, calibrationAssessment
  - Status: live (offline) — run manually via `tsx web/scripts/train-nhl-xg-baseline.ts`; produced artifacts consumed by update-nhl-xg-shot-predictions via artifact path env
  - Consumers: scoring (calibrated_probability)
- **Codex view (XG-14, calculation, location; Codex family 'Expected goals'):** Probability calibration: raw, Platt and isotonic
  - Purpose: Fit calibration mapping and choose/report calibrated output.
  - Inputs/units: Validation predictions [0,1], binary labels and calibrator family.
  - Output scale: Calibrated probabilities [0,1], model parameters and eligibility/warnings.
  - Version/status: Raw/platt/isotonic coexist; artifact determines use. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (tasks/artifacts/xg-calibration-path-decision-2026-03-31.md, xg-calibration-requirement-reassessment-2026-03-31.md)
  - Intended contract (Codex XG-14): Serialized raw/Platt/isotonic models; held-out positive/rush/rebound minimum gates. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Platt scaling / isotonic regression (Niculescu-Mizil & Caruana); MoneyPuck/EH report calibration plots
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
  - Tests: `web/lib/xg/calibration.test.ts`
- **Leads (not audited):**
  - (opus) tolerance 0.02 absolute on a ~0.07 base rate is ~30% relative — loose
  - (opus) equal-width [0,1] bins: ~78% of test shots fall in bin 0 in corrected candidate, so the max-gap check is nearly blind
  - (opus) holdout metrics later reported over validation+test although calibrator was fit on validation (optimistic)
  - (opus) corrected candidate selected 'raw'
  - (codex:XG-14) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-004 xG offline challengers (LightGBM / CatBoost / XGBoost) with Platt calibration

- **Match:** Both; Opus XG-007; Codex XG-12, XG-15
- **Purpose:** Benchmark gradient-boosted xG challengers against the frozen logistic baseline
- **Where:** `web/scripts/train_nhl_xg_challengers.py:177 (build_model)`; `web/scripts/train_nhl_xg_challengers.py:232 (fit_platt)`; `web/scripts/train_nhl_xg_challengers.py:249 (expected_calibration_error)`; `web/scripts/train_nhl_xg_challengers.py:264 (metrics)`; `web/scripts/train_nhl_xg_challengers.py:289 (main)`; `web/scripts/train-nhl-xg-baseline.ts:1750 main`; `web/scripts/train_nhl_xg_challengers.py:177 build_model`; `web/lib/xg/calibration.ts:106 evaluateProbabilityMetrics`; `web/lib/xg/hardeningAudit.ts:112 buildXgSegmentCalibrationAudit`; `web/scripts/train_nhl_xg_challengers.py:20 metrics`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, development, current
- **Opus view (XG-007):**
  - Method: LightGBM 200 trees lr 0.05 leaves 31 min_child 50 subsample/colsample 0.9 lambda 1; CatBoost depth 6 lr 0.05 l2_leaf 3; XGBoost depth 4 min_child_weight 5 lr 0.05 hist; seed 42+familyIndex; Platt = logistic on logit(p) with C=1e6, needs >=20 val rows and >=10 of each class; also per-strength-state models if train>=1000 rows and >=25 pos/neg; metrics Brier, log loss, AUC, ECE with 10 equal-width bins; probs clipped 1e-7
  - Inputs/units: standardized features from exported dataset; sources: file: challenger dataset .json.gz exported by train-nhl-xg-baseline.ts
  - Output scale: probability 0-1; ECE 0-1; writes: --output file
  - Status: draft — offline research (training set = frozen 20252026 dataset export)
  - Consumers: xG model selection research
- **Codex view (XG-12, calculation, location; Codex family 'Expected goals'):** Boosted-tree xG baseline and Python challengers
  - Purpose: Train nonlinear alternative classifiers on same encoded shot contract.
  - Inputs/units: Encoded shot vectors/labels; train/validation/test partitions, seed and estimator settings.
  - Output scale: Goal or rebound probabilities; feature importance/evaluation artifacts.
  - Version/status: xgboost_js and offline challenger families. Production deployment/active database state not checked.
- **Codex view (XG-15, calculation, location; Codex family 'Expected goals'):** Probability evaluation and calibration bins
  - Purpose: Compute evaluation measures already implemented for xG models.
  - Inputs/units: Predictions [0,1] and binary observed outcomes; segment keys.
  - Output scale: Log loss, Brier, count, positive rate, mean prediction, bin gaps; Python adds ROC AUC/ECE.
  - Version/status: Evaluation tools inventoried only. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): report calibration note web/scripts/train_nhl_xg_challengers.py:419
  - Intended contract (Codex XG-12): TS @fractal-solutions/xgboost-js; Python LightGBM, CatBoost and XGBoost use reference contract alignment. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - Intended contract (Codex XG-15): Metrics functions and segment taxonomies, not a newly performed audit. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck GBM xG; Platt scaling; ECE
  - Fixtures/test data: `challenger dataset .json.gz written by train-nhl-xg-baseline.ts --challengerDatasetPath (none committed)`
  - Tests: `web/lib/xg/calibration.test.ts`; `web/lib/xg/hardeningAudit.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) per-state models are compared on test after using only validation for calibration, but per-state test merges into 'partitioned' with global fallback, mixing two model types in one metric
  - (codex:XG-12) Active model/approval not verified; third-party learner internals are dependencies, not in-house formulas.
  - (codex:XG-15) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-005 Power-play age and shift-fatigue features

- **Match:** Both; Opus XG-010; Codex XG-08
- **Purpose:** Seconds into current PP and shift ages/gaps for shooter and on-ice units.
- **Where:** `web/lib/supabase/Upserts/nhlContextualFeatures.ts:149 (computePlayerShiftAgeSeconds)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:187 (computePlayerPreviousShiftGapSeconds)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:212 (computePlayerPreviousShiftDurationSeconds)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:237 (computeShiftAgeStats)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:337 (teamPowerPlayAge)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:303 (buildContextualFeatureContexts)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:303 buildContextualFeatureContexts`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:277 computeCrossedRoyalRoad`
- **Tags (heuristic):** generation: current
- **Opus view (XG-010):**
  - Method: Shift age = eventSec - shiftStart (prefers interval ending exactly at event second); prev gap = currentStart - prevEnd (same period only); owner/opponent average & max over on-ice players. PP age = eventTime - first observed event time while team state is PP with same strengthExact.
  - Inputs/units: seconds; sources: nhl_api_pbp_events, nhl_api_shift_rows
  - Output scale: seconds; writes: nhl_xg_shot_features
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: production model numeric features ownerPowerPlayAgeSeconds, shooterShiftAgeSeconds
- **Codex view (XG-08, calculation, location; Codex family 'Expected goals'):** Shift fatigue, power-play age and royal-road movement
  - Purpose: Derive shot-time shift and movement context.
  - Inputs/units: Shift start/end seconds, strength intervals, ordered event positions.
  - Output scale: Shooter/team/opponent shift ages and prior shift gap/duration seconds; PP age seconds; east-west/north-south feet; crossedRoyalRoad boolean.
  - Version/status: Local feature generator. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-08): NhlContextualFeatureContext type and inline helpers. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck shooter time on ice / PP time elapsed
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlContextualFeatures.test.ts`
- **Leads (not audited):**
  - (opus) PP age starts at the first EVENT observed in PP state, not the penalty start, so it is understated
  - (opus) PP segment resets if strengthExact changes (5v4 -> 5v3) and EN state
  - (opus) at shift-change second the outgoing player's interval is preferred
  - (codex:XG-08) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-006 East-west / north-south movement and royal-road crossing

- **Match:** Both; Opus XG-011; Codex XG-08
- **Purpose:** Pre-shot puck movement proxies from the previous same-team event.
- **Where:** `web/lib/supabase/Upserts/nhlContextualFeatures.ts:277 (computeCrossedRoyalRoad)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:438 (movement block)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:303 buildContextualFeatureContexts`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:277 computeCrossedRoyalRoad`
- **Tags (heuristic):** generation: current
- **Opus view (XG-011):**
  - Method: Only when previous event is same team: eastWest = \|dY\|; northSouth = curX - prevX; crossedRoyalRoad = both x >= 25 ft and sign(prevY) != sign(curY) (both nonzero).
  - Inputs/units: feet; sources: nhl_api_pbp_events
  - Output scale: feet; boolean; writes: nhl_xg_shot_features
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: production model features (numeric + boolean); heuristic xG +0.02
- **Codex view (XG-08, calculation, location; Codex family 'Expected goals'):** Shift fatigue, power-play age and royal-road movement
  - Purpose: Derive shot-time shift and movement context.
  - Inputs/units: Shift start/end seconds, strength intervals, ordered event positions.
  - Output scale: Shooter/team/opponent shift ages and prior shift gap/duration seconds; PP age seconds; east-west/north-south feet; crossedRoyalRoad boolean.
  - Version/status: Local feature generator. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-08): NhlContextualFeatureContext type and inline helpers. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck east-west/north-south movement; royal-road passes (tracking-based in the community)
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlContextualFeatures.test.ts`
- **Leads (not audited):**
  - (opus) x>=25 threshold sits outside the blue line (~25 ft from center) — loose 'offensive' filter
  - (opus) previous event is any event (hit, faceoff), not a pass
  - (codex:XG-08) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-007 Shot coordinate normalization to attacking direction

- **Match:** Both; Opus XG-012; Codex XG-01
- **Purpose:** Mirror raw NHL x,y so every shot attacks the net at (+89,0).
- **Where:** `web/lib/supabase/Upserts/nhlCoordinates.ts:20 (OFFENSIVE_NET_X/Y)`; `web/lib/supabase/Upserts/nhlCoordinates.ts:37 (getTeamAttackingSide)`; `web/lib/supabase/Upserts/nhlCoordinates.ts:51 (normalizeCoordinatesToAttackingDirection)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:476 (call)`; `web/lib/supabase/Upserts/nhlPriorEventContext.ts:64 (call)`; `web/lib/xg/reboundRichLabels.ts:88 (shotGeometry)`; `web/lib/supabase/Upserts/nhlCoordinates.ts:51 normalizeCoordinatesToAttackingDirection`
- **Tags (heuristic):** generation: current
- **Opus view (XG-012):**
  - Method: attackingSide = home: opposite of homeTeamDefendingSide; away: = homeTeamDefendingSide. If attacking 'left', normalizedX=-x and normalizedY=-y (180-degree rotation), else unchanged. Net fixed at x=89 ft, y=0. No rink/arena bias adjustment.
  - Inputs/units: feet (NHL rink coords x in [-100,100], y in [-42.5,42.5]); sources: nhl_api_pbp_events
  - Output scale: feet, attacking +x; writes: nhl_xg_shot_features.normalized_x/normalized_y
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: shot distance/angle; rebound geometry; royal-road/movement features; xG model features normalizedX/Y
- **Codex view (XG-01, calculation, location; Codex family 'Expected goals'):** Attacking-direction coordinate normalization
  - Purpose: Normalize NHL rink coordinates to the offensive net at (89,0).
  - Inputs/units: Raw x/y in feet; event team side and home defending side.
  - Output scale: Normalized x/y feet; attacking side and mirror flag.
  - Version/status: Coordinate helper, shot feature version 1. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (no comment; tasks/artifacts/xg-feature-contract-repair-2026-03-31.md may describe)
  - Intended contract (Codex XG-01): OFFENSIVE_NET_X=89; both axes negated for left-attacking events. Unknown direction produces null geometry. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck arena-adjusted coordinates; Evolving-Hockey/HockeyViz coordinate flipping by period/home side
  - Fixtures/test data: `web/lib/supabase/Upserts/nhlCoordinates.test.ts`; `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
  - Tests: `web/lib/supabase/Upserts/nhlCoordinates.test.ts`
- **Leads (not audited):**
  - (opus) owner side is NHL eventOwnerTeamId; for blocked-shot events the NHL API owner is believed to be the blocking team, which would mirror blocked-shot coords/strength to the wrong team (no flip found in nhlPlayByPlayParser.ts:362)
  - (opus) null homeTeamDefendingSide yields null coords (later imputed as 0 in model encoding)
  - (opus) no arena/rink-bias correction (MoneyPuck adjusts)
  - (codex:XG-01) Community-convention comparison intentionally deferred.

## M-XG-008 Prior-event context (time, distance, speed from previous event)

- **Match:** Both; Opus XG-015; Codex XG-03
- **Purpose:** Describe the event immediately preceding each shot.
- **Where:** `web/lib/supabase/Upserts/nhlPriorEventContext.ts:51 (buildPriorEventContexts)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:202 (computeFeetPerSecond)`; `web/lib/supabase/Upserts/nhlPriorEventContext.ts:51 buildPriorEventContexts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:202 computeFeetPerSecond`
- **Tags (heuristic):** generation: current
- **Opus view (XG-015):**
  - Method: previousEventSameTeam = owner ids equal; distanceFromPreviousEvent = Euclidean distance on RAW coords; speed = distance/seconds if seconds>0 else null; also normalized coords of both events.
  - Inputs/units: seconds, feet; sources: nhl_api_pbp_events
  - Output scale: seconds; feet; ft/s; writes: nhl_xg_shot_features
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: xG features (first_pass_v1 uses previousEventTypeDescKey, previousEventSameTeam, time, distance); rebound & movement features; shot assist heuristic
- **Codex view (XG-03, calculation, location; Codex family 'Expected goals'):** Prior-event movement and speed
  - Purpose: Derive elapsed time and movement before a shot.
  - Inputs/units: Ordered event timestamps seconds; x/y feet.
  - Output scale: Time since event seconds; Euclidean distance feet; distance/time ft/s; same-team flag.
  - Version/status: Feature families first_pass_v1, expanded_v2, speed_context_v3 coexist. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-03): NhlPriorEventContext and feature units. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck 'time since last event', 'distance from last event', 'speed from last event'
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlPriorEventContext.test.ts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`
- **Leads (not audited):**
  - (opus) distance uses raw coords across events whose owners differ; OK within one period but blocked-shot owner semantics leak in
  - (opus) speed null when 0-second gap (common)
  - (codex:XG-03) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-009 Rebound shot definition and rebound geometry

- **Match:** Both; Opus XG-017; Codex XG-04
- **Purpose:** Flag shots that follow a same-team shot attempt within 3 s and measure displacement.
- **Where:** `web/lib/supabase/Upserts/nhlRebounds.ts:6 (DEFAULT_REBOUND_WINDOW_SECONDS=3)`; `web/lib/supabase/Upserts/nhlRebounds.ts:173 (buildReboundContexts)`; `web/lib/supabase/Upserts/nhlRebounds.ts:173 buildReboundContexts`
- **Tags (heuristic):** denominators: shots on goal; generation: current
- **Opus view (XG-017):**
  - Method: isReboundShot = immediately previous event (no intervening events allowed) is an eligible SOG/missed/blocked attempt by the SAME owner team, same period, and 0 < dt <= 3 s. Geometry: lateral displacement \|dY\|, distance delta (cur-src), angle change \|dAngle\|, distance from source (raw), speed = dist/dt.
  - Inputs/units: seconds, feet, degrees; sources: nhl_api_pbp_events
  - Output scale: boolean; feet; degrees; ft/s; writes: nhl_xg_shot_features
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: xG boolean feature isReboundShot; rush exclusion; shot assists/transitions exclusion; NST-parity rebound counts; heuristic xG +0.03
- **Codex view (XG-04, calculation, location; Codex family 'Expected goals'):** Rebound identity and geometry
  - Purpose: Classify rebound sequences, source/target and outcome context.
  - Inputs/units: Ordered shot-like events, team, timestamps, coordinates.
  - Output scale: Rebound flag; time seconds; lateral/distance change feet; angle change degrees; creation and control-outcome labels.
  - Version/status: Default 3-second window. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (see tasks/artifacts/xg-rebound-geometry-benchmark-2026-03-31.md)
  - Intended contract (Codex XG-04): DEFAULT_REBOUND_WINDOW_SECONDS=3 and eligibility/break rules. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck rebound = shot within 3 s of prior shot; Evolving-Hockey rebound <=2-3 s
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
  - Tests: `web/lib/supabase/Upserts/nhlRebounds.test.ts`
- **Leads (not audited):**
  - (opus) strict dt>0 excludes same-second rebounds (1-s clock resolution) — likely undercounts rebounds vs MoneyPuck
  - (opus) requires same owner team: if NHL blocked-shot owner is the blocker, rebounds after blocked shots are never flagged
  - (opus) only the immediately previous event is checked; any intervening event (e.g., hit, giveaway) breaks it
  - (codex:XG-04) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-010 Rush shot definition

- **Match:** Both; Opus XG-018; Codex XG-05
- **Purpose:** Flag non-rebound shots preceded within 10 s by a qualifying turnover/faceoff/block in the shooting team's D or N zone.
- **Where:** `web/lib/supabase/Upserts/nhlRush.ts:5 (DEFAULT_RUSH_WINDOW_SECONDS=10)`; `web/lib/supabase/Upserts/nhlRush.ts:91 (isQualifyingRushSource)`; `web/lib/supabase/Upserts/nhlRush.ts:122 (isHardRushBreak)`; `web/lib/supabase/Upserts/nhlRush.ts:149 (buildRushContexts)`; `web/lib/supabase/Upserts/nhlRush.ts:149 buildRushContexts`
- **Tags (heuristic):** generation: current
- **Opus view (XG-018):**
  - Method: Scan backward up to 10 s (same period, dt>0). Qualifying sources: own takeaway, own faceoff win, opponent giveaway, opponent-owned blocked-shot. Source zone converted to shooting-team-relative (invert O/D for opponent events); rush if relative zone is D or N. Break on stoppage/penalty/period events, any other shot, opponent takeaway/faceoff, own giveaway. Rebound shots are never rush. Distance from source uses raw coords.
  - Inputs/units: seconds, feet; sources: nhl_api_pbp_events
  - Output scale: boolean; seconds; feet; ft/s; writes: nhl_xg_shot_features
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: xG boolean isRushShot; transition proxies; NST-parity rush_attempts; heuristic xG +0.02
- **Codex view (XG-05, calculation, location; Codex family 'Expected goals'):** Rush-shot context
  - Purpose: Identify shots linked to qualifying transition sources.
  - Inputs/units: Event team-relative zones, times seconds, locations feet.
  - Output scale: Rush flag/source; elapsed seconds; distance feet, derived speed ft/s.
  - Version/status: Local deterministic heuristic. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-05): DEFAULT_RUSH_WINDOW_SECONDS=10; qualifying sources and hard breaks encoded. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck rush = within 4 s of an event in neutral/defensive zone; Evolving-Hockey ~ similar
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
  - Tests: `web/lib/supabase/Upserts/nhlRush.test.ts`
- **Leads (not audited):**
  - (opus) 10 s window is much wider than MoneyPuck's 4 s and has no speed/distance requirement
  - (opus) 'opponent-owned blocked-shot' as rush source depends on NHL owner semantics for blocked shots (unverified)
  - (opus) faceoff win in D/N zone counts as rush source
  - (codex:XG-05) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-011 Score state context

- **Match:** Both; Opus XG-019; Codex score-state
- **Purpose:** Score before event, owner-relative differential and late-game buckets.
- **Where:** `web/lib/supabase/Upserts/nhlScoreState.ts:47 (bucketOwnerScoreDiff)`; `web/lib/supabase/Upserts/nhlScoreState.ts:61 (getScoreEffectsGameTimeSegment)`; `web/lib/supabase/Upserts/nhlScoreState.ts:108 (updateRunningScore)`; `web/lib/supabase/Upserts/nhlScoreState.ts:138 (buildScoreStateContexts)`; `web/lib/supabase/Upserts/nhlScoreState.ts:138 buildScoreStateContexts; :47 bucketOwnerScoreDiff; :61 getScoreEffectsGameTimeSegment`
- **Tags (heuristic):** generation: current
- **Opus view (XG-019):**
  - Method: Running score updated after each event (max of carried score fields). ownerDiff bucket: <=-2 trail-2plus, -1, 0 tied, +1, >=+2 lead-2plus. Segments: <20 min early, <40 mid, <55 late, else final-five; OT/SO separate. Late-game window >=50:00; isLateGameClose \|diff\|<=1; final five >=55:00, final two >=58:00 (REG only).
  - Inputs/units: seconds; goals; sources: nhl_api_pbp_events
  - Output scale: goal differential integer; categorical buckets; writes: nhl_xg_shot_features
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: expanded_v2 model features (not in production first_pass_v1); adjusted impact context; segment calibration audit
- **Codex view (score-state, calculation, location; Codex family 'NHL event context'):** Pre-event score differentials, score buckets and late-game flags
  - Purpose: Attach pre-event score/time context for event metrics and filters.
  - Inputs/units: Sorted NHL PBP events, score counts, owning side, period type and elapsed seconds
  - Output scale: Home/away/owner score differences; trail-2plus/trail-1/tied/lead-1/lead-2plus; regulation segments 20/40/55 minutes plus OT/SO; late window ≥50m; final-five ≥55m and final-two ≥58m in REG. Close \|diff\|≤1.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex score-state): Implementation explicitly computes contexts before updateRunningScore; source web/lib/supabase/Upserts/nhlScoreState.ts.
  - External references: Score-and-venue adjustment (Tulsky/Micah McCurdy HockeyViz/EH score-adjusted xG)
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlScoreState.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlScoreState.test.ts"]}`
- **Leads (not audited):**
  - (opus) production first_pass_v1 model has NO score-state feature
  - (opus) no score/venue adjustment applied to aggregates (unadjusted_observed per hardeningAudit.ts)
  - (codex:score-state) No runtime verification or correctness assessment performed.

## M-XG-012 Goalie-on-ice flags and shot outcome flags

- **Match:** Both; Opus XG-021; Codex XG-02
- **Purpose:** Derive goalie presence and goal/SOG/unblocked/own-goal flags; normalize shot type.
- **Where:** `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:176 (normalizeShotType)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:384 (resolveGoalieOnIceFlags)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:515 (isGoal/isShotOnGoal/isUnblockedShotAttempt)`; `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts:165 (isOwnGoalPlayByPlayEvent)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:182 computeShotDistanceFeet`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:192 computeShotAngleDegrees`
- **Tags (heuristic):** denominators: unblocked attempts, shots on goal; generation: current
- **Opus view (XG-021):**
  - Method: ownerGoalieOnIce = owner-side goalie digit > 0; isUnblockedShotAttempt = type != blocked-shot and not own goal (goal, SOG, missed). shotType lowercased/trimmed (11 levels incl. bat, between-legs, cradle, poke).
  - Inputs/units: —; sources: nhl_api_pbp_events
  - Output scale: booleans; categorical; writes: nhl_xg_shot_features
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: model label (isGoal) and eligibility (isUnblockedShotAttempt); shotType one-hot in production model
- **Codex view (XG-02, calculation, location; Codex family 'Expected goals'):** Shot distance and angle
  - Purpose: Calculate distance to offensive goal and unsigned angle.
  - Inputs/units: Normalized x/y feet; net (89,0).
  - Output scale: Distance sqrt((89-x)^2+y^2) feet; atan2(abs(y),abs(89-x))*180/pi degrees (0–90).
  - Version/status: NHL_SHOT_FEATURE_VERSION=1. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-02): Inline implementations and NhlShotFeatureRow define units. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Fenwick (unblocked attempts) convention used by MoneyPuck/EH/NST xG
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`
- **Leads (not audited):**
  - (opus) goalie-on-ice flags exist but are not in the production feature set; isEmptyNetEvent is
  - (codex:XG-02) No geometry convention validation performed.

## M-XG-013 Shot distance and angle

- **Match:** Both; Opus XG-022; Codex XG-02
- **Purpose:** Euclidean distance (ft) and absolute angle (deg) from normalized shot location to net.
- **Where:** `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:182 (computeShotDistanceFeet)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:192 (computeShotAngleDegrees)`; `web/lib/supabase/Upserts/nhlRebounds.ts:49,59 (duplicate copies)`; `web/lib/xg/reboundRichLabels.ts:88 (shotGeometry duplicate)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:182 computeShotDistanceFeet`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:192 computeShotAngleDegrees`
- **Tags (heuristic):** generation: current
- **Opus view (XG-022):**
  - Method: distance = sqrt((89-x)^2 + (0-y)^2); angle = atan2(\|y\|,\|89-x\|)*180/pi (0 = straight on, 90 = goal line). Shots from behind the net (x>89) get the same angle as mirrored front shots because abs(89-x) is used.
  - Inputs/units: feet; sources: nhl_api_pbp_events
  - Output scale: distance feet 0..~190; angle degrees 0..90; writes: nhl_xg_shot_features.shot_distance_feet/shot_angle_degrees
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: xG logistic model; NST-parity danger buckets; goalie avg_shot_distance; rebound deltas
- **Codex view (XG-02, calculation, location; Codex family 'Expected goals'):** Shot distance and angle
  - Purpose: Calculate distance to offensive goal and unsigned angle.
  - Inputs/units: Normalized x/y feet; net (89,0).
  - Output scale: Distance sqrt((89-x)^2+y^2) feet; atan2(abs(y),abs(89-x))*180/pi degrees (0–90).
  - Version/status: NHL_SHOT_FEATURE_VERSION=1. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-02): Inline implementations and NhlShotFeatureRow define units. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck/Evolving-Hockey shot distance & angle (EH uses signed/abs angle, behind-net handled separately)
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
  - Tests: `web/lib/supabase/Upserts/nhlRebounds.test.ts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`
- **Leads (not audited):**
  - (opus) behind-the-net shots indistinguishable from in-front shots by angle (abs on deltaX)
  - (opus) logic duplicated in 3 files (nhlShotFeatureBuilder, nhlRebounds, reboundRichLabels)
  - (opus) model uses raw linear distance/angle (no log/spline), see model entry
  - (codex:XG-02) No geometry convention validation performed.

## M-XG-014 Shooter/goalie handedness, roster position and deployment buckets

- **Match:** Both; Opus XG-025; Codex XG-09
- **Purpose:** Training/persistence-time enrichment of shots with player attributes and on-ice F/D counts.
- **Where:** `web/lib/xg/handedness.ts:27 (buildShooterGoalieHandednessMatchup)`; `web/lib/xg/rosterPosition.ts:25 (buildShooterPositionGroup)`; `web/lib/xg/deploymentContext.ts:91 (buildDeploymentContextForShot)`; `web/lib/xg/shotFeatureEnrichment.ts:137 (enrichShotRowsWithTrainingContextMaps)`; `web/scripts/train-nhl-xg-baseline.ts:1253 (enrichShotRowsWithHandedness)`; `web/lib/xg/deploymentContext.ts:91 buildDeploymentContextForShot`; `web/lib/xg/deploymentContext.ts:84 buildSkaterDeploymentBucket`
- **Tags (heuristic):** generation: current
- **Opus view (XG-025):**
  - Method: Handedness L/R normalization; matchup same-hand vs opposite-hand; position group forward/defense/goalie; isDefensemanShooter; deployment bucket '{F}F-{D}D(+{U}U)' per side and '{owner}_vs_{opp}'.
  - Inputs/units: —; sources: players, player_stats_unified, goalie_stats_unified, nhl_api_shift_rows
  - Output scale: categorical; counts; writes: nhl_xg_shot_features (enriched payload)
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: expanded_v2 features (not production)
- **Codex view (XG-09, calculation, location; Codex family 'Expected goals'):** On-ice deployment and matchup context
  - Purpose: Summarize forwards/defensemen and role matchup at a shot.
  - Inputs/units: Shift stints, roster positions, shot period/time.
  - Output scale: On-ice counts; deployment buckets, matchup category.
  - Version/status: Local enrichment. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (tasks/artifacts/xg-handedness-benchmark-2026-03-31.md)
  - Intended contract (Codex XG-09): Counts exclude or classify by supplied position map; exact labels in DeploymentContext. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck shooter handedness / off-wing features
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/deploymentContext.test.ts`; `web/lib/xg/handedness.test.ts`; `web/lib/xg/rosterPosition.test.ts`; `web/lib/xg/shotFeatureEnrichment.test.ts`
- **Leads (not audited):**
  - (opus) uses current shoots_catches/position (not as-of-date)
  - (opus) none of these are in the production first_pass_v1 model (shooter/goalie identity effects excluded)
  - (codex:XG-09) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-015 Rich rebound labels (offline)

- **Match:** Both; Opus XG-026; Codex XG-22
- **Purpose:** Richer rebound outcome taxonomy for offline rebound-head models.
- **Where:** `web/lib/xg/reboundRichLabels.ts:115 (classifyHighDanger)`; `web/lib/xg/reboundRichLabels.ts:120 (buildRichReboundLabels)`; `web/lib/xg/reboundHeads.ts:28 buildReboundHeadOutputs`; `web/lib/xg/reboundRichLabels.ts:120 buildRichReboundLabels`
- **Tags (heuristic):** conditionality: conditional; denominators: shots on goal; generation: research, development, current
- **Opus view (XG-026):**
  - Method: Scan forward from SOG/missed/blocked source within 3 s: stoppage -> goalie_freeze_covered_puck (if SOG) else stoppage; faceoff/penalty/period end -> possession_break; opponent-owned event -> opponent_control; possession change -> break; next eligible attempt -> next_attempt. High danger = target distance<=20 ft and angle<=35 deg.
  - Inputs/units: seconds, feet, degrees; sources: nhl_api_pbp_events
  - Output scale: labels 0/1; writes: —
  - Status: draft — offline only; caller web/scripts/train-nhl-xg-rebound-heads-offline.ts
  - Consumers: train-nhl-xg-rebound-heads-offline.ts
- **Codex view (XG-22, calculation, location; Codex family 'Expected goals'):** Rebound creation/danger/freeze/second-chance heads
  - Purpose: Expose distinct rebound output contracts.
  - Inputs/units: Creation probability; optional conditional danger/freeze/second-chance probability; ordered future outcomes for training labels.
  - Output scale: Creation p; p_creation×p_danger; freeze p; p_creation×conditional second-chance xG.
  - Version/status: rebound_heads_v1. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-22): Creation status approved_model, optional richer heads candidate_contract/unavailable; these are returned labels, not verified production status. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck expected rebounds / rebound control
  - Fixtures/test data: `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
  - Tests: `web/lib/xg/reboundHeads.test.ts`; `web/lib/xg/reboundRichLabels.test.ts`
- **Leads (not audited):**
  - (opus) high-danger box (20 ft, 35 deg) duplicates NST-parity heuristic, not NST's HD zone
  - (codex:XG-22) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-016 Team travel / rest / fatigue features

- **Match:** Both; Opus XG-027; Codex XG-26
- **Purpose:** Schedule-derived rest and travel context per team-game.
- **Where:** `web/lib/xg/travelFatigue.ts:176 (restDaysBetween)`; `web/lib/xg/travelFatigue.ts:192 (gamesSince)`; `web/lib/xg/travelFatigue.ts:204 (travelDirection)`; `web/lib/xg/travelFatigue.ts:227 (buildTeamGameTravelFatigueFeatures)`; `web/lib/xg/travelFatigue.ts:227 buildTeamGameTravelFatigueFeatures`
- **Tags (heuristic):** generation: current
- **Opus view (XG-027):**
  - Method: restDays = localDate diff - 1 (0 = back-to-back); hoursSincePreviousGame; gamesInLast 4/7/14 days (96/168/336 h, includes current game); road-trip/home-stand game number; venue tz = home team tz; timezoneDelta = venue offset - previous venue offset, east/west direction; body-clock puck-drop hour delta.
  - Inputs/units: days, hours; sources: games
  - Output scale: days; counts; hours; writes: nhl_xg_team_game_travel_fatigue_features
  - Status: live — route update-nhl-xg-travel-fatigue.ts
  - Consumers: adjusted impact rest_days_diff (promotion contract: available_not_joined)
- **Codex view (XG-26, calculation, location; Codex family 'Expected goals'):** Schedule-derived travel, rest and body-clock features
  - Purpose: Calculate fatigue context from scheduled games/timezones.
  - Inputs/units: UTC puck-drop timestamps, home/away teams, timezone map.
  - Output scale: Rest days/hours; B2B and 3-in-4 flags; games last 4/7/14 days; road/home sequence; timezone shift/body-clock hours.
  - Version/status: Local deterministic feature set. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-26): source_scope schedule_derived; venue timezone inferred from home team. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Schedule-fatigue features in public game models (e.g., MoneyPuck game model, EH)
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/travelFatigue.test.ts`
- **Leads (not audited):**
  - (opus) venue timezone assumed = home team timezone (neutral-site/global series games wrong)
  - (opus) no travel distance, only tz delta
  - (codex:XG-26) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-017 Baseline dataset encoding (feature families, imputation, one-hot, label)

- **Match:** Both; Opus XG-029; Codex XG-10
- **Purpose:** Turn shot feature rows into numeric design matrices for the shot_goal and rebound_creation models.
- **Where:** `web/lib/xg/baselineDataset.ts:32 (NUMERIC_FEATURE_KEYS)`; `web/lib/xg/baselineDataset.ts:70 (DEFAULT_NUMERIC_FEATURE_KEYS)`; `web/lib/xg/baselineDataset.ts:160 (DEFAULT_BOOLEAN_FEATURE_KEYS)`; `web/lib/xg/baselineDataset.ts:214 (BASELINE_FEATURE_FAMILY_PRESETS)`; `web/lib/xg/baselineDataset.ts:241 (FORBIDDEN_BASELINE_FEATURE_INPUT_KEYS)`; `web/lib/xg/baselineDataset.ts:281 (isEligibleBaselineTrainingRow)`; `web/lib/xg/baselineDataset.ts:299 (buildTrainingLabel)`; `web/lib/xg/baselineDataset.ts:449 (encodeNumericFeature)`; `web/lib/xg/baselineDataset.ts:465 (buildEncodedBaselineDataset)`; `web/lib/xg/baselineDataset.ts:465 buildEncodedBaselineDataset`; `web/lib/xg/baselineDataset.ts:214 BASELINE_FEATURE_FAMILY_PRESETS`
- **Tags (heuristic):** denominators: unblocked attempts, shots on goal; generation: research, current
- **Opus view (XG-029):**
  - Method: Eligible rows: drop penalty shots & shootout; shot_goal uses unblocked attempts (goal/SOG/missed, own goals excluded), label = isGoal; rebound_creation uses SOG/missed/blocked, label = createsRebound. first_pass_v1 (production): 13 numeric [normalizedX, normalizedY, shotDistanceFeet, shotAngleDegrees, periodNumber, periodSecondsElapsed, gameSecondsElapsed, timeSincePreviousEventSeconds, distanceFromPreviousEvent, ownerPowerPlayAgeSeconds, shooterShiftAgeSeconds, eastWestMovementFeet, northSouthMovementFeet] + 7 boolean [previousEventSameTeam, isReboundShot, isRushShot, isFlurryShot, isEmptyNetEvent, isOvertimeEvent, crossedRoyalRoad] + one-hot categorical [shotType, strengthState, strengthExact, zoneCode, previousEventTypeDescKey] (65 encoded columns in corrected candidate). expanded_v2 adds score diffs, possession, position; speed_context_v3 adds speeds. Missing numeric -> 0; missing boolean -> 0; categorical levels learned from all eligible rows (train+holdout). Forbidden: shotEventType, missReasonBucket, isShortSideMiss.
  - Inputs/units: feet, seconds, degrees, booleans; sources: nhl_xg_shot_features (or rebuilt from nhl_api_pbp_events + nhl_api_shift_rows)
  - Output scale: design matrix; label 0/1; writes: artifact JSON (dataset-artifact.json)
  - Status: live (offline) — run manually via `tsx web/scripts/train-nhl-xg-baseline.ts`; produced artifacts consumed by update-nhl-xg-shot-predictions via artifact path env
  - Consumers: trainBinaryLogisticModel; xgboost_js; Python challengers; encodeFeatureVector at scoring
- **Codex view (XG-10, calculation, location; Codex family 'Expected goals'):** Baseline feature encoding and chronological splits
  - Purpose: Build shot-goal/rebound classification training examples.
  - Inputs/units: NhlShotFeatureRow numeric values, booleans, categories; labels; game/date and split ratios.
  - Output scale: Encoded feature vectors, levels, train/validation/test game assignments.
  - Version/status: Three feature-family presets. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/xg/baselineDataset.ts:4 comment: 'For shot_goal, the model estimates P(goal \| this shot's features)'; web/lib/xg/baselineDataset.ts:307 comment: label is observed outcome of same shot
  - Intended contract (Codex XG-10): shot_goal means P(goal \| this shot), not future-goals projection; first_pass_v1/expanded_v2/speed_context_v3 feature lists and forbidden leakage keys. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck xG feature list (distance, angle, shot type, rebound, rush, speed, empty net, strength, score); Evolving-Hockey xG features
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`; `web/scripts/output/xg-approval-run-20260522/`
  - Tests: `web/lib/xg/baselineDataset.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) missing numerics imputed as 0 with no missing-indicator: null distance -> 0 ft (at the goal mouth), null normalizedX -> 0 (center ice)
  - (opus) categorical level vocabulary built over train+holdout (minor leakage of level existence)
  - (opus) isFlurryShot (future-dependent) is a default feature
  - (opus) periodNumber and gameSecondsElapsed entered linearly
  - (opus) strengthExact is away-v-home, not owner-relative
  - (opus) no shooter, goalie or score-state terms in production family
  - (codex:XG-10) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-018 Train/validation/test game splits (chronological and out-of-time)

- **Match:** Both; Opus XG-030; Codex XG-13
- **Purpose:** Split games for training and holdout evaluation.
- **Where:** `web/lib/xg/baselineDataset.ts:358 (normalizeSplitConfig)`; `web/lib/xg/baselineDataset.ts:384 (buildChronologicalGameSplitAssignments)`; `web/scripts/train-nhl-xg-baseline.ts:881 (buildOutOfTimeGameSplitAssignments)`; `web/scripts/train-nhl-xg-baseline.ts:789 buildNumericStandardization`; `web/scripts/train-nhl-xg-baseline.ts:881 buildOutOfTimeGameSplitAssignments`
- **Tags (heuristic):** generation: research, current
- **Opus view (XG-030):**
  - Method: Default: games ordered by date (random order within same date, seed 42), first 70% train, next 15% validation, rest test (min 1 validation if >=3 games). Out-of-time: test = --testSeasons; validation = last 15% (by date) of training-season games. Default season scope 20252026 only.
  - Inputs/units: dates; sources: —
  - Output scale: split labels; writes: artifact JSON
  - Status: live (offline) — run manually via `tsx web/scripts/train-nhl-xg-baseline.ts`; produced artifacts consumed by update-nhl-xg-shot-predictions via artifact path env
  - Consumers: trainer, calibration, evaluation
- **Codex view (XG-13, calculation, location; Codex family 'Expected goals'):** Numeric standardization and out-of-time split
  - Purpose: Scale baseline numeric features using training statistics and define chronological holdout.
  - Inputs/units: Training feature vectors; game dates and season scopes.
  - Output scale: Feature means/scales and standardized values; temporal split assignment.
  - Version/status: Local training utilities. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-13): Implementation and serialized transforms are the contract. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Standard out-of-time validation used by EH/MoneyPuck (train prior seasons, test later season)
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
  - Tests: `web/lib/xg/baselineDataset.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) corrected candidate trained on a single season (20252026) with chronological in-season split — no multi-season training or true out-of-season test
  - (opus) test set ~1,295 goals / 17,834 shots
  - (codex:XG-13) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-019 Binary logistic regression trainer (in-house gradient descent)

- **Match:** Both; Opus XG-031; Codex XG-11
- **Purpose:** Fit the production shot-goal model (logistic_l2) and calibrators.
- **Where:** `web/lib/xg/binaryLogistic.ts:84 (trainBinaryLogisticModel)`; `web/lib/xg/binaryLogistic.ts:135 (predictBinaryLogisticProbability)`; `web/scripts/train-nhl-xg-baseline.ts:931 (resolveFitOptions)`; `web/scripts/train-nhl-xg-baseline.ts:2008 (call)`; `web/lib/xg/binaryLogistic.ts:84 trainBinaryLogisticModel`; `web/lib/xg/binaryLogistic.ts:135 predictBinaryLogisticProbability`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, current
- **Opus view (XG-031):**
  - Method: Full-batch gradient descent from zero weights/bias: grad = sum(error*x*w)/totalWeight; update w -= lr*(grad + l1*sign(w) + l2*w); bias unpenalized. Defaults: 800 iterations, lr 0.05. Families: logistic_unregularized (l1=0,l2=0), logistic_l2 (l2=0.01), logistic_elastic_net (l1=0.001,l2=0.01). Output clipped to [1e-9, 1-1e-9]. No convergence check.
  - Inputs/units: standardized features; sources: —
  - Output scale: probability 0-1; writes: model-artifact.json model
  - Status: live (offline) — run manually via `tsx web/scripts/train-nhl-xg-baseline.ts`; produced artifacts consumed by update-nhl-xg-shot-predictions via artifact path env; corrected candidate approved=true
  - Consumers: shot xG scoring; Platt calibrator; rebound heads
- **Codex view (XG-11, calculation, location; Codex family 'Expected goals'):** Logistic shot-goal and rebound-creation probability
  - Purpose: Train and score weighted binary logistic classifiers.
  - Inputs/units: Encoded features, binary goal/rebound labels, optional sample weights, L1/L2, learning rate.
  - Output scale: Sigmoid probability clipped to [1e-9,1−1e-9]; weights/intercept.
  - Version/status: logistic_unregularized and logistic_l2 artifact families. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (tasks/artifacts/xg-logistic-vs-l2-comparison-2026-03-31.md, xg-first-baseline-decision-2026-03-31-repaired.md)
  - Intended contract (Codex XG-11): 800 default gradient iterations and .05 default rate; probabilities stored separately for shot_goal/rebound_creation. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: scikit-learn LogisticRegression (lbfgs, converged); Evolving-Hockey/MoneyPuck use gradient boosting (XGBoost/GBM)
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`; `web/scripts/output/xg-approval-run-20260522/`; `web/scripts/output/xg-baselines/`
  - Tests: `web/lib/xg/binaryLogistic.test.ts`
- **Leads (not audited):**
  - (opus) 800 fixed GD steps with lr 0.05 from zero is likely unconverged (corrected candidate test log loss 0.2434 vs null-model ~0.260; typical public xG ~0.20-0.21)
  - (opus) approval run cfg56c3fc2f used lr 1e-4 and collapsed to mean prediction 0.0008 (log loss 1.43)
  - (opus) subgradient L1 (not proximal)
  - (opus) purely linear in distance/angle (no log/spline/interaction terms)
  - (codex:XG-11) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-020 Python challenger models (LightGBM / CatBoost / XGBoost, global and per-strength)

- **Match:** Both; Opus XG-032; Codex XG-12
- **Purpose:** Offline challengers against the champion artifact's exact dataset contract.
- **Where:** `web/scripts/train_nhl_xg_challengers.py:61 (align_reference_contract)`; `web/scripts/train_nhl_xg_challengers.py:177 (build_model)`; `web/scripts/train_nhl_xg_challengers.py:232 (fit_platt)`; `web/scripts/train_nhl_xg_challengers.py:289 (main)`; `web/scripts/train-nhl-xg-baseline.ts:1750 main`; `web/scripts/train_nhl_xg_challengers.py:177 build_model`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, development, current
- **Opus view (XG-032):**
  - Method: LGBMClassifier(binary, lr 0.05, 31 leaves, min_child 50, subsample/colsample 0.9, lambda 1); CatBoost(Logloss, depth 6, lr 0.05, l2 3); XGBClassifier(binary:logistic, lr 0.05, depth 4, min_child 5, subsample/colsample 0.9, lambda 1); n_estimators from CLI. Each fitted globally and per strengthState (if min rows/positives met); Platt (C=1e6) on validation when >=20 rows and >=10 of each class.
  - Inputs/units: standardized features; sources: offline JSON export only
  - Output scale: probability 0-1; writes: JSON report file
  - Status: draft — offline only, docstring: never connects to Supabase
  - Consumers: manual comparison
- **Codex view (XG-12, calculation, location; Codex family 'Expected goals'):** Boosted-tree xG baseline and Python challengers
  - Purpose: Train nonlinear alternative classifiers on same encoded shot contract.
  - Inputs/units: Encoded shot vectors/labels; train/validation/test partitions, seed and estimator settings.
  - Output scale: Goal or rebound probabilities; feature importance/evaluation artifacts.
  - Version/status: xgboost_js and offline challenger families. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/scripts/train_nhl_xg_challengers.py:5 docstring
  - Intended contract (Codex XG-12): TS @fractal-solutions/xgboost-js; Python LightGBM, CatBoost and XGBoost use reference contract alignment. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Evolving-Hockey (XGBoost per strength state), MoneyPuck (GBM)
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
  - Tests: `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) never registers/promotes (docstring line 5); results not wired to production
  - (codex:XG-12) Active model/approval not verified; third-party learner internals are dependencies, not in-house formulas.

## M-XG-021 Numeric feature standardization

- **Match:** Both; Opus XG-034; Codex XG-13
- **Purpose:** z-score numeric features with train-split mean/std; persisted for scoring.
- **Where:** `web/scripts/train-nhl-xg-baseline.ts:789 (buildNumericStandardization)`; `web/scripts/train-nhl-xg-baseline.ts:811 (applyFeatureTransforms)`; `web/lib/xg/shotFeaturePersistence.ts:532 (encodeFeatureVector applies same transform)`; `web/scripts/train-nhl-xg-baseline.ts:789 buildNumericStandardization`; `web/scripts/train-nhl-xg-baseline.ts:881 buildOutOfTimeGameSplitAssignments`
- **Tags (heuristic):** generation: research, current
- **Opus view (XG-034):**
  - Method: mean and population std over TRAIN examples only; std<=1e-9 -> 1; x' = (x-mean)/std. Booleans/one-hots untouched.
  - Inputs/units: raw feature units; sources: —
  - Output scale: z-scores; writes: model-artifact.json featureTransforms
  - Status: live (offline) — run manually via `tsx web/scripts/train-nhl-xg-baseline.ts`; produced artifacts consumed by update-nhl-xg-shot-predictions via artifact path env
  - Consumers: logistic trainer; scoring
- **Codex view (XG-13, calculation, location; Codex family 'Expected goals'):** Numeric standardization and out-of-time split
  - Purpose: Scale baseline numeric features using training statistics and define chronological holdout.
  - Inputs/units: Training feature vectors; game dates and season scopes.
  - Output scale: Feature means/scales and standardized values; temporal split assignment.
  - Version/status: Local training utilities. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-13): Implementation and serialized transforms are the contract. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: none suggested
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
  - Tests: `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) imputed zeros enter the mean/std, distorting scaling for sparsely populated features (e.g., ownerPowerPlayAgeSeconds mostly null->0)
  - (codex:XG-13) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-022 xgboost_js boosted-tree family (third-party @fractal-solutions/xgboost-js)

- **Match:** Both; Opus XG-035; Codex XG-RUNTIME
- **Purpose:** Alternative tree model; CLI default family.
- **Where:** `web/scripts/train-nhl-xg-baseline.ts:968 (resolveBoostingFitOptions)`; `web/scripts/train-nhl-xg-baseline.ts:2013 (new XGBoost)`; `web/lib/xg/shotFeaturePersistence.ts:585 (predictXgBoostNode)`; `web/lib/xg/shotFeaturePersistence.ts:593 (predictXgBoost)`; `web/node_modules/@fractal-solutions/xgboost-js/src/xgboost.js:22 (fit), :121 (predictSingle)`; `web/lib/xg/shotFeaturePersistence.ts:575 predictLogistic`; `web/lib/xg/shotFeaturePersistence.ts:593 predictXgBoost`; `web/lib/xg/shotFeaturePersistence.ts:611 predictShotGoalProbabilities`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: legacy, development, current
- **Opus view (XG-035):**
  - Method: lr 0.1, maxDepth 3, minChildWeight 5, numRounds 60. Library fits residuals (y - p) in PROBABILITY space starting at 0.5, leaf = mean residual, split gain = sum^2/n; prediction = sigmoid(0.5 + lr*sum(leaves)). Repo scorer re-implements the same (prediction starts 0.5, sigmoid at end).
  - Inputs/units: standardized features; sources: —
  - Output scale: claimed probability 0-1 (miscalibrated); writes: model-artifact.json
  - Status: legacy/draft — artifacts in web/scripts/output/xg-baselines/xgboost_js-*; production candidate is logistic_l2
  - Consumers: benchmark-nhl-xg-baselines.ts; scoring if artifact.family=='xgboost_js'
- **Codex view (XG-RUNTIME, calculation, location; Codex family 'Expected goals'):** Persisted-artifact xG inference and calibration selection
  - Purpose: Score shot rows using the serialized selected model.
  - Inputs/units: Encoded features; persisted model family, logistic weights/bias or tree nodes/learning rate; serialized calibration.
  - Output scale: Raw probability, optional calibrated probability and xg; probability clipped 1e-9 to 1−1e-9.
  - Version/status: Runtime scoring implementation; active artifact unknown. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (tasks/artifacts/xg-baseline-benchmark-summary-2026-03-31.md)
  - Intended contract (Codex XG-RUNTIME): Logistic sigmoid(dot(weights,features)+bias); tree scorer starts at .5 and sums learningRate*leaf then sigmoid; xg chooses calibrated output only when artifact.calibration.applied is true. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: XGBoost binary:logistic (gradient+hessian in logit space) as used by Evolving-Hockey
  - Fixtures/test data: `web/scripts/output/xg-baselines/`
  - Tests: `web/lib/xg/shotFeaturePersistence.test.ts`; `web/scripts/benchmark-nhl-xg-baselines.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) train/predict mismatch: training accumulates in probability space but prediction applies sigmoid to that sum, so outputs cluster near sigmoid(~0.07..0.5) ~ 0.52-0.62 — not valid probabilities without heavy recalibration
  - (opus) it is the CLI default family (train-nhl-xg-baseline.ts:665 default 'xgboost_js')
  - (opus) not true XGBoost (no hessian, no regularization)
  - (codex:XG-RUNTIME) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-023 xG-adjusted player impact (shot-level ridge, 'RAPM-like')

- **Match:** Both; Opus XG-037; Codex XG-25
- **Purpose:** Estimate one coefficient per skater for on-ice xG differential with teammate/opponent and context controls.
- **Where:** `web/lib/xg/adjustedImpact.ts:216 (buildContextFeatures)`; `web/lib/xg/adjustedImpact.ts:310 (buildAdjustedImpactDesignRows)`; `web/lib/xg/adjustedImpact.ts:430 (fitAdjustedImpactBaseline)`; `web/pages/api/v1/db/update-nhl-xg-adjusted-impact.ts:292 (defaults)`; `web/lib/xg/adjustedImpact.ts:310 buildAdjustedImpactDesignRows`; `web/lib/xg/adjustedImpact.ts:430 fitAdjustedImpactBaseline`; `web/lib/xg/adjustedImpact.ts:553 validateAdjustedImpactHeldOut`
- **Tags (heuristic):** generation: current
- **Opus view (XG-037):**
  - Method: One design row PER SHOT (no rows for shot-free time). Response = shot xG (response_xg_differential = xg, always >=0). Shooting-team skaters coded +1, opponents -1 (goalies removed), single coefficient per player (offense and defense pooled). Context: is_home +/-1, period_seconds/1200, owner score diff, rest-day diff, one-hot strength_state, strength_exact, score bucket, zone_code, shot_zone_code. Fit: full-batch GD on squared error, intercept init = mean response, 500 iterations, lr 0.03, L2 0.1 on player and context weights; minPlayerRows=100 (route default). SE approx = sqrt(MSE / player rows).
  - Inputs/units: xG per shot; seconds/1200; goal diff; days; sources: nhl_xg_shot_predictions, nhl_xg_shot_features, nhl_api_shift_rows, games
  - Output scale: regression coefficient in xG-per-shot units; writes: nhl_xg_adjusted_impact_model_runs, nhl_xg_adjusted_player_impacts
  - Status: live (diagnostic) — route update-nhl-xg-adjusted-impact.ts; adjustedImpactPromotionContract currentStatus 'diagnostic_live', 'do not render as a rankings metric'
  - Consumers: web/lib/rankings/defensiveCompositeMethodology.ts:38 (cited as diagnostic source); web/lib/rankings/adjustedImpactPromotionContract.ts (gate); web/lib/ml/featureLeakageRegistry.ts
- **Codex view (XG-25, calculation, location; Codex family 'Expected goals'):** Regularized adjusted on-ice impact baseline
  - Purpose: Fit sparse player/context coefficients for on-ice xG differential.
  - Inputs/units: Shot xG with on-ice stints; player +/− coefficients and context features.
  - Output scale: Regularized player/context estimates in target differential units; holdout RMSE/MAE and baseline comparison.
  - Version/status: 500 default iterations, .03 learning rate, .1 L2. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/rankings/adjustedImpactPromotionContract.ts:71 currentUse: live methodology/diagnostic source only; promotion gate lists required controls
  - Intended contract (Codex XG-25): ADJUSTED_IMPACT_TARGET_FAMILY=on_ice_xg_differential_v1; descriptive/pregame mode distinction. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Macdonald (2011/2012) xG RAPM / Schuckers-Curro THoR; Evolving-Hockey RAPM (stint rows, per-60 response, TOI weights, separate O/D coefficients, ridge via cross-validated lambda)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/adjustedImpactPromotionContract.test.ts`; `web/lib/xg/adjustedImpact.test.ts`
- **Leads (not audited):**
  - (opus) NOT RAPM in the standard sense: rows are shots not stints, so shot volume/rate is not modeled — only xG per shot conditional on a shot; response is never negative
  - (opus) single pooled coefficient per player conflates offense (+1 rows) and defense (-1 rows) — promotion contract itself lists 'defense_specific_target' as missing
  - (opus) no TOI weighting, no per-60 normalization, no separate PP/SH models (strength only as context dummy); EN shots included
  - (opus) GD with fixed 500 steps likely unconverged; L2 0.1 not cross-validated
  - (opus) SE formula is heuristic
  - (codex:XG-25) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-024 Created xG (shot-assist + transition)

- **Match:** Both; Opus XG-038; Codex XG-21
- **Purpose:** Per-player created xG combining shot-assist and best non-shooter transition credit.
- **Where:** `web/lib/xg/createdXg.ts:126 (TRANSITION_CREATOR_TYPES)`; `web/lib/xg/createdXg.ts:173 (addGameRowComponent)`; `web/lib/xg/createdXg.ts:227 (buildRollingRows)`; `web/lib/xg/createdXg.ts:318 (buildCreatedXgAggregates)`; `web/lib/xg/createdXg.ts:318 buildCreatedXgAggregates`
- **Tags (heuristic):** generation: current
- **Opus view (XG-038):**
  - Method: created_xg = shot_assist_created_xg (expected_primary_assists, excluding self) + max single transition_created_xg per player-shot among controlled_entry/controlled_exit/entry_assist proxies (non-shooter) + rebound_created_xg (always 0, not included). Rolling 5/10/20 sums.
  - Inputs/units: xG goals; sources: nhl_xg_shot_assist_candidates, nhl_xg_transition_events, nhl_xg_shot_features
  - Output scale: xG goals; writes: nhl_xg_player_created_xg_game_aggregates, nhl_xg_player_created_xg_rolling_aggregates
  - Status: live — route update-nhl-xg-created-xg.ts
  - Consumers: web/pages/api/v1/underlying-stats/xg.ts; xgExplorer
- **Codex view (XG-21, calculation, location; Codex family 'Expected goals'):** Created xG aggregation and attribution deduplication
  - Purpose: Combine non-shooter shot-assist and transition credit.
  - Inputs/units: Expected-primary-assist rows, transition-created xG, shot identity.
  - Output scale: shot_assist_created_xg, transition_created_xg, rebound_created_xg, created_xg; event counts and game/L5/L10/L20 totals.
  - Version/status: Current implementation includes reserved rebound field. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/xg/createdXg.ts:164 provenance formula string
  - Intended contract (Codex XG-21): Excludes shooter self-credit and retains maximum transition per player/shot; provenance/reconciliation included. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: EH/MoneyPuck xA-like 'xG created'
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/createdXg.test.ts`
- **Leads (not audited):**
  - (opus) rebound component declared but always 0 (reboundCreatedXgIncluded:false)
  - (opus) can double-count shot xG between shot-assist and transition credit for the same shot
  - (codex:XG-21) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-025 Quality of teammates / competition (QoT/QoC) percentiles

- **Match:** Both; Opus XG-039; Codex XG-24
- **Purpose:** TOI-weighted average percentile ratings of teammates and opponents.
- **Where:** `web/lib/xg/qotQoc.ts:101 (percentileRank)`; `web/lib/xg/qotQoc.ts:110 (buildBucketByPlayer)`; `web/lib/xg/qotQoc.ts:137 (buildQotQocPlayerRatings)`; `web/lib/xg/qotQoc.ts:407 (buildQotQocFeatureRows)`; `web/lib/xg/qotQoc.ts:581 (validateQotQocLeakage)`; `web/pages/api/v1/db/update-nhl-xg-qot-qoc.ts:150 (rating inputs)`; `web/lib/xg/qotQoc.ts:137 buildQotQocPlayerRatings`; `web/lib/xg/qotQoc.ts:407 buildQotQocFeatureRows`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (XG-039):**
  - Method: Players split by position into TOI terciles (low/middle/high); percentile = (#<=value - 1)/(n-1) within position:tercile group for offensive and defensive metric. For each stint, each skater gets mean teammate and mean opponent percentile, weighted by stint seconds; unit (F/D) rows too; rolling 5/10/20.
  - Inputs/units: seconds; rating units; sources: skater_offensive_ratings_daily, skater_defensive_ratings_daily, players, nhl_api_shift_rows
  - Output scale: percentile 0-1; writes: nhl_xg_qot_qoc_* tables (player/unit game & rolling)
  - Status: live — route update-nhl-xg-qot-qoc.ts
  - Consumers: xgExplorer / diagnostics
- **Codex view (XG-24, calculation, location; Codex family 'Expected goals'):** QoT/QoC comparable-player ratings and on-ice exposure
  - Purpose: Measure quality of teammates/competition using ratings and shared ice time.
  - Inputs/units: Offensive/defensive metrics, position, TOI seconds, shift stints and as-of metadata.
  - Output scale: Within-position/TOI-tercile percentiles [0,1]; time-weighted teammate/opponent offense/defense context; line/pair and rolling values.
  - Version/status: Comparable groups by position plus low/middle/high TOI. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-24): Source provenance and leakage validators separately declared. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: NST/EH QoT/QoC (TOI% or xGF%-based); HockeyViz
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/qotQoc.test.ts`
- **Leads (not audited):**
  - (opus) single rating snapshot applied to all historical games (possible look-ahead; validateQotQocLeakage flags same-game overlap)
  - (opus) percentiles relative to TOI tercile, not league
  - (opus) all strengths mixed in stints
  - (codex:XG-24) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-026 Rebound-control aggregates (expected vs actual rebounds; goalie rebound control above expected)

- **Match:** Both; Opus XG-040; Codex XG-23
- **Purpose:** Sum rebound-creation probabilities vs outcomes by team, shooter and goalie.
- **Where:** `web/lib/xg/reboundControl.ts:209 (rowOutcome)`; `web/lib/xg/reboundControl.ts:254 (buildReboundControlAggregates)`; `web/lib/xg/reboundControl.ts:386 (goalie saved above expected)`; `web/lib/xg/reboundControl.ts:254 buildReboundControlAggregates`
- **Tags (heuristic):** generation: current
- **Opus view (XG-040):**
  - Method: Exclude unapproved, delayed-penalty; team for/against sums of expected and actual rebounds, freezes, covered pucks, no-danger; player expected/actual rebounds created; goalie (non-EN) rebound_control_saved_above_expected = expected_rebounds_allowed - actual_rebounds_allowed.
  - Inputs/units: probabilities; sources: nhl_xg_shot_predictions (rebound_creation), nhl_xg_shot_features
  - Output scale: expected counts; writes: nhl_xg_rebound_control_team_game_aggregates, nhl_xg_rebound_control_player_game_aggregates, nhl_xg_rebound_control_goalie_game_aggregates
  - Status: live — route update-nhl-xg-rebound-control.ts
  - Consumers: xgExplorer; underlying-stats/xg API
- **Codex view (XG-23, calculation, location; Codex family 'Expected goals'):** Rebound-control aggregates and above-expected control
  - Purpose: Aggregate expected/actual rebounds and observed freeze/continuation outcomes.
  - Inputs/units: Approved rebound_creation rows, labels, goalie/team/player identity.
  - Output scale: Expected/actual rebounds created/allowed, above-expected measures, freezes/covered-puck/no-danger counts.
  - Version/status: Model and label-only outputs distinct. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-23): Freeze surface explicitly label_only_no_approved_model. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck expected rebounds / rebound control
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/reboundControl.test.ts`
- **Leads (not audited):**
  - (opus) covered_puck set whenever goalie_freeze (duplicative)
  - (opus) freeze model status is 'label_only_no_approved_model'
  - (codex:XG-23) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-027 Rebound head outputs (danger / second-chance xG)

- **Match:** Both; Opus XG-041; Codex XG-22
- **Purpose:** Combine rebound creation probability with conditional heads.
- **Where:** `web/lib/xg/reboundHeads.ts:28 (buildReboundHeadOutputs)`; `web/lib/xg/reboundHeads.ts:28 buildReboundHeadOutputs`; `web/lib/xg/reboundRichLabels.ts:120 buildRichReboundLabels`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: conditional; generation: development, current
- **Opus view (XG-041):**
  - Method: rebound_danger = P(create) x P(high danger \| rebound); second_chance_xg = P(create) x E[xG \| rebound]; freeze passthrough; statuses approved_model / candidate_contract / unavailable.
  - Inputs/units: probabilities; sources: —
  - Output scale: probability / xG; writes: —
  - Status: draft — only caller /api/v1/xg/operations (candidate_contract)
  - Consumers: web/pages/api/v1/xg/operations.ts
- **Codex view (XG-22, calculation, location; Codex family 'Expected goals'):** Rebound creation/danger/freeze/second-chance heads
  - Purpose: Expose distinct rebound output contracts.
  - Inputs/units: Creation probability; optional conditional danger/freeze/second-chance probability; ordered future outcomes for training labels.
  - Output scale: Creation p; p_creation×p_danger; freeze p; p_creation×conditional second-chance xG.
  - Version/status: rebound_heads_v1. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-22): Creation status approved_model, optional richer heads candidate_contract/unavailable; these are returned labels, not verified production status. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck 'xGoals of xRebounds'
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/reboundHeads.test.ts`; `web/lib/xg/reboundRichLabels.test.ts`
- **Leads (not audited):**
  - (codex:XG-22) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-028 Lagged residual shooter/goalie skill layer

- **Match:** Both; Opus XG-042; Codex XG-17
- **Purpose:** Adjust baseline xG with shrunken prior-to-date shooter finishing and goalie save residuals.
- **Where:** `web/lib/xg/residualSkill.ts:23 (effect)`; `web/lib/xg/residualSkill.ts:32 (buildLaggedResidualSkillLayers)`; `web/pages/api/v1/xg/operations.ts:15 (import)`; `web/lib/xg/residualSkill.ts:32 buildLaggedResidualSkillLayers`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (XG-042):**
  - Method: Process shots chronologically; effect = mean(residual) * n/(n+200), only if n >= 50 prior shots; shooter residual = label - xg; goalie residual = xg - label. adjusted = clamp(xg + shooterEffect - goalieEffect, 0, 1). State updated after each shot (strictly lagged).
  - Inputs/units: probability; sources: nhl_xg_shot_predictions
  - Output scale: probability 0-1; writes: —
  - Status: live (diagnostic) — only caller web/pages/api/v1/xg/operations.ts
  - Consumers: web/pages/api/v1/xg/operations.ts (diagnostic)
- **Codex view (XG-17, calculation, location; Codex family 'Expected goals'):** Lagged shooter finishing and goalie save residuals
  - Purpose: Build residual skill layers using earlier outcomes.
  - Inputs/units: Chronological shot labels and baseline probability, shooter/goalie IDs.
  - Output scale: Shrinkage residual effects; clipped adjusted probability [0,1].
  - Version/status: lagged_residual_skill_v1. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-17): Effect=(sum residual/n)×n/(n+priorStrength); default min 50, prior strength 200; update state after scoring row. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Shooter talent regression to mean (Tango-style n/(n+k)); MoneyPuck shooting talent adjusted xG; EH xFSh%/goalie GSAx
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/residualSkill.test.ts`
- **Leads (not audited):**
  - (opus) additive adjustment in probability space (not logit) can go negative/clamped
  - (opus) same-game events update state before later shots in that game (within-game lag only)
  - (opus) k=200 and min 50 are magic numbers
  - (codex:XG-17) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-029 Shot-assist candidates / expected primary assists

- **Match:** Both; Opus XG-043; Codex XG-19
- **Purpose:** Heuristic credit of shot xG to the prior same-team event actor.
- **Where:** `web/lib/xg/shotAssists.ts:75 (MAX_SHOT_ASSIST_WINDOW_SECONDS=8)`; `web/lib/xg/shotAssists.ts:133 (scoreShotAssistConfidence)`; `web/lib/xg/shotAssists.ts:177 (buildShotAssistCandidateRows)`; `web/lib/xg/shotAssists.ts:133 scoreShotAssistConfidence`; `web/lib/xg/shotAssists.ts:177 buildShotAssistCandidateRows`
- **Tags (heuristic):** denominators: unblocked attempts; generation: current
- **Opus view (XG-043):**
  - Method: Eligible: unblocked, non-rebound shot; previous event same team, 0<dt<=8 s, previous type not in excluded set (faceoff, shots, goal, giveaway, stoppage, penalties, period events...) -> effectively takeaways and hits. confidence = 0.35 +0.25 (dt<=3) or +0.15 (dt<=5) +0.15 (dist<=35) or +0.05 (dist<=70) +0.10 (entered OZ) +0.05 (regained) -0.20 (hit), clamped [0.1,0.85]; tiers >=0.7 high, >=0.45 medium. expected_primary_assists = xg * confidence.
  - Inputs/units: seconds, feet; sources: nhl_xg_shot_features, nhl_xg_shot_predictions, nhl_api_pbp_events
  - Output scale: xG goals x confidence 0.1-0.85; writes: nhl_xg_shot_assist_candidates
  - Status: live — route update-nhl-xg-shot-assists.ts
  - Consumers: created xG; xgExplorer
- **Codex view (XG-19, calculation, location; Codex family 'Expected goals'):** Expected primary assists / inferred shot-assist confidence
  - Purpose: Assign prior-event creator candidates and confidence-weighted xG credit.
  - Inputs/units: Same-team prior actor; lag ≤8 sec; distance feet; possession context; shot xG.
  - Output scale: Confidence .1–.85 and tier; expected_primary_assists and candidate records.
  - Version/status: Heuristic attribution layer. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): provenance note in code: 'Inferred candidate, not official tracked pass data.' (web/lib/xg/shotAssists.ts:268)
  - Intended contract (Codex XG-19): Confidence starts .35, adds lag/location/entry/regain and penalizes weak event type; inferred candidate, not tracked pass. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Tracked passing data (Corey Sznajder/AllThreeZones), MoneyPuck/EH xA
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/shotAssists.test.ts`
- **Leads (not audited):**
  - (opus) NHL PBP has no pass events — 'shot assists' are takeaway/hit-to-shot proxies; resolvePriorEventActor branches for faceoff/blocked-shot are unreachable (types excluded)
  - (opus) confidence weights are hand-set
  - (codex:XG-19) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-030 Transition proxies (controlled entry/exit, transition-created xG)

- **Match:** Both; Opus XG-044; Codex XG-20
- **Purpose:** Proxy zone transitions from PBP and credit shot xG to transition actors.
- **Where:** `web/lib/xg/transitions.ts:142 (isControlledSource)`; `web/lib/xg/transitions.ts:159 (isTransitionShot)`; `web/lib/xg/transitions.ts:178 (addAggregateMetric)`; `web/lib/xg/transitions.ts:237 (buildTransitionRows)`; `web/lib/xg/transitions.ts:237 buildTransitionRows`
- **Tags (heuristic):** denominators: unblocked attempts; generation: current
- **Opus view (XG-044):**
  - Method: Transition shot = unblocked non-rebound shot that is a rush, or possession entered OZ with possession duration <=15 s. Source = rush source, else possession start, else previous event; faceoff sources skipped. Shooter gets transition_created_shot with confidence 0.7 (rush) / 0.5, minus 0.15 if source zone not D/N; actor gets controlled_entry_proxy (0.7/0.5) when source zone N/D and same team; controlled_exit_proxy (0.65/0.45) when source zone D; dump_in 0.3 if type contains 'dump'. transition_created_xg = xg * confidence.
  - Inputs/units: seconds; sources: nhl_xg_shot_features, nhl_xg_shot_predictions, nhl_api_pbp_events
  - Output scale: xG x confidence; writes: nhl_xg_transition_events, nhl_xg_transition_game_aggregates
  - Status: live — route update-nhl-xg-transitions.ts
  - Consumers: created xG; xgExplorer
- **Codex view (XG-20, calculation, location; Codex family 'Expected goals'):** Transition event credit and transition-created xG
  - Purpose: Derive transition/entry/exit/regain candidate events and xG credit.
  - Inputs/units: Shot feature context, source actor/event, approved prediction.
  - Output scale: Transition counts, confidence [0,1], transition_created_xg and player/team totals.
  - Version/status: Local inference layer. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): provenance note: 'Public-PBP transition proxy, not puck-tracking zone-entry data.' (web/lib/xg/transitions.ts:321)
  - Intended contract (Codex XG-20): TransitionSourceEventRow and event-type/confidence rules. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Tracked zone-entry data (Sznajder AllThreeZones), EH/MoneyPuck rush stats
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/transitions.test.ts`
- **Leads (not audited):**
  - (opus) dump_in_entry_proxy increments controlled_entries in aggregates
  - (opus) isDumpInSource can never be true for NHL type_desc_key values (no 'dump' events) — dead branch
  - (opus) one shot can credit the same xg to shooter + entry + exit actors (sum > shot xG)
  - (opus) failed_exit_against_proxy / entry_assist_proxy rules hand-set (0.35/0.45)
  - (codex:XG-20) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-031 xG denominator semantics (xSh%, shooting above expected, shot quality)

- **Match:** Both; Opus XG-045; Codex XG-DENOM
- **Purpose:** Canonical Fenwick-denominator ratios over xG aggregates.
- **Where:** `web/lib/rankings/xgDenominatorSemantics.ts:35 (calculateExpectedShootingPercentage)`; `web/lib/rankings/xgDenominatorSemantics.ts:45 (calculateShootingAboveExpectedPercentage)`; `web/lib/rankings/xgDenominatorSemantics.ts:57 (calculateTeamShotQuality)`; `web/lib/rankings/xgDenominatorSemantics.ts:67 (calculateGoalieXgaPerUnblockedAttempt)`; `web/lib/rankings/xgDenominatorSemantics.ts:35 calculateExpectedShootingPercentage`; `web/lib/rankings/xgDenominatorSemantics.ts:45 calculateShootingAboveExpectedPercentage`; `web/lib/rankings/xgDenominatorSemantics.ts:57 calculateTeamShotQuality`; `web/lib/rankings/xgDenominatorSemantics.ts:67 calculateGoalieXgaPerUnblockedAttempt`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: unblocked attempts; generation: legacy, current
- **Opus view (XG-045):**
  - Method: xSh% = ixG/iFF*100; shooting above expected = (G - ixG)/iFF*100; team shot quality = xGF/FF; goalie xGA per unblocked attempt = xGA/FA. Null when denominator <=0.
  - Inputs/units: xG goals, counts; sources: nhl_xg_*_aggregates
  - Output scale: percent 0-100 for xSh%; xG per attempt 0-1; writes: —
  - Status: legacy/dead — no non-test callers found
  - Consumers: none found outside tests
- **Codex view (XG-DENOM, calculation, location; Codex family 'Expected goals'):** Unblocked-attempt xG denominator helpers
  - Purpose: Make shot-universe-specific ratios explicit.
  - Inputs/units: Goals, ixG/xGF/xGA in goal units and Fenwick/unblocked attempts.
  - Output scale: xSH%=100*ixG/unblocked; SAX%=100*(goals−ixG)/unblocked; team and goalie xG per unblocked attempt.
  - Version/status: Explicit denominator semantics helper. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/rankings/xgDenominatorSemantics.ts:1 XG_SHOT_UNIVERSE='fenwick_unblocked'
  - Intended contract (Codex XG-DENOM): XG_SHOT_UNIVERSE=fenwick_unblocked; positive denominators required; 6-decimal rounding. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: NST xFSh% (ixG/iFF)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/xgDenominatorSemantics.test.ts`
- **Leads (not audited):**
  - (opus) no non-test callers found by rg (definitions only)
  - (codex:XG-DENOM) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-032 Player-trend expected shooting % (NST ixG/iFF)

- **Match:** Both; Opus XG-046; Codex core-154
- **Purpose:** Trend metric expected_shooting_pct from NST counts.
- **Where:** `web/lib/trends/playerTrendCalculator.ts:307 (expected_shooting_pct accessor)`; `web/scripts/audit-player-trend-expected-shooting.ts:264 (audit formula)`; `web/lib/trends/playerTrendCalculator.ts:307 expected_shooting_pct`; `web/lib/trends/playerTrendCalculator.ts:160 processMetric`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: unblocked attempts; generation: current
- **Opus view (XG-046):**
  - Method: ixg / iff (null if iff<=0); audit script documents formula 'nst_ixg / nst_iff * 100'.
  - Inputs/units: xG goals, counts; sources: NST-derived player trend source rows
  - Output scale: fraction or percent (check accessor return; audit says *100); writes: —
  - Status: live — player trend calculator
  - Consumers: player trends
- **Codex view (core-154, calculation, location; Codex family 'player trend metric'):** Skater Expected Shooting %
  - Formula: 100*ixG/individual unblocked attempts; not ordinary shots-on-net SH%. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater expected shooting % over cumulative and rolling game windows.
  - Inputs/units: Source metric expected_shooting_pct per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-154): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - External references: NST xFSh%
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/trends/playerTrendCalculator.test.ts`
- **Leads (not audited):**
  - (opus) uses NST's xG, not FHFH's model — two xG universes coexist in the site
  - (codex:core-154) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-XG-033 Team/player/goalie game xG aggregation and goalie GSAx

- **Match:** Both; Opus XG-049; Codex XG-18
- **Purpose:** Sum approved per-shot xG into team-game, shooter-game and goalie-game rows.
- **Where:** `web/lib/xg/aggregates.ts:618 (buildXgAggregates)`; `web/lib/xg/aggregates.ts:422 (addTeamGameRow)`; `web/pages/api/v1/db/update-nhl-xg-aggregates.ts:403 (route)`; `web/lib/xg/aggregates.ts:618 buildXgAggregates`
- **Tags (heuristic):** denominators: per team game, all strengths, unblocked attempts, shots on goal; generation: current
- **Opus view (XG-049):**
  - Method: Per team-game: xg_for/against = sum xg; goals_for/against = sum label; shot_attempts = count of unblocked attempts; flurry-adjusted versions. Player: ixg, goals, shot_attempts per shooter. Goalie (only when goalie_in_net_id non-null): xg_against, goals_against, shots_against (= Fenwick against, not SOG), GSAx = xg_against - goals_against. All strengths pooled (EN included for team/player).
  - Inputs/units: xG goals; sources: nhl_xg_shot_predictions, nhl_xg_shot_features (flurry metadata), games
  - Output scale: xG goals, counts; writes: nhl_xg_team_game_aggregates, nhl_xg_player_game_aggregates, nhl_xg_goalie_game_aggregates
  - Status: live — admin/cron route web/pages/api/v1/db/update-nhl-xg-aggregates.ts; read by MetricsTimeline, homepageGameAnalytics, FORGE team-context-queries, /underlying-stats/xg
  - Consumers: components/MetricsTimeline/MetricsTimeline.tsx:159; web/lib/homepageGameAnalytics.ts:385; rolling aggregates; xgExplorer
- **Codex view (XG-18, calculation, location; Codex family 'Expected goals'):** Team, player and goalie xG aggregates
  - Purpose: Sum approved shot-goal expectations into game and rolling totals.
  - Inputs/units: Approved shot_goal predictions, shot ownership/shooter/goalie and game context.
  - Output scale: Team xGF/xGA, individual ixG, goalie xGA, goals, shot counts, GSAx=xGA−GA; raw/flurry variants; L5/L10/L20 totals.
  - Version/status: Default windows 5,10,20. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/xg/shotFeaturePersistence.ts:615 comment (sums create ixG/xGF/xGA)
  - Intended contract (Codex XG-18): Source prediction type shot_goal; model_approved true; model/feature keyed aggregation. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck/EH/NST team xGF/xGA, ixG, GSAx
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/aggregates.test.ts`
- **Leads (not audited):**
  - (opus) no strength split: all-situations only (PP/EN mixed); team xG includes empty-net shots
  - (opus) goalie 'shots_against' is unblocked attempts — differs from NST SA (SOG)
  - (opus) own goals excluded from predictions so goals_for/against omit own goals
  - (opus) no score/venue adjustment
  - (codex:XG-18) Live coverage and selected model not checked.

## M-XG-034 Flurry-adjusted xG

- **Match:** Both; Opus XG-050; Codex XG-16
- **Purpose:** Discount later shots in a flurry by prior non-scoring probability.
- **Where:** `web/lib/xg/flurryAdjusted.ts:22 (buildFlurryAdjustedPredictions)`; `web/lib/xg/flurryAdjusted.ts:50 (summarizeFlurryAdjustedXg)`; `web/lib/xg/aggregates.ts:312 (mergeXgFlurryMetadata)`; `web/lib/xg/flurryAdjusted.ts:22 buildFlurryAdjustedPredictions`; `web/lib/xg/flurryAdjusted.ts:52 summarizeFlurryAdjustedXg`
- **Tags (heuristic):** generation: current
- **Opus view (XG-050):**
  - Method: Within a flurry (>=2 shots, <=5 s gaps): adjusted_i = xg_i * prod_{j<i}(1 - xg_j); non-flurry shots unchanged.
  - Inputs/units: probability; sources: nhl_xg_shot_predictions, nhl_xg_shot_features
  - Output scale: xG goals; writes: nhl_xg_*_aggregates.flurry_adjusted_*
  - Status: live — admin/cron route web/pages/api/v1/db/update-nhl-xg-aggregates.ts; read by MetricsTimeline, homepageGameAnalytics, FORGE team-context-queries, /underlying-stats/xg
  - Consumers: aggregates; goalie flurry-adjusted GSAx
- **Codex view (XG-16, calculation, location; Codex family 'Expected goals'):** Flurry-adjusted expected goals
  - Purpose: Discount later shots by probability prior shots in the flurry did not score.
  - Inputs/units: Raw xG [0,1], ordered flurry sequence/index.
  - Output scale: p_i × product(1−p_prior), expected-goal units; raw/adjusted totals and difference.
  - Version/status: Additional surface, not replacement for raw xG. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-16): Raw xG preserved separately; ungrouped shots unchanged. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck flurry-adjusted xG (identical formula)
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/flurryAdjusted.test.ts`
- **Leads (not audited):**
  - (opus) sequence ordering sorts by sequence id string then shot index — fine within a sequence
  - (codex:XG-16) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-035 Shot xG scoring (prediction)

- **Match:** Both; Opus XG-051; Codex XG-RUNTIME
- **Purpose:** Score persisted shot features with an approved artifact and store raw/calibrated xG.
- **Where:** `web/lib/xg/shotFeaturePersistence.ts:532 (encodeFeatureVector)`; `web/lib/xg/shotFeaturePersistence.ts:575 (predictLogistic)`; `web/lib/xg/shotFeaturePersistence.ts:611 (predictShotGoalProbabilities)`; `web/lib/xg/shotFeaturePersistence.ts:649 (buildPredictionDbRow)`; `web/lib/xg/shotFeaturePersistence.ts:743 (fetchPersistedFeatureRows)`; `web/pages/api/v1/db/update-nhl-xg-shot-predictions.ts:285 (scoring loop)`; `web/lib/xg/shotFeaturePersistence.ts:575 predictLogistic`; `web/lib/xg/shotFeaturePersistence.ts:593 predictXgBoost`; `web/lib/xg/shotFeaturePersistence.ts:611 predictShotGoalProbabilities`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: unblocked attempts, shots on goal; generation: current
- **Opus view (XG-051):**
  - Method: Select rows: same feature_version, not penalty shot/shootout, is_unblocked_shot_attempt (shot_goal) or SOG/missed/blocked (rebound_creation). Encode (0-imputation, z-score, one-hot by artifact levels), p_raw = clip(sigmoid(w.x+b)); if calibration.applied, xg = calibrator(p_raw) else xg = p_raw. Refuses unapproved artifacts unless allowUnapproved=true; asserts feature contract.
  - Inputs/units: standardized features; sources: nhl_xg_shot_features
  - Output scale: probability 0-1 per shot; writes: nhl_xg_shot_predictions (onConflict model_version,prediction_type,game_id,event_id)
  - Status: live — admin/cron route update-nhl-xg-shot-predictions.ts (no vercel.json schedule found)
  - Consumers: update-nhl-xg-aggregates; shot assists; transitions; created xG; adjusted impact; rebound control
- **Codex view (XG-RUNTIME, calculation, location; Codex family 'Expected goals'):** Persisted-artifact xG inference and calibration selection
  - Purpose: Score shot rows using the serialized selected model.
  - Inputs/units: Encoded features; persisted model family, logistic weights/bias or tree nodes/learning rate; serialized calibration.
  - Output scale: Raw probability, optional calibrated probability and xg; probability clipped 1e-9 to 1−1e-9.
  - Version/status: Runtime scoring implementation; active artifact unknown. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/xg/shotFeaturePersistence.ts:615 comment: returns a shot-quality probability for a single shot; summing gives ixG/xGF/xGA, not a forecast
  - Intended contract (Codex XG-RUNTIME): Logistic sigmoid(dot(weights,features)+bias); tree scorer starts at .5 and sums learningRate*leaf then sigmoid; xg chooses calibrated output only when artifact.calibration.applied is true. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck/EH per-shot xG
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
  - Tests: `web/lib/xg/shotFeaturePersistence.test.ts`
- **Leads (not audited):**
  - (opus) empty-net shots scored by the same model (isEmptyNetEvent boolean only)
  - (opus) artifact loaded from deployed filesystem path (env)
  - (codex:XG-RUNTIME) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-036 xG baseline trainer: chronological / out-of-time game splits

- **Match:** Both; Opus XG-055; Codex XG-13
- **Purpose:** Assign games to train/validation/test for xG fitting
- **Where:** `web/scripts/train-nhl-xg-baseline.ts:268 (buildSplitDateRanges)`; `web/scripts/train-nhl-xg-baseline.ts:860 (buildSplitStrategyLabel)`; `web/scripts/train-nhl-xg-baseline.ts:881 (buildOutOfTimeGameSplitAssignments)`; `web/scripts/train-nhl-xg-baseline.ts:789 buildNumericStandardization`; `web/scripts/train-nhl-xg-baseline.ts:881 buildOutOfTimeGameSplitAssignments`
- **Tags (heuristic):** generation: current
- **Opus view (XG-055):**
  - Method: default chronological by game: train 0.70 / validation 0.15 / test remainder; out-of-time mode puts whole testSeasons in test and the last floor(0.15*n) (min 1) of non-test games by date in validation; missing gameDate sorts as 9999-12-31
  - Inputs/units: dates, game IDs; sources: games
  - Output scale: split label; writes: —
  - Status: live — training CLI (single season 20252026 by default; --testSeasons for out-of-time)
  - Consumers: xG trainer, challenger dataset export
- **Codex view (XG-13, calculation, location; Codex family 'Expected goals'):** Numeric standardization and out-of-time split
  - Purpose: Scale baseline numeric features using training statistics and define chronological holdout.
  - Inputs/units: Training feature vectors; game dates and season scopes.
  - Output scale: Feature means/scales and standardized values; temporal split assignment.
  - Version/status: Local training utilities. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): split strategy label web/scripts/train-nhl-xg-baseline.ts:860-879
  - Intended contract (Codex XG-13): Implementation and serialized transforms are the contract. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: time-based holdout (MoneyPuck/Evolving-Hockey validate on later seasons)
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
  - Tests: `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) games with null gameDate are pushed to the end and therefore land in validation/test
  - (codex:XG-13) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-037 xG baseline trainer: train-only z-score standardization

- **Match:** Both; Opus XG-056; Codex XG-13
- **Purpose:** Standardize numeric shot features before logistic/boosted xG training
- **Where:** `web/scripts/train-nhl-xg-baseline.ts:789 (buildNumericStandardization)`; `web/scripts/train-nhl-xg-baseline.ts:811 (applyFeatureTransforms)`; `web/scripts/train-nhl-xg-baseline.ts:789 buildNumericStandardization`; `web/scripts/train-nhl-xg-baseline.ts:881 buildOutOfTimeGameSplitAssignments`
- **Tags (heuristic):** generation: current
- **Opus view (XG-056):**
  - Method: mean and population std (divide by n) computed on train split only; std<=1e-9 replaced by 1; x' = (x - mean)/std applied to all splits; missing features treated as 0 before stats
  - Inputs/units: feet, degrees, seconds (raw feature units before scaling); sources: nhl_api_pbp_events, nhl_api_shift_rows, games, player_stats_unified, goalie_stats_unified, players
  - Output scale: z-scores; writes: scripts/output/xg-baselines/*/model-artifact.json (file artifact)
  - Status: live — used for saved logistic_l2 candidate artifacts
  - Consumers: xG model artifacts loaded by lib/xg/shotFeaturePersistence; train-nhl-xg-rebound-heads-offline.ts; train_nhl_xg_challengers.py (via exported dataset)
- **Codex view (XG-13, calculation, location; Codex family 'Expected goals'):** Numeric standardization and out-of-time split
  - Purpose: Scale baseline numeric features using training statistics and define chronological holdout.
  - Inputs/units: Training feature vectors; game dates and season scopes.
  - Output scale: Feature means/scales and standardized values; temporal split assignment.
  - Version/status: Local training utilities. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (function names only)
  - Intended contract (Codex XG-13): Implementation and serialized transforms are the contract. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: standard z-score scaling (sklearn StandardScaler uses population std too)
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json (featureTransforms)`
  - Tests: `web/lib/xg/baselineDataset.test.ts`; `web/lib/xg/binaryLogistic.test.ts`; `web/lib/xg/calibration.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) missing numeric values imputed as 0 before mean/std, which biases mean toward 0 for sparse features
  - (codex:XG-13) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-038 xG baseline trainer: logistic / elastic-net / xgboost-js model fit

- **Match:** Both; Opus XG-057; Codex XG-12
- **Purpose:** Fit shot-goal (and rebound_creation) probability models
- **Where:** `web/scripts/train-nhl-xg-baseline.ts:931 (resolveFitOptions)`; `web/scripts/train-nhl-xg-baseline.ts:968 (resolveBoostingFitOptions)`; `web/scripts/train-nhl-xg-baseline.ts:2003 (main model branch)`; `web/scripts/train-nhl-xg-baseline.ts:1750 main`; `web/scripts/train_nhl_xg_challengers.py:177 build_model`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, current
- **Opus view (XG-057):**
  - Method: gradient-descent logistic from lib/xg/binaryLogistic: logistic_unregularized iters 800 lr 0.05 l1 0 l2 0; logistic_l2 l2 0.01; logistic_elastic_net l1 0.001 l2 0.01; xgboost_js lr 0.1 maxDepth 3 minChildWeight 5 numRounds 60, predictions clamped to [0,1]; features enriched with shooter handedness, goalie catch hand, roster position group, on-ice deployment context
  - Inputs/units: feet, degrees, seconds; one-hot categoricals; sources: nhl_api_pbp_events, nhl_api_shift_rows, games, player_stats_unified, goalie_stats_unified, players
  - Output scale: probability 0-1; writes: scripts/output/xg-baselines/<tag>/ (files)
  - Status: live — CLI default family xgboost_js, saved candidates logistic_l2; training set season 20252026, 82,636 train shots
  - Consumers: lib/xg shot-feature persistence / xG scoring in production; benchmark-nhl-xg-baselines.ts
- **Codex view (XG-12, calculation, location; Codex family 'Expected goals'):** Boosted-tree xG baseline and Python challengers
  - Purpose: Train nonlinear alternative classifiers on same encoded shot contract.
  - Inputs/units: Encoded shot vectors/labels; train/validation/test partitions, seed and estimator settings.
  - Output scale: Goal or rebound probabilities; feature importance/evaluation artifacts.
  - Version/status: xgboost_js and offline challenger families. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): --help text web/scripts/train-nhl-xg-baseline.ts:294-330
  - Intended contract (Codex XG-12): TS @fractal-solutions/xgboost-js; Python LightGBM, CatBoost and XGBoost use reference contract alignment. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck / Evolving-Hockey logistic & GBM xG
  - Fixtures/test data: `web/scripts/output/xg-baselines/`; `web/scripts/output/xg-approval-run-20260522/`; `web/scripts/output/xg-corrected-candidate/`
  - Tests: `web/lib/xg/baselineDataset.test.ts`; `web/lib/xg/binaryLogistic.test.ts`; `web/lib/xg/calibration.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) xgboost_js predictions clamped to exactly 0 or 1 can produce infinite log loss in evaluateScoredExamples (no epsilon clip)
  - (codex:XG-12) Active model/approval not verified; third-party learner internals are dependencies, not in-house formulas.

## M-XG-039 NST-parity goalie metrics (Sv%, GAA, 'gsaa', danger splits)

- **Match:** Both; Opus XG-058; Codex parity-goalie-metrics
- **Purpose:** Goalie counts and rates rebuilt from PBP.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1468 (goalie accumulation)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1762 (goalie counts)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:989 (accumulateGoalieToiBySplit)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:989 accumulateGoalieToiBySplit; :1754 buildGoalieSplitParity`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, shots on goal; generation: current
- **Opus view (XG-058):**
  - Method: Sv% = 100*saves/SOG against; GAA = GA*3600/TOI; xg_against = sum heuristic xG on ALL attempts (incl. blocked/missed); 'gsaa' = xg_against - goals_against; HD/MD/LD shots, saves, Sv%; hd_gaa = (HDSA - HDsaves)*3600/TOI; avg shot/goal distance; per-60 versions.
  - Inputs/units: seconds TOI; sources: nhl_api_pbp_events, nhl_api_shift_rows, nhl_xg_shot_features
  - Output scale: percent 0-100; per-60; goals; writes: —
  - Status: live — via playerStatsLandingServer.ts
  - Consumers: playerStatsLandingServer; release validation
- **Codex view (parity-goalie-metrics, calculation, location; Codex family 'Native NST-parity metrics'):** Goalie saves, save%, GAA, GSAA-labelled xGA differential, danger splits and distances
  - Purpose: Build goalie count/rate tables from attributed shots and shifts.
  - Inputs/units: Shots/goals attributed to goalie; xG values; danger labels; shot and goal distances feet; TOI seconds
  - Output scale: SV%=saves/SA×100; GAA=GA×3600/TOI; gsaa=xGA-GA when available; per60 transforms; high/medium/low danger save% and GAA; average distances=sum/count. HD/MD/LD gsaa game parity fields are null in implementation.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex parity-goalie-metrics): web/lib/supabase/Upserts/nhlNstParityMetrics.ts types/formulas are code contract; null unavailable values preserved.
  - External references: NST GSAA = SA*(league Sv%) - GA; GSAx = xGA - GA (MoneyPuck/EH)
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts"]}`
- **Leads (not audited):**
  - (opus) field named gsaa is actually GSAx vs heuristic xG (NST GSAA is vs league-average Sv%) — web/lib/socialShare/modules/goalieGsax.ts:14 explicitly warns about this naming
  - (opus) hd_goals_against never incremented (only md/ld)
  - (opus) xg_against sums attempts incl. blocked while Sv% uses SOG
  - (codex:parity-goalie-metrics) No runtime verification or correctness assessment performed.

## M-XG-040 NST-parity heuristic xG and danger buckets

- **Match:** Both; Opus XG-059; Codex parity-skater-rates, parity-xg-proxy
- **Purpose:** Fallback xG and HD/MD/LD classification used when no model xG is attached to parity shots.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:399 (getDangerBucket)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:407 (getApproximateXgValue)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:421 (isScoringChance)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:427 toPct; :432 toPer60; :1592 buildSkaterSplitParity`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:399 getDangerBucket; :407 getApproximateXgValue; web/lib/underlying-stats/teamStatsSummaryRefresh.ts:462 getDangerBucket; :481 getApproximateXgValue`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (XG-059):**
  - Method: Danger: high if dist<=20 and angle<=35; medium if dist<=40 and angle<=50; else low. xG = 0.18/0.08/0.02 + 0.03 rebound + 0.02 rush + 0.02 royal road; if isGoal, xG = max(xG, 0.25); cap 0.95. Scoring chance = medium or high.
  - Inputs/units: feet, degrees; sources: nhl_xg_shot_features
  - Output scale: xG 0.02-0.95; writes: —
  - Status: live — used by buildNstParityMetrics (playerStatsLandingServer.ts:1086, release validation)
  - Consumers: buildNstParityMetrics (ixg, xgf, xga, goalie xg_against, gsaa)
- **Codex view (parity-skater-rates, calculation, location; Codex family 'Native NST-parity metrics'):** Individual/on-ice per60, IPP, possession shares, zone shares, PDO
  - Purpose: Create rate fields from native game counts.
  - Inputs/units: Counts from parity-skater-counts; TOI seconds; denominator counts
  - Output scale: Per60 = count ×3600/TOI; percentages ×100; IPP=(G+A)/oiGF×100; CF/FF/SF/GF/xGF/SCF/HDCF/HDGF/MDCF/MDGF/LDCF/LDGF shares = for/(for+against)×100; on-ice SH=GF/SF×100; SV=(SA-GA)/SA×100; PDO=SH+SV (roughly 100 scale, not rolling 1 scale); OZ starts and OZ faceoffs include neutral in denominator.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (parity-xg-proxy, calculation, location; Codex family 'Native xG proxy cross-reference'):** Approximate danger-bucket xG fallback
  - Purpose: Supply a heuristic proxy when a supplied shot xG is absent.
  - Inputs/units: Shot distance feet, angle degrees, rebound/rush/royal-road/goal booleans; optional supplied xG
  - Output scale: High≤20ft and ≤35°, medium≤40ft and ≤50°, otherwise low; base .18/.08/.02 plus rebound .03, rush .02, royal road .02; goal floor .25, cap .95. Supplied xG wins.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md)
  - Intended contract (Codex parity-skater-rates): web/lib/supabase/Upserts/nhlNstParityMetrics.ts row types and formulas; explicit separate rolling contracts do not define these game-level output scales.
  - Intended contract (Codex parity-xg-proxy): Explicit implementation fallback, not a fitted model probability. See the xG inventory for shot-model artifacts and geometry.
  - External references: NST scoring-chance/high-danger zones (polygon-based), NST xG model
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts", "web/lib/underlying-stats/teamStatsSummaryRefresh.test.ts"]}`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts"]}`
- **Leads (not audited):**
  - (opus) OUTCOME LEAKAGE: goals get xG floor 0.25, so heuristic xG depends on the result
  - (opus) danger boxes are distance/angle approximations, not NST's zone polygons
  - (opus) applied to blocked shots too (shot rows include blocked) — NST xG/scoring chances treat blocked shots differently
  - (codex:parity-skater-rates) No runtime verification or correctness assessment performed.
  - (codex:parity-xg-proxy) No runtime verification or correctness assessment performed.

## M-XG-041 NST-parity skater individual and on-ice counts/rates

- **Match:** Both; Opus XG-060; Codex parity-skater-counts, parity-skater-rates
- **Purpose:** Rebuild NST-style skater tables (counts, per-60, percentages) from NHL PBP + shifts.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:427 (toPct)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:432 (toPer60)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1103 (buildNstParityMetrics)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1341 (ixg accumulation)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1423 (on-ice xgf/xga)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1543 (zone starts)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1601 (ipp, pdo, pct block)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1103 buildNstParityMetrics; :906 accumulateToiBySplit; :1592 buildSkaterSplitParity`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:427 toPct; :432 toPer60; :1592 buildSkaterSplitParity`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, 5v5 only, shots on goal; generation: current
- **Opus view (XG-060):**
  - Method: Individual: goals, assists, shots (goal+SOG), iCF (all attempts), iFF, ixG (heuristic or attached xG), iSCF, iHDCF, rush attempts, rebounds created, PIM, hits, blocks, faceoffs. On-ice: CF/CA, FF/FA, SF/SA, GF/GA, xGF/xGA, SCF/SCA, HD/MD/LD CF/CA/GF/GA. per60 = value*3600/toiSeconds; pct = 100*for/(for+against); on-ice Sh% = 100*GF/SF; on-ice Sv% = 100*(SA-GA)/SA; PDO = Sh%+Sv% (~100 scale); IPP = 100*(G+A)/GF; OZS% = 100*OZ/(OZ+DZ) from faceoffs following stoppage/period start/goal/penalty for players starting shifts at that second. Splits: all, ev, 5v5, pp, pk, 5v4, 4v5, 3v3, withEmptyNet, againstEmptyNet; score filters tied/upOne/downOne/leading(>=2)/trailing(<=-2)/withinOne.
  - Inputs/units: seconds TOI; sources: nhl_api_pbp_events, nhl_api_shift_rows, nhl_xg_shot_features
  - Output scale: per-60; percent 0-100; counts; writes: (in-memory; served by underlying-stats landing; compared to nst_gamelog_* in validation)
  - Status: live — via playerStatsLandingServer.ts
  - Consumers: web/lib/underlying-stats/playerStatsLandingServer.ts:1086; web/scripts/run-nhl-xg-release-validation.ts
- **Codex view (parity-skater-counts, calculation, location; Codex family 'Native NST-parity metrics'):** Individual and on-ice skater event/TOI totals
  - Purpose: Translate normalized PBP and shifts into game/strength/score-state stat rows.
  - Inputs/units: Normalized PBP event types and player attribution; shift intervals seconds; shot features and goalie/team identities
  - Output scale: Individual goals, assists, primary/secondary assists, points, shots, ixG, iCF/iFF/iSCF/iHDCF, rush/rebounds, PIM/penalties/drawn, giveaways/takeaways, hits/hits-taken/blocks, FOW/FOL; on-ice CF/CA, FF/FA, SF/SA, GF/GA, xGF/xGA, SC/danger counts, zone starts/faceoffs; TOI seconds.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (parity-skater-rates, calculation, location; Codex family 'Native NST-parity metrics'):** Individual/on-ice per60, IPP, possession shares, zone shares, PDO
  - Purpose: Create rate fields from native game counts.
  - Inputs/units: Counts from parity-skater-counts; TOI seconds; denominator counts
  - Output scale: Per60 = count ×3600/TOI; percentages ×100; IPP=(G+A)/oiGF×100; CF/FF/SF/GF/xGF/SCF/HDCF/HDGF/MDCF/MDGF/LDCF/LDGF shares = for/(for+against)×100; on-ice SH=GF/SF×100; SV=(SA-GA)/SA×100; PDO=SH+SV (roughly 100 scale, not rolling 1 scale); OZ starts and OZ faceoffs include neutral in denominator.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex parity-skater-counts): web/lib/supabase/Upserts/nhlNstParityMetrics.ts exported row types and event-inclusion/strength helpers are implementation contract; no claim of numerical parity with third-party NST.
  - Intended contract (Codex parity-skater-rates): web/lib/supabase/Upserts/nhlNstParityMetrics.ts row types and formulas; explicit separate rolling contracts do not define these game-level output scales.
  - External references: Natural Stat Trick definitions (CF%, xGF%, PDO, IPP, OZS%)
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts", "web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts"]}`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts"]}`
- **Leads (not audited):**
  - (opus) on-ice GF counts own goals (isGoal) while CF/SF exclude them
  - (opus) 'leading'/'trailing' score buckets mean >=2, not >=1 (NST 'leading' = any lead)
  - (opus) blocked shots contribute heuristic xG to xGF/xGA
  - (opus) ev split = owner-state EV which excludes EN but 'withEmptyNet' etc. overlap with pp/pk splits
  - (codex:parity-skater-counts) No runtime verification or correctness assessment performed.
  - (codex:parity-skater-rates) No runtime verification or correctness assessment performed.

## M-XG-042 Adjusted-impact held-out validation and leakage gate

- **Match:** Both; Opus XG-063; Codex XG-25
- **Purpose:** Chronological holdout MSE vs mean baseline; block pregame use.
- **Where:** `web/lib/xg/adjustedImpact.ts:553 (validateAdjustedImpactHeldOut)`; `web/lib/xg/adjustedImpact.ts:655 (validateAdjustedImpactLeakage)`; `web/lib/xg/../rankings/adjustedImpactPromotionContract.ts:78 (evaluateAdjustedImpactPromotionReadiness)`; `web/lib/xg/adjustedImpact.ts:310 buildAdjustedImpactDesignRows`; `web/lib/xg/adjustedImpact.ts:430 fitAdjustedImpactBaseline`; `web/lib/xg/adjustedImpact.ts:553 validateAdjustedImpactHeldOut`
- **Tags (heuristic):** generation: current
- **Opus view (XG-063):**
  - Method: Last ceil(20%) of distinct game dates = validation; fit on earlier rows; MSE vs training-mean baseline; block if improvement < minimumMseImprovement (default 0). Leakage: any usageMode other than postgame_descriptive is blocked (same-game on-ice target).
  - Inputs/units: xG; sources: —
  - Output scale: MSE; writes: nhl_xg_adjusted_impact_model_runs
  - Status: live (diagnostic) — same route
  - Consumers: route gate
- **Codex view (XG-25, calculation, location; Codex family 'Expected goals'):** Regularized adjusted on-ice impact baseline
  - Purpose: Fit sparse player/context coefficients for on-ice xG differential.
  - Inputs/units: Shot xG with on-ice stints; player +/− coefficients and context features.
  - Output scale: Regularized player/context estimates in target differential units; holdout RMSE/MAE and baseline comparison.
  - Version/status: 500 default iterations, .03 learning rate, .1 L2. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-25): ADJUSTED_IMPACT_TARGET_FAMILY=on_ice_xg_differential_v1; descriptive/pregame mode distinction. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/adjustedImpact.test.ts`
- **Leads (not audited):**
  - (opus) improvement threshold 0 means any tiny gain passes
  - (codex:XG-25) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-043 Artifact drift and NST team-surface drift reports

- **Match:** Both; Opus XG-064; Codex XG-27
- **Purpose:** Compare live predictions to the artifact's training stats and to NST team xG.
- **Where:** `web/lib/xg/aggregates.ts:274 (thresholds)`; `web/lib/xg/aggregates.ts:807 (validateXgAggregateReconciliation)`; `web/lib/xg/aggregates.ts:1010 (buildArtifactDriftReport)`; `web/lib/xg/aggregates.ts:1087 (buildTeamSurfaceDriftReport)`; `web/lib/xg/featureCoverage.ts:99 buildXgFeatureCoverageProfile`; `web/lib/xg/aggregates.ts:807 validateXgAggregateReconciliation`; `web/lib/xg/aggregates.ts:1010 buildArtifactDriftReport`; `web/lib/xg/aggregates.ts:1087 buildTeamSurfaceDriftReport`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (XG-064):**
  - Method: Warn if \|live mean prediction - artifact mean\| > 0.015 or \|goal rate delta\| > 0.015; team surface warn if mean \|xGF delta\| per team-game > 0.75 or match rate < 0.8; reconciliation sums game rows vs predictions with tol 1e-6 (EN keys tracked separately).
  - Inputs/units: goals/xG; sources: nhl_xg_shot_predictions, nst_team_gamelogs_as_counts
  - Output scale: deltas; writes: —
  - Status: live — update-nhl-xg-aggregates route
  - Consumers: update-nhl-xg-aggregates route response
- **Codex view (XG-27, calculation, location; Codex family 'Expected goals'):** xG coverage, reconciliation and drift measures
  - Purpose: Inventory data-quality calculations used by the existing xG tools.
  - Inputs/units: Feature missingness, raw/aggregate totals, candidate/reference predictions and external team totals.
  - Output scale: Null rates, reconciliation deltas, average prediction/goal-rate drift, mean absolute xG deltas, match rates.
  - Version/status: Operational diagnostics, not hockey talent metrics. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-27): Threshold constants in these modules; no checks executed by this inventory. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: NST team xGF
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/aggregates.test.ts`; `web/lib/xg/featureCoverage.test.ts`
- **Leads (not audited):**
  - (opus) comparison mixes FHFH all-situations Fenwick xG (EN included) with NST surface whose taxonomy is unverified (per hardeningAudit)
  - (codex:XG-27) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-044 Probability metrics: log loss, Brier, calibration bins, slice evaluation

- **Match:** Both; Opus XG-065; Codex XG-15
- **Purpose:** Evaluate xG predictions per split and per slice.
- **Where:** `web/lib/xg/calibration.ts:106 (evaluateProbabilityMetrics)`; `web/scripts/train-nhl-xg-baseline.ts:345 (binaryLogLossBaseline)`; `web/scripts/train-nhl-xg-baseline.ts:356 (binaryBrierBaseline)`; `web/scripts/train-nhl-xg-baseline.ts:1426 (buildCalibrationBins)`; `web/scripts/train-nhl-xg-baseline.ts:1459 (evaluateScoredExamples)`; `web/scripts/train-nhl-xg-baseline.ts:1507 (evaluateSlices)`; `web/lib/xg/calibration.ts:106 evaluateProbabilityMetrics`; `web/lib/xg/hardeningAudit.ts:112 buildXgSegmentCalibrationAudit`; `web/scripts/train_nhl_xg_challengers.py:20 metrics`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, current
- **Opus view (XG-065):**
  - Method: logLoss = mean(-[y ln p + (1-y) ln(1-p)]) (p clipped 1e-9 in calibration.ts, unclipped in train script); Brier = mean((p-y)^2); null baselines: -[r ln r + (1-r) ln(1-r)] and r(1-r); 10 equal-width calibration bins with count, mean prediction, observed rate; slices by strengthState, rebound, rush over validation+test holdout. No AUC in main trainer.
  - Inputs/units: probabilities 0-1; sources: —
  - Output scale: log loss nats; Brier 0-1; rates 0-1; writes: model-artifact.json
  - Status: live (offline) — run manually via `tsx web/scripts/train-nhl-xg-baseline.ts`; produced artifacts consumed by update-nhl-xg-shot-predictions via artifact path env
  - Consumers: approval gates; benchmark markdown
- **Codex view (XG-15, calculation, location; Codex family 'Expected goals'):** Probability evaluation and calibration bins
  - Purpose: Compute evaluation measures already implemented for xG models.
  - Inputs/units: Predictions [0,1] and binary observed outcomes; segment keys.
  - Output scale: Log loss, Brier, count, positive rate, mean prediction, bin gaps; Python adds ROC AUC/ECE.
  - Version/status: Evaluation tools inventoried only. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-15): Metrics functions and segment taxonomies, not a newly performed audit. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck/EH report log loss and AUC (EH ~0.77-0.78 AUC at 5v5); NST does not publish
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
  - Tests: `web/lib/xg/calibration.test.ts`; `web/lib/xg/hardeningAudit.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) AUC not computed for the shot_goal model (only offline rebound heads and Python challengers)
  - (opus) holdout = validation + test, but calibrator was fit on validation
  - (opus) train script log loss uses unclipped p (log(0) possible for xgboost_js clamp to [0,1])
  - (codex:XG-15) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-045 Feature coverage profile and scoring-row drift audit

- **Match:** Both; Opus XG-066; Codex XG-27
- **Purpose:** Null-rate and unknown-category coverage per selected feature; drift between training and scoring rows.
- **Where:** `web/lib/xg/featureCoverage.ts:52 (policy: maxAllowedNullRateDrift 0.25, maxAllowedCategoricalUnknownRate 0.05)`; `web/lib/xg/featureCoverage.ts:99 (buildXgFeatureCoverageProfile)`; `web/lib/xg/featureCoverage.ts:180 (auditScoringRowsAgainstFeatureCoverage)`; `web/lib/xg/featureCoverage.ts:99 buildXgFeatureCoverageProfile`; `web/lib/xg/aggregates.ts:807 validateXgAggregateReconciliation`; `web/lib/xg/aggregates.ts:1010 buildArtifactDriftReport`; `web/lib/xg/aggregates.ts:1087 buildTeamSurfaceDriftReport`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, current
- **Opus view (XG-066):**
  - Method: nullRate per feature; warn if >=0.5; block scoring if null-rate drift >0.25 or categorical unknown rate >0.05.
  - Inputs/units: rates; sources: nhl_xg_shot_features
  - Output scale: rates 0-1; writes: model-artifact.json
  - Status: live (offline) — run manually via `tsx web/scripts/train-nhl-xg-baseline.ts`; produced artifacts consumed by update-nhl-xg-shot-predictions via artifact path env; scoring audit live in prediction route
  - Consumers: approval gate; prediction route
- **Codex view (XG-27, calculation, location; Codex family 'Expected goals'):** xG coverage, reconciliation and drift measures
  - Purpose: Inventory data-quality calculations used by the existing xG tools.
  - Inputs/units: Feature missingness, raw/aggregate totals, candidate/reference predictions and external team totals.
  - Output scale: Null rates, reconciliation deltas, average prediction/goal-rate drift, mean absolute xG deltas, match rates.
  - Version/status: Operational diagnostics, not hockey talent metrics. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-27): Threshold constants in these modules; no checks executed by this inventory. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: none suggested
  - Fixtures/test data: `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
  - Tests: `web/lib/xg/aggregates.test.ts`; `web/lib/xg/featureCoverage.test.ts`
- **Leads (not audited):**
  - (codex:XG-27) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-046 Segment calibration audit and internal benchmark surfaces

- **Match:** Both; Opus XG-067; Codex XG-15
- **Purpose:** ECE/max-gap by rink, playoff, strength, score state; all-situations vs 5v5 surfaces.
- **Where:** `web/lib/xg/hardeningAudit.ts:77 (calibrationGaps)`; `web/lib/xg/hardeningAudit.ts:112 (buildXgSegmentCalibrationAudit)`; `web/lib/xg/hardeningAudit.ts:158 (buildXgInternalBenchmarkSurfaces)`; `web/lib/xg/hardeningAudit.ts:189 (XG_EXTERNAL_TAXONOMY)`; `web/lib/xg/calibration.ts:106 evaluateProbabilityMetrics`; `web/lib/xg/hardeningAudit.ts:112 buildXgSegmentCalibrationAudit`; `web/scripts/train_nhl_xg_challengers.py:20 metrics`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: 5v5 only, all strengths, unblocked attempts; generation: current
- **Opus view (XG-067):**
  - Method: ECE = sum over 10 equal-width bins (n_bin/N)*\|rate-mean pred\|; max gap; segment 'insufficient' if n<100 or one class. Surfaces: all-situations unblocked (EN included) and 5v5 non-EN unblocked (strengthState in {5v5,5-on-5,0505}).
  - Inputs/units: probabilities; sources: nhl_xg_shot_predictions (via /api/v1/xg/operations)
  - Output scale: ECE 0-1; writes: —
  - Status: live — admin route web/pages/api/v1/xg/operations.ts
  - Consumers: web/pages/api/v1/xg/operations.ts
- **Codex view (XG-15, calculation, location; Codex family 'Expected goals'):** Probability evaluation and calibration bins
  - Purpose: Compute evaluation measures already implemented for xG models.
  - Inputs/units: Predictions [0,1] and binary observed outcomes; segment keys.
  - Output scale: Log loss, Brier, count, positive rate, mean prediction, bin gaps; Python adds ROC AUC/ECE.
  - Version/status: Evaluation tools inventoried only. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/xg/hardeningAudit.ts XG_EXTERNAL_TAXONOMY comparisonRule 'taxonomy_alignment_required_before_failure_classification'
  - Intended contract (Codex XG-15): Metrics functions and segment taxonomies, not a newly performed audit. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck/EH/NST taxonomy (documented in XG_EXTERNAL_TAXONOMY)
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/calibration.test.ts`; `web/lib/xg/hardeningAudit.test.ts`
- **Leads (not audited):**
  - (opus) 5v5 surface filters strengthState values like '5v5' but feature rows store strengthState as EV/PP/SH/EN (5v5 lives in strengthExact) — surface may be empty unless caller maps it
  - (codex:XG-15) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-047 AUC (rank-based) for offline heads and challengers

- **Match:** Both; Opus XG-070; Codex XG-15
- **Purpose:** Discrimination metric.
- **Where:** `web/scripts/train-nhl-xg-rebound-heads-offline.ts:121 (auc)`; `web/scripts/train_nhl_xg_challengers.py:264 (metrics: roc_auc_score, ece10)`; `web/scripts/train_nhl_xg_challengers.py:249 (expected_calibration_error)`; `web/lib/xg/calibration.ts:106 evaluateProbabilityMetrics`; `web/lib/xg/hardeningAudit.ts:112 buildXgSegmentCalibrationAudit`; `web/scripts/train_nhl_xg_challengers.py:20 metrics`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, development, current
- **Opus view (XG-070):**
  - Method: Mann-Whitney U with average ranks for ties: (sumRanksPos - nPos(nPos+1)/2)/(nPos*nNeg). Python: sklearn roc_auc_score; ECE10 = sum (n_bin/N)*\|mean y - mean p\| over 10 equal-width bins.
  - Inputs/units: probability 0-1; sources: —
  - Output scale: AUC 0-1; writes: offline JSON
  - Status: draft — offline scripts only
  - Consumers: manual review
- **Codex view (XG-15, calculation, location; Codex family 'Expected goals'):** Probability evaluation and calibration bins
  - Purpose: Compute evaluation measures already implemented for xG models.
  - Inputs/units: Predictions [0,1] and binary observed outcomes; segment keys.
  - Output scale: Log loss, Brier, count, positive rate, mean prediction, bin gaps; Python adds ROC AUC/ECE.
  - Version/status: Evaluation tools inventoried only. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex XG-15): Metrics functions and segment taxonomies, not a newly performed audit. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: standard ROC AUC; EH/MoneyPuck AUC reporting
  - Fixtures/test data: `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
  - Tests: `web/lib/xg/calibration.test.ts`; `web/lib/xg/hardeningAudit.test.ts`
- **Leads (not audited):**
  - (opus) not applied to the production shot_goal model
  - (codex:XG-15) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-XG-048 xG team aggregate reconciliation (xGF/xGA symmetry) and operations alerts

- **Match:** Opus only; Opus XG-002; Codex —
- **Purpose:** Check that summed team xG for equals summed team xG against per game (and for flurry-adjusted aggregates) and raise operations alerts.
- **Where:** `web/lib/xg/operationsHealth.ts:17 (buildXgTeamAggregateReconciliation)`; `web/lib/xg/operationsHealth.ts:58 (buildXgOperationsAlerts)`
- **Tags (heuristic):** generation: current
- **Opus view (XG-002):**
  - Method: Group rows by model_version:feature_version:game_id; sum xg_for and xg_against (nulls -> 0); delta = \|sum xGF - sum xGA\|; issue if delta > tolerance 0.0001; report games checked, issues, max delta (6 dp). Alerts: coverage, feature drift, registry/prediction model parity, running leases, aggregate coverage, symmetry, flurry completeness (adjusted == total), calibration segments below confidence thresholds.
  - Inputs/units: expected goals; sources: xG team aggregate sample (operations route)
  - Output scale: absolute xG delta; ok/warning; writes: —
  - Status: live — /api/v1/xg/operations
  - Consumers: web/pages/api/v1/xg/operations.ts:146-159
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Accounting identity: league/game xGF = xGA
  - Fixtures/test data: `web/lib/xg/operationsHealth.test.ts`
  - Tests: `web/lib/xg/operationsHealth.test.ts`
- **Leads (not audited):**
  - (opus) Number(x)\|\|0 turns missing xG into 0, which can hide a missing side
  - (opus) identity only proves both team rows exist with mirrored totals, not that per-shot xG is right; this does not cover what the xG model includes/excludes (see XG-001)

## M-XG-049 xG shot scoring route stage (artifact-gated)

- **Match:** Opus only; Opus XG-003; Codex —
- **Purpose:** Score stored shot feature rows with the configured xG model artifact and persist raw/calibrated probabilities and xG.
- **Where:** `web/pages/api/v1/db/update-nhl-xg-shot-predictions.ts:285 (predictShotGoalProbabilities call)`; `web/pages/api/v1/db/update-nhl-xg-shot-predictions.ts:379-401 (approval gate)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (XG-003):**
  - Method: No inline formula: lib/xg/shotFeaturePersistence predictShotGoalProbabilities returns rawProbability, calibratedProbability, xg. Route refuses non-approval-grade artifacts unless allowUnapproved=true. What the model INCLUDES/EXCLUDES (x,y normalization, distance, angle, shot type, rebound/rush windows, strength, score state, shooter/goalie effects, training seasons, model type, calibration) is NOT determinable from this route; it lives in lib/xg and the artifact (other agent's slice).
  - Inputs/units: feature payload (see lib); sources: nhl_xg_shot_features
  - Output scale: probability 0-1 per shot; writes: nhl_xg_shot_predictions
  - Status: unknown — depends on NHL_XG_MODEL_ARTIFACT_PATH being configured; not in vercel.json crons
  - Consumers: update-nhl-xg-aggregates; update-nhl-xg-adjusted-impact; update-nhl-xg-created-xg; underlying-stats/xg explorer
- **Audit context:**
  - Intent (Opus): Route error text: artifact must be approval-grade (approvalGradeEligibility.isEligible)
  - External references: MoneyPuck / Evolving-Hockey xG; calibration curves
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts (wrapper only)`
- **Leads (not audited):**
  - (opus) allowUnapproved=true lets an unapproved artifact write production predictions (flagged in response only)

## M-XG-050 xG post-calibration selection on validation split

- **Match:** Opus only; Opus XG-006; Codex —
- **Purpose:** Choose and apply a probability calibrator to raw xG outputs
- **Where:** `web/scripts/train-nhl-xg-baseline.ts:1532 (buildValidationCalibration)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (XG-006):**
  - Method: skip (raw) if <10 validation examples or one class missing; else lib/xg/calibration assessCalibration decides requiresPostCalibration/adoptableMethod and fitProbabilityCalibrator fits on validation only, applied to all splits
  - Inputs/units: probability 0-1; sources: —
  - Output scale: calibrated probability 0-1; writes: model-artifact.json
  - Status: live — corrected candidate selected raw, approval run selected isotonic
  - Consumers: xG production scoring
- **Audit context:**
  - Intent (Opus): reason strings web/scripts/train-nhl-xg-baseline.ts:1570,1613-1614
  - External references: Platt / isotonic calibration on held-out data
  - Fixtures/test data: `web/scripts/output/xg-approval-run-20260522/logistic_l2-s20252026-p1-st1-f1-cfg9bac2706/model-artifact.json (calibration)`
  - Tests: `web/lib/xg/calibration.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) the calibrated predictions are then evaluated on the same validation split used to fit the calibrator (validation metrics optimistic)

## M-XG-051 xG evaluation metrics: log loss, Brier, calibration bins, slice evaluation

- **Match:** Opus only; Opus XG-008; Codex —
- **Purpose:** Score xG model quality per split and per slice
- **Where:** `web/scripts/train-nhl-xg-baseline.ts:1426 (buildCalibrationBins)`; `web/scripts/train-nhl-xg-baseline.ts:1459 (evaluateScoredExamples)`; `web/scripts/train-nhl-xg-baseline.ts:1507 (evaluateSlices)`; `web/scripts/train-nhl-xg-baseline.ts:345 (binaryLogLossBaseline)`; `web/scripts/train-nhl-xg-baseline.ts:356 (binaryBrierBaseline)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (XG-008):**
  - Method: logLoss = mean(-ln p \| y=1, -ln(1-p) \| y=0) without clipping; Brier = mean((p-y)^2); 10 equal-width probability bins with avgPrediction & observedGoalRate; base-rate baselines: LL0 = -(r ln r + (1-r) ln(1-r)), Brier0 = r(1-r); slices by strength state, rebound, rush; metrics rounded
  - Inputs/units: probability 0-1, label 0/1; sources: —
  - Output scale: log loss (nats), Brier 0-1, bin rates 0-1; writes: model-artifact.json
  - Status: live — computed on every training run
  - Consumers: approval gates; benchmark markdown
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: standard proper scoring rules
  - Fixtures/test data: `web/scripts/output/xg-baselines/*/model-artifact.json (evaluation, holdoutSliceEvaluations, holdoutScores)`
  - Tests: `web/scripts/benchmark-nhl-xg-baselines.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) log loss unclipped (contrast: rebound-heads script clips 1e-9, Python challengers clip 1e-7) so the three xG evaluators can disagree

## M-XG-052 Shot map coordinate folding, hexbin and density heatmap

- **Match:** Opus only; Opus XG-009; Codex —
- **Purpose:** Client-side transforms for team shot visualizations.
- **Where:** `web/components/ShotVisualization/ShotVisualization.tsx:27 (shotSummary)`; `web/components/ShotVisualization/ShotVisualization.tsx:393 (transformCoords)`; `web/components/ShotVisualization/ShotVisualization.tsx:438 (hexbin radius 1.5)`; `web/components/HeatMap/Heatmap.tsx:81 (mapXCoordinate)`; `web/components/HeatMap/Heatmap.tsx:104 (contourDensity bandwidth 2.3)`
- **Tags (heuristic):** percent scale: 0-100; denominators: shots on goal; generation: current
- **Opus view (XG-009):**
  - Method: ShotVisualization: team shots -> (tx,ty) = (-y, -\|x\|) (fold by sign of x), opponent shots mirrored to top; SVG offset (+42.5,+100); d3 hexbin counts; shooting% = goals/(goals+SOG)*100. Heatmap: x+100, y+42.5, d3.contourDensity bandwidth 2.3, turbo color scale.
  - Inputs/units: feet; sources: shot data via hooks/useShotData (pbp)
  - Output scale: counts; percent 0-100; writes: —
  - Status: live — team stats page
  - Consumers: web/pages/teamStats/[teamAbbreviation].tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: HockeyViz shot maps (attack-direction normalized via period/side)
  - Fixtures/test data: none listed
  - Tests: `web/hooks/useShotData.test.tsx`
- **Leads (not audited):**
  - (opus) folds by sign of x instead of using homeTeamDefendingSide — defensive-zone shots get plotted in the offensive zone
  - (opus) when x is folded, y is not negated, so left/right is swapped for mirrored shots (pure reflection, not 180-degree rotation)
  - (opus) Heatmap comment says 'height is 58 units' while code uses 85

## M-XG-053 Event inclusion / empty-net / OT / rare-manpower flags

- **Match:** Opus only; Opus XG-013; Codex —
- **Purpose:** Decide which events enter shot features and tag special situations.
- **Where:** `web/lib/supabase/Upserts/nhlEventInclusion.ts:19 (COMMON_MANPOWER_STATES)`; `web/lib/supabase/Upserts/nhlEventInclusion.ts:106 (evaluateNormalizedEventInclusion)`
- **Tags (heuristic):** denominators: 5v5 only; generation: current
- **Opus view (XG-013):**
  - Method: Exclude shootout (period SO or text) and penalty shots (regex /penalty[- ]shot/) from parity and shot features; also exclude event type 'delayed-penalty' from shot features. isEmptyNetEvent = strength_state=='EN'. isOvertimeEvent = period>3 or /ot/ text. hasRareManpower = strengthExact not in {3v3,4v3,3v4,4v4,5v3,3v5,5v4,4v5,5v5,6v5,5v6}.
  - Inputs/units: —; sources: nhl_api_pbp_events
  - Output scale: booleans; writes: nhl_xg_shot_features.is_* flags
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: shot feature builder; model eligibility; aggregates
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: MoneyPuck/EH exclude shootouts; penalty shots usually excluded or modeled separately
  - Fixtures/test data: `web/lib/supabase/Upserts/nhlEventInclusion.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlEventInclusion.test.ts`
- **Leads (not audited):**
  - (opus) empty-net shots stay in the xG training/scoring set (flag only)
  - (opus) isOvertimeEvent uses period>3 so playoff OT periods all OT (fine) but regex /ot/ could match unexpected period_type text

## M-XG-054 Missed-shot reason buckets

- **Match:** Opus only; Opus XG-014; Codex —
- **Purpose:** Classify missed-shot reasons (wide, post, short-side...).
- **Where:** `web/lib/supabase/Upserts/nhlMissReasons.ts:36 (classifyMissReasonBucket)`; `web/lib/supabase/Upserts/nhlMissReasons.ts:51 (buildMissReasonContext)`
- **Tags (heuristic):** generation: current
- **Opus view (XG-014):**
  - Method: Lowercased substring match in order: short->short-side, wide, crossbar, post, over->over-net, blocked->blocked-like, else other; null -> unknown. Only for missed-shot events.
  - Inputs/units: —; sources: nhl_api_pbp_events
  - Output scale: categorical; writes: nhl_xg_shot_features
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: (forbidden) model features; diagnostics
- **Audit context:**
  - Intent (Opus): web/lib/xg/baselineDataset.ts:239 comment: post-event/outcome fields that must never feed an xG model
  - External references: none suggested
  - Fixtures/test data: `web/scripts/output/xg-approval-run-20260522/ (3 logistic_l2 runs: cfg9bac2706 leaky-approved, cfg56c3fc2f, cfgf81a5112)`
  - Tests: `web/lib/supabase/Upserts/nhlMissReasons.test.ts`; `web/lib/xg/baselineDataset.test.ts`
- **Leads (not audited):**
  - (opus) post-shot outcome information; was used as a model feature in the approved run cfg9bac2706 (log loss 0.142, implausibly good) and is now on FORBIDDEN_BASELINE_FEATURE_INPUT_KEYS (baselineDataset.ts:241); still present in NUMERIC/BOOLEAN/CATEGORICAL key lists

## M-XG-055 Rebound-control outcome labels (creates rebound / goalie freeze / no-danger)

- **Match:** Opus only; Opus XG-016; Codex —
- **Purpose:** Label each source shot by what happened next (training label for rebound_creation model).
- **Where:** `web/lib/supabase/Upserts/nhlRebounds.ts:108 (classifyReboundControlOutcome)`; `web/lib/supabase/Upserts/nhlRebounds.ts:295 (createsRebound assignment)`
- **Tags (heuristic):** denominators: shots on goal; generation: current
- **Opus view (XG-016):**
  - Method: If a rebound shot followed -> second_chance_allowed (confidence high); else if source is SOG and next event is 'stoppage' within 3 s same period -> goalie_freeze + covered_puck (medium); otherwise no_danger_continuation (medium).
  - Inputs/units: seconds; sources: nhl_api_pbp_events
  - Output scale: categorical/booleans; writes: nhl_xg_shot_features.creates_rebound etc.
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: rebound_creation model label; rebound control aggregates
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: MoneyPuck expected rebounds / rebound control
  - Fixtures/test data: `web/scripts/output/xg-rebound-baselines/logistic_l2-rebound_creation-s20252026-p1-st1-f1-cfg67a10a61/`
  - Tests: `web/lib/supabase/Upserts/nhlRebounds.test.ts`
- **Leads (not audited):**
  - (opus) any stoppage within 3 s after a SOG is treated as goalie freeze (could be puck out of play, net off)
  - (opus) goal events as sources are excluded (REBOUND_SOURCE_TYPES lacks goal) — fine

## M-XG-056 Shift stints and on-ice attribution

- **Match:** Opus only; Opus XG-020; Codex —
- **Purpose:** Turn shift rows into constant-personnel stints and resolve on-ice players at event time.
- **Where:** `web/lib/supabase/Upserts/nhlShiftStints.ts:84 (normalizeShiftInterval)`; `web/lib/supabase/Upserts/nhlShiftStints.ts:195 (buildShiftStints)`; `web/lib/supabase/Upserts/nhlShiftStints.ts:270 (findShiftStintAtTime)`; `web/lib/supabase/Upserts/nhlOnIceAttribution.ts:48 (buildOnIceAttributionForEvent)`
- **Tags (heuristic):** generation: current
- **Opus view (XG-020):**
  - Method: Fix end<=start using duration; split each period at all shift boundaries; merge adjacent identical stints. Event at a boundary second resolves to the stint ENDING at that second (outgoing players) first.
  - Inputs/units: seconds within period; sources: nhl_api_shift_rows
  - Output scale: player id sets; seconds; writes: —
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: contextual features; deployment buckets; adjusted impact design rows; QoT/QoC; NST-parity on-ice counts
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST/EH on-ice attribution at shift changes (NST credits players on ice at event time; conventions differ on change seconds)
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlOnIceAttribution.test.ts`; `web/lib/supabase/Upserts/nhlShiftStints.test.ts`
- **Leads (not audited):**
  - (opus) boundary rule (prefer ending stint) may differ from NST; goalie inclusion is decided by callers

## M-XG-057 Game-clock hydration and seconds-since-previous-event

- **Match:** Opus only; Opus XG-023; Codex —
- **Purpose:** Derive period duration, cumulative game seconds and inter-event gaps.
- **Where:** `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:233 (defaultPeriodDurationSeconds)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:265 (buildPeriodDurationLookup)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:283 (buildPeriodOffsetLookup)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:311 (hydratePersistedEventTimingFields)`; `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts:174 (defaultPeriodDurationSeconds, parser copy)`
- **Tags (heuristic):** generation: current
- **Opus view (XG-023):**
  - Method: periodDuration = elapsed+remaining, else 1200 s regulation / 300 s OT (regular-season OT assumption); game_seconds = sum of prior period durations + period elapsed; seconds_since_previous_event = max(0, gameSec - prevGameSec). Events sorted by sort_order then event_id.
  - Inputs/units: seconds; sources: nhl_api_pbp_events
  - Output scale: seconds; writes: nhl_xg_shot_features (via payload)
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: rebound/rush/flurry windows; model numeric features gameSecondsElapsed/periodSecondsElapsed/timeSincePreviousEventSeconds
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlPlayByPlayParser.test.ts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`
- **Leads (not audited):**
  - (opus) DEFAULT_REGULAR_SEASON_OT_SECONDS=300 fallback is wrong for playoff 20-min OT when clock fields missing
  - (opus) NHL clock resolution is 1 s, so many rebound gaps are 0 s and later filtered by '>0' rules

## M-XG-058 Strength state and exact manpower

- **Match:** Opus only; Opus XG-024; Codex —
- **Purpose:** Parse NHL situationCode into owner-relative EV/PP/SH/EN and 'AvH' exact manpower.
- **Where:** `web/lib/supabase/Upserts/nhlStrengthState.ts:24 (parseSituationCode)`; `web/lib/supabase/Upserts/nhlStrengthState.ts:40 (formatStrengthExact)`; `web/lib/supabase/Upserts/nhlStrengthState.ts:64 (isEmptyNetSituation)`; `web/lib/supabase/Upserts/nhlStrengthState.ts:71 (classifyTeamStrengthState)`; `web/lib/supabase/Upserts/nhlRawGamecenter.mjs:78,91 (duplicate parseSituationCode/buildStrengthState)`
- **Tags (heuristic):** generation: current
- **Opus view (XG-024):**
  - Method: EN if either goalie digit = 0 (regardless of which team pulled); else EV if owner skaters == opponent skaters, PP if more, SH if fewer. strengthExact = `${awaySkaters}v${homeSkaters}` (NOT owner-relative).
  - Inputs/units: skater counts (integers); sources: nhl_api_pbp_events, NHL gamecenter play-by-play
  - Output scale: categorical EV/PP/SH/EN; string 'NvM'; writes: nhl_api_pbp_events.strength_state/strength_exact, nhl_xg_shot_features
  - Status: live — feeds nhl_xg_shot_features via admin/cron-bearer route web/pages/api/v1/db/update-nhl-xg-shot-features.ts (no schedule in vercel.json; docs/player-projections/model-inventory.json:1114 says status production)
  - Consumers: xG model categorical features strengthState & strengthExact; NST-parity splits; adjusted impact context; holdout slices
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST/Evolving-Hockey strength definitions (5v5, 5v4, 4v5, EN for/against separated)
  - Fixtures/test data: `web/lib/supabase/Upserts/nhlStrengthState.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlRawGamecenter.test.ts`; `web/lib/supabase/Upserts/nhlStrengthState.test.ts`
- **Leads (not audited):**
  - (opus) EN lumps 'shooting at empty net' with 'own goalie pulled' (6v5 attacking) into one state
  - (opus) strengthExact is away-v-home orientation, so model level '5v4' means away PP for away shots but PK for home shots; artifact levels include odd '0v1','1v0','6v3'
  - (opus) TS returns null strength for unknown owner on EV while .mjs returns 'EV' (minor inconsistency)

## M-XG-059 xG model specification as trained (includes / excludes)

- **Match:** Opus only; Opus XG-028; Codex —
- **Purpose:** Record exactly what the in-house shot xG model uses, per the trainer defaults and saved artifacts
- **Where:** `web/scripts/train-nhl-xg-baseline.ts:616 (parseCliArgs defaults)`; `web/lib/xg/baselineDataset.ts:70 (DEFAULT_NUMERIC_FEATURE_KEYS)`; `web/lib/xg/baselineDataset.ts:160 (DEFAULT_BOOLEAN_FEATURE_KEYS)`; `web/lib/xg/baselineDataset.ts:170 (DEFAULT_CATEGORICAL_FEATURE_KEYS)`; `web/lib/xg/baselineDataset.ts:241 (FORBIDDEN_BASELINE_FEATURE_INPUT_KEYS)`; `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`; `web/scripts/output/xg-approval-run-20260522/logistic_l2-s20252026-p1-st1-f1-cfg9bac2706/model-artifact.json`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (XG-028):**
  - Method: INCLUDES (first_pass_v1 preset, the one in both saved logistic_l2 artifacts): normalizedX/normalizedY (raw x,y mirrored by -1 when attacking toward negative side, using homeTeamDefendingSide; net at x=89,y=0), shotDistanceFeet, shotAngleDegrees = atan2(\|dy\|,\|dx\|) in degrees (unsigned, so no left/right side), shotType (categorical), strengthState + strengthExact (categorical), zoneCode, previousEventTypeDescKey, previousEventSameTeam, timeSincePreviousEventSeconds, distanceFromPreviousEvent, east-west/north-south movement feet, isReboundShot (3 s window), isRushShot (10 s window), isFlurryShot (5 s gap), crossedRoyalRoad, isEmptyNetEvent, isOvertimeEvent, period/periodSeconds/gameSeconds, ownerPowerPlayAgeSeconds, shooterShiftAgeSeconds. Optional presets: expanded_v2 adds score differential (home/away/owner + ownerScoreDiffBucket), possession chain counts/duration/start type, defenseman shooter, roster position, late-game close/trailing; speed_context_v3 adds speed-from-previous-event and rebound/rush speeds. Trainer also enriches shooter handedness, goalie catch hand and handedness matchup, and on-ice deployment context. EXCLUDES: score state in default preset (only in expanded_v2), shooter identity/talent effects, goalie identity/quality effects, rink-bias (arena) adjustment, pre-shot pass/royal-road beyond crossedRoyalRoad flag, post-event fields (shotEventType, missReasonBucket, isShortSideMiss are forbidden). TRAINING SET: single season 20252026 (default --season), 70/15/15 chronological game split: train 2025-10-07..2026-03-03 (82,636 shots), validation 2026-03-03..03-30 (17,829), test 2026-03-30..05-21 (17,834, includes playoffs). MODEL TYPE: default CLI family xgboost_js, but saved candidates are logistic_l2 (800 iters, lr 0.05, l2 0.01, train-only z-scored numerics, one-hot categoricals). CALIBRATION: validation-fit post-calibration chosen by lib/xg/calibration (corrected candidate: raw; approval run: isotonic)
  - Inputs/units: feet (coordinates, distance, movement), degrees (angle), seconds (time features); sources: nhl_api_pbp_events, nhl_api_shift_rows, games, player_stats_unified, goalie_stats_unified, players
  - Output scale: probability 0-1 per shot; writes: model artifacts on disk; production persistence via lib/xg/shotFeaturePersistence (other slice)
  - Status: live — logistic_l2 candidate artifacts exist; promotion/serving managed elsewhere (lib/xg releaseArtifactReference)
  - Consumers: xG shot scoring, NST-parity metrics, rebound heads, CTPI/team ratings via xG columns (other slices)
- **Audit context:**
  - Intent (Opus): comment web/lib/xg/baselineDataset.ts:239-240 ('Post-event/outcome fields that must never feed an xG model'); trainer --help text web/scripts/train-nhl-xg-baseline.ts:294-330
  - External references: MoneyPuck / Evolving-Hockey xG (multi-season training, score-state and shooter/rebound angle-change features)
  - Fixtures/test data: `web/scripts/output/xg-baselines/ (logistic_unregularized, logistic_l2, xgboost_js artifacts per config)`; `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/`; `web/scripts/output/xg-approval-run-20260522/ (3 configs)`; `web/scripts/output/xg-rebound-baselines/`; `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
  - Tests: `web/lib/supabase/Upserts/nhlCoordinates.test.ts`; `web/lib/supabase/Upserts/nhlRebounds.test.ts`; `web/lib/supabase/Upserts/nhlRush.test.ts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`; `web/lib/xg/baselineDataset.test.ts`; `web/lib/xg/binaryLogistic.test.ts`; `web/lib/xg/calibration.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) approval-run artifact cfg9bac2706 (default reference for audit-xg-registry-feature-coverage.ts and rebound-heads script) includes now-forbidden post-event features isShortSideMiss and missReasonBucket; its test log loss 0.142 vs 0.243 for the corrected candidate
  - (opus) trained on one partial season with playoffs in the test split; no multi-season training
  - (opus) shot angle is unsigned (atan2 of absolute deltas)
  - (opus) trainer CLI default family is xgboost_js while saved/approved artifacts are logistic_l2

## M-XG-060 Rebound-creation model and offline rebound heads

- **Match:** Opus only; Opus XG-033; Codex —
- **Purpose:** Predict P(shot creates a rebound) and conditional rebound danger/freeze/goal heads.
- **Where:** `web/scripts/train-nhl-xg-baseline.ts:299-305 (rebound_creation label via baselineDataset)`; `web/scripts/train-nhl-xg-rebound-heads-offline.ts:113 (labelForHead)`; `web/scripts/train-nhl-xg-rebound-heads-offline.ts:167 (trainHead)`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: conditional; denominators: shots on goal; generation: research, development, current
- **Opus view (XG-033):**
  - Method: rebound_creation: same logistic pipeline, label createsRebound, sources SOG/missed/blocked. Offline heads: logistic_l2 (500 iters, lr 0.05, l2 0.01) for conditional_rebound_danger, goalie_freeze_control, conditional next-attempt goal; reuse champion split assignments; block if rows<100, positives<10, Brier/log loss not better than base rate, AUC<0.5.
  - Inputs/units: standardized features; sources: nhl_xg_shot_features, nhl_api_pbp_events
  - Output scale: probability 0-1; writes: nhl_xg_shot_predictions (prediction_type=rebound_creation), offline JSON
  - Status: live for rebound_creation predictions if approved artifact configured; heads draft/offline (promotionAuthorized:false)
  - Consumers: rebound control aggregates; rebound heads outputs
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: MoneyPuck expected rebounds model
  - Fixtures/test data: `web/scripts/output/xg-rebound-baselines/logistic_l2-rebound_creation-s20252026-p1-st1-f1-cfg67a10a61/`; `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
  - Tests: `web/lib/xg/reboundRichLabels.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) heads reuse shot_goal feature encoding (incl. isFlurryShot/isReboundShot, which partially encode the label for rebound creation: a flurry source is by construction followed by a shot)

