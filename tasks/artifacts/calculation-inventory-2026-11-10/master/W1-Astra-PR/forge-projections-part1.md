# Independent peer review: W1-6 FORGE projections, part 1

Reviewed 2026-11-11 in `/Users/tim/Code/fhfhockey.com`, `octoberBranch`. Audit commit: `0e52a91350`. The audit names source commit `e56c5d635`; inspection began at `bc60b18a64a83444ec0c9b2a3f41132ba5c982db` and the final source check was at `37106e4aba5f72de978b20658dca0aefd0a62296`. The named projection, bridge, ledger, season-evaluator and counterfactual source paths had no committed differences from `e56c5d635` at that last check. Other work in this shared checkout was preserved.

Scope: the 60-entry part-1 packet, its W1-6 prompt, `audits/forge-projections-part1.md`, current `OWNER-DECISIONS.md`, Batch A consolidated findings, and the relevant earlier Astra goalie, rolling, team, NST and xG qualifications. The adjacent season-forecast review was consulted for the overlapping scoring-population question. **Part 2 is not reviewed or merged into this report.** This is an additive review, not implementation or acceptance of a replacement model.

## Verdict

**Retain the main defect findings, but correct important claims and tests before using this as an implementation plan.** Independently inspected source supports the per-game TOI evidence error, team NST per-60 unit error, one-game context profiles, goalie-slot/individual mismatch, incorrect accuracy population and one-day probability gates, spread sign, nonmonotone yes-only de-vig, null ranks, and incompatible strength classifiers.

The most consequential corrections/additions are:

1. ES+PP omits the explicit PK bucket, **not all extra-attacker or empty-net production**. Empty-net and overtime overlap strength categories. Owner decision 7 governs xG/GSAx, not erasure of credited fantasy goals.
2. A fixed 18,000-skater-second budget is not the actual all-situation exposure identity. Removing the second PK multiplier is directionally justified, but the proposed exact 300-minute test preserves a separate approximation.
3. **Bootstrap changes shots after reconciliation.** The report's universal “team volume pinned / context cancelled” claims need a no-bootstrap, nonbinding-clamp qualification.
4. **ELITE is reachable.** Its absence in a dated sample does not establish an unreachable tier, and forcing every tier to be populated is not a valid test.
5. Fixed-baseline decile comparisons and RMSE are already present. Retain the evaluation warnings, not the contrary implementation claims.
6. Two additional source defects deserve follow-up: zero-shot historical exposure is discarded in the shot-rate helper, and explicit null season-interval endpoints become a fabricated `[0,0]` interval.

Fable's **13 sound / 29 mis-specified / 16 wrong / 2 undetermined** tally is the original classification, not an independent production-validation count. Several entries mix sound arithmetic, defective readers and empirical model choices; a replacement tally would falsely suggest all 60 were equally verified. The disposition matrix below states the coverage instead.

## Evidence boundaries

- **Independently source-verified:** code and callers cited below. Local fixtures executed actual TypeScript functions through in-memory transpilation, with the Supabase import replaced by inert/null or in-memory responses. No fixture queried a service.
- **Independently executed:** nine focused Vitest files, **162 tests passed**; additional counterexamples listed below. Passing existing tests does not clear defects they do not test.
- **Reported only:** every production ledger count, November multiplier range, table-start date, catalog/table-existence claim, flag inference, trace-game stored number, calibration percentage and magnitude from Fable. No production read was made, and the audit's ad hoc SQL/export is absent. Do not treat the −5.5% FP bias, +12.5% block bias, 2,699 null-TOI rows, 42-game distribution or 114-start sample as reproduced here.
- **Not established:** today's production serving branch, runtime flags, completeness of historical outputs, causal error attribution, or predictive improvement from any recommendation. Code has direct readers, but read admission and native-source selection can prevent a particular legacy output from being served.
- No code changes, production queries, provider calls, DB writes, migration, cron execution, publication or deployment. Only this review file was authored. No separate diary was created because the assignment expressly restricts saved work to this file.

## Corrections and new findings

### PR1. Correct the situation accounting before “adding back” missing production

**D1 / M-FRG-038, 057–059: retain incomplete all-situation coverage; narrow its attribution.**

`web/lib/projections/derived/situation.ts:27-54` explicitly adjusts skater counts for pulled goalies. `1560` is ES for both teams. `buildStrengthTablesV2.ts:272-306` counts non-shootout shots/goals/assists with that classifier and does not exclude empty-net events. `skater-stage.ts:2652-2659` then targets strength-table ES shots plus official PP shots. Thus ordinary 6v5/5v6 events can already be in the ES target. A short-handed empty-net goal can instead be in PK. Overtime can be ES/PP/PK too. Missing separate EN/OT heads in `nativeGoalAccounting.ts:209,244-260` is not proof that all such events are numerically absent.

