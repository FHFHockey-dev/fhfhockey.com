# Independent peer review: W1-8 player forecasts and season models

Reviewed 2026-11-11 on Tim's Mac, canonical checkout `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`. Audit commit verified: `87785fdbc95488c7f58fe14053cace33b1ffd432`. The reviewed implementation paths had no diff from that commit when checked.

This is an **addendum**, not a replacement for [Fable's audit](../audits/player-forecasts-season-part1.md). Read with [OWNER-DECISIONS](../OWNER-DECISIONS.md), [Batch A consolidation](../BATCH-A-CONSOLIDATED.md), the W1-8 prompt, packet and TRIAGE brief. No application code was changed. No database queries, production/application requests, provider calls, deployments, pushes or dependency installs were performed. Existing unrelated work was preserved.

## Assessment

**Keep the native-small-sample warning, C17, the challenger train/serve mismatch, and the ledger conditioning concern. Correct the gate, contract, copula and goalie-basis claims before turning the audit into an implementation plan.**

Most important changes:

1. The v4/v5 contracts **already explicitly treat the 2025–26 lockbox as consumed training/validation evidence**. This is not a newly discovered violation of their own contracts. Independent prospective coverage remains missing.
2. Release gates **can fail**. What is circular is selected-model noninferiority and expected calibration on reused data, not every gate. The displayed deterministic intervals also do not implement the randomized-boundary coverage being reported.
3. The Gaussian factor loading is 0.65, making pairwise primitive correlation **0.4225**, not 0.65. Reconciliation makes derived quantiles depend on that choice. An offline execution confirms this.
4. Per-appearance goalie means including relief, multiplied by appearance probability, are **not inherently double-discounted**. Changing to start probability requires a different conditional mean and an explicit relief component.
5. The season model independently repeats Batch A's **maximum-TOI goalie-label problem**. Official starts and W/L/OTL/SO credits must be fixed in this consumer too before activation.
6. A private fixed 300-minute research policy differing from a selected 60/180/360 policy is a **version/evidence mismatch to resolve**, not established proof that a trained artifact is served incorrectly.

No new **currently served** P0 is established by this review. That is not a certificate that the live scoreboard has no defects: its count/FP comparisons are conditional on dressing while some predictions are unconditional. Most other findings are dormant activation blockers or research limitations. Do not convert Fable's 20/33/5/2 totals into independently verified totals; several entries require qualification and the untouched-data coverage done-criterion remains open.

## Evidence and serving status

- **Independently inspected:** current local source, versioned contracts, Fable report and Batch A consolidation. Coverage by entry appears below.
- **Executed offline:** isolated actual Python functions extracted using `ast`, with only standard-library globals and synthetic inputs; no importing of application modules. Results and reproduction details are below.
- **Reported, not re-read:** Fable's 2026-11-11 zero-row season/native tables, 10,956-row ledger, 2,215 skater-games, 146 goalie starts, 482-start QS sample and associated metrics. The audit does not retain its SQL or extracts, so exact magnitudes are not independently reproducible here. No new production read should be commissioned merely to reconfirm these figures.
- **Native serving:** `web/lib/player-forecasts/forecastServingSource.ts:59-78` cannot select `native` without a valid catalog selection. Given Fable's empty-head snapshot, that branch was unavailable then. Without the activation environment, the alternatives are `legacy`, `legacy_flagged` or `empty`, not necessarily legacy (`:21-25`). Empty tables do not prove a path has never run locally or cannot activate later.
- **Season/advanced:** treat as dormant on the reported database snapshot, not “never imported” as a historical fact. A zero row count cannot establish that history.
- **Ledger / expectation view:** live-capable paths in the source; Fable reports bridge rows in production. No request was made to establish the current deployed branch. The expectation view's arithmetic can be sound while an upstream bridge forecast is not.
- **Research, draft and flagged-off modules:** no new activation is inferred from their presence in source. Their fixed experimental choices are not automatically specification defects if clearly disclosed.

## Corrections and additions

### PR-P1 · Gates: retain the evaluation concern, remove “cannot fail” and stale lockbox framing

**M-PFC-008/032/038; correct D3 and owner question 4. P1 before claims of validated public uncertainty.**

`season.py:2192-2209,2355-2369,2391-2498` reuses validation folds for hyperparameter/family selection and interval calibration. `advanced.py:885-977` likewise selects a challenger or population fallback, then calculates residual coverage on those validation rows. These are not independent estimates of the selected system's generalization. MAE also elicits a conditional median, not a conditional mean, so squared error or a suitable proper count-distribution score is preferable when the advertised target is a mean.

But:

- `advanced.py:451-463` blocks v4 for missing support, loss regression, interval-calibration failure and rookie-validation failure. Checksums/contracts are checked earlier.
- `advanced.py:900,975` requires at least 100 validation rows and 20 entities for v5 serving eligibility. `:1507-1526` checks both expected **and observed** randomized coverage and source coverage. Those checks can fail. Source coverage passed as 1.0 at `:1352,1361,1371` still needs a real denominator, but does not erase the other gates.
- v4's selected-model loss noninferiority is mostly a consequence of selecting the minimum including the baseline; that is useful baseline fallback behavior, not independent performance evidence.
- `docs/player-projections/research-contract-v4-season-fantasy.json:159-163` explicitly says the lockbox is validation/training evidence and prospective 2026–27 coverage is required. v5 says the same at `research-contract-v5-season-advanced.json:129-140`. `advanced.py:473,1424,1561` also discloses this. The older general research lockbox rules do not establish that these version-specific consumed-lockbox contracts are being violated.

**Additional confirmed gap:** randomized residual-boundary coverage is not the same event as membership in the emitted closed interval. `_fit_rate_policy` hashes boundary cases for its observed coverage (`advanced.py:923-941`), but `:1997-2017` emits ordinary deterministic p10/p90 endpoints. The v4 contract explicitly distinguishes expected randomized coverage and ordinary discrete overcoverage; the report/UI must retain that distinction instead of implying the emitted interval empirically covered 80%.

**Executed actual-function fixture:** 20 entities, one zero-valued development observation each and five zero-valued validation observations each. `_fit_rate_policy` returned 100 rows, 20 entities, `residual80PerGame=0`, expected randomized coverage **0.8**, observed randomized coverage **0.77**, inclusive coverage **1.0**, and `eligibleForServing=true`. For an always-zero target the emitted [0,0] interval covers 100%. Conservative coverage on a discrete target is not itself a defect; calling its displayed interval's measured coverage 80% is.

**Remedy/test:** keep support/fallback checks, report fit/selection/calibration/prospective evidence separately, score the **actual emitted interval** on untouched dates, and test all-zero/tied residuals, insufficient support, deliberate interval narrowing and a checksum-valid but miscalibrated bundle. “Halve an artifact's intervals” must also recompute/check the corresponding forecast coverage; a gate that reads only stored metrics cannot discover arbitrary endpoint edits by magic. Do not describe 2025–26 as a fresh blind test or silently reuse it as one.

### PR-P2 · Copula: correct correlation and the claim that marginal bands are unaffected

**M-PFC-006; correction with executed counterfactual. Dormant P2 modeling issue.**

At `advanced.py:1886-1893`, the latent draw is `0.65*Zcommon + sqrt(1-0.65²)*Zi`. Its variance is 1 and pairwise correlation is **0.65² = 0.4225**. A common-factor normal construction is internally valid; the real concern is that its loading is not fitted or validated and all categories share it.

Unconstrained primitive distributions remain marginally normal before truncation. However `:1895-1908` caps games, caps goalie GA by SA, and calls `_advanced_reconcile` on **every draw**. That recomputes sums, differences and ratios (`:1793-1827`; `season.py:3935-4087`). Derived marginal intervals, such as points, saves, SV% and on-ice shares, therefore **depend on the covariance**. They are not unaffected.

**Executed fixture:** GOALS, PRIMARY_ASSISTS and SECONDARY_ASSISTS each have mean 100 and variance 1; 10,000 draws, seed `W1-Astra-offline`. The actual simulator gave POINTS p10/p90 **296.9959604142 / 303.0215393169**, width **6.0255789027**. An explicitly in-memory counterfactual changing only the loading to zero gave **297.7671246886 / 302.2248647674**, width **4.4577400788**. No source file was edited. These are synthetic diagnostic numbers, not hockey forecasts.

Fable's “±0.11 SD” for 256-draw noise is roughly the **one-standard-error** normal p10/p90 sampling scale, not a universal bound or 95% interval. Clamping/reconciliation changes it. Keep the schedule-based cap finding, but test primitive and derived distributions separately, document the loading and increase/check simulation precision before promising calibrated endpoints.

### PR-P3 · Native goalie conditionality is coherent; statistical improvement is separate

**M-PFC-041/042/043; qualify D2 and replace its proposed test.**

`goalieBaselineRates.ts:184-221,224-256,259-308` explicitly defines W, SO and volume **per positive-minute appearance including relief**, with the same coherent volume population and SA=SV+GA. This is not a start-conditioned rate. Multiplying by the probability of that same appearance event is the correct law of total expectation.

**Algebraic fixture:** 10 eligible games, 5 appearances including relief, 2 wins. `(2/5) × (5/10) = 0.2 = 2/10`; there is no double discount. A future change in the mix of starts/relief can hurt prediction, but that is a role-model issue, not an arithmetic proof from relief in the denominator.

No regression and no prior-season fallback are source-confirmed. A shots-based SV% prior and team/opponent volume model are reasonable candidates. Fable's 146-start experiment conditions on **actual future shots** and compares a `naive_season` proxy rather than issued native predictions. It is an informative save-rate diagnostic, not an end-to-end forecast backtest. Regression slope 0.043 is not “4% signal” or an explained-variance percentage without further assumptions.

**Remedy/test:** estimate an appearance mixture or explicitly model `P(start)*E[Y|start] + P(relief)*E[Y|relief]`. Do not replace appearance probability with start probability while retaining appearance-conditioned means. W/SO credits remain official outcomes, not team wins or GA=0 inferred credits. Verify stronger shrinkage for fewer shots, posterior containment between prior and sample, and convergence as exposure grows. The proposed fixed “both within ±.010” test cannot be justified without shot counts, prior strength and league baseline. Likewise 7/7 participation <1 is a property of a chosen smoothing model, not proof the raw frequency is arithmetically wrong.

### PR-P4 · Native skater concern stands; define the blend and evidence correctly

**M-PFC-013/014; D1/C16 confirmed, statistical magnitudes reported only.**

`baselineRates.ts:243-255` takes a 0.9-decay mean over up to 20 current appearances. `nativeDailyMeansCapture.ts:467-473` makes the current/prior choice. The prior path permits up to 82 (`baselineRates.ts:204-228`) but this producer caps acquisition at 20 (`nativeDailyMeansCapture.ts:30-33`). Thus it is at most 20 captured prior appearances in this path, not a guaranteed full-season prior.

Fable correctly distinguishes weight sum 8.7842 from Kish effective sample size **14.8808763935** for a complete 20-game window; independently recomputed. A raw current mean is a deliberately disclosed unvalidated baseline, but it is weak evidence for general predictive serving. Native actual performance was not measured. Exponential weighting need not be worse than equal weighting when true role/rate is changing, so “slightly noisier” is a stationary-noise argument, not an observed universal ranking.

The proposed `(Σw*x + k*prior)/(Σw+k)` makes `k` measured in weight units; do not transplant a fitted equal-weight pseudo-game k unchanged. The first observation generally **does** move the estimate; the test should bound a rational update rather than demand literally no discontinuity from zero to one games. Fit/stat-test a new version, preserve provenance, compare against both raw and bridge on identical eligible issued rows, and keep unavailable outcomes unavailable.

### PR-P5 · C17 is real, but the 28% and remedy require conditions

**M-PFC-007/010/056/058; D4/D5 confirmed as model limitations, with qualifications.**

`advanced.py:1997-2001` uses the absolute-residual 80th percentile as an SD before multiplying by z=.1/.9 again. For playing probability 1, a nonbinding lower clamp and residual-dominated variance, normal errors give half-width `1.28155²*σ` and coverage **0.8994875662**. This is the stated ~90% case, not a measured population coverage and not a universal 28% error when mixture variance, Poisson floor or truncation matters.

An absolute-residual threshold produces a central symmetric prediction **set**; it does not guarantee genuine equal-tailed p10/p90 for asymmetric count errors. When participation probability is below one, replacing the final band by conditional mean ± residual is insufficient. Carry the DNP atom and the conditional distribution, then derive unconditional quantiles. If a normal SD conversion is retained, its distributional assumption must be explicit.

`season.py:4440-4444` and `restOfSeason.ts:47-53` omit intergame covariance. Fable's 30-goal ±7/±11/57% example is a hypothetical sensitivity analysis with assumed talent/availability uncertainty. The exact correction is `Var(sum Y)=sum Var(Y)+2*sum Cov(Yi,Yj)`. Avoid simply adding all parameter uncertainty again if marginal variance already includes part of it; identify within-game versus shared uncertainty first. Season coverage may be too narrow with positively correlated talent/availability, but its direction and size are not established from code alone.

`season.py:4226-4240` combines opposite marginal endpoints for ratios. Those are not ratio quantiles. They are often conservative, but “too wide” is not guaranteed: when the denominator's low endpoint is zero the code falls back to the center, which can understate an upper tail. Test zero denominators, highly correlated numerator/denominator, sparse counts and actual joint-distribution quantiles. p50=mean is a normal-approximation convention, not a genuine discrete median guarantee.

### PR-P6 · Ledger: distinguish count/FP scoring, binary scoring, and source-specific bases

**M-PFC-030/031; D6 is materially correct for skater count/FP comparisons. Live-capable P1/P2 evaluation issue.**

`servedForecastLedger.ts:146-147` sets skater naive participation to 1. The count and fantasy-point scorer filters to `dressed===true` (`:414-424`), as do paired count/FP comparisons (`:486-505`). Evaluating an unconditional mean on the dressed-only subset causes the stated conditioning mismatch. Paired arithmetic is mechanically correct but does not cure mismatched estimands; M-PFC-031 is not an unqualified end-to-end methodological pass.

Two corrections:

- Goalies' naive controls **do not assume 100% participation**. They multiply per-start means by an empirical start share (`:151-159`).
- Binary W/SO/start scores use settled known-event rows, not only dressed rows (`:417-418,494-500`). Preserve that valid distinction when fixing count/FP scoring. Market comparisons have their own documented conditional event basis.

`naive_last5` using 10 goalie starts and 10 team games is source-confirmed C18. The rest-day convention difference is also a real naming/adapter issue, not proof that the existing B2B filter is wrong in its own convention.

**Remedy/test:** compare every source under the same estimand and cohort; comparing unconditional models only with other unconditional models and conditional models only with conditional models is valid, but then do not publish cross-basis skill as if comparable. To keep a shared leaderboard, store conditional means/probabilities or build unconditional controls, and use a complete independently settled candidate universe with confirmed DNP=0. Unknown/missing feed must not be turned into DNP. A correct probability produces zero **expected** bias, not zero sample bias in every finite realization. Test a deterministic full fixture with nine appearances in ten opportunities, known nonappearance, unknown settlement, and a relief goalie.

### PR-P7 · The 300-minute private baseline is not proved to be a mis-served trained policy

**M-PFC-020/023/024; qualify D10 and the “Wrong” verdict on 024.**

`daily_board_training.py:41-51,70-76` selects 60/180/360 and writes `starter-board-baseline-policy-v1`. `daily_board_baseline_issuance.py:20-25,85-86` deliberately declares and issues a different fixed `starter-board-prospective-baselines-v1`, 300 minutes, with `servingActivation=false` and `promotionEligible=false`. The issuer does not load the selected artifact. The numerical difference is real, but these are **two explicit policy identities**, not established training/serving parity failure within one policy.

Do not transfer the tuned policy's evaluation claims to the fixed issuer. If the intended contract is that the selected artifact must be issued, change the issuer to consume and verify it; otherwise evaluate and report the fixed baseline separately. Merely adding 300 to the selection grid does **not** ensure 300 wins and therefore is not a complete fix for a selected-policy contract.

TOI exposure for goalie shot/GA rates is dimensionally legitimate. It may be a weak role/opponent model, but “like skaters” alone is not a mathematical defect. Likewise a shared 180-minute strength prior (`daily_board_strength.py:25-32`) means PP/PK rates get stronger shrinkage because they have less exposure; that is not inherently inconsistent. Choosing different pseudo-minutes needs held-out evidence or an explicit domain prior, not different exposure alone.

### PR-P8 · Separate season goalie-label consumer must be included in the fix plan

**Additional source-confirmed defect affecting season training, D9 and M-PFC-025/048/055; dormant P1 before activation.**

`season.py:532-536` sets `goalie_order` using descending TOI per team-game. `:548-555` then treats the longest-playing goalie as the starter and uses the **team result** to allocate W/L/OTL; SO is inferred from zero GA and ≥59 minutes. None of these is an official credited-outcome label.

A starter removed after 10 minutes and a reliever playing 50 will be mislabeled as reliever/start respectively. Official goalie decisions also need not belong to the longest-playing goalie. A shared shutout or late pull cannot be settled safely by this shortcut. Unknown team identity can additionally collapse partition membership, so do not repair only the sort expression.

**Remedy:** reuse verified official starter/decision/SO evidence, preserve unknown when incomplete, and keep appearance workload distinct. Include this source in Batch A's “fix every reader” inventory even though the native labeler `nativeGoalieOutcomes.ts` is sound on this question. Add pulled-starter, relief-win, shared-shutout, empty-net pull and missing-team fixtures.

Fable's QS direction correction is justified **for its reported .8926 league sample**, not universally. Its sample omitted the 59-minute gate and used WGO starts, while the actual producer uses max-TOI starts. Reconcile that cohort before calling 203 the deployed/model count. The 30/33=.909 QS example also requires a league benchmark below .909. Apply Vollman's chosen benchmark and credited-start rule together, with a declared season/strength sample and an as-of policy when used predictively.

### PR-P9 · Other methodological verdicts need narrower language

- **M-PFC-047:** venue scorer bias is not home-ice advantage. `season.py:4103-4117,4363` applies the host arena's recorded-event multiplier to both teams while separately applying home/away coefficients. Both teams using the arena is reasonable. Own defense may already be partly embedded in a goalie's historical rate; additional team adjustment needs a clear baseline to avoid double counting. Missing strength-specific opponent PK remains a model limitation to validate, not an algebra error.
- **M-PFC-053:** geometric means have half elasticities; that is a chosen context blend, not intrinsically a bug. Summing chance suppression translated to goal units and actual-goal suppression correlates/double-weights signals, but it is not universally “about double.” The consumer converts the signal to percentiles (`season.py:3500-3530`), so a uniform factor of two would leave ranks unchanged. Keep all-strength confounding and unvalidated weighting as concerns; do not claim measured 2× downstream ratings.
- **M-PFC-059:** the objective is mean logistic loss plus a fixed ridge penalty. Its local shrink depends on the Hessian `mean[p(1-p)xx']`, feature correlations and baseline probabilities. Source proves λ=.2, not “three times data curvature” or universal 70% shrink. Undrafted/missing draft conflating with pick 128 is source-confirmed; tune/ablate rather than mandate a penalty reduction from that unsupported percentage.
- **M-PFC-060:** translation factors among players who move leagues are standard conditional NHLe-style estimands; excluding non-movers from a **conditional NHL rate** is not automatically bias. The current captured pool may still be selected, and `P(made NHL)` especially requires a representative eligible prospect denominator. Audit capture-frame selection separately from conditional performance, with cohort/age/role controls. No quantitative bias is established here.
- **M-PFC-021:** convexity plus 1,000 fixed gradient steps is not proof of convergence for every feature dimension/data condition. Keep the logistic arithmetic, but request objective/gradient diagnostics before a blanket “adequate” verdict.
- **M-PFC-034/036:** the resampler averages within slate then bootstraps slate means. That targets an equal-slate average, whereas some accompanying MAE/lift fields weight player-games. State the estimand, or resample clusters and recompute the desired player-game-weighted statistic. Clustering alone does not make these two estimates equivalent (`daily_board.py:102-114`; `model.py:107-135`).

### PR-P10 · Known zero, unknown and denominator-zero must remain distinct

**M-PFC-003/004/055/058; source-supported activation safeguards.**

The advanced builder creates player-game observations from contributing on-ice/shot/rebound/xG rows (`advanced.py:1030-1073,1095-1114,1135-1175,1235-1282`), not from a separately proven complete appearance universe. Thus a missing player-game can disappear entirely; an existing observation can retain initialized zeros for an unobserved source family. The actual frequency is undetermined. Audit coverage against a complete local appearance fixture, not only the rows the builder already produced, and replace the constant source coverage with per-target accounting.

`season.py:3943-3958,4060-4068` emits 0 for undefined ratios when the denominator is zero. Executing `_reconcile({}, 'goalie')` produced SAVE_PERCENTAGE=0, GAA=0 and WIN_PERCENTAGE=0. This establishes helper behavior, not that an incomplete record passed the full bundle checks. Add explicit unavailable status/null for undefined ratios where permitted; do not present them as measured zeros. The live expectation adapter already preserves null for zero/incomplete denominators (`gameExpectations.ts:209-218`).

`restOfSeason.ts:43-45` does not reject NaN participation, and `:63` defaults missing season-to-date actuals to zero. A caller that truly means known zero is fine; an unknown running-season actual is not. Validate finite probabilities and explicitly distinguish known-zero actuals from unavailable totals before reusing this dormant writer.

## Entry-by-entry disposition

All IDs below are M-PFC. “Retain” means the cited mechanism survived this source review, not a complete statistical validation. Source paths below omit the repeated `modeling/player_forecasts/` or `web/lib/player-forecasts/` prefix when unambiguous. Dormancy/live status follows the qualified evidence above. No replacement verdict-count total is asserted.

| ID | Peer-review disposition and evidence |
|---|---|
| 001 | Retain context-pooling/sample-awareness concern. SQL `20260805003121_add_player_forecast_runtime_context_rates.sql:59-60,102-119,131-134` uses started-before-cutoff, not completed/known-before-cutoff. Deployed status is Fable's snapshot, not a new check. |
| 002 | Retain defect: player/date ordering feeds team row rolling means (`performance_prediction.py:237,271-272`); season-progress uses observed max date (`:262-264`). Do not claim all player rolling features leak without accounting for their future-target shift. Dead-path status not independently exhaustively searched. |
| 003 | Retain distance-vs-NST taxonomy warning (`advanced.py:1159-1175`); add coverage/zero-population issue PR-P10. Not a complete per-event NST parity audit. |
| 004 | Retain SOG-vs-attempt basis distinction (`advanced.py:1206-1224`) and upstream xG dependencies. On-ice xG query lacks empty-net exclusion at `:104-106`; include owner decision 7 in upstream remediation. Do not relabel GSAx as NST GSAA. |
| 005 | Retain limited sound verdict for descriptive, cutoff-safe EDGE context and zero coefficient (`advanced.py:759-870`), not predictive validation. |
| 006 | Correct loading/correlation and derived-quantile assertions; PR-P2. |
| 007 | Retain C17, conditional size and distribution-aware remedy; PR-P5. |
| 008 | Retain reused-data evaluation concern; actual support gates and consumed-lockbox contract matter; PR-P1. |
| 009 | Retain explicit actual-assist fallback provenance; xA terminology can confuse shot-assist xG (`advanced.py:980-1000,1984-1995`). A statistical expectation of assists is otherwise legitimate language; distinguish product labels. |
| 010 | Retain missing covariance concern (`season.py:4437-4468`), not an empirical coverage failure; PR-P5. |
| 011 | Age-profile survivor/role confounding plausible (`season.py:1711-1809`); magnitude and direction unmeasured. |
| 012 | Hard-coded 2026-10-01 confirmed (`season.py:1848-1864`), appropriate only to the fixed 2026–27 artifact. Selective use by winning family is not intrinsically wrong; “most” targets requires saved selections. |
| 013 | Raw current weighted policy and switch confirmed; PR-P4. |
| 014 | Prior acquisition cap versus policy allowance confirmed; PR-P4. |
| 015 | Legacy fixed-k/external-source finding retained from code-path context, not a fresh exhaustive external-provider policy audit; isolated arithmetic can still be reused by the prior-only path. |
| 016 | Canary is offline/bounded; correct “one hard-coded player”: an immutable default exists, but `CurrentSeasonSogGameScope` and `assembleCurrentSeasonSogBaseline(..., gameScope)` support explicit validated scopes (`currentSeasonSogBaseline.ts:8-20,97-105`). |
| 017 | PPP arithmetic and receipt controls are sound on inspection (`nativePowerPlayPoints.ts:22-130`); no new runtime fixture was executed. |
| 018 | Ridge-on-residual fit/predict mechanism checks out (`daily_board_context.py:140-175`); clipping/reconciliation still requires out-of-sample evaluation. |
| 019 | Temperature scaling on complete normalized goalie mass checks out (`daily_board_models.py:140-157`); training log loss is not held-out calibration evidence. |
| 020 | Downgrade generic TOI-exposure criticism to predictive-model concern; PR-P7. |
| 021 | Logistic implementation plausibly sound; remove unsupported convergence certification; PR-P9. |
| 022 | Count simulation and goalie identities agree on inspection (`daily_board_scenarios.py:145-242`); no-relief/no-empty-net scenarios remain explicit limits, not validated hockey realism. |
| 023 | Shared 180-minute prior is a disclosed fixed experimental choice; not intrinsically mis-specified due to different exposures; PR-P7. |
| 024 | Numerical policy mismatch confirmed, but wrong-policy issuance not established under distinct identities; PR-P7. |
| 025 | Snapshot-based multiplier persists across forecast games (`season.py:2895-2960,3489-3497`); 50–70% applies to fresh unit-weight single signals, not every aged snapshot. Add official goalie source problem PR-P8. |
| 026 | Read role heuristics (`season.py:3543-3660`): rank-based roles and .65/.70 fallbacks are visible. Keep predictive accuracy undetermined; no fitted evidence supplied. |
| 027 | Accounting-alignment helper inspected (`forecast-diagnostics/contract.ts:117-160`); retain narrow invariant verdict, not a team-goal model validation. |
| 028 | Simple own/opponent goals blend inspected (`pairedInputs.ts:81-105`); minimum support/home-ice/shrinkage are validation requirements for promotion, not proof a disclosed empirical diagnostic is mathematically invalid. |
| 029 | Cohort, known-outcome and timestamp filters inspected (`evaluation.ts:34-95`); retain narrow scoring verdict. “No non-test callers” remains Fable's inventory claim. |
| 030 | Confirm count/FP conditioning issue and C18, correct binary/goalie-control scope; PR-P6. |
| 031 | RMSE/Brier skill arithmetic sound, paired count methodology inherits 030; PR-P6. |
| 032 | Correct absolute gate claim; PR-P1. |
| 033 | Empirical horizon residual quantile calculation is coherent (`challenger_math.py:23-60`); selecting the winner on the same residual cohort limits calibration assurance. Not a general conformal guarantee. |
| 034 | Correct cluster estimand wording; PR-P9. |
| 035 | MAE/RMSE/Brier/interval-score factors agree (`daily_board.py:70-98`); sparse/discrete interval caveats remain. |
| 036 | Slate-bootstrap and gate implementation inspected (`model.py:107-135`; `scoring.py:57-105`); clarify equal-slate versus row-weighted statistic; PR-P9. |
| 037 | Retain score-scale disclosure: 50 at parity, clipped 0–100 (`scoring.py:52-54`), not conventional 1-loss-ratio alone. |
| 038 | Retain calibration reuse concern and distinguish randomized from emitted intervals; PR-P1. |
| 039 | Now source-inspected (`challenger_features.py:122-155,173-244`): timestamp-indexed historical snapshots and reconstructed schedule vintages. No new arithmetic defect proved; source arrival/finality knowledge not certified by `start_time < cutoff`. Remains validation-only/undetermined end to end. |
| 040 | Fixed .7/.3 confirmed; position prior really is bounded to 10,000 observations (`features.py:55,79-101`). Although bare `empirical_bayes_rate` is absent from `model.py:13-28`, opportunity-adjusted EB is present and can fall back to it (`features.py:112-122`). Do not imply all EB candidates are excluded. |
| 041 | Raw wins/appearance confirmed; no intrinsic relief double-discount; PR-P3. |
| 042 | Coherent common appearance population, raw volumes confirmed; proxy experiment is not native end-to-end validation; PR-P3. |
| 043 | Summary W/SO are explicit credits over same appearance frame, not inferred from GA; PR-P3. |
| 044 | Legacy consensus criticism not newly statistically tested; keep dormant classification and do not conflate with native 041–043. |
| 045 | Official starter label contract retained; important contrast with separate season SQL PR-P8. No complete end-to-end new execution. |
| 046 | Unsupported selected-candidate fallback and zero-vs-missing `or` defect confirmed (`challenger_inference.py:49-71`; `challenger_model.py:380,424-447`). “Most winners” not established without selected artifacts. Require parity for every emit-able candidate. |
| 047 | Correct venue-scorer interpretation; missing contextual features remain model limitations; PR-P9. |
| 048 | Mixture variance algebra is correct conditional on valid inputs (`season.py:4384-4413`). This does not validate rate variance scaling, derived covariance, or incorrect goalie labels. |
| 049 | Frozen-window policy expiry is reported/design scope, not a formula bug. No fresh exhaustive caller search. |
| 050 | Raw opportunity frequency confirmed. Correct D8's window: this kernel says up to 20 games in 60 days with one within 14 days (`modeledSkaterParticipation.ts:110-130`), not universally 6–8 games/14 days. It explicitly labels itself uncalibrated. |
| 051 | Rolling variant uses 14 local calendar days and withholds incomplete labels (`rollingWindowParticipation.ts:43-74`). Raw endpoints are not confirmed absence/presence; smoothing is a candidate policy change, not a missing-label imputation. |
| 052 | Exposure-shrinkage ablation formula inspected (`pp_shot_support.py:74-110`); retain narrow soundness, not empirical promotion evidence. |
| 053 | Retain role/strength confounding; correct universal doubling/half-effect interpretation; PR-P9. On-ice versus team exposure needs source-population validation. |
| 054 | Rate/TOI/population composition matters (`season.py:3500-3530,3623-3625`); percentiles are descriptive. No independent measured bias established. |
| 055 | Arithmetic identities mostly coherent but undefined ratios become zero and W/starts is not W/decisions (`season.py:3935-4087`); qualify “sound.” PR-P8/P10. |
| 056 | Normal approximation and opposite-endpoint ratios are not exact count/ratio quantiles; PR-P5. |
| 057 | Ratio-of-expected-totals explicitly labeled and unknowns preserved (`gameExpectations.ts:195-218,228-233`). Retain sound adapter verdict, not correctness of upstream bridge models. |
| 058 | Retain covariance/normal-approximation caveat; add finite-probability and missing-actual safeguards (`restOfSeason.ts:43-63`); PR-P10. |
| 059 | Fixed ridge and draft conflation confirmed; 70% shrinkage claim not established; PR-P9. |
| 060 | Conditional NHLe selection versus representative roster-probability frame must be distinguished (`rookies.py:350-445`); PR-P9. |

## Verification record and reproduction

**Passed:** read-only source/contract checks; `git show --stat 87785fdbc`; no diff between the audited implementation paths and that audit commit; actual-function synthetic checks described in PR-P1/P2/P10; algebraic C17, Kish effective-N and appearance-basis checks.

The offline Python runner parsed, selected and executed only these function definitions, with standard-library `math`, `hashlib`, `collections.defaultdict`, `datetime.date` and `typing.Any`:

- `season.py`: `_round_number`, `_reconcile`.
- `advanced.py`: `_number`, `_day`, `_rounded`, `_quantile`, `_advanced_reconcile`, `_simulation_quantiles`, `_fit_rate_policy`.

Set DEVELOPMENT_END=2026-01-02, VALIDATION_START=2026-01-03, VALIDATION_END=2026-04-16. The zero fixture uses entity IDs 1–20 and dates January 1/3/4/5/6/7, target X=0, prior strength 20, source coverage 1. The simulation fixture/seed/draws and all outputs are recorded in PR-P2; the independent counterfactual replaced only the local AST assignment `correlation=0.65` with 0.0. The application files were never modified. This reproduces the reported checks without database credentials, source-data exports or importing modules with service dependencies.

**Not run:** full application/unit suites, source-collection scripts, live routes, production comparisons, trained-artifact replay, interval coverage on independent real outcomes, external-reference retrieval, or native-versus-blended served predictions. Those are not implied by static review or synthetic checks. Some “sound” rows received bounded symbol inspection rather than whole-subsystem certification, as noted above.

## Recommended disposition

1. Retain the original audit and append this review; do not silently overwrite its dated observations.
2. Before activation, fix official goalie labels, train/serve candidate parity, uncertainty construction and missing-data contracts. Establish actual emitted-interval prospective coverage. Native shrinkage changes require a separately versioned, tested policy.
3. For the live ledger, first settle the desired common conditioning/candidate universe and then fix every count/FP comparison and UI interpretation. Preserve existing binary-event and unknown-settlement safeguards.
4. Keep fixed research policies separately identified; do not replace them or delete dormant code merely because a more sophisticated alternative exists.
5. Owner decisions still useful: native activation intent; approved mean-versus-median evaluation objective; shared ledger conditioning; selected-versus-fixed private policy contract; chosen QS benchmark. The consumed-lockbox premise is already answered by the v4/v5 contracts and should not be asked again as a new discovery.

No production action is authorized or needed to accept this source review. Any future data work should start from existing frozen/local evidence and a separately bounded plan.
