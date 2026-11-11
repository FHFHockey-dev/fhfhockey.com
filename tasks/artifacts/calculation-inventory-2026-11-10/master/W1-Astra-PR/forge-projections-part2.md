# Astra peer review: W1-7 FORGE projections, part 2

2026-11-11. Independent review of Fable audit commit `37106e4aba5f72de978b20658dca0aefd0a62296`, whose stated source baseline is `bc60b18a6`. Reviewed in the canonical `octoberBranch` checkout on Tim's Mac; initial review HEAD `fbceea028f71737b2d55745b9556f96ebe1d26aa`. Paths below are relative to `web/` unless explicitly prefixed otherwise.

## Decision and evidence boundary

**Accept the inventory and many concrete defects, with material corrections before using the remedies as an implementation specification.** All 60 entries and all 18 recommendations are addressed below. Fable's 30 sound / 18 mis-specified / 12 wrong totals are its classifications, not independently certified correctness counts. Several entries combine correct arithmetic, unsupported model choices, and conditional defects; these should not be reduced to a blanket “sound” verdict.

Read the W1-7 prompt and packet, owner decisions, Batch A consolidation, and the related [Part 1 peer review](forge-projections-part1.md). Existing changes were preserved. This task wrote only this review, with no application edits, commits, database reads, provider calls, endpoint execution, builds, or deployments. The inspected projection/research source paths showed no diff from Fable's stated baseline at the initial comparison; unrelated repository work continued during the review.

**Evidence classes:** “reproduced” means actual pure source functions or source-isolated functions executed on synthetic inputs. “Source-confirmed” means code traced, not production behavior observed. All production samples, table counts, rollout settings and population magnitudes in Fable remain **reported only**. In particular, 1,835 skater-games, 66 goalie rows, the 12-row goalie run, 152 game predictions, and empty market tables were not reread and must retain their dates and limitations. No empirical holdout was performed here.

### Highest-priority changes to the reading

1. **Discrete p10/p90 is a valid quantile label.** Inclusive coverage above 80% is expected and does not prove miscalibration. The fixed hit-rate gate and unsupported exact-80% interpretation need repair; the name need not automatically be abandoned.
2. **Do not replace the simulator with one Poisson/NB distribution as a numerical-only fix.** It includes scenario and TOI mixtures. Identical full inputs are already deterministic. There are, however, two additional conditional defects: pre-bootstrap scenarios can override final means, and zero own-goal means erase positive assist uncertainty.
3. **Reject the proposed pool-guard replacement as written.** It can violate the individual-TOI safety constraint. The 15-to-14 cliff is real, but its replacement must address missing players and feasible exposure, not simply inflate the target.
4. **Do not call conditional or dated paths live P0s without evidence.** Tweet effects require published matching events; market dormancy is a dated observation; Start Chart depends on serving paths; FORGE v2 is explicitly disabled.
5. **Carry Part 1's corrections through the duplicate entries.** Final bootstrap output is not necessarily reconciled to the intermediate target, the comparator reports RMSE as well as MAE, and an empty Brier subgate passing is not the entire launch gate passing.

## Additional findings

### N1. Candidate intervals can describe pre-bootstrap means rather than the serialized forecast

**P1, conditional on candidate scenario mode and a nontrivial season bootstrap; M-FRG-066, 103–110.** The stage constructs `scenarioBlend` at `lib/projections/stages/skater-stage.ts:2776-2785`, selects its point line, then changes goals, assists, shots and peripherals with `bootstrapSkaterLine` at `:2811-2821`. It passes the changed point line to uncertainty at `:2837-2848`, but passes the *old* scenario goal/assist lines at `:2852-2862`. The simulator prefers those scenario values over the base values (`lib/projections/uncertainty.ts:265-284,323-328`). Thus bootstrap can change the displayed mean while candidate uncertainty continues to describe the older mean. Baseline mode does not supply that scenario mixture (`lib/projections/skaterRollout.ts:30-35`).

**Reproduced:** with final ES goal and assist means both 1, the pure uncertainty function gives G and A bands `[0,1,2]`. Supplying a weight-1 stale scenario with both means 0.1 gives G `[0,0,1]` and A `[0,0,0]`. This proves the override, not its current production frequency. Source tracing establishes the stage can construct precisely this mismatch in kind; the fixture is not a whole-stage replay.

**Fix/test:** apply the same bootstrap/final-output transformation to each scenario and recompute its weighted mean, or produce a newly specified distribution around the final line. Verify scenario-weighted means against every final serialized head, including mixed prior coverage and changed ES/PP splits. Do not just add a wider interval to hide the mismatch. Keep candidate mode gated until its corrected distribution is evaluated.

### N2. A positive assist forecast collapses to a zero distribution when own-goal mean is zero

**P1 boundary defect, production prevalence unmeasured; M-FRG-066.** `lib/projections/uncertainty.ts:362-369` returns an assist mean of zero whenever the player's corresponding own-goal mean is zero. A player can assist without having a positive own-goal projection. The stage's assist model itself uses on-ice team goals, not the player's own goals (`skater-stage.ts:2750-2775`).