**Executed:** `strengthForTeam(parseSituationDigits("1560"), team, home, away)` returns `es` for each side. The shift classifier uses raw counts instead (`ingest/shifts.ts:112-123`), confirming D15's inconsistency.

Owner decision 7 says exclude empty-net shots from **xG totals and GSAx/xGA**, reporting them separately. It does not authorize removing officially credited actual goals, assists or shots from all-situation fantasy totals. Separate the xG population from actual-stat/forecast-total accounting. Adding a new EN component to the current ES+PP output without subtracting overlap can double count.

**Fix/test:** define mutually exclusive strength × net-state × regulation/OT accounting, preserve the official credited totals, keep shootout attempts outside skater totals, and distinguish shooting at an empty net from the shooter's own net being empty. Test 5v5, 6v5, 5v6, 6v4, short-handed empty-net goals, overtime and shootouts. Enforce identities against the chosen complete modeled team target, not against last-10 observed means regardless of opponent. The proposed ±1% last-10 equality and ±2% finite-window bias rules are candidate acceptance criteria, not mathematical laws or owner-approved tolerances. Use paired frozen cohorts and uncertainty intervals to measure improvement. Unpaired naive controls cannot isolate PK/EN as the cause of the reported bias.

### PR2. Physical exposure is inconsistent, but 300 minutes is not the correct universal oracle

**D4 confirmed in the lineup path**, with an additional target qualification. `skater-stage.ts:2458-2459,2515-2533` sets a guarded 60×60×5 budget and calls the non-PP remainder ES. `:2806-2809` multiplies that reconciled exposure by `physicalToiMultiplier`; `skater-adjustments.ts:530-545` defines the multiplier from recent all-situation versus ES+PP TOI. That applies a PK uplift after a budget already intended to cover all situations. The reserve path instead starts from individual raw ES+PP (`reserveProjections.ts:59-61,90-96`); a separate treatment is appropriate.

But 300 skater-minutes is a **nominal five-skater regulation budget**. Two minutes at 4v5 with 58 minutes at five skaters gives 298, without OT or extra attackers. OT, 3v5, coincidental states and pulls change the total. Removing the multiplier does not repair the target's strength labels or make the budget physically exact. Pool guards can reduce it too.

**Fix/test:** derive explicit ES/PP/PK/extra-attacker skater-seconds from a qualified opportunity model and apply physical rates once to the intended all-situation exposure. Test conservation over the modeled manpower intervals, not exactly 300 in every game. Preserve reserve semantics separately. The sample bias is not a measured ablation of this term; a hard ±3% sample-bias gate needs sample size and uncertainty.

### PR3. Reconciliation is not the final shot transformation

**Additional conditional defect / correction to M-FRG-008, 045, 059 and the “Which adjustments survive” table.** Reconciliation updates shots/TOI at `skater-stage.ts:2728-2735`. Then `:2811-2821` calls `bootstrapSkaterLine`, replacing shots, goals, assists and physical counts. `:2830-2835` accumulates those changed values. `seasonBootstrap.ts:94-125` explicitly applies team/rest context to the prior and re-splits the blended total shots.

**Executed:** an organic line with 2 ES + 1 PP shots, prior 6 shots, 10 current-season games, history share .4, and neutral context becomes **3.857142857 total shots**, not 3. Its effective history share is `.2/(.5+.2)`, not merely .2. This is a conditional counterexample, not proof bootstrap was active in Fable's trace (the audit reports it was not).

The pure proportional rescaler cancels a common multiplier only when the multiplier reaches every member proportionately, inputs remain in the same branch, and no later transformation changes them (`reconcile.ts:119-145`). Role bounds, additive shrinkage toward player priors (`skater-stage.ts:2163-2166`) and fallback targets can break that precondition. Therefore “nothing changes team shot volume” and “rest TOI cancels exactly” are too absolute. Even before bootstrap, redistribution can survive nonlinear preprocessing.

**Fix/test:** choose whether the team target remains authoritative after bootstrap. If so, bootstrap before final reconciliation or reconcile the final serialized heads again, with disclosure of the corrected target. Test mixed bootstrap participation, missing prior keys, context changes, binding role caps and fallback targets. Test final outputs, not just the intermediate reconciliation report.

### PR4. Repair goalie populations, including relief and source selection

**D2, D9 and D12 stand**, with these contract corrections:

