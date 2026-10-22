# F3 falsification: cumulative TOI is not a safe drop-in correction

2026-10-20 UTC. This memo explicitly supersedes `exposure.md`'s cumulative-input-only recommendation and its simplified appearances/20 bootstrap interpretation. The caller really supplies average TOI beside cumulative shots. What follows from that fact is an estimand/support-coupling problem, not a proven universal instruction to substitute cumulative TOI.

No app/Git changes, fits, protected labels, dependencies, production/provider/paid calls. Source pinned by SHA-256 in `exposure-synthetic-results.json`; inspected HEAD `8fcb1b278bd8b7eb2ed961b7f12b320ed0e4a77a`. `exposure_synthetic.py` uses only Python's standard library. All ten deterministic checks passed. These are reproduced algebraic sensitivities, not empirical validation.

Reproduce: `python /workspace/shared/fhfh-research-2026-10-20/exposure_synthetic.py --repo /workspace/shared/fhfhockey.com`. Output: `exposure-synthetic-results.json`, alongside the script. No app modules are executed.

## 1. Exact upstream/downstream trace

**History scope is not uniformly “season.”** `buildPlayerHistoryReadOptions` removes startDate but retains optional season/endDate (`fetchRollingPlayerAverages.ts:2987–2990`); the WGO query applies those retained filters (`:2916–2924`). The normal `run-rolling-forge-pipeline.ts:553–579` call supplies dates but no season. Thus `_all` can accumulate multi-season available history; explicit season jobs can produce a different scope. Do not infer lifetime completeness from its name, or infer a one-year evidence window from the forecast reader's one-year search for snapshot rows.

**TOI, raw counts and rates do not necessarily share support.** Simple accumulators independently skip missing values (`fetchRollingPlayerAverages.ts:2561–2573`). SOG rates use `resolvePer60Components`: matched count+positive TOI, or reconstructed count from a supplied /60 rate (`rollingPlayerMetricMath.ts:3–34`). Rate windows retain the last five positive-TOI appearances, including missing-rate slots (`rollingMetricAggregation.ts:248–289`); they do not backfill five known rates. The recent generic TOI total can therefore exceed the SOG rate's paired exposure. The writer already has ratio component totals; export verified paired support rather than inventing it from a generic total or average×games.

**One weight controls different estimands.** `skater-stage.ts:2024–2137` uses the same combined EV+PP weight to:

- move recent/deployment/rest-adjusted TOI toward the `_all` average;
- blend EV recent-five SOG/60 toward 6;
- blend PP recent-five SOG/60 toward 8.

Consequently greater old EV evidence changes trust in an unchanged thin PP window. The weight does not directly estimate a cumulative player rate, so larger cumulative sample size is not sufficient justification for increasing it. Both seconds ratios are dimensionless; this is not a literal arithmetic dimensional inconsistency.

**Later layers matter.** Role bounds, availability and PP allocation precede hard team TOI/shot reconciliation (`skater-stage.ts:2341–2592`; `reconcile.ts`). H/B subsequently uses reconciled TOI, then optional category-specific season bootstrap. Uniform increases in all players' raw shot means can cancel under fixed team totals; nonuniform changes redistribute teammates' shares. The synthetic stage slice is deliberately pre-reconciliation, not an imitation of the whole forecast.

## 2. Reproducible counterexamples

References use the exact conditional Gamma-Poisson mean `(60*C + tau*r0)/(E+tau)`, with E in matched minutes and illustrative tau=15 minutes. A recent-window reference and a stationary-all-history reference answer different questions. Neither is asserted to be hockey truth; tau is not fitted. Current/cumulative variants retain the app's four-decimal weights and global SOG clamps; references expose unclamped inference.

The recent reference ignores older observations by design; the all-history reference assumes one stationary rate with no role drift. Their opposing predictions expose ambiguity in the desired estimand, not evidence that either is the preferred empirical model.

**Fixed recent estimate, more old contrary evidence.** Hold recent-five at 20 shots/100 minutes, all average TOI at 1,200 seconds; prepend zero-shot 20-minute games:

- 5 total games: current SOG/60 8.7642; cumulative-only 9.8016; recent reference 11.2174; all-history reference 11.2174.
- 80 games: current 8.7642; cumulative-only 10.2228; recent reference 11.2174; all-history reference 0.7988.
- 800 games: current 8.7642; cumulative-only 10.2522; recent reference 11.2174; all-history reference 0.0805.