**Reproduced:** 1 expected ES assist, 0 expected own goals and positive shot/TOI inputs returns A `[0,0,0]`. Changing only the own-goal mean to 0.001 returns A `[0,1,2]`. The API accepts both input states. Current rate floors make many ordinary organic lines positive, so this is not evidence that every live assist band is affected.

**Fix/test:** scale assists directly by the intended shared exposure or a coherent team-goal process; do not divide through a player's own-goal mean. Test positive assists with zero own goals, zero own shots, PP-only assists, and zero exposure. Check simulated expectations against input means, not just quantile ordering.

### N3. The TOI-conditional dispersion fit does not have a generally unbiased n/(n−1) correction

**P2 offline methodology; M-FRG-069.** The unconditional sample-variance correction is reasonable under its within-player-season assumptions, and the NNLS arithmetic is correct. But the separate TOI-conditional SQL estimates a rate from the same observations, then multiplies residual SSE by `n/(n−1)` (`scripts/fit-forge-dispersion.ts:58-74`). That correction is not exact for unequal exposures and heteroskedastic counts.

For independent Poisson counts with true means `r*T_i`, define `w_i=T_i/sum(T)` and `M=sum(r*T_i)`. With fitted `r_hat=sum(Y)/sum(T)`, direct covariance expansion gives `E[RSS] = M*(1-sum(w_i^2))`, not universally `M*(n-1)/n`. For 20 games with ten exposures of 1 and ten of 3 at rate 1, `M=40`, `E[RSS]=37.5`; the current adjusted excess is `37.5*20/19 - 40 = -0.526315789`, despite true zero overdispersion. This is a mathematical counterexample computed offline, not a measured bias in the saved coefficients.

**Fix/test:** qualify the estimator as approximate or use an exposure-aware likelihood/moment correction that accounts for the fitted rate and the assumed variance function. Validate recovery using synthetic unequal-exposure Poisson and NB player-seasons before refitting. Saved offline inputs and an approved extraction are prerequisites; do not run the report's embedded SQL against production to validate this.

### N4. Residual TOI variances only approximately add back to the desired variance

**P2 small numerical-method correction; M-FRG-066.** `uncertainty.ts:762-771` uses residual squared CV `c_r²=max(0,c_fit²-c_sim²)`, then compounds it with independently simulated TOI. Multiplicative noise compounds as `(1+c_r²)*(1+c_sim²)-1`, adding the cross-term `c_r²*c_sim²`. Fable's claim that they add up exactly is false. With F SOG, ES 1,000 s and PP 200 s, actual source helpers give target quadratic coefficient `0.0247` versus nested-compound `0.024829668788580245` (linear coefficient `0.0458` unchanged). This small discrepancy cannot explain the reported ten-point coverage gap.

**Fix/test:** if matching that target remains the intended model, use a multiplicatively consistent residual, `(1+c_fit²)/(1+c_sim²)-1`, when nonnegative, and explicitly handle simulation variance already above the target. Preserve the distinction between conditional and unconditional fits. Test recovered moments across exposures and horizons, with Monte Carlo tolerance where sampling is used.

## Statistical and semantic corrections

### C1. Quantile coverage, determinism and the proposed exact-distribution replacement

For the standard left inverse CDF, `q_p=min{x:F(x)>=p}`, an inclusive integer band has probability `F(q_0.9)-F(q_0.1-1) >= 0.8`. It can be much larger because boundary atoms cannot be divided. **Reproduced using `countCdf`/`summarizeCountDistribution`:** Poisson mean 0.17 has quantiles `[0,0,1]` and inclusive coverage **0.9870878354**. Those are correct 10th/50th/90th percentiles. For finite integer left-quantiles, the inclusive boundary atoms make the population coverage strictly greater than .8; this is a property of the quantile convention, not a faulty p10/p90 label. There is no universal 86–99% range, and finite-sample coverage need not obey the population bound.

Therefore, skater hit rates of 91–96% neither prove bad intervals nor prove the model is calibrated. Fable's representative means do not establish the model-implied coverage of the actual 1,835-row cohort. Compare each issued predictive CDF with its own outcome, retain lower/upper misses, and use randomized PIT plus proper scores and cohort-specific calibration diagnostics. A global PIT histogram alone is not proof of conditional calibration.

`uncertainty.ts:34-52,234-256,640-652` seeds the draws from inputs. The same **complete** inputs returned byte-identical bands in the fixture. Finite-sample quantile error remains, and changing another input changes the seed; “same mean” alone cannot require identical quantiles when the mixture or variance changes. `sqrt(.9*.1/400)=.015` describes empirical-CDF probability-scale SD near a fixed quantile, not a universal ±1.5-point confidence interval or count-scale quantile error.

The existing exact PMF is Poisson/NB, while the simulator mixes scenarios, exposure and count draws (`:313-399,682-719`). A mixture is generally not the single NB having its mean and variance. Replace simulation only by a distribution-preserving mixture/convolution/quadrature calculation, or explicitly version and validate the model change. `samplePoisson` itself uses a rounded normal approximation at means ≥30 (`:63-77`), so “exact sampling” is also too strong. Volatility padding of quantiles (`:102-114`) is not itself a calibrated new predictive distribution; changing variance first is a candidate improvement, not automatically the same model.