- The stage builds candidate conditional lines, blends the top scenarios and stores the mixture under one selected ID (`goalie-stage.ts:602-685,804-824`). The goalies API normalizes paired rows (`pages/api/v1/forge/goalies.ts:151-209`). The bridge calls these slot volumes per-start (`forgeDailyBridge.ts:283-289,610-636`) and multiplies them by its own start probability. Those are different populations; the 15-versus-24 saves sample is not a direct test of an individual conditional line.
- Candidate metadata already exists (`goalie-stage.ts:620-632,787-800`). Migration must preserve/use it where supported, not claim only the top probability exists. Historical metadata coverage remains unchecked.
- **Unconditional is not always just conditional × P(start).** `goalieOutcomes.ts:201-260` includes relief-win mass. Counts need `P(start) E[Y|start] + P(relief) E[Y|relief]`, or an explicit zero-relief assumption. A sum of start-only credited wins is normally below team win probability. Even full candidate sums equal the *start-weighted conditional team-win* quantity under a complete normalized set, not automatically an independently calculated marginal probability after nonlinear goalie adjustments.
- The ledger currently scores volume on dressed rows (`servedForecastLedger.ts:414-420`) while its inputs can be unconditional. The settle route lacks completeness evidence (`forge-served-forecast-settle.ts:48-49`). Score conditional-start lines on official starts; alternatively score unconditional lines across a proven complete candidate universe with confirmed nonappearance zeros. Keep missing feeds unknown. A finite calibrated fixture need not have exactly zero observed bias.
- Reconcile opposing skater goals **net of empty-net goals** with aggregate opposing goalie GA on the same game/participation basis, not an arbitrarily named starter. The current independent quantities can disagree; Fable's 2.69/3.39 is reported, not rerun.
- RSO selects a native/legacy/empty source before bridge use (`rosterScheduleData/planning.ts:12,86`; `player-forecasts/forecastServingSource.ts`). Apply the earlier goalie review's source-selection qualifications. The goalies API is a concrete legacy reader, not proof every current product serves it.

**Acceptance:** complete two-/three-candidate sets, incomplete sets with unknown mass, confirmed starter and eligible backup, early pull/relief win, missing actual feed, blocked/off-release run, and separate direct API/native/legacy bridge reader fixtures. Repair official start labels, immutable pregame cutoff/issuance and settlement first, then fit probabilities, as the owner directs.

### PR5. Correct the input units, but do not promote suggested coefficients into validated fixes

**D3, D5–D8 and M-FRG-025, 042–046, 050–051 are substantially supported.**

- `team-context-queries.ts:422-450` computes `xga*60/toi`. **Executed with an in-memory DB row:** 3 xGA, 3,600 seconds produces **0.05**, not 3.0. The latest-row `.limit(1)` profiles are explicit (`:384-413,431-450`; `skater-queries.ts:550-605`). Per-game shot/xG rates are not sample-size evidence (`skater-adjustments.ts:112-113,175-176`). Use count/exposure pairs, coherent windows and an as-of/receipt contract. Skipping the newest row to find the last supported row must disclose staleness, not silently call it current.
- The fallback without a cutoff in `fetchTeamStrengthPrior` (`team-context-queries.ts:370-379`) can look ahead. Merely changing `.lte(date)` to `.lt(date)` does not prove inputs were available before puck drop when records are later backfilled. Keep immutable input receipt/publication provenance.
- The model-version resolver returns null with the owner's absent xG overrides (`team-context-queries.ts:184-189`); this does **not** establish a route to the leaky champion. Preserve the prior Batch A qualification.
- The PDO adapter is genuinely discontinuous at 1 (`skater-adjustments.ts:74-80,259,279`). **However, PDO is absent from the goal multiplier at `:288`.** It enters shots and assists at `:283,293`. On the ordinary fully reconciled, non-bootstrap lineup path, those effects may cancel or be unused. Bootstrap/reserve/redistribution need separate tests. Do not attribute the reported goal-range directly to PDO.
- `skater-stage.ts:2149-2153` passes mean TOI plus total shots into the evidence helper. **Executed:** fixed 100 shots with 1,200 versus 120,000 seconds gives weights **.6211 versus .8653**. Only the TOI component is mis-scaled; “veterans regress as hard as second-year players” is not universal because the shots component differs. Refit exposure scale, scope, thresholds and the second conversion shrink together. Two shrinks are not inherently invalid; whether this compound model over-shrinks is an empirical question.
- Fixed-.900 GSAA input and post-mixture clamp are source-confirmed (`update-goalie-projections-v2.ts:431-433`; `goalie-queries.ts:379-408`; `skater-adjustments.ts:328-340`). Preserve literal NST GSAA as the owner-defined descriptive statistic; label any shrunk predictive feature separately. “Read the goalie stage's modeled save %” is not a drop-in repair: the run computes skater goals before the goalie stage (`run-forge-projections.ts:1035-1050`), and the goalie model consumes those goals. Extract a shared independently estimated goalie-quality input or define a coherent joint model, avoiding a circular dependency.
- Rest and last-five adjustments are hand-set, asymmetric and unvalidated (`goalie-stage.ts:338-371`). They need held-out fitting/ablation. Zero mean within ±.5% is not mandatory: a chosen baseline may legitimately need correction. Test centering against a specified reference population and actual predictive performance, not an arbitrary zero-sum rule.

### PR6. Do not infer unreachable goalie tiers from one sample

