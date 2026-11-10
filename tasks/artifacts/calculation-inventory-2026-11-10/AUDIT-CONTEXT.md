# Audit context for the calculation inventory (Opus)

Companion to [CALCULATIONS-OPUS.md](CALCULATIONS-OPUS.md), kept separate from the inventory. For each calculation: the stated intended goal or contract (with its source), credible external references to compare against, and real examples, fixtures or test data an auditor could use. **UNDOCUMENTED** marks calculations where no stated intent was found in code comments, docs or tasks/.

Intent documented: 634 of 1029. Undocumented: 395.

## Undocumented intent by family

| Family | Undocumented | Total |
|---|---:|---:|
| xG | 50 | 70 |
| FORGE projections | 34 | 98 |
| Player forecasts (season) | 28 | 130 |
| RSO / roster optimizer | 4 | 60 |
| Fantasy scoring | 15 | 53 |
| Rankings | 8 | 45 |
| Sustainability | 31 | 58 |
| BLSH (Buy Low / Sell High) | 2 | 15 |
| Trade value | 0 | 5 |
| Game predictions & odds | 37 | 42 |
| sKO | 8 | 26 |
| VuDu | 0 | 3 |
| Team ratings / power / CTPI / SOS | 42 | 54 |
| Underlying stats summaries | 50 | 95 |
| Rolling player averages & trends | 10 | 45 |
| NST-derived stats | 12 | 34 |
| Player cards & homepage stats | 8 | 24 |
| Lines / TOI / PP units | 15 | 43 |
| WiGO | 2 | 15 |
| Goalie starters & starter odds | 5 | 20 |
| Draft tools | 15 | 42 |
| Stats helpers | 1 | 8 |
| Misc / other | 18 | 44 |

## xG (XG)

### XG-001 xG model: includes/excludes

- **Intent / contract:** web/lib/xg/baselineDataset.ts:4 and :307 comments (P(goal \| shot features), label = observed outcome); web/lib/xg/shotFeaturePersistence.ts:615 comment; docs/player-projections/model-inventory.json:1110 entry; tasks/artifacts/xg-*.md (62 decision/benchmark notes, not read)
- **External references:** Evolving-Hockey xG (XGBoost per strength, Fenwick, multi-season, AUC ~0.77-0.78 at 5v5); MoneyPuck xG (GBM, arena-adjusted, rebound/rush/speed/flurry, shooter talent adjustment); HockeyViz (Micah McCurdy, location-smoothed); NST xG (Fenwick, distance/angle/type/rebound/rush)
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`; `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`; `web/scripts/output/xg-approval-run-20260522/`; `web/scripts/output/xg-baselines/`; `web/scripts/output/xg-rebound-baselines/`; `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
- **Tests:** `web/lib/xg/baselineDataset.test.ts`; `web/lib/xg/binaryLogistic.test.ts`; `web/lib/xg/calibration.test.ts`; `web/lib/xg/shotFeaturePersistence.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`

### XG-002 xG team aggregate reconciliation (xGF/xGA symmetry) and operations alerts

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Accounting identity: league/game xGF = xGA
- **Examples / fixtures / test data:** `web/lib/xg/operationsHealth.test.ts`
- **Tests:** `web/lib/xg/operationsHealth.test.ts`

### XG-003 xG shot scoring route stage (artifact-gated)

- **Intent / contract:** Route error text: artifact must be approval-grade (approvalGradeEligibility.isEligible)
- **External references:** MoneyPuck / Evolving-Hockey xG; calibration curves
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts (wrapper only)`

### XG-004 Platt and isotonic calibrators

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** sklearn CalibratedClassifierCV / IsotonicRegression
- **Examples / fixtures / test data:** `web/scripts/output/xg-approval-run-20260522/`
- **Tests:** `web/lib/xg/calibration.test.ts`

### XG-005 Calibration requirement and cross-validated method selection

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (tasks/artifacts/xg-calibration-path-decision-2026-03-31.md, xg-calibration-requirement-reassessment-2026-03-31.md)
- **External references:** Platt scaling / isotonic regression (Niculescu-Mizil & Caruana); MoneyPuck/EH report calibration plots
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
- **Tests:** `web/lib/xg/calibration.test.ts`

### XG-006 xG post-calibration selection on validation split

- **Intent / contract:** reason strings web/scripts/train-nhl-xg-baseline.ts:1570,1613-1614
- **External references:** Platt / isotonic calibration on held-out data
- **Examples / fixtures / test data:** `web/scripts/output/xg-approval-run-20260522/logistic_l2-s20252026-p1-st1-f1-cfg9bac2706/model-artifact.json (calibration)`
- **Tests:** `web/lib/xg/calibration.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`

### XG-007 xG offline challengers (LightGBM / CatBoost / XGBoost) with Platt calibration

- **Intent / contract:** report calibration note web/scripts/train_nhl_xg_challengers.py:419
- **External references:** MoneyPuck GBM xG; Platt scaling; ECE
- **Examples / fixtures / test data:** `challenger dataset .json.gz written by train-nhl-xg-baseline.ts --challengerDatasetPath (none committed)`
- **Tests:** none found

### XG-008 xG evaluation metrics: log loss, Brier, calibration bins, slice evaluation

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** standard proper scoring rules
- **Examples / fixtures / test data:** `web/scripts/output/xg-baselines/*/model-artifact.json (evaluation, holdoutSliceEvaluations, holdoutScores)`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`; `web/scripts/benchmark-nhl-xg-baselines.test.ts`

### XG-009 Shot map coordinate folding, hexbin and density heatmap

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** HockeyViz shot maps (attack-direction normalized via period/side)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/hooks/useShotData.test.tsx`

### XG-010 Power-play age and shift-fatigue features

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck shooter time on ice / PP time elapsed
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlContextualFeatures.test.ts`

### XG-011 East-west / north-south movement and royal-road crossing

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck east-west/north-south movement; royal-road passes (tracking-based in the community)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlContextualFeatures.test.ts`

### XG-012 Shot coordinate normalization to attacking direction

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (no comment; tasks/artifacts/xg-feature-contract-repair-2026-03-31.md may describe)
- **External references:** MoneyPuck arena-adjusted coordinates; Evolving-Hockey/HockeyViz coordinate flipping by period/home side
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/nhlCoordinates.test.ts`; `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
- **Tests:** `web/lib/supabase/Upserts/nhlCoordinates.test.ts`

### XG-013 Event inclusion / empty-net / OT / rare-manpower flags

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck/EH exclude shootouts; penalty shots usually excluded or modeled separately
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/nhlEventInclusion.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlEventInclusion.test.ts`

### XG-014 Missed-shot reason buckets

- **Intent / contract:** web/lib/xg/baselineDataset.ts:239 comment: post-event/outcome fields that must never feed an xG model
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/output/xg-approval-run-20260522/ (3 logistic_l2 runs: cfg9bac2706 leaky-approved, cfg56c3fc2f, cfgf81a5112)`
- **Tests:** `web/lib/supabase/Upserts/nhlMissReasons.test.ts`; `web/lib/xg/baselineDataset.test.ts`

### XG-015 Prior-event context (time, distance, speed from previous event)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck 'time since last event', 'distance from last event', 'speed from last event'
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlPriorEventContext.test.ts`

### XG-016 Rebound-control outcome labels (creates rebound / goalie freeze / no-danger)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck expected rebounds / rebound control
- **Examples / fixtures / test data:** `web/scripts/output/xg-rebound-baselines/logistic_l2-rebound_creation-s20252026-p1-st1-f1-cfg67a10a61/`
- **Tests:** `web/lib/supabase/Upserts/nhlRebounds.test.ts`

### XG-017 Rebound shot definition and rebound geometry

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (see tasks/artifacts/xg-rebound-geometry-benchmark-2026-03-31.md)
- **External references:** MoneyPuck rebound = shot within 3 s of prior shot; Evolving-Hockey rebound <=2-3 s
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
- **Tests:** `web/lib/supabase/Upserts/nhlRebounds.test.ts`

### XG-018 Rush shot definition

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck rush = within 4 s of an event in neutral/defensive zone; Evolving-Hockey ~ similar
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
- **Tests:** `web/lib/supabase/Upserts/nhlRush.test.ts`

### XG-019 Score state context

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Score-and-venue adjustment (Tulsky/Micah McCurdy HockeyViz/EH score-adjusted xG)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlScoreState.test.ts`

### XG-020 Shift stints and on-ice attribution

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST/EH on-ice attribution at shift changes (NST credits players on ice at event time; conventions differ on change seconds)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlShiftStints.test.ts`; `web/lib/supabase/Upserts/nhlOnIceAttribution.test.ts`

### XG-021 Goalie-on-ice flags and shot outcome flags

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Fenwick (unblocked attempts) convention used by MoneyPuck/EH/NST xG
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`

### XG-022 Shot distance and angle

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck/Evolving-Hockey shot distance & angle (EH uses signed/abs angle, behind-net handled separately)
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
- **Tests:** `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`; `web/lib/supabase/Upserts/nhlRebounds.test.ts`

### XG-023 Game-clock hydration and seconds-since-previous-event

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`; `web/lib/supabase/Upserts/nhlPlayByPlayParser.test.ts`

### XG-024 Strength state and exact manpower

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST/Evolving-Hockey strength definitions (5v5, 5v4, 4v5, EN for/against separated)
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/nhlStrengthState.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlStrengthState.test.ts`; `web/lib/supabase/Upserts/nhlRawGamecenter.test.ts`

### XG-025 Shooter/goalie handedness, roster position and deployment buckets

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (tasks/artifacts/xg-handedness-benchmark-2026-03-31.md)
- **External references:** MoneyPuck shooter handedness / off-wing features
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/handedness.test.ts`; `web/lib/xg/rosterPosition.test.ts`; `web/lib/xg/deploymentContext.test.ts`; `web/lib/xg/shotFeatureEnrichment.test.ts`

### XG-026 Rich rebound labels (offline)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck expected rebounds / rebound control
- **Examples / fixtures / test data:** `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
- **Tests:** `web/lib/xg/reboundRichLabels.test.ts`

### XG-027 Team travel / rest / fatigue features

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Schedule-fatigue features in public game models (e.g., MoneyPuck game model, EH)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/travelFatigue.test.ts`

### XG-028 xG model specification as trained (includes / excludes)

- **Intent / contract:** comment web/lib/xg/baselineDataset.ts:239-240 ('Post-event/outcome fields that must never feed an xG model'); trainer --help text web/scripts/train-nhl-xg-baseline.ts:294-330
- **External references:** MoneyPuck / Evolving-Hockey xG (multi-season training, score-state and shooter/rebound angle-change features)
- **Examples / fixtures / test data:** `web/scripts/output/xg-baselines/ (logistic_unregularized, logistic_l2, xgboost_js artifacts per config)`; `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/`; `web/scripts/output/xg-approval-run-20260522/ (3 configs)`; `web/scripts/output/xg-rebound-baselines/`; `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`; `web/lib/xg/baselineDataset.test.ts`; `web/lib/xg/binaryLogistic.test.ts`; `web/lib/xg/calibration.test.ts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`; `web/lib/supabase/Upserts/nhlCoordinates.test.ts`; `web/lib/supabase/Upserts/nhlRebounds.test.ts`; `web/lib/supabase/Upserts/nhlRush.test.ts`

### XG-029 Baseline dataset encoding (feature families, imputation, one-hot, label)

- **Intent / contract:** web/lib/xg/baselineDataset.ts:4 comment: 'For shot_goal, the model estimates P(goal \| this shot's features)'; web/lib/xg/baselineDataset.ts:307 comment: label is observed outcome of same shot
- **External references:** MoneyPuck xG feature list (distance, angle, shot type, rebound, rush, speed, empty net, strength, score); Evolving-Hockey xG features
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`; `web/scripts/output/xg-approval-run-20260522/`
- **Tests:** `web/lib/xg/baselineDataset.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`

### XG-030 Train/validation/test game splits (chronological and out-of-time)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Standard out-of-time validation used by EH/MoneyPuck (train prior seasons, test later season)
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`; `web/lib/xg/baselineDataset.test.ts`

### XG-031 Binary logistic regression trainer (in-house gradient descent)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (tasks/artifacts/xg-logistic-vs-l2-comparison-2026-03-31.md, xg-first-baseline-decision-2026-03-31-repaired.md)
- **External references:** scikit-learn LogisticRegression (lbfgs, converged); Evolving-Hockey/MoneyPuck use gradient boosting (XGBoost/GBM)
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`; `web/scripts/output/xg-approval-run-20260522/`; `web/scripts/output/xg-baselines/`
- **Tests:** `web/lib/xg/binaryLogistic.test.ts`

### XG-032 Python challenger models (LightGBM / CatBoost / XGBoost, global and per-strength)

- **Intent / contract:** web/scripts/train_nhl_xg_challengers.py:5 docstring
- **External references:** Evolving-Hockey (XGBoost per strength state), MoneyPuck (GBM)
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
- **Tests:** none found

### XG-033 Rebound-creation model and offline rebound heads

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck expected rebounds model
- **Examples / fixtures / test data:** `web/scripts/output/xg-rebound-baselines/logistic_l2-rebound_creation-s20252026-p1-st1-f1-cfg67a10a61/`; `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`; `web/lib/xg/reboundRichLabels.test.ts`

### XG-034 Numeric feature standardization

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`

### XG-035 xgboost_js boosted-tree family (third-party @fractal-solutions/xgboost-js)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (tasks/artifacts/xg-baseline-benchmark-summary-2026-03-31.md)
- **External references:** XGBoost binary:logistic (gradient+hessian in logit space) as used by Evolving-Hockey
- **Examples / fixtures / test data:** `web/scripts/output/xg-baselines/`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`; `web/scripts/benchmark-nhl-xg-baselines.test.ts`

### XG-036 Goalie GSAx share module (NST xGA)

- **Intent / contract:** web/lib/socialShare/modules/goalieGsax.ts:14 comment: GSAx is xg_against - goals_against, never NST gsaa
- **External references:** MoneyPuck/EH GSAx
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/socialShare/modules/goalieGsax.test.ts`

### XG-037 xG-adjusted player impact (shot-level ridge, 'RAPM-like')

- **Intent / contract:** web/lib/rankings/adjustedImpactPromotionContract.ts:71 currentUse: live methodology/diagnostic source only; promotion gate lists required controls
- **External references:** Macdonald (2011/2012) xG RAPM / Schuckers-Curro THoR; Evolving-Hockey RAPM (stint rows, per-60 response, TOI weights, separate O/D coefficients, ridge via cross-validated lambda)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/adjustedImpact.test.ts`; `web/lib/rankings/adjustedImpactPromotionContract.test.ts`

### XG-038 Created xG (shot-assist + transition)

- **Intent / contract:** web/lib/xg/createdXg.ts:164 provenance formula string
- **External references:** EH/MoneyPuck xA-like 'xG created'
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/createdXg.test.ts`

### XG-039 Quality of teammates / competition (QoT/QoC) percentiles

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST/EH QoT/QoC (TOI% or xGF%-based); HockeyViz
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/qotQoc.test.ts`

### XG-040 Rebound-control aggregates (expected vs actual rebounds; goalie rebound control above expected)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck expected rebounds / rebound control
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/reboundControl.test.ts`

### XG-041 Rebound head outputs (danger / second-chance xG)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck 'xGoals of xRebounds'
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/reboundHeads.test.ts`

### XG-042 Lagged residual shooter/goalie skill layer

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Shooter talent regression to mean (Tango-style n/(n+k)); MoneyPuck shooting talent adjusted xG; EH xFSh%/goalie GSAx
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/residualSkill.test.ts`

### XG-043 Shot-assist candidates / expected primary assists

- **Intent / contract:** provenance note in code: 'Inferred candidate, not official tracked pass data.' (web/lib/xg/shotAssists.ts:268)
- **External references:** Tracked passing data (Corey Sznajder/AllThreeZones), MoneyPuck/EH xA
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/shotAssists.test.ts`

### XG-044 Transition proxies (controlled entry/exit, transition-created xG)

- **Intent / contract:** provenance note: 'Public-PBP transition proxy, not puck-tracking zone-entry data.' (web/lib/xg/transitions.ts:321)
- **External references:** Tracked zone-entry data (Sznajder AllThreeZones), EH/MoneyPuck rush stats
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/transitions.test.ts`

### XG-045 xG denominator semantics (xSh%, shooting above expected, shot quality)

- **Intent / contract:** web/lib/rankings/xgDenominatorSemantics.ts:1 XG_SHOT_UNIVERSE='fenwick_unblocked'
- **External references:** NST xFSh% (ixG/iFF)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/xgDenominatorSemantics.test.ts`

### XG-046 Player-trend expected shooting % (NST ixG/iFF)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST xFSh%
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### XG-047 xG explorer derived ratios

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST xGF%
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/xgExplorer.test.ts`; `web/__tests__/pages/underlying-stats/xg/index.test.tsx`

### XG-048 Rolling-window xG aggregates (5/10/20 games)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST last-N rolling; EH rolling xGF
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/aggregates.test.ts`

### XG-049 Team/player/goalie game xG aggregation and goalie GSAx

- **Intent / contract:** web/lib/xg/shotFeaturePersistence.ts:615 comment (sums create ixG/xGF/xGA)
- **External references:** MoneyPuck/EH/NST team xGF/xGA, ixG, GSAx
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/aggregates.test.ts`

### XG-050 Flurry-adjusted xG

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck flurry-adjusted xG (identical formula)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/flurryAdjusted.test.ts`

### XG-051 Shot xG scoring (prediction)

- **Intent / contract:** web/lib/xg/shotFeaturePersistence.ts:615 comment: returns a shot-quality probability for a single shot; summing gives ixG/xGF/xGA, not a forecast
- **External references:** MoneyPuck/EH per-shot xG
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
- **Tests:** `web/lib/xg/shotFeaturePersistence.test.ts`

### XG-052 xG rich rebound heads (offline logistic)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (output field promotionAuthorized:false)
- **External references:** Mann-Whitney AUC; logistic regression
- **Examples / fixtures / test data:** `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
- **Tests:** `web/lib/xg/binaryLogistic.test.ts`

### XG-053 xG release validation: native NST-parity counts vs NST gamelogs

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in script header (help text only)
- **External references:** Natural Stat Trick counts
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`

### XG-054 xG approval-grade eligibility gates

- **Intent / contract:** blocking reason messages web/scripts/train-nhl-xg-baseline.ts:364-575; constants :331-343
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/output/xg-*/**/model-artifact.json (approvalGradeEligibility)`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`; `web/scripts/benchmark-nhl-xg-baselines.test.ts`; `web/lib/xg/featureCoverage.test.ts`

### XG-055 xG baseline trainer: chronological / out-of-time game splits

- **Intent / contract:** split strategy label web/scripts/train-nhl-xg-baseline.ts:860-879
- **External references:** time-based holdout (MoneyPuck/Evolving-Hockey validate on later seasons)
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/dataset-artifact.json`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`

### XG-056 xG baseline trainer: train-only z-score standardization

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (function names only)
- **External references:** standard z-score scaling (sklearn StandardScaler uses population std too)
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json (featureTransforms)`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`; `web/lib/xg/binaryLogistic.test.ts`; `web/lib/xg/calibration.test.ts`; `web/lib/xg/baselineDataset.test.ts`

### XG-057 xG baseline trainer: logistic / elastic-net / xgboost-js model fit

- **Intent / contract:** --help text web/scripts/train-nhl-xg-baseline.ts:294-330
- **External references:** MoneyPuck / Evolving-Hockey logistic & GBM xG
- **Examples / fixtures / test data:** `web/scripts/output/xg-baselines/`; `web/scripts/output/xg-approval-run-20260522/`; `web/scripts/output/xg-corrected-candidate/`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`; `web/lib/xg/binaryLogistic.test.ts`; `web/lib/xg/calibration.test.ts`; `web/lib/xg/baselineDataset.test.ts`

### XG-058 NST-parity goalie metrics (Sv%, GAA, 'gsaa', danger splits)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST GSAA = SA*(league Sv%) - GA; GSAx = xGA - GA (MoneyPuck/EH)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`

### XG-059 NST-parity heuristic xG and danger buckets

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md)
- **External references:** NST scoring-chance/high-danger zones (polygon-based), NST xG model
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`

### XG-060 NST-parity skater individual and on-ice counts/rates

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Natural Stat Trick definitions (CF%, xGF%, PDO, IPP, OZS%)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`

### XG-061 Strength segments and TOI-by-split accumulation

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST TOI by situation
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`

### XG-062 NST parity comparison tolerances

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md, xg-release-validation-output-contract-2026-03-31.md)
- **External references:** NST definitions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlXgValidation.test.ts`

### XG-063 Adjusted-impact held-out validation and leakage gate

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/adjustedImpact.test.ts`

### XG-064 Artifact drift and NST team-surface drift reports

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST team xGF
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/aggregates.test.ts`

### XG-065 Probability metrics: log loss, Brier, calibration bins, slice evaluation

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck/EH report log loss and AUC (EH ~0.77-0.78 AUC at 5v5); NST does not publish
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`; `web/lib/xg/calibration.test.ts`

### XG-066 Feature coverage profile and scoring-row drift audit

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
- **Tests:** `web/lib/xg/featureCoverage.test.ts`

### XG-067 Segment calibration audit and internal benchmark surfaces

- **Intent / contract:** web/lib/xg/hardeningAudit.ts XG_EXTERNAL_TAXONOMY comparisonRule 'taxonomy_alignment_required_before_failure_classification'
- **External references:** MoneyPuck/EH/NST taxonomy (documented in XG_EXTERNAL_TAXONOMY)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/hardeningAudit.test.ts`

### XG-068 Tracking-alignment audit

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/trackingAlignment.test.ts`

### XG-069 Approval-grade eligibility gates

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (tasks/artifacts/xg-release-gate-verdict-2026-03-30.md, xg-harness-enforcement-2026-03-31.md)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`; `web/scripts/output/xg-approval-run-20260522/`
- **Tests:** `web/scripts/train-nhl-xg-baseline.test.ts`; `web/scripts/benchmark-nhl-xg-baselines.test.ts`

### XG-070 AUC (rank-based) for offline heads and challengers

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** standard ROC AUC; EH/MoneyPuck AUC reporting
- **Examples / fixtures / test data:** `web/scripts/output/xg-rebound-rich-offline/rebound-rich-heads-v1.json`
- **Tests:** none found

## FORGE projections (FRG)

### FRG-001 matview opponent_skater_allowed_by_position

- **Intent / contract:** supabase/migrations/20261019211444_opponent_skater_allowed_by_position.sql:1-5
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### FRG-002 fn forge_league_skater_physical_totals

- **Intent / contract:** supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql:1-6
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/queries/skater-queries.test.ts`

### FRG-003 view forge_served_forecast_scoreboard_daily

- **Intent / contract:** supabase/migrations/20261021230025_forge_served_forecast_ledger.sql:70-73 and COMMENT at :108
- **External references:** MAE/bias; Brier score / log loss for probabilities
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### FRG-004 FORGE dashboard client aggregates (hot/cold, trust/momentum, power trend)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/forge/dashboard.test.tsx`; `web/__tests__/pages/forge/command-center.test.tsx`

### FRG-005 FORGE v2 forecast revision traversal spans

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/ForgeV2/ForecastExplorer.test.tsx`

### FRG-006 Legacy game goal projections (att x def x league)

- **Intent / contract:** calculations.ts:1 'Legacy game-goal projection calculations'; 24-28 docstring
- **External references:** Dixon-Coles / Maher Poisson model
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### FRG-007 Legacy / test-only skater and goalie helpers

- **Intent / contract:** calculators/skater-adjustments.ts:782-787 docstring
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/fixtures/forge-counterfactual-backtest/`; `web/scripts/fixtures/forge-reconstruction-backtest/`
- **Tests:** `web/lib/projections/runProjectionV2.alignedConversion.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `web/scripts/forge-counterfactual-backtest.test.ts`

### FRG-008 Completed game length

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL OT rules
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/gameLength.test.ts`

### FRG-009 Reserve (if-dressed / if-starts) projections

- **Intent / contract:** reserveProjections.ts:13-19 docstring; tasks/artifacts/forge-week-coverage-2026-10-26/DIAGNOSIS.md
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/reserveProjections.test.ts`

### FRG-010 Roster event confidence and TTL from reviewed tweets (+ preflight staleness gates)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/projections/rosterEvents.test.ts`
- **Tests:** `web/lib/projections/rosterEvents.test.ts`

### FRG-011 Season-opening bootstrap blend

- **Intent / contract:** seasonBootstrap.ts:4-8 comment and SEASON_BOOTSTRAP_POLICY
- **External references:** Marcel-style prior-season regression
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### FRG-012 Horizon per-game scalars

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-013 FORGE goalie starter metadata: top-2 probability mass and horizon-scaled blended projection

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/module-imports.test.ts`

### FRG-014 Projections table proration and global ranks

- **Intent / contract:** proration.ts:1-4 header
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draftDashboard/fantasyPointRecalculation.test.ts`

### FRG-015 FORGE pipeline stage map

- **Intent / contract:** rollingForgePipeline.ts:219-251 dependency requirements text; tasks/TASKS/forge-projections/tasks-forge-projection-improvements-2026-10-22.md
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/fixtures/forge-counterfactual-backtest/`; `web/scripts/fixtures/forge-reconstruction-backtest/`; `web/lib/projections/externalInputProof.fixtures.ts`
- **Tests:** `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`; `web/__tests__/pages/api/v1/db/run-projection-v2.test.ts`; `web/lib/projections/runProjectionV2.test.ts`

### FRG-016 FORGE projection miss attribution (skater TOI/shot-rate/conversion; goalie starter/SA/SV%)

- **Intent / contract:** Comment run-projection-accuracy.ts:~2250 (unknown starter probability attributes nothing to the starter call)
- **External references:** Shapley-style or variance decomposition; sequential substitution is order-dependent
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`

### FRG-017 FORGE projection accuracy metrics (MAE/RMSE/accuracy, Brier, interval coverage, holdout baselines)

- **Intent / contract:** Comment run-projection-accuracy.ts:107 (unknown stats left out of MAE/RMSE and interval diagnostics); baseline_definition 'fixed_save_pct_0.900_using_projected_shots_against' (line ~2500)
- **External references:** Brier score and reliability diagrams; nominal 80% interval coverage for p10-p90; MAE/RMSE vs naive baseline
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`; `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`

### FRG-018 FORGE accuracy role buckets (ES line role and PP unit by projected PP TOI)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`

### FRG-019 FORGE projection run preflight gates

- **Intent / contract:** Gate action strings in run-projection-v2.ts:665-690
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/run-projection-v2.test.ts`

### FRG-020 FORGE goalie matchup win-probability normalization

- **Intent / contract:** Comment forge/goalies.ts:173-174 (null win probability stays unknown); response note 'Normalized likely-starter win probabilities ... to total 100%' (line ~547)
- **External references:** Team win probabilities P(home)+P(away)=1; goalie-level win prob = P(start)*P(win\|start)
- **Examples / fixtures / test data:** `web/__tests__/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap`
- **Tests:** `web/__tests__/pages/api/v1/forge/goalies.test.ts`

### FRG-021 Start-chart projected TOI normalization

- **Intent / contract:** Constant MAX_ONE_GAME_SKATER_TOI_SECONDS = 65*60 (start-chart.ts:747)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/start-chart.test.ts`

### FRG-022 FORGE counterfactual PP usage re-allocation

- **Intent / contract:** doc comments web/scripts/forge-counterfactual-backtest.ts:424,434,443-446
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/fixtures/forge-counterfactual-backtest/wgo_pp.json`; `web/scripts/fixtures/forge-counterfactual-backtest/pp_usage.json`
- **Tests:** `web/scripts/forge-counterfactual-backtest.test.ts`

### FRG-023 FORGE skater counterfactual: conversion rates, used-rate clamps, bootstrap blend inversion

- **Intent / contract:** header comment web/scripts/forge-counterfactual-backtest.ts:11-14 ('Offline frozen-cohort backtest of Q7 ... and Q8 ...') and variant doc :24-28
- **External references:** empirical-Bayes rate shrinkage; held-out MAE/RMSE comparison
- **Examples / fixtures / test data:** `web/scripts/fixtures/forge-counterfactual-backtest/ (runs, projections, actuals, games, pp_actuals, pp_usage, wgo_pp, team_strength JSON)`
- **Tests:** `web/scripts/forge-counterfactual-backtest.test.ts`

### FRG-024 Projection source accuracy analysis (client)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MAE; MAPE
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/DraftDashboard/ProjectionSourceAccuracy.test.tsx`

### FRG-025 Served ledger scoring (MAE/bias/RMSE, Mincer-Zarnowitz, Brier, paired RMSE skill)

- **Intent / contract:** servedForecastLedger.ts:394-395 comment
- **External references:** Mincer-Zarnowitz regression; Brier; RMSE skill score
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/servedForecastLedger.test.ts`

### FRG-026 Fantasy points scoring (FORGE defaults and board)

- **Intent / contract:** web/lib/projectionsConfig/fantasyPointsConfig.ts:1-5 docstring
- **External references:** Standard points-league scoring
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/startChartPipeline.test.ts`; `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`

### FRG-027 Projection accuracy score, MAE/RMSE aggregates and interval coverage

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (route); rollingForgePipeline.ts:170-181 stage contract
- **External references:** MAE/RMSE; interval coverage; CRPS would be the proper scoring rule
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`

### FRG-028 Promotion gates and holdout comparison

- **Intent / contract:** skaterRollout.ts:41-55 SKATER_ROLLOUT_GOVERNANCE
- **External references:** Diebold-Mariano style paired tests would be the standard
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/promotionGates.test.ts`

### FRG-029 Skater holdout baselines (current and naive prior)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.alignedConversion.test.ts`; `web/lib/projections/promotionGates.test.ts`

### FRG-030 Probability calibration and goalie launch gates

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Brier score; reliability diagrams
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`

### FRG-031 Skater fantasy-point miss attribution

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Sequential (Shapley-like) error attribution
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`

### FRG-032 FORGE backtest accuracy metrics: MAE/bias/RMSE, paired game-cluster bootstrap, top decile, calibration bins

- **Intent / contract:** doc comment web/scripts/forge-counterfactual-backtest.ts:294 ('Paired cluster bootstrap by game_id')
- **External references:** cluster bootstrap CIs; forecast verification (MAE/RMSE)
- **Examples / fixtures / test data:** `web/scripts/fixtures/forge-reconstruction-backtest/ (actuals.json, hits_blocks.json, recon/a,b,a0,b0 captures)`
- **Tests:** `web/scripts/forge-counterfactual-backtest.test.ts`; `web/scripts/forge-reconstruction-backtest.test.ts`

### FRG-033 FORGE goalie backtest scoring: Brier, log loss, reliability bins, paired win sums, clustered bootstrap

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** proper scoring rules
- **Examples / fixtures / test data:** none found
- **Tests:** `web/scripts/forge-goalie-backtest.test.ts`

### FRG-034 FORGE retained ledger validity checks

- **Intent / contract:** doc comment web/scripts/forge-ledger-evaluate.ts:7-8
- **External references:** naive persistence baselines
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### FRG-035 FORGE skater candidate ablation (fantasy-point head, Mincer-Zarnowitz)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (type comments only)
- **External references:** Mincer-Zarnowitz forecast efficiency regression
- **Examples / fixtures / test data:** none found
- **Tests:** `web/scripts/forge-skater-candidate-ablation.test.ts`

### FRG-036 FORGE v2 issuance: joint-distribution coherence gate and category support

- **Intent / contract:** pipeline.server.ts:272 comment: a broader optional profile must not discard support needed by the issued profile; tasks/tasks-prd-forge-v2-skater-game-forecasts.md (joint-distribution coverage)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/forge-v2/fixtureHarness.server.ts`
- **Tests:** `web/lib/forge-v2/pipeline.test.ts`; `web/lib/forge-v2/lifecycle.test.ts`

### FRG-037 FORGE v2 operational health summary and alarms

- **Intent / contract:** tasks/tasks-prd-forge-v2-skater-game-forecasts.md 13.3: measure due/published counts, latency, source age, missingness, queue/retry, artifact integrity, outcome lag and qualification drift
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/forge-v2/lifecycle.test.ts`

### FRG-038 FORGE v2 qualification gate (serving eligibility of means and participation)

- **Intent / contract:** tasks/tasks-prd-forge-v2-skater-game-forecasts.md: fail-closed qualification/adapter, explicit H1-H10 evaluation rule, task 2.5 frozen protocol
- **External references:** Pre-registered evaluation / holdout discipline
- **Examples / fixtures / test data:** `web/lib/forge-v2/fixtureHarness.server.ts`
- **Tests:** `web/lib/forge-v2/lifecycle.test.ts`; `web/lib/forge-v2/integration.test.ts`; `web/lib/forge-v2/uncertainty.test.ts`

### FRG-039 FORGE v2 refresh cadence and material-event coalescing

- **Intent / contract:** tasks/tasks-prd-forge-v2-skater-game-forecasts.md 5.1 (daily by 8 a.m. America/New_York, T−30 attempt), 5.2 (coalesce at most five minutes), 5.4 (15-minute target from evidence receipt)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/forge-v2/fixtureHarness.server.ts`
- **Tests:** `web/lib/forge-v2/refresh.test.ts`; `web/lib/forge-v2/schedule.test.ts`; `web/lib/forge-v2/lifecycle.test.ts`; `web/lib/forge-v2/history.test.ts`

### FRG-040 Goalie share, save% and GAA by team window

- **Intent / contract:** goalieWorkload.ts:3-4 docstring
- **External references:** NHL sv%/GAA
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GoalieShareChart/GoalieShareChart.test.ts`

### FRG-041 Goalie starter probability (FORGE logit/softmax)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Logistic starter models; Brier
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/goaliePipeline.test.ts`

### FRG-042 Goalie starter-scenario blend and horizon scaling

- **Intent / contract:** stages/goalie-stage.ts:771-772 comment
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-043 Team context adjustments for goalie (team strength, 5v5, NST danger)

- **Intent / contract:** queries/team-context-queries.ts:221-224 comment (nhl_team_data row selection)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/queries/team-context-queries.test.ts`

### FRG-044 Goalie game table (shots against, goals allowed)

- **Intent / contract:** buildGoalieGameV2.ts:74 comment
- **External references:** NHL goalie stats (SA excludes EN)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/derived/buildGoalieGameV2.test.ts`

### FRG-045 Goalie shutout probability

- **Intent / contract:** goalie/goalieOutcomes.ts:34-43 comments
- **External references:** Binomial save model
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/goalie/goalieOutcomes.test.ts`

### FRG-046 Modeled save percentage (beta-binomial) with context shifts

- **Intent / contract:** goalie/goalieOutcomes.ts:14-29 comments (k=6000 fit, B2B/workload fits, pass-through 0.25)
- **External references:** Beta-binomial save% shrinkage (k ~3,000-11,000 shots in literature); GSAx
- **Examples / fixtures / test data:** `web/scripts/forge-goalie-backtest.ts`
- **Tests:** `web/lib/projections/goalieModel.test.ts`; `web/lib/projections/goalie/goalieOutcomes.test.ts`

### FRG-047 Team win probability (Poisson race) and goalie win populations

- **Intent / contract:** goalie/goalieOutcomes.ts:30-49 comments (fits on 2018-19..2024-25)
- **External references:** Poisson/Skellam goal models; de-vigged moneyline
- **Examples / fixtures / test data:** `web/scripts/forge-goalie-backtest.ts`
- **Tests:** `web/lib/projections/goalie/goalieOutcomes.test.ts`; `web/lib/projections/goalieModel.test.ts`

### FRG-048 Season-current league save percentage

- **Intent / contract:** goalie/leagueSavePct.ts:5-7 comment
- **External references:** League sv% (NHL ~0.900-0.905)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/goalie/leagueSavePct.test.ts`

### FRG-049 Goalie profile tiers (volatility, blowup risk, confidence, quality, recommendation)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/goalieModel.test.ts`

### FRG-050 Goalie starter mixtures

- **Intent / contract:** goalieStarterMixtures.ts:166-167 comment (missing mass)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/goalieStarterMixtures.test.ts`

### FRG-051 Goalie workload context

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/goalieModel.test.ts`

### FRG-052 Goalie evidence aggregation

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/goalieModel.test.ts`

### FRG-053 Goalie shots-against projection

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Team shot-suppression models; home/rest effects
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-054 Goalie start projections route (L10 share, GSAA/60)

- **Intent / contract:** update-goalie-projections-v2.ts:356-362 inline comment
- **External references:** Save% above expected (GSAx uses xG)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-goalie-projections-v2.test.ts`

### FRG-055 FORGE goalies API win-probability normalisation

- **Intent / contract:** goalies.ts:173-174 comment
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/__tests__/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap`
- **Tests:** `web/__tests__/pages/api/v1/forge/goalies.test.ts`

### FRG-056 FORGE goalie line backtest: legacy vs new save%/win/shutout model

- **Intent / contract:** header comment web/scripts/forge-goalie-backtest.ts:1-23
- **External references:** Beta-binomial save% shrinkage; Poisson/Skellam win probability
- **Examples / fixtures / test data:** none found
- **Tests:** `web/scripts/forge-goalie-backtest.test.ts`; `web/lib/projections/goalie/goalieOutcomes.test.ts`

### FRG-057 Fantasy-projections season evaluator and settlement

- **Intent / contract:** **UNDOCUMENTED** — settlement.ts:1 FANTASY_PROJECTION_SCORING_VERSION; UNDOCUMENTED formulas
- **External references:** Normal approximation intervals; skill scores
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/fantasy-projections/fantasyProjections.test.ts`; `web/lib/fantasy-projections/scoringSettings.test.ts`

### FRG-058 Served forecast ledger build and settlement

- **Intent / contract:** servedForecastLedger.ts:7 docstring; LEDGER_SCORING_LIMITATIONS
- **External references:** Naive persistence baselines; market-implied means
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/servedForecastLedger.test.ts`; `web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts`; `web/__tests__/pages/api/v1/db/forge-served-forecast-settle.test.ts`

### FRG-059 Native goal accounting (team expected goals)

- **Intent / contract:** nativeGoalAccounting.ts:1 and 168-171 docstrings
- **External references:** Team goal models (full-game incl. EN/OT)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/nativeGoalAccounting.test.ts`

### FRG-060 Native coverage, interval reconciliation and direct conditional count kernels

- **Intent / contract:** nativePlayerCoverageKernel.ts:1 docstring
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/nativePlayerCoverageKernel.test.ts`; `web/lib/projections/nativePlayerCoverage.test.ts`; `web/lib/projections/nativeDirectConditionalCounts.test.ts`; `web/lib/projections/nativeIntervalReconciliation.test.ts`; `web/lib/projections/nativeGoalLedgerAudit.test.ts`; `web/lib/projections/nativeSkaterParticipationResearch.test.ts`

### FRG-061 Game totals and spread market flags

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Sportsbook totals/spread conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/utils/market-output-builders.test.ts`

### FRG-062 Sportsbook de-vig

- **Intent / contract:** utils/devig.ts:1-23 docstring
- **External references:** Shin (1993); standard de-vig methods
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/utils/devig.test.ts`

### FRG-063 Model vs market prop comparison

- **Intent / contract:** utils/market-output-builders.ts:136-142 and 373-384 comments
- **External references:** De-vigged market probability comparison
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/utils/market-output-builders.test.ts`; `web/lib/projections/queries/market-queries.test.ts`

### FRG-064 Start chart opponent defence grade and TOI normalisation

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Percentile rank
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/startChartPipeline.test.ts`

### FRG-065 On-ice context adjustment

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST on-ice per-60 convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-066 Team-level skater context adjustment

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Opponent-adjusted rates (log5 / multiplicative att x def models)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/queries/team-context-queries.test.ts`

### FRG-067 Opponent goalie quality adjustment for skaters

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** GSAx (xG-based) per 60
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-068 Skater rest / schedule adjustment

- **Intent / contract:** calculators/skater-adjustments.ts:358 and 377-380 comments; skater-stage.ts:1944 'Q8 tiers remain unqualified'
- **External references:** Published B2B effects (~-0.1 to -0.2 goals/team-game)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-069 Small-sample shrinkage weight

- **Intent / contract:** stages/skater-stage.ts:2289-2293 comment (task 4 / task 9)
- **External references:** Tango regression to the mean (k = exposure where reliability = 0.5)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/reserveProjections.test.ts`

### FRG-070 Hits and blocks per 60 (physical rates)

- **Intent / contract:** constants/projection-weights.ts:87-109 comments (fit by Poisson deviance on games 2-30)
- **External references:** Marcel-style weighting; Poisson deviance fit (code comment)
- **Examples / fixtures / test data:** `web/scripts/fixtures/forge-counterfactual-backtest/`; `web/scripts/fixtures/forge-reconstruction-backtest/`
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-071 Assist share and team assist allocation

- **Intent / contract:** stages/skater-stage.ts:2749-2751 and skater-adjustments.ts:580 comments
- **External references:** IPP / on-ice point shares; NHL ~1.7 assists per goal
- **Examples / fixtures / test data:** `tasks/artifacts/forge-priors-2026-10-22`
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-072 Skater shot rate per 60 (shrunk)

- **Intent / contract:** constants/projection-weights.ts:121-122 comment; tasks/artifacts/forge-priors-2026-10-22
- **External references:** Tango regression to mean; NST per-60 convention
- **Examples / fixtures / test data:** `tasks/artifacts/forge-priors-2026-10-22`
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-073 Goal conversion (goals per shot) by strength

- **Intent / contract:** calculators/skater-adjustments.ts:647 docstring; constants/projection-weights.ts:121
- **External references:** Tango regression to mean; shooting% reliability (~375-400 shots for forwards)
- **Examples / fixtures / test data:** `tasks/artifacts/forge-priors-2026-10-22`; `web/scripts/fixtures/forge-counterfactual-backtest/`; `web/scripts/fixtures/forge-reconstruction-backtest/`
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/runProjectionV2.alignedConversion.test.ts`

### FRG-074 Shot-quality adjustment

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** MoneyPuck/Evolving-Hockey ixG per shot
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/queries/skater-queries.test.ts`

### FRG-075 Research goal kernels and skater-candidate accounting (offline)

- **Intent / contract:** accounting.ts:1 'Offline candidates only'; context.ts:1
- **External references:** Empirical Bayes; split-half reliability
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/researchGameGoals.test.ts`; `web/lib/projections/researchGoalBaseline.test.ts`; `web/lib/projections/research/skater-candidates/priors.test.ts`; `web/lib/projections/research/skater-candidates/accounting.test.ts`; `web/lib/projections/research/skater-candidates/context.test.ts`

### FRG-076 Availability multiplier from roster events

- **Intent / contract:** stages/skater-stage.ts:2333-2334 comment
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/rosterEvents.test.ts`; `web/lib/projections/runProjectionV2.test.ts`

### FRG-077 Teammate assist coupling

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-078 Skater role scenarios and horizon scenario blend

- **Intent / contract:** skaterRollout.ts:41 SKATER_ROLLOUT_GOVERNANCE acceptance criteria
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/skaterRollout.test.ts`

### FRG-079 Skater recency multiplier and active-pool filter

- **Intent / contract:** utils/season-recency.ts:12 comment
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/utils/season-recency.test.ts`

### FRG-080 Sustainability trend-band adjustment

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/utils/trend-adjustments.test.ts`

### FRG-081 Player and team game strength tables

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL boxscore counting
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/derived/buildStrengthTablesV2.test.ts`

### FRG-082 Strength-state classification and shift strength TOI

- **Intent / contract:** derived/situation.ts:27-37 docstring
- **External references:** NHL official strength conventions; NST strength splits
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/derived/situation.test.ts`; `web/lib/projections/ingest/shifts.test.ts`

### FRG-083 Team-to-player reconciliation (TOI and shots)

- **Intent / contract:** stages/skater-stage.ts:2457 comment 'Task 3.6 reconciliation: hard constraints'
- **External references:** Top-down team-total constraints
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/reconcile.test.ts`; `web/lib/projections/runProjectionV2.test.ts`

### FRG-084 Role-specific usage bounds

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-085 Team PP share and PP TOI allocation

- **Intent / contract:** stages/skater-stage.ts:1233-1237 docstring
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/queries/team-context-queries.test.ts`

### FRG-086 Team TOI target with undersized-pool guard

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-087 WGO TOI normalization and deployment-prior TOI blend

- **Intent / contract:** stages/skater-stage.ts:338 comment: WGO TOI/game fields are typically in minutes
- **External references:** NST/WGO per-game TOI conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-088 Line-combination recency, role tags and fallback ranking

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-089 Role continuity and stability multiplier

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/runProjectionV2.test.ts`

### FRG-090 Count distribution helpers and fitted dispersion

- **Intent / contract:** dispersion.ts:1-30 docstring (fit method, data, holdout)
- **External references:** Negative binomial NB2/NB1; log score, RPS, PIT (holdout described in comment)
- **Examples / fixtures / test data:** `web/scripts/fit-forge-dispersion.ts`
- **Tests:** `web/lib/projections/dispersion.test.ts`; `web/lib/projections/uncertainty.test.ts`

### FRG-091 Player uncertainty Monte Carlo (p10/p50/p90)

- **Intent / contract:** uncertainty.ts:11-23 UNCERTAINTY_CONFIG comments
- **External references:** NB2 count models; predictive intervals
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/uncertainty.test.ts`

### FRG-092 Team uncertainty Monte Carlo

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Poisson team goal models
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/uncertainty.test.ts`

### FRG-093 Goalie uncertainty Monte Carlo

- **Intent / contract:** uncertainty.ts:579-590, 712-722 comments
- **External references:** Binomial GA\|SA; NB shots
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/uncertainty.test.ts`

### FRG-094 FORGE count dispersion fit (NB2 method of moments) and holdout scoring

- **Intent / contract:** header comment web/scripts/fit-forge-dispersion.ts:1-24 (tasks 8.1/8.2)
- **External references:** negative binomial (NB2) overdispersion; RPS and PIT for count forecasts
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/dispersion.test.ts`

### FRG-095 FORGE v2 evaluation scoring (CRPS, log score, interval score, block bootstrap)

- **Intent / contract:** horizonEvaluation.ts:5 version; evaluation.ts
- **External references:** CRPS (Gneiting & Raftery 2007); interval score; Brier; block bootstrap
- **Examples / fixtures / test data:** `web/lib/forge-v2/horizonEvaluation.fixtures.ts`
- **Tests:** `web/lib/forge-v2/horizonEvaluation.test.ts`; `web/lib/forge-v2/evaluation.test.ts`

### FRG-096 FORGE v2 kernel-means model and participation

- **Intent / contract:** model.ts:5 MODEL_ALGORITHM; contracts.ts
- **External references:** Nadaraya-Watson kernel regression; histogram calibration
- **Examples / fixtures / test data:** `web/lib/forge-v2/fixtures.ts`
- **Tests:** `web/lib/forge-v2/model.test.ts`; `web/lib/forge-v2/lifecycle.test.ts`

### FRG-097 FORGE v2 research baselines (half-life pooled rates)

- **Intent / contract:** researchBaselines.ts:5,23 comments
- **External references:** Marcel-style decay; empirical Bayes pooling
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### FRG-098 FORGE v2 joint distribution and interval calibration

- **Intent / contract:** uncertainty.ts:7-10 version constants
- **External references:** Split conformal prediction
- **Examples / fixtures / test data:** `web/lib/forge-v2/fixtures.ts`
- **Tests:** `web/lib/forge-v2/uncertainty.test.ts`

## Player forecasts (season) (PFC)

### PFC-001 fn build_player_forecast_runtime_features

- **Intent / contract:** supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:186 COMMENT 'Builds cutoff-safe historical-core skater features, including team and opponent context'
- **External references:** Marcel-style weighting; EWMA
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/playerForecasts.test.ts`; `supabase/tests/data_api_grants.sql`

### PFC-002 Player forecast validation inference context (rest days, home indicator)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-003 Fantasy projections page confidence tiers and stale/conflict badges

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/fantasy-projections.test.tsx`

### PFC-004 Season fantasy projection settlement scoring (model vs published)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in script
- **External references:** interval coverage / pinball loss; Brier for probabilities
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/fantasy-projections/fantasyProjections.test.ts`

### PFC-005 Fantasy performance predictor (RF/GBM/XGB/linear) with league scoring

- **Intent / contract:** module docstring web/scripts/performance_prediction.py:2-13
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-006 Advanced skater/team observations (individual attempts, distance danger bands, rush, rebound, ixG, pace)

- **Intent / contract:** DANGER_TAXONOMY_VERSION 'player-forecasts-v5-distance-bands-v1' (advanced.py:74); docs/player-projections/research-contract-v5-season-advanced.json
- **External references:** NST high-danger (slot/home-plate zones), NHL EDGE shot-location bands; MoneyPuck/Evolving-Hockey ixG
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-007 Advanced goalie danger-band shots/goals against, xGA and GSAx

- **Intent / contract:** docs/player-projections/research-contract-v5-season-advanced.json
- **External references:** MoneyPuck/Evolving-Hockey GSAx; NST HDSV%
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-008 Advanced EDGE context selection

- **Intent / contract:** advanced.py:870 'coefficient remains zero until chronological validation demonstrates lift'
- **External references:** NHL EDGE
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-009 On-ice shot attempts, unblocked attempts and xG for/against (SQL)

- **Intent / contract:** docs/player-projections/research-contract-v5-season-advanced.json (targets)
- **External references:** NST/Evolving-Hockey on-ice CF/FF/xGF (normally 5v5 or all-situations with shift-change handling)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-010 Deterministic Gaussian copula simulation for season quantiles

- **Intent / contract:** provenance simulation 'deterministic_reconciled_gaussian_copula_v2', withinPlayerTargetCorrelation 0.65 (advanced.py project_advanced_release)
- **External references:** Gaussian copula with estimated correlation matrix
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-011 Advanced per-game mean/variance and team season totals

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-012 Advanced EB rate policy with chronological split and conformal residual

- **Intent / contract:** calibrationMethod 'chronological_randomized_conformal_absolute_residual_v1'; evidencePolicy advanced.py:1424
- **External references:** Tango regression to mean; split conformal
- **Examples / fixtures / test data:** `generated (not in repo): <advanced artifact dir>/season-artifact.json goldenVectors built at modeling/player_forecasts/advanced.py:1443`
- **Tests:** none found

### PFC-013 Expected assists proxied by actual-assist projections

- **Intent / contract:** fallbackReason 'shot_assist_candidate_game_coverage_below_0.80' (advanced.py _v4_assist_policy)
- **External references:** xA / shot-assist xG (Evolving-Hockey, HockeyViz)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-014 Season / rest-of-season aggregation and current-view actuals

- **Intent / contract:** view semantics opening/current/ros: docs/player-projections/player-forecasts-runbook.md (:454) and docs/player-projections/research-contract-v4-season-fantasy.json releaseSemantics; aggregation.py aggregationMethod 'independent_game_moments_normal_approximation'
- **External references:** sum of independent game moments; talent-uncertainty correlation (Marcel reliability)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`; `web/lib/fantasy-projections/fantasyProjections.test.ts`

### PFC-015 Contextual EB profile: age curve, back-to-back and home/away multipliers

- **Intent / contract:** season.py:1750 comment (do not clip sparse ratios, preserve mean-one identity); docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Context' (:67)
- **External references:** Hockey aging curves (delta method; scoring peak ~24-27, decline after ~28-30); Marcel age adjustment
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-016 Future age multiplier (season aging adjustment)

- **Intent / contract:** docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Context' (:67)
- **External references:** Marcel age factor; standard hockey aging curves
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-017 Current-appearance skater rate (current-season-only decayed mean)

- **Intent / contract:** baselineRates.ts:230 'Explicit current-season-only mean'; tasks/prd-forge-daily-pipeline.md (v2 fresh native means)
- **External references:** Marcel / Tango regression to the mean (absent here); EWMA recency weighting
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/contributions.test.ts`; `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts`

### PFC-018 Prior-appearance skater rates (previous-season arithmetic means + mean TOI)

- **Intent / contract:** baselineRates.ts:202 'Native prior-only extension... every retained opportunity must carry positive original minutes'
- **External references:** Marcel prior season weighting; NHL TOI per game
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/contributions.test.ts`; `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts`

### PFC-019 Legacy skater baseline per-appearance rate (projection consensus + prior season prior, decayed recent form)

- **Intent / contract:** baselineRates.ts:89 'A pure, cutoff-safe candidate'; baselinePolicy.ts:21 'Candidate ingredients are independent of dashboard selection'; baselinePolicy.ts:73 definition pinned by hash
- **External references:** Marcel projections (weighted seasons + regression to mean); Tango regression to the mean with k pseudo-games
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/contributions.test.ts`; `web/lib/player-forecasts/nativeBaselinePublication.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`

### PFC-020 Projection row normalization (goalie SA = SV + GA)

- **Intent / contract:** baselinePolicy.ts:39 'These legacy schemas were checked against hosted metadata; absent columns stay unsupported.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/goalieBaseline.test.ts`

### PFC-021 Boxscore target extraction and TOI parsing

- **Intent / contract:** baselineSourceLineage.ts:293 'Missing raw components remain missing; percentage fields cannot reconstruct counts.'
- **External references:** NHL API boxscore field conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/player-forecasts/nativeGoalieOutcomes.test.ts`; `web/lib/player-forecasts/playerForecasts.test.ts`

### PFC-022 Current-season SOG appearance mean (VAN canary)

- **Intent / contract:** currentSeasonSogBaseline.ts:96 'Offline assembly only: no fetch, database, projections, prior season or public admission.'
- **External references:** Tango regression to the mean for shot rates
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/currentSeasonSogBaseline.test.ts`; `web/lib/player-forecasts/currentSeasonSogContribution.test.ts`

### PFC-023 Native daily means capture planning (lookback windows and bounds)

- **Intent / contract:** nativeDailyMeansCapture.ts:1 'FORGE v2 daily means stage... an unknown never becomes zero'; tasks/prd-forge-daily-pipeline.md
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/player-forecasts/yahooUniverse.fixtures.ts`
- **Tests:** `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts`

### PFC-024 Native power-play points per game (landing scoring summary)

- **Intent / contract:** nativePowerPlayPoints.ts:20 'Historical observed counts only. Never guesses strength from manpower, fills missing summaries with zero'
- **External references:** NHL official PPP definition (goal scored with team on power play)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/nativePowerPlayPoints.test.ts`; `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts`

### PFC-025 Daily-board opponent/home/player-residual ridge context model

- **Intent / contract:** daily_board_context.py:1 docstring and POLICY (:24)
- **External references:** ridge regression on residuals; opponent-adjusted rates
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-026 Starter Board daily run (FORGE forecast export, candidate capture, baseline issuance, settlement)

- **Intent / contract:** daily_board_daily.py:1 docstring; docs/start-chart/launch-validation.md
- **External references:** none suggested
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-027 Daily-board history normalization and strength accounting audit

- **Intent / contract:** daily_board_data.py:93 docstring and :165 comment; docs/start-chart/launch-validation.md (:170)
- **External references:** NHL shift-chart strength TOI
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-028 Goalie start probability temperature scaling

- **Intent / contract:** daily_board_goalies.py:1 docstring and :25
- **External references:** temperature scaling (Guo et al. 2017)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-029 Daily-board historical baselines (season rate, recent blend, role-aware, empirical Bayes)

- **Intent / contract:** daily_board_models.py:23 docstring (2-day lag, no same-day outcomes); daily_board_baseline_issuance.py:1
- **External references:** per-60 rate x projected TOI; Tango regression with exposure prior
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-030 Participation logistic regression

- **Intent / contract:** daily_board_models.py:100 docstring (labels require complete candidate list)
- **External references:** L2-regularized logistic regression
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-031 Joint game scenario simulator (Poisson shot process, goal odds, assists, OT/shootout)

- **Intent / contract:** daily_board_scenarios.py:1 docstring; docs/start-chart/launch-validation.md (:300)
- **External references:** Poisson/odds-ratio goal models; shot-based game simulators (e.g. MoneyPuck/HockeyViz)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-032 Daily-board official settlement normalization

- **Intent / contract:** daily_board_settlement.py:1 and :128 docstrings
- **External references:** NHL official stats
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-033 Daily-board strength-split baselines (EV/PP/PK usage x rate)

- **Intent / contract:** daily_board_strength.py:1 docstring; docs/start-chart/launch-validation.md (:207)
- **External references:** NST per-60 by strength x projected TOI
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-034 Baseline policy grid selection (recent weight, prior minutes)

- **Intent / contract:** daily_board_training.py:40 comment ('Fixed small grid; no repeated search')
- **External references:** none suggested
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-035 Deployment evidence weights and injury/scratch availability multiplier

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (constants uncommented); docs/player-projections/player-forecasts-runbook.md 'Roster and transaction integrity' (:672)
- **External references:** none suggested
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-036 Deployment role heuristics (lines, pairs, PP/PK units, teammate quality)

- **Intent / contract:** selectionStatus text season.py:3712 ('line_continuity_and_peer_quality_retained_as_prospective_context')
- **External references:** none suggested
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`; `generated (not in repo): <season artifact dir>/season-artifact.json goldenVectors built at modeling/player_forecasts/season.py:3850`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-037 Forecast-diagnostics team goal mean alignment (FORGE vs team model)

- **Intent / contract:** forecast-diagnostics/contract.ts:159 'Alignment is an accounting/lineage check, not predictive validation.'
- **External references:** Team goal expectation (Poisson team scoring models)
- **Examples / fixtures / test data:** `web/lib/forecast-diagnostics/fixtures.ts`
- **Tests:** `web/lib/forecast-diagnostics/contract.test.ts`

### PFC-038 Historical qualification cohort classification (early-season target)

- **Intent / contract:** historicalQualification.ts:121 'One row per paired game, including failures and unknown early-season eligibility. No outcomes are consumed.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/forecast-diagnostics/historicalQualification.test.ts`

### PFC-039 Empirical team goals baseline (own GF/gm and opponent GA/gm)

- **Intent / contract:** pairedInputs.ts:80 'Independent, unfitted baseline. No win probability, FORGE input, or fallback prior.'
- **External references:** Poisson team goal models (Dixon-Coles / attack-defense ratings) with league-mean regression and home advantage
- **Examples / fixtures / test data:** `web/lib/forecast-diagnostics/fixtures.ts`
- **Tests:** `web/lib/projections/researchGoalBaseline.test.ts`; `web/lib/projections/researchGameGoals.test.ts`; `web/lib/forecast-diagnostics/frozenResearchPair.test.ts`

### PFC-040 Forecast candles and accountability candles (OHLC of revisions/skill)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/seed-player-forecast-fixtures.ts`
- **Tests:** `web/lib/player-forecasts/playerForecasts.test.ts`

### PFC-041 Prospective point and probability evaluation (MAE, bias, Brier, paired baseline)

- **Intent / contract:** evaluation.ts:50 'Research holdout stays excluded'; evaluation.ts:209 'Read retained issued forecasts and final outcomes for local evidence reporting. Never publishes or promotes.'
- **External references:** Standard MAE/RMSE, Brier score, Murphy decomposition/calibration curves
- **Examples / fixtures / test data:** `web/scripts/seed-player-forecast-fixtures.ts`
- **Tests:** `web/lib/player-forecasts/evaluation.test.ts`

### PFC-042 Game forecast contract consistency checks

- **Intent / contract:** gameContract.ts:243 'Every unsupported mean is null with a reason; a supported zero is not missing data.'; :247 'Unconditional means must integrate game occurrence and declared participation exactly once.'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/player-forecasts/gameContract.fixtures.ts`
- **Tests:** `web/lib/player-forecasts/gameContract.test.ts`

### PFC-043 Market implied mean from de-vigged props and moneyline team win

- **Intent / contract:** servedForecastLedger.ts:192 'Mean whose P(over \| no push) at line equals the market's, under the same distribution the model is scored with.'; :167 migration 99 note
- **External references:** Sportsbook de-vig (multiplicative/power/Shin); Poisson/negative-binomial prop pricing
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/servedForecastLedger.test.ts`

### PFC-044 Ledger scoring: MAE/bias/RMSE, Mincer-Zarnowitz, reliability bins, FP deciles, coverage

- **Intent / contract:** servedForecastLedger.ts:394 'Per-source errors use each source's own observed sample, not a paired model comparison. Coverage requires an independently captured and settled universe'
- **External references:** Mincer-Zarnowitz forecast efficiency regression; Brier reliability diagrams; standard MAE/RMSE
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/servedForecastLedger.test.ts`

### PFC-045 Paired ledger comparison (RMSE skill) and market probability scoring (Brier skill, log loss)

- **Intent / contract:** servedForecastLedger.ts:469 'Pairwise comparisons, never intersections of unrelated source-level averages'; :526 'Model versus market in probability space on the same settled events'
- **External references:** Skill scores (1 - MSE/MSE_ref), Brier skill score vs market benchmark
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/servedForecastLedger.test.ts`

### PFC-046 Served-forecast ledger naive controls (last-N and season means, goalie start share)

- **Intent / contract:** servedForecastLedger.ts:8 'what the RSO was shown per player-game, beside naive controls'; tasks/prd-forge-accountability-table.md
- **External references:** Persistence / climatology baselines in forecast verification
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/servedForecastLedger.test.ts`; `web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts`

### PFC-047 Release evaluation gates (v4 fantasy batch and v5 advanced batch)

- **Intent / contract:** promotionPolicy 'Prospective 2026-27 evidence remains required' (advanced.py evaluate_advanced_batch); docs/player-projections/research-contract-v4-season-fantasy.json acceptance
- **External references:** none suggested
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-048 Horizon residual quantile calibration

- **Intent / contract:** docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Horizon uncertainty' (:96)
- **External references:** empirical residual (split-conformal style) intervals
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-049 Paired loss bootstrap (game/slate clusters)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in code; docs/start-chart/launch-validation.md
- **External references:** cluster bootstrap; Diebold-Mariano style paired comparison
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-050 Daily-board evaluation metrics (MAE, RMSE, bias, Brier, log loss, calibration bins, CRPS, interval score)

- **Intent / contract:** daily_board.py:1 docstring; docs/start-chart/daily-board-contract-v1.json
- **External references:** Gneiting and Raftery (2007) CRPS and interval score; Brier; reliability diagrams
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-051 Horizon vintages (issue-time reconstruction)

- **Intent / contract:** scheduleSemantics 'final_schedule_reconstructed_validation'; docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Horizon uncertainty' (:96)
- **External references:** none suggested
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-052 Paired slate bootstrap and lockbox promotion gates

- **Intent / contract:** docs/player-projections/lockbox-evidence-2025-26.md; docs/player-projections/development-evidence-2025-26.md
- **External references:** block (cluster) bootstrap by slate
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-053 Range evaluation MAE/RMSE and skill score

- **Intent / contract:** docs/player-projections/lockbox-evidence-2025-26.md
- **External references:** MSE skill score (1 - model/baseline)
- **Examples / fixtures / test data:** none found
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-054 Rolling-origin randomized conformal 80% interval calibration

- **Intent / contract:** calibrationMethod 'rolling_origin_randomized_conformal_p10_p90'; docs/player-projections/research-contract-v4-season-fantasy.json evaluation acceptance
- **External references:** split conformal prediction (absolute standardized residual)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-055 Season settlement finality rule

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (48 h)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-056 Fantasy metric source eligibility coverage gate

- **Intent / contract:** season.py:82 FANTASY_SOURCE_ELIGIBILITY_POLICY text (availabilityScope/fallback); docs/player-projections/research-contract-v4-season-fantasy.json
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-057 Validation challenger features (HistoricalSeries, team/opponent position rates, play-driver assists)

- **Intent / contract:** docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Assist decomposition decision' (:62)
- **External references:** opponent-adjusted rates (NST 'against' splits); primary-assist weighting (A1 more repeatable than A2)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-058 Historical-core feature engineering (career, season, last-N, EWMA, EB, opportunity-adjusted)

- **Intent / contract:** features.py:50 comment on goalie exclusion; docs/player-projections/development-evidence-2025-26.md
- **External references:** Marcel weighting; EWMA smoothing; Tango regression
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-059 On-ice chances/goals against per player-game (defense history SQL)

- **Intent / contract:** season.py:3900 limitation text: 'regularized on-ice shot-attempt and goal suppression adjusted for team and opponent'
- **External references:** NST/Evolving-Hockey on-ice CA/GA (usually 5v5 only, score-and-venue adjusted)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-060 Rest-day / back-to-back derivation

- **Intent / contract:** **UNDOCUMENTED** — season.py:4121 comment on context; UNDOCUMENTED definition of rest days
- **External references:** NHL schedule-rest convention (B2B = consecutive calendar days, local date)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-061 Native baseline cadence (08:00 NY / T-15 publication slots)

- **Intent / contract:** nativeBaselineCadence.ts:49 'Native publication stage for one explicit 08:00-NY or T-15 decision... No legacy detailed worker or scheduler is invoked by this adapter.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/nativeBaselinePublication.test.ts`

### PFC-062 Native baseline publication validation (bounded plan admission)

- **Intent / contract:** nativeBaselinePublication.ts:39 'Existing admission contracts run over exact local rows'; :112 'No automatic activation or retries. Reconcile uncertain writes only by exact ID readback.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/nativeBaselinePublication.test.ts`

### PFC-063 Native cadence output preparation (re-issuance of means and participation bundles)

- **Intent / contract:** nativeCadenceOutputPreparation.ts:18 'Offline issuance of later same-method outputs from one closed materialization. It reproduces the reviewed plan's means, identities, expiries and nulls exactly; only issuance changes.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/nativeDailyPipelineV2.test.ts`; `web/lib/player-forecasts/nativeBaselinePublication.test.ts`

### PFC-064 FORGE daily v1 composition: schedule bindings and daily issuance expiry

- **Intent / contract:** nativeDailyPipeline.ts:14 'v1 daily FORGE run: frozen native means and frozen participation history, re-bound to fresh official club rosters and a fresh schedule.'; tasks/prd-forge-daily-pipeline.md
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/player-forecasts/yahooUniverse.fixtures.ts`
- **Tests:** `web/lib/player-forecasts/nativeDailyPipeline.test.ts`

### PFC-065 FORGE daily v2 composition gates (method switch, universe, means coverage, null participation)

- **Intent / contract:** nativeDailyPipelineV2.ts:1 'FORGE v2 daily composition... Everything still awaiting TJ sits behind NativeDailyV2Flags, all off by default.'; tasks/prd-forge-daily-pipeline.md
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/player-forecasts/yahooUniverse.fixtures.ts`
- **Tests:** `web/lib/player-forecasts/nativeDailyPipelineV2.test.ts`

### PFC-066 Native input materialization (bounded immutable input packing and manifest)

- **Intent / contract:** nativeInputMaterialization.ts:66 'Pure producer over an explicit acquisition packet. No collection or public-use grant.'; :283 'Reproduce from durable originals and standalone inputs, rather than trusting counts.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/nativeDailyPipelineV2.test.ts`; `web/lib/player-forecasts/nativeBaselinePublication.test.ts`; `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts`

### PFC-067 Native goalie win rate per appearance (boxscore decision)

- **Intent / contract:** goalieBaselineRates.ts:183 'Explicit native mean of observed win credits, including relief appearances. Never a start probability.'
- **External references:** Team win probability models (Elo/xG); goalie wins largely team-driven
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/player-forecasts/nativeGoalieOutcomes.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`

### PFC-068 Native goalie volume rates (SV, GA, SA, minutes per appearance)

- **Intent / contract:** goalieBaselineRates.ts:223 'Joint appearance population preserves SA=SV+GA and minutes without requiring a prior or any future probability.'
- **External references:** Goalie SV% regression to league mean (~.900-.905) with large k (e.g., ~3000 shots)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`

### PFC-069 Native goalie summary-credited W and SO rates

- **Intent / contract:** goalieBaselineRates.ts:258 'a missing boxscore decision is never interpreted as zero'; goalieBaselineRates.ts:286 'Credited SO means over the same positive-minute appearance population, including relief.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/player-forecasts/nativeGoalieOutcomes.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`

### PFC-070 Legacy goalie baseline rates (per-appearance volume, per-start W/SO)

- **Intent / contract:** goalieBaselineRates.ts:77 'Volume rates use appearances; outcome counts use starts only when projected starts are explicit.'
- **External references:** Marcel/Tango regression; goalie SV% regression (high-variance stat)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`

### PFC-071 Goalie starter label from boxscore

- **Intent / contract:** nativeGoalieOutcomes.ts:183 'Original explicit starter flag; zero-minute listed nonstarters are valid labels. Missing players/flags are unknown'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/nativeGoalieOutcomes.test.ts`; `web/lib/player-forecasts/rollingParticipationFrame.test.ts`

### PFC-072 Goalie start-basis compatibility and modeled start metadata mass check

- **Intent / contract:** resolvedPlanningForecast.ts:18 'Rebuild every displayed value and timestamp from the same selected target inputs'; :98 'Conflicting start metadata is withheld without reweighting'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`; `web/lib/player-forecasts/planningContributions.test.ts`

### PFC-073 Challenger/inference serving (validation shadow worker)

- **Intent / contract:** modeling/player_forecasts/challenger_inference.py (validationOnly); functions/lib/player_forecasts/inference.py:9 docstring; docs/player-projections/player-forecasts-runbook.md 'Contract-only smoke test' (:172)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/seed-player-forecast-fixtures.ts`; `functions/tests/test_player_forecast_inference.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`; `functions/tests/test_player_forecast_inference.py`

### PFC-074 Per-game target multiplier (pace, opponent defense, venue, rest, home/away)

- **Intent / contract:** season.py:4121 comment (pace changes opportunity, not TOI)
- **External references:** log5/odds-ratio opponent adjustment; multiplicative team-strength models
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`; `generated (not in repo): <season artifact dir>/season-artifact.json goldenVectors built at modeling/player_forecasts/season.py:3850`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-075 Per-game evaluation: unconditional mean and mixture variance

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in code; docs/player-projections/research-contract-v4-season-fantasy.json releaseSemantics
- **External references:** law of total variance for zero-inflated mixtures
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`; `generated (not in repo): <season artifact dir>/season-artifact.json goldenVectors built at modeling/player_forecasts/season.py:3850`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-076 Challenger freeze assist labels from legacy pbp_plays

- **Intent / contract:** docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Source audit' (:23)
- **External references:** NHL official scoring
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-077 Season skater game-label construction (TOI split, assists, strength splits)

- **Intent / contract:** Assist label policy and source precedence: docs/player-projections/research-contract-v3-season.json / docs/player-projections/research-contract-v4-season-fantasy.json; docs/player-projections/player-forecasts-runbook.md '2026–27 season projection workflow' (:454)
- **External references:** NHL official boxscore/Gamecenter definitions; NST per-strength TOI convention (EV=5v5+4v4+3v3)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`; `generated (not in repo): <season artifact dir>/season-artifact.json goldenVectors built at modeling/player_forecasts/season.py:3850`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-078 Season-total exposure labels and identity audit

- **Intent / contract:** docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Repaired model path' (:42) - season totals as exposure-model outcomes
- **External references:** NHL.com/WGO season summary definitions
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-079 Season goalie game labels (starter, decisions, shutout, quality start)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (QS rule not explained in code; see docs/player-projections/research-contract-v4-season-fantasy.json targets)
- **External references:** NHL decision rules (win/loss credited to goalie in net for the deciding goal, not the max-TOI goalie); Vollman quality start (SV% >= league average ~.913, or >= .885 with <=20 shots)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-080 Assist label audit and official Gamecenter correction

- **Intent / contract:** WGO used only as settled outcome labels, never predictive (season.py review wgoSettledOutcomeLabelsUsed); docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Audited evidence' (:25)
- **External references:** NHL official scoring summary
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-081 Frozen-window and roster-observation participation variants (Sep 29 - Oct 13 frame)

- **Intent / contract:** modeledSkaterParticipation.ts:171 'Explicit frozen-history baseline; actual capture/cutoff clocks are never backdated.'; tasks/prd-forge-daily-pipeline.md (frozen Sep 29-Oct 12 window)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/modeledSkaterParticipation.test.ts`; `web/lib/player-forecasts/modeledGoalieParticipation.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`

### PFC-082 Skater participation frequency (eligible-opportunity appearance rate)

- **Intent / contract:** modeledSkaterParticipation.ts:44 'Pure finite baseline. Source authenticity/completeness must be reviewed before release.'
- **External references:** Beta-binomial / Laplace smoothing for availability rates; injury-aware lineup models
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/modeledSkaterParticipation.test.ts`; `web/lib/player-forecasts/modeledSkaterParticipationStore.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`

### PFC-083 Native participation frame accounting (P/Z/O/K/U dispositions)

- **Intent / contract:** nativeParticipationFrame.ts:80 'Pure historical frame accounting. No probabilities, acquisition, fitting or issuance.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/nativeParticipationFrame.test.ts`

### PFC-084 Rolling 14-day participation (skater/goalie appearance and goalie start frequency)

- **Intent / contract:** rollingWindowParticipation.ts:10 'Approved v2 participation (TJ 2026-10-17)... over the 14 America/New_York calendar days before the cutoff's local date'
- **External references:** Goalie start probability models (rest days, back-to-backs, starter share), Beta-binomial smoothing
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/rollingWindowParticipation.test.ts`; `web/lib/player-forecasts/rollingParticipationFrame.test.ts`; `web/lib/player-forecasts/nativeDailyPipelineV2.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`

### PFC-085 Lineup/goalie text classification and lineup completeness

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/playerForecasts.test.ts`; `web/__tests__/pages/api/v1/db/update-line-sources.test.ts`

### PFC-086 PP evidence packet consistency checks

- **Intent / contract:** pp_evidence_capture.py:1 docstring; docs/player-projections/forge-pp-shot-evidence-packet.md
- **External references:** none suggested
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-087 PP shot-rate exposure shrinkage ablation

- **Intent / contract:** pp_shot_support.py:27 PROTOCOL hypothesis; docs/player-projections/forge-pp-shot-support.md
- **External references:** Tango regression with exposure-based reliability (n/(n+k))
- **Examples / fixtures / test data:** `modeling/player_forecasts/pp_shot_support.py:110 (engineering_fixtures, fictional cases)`; `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-088 Adjusted defense rating (on-ice suppression goal-equivalents per 60)

- **Intent / contract:** season.py:3900 limitation text
- **External references:** Evolving-Hockey RAPM / xGA-based defensive ratings; NST on-ice CA/60 relative
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-089 Player rating signals and percentiles (offense, defense, goaltending)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (ratings contract in docs/player-projections/research-contract-v3-season.json)
- **External references:** mid-rank percentile convention
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-090 Derived-stat reconciliation (_reconcile)

- **Intent / contract:** artifact review strengthReconciliation text (season.py:3837); docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Strength-state reconciliation' (:76)
- **External references:** NHL stat definitions; NST CF%/FF%/xGF%
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-091 Normal-approximation quantiles and ratio-interval reconciliation

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-092 Season projection draft validation gates

- **Intent / contract:** **UNDOCUMENTED** — validation.ts:57 message: the runtime must match an approved season research contract; schedule/roster rules are UNDOCUMENTED beyond messages
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/fantasy-projections/fantasyProjections.test.ts`
- **Tests:** `web/lib/fantasy-projections/fantasyProjections.test.ts`

### PFC-093 Game expectations: horizon totals, expected appearances/starts, SV% and GAA ratios

- **Intent / contract:** gameExpectations.ts:137 'A view of admitted shared inputs; this function never issues, releases or generates a forecast.'; limitations gameExpectations.ts:229
- **External references:** NHL GAA = GA*60/TOI minutes; SV% = SV/SA
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/gameExpectations.test.ts`; `web/__tests__/pages/start-chart.test.tsx`; `web/__tests__/pages/api/v1/start-chart.test.ts`; `web/__tests__/pages/forge/forecasts.test.tsx`; `web/__tests__/pages/api/v1/forge/forecasts.test.ts`

### PFC-094 Rest-of-season aggregation (normal approximation with participation mixture)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (only distributionKind label 'independent_game_moments_normal_approximation', restOfSeason.ts:76)
- **External references:** Poisson / negative-binomial count totals; law of total variance
- **Examples / fixtures / test data:** `web/scripts/seed-player-forecast-fixtures.ts`
- **Tests:** `web/lib/player-forecasts/playerForecasts.test.ts`

### PFC-095 Rookie roster logistic offsets (age, draft, trajectory, PPG)

- **Intent / contract:** docs/player-projections/research-contract-v4-season-fantasy.json rookieModel
- **External references:** logistic regression with offset; prospect models (e.g. Hockey Prospecting NHLe + age)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-096 Rookie league-transition model (NHLe-style equivalency and roster probability)

- **Intent / contract:** docs/player-projections/research-contract-v4-season-fantasy.json rookieModel
- **External references:** NHLe (Desjardins 2004; Bader/CapFriendly; e.g. KHL ~0.77, SHL ~0.57, AHL ~0.39-0.47, NCAA ~0.4, CHL ~0.14-0.3)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-097 Rookie model validation (Brier and point-rate MAE)

- **Intent / contract:** rookies.py:522 docstring ('Score one untouched source season...')
- **External references:** Brier score
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-098 Rookie projection profile (rookie flag, expected games, uncertainty multiplier)

- **Intent / contract:** fallbackPolicy 'retain_generic_prior_with_wider_uncertainty' (rookies.py evaluate_rookie_transition_model)
- **External references:** NHL Calder eligibility (<=25 prior-season GP, <=6 in each of two prior seasons, age < 26)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-099 Rookie translated rates into season artifact

- **Intent / contract:** method 'historical_league_transition_empirical_bayes_v1'; docs/player-projections/research-contract-v4-season-fantasy.json rookieModel
- **External references:** NHLe translation (Desjardins; Bader)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-100 Season roster consensus and roster_confidence ladder

- **Intent / contract:** **UNDOCUMENTED** — web/lib/fantasy-projections/rosterIntegrity.ts:103/151 summaries: an automatic roster change needs two current official sources (an approved roster+landing or landing+transaction pair); otherwise UNDOCUMENTED
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/fantasy-projections/fantasyProjections.test.ts`
- **Tests:** `web/lib/fantasy-projections/fantasyProjections.test.ts`

### PFC-101 Baseline/goalie contribution bundle assembly and unit labeling

- **Intent / contract:** baselineGeneration.ts:51 'Build an unreleased bundle from immutable, cutoff-stamped rate snapshots.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/contributions.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`; `web/lib/player-forecasts/nativeBaselinePublication.test.ts`; `web/lib/player-forecasts/goalieBaseline.test.ts`

### PFC-102 Calendar consumer coverage (eligible player-game-target counts, starter competition check)

- **Intent / contract:** calendarCoverage.ts:27 'Count every catalog competitor in the declared population, including unforecasted players.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/planningContributions.test.ts`; `web/__tests__/pages/api/internal/forecast-calendar.test.ts`

### PFC-103 Contribution resolver: detailed/baseline blend and unconditional mean

- **Intent / contract:** contributions.ts:266 'Resolve one player/game/target. Source records must already be sanitized and release checked'; contributions.ts:6 'Calendar coverage/overlap policy'
- **External references:** Forecast combination / horizon-dependent blending
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/contributions.test.ts`; `web/lib/player-forecasts/currentSeasonSogContribution.test.ts`; `web/lib/player-forecasts/planComparison.test.ts`; `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`

### PFC-104 Contribution coverage summary

- **Intent / contract:** contributions.ts:386 'The caller supplies every required opportunity, including competing bench players.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/contributions.test.ts`

### PFC-105 Planning contribution resolution (RSO/Start Chart) incl. goalie start-mass check

- **Intent / contract:** planningContributions.ts:36 'Apply immutable shared rates only to actual requested schedule opportunities. No model generation, database reads, league scoring, or cache writes occur here.'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/player-forecasts/rsoUsePolicy.fixtures.ts`
- **Tests:** `web/lib/player-forecasts/planningContributions.test.ts`; `web/lib/player-forecasts/gameExpectations.test.ts`; `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`; `web/e2e/roster-schedule-optimizer.spec.ts`

### PFC-106 Use-permission and readiness gating rules

- **Intent / contract:** rsoUsePolicy.ts:124 'Serialized allowedUses/decision IDs cannot grant a review.'; nativeDailyPipelineV2.ts:17 'Default off: each flag stays off until TJ approves the thing it enables.'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/player-forecasts/rsoUsePolicy.fixtures.ts`
- **Tests:** `web/lib/player-forecasts/rsoUsePolicy.test.ts`; `web/lib/player-forecasts/nativeDailyPipelineV2.test.ts`; `web/lib/player-forecasts/forecastServingSource.test.ts`

### PFC-107 Schedule horizon scopes (calendar 1-21 days, next-10 team games, season id from date)

- **Intent / contract:** schedule.ts:54 'A UTC calendar scope is separate from the existing next-ten-team-games scope.'; schedule.ts:74 'The ordinal is measured over the eligible team schedule, never over calendar days.'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/seed-player-forecast-fixtures.ts`
- **Tests:** `web/lib/player-forecasts/playerForecasts.test.ts`; `web/lib/player-forecasts/contributions.test.ts`

### PFC-108 Season artifact game contribution (portable seasonal producer preview)

- **Intent / contract:** seasonGameContributions.ts:16 'Offline producer reuse only. Candidates remain denied until existing native admission approves them.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-109 Ledger settlement (dressed/DNP, actual heads)

- **Intent / contract:** servedForecastLedger.ts:289 'Absence is DNP only with final, complete team/class evidence. A null stat remains null'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/servedForecastLedger.test.ts`

### PFC-110 Settlement outcome extraction (plays, starts, wins, goalie SV%/GAA)

- **Intent / contract:** settlement.ts:108 'The NHL final boxscore supplies actual starter and win-decision labels. It has no shutout award field.'
- **External references:** NHL GAA = GA*60/minutes
- **Examples / fixtures / test data:** `web/scripts/seed-player-forecast-fixtures.ts`
- **Tests:** `web/lib/player-forecasts/playerForecasts.test.ts`; `web/lib/player-forecasts/evaluation.test.ts`

### PFC-111 Forecast scoring per output (abs/squared error, Brier, log loss, 80% interval, composite skill score)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED for the 0-100 skill formula (scoring version label PLAYER_FORECAST_SCORING_VERSION 'player-forecast-skill-v1', researchContract.ts:13)
- **External references:** Skill score SS = 1 - err/err_ref; Brier/log loss conventions
- **Examples / fixtures / test data:** `web/scripts/seed-player-forecast-fixtures.ts`
- **Tests:** `web/lib/player-forecasts/playerForecasts.test.ts`

### PFC-112 Team contexts: offense/defense/pace multipliers, schedule-neutral goal differential, team ratings

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED; docs/player-projections/research-contract-v3-season.json
- **External references:** Simple Rating System (Sports-Reference SRS); team GF%/xGF%
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-113 Venue scorer effects (rink counting bias)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Rink-bias adjustment (Schuckers; Evolving-Hockey home/away scorer adjustments)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-114 Roster-adjusted team contexts

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-115 Hierarchical hits (Poisson-Gamma partial pooling)

- **Intent / contract:** docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Hits decision' (:81)
- **External references:** Gamma-Poisson conjugate empirical Bayes
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-116 Challenger context OLS and assist routing tournament

- **Intent / contract:** docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Development results' (:35)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-117 Historical-core candidate tournament, distribution fit and calibration

- **Intent / contract:** selectionPolicy 'rolling_origin_validation_within_development_window' (model.py); docs/player-projections/development-evidence-2025-26.md
- **External references:** NB/gamma moment estimators; residual-quantile (empirical) intervals
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`; `functions/tests/test_player_forecast_inference.py`

### PFC-118 Recency-decayed weighted summary (per-player mean/variance and population prior)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in code; decay grid in docs/player-projections/research-contract-v3-season.json
- **External references:** Marcel projections (season weights 5/4/3, i.e. ~0.8/0.6 decay); exponential recency weighting
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-119 v4 exposure-based serving rates (TOI per GP, scoring per TOI) and strength TOI rescale

- **Intent / contract:** season.py:3373 comment (exposure model authoritative, context disabled); docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Repaired model path' (:42) and 'Strength-state reconciliation' (:76)
- **External references:** NST per-60 rate x projected TOI convention; Marcel
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-120 Empirical-Bayes shrinkage rate

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (selection evidence 'empirical_bayes_rate'); docs/player-projections/research-contract-v3-season.json
- **External references:** Tango regression to the mean r = n/(n+k); Marcel regression (~1200 PA)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-121 Penalized log-link rate GLM (Poisson IRLS with ridge)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (family name only); docs/player-projections/research-contract-v3-season.json
- **External references:** Poisson GLM via IRLS; ridge GLM conventions (standardized features before penalization)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-122 Regularized negative-binomial GLM

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED; docs/player-projections/research-contract-v4-season-fantasy.json modeling
- **External references:** NB2 GLM (Cameron-Trivedi moment estimator)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-123 Decay/shrinkage grid search by chronological MAE

- **Intent / contract:** VALIDATION_FOLDS / chronological selection: docs/player-projections/research-contract-v3-season.json; limitation '2025-26 is training and validation evidence, not a new blind test' (season.py:3894)
- **External references:** rolling-origin time-series cross-validation
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-124 Season model tournament and minimum-lift rule

- **Intent / contract:** artifact review challengerFallbackPolicy 'baseline_is_served_when_no_valid_challenger_exists' (season.py:3765); docs/player-projections/research-contract-v4-season-fantasy.json evaluation
- **External references:** none suggested
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-125 Play and start probability (participation shrinkage)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in code; docs/player-projections/research-contract-v4-season-fantasy.json releaseSemantics
- **External references:** Marcel-style playing-time projection; Beta-Binomial shrinkage
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-126 Conditional variance construction for season rates

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Poisson variance floor = mean
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### PFC-127 Regularized hurdle GLM (logistic positive-probability x log-link positive mean)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED; HURDLE_TARGETS season.py:57; docs/player-projections/research-contract-v4-season-fantasy.json
- **External references:** hurdle Poisson/NB models (Mullahy 1986)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-128 FORGE walk-forward blocked-shots settlement labels

- **Intent / contract:** forge_walk_forward.py:133 docstring ('raw final boxscore only; absence never supplies a zero') and POLICY settlement text (:47)
- **External references:** NHL official boxscore
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-129 FORGE walk-forward blocked-shots pilot: methods A/B/C and bands

- **Intent / contract:** forge_walk_forward.py:1 docstring and POLICY (:47); tasks/prd-forge-daily-pipeline.md
- **External references:** walk-forward (prospective) evaluation
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### PFC-130 FORGE walk-forward selection, pair regret and cluster bootstrap

- **Intent / contract:** POLICY selection/pairs/clusterBootstrap (forge_walk_forward.py:47-60)
- **External references:** cluster bootstrap; pairwise ranking regret
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

## RSO / roster optimizer (RSO)

### RSO-001 Client bench/dead-day tallies (DustMatrix, BenchDays)

- **Intent / contract:** BenchDays.tsx:24 comment: days left when each lineup player doesn't count: off plus sat (DUST)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/e2e/dust-matrix.spec.ts`; `web/components/RosterScheduleOptimizer/BenchDays.test.tsx`

### RSO-002 RSO lineup expected-points tercile tiers

- **Intent / contract:** SlotWeekGrid.tsx:228 comment: high/mid/low thirds; goalies ranked apart
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/RosterScheduleOptimizer/SlotWeekGrid.test.tsx`

### RSO-003 RSO streaming itinerary override totals and goalie-minimum tradeoff

- **Intent / contract:** StreamingItinerary.tsx:48 comment: day-by-day streaming plan; totals show projections
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx`; `web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx`

### RSO-004 Bench decision explanation (forced-placement counterfactual)

- **Intent / contract:** benchDecisions.ts:39-40 ('Reuse the actual evaluator with a hypothetical placement ... receipts describe evaluated placements')
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/contributionLedger.test.ts`

### RSO-005 Player contribution ledger (GP/AGP/bench per roster player)

- **Intent / contract:** contributionLedger.ts:24 ('Readback of an existing plan, never a second optimizer or a drop recommendation')
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/contributionLedger.test.ts`; `web/components/RosterScheduleOptimizer/BenchDays.test.tsx`

### RSO-006 Roster schedule evaluation (bench games, DUST rate, slot utilization)

- **Intent / contract:** docs/roster-schedule-optimizer.md:27 (roster DUST rate = Bench Games / scheduled player-games)
- **External references:** Games-played / max-games-started maximisation (streaming 'games per week' metric)
- **Examples / fixtures / test data:** `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `web/lib/draft-pro/dust.test.ts`

### RSO-007 Plan evaluation totals (scheduled, active, bench games, projected value)

- **Intent / contract:** tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md; planning.ts:682-685 comment (started/held rows shown but never planned, valued or counted)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`; `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`; `web/lib/rosterScheduleOptimizer/dailyDecisionReplay.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts`

### RSO-008 Candidate plan ordering and alternative display rule

- **Intent / contract:** CandidateBrowser.tsx:51-54 (VORP S4 display rule); candidatePlanMetrics.ts:56-57 (R7 ownership tie)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`; `web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx`

### RSO-009 Candidate plan metrics (Best Fit swaps)

- **Intent / contract:** candidatePlanMetrics.ts:88 ('One acquisition with its necessary reserve/drop, not an unbounded sequence search'), :102-103 goalie boost, :129-130 shortlist heuristic
- **External references:** Waiver-wire value = marginal points/games over replacement (VORP-like)
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`; `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`; `web/lib/rosterScheduleOptimizer/executionAdapter.test.ts`; `web/lib/rosterScheduleOptimizer/lineupGaps.test.ts`; `web/components/RosterScheduleOptimizer/CandidateBrowser.integration.test.tsx`; `web/components/RosterScheduleOptimizer/CandidateCard.test.tsx`; `web/lib/rosterScheduleData/forgeReservePayload.test.ts`

### RSO-010 Candidate shortlist heuristic

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`

### RSO-011 Streaming best-player-available ranking (blended FPts score)

- **Intent / contract:** streamingChain.ts:12-13 (TJ 10-27: past + future average); CONFLICTS with recentForm.ts:49-50 ('A hint only: never a projection input')
- **External references:** Rest-of-season projection vs recent form weighting (regression to mean; recency usually small weight)
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`; `web/lib/rosterScheduleOptimizer/recentForm.test.ts`

### RSO-012 Points comparison 5% similarity display

- **Intent / contract:** CategoryGains.tsx:43 ('not a confidence interval or an automatic decision')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx`

### RSO-013 Category plan dominance relation

- **Intent / contract:** planning.ts:66 ('A native-unit partial order, never a cross-category utility or global rank') and :1110-1112 (no significance floor, weighting or five-percent rule)
- **External references:** Pareto dominance; contrast SGP/z-score weighted category value
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`

### RSO-014 RSO planning data load and forecast source selection

- **Intent / contract:** lib/rosterScheduleData/planning.ts:212 comment (interim RSO source TJ 2026-10-19, before native activation only); tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`; `web/lib/player-forecasts/rsoUsePolicy.fixtures.ts`; `web/__tests__/fixtures/consumerGameRevision.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleData/planning.test.ts`; `web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts`; `web/lib/integrations/yahoo/rosterPlanning.test.ts`

### RSO-015 Opponent positional tilt (F vs D share allowed)

- **Intent / contract:** forgeDailyBridge.ts:120-122, 76-77
- **External references:** Shrinkage toward league mean (k=30 games)
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
- **Tests:** `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`

### RSO-016 Legacy naive team win probability (Poisson)

- **Intent / contract:** forgeDailyBridge.ts:185-187
- **External references:** Independent Poisson goal model (Skellam)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`

### RSO-017 Season per-game rates for stats FORGE does not project

- **Intent / contract:** forgeDailyBridge.ts:37, 41, 215-218
- **External references:** Regression to the mean (Tango k-games shrinkage)
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
- **Tests:** none found

### RSO-018 Power-play zero policy and skater line construction

- **Intent / contract:** forgeDailyBridge.ts:252-256 (declared modeled-zero policy), 291-293
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
- **Tests:** `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/rosterScheduleData/laterImpactInputs.test.ts`

### RSO-019 FORGE bridge skater line reuse and opponent/rest/tilt retargeting

- **Intent / contract:** forgeDailyBridge.ts:19-20 (interim RSO source until native forecasts, TJ 2026-10-19); limitation text :709
- **External references:** Opponent-adjusted per-game projections (log5/multiplicative opponent factors)
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`; `web/lib/player-forecasts/rsoUsePolicy.fixtures.ts`; `web/__tests__/fixtures/consumerGameRevision.ts`
- **Tests:** `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/rosterScheduleData/forgeReservePayload.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`

### RSO-020 Reserve lines and 'no FORGE line' conservative zeros

- **Intent / contract:** forgeDailyBridge.ts:640-644 (TJ option B 2026-10-26 conservative 0); bridgeForecastWire.ts:40-41
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
- **Tests:** `web/lib/rosterScheduleData/forgeReservePayload.test.ts`; `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`

### RSO-021 Bridge forecast transport trimming

- **Intent / contract:** forgeDailyBridge.ts:27-35 (byte budgets, raised 2026-10-26); bridgeForecastWire.ts:178-182
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
- **Tests:** `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/rosterScheduleData/forgeReservePayload.test.ts`

### RSO-022 Team strength priors blend

- **Intent / contract:** forgeDailyBridge.ts:88-90, 79-80 (last season = 20 games)
- **External references:** Bayesian prior/regression to previous season (Tango-style k games)
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
- **Tests:** `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`

### RSO-023 Forecast coverage accounting

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (limitations text planning.ts:281-282 in rosterScheduleData)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`; `web/lib/player-forecasts/rsoUsePolicy.fixtures.ts`; `web/__tests__/fixtures/consumerGameRevision.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`

### RSO-024 Later-period impact (Delta F rate scenario)

- **Intent / contract:** futureImpact.ts:8-9; tasks/artifacts/rso-wave2-2026-10-25/VORP/S3-SCENARIO-CONTRACT.md; tasks/diaries/2026-10-29-claude-rso-vorp-assessment.md
- **External references:** Rest-of-season VORP / discounted future value
- **Examples / fixtures / test data:** `tasks/artifacts/rso-wave2-2026-10-25/VORP/S3-SCENARIO-CONTRACT.md`
- **Tests:** `web/lib/rosterScheduleOptimizer/futureImpact.test.ts`; `web/lib/rosterScheduleData/laterImpactInputs.test.ts`

### RSO-025 Bridge goalie per-start line, wins and expected stats

- **Intent / contract:** forgeDailyBridge.ts:197-199, 515-519, 623 comment; limitation :711
- **External references:** Goalie W = team win x decision share; Poisson/Skellam goal models
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
- **Tests:** `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/projections/goalie/goalieOutcomes.test.ts`

### RSO-026 Bridge goalie start probabilities

- **Intent / contract:** forgeDailyBridge.ts:39-40 (news floors, TJ may tune), 82-83 (B2B 0.55), 572-574 comment
- **External references:** Goalie start models (rest-based, last-N share); B2B starter repeat rates (~25-35% historically)
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
- **Tests:** `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`

### RSO-027 Goalie minimum coverage target and preferred window

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in code beyond names; intent.goalieSplit/goalieWindow schema web/lib/in-season/workspaceSchema.ts:148
- **External references:** Yahoo goalie minimum starts rule
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`

### RSO-028 Projected goalie starts and minimum risk

- **Intent / contract:** planning.ts:968,970 comments (zero requirement bypass; unknown upcoming start keeps projected unknown, never a partial sum)
- **External references:** Expected value of Bernoulli starts; P(meet minimum) would need a Poisson-binomial
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`; `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`

### RSO-029 Yahoo starting-goalie override of start probabilities

- **Intent / contract:** providerGoalieStarts.ts:10-17 docstring
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/providerGoalieStarts.test.ts`; `web/e2e/roster-schedule-optimizer.spec.ts`

### RSO-030 Healthy-reserve activation gain

- **Intent / contract:** healthyReserves.ts:24-26, 64-66 (TJ 2026-10-25 policy 3 option A), 92-94 (C7 H1 assignment rule)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/healthyReserves.test.ts`; `web/components/RosterScheduleOptimizer/HealthyReserveAlert.test.tsx`

### RSO-031 Position eligibility normalization and slot compatibility

- **Intent / contract:** docs/roster-schedule-optimizer.md:33 (multi-position eligibility changes the assignment graph, not a fixed discount)
- **External references:** Yahoo NHL roster position rules (C/LW/RW/W/F/D/Util/G)
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/__tests__/pages/api/v1/roster-schedule-optimizer/eligibility.test.ts`

### RSO-032 Lineup gap report

- **Intent / contract:** lineupGaps.ts:38-39 (readback of no-move lineup, runs no search)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/lineupGaps.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`

### RSO-033 DUST daily lineup assignment (min-cost max-flow)

- **Intent / contract:** docs/roster-schedule-optimizer.md '## Definitions' (lines 9-27) and '## Shared engine' (57-61): 'deterministic maximum-cardinality bipartite matching ... value-aware tie-break chooses starters without changing the maximum starter count'
- **External references:** Exact bipartite / min-cost-flow lineup assignment (Hungarian equivalent); Yahoo daily lineup rules
- **Examples / fixtures / test data:** `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/optimizer.test.ts`

### RSO-034 Planner daily lineup assignment (Hungarian, AGP lexicographic bonus)

- **Intent / contract:** weightedAssignment.ts:1 ('Exact rectangular maximum-weight matching with an independent empty choice for each slot'); tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md
- **External references:** Hungarian / ILP lineup optimisation (exact per day; not a multi-day joint optimisation)
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/projections/startChartPipeline.test.ts (weightedAssignment)`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts`

### RSO-035 Unknown-quality contamination and conditional ability tie-break

- **Intent / contract:** planning.ts:427-429 comment (unknown quality contaminates the whole competing slot component); limitation text :467
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`

### RSO-036 Outcome lineup local-search refinement

- **Intent / contract:** planning.ts:504 ('Compare complete category or points-goalie lineups; local moves remain bounded'); limitation :613-615
- **External references:** Local search / beam vs exact ILP
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`

### RSO-037 Started-game lock inference

- **Intent / contract:** planning.ts:682-685 comment (daily providers lock at game time)
- **External references:** Yahoo daily lineup lock at puck drop
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`

### RSO-038 Weekly lineup window aggregation

- **Intent / contract:** docs/roster-schedule-optimizer.md:130 lists 'verified weekly-lock assignment model' as future work; planning.ts:758-759 comment
- **External references:** Weekly-lineup leagues: maximise weekly games x value per slot
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`

### RSO-039 Active roster slot expansion

- **Intent / contract:** docs/roster-schedule-optimizer.md '## Definitions' (lines 9-27) and '## Shared engine' (57-61)
- **External references:** Yahoo roster positions
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`

### RSO-040 Streaming per-day capacity via bipartite matching

- **Intent / contract:** streamingChain.ts:11 ('small per-day matchings')
- **External references:** Maximum bipartite matching
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`

### RSO-041 Schedule preparation and Yahoo week mapping

- **Intent / contract:** docs/roster-schedule-optimizer.md '## Matchup-week mapping' (47-55): Yahoo week boundaries inclusive
- **External references:** Yahoo matchup week boundaries (inclusive)
- **Examples / fixtures / test data:** `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `web/lib/draft-pro/dust.test.ts`

### RSO-042 Latest equivalent action time

- **Intent / contract:** planning.ts:1241-1245 docstring (time a due-now move at the latest instant with the same outcome)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### RSO-043 Schedule freshness witness and warning thresholds

- **Intent / contract:** planning.ts:624-628 docstrings; RosterScheduleOptimizer.tsx:1160 tooltip (provisional thresholds)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/RosterScheduleOptimizer/canonicalSchedule.test.ts`; `web/__tests__/pages/api/v1/roster-schedule-optimizer/schedule.test.ts`

### RSO-044 Period, lineup-window and timezone boundary math

- **Intent / contract:** periodBoundaries.ts:3, 13; providerRules.ts:6-7 (TJ D6), 33
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rosterScheduleOptimizer/periodBoundaries.test.ts`; `web/lib/rosterScheduleOptimizer/providerRules.test.ts`; `web/components/RosterScheduleOptimizer/AcquisitionPeriodTimes.test.tsx`

### RSO-045 Acquisition timeline, effective time and budget accounting

- **Intent / contract:** planningTimeline.ts:12, 24 ('Applies actions at their effective time while charging acquisition at action time')
- **External references:** Yahoo max acquisitions per week, waiver processing
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/reconciliation.test.ts`; `web/lib/integrations/yahoo/rosterPlanning.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`

### RSO-046 Form label and deployment chips

- **Intent / contract:** lib/rosterScheduleData/planning.ts:50-52, 400-401 comments; evidence text :385
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rosterScheduleData/planning.test.ts`

### RSO-047 Intent reconciliation (refresh revalidation and allowance re-spend)

- **Intent / contract:** reconciliation.ts:4 ('Recheck selected intent against new authoritative inputs; repairs require explicit acceptance')
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/reconciliation.test.ts`; `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`

### RSO-048 Ownership freshness

- **Intent / contract:** retention.ts:15-16; lib/rosterScheduleData/planning.ts:313-314 (fresh <= 3 days)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rosterScheduleData/planning.test.ts`; `web/lib/rosterScheduleOptimizer/retention.test.ts`

### RSO-049 Drop retention ordering and ownership caution

- **Intent / contract:** retention.ts:3-4 (R7 one retention policy), :6 (50% threshold TJ 2026-10-20), :68-70 (TJ 2026-10-21 unknown never suggested)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/retention.test.ts`; `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts`

### RSO-050 Candidate marginal DUST (Daily Unstartable Schedule Tax)

- **Intent / contract:** docs/roster-schedule-optimizer.md:19-24 (DUST Games, DUST Rate, Active Games Added formulas)
- **External references:** Marginal games-started added (streaming value) - docs/roster-schedule-optimizer.md formula
- **Examples / fixtures / test data:** `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/optimizer.test.ts`; `web/lib/draft-pro/dust.test.ts`

### RSO-051 Lower-conflict alternative recommendations

- **Intent / contract:** docs/roster-schedule-optimizer.md:77 (max(2, ceil(DUST x 25%)), <=5% value loss, ordering)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/optimizer.test.ts`

### RSO-052 DUST risk classification

- **Intent / contract:** docs/roster-schedule-optimizer.md '## Recommendations and risk thresholds' (67-77); thresholds called initial product defaults at :128
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/draft-pro-fixtures.ts`; `web/e2e/roster-schedule-optimizer-fixtures.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/optimizer.test.ts`

### RSO-053 Roster Autopsy slot coverage analysis

- **Intent / contract:** web/lib/rosterAutopsy/diagnosis.ts:7; manual.ts:168
- **External references:** Maximum bipartite matching (Hopcroft-Karp) for slot feasibility
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/RosterAutopsy/RosterAutopsy.test.tsx`

### RSO-054 Team schedule context (schedule score, off-nights)

- **Intent / contract:** TeamScheduleContext.tsx:80 tooltip ('team schedule context, not net roster fit')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx`

### RSO-055 Plan ordering and safe-alternative gate

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (only inline comments planning.ts:1123-1124, 1157-1158)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`

### RSO-056 Search work quotas

- **Intent / contract:** planning.ts:1182-1183 ('work bounds, not wall-clock guesses, so identical inputs visit the same frontier')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`

### RSO-057 Schedule fits (marginal active games by team/position group)

- **Intent / contract:** planning.ts:1175 ('Marginal lineup capacity only: one hypothetical extra roster place, no acquisition/drop claim')
- **External references:** Games-per-week streaming target identification
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`

### RSO-058 Roster plan beam search (add/drop/reserve sequences)

- **Intent / contract:** planning.ts:1327-1328 (VORP S1 beam reserve bounds), tasks/diaries/2026-10-29-claude-rso-vorp-assessment.md; tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md
- **External references:** Beam search vs exact ILP/MIP over add/drop sequences
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`; `web/lib/rosterScheduleOptimizer/refreshForecastInputs.test.ts`; `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.e2e.test.ts`

### RSO-059 Streaming chain certification and ranking

- **Intent / contract:** streamingChain.ts:14-15 ('every returned chain is certified by the plan evaluator'); :36-39 VORP S1/S4 alternatives
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`

### RSO-060 Streaming chain window DP (1 vs 2 spots)

- **Intent / contract:** streamingChain.ts:9-19 (TJ 2026-10-27: most added active games then projected FPts; goalie minimum; waivers); tasks/diaries/2026-10-27-claude-rso-streaming-chain.md, tasks/diaries/2026-10-27-claude-rso-chain-limits.md
- **External references:** Streaming games-per-week maximisation; DP over add budget
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`; `web/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx`

## Fantasy scoring (FSC)

### FSC-001 Starter Board default fantasy points

- **Intent / contract:** docs/start-chart/daily-board-contract-v1.json; docs/start-chart/launch-validation.md (scoring checks :95)
- **External references:** Compare against the web app league scoring defaults and common platform point leagues (G/A/PPP/SOG/HIT/BLK weights vary by platform)
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### FSC-002 Joint fantasy samples from scenario draws

- **Intent / contract:** daily_board.py:52 docstring ('Score each joint draw before taking percentiles')
- **External references:** none suggested
- **Examples / fixtures / test data:** `modeling/player_forecasts/tests/test_harness.py`
- **Tests:** `modeling/player_forecasts/tests/test_harness.py`

### FSC-003 Paired fantasy decision evaluation (opportunity loss)

- **Intent / contract:** evaluation.ts:140 'Scores every plan against the same observed player/game values. Points leagues only.'
- **External references:** Regret / opportunity-loss evaluation of decisions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/evaluation.test.ts`

### FSC-004 Plan comparison and +/-20% sensitivity scoring

- **Intent / contract:** planComparison.ts:110 'Compare fixed complete lineups'; planComparison.ts:148 'Explicit ±20% counting-stat stresses. No invented forecast distribution or probability.'
- **External references:** H2H category win counting; scenario stress testing
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/planComparison.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`

### FSC-005 Ledger fantasy points (default league weights)

- **Intent / contract:** servedForecastLedger.ts:59 'League-default (TJ's) fantasy points; null when any head with a non-zero weight is unknown (R15 accuracy rule).'
- **External references:** Yahoo/ESPN points-league scoring conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/player-forecasts/servedForecastLedger.test.ts`

### FSC-006 Game forecast points (expected and if-starts)

- **Intent / contract:** planning.ts:139 comment ('stats already includes participation; multiplying or dividing by start probability changes its meaning') and :118
- **External references:** Expected fantasy points = sum E[stat] x weight
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`; `web/lib/player-forecasts/rsoUsePolicy.fixtures.ts`; `web/__tests__/fixtures/consumerGameRevision.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/gameForecastPoints.test.ts`; `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`; `web/components/RosterScheduleOptimizer/ForecastPoints.test.tsx`

### FSC-007 Swap category gain/sacrifice breakdown

- **Intent / contract:** planning.ts:195-197 (R8: whole-swap explanation, no new projection, no blended score)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`

### FSC-008 Candidate horizon/active points (unused export)

- **Intent / contract:** planning.ts:251-252, 279-280, 1579 docstrings
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/rosterScheduleOptimizer/dailyDecisionReplay.test.ts`

### FSC-009 Per-game fantasy point value of a play (points leagues)

- **Intent / contract:** planning.ts:319-320 comment ('Category forecasts establish supported inputs, not an additive utility'); tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md
- **External references:** Yahoo points-league scoring (sum of stat x weight)
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/gameForecastPoints.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`

### FSC-010 Category values, opponent totals and matchup result

- **Intent / contract:** planning.ts:944-946 comment ('Category mode reports no scalar score (no fixed category blend, FR9-D2)'); planning.ts:82 (FR9-D1 missing component unknown); tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md
- **External references:** H2H category win probability models (e.g. Normal/Poisson per category) / SGP
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`; `web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx`

### FSC-011 Stat applicability (skater vs goalie key routing)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/planning.test.ts`; `web/lib/rosterScheduleOptimizer/gameForecastPoints.test.ts`

### FSC-012 Recent form totals and recent FPts per game

- **Intent / contract:** recentForm.ts:3-5, 49-50 ('A hint only: never a projection input')
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
- **Tests:** `web/lib/rosterScheduleOptimizer/recentForm.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`; `web/lib/rosterAutopsy/manual.test.ts`; `web/components/RosterScheduleOptimizer/CandidateCard.test.tsx`

### FSC-013 Sustainability Sandbox skater fantasy score (hard-coded weights)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/trendsSandbox.test.tsx`

### FSC-014 True Goalie Value default goalie fantasy point settings

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/trueGoalieValue.test.tsx`

### FSC-015 Fantasy points percentile & correlation analysis (per game)

- **Intent / contract:** module docstring web/scripts/fantasy_points_analysis.py:2-15
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### FSC-016 Category z-score value (calculateCategoryScores)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Standard category z-score / SGP valuation (replacement-level-relative, rate stats weighted by volume, e.g., Razzball/FanGraphs z-scores)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/scoring/categoryScores.test.ts`

### FSC-017 Start Chart today value, Hungarian lineup and stream gain

- **Intent / contract:** web/lib/projections/starterBoardPersonalization.ts:3, :36
- **External references:** ILP / Hungarian assignment for daily lineups (optimal vs greedy)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/startChartPipeline.test.ts`; `web/__tests__/pages/api/v1/start-chart.test.ts`; `web/e2e/start-chart.spec.ts`

### FSC-018 NHL Edge snapshot freshness gate

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/NHL/edgeFeatureContract.test.ts`

### FSC-019 NHL schedule derived game type and daily counts

- **Intent / contract:** web/lib/NHL/server/index.ts:477, :494
- **External references:** NHL game id format SSSSTTNNNN
- **Examples / fixtures / test data:** `web/e2e/fixtures/game-grid-previews/real-week-32.ts`
- **Tests:** none found

### FSC-020 Goalie qualification minimum games (stats page)

- **Intent / contract:** web/lib/NHL/statsPageFetch.ts:72 comment
- **External references:** NHL goalie qualification (25 GP of 82 historically / GP-proportional)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/NHL/statsPageFetch.test.ts`

### FSC-021 NHL TOI share and team PP time (legacy statsapi)

- **Intent / contract:** web/lib/NHL/TOI.ts:77-81
- **External references:** NHL TOI share uses team TOI incl. OT; PP share uses team PP time from play-by-play
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### FSC-022 Ownership freshness and threshold filter

- **Intent / contract:** web/lib/integrations/yahoo/playerWriter.ts:91
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`; `web/lib/integrations/yahoo/writerPermissions.test.ts`

### FSC-023 Ownership / ADP trend movement

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts`

### FSC-024 Pickup GP% (player games / team games)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`

### FSC-025 Pickup table metric percentiles

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Standard fantasy z-score / SGP valuation (rate per game and replacement level) — here raw season-total percentiles
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`; `web/e2e/player-pickup.spec.ts`

### FSC-026 Pickup composite / display score

- **Intent / contract:** **UNDOCUMENTED** — web/components/PlayerPickupTable/PlayerPickupTable.tsx:813 (BPA heading comment only); otherwise UNDOCUMENTED
- **External references:** Category z-score sum with league weights (Yahoo-style H2H categories)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`

### FSC-027 Pickup team boost from Week Score

- **Intent / contract:** web/components/PlayerPickupTable/PlayerPickupTable.tsx:2771 comment ('up to +-25% boost/dilution')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`

### FSC-028 Yahoo credited goalie appearances (goalie minimum progress)

- **Intent / contract:** web/lib/integrations/yahoo/rosterPlanning.ts:98-103
- **External references:** Yahoo minimum goalie games played rule
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/integrations/yahoo/rosterPlanning.test.ts`

### FSC-029 Yahoo past-lineup actual fantasy points

- **Intent / contract:** web/lib/integrations/yahoo/rosterPlanning.ts:37-42
- **External references:** Yahoo points scoring (Yahoo stat corrections may differ)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/integrations/yahoo/rosterPlanning.test.ts`

### FSC-030 Roster Autopsy retained recent points per game

- **Intent / contract:** web/lib/rosterAutopsy/manual.ts:216 ('historical hints; never player grades or forecasts')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/RosterAutopsy/RosterAutopsy.test.tsx`

### FSC-031 Default fantasy points and category weights

- **Intent / contract:** web/lib/projectionsConfig/fantasyPointsConfig.ts:15-31 comments
- **External references:** Yahoo/ESPN default points-league scoring settings
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/contexts/AuthProviderContext.test.tsx`; `web/lib/socialShare/score.test.ts`

### FSC-032 ESPN league scoring mapping

- **Intent / contract:** web/lib/integrations/espn/normalize.ts:274 warning text
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/integrations/espn/__fixtures__/fhl-categories.json`; `web/lib/integrations/espn/__fixtures__/fhl-points.json`; `web/lib/integrations/espn/__fixtures__/fhl-season-points.json`
- **Tests:** `web/lib/integrations/espn/normalize.test.ts`

### FSC-033 Fantrax league scoring mapping

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/integrations/fantrax/__fixtures__/nhl-categories.json`; `web/lib/integrations/fantrax/__fixtures__/nhl-points.json`
- **Tests:** `web/lib/integrations/fantrax/normalize.test.ts`

### FSC-034 Yahoo league scoring adaptation

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Yahoo H2H categories (equal weight per category)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/integrations/yahoo/rosterPlanning.test.ts`; `web/lib/integrations/yahoo/yahooDiet.test.ts`

### FSC-035 Date-range grid counts (off-nights, back-to-backs, home/away)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/SortableHeaders.test.tsx`

### FSC-036 Selected-period opponent point pct (pickup context)

- **Intent / contract:** web/components/GameGrid/utils/scheduleSummary.ts:6
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/utils/scheduleSummary.test.ts`

### FSC-037 League daily totals row (calcTotalGP / calcTotalOffNights)

- **Intent / contract:** web/components/GameGrid/TotalGamesPerDayRow.tsx:84-111 docstrings
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/utils/scheduleSummary.test.ts`

### FSC-038 Week Score matchup bonus

- **Intent / contract:** web/components/GameGrid/utils/calcWeekScore.ts:26 ('Interim win-odds heuristic')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/utils/calcWeekScore.test.js`

### FSC-039 weekScore (Game Grid Week Score)

- **Intent / contract:** web/components/GameGrid/utils/calcWeekScore.ts:44-53 docblock; user-facing formula text web/components/GameGrid/GameGrid.tsx:864-875 and :1586-1597 ('interim heuristic, not a calibrated fantasy projection')
- **External references:** Common fantasy 'games-per-week / off-night' streaming heuristics (e.g., Frozen Tools/Left Wing Lock off-night counts); no calibrated standard
- **Examples / fixtures / test data:** `web/e2e/fixtures/game-grid-previews/real-week-32.ts`; `web/e2e/fixtures/game-grid-previews/data.ts`
- **Tests:** `web/components/GameGrid/utils/calcWeekScore.test.js`; `web/components/GameGrid/utils/scheduleSummary.test.ts`; `web/components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx`; `web/lib/socialShare/modules/offNightEdge.test.ts`

### FSC-040 Week Score slate crowding adjustment

- **Intent / contract:** web/components/GameGrid/utils/calcWeekScore.ts:5 ('One centered adjustment for the entire included horizon')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/utils/calcWeekScore.test.js`; `web/components/GameGrid/utils/scheduleSummary.test.ts`

### FSC-041 Win odds list with back-to-back penalty

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (only function docstring at calcWinOdds.ts:29-33)
- **External references:** Published back-to-back win% drop ~3-5 points (e.g. Evolving-Hockey/MoneyPuck rest effects), not a 25% multiplicative cut
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/utils/calcWinOdds.test.js`

### FSC-042 Tertile favourability bands and top/bottom-10 ranks

- **Intent / contract:** web/components/GameGrid/utils/fourWeekMetricBands.ts:3; web/components/GameGrid/utils/metricRanks.ts:3
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/utils/fourWeekMetricBands.test.ts`; `web/components/GameGrid/utils/metricRanks.test.ts`

### FSC-043 Team games and off-night counts (Game Grid helper)

- **Intent / contract:** web/components/GameGrid/utils/helper.ts:11, :34-37
- **External references:** Community off-night definition: nights with fewer than half the league playing (<=8 games of 16 max)
- **Examples / fixtures / test data:** `web/e2e/fixtures/game-grid-previews/real-week-32.ts`
- **Tests:** `web/components/GameGrid/utils/scheduleSummary.test.ts`

### FSC-044 Weighted off-nights (calcWeightedOffNights)

- **Intent / contract:** web/components/GameGrid/utils/helper.ts:58-70 docblock
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/socialShare/pickupsFixture.ts`
- **Tests:** `web/lib/socialShare/modules/offNightEdge.test.ts (indirect)`

### FSC-045 Opponent category effect sign map

- **Intent / contract:** web/components/GameGrid/utils/opponentCategoryEffects.ts:24-29, :72-75
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/utils/opponentCategoryEffects.test.ts`

### FSC-046 Poisson score matrix with 'tie-breaker' (PDHC heat map)

- **Intent / contract:** web/components/GameGrid/utils/poissonHelpers.ts:5 ('with tie-breaker')
- **External references:** Independent / bivariate Poisson (Maher 1982; Dixon-Coles low-score correction); NHL OT/SO resolution
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### FSC-047 Opponent atk/def percentile rating

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/OpponentMetricsTable.test.tsx`

### FSC-048 Four-week opportunity score (GP + 0.25*ON)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (version constants only, scheduleOpportunity.ts:6-7)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/fixtures/opponent-four-week-metrics/App.tsx`
- **Tests:** `web/components/GameGrid/OpportunitySparkline.test.tsx`; `web/components/GameGrid/utils/scheduleSummary.test.ts`; `web/lib/socialShare/matchups.test.ts`

### FSC-049 Four-week averages and OPP score

- **Intent / contract:** web/components/GameGrid/utils/scheduleSummary.ts:20
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/fixtures/opponent-four-week-metrics/App.tsx`
- **Tests:** `web/components/GameGrid/utils/scheduleSummary.test.ts`; `web/components/GameGrid/utils/fourWeekGridViews.test.ts`

### FSC-050 Team-vs-player forecast reconciliation residual and team game-expectation subtotal

- **Intent / contract:** web/components/GameGrid/utils/teamForecasts.ts:174; web/components/GameGrid/utils/teamGameExpectations.ts:49-53
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/utils/teamForecasts.test.ts`; `web/components/GameGrid/utils/teamGameExpectations.test.ts`

### FSC-051 Team forecast category subtotal (Game Grid TeamDetails)

- **Intent / contract:** web/components/GameGrid/utils/teamForecasts.ts:6, :13, :36
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/utils/teamForecasts.test.ts`; `web/components/GameGrid/utils/useTeamForecasts.test.tsx`; `web/components/GameGrid/TeamDetails.test.tsx`

### FSC-052 Four-week per-week Week Score

- **Intent / contract:** web/components/GameGrid/utils/useFourWeekSchedule.ts:108 ('Opportunity needs fixtures, not the additional win-odds database lookup')
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/fixtures/opponent-four-week-metrics/App.tsx`
- **Tests:** `web/components/GameGrid/utils/scheduleSummary.test.ts`

### FSC-053 Opponent metric averages (xGF, xGA, GF, GA, SF, SA, PTS%)

- **Intent / contract:** web/components/GameGrid/utils/useOpponentMetricsData.ts:52, :105
- **External references:** NST team stats per-game convention; standings point% = points/(2*GP)
- **Examples / fixtures / test data:** `web/__tests__/fixtures/nst`
- **Tests:** `web/components/GameGrid/utils/useOpponentMetricsData.test.ts`; `web/components/GameGrid/OpponentMetricsTable.test.tsx`

## Rankings (RNK)

### RNK-001 Player percentile rank across skaters (avg stats)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Standard percentile rank (count below + 0.5*ties)/N
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### RNK-002 Legacy /api/v1/rankings start-chart scaffold

- **Intent / contract:** TODO comment web/pages/api/v1/rankings.ts:67
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/rankings.test.ts`

### RNK-003 Skater contextual metric catalogue (per-60 rates, shares, regression metrics)

- **Intent / contract:** description/formulaDescription fields in web/lib/rankings/metricDefinitions.ts:195-956; PRD tasks/TASKS/contextual-hockey-rankings/prd-contextual-hockey-rankings.md
- **External references:** NST per-60 and on-ice share conventions; Evolving-Hockey RAPM for relative metrics
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/metricDefinitions.test.ts`

### RNK-004 Player matrix composite cells & composite-sort ranking

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (no comment for percentile substitution)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/playerMatrix.test.ts`; `web/components/Rankings/PlayerMatrixTable.test.tsx`; `web/__tests__/pages/api/v1/contextual-rankings-matrix.test.ts`

### RNK-005 Player matrix all-strengths TOI per game

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/playerMatrix.test.ts`

### RNK-006 Contextual metric raw value + direction normalization

- **Intent / contract:** metricDefinitions formulaDescription per metric (web/lib/rankings/metricDefinitions.ts:202 et seq.)
- **External references:** NST per-60 convention (count / TOI minutes * 60)
- **Examples / fixtures / test data:** `web/lib/rankings/fixtures/rankingsTrust.json`
- **Tests:** `web/lib/rankings/rankingCalculator.test.ts`; `web/lib/rankings/rankingCalculator.lowerIsBetter.test.ts`

### RNK-007 Peer-group sample gating & sample confidence

- **Intent / contract:** metricDefinitions sampleRequirements (web/lib/rankings/metricDefinitions.ts:179); PRD tasks/TASKS/contextual-hockey-rankings/prd-contextual-hockey-rankings.md
- **External references:** NST-style minimum TOI filters (e.g. 5v5 TOI cutoffs); Tango reliability-based thresholds
- **Examples / fixtures / test data:** `web/lib/rankings/fixtures/rankingsTrust.json`
- **Tests:** `web/lib/rankings/rankingCalculator.test.ts`; `web/lib/rankings/metricDefinitions.test.ts`

### RNK-008 Contextual ranking percentile & dense rank (rankNormalizedMetricValues)

- **Intent / contract:** MCM_SCORE_CONTRACT.percentileConvention: '100 * strictly worse qualified peers / (qualified peers - 1); tied values receive the same percentile' (web/lib/rankings/skaterCompositeMethodology.ts:82); PRD tasks/TASKS/contextual-hockey-rankings/prd-contextual-hockey-rankings.md
- **External references:** Standard percentile rank (exclusive, (#below)/(N-1)); compare to mid-rank convention (#below + 0.5*#ties)/N used by NST/HockeyViz-style percentile cards.
- **Examples / fixtures / test data:** `web/lib/rankings/fixtures/rankingsTrust.json`
- **Tests:** `web/lib/rankings/rankingCalculator.test.ts`; `web/lib/rankings/rankingCalculator.lowerIsBetter.test.ts`; `web/__tests__/pages/api/v1/contextual-rankings.test.ts`

### RNK-009 Team matrix ranking (power-rating passthrough + percentiles)

- **Intent / contract:** comment web/lib/rankings/teamMatrix.ts:1378-1379 (event components stop at selected power snapshot)
- **External references:** NST team 5v5 tables
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/teamMatrix.test.ts`; `web/__tests__/pages/api/v1/contextual-rankings-matrix.test.ts`; `web/components/Rankings/GoalieTeamMatrixTable.test.tsx`

### RNK-010 Team style profile (xGF%, shot quality, event rate, pace/control axes, style badge)

- **Intent / contract:** TEAM_STYLE_SOURCE_CONTRACT web/lib/rankings/teamStyleMethodology.ts:35-58
- **External references:** NST team 5v5 xGF%; score-and-venue adjusted xG (Evolving-Hockey / Micah McCurdy)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/teamStyleMethodology.test.ts`; `web/lib/rankings/teamMatrix.test.ts`

### RNK-011 Team luck components (finishing, save, net GAx)

- **Intent / contract:** formulaDecisions.luck '(GF - xGF) + (xGA - GA)' web/lib/rankings/teamStyleMethodology.ts:51
- **External references:** GSAx (team-level) / GAx; PDO
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/teamStyleMethodology.test.ts`

### RNK-012 Team game context components (1-goal rate, home/road gap, PP opp/G, Pen/60)

- **Intent / contract:** METRIC_COLUMNS descriptions web/lib/rankings/teamMatrix.ts:428-455
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/teamStyleMethodology.test.ts`; `web/lib/rankings/teamMatrix.test.ts`

### RNK-013 QoT / QoC (quality of teammates / competition) features

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in read excerpts
- **External references:** Evolving-Hockey / NST QoT-QoC (TOI-weighted teammate/opponent TOI% or xGF%); HockeyViz competition metrics
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/xg/qotQoc.test.ts`

### RNK-014 Deployment tier bucket summaries

- **Intent / contract:** comment web/lib/rankings/deploymentTiers.ts:785-786 (rank lines vs whole position, not vs bucket)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/deploymentTiers.test.ts`; `web/__tests__/pages/api/v1/contextual-rankings-deployment-tiers.test.ts`

### RNK-015 Deployment bucket assignment (EV line/pair, PP unit, PK tier)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in code beyond names; PRD tasks/TASKS/contextual-hockey-rankings/prd-contextual-hockey-rankings.md
- **External references:** Line-combination conventions (Daily Faceoff / NST line tool); PK usage tiers by SH TOI share
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/skaterDeploymentAggregation.test.ts`

### RNK-016 Team unit-usage indices (forward top load, pair top load, PP1+PP2 share)

- **Intent / contract:** METRIC_COLUMNS descriptions web/lib/rankings/teamMatrix.ts:456-479
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/teamMatrix.test.ts`; `web/__tests__/pages/api/v1/db/update-team-unit-toi.test.ts`

### RNK-017 Team unit TOI builder (5v5 lines/pairs and PP units, pooled player-seconds)

- **Intent / contract:** comments web/lib/rankings/teamUnitToiBuilder.ts:86-92; migration comment on unit_share (20260622150500_create_team_unit_toi.sql:83)
- **External references:** NST/HockeyViz line-combination TOI (5v5 shared ice time)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/teamUnitToiBuilder.test.ts`; `web/lib/rankings/teamUnitToiWriter.test.ts`; `web/lib/rankings/teamUnitToiNightly.test.ts`; `web/__tests__/pages/api/v1/db/update-team-unit-toi.test.ts`

### RNK-018 Goalie value signal (avg of GSAx and GSAA)

- **Intent / contract:** METRIC_COLUMNS goalie_value_signal description goalieMatrix.ts:268-276
- **External references:** GSAx (xG baseline) vs GSAA (league-average SV% baseline) are distinct standards
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/goalieMatrix.test.ts`

### RNK-019 Goalie relative SV% (vs same-team other goalies)

- **Intent / contract:** comment web/lib/rankings/goalieMatrix.ts:576-577 and METRIC_COLUMNS :236-243
- **External references:** dSV% / team-relative save percentage
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/goalieMatrix.test.ts`

### RNK-020 Goalie matrix sample gate, confidence and ranking

- **Intent / contract:** comment web/lib/rankings/goaliePopulation.ts:87-90 (official appearances anchor eligibility)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/goalieMatrix.test.ts`; `web/lib/rankings/goaliePopulation.test.ts`

### RNK-021 Goalie window aggregation (SV%, 5v5 GSAx, GSAA/60, xGA/shot, HD SV%)

- **Intent / contract:** METRIC_COLUMNS descriptions web/lib/rankings/goalieMatrix.ts:227-316; comment :704-705
- **External references:** GSAx = xGA - GA (MoneyPuck/Evolving-Hockey, all unblocked shots, all situations); NST GSAA and HD SV% definitions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/goalieMatrix.test.ts`; `web/__tests__/pages/api/v1/contextual-rankings-matrix.test.ts`; `web/components/Rankings/GoalieTeamMatrixTable.test.tsx`

### RNK-022 Goalie quality start / really bad start / steal game classification

- **Intent / contract:** DEFAULT_THRESHOLDS web/lib/rankings/goalieMethodology.ts:74-83; METRIC_COLUMNS :285-306
- **External references:** Rob Vollman Quality Start (SV% >= league avg or >=.885 on <20 shots) and Really Bad Start (SV% < .850)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/goalieMethodology.test.ts`; `web/lib/rankings/goalieMatrix.test.ts`

### RNK-023 Goalie role / start-share buckets and adjusted core netshare

- **Intent / contract:** roleNotes text web/lib/rankings/goalieMatrix.ts:1078-1087
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/goalieMethodology.test.ts`; `web/lib/rankings/goalieMatrix.test.ts`

### RNK-024 Results Luck Index (non-overlapping rate version with peer blend shrinkage)

- **Intent / contract:** RESULTS_LUCK_INDEX_CONTRACT.baseline 'blended with active peer-group average when player history is thin' (skaterCompositeMethodology.ts:197)
- **External references:** Linear shrinkage toward population mean (Tango regression to the mean)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/resultsLuckIndex.test.ts`

### RNK-025 Results Luck Index (component-aware, written)

- **Intent / contract:** RESULTS_LUCK_INDEX_CONTRACT and RESULTS_LUCK_BASELINE_PERSISTENCE_CONTRACT (web/lib/rankings/skaterCompositeMethodology.ts:188-302)
- **External references:** PDO / regression-to-mean of shooting % and on-ice Sh% (Tango-style true-talent regression)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/resultsLuckIndex.test.ts`; `web/lib/rankings/resultsLuckSources.test.ts`; `web/lib/rankings/skaterCompositeWriter.test.ts`

### RNK-026 Skater composite source population & coverage gate

- **Intent / contract:** comment web/lib/rankings/skaterCompositeSourceCoverage.ts:74 and :99-100
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/skaterCompositeSourceCoverage.test.ts`

### RNK-027 Skater composite publication gate & population re-check

- **Intent / contract:** comments web/lib/rankings/skaterCompositeWriter.ts:200-201, 734, 768-769
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/skaterCompositeWriter.test.ts`; `web/__tests__/pages/api/v1/db/update-skater-composite-ratings.test.ts`

### RNK-028 Offense Rating (skater composite)

- **Intent / contract:** OFFENSE_RATING_CONTRACT formula + caveats (web/lib/rankings/skaterCompositeMethodology.ts:9-30); metricDefinitions offense_rating adjustedImpactBoundary (metricDefinitions.ts:812)
- **External references:** Evolving-Hockey EV/PP offense GAR components; percentile-card composites (JFresh)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/skaterCompositeWriter.test.ts`; `web/lib/rankings/skaterCompositeMethodology.test.ts`; `web/__tests__/pages/api/v1/db/update-skater-composite-ratings.test.ts`

### RNK-029 Defense Rating / Defensive Impact in Context (skater composite)

- **Intent / contract:** DEFENSE_RATING_CONTRACT + DEFENSIVE_COMPOSITE_CAVEATS (skaterCompositeMethodology.ts:32-46, defensiveCompositeMethodology.ts:10-13)
- **External references:** Evolving-Hockey defensive RAPM/GAR (xGA suppression controlling for teammates, competition, zone, score)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/skaterCompositeWriter.test.ts`; `web/lib/rankings/defensiveCompositeMethodology.test.ts`

### RNK-030 MCM Score (multi-category fantasy composite)

- **Intent / contract:** MCM_SCORE_CONTRACT formula/componentPolicy/caveats (web/lib/rankings/skaterCompositeMethodology.ts:73-102)
- **External references:** Fantasy category z-score/value-over-replacement methods (e.g. standard H2H category z-scores)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/skaterCompositeWriter.test.ts`; `web/lib/rankings/skaterCompositeMethodology.test.ts`

### RNK-031 BEAST tier classification

- **Intent / contract:** metricDefinitions beast_tier description (web/lib/rankings/metricDefinitions.ts:926-956); tierComparison note skaterCompositeMethodology.ts:84
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/skaterCompositeWriter.test.ts`; `web/lib/rankings/skaterCompositeMethodology.test.ts`

### RNK-032 Skater archetype scores & tags (shoot-first, pass-first, play-driver)

- **Intent / contract:** SKATER_ARCHETYPE_TAG_CONTRACTS rules (web/lib/rankings/skaterCompositeMethodology.ts:135-186), exactFormulaStatus source_pending
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/skaterCompositeWriter.test.ts`

### RNK-033 xG denominator semantics helpers (xS%, SAX%, team shot quality, goalie xGA per Fenwick)

- **Intent / contract:** XG_SHOT_UNIVERSE = 'fenwick_unblocked' (web/lib/rankings/xgDenominatorSemantics.ts:1)
- **External references:** MoneyPuck/Evolving-Hockey xG per Fenwick (unblocked) attempt
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/xgDenominatorSemantics.test.ts`; `web/lib/rankings/teamStyleMethodology.test.ts`

### RNK-034 Rankings UI score tones and snapshot strengths/weak spots

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/Rankings/PlayerSnapshotPanel.test.tsx`; `web/components/Rankings/PlayerMatrixTable.test.tsx`

### RNK-035 Entity metric rankings snapshot writer/reader (persisted percentiles, re-ranked on read)

- **Intent / contract:** comments web/lib/rankings/entityMetricRankingReader.ts:428-429, 558-560
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/entityMetricRankingWriter.test.ts`; `web/lib/rankings/entityMetricRankingReader.test.ts`; `web/__tests__/pages/api/v1/db/update-entity-metric-rankings.test.ts`

### RNK-036 Window-scaled minimum GP defaults (min GP by window, comparison-window min GP)

- **Intent / contract:** comments web/lib/rankings/rankingUrlState.ts:63-64 and :82-84
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/rankingUrlState.test.ts`

### RNK-037 Skater window aggregation from rolling rows (per-60 / derived metrics)

- **Intent / contract:** comment web/lib/rankings/skaterWindowAggregation.ts:243 (last-N windows reach into prior season); SKATER_WINDOW_AGGREGATION_REFRESH_SURFACES :165
- **External references:** NST per-60 convention; on-ice GF%/xGF% = For/(For+Against)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/skaterWindowAggregation.test.ts`

### RNK-038 Last-N window games-played / TOI resolution

- **Intent / contract:** comment web/lib/rankings/skaterWindowAggregation.ts:243-244 and :254
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/skaterWindowAggregation.test.ts`

### RNK-039 Rankings splits (strength/window/deployment comparisons)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED beyond code
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/splits.test.ts`; `web/__tests__/pages/api/v1/contextual-rankings-splits.test.ts`

### RNK-040 Trending percentile deltas, trend score & opportunity signals

- **Intent / contract:** OPPORTUNITY_SIGNAL_CONTRACTS in web/lib/rankings/trending.ts; comment :311
- **External references:** Rolling-window form indicators; compare with EWMA or Bayesian updated rates
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/trending.test.ts`; `web/__tests__/pages/api/v1/contextual-rankings-trending.test.ts`

### RNK-041 Team-vs-opponent splits (skater/goalie aggregates, PP share, QS)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Vollman Quality Start (SV% >= league avg, or >= .885 on <=20 shots)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/splits/splitsSurface.test.ts`

### RNK-042 Adjusted-impact promotion readiness gate

- **Intent / contract:** ADJUSTED_IMPACT_PROMOTION_CONTRACT.promotionGate web/lib/rankings/adjustedImpactPromotionContract.ts:73
- **External references:** Evolving-Hockey RAPM (ridge regression on shift stints with score/zone/venue controls)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/adjustedImpactPromotionContract.test.ts`; `web/lib/rankings/defensiveCompositeMethodology.test.ts`

### RNK-043 WAR surface (placeholder, no calculation)

- **Intent / contract:** sourcePendingReason text web/lib/rankings/war.ts:145
- **External references:** Evolving-Hockey GAR/WAR (replacement level, goals-to-wins ~5.5-6 goals/win), TopDownHockey WAR
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/contextual-rankings-war.test.ts`

### RNK-044 Season-decayed player impact priors

- **Intent / contract:** PLAYER_IMPACT_SEASON_DECAY_VERSION 'player_impact_season_decay_v1_current_1_prev_0_65_prev2_0_35_prev3_0_2' (playerImpactRatings.ts:85)
- **External references:** Marcel-style weighting (5/4/3) with regression
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/ratings/playerImpactRatings.test.ts`

### RNK-045 Player impact ratings (skater offense/defense, goalie) — z-score composite with TOI shrinkage

- **Intent / contract:** model versions skater_impact_v1_game_log_toi_shrunk / goalie_impact_v1_game_log_toi_shrunk (playerImpactRatings.ts:83-84); sql/ratings/001_create_analytics_rating_contracts.sql
- **External references:** Evolving-Hockey RAPM/GAR; standard z-score composites with position-specific pools
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/ratings/playerImpactRatings.test.ts`

## Sustainability (SUS)

### SUS-001 matview player_baselines_3yr

- **Intent / contract:** migrations/20250930_add_baseline_3yr_career.sql:1-3 'Sample migration to compute 3yr blended and career aggregates for player_baselines'
- **External references:** Marcel-style 3-year weighting (5/4/3)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### SUS-002 seed sustainability_sigma_constants + model_sustainability_config v1

- **Intent / contract:** migrations/sql/20250928_seed_sigma_constants.sql:1-3 'placeholder baseline approximations'
- **External references:** Tango regression to mean (k shrinkage constants)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### SUS-003 view sustainability_trends_v

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### SUS-004 fn finalize_sustainability_score_snapshot

- **Intent / contract:** supabase/migrations/20260725223034_add_sustainability_version_provenance.sql:1-2 'Make the active TypeScript sustainability pipeline's model/config identity first-class'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/sustainabilityVersionProvenanceMigration.test.ts`

### SUS-005 view vw_entity_sustainability_scores

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/supportedBaselineMigration.test.ts`

### SUS-006 Legacy NST career averages (unweighted mean of season rows)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (only inline comments naming each stat)
- **External references:** Career rates should pool totals (sum G / sum SOG), not average seasonal percentages; Tango regression references for sustainability baselines
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/nst/callerLifecycle.test.ts (lifecycle only)`

### SUS-007 Legacy NST date-window sustainability stats (single player row)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST per-60 convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/SustainabilityStats/[playerId].test.ts`

### SUS-008 Sustainability luck pressure (served)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in route; weights come from lib/sustainability config
- **External references:** Shooting% / on-ice SH% / IPP regression to mean (Tango); PDO luck
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/sustainability/trends.test.ts`; `web/hooks/useDashboardData.test.tsx`

### SUS-009 trendsDebug sustainability-model feature engineering (recent-vs-career z-like, aggregate delta, usage delta) and demo model

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED for the feature formulas (page is a validation/debug console for rolling metrics; recompute notes at web/pages/trendsDebug.tsx:229-239)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/__tests__/pages/trendsDebug.test.tsx`
- **Tests:** `web/__tests__/pages/trendsDebug.test.tsx`

### SUS-010 Sustainability Sandbox band-status streaks, streak intensity and barometer pointer

- **Intent / contract:** web/lib/navigation/analyticsSurfaceOwnership.ts:143 'comparing rolling output against baseline expectation bands and highlighting overperformance or underperformance'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/__tests__/pages/trendsSandbox.test.tsx`
- **Tests:** `web/__tests__/pages/trendsSandbox.test.tsx (barometerPointer presence)`

### SUS-011 Rolling window baselines L3/L5/L10/L20 (mu, sigma per metric)

- **Intent / contract:** Comment aggregations.ts:71-72; migration note 20250930_add_baseline_3yr_career.sql
- **External references:** NST rate conventions; ratio-of-sums vs mean-of-ratios
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/baselines.aggregations.test.ts`; `web/__tests__/pages/api/v1/db/sustainability/rebuild-baselines.test.ts`

### SUS-012 3-year blended and career baselines

- **Intent / contract:** Migration header 20250930_add_baseline_3yr_career.sql:1-4 ('sample migration ... illustrative')
- **External references:** Marcel weighted multi-season baselines
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/baselines.aggregations.test.ts`; `web/__tests__/pages/api/v1/db/sustainability/rebuild-baselines.test.ts`

### SUS-013 Power-play share controls (smoothed PP share, PP1 hysteresis, band widen)

- **Intent / contract:** Comments aggregations.ts:395-446
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/baselines.aggregations.test.ts`; `web/__tests__/pages/api/v1/db/sustainability/rebuild-baselines.test.ts`

### SUS-014 Trend-band baselines (3-season weighted per-60 / percentage / normal)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Marcel-style weighted multi-season baseline
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/bandCalculator.test.ts`; `web/__tests__/pages/api/v1/sustainability/rebuild-trend-bands.test.ts`; `web/__tests__/pages/api/v1/sustainability/trend-bands.test.ts`

### SUS-015 Trend-band comparison deltas vs L5/L10/L20/season/career

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/entitySurfaceServer.test.ts`

### SUS-016 Python synthetic benchmark data generator

- **Intent / contract:** benchmark.py docstring:1-19
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `functions/tests/test_benchmark.py`

### SUS-017 Sustainability backtest metrics (MAE/RMSE/bias, Brier, band hit rate)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Forecast verification (MAE/RMSE, Brier score, interval coverage)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/backtest.test.ts`; `web/lib/sustainability/backtestHarness.test.ts`

### SUS-018 Joined feature row as-of selection

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/dataJoins.test.ts`

### SUS-019 Feature helpers: per-60, per-game, z-score, window weights, weighted rate

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST per-60 convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/features.test.ts`

### SUS-020 Usage and context deltas (TOI, PDO, on-ice SH%, OZS%)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/features.test.ts`

### SUS-021 Python finishing residuals (goals - ixG)

- **Intent / contract:** finishing.py docstring:1-31
- **External references:** Goals above expected vs MoneyPuck/Evolving-Hockey xG
- **Examples / fixtures / test data:** none found
- **Tests:** `functions/tests/test_finishing.py`

### SUS-022 Finishing residuals in baselines (goals - ixG)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Goals above expected (GAx) vs MoneyPuck/Evolving-Hockey xG
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/baselines.aggregations.test.ts`; `web/__tests__/pages/api/v1/db/sustainability/rebuild-baselines.test.ts`

### SUS-023 Legacy NST sustainability stats (S%, xS%, IPP, oiSH%, secA%, SOG/60, oZS%)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST definitions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/SustainabilityStats/[playerId].test.ts`

### SUS-024 Python player multi-season posterior

- **Intent / contract:** functions/lib/sustainability/README.md (offline, non-canonical; TS is canonical)
- **External references:** Beta-binomial EB / Marcel
- **Examples / fixtures / test data:** none found
- **Tests:** `functions/tests/test_player_priors.py`

### SUS-025 Python league Beta priors

- **Intent / contract:** functions/lib/sustainability/README.md (offline, non-canonical; TS is canonical); docstring priors.py:1-27
- **External references:** Beta-binomial EB
- **Examples / fixtures / test data:** none found
- **Tests:** `functions/tests/test_priors.py`

### SUS-026 Empirical-Bayes linear shrinkage (gamma / beta) for features

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Tango regression to mean; Beta-binomial EB
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/features.test.ts`

### SUS-027 Rookie / low-trial prior strengthening fallback

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (name suggests position-league fallback for rookies)
- **External references:** Credibility theory / Tango regression (prior weight vs sample)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/priors.test.ts`

### SUS-028 Player 3-season blended Beta posterior (player priors)

- **Intent / contract:** Comment windows.ts:127 'Each player's pre-season Beta posterior per stat (their last three completed seasons, shrunk to the league prior)'; PRD tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-model.md
- **External references:** Beta-binomial empirical Bayes; Marcel-style 5/4/3 season weighting (here 6/3/1)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/priors.test.ts`; `web/__tests__/pages/api/v1/sustainability/rebuild-priors.test.ts`

### SUS-029 League Beta priors per position (shp, oishp, ipp, ppshp)

- **Intent / contract:** Comment priors.ts:53 'aggregate league means (pooled) for a season + position group'; PRD tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-model.md
- **External references:** Beta-binomial empirical Bayes; Tango regression-to-mean (k = league-average stabilization constant, e.g. sh% ~ 375 shots in community estimates)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/priors.test.ts`; `web/__tests__/pages/api/v1/sustainability/rebuild-priors.test.ts`

### SUS-030 Opponent adjustment factors (defense score, rate multipliers)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Opponent-adjusted projections (e.g. Evolving-Hockey/NST team-defence adjustments)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/features.test.ts`; `web/lib/sustainability/data.test.ts`

### SUS-031 Count projections (Poisson / NB normal-approx bands, 5/10-game horizons)

- **Intent / contract:** SQL check constraints web/sql/sustainability/001_create_sustainability_projections.sql:43-66 (horizon 1-10, band ordering)
- **External references:** Poisson goal/point models; negative binomial overdispersion
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/recompute.test.ts`; `web/lib/sustainability/model.test.ts`; `web/__tests__/pages/api/v1/sustainability/recompute.test.ts`

### SUS-032 Faceoff win% projection bands

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Binomial proportion CI (Wald)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/model.test.ts`

### SUS-033 Python reliability, soft clipping and contributions

- **Intent / contract:** functions/lib/sustainability/README.md (offline, non-canonical; TS is canonical); reliability.py docstring
- **External references:** Spearman-Brown reliability; Tango
- **Examples / fixtures / test data:** none found
- **Tests:** `functions/tests/test_reliability.py`; `functions/tests/test_clipping.py`; `functions/tests/test_contributions.py`

### SUS-034 Python logistic scoring, components and quintiles

- **Intent / contract:** functions/lib/sustainability/README.md (offline, non-canonical; TS is canonical); scoring.py docstring
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `functions/tests/test_scoring.py`; `functions/tests/test_scoring_edge_cases.py`; `functions/tests/test_distribution.py`; `functions/tests/test_full_scoring_pipeline.py`; `functions/tests/test_pipeline.py`; `functions/tests/test_orchestrator.py`

### SUS-035 Sandbox tier labels (durable / balanced / volatile terciles)

- **Intent / contract:** SustainabilityBadge.tsx title 'Descriptive process support index grouped by the supplied score thresholds'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/sustainability/SustainabilityUi.test.tsx`

### SUS-036 Sustainability vs career colour rules

- **Intent / contract:** Comment links GitHub issue #14 (SustainabilityVSCareerChart.tsx:27-28)
- **External references:** PDO/sh% regression heuristics
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### SUS-037 Score distribution snapshot and quintile assignment (TS)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/distribution.test.ts`

### SUS-038 Reason highlights from score components

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/entitySurface.test.ts`; `web/lib/sustainability/read.test.ts`

### SUS-039 Score guardrails (z clamp, s_raw clamp, exact 0/100 check, luck pressure clamp)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED beyond code (runtimeContract constants)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/guardrails.test.ts`

### SUS-040 Hot/normal/cold labelling and calibrated logistic probability model

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Platt scaling; multinomial logistic
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/model.test.ts`

### SUS-041 Composite sustainability score (probability edge) and performance flags

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/model.test.ts`

### SUS-042 Recompute verification and distribution drift

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/observability.test.ts`

### SUS-043 Sustainability leaderboard filters and rookie flag

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/read.test.ts`

### SUS-044 Config identity hashes (TS FNV-1a / Python SHA-256)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/runtimeContract.test.ts`; `web/lib/sustainability/config.test.ts`

### SUS-045 Sustainability process-support score s_raw / s_100 (canonical v3)

- **Intent / contract:** entitySurfaceServer.ts provenance: 'process_support_index' that 'does not measure observed performance against an expectation'; PRD tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-barometer.md
- **External references:** Logistic composite index; compare against Tango regression and PDO regression literature
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/score.test.ts`; `web/lib/sustainability/config.test.ts`; `web/lib/sustainability/runtimeContract.test.ts`; `web/__tests__/pages/api/v1/sustainability/rebuild-score.test.ts`

### SUS-046 Luck pressure (trends sort key)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (dashboard copy)
- **External references:** PDO / sh% regression literature
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/sustainability/trends.test.ts`

### SUS-047 Trend-band per-game samples (gamma/beta/normal collectors)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/bandCalculator.test.ts`

### SUS-048 Gamma / Beta / Normal trend band (value, CI, z, percentile)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (trend-band model v2 constant runtimeContract.ts:5)
- **External references:** Bayesian shrinkage bands; compare with NST rolling averages
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/bandCalculator.test.ts`; `web/__tests__/pages/api/v1/sustainability/rebuild-trend-bands.test.ts`; `web/__tests__/pages/api/v1/sustainability/trend-bands.test.ts`

### SUS-049 Half-life EWMA weights and prior blend

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Exponential smoothing; credibility weighting n/(n+k)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/bandCalculator.test.ts`

### SUS-050 Beta and Gamma posterior credible intervals (incomplete beta/gamma, bisection)

- **Intent / contract:** Comment bands.ts:356-359
- **External references:** Bayesian credible intervals (Beta/Gamma conjugate)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/bandCalculator.test.ts`

### SUS-051 Trend-band metric spec table (half-lives, prior strengths, distributions)

- **Intent / contract:** Comment bands.ts:3-6 'Align with backend column names'
- **External references:** Tango stabilization points per metric
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/bandCalculator.test.ts`

### SUS-052 Python rolling windows GAME/G5/G10/STD

- **Intent / contract:** functions/lib/sustainability/README.md (offline, non-canonical; TS is canonical); docstring windows.py:1-23
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `functions/tests/test_windows.py`

### SUS-053 Skill window per-60 rates

- **Intent / contract:** Comment score.ts:70 'Window rates from game logs (sum counts / sum TOI -> per60)'
- **External references:** NST per-60 convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/score.test.ts`

### SUS-054 Window rolling counts (l3/l5/l10/l20) for luck stats

- **Intent / contract:** Comment windows.ts:61-66 lists the per-stat successes/trials definitions
- **External references:** NST rolling-window convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/windows.test.ts`; `web/__tests__/pages/api/v1/sustainability/rebuild-window-z.test.ts`

### SUS-055 Python z-scores vs posterior with fixed SD constants

- **Intent / contract:** constants.py docstring: 'Values here are placeholders'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `functions/tests/test_zscores.py`

### SUS-056 Reliability weight sqrt(n/(n+k)) and tanh soft clip (TS port)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (mirrors functions/lib/sustainability/reliability.py docstring)
- **External references:** Spearman-Brown / split-half reliability; Tango r=n/(n+k)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/features.test.ts`

### SUS-057 Skill stabilizer league reference (mu, sigma of per-60)

- **Intent / contract:** Comment score.ts:22 'League references (mu, sigma) for each stabilizer stat per season x position group'
- **External references:** NST per-60 convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/score.test.ts`

### SUS-058 Beta-binomial empirical-Bayes window z (eb_z)

- **Intent / contract:** Comment windows.ts:157-160 'z of a window rate s/n against a Beta(alpha0, beta0) baseline, using the beta-binomial predictive spread'
- **External references:** Beta-binomial predictive distribution; Tango regression to the mean
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/windows.test.ts`; `web/__tests__/pages/api/v1/sustainability/rebuild-window-z.test.ts`

## BLSH (Buy Low / Sell High) (BLSH)

### BLSH-001 BLSH current-input qualification gates

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED beyond reason codes (tasks/diaries/2026-10-27-codex-blsh-current-input.md)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/buyLowSellHigh/currentInput.test.ts`; `web/lib/buyLowSellHigh/currentProcessEvidence.server.test.ts`

### BLSH-002 BLSH forecast development comparison (arms P0-P3, gamma transfer, cluster bootstrap)

- **Intent / contract:** forecastEvaluation.ts:1-6 header; tasks/artifacts/blsh-independent-review-2026-10-28/FORECAST-PROPOSAL-v2.md
- **External references:** Forecast verification; paired cluster bootstrap
- **Examples / fixtures / test data:** `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/ORIGINS.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/RESULTS.json`; `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/FORECAST-DEV-V2-REPORT.md`
- **Tests:** `web/lib/buyLowSellHigh/forecastEvaluation.test.ts`; `web/scripts/blsh/forecastDevRun.test.ts`

### BLSH-003 BLSH / Sko watchlists (rebound / cooling by gap sign) and market-reference gap

- **Intent / contract:** market.ts:1-5 and :44-47 comments
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/buyLowSellHigh/market.test.ts`

### BLSH-004 BLSH opportunity split (per-game vs PP/non-PP-rate-adjusted comparison)

- **Intent / contract:** opportunity.ts:33 PERSISTENCE_NOTE; tasks/artifacts/blsh-opportunity-2026-11-04/REPORT.md
- **External references:** Usage-adjusted production (per-60 × TOI); credibility shrinkage of PP rates
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/opportunity.test.ts`

### BLSH-005 BLSH stage 1: per-game production tracks (FHFH FP, G+A, WiGO Game Score)

- **Intent / contract:** productionReference.ts:1-6 header; FHFH Standard comment productionReference.ts:9
- **External references:** Dom Luszczyszyn Game Score (2016) — standard uses 5v5 on-ice GF/GA; Yahoo/ESPN points scoring
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/productionReference.test.ts`; `web/lib/buyLowSellHigh/currentWindows.test.ts`

### BLSH-006 BLSH stage 2b: position cohort production prior (donor moments, signal/noise covariance)

- **Intent / contract:** productionReference.ts:1-6 (port of frozen research estimator position-exposure-reference-gap-v1)
- **External references:** Empirical Bayes / random-effects method-of-moments (multivariate Tango regression)
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/productionReference.test.ts`

### BLSH-007 BLSH stage 2a: recency-weighted personal baseline (arm C)

- **Intent / contract:** productionReference.ts:141-155 comment (TJ decision 1); tasks/artifacts/blsh-baseline-2026-11-04/REPORT.md
- **External references:** Marcel-style season weighting; Kish effective sample size
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/productionReference.test.ts`; `web/scripts/blsh/baselineEvaluation.test.ts`

### BLSH-008 BLSH stage 2c: shrunk personal reference rate

- **Intent / contract:** productionReference.ts:1-6
- **External references:** James-Stein / Tango regression to the mean (multivariate, trace-scalarised)
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/productionReference.test.ts`

### BLSH-009 BLSH stage 3: production gap (normalised expected minus observed, index)

- **Intent / contract:** productionReference.ts:1-6 ('joint moments are working descriptive uncertainty, not calibrated probabilities')
- **External references:** Standardised residual / z-score of observed vs expected (uncalibrated)
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/productionReference.test.ts`; `web/lib/buyLowSellHigh/currentWindows.test.ts`

### BLSH-010 BLSH research state label and window-age text

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/researchSnapshot.test.ts`

### BLSH-011 BLSH stage 4b: conditional process delta (imputation of missing components)

- **Intent / contract:** supportGap.ts:199 comment 'Missing delta components get a labelled linear estimate, never a zero fill'
- **External references:** Gaussian conditional expectation
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/supportGap.test.ts`; `web/lib/buyLowSellHigh/currentWindows.test.ts`

### BLSH-012 BLSH stage 4c: support-conditioned gap score, status and BL/SH list assignment

- **Intent / contract:** supportGap.ts:244 'One current support-conditioned gap; never a trusted or automatic trade flag'; tasks/artifacts/blsh-independent-review-2026-10-28/INDEPENDENT-ASSESSMENT.md
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/supportGap.test.ts`

### BLSH-013 BLSH stage 5: list gates and ranking (BL/SH top 25, ≥20 personal games, 5-game window, FP-gap ordering)

- **Intent / contract:** displayProfile.ts:246-248 comment; tasks/artifacts/blsh-list-gating-2026-11-03, tasks/artifacts/blsh-lists-2026-11-04
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/displayProfile.test.ts`; `web/lib/buyLowSellHigh/researchSnapshot.test.ts`; `web/components/buyLowSellHigh/BlshCandidateLists.test.tsx`

### BLSH-014 BLSH explanation layer (finishing, on-ice finishing, assist share, shots, TOI comparisons)

- **Intent / contract:** supportGap.ts:319-337 comment block (explanation layer v3)
- **External references:** Goals above expected; IPP-like secondary assist share; PDO-style on-ice sh% regression
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/supportGap.test.ts`

### BLSH-015 BLSH stage 4a: process-support sensitivity model (within-player beta, SHRINK 0.5)

- **Intent / contract:** supportGap.ts:1-5 header (port of frozen research scorer support-conditioned-production-gap-v1)
- **External references:** Fixed-effects (within) regression with ridge-like shrinkage
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
- **Tests:** `web/lib/buyLowSellHigh/supportGap.test.ts`

## Trade value (TRD)

### TRD-001 BLSH retrospective trade fallback (recorded FP per game)

- **Intent / contract:** retrospective.ts:1-4 header
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/components/blshTrade/fixtureEvidence.ts`
- **Tests:** `web/components/blshTrade/retrospective.test.ts`

### TRD-002 BLSH trade comparison: forecast league points per side (FHFH Standard or custom)

- **Intent / contract:** trade.ts:1-5 header (FR-10..13 advisory only)
- **External references:** Standard fantasy points scoring
- **Examples / fixtures / test data:** `tasks/artifacts/blsh-trade-2026-11-04`
- **Tests:** `web/lib/buyLowSellHigh/trade.test.ts`; `web/components/blshTrade/BlshTradeComparison.test.tsx`

### TRD-003 Trade analyzer roster capacity and starting-slot coverage

- **Intent / contract:** offer.ts:41 'Applies only an entered exchange and explicit drops. No slot solver or valuation.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/tradeAnalyzer/offer.test.ts`; `web/lib/tradeAnalyzer/slotFeasibility.test.ts`; `web/components/TradeAnalyzer/TradeAnalyzer.test.tsx`

### TRD-004 Trade observation evidence selection (Yahoo trade market sightings)

- **Intent / contract:** observationEvidence.ts:2-7 header
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/tradeValue/observationEvidence.test.ts`

### TRD-005 Trade value components (projected league points, dated ADP; VOR/combined unavailable)

- **Intent / contract:** valuationComponents.ts:5-10 and valuationRequest.ts:7-12 headers; tasks/artifacts/trade-value-pipeline-2026-11-04/PLAN.md
- **External references:** VOR / replacement-level valuation (not implemented)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/tradeValue/valuationComponents.test.ts`; `web/lib/tradeValue/valuationRequest.test.ts`

## Game predictions & odds (GPR)

### GPR-001 Homepage win-probability favoured/underdog tone

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### GPR-002 Start-chart defense ease grade

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Percentile rank with average ties
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/start-chart.test.ts`

### GPR-003 Game stats page moneyline implied win probability with proportional de-vig

- **Intent / contract:** In-code comment 'Normalize probabilities (removing the vig)' (web/pages/stats/game/[gameId].tsx:190)
- **External references:** Standard implied probability from American/decimal odds; proportional (multiplicative) vig removal
- **Examples / fixtures / test data:** `web/__tests__/pages/statsGame.test.tsx`
- **Tests:** `web/__tests__/pages/statsGame.test.tsx`

### GPR-004 Game prediction recent-team-form audit: retrain + goal-differential edge benchmark

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in script (constants only)
- **External references:** Brier/log loss vs naive baselines; market-implied probabilities
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/baselineModel.test.ts`; `web/lib/game-predictions/evaluation.test.ts`

### GPR-005 Game prediction source audit: SQL math-identity and range checks

- **Intent / contract:** check descriptions inline e.g. web/scripts/audit-nhl-game-prediction-sources.ts:1220,1552,2633 ('Gamelog per-60 fields should match count * 3600 / TOI seconds')
- **External references:** NST per-60 convention (count*3600/TOI seconds)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### GPR-006 Simple baseline comparators (bounded edge probability)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Naive forecasts (home-ice prior, standings log5)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/accountability.test.ts`; `web/__tests__/pages/api/v1/game-predictions/accuracy-loop.test.ts`

### GPR-007 Accountability candlesticks and rolling accuracy

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Forecast verification (Brier, log loss)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/accountability.test.ts`; `web/__tests__/pages/api/v1/game-predictions/accuracy-loop.test.ts`

### GPR-008 Feature signal analysis (correlation, mutual information, odds ratios)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Point-biserial correlation; mutual information
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/baselineModel.test.ts`

### GPR-009 Prediction evaluation metrics (log loss, Brier, accuracy, AUC, calibration bins)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Proper scoring rules (log loss, Brier); ROC AUC; reliability diagrams
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/evaluation.test.ts`

### GPR-010 Walk-forward backtest splits and retrain cadence

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Walk-forward / rolling-origin evaluation
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/accountability.test.ts`; `web/__tests__/pages/api/v1/game-predictions/accuracy-loop.test.ts`; `web/lib/game-predictions/workflow.test.ts`

### GPR-011 Prediction health checks and admin health report

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/adminHealth.test.ts`; `web/lib/game-predictions/workflow.test.ts`

### GPR-012 Baseline feature vector transform (53 home-minus-away keys)

- **Intent / contract:** Leakage rules per key in buildBaselineFeatureLeakageChecks (baselineModel.ts:432): strict_before_game_date; candidate-only features excluded 'until ablation evidence supports promotion' (baselineModel.ts:457)
- **External references:** Standard feature engineering for logistic game models (difference features, z-scoring)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/baselineModel.test.ts`

### GPR-013 FORGE team projection features

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`

### GPR-014 Roster-prior vs current-form blend weights

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Bayesian prior/likelihood blending; Tango regression to mean
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`

### GPR-015 Season phase derivation

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`; `web/lib/game-predictions/evaluation.test.ts`

### GPR-016 Source freshness / staleness flags

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`; `web/lib/predictions/contracts.test.ts`

### GPR-017 Rest / back-to-back schedule features

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Rest-advantage effects in NHL (back-to-back road penalty ~ -0.1 goals)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`

### GPR-018 Team power rating difference features

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`

### GPR-019 Recent team form windows (last 5/10/20/40, season-to-date, cross-season prior)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST all-situations team counts; ratio-of-sums convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`; `web/lib/game-predictions/teamGameNormalization.test.ts`

### GPR-020 Roster impact (TOI-weighted player impact ratings)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Lineup-weighted player ratings (e.g. Evolving-Hockey GAR/WAR team sums)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/rosterImpact.test.ts`

### GPR-021 Team game fact normalization (cumulative-difference derivation)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/teamGameNormalization.test.ts`

### GPR-022 Goalie start blend and start uncertainty

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Goalie GSAx/60 (MoneyPuck, Evolving-Hockey); starter probability models
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`

### GPR-023 Goalie workload context

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`

### GPR-024 Past-opponent schedule strength (last 5/10 opponents composite power)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** RPI-style OWP / opponent-strength SOS
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`

### GPR-025 Opponent-adjusted recent form (SOS-adjusted GD and xGF%)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Opponent-adjusted ratings (e.g. SRS / ridge-adjusted team ratings)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`

### GPR-026 Game Grid Poisson heatmap tie-breaker matrix

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Poisson score matrix
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/utils/calcWinOdds.test.js`

### GPR-027 Game page Poisson score distribution (client)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Poisson / Dixon-Coles goal models with attack x defence x home-ice
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### GPR-028 Legacy Poisson game goal projection (att x def x league avg) and win odds

- **Intent / contract:** 'Legacy game-goal projection calculations... not shot-level hockey xG' (calculations.ts:1, 26-30)
- **External references:** Maher / Dixon-Coles bivariate Poisson; Skellam for goal difference; vig removal
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### GPR-029 Probability blend variants (training home prior, GD anchor, standings anchor)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Shrinkage toward prior / ensemble averaging
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/accountability.test.ts`; `web/__tests__/pages/api/v1/game-predictions/accuracy-loop.test.ts`

### GPR-030 Probability calibration in backtests (Platt / isotonic)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Platt scaling; isotonic regression (fit on held-out data)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/accountability.test.ts`; `web/__tests__/pages/api/v1/game-predictions/accuracy-loop.test.ts`

### GPR-031 Training season recency weight

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/accountability.test.ts`; `web/__tests__/pages/api/v1/game-predictions/accuracy-loop.test.ts`

### GPR-032 ExtraTrees candidate model

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Geurts et al. Extremely Randomized Trees (sklearn ExtraTreesClassifier)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/baselineModel.test.ts`

### GPR-033 Top factors / explanation contributions

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Linear-model attribution (coef*x)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/baselineModel.test.ts`; `web/lib/game-predictions/publicPredictions.test.ts`

### GPR-034 Probability floor, rounding, winner threshold, confidence label, market edge bucket

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/baselineModel.test.ts`

### GPR-035 Data-quality dampening toward 50%

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Ad hoc shrinkage; compare with calibrated uncertainty (Platt/isotonic) rather than fixed penalties
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/baselineModel.test.ts`

### GPR-036 Training-set feature standardization

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Standard scaling (sklearn StandardScaler)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/baselineModel.test.ts`

### GPR-037 Regularized logistic training (candidate/backtest)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Regularized logistic regression
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/baselineModel.test.ts`; `web/lib/game-predictions/accountability.test.ts`; `web/__tests__/pages/api/v1/game-predictions/accuracy-loop.test.ts`

### GPR-038 Served pregame home-win probability (INITIAL_BASELINE_MODEL hand-weighted logistic)

- **Intent / contract:** Pregame win probability with refresh windows 24/6/1 h before start (workflow.ts:34 PREGAME_PREDICTION_REFRESH_POLICY); runbook tasks/artifacts/forge-prediction-operator-runbook.md
- **External references:** Fitted logistic/Elo-style win models (e.g. MoneyPuck, Evolving-Hockey game models); Elo home-ice term ~ +0.08–0.10 logit / ~54-55% home win rate
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-game-prediction-supabase-source-audit.md`
- **Tests:** `web/lib/game-predictions/baselineModel.test.ts`; `web/lib/game-predictions/workflow.test.ts`; `web/__tests__/pages/api/v1/game-predictions/forecast.test.ts`; `web/__tests__/pages/api/v1/game-predictions/generate.test.ts`

### GPR-039 Game preview odds bar (ESPN/NHL odds implied probability)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Proportional vig removal
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GamePreview/GamePreview.test.tsx`

### GPR-040 American odds -> implied probability and no-vig (proportional) normalization

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Standard multiplicative vig removal; alternatives Shin / power method
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/espnOdds.test.ts`; `web/__tests__/pages/api/v1/game-predictions/ingest-espn-odds.test.ts`; `web/__tests__/pages/api/v1/game-predictions/import-market-odds.test.ts`

### GPR-041 Market odds snapshot selection (pre-cutoff)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/featureBuilder.test.ts`; `web/lib/game-predictions/espnOdds.test.ts`

### GPR-042 Promotion gate and segment regression guardrails

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/game-predictions/workflow.test.ts`; `web/__tests__/pages/api/v1/game-predictions/promote-model-version.test.ts`; `web/lib/game-predictions/accountability.test.ts`; `web/__tests__/pages/api/v1/game-predictions/accuracy-loop.test.ts`

## sKO (SKO)

### SKO-001 matview analytics.mv_sko_skater_moments

- **Intent / contract:** tasks/TASKS/sko-charts/sko-ownership-contract.md (per legacyQuarantine.ts:18)
- **External references:** robust z (median/MAD, 1.4826 consistency constant)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/supportedBaselineMigration.test.ts`

### SKO-002 view analytics.vw_sko_skater_zscores

- **Intent / contract:** web/sql/views/analytics.vw_sko_skater_zscores.sql:2 'EB z-score view ... with shrinkage for ixG metrics'
- **External references:** empirical Bayes shrinkage (kappa pseudo-games)
- **Examples / fixtures / test data:** `web/sql/tests/sko_trends_validation.sql`
- **Tests:** `web/sql/tests/sko_trends_validation.sql`; `web/lib/supabase/supportedBaselineMigration.test.ts`

### SKO-003 view analytics.vw_sko_skater_scores

- **Intent / contract:** web/sql/views/analytics.vw_sko_skater_scores.sql:2 'Applies ridge weights to z-scores and bounds via tanh'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/sql/tests/sko_trends_validation.sql`
- **Tests:** `web/sql/tests/sko_trends_validation.sql`; `web/lib/supabase/supportedBaselineMigration.test.ts`

### SKO-004 fn analytics.rpc_sko_player_series (+ public wrapper)

- **Intent / contract:** web/sql/functions/public.rpc_sko_player_series.sql:2 'Wrapper to expose analytics RPC'; contract tasks/TASKS/sko-charts/sko-ownership-contract.md
- **External references:** EWMA control chart / CUSUM-like streak detection
- **Examples / fixtures / test data:** `web/sql/tests/sko_trends_validation.sql`
- **Tests:** `web/sql/tests/sko_trends_validation.sql`; `web/lib/supabase/supportedBaselineMigration.test.ts`

### SKO-005 sKO skater stats row derivations (IPP, SOG/60)

- **Intent / contract:** docs/player-projections/duplicate-retirement-ledger.md RET-006
- **External references:** IPP = points / on-ice GF
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-sko-stats.test.ts`

### SKO-006 sKO points prediction (moving-average blend with volatility penalty)

- **Intent / contract:** Comment update-predictions-sko.ts:316-317 (0 average is a real scoreless stretch, no fallback to longer window, v0.2 did); docs/player-projections/duplicate-retirement-ledger.md RET-005; tasks/TASKS/sko-charts/sko-ownership-contract.md
- **External references:** Weighted moving average baseline; Marcel-style regression would add a league prior
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts`

### SKO-007 Sko Element: personal reference block change and outlook change

- **Intent / contract:** Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
- **Tests:** `web/lib/skoElement/interpret.test.ts`; `web/components/skoElement/SkoElementPreview.test.tsx`

### SKO-008 Sko Element: sustainability gap D and direction (Rebound/Cooling)

- **Intent / contract:** Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
- **External references:** Regression-to-expectation diagnostics (actual vs expected)
- **Examples / fixtures / test data:** `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
- **Tests:** `web/lib/skoElement/interpret.test.ts`; `web/components/skoElement/SkoElementPreview.test.tsx`

### SKO-009 Sko Element: IPP observed vs class reference

- **Intent / contract:** Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
- **External references:** NST IPP; position IPP norms (~70% F, ~40% D at 5v5)
- **Examples / fixtures / test data:** `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
- **Tests:** `web/lib/skoElement/interpret.test.ts`; `web/components/skoElement/SkoElementPreview.test.tsx`

### SKO-010 Sko Element: observed per-team-game and per-appearance rates

- **Intent / contract:** Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
- **Tests:** `web/lib/skoElement/interpret.test.ts`; `web/components/skoElement/SkoElementPreview.test.tsx`

### SKO-011 Sko Element: weighted league-points gap

- **Intent / contract:** Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
- **Tests:** `web/lib/skoElement/interpret.test.ts`; `web/components/skoElement/SkoElementPreview.test.tsx`; `web/lib/buyLowSellHigh/market.test.ts`

### SKO-012 Sko Element: opportunity change classification (TOI / PP TOI)

- **Intent / contract:** Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
- **Tests:** `web/lib/skoElement/interpret.test.ts`; `web/components/skoElement/SkoElementPreview.test.tsx`

### SKO-013 Sko Element: observed variability (sample SD)

- **Intent / contract:** Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
- **Tests:** `web/lib/skoElement/interpret.test.ts`; `web/components/skoElement/SkoElementPreview.test.tsx`

### SKO-014 Sko Element: FORGE expected per scheduled team game and conditional per appearance

- **Intent / contract:** Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
- **Tests:** `web/lib/skoElement/interpret.test.ts`; `web/components/skoElement/SkoElementPreview.test.tsx`

### SKO-015 sKO gap helpers: sustainabilityGap, displayScore (tanh), rateFromTotals, watchLabel

- **Intent / contract:** 'Pure SKO/VuDu Phase 0 descriptive gap math (new contract)' (web/lib/predictions/legacyQuarantine.ts:120)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sko/gap.test.ts`

### SKO-016 Legacy sKO stat weights (inverse ratings)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/utils/legacySko.test.ts`

### SKO-017 Legacy sKO confidence multiplier and empirical thresholds

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/utils/legacySko.test.ts`

### SKO-018 Legacy sKO characteristic-game classification (weighted squared z)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Chi-square-style weighted Mahalanobis distance
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/utils/legacySko.test.ts`

### SKO-019 Legacy sKO Game Score

- **Intent / contract:** web/lib/supabase/utils/calculations.ts:3-6 ('Legacy sKO-only game-score helper... remains for lineage and quarantine-era reference only')
- **External references:** Dom Luszczyszyn Game Score (2016): same coefficients but CF/CA and GF/GA are 5v5 on-ice
- **Examples / fixtures / test data:** `web/lib/supabase/utils/legacySko.test.ts`
- **Tests:** `web/lib/supabase/utils/legacySko.test.ts`

### SKO-020 sKO skater stat ingestion derived fields (IPP, SOG/60)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST IPP (individual points / on-ice GF, all situations)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-sko-stats.test.ts`; `web/__tests__/pages/api/v1/db/update-sko-stats.route.test.ts`

### SKO-021 sKO leaderboard overall accuracy (sample-weighted hit rate)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### SKO-022 sKO stability statistic (stability_cv)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Coefficient of variation = SD/mean
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts`; `web/__tests__/pages/api/v1/ml/get-predictions-sko.test.ts`

### SKO-023 sKO stability multiplier (smoothstep 0.8-1.0)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts`; `web/__tests__/pages/api/v1/ml/get-predictions-sko.test.ts`

### SKO-024 sKO prediction: recent points blend (pred_points)

- **Intent / contract:** sKO = Prediction x Stability (web/components/Predictions/SkoExplainer.tsx:11)
- **External references:** Marcel-style weighted averages with regression to mean (Tango)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts`; `web/__tests__/pages/api/v1/ml/get-predictions-sko.test.ts`

### SKO-025 sKO score (pred_points x stability)

- **Intent / contract:** SkoExplainer.tsx:6-11 'Sustainability K-Value Outlook ... sKO = Prediction x Stability'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts`; `web/__tests__/pages/api/v1/ml/get-predictions-sko.test.ts`

### SKO-026 combineSKO / computeLuck (trends utils)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

## VuDu (VUDU)

### VUDU-001 VuDu save gap (expected SV prob minus recent SV%)

- **Intent / contract:** VuDu = goalie side of the sKO contract; gap awaits accepted goalie adapter (interpret.ts:188; blsh-sko-vudu-audit-2026-11-04.md:32)
- **External references:** GSAx per shot / dFSV% (MoneyPuck, Evolving-Hockey); Fenwick-based xSV% must not be compared with ordinary SV%
- **Examples / fixtures / test data:** `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
- **Tests:** `web/lib/sko/gap.test.ts`

### VUDU-002 VuDu observed goalie results (SV%, GAA, starts, start share)

- **Intent / contract:** interpret.ts:188 VuDu gaps await goalie adapter; ratios shown as context only
- **External references:** NHL SV% and GAA definitions
- **Examples / fixtures / test data:** `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
- **Tests:** `web/lib/skoElement/interpret.test.ts`; `web/components/skoElement/SkoElementPreview.test.tsx`

### VUDU-003 VuDu expected goalie ratios and gap status

- **Intent / contract:** interpret.ts:188
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
- **Tests:** `web/lib/skoElement/interpret.test.ts`; `web/components/skoElement/SkoElementPreview.test.tsx`

## Team ratings / power / CTPI / SOS (TEAM)

### TEAM-001 matview team_power_ratings_daily__new (sql/001)

- **Intent / contract:** sql/001_team_power_ratings.sql inline comments ('Build NEW MV with NO DATA'); sql/refresh_example.sql
- **External references:** Elo/SRS-style team ratings; EWMA; empirical-Bayes shrinkage
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-team-power-ratings-new.test.ts`

### TEAM-002 view nhl_team_data

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/fixtures/native-player-offline-synthetic.json`
- **Tests:** `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/projections/run-forge-projections.local-attempt.test.ts`

### TEAM-003 views nst_avg_all / nst_avg_5v5 / nst_avg_pk / nst_avg_pp

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST team percentages = sum(for)/(sum(for)+sum(against))
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-004 views nst_{all,5v5,pk,pp}_team_per_game

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-005 view nst_league_averages

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-006 views nst_{all,5v5,pk,pp}_team_differentials

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-007 view nst_att_def_scores

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Dixon-Coles / Poisson attack-defense strength ratios (team rate / league rate)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-008 view nst_team_scores_all_strengths

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-009 view power_rankings

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-power-rankings.test.ts`

### TEAM-010 views vw_team_strength_state_daily / vw_team_strength_state_daily_norm

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST per-60
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-011 trigger fn update_team_discipline_stats (+ populate script)

- **Intent / contract:** migrations/20251126_populate_team_discipline_stats.sql:1-2 'Populate team_discipline_stats ... self-join ... to get opponent metrics'
- **External references:** NST/NHL per-60 convention (count*3600/TOI seconds)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-012 view combined_sos

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** SOS = mean opponent points% (opponent's, not own)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-013 Team power card trend and matchup tone thresholds

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-014 Underlying stats team rating bar width (70–130 window)

- **Intent / contract:** UnderlyingStatsDashboard.tsx:55 comment: league-average ratings sit at 100; map roughly 70-130
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-015 Team power ratings daily writer (PP/PK tiers and carry-forward)

- **Intent / contract:** Comment at update-team-power-ratings.ts:160 (shared trend lookback keeps last played-game snapshots in offseason); version constant line 29
- **External references:** Tercile tiering; EWMA/z-score composite (see lib/power-ratings audit)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`

### TEAM-016 Opponent record strength-of-schedule tally

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** RPI/OWP: opponents' winning percentage excluding games against the team; NHL points% convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts (wrapper only)`; `web/__tests__/pages/api/v1/trends/team-sos.test.ts (reader)`

### TEAM-017 Underlying-stats landing popover component z-scores and special-teams bonus (client-side)

- **Intent / contract:** In-page copy: 'Power Score averages offense, defense, and pace, then adds a small PP/PK tier bonus' (web/pages/underlying-stats/index.tsx:836)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/__tests__/pages/underlying-stats/index.test.tsx (asserts 'xGF/60: 3.10 vs league 3.10')`
- **Tests:** `web/__tests__/pages/underlying-stats/index.test.tsx`

### TEAM-018 CTPI audit re-derivation (single-date reconciliation)

- **Intent / contract:** formulaContract object in web/scripts/audit-ctpi-formula.ts:640-650 and notes 'read-only CTPI audit'
- **External references:** z-score composite team power ratings; compare against lib/trends/ctpi
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/trends/ctpi.test.ts`; `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`

### TEAM-019 CTPI forward-association test (predictive validity)

- **Intent / contract:** output note at web/scripts/audit-ctpi-formula.ts:758 ('unadjusted descriptive diagnostics')
- **External references:** out-of-sample predictive validity of team strength metrics
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-020 CTPI multiseason audit: legacy vs recent-team-form v2 candidate

- **Intent / contract:** web/scripts/audit-ctpi-multiseason.ts:847-894 method descriptions
- **External references:** Fisher z CI; Spearman rank correlation
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/nst/callerLifecycle.test.ts (NST caller registration only)`

### TEAM-021 CTPI delta and spark series

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/dashboard/teamContext.test.ts`; `web/lib/trends/ctpi.test.ts`; `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`; `web/__tests__/pages/api/v1/trends/team-ctpi.test.ts`

### TEAM-022 CTPI recent-form inputs (linear-weighted last 10 games)

- **Intent / contract:** CTPI should track/predict next-N goal and xG differential (web/scripts/audit-ctpi-formula.ts:352-409 correlates CTPI with next{N}GoalDifferential); reviews in tasks/artifacts/ctpi-independent-review-2026-10-22
- **External references:** Linearly weighted moving average
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/trends/ctpi.test.ts`; `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`; `web/__tests__/pages/api/v1/trends/team-ctpi.test.ts`

### TEAM-023 CTPI composite (Current Team Performance Index) and 0-100 mapping

- **Intent / contract:** CTPI should track/predict next-N goal and xG differential (web/scripts/audit-ctpi-formula.ts:352-409 correlates CTPI with next{N}GoalDifferential); reviews in tasks/artifacts/ctpi-independent-review-2026-10-22
- **External references:** Composite power indices; PDO regresses to 1.000 (should not be rewarded)
- **Examples / fixtures / test data:** `tasks/artifacts/ctpi-duplicate-upsert-audit-2026-10-22`; `tasks/artifacts/ctpi-independent-review-2026-10-22`
- **Tests:** `web/lib/trends/ctpi.test.ts`; `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`; `web/__tests__/pages/api/v1/trends/team-ctpi.test.ts`

### TEAM-024 Recent Team Form v2 candidate (bounded, coverage-aware CTPI)

- **Intent / contract:** CTPI should track/predict next-N goal and xG differential (web/scripts/audit-ctpi-formula.ts:352-409 correlates CTPI with next{N}GoalDifferential); reviews in tasks/artifacts/ctpi-independent-review-2026-10-22
- **External references:** Kish effective sample size; logistic squashing
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/trends/ctpi.test.ts`; `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`; `web/__tests__/pages/api/v1/trends/team-ctpi.test.ts`

### TEAM-025 Dashboard freshness thresholds and insight tone bands

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/dashboard/freshness.test.ts`

### TEAM-026 Top Adds candidate score

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/dashboard/topAddsRanking.test.ts`; `web/components/forge-dashboard/TopAddsRail.test.tsx`

### TEAM-027 Top Adds schedule context (games and off-nights remaining)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Fantasy off-night convention (<= 8 games)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/dashboard/topAddsScheduleContext.test.ts`

### TEAM-028 Legacy SQL team power ratings materialized view

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-team-power-ratings-new.test.ts`

### TEAM-029 Team power score and matchup edge

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/dashboard/teamContext.test.ts`

### TEAM-030 Power ratings: per-60 game log assembly (all and 5v5)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST per-60 convention (count*3600/TOI seconds)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/power-ratings.test.ts`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`

### TEAM-031 Power ratings: EWMA of team rates (half-life 10, 25-game window)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Exponentially weighted moving average (half-life parametrization)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/power-ratings.test.ts`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`

### TEAM-032 Power ratings: league distribution, early-season blend, z-scores

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Z-score standardization; Bayesian shrinkage to league mean
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/power-ratings.test.ts`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`

### TEAM-033 Power ratings: offense / defense / pace ratings (100 + 15z)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** IQ-style 100/15 scaling; xG-weighted team ratings (MoneyPuck/Evolving-Hockey team xGF/60)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/power-ratings.test.ts`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`

### TEAM-034 Power ratings: finishing, goalie, danger, special, discipline ratings and variance flag

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** GSAx (team) for goalie; PDO regression
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/power-ratings.test.ts`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`

### TEAM-035 Legacy power rankings store (season/L10 aggregates, ranks, SOS)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-power-rankings.test.ts`

### TEAM-036 Team form context: power-score trend delta and PDO variance

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/power-ratings.test.ts`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`

### TEAM-037 Power ratings: PP/PK tiers (tertiles) and trend10

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/power-ratings.test.ts`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`

### TEAM-038 Power ratings: carry-forward for teams without a game

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/power-ratings.test.ts`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`

### TEAM-039 Legacy SOS standings loader (sosStandings.js)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-040 Opponent strength band (strong/average/weak tertiles)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/teamOpponentStrength.test.ts`

### TEAM-041 SOS ratings (win% of opponents; combined sosScore)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** RPI-style OWP/OOWP; points% SOS
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/trends/strengthOfSchedule.test.ts`; `web/__tests__/pages/api/v1/trends/team-sos.test.ts`

### TEAM-042 Descriptive SOS contract (direct and indirect, as-known-then)

- **Intent / contract:** 'Event-level research contract. Legacy aggregate snapshots cannot satisfy it.' (strengthOfScheduleContract.ts:1)
- **External references:** NCAA RPI OWP/OOWP
- **Examples / fixtures / test data:** `tasks/artifacts/sos-candidate-2026-10-23`
- **Tests:** `web/lib/trends/strengthOfSchedule.test.ts`; `web/__tests__/pages/api/v1/trends/team-sos.test.ts`

### TEAM-043 SOS writer: opponents' current W/L/OTL totals (past and future)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** RPI OWP (opponents' win% excluding games vs the team) and OOWP
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### TEAM-044 Score-state shot share averages (GameStateAnalysis)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Score-state shot shares (ratio of sums preferred)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameStateAnalysis/GameStateAnalysis.test.tsx`

### TEAM-045 Team L10 metrics and L5-vs-L10 trends (AdvancedL10Metrics)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/TeamDashboard/AdvancedL10Metrics.test.tsx`

### TEAM-046 Game-by-game performance score (GameByGameTimeline)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/TeamDashboard/GameByGameTimeline.test.tsx`

### TEAM-047 Team dashboard season aggregates, goalie totals and league ranks

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/TeamDashboard/TeamDashboard.test.tsx`

### TEAM-048 Team leaders BSH (blocks + shots + hits)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/TeamDashboard/TeamLeaders.test.tsx`

### TEAM-049 Team standings chart rolling averages

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/TeamStandingsChart/TeamStandingsChart.test.tsx`; `web/components/TeamStandingsChart/metricUtils.test.ts`; `web/components/TeamStandingsChart/chartUtils.test.ts`

### TEAM-050 Team share aggregation (CF%, xGF%, HDCF%, SCF%, SH%, SV%, PDO)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST ratio-of-sums; PDO = on-ice SH% + SV%
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/stats/percentUnits.test.ts`; `web/components/GameStateAnalysis/GameStateAnalysis.test.tsx`

### TEAM-051 Team trend category percentiles (offense/defense/PP/PK by game number)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Percentile ranks
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/trends/team-power.test.ts`

### TEAM-052 Trend utilities: percentile, winsorize, pearson, regression, hot/cold streaks

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/trends/trendsSurface.test.ts`

### TEAM-053 Goalie trend confidence and volatility

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/trends/goalieMetricConfig.test.ts`; `web/__tests__/pages/api/v1/trends/goalie-power.test.ts`

### TEAM-054 Player trend records (cumulative mean, rolling 3/5/10, variance)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/trends/playerTrendCalculator.test.ts`; `web/__tests__/pages/api/v1/trends/player-trends.test.ts`

## Underlying stats summaries (UST)

### UST-001 NST team table header normalization and percentage validation

- **Intent / contract:** docstring web/scripts and functions copies: 'Replace /60 with _perSixty and % with Pct'
- **External references:** NST team table
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-002 view goalie_totals_unified (+ matview goalie_totals_unified_snapshot)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL GAA = GA*3600/TOI seconds; NST goalie per-60
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-003 view goalie_weekly_aggregates

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL GAA/sv% conventions
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-004 view league_weekly_goalie_averages

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-005 fn get_skater_game_scores_for_season

- **Intent / contract:** **UNDOCUMENTED** — supabase/migrations/20260716112908_production_schema_baseline.sql:1353 comment 'Your existing game_score calculation remains unchanged' (no spec); UNDOCUMENTED otherwise
- **External references:** Dom Luszczyszyn Game Score (2016): same weights, but CF/CA and GF/GA are 5v5 on-ice
- **Examples / fixtures / test data:** `web/e2e/fixtures/wigo/wigoFixtures.ts`
- **Tests:** `web/components/WiGO/GameScoreLineChart/index.test.tsx`

### UST-006 fn get_skaters_avg_stats

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/fixtures/wigo/wigoFixtures.ts`
- **Tests:** `web/hooks/usePercentileRank.test.tsx`

### UST-007 views nst_seasonlong_{es,pk,pp,as}_counts and _counts_oi

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (baseline pg_dump)
- **External references:** Natural Stat Trick season totals
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/nst/radarSeasonStats.test.ts`

### UST-008 views nst_seasonlong_{es,pk,pp,as}_rates and _rates_oi

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST per-60 and share conventions; NST OZS% excludes neutral-zone starts
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-009 views nst_percentile_{es,pk,pp}_{offense,defense}_filtered

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** percent_rank / cume_dist; mid-rank = (count(<) + 0.5*count(=))/N
- **Examples / fixtures / test data:** `web/e2e/fixtures/wigo/schema.json`
- **Tests:** none found

### UST-010 views nst_seasonlong_combined_{es,pk,pp}

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST per-60
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-011 matview player_totals_unified (internal_stats) + wrapper view

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (baseline pg_dump); privatize migration header documents storage move only
- **External references:** NST per-60 and on-ice share definitions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sustainability/score.test.ts`; `web/lib/supabase/supportedBaselineMigration.test.ts`; `web/__tests__/pages/api/v1/db/cron-report.test.ts`

### UST-012 views wgo_skater_stats_per_game / wgo_goalie_stats_per_game

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/PlayerStats/PlayerRadarChart.test.tsx`; `web/lib/nst/radarSeasonStats.test.ts`

### UST-013 fn get_aggregated_player_stats

- **Intent / contract:** supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:1-6 'Preserve the read-only aggregate RPC contract and repair only its result typing'
- **External references:** PDO = on-ice SH% + on-ice SV% (NST/Corsica convention, ~100 or ~1.000)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/supportedBaselineMigration.test.ts`

### UST-014 Goalie leaderboard percent colour bands and fPts diff vs league

- **Intent / contract:** GoalieLeaderboard.tsx:253 help text: Avg %ile shows overall statistical rank vs peers
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/trueGoalieValue.test.tsx`

### UST-015 Team roster matrix heat shade (min-max of sorted column)

- **Intent / contract:** RosterMatrix.tsx:352 comment: shade = rank between lowest and highest value (GAA lower-is-better)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-016 Team roster matrix goalie gamelog aggregation (SV%, GAA, HD/MD/LD SV%)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL SV%/GAA convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/TeamTabNavigation/TeamTabNavigation.test.tsx`

### UST-017 Legacy NST three-year and career count averages (ThreeYearAverages)

- **Intent / contract:** Code comment at web/pages/api/ThreeYearAverages/[playerId].ts:~648 'Computes three-year averages for counting stats without strictly requiring TOT rows'; no product doc found
- **External references:** NST per-60 convention (count / TOI minutes * 60); IPP = points / on-ice GF
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/nst/callerLifecycle.test.ts (lifecycle only, not math)`

### UST-018 Legacy NST three-year and career rate averages (per-60) with TOT rate rows

- **Intent / contract:** Code comment at web/pages/api/ThreeYearAverages/[playerId].ts:~474 'Aggregates multiple team entries per season into a TOT row for yearlyRates. Computes percentages using specified formulas instead of averaging.'
- **External references:** TOI-weighted pooling of per-60 rates (sum counts / sum TOI), as NST and Evolving-Hockey do for multi-season views
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-019 NST scrape cell normalization (TOI to seconds, dashes, percents)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (NST rate limits documented in AGENTS.md, not parsing)
- **External references:** NST definitions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/cron/nstClassification.test.ts`; `web/lib/routeRunner/tick.test.ts`

### UST-020 WGO/NST three-year and career average table (wgo_avg_three_year / wgo_avg_career)

- **Intent / contract:** Inline comments update-wgo-averages.ts (denominator excludes neutral zone and on-the-fly starts)
- **External references:** NST pooled per-60 and share conventions; PDO*1000 convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-wgo-averages.route.test.ts`

### UST-021 WGO career and three-year average aggregator (legacy)

- **Intent / contract:** file header 'Opt-in legacy WGO averages maintenance script' (web/scripts/WGOAverages/calculateAverages.ts:1)
- **External references:** NST per-60 convention (all-situation TOI)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/WGOAverages/calculateAverages.test.ts`

### UST-022 Stats/goalie page client-side display derivations (grouped)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/StatsPage/MobileTabInterface.test.tsx`; `web/components/StatsPage/LeaderboardCategoryGoalie.test.tsx`

### UST-023 Goalie danger-split goals-against and xG-against accumulation

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-goalie-underlying-stats-landing-page.md:38 ('danger-split shots, saves, goals against, save percentages, GAA, and GSAA')
- **External references:** NST goalie HDSV%/HDGA; GSAx by danger
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:560-1160 persisted summary fixtures with md/ldGoalsAgainst`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts (danger goals appear only as zero/one-valued fixture fields at :662-1037)`

### UST-024 Goalie save %, GAA, 'GSAA' and danger-split save metrics

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-goalie-underlying-stats-landing-page.md:36-38,200-219 (GSAA, xG Against, HD/MD/LD GSAA) — PRD does not define GSAA as xGA-GA
- **External references:** NST/MoneyPuck GSAx = xGA - GA; GSAA (Hockey-Reference) = SA*(1 - league SV%) - GA
- **Examples / fixtures / test data:** `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsLanding_Audit.md`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md`
- **Tests:** `web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId].test.ts`; `web/lib/underlying-stats/goalieStatsServer.test.ts`

### UST-025 Goalie advanced NST metrics by strength (GSAA, xGA/60, HDSA/60, distances, QS%)

- **Intent / contract:** tasks/TASKS/variance/v2/prd-variance-goalies-skaters-second-pass.md:5 ('a real advanced goalie Metrics table')
- **External references:** NST goalie GSAA and per-60 conventions; HDSV%
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GoaliePage/goalieMetrics.test.ts`

### UST-026 Goalie metrics leader groups and variance relative display

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GoaliePage/goalieMetrics.test.ts`

### UST-027 Goalie value tier score (Tier 1-5)

- **Intent / contract:** tasks/TASKS/variance/v2/prd-variance-goalies-skaters-second-pass.md:20,31,94-107 (explainable tier from production, consistency, workload, start confidence)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GoaliePage/goalieMetrics.test.ts`

### UST-028 Goalie variance fantasy points, overall SV% and GAA

- **Intent / contract:** tasks/TASKS/variance/v1/prd/prd-variance-section.md; defaults web/lib/projectionsConfig/fantasyPointsConfig.ts:25-29
- **External references:** NHL.com SV% and GAA (GA*60/TOI min)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GoaliePage/goalieCalculations.test.ts`; `web/__tests__/pages/trueGoalieValue.test.tsx`

### UST-029 Goalie week-over-week (WoW) ranking vs league average

- **Intent / contract:** web/components/GoaliePage/goalieCalculations.ts:18-19,37 comments ('Keep for WoW ranking')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GoaliePage/goalieCalculations.test.ts`

### UST-030 Goalie variance percentile ranks and average percentile

- **Intent / contract:** web/components/GoaliePage/goalieCalculations.ts:298-309 comments (percentile rank formula)
- **External references:** Midrank percentile
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GoaliePage/goalieCalculations.test.ts`

### UST-031 Goalie consistency score

- **Intent / contract:** web/components/GoaliePage/goalieMetrics.ts:481 column tooltip '0-100 stability score across eligible weekly quality bands'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GoaliePage/goalieCalculations.test.ts`

### UST-032 Goalie page weekly league averages

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** League SV% = total saves / total shots against; GAA = GA*60/minutes
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-033 Goalie season ranking points (weekly tier tally)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-034 Goalie weekly ranking tier (beats-average count)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (inline comment calculateRanking.ts:20 'For percentages, higher is better' contradicts GAA semantics)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-035 Goalie page week windows and weekly pipeline

- **Intent / contract:** web/lib/supabase/GoaliePage/goaliePageWeeks.js:14-17 ('Week 1: Season start to the first Sunday. Weeks 2+: Monday to Sunday')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-036 NHL Edge metric ingestion and snapshot freshness gate

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (no intent comment for units/percentile scale; contract shape defined in web/lib/NHL/edgeFeatureContract.ts:45-136)
- **External references:** NHL Edge definitions (NHL.com); percentile scale as published by NHL Edge
- **Examples / fixtures / test data:** `web/lib/NHL/edgeIngestion.test.ts (inline Edge payload samples)`
- **Tests:** `web/lib/NHL/edgeIngestion.test.ts`; `web/lib/NHL/edgeFeatureContract.test.ts`; `web/__tests__/pages/api/v1/db/update-nhl-edge-stats.test.ts`

### UST-037 Declared percent units and ratio helpers

- **Intent / contract:** web/lib/stats/percentUnits.ts:1-4 ('callers must say which unit a source field uses; magnitude is never used to guess')
- **External references:** Ratio-of-sums aggregation convention
- **Examples / fixtures / test data:** `web/lib/stats/percentUnits.test.ts`
- **Tests:** `web/lib/stats/percentUnits.test.ts`

### UST-038 Expanded-row chart rolling 5/10 and season averages

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Ratio-of-sums (TOI- or attempt-weighted) rolling convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/underlying-stats/PlayerStatsExpandedRowChart.test.tsx (renders chart; no rolling-average assertion found)`

### UST-039 Entity ratings overlay (latest rating snapshot)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-040 Native NST-parity game build per score state

- **Intent / contract:** tasks/TASKS/xg-model/docs/final-implementation-summary.md (NST-parity foundation section, line 76); tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:34 'parity-backed stat surfaces'
- **External references:** Natural Stat Trick game-level counts (parity target)
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2209-2548 stored games/events/shifts fixtures`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST reference sample, not slice-specific)`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2208 (buildPlayerStatsNativeGameParity)`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:932 (summary partitions by scoreState)`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`

### UST-041 Score-state classifier (score differential before event)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (score-state options listed in tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md; 'leading' = +2 or more not stated)
- **External references:** NST score-state filters (Leading/Trailing/Tied/Within 1)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:809 (legacy rows default to allScores)`

### UST-042 Team-relative strength-state classifier (shift/shot based)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (strength list in tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md filters section; no definition of EV/PP with empty net)
- **External references:** NST situation definitions (5v5 excludes empty net; PP/PK by manpower advantage)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-043 Per-60 rate conversion (players and goalies)

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:203 (ixG/60 etc.) and tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-goalie-underlying-stats-landing-page.md:236-252 (GSAA/60 and danger GSAA/60)
- **External references:** NST per-60 convention (count / TOI minutes * 60)
- **Examples / fixtures / test data:** `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsLanding_Audit.md`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2009`

### UST-044 PBP-only strength classifier (situation-code based)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL situationCode (away goalie, away skaters, home skaters, home goalie)
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:3141 fixture`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:3141 (PBP-only fallback)`

### UST-045 Appearance eligibility and games-played definition

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:138-139 (Game Range uses the player's own games; By Team Games uses team games even if the player missed some)
- **External references:** NST GP convention (games played in the situation)
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2549-2940 fixtures`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2068 (by-team-games appearances)`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2583`

### UST-046 PBP-only individual counts fallback (games without shift data)

- **Intent / contract:** **UNDOCUMENTED** — Test name at web/lib/underlying-stats/playerStatsLandingServer.test.ts:3141 is the only stated contract; otherwise UNDOCUMENTED
- **External references:** NST individual counts definitions
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:3141 fixture`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:3141 ('falls back to PBP-only individual counts when shiftcharts are empty')`

### UST-047 Trade-mode grouping and team label

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:142-143 (Combine aggregates across teams; Split shows player-team stints)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1812 fixture`
- **Tests:** `web/lib/underlying-stats/playerStatsQueries.test.ts (buildLandingTradeDisplay)`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1812`

### UST-048 Scope windows: last N games, last N team games, date range

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:58,138-139
- **External references:** NST 'last N games' / team-games filters
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1715-2154 fixtures`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsLanding_Audit.md`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1715 (game-range windows)`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2068`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2941 (by-team-games)`

### UST-049 Ratio-of-sums aggregation across games (nullable-sum semantics)

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:144 (minimum TOI applied after aggregation over the active scope)
- **External references:** Ratio-of-sums convention (NST season totals)
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1583-2207 summary-row fixtures`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsLanding_Audit.md`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1583 (buildPlayerStatsLandingAggregationFromSummaryRows)`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2009 (null rates when denominator zero)`

### UST-050 Minimum-TOI filter and TOI per game

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:144 and tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-goalie-underlying-stats-landing-page.md:180 (minimum TOI after aggregation)
- **External references:** NST minimum TOI filter (minutes)
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1910 fixture`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1910`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2941`

### UST-051 Per-season detail aggregation

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED beyond tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md (prior audit notes)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1161-1582 fixtures`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1161-1582`; `web/__tests__/pages/api/v1/underlying-stats/players/[playerId].test.ts`

### UST-052 Per-game chart series

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/underlying-stats/players/[playerId]/chart.test.ts`; `web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId]/chart.test.ts`

### UST-053 Individual derived metrics: points, IPP, shooting %, faceoff %

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:164,200 (IPP listed among individual columns)
- **External references:** NST IPP = points / on-ice GF; NHL SH% = G/SOG
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2009`

### UST-054 On-ice share percentages (CF%, FF%, SF%, GF%, xGF%, SCF%, HDCF%, HDGF%, MDCF%, MDGF%)

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:242 (on-ice xGF etc.)
- **External references:** NST on-ice CF%/FF%/SF%/GF%/xGF%/SCF%/HDCF%
- **Examples / fixtures / test data:** `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsLanding_Audit.md`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2583`

### UST-055 Finished-game and season/game-type eligibility filter

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md (season type/date-range filters); 'not-safely-finished same-day games' contract asserted in web/lib/underlying-stats/playerStatsLandingServer.test.ts:250
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:129-265 inline game fixtures`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts (filterPlayerStatsLandingSourceGames, resolvePlayerStatsSeasonGameType)`

### UST-056 PBP game-clock reconstruction (period duration, game seconds elapsed, seconds since previous event)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (no comment states the game-clock contract; NHL_REGULATION_PERIOD_SECONDS/OT constants at web/lib/underlying-stats/playerStatsLandingServer.ts:212-213)
- **External references:** NHL API period clock (20-min regulation, 5-min regular-season OT, 20-min playoff OT)
- **Examples / fixtures / test data:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:388-543 inline PBP rows (no OT case seen)`
- **Tests:** `web/lib/underlying-stats/playerStatsLandingServer.test.ts:388 (buildStoredPbpEventSequence)`

### UST-057 Position canonicalization and position-group filter

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/playerStatsQueries.test.ts`

### UST-058 Power rankings STD/L10 aggregation

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (only inline code comments naming the steps)
- **External references:** GF% = GF/(GF+GA); PP% = PPG/PPO ratio-of-sums
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/NHL/seasonAwareWriterTeams.test.js (team map only)`

### UST-059 Power rankings stat ranks

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Dense/competition ranking across 32 teams on one date
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-060 Season window fallback and date-range validation

- **Intent / contract:** web/lib/underlying-stats/playerStatsFilters.ts:455-456 comment ('Use September as the season rollover threshold for local fallback logic. Server/bootstrap code should pass a canonical currentSeasonId')
- **External references:** NHL season calendar
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/playerStatsFilters.test.ts`; `web/lib/underlying-stats/teamStatsFilters.test.ts`

### UST-061 Incremental refresh watermark selection

- **Intent / contract:** **UNDOCUMENTED** — web/lib/underlying-stats/playerStatsRefreshWindow.ts:134-136 (retry uncovered games back to latest finished date minus 7 days); goalie/team equivalents UNDOCUMENTED
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/playerStatsRefreshWindow.test.ts`; `web/__tests__/pages/api/v1/db/update-player-underlying-stats.test.ts`; `web/__tests__/pages/api/v1/db/update-goalie-underlying-stats.test.ts`; `web/__tests__/pages/api/v1/db/catch-up-team-underlying.test.ts`

### UST-062 Summary coverage and missing-game detection

- **Intent / contract:** web/lib/underlying-stats/teamStatsQueries.ts:963 ('One all-situations row per team per game: two rows per summarized game'); web/lib/underlying-stats/teamStatsLandingApi.ts:142-144; guidance strings in web/lib/underlying-stats/playerUnderlyingCoverage.ts:24-100
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/teamStatsSummaryRefresh.test.ts:72 (fetchSeasonTeamSummaryGameIdSet)`; `web/lib/underlying-stats/playerUnderlyingCoverage.test.ts`; `web/__tests__/pages/api/v1/db/catch-up-team-underlying.test.ts`

### UST-063 Strength of schedule (direct + indirect opponent point %)

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-underlying-stats-landing-page-sos.md:30-36,64-80 (SoS must be 50% standings/record component + 50% predictive/context component)
- **External references:** RPI-style SOS (2/3 OWP + 1/3 OOWP); NHL point %
- **Examples / fixtures / test data:** `web/lib/underlying-stats/teamScheduleStrength.test.ts inline sos_standings rows`; `tasks/TASKS/three-pillars-analytics/underlying-stats/UnderlyingStats_Audit.md`
- **Tests:** `web/lib/underlying-stats/teamScheduleStrength.test.ts`

### UST-064 Schedule texture (next 7/14 days)

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-underlying-stats-landing-page-sos.md:17 (rest disadvantage as optional context)
- **External references:** Common rest/B2B conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/teamScheduleStrength.test.ts`

### UST-065 Shots and goals by rink coordinate

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Shot location heat maps normally normalize coordinates to one attacking direction (e.g. MoneyPuck/NST rink normalization)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-066 Heuristic shot danger buckets (distance/angle)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in this slice; tasks/TASKS/xg-model/docs/final-implementation-summary.md describes the parity foundation but not these thresholds
- **External references:** NST scoring-chance / high-danger zone map (slot/home-plate regions, rebounds/rush bonuses) — this is a simplified geometric proxy
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-067 Heuristic approximate xG per shot

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (no comment or PRD defines the proxy; team PRD tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:64 only lists xGF/xGA/xGF% columns)
- **External references:** MoneyPuck / Evolving-Hockey / NST logistic xG models (outcome-blind, calibrated to league goal rate)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-068 Skater weekly aggregates, ownership/ADP buckets

- **Intent / contract:** tasks/TASKS/variance/v1/prd-skater-variance-leaderboard.md:19 (peer buckets)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/SkaterPage/skaterCalculations.test.ts`

### UST-069 Skater week rating z-score (Elite..Really Bad) and value overview

- **Intent / contract:** tasks/TASKS/variance/v1/prd-skater-variance-leaderboard.md:19,113-117 (Elite >= avg+1.5 SD, Quality >= +0.5 SD, Bad <= -0.5 SD, Really Bad <= -1.5 SD); web/components/SkaterPage/skaterCalculations.ts:73 'Matches goalie variance and uses sample standard deviation'
- **External references:** z-score banding
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/SkaterPage/skaterCalculations.test.ts`

### UST-070 Skater variance fantasy points per game

- **Intent / contract:** tasks/TASKS/variance/v1/prd-skater-variance-leaderboard.md; defaults web/lib/projectionsConfig/fantasyPointsConfig.ts:3-17
- **External references:** Yahoo/ESPN points-league scoring
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/SkaterPage/skaterCalculations.test.ts`

### UST-071 Skater standard and advanced variance metrics (per-60, SH%, ATOI)

- **Intent / contract:** tasks/TASKS/variance/v2/prd-variance-goalies-skaters-second-pass.md:5 (first live /variance/skaters MVP table)
- **External references:** NST per-60 convention; ratio-of-sums
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/SkaterPage/skaterMetrics.test.ts`; `web/components/SkaterPage/skaterCalculations.test.ts`

### UST-072 Skater bucket average rows

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/SkaterPage/skaterMetrics.test.ts`

### UST-073 Power rankings strength of schedule and opponent records

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Opponent points % SoS weighted by games played against each opponent
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-074 SoS game-log past/future opponent partition

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Opponent win%/points% SoS
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-075 Strength-of-schedule opponent record totals (legacy script)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in this file (section comments only, e.g. sosStandings.js:171 'Fetch Daily Standings and Upsert to sos_standings', :390 'Update Standings with Opponents')
- **External references:** Common SoS = opponents' points% (or win%) weighted by games, optionally excluding games vs the team itself
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-076 Landing/detail table sort, pagination and rank

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:75 ('Default sorting logic must be defined (e.g., Points or xGF%)')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/underlying-stats/playerStatsSorting.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2155 (server pagination)`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1497`

### UST-077 Team landing goalie start share and span windows

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-078 Archetype tags and quadrant summary

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/teamLandingDashboard.test.ts`

### UST-079 Trust-type classifier (buyLow / heatCheck / processBacked)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/teamLandingDashboard.test.ts`

### UST-080 Risers and fallers by trend

- **Intent / contract:** tasks/tasks-underlying-stats-lineupexperts-alignment.md (Team Movers in Chart tab)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/teamLandingDashboard.test.ts`

### UST-081 Process quadrant (offense/defense process z-scores)

- **Intent / contract:** **UNDOCUMENTED** — tasks/tasks-underlying-stats-lineupexperts-alignment.md (Process Quadrant kept in Chart tab, task 3.3); formula UNDOCUMENTED
- **External references:** z-score convention (population vs sample SD)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/teamLandingDashboard.test.ts`; `web/__tests__/pages/underlying-stats/index.test.tsx`

### UST-082 PDO luck status and landing ratings merge

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in slice (PDO z computed in web/lib/teamRatingsTrend.ts)
- **External references:** PDO regression-to-1000 convention
- **Examples / fixtures / test data:** `tasks/TASKS/three-pillars-analytics/underlying-stats/UnderlyingStats_Audit.md`
- **Tests:** `web/lib/underlying-stats/teamLandingRatings.test.ts`

### UST-083 Narrative context bullet thresholds

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/teamRatingNarrative.test.ts`

### UST-084 Team rating narrative drivers vs 10-snapshot baseline

- **Intent / contract:** **UNDOCUMENTED** — tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-underlying-stats-power-rankings-roadmap.md (power rankings roadmap); thresholds UNDOCUMENTED
- **External references:** none suggested
- **Examples / fixtures / test data:** `tasks/TASKS/three-pillars-analytics/underlying-stats/UnderlyingStats_Audit.md`
- **Tests:** `web/lib/underlying-stats/teamRatingNarrative.test.ts`

### UST-085 Special-teams PP%/PK% and ranks

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL.com PP%/PK%
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-086 WGO team game aggregation (PP%, PK%, shots/game, FO%)

- **Intent / contract:** web/lib/stats/percentUnits.ts:144-148 and :164 ('Full-sample totals over WGO game rows; only known zero-game rows are excluded')
- **External references:** NHL.com PP% = PPG/PPO, PK% = 1 - PPGA/TSH
- **Examples / fixtures / test data:** `web/lib/stats/percentUnits.test.ts`; `web/components/TeamDashboard/AdvancedL10Metrics.test.tsx`
- **Tests:** `web/lib/stats/percentUnits.test.ts`; `web/components/TeamDashboard/AdvancedL10Metrics.test.tsx`

### UST-087 Team landing aggregation: GP, point %, share %, SH%, SV%, PDO, per-60

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:64-66 (full column list incl. SH%, SV%, PDO)
- **External references:** NST team stats (CF%, xGF%, HDCF%, SH%, SV%, PDO), NHL point %
- **Examples / fixtures / test data:** `web/lib/underlying-stats/teamStatsQueries.test.ts:226-615 summary-row fixtures`
- **Tests:** `web/lib/underlying-stats/teamStatsQueries.test.ts:290 (aggregates counts and derives rates from toi)`; `web/lib/underlying-stats/teamStatsQueries.test.ts:477 (ignores zero-sample rows)`; `web/__tests__/pages/api/v1/underlying-stats/teams.test.ts`

### UST-088 Official NHL metric overlay for team rows

- **Intent / contract:** web/lib/underlying-stats/teamStatsQueries.ts:492-493 ('Official NHL totals only replace native values when both cover the same games')
- **External references:** NHL.com team summary / SAT (Corsi) definitions
- **Examples / fixtures / test data:** `web/lib/underlying-stats/teamStatsQueries.test.ts:650 official row fixture`
- **Tests:** `web/lib/underlying-stats/teamStatsQueries.test.ts:616-660 (applyOfficialRowOverrides)`

### UST-089 Team scope windows and minimum TOI

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:23 (date range, game range and team-game range filters)
- **External references:** NST last-N team games
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/teamStatsQueries.test.ts:271 (invalid date ranges)`

### UST-090 Team strength-segment TOI

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (team PRD tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:64 lists TOI and TOI/GP only)
- **External references:** NST team TOI (shift-based)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-091 Team shot, goal, xG and danger counts per game-split

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:64,66 (column list) and code comment web/lib/underlying-stats/teamStatsSummaryRefresh.ts:1192 (stale-key semantics)
- **External references:** NST team counts (Corsi/Fenwick/shots/xG/SCF/HDCF)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-player-underlying-stats.test.ts (mocks refresh)`; `web/__tests__/pages/api/v1/db/rebuild-team-underlying-summaries.test.ts (mocks refresh)`

### UST-092 Game outcome and standings points (W, L, OTL, ROW, points)

- **Intent / contract:** tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:64 (W, L, OTL, ROW, Points, Point %)
- **External references:** NHL standings (2 pts W, 1 pt OTL/SOL; ROW = regulation + OT wins)
- **Examples / fixtures / test data:** `web/lib/underlying-stats/teamStatsSummaryRefresh.test.ts:97-140 official payload fixtures`
- **Tests:** `web/lib/underlying-stats/teamStatsSummaryRefresh.test.ts:96 (official payload shootout/OT/tied cases)`

### UST-093 Legacy NHL statsapi TOI parsing, TOI% and PP-time share

- **Intent / contract:** **UNDOCUMENTED** — web/lib/NHL/TOI.ts:77-81 JSDoc ('Convert a time string to minutes. @param timeString mm:ss'); fetchTOIData UNDOCUMENTED
- **External references:** NHL.com TOI mm:ss; NST TOI convention (seconds or minutes) and PP share = player PP TOI / team PP TOI
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### UST-094 xG explorer row builders (latest rolling window + supplemental sums)

- **Intent / contract:** **UNDOCUMENTED** — tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md (xG model program); explorer contract UNDOCUMENTED
- **External references:** MoneyPuck/Evolving-Hockey xG, GSAx
- **Examples / fixtures / test data:** `web/lib/underlying-stats/xgExplorer.test.ts inline rows`
- **Tests:** `web/lib/underlying-stats/xgExplorer.test.ts`; `web/__tests__/pages/underlying-stats/xg/index.test.tsx`; `web/__tests__/pages/underlying-stats/xg/operations.test.tsx`

### UST-095 xG explorer coverage ratios

- **Intent / contract:** Warning text at web/lib/underlying-stats/xgExplorer.ts:283 and 294-296 (zero-filled fields are 'missing coverage', not production-authoritative)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/underlying-stats/xgExplorer.test.ts`

## Rolling player averages & trends (ROLL)

### ROLL-001 Social share Hot/Cold Recent Form (recent-form-v1-early)

- **Intent / contract:** web/lib/socialShare/trends.ts:181-184 comment (two non-overlapping 5-appearance windows, all 10 in season; unproven left out, never read as zero); trendDefinitions at trends.ts:478
- **External references:** Simple recent-vs-prior form split; compare with hot/cold streak rules (MISC-033) and trends hot/cold (ROLL-028)
- **Examples / fixtures / test data:** `web/lib/socialShare/trendsFixture.ts (deterministic synthetic rolling rows)`
- **Tests:** `web/lib/socialShare/trends.test.ts`; `web/lib/socialShare/trendSources.test.ts`; `web/components/SocialShare/SocialShare.test.tsx`; `web/e2e/social-share.spec.ts`

### ROLL-002 Social share per-60 rate standouts (L5 vs season)

- **Intent / contract:** web/lib/socialShare/trends.ts:69 comment (L5 per-60 needs at least 50 minutes); trendDefinitions trends.ts:481
- **External references:** NST per-60 convention (count*3600/TOI seconds)
- **Examples / fixtures / test data:** `web/lib/socialShare/trendsFixture.ts`
- **Tests:** `web/lib/socialShare/trends.test.ts`; `web/lib/socialShare/trendSources.test.ts`; `web/components/SocialShare/SocialShare.test.tsx`; `web/e2e/social-share.spec.ts`

### ROLL-003 Social share per-game series reconstruction from cumulative and window sums (sparklines)

- **Intent / contract:** web/lib/socialShare/trends.ts:290-300 comment (TT-17: solved exactly from sums, never interpolated)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/socialShare/trendsFixture.ts`
- **Tests:** `web/lib/socialShare/trends.test.ts`

### ROLL-004 Additive metric rolling sums/means and historical per-game averages

- **Intent / contract:** additive_performance contract 'Last N means the player's last N chronological appearances in the relevant strength state' (rollingWindowContract.ts:59); history read must include earlier games for _all/_3ya/_career (fetchRollingPlayerAverages.ts:3044)
- **External references:** Simple per-game mean over last N games played
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`
- **Tests:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingHistoricalAverages.test.ts`; `web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts`

### ROLL-005 Player trend rolling averages, running mean and variance

- **Intent / contract:** web/lib/trends/playerTrendCalculator.ts:15-16 version 'player-trend-v2-full-history-source-units'; web/lib/trends/playerTrendRebuildScope.ts:1 7-day repair window; scripts/audit-player-trend-playoff-repair.ts:349
- **External references:** Simple moving average over last N games; ratio-of-sums vs mean-of-ratios convention
- **Examples / fixtures / test data:** `web/scripts/audit-player-trend-playoff-repair.ts`; `web/scripts/audit-player-trend-expected-shooting.ts`; `web/lib/trends/playerTrendCalculator.test.ts (inline rows)`
- **Tests:** `web/lib/trends/playerTrendCalculator.test.ts`; `web/__tests__/pages/api/v1/trends/player-trends.test.ts`

### ROLL-006 Goalie trend percentile series

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Percentile rank; goalie samples need heavier regression (save% stabilizes slowly)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/trends/goalie-power.test.ts`

### ROLL-007 Skater trend percentile series with low-sample shrink

- **Intent / contract:** **UNDOCUMENTED** — Constants MIN_TREND_SAMPLE_GAMES=10 at web/pages/api/v1/trends/skater-power.ts:131; sampleConfidence 'low'/'qualified' contract; otherwise UNDOCUMENTED
- **External references:** Percentile rank with average ranks for ties; regression toward the mean by sample size (Tango-style k)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/trends/skater-power.test.ts`; `web/hooks/useDashboardData.test.tsx`

### ROLL-008 Player trend page: rolling-vs-baseline delta %, hot/cold streak and L7/L14/L30 quick cards

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (only in-code labels such as 'straight games above baseline'; web/lib/navigation/analyticsSurfaceOwnership.ts lists 'Rolling-average directionality and hot/cold scanning' as the trends surface remit)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/__tests__/pages/trends/player/[playerId].test.tsx (inline rolling rows with *_avg_career / *_avg_last10)`
- **Tests:** `web/__tests__/pages/trends/player/[playerId].test.tsx`

### ROLL-009 Player trend / team power / rolling-player repair reconciliation audits

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED beyond variable names
- **External references:** NHL official team stats; NST per-60 convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/trends/playerTrendCalculator.test.ts`

### ROLL-010 Rolling-window stat averages, std, OLS trend slope and form features (python research)

- **Intent / contract:** docstrings at web/scripts/performance_prediction.py:859,939
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### ROLL-011 GP% / availability and split-strength participation

- **Intent / contract:** ROLLING_PLAYER_AVAILABILITY_CONTRACT intendedReplacement: availability = team games appeared / team games available, season scope all stints (web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts:75-116); fetchRollingPlayerAverages.ts:2921 'should not collapse to the current team only after a trade'. Note: rollingHistoricalAverages.test.ts:145 encodes the trade case with team 2's counter restarting at 3, whereas the live ledger supplies team 2's full cumulative count
- **External references:** GP / team GP (availability rate)
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `tasks/artifacts/forge-rolling-participation-2026-10-17/`
- **Tests:** `web/lib/supabase/Upserts/rollingHistoricalAverages.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`

### ROLL-012 Trend window/limit constants and category direction

- **Intent / contract:** web/lib/trends/skaterMetricConfig.ts:15-44 and goalieMetricConfig.ts:15-44 category descriptions
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/trends/skater-power.test.ts`; `web/lib/trends/goalieMetricConfig.test.ts`

### ROLL-013 Line combination slot/group and PP unit context labels

- **Intent / contract:** ROLLING_PLAYER_LINE_CONTEXT_CONTRACT and ROLLING_PLAYER_PP_UNIT_CONTRACT: contextual labels, not rolling metrics (web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts:14-33; rollingPlayerPpUnitContract.ts:1-19)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/check-rolling-player-context-labels.ts`
- **Tests:** `web/lib/supabase/Upserts/rollingPlayerLineContextContract.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPpUnitContract.test.ts`

### ROLL-014 Finishing ratios: shooting %, expected shooting %, primary points %

- **Intent / contract:** **UNDOCUMENTED** — Scale contract web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27; formula strings rollingPlayerValidationPayload.ts:490-503; no written rationale for 0-on-empty-denominator choice (UNDOCUMENTED)
- **External references:** NST SH% = G/SOG*100; xSH% (ixG/SOG); primary points share
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`
- **Tests:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts`; `web/lib/supabase/Upserts/rollingMetricAggregation.test.ts`

### ROLL-015 Aligned count support pairs (goals per shot, assists per goal)

- **Intent / contract:** 'The WGO event must agree with the canonical game. A source date join remains explicitly declared, not independent NST event proof.' (web/lib/rollingPlayerCountSupport.ts:32); legacy scalar totals never establish a frame (:96)
- **External references:** Ratio-of-sums finishing (G/SOG) and assists per goal
- **Examples / fixtures / test data:** `tasks/artifacts/forge-projection-audit-2026-10-21/release-es-assist-refit/`
- **Tests:** `web/lib/rollingPlayerCountSupport.test.ts`; `web/lib/projections/runProjectionV2.alignedConversion.test.ts`; `web/lib/projections/queries/skater-queries.test.ts`

### ROLL-016 Goalie trend metric definitions

- **Intent / contract:** web/lib/trends/goalieMetricConfig.ts:15-44 category descriptions
- **External references:** NHL.com SV%, GAA; Quality Start (Hockey-Reference: SV% > league avg or >= .885 with <=20 SA)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/trends/playerTrendCalculator.test.ts`; `web/__tests__/pages/api/v1/trends/goalie-power.test.ts`

### ROLL-017 Legacy trailing simple rolling average

- **Intent / contract:** web/lib/supabase/utils/statistics.ts:175-177 ('Computes a simple rolling average for a numeric series')
- **External references:** Simple moving average
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### ROLL-018 Legacy smoothstep confidence multiplier

- **Intent / contract:** web/lib/supabase/utils/statistics.ts:194-199 (smoothstep mapping description)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### ROLL-019 Legacy empirical score thresholds (quantiles)

- **Intent / contract:** web/lib/supabase/utils/statistics.ts:224-226 ('Derive empirical thresholds (e.g., med/90th)')
- **External references:** Nearest-rank quantile
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### ROLL-020 Legacy sKO characteristic-game classifier (z-scores, weighted chi-square thresholds, stat weights)

- **Intent / contract:** web/lib/supabase/utils/statistics.ts:3-7 (legacy, 'not approved FORGE signal definitions') and :66-71 (score each game against prior games only)
- **External references:** Standard z-score / chi-square approximation; weighted sum of squared z assumes independent normals
- **Examples / fixtures / test data:** `web/lib/supabase/utils/legacySko.test.ts`
- **Tests:** `web/lib/supabase/utils/legacySko.test.ts`

### ROLL-021 Individual points percentage (IPP)

- **Intent / contract:** 'Individual points percentage, aggregated from raw point and on-ice goal components' (web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:118)
- **External references:** NST IPP = points / on-ice GF * 100
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`
- **Tests:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`

### ROLL-022 On-ice shooting %, on-ice save %, PDO

- **Intent / contract:** 'On-ice shooting percentage plus save percentage, stored as a 0-2 index' (web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:124); oiSH% note at :130
- **External references:** NST on-ice SH%/SV%/PDO (shots on goal based); PDO convention 1.000 or 100
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`
- **Tests:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingMetricAggregation.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`

### ROLL-023 Possession and zone-start shares (CF%, FF%, OZ start %)

- **Intent / contract:** **UNDOCUMENTED** — 'Offensive-zone start share excluding neutral-zone starts' (web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:136); CF%/FF% UNDOCUMENTED beyond formula strings (rollingPlayerValidationPayload.ts:507-508)
- **External references:** NST CF%/FF%/Off. Zone Start % (neutral excluded)
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`
- **Tests:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts`

### ROLL-024 Per-60 weighted rate metrics

- **Intent / contract:** '/60 families are stored as weighted rate snapshots derived from raw event totals and TOI over the selected scope. We never average per-game rates.' (web/lib/supabase/Upserts/rollingPlayerMetricMath.ts:8); NST rates are supplementary only (fetchRollingPlayerAverages.ts:1072-1084)
- **External references:** NST per-60 convention: sum(events) / sum(TOI minutes) * 60
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`
- **Tests:** `web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts`

### ROLL-025 Individual expected goals (ixG) source resolution and ixG/60

- **Intent / contract:** 'WGO supplies shots but no xG, so a game without an NST row must not count as zero-xG shots' (web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1377); source contract rollingMetricSourceUnitContract.ts:53-66
- **External references:** NST ixG (NST xG model)
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`
- **Tests:** `web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts`; `web/lib/supabase/Upserts/rollingPlayerSourceSelection.test.ts`

### ROLL-026 PP TOI and team PP share (pp_share_pct)

- **Intent / contract:** ROLLING_PLAYER_PP_SHARE_CONTRACT 'Player share of total team power-play TOI over the selected scope' (web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts:22-48, rationale :71-75)
- **External references:** PP TOI share of team PP TOI (NHL.com ppTimeOnIcePctPerGame)
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `tasks/artifacts/forge-projection-audit-2026-10-21/release-pp-usage/`
- **Tests:** `web/lib/supabase/Upserts/rollingPlayerPpShareContract.test.ts`; `web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPpUnitContract.test.ts`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`

### ROLL-027 Power-play unit usage metrics

- **Intent / contract:** web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:59 (comment: team-share semantics stored separately from unit-relative usage so downstream pp_share_pct uses a consistent denominator)
- **External references:** NHL.com ppTimeOnIcePctPerGame (player PP TOI / team PP TOI)
- **Examples / fixtures / test data:** `inline fixtures in web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts`; `web/lib/supabase/Upserts/rollingPlayerHelperContracts.test.ts`

### ROLL-028 Skater trend metric definitions (per-60 fallbacks, primary points %, expected SH%)

- **Intent / contract:** web/lib/trends/playerTrendCalculator.ts:15-16 'source-units' version tag; web/lib/trends/skaterMetricConfig.ts:19 'Individual shot volume rate at all strengths'
- **External references:** NST individual per-60 definitions; expected SH% = ixG/iFF (MoneyPuck/NST style)
- **Examples / fixtures / test data:** `web/scripts/audit-player-trend-expected-shooting.ts`; `web/scripts/audit-player-trend-playoff-repair.ts`
- **Tests:** `web/lib/trends/playerTrendCalculator.test.ts`; `web/scripts/audit-player-trend-expected-shooting.ts (audit script, not test)`

### ROLL-029 SKO inputs: IPP and SOG/60

- **Intent / contract:** web/lib/supabase/Upserts/fetchSKOskaterStats.js:263 (comment: 'Calculate fields'); fetchSKOyears.js:161 (comment: Individual Points Percentage) — no contract on percent units
- **External references:** NST IPP (points / on-ice GF) and per-60 convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-sko-stats.test.ts (tests the live route reimplementation, not these JS files)`; `web/__tests__/pages/api/v1/db/update-sko-stats.route.test.ts`

### ROLL-030 SKO luck deltas, sustainability composite and role classifier

- **Intent / contract:** web/lib/trends/utils.ts:139 comment 'signs chosen so higher = more luck / less sustainable'; current SKO intent lives in tasks/TASKS/prd-sko-element.md:12-22 (new sustainability core, not this helper)
- **External references:** PDO regression to 1.000; league oiSH% ~8% at ES
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### ROLL-031 Additive metric source precedence (NST counts vs WGO)

- **Intent / contract:** Source precedence contract (web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1072-1089): WGO is the appearance spine; NST counts authoritative; WGO fills only all-strength gaps
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/__tests__/fixtures/nst/oct1-identity-source.json`
- **Tests:** `web/lib/supabase/Upserts/rollingPlayerSourceSelection.test.ts`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`

### ROLL-032 Trend rolling average and hot/cold streak detection

- **Intent / contract:** web/lib/trends/utils.ts:309 comment 'Per-point streak labeling requires at least 2 consecutive games'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### ROLL-033 Trend surface leader selection

- **Intent / contract:** web/lib/trends/trendsSurface.ts:121-122 'headline figure is the stat itself... TOI fields arrive as seconds per game'; :214 tie-break comment
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/socialShare/trendsFixture.ts`
- **Tests:** `web/lib/trends/trendsSurface.test.ts`

### ROLL-034 Team rolling opponent-record strength of schedule

- **Intent / contract:** **UNDOCUMENTED** — web/lib/supabase/Upserts/fetchRollingGames.js:405 (comment: seed cumulative values from last game before baseline); SoS intent otherwise UNDOCUMENTED
- **External references:** Opponent win% SoS (NHL/hockey-reference style), opponent records as of game date exclusive
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### ROLL-035 Team rolling STD and last-10 (LTG) averages

- **Intent / contract:** web/lib/supabase/Upserts/fetchRollingGames.js:357-359 (comment: recent mode processes games >= baseline and seeds cumulative values from last game before baseline)
- **External references:** Ratio-of-sums convention (e.g. PP% = PPG/PPO over window; SAT% = SATF/(SATF+SATA))
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### ROLL-036 TOI resolution, trust tiers and WGO minutes/seconds normalization

- **Intent / contract:** 'NHL strength-specific report fields are seconds, including short/zero usage' (web/lib/supabase/Upserts/rollingPlayerToiContract.ts:94); TOI source priority summary rollingPlayerValidationPayload.ts:1122-1128; toi_seconds contract rollingMetricSourceUnitContract.ts:30
- **External references:** NST TOI in seconds; NHL API timeOnIce seconds
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `tasks/TASKS/wigo-charts-audit/16-time-on-ice.md`
- **Tests:** `web/lib/supabase/Upserts/rollingPlayerToiContract.test.ts`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`

### ROLL-037 Playoff skater TOI normalisation

- **Intent / contract:** web/scripts/audit-player-trend-playoff-repair.ts:349 'normalize playoff TOI seconds to minutes'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/audit-player-trend-playoff-repair.ts`
- **Tests:** `web/__tests__/pages/api/v1/trends/player-trends.test.ts`

### ROLL-038 Trends sandbox statistics helpers (mean, SD, z-score, percentile, winsorize, Pearson, regression)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Standard textbook definitions
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### ROLL-039 Ratio support-component outputs

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (no comment stating support columns must reproduce the ratio; audit evidence in tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`
- **Tests:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`; `web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts`

### ROLL-040 Legacy GP and _avg_/_total_ alias outputs and compatibility resolution

- **Intent / contract:** Compatibility inventory comment (web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2687); legacyFieldPolicy gpPctAvgFields 'deprecated_aliases_not_real_averages' (rollingPlayerAvailabilityContract.ts:122)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`
- **Tests:** `web/lib/rollingPlayerMetricCompatibility.test.ts`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`

### ROLL-041 Pipeline diagnostics: scale bounds, ratio re-check, source tail lag

- **Intent / contract:** **UNDOCUMENTED** — Scale bounds from ROLLING_METRIC_SCALE_CONTRACTS (web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27); tail freshness UNDOCUMENTED beyond code
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/check-rolling-player-coverage.ts`; `web/scripts/check-rolling-player-validation-freshness.ts`
- **Tests:** `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`; `web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts`

### ROLL-042 Validation recompute comparison and reconstruction helpers

- **Intent / contract:** METRIC_FORMULAS reconstruction strings (web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:490); readiness rules :1772
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, recheck.cjs)`
- **Tests:** `web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts`; `web/__tests__/pages/api/v1/debug/rolling-player-metrics.test.ts`

### ROLL-043 Team game ledger, season-id derivation and appearance anchor

- **Intent / contract:** 'Seasons run September through August, so the game date fixes the season' and the WGO season_id leak fix (web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:3368, :3385)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`

### ROLL-044 Ratio-of-sums rolling/historical aggregation engine

- **Intent / contract:** Ratio families always computed from aggregated raw components, never averaged per-entry ratios (web/lib/supabase/Upserts/rollingMetricAggregation.ts:140); missing numerator is a missing observation not a zero (rollingMetricAggregation.ts:118); window contracts in rollingWindowContract.ts:35
- **External references:** Ratio-of-sums convention (NST/Evolving-Hockey aggregate rates as sum(events)/sum(TOI)); last-N-games windows
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`
- **Tests:** `web/lib/supabase/Upserts/rollingMetricAggregation.test.ts`; `web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`

### ROLL-045 Rolling window contracts and metric-to-family map

- **Intent / contract:** contractSummary strings in web/lib/supabase/Upserts/rollingWindowContract.ts:48-85 (e.g. 'Last N means the player's last N chronological appearances in the relevant strength state')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/rollingWindowContract.test.ts`; `web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts`

## NST-derived stats (NST)

### NST-001 usePlayerStats zone-start % and NST merge coercion

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST/Evolving-Hockey zone start % (OZS% usually excludes neutral starts)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### NST-002 NST goalie catch-up step planner (windows, budgets, burst sizing)

- **Intent / contract:** web/lib/nst/goalieCatchup.ts:90 ('Pure proposal only...') and :200-201 ('These are proposed operating windows; this function activates no scheduler'); NST policy AGENTS.md:105
- **External references:** Repository NST rate-limit policy (21 s spacing, burst only <40 total)
- **Examples / fixtures / test data:** `web/lib/nst/goalieCatchup.test.ts (manifest/budget fixtures)`
- **Tests:** `web/lib/nst/goalieCatchup.test.ts`; `web/lib/nst/goalieCatchup.server.test.ts`; `web/lib/nst/goaliePreparation.server.test.ts`

### NST-003 NST goalie freshness assessment (coverage counts and status tiers)

- **Intent / contract:** web/lib/nst/goalieFreshness.ts:29-30 ('Evaluate supplied, completely enumerated snapshots...') and :101-102 (13:00 UTC report after catch-up window)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/nst/goalieFreshness.test.ts (inline snapshot fixtures)`
- **Tests:** `web/lib/nst/goalieFreshness.test.ts`; `web/lib/nst/goalieFreshness.server.test.ts`

### NST-004 Goalie parity counts, SV%, GAA and 'GSAA'

- **Intent / contract:** **UNDOCUMENTED** — tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:89 (phase-1 parity covers skaters plus goalies); GSAA-as-xGA-minus-GA definition UNDOCUMENTED
- **External references:** NST goalie: GSAA = SA x league-average SV% - GA; GSAx = xGA - GA; SV% 0-100 on NST
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`; `web/lib/underlying-stats/goalieStatsServer.test.ts`

### NST-005 On-ice For/Against counts by danger

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md:129-146 (on-ice count families CF..LDGA, on-ice SH%/SV%, PDO, zone starts)
- **External references:** Natural Stat Trick on-ice: CF = goals+SOG+missed+blocked; FF excludes blocked; SF = goals+SOG
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`

### NST-006 Zone starts and zone faceoff shares

- **Intent / contract:** **UNDOCUMENTED** — tasks/TASKS/xg-model/docs/definitions-and-parity.md:146-148 (O/N/D zone starts, zone faceoffs, on-the-fly starts are parity targets); zone-start detection rule UNDOCUMENTED
- **External references:** NST zone starts (shifts starting with a faceoff; OZS% often reported excluding neutral zone)
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`

### NST-007 IPP (parity)

- **Intent / contract:** **UNDOCUMENTED** — tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (IPP as NST metric replacement) — formula itself UNDOCUMENTED
- **External references:** NST IPP = points / on-ice GF (percent)
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`

### NST-008 On-ice percentages and PDO

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md:143-145 (on-ice SH%, SV%, PDO listed as parity targets)
- **External references:** NST PDO = on-ice SH% + on-ice SV% (5v5 by default); percentages 0-100
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`; `web/lib/supabase/Upserts/nhlXgValidation.test.ts`

### NST-009 On-ice attribution per event

- **Intent / contract:** tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:48 (on-ice player-set attribution, team-relative strength, entity membership); tasks/TASKS/xg-model/docs/event-dictionary.md (eventOwnerTeamId alone not enough for on-ice attribution)
- **External references:** NST on-ice For/Against attribution
- **Examples / fixtures / test data:** `tasks/TASKS/xg-model/nhl-api-foundation/manual-audit-requirements.md (on-ice spot-check procedure)`; `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`; `tasks/TASKS/xg-model/docs/event-dictionary.md:256 (blocked-shot payload keys)`
- **Tests:** `web/lib/supabase/Upserts/nhlOnIceAttribution.test.ts`; `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`

### NST-010 Normalized event inclusion rules

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md:205-206 and :213-220 (shootouts and penalty shots stored but excluded from parity, on-ice parity and shot features until a versioned penalty-shot method exists) — exclusion is intentional
- **External references:** NST excludes shootouts; NHL counts penalty-shot goals as goals
- **Examples / fixtures / test data:** `inline fixtures in web/lib/supabase/Upserts/nhlEventInclusion.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlEventInclusion.test.ts`; `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`

### NST-011 Individual skater counts (NST individual table parity)

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md (phase-1 count families; NHL-derived correctness wins over NST on edge cases per tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:90)
- **External references:** Natural Stat Trick individual counts (iCF, iFF, iSCF, iHDCF, ixG)
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`

### NST-012 Penalty count classification

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (no stated duration->type mapping)
- **External references:** NST/NHL penalty types (minor 2, double minor 4, major 5, misconduct 10, game misconduct)
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`

### NST-013 Danger bucket and scoring-chance fallback

- **Intent / contract:** **UNDOCUMENTED** — tasks/TASKS/xg-model/docs/definitions-and-parity.md:84-86 (rule-based phase-1 low/medium/high danger; thresholds must be versioned); exact 20/40 ft and 35/50 deg thresholds UNDOCUMENTED
- **External references:** Natural Stat Trick scoring-chance/HD definition (zone polygons + point system: HD area 3 pts, rebounds/rush +1, blocked shots -1; SC >=2, HDC >=3 in HD area)
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`

### NST-014 Approximate xG fallback heuristic

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (no comment or PRD states the 0.18/0.08/0.02 constants or goal floor; tasks/TASKS/xg-model/docs/definitions-and-parity.md:84 only covers danger buckets)
- **External references:** Evolving-Hockey / MoneyPuck / NST xG (Fenwick-based logistic models; outcome never an input)
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`

### NST-015 PbP clock and game-time derivation

- **Intent / contract:** tasks/TASKS/xg-model/docs/data-contract-boundaries.md (normalized layer owns parsed timing/strength; versioned via parser_version/strength_version)
- **External references:** none suggested
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`; `tasks/TASKS/xg-model/docs/event-dictionary.md`
- **Tests:** `web/lib/supabase/Upserts/nhlPlayByPlayParser.test.ts`; `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`

### NST-016 NST radar season values (on-ice shares, per-60 rates, league sample minima)

- **Intent / contract:** web/lib/nst/radarSeasonStats.ts:1-9 (rank a skater's season row against every skater's season row from the same NST views so both are measured the same way); :23 ('one hour of ice time before a per-60 rate counts'); PlayerRadarChart.tsx:240 comment on small-sample guard
- **External references:** Natural Stat Trick on-ice share definitions (CF% = CF/(CF+CA)); NST per-60 = count*3600/TOI seconds; percentile-rank conventions (inclusive vs exclusive ties)
- **Examples / fixtures / test data:** `web/lib/nst/radarSeasonStats.test.ts (inline NST row fixtures)`
- **Tests:** `web/lib/nst/radarSeasonStats.test.ts`

### NST-017 Per-60 rates (skater individual and on-ice)

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md:150-153 (every count family needs its per-60 surface; raw TOI and TOI/GP retained)
- **External references:** NST per-60 convention (count / TOI minutes * 60, TOI in minutes)
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`; `web/lib/supabase/Upserts/nhlXgValidation.test.ts`

### NST-018 NST rate-limit admission window math (local ledger + shared RPC + Python admission)

- **Intent / contract:** AGENTS.md:105 (NST: 40/1m, 80/5m, 100/15m, 180/h unique URLs; jobs <40 requests may burst; >=21 s spacing); web/lib/cron/nstRateLimitPolicy.ts:25-27 and :120-121 ('at most two 39-attempt waves; the authoritative ledger decides'); functions/lib/nst_admission.py:1-5
- **External references:** Repository NST policy (AGENTS.md / memory): 40/1m, 80/5m, 100/15m, 180/h unique URLs, 21 s spacing, only jobs <40 requests may burst
- **Examples / fixtures / test data:** `web/lib/cron/nstRateLimitPolicy.test.ts (window/interval cases)`; `web/lib/nst/requestBudget.test.ts (ledger scenarios)`; `functions/tests/test_nst_admission.py (receipt fixtures)`
- **Tests:** `web/lib/nst/requestBudget.test.ts`; `web/lib/nst/sharedAdmission.test.ts`; `web/lib/nst/client.test.ts`; `web/lib/nst/clientOperationControls.test.ts`; `web/lib/nst/nstBypassGuard.test.ts`; `web/lib/nst/jobLifecycle.server.test.ts`; `web/lib/cron/nstRateLimitPolicy.test.ts`; `web/lib/cron/nstBurstPlans.test.ts`; `web/lib/cron/nstCoordination.test.ts`; `functions/tests/test_nst_admission.py`; `functions/tests/test_nst_legacy_lifecycle.py`; `functions/tests/test_fetch_team_table_contract.py`; `web/__tests__/pages/api/v1/db/update-nst-gamelog.test.ts`

### NST-019 Score-state filters (parity)

- **Intent / contract:** **UNDOCUMENTED** — tasks/TASKS/xg-model/docs/event-dictionary.md (goal carries homeScore/awayScore at 100%; score fields are NOT present on every event class) — supports the null-diff concern; bucket semantics UNDOCUMENTED
- **External references:** NST score states (Tied, Leading, Trailing, Within 1, Up 1, Down 1, Close); NST Leading includes all leads
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`

### NST-020 Score-state context features (running score, game-time segments)

- **Intent / contract:** **UNDOCUMENTED** — tasks/TASKS/xg-model/docs/definitions-and-parity.md (score state listed among phase-1 contextual inputs); 50:00/55:00/58:00 thresholds UNDOCUMENTED
- **External references:** NST/Corsica 'close' (within 1 in 1st/2nd, tied in 3rd) and score-adjustment conventions
- **Examples / fixtures / test data:** `inline fixtures in web/lib/supabase/Upserts/nhlScoreState.test.ts`; `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`
- **Tests:** `web/lib/supabase/Upserts/nhlScoreState.test.ts`

### NST-021 Shift interval normalization, stints and stint lookup

- **Intent / contract:** **UNDOCUMENTED** — tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:83 (shift integration treated as a release blocker); no stated shift-change tie-break rule found — UNDOCUMENTED for the end-of-stint preference
- **External references:** NST shift-change convention (events at a change second credited to outgoing players except faceoffs credited to incoming)
- **Examples / fixtures / test data:** `inline shift fixtures in web/lib/supabase/Upserts/nhlShiftStints.test.ts`; `tasks/TASKS/xg-model/nhl-api-foundation/shift-charts-vs-nhl-api-shifts-audit.md`
- **Tests:** `web/lib/supabase/Upserts/nhlShiftStints.test.ts`; `web/lib/supabase/Upserts/nhlOnIceAttribution.test.ts`; `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`

### NST-022 Contextual shot features (shift age, PP age, movement, royal road)

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md:88 Phase 1 Contextual Features (power-play age from continuous owner PP segments, resets on leaving PP or new segment; fatigue = shooter shift age plus owner/opponent average and max shift age)
- **External references:** none suggested
- **Examples / fixtures / test data:** `inline fixtures in web/lib/supabase/Upserts/nhlContextualFeatures.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlContextualFeatures.test.ts`

### NST-023 Flurry sequences

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md:72-83 (5 s gap grouping, sequence metadata only; raw per-shot values untouched)
- **External references:** MoneyPuck flurry-adjusted xG (discounting later shots in a flurry)
- **Examples / fixtures / test data:** `inline fixtures in web/lib/supabase/Upserts/nhlFlurries.test.ts`; `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
- **Tests:** `web/lib/supabase/Upserts/nhlFlurries.test.ts`; `web/lib/xg/flurryAdjusted.test.ts`

### NST-024 Miss-reason buckets

- **Intent / contract:** tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:57 (short-side and other miss buckets with explicit parity and xG inclusion flags)
- **External references:** none suggested
- **Examples / fixtures / test data:** `inline fixtures in web/lib/supabase/Upserts/nhlMissReasons.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlMissReasons.test.ts`

### NST-025 Possession chains

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (tasks/artifacts/xg-possession-chain-benchmark-2026-03-31.md)
- **External references:** none suggested
- **Examples / fixtures / test data:** `inline fixtures in web/lib/supabase/Upserts/nhlPossessionChains.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlPossessionChains.test.ts`

### NST-026 Prior-event context (time, distance, speed)

- **Intent / contract:** **UNDOCUMENTED** — tasks/TASKS/xg-model/docs/definitions-and-parity.md:339 (prior-event context is a versioned derived feature); formulas UNDOCUMENTED
- **External references:** MoneyPuck/EH prior-event features
- **Examples / fixtures / test data:** `inline fixtures in web/lib/supabase/Upserts/nhlPriorEventContext.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlPriorEventContext.test.ts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`

### NST-027 Rebound detection and rebound control outcome

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md:51-58 (rebound = same-team shot within 3 s of an immediately prior SOG/missed/blocked shot, any intervening event breaks it; rebound goals count; rebounds created credited to source)
- **External references:** NST rebound: attempt within 3 s of a blocked/missed/saved attempt by same team without stoppage
- **Examples / fixtures / test data:** `inline fixtures in web/lib/supabase/Upserts/nhlRebounds.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlRebounds.test.ts`; `web/lib/xg/reboundRichLabels.test.ts`

### NST-028 Rush shot detection

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md:60-71 (10 s backward scan, defined sources, D/N team-relative zone; explicit approximation because no controlled-entry data) — the 10 s vs NST 4 s difference is a documented choice
- **External references:** NST rush: attempt within 4 s of any event in the neutral or defensive zone without stoppage
- **Examples / fixtures / test data:** `inline fixtures in web/lib/supabase/Upserts/nhlRush.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlRush.test.ts`

### NST-029 Shot feature row assembly

- **Intent / contract:** tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:62,69 (integrated shot-feature row assembly across distance, angle, rebound, rush, flurry, miss-reason and exclusions); tasks/TASKS/xg-model/docs/data-contract-boundaries.md:178 (approximations isolated in the derived layer)
- **External references:** MoneyPuck/Evolving-Hockey xG feature sets
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`; `inline fixtures in web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`; `web/lib/xg/baselineDataset.test.ts`; `web/lib/xg/featureCoverage.test.ts`; `web/lib/xg/shotFeatureEnrichment.test.ts`; `web/lib/xg/deploymentContext.test.ts`

### NST-030 Coordinate normalization, shot distance and angle

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md:339 (feature version increments when distance/angle normalization changes); tasks/TASKS/xg-model/docs/event-dictionary.md (coordinates normalized with homeTeamDefendingSide)
- **External references:** Standard NHL rink coordinates (goal line x=89); MoneyPuck/EH distance-angle features
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`; `inline fixtures in web/lib/supabase/Upserts/nhlCoordinates.test.ts`
- **Tests:** `web/lib/supabase/Upserts/nhlCoordinates.test.ts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`; `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`

### NST-031 Team-relative strength-state and split classification

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md:208-211 (zero goalie digit -> EN, not ordinary EV/PP/SH); tasks/TASKS/xg-model/nhl-api-foundation/strength-mapping.md (canonical situationCode mapping)
- **External references:** Natural Stat Trick strength definitions (5v5 = both goalies in; EV = 5v5+4v4+3v3; PP/PK exclude empty-net; all situations includes EN)
- **Examples / fixtures / test data:** `tasks/TASKS/xg-model/nhl-api-foundation/strength-mapping.md (examples 1331, 0651, 1560)`; `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`
- **Tests:** `web/lib/supabase/Upserts/nhlStrengthState.test.ts`; `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/supabase/Upserts/nhlPlayByPlayParser.test.ts`

### NST-032 NST team count aggregation (CF%, xGF%, HDCF%, SCF%, SH%, SV%, PDO)

- **Intent / contract:** web/lib/stats/percentUnits.ts:101-106 ('ratio of sums, never a mean of per-row percentages...'); TeamDashboard.tsx:491-492
- **External references:** Natural Stat Trick team on-ice definitions; PDO = on-ice SH% + SV%
- **Examples / fixtures / test data:** `web/lib/stats/percentUnits.test.ts`; `web/components/TeamDashboard/AdvancedL10Metrics.test.tsx`
- **Tests:** `web/lib/stats/percentUnits.test.ts`; `web/components/TeamDashboard/AdvancedL10Metrics.test.tsx`

### NST-033 Strength segments and TOI by split (skater and goalie)

- **Intent / contract:** tasks/TASKS/xg-model/docs/definitions-and-parity.md:153 (raw TOI and TOI/GP must remain available); tasks/TASKS/xg-model/nhl-api-foundation/shift-charts-vs-nhl-api-shifts-audit.md (TOI parity audit)
- **External references:** NST TOI by strength (shift-chart based, seconds)
- **Examples / fixtures / test data:** `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `tasks/TASKS/xg-model/nhl-api-foundation/shift-charts-vs-nhl-api-shifts-audit.md`
- **Tests:** `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`

### NST-034 NHL-vs-legacy NST parity validation tolerances

- **Intent / contract:** tasks/TASKS/xg-model/release/prd/prd-xg-release-validation-and-exception-resolution.md (release validation and exception policy); tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:90 (NHL-derived correctness wins over NST on edge cases, divergences documented)
- **External references:** Natural Stat Trick gamelog values
- **Examples / fixtures / test data:** `tasks/TASKS/xg-model/release/tasks-xg-release-exception-resolution.md`; `tasks/TASKS/xg-model/nhl-api-foundation/validation-checklist.md`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md`
- **Tests:** `web/lib/supabase/Upserts/nhlXgValidation.test.ts`

## Player cards & homepage stats (CARD)

### CARD-001 WiGO per-game table: per-GP, S%, 84-game pace

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL S% convention; season pace
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/WiGO/PerGameStatsTable.test.tsx`

### CARD-002 Player-card interaction snapshot sample TOI back-calculation

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/player-cards/interactionFixtures.ts`
- **Tests:** `web/lib/player-cards/shareExport.test.ts`; `web/components/player-cards/EditorialPlayerCard.test.tsx`

### CARD-003 Player vs Player comparison (totals / per appearance / per 60 with NST coverage gate)

- **Intent / contract:** web/lib/socialShare/modules/playerVsPlayer.ts:7-10 comment (two players on one basis and strength; no consensus claimed)
- **External references:** NST per-60 convention
- **Examples / fixtures / test data:** `web/lib/socialShare/modules/playerVsPlayer.candidates.json`
- **Tests:** `web/lib/socialShare/modules/playerVsPlayer.test.ts`

### CARD-004 Analysis card radar/bars common raw scale

- **Intent / contract:** web/components/player-cards/PlayerAnalysisCard.tsx:65/69 labels 'Raw count shape, not percentiles'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/player-cards/analysisFixtures.ts (captureFixture, deterministic synthetic)`
- **Tests:** `web/components/player-cards/PlayerAnalysisStudio.test.tsx`

### CARD-005 Player-card analysis snapshot readings (total / per-game / per-60, xG share)

- **Intent / contract:** web/lib/player-cards/analysisSnapshot.ts:6 'Consumer contract only'; :84 'Copies inputs before selecting'; tasks/tasks-prd-player-cards-evolution-2026-10-31.md
- **External references:** NST per-60 convention; ratio-of-sums
- **Examples / fixtures / test data:** `web/lib/player-cards/analysisFixtures.ts (captureFixture, deterministic synthetic)`
- **Tests:** `web/lib/player-cards/analysisSnapshot.test.ts`; `web/components/player-cards/PlayerAnalysisStudio.test.tsx`

### CARD-006 Player-card recent vs baseline difference

- **Intent / contract:** web/lib/player-cards/currentNhl.ts:98-99 comment 'Equal, non-overlapping own-appearance windows... never becomes a smaller, silently substituted comparison'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/player-cards/analysisFixtures.ts (captureFixture, deterministic synthetic)`
- **Tests:** `web/lib/player-cards/analysisSnapshot.test.ts`; `web/components/player-cards/CurrentPlayerCardStudio.test.tsx`

### CARD-007 Player-card artwork/outline geometry (grouped)

- **Intent / contract:** web/lib/player-cards/alphaOutline.ts:46-49; portraitTreatment.ts:31 'RGB-only transforms'
- **External references:** Rec.709 luminance; Felzenszwalb-Huttenlocher EDT
- **Examples / fixtures / test data:** `web/lib/player-cards/reviewedHeroSamples.ts`
- **Tests:** `web/lib/player-cards/alphaOutline.test.ts`; `web/lib/player-cards/portraitTreatment.test.ts`; `web/lib/player-cards/outlineStack.test.ts`

### CARD-008 BLSH current card evidence gate and market reference gap

- **Intent / contract:** web/lib/player-cards/analysisEvidence.ts:35 'Consumes the owner's display mapping. Never recomputes a BLSH score or direction.'; :8 'exposure qualification never certifies counting stats'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/__fixtures__/syntheticProfiles.ts`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `web/lib/player-cards/analysisFixtures.ts`
- **Tests:** `web/lib/player-cards/analysisEvidence.test.ts`; `web/lib/buyLowSellHigh/market.test.ts`; `web/components/player-cards/PlayerAnalysisStudio.test.tsx`

### CARD-009 BLSH retained research evidence on player cards (box comparison, capture age, direction)

- **Intent / contract:** web/lib/player-cards/retainedBlsh.ts:4 'Frozen local research handoff, not live input admission or a scoring implementation'; tasks/tasks-prd-buy-low-sell-high.md; tasks/tasks-prd-player-cards-evolution-2026-10-31.md
- **External references:** Regression-to-support / expected-vs-actual production gap (BLSH method lives in web/lib/buyLowSellHigh); NHL official boxscore as ground truth for counts
- **Examples / fixtures / test data:** `web/lib/buyLowSellHigh/__fixtures__/retainedData.ts`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `web/lib/buyLowSellHigh/__fixtures__/syntheticProfiles.ts`; `web/lib/buyLowSellHigh/__fixtures__/syntheticSnapshots.ts`; `web/components/blshTrade/fixtureEvidence.ts`
- **Tests:** `web/lib/player-cards/retainedBlsh.test.ts`; `web/lib/player-cards/analysisEvidence.test.ts`; `web/components/player-cards/PlayerAnalysisStudio.test.tsx`; `web/lib/buyLowSellHigh/displayProfile.test.ts`

### CARD-010 Dashboard insight tone and trend bands

- **Intent / contract:** web/lib/dashboard/playerInsightContext.ts:19-21 comment: luck pressure compares shooting, on-ice shooting and IPP with position norms
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### CARD-011 Yahoo ownership freshness gate

- **Intent / contract:** web/lib/dashboard/playerOwnership.ts:79-80 Yahoo season by starting year comment
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/dashboard/playerOwnership.test.ts`; `web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts`

### CARD-012 Top Adds composite score

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED weights; product gate context in tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md:3567 (FORGE-TOP-ADDS-WEEK)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/dashboard/topAddsRanking.test.ts (inline)`
- **Tests:** `web/lib/dashboard/topAddsRanking.test.ts`

### CARD-013 Homepage pregame projected-score freshness and SOG/xG merge

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL.com team SOG
- **Examples / fixtures / test data:** `web/lib/homepageGameAnalytics.test.ts (inline)`
- **Tests:** `web/lib/homepageGameAnalytics.test.ts`

### CARD-014 Homepage model-vs-market edge and favoured team

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** No-vig implied probability edge
- **Examples / fixtures / test data:** `web/lib/homepageGameAnalytics.test.ts (inline)`
- **Tests:** `web/lib/homepageGameAnalytics.test.ts`

### CARD-015 Homepage pulse sparkline (model edge / confidence)

- **Intent / contract:** web/lib/homepagePulse.ts:191-193 comment: historical rows predate market snapshots; distance from 50% keeps offseason pulse real until market capture resumes
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/homepagePulse.test.ts (inline)`
- **Tests:** `web/lib/homepagePulse.test.ts`; `web/components/HomePage/HomepagePulse.test.tsx`; `web/__tests__/index.test.tsx`

### CARD-016 Homepage daily visitors

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/homepageVisitors.test.ts`

### CARD-017 Production-by-game chart scaling

- **Intent / contract:** web/components/player-cards/ProductionGameChart.tsx:4 'Fixed 0-5 point scale across every window/player'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/player-cards/CurrentPlayerCardStudio.test.tsx`

### CARD-018 Current NHL card pooled basic rates (ATOI, shots/goals/points per 60, SH%)

- **Intent / contract:** web/lib/player-cards/currentNhl.ts:1 'NHL basic skater results... deliberately separate from NST metrics'; definitions at currentNhl.ts:7-17
- **External references:** NHL.com TOI/GP and per-60 conventions; ratio-of-sums SH%
- **Examples / fixtures / test data:** `web/lib/player-cards/currentNhl.test.ts (inline fixtures)`; `contract-fixture source in CurrentPlayerCardStudio tests`
- **Tests:** `web/lib/player-cards/currentNhl.test.ts`; `web/components/player-cards/CurrentPlayerCardStudio.test.tsx`

### CARD-019 Player-card pooled NST metric (ATOI, per-60, percentage)

- **Intent / contract:** web/lib/player-cards/aggregation.ts:41 'Arithmetic only; makes no source, window or league-coverage claim'; registry formulas web/lib/player-cards/registry.ts:11-22; tasks/tasks-prd-player-cards-evolution-2026-10-31.md:46 (all-NHL same-definition cohort, competition ranks, midrank percentiles, no GP/TOI filters); tasks/tasks-prd-shareable-player-cards.md:42
- **External references:** NST per-60 convention (events*60/TOI min) and NST on-ice xGF%, IPP, SH%, oiSH% definitions; ratio-of-sums convention
- **Examples / fixtures / test data:** `web/lib/player-cards/fixtures.ts (fixtureSnapshot)`; `web/lib/player-cards/interactionFixtures.ts (buildInteractionFixture)`; `web/lib/player-cards/__fixtures__/retained/player-cards-2026-10-25/completion-read-01`
- **Tests:** `web/lib/player-cards/aggregation.r1.test.ts`; `web/lib/player-cards/domain.test.ts`

### CARD-020 NST gamelog capture mapping to card records

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in code beyond rejection reasons; tasks/diaries/2026-10-25-claude-c1-evidence-bundle.md (evidence bundle work)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/player-cards/fixtures.ts (fixtureSnapshot)`; `web/lib/player-cards/interactionFixtures.ts (buildInteractionFixture)`; `web/lib/player-cards/__fixtures__/retained/player-cards-2026-10-25/completion-read-01`
- **Tests:** `web/lib/player-cards/nstCapture.test.ts`; `web/lib/player-cards/cardEvidenceVerdict.test.ts`

### CARD-021 Observed-card sample TOI back-calculation

- **Intent / contract:** web/lib/player-cards/observedView.ts:12 'Presentation projection only'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/player-cards/fixtures.ts (fixtureSnapshot)`; `web/lib/player-cards/interactionFixtures.ts (buildInteractionFixture)`; `web/lib/player-cards/__fixtures__/retained/player-cards-2026-10-25/completion-read-01`
- **Tests:** `web/components/player-cards/ObservedPlayerCard.test.tsx`; `web/lib/player-cards/observedExport.test.ts`

### CARD-022 Player-card competition rank and midrank percentile

- **Intent / contract:** web/lib/player-cards/analysisSnapshot.ts:8-9 CARD_RANK_POLICY approved by TJ 2026-11-01; web/lib/player-cards/ranking.ts:7 'Proposed numeric convention; no GP/TOI/position/active-roster qualifier'; tasks/tasks-prd-player-cards-evolution-2026-10-31.md:46 (all-NHL same-definition cohort, competition ranks, midrank percentiles, no GP/TOI filters); tasks/tasks-prd-shareable-player-cards.md:42
- **External references:** Empirical percentile rank (midrank) convention
- **Examples / fixtures / test data:** `web/lib/player-cards/fixtures.ts (fixtureSnapshot)`; `web/lib/player-cards/interactionFixtures.ts (buildInteractionFixture)`; `web/lib/player-cards/__fixtures__/retained/player-cards-2026-10-25/completion-read-01`
- **Tests:** `web/lib/player-cards/ranking.test.ts`; `web/lib/player-cards/analysisSnapshot.test.ts`; `web/components/player-cards/EditorialPlayerCard.test.tsx`

### CARD-023 Stats page leaderboards (BSH, goalie min-GP filter, top-5 sorts)

- **Intent / contract:** **UNDOCUMENTED** — web/lib/NHL/statsPageFetch.ts comments near :282 ('Filter the full season dataset before taking each position's top five'); goalie min-GP rule UNDOCUMENTED
- **External references:** NHL.com goalie leader qualification (minimum games/minutes)
- **Examples / fixtures / test data:** `web/lib/NHL/statsPageFetch.test.ts (mocked Supabase rows)`
- **Tests:** `web/lib/NHL/statsPageFetch.test.ts`

### CARD-024 Player-card appearance window selection (L5/L10/L20 or calendar)

- **Intent / contract:** web/lib/player-cards/windows.ts:61 'No implicit defaults; provisional season and short-sample choices are explicit'; windows.ts:36 minute-range completion contract
- **External references:** Last-N-games window convention (games, not days)
- **Examples / fixtures / test data:** `web/lib/player-cards/fixtures.ts (fixtureSnapshot)`; `web/lib/player-cards/interactionFixtures.ts (buildInteractionFixture)`; `web/lib/player-cards/__fixtures__/retained/player-cards-2026-10-25/completion-read-01`
- **Tests:** `web/lib/player-cards/domain.test.ts`

## Lines / TOI / PP units (LINE)

### LINE-001 generated column team_unit_toi.unit_share

- **Intent / contract:** supabase/migrations/20260716112908_production_schema_baseline.sql:26054 COMMENT 'Generated unit_toi_seconds / team_unit_pool_toi_seconds share.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/exactFivePp/exactFivePpUnits.test.ts`; `web/__tests__/pages/rankings.test.tsx`

### LINE-002 view vw_pp_unit_share_recent

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### LINE-003 fn refresh_player_lineup_deployment_tallies

- **Intent / contract:** supabase/migrations/20260716112908_production_schema_baseline.sql:3079 COMMENT 'Refreshes player lineup deployment tallies from lineCombinations and powerPlayCombinations'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-lineup-deployment-tallies.test.ts`

### LINE-004 Date Range Matrix cell shade from shared TOI%

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/DateRangeMatrix/index.accessibility.test.tsx`

### LINE-005 Tweet trainer confidence tone bands (component copy)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### LINE-006 Social share deployment change (TOI/GP L5 vs season, line and PP unit step)

- **Intent / contract:** web/lib/socialShare/trends.ts:146-150 (two PP units rule) and :218-220 (column driver rule)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/socialShare/trendsFixture.ts`
- **Tests:** `web/lib/socialShare/trends.test.ts`; `web/lib/socialShare/trendSources.test.ts`; `web/components/SocialShare/SocialShare.test.tsx`; `web/e2e/social-share.spec.ts`

### LINE-007 Decisions reference shadow adapter: token reservation, USD budget and material-news triage

- **Intent / contract:** web/lib/sources/decisionsReference/adapter.mjs:147 comment ('Dependency-free, deliberately conservative estimate; NOT an exact tokenizer')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sources/tweetDecisionReview.test.ts`

### LINE-008 Tweet identity resolution evaluation grading (baseline vs deterministic vs mocked resolver)

- **Intent / contract:** web/lib/sources/tweetIdentityEvaluation.ts:76-79 (interpretation and note strings)
- **External references:** Entity-linking precision/recall (retrieval recall@k, assignment precision)
- **Examples / fixtures / test data:** `web/lib/sources/fixtures/tweetIdentityDevelopmentComparison.ts`
- **Tests:** `web/lib/sources/tweetIdentityEvaluation.test.ts`

### LINE-009 Per-game TOI and power-play TOI share series

- **Intent / contract:** Code comment web/pages/api/toi.ts:120-124: PP TOI is FORGE toi_pp_seconds and the share divides by the PP TOI of the team the player dressed for
- **External references:** PP TOI share = player PP TOI / team PP TOI (NHL/NST convention)
- **Examples / fixtures / test data:** `web/__tests__/pages/api/toi.test.ts (inline rows)`
- **Tests:** `web/__tests__/pages/api/toi.test.ts`

### LINE-010 Shift-chart overlap, percent-TOI-with and greedy line/pair assignment

- **Intent / contract:** JSDoc on getPairwiseTOI (shift-charts.ts:~375 '@returns Total TOI in seconds')
- **External references:** Line identification from ES shared TOI (NST/DailyFaceoff style)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts`; `web/__tests__/pages/api/v1/db/update-nhl-shift-charts.test.ts`

### LINE-011 Power-play unit assignment and PP time from play-by-play

- **Intent / contract:** Comments [gameId].ts:~200-210 (a team with PP time must show players on ice; catches grossly incomplete feed)
- **External references:** PP unit identification by shared 5v4 ice time (e.g. NST line tool)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts`; `web/__tests__/pages/api/v1/db/update-power-play-combinations.test.ts`

### LINE-012 DRM line/pair builder with comboPoints

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Daily Faceoff / LeftWingLock line usage frequency
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/DateRangeMatrix/lineCombinationHelper.test.ts`; `web/__tests__/pages/drm.test.tsx`

### LINE-013 Line promotions/demotions and line-card goalie stats

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL SV% = saves/shots and GAA = GA*3600/TOI seconds (pooled)
- **Examples / fixtures / test data:** `web/components/LineCombinations/__test__/LineCombinationsData.ts`
- **Tests:** `web/components/LineCombinations/__test__/utilities.test.ts`; `web/__tests__/pages/lines/index.test.tsx`

### LINE-014 Player lineup deployment tallies (line/pair/PP slot shares)

- **Intent / contract:** web/supabase/migrations/20260629020121_create_player_lineup_deployment_tallies.sql:281-290 COMMENTs (percentage-grid tallies; share within player/season/game_type/deployment_group)
- **External references:** Daily Faceoff line deployment percentages
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-lineup-deployment-tallies.test.ts`

### LINE-015 Source authority tier weights

- **Intent / contract:** web/lib/lines/authority.ts:5-44 comments (TJ sourcing rule 2026-11-06 / 11-07)
- **External references:** Daily Faceoff / LeftWingLock source hierarchy (team > beat > aggregator)
- **Examples / fixtures / test data:** `web/lib/lines/fixtures/clubHandles.ledger.json`
- **Tests:** `web/lib/lines/decisions.test.ts`; `web/lib/lines/processor.test.ts`

### LINE-016 Beat-reporter candidate confidence and team-conflict share

- **Intent / contract:** web/lib/lines/beatReporterInference.ts:39-55 comments
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/lines/beatReporterInference.test.ts`

### LINE-017 Line claim decision: context, certainty and binding

- **Intent / contract:** web/lib/lines/decisions.ts:26-30, 41, 85-88 docblocks
- **External references:** Daily Faceoff confirmed vs projected labels
- **Examples / fixtures / test data:** `web/lib/sources/fixtures/claimContextCases.json`
- **Tests:** `web/lib/lines/decisions.test.ts`; `web/lib/lines/binding.test.ts`; `web/lib/lines/sourceClaims.test.ts`

### LINE-018 PP unit carry-forward, staleness and swaps

- **Intent / contract:** web/lib/lines/reconcile.ts:160 docblock
- **External references:** Daily Faceoff PP unit reports
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/lines/ppRules.test.ts`; `web/lib/lines/reconcile.test.ts`

### LINE-019 Entry lineup selection (context rank > authority > recency) and freeze

- **Intent / contract:** web/lib/lines/reconcile.ts:70 comment; reconcile.ts:108-109, 133-134 comments
- **External references:** Daily Faceoff line confirmation workflow (warmups > morning skate > practice)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/lines/reconcile.test.ts`; `web/lib/lines/service.test.ts`; `web/lib/lines/processor.test.ts`

### LINE-020 Injury attribute confidence + severity tier

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sources/injuryStatusIngestion.test.ts`

### LINE-021 First-arrival winner per lineup signal bucket

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sources/lineSourceFirstArrival.test.ts`

### LINE-022 American odds to implied probability

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Standard American-odds conversion; de-vig (multiplicative/Shin) for fair probability
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sources/oddsSourceIngestion.test.ts`

### LINE-023 Tweet claim extraction precision/recall (prospective evaluation)

- **Intent / contract:** web/lib/sources/tweetClaimEvaluation.ts:29, 48 docblocks
- **External references:** Standard IR precision/recall
- **Examples / fixtures / test data:** `web/lib/sources/fixtures/tweetLunaEvaluation.ts`; `web/lib/sources/fixtures/tweetLunaAdjudicatedLibrary.json`
- **Tests:** `web/lib/sources/tweetClaimEvaluationBounds.test.ts`; `web/lib/sources/tweetClaimEvaluationIntake.test.ts`; `web/lib/sources/tweetLunaReview.test.ts`

### LINE-024 News inference auto-publish confidence thresholds

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sources/tweetNewsInference.test.ts`

### LINE-025 Tweet parse card confidence score (swipe trainer)

- **Intent / contract:** web/lib/sources/tweetSwipeTrainer.ts:543-546 docblock
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/sources/fixtures/tweetClassificationLabels.json`; `web/lib/sources/fixtures/october11TroublesomeTweets.json`
- **Tests:** `web/lib/sources/tweetSwipeTrainer.test.ts`; `web/components/TweetSwipeTrainer/TweetSwipeTrainer.test.tsx`

### LINE-026 Date-range linemate aggregation (DRM) and %TOI-with

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NST 'TOI together' and 'TOI% with' (5v5)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/DateRangeMatrix/fetchAggregatedData.test.ts`; `web/components/DateRangeMatrix/useTOIData.test.ts`; `web/components/DateRangeMatrix/useDateRangeMatrixData.test.tsx`; `web/__tests__/pages/drm.test.tsx`

### LINE-027 Linemate shared-TOI matrix (game) and greedy line clustering

- **Intent / contract:** web/components/LinemateMatrix/index.tsx:521 comment (TJ: three fwds with most shared toi, then 2nd, 3rd, 4th)
- **External references:** NST line TOI (5v5), Daily Faceoff / LeftWingLock confirmed lines
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/LinemateMatrix/index.test.tsx`; `web/__tests__/pages/api/v1/db/update-line-combinations.test.ts`; `web/lib/lines/matrixCapture.test.tsx`

### LINE-028 Shift-chart replay TOI, game clock axis and shared-interval matrix

- **Intent / contract:** web/components/ShiftChart/model.ts:388 comment (same shared-seconds measure as the standalone matrix)
- **External references:** NHL shift-chart conventions
- **Examples / fixtures / test data:** `web/components/ShiftChart/testFixtures.ts`
- **Tests:** `web/components/ShiftChart/model.test.ts`; `web/components/ShiftChart/Replay.test.tsx`; `web/components/ShiftChart/useGameGrid.test.tsx`

### LINE-029 Shift-chart pair shared TOI and %TOI-with (route)

- **Intent / contract:** web/pages/api/v1/db/shift-charts.ts:2-41 header: critical ingestion step for player TOI and line combinations
- **External references:** NST line/pair TOI (5v5 'TOI together'), Dobber/LeftWingLock line combos
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/shift-charts.audit.test.ts`; `web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts`; `web/__tests__/pages/api/v1/db/shift-charts.transactional.test.ts`

### LINE-030 PP TOI % per game chart bands

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/PlayerPPTOIPerGameChart/PPTOIChart.test.tsx`

### LINE-031 PowerPlayCombos unit card PP stats

- **Intent / contract:** web/components/PowerPlayCombos/PowerPlayCombos.tsx:436-439 comment
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/PowerPlayCombos/PowerPlayCombos.test.tsx`

### LINE-032 Exact-five PP units (observed 5v4/5v3 groups)

- **Intent / contract:** web/lib/exactFivePp/exactFivePpUnits.ts:1-28 header (offline proposal, interval and manpower semantics)
- **External references:** NST PP unit TOI; Evolving-Hockey 5v4 unit TOI
- **Examples / fixtures / test data:** `web/lib/exactFivePp/exactFivePpFixtures.ts`; `web/lib/exactFivePp/exactFivePpOracle.ts`
- **Tests:** `web/lib/exactFivePp/exactFivePpUnits.test.ts`

### LINE-033 Player TOI / PP TOI share series (/api/toi)

- **Intent / contract:** web/pages/api/toi.ts:120-124 docblock
- **External references:** NST PP TOI% (individual PP TOI / team PP TOI)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/toi.test.ts`

### LINE-034 PP unit assignment + per-player PP usage metrics (powerPlayCombinations)

- **Intent / contract:** web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:59-60 comment (team-share stored separately for consistent pp_share_pct denominator); [gameId].ts:17-20 comments on thresholds
- **External references:** NST PP TOI% (player PPTOI / team PPTOI); Daily Faceoff / LeftWingLock PP unit reports
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts`; `web/__tests__/pages/api/v1/db/update-power-play-combinations.test.ts`; `web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts`; `web/components/LinemateMatrix/index.test.tsx`

### LINE-035 Penalty PP timeframes (legacy per-penalty blocks + details)

- **Intent / contract:** web/utils/getPowerPlayBlocks.ts:187-196 docblock (one block per penalty, not manpower)
- **External references:** NHL penalty rules; NST PP opportunities/TOI
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`

### LINE-036 Power-play blocks (manpower advantage timeline)

- **Intent / contract:** web/utils/getPowerPlayBlocks.ts:392-399 docblock (minor ends early on goal, double minor loses current 2 min, coinciding cancel, max two serving)
- **External references:** NHL Rule 16/19 penalty and coincidental-penalty rules; NST PP TOI from situation codes
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts`; `web/components/ShiftChart/model.test.ts`

### LINE-037 Per-player ES/PP/PK TOI from shifts (strengthForTeam)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (only inline error contracts)
- **External references:** NST strength-state convention (5v5 / PP / SH by skater counts incl. goalie pull handling)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts`; `web/__tests__/pages/api/v1/db/shift-charts.transactional.test.ts`

### LINE-038 PBP situation timeline per period

- **Intent / contract:** web/lib/projections/ingest/shifts.ts:817-821 comment: split every validated shift interval against the same complete PBP situation timeline used for strength totals
- **External references:** NHL PBP situationCode convention; NST/Evolving-Hockey derive strength from on-ice player counts in shift charts rather than event-sampled codes
- **Examples / fixtures / test data:** `web/__tests__/fixtures/nst`; `web/components/ShiftChart/testFixtures.ts`
- **Tests:** `web/__tests__/pages/api/v1/db/shift-charts.audit.test.ts`; `web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts`; `web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts`

### LINE-039 Event on-ice attribution + team strength state

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Evolving-Hockey / NST on-ice event attribution
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlOnIceAttribution.test.ts`

### LINE-040 Shift interval normalization + stint sweep

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL shift-chart on-ice attribution convention (players on at event time; outgoing players credited at a change second)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/Upserts/nhlShiftStints.test.ts`; `web/lib/supabase/Upserts/nhlOnIceAttribution.test.ts`; `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`

### LINE-041 team_unit_toi 5v5 forward-line / D-pair pooled TOI

- **Intent / contract:** web/lib/rankings/teamUnitToiBuilder.ts:103-105 comment (unclassified skaters break the 5v5 count); metadata secondsBasis 'overlap_segments_multiplied_by_unit_player_count'
- **External references:** NST line/pair 5v5 TOI (clock seconds together), Evolving-Hockey line tools
- **Examples / fixtures / test data:** `web/lib/rankings/fixtures/rankingsTrust.json`
- **Tests:** `web/lib/rankings/teamUnitToiBuilder.test.ts`; `web/lib/rankings/teamUnitToiNightly.test.ts`; `web/lib/rankings/teamUnitToiWriter.test.ts`; `web/__tests__/pages/api/v1/db/update-team-unit-toi.test.ts`

### LINE-042 team_unit_toi power-play units (from powerPlayCombinations)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (metadata secondsBasis 'sum_powerPlayCombinations_player_PPTOI_by_unit')
- **External references:** NST PP unit TOI (clock seconds of 5-man group on 5v4)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/teamUnitToiBuilder.test.ts`

### LINE-043 team_unit_toi shift cleanup + nightly planning/completeness

- **Intent / contract:** web/lib/rankings/teamUnitToiBuilder.ts:476-483 comment (NHL served game 2025020565 with mixed VGK/SJS shifts)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/rankings/teamUnitToiNightly.test.ts`; `web/__tests__/pages/api/v1/db/update-team-unit-toi.test.ts`

## WiGO (WIGO)

### WIGO-001 views nst_percentile_{es,pk,pp,as}_{offense,defense} (rate sources)

- **Intent / contract:** supabase/migrations/20261104011002_nst_percentile_as_from_gamelogs.sql:1-7 (WiGO P-2: views over AS game logs, same shape as ES/PP/PK)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/e2e/fixtures/wigo/schema.json`
- **Tests:** `web/utils/fetchWigoRatingStats.test.ts`; `web/utils/fetchWigoPlayerStats.test.ts`

### WIGO-002 WiGO game-log chart reference averages and nice ticks

- **Intent / contract:** StatsTableRowChart.tsx:75 comment: round ticks from zero, about four steps
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### WIGO-003 WiGO career and recent stat builder (STD/LY/3YA/CA, L5/L10/L20)

- **Intent / contract:** Comments calculate-wigo-stats.ts:601-606 (one builder per period, numerator and denominator from same seasons, absent source gives null not 0; references C-21, C-25, C-30, C-31, B-06)
- **External references:** NST per-60; IPP = points / on-ice GF
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts`

### WIGO-004 WiGO comparison DIFF (% change between timeframes)

- **Intent / contract:** web/components/WiGO/tableUtils.ts:11-14 docblock
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/WiGO/tableUtils.test.ts`; `web/components/WiGO/WigoComparisonBand.test.tsx`

### WIGO-005 WiGO career/recent aggregates writer (STD/LY/3YA/CA, L5/L10/L20)

- **Intent / contract:** web/pages/api/v1/db/calculate-wigo-stats.ts:600-605 comment (C-21, C-31: numerator and denominator from same seasons)
- **External references:** NST per-60 convention (count / TOI minutes * 60); pooled ratio estimators
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts`

### WIGO-006 WiGO aggregate table assembly + per-60 fallback derivation

- **Intent / contract:** web/utils/fetchWigoPlayerStats.ts:247-248 comment; statMetadata normalization metadata
- **External references:** NST per-60 convention
- **Examples / fixtures / test data:** `web/e2e/fixtures/wigo/wigoFixtures.ts`
- **Tests:** `web/utils/fetchWigoPlayerStats.test.ts`; `web/components/WiGO/statMetadata.test.ts`

### WIGO-007 WiGO points-per-game, PPG rolling, game mean and consistency distribution

- **Intent / contract:** web/components/WiGO/gameLogMean.ts:9-11 comment
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/WiGO/ConsistencyChart.test.tsx`; `web/components/WiGO/StatsTableRowChart.test.tsx`; `web/components/WiGO/ToiLineChart.test.tsx`

### WIGO-008 WiGO game-log series (per-game stat, PTS1%, PTS1/60, PP per-60)

- **Intent / contract:** inline comments fetchWigoPlayerStats.ts:92-93, 151, 507-508
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/utils/fetchWigoPlayerStats.test.ts`

### WIGO-009 Skater Game Score (per game) + 5/10-game rolling averages

- **Intent / contract:** baseline SQL comment 'existing game_score calculation remains unchanged' (no source cited)
- **External references:** Dom Luszczyszyn Game Score (2016): CF/CA and GF/GA are 5v5 on-ice
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/WiGO/GameScoreLineChart/index.test.tsx`; `web/components/WiGO/GameScoreSection.test.tsx`; `web/utils/formattingUtils.test.ts`

### WIGO-010 WiGO rate-stat percentile panel (cohort, min-GP, season fallback)

- **Intent / contract:** web/utils/fetchWigoPercentiles.ts:152-157 docblock
- **External references:** NST player card percentiles
- **Examples / fixtures / test data:** `web/e2e/fixtures/wigo/wigoFixtures.ts`
- **Tests:** `web/utils/fetchWigoPercentiles.test.ts`; `web/components/WiGO/RateStatPercentiles.test.tsx`

### WIGO-011 WiGO midrank percentile

- **Intent / contract:** web/utils/calculatePercentiles.ts:89-98 docblock
- **External references:** Midrank / Hazen percentile rank
- **Examples / fixtures / test data:** none found
- **Tests:** `web/utils/calculatePercentiles.test.ts`

### WIGO-012 WiGO dead percentile loader (fetchPercentilePlayerData)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### WIGO-013 WiGO player ratings (offense/defense/overall by strength)

- **Intent / contract:** web/utils/calculateWigoRatings.ts:28 formula comment M' = (GP*M + (P-GP)*mM)/P; ratingWeights.ts:96 comment; calculateWigoRatings.ts:66-67 (min 20 peers)
- **External references:** Percentile composite ratings (e.g. Evolving-Hockey RAPM/GAR as stronger alternative); Tango regression to the mean
- **Examples / fixtures / test data:** `web/e2e/fixtures/wigo/wigoFixtures.ts`
- **Tests:** `web/utils/calculateWigoRatings.test.ts`; `web/utils/fetchWigoRatingStats.test.ts`; `web/components/WiGO/PlayerRatingsDisplay.test.tsx`

### WIGO-014 Team performance drivers (5v5 generation/suppression/finishing, special teams percentiles)

- **Intent / contract:** web/components/WiGO/teamPerformanceDriverModel.ts:42, 98 comments
- **External references:** NST team 5v5 xGF/60, xGA/60; standard PP%/PK%
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/WiGO/teamPerformanceDrivers.test.ts`; `web/components/WiGO/TeamPerformanceDrivers.test.tsx`

### WIGO-015 Draft-round performance tiers (tierUtils)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

## Goalie starters & starter odds (GST)

### GST-001 fn process_team_goalie_projections (+ calculate_goalie_start_projections)

- **Intent / contract:** migrations/20251126_calculate_goalie_projections.sql header comments; tombstone comment 'update-goalie-projections-v2 owns writes'
- **External references:** GSAA = SA*(1 - league SV%) - GA (expected GA minus actual GA)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/supabase/supportedBaselineMigration.test.ts`

### GST-002 RSO goalie likely-starter mark (p >= 0.5)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/RosterScheduleOptimizer/SlotWeekGrid.test.tsx`

### GST-003 Starter board operations SLO report (on-time share, nearest-rank latency percentiles, sample gate)

- **Intent / contract:** web/lib/projections/starterBoardOperations.ts:25 comment and limitations array (:101-106)
- **External references:** Nearest-rank percentile definition; SLO on-time share
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/startChartPipeline.test.ts`

### GST-004 Goalie board heat level and best/worst tie handling

- **Intent / contract:** web/lib/socialShare/modules/shared/goalieBoards.ts:33 comment (colour strength by size against the largest shown value; sign sets the colour)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/socialShare/modules/goaliePeriod.test.ts`

### GST-005 Goalie inventory team lenses (pooled per-game team rates, PP%, PK%, league ranks, back-to-back weaker opponent)

- **Intent / contract:** web/lib/socialShare/modules/shared/goalieInventory.sources.ts:144-148 comment (pooled from each game's counts, never a mean of rates; rank only when every team has the value)
- **External references:** NHL.com PP%/PK% definitions (PK% = 1 - PPGA/TSH)
- **Examples / fixtures / test data:** `web/lib/socialShare/modules/shared/goalieInventory.fixture.ts`
- **Tests:** `web/lib/socialShare/modules/shared/goalieInventory.sources.test.ts`; `web/lib/socialShare/modules/riskyStarts.test.ts`; `web/lib/socialShare/modules/startSit.test.ts`

### GST-006 Goalie inventory rank band, strength share and head-to-head winner

- **Intent / contract:** web/lib/socialShare/modules/shared/goalieInventory.sources.ts:367-383 comments (Risky Starts cut; strength as share of league; one winner rule)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/socialShare/modules/shared/goalieInventory.fixture.ts`
- **Tests:** `web/lib/socialShare/modules/riskyStarts.test.ts`; `web/lib/socialShare/modules/shared/goalieInventory.sources.test.ts`; `web/lib/socialShare/modules/startSit.test.ts`

### GST-007 Social share team start share (official starts / team games over last N)

- **Intent / contract:** web/lib/socialShare/modules/shared/goalieLedger.ts:56-60 comment (denominator is team games; relief apart; descriptive only, no start probability)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/socialShare/modules/shared/goalieInventory.fixture.ts`
- **Tests:** `web/lib/socialShare/modules/shared/ledgers.test.ts`

### GST-008 Goalie start probability and GSAA/60 (goalie_start_projections v2)

- **Intent / contract:** Comment update-goalie-projections-v2.ts:~372-378 (user wants rolling tally including the current game); docs/player-projections/duplicate-retirement-ledger.md RET-020
- **External references:** GSAx vs expected-goals (MoneyPuck/Evolving-Hockey) rather than fixed league sv%; starter models use rest days, back-to-backs, confirmations
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/db/update-goalie-projections-v2.test.ts`; `web/lib/projections/goaliePipeline.test.ts`

### GST-009 Goalie share / workload by team (L10/L20/L30/Season)

- **Intent / contract:** web/lib/goalieWorkload.ts:3-4, 54-55 docblocks; workloadEvidence.ts:4-7
- **External references:** Goalie usage share (starts / team games); NHL SV%/GAA
- **Examples / fixtures / test data:** `web/lib/socialShare/modules/shared/goalieInventory.fixture.ts`
- **Tests:** `web/components/GoalieShareChart/GoalieShareChart.test.ts`; `web/components/GoalieShareChart/GoalieShareChart.pagination.test.tsx`; `web/lib/socialShare/modules/creaseShift.test.ts`

### GST-010 News/evidence goalie override (confirmed/likely)

- **Intent / contract:** web/lib/projections/stages/goalie-stage.ts:507 comment (probability is not a source assertion)
- **External references:** Daily Faceoff Confirmed/Likely labels
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/goaliePipeline.test.ts`

### GST-011 Best goalie-start source selection (news/model precedence + TTL)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Daily Faceoff / LeftWingLock confirmed-starter labels
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sources/lineupSourceIngestion.test.ts`; `web/__tests__/pages/api/v1/db/update-lineup-source-provenance.test.ts`

### GST-012 Legacy SQL calculate_goalie_start_projections

- **Intent / contract:** migrations/20251126_calculate_goalie_projections.sql:1-6 header
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### GST-013 goalie_start_projections v2 (L10 start share + GSAA/60)

- **Intent / contract:** web/pages/api/v1/db/update-goalie-projections-v2.ts:101-103, 129-132, 156-157 docblocks; compatibilityInventory GOALIE_START_TABLE_OWNERSHIP
- **External references:** Goalie usage studies (rest/B2B splits); MoneyPuck GSAx; NHL league SV% ~.900-.905
- **Examples / fixtures / test data:** `web/__tests__/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap`
- **Tests:** `web/__tests__/pages/api/v1/forge/goalies.test.ts`; `web/__tests__/pages/api/v1/start-chart.test.ts`; `web/lib/projections/goaliePipeline.test.ts`

### GST-014 Starter board scoring (fantasy points, participation integration, ranks)

- **Intent / contract:** docs/start-chart/implementation.md; docs/start-chart/deep-research.md:21 (separate start probability from goalie value); launch-validation.md:1460 (apply participation once)
- **External references:** Yahoo default H2H points scoring; expected value = P(start) x conditional
- **Examples / fixtures / test data:** `web/__tests__/fixtures/consumerGameRevision.ts`
- **Tests:** `web/lib/projections/startChartPipeline.test.ts`; `web/lib/projections/goaliePipeline.test.ts`; `web/lib/projections/privateParticipationScenario.test.ts`; `web/__tests__/pages/api/v1/start-chart.test.ts`; `web/e2e/start-chart.spec.ts`

### GST-015 Starter board validation / promotion gate

- **Intent / contract:** web/lib/projections/starterBoardValidation.ts:54 docblock
- **External references:** Brier / log-loss calibration; paired bootstrap comparison
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/startChartPipeline.test.ts`; `web/__tests__/pages/start-chart.test.tsx`

### GST-016 FORGE starter probability model (computeStarterProbabilities)

- **Intent / contract:** docs/player-projections/model-inventory.md:24 (PP-004 'heuristic probability + weighted formula')
- **External references:** Goalie usage studies (B2B starter rates ~10-20% for repeat starter); Daily Faceoff confirmations; logistic starter models
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/module-imports.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/goaliePipeline.test.ts`

### GST-017 Starter candidate selection + scenario blend

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Mixture expectation
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/module-imports.test.ts`

### GST-018 Goalie starter mixture (B2B adjust, normalize, confidence, staleness)

- **Intent / contract:** web/lib/projections/goalieStarterMixtures.ts:160-161 comment (do not redistribute missing mass)
- **External references:** Goalie usage studies (B2B rotation)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/goalieStarterMixtures.test.ts`; `web/__tests__/pages/api/v1/db/operational-route-auth.test.ts`; `web/__tests__/pages/api/v1/start-chart.test.ts`

### GST-019 Team goalie starter context + line-combo goalie prior

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/projections/nativeGoalAccounting.test.ts`; `web/lib/projections/module-imports.test.ts`

### GST-020 Skater variance (production proxy SD)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Sample SD (n-1) / coefficient of variation
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/Variance/skaterVariance.test.ts`

## Draft tools (DRF)

### DRF-001 fn initialize_draft_ranking_from_yahoo / reorder_draft_ranking / repair_draft_ranking_ordering

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in SQL (archive migrations under supabase/migration-archive/pre-baseline-20260716/ hold the originals)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draft-ranker/server.test.ts`; `web/lib/supabase/fhfhDraftRankerYahooSeedMigration.test.ts`; `web/lib/supabase/fhfhDraftRankerReorderMigration.test.ts`; `web/lib/supabase/fhfhDraftRankerRepairMigration.test.ts`; `web/lib/supabase/fhfhDraftRankerPlacementMigration.test.ts`

### DRF-002 fn mock_draft_adp (+ mock_draft_ingest snake validation)

- **Intent / contract:** supabase/migrations/20260917133519_mock_draft_adp.sql:1 'Raw mock history is private; only the server may ingest or aggregate it.'
- **External references:** FantasyPros/Yahoo ADP (mean pick); quantile ADP ranges
- **Examples / fixtures / test data:** `supabase/tests/mock_draft_adp.sql`
- **Tests:** `supabase/tests/mock_draft_adp.sql`; `web/lib/mockDraft/api.test.ts`

### DRF-003 Projection source weight slider rebalancing

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/DraftDashboard/DraftSettingsShell.test.tsx`

### DRF-004 Projection source-weight sanitization and legacy percent-weight migration

- **Intent / contract:** **UNDOCUMENTED** — web/lib/draftDashboard/sourceControlPreferences.ts:130 comment: invalid preferences fail closed to the official-source defaults; otherwise UNDOCUMENTED
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/draftDashboard/sourceControlPreferences.test.ts`
- **Tests:** `web/lib/draftDashboard/sourceControlPreferences.test.ts`; `web/lib/draftDashboard/sourceWeights.test.ts`

### DRF-005 Social share rostered-% movers (Yahoo ownership pp change)

- **Intent / contract:** web/lib/socialShare/trends.ts:231 comment and trendDefinitions trends.ts:482 ('No observation != 0% · not add/drop counts')
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/socialShare/trendsFixture.ts (ownership series)`
- **Tests:** `web/lib/socialShare/trends.test.ts`; `web/lib/socialShare/trendSources.test.ts`; `web/components/SocialShare/SocialShare.test.tsx`; `web/e2e/social-share.spec.ts`

### DRF-006 Yahoo ownership and ADP movement

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts`

### DRF-007 Legacy projections page: projection-vs-actual diff% colour bands, ADP round buckets and source weight floor

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### DRF-008 Mock draft ADP aggregation (mock_draft_adp RPC)

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED (migration has no comments)
- **External references:** ADP conventions (FantasyPros/Yahoo: mean pick among drafts where selected; some providers assign undrafted players a penalty pick)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/mockDraft/api.test.ts`

### DRF-009 ComparePlayersModal percentiles and per-game rates

- **Intent / contract:** web/components/DraftDashboard/ComparePlayersModal.tsx:128 'Build percentiles across allPlayers for fairness'
- **External references:** Percentile rank conventions (mid-rank for ties)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/DraftDashboard/ComparePlayersModal.test.tsx`

### DRF-010 CSV import name fuzzy match (Levenshtein similarity)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Levenshtein / Jaro-Winkler name matching
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/DraftDashboard/ImportCsvModal.test.tsx`

### DRF-011 LeagueStandings team value, DraftSummaryModal steals/reaches/draft winner, DraftBoard heat

- **Intent / contract:** web/lib/draftDashboard/roundRankHistory.ts:12 'Reconstruct completed rounds from current picks, so undo/corrections cannot leave stale history.'
- **External references:** ADP value-vs-pick conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/DraftDashboard/LeagueStandings.test.tsx`; `web/__tests__/components/DraftDashboard/DraftSummaryModal.test.tsx`; `web/lib/draftDashboard/roundRankHistory.test.ts`

### DRF-012 ProjectionsTable value/VBD percentile bands, off-night rank colours, expected run forecast

- **Intent / contract:** web/components/DraftDashboard/ProjectionsTable.tsx:946 'Map deciles to 3 colors: bottom 0-30%=danger, 30-70%=warning, 70-100%=success'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/DraftDashboard/ProjectionsTable.test.tsx`

### DRF-013 Actual-stat unit normalization (TOI, SV%) + derived DEFENSE_POINTS / SH_ASSISTS

- **Intent / contract:** web/hooks/useProcessedProjectionsData.tsx:1324-1326 'Keep explicitly supplied provider SHA, including zero. Only custom sources without a direct SHA mapping retain the legacy derivation.'
- **External references:** NHL TOI conventions (mm:ss per game)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/hooks/useProcessedProjectionsData.test.tsx`; `web/lib/draftDashboard/derivedProjectionStats.test.ts`

### DRF-014 Yahoo ADP / percent drafted parsing

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Yahoo ADP definition (mean pick among drafts where player was selected)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/hooks/useProcessedProjectionsData.test.tsx`

### DRF-015 Projected fantasy points + per-game FP (projection processing)

- **Intent / contract:** web/lib/projectionsConfig/fantasyPointsConfig.ts:3-6 'Default fantasy point values for skater stats. Stats not listed here will default to 0.'
- **External references:** League scoring conventions (Yahoo/ESPN default points); ESPN default points scoring as comparison
- **Examples / fixtures / test data:** none found
- **Tests:** `web/hooks/useProcessedProjectionsData.test.tsx`; `web/lib/draftDashboard/fantasyPointRecalculation.test.ts`

### DRF-016 Projection vs actual diff % and round summaries

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Forecast error metrics (MAPE)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/hooks/useProcessedProjectionsData.test.tsx`

### DRF-017 Draft Pro DUST wrapper (schedule bench waste)

- **Intent / contract:** web/components/DraftDashboard/MyRoster.tsx:608 'DUST means Daily Unstartable Schedule Tax'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draft-pro/dust.test.ts`; `web/lib/draft-pro/api-tests/dust.test.ts`

### DRF-018 Community draft rankings: regularized Bradley-Terry with ADP prior

- **Intent / contract:** tasks/TASKS/draft-ranker/community-ranking-runbook.md:11-20 'Model: regularized-bradley-terry-v1... Prior: verified prior-season Yahoo ADP; its weight decays to zero at 20 independent users... Previously undrafted players: neutral broad prior, never a synthetic ADP'
- **External references:** Bradley-Terry / Elo-style paired comparison models with Gaussian prior (e.g. Glicko/TrueSkill shrinkage); Hunter MM algorithm
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draft-ranker/communityModel.test.ts`; `web/lib/draft-ranker/communityRedTeam.test.ts`; `web/lib/draft-ranker/communityServer.test.ts`

### DRF-019 Draft Ranker discovery signals: projection consensus gap, ownership risers, opportunity change

- **Intent / contract:** web/lib/draft-ranker/discovery.ts:7-16 DRAFT_RANKER_DISCOVERY_THRESHOLDS (minimumProjectionSources 2, projectionGapRanks 25, ownershipGainPoints 5, ownershipTopDecile 0.9, opportunityEventMinimumConfidence 0.75, opportunityDeploymentShareGain 0.15)
- **External references:** ADP vs projection-rank value gaps (FantasyPros ECR vs ADP)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draft-ranker/discovery.test.ts`; `web/__tests__/pages/api/v1/draft-ranker/discovery.test.ts`

### DRF-020 Draft Ranker assisted placement: binary-search rank interval engine

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in code; tasks/TASKS/draft-ranker/technical-contract.md
- **External references:** Binary insertion sort / noisy binary search
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draft-ranker/placementEngine.test.ts`

### DRF-021 Draft Ranker pair queue selection

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Active learning for paired comparisons
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draft-ranker/queue.test.ts`; `web/lib/draft-ranker/queueServer.test.ts`

### DRF-022 applyCategoryBoosts: Draft Pro valuation-only scoring boosts

- **Intent / contract:** web/lib/draftDashboard/categoryBoosts.ts:3 'Applies valuation-only Draft Pro boosts without mutating league scoring.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/DraftDashboard/DraftSettingsScoring.test.tsx`

### DRF-023 aggregateTeamCategoryTotals / rankTeamCategories / categoryRankBand

- **Intent / contract:** web/lib/draftDashboard/categoryStandings.ts:117-121 'Aggregates category projections without treating rates as counting stats...'
- **External references:** Roto/H2H category standings conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/DraftDashboard/GodView.test.tsx`; `web/lib/draftDashboard/draftWorkflow.integration.test.tsx`; `web/__tests__/components/DraftDashboard/LeagueStandings.test.tsx`

### DRF-024 Draft pick arithmetic: snake/custom order, keeper/traded pick numbers, pick windows

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Snake draft conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draftDashboard/godView.test.ts`; `web/lib/draftDashboard/keepers.test.ts`; `web/lib/draftDashboard/pickTrades.test.ts`; `web/e2e/god-view.spec.ts`

### DRF-025 buildPositionTiers / advisePosition: 1-D k-means positional tiers + take-now advice

- **Intent / contract:** web/components/DraftDashboard/SuggestedPicks.tsx:785 'Bands wider than 5% of the positional value range are split... A meaningful break exceeds three times the median adjacent gap and one quarter of the positional interquartile range... Take now means fewer than 0.5 comparable players estimated to remain before a meaningful drop; Can wait requires at least 1.5'
- **External references:** Jenks natural breaks / 1-D k-means tiering (e.g. Boris Chen Gaussian-mixture tiers)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draftDashboard/positionalTiers.test.ts`; `web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx`

### DRF-026 calculateScheduleMetrics: team games, off-nights, back-to-backs for draft weeks

- **Intent / contract:** web/lib/draftDashboard/scheduleMetrics.ts:26 'Count NHL opportunities, not predicted player/goalie appearances.'
- **External references:** Off-night convention: nights with <= half the league (<=8 of 16 games) playing
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draftDashboard/scheduleMetrics.test.ts`; `web/hooks/useDraftSchedule.test.tsx`; `web/e2e/draft-pro-free.spec.ts`

### DRF-027 calculateSourceAccuracy: projection source accuracy (mean normalized abs error)

- **Intent / contract:** web/components/DraftDashboard/ProjectionSourceAccuracy.tsx:59 'Accuracy is 100 minus mean normalized absolute error'
- **External references:** Forecast accuracy metrics (MAPE / sMAPE / MAE)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draftDashboard/sourceAccuracy.test.ts`

### DRF-028 rankProjectionPlayers / calculateSourceRankImpacts

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draftDashboard/sourceRankImpact.test.ts`

### DRF-029 calculateWeightedProjection / source shares: multi-source projection blend

- **Intent / contract:** web/hooks/useProcessedProjectionsData.tsx:2411 tooltip 'Projected is a weighted average.'
- **External references:** Projection aggregation (FantasyPros-style weighted consensus)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draftDashboard/sourceWeights.test.ts`; `web/lib/draftDashboard/draftWorkflow.integration.test.tsx`; `web/e2e/draft-settings.spec.ts`

### DRF-030 freezePlayers (mock draft adapter): per-category values, goalie workload

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/mockDraft/engine.test.ts`

### DRF-031 Mock draft bot pick model (decide): utility score + softmax sampling

- **Intent / contract:** web/lib/mockDraft/engine.ts:91 'Augmenting paths reassign dual-eligible players; greedy allocation can falsely fill a bench.'; :120 'All held players must remain assigned...'
- **External references:** Opponent modelling in draft simulators (ADP-based pick probability / softmax over value)
- **Examples / fixtures / test data:** `web/components/DraftDashboard/mock-sleepers-value-list.json`
- **Tests:** `web/lib/mockDraft/engine.test.ts`; `web/hooks/useMockDraft.test.ts`

### DRF-032 DraftDashboard roster needs: posNeeds, catNeeds, teamVorp, team projected points, picksUntilNext

- **Intent / contract:** web/components/DraftDashboard/DraftDashboard.tsx:2533 'compute my team's positional needs normalized 0..1 (remaining slots / total slots)'; :2615 'category deficits vector for my team (categories mode): league mean - my totals'
- **External references:** Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx`; `web/lib/draftDashboard/draftWorkflow.integration.test.tsx`

### DRF-033 SuggestedPicks free-path risk boost and sort keys

- **Intent / contract:** web/components/DraftDashboard/SuggestedPicks.tsx:408-409 'Preserve the established free rank ordering while using the shared availability estimate'
- **External references:** Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx`; `web/e2e/draft-layout.spec.ts`

### DRF-034 usePlayerRecommendations / buildRecommendationCandidates: recommendation rank score

- **Intent / contract:** web/hooks/usePlayerRecommendations.ts:2-4 'Computes top-N recommended players based on VORP/VBD and optional team needs weighting.'; :34 'A separately calculated filled-roster replacement map; never mutate global table VORP.'
- **External references:** Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
- **Examples / fixtures / test data:** none found
- **Tests:** `web/hooks/usePlayerRecommendations.test.tsx`; `web/lib/draftDashboard/draftWorkflow.integration.test.tsx`; `web/__tests__/components/DraftDashboard/MyRoster.test.tsx`

### DRF-035 useVORPCalculations: VORP / VOLS / VONA / VBD per player

- **Intent / contract:** tasks/draft-dashboard-youtube-outline.md:195-206: 'VORP - Value Over Replacement Player: how much more value a player offers than the position's estimated replacement option... Replacement depth comes from league size, starting slots, and a utility adjustment'; 'VONA - Value Over Next Available: estimated cost of waiting until your next turn... uses available players' ADP and the number of intervening picks... Multi-position players split their expected positional contribution'; 'VBD = 60% VORP + 30% VONA + 10% VOLS'; tasks/prd-positional-weighting.md:11-14 (weights applied to comparable value before replacement metrics)
- **External references:** Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
- **Examples / fixtures / test data:** `web/hooks/useVORPCalculations.test.tsx (inline player fixtures)`
- **Tests:** `web/hooks/useVORPCalculations.test.tsx`; `web/__tests__/components/DraftDashboard/DraftDashboardRecovery.test.tsx`; `web/__tests__/components/DraftDashboard/DraftRetention.test.tsx`; `web/lib/draft-pro/scenarioDashboardAdapter.test.ts`

### DRF-036 buildPersonalizedRecommendations (Draft Pro): need-weighted recommendation score

- **Intent / contract:** web/lib/draft-pro/recommendations.ts:148-151 'Builds suggestion-only personalized ranks. globalVorp and rankScore remain the league-wide values so tables can continue to present raw VORP.'; :137-139 'categoryScores already applies lower-is-better direction... missing categories contribute no fit.'; tasks/draft-pro/PLAN.md:28
- **External references:** Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative; SGP-based category need weighting
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draft-pro/recommendations.test.ts`; `web/__tests__/pages/api/v1/draft-pro/recommendations.test.ts`; `web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx`

### DRF-037 Scenario / report adapters: globalVorp and roster category totals (Draft Pro)

- **Intent / contract:** web/lib/draft-pro/scenarioDashboardAdapter.ts:82 'Scenario data is unavailable because ... has no current league VORP.'; tasks/draft-pro/PLAN.md:10
- **External references:** Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draft-pro/scenarioDashboardAdapter.test.ts`; `web/lib/draft-pro/reportDashboardAdapter.test.ts`; `web/lib/draft-pro/scenarios.test.ts`; `web/lib/draft-pro/reports.test.ts`; `web/lib/draft-pro/api-tests/scenarios.test.ts`; `web/lib/draft-pro/api-tests/reports.test.ts`

### DRF-038 estimatePlayerAvailability: ADP normal-survival availability probability

- **Intent / contract:** web/lib/draftDashboard/availability.ts:20 'ADP heuristic, conditional on availability now; not a calibrated room forecast.'
- **External references:** ADP-normal availability models (e.g. FantasyPros 'chance available'); ADP SD typically scales with ADP
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/components/DraftDashboard/SuggestedPicks.test.tsx`; `web/lib/draftDashboard/positionalTiers.test.ts`; `web/lib/draft-pro/recommendations.test.ts`

### DRF-039 buildPlayerValues: comparable draft value (points or category z-sum) + position weights

- **Intent / contract:** web/lib/draftDashboard/playerValues.ts:8 'Shared league-wide values; no availability or personalized replacement inputs.'; :90 'Weight only the comparable valuation, after scoring/proration and before replacement pools and tiers.'; tasks/prd-positional-weighting.md:11-14
- **External references:** Classic VBD (Joe Bryant, footballguys 'Value Based Drafting': value minus baseline player at position); VORP (Baseball Prospectus-style value over replacement, replacement = first non-starter at T*starters+1); VONA (Value Over Next Available, e.g. Draft Buddy/Fantasy Football Calculator: best at position now minus best expected at your next pick); VOLS (value over last starter, baseline = T*starters-th player); Man-games baseline (Lammey/Dodds 100/120-pick baseline) as alternative
- **Examples / fixtures / test data:** none found
- **Tests:** `web/hooks/useVORPCalculations.test.tsx`; `web/lib/draftDashboard/forwardGrouping.test.ts`; `web/lib/draftDashboard/positionalTiers.test.ts`

### DRF-040 computeProratedFantasyPoints / getProratedStat: 84-game skater pace

- **Intent / contract:** web/lib/projectionsConfig/proration.ts:1-4 'Helpers for full-season pacing (proration) of skater counting stats.'; :61 'Return (raw / GP) * season games for eligible skater counting stats.'
- **External references:** Full-season pace normalization (rate x games); compare with games-played risk adjustment conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/draftDashboard/fantasyPointRecalculation.test.ts`; `web/lib/draftDashboard/positionalTiers.test.ts`

### DRF-041 calculateCategoryScores: weighted category z-score composite with goalie rate shrinkage

- **Intent / contract:** **UNDOCUMENTED** — UNDOCUMENTED in code; tasks/draft-dashboard-youtube-outline.md:108-112 says 'The current VORP value calculation uses a weighted standardized score'
- **External references:** Standard z-score category valuation (e.g. Razzball/FanGraphs z-score method); SGP (standings gain points) as alternative; Tango-style regression to mean for rate stats
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/scoring/categoryScores.test.ts`

### DRF-042 Mock draft roster feasibility (Dinic max-flow)

- **Intent / contract:** feasibility.ts:4 comment: capacity matching groups interchangeable players and slots to keep 40-team drafts bounded; engine.ts:120 comment: all held players must remain assigned
- **External references:** Bipartite matching / max-flow (Dinic)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/mockDraft/engine.test.ts`

## Stats helpers (HLP)

### HLP-001 Generic projection math primitives (decayBlend, ewsd, slope, shrinkage, poissonMeanFromRate, selectCountDistribution, clip, goalieFinishMult)

- **Intent / contract:** header comment web/lib/math/utils.ts:1 and JSDoc per function
- **External references:** Tango regression to the mean (k = sample at r=0.5); Poisson/negative-binomial count models
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/math/utils.test.ts`

### HLP-002 Team power EWMA and z-score helpers (pointer)

- **Intent / contract:** see lib/power-ratings.ts (not fully read in this slice)
- **External references:** EWMA team form; z-score standardization
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/power-ratings.test.ts`

### HLP-003 Social share shared definitions (per-60, pooled SV%/GAA, BSH, competition ranks, recent-vs-season windows)

- **Intent / contract:** web/lib/socialShare/modules/shared/definitions.ts:4 ('Shared definitions (CONTRACT.md §2). The one producer of each; posts import these and never restate them')
- **External references:** NST per-60 convention; pooled (ratio of sums) SV% and GAA = GA*60/TOI minutes
- **Examples / fixtures / test data:** `web/lib/socialShare/modules/shared/definitions.test.ts`
- **Tests:** `web/lib/socialShare/modules/shared/definitions.test.ts`

### HLP-004 Percent-unit conversion & exposure-correct share aggregation (NST/WGO team rows)

- **Intent / contract:** header and JSDoc web/lib/stats/percentUnits.ts:1-4, 101-106, 144-147
- **External references:** NST team share definitions; NHL PP%/PK% (PK% here excludes SH-goal adjustment)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/stats/percentUnits.test.ts`; `web/lib/stats/teamCountConsumers.test.tsx`

### HLP-005 Mid-rank percentile helpers (calculateRankingResult / buildPercentileLookup)

- **Intent / contract:** JSDoc web/utils/calculatePercentiles.ts:59-63 and :89-97
- **External references:** Mid-rank percentile rank (Hazen-style (i-0.5)/N family)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/utils/calculatePercentiles.test.ts`; `web/utils/calculateWigoRatings.test.ts`

### HLP-006 WiGO player ratings (regressed percentile composite by strength)

- **Intent / contract:** comments web/utils/calculateWigoRatings.ts:23 (formula M' = (GP*M + (P-GP)*mM)/P) and WIGO_RATING_MIN_COHORT_PEERS comment
- **External references:** Tango regression to the mean (applied to rates, not percentiles)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/utils/calculateWigoRatings.test.ts`

### HLP-007 Projections page global projected/actual ranks

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### HLP-008 Draft-round fantasy point tier thresholds

- **Intent / contract:** inline comments web/utils/tierUtils.ts:40-122
- **External references:** Draft-round replacement level (VORP-style)
- **Examples / fixtures / test data:** none found
- **Tests:** none found

## Misc / other (MISC)

### MISC-001 fn safe_z

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** standard z-score
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-002 view gameOutcomes

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-003 Game Grid opportunity trend label (first vs last week)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/GameGrid/OpportunitySparkline.test.tsx`

### MISC-004 Player bio unit conversions (age, height, weight)

- **Intent / contract:** playerBiography.ts:12 comment on age at midnight UTC
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-005 Social share card tone encodings (changeTone, workload alpha, goalie spark scale)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-006 Social share Week Score five-tier colour band (tierOf)

- **Intent / contract:** SocialShare.tsx:123 comment: five Week Score tiers by rank among ranked teams, best (green) to worst (red); equal scores share a tier
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/components/SocialShare/SocialShare.test.tsx`
- **Tests:** none found

### MISC-007 Social share recent-form line: L5 SV% and TOI delta vs season

- **Intent / contract:** SocialShare.tsx:333 comment: Relative TOI (ticket 15): L5 ice time against season average
- **External references:** NHL SV% convention
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-008 Social share gold-glow availability strength (goldGlow)

- **Intent / contract:** SocialShare.tsx:415 comment TT-16 (TJ): 0 at 50% rostered or more, 1 at 25% or less
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/SocialShare/SocialShare.test.tsx`

### MISC-009 Social share pickup ownership band chip (bandChip)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/socialShare/players.test.ts`
- **Tests:** none found

### MISC-010 Team Games Played (completed team games per team, competition ranked, coverage)

- **Intent / contract:** web/lib/socialShare/modules/teamGames.ts:40-43 comment
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/socialShare/modules/teamGames.test.ts`

### MISC-011 Yahoo-NHL fuzzy name match confidence

- **Intent / contract:** module docstring player_name_matcher.py:1 ('Deterministic name normalization and thresholded fuzzy player matching')
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/supabase/Upserts/Yahoo/player_name_normalization_spec.json`; `web/lib/supabase/Upserts/Yahoo/name_mapping_todo.json`
- **Tests:** `web/lib/supabase/Upserts/Yahoo/test_player_name_matcher.py`; `web/lib/supabase/Upserts/Yahoo/test_yahoo_identity_promotion.py`

### MISC-012 CSV player-name fuzzy match (Levenshtein similarity)

- **Intent / contract:** Comment upsert-csv.ts:37 'Simple normalized similarity ratio using Levenshtein distance'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-013 Goals correlation analysis

- **Intent / contract:** module docstring web/scripts/goals_correlation_analysis.py:2-13
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-014 Top scorers relationship analysis (points percentile, point-biserial, Cohen's d)

- **Intent / contract:** module docstring web/scripts/top_scorers_relationship_analysis.py:2-23
- **External references:** Cohen's d; point-biserial correlation
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-015 Dashboard source-date alignment gap (recency state)

- **Intent / contract:** dataFetchers.ts:383 warning text: source dates are not safely aligned; projection and start context is downgraded until the feeds converge
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-016 Date Range Matrix TOI shares and goalie ratios

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/DateRangeMatrix/fetchAggregatedData.test.ts`; `web/components/DateRangeMatrix/useTOIData.test.ts`; `web/__tests__/pages/drm.test.tsx`

### MISC-017 FORGE command center: momentum/trust and power-score deltas

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-018 Metrics timeline point % and delta

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** NHL points percentage
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/MetricsTimeline/metricsTimelineData.test.ts`

### MISC-019 Player pickup table percentile composite

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Percentile rank (mid-rank ties)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`; `web/e2e/player-pickup.spec.ts`

### MISC-020 Player stats page aggregation, percentiles, per-game index, performance heat levels

- **Intent / contract:** web/components/PlayerStats/playerStatsContract.ts:229-236 'Ratios rebuilt from summed components rather than averaged per game... Missing values are skipped, never counted as zero'
- **External references:** NST per-60 TOI-weighting convention
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/PlayerStats/playerStatsContract.test.ts`; `web/components/PlayerStats/PlayerRadarChart.test.tsx`; `web/components/PlayerStats/PlayerStatsChart.test.tsx`; `web/components/PlayerStats/PlayerContextualStats.test.tsx`; `web/__tests__/pages/stats/player/playerId.test.ts`

### MISC-021 Poisson score distribution chart (game page)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Poisson / bivariate Poisson goal models (Maher 1982, Dixon-Coles)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/game.test.tsx`

### MISC-022 Team schedule calendar game rating and standings tiers

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx`

### MISC-023 Skater variance: production proxy and game volatility

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/Variance/skaterVariance.test.ts`

### MISC-024 NST rate-limit plan assessment

- **Intent / contract:** web/lib/cron/nstRateLimitPolicy.ts:26-28 'All four unique-URL windows apply across participating jobs. Only a complete job below40 URLs may burst.'
- **External references:** AGENTS.md / memory NST limits: 40/1m, 80/5m, 100/15m, 180/h
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/cron/nstRateLimitPolicy.test.ts`

### MISC-025 X poller health thresholds (coverage, read success, fail streak)

- **Intent / contract:** web/lib/cron/xPollerHealth.ts:21 'The cutover bar from the IFTTT-TO-FXTWITTER-CUTOVER debrief: coverage of at least 98%.'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/cron/xPollerHealth.test.ts`; `web/lib/cron/reportMetrics.test.ts`; `web/__tests__/pages/api/v1/db/cron-report.test.ts`

### MISC-026 Homepage game analytics: shots on goal sum and xG attach

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/homepageGameAnalytics.test.ts`

### MISC-027 Homepage pulse: model-vs-market edge series

- **Intent / contract:** web/lib/homepagePulse.ts:196-199 'Historical rows predate market-snapshot persistence. Their changing distance from 50% keeps the offseason pulse real until market capture resumes'
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/homepagePulse.test.ts`; `web/components/HomePage/HomepagePulse.test.tsx`

### MISC-028 Percentile rank hook (season average stats)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/hooks/usePercentileRank.test.tsx`; `web/components/CategoryCoverageChart/CategoryCoverageChart.test.tsx`

### MISC-029 Weekly/matchup-week fantasy points from game logs

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-030 Tweet identity candidates (bounded edit distance) and news phrase / mention scoring

- **Intent / contract:** web/lib/sources/tweetLunaEvaluationScoring.ts:5-8 'Compare with predeclared labels, never derive truth from validator acceptance.'
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/sources/fixtures/tweetLunaEvaluation.ts`; `web/lib/sources/fixtures/tweetLunaAdjudicatedLibrary.json`; `web/lib/sources/fixtures/tweetIdentitySavedEvidence.json`
- **Tests:** `web/lib/sources/tweetIdentityCandidates.test.ts`; `web/lib/sources/tweetNewsAutomation.test.ts`; `web/lib/sources/tweetNewsInference.test.ts`; `web/lib/sources/tweetLunaReview.test.ts`

### MISC-031 Tweet swipe trainer confidence score (0-100) and name-match confidence

- **Intent / contract:** web/lib/sources/tweetSwipeTrainer.ts:543-547 'Card confidence (0-100), after the audit's proposal: start at 100, subtract named penalties, then apply caps.' (tasks/artifacts/tweet-parsing-audit-2026-11-06.md section 5)
- **External references:** none suggested
- **Examples / fixtures / test data:** `web/lib/sources/fixtures/tweetClassificationLabels.json`; `web/lib/sources/fixtures/october11TroublesomeTweets.json`
- **Tests:** `web/lib/sources/tweetSwipeTrainer.test.ts`; `web/components/TweetSwipeTrainer/TweetSwipeTrainer.test.tsx`

### MISC-032 NST career / 3-year averages (counts and rates) with multi-team TOT rows

- **Intent / contract:** web/lib/api/averages/statsService.ts:14-16 'Gets three-year or career aggregated counting data and averages.'
- **External references:** NST per-60 convention: rate = count / TOI_minutes * 60; multi-season rates should be TOI-weighted
- **Examples / fixtures / test data:** none found
- **Tests:** `web/__tests__/pages/api/Averages/helpers.test.ts`; `web/lib/nst/callerLifecycle.test.ts`

### MISC-033 Odds implied probability (ingestion and Game Preview)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** Standard American-odds conversion; proportional (multiplicative) de-vig; Shin / power methods as alternatives
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/sources/oddsSourceIngestion.test.ts`; `web/__tests__/pages/api/v1/db/update-market-prices.test.ts`; `web/components/GamePreview/GamePreview.test.tsx`

### MISC-034 Goalie weekly league averages (pages/goalies.js)

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-035 Trends pages: percentile smoothing and hot/cold team selection

- **Intent / contract:** **UNDOCUMENTED**
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** none found

### MISC-036 Opponent DEF percentile, easiest schedules, streaming nights (perfect storm tilts)

- **Intent / contract:** web/lib/socialShare/matchups.ts:48 'Single-opponent Game Grid DEF: 100 - percentile of that team's xGA/GP. Higher = stronger defense.'
- **External references:** Schedule strength via opponent xGA/60 (Evolving-Hockey/MoneyPuck team xG rates)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/socialShare/matchups.test.ts`; `web/lib/socialShare/targets.test.ts`; `web/e2e/social-share.spec.ts`

### MISC-037 BSH board, Nightly Floor, Role Watch, What Changed, Last Night's Standouts: window vs baseline deltas

- **Intent / contract:** web/lib/socialShare/modules/lastNightsStandouts.ts:80-86 (average rule); bshBoard.ts:82 'Half the most games anyone played there, rounded up, and never above the season default of 5.'
- **External references:** NST per-60 conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/socialShare/modules/bshBoard.test.ts`; `web/lib/socialShare/modules/nightlyFloor.test.ts`; `web/lib/socialShare/modules/roleWatch.test.ts`; `web/lib/socialShare/modules/whatChanged.test.ts`; `web/lib/socialShare/modules/lastNightsStandouts.test.ts`

### MISC-038 Multi-cat percentile composite (Multi Cat Monsters / Points-First) and Multi-Cat Stars raw sum

- **Intent / contract:** web/lib/socialShare/modules/categoryBlueprint.ts:18 'TJ's decision: this card alone ranks on a combined score'; :49-52
- **External references:** Percentile-rank composites
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/socialShare/modules/categoryBlueprint.test.ts`; `web/lib/socialShare/modules/multiCatStars.test.ts`; `web/e2e/social-share-multi-cat-stars.spec.ts`

### MISC-039 Goalie share cards: GSAx, Crease Shift, Busy/Quiet, Rescue, Ratio Impact, Category Counts, Goalie Period ADP, Risky Starts

- **Intent / contract:** web/lib/socialShare/modules/ratioImpact.ts:5-7 'Rates always come from summed saves/SA and GA/TOI seconds, never a mean of percentages.'; categoryCounts.ts:4-6; goalieGsax.ts:12-15
- **External references:** GSAx (MoneyPuck / Evolving-Hockey; NST xG model as source)
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/socialShare/modules/goalieGsax.test.ts`; `web/lib/socialShare/modules/creaseShift.test.ts`; `web/lib/socialShare/modules/busyQuiet.test.ts`; `web/lib/socialShare/modules/goalieRescue.test.ts`; `web/lib/socialShare/modules/ratioImpact.test.ts`; `web/lib/socialShare/modules/goaliePeriod.test.ts`; `web/lib/socialShare/modules/riskyStarts.test.ts`

### MISC-040 Week Score callers: Off-Night Edge, schedule tiers, Monday grid, Team Stream

- **Intent / contract:** web/lib/socialShare/tiers.ts:6-12 'Schedule-aware streaming tiers (TJ, ticket 13)...'; offNightEdge.ts:312 sample text defines HOT
- **External references:** Off-night streaming conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/socialShare/modules/offNightEdge.test.ts`; `web/lib/socialShare/tiers.test.ts`; `web/lib/socialShare/mondayGrid.test.ts`; `web/lib/socialShare/modules/teamStream.test.ts`

### MISC-041 Social share L5 player score: L5 fantasy points per game x opportunity multiplier

- **Intent / contract:** web/lib/socialShare/score.ts:4-8 'L5 ranking for every player card (TJ, ticket 15): fantasy points per game over the last five games... times an opportunity multiplier...'
- **External references:** Fantasy points per game; deployment-adjusted streaming ranks
- **Examples / fixtures / test data:** `web/lib/socialShare/pickupsFixture.ts`; `web/lib/socialShare/fixtures.ts`
- **Tests:** `web/lib/socialShare/score.test.ts`; `web/e2e/social-share.spec.ts`

### MISC-042 Hot/cold streak rules

- **Intent / contract:** web/lib/socialShare/streak.ts:3-14 (full rule text, TJ ticket 18)
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/lib/socialShare/streak.test.ts`

### MISC-043 Ownership / ADP trend movement (risers/fallers)

- **Intent / contract:** web/components/TransactionTrends/TransactionTrends.tsx:517-518 ('Δ = relative change in Yahoo! average draft pick...'; 'Δ = change in Yahoo! percent ownership (percentage points)')
- **External references:** none suggested
- **Examples / fixtures / test data:** none found
- **Tests:** `web/components/TransactionTrends/TransactionTrends.test.tsx`; `web/components/forge-dashboard/TopAddsRail.test.tsx`

### MISC-044 WiGO util fallbacks: derived per-60, PP per-60, PTS1%, percentile staleness, rolling average

- **Intent / contract:** web/utils/fetchWigoPlayerStats.ts:507-508 'A pointless game has no share... so it is a gap rather than 0'
- **External references:** NST per-60 conventions
- **Examples / fixtures / test data:** none found
- **Tests:** `web/utils/fetchWigoPlayerStats.test.ts`; `web/utils/fetchWigoPercentiles.test.ts`; `web/utils/formattingUtils.test.ts`