### C2. Goalie coverage and individual-versus-slot identity

Fable's 47/66 saves coverage (71.2%) is reported from seven days, not independently reproduced. If one *illustratively* assumes 66 independent trials with a known null coverage of .81, the null SE is .04829 and the gap is about **2.03**, not 1.8, SE; a 95% Wilson interval for 47/66 is approximately **[.594,.807]**. These are **not a valid significance test here**: the .81 came from representative means, rows share dates/games, and the scored population is already mismatched. Retain this as an alarm, not measured proof of undercoverage.

The incumbent stage passes `{negativeBinomial:true, position:"G"}` but not `jointGoalieCounts` (`goalie-stage.ts:738-749`). A coherent conditional-binomial option already exists (`uncertainty.ts:588-624,712-715`) and has tests. It is an opt-in candidate, not the current served model. Poisson GA conditional on shots allows GA>SA; the variance excess relative to binomial depends on the scoring probability and shot variance, not a universal 10%. The candidate must be evaluated, not rediscovered or silently enabled.

Scoring only credited starters is necessary for a **start-conditioned individual** forecast, but not sufficient to validate a **team-slot/full-game** forecast. Starters can be pulled and relievers face shots. Either model each identified goalie's conditional workload/relief and score that target, or compare a labeled full-team goalie-slot distribution to the matching aggregated team-goalie outcomes. Do not sum in empty-net goals against no goalie. Public win fields require the same explicit population choice; relabeling the pair-normalized value as team win is an interim option only after checking the underlying slot-to-team assumptions.

### C3. The pool-guard cliff is confirmed; removing its cap is not a complete fix

**Reproduced:** PP share .085 gives target 18,000 for 15/18 skaters, 7,809 for 14, and 1,800 even for zero in the helper (`scenario-blending.ts:421-479`). The zero case exposes a helper-domain oddity, not a proven persisted empty-team row.

`floor(2100/blendedTopShare)` is a conservative bound using an allowed maximum share, not an arithmetic mistake merely because the actual maximum is smaller. Fable's `min(18000,n*1200)` gives 16,800 for 14 players, which at the same allowed combined top share .2689 permits **4,517.52 seconds** for a player, beyond the intended 2,100-second cap. Its alternative `18000*n/18` gives 14,000, contradicting the proposed test “14 skaters at least 16,000.”

Choose how an incomplete roster is represented, preserve unknown/unmodeled exposure, and enforce individual caps in the actual allocation. Prefer a completeness gate or constrained allocator with explicit infeasibility over inflating the remaining players. Derive team skater-seconds from manpower/duration when claiming all-situation accounting; 18,000 is a regulation five-skater approximation, not a universal truth. Part 1's post-bootstrap reconciliation qualification still applies.

### C4. Reachability, population and labeling corrections

- **Roster tweets:** publication is an explicit DB route branch (`pages/api/v1/db/tweet-pattern-review.ts:1084-1102`). The translator and consumer defects are reproduced, but frequency/current user impact is unknown. A multiplier of zero causes `continue`, omitting the row (`skater-stage.ts:2351`), not necessarily a literal persisted zero line. The Monday-23:00 fixture expires Wednesday-05:00; a date-only reader can apply it Wednesday because it tests midnight (`preflight-stage.ts:142`). Monday effect also requires issuance after the event is available. A game-specific status model must honor effective time, receipt/decision time and superseding evidence.
- **“No look-ahead”:** `.lt(date,asOfDate)` proves a prior game-date filter, not historical knowledge-time correctness for backfilled data. The official PP usage query has no first-received bound (`team-context-queries.ts:105-134`).
- **Start Chart multi-game TOI:** the helper rejects totals above 65 minutes, not every multi-game row. More importantly, the actual projection query and selector enforce horizon 1 (`pages/api/v1/start-chart.ts:887,940`). The claimed live multi-game defect in 083 is not established.
- **B2B mixture mass:** the helper explicitly preserves lost mass as unresolved (`goalieStarterMixtures.ts:165-168`). This is not automatically a defect requiring redistribution into certainty, and the observed Start Chart caller supplies no B2B arguments (`start-chart.ts:1539-1542`). Keep the real four-decimal-overflow bug separate.
- **Holdout report:** `promotionGates.ts:127-196` emits MAE, RMSE and both deltas. The separate shadow-improvement helper is MAE-only. Thirty rows and no interval do not establish model qualification, but do not erase existing RMSE.
- **Launch gate:** probability subgates use daily accumulators under `_30d` names; the saves/GA error gates read `rolling_30d`, the sample-count gate can fail, and empty interval coverage fails (`run-projection-accuracy.ts:985-1067,1213`). Do not report “an empty sample passes” as whole-gate behavior.
- **FORGE v2:** the API literal is disabled and the page returns `notFound` (`pages/api/v2/forge/[operation].ts:5`; `pages/forge/v2/index.tsx:5-7`). Ungated historical accountability arithmetic is not automatically improper: unqualified models can legitimately be evaluated if the result is labeled research, not served qualification. The public-context boundary and any future release need explicit evidence-class and scope rules (`api.server.ts:128-146`).