**Reject D23's “cannot reach ELITE” conclusion and “each tier non-empty” test.** `goalieModel.ts:94-98` requires +.012; `:127-143` does not prohibit it. **Executed:** league .8924, 1,900 shots and 95 GA, no context shift, returns modeled SV% **.9062531646**, quality **ELITE**. This even respects the report's asserted approximately 1,900-shot sample ceiling.

Fable's narrow sampled spread remains a useful calibration alarm, not proof of unreachable code or that the prior must be weakened. Quality-start evidence being one game is supported (`goalie-queries.ts:285-291`). The 6,000-shot prior and evidence-window mismatch deserve held-out re-estimation with disjoint evaluation, not an imposed talent SD or forced tier occupancy. Test threshold boundaries and label calibration conditional on supported exposure.

### PR7. Evaluation corrections: RMSE and fixed comparison bins already exist

- **M-FRG-017 is not MAE-only throughout.** `promotionGates.ts:127-145,162-196` reports both MAE and RMSE, including `rmseDelta`. The separate `evaluateShadowModeImprovement` is MAE-only (`:88-124`). Avoid conflating the report, unused helper and release gates. Minimum 30 rows alone is not predictive qualification; report paired uncertainty over held-out dates. MAE targets a median, squared loss a mean, so an MAE/RMSE disagreement is not an arithmetic failure.
- **Withdraw the blanket D28 binning repair.** `forge-counterfactual-backtest.ts:348-357` already compares every variant on the same baseline-G top decile, then separately labels an own-top-decile diagnostic. Own-forecast bins are valid for calibration; do not compare them as a common paired cohort. The null-actual coercion (`:267`), latest-date run selection (`:156-167`), latest-team historical reassignment (`:458-461,481-487`) and unbounded fixed PP allocation (`:425-430`) remain defects. **Executed:** two fallback allocations of 700 seconds overshoot a 1,200-second target by 200.
- **D10: retain the one-day probability-gate and empty-subgate defects, not “all 30-day gates pass empty.”** Fresh accumulators at `run-projection-accuracy.ts:2052-2054` feed the probability gates named `_30d` (`:1009-1036`); empty Brier is 0 (`:1213`). But saves/GA MAE read `rolling_30d` (`:995-1005`) and interval gates fail with zero coverage (`:1039-1067`). An empty Brier subgate passing is not proof the whole release passes. Unknown outcomes, sample minimums and genuine windows must be fixed together.
- The bespoke accuracy percentage is not an accuracy probability or a proper score for a conditional mean (`accuracy/fantasyPoints.ts:54-61`). The reported optimizing-constant example was not rerun. Replace/rename the metric by its estimand and show paired baseline skill, rather than assuming every loss measures the same thing.
- The naive PP assist coefficient is .95 per goal (`skater-stage.ts:2823-2826`), versus the stated 1.91 team target. Correct the baseline or honestly label it. A fixed league-average baseline need not have position-specific rates, and sharing reconciled shots is legitimate **for a conversion ablation**; it is not an independent end-to-end forecast control. Add that separate control without mislabelling the existing one.

### PR8. Additional defects found while checking nominally sound entries

**P1, M-FRG-049: known zero-shot history loses its exposure.** `skater-adjustments.ts:643-645` reconstructs hours as `shots/rate` only when both are positive. Zero shots over real minutes therefore become zero hours, indistinguishable from absent history. **Executed:** F/ES with `(shotsAll,ratePer60All)=(0,0)` and no recent input returns **6.62**, exactly the same as `(null,null)`. It cannot regress a supported zero rate by its accumulated exposure because that exposure is not an argument. This is especially relevant to sparse PP histories; population prevalence was not measured.

**Fix/test:** pass the matched accumulated seconds directly, preserve known-zero counts, keep unknown count/exposure pairs unknown, and test zero shots at multiple increasing positive exposures. With a positive prior, the posterior should decrease toward zero as known zero-shot exposure grows. Audit lineup and reserve readers (`reserveProjections.ts:67-72`) and the downstream hard rate floors separately. Do not reuse the withdrawn “shots/60 must be at least 1” invariant.

**P1 evaluation / conditional on explicit null endpoints, M-FRG-036: fabricated zero-width intervals.** `fantasy-projections/settlement.ts:4-6,57-62` uses `Number(null)=0`. **Executed:** `scoreSeasonPrimitive({actual:0,forecast:2,baselineForecast:1,p10:null,p90:null})` returns `interval80Covered:true` and `intervalWidth:0`. The offline settlement importer forwards optional quantile values (`scripts/import-player-forecast-season-settlement.ts:331-339`). Missing `undefined` endpoints become NaN and are skipped, but explicit nulls are falsely scored.

**Fix/test:** reject null/undefined/empty/nonfinite endpoints before numeric conversion and require ordered bounds. Test explicit null, absent endpoint, reversed bounds and genuine `[0,0]`. This does not establish corrupt production settlement rows. Keep this overlap coordinated with the season-forecast work; no part-2 finding is imported here.

