# Independent peer review: W3 FORGE parts 3–4 cross-check

Reviewed 2026-11-11 in the canonical `octoberBranch` checkout. Target: Fable's `audits/forge-projections-part3-4-crosscheck.md`, introduced by **46f4d482d7**, which names **859cfb512** as its source baseline. Inspection began at `2fd0e10528ead57db70112241f8100d276d7cd7c`; the final principal-source check was at `7174249cb7eae7e711039e495c63a990112e22ea`. The eleven principal source paths in the fixture manifest have no committed differences from `859cfb512` and no working-tree changes. Concurrent unrelated work was preserved.

## Result

**Accept the cross-check with qualifications, not its five-new-defect count as five established model failures.** N3's team-shot/assist mismatch and N4's goal-mean scoring mismatch are reproducible research-contract problems. N1 identifies a real latent integration hazard, but its production-wide inertness, double-count claim and proposed statistical remedy require narrower language. N2 is a dormant naming/interpretation concern, not proof that a displayed probability is wrong. N5 is an explicitly unqualified research model choice, not a demonstrated incorrect formula. N6 correctly rejects multiplying reserve shutout probability by a horizon scalar, but does not certify the complete reserve multi-game contract.

**No newly verified current production impact.** No production state was inspected. “Live” below means source-reachable in the normal producer, not a fresh deployment or output attestation. Fable's table counts, empty-market-table claim and absent-reserve-table claim remain dated reported observations.

**Verification:** 237 existing focused tests passed across 13 files, plus 8 new offline audit fixtures. The new fixtures execute the real goalie stage through its final persistence payload, with all DB/RPC access refused, fetch disabled, synthetic cached inputs and mocked persistence. They do not exercise a production write, served HTTP route or frontend.

## 1. N1: retain the integration hazard; separate facts from hypotheses

### What is independently established

- `queries/goalie-queries.ts:174-210` computes a calendar gap from the latest recorded appearance. It neither selects credited starts nor distinguishes a missing history from a verified long rest. `:214-248` reads only the latest WGO row, with `date <= asOfDate`.
- The current producer is game-scoped: `pages/api/v1/db/update-wgo-goalies.ts:636-661,697-706` joins the days-rest response by player/game and copies its bucket values; `:796` requests `isGame=true`, `isAggregate=false` for one date. The per-player path at `:532` is also bounded to one date. This supports the single-game-shape diagnosis; it is not a census of historical stored rows or every writer.
- `calculators/goalie-save-pct-context.ts:48-84` returns zero whenever the selected bucket has fewer than two games. Every synthetic one-game bucket was inert for gaps 0, 1, 2, 3, 4, 15 and null. Final lineup and reserve projection fields were unchanged versus a null profile.
- The live source does not have a separate disabling switch for this term. `stages/goalie-stage.ts:531-544` adds `restAdjustment + .25 * (contextSavePctShift + restSplitAdjustment)`. The value reaches `computeModeledSavePct`, candidate models, the lineup persistence payload (`:804-828`) and conditional reserve rows (`:830-850`). It is therefore **conditional on supplied data**, not permanently unreachable.
- A synthetic eligible profile produced raw adjustment **−.012**, then a **−.003** change in the reserve modeled save percentage. The actual stage's adjusted shot exposure was **29.7**, not the fixture's upstream 30 shots. Final lineup saves changed **26.699 → 26.610**, GA **3.001 → 3.090**, and shutout probability **.0492 → .0451**. These are synthetic integration results, not population estimates.
- Win reach is conditional too. Changing every candidate identically leaves the relative goalie-quality ratio unchanged. In the two-candidate fixture, changing only candidate 100 moved his `team_win_if_starts` **.5000 → .4986** and candidate 101's **.5000 → .5096**; the separate team-game win stayed **.5000**. Do not promise that every save-percent perturbation changes the team win or all win outputs.

### Corrections to the report