## Recommendation-by-recommendation disposition

| Fable defect | Independent disposition and required test correction |
|---|---|
| D1 | Retain duplicate physical exposure defect. Apply all-situation exposure once; use Part 1's manpower accounting and post-bootstrap qualifications. The reported +12.5%/+4.0% are not an independent ablation or universal inflation. |
| D2 | Retain scratch/injury conflation and missing-role defaults. `SCRATCH` currently yields a confidence-dependent multiplier, so renaming alone does not implement “no game contribution.” A new game-bound event contract needs writer, schema/types, reader and supersession coverage. Indefinite injury until a RETURN tweet is not automatically safe when evidence stops; distinguish confirmed ongoing absence from stale/unknown status. Do not execute the proposed DB count in this review. |
| D3 | Retain saturated bars, wrong riser ordering and fallback trend direction. The 50+16.7z mapping is an arbitrary presentation choice, not a percentile or an owner-approved calibration. Label the axis. Prefer actual history; a synthetic three-point line must not masquerade as observations, and CTPI history must not be labeled power history. |
| D4 | Retain individual/slot/team ambiguity with C2. The one-row case already skips normalization (`goalies.ts:172`), so “never rescale one row” is existing behavior, not a new fix. Ensure the same semantic scale for paired and orphan rows. |
| D5 | Rewrite using C1–C2 and N1–N2. Preserve mixture semantics, distinguish exact quantiles from calibrated coverage, fix population before scoring. Test identical complete inputs, not mean alone; assess PIT with a specified statistical tolerance and stratification. Do not automatically substitute the existing marginal NB helper. |
| D6 | Retain wrong signed spread and same-book quote identity defect. Fixture Poisson regulation P(home−away>1.5)=.3808092742; swapping means and +1.5 gives the complementary .6191907258, not the same probability. Neither number alone determines a value flag: a .38 model probability can still be attractive at a lower fair market probability. Test price-dependent expected edge, push/void rules and exact settlement rules. Do not blindly add EN/OT means already present; reconcile nonoverlapping goal definitions first. |
| D7 | Reject replacement/test as written; use C3. Enforce actual individual bounds, completeness and modeled residual exposure together. Smoothness is not a substitute for a feasible roster. |
| D8 | Retain unit bug and known zero. Fix both normalizers: `skater-stage.ts:333-341` and the actually used query-local copy at `queries/skater-queries.ts:142-147,529-532`. A last-five prior and 15-row exclusion are modeling/data-quality choices, not proven fixes; validate completeness from the roster/game contract, not just row count. |
| D9 | Retain rounded excess fixture. With four-decimal inputs, a pure rounding envelope is about n×.00005 plus floating tolerance, not an arbitrary n×.001. Resolve upstream floors separately; .975+.0205+.01=1.0055 is not mere four-decimal roundoff. Do not normalize unknown/subunit mass or conflicting confirmed identities into certainty. Test those cases alongside the benign overflow. |
| D10 | Retain inconsistent shot populations, not an exact unconditional equality as written. Sum goalie SA matches opponent SOG **at a goalie**; empty-net SOG and individual relief change the comparison. Use the final skater output, not its pre-bootstrap target. Fitting/drop decisions need held-out evidence; “mean bias within ±1%” is not a sample-size-free statistical invariant. A nonzero baseline rest intercept can be legitimate in a jointly fitted model. |
| D11 | Retain zero-allocation/nonzero-PP-count inconsistency. Also handle zero old PP TOI becoming positive, missing rate separately from known zero, and the final shot reconciler. Test the final serialized row, not allocation alone. |
| D12 | Retain misleading ES/non-PP label. Renaming needs every consumer/schema checked. Conservation applies to the declared complete exposure; PK need not be >0 in every game. Neither an all-game positive-PK test nor a universal 18,000-second equality is valid. |
| D13 | Retain non-exact diagnostic attribution. The existing components take absolute values (`run-projection-accuracy.ts:1996-2002,2255-2259`), so even the two goalie factors do not necessarily sum to absolute error. Specify signed residual convention and a complete feature set before Shapley or ordered decomposition. Zero-shot assists/peripherals and offsetting factor changes must reconstruct the signed error. |
| D14 | Retain inconsistent L3 meaning and PP positive-exposure check. Shared definitions need not force every analytic bucket to equal a usage model's category, but any intentional crosswalk must be explicit. Missing PP TOI is not confirmed zero. |
| D15 | Reclassify as model proposals, not established coefficient fixes. Role instability may affect mean and variance; newly promoted mean need not always exceed an earlier-role forecast. Fit participation separately, state conditionality, and test it is applied once. Current compute mode deliberately uses 0/1 availability for conditional production. |
| D16 | Retain multi-game probability/count contract defect, fixing writer and metadata together. Choose expected wins, per-game win probability, or at-least-one win explicitly; do not use `1-product(1-p)` without the independence assumption. |
| D17 | Retain mixed-unit score/unclear “accuracy” labeling and hard-coded league size. MAE and bias are not bounded; `1-loss/baseline_loss` skill can be arbitrarily negative and is undefined for zero baseline loss. Replace “score is bounded” with formula, unit, zero-baseline and finite-input tests. |
| D18 | Retain scaling/support and different-head-population risks as research concerns. Standardization fitted on training only or declared commensurate features is appropriate; ESS is a useful diagnostic, not complete support/coverage proof. Nonmonotone bin calibration is not mathematically invalid per se. Preserve fail-closed joint-mean checks instead of loosening tolerance. Apply future public qualification to claimed public outputs; allow explicitly labeled research accountability. |