## Disposition of the remaining fix recommendations

Every defect recommendation D1–D31, including D4b, is addressed either above or below. “Retain” means source-supported problem/direction, not approved implementation or proven predictive uplift.

| Recommendation | Peer disposition and required test qualification |
|---|---|
| D1 | Correct per PR1. Separate nonoverlapping situation populations; do not mechanically add EN twice or mandate a last-10 target forever. |
| D2 | Retain with PR4: candidate identity, conditional/unconditional/relief populations, complete mass and every admitted reader. |
| D3 | Retain input defect; PR5 gives the descriptive GSAA versus predictive feature distinction and stage-order constraint. Bound/calibrate the mixture, not a chosen coefficient by assertion. |
| D4 | Retain second exposure uplift defect; replace exact 300-minute invariant per PR2. |
| D4b | Confirmed: `run-forge-projections.ts:1108` subtracts the signed handicap. Use margin + home handicap. 3.4−2.6−1.5 = −.7; reverse with +1.5 = +.7. This is an expected-margin edge, not itself a calibrated cover probability. |
| D5 | Retain joint unit/scale/refit fix, PR5. Test monotonicity with matched count/exposure and fixed rates, not arbitrary guaranteed veteran values. |
| D6 | Retain units and as-of defect; include fallback `nst_team_stats` plus all readers, immutable receipt time and explicit PDO units. |
| D7 | Retain one-game/rate-as-sample defect; pooling invariance requires the same eligible window, exposures and weights. A recency-weighted model can legitimately change when dates change. |
| D8 | Model-validation problem; remove or fit unsupported context, but zero mean is not an unconditional mathematical requirement. |
| D9 | Retain cross-model inconsistency; match complete team-goalie GA to non-empty-net skater goals under the same conditioning, PR4. |
| D10 | Retain, narrowly scoped to actual faulty subgates/populations; do not infer whole-gate success from empty Brier. |
| D11 | Correct .95/goal baseline and add a clearly separate full forecast comparator; position priors are a modeling choice. |
| D12 | Retain complete settlement/cohort repair; valid alternative is unconditional scoring on complete opportunities, including confirmed nonstarts and relief. |
| D13 | Qualify: home already enters the skater goal multipliers (`skater-adjustments.ts:388,401`), and `goalie-stage.ts:382` prefers de-vigged market odds when available. Fit residual home effect only for the intended nonmarket model; do not double-count home advantage in market odds. Decision 1 concerns the separate placeholder model, not permission to transplant a home coefficient here. |
| D14 | TOI-only on-ice allocation is a simplification (`skater-stage.ts:2750-2775`), not proof of the reported quintile bias's cause. Test line/on-ice alternatives on a paired holdout with shrunk estimates and team accounting, rather than hard ±5% in every finite sample. |
| D15 | Retain classifier mismatch; one state engine must handle pulled goalies, actual penalties and interval transitions. The existing event rule is not a complete penalty-expiry engine. Test expiration, early goals, coincidental/double-minor cases and OT, not penalty minutes alone. |
| D16 | Null-to-zero ranks confirmed and reproduced (`projectionsRanking.ts:14-25`). Null ranks should remain unknown. Equal-rank versus deterministic tie-break is a rank-policy choice; state competition/dense/tie-break semantics explicitly. |
| D17 | Confirmed and reproduced (`devig.ts:238-242`): +2300 → .0016667, +2400 → .0370370 at assumed .08 overround. Use a continuous monotone assumed-margin model; disclose that one quote cannot identify a fair probability or its true overround. |
| D18 | Retain: averages erase line/book identity (`market-queries.ts:129-138`) contrary to comparator contract (`market-output-builders.ts:373-383`). Pass complete same-book/line pairs and test unavailable under sides, pushes and quote provenance. |
| D19 | Source confirms ratio `tilt_to/tilt_from` (`forgeDailyBridge.ts:351-354`), but “destination tilt alone is correct” requires an explicit neutral/source-adjusted contract. An adjustment model may intentionally use a ratio as an approximation. Test exact versus re-aimed continuity, identity A→A and round trip, and apply any new neutral-to-destination effect consistently. Handoff to RSO; not a validated coefficient correction. |
| D20 | Retain raw implied book percentages (`gameGoalProjections/calculations.ts:188-211`). Pair/de-vig within the same book before consensus, or withhold misleading probability labels; do not substitute the placeholder model. |
| D21 | Retain raw-team-rate pace concern and pooled-skill recommendation. `evaluator.ts:290-296` bypasses multipliers for advanced-v5 primitive targets; identify affected targets before changing all paths. The algebra reducing variance to source variance is redundant, not independently a defect. Add PR8 null-endpoint test. |
| D22 | Prior/evidence fit needs revalidation, not automatic weakening or mandatory age weighting. Multi-season history must have consistent populations/units and approved offline extraction. No backfill or production query authorized by this review. |
| D23 | Reject unreachable/nonempty-tier claims; replace with boundary and predictive-calibration tests, PR6. |
| D24 | Retain horizon semantic inconsistency (`goalie-stage.ts:719-730,820-823`; reserve row `:153-154`). Expected wins/counts can sum over actual games; a probability cannot exceed 1. `1−∏(1−p)` is an independence formula for “at least one,” not a universal substitute. Specify endpoint first; preserve per-game opponent and schedule identity. |
| D25 | Legacy explicitly selected; owner choice and held-out qualification, not flip a default. Test B2B=1 calendar-day gap and replay final outputs, not isolated multipliers. |
| D26 | Prior seasons/age weighting are candidate enhancements; preserve missing-head renormalization and fix post-reconciliation behavior per PR3. The current .4 is an unnormalized share, not the final history weight at every progress point. |
| D27 | Role-based bounds are source-confirmed, but top projected scorer need not have a TOP line role and 16.5-minute D need not be first-pair. Validate role provenance and F/D-specific usage before replacing roles with TOI ranks. |
| D28 | Retain null-actual, trade-team and allocation bugs plus source-drift warning; withdraw claim that fixed baseline bins are absent, PR7. |
| D29 | Inert helpers/imports found by bounded symbol search; no live numeric impact established. Dependency inventory before deletion, as owner directs. |
| D30 | SQL scoreboard population differs (`20261021230025_forge_served_forecast_ledger.sql:80-103`). Its labels explicitly say MAE, so MAE arithmetic is not mislabeled Brier; it is unsuitable as the sole probability qualification measure. Align intended populations or mark legacy. No consumer found in this review's bounded search. |
| D31 | `refresh.ts:146-148` has zero pregame execution slack and lateness compares confirmation to deadline (`:334`). Real positive-duration work will be late; exactly simultaneous completion is not logically late. Fix readiness/deadline contract and test both boundaries. Public v2 route explicitly disabled. |