1. **“Never fires” / “for every goalie” must remain conditional.** The source and fixture prove zero for profiles whose selected bucket has fewer than two games. They do not prove all relevant production latest rows satisfy that premise. Fable's 319-row sample and bucket counts were not rerun or reconstructed here. A future cumulative input can activate it immediately, as the real-stage fixture demonstrates.
2. **Raw-gap lookup is confirmed; provider semantics are not independently revalidated.** A gap of 1 selects bucket `"1"`; a gap of 0 selects `"0"`. Under the reported provider definition of intervening rest days, that is off by one. Fable's dated gap/bucket cross-tab is the evidence for that provider definition. No provider call was made here. A fix test should pin a verified source receipt/contract rather than silently declaring the synthetic adapter to be provider truth.
3. **Additional latent missingness problem:** `toGoalieRestSplitBucket(null)` returns `"4_plus"`. An otherwise valid cumulative profile can therefore turn unknown rest into a positive long-rest effect. The fixture returns **+.012** raw and shifts reserve modeled save percentage **.8989 → .9019**. Unknown history should remain explicitly unknown/neutral or withheld according to a declared model contract, not be assigned to a measured rest bucket. This is part of N1, not another current production-impact claim.
4. **“Double count” is an overlap risk, not an algebraic impossibility.** The fitted population B2B term is −.003 (`goalie/goalieOutcomes.ts:20-24,69-77`), and the current split is an unresidualized bucket-versus-own-baseline effect. Adding both lacks a documented joint interpretation. But a properly fitted population effect plus a residual individual deviation can be valid. Do not make exclusion of B2B the only acceptable model. Compare jointly fitted/residualized alternatives on frozen held-out final outputs.
5. **The noise argument is illustrative, not a validated threshold.** Approximately .018 is a binomial standard error near p=.9 and 280 independent shots; the variance of this estimator's bucket-minus-overlapping-baseline contrast is different and depends on covariance, shot counts and heterogeneity. Neither “clamp would bind often” nor the choice of a two-game cutoff is established by that calculation. Game-weighted mean-of-game save percentages and pooled save percentage are different estimands; pooled shots/saves is appropriate for a per-shot talent target, but the target and shrinkage must be explicit.
6. **Do not interpret decision 60 as authorization to delete the production rest path.** It calls for retaining the legacy rest treatment until a replacement beats both it and a no-rest baseline after reconciliation. The safe immediate handoff is to prevent an accidental cumulative-profile activation and design an explicit qualified replacement. Same-day `lte` is a point-in-time risk for replays, not proof that a particular issued forecast leaked.

**Disposition:** P2 latent data/contract integration hazard; high confidence in source and synthetic reach, current production prevalence unverified. The helper's output alone is insufficient acceptance evidence; preserve the final-payload and asymmetric-candidate checks.

## 2. N2: formula confirmed; confidence and probability must remain distinct

`utils/market-output-builders.ts:77-90,123,590` indeed stores `min(100, 50 * abs(edge) / threshold)`. At the spread threshold .5 it is 50, at 1.0 it saturates at 100. Probability-space flags override the mean-space score using their own threshold. The field contains neither an outcome probability nor an uncertainty estimate.

The fixture confirms the inherited spread defect in `run-forge-projections.ts:1108`: margin `3.4−2.6=.8` and signed home handicap `−1.5` produce **+2.3 / home-cover / 100** in the existing formula. Correcting the sign in that same legacy mean-space calculation gives **−.7 / away-cover / 70**. That is a useful direction test, **not** the owner-required replacement: decision 30 requires a cover probability against a per-book de-vigged price with the OT settlement convention stated.

Qualify the proposed repair:

- No application reader presenting `confidence_0_to_100` as “50% confident” was found. The schema only bounds it to 0–100. A heuristic confidence/strength score is not automatically a miscalibrated probability merely because its name contains “confidence.” Treat this as an ambiguous dormant contract and promotion gate, not an observed user-facing probability failure.
- The stored value is a **scaled, clipped edge ratio**, not the raw edge-to-threshold ratio. Renaming it literally to `edge_to_threshold_ratio` without changing the value would create another units mismatch. A declared edge-strength score, or a separate actual ratio, would be clearer if retained.
- Do not replace it mechanically with P(outcome wins). Outcome probability, uncertainty that the model-market edge is positive, evidence coverage, and magnitude of the edge answer different questions. Name and validate whichever quantity is wanted; preserve the already explicit probability-comparison metadata.
- Field search found the builder, tests, schema and generated types. `lib/underlying-stats/ulsRouteStatus.ts:109` also reads **table freshness**, not this score. Thus “no application score reader found” is supported; “no application use of the table” would not be. External consumers and current table contents remain unknown. A schema migration is not justified solely by this review.

**Disposition:** retain a P2 dormant labeling/qualification item, coupled to the established spread/market defects. Do not count the spread sign error again as a new W3 defect or say a wrong-way row was actually stored during this review.

## 3. N3–N5: two research-contract issues and one unqualified candidate

### N3 / M-FRG-154: retain

`research/skater-candidates/context.ts:3-8,21-25` permits `shotVolume` only with **team** ownership (home/rest). Yet `:29-35` applies it to the player's shots/goals, not on-ice goals or assists. This is stronger than an imagined unsupported input: the type and runtime validator explicitly admit the team-owned input.

The fixture's neutral values are goals .2 and assists .5. A team-shot multiplier 1.03 gives goals **.206**, assists **.5**, and unchanged on-ice goals **1**. Under the stated team-shot-volume meaning with fixed conversion and assist share, the on-ice goal opportunity should move too. Either propagate that channel coherently or redefine/narrow its contract. Keep skater-specific finishing distinct; it does not imply the same assist uplift. `ablateContexts` inherits this issue. No production importer was established, and no predictive coefficient is validated here.

### N4 / M-FRG-157: retain, limited to the goal mean

`researchGameGoals.ts:328-347` scores team/player GOALS with absolute errors and MAE. It also contains a proper **appearance Brier score**, so “only loss summaries” is too broad. That separate participation score does not qualify the GOALS mean.

For an exact Poisson(.2) fixture (tail summed through 29), forecasting zero yields expected MAE **.2**, while forecasting the true mean yields **.3274923**. Squared error correctly prefers the mean: **.2** versus **.24**. This supports decision 65's mean-score requirement. It does **not** mean MAE always prefers whichever forecast is lower; it targets a median, with the sparse-zero case providing the relevant counterexample.

Add paired goal-mean squared error or valid-distribution deviance/log score on the same folds; retain MAE as secondary. Existing `forecastLift: "not_established"` and `historicalForecastBacktestEligible: false` must remain. Chronological ordering alone does not make late-received retained data historically knowable.

### N5 / M-FRG-160: recategorize, do not prescribe a multiplicative repair

`researchGameGoals.ts:190-193` is a .5/.5 linear pool of own scoring and opponent allowing means by cell. It is an explicitly unfitted research choice (`:304-310`), alongside empirical and smoothed comparators. A linear pool is mathematically legitimate. Fable's **3.5** versus **3.5×3.5/3 = 4.0833** contrasts two model assumptions; it does not establish that 4.0833 is the correct conditional mean. An additive league-centered model would produce yet another answer, 4.0.

Retain **unqualified research candidate / predictive adequacy undetermined**, not a new P2 formula defect. Before promotion, compare properly fitted league-referenced additive, multiplicative or pooled alternatives on common point-in-time folds and proper scores. Do not elevate the multiplicative example to an invariant or an approved coefficient/architecture. This is consistent with prior Astra corrections that declared modelling choices need evidence, not an arithmetic-error label.

## 4. N6: the reserve shutout correction is directionally right, but scoped

`buildReserveGoalieRow` at `reserveProjections.ts:143-158` leaves `proj_shutout_prob` per game while multiplying shot/save/GA counts by the horizon scalar. The fixture with p=.05 and scalar 5 returns saves **135** and probability **.05**, not .25. **Do not “align” it to the lineup's scalar multiplication** (`goalie-stage.ts:820-823`).