The substitution increases a fixed recent rate's influence after adding contrary old observations. That fails a declared recent-only information contract, while moving opposite the stationary-all-history posterior. A dynamic model could justify other behavior, but must specify why old observations increase recent-signal trust. This counterexample invalidates “weight rises, therefore fix verified.” It does not prove the existing heuristic predicts better.

**Same rate, more history.** With two shots/20 minutes every game, all mean estimates stay at 6/60. Cumulative heuristic weight rises 0.3493→0.9880 from 1→800 games. Recent-reference weight stops at 0.8696 after five games; all-history-reference weight reaches 0.9991. Both are coherent under their respective scopes. Precision cannot be judged without naming the estimator it belongs to.

**Cross-strength contamination.** Fix PP history at one shot/five minutes, change only EV history from 1→800 games. PP SOG/60 changes 9.5548→11.0840 currently and 9.5548→11.9520 after substitution. PP's matched reference stays 9.0000. Shared latent information is a possible modeling choice, but the code has no explicit cross-strength hierarchy establishing this transfer.

**Zero is not missing.** Five valid 20-minute zero-shot games and five missing-count games receive identical current weights (0.3314) and identical cumulative weights (0.5043). Their forecasts are not identical because missing rate falls back to the prior. Matched support distinguishes 100 observed minutes of zeros from zero rate-supported minutes. Merely changing TOI leaves the misleading common “sample” confidence semantics intact.

**Generic exposure invents evidence.** One known shot in 20 minutes plus four missing-shot/known-TOI appearances gives 100 generic minutes, but only 20 matched minutes. Matched posterior =4.2857/60. Assigning all 100 minutes to the observed 3/60 rate fabricates five count-equivalents and changes it to 3.3913. Pairing matters before selecting any shrinkage scale.

**Overlapping H/B windows.** With 10 HIT in 100 historical minutes, all 10 in the last 20, position prior 4.9/60 and 50 pseudo-minutes: a single static posterior and an exact disjoint sequential update both equal 5.6333. Re-updating with the already included recent data yields 8.5000. The existing H/B recency blend yields 9.1143. That blend is a legitimate explicit recency preference, not the same operation as double-counting a Bayesian update. It cannot inherit static-posterior confidence without a new uncertainty argument.

## 3. Minutes shift reverses the apparent winner

Synthetic 75 games at 20 minutes/two shots, followed by five at 10 minutes/one shot: rate remains exactly 6/60. Current weight gives 795.525 forecast seconds and 1.325875 shots; cumulative-only gives 656.306 seconds and 1.093843 shots.

Under a durable 10-minute role, exact expected Poisson MSE is 1.10619 currently versus 1.00881 cumulative-only. Under a temporary dip followed by a return to 20 minutes, it is 2.45444 versus 2.82112. The preferred edit reverses solely with the future-workload assumption. These are mathematical results under stipulated means, not estimated NHL performance. Old sample-mean TOI and desired next-game TOI must remain distinct.

## 4. Bootstrap correction and falsifiable next action

This stage calls `loadSeasonBootstrap(...,"skater",false)` (`:1460–1462`), disabling fantasy priors. `blendSeasonBootstrap` renormalizes only available category inputs. Let p=min(n/20,1). When previous-season category exists, effective organic coefficient is `p/[p+0.4*(1-p)]`: 0.1163/0.4545/0.7143 at 1/5/10 appearances, not 0.05/0.25/0.50. If previous category is missing, organic receives all available weight; when all positive-weight parts disappear, code falls back to organic. Nominal disclosure weights alone do not establish actual influence.

**Tomorrow's exit should be contract tests, not the scalar substitution.** Choose whether each weight measures recent rate precision, historical latent-rate precision, or workload adaptation. Then require:

1. Exact target/strength/window/count/exposure identities and explicit unknown/reconstructed support.
2. Recent-only reliability invariant to appended out-of-scope old rows; a stationary model instead updates both numerator and denominator and satisfies partition invariance. Do not require both incompatible invariants.
3. Fixed PP support invariant to EV-only changes unless an explicit cross-strength model is chosen.
4. Unknown versus observed-zero coverage preserved; no generic-exposure pseudocount invention.
5. Pre-bound, post-bound, post-team-reconciliation and post-bootstrap paired traces, including effective category weights. Test uniform-scaling cancellation and teammate redistribution.

Passing these establishes implementation semantics, not forecast superiority. Preserve the existing approval-gated HIT/TOI experiment and protected-date boundaries. Only a separately authorized chronological comparison can choose workload adaptation or calibrate a predictive model. No new literature was needed to resolve this narrower question: the decision changed through upstream support and downstream algebra, not additional model coverage.