## Per-entry coverage (M-FRG prefix omitted)

These are independent dispositions with scoped evidence, not deployment certification. “Conditional” means an input, flag or contract dependency remains; “research” is not a served defect.

| ID | Independent disposition and source |
|---|---|
| 061 | **Retain wrong units/zero-PP-shots edge.** Official PP share is internally consistent as a fraction of all skater-seconds; `team-context-queries.ts:137-173`, `skater-stage.ts:2527-2577`. Unknown-to-zero PP inputs and incomplete team-game coverage prevent blanket data validity. Fix both allocation and downstream reconciliation. |
| 062 | **Confirmed cliff; remedy rejected.** Pure helper reproduced, `scenario-blending.ts:421-479`; C3. Canonical target is an approximation, not verified full-game exposure. |
| 063 | **Retain wrong units, qualify prior criticism.** Both 45-second normalizers return 2,700; query later clamps PP to 1,200 (`skater-queries.ts:142-147,497-532`). Latest one-game choice is source-confirmed. “Prior” need not universally mean a multi-game Marcel average. |
| 064 | **Model choice, not established predictive defect.** Continuity summary and .70–1.05 multiplier traced at `skater-stage.ts:747-806`; downstream `:2347-2360`. Reconciliation can redistribute its effects, but “only share” is not unconditional after later bootstrap. |
| 065 | **Sound on stated finite nonnegative domain; qualify exactness.** PMF/quantile/push formulas inspected and tests passed (`uncertainty.ts:782-937`). Horizon alpha requires iid/common-distribution game assumptions (`dispersion.ts:145-170`), not arbitrary unequal future games. Sampler has large-mean approximation. |
| 066 | **Needs correction; N1/N2 additional defects.** Seeded mixture simulation, padded quantiles and assist conditional traced/executed (`uncertainty.ts:234-454`). Discrete overcoverage is not inherently wrong. Residual-variance claim qualified by N4. |
| 067 | **Simplified model; predictive adequacy undetermined.** This is a Poisson conditional on random TOI, so marginal variance is already above the mean (`uncertainty.ts:528-560`). Fable's “no over-dispersion” is false literally; no fitted residual count dispersion is used. Fixed reconciled expected TOI does not imply actual team exposure is deterministic. |
| 068 | **Retain population/shot-accounting concerns; qualify sampling.** Incumbent Poisson GA and opt-in binomial distinguished (`uncertainty.ts:588-733`; `goalie-stage.ts:738-749`). Coverage sample unverified, C2. |
| 069 | **Limited offline soundness; N3 corrects methodology.** NNLS and score formulas inspected (`fit-forge-dispersion.ts:177-245`); SQL/date/TOI caveats remain (`:32-74,78-85`). Holdout bin-mean scores do not validate per-issued FORGE distributions. |
| 070 | **Sound scoped arithmetic, not predictive qualification.** CRPS, proper interval score, log-score state and mixture moments traced (`horizonEvaluation.ts:134-168`); focused tests passed. Bootstrap explicitly warns it is approximate; two blocks do not provide credible population inference (`:292-328`). |
| 071 | **Research adequacy undetermined.** Gaussian common bandwidth/raw count support source-confirmed (`model.ts:112-124`; `participation.ts:28-41`), but input scaling and fitted value need evidence. Chronology checked; no new leak established. Nonmonotone calibrated bins alone do not prove a defect. |
| 072 | **Sound within pinned-input point-baseline contract.** Count-family matched exposures, half-life weights and pooled prior inspected (`researchBaselines.ts:52-115`); model tests passed. Not a qualified serving replacement. |
| 073 | **Sound conditional rank arithmetic.** Tail ranks and union-bound explanation hold under exchangeability with a fixed independent fit (`forge-v2/uncertainty.ts:99-120`). Actual chronology/hockey time-series dependence does not supply exchangeability; code explicitly disclaims that guarantee. Focused tests passed. |
| 074 | **Retain display defects, conditional data availability.** Bar clipping, power-ranked risers and synthetic spark traced (`TeamPowerTerminal.tsx:78-93,125-145`). Hot/cold composite uses selected available ranking categories (`HotColdCard.tsx:237-298`); not a universal calibrated trust measure. |
| 075 | **Sound scoped display arithmetic.** Sweep line and opacity inspected (`ForgeV2/ForecastExplorer.tsx:17-33,73`); adjacent/gap semantics labeled. Public page disabled. |
| 076 | **Retain wrong mapping/default-role semantics, conditional publication.** Translator executed (`rosterEvents.ts:75-177`), source publication traced (`tweet-pattern-review.ts:1084-1102`), consumer expiry `preflight-stage.ts:142`. No prevalence measured; C4/D2. |
| 077 | **Retain latent horizon semantic defect.** Raw top-two sum correct (`projection-metadata-builders.ts:297-301`); probability multiplied by horizon scalar at `:454-460`. Does not affect horizon 1 by that mechanism. |
| 078 | **Pipeline map, not a numerical correctness verdict.** `rollingForgePipeline.ts:48-200` lists order/dependencies. Upstream holds and starter-outcome issues remain separate. No pipeline executed. |
| 079 | **Retain diagnostic decomposition mismatch.** Zero-shot assist endpoint and absolute-value components source-confirmed (`run-projection-accuracy.ts:1948-2002,2246-2259`). Even without starter add-on, opposing signed contributions need not add as absolute values. |
| 080 | **Retain units/window/coverage-gate defects with narrower scope.** `run-projection-accuracy.ts:985-1067,1213,1963-1966`; C1–C2/C4. Fixed-.900 comparator is a conversion ablation, not independent whole-forecast baseline. |
| 081 | **Retain incorrect implied PP-role buckets.** Zero/null exposure still assigned PP1/PP2 by rank (`run-projection-accuracy.ts:587-599`). Source-confirmed; production frequency unmeasured. |
| 082 | **Sound stated gating arithmetic, policy not empirically validated.** Freshness queries/counters inspected (`run-projection-v2.ts:200-250,638-684`). Bypass path exists at `:559-572`; idle-team freshness can block with no source defect. No live preflight executed. |
| 083 | **Withdraw claimed live multi-game failure.** Helper source at `start-chart.ts:749-765`; all-null returns null and invalid inputs reject. Query/selector require horizon 1 (`:887,940`). A 30-minute two-game sum would not reject anyway. Partial null interpretation needs the non-PP/PK contract. |
| 084 | **Retain misleading score units/label, not boundedness axiom.** `ProjectionSourceAnalysis.tsx:234-237,316-323,397-401`; D17. MAE/RMSE/skill are replacements with their own well-defined unbounded domains. |
| 085 | **Retain wrong start population and empty probability subgates.** `run-projection-accuracy.ts:2078-2084,1190-1213`; appearance is not credited start. Missing mass, invalid p and unknown outcome must not be clamped into valid evidence. |
| 086 | **Duplicate 079.** No second independent defect count; same signed-vs-absolute and zero-shot issue. |
| 087 | **Sound scoped retention/pair checks; population not certified.** Pregame clocks and three-four-decimal tolerance inspected (`scripts/forge-ledger-evaluate.ts:15-63`); same known outcomes/head-specific pairs (`servedForecastLedger.ts:447-505`). Complete opportunities/selection issues remain Part 1. |
| 088 | **Fail-closed mismatch, not a floating tolerance bug.** Different per-head versus complete-case support (`model.ts:120`; `forge-v2/uncertainty.ts:53,161-164`) can withhold intervals. Choose a coherent joint/head model rather than relaxing tolerance. Research-only. |
| 089 | **Limited sound operational arithmetic.** Counts/latencies/settlement and explicit `readyForActivation:false` inspected (`forge-v2/operations.ts:22-102`); bounded caller search found test use. No operational rollout verified. |
| 090 | **Research/public-policy distinction required.** Qualification checks at `qualification.ts:43-87`; accountability can evaluate raw means (`evaluation.ts:173`, `api.server.ts:137-146`). Not a demonstrated current public bypass with the literal route disabled. |
| 091 | **Sound for complete unique descriptive rows.** Known-count pooled SV% and GAA, all-game starter-label check inspected (`goalieWorkload.ts:61-117`). Distinct recorded games are not certified schedule completeness; callers must validate page coverage/duplicates. |
| 092 | **Retain conditional roundoff overflow; reject automatic B2B redistribution.** `[.6001,.3001,.0999]` reproduced as all zero (`goalieStarterMixtures.ts:143-168`). Pure rounding bounds and unknown mass are separate, D9. |
| 093 | **Retain source mismatch; coefficient adequacy undetermined.** Context formula at `goalie-stage.ts:296-364` includes the +.03 when rest >=2. A normal-state intercept is not intrinsically wrong; compare shared definitions and final outputs before changing coefficients. |
| 094 | **Retain slot/team/individual labeling issue.** Pair normalization at `forge/goalies.ts:151-209`; one-row skip already exists. The six pairs/0.984 production sample was not rerun. |
| 095 | **Retain wrong sign, dormant only as reported.** `run-forge-projections.ts:1069,1108-1117`; corrected Poisson fixture reproduced. Price availability/current consumer activity unverified; D6. |
| 096 | **Sound rank arithmetic with inherited input defect.** Tie-averaged percentiles at `start-chart.ts:715-745`; slate-only population at `:1528-1530`. Null-to-zero/input-model issues from W1-4 not cured by correct rank arithmetic. |
| 097 | **Conditional heuristic/participation mismatch.** `preflight-stage.ts:41-69`; compute-mode switch and zero-row omission at `skater-stage.ts:2332-2351`. Source distinguishes conditional production; no production flag value read. |
| 098 | **Retain inconsistent role crosswalk; thresholds are choices.** Event/default versus lineup tags `skater-stage.ts:595-650`; accuracy buckets `run-projection-accuracy.ts:616-621`. Recency values need validation, not automatic wrong-math classification. |
| 099 | **Sound finite-input mean.** `team-context-queries.ts:24-30` excludes null/nonfinite values. No assertion that callers supply a representative or complete sample. |
| 100 | **Sound mean formula, limited data validity.** `team-context-queries.ts:161-173`; player means use appearances with rows, not all team opportunities. Missing PP values were coalesced earlier, and the bad seconds heuristic remains. |
| 101 | **Arithmetic sound; MAE-only claim corrected.** Paired eligible rows and MAE/RMSE deltas inspected (`promotionGates.ts:154-196`), tests passed. Diagnostic ready status is not promotion qualification. |
| 102 | **Sound finite-input MAE/RMSE arithmetic.** `promotionGates.ts:127-145`; no-sample returns null. Caller/domain and cohort checks remain necessary. |
| 103 | **Intermediate equality only.** Team assist factor 1.65 at `skater-stage.ts:2753-2775`; candidate role and season bootstrap can change final assists (`:2776-2821`). Do not certify final output as exactly 1.65 per ES goal. |
| 104 | **Same qualification as 103.** Intermediate PP factor 1.91; later transforms can change final ratio. Final-output accounting needs explicit validation. |
| 105 | **Retain double physical exposure.** `skater-stage.ts:2806-2809`; Part 1 fixes target semantics and bootstrap qualification. Reused reported magnitude is not independently measured. |
| 106 | **Intermediate goals=shots×rate, final ratio conditional.** `skater-stage.ts:2772,2801-2821`; bootstrap and candidate can alter final goals. Team final totals do sum final player means (`:2830-2835`), but that is distinct from the claimed conversion identity. |
| 107 | **Same as 106 for PP**, with 061's zero-time PP shots inherited. No blanket final-output soundness. |
| 108 | **Same defect as 105 for hits.** No separate mechanism or independently reproduced population bias. |
| 109 | **Intermediate shot target only.** Reconciliation `reconcile.ts:133-146`; final bootstrap at `skater-stage.ts:2811-2821` can change target totals. Part 1 PR3 applies. |
| 110 | **Same as 109 for PP**, plus zero-TOI allocation and bootstrap re-split cases. |
| 111 | **Retain non-PP mislabeled ES.** All-situation target less PP at `skater-stage.ts:2526-2533`; PK null at `:3213-3215`. Exact PK sample share is unverified; D12. |
| 112 | **Sound horizon-1 integer allocator, qualify final horizons.** Largest-remainder scheme inspected (`reconcile.ts:34-63`). Serializer independently rounds scaled player values (`skater-stage.ts:3213-3214`), so exact integer equality need not survive multigame scaling. |
| 113 | **Sound scoped FP-only aggregation.** `forge-v2/evaluation.ts:230-240` exposes strata and dependent-observation warning; not qualified serving accuracy by itself. |
| 114 | **Sound bias convention.** Forecast−actual and mean at `evaluation.ts:176,183`; tests passed. UI should explain sign, not invert it. |
| 115 | **Sound conditional settlement on stated inputs.** Identity/clock/revision guards `evaluation.ts:157-178`; official-appearance filter is intentional conditional target. Research qualification and actual publication admission remain separate. |
| 116 | **Sound scoped error/proper-score formulas.** Duplicate rejection, strata, paired outcomes and interval score `evaluation.ts:186-225`; tests passed. No independence claim. |
| 117 | **Sound metric formula with denominator caveat.** `horizonEvaluation.ts:240-268` mixes requested kinds into per-head missing counts unless callers stratify. Expose eligible-versus-not-applicable denominators before treating missingness as data quality. |
| 118 | **Sound explicit calendar contract.** Frozen boundary sums and ratio-of-totals at `horizonEvaluation.ts:122-131`; horizons are calendar windows anchored at issue, not a freshly rolling next-H selector. Focused tests passed. |
| 119 | **Sound linear scoring.** `forge-v2/identity.ts:28-40`; only missing nonzero-weight heads withhold. A missing zero-weight PIM head does not withhold, qualifying Fable's blanket “missing head” statement. |
| 120 | **Sound finite seven-weight identity.** `identity.ts:22-28`; identity includes normalized weights/rule version. This is not qualification of a user's scoring profile or model. |