However, “reserve is correct; no reserve change is needed” is too broad for the kept multi-game product:

- The current row has a game ID, `horizon_games`, and `conditioning: "if_starts"`; it does not explicitly label that probability's single-game basis in the uncertainty object. A one-game .05, the expected number of shutouts across five identical games (.25), and independent “at least one” probability (`1−.95^5 ≈ .2262191`) are different outputs. Counts can sum; “at least one” requires a joint/dependence assumption. Current opponent/horizon scalars do not establish those assumptions.
- The RSO bridge filters reserve rows to **horizon 1**, both in query and selection (`forgeDailyBridge.ts:419,793`), so this review did not find a currently reachable multi-game reserve-reader failure. Preserve that scope, rather than inventing one.
- The packet's **M-FRG-163 is `buildReserveSkaterRow`**, whose shutout field is null (`reserveProjections.ts:135`). N6 concerns its adjacent goalie builder and upstream M-FRG-007/D24, not new wrong skater-row arithmetic.
- Prior Astra Part 1 D24 already distinguishes summed counts, bounded probabilities and the independence assumption. Carry that correction forward. Fable's reserve correction is useful protection against the wrong fix, not a reversal of Astra's qualified D24 conclusion.

## 5. Remaining coverage and upstream reconciliation

The table covers every ID 121–186. Grouped records share the stated disposition; it does not imply a fresh end-to-end re-audit of inherited W1 findings.

| IDs | Independent disposition |
|---|---|
| 121, 123, 125, 126 | Preserve Part 2's qualified research-model/participation assessment. No new fit/coverage claim. Private helper name matches do not establish consumers. |
| 122, 124, 127 | Scoped mechanics supported: qualification and identity guards, apply participation once; unresolved label stays unknown; schedule/affiliation evidence and shortfalls explicit. No schedule completeness certification. |
| 128, 129 | Preserve prior exchangeability/chronology qualifications and fail-closed mean mismatch. Not unconditional interval coverage guarantees. |
| 130 | N1 above, including latent unknown-rest assignment and final-payload fixtures. |
| 131 | Preserve no non-import caller finding; do not confuse the old helper with the active `goalieRestSavePctAdjustment`. |
| 132, 133, 134 | Preserve candidate-scenario, denominator and game-length upstream dispositions. No new live claim. |
| 135–141 | Scoped interval mechanics supported: strict clock decoding, safe IDs, sorted unique strings, scorer-perspective net/manpower cells, interval union, retained-revision verification. These helpers do not certify the unread full reconciliation pipeline or provider completeness. |
| 142, 143 | Exact rational sensitivity and finite-frame partial identification are supported; outputs explicitly disclaim target probabilities/qualification. |
| 144, 147, 148, 150, 151 | Inherited accounting assessment, not new production reach. Allocation names in unrelated files are not consumers. |
| 145, 146, 149 | Scoped PK-capacity allocation, null-preserving head combination, and per-minute × minute short-handed calculation supported; existing accounting tests pass. |
| 152–154 | Variance identity at 153 is supported; context/ablation at 152/154 inherit retained N3. |
| 155, 156 | Matched count/exposure pooling supported. Split-half tuning remains historical tuning, not independent predictive validation. |
| 157–160 | N4 retained for GOALS; coherent accounting/summary mechanics at 158/159 are distinct from N5's unqualified opponent model. |
| 161, 162 | Preserve scoped fail-closed GOALS baseline and partial-read qualification. Existing module tests passed, but passing tests do not prove external player-season completeness or independently re-audit every unread adapter branch. |
| 163, 164 | Skater row and goalie stage retain upstream population/horizon issues; N1/N6 specify the additional scope. Stage fixtures add final-payload evidence, not production certification. |
| 165 | Empty recent-share denominator returns 0 while pool average returns null. Confirmed operational missingness nit, not a user-facing projection defect. |
| 166 | Preserve upstream final-output, reconciliation/bootstrap, strength-accounting and scenario qualifications; no new whole-skater-stage replay here. |
| 167–169 | Competition-rank/tie mechanics, declared default fantasy scoring and team-score averaging are scoped descriptive calculations. Preserve source missingness and shootout-goal disclosure caveats. |
| 170–174, 176, 179–181 | Preserve Part 2's finite-domain distribution/push arithmetic assessment, common-distribution horizon assumptions and large-mean sampler approximation. Not blanket distribution calibration. |
| 175, 178 | Preserve fallback approximation qualification; default 400-simulation path does not use these functions as its sole quantile law. |
| 177 | Preserve prior TOI-dispersion composition correction; no new duplicate defect. |
| 182, 183 | Finite-domain inverse American-odds and median arithmetic supported; not qualification of synthetic averaged quotes. |
| 184, 185 | N2 above; one field/contract issue, not two independently counted defects. |
| 186 | `win * (decimal − 1) − lose` properly gives zero return for pushes under the stated probabilities/settlement basis. Preserve upstream quote and probability-population concerns. |