## Per-entry coverage and disposition (M-FRG prefix omitted)

Source references below are relative to `web/` unless otherwise stated. “Sample unverified” means Fable's production sample was not reread. “Limited” is deliberately not a blanket sound verdict.

| ID | Independent disposition |
|---|---|
| 001 | Ratio and positional reader traced (`forgeDailyBridge.ts:351-354`); replacement needs contract, D19. Matview deployment/refresh unverified. |
| 002 | SQL seconds and cutoff inspected (`supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql:32-45`); assumes null hit/block values mean zero via COALESCE. No production RPC validation. |
| 003 | SQL view inspected; different cohort and MAE explicitly labeled; D30. |
| 004 | Raw market implied percentages, Poisson and tie split source-confirmed (`gameGoalProjections/calculations.ts:32-37,98-105,188-211`); D20. |
| 005 | Bounded symbol search confirms named unused helpers/imports. Inert status is not permanent future safety; D29. |
| 006 | Valid-case game-length algebra and tests pass (`gameLength.ts:44-64`); malformed regular-season multi-OT remains accepted, so sound only within validated input domain. |
| 007 | Reserve semantics, same TOI evidence input and horizon inconsistency source-confirmed (`reserveProjections.ts:52-98,143-156`). Flag default false confirmed; catalog absence only reported. |
| 008 | Bootstrap inspected/executed (`seasonBootstrap.ts:39-125`); PR3 changes final accounting. Predictive improvements from Marcel-like additions unverified. |
| 009 | Date scalar code inspected (`date-utils.ts:41-66`); first gap absent, future schedule lacks type filter (`skater-stage.ts:1281-1287`). Zero-rest unreachable for normalized unique dates; helper de-duplicates before truncating strings, so arbitrary timestamp strings are a separate input-domain caveat. |
| 010 | Null ranks reproduced; 84 constant and selective proration inspected (`projectionsConfig/proration.ts:13-32,61-79`). Historical-season behavior needs season-specific contract. |
| 011 | Paired normalization source-confirmed (`forge/goalies.ts:151-209`); not generic uncertain-start inflation; PR4. |
| 012 | Trade reassignment confirmed; fixed fallback overshoot reproduced (`forge-counterfactual-backtest.ts:425-430,458-487`). Offline only. |
| 013 | Inversion algebra and single global bootstrap weight inspected (`:111-136`); live null-head renormalization is per head (`seasonBootstrap.ts:75-78`). Old conversion reconstruction is not a complete current-stage replay. |
| 014 | Error/MZ/Brier/pair formulas inspected (`servedForecastLedger.ts:332-356,450-466`); population defect confirmed; PR4. |
| 015 | Point scoring summation inspected (`accuracy/fantasyPoints.ts:28-50`); known-value arithmetic sound. Scoring settings and missing-input eligibility remain caller responsibilities. |
| 016 | Wrong start outcome and probability-gate scope source-confirmed (`run-projection-accuracy.ts:1009-1036,1213,2052-2084`); PR7. No production promotion pass inferred. |
| 017 | Paired report sound arithmetic, with RMSE already present (`promotionGates.ts:127-196`); qualification insufficiency distinct from formula correctness. |
| 018 | .95 PP coefficient confirmed (`skater-stage.ts:2823-2826`); conversion ablation versus full-forecast baseline distinction, PR7. |
| 019 | Null actual and issuance defects confirmed; game-cluster bootstrap inspected (`counterfactual-backtest.ts:267,295-319`); fixed baseline bins already exist (`:348-357`). |
| 020 | Brier/log loss, row-weighted game-cluster bootstrap and population separation inspected (`forge-goalie-backtest.ts:157-230,300-369`). In-sample sweep is not out-of-sample qualification. |
| 021 | Paired known-head cohort, MZ and both own/fixed bins inspected (`forge-skater-candidate-ablation.ts:53-106`); unqualified diagnostic labeling is appropriate. |
| 022 | Zero-slack pregame schedule confirmed; tests pass; disabled public route source-confirmed; D31. |
| 023 | Null TOI writer and max-TOI/date selector rechecked (`buildGoalieGameV2.ts:138`; `goalie-queries.ts:113-123`). Retain earlier W1-5 official-start repair, not max-TOI fallback. Calibration sample unverified. |
| 024 | Slot mixture and horizon scalar source-confirmed (`goalie-stage.ts:656-685,804-824`); PR4/D24. |
| 025 | NST unit defect reproduced with in-memory row; latest profiles and unbounded-date fallback confirmed (`team-context-queries.ts:370-450`); PR5. |
| 026 | Nonempty-net shot/goal accounting and null TOI inspected (`buildGoalieGameV2.ts:73-138`); count identity sound for supported events, starter/exposure incomplete. |
| 027 | NB/binomial clean-sheet arithmetic inspected and existing goalie tests passed (`goalieOutcomes.ts:176-198`). .927 credit factor requires empirical validation; slot/horizon semantics separate. |
| 028 | Posterior formula inspected and executed (`goalieModel.ts:127-143`; `goalieOutcomes.ts:56-66`). Sparse history does not mathematically invalidate shrinkage; re-fit quality unproven. |
| 029 | Symmetric Poisson/OT formula inspected (`goalieOutcomes.ts:92-122`); market-first branch and existing small venue term qualify “no home term”; D13. |
| 030 | Season/previous-season pooled-save calculation inspected (`leagueSavePct.ts:28-79`); game-type/coverage limitations remain. Not an independently verified live league baseline. |
| 031 | ELITE reachable, independently reproduced; one-game quality-start lookup confirmed; PR6. |
| 032 | Appearance dates counted as starts (`goalie-queries.ts:174-210`); distinguish naming, workload and credited-start targets. |
| 033 | Baseline/recent/season queries and single quality-start row inspected (`goalie-queries.ts:251-291`); history-depth sample unverified. Recency model choice, not formula proof. |
| 034 | Fixed-.900 and same-day inclusion rechecked (`update-goalie-projections-v2.ts:365-367,431-445`); owner GSAA contract stands. |
| 035 | Same offline goalie evaluation as 020; source checked, no external data rerun. |
| 036 | Pace path, variance identity and skill kernel checked (`evaluator.ts:237-243,290-301`; `settlement.ts:13-62`); advanced target bypass and explicit-null interval defect added. |
| 037 | Default .5 win and ten-start “last5” confirmed (`servedForecastLedger.ts:149-159`); missing completeness scope confirmed; PR4. |
| 038 | Honest partial native goal-accounting disclosure inspected (`nativeGoalAccounting.ts:209-260`), existing tests pass. Unknown EN/OT separation does not prove numerical omission; PR1. |
| 039 | **Limited review, not blanket sound.** Direct count and finite-frame bounds inspected (`nativeDirectConditionalCounts.ts:103-132`; `nativeSkaterParticipationResearch.ts:43-91`). Larger coverage/interval/audit kernels not exhaustively audited here or by Fable. No predictive/public qualification inferred. |
| 040 | Yes-only discontinuity reproduced; focused de-vig tests pass; D17. |
| 041 | Spread sign and quote averaging source-confirmed; comparator tests pass. Actual supplied-price execution not measured. |
| 042 | Latest one-game profile and rate-based “sample” confirmed (`skater-queries.ts:550-605`; `skater-adjustments.ts:170-176`); PR5. |
| 043 | PDO discontinuity and wrong NST units confirmed; distinguish canceled/unused PDO outputs from goal adjustment; PR5. |
| 044 | Weighted unshrunk GSAA then clamp confirmed (`goalie-queries.ts:379-408`; `skater-adjustments.ts:328-340`); sample magnitude unverified. |
| 045 | Legacy schedule mapping inspected (`skater-adjustments.ts:377-408`); calibration choice and cancellation qualifications in PR3/PR5. |
| 046 | Per-game versus total TOI input reproduced; shots component remains accumulated evidence; PR5. |
| 047 | Second physical-exposure uplift source-confirmed; invalid universal budget invariant corrected, PR2. |
| 048 | TOI-based on-ice share and team assist rescale confirmed (`skater-stage.ts:2750-2775`); causal compression attribution not independently measured. |
| 049 | Positive-input rate algebra coherent; zero-shot exposure loss newly identified and reproduced, PR8. |
| 050 | Two goal-rate shrinks confirmed (`skater-stage.ts:2266-2298`); arbitrary compound shrinkage needs evaluation, not automatic deletion. |
| 051 | Latest-game ixG/shot and rate-as-sample confirmed (`skater-adjustments.ts:102-113`); predictive sign/size unverified. |
| 052 | Sampled research count/exposure, assist-capacity and variance kernels inspected (`research/skater-candidates/accounting.ts:13-94`, `priors.ts:67-94`, `context.ts:42-49`). Full researchGoalBaseline pipeline not exhaustively reviewed; do not promote to certified replacement. |
| 053 | Role-label coupling source inspected (`skater-stage.ts:1108-1165`); predictive value remains undetermined. |
| 054 | Scenario role multipliers and candidate selection inspected (`scenario-blending.ts:45-68,134-155`; `skater-stage.ts:2786-2799`). Production rollout value only reported. |
| 055 | Recency function inspected (`skater-stage.ts:884-897`); plausible heuristic, not proof of calibrated dressing probability or complete active pool. |
| 056 | Momentum mapping confirmed (`trend-adjustments.ts:73-85,113-132`); intended sustainability/regression contract remains undetermined. A value outside a band does not by itself prove a required forecast direction. |
| 057 | Player-second team aggregation and PP-percentage reader checked (`buildStrengthTablesV2.ts:395-411`; `splitsServer.ts:676-681,779-780`). The reader needs team-clock versus slot-share semantics; do not “fix” the correctly labeled player-second producer globally. |
| 058 | Event/shift classifier mismatch independently confirmed; interval state held to next event (`shifts.ts:266-289`); PR1/D15. |
| 059 | Intermediate reconciliation algebra checked/tests pass; target semantics and post-bootstrap limitation, PR1–PR3. |
| 060 | Tier bounds source inspected (`skater-stage.ts:1168-1230`); inappropriate provenance or empirical caps need evidence, not role-vs-scoring-rank assumptions. |