## Checks and reproducibility

**Passed:** 9 focused Vitest files, 100 tests. Run from `web/` with Supabase URL/key environment values explicitly replaced by inert synthetic values:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key ./node_modules/.bin/vitest run lib/projections/uncertainty.test.ts lib/projections/dispersion.test.ts lib/projections/rosterEvents.test.ts lib/projections/goalieStarterMixtures.test.ts lib/projections/promotionGates.test.ts lib/forge-v2/uncertainty.test.ts lib/forge-v2/model.test.ts lib/forge-v2/evaluation.test.ts lib/forge-v2/horizonEvaluation.test.ts --reporter=dot
```

These are synthetic correctness checks, not a whole-pipeline replay, historical calibration, production configuration check or full application suite. No lint/full build was warranted by this document-only task. The initial scratch harness stopped after the uncertainty examples because its import allowlist omitted `lib/predictions/rollingWindows`; that pure constants dependency was inspected and allowed for the subsequent guard/roster/roundoff calls. This was a harness restriction, not an application failure or external access attempt.

### Re-run the principal new interval fixtures without services or filesystem writes

Run this from `web/`; it loads only the two pure files shown and rejects all other imports. The full synthetic inputs are retained here rather than relying on an unsaved script or DB extract.

```sh
node <<'NODE'
const fs = require('fs'), path = require('path');
const vm = require('vm'), ts = require('typescript');
const allowed = new Set(['lib/projections/uncertainty.ts', 'lib/projections/dispersion.ts']);
const cache = new Map();
function load(file) {
  if (!allowed.has(file)) throw Error('Import outside pure allowlist: ' + file);
  if (cache.has(file)) return cache.get(file);
  const m = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(js, { module: m, exports: m.exports,
    require: id => load(path.normalize(path.join(path.dirname(file), id)) + '.ts') },
    { filename: file });
  cache.set(file, m.exports);
  return m.exports;
}
const u = load('lib/projections/uncertainty.ts');
const d = load('lib/projections/dispersion.ts');
const x = { toiEsSeconds: 1000, toiPpSeconds: 200, shotsEs: 2, shotsPp: .5,
  goalsEs: .17, goalsPp: .08, assistsEs: .2, assistsPp: .06, hits: 1, blocks: 1 };