All earlier Astra qualifications remain: final outputs may change after reconciliation; 300 skater-minutes is not a universal oracle; goalie slot/individual/relief populations differ; discrete interval overcoverage is not inherently miscalibration; mixture simulation is not one NB; and the pool-guard “fix” must not erase physical-exposure constraints. This cross-check adds no authority to remove persistence holds, activate research, enable markets or perform migrations.

## 6. Reproducibility, limits and handoff

Artifacts beside this report:

- `w3-forge-projections-part3-4-crosscheck-fixtures.test.ts`: eight synthetic assertions and the real-stage fixture runner adapted from the existing goalie pipeline test.
- `w3-forge-projections-part3-4-crosscheck-vitest.config.cjs`: isolated node test config; uses the canonical checkout's installed Vitest and a local source alias.
- `w3-forge-projections-part3-4-crosscheck-fixtures.log` and `.json`: final output, exact fixture results, source commit/blob manifest and limitations.
- `w3-forge-projections-part3-4-crosscheck-tests.log`: 13 existing focused files, **237 passed**.
- `...-fixtures-first-run.log` / `...-fixtures-second-run.log`: two corrected fixture assumptions, not application fixes. The first assumed upstream 30 shots survived the stage instead of its emitted 29.7. The second tried to demonstrate relative candidate-win movement with a single-goalie override, whose ratio correctly cancels; the final test uses two candidates. Both corrections are retained for transparency.

Run the audit fixtures from repository root:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key ./web/node_modules/.bin/vitest run --config tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/w3-forge-projections-part3-4-crosscheck-vitest.config.cjs --reporter=verbose
```

Existing tests run from `web/` with the same three inert variables and `FORGE_RESERVE_PASS_ENABLED=false`: `lib/projections/goalieModel.test.ts`, `goaliePipeline.test.ts`, `goalie/goalieOutcomes.test.ts`, `reserveProjections.test.ts`, `utils/market-output-builders.test.ts`, `researchGameGoals.test.ts`, `researchGoalBaseline.test.ts`, `nativeIntervalReconciliation.test.ts`, `nativeSkaterParticipationResearch.test.ts`, `research/skater-candidates/{accounting,context,priors}.test.ts`, and `lib/forge-v2/schedule.test.ts`.

No DB read/write, provider request, cron, migration, source modification, commit, push or deployment was performed. No full application suite, typecheck, lint, build, historical calibration or live API/UI test was run; this is an artifact-only review. Test imports and synthetic caches do not certify runtime feature flags or available production data.

**Handoff:** first prevent accidental N1 activation while its units, missingness and joint rest model are unresolved. Keep market fixes grouped behind decision 30. Repair the two research-contract issues before promoting their candidates. Keep N5 in the model-comparison backlog, not a mandatory multiplicative “bug fix.” Keep per-game reserve shutout probability, and specify the multi-game endpoint/reader contract before declaring the horizon work complete. No implementation is authorized by this report.