## Checks actually run

From `web/`, with Supabase URL/key variables explicitly replaced by inert synthetic values:

`./node_modules/.bin/vitest run lib/projections/goalieModel.test.ts lib/projections/reconcile.test.ts lib/projections/gameLength.test.ts lib/projections/derived/situation.test.ts lib/projections/utils/devig.test.ts lib/projections/utils/market-output-builders.test.ts lib/projections/promotionGates.test.ts lib/projections/nativeGoalAccounting.test.ts lib/forge-v2/refresh.test.ts --reporter=dot`

**Passed: 9 files, 162 tests.** The saved report was also checked for all 60 unique entry dispositions, all 32 defect recommendations (D1–D31 plus D4b), and trailing whitespace. No full application suite, lint, build, production request or stage replay was run. There was no implementation change warranting a full build.

Additional in-memory calls used the actual exported functions and the explicit inputs documented above: `1560` event classification; yes-only +2300/+2400; reachable ELITE; bootstrap 3→3.857142857 shots; evidence weights .6211/.8653; `[120,null,-4]` ranks `[1,2,3]`; null interval→zero-width covered; PP fixed allocation 1400 against 1200; mocked NST 3/3600→.05; zero-shot versus missing history both 6.62. The first second-batch harness stopped after the NST result because its allowlist omitted `node:crypto`; that harness issue was corrected for the subsequent shot-rate call. A PDO fixture with an incorrect argument name was not used as evidence; PDO conclusions above are source inspection.

## Handoff / decisions remaining

1. Specify all-situation fantasy totals and nonoverlapping situation/net-state accounting, without broadening owner decision 7 beyond xG.
2. Choose explicitly between individual goalie conditional/unconditional outputs and a separately labeled team-goalie slot; include relief and candidate completeness.
3. Clarify whether multi-game horizon endpoints remain supported and whether they return counts, per-game probabilities or “at least one” probabilities.
4. Keep rest/scenario/role/assist/coupling changes as separately qualified candidates. No sample percentage here authorizes a coefficient.
5. Obtain a reproducible saved ledger/run extract with issuance/cutoff identity and paired cohorts before relying on Fable's magnitudes. Do not run a fresh broad production scan. Rolling/FORGE persistence holds must be reconciled before any retry or rebuild, per the existing owner notes.

The strongest next implementation package is units and population/identity/settlement correctness with deterministic offline fixtures, followed by a final-output reconciliation check. Refitting follows those prerequisites. This review does not authorize the implementation, production reads, recovery retries or deployment.
