# FORGE: amended research plan and working task list

Prepared by Scout, October 14, 2026 Eastern / October 15 UTC. Research and planning amendment; no model, data, production or experiment changes made.

## Executive recommendation

Keep the existing framework, but replace repeated tiny-cohort weight tuning with a broader, finite, target-specific experiment. The most promising sophistication is **better modeling of opportunity, information timing and context**, followed by stronger rate estimates. A complicated distribution around a weak mean does not necessarily improve the lineup decisions we care about.

Our product goal remains: native FORGE forecasts → better legal start/bench decisions in RSO and Start Chart → complete drop/add recommendations measured against the optimized existing roster.

### What changes in the plan

1. Evaluate **scheduled player-game opportunities**, including verified nonappearances, rather than only rows for players who played. Otherwise we cannot evaluate participation or unconditional forecasts.
2. Distinguish **officially credited fantasy statistics** from neutralized player ability. Arena/scorer effects may need to be removed when estimating ability and reinstated for the upcoming venue when predicting recorded hits/blocks.
3. Compare a direct count forecast with **forecast minutes × shrunk rate**, using predicted rather than actual test-game minutes. Audit where the error comes from before adding machinery.
4. Freeze a small challenger menu per target; retain baselines and evaluate the whole selection procedure chronologically. Different methods per statistic are appropriate, but linked quantities must remain coherent.
5. Treat **mean accuracy, probability calibration, distribution quality and lineup utility** as different goals. Report them separately rather than allowing one combined score to conceal regressions.
6. Add role-change, trade, rookie and information-latency tests. Better responsiveness must beat simply reacting to random recent results.
7. Keep sophisticated dynamics, ensembles, shot-quality models and decision-focused training as bounded experiments with explicit promotion/stop rules.

No source reviewed establishes a universally best NHL player model or guarantees a percentage improvement for FORGE. Recommendations below are experiments, not claims that the existing implementation lacks every item.

## Verified starting point and limits

The accessible FORGE owner's latest recorded handoff confirms a completed consolidated plan and a hold on new fits, scoring, allocations and experiments. Its sequence is coverage → frozen cohort/protocol → bounded per-target benchmark → supported heads → generalization diagnostics → prospective confirmation → lineup utility. This amendment preserves that sequence.

Supplied research results: January 8–13 development scored 55 skater appearances across 16 skaters, three PPP labels and two goalie appearances. Conditional TOI MSE improved 5.112%; assists, hits and PIM worsened 3.946%, 3.488% and 0.480%; other listed skater heads were unchanged. Gains and regressions were concentrated. These findings motivate diagnostics, not causal diagnoses or broad superiority claims.

Historical source versions were captured after simulated cutoffs. These are retrospective development results, not authentic pregame replay. The completed exposure review could not certify a retained historical reserve as untouched. Preserve exact exposure uncertainty; do not claim all values were read, and do not try to restore blindness by assigning a fresh agent.

The 665-ID inventory is a candidate pool, not 665 qualified skaters. Current source coverage, schemas, code and deployed behavior were not re-audited in this cloud research. The current repository's task register was not edited. This document is the proposed working amendment for reconciliation when access resumes.

## 1. Highest-value methodological amendments

### A. Fix the population before improving the algorithm

Define the forecast universe using information available at each origin. A historical box-score join contains participants; using it alone excludes scratches, injuries and healthy nonparticipants. That would make a participation model look artificially successful and understate the risk of starting a player who does not dress.

Create an opportunity table with player ID, team and date binding, scheduled game, as-of eligibility evidence, participation label status, and category-label availability. Distinguish:
- verified did not appear;
- appeared with a recorded zero;
- source missing or unresolved;
- player outside the defined forecast universe.