console.log('Poisson .17', u.summarizeCountDistribution(.17).quantiles, u.countCdf(1, .17));
console.log('Same complete inputs', JSON.stringify(u.buildPlayerUncertainty(x)) ===
  JSON.stringify(u.buildPlayerUncertainty(x)));
for (const goalsEs of [0, .001]) console.log('Own G', goalsEs,
  u.buildPlayerUncertainty({ ...x, goalsEs, goalsPp: 0, assistsEs: 1, assistsPp: 0 }).a);
const final = { ...x, goalsEs: 1, goalsPp: 0, assistsEs: 1, assistsPp: 0 };
const stale = [{ weight: 1, goalsEs: .1, goalsPp: 0, assistsEs: .1,
  assistsPp: 0, shotsEs: 2, shotsPp: .5 }];
for (const scenarios of [undefined, stale]) {
  const band = u.buildPlayerUncertainty(final, 1, undefined, scenarios);
  console.log('Scenario override', Boolean(scenarios), band.g, band.a);
}
const cv = u.playerToiCv(1000, 200), fit = d.getDispersionFit('sog', 'F');
console.log('Target coefficients', d.compoundToiDispersion(fit.toiConditional, Math.sqrt(fit.toiCv2)));
console.log('Actual nested coefficients', d.compoundToiDispersion(
  d.compoundToiDispersion(fit.toiConditional, Math.sqrt(fit.toiCv2 - cv * cv)), cv));
const hp = u.countPmf(3.4), ap = u.countPmf(2.6);
let cover = 0;
for (let h = 0; h < hp.length; h++) for (let a = 0; a < ap.length; a++)
  if (h - a > 1.5) cover += hp[h] * ap[a];
console.log('Regulation cover / swapped +1.5', cover, 1 - cover);
NODE
```

Other executed inputs are specified completely in the findings: pool guard `{canonicalTargetSeconds:18000, ppShare:.085, projectedSkaterCount:18|15|14|0}`; three distinct unconfirmed candidates with probabilities `.6001/.3001/.0999`; reviewed SCRATCHES and LINEUP assignments at `2026-11-09T23:00:00.000Z`, player/team 1, no role payload; both source normalizers with numeric 45. The normalizer and role tests isolated their original function declarations and used the same finite-number helper; they did not initialize any DB client.

## Handoff

Prioritize unit adapters, final-output identity/accounting, and explicit event/forecast populations before coefficient changes or refits. Freeze the reported sample manifest and actual issued distributions before using Fable's coverage rates to set thresholds. Keep unknown starter/roster mass unknown, keep FORGE v2 disabled, and preserve the existing persistence holds. The review recommends work; it does not authorize implementation, extraction, retries, publication or deployment.

Review checkpoints: source/contract pass; conditional-path and statistical corrections; actual offline counterexamples; 100 passing focused tests; final 60-entry/18-remedy and whitespace validation. No unresolved tooling blocker remains.