Only the first two justify numerical zeros for the appropriate target. NHL game-play credit can include serving a penalty; positive TOI alone is not a complete participation definition. [Official glossary](https://www.nhl.com/info/hockey-glossary) Evaluate conditional production on appearances and unconditional production over the declared opportunity population. Missing complete historical risk sets may block participation evaluation without blocking an honestly labeled conditional-count experiment.

Avoid multiplying participation twice when an existing minutes forecast already includes nonappearances. Goalie-start labels must come from official starts or verified start-of-game evidence, not whichever goalie played the most minutes.

**Acceptance:** inclusion/exclusion counts are independently reconcilable; every scored target has a defined denominator; eligibility is not selected after inspecting which method wins. Broaden dates as well as players. Player-balanced and player-game-weighted summaries answer different questions and should both be shown.

### B. Separate opportunity error from ability error

For skater category k, use the decomposition as a modeling contract:

E[Y_k | pregame information] = P(appearance | information) × E[Y_k | appearance, information].

The appearance-probability identity above is exact when a nonappearance contributes zero. Within its conditional term, multiplying expected minutes by an expected production rate is only an approximation when minutes and rates vary together; label that approximation. PP1/PP2/no-PP scenarios give a tractable way to carry joint role uncertainty without pretending the future role is certain. Forecast team PP opportunity separately from player deployment: a zero-PP-minute game does not by itself prove the player lost their role. PP clock-time shares across skaters do not sum to one; use explicit manpower-aware skater-minute budgets. EV must not silently mean only 5v5, and extra-attacker play must not automatically become an official power play.

Run controlled ablations on the same rows:
- expanding player mean;
- shrunk player rate with a simple pregame minutes forecast;
- same rate with enhanced minutes/role prediction;
- same minutes with enhanced rate/context prediction.

Actual future minutes may be used in a separately labeled diagnostic to locate error, never in the forecast used for acceptance. A primary NHL study explicitly illustrates this distinction. [S14] Use rolling-origin, out-of-sample minutes predictions when training a second-stage model that consumes predicted exposure, so the second stage sees realistic exposure errors.

**Why this is useful:** paired ablations test which changes improve errors across cases. A single miss still mixes model error and irreducible outcome noise; it cannot uniquely identify the cause. This is more informative than replacing weights blindly.

### C. Model recorded outcomes, including venue and era

Primary NHL research documents rink recording differences, including hits and blocks, in 2007–08 through 2012–13. It supports investigating the mechanism; its coefficients are obsolete for direct reuse. The paper also uses realized game score state to explain counts, which cannot be inserted as a known pregame feature. [S1]

For fantasy forecasts, the target is the statistic actually credited by the relevant provider. Proposed experiment:
1. Estimate recent, regularized venue effects jointly with team/opponent context using only training history.
2. Estimate player ability without confusing home-rink recording tendencies with talent.
3. Predict recorded counts at the destination rink; do not publish neutralized counts as expected fantasy credit.
4. Compare venue-aware versus venue-blind forecasts by home/away, arena, season and traded players.

Check scorer-definition changes and season-wide baselines before interpreting a player trend. Keep NHL/provider targets explicit. Do not copy fixed arena multipliers or use realized game-state variables from the target game.

### D. Improve shrinkage and adaptation without daily winner chasing

Use hierarchical pooling by defensible pregame groups, such as position, plus player-specific history. Learn shrinkage strength on development data, not from an invented universal minutes threshold. Rookies and sparse histories need a labeled prior/fallback and uncertainty, not zero ability or veteran-level confidence.

Test one time-adaptive alternative against a static/shrunk baseline: recency-weighted rates first; a state-space rate model later if residuals show a remaining adaptation problem. Separate latent ability from role changes. A trade should not automatically erase talent history, but it may reset or change workload/context expectations.

NHL aging research identifies selection problems when only surviving/observed players inform age curves. Treat age effects as training-derived priors and test cold-start groups separately; no universal age peak or cross-league translation factor is assumed. [S2]

HockeyViz's Magnus 9 documents contextual and age-dependent modeling, but it estimates 5v5 shot-rate impact, not our complete next-game fantasy targets. Its methods are useful leads; proprietary performance is not independent FORGE validation. [S3]

### E. Separate a better mean from a better uncertainty model

A count distribution with the same expected count can improve tail calibration while leaving point MSE exactly unchanged. A risk-neutral linear-points optimizer will also make the same choices if all means and constraints stay fixed; category, threshold or risk-aware objectives can respond to distribution changes. Negative-binomial dispersion is not automatically a mean-accuracy upgrade. Nor does a high pooled variance establish conditional overdispersion: players, roles and minutes differ.

A Gamma-Poisson hierarchy already generates negative-binomial posterior predictive variation; additional random role/exposure uncertainty adds variation too. Do not double-count uncertainty by stacking dispersion layers without residual checks.

Compare Poisson and a dispersion alternative only after defining conditioning and checking zero/tail calibration out of sample. PIM deserves an event-severity or hurdle/compound candidate if verified penalty classifications exist, because penalty minutes are not interchangeable one-minute events. A legitimate 14-PIM game remains part of the target.

Dynamic count-mixture models offer transferable methods for low counts and changing rates, but the cited study is retail sales research, not proof of NHL predictive gains. [S4]

### F. Coherent goalie forecasts, with separate component accountability

Select workload and stopping components separately, then validate the reconciled outputs. Predict appearance state (start, relief, no appearance), minutes and shots faced before converting to saves/goals allowed. If the evidence only supports conditional-on-start forecasts, label that limitation.

For compatible counted shots, require SV + GA = SA. Define empty-net events, shootouts and attribution before enforcing player/team identities. SV% and GAA need explicit estimands: expected game ratio, ratio of expected totals and multi-game aggregate ratio are different objects. Aggregate roster ratios from counts/minutes rather than averaging player percentages; zero-denominator ratios remain undefined rather than zero.

Win and shutout probabilities require their own event definitions and evaluation. Personal GA=0 alone is not a complete shutout label, and a starter need not receive the win. Do not manufacture pStart or shutout confidence from two goalie appearances. A detailed joint simulator is a later option, not a prerequisite for a truthful conditional workload baseline.

### G. Compare methods on the right score

For expected counts, use paired MSE (RMSE for familiar units), bias and an appropriate count deviance. Retain MAE as a secondary descriptive measure, recognizing that it targets a median rather than the mean. For probabilities use predeclared proper scores such as Brier/log loss and calibration; for distributions add a proper distribution score and interval/tail checks. [S5, S13]

Show target-specific denominators, missingness and coverage beside every result. Normalized per-target skill is interpretable when the baseline loss is nonzero; raw saves MSE and goals MSE should not be blended without an explicit reason. Log every candidate tried, including failures.

Selection itself can overfit a noisy validation score; the general risk is documented by Cawley and Talbot. Use chronological inner development for choices and later outer periods for evaluating the chosen procedure. [S6] Do not invent a minimum sample size, fixed 1% improvement gate or standard-error percentage. Set a practically meaningful gain and uncertainty plan before the next experiment. With too few independent dates, report inconclusive rather than a precise confidence claim. Dependence can arise within game/date and across repeated players; the inference design must account for it. [S7]

### H. Test the decision the customer actually makes

For each replayable pregame roster snapshot, run baseline and challenger through the same legal solver with the same players, eligibility, league settings, locks and acquisition rules. Compare realized active fantasy points, category outcomes where defined, AGP and complete swap net contribution.

A hindsight-optimal lineup is an upper-bound diagnostic, not an achievable competing forecast. Missing historical waiver availability prevents an authentic acquisition replay; use explicitly simulated candidate pools instead of claiming real-world catch-up gains. For points leagues, expected linear score is the weighted sum of category expectations; a universal per-category winner need not optimize all league weight combinations. For category leagues, probabilities and joint dependence matter more.

Decision-focused learning provides a research framework for measuring downstream regret, with published experiments outside hockey. Start by adding decision-aware evaluation to the existing solver; postpone end-to-end decision-focused training until the baseline forecast/evaluation interface is stable. [S8]

### I. Require shot-quality sophistication to prove its forecasting value

Native shot-quality or finishing models are worth testing, but classifying a shot after its location/type are known is easier than forecasting a player's next-game total before those shots exist. A 2012 NHL weighted-shot paper found no strong predictive superiority over traditional measures in its comparisons. A newer skill-adjusted xG preprint reports improved held-out shot-outcome scores, but conditions on realized shot descriptions and needs a chronology audit. Neither establishes a next-game FORGE gain. [S11, S12]

Compare direct goals rates against shot-volume × finishing, then add native predicted shot mix only if it earns a gain. An xG model trained on unblocked attempts does not directly supply a goal probability per SOG; denominators must match. Separate G, primary/secondary A and PP contributions only when labels support them. Retain an “other players” residual when reconciling team totals; the pilot subset must not receive every team goal or shot. Evaluate any reconciliation or clipping as part of the final predictor.

A useful further test is information latency: compare the same frozen forecast at an earlier and later authentic pregame cutoff. This measures whether fresh lineup/role information adds enough decision value to justify extra collection. Do not reconstruct earlier knowledge from today's news or treat duplicated reports as independent confirmations.

## 2. Amended task list

Status convention: checked means completed evidence or this research deliverable; unchecked means work remains. Priorities and owners below are proposed, not newly dispatched jobs. Existing implementation must be mapped before opening duplicate tasks.

### P0 — Preserve progress and establish a usable benchmark

- [x] **F00 — Preserve existing plan, exposure assessment and completed results.** Latest owner handoff checked; development hold remains. No historical untouched-test claim added.
- [x] **F01 — Produce this research amendment.** Primary-source findings separated from FORGE proposals; no numerical gain promised.
- [ ] **F02 — Reconcile this amendment with the living register and current code.** Owner: Scout + FORGE owner. Map each task to existing work, actual paths and latest receipts; retain original task IDs; mark done only with evidence. Deliverable: delta register, no duplicate backlog.
- [ ] **F03 — Complete the value-free coverage audit, subject to its separate approval.** Owner: data owner + evaluator. Existing proposed scope remains retained indexes/spans October 7, 2025–January 13, 2026. Exact IDs, roles, team bindings, schemas, target units, date/game counts and missingness. Do not reopen mixed outcome files. Deliverable: concrete cohort proposal and authorization-ready manifest. Research request does not itself authorize this data audit.
- [ ] **F04 — Define opportunity population, targets and label contract.** Owner: FORGE + evaluator. Include verified nonappearances; distinguish missing/zero; pin provider definitions, revisions, forecast horizons and conditionality. Depends F03 for actual feasibility. Exit: each head has an explicit population, time boundary and fallback.
- [ ] **F05 — Freeze finite benchmark protocol.** Owner: evaluator. Exact sources/cohort, lag/availability policy, temporal partitions, candidate budget, primary scores, practical gain criterion, subgroup checks and stop rules. Preserve exposed-history labels. Exit: independently reviewed manifest before execution.
- [ ] **F06 — Reproduce baseline and existing candidates on admitted broader data.** Owner: FORGE. First run is a coverage/benchmark repair, not a new algorithm sweep. Report matched rows and exclusions. Depends F03–F05 and execution approval. Exit: immutable reproducible forecasts and target-specific comparisons.

### P1 — Improve opportunity and high-utility count forecasts

- [ ] **F07 — Decompose exposure versus rate error.** Owner: skater-model worker. Four ablations from Section B; forecast exposure out of sample; oracle diagnostic kept separate. Depends F06. Exit: identify the next change from evidence rather than speculation.
- [ ] **F08 — Participation and role evidence model.** Owner: data/role worker. Versioned pregame evidence, probabilistic role scenarios, source freshness and contradictory reports. Separate PP team opportunity from deployment, and test early versus late authentic information cutoffs when feasible. Calibrate only on an authentic risk set. Conditional forecasts may proceed separately while unavailable history is disclosed.
- [ ] **F09 — SOG/HIT/BLK rate challenger.** Owner: skater-model worker. Compare simple shrunk exposure model and one modest context extension; reuse existing implementation where present. Exit: paired mean accuracy, calibration/bias, subgroup/concentration and latency results.
- [ ] **F10 — Rink/era observation-model experiment.** Owner: separate modeling worker after F06. Recent training-only venue effects; recorded-count evaluation; verify SHOT versus SOG and shooting-team BLOCK versus defending-player BLK mappings; no historic coefficient copying. Avoid simultaneous edits to F09. Exit: ablation shows whether venue adds useful signal beyond player/team/context.
- [ ] **F11 — Goals/assists/PPP components.** Owner: scoring-model worker. Start from direct target means; compare opportunity + rate decomposition. Test shot-volume/finishing or assist components only with verified labels. PPP incorporates PP exposure/role uncertainty; no PP evidence means unknown role, not zero PPP. Exit: per-head gains after coherence checks.
- [ ] **F12 — PIM event-severity challenger.** Owner: skater-model worker. Verify penalty-type accounting first; compare simple shrunk baseline against one compound/hurdle candidate. No arbitrary outlier deletion. Exit: full-tail and typical-game performance reported separately, promotion based on declared target.
- [ ] **F13 — Coherent goalie components.** Owner: goalie-model worker. Conditional minutes/SA baseline, stopping component, start/relief state where support exists, derived SV/GA, ratio contract and independent W/SO gates. pStart must cover the complete team-game candidate set (with an unknown/other state if needed); official W/SO marginal probability heads can precede a full simulator. Exit: reconciled per-component evaluation, honest unsupported heads and no hidden regression in blended goalie scores.

### P2 — Earn sophistication and connect it to lineup value

- [ ] **F14 — Test one dynamic adaptation mechanism.** Owner: FORGE. Recency or state-space challenger, not unlimited half-life search; subgroup tests for trades, role changes, rookies and returns. Depends broad baseline and verified feature clocks.
- [ ] **F15 — Calibrate distributions and uncertainty.** Owner: evaluator/modeler. Mean-fixed distribution comparison, then joint exposure uncertainty; residual dispersion and zero/tail checks. Optional time-adaptive interval calibration is a separate policy needing its own test. Exit: interval usefulness and coverage, not only wider intervals.
- [ ] **F16 — Benchmark a bounded nonlinear challenger and/or regularized ensemble.** Owner: FORGE. Only after simple baselines; identical pregame features; chronological out-of-fold predictions for combination weights. No blend-improvement guarantee, no final-block weight tuning. Exit: improvement survives selection and reconciliation cost.
- [ ] **F17 — RSO/Start Chart decision replay.** Owner: consumer/evaluator pair. Same legal solver, points/category rules and actionable candidates; report crowded-day start/bench gains and net complete-swap gains. Distinguish simulator from authentic account replay. Depends admitted forecasts and consumer contracts.
- [ ] **F18 — Next-10/20 scheduled-game aggregation.** Owner: FORGE. Sum the next 10/20 scheduled-game means all issued at the same forecast origin; keep each later refresh as a separate version. For uncertainty, model shared role/availability and schedule dependence. Exit: horizon-specific calibration, no silent switch to next appearances.
- [ ] **F19 — Accountability dashboard.** Owner: independent UI worker after schema freeze. Target/version/baseline, sample and date coverage, signed-error histogram, loss through time, calibration, subgroups, excluded rows and test-status badges. Display local/research/shadow/deployed distinctly.

### P0 operational track — Make future confirmation reliable

- [ ] **F20 — Package a future cloud-ready capture runner.** Owner: capture owner + Scout. Export exact runner/model/input-schema/guard pins and admissible nonsecret fixture package; verify environment parity, clock, dependencies, duplicate prevention and immutable receipts. Credentials or expanded access need their own approved setup. This is future work: it does not reopen October 14's passed window or authorize an automatic retry.
- [ ] **F21 — Freeze and issue prospective shadow forecasts.** Owner: sole capture executor. Freeze candidate choices and rolling-update policy before permitted windows, then evaluate with genuine source times. Unsupported heads remain conditional/unavailable. Do not let UI pressure turn research into a production claim.
- [ ] **F22 — Per-head release review and rollback.** Owner: independent reviewer + product owner. Data integrity, predictive evidence, coverage, calibration, consumer readback, latency and rollback. Promote supported heads/populations independently when justified; no entire-model blanket approval.

### Parked until a simpler experiment earns them

- End-to-end decision-focused training, large neural/transformer architectures, elaborate joint game simulation and unrestricted feature searches.
- Learned cross-league rookie translations without verified histories/rights; do not substitute externally authored fantasy projections.
- Automatic daily switching among dozens of methods based on tiny recent validation samples.

## 3. Finite first experiment

Proposed search budget: baseline plus at most two additional mean specifications for the first active head/component, followed by one mean-fixed distribution diagnostic. This is an operational limit on search, not a statistical sufficiency threshold. Do not run the Cartesian product of every possible head, context block and hyperparameter.

After F03–F05 and separate execution approval, compare **baseline → pooled exposure/rate → same model with one context addition** on the exact same admitted player-game rows. Use the widest defensible retained cohort and enough temporal origins to assess stability; do not claim the pilot's six dates resolve that question. Pick the first head from actual coverage, with SOG/HIT/BLK sensible candidates to assess, not a predetermined promise.

Keep the current baseline in service/research wherever appropriate until an alternative earns promotion. Stop a challenger if it needs unavailable pregame features, changes the target population opportunistically, violates accounting, cannot replay, or provides no practically useful gain at acceptable uncertainty and cost. "Inconclusive" is a valid terminal experiment result and should lead to more appropriate evidence, not infinite parameter fiddling.

Independent work now suitable for Scout's cloud workspace: methodology/source audit, protocol and target-schema drafts, synthetic invariant fixtures, dashboard specification and review of nonsecret supplied code. Actual retained-data qualification, protected model execution and authenticated integration remain tied to accessible artifacts and approvals. No work on the user's Mac was started for this research.

## 4. Primary-source ledger

Research accessed October 15, 2026 UTC. These sources support methods or mechanisms, not automatic FORGE gains. Specific reading scope is stated; no claim of exhaustive review of all previous reports.

- **S1 — Schuckers & Macdonald, Accounting for Rink Effects in the NHL's Real Time Scoring System**, arXiv v1 December 2, 2014; sections 2–4, especially Models and HIT/BLOCK results. [Full text](https://arxiv.org/html/1412.1035). NHL historical recording effects; 2007–13, mainly non-empty-net 5v5. The HTML displays a later date in its header; the submission/version and dataset dates control our interpretation. No current rink coefficient adopted.
- **S2 — Schuckers, Lopez & Macdonald, Estimation of Player Aging Curves Using Regression and Imputation**, arXiv record first submitted October 26, 2021. [Full text](https://arxiv.org/html/2110.14017). Introduction, missingness/selection discussion and NHL application checked. Supports accounting for selection into observed performance, not a ready-made rookie forecast or universal age curve.
- **S3 — Micah Blake McCurdy, Magnus 9 EV**, August 27, 2025. [Author methodology](https://www.hockeyviz.com/txt/magnus9EV). What's New, covariates and method checked. Contextual shot-rate/age modeling is an author-documented method, not independent next-game fantasy validation. Earlier Magnus versions are not treated as current automatically.
- **S4 — Berry & West, Bayesian Forecasting of Many Count-Valued Time Series**, arXiv v1 May 14, 2018. [Full text](https://arxiv.org/html/1805.05232). Sections 2 and 4 describe dynamic mixture/random-effect and shared-factor construction. Retail setting; transfer hypothesis only.
- **S5 — Tilmann Gneiting, Making and Evaluating Point Forecasts**, arXiv first submitted 2009, published 2011. [Full text](https://arxiv.org/html/0912.0902). Sections 1.3, 3.1–3.2 and discussion support matching scores to means/medians/ratios. Does not give a universal acceptable NHL MAE.
- **S6 — Cawley & Talbot, On Over-fitting in Model Selection and Subsequent Selection Bias in Performance Evaluation**, JMLR 11, 2010, pp.2079–2107. [Paper](https://jmlr.csail.mit.edu/papers/volume11/cawley10a/cawley10a.pdf). Abstract/introduction and selection-bias discussion checked. General methodological support; no NHL-specific threshold inferred.
- **S7 — Cameron & Miller, A Practitioner's Guide to Cluster-Robust Inference**, 2015. [Paper](https://cameron.econ.ucdavis.edu/research/Cameron_Miller_JHR_2015_February.pdf). Dependence, few-cluster and multiway-clustering discussions are relevant; method assumptions need adaptation to this evaluation design. No claim that an arbitrary number of NHL dates guarantees valid intervals.
- **S8 — Elmachtoub & Grigas, Smart Predict, then Optimize**, online 2021 / Management Science volume 2022. [Full text](https://arxiv.org/html/1710.08005). Formulation and experiments support measuring decision loss; experiments concern shortest paths/portfolios, not fantasy hockey. Decision-aware evaluation is immediate; specialized training remains proposed.
- **S9 — Gibbs & Candès, Conformal Inference for Online Prediction with Arbitrary Distribution Shifts**, JMLR 25, 2024. [Journal record and paper](https://www.jmlr.org/papers/v25/22-1218.html). Abstract/method motivation checked. Optional later calibration work; long-run/adaptive guarantees do not establish per-player conditional NHL coverage or better mean accuracy.
- **S10 — scikit-learn, Poisson regression and non-normal loss**, current official documentation accessed October 15. [Worked example](https://scikit-learn.org/stable/auto_examples/linear_model/plot_poisson_regression_non_normal_loss.html). Exposure-weighted rate fitting and nonlinear Poisson-loss challenger are implementable examples; insurance results cannot establish NHL superiority. Its random split is not our temporal protocol.

- **S11 — Macdonald, Lennon & Sturdivant, Evaluating NHL Goalies, Skaters, and Teams Using Weighted Shots**, 2012. [Full text](https://arxiv.org/html/1205.1746). Sections 5.1, 5.3–5.4 checked. Older split-half evidence; provides a caution against assuming complexity improves pregame forecasts, not a rejection of modern xG.
- **S12 — Noël, Expected by Whom? A Skill-Adjusted Expected Goals Model for NHL Shooters and Goaltenders**, arXiv 2511.07703, v2 inspected. [Full text](https://arxiv.org/html/2511.07703v2). Sections 3.4–3.5 and Table 5 checked: author-reported held-out shot classification improvements. Future shot context is unavailable pregame; feature-bracket and cross-fitting chronology need audit before reuse. No performance numbers transferred to FORGE.
- **S13 — Gneiting & Raftery, Strictly Proper Scoring Rules, Prediction, and Estimation**, JASA 2007. [Paper](https://sites.stat.washington.edu/raftery/Research/PDF/Gneiting2007jasa.pdf). Proper-score definitions and probability/distribution score framework checked. Expected-score incentive compatibility does not guarantee an observed small-sample winner.
- **S14 — Buttrey, Washburn & Price, Estimating NHL Scoring Rates**, JQAS 2011. [Paper](https://faculty.nps.edu/awashburn/docs/EstimatingNHLScoringRates.pdf). Section 4.4/Table 4 explicitly distinguishes predictions conditional on actual future manpower minutes from deployable forecasts. Supports our exposure-leakage guard; no historical window or scoring coefficient adopted.

## 5. What this document does not settle

Actual code-level gaps, full retained cohort feasibility, current data-access authority, production readiness and future capture setup still require their respective evidence. Neither a paper nor this plan authorizes opening protected outcomes. The best next investment is a defensible broader benchmark plus opportunity modeling, not another unbounded search for a winning weight.
