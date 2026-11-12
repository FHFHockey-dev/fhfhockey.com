# Independent peer review: W3 season forecasts, parts 4–5

Reviewed 2026-11-11 on `octoberBranch` in the canonical checkout. Target: Fable's [cross-check](../audits/player-forecasts-season-part4-5-crosscheck.md), commit `8d95393baa`. Starting HEAD: `ef9fc5f547fb99d6aef920e1fdb586c91c73ac4c`. The inspected application paths have no diff from the audited commit. This is a separate addendum, not an edit to Fable's report or a certification of its verdict totals.

Read with the part-4/5 packets, [owner rules](../RULES-DIGEST.md), relevant full owner decisions, and upstream Astra reviews [W1](player-forecasts-season.md), [W2 part 2](w2-player-forecasts-season-part2.md), and [W2 part 3](w2-player-forecasts-season-part3.md).

## Assessment

**Keep the goalie-pace, duplicate improper-score, missing-total and final-output concerns. Repair the handoff before implementation: v5 is not protected from endpoint recombination, the Python/TypeScript advanced-assist variances already diverge, and null handling is broken in the transport readers as well as the calculator.**

Most consequential corrections:

1. **F4's “v5 season bands … are not affected” is false at publication.** Actual `effectivePlayer` with no overrides widened the synthetic v5 POINTS interval by **34.1%**. Both event recomputation and publication overwrite joint-derived quantiles with arithmetic on marginal endpoints.
2. **The twins need more than synchronized edits.** The Python v5 overlay reconstructs expected-assist variance from an already clipped interval; the TypeScript overlay preserves the source mixture variance. One same-input fixture gives **0.1753829136 versus 0.3456**, despite identical per-game endpoints.
3. **Returning `missingKeys` only from `fantasyProjectionTotal` cannot fix completeness.** Full readers coerce explicit null to zero, and the compact transport fills absent categories with zero before the calculator sees them.
4. **F7's main score defect reproduces.** Its log-loss claim needs correction: the scorer already clips probabilities. There are separate defects in probability validity, null interval scoring, and allocation of current-season adjustments.
5. **F1 reproduces in both languages.** Two complementary .5 goalie-win forecasts become .6 each at pace 1.2. Removing pace is necessary for this counterexample but does not prove the coupled goalie outcome system coherent or calibrated.

No currently served P0 established. P1 below means a blocker before activating the relevant release or claiming its accuracy, not evidence of wrong production numbers today.

## Evidence and reach

- **Executed:** actual pure TypeScript modules; AST-selected unchanged helper functions from `seasonJobs.ts`, `admin.ts`, and `queries.ts`; AST-selected Python season functions and the nested v5 `game_rows` producer. Synthetic inputs only. Network transports blocked; no DB/service modules imported into fixtures.
- **Source evidence:** page access requires an active pointer and matching release (`web/lib/fantasy-projections/queries.ts:98-120`). Event recomputation additionally requires that release's validated source run (`seasonJobs.ts:604-629`). Publication is a separate path through `admin.ts:313-420,537`.
- **Reported only:** Fable's exact-zero counts on four production tables. No retained query results are independently reproduced here. They support its dated inactive snapshot, not a guarantee about current deployment, external consumers, or all helpers under a directory. No production tables, environment flags, job triggers or providers were queried.
- **Interpretation:** season findings are conditional activation issues on the reported dormant snapshot; native receipt wording is separately conditional. The 67 named heads remain empirically unqualified. A passed synthetic invariant is not trained-model performance or calibration evidence.

Paths below are under `web/lib/fantasy-projections/` unless stated otherwise. Python paths are under `modeling/player_forecasts/`.

## PR1 · Preserve joint quantiles through the final publication path

**F4 / M-PFC-249, 251, 252, 253. New final-reader finding; P1 before calibrated-band claims.**

The marginal-endpoint mechanism is confirmed: `contracts.ts:632-634` reconciles each level separately, so POINTS p10 becomes the sum of G/A1/A2 p10 values. However `aggregateSeasonGames` using the v5 simulation is only an intermediate step:

- `seasonJobs.ts:977-996` calls the aggregator, optionally adds actuals, then **always** calls `reconcileProjectionQuantiles` again. Current-view `addActuals` itself calls `reconcileProjectionValues` on each level (`:392-405`), so removing only line 996 is insufficient.
- `admin.ts:370-382` performs the same endpoint reconciliation when building a release player, **even when overrides is empty**. `:410-412` supplies the resulting endpoints to the stored release.
- `queries.ts:362-365` reads those endpoints; `web/pages/fantasy-projections.tsx:262-280,1732-1737` displays them as 10th-to-90th-percentile intervals.

**Executed diagnostic:** three synthetic primitives each have mean 100 and variance 1, with an advanced target selecting the v5 branch. One-game aggregate, installed algorithm's 256 draws:

| Stage | POINTS p10 | p50 | p90 |
|---|---:|---:|---:|
| Per-game marginal recombination | 296.1553453035 | 300 | 303.8446546965 |
| v5 aggregate joint simulation | 297.6554757466 | 300.1277165224 | 303.3064534040 |
| Event helper recombination | 296.5809152949 | 300.1092361858 | 304.1584713240 |
| Actual publication helper, no overrides | 296.5809152949 | 300.1092361858 | 304.1584713240 |

Published width is 1.3409283 times the simulated width, with `adjusted=false`. Means of 100 are intentionally non-hockey diagnostic values keeping nonnegative clamps inactive. This is a mechanism counterexample, not a prevalence or empirical-coverage claim.

**Qualify the size argument:** 1.7321 versus independent components and 1.2752 versus equal-variance normal components with correlation .4225 are correct analytic ratios for an *unclamped three-component sum*. They are not universal errors for every band. Shared participation, unequal variances, marginal truncation, reconciliation and actual covariance matter. The .4225 loading is among target draws, not a fitted statement about every per-game covariance.

Saves are **not a three-component sum**: `contracts.ts:688-701` uses SA-low minus GA-high and SA-high minus GA-low. For synthetic SA=100, GA=10 and unit variances, it emits [87.436896869,92.563103131]. This is a cross-bound difference construction, corresponding to extremal negative dependence in the unclamped normal case, not the positive comonotonic sum argument. EV endpoints likewise need their own difference/joint treatment. Do not apply the sum's 1.28–1.73 range indiscriminately.

**Remedy/acceptance:** carry the chosen joint distribution or its derived quantiles through event recomputation, actuals addition, editor adjustments and publication. Known actuals shift primitive draws before recomputing ratios; a ratio interval cannot be shifted like a count. Define what an editor change means for the joint distribution rather than silently rebuilding from endpoints. Add a no-override release round-trip test asserting that approved joint-derived endpoints survive, plus current/ROS, nonzero actuals, editor, sparse-count, saves and EV fixtures. Test the final release payload/UI contract. Retain the explicit **uncalibrated** label and prospective evidence requirement in decision 39.

### Goalie pace: retain F1, strengthen its acceptance condition

The catch-all multiplier scales WINS, LOSSES, OTL, SHUTOUTS and QUALITY_STARTS in both `evaluator.ts:281-352` and `season.py:4090-4138`. The fixture sets every opponent-quality/venue term neutral and both teams' pace to 1.2. With certain appearance/start, each goalie's .5 win mean becomes .6, shutouts .05 become .06, and one goalie's W/L/OTL .5/.3/.2 become .6/.36/.24. Both the game-wide win mass and the player's decision mass exceed their possible total. This is direct incoherence, not an argument from a merely correlated historical pace/shutout relationship.

Keep opponent/event modelling qualified under decisions 38, 46 and 63. A contextual-only multiplier can still produce invalid probabilities or incompatible independently fitted team/goalie outcomes; Fable's proposed `sum wins ≤1` does not follow from removing pace for arbitrary priors. Test complementary valid priors under home/away and rest changes, both teams and all candidate goalies, start/relief/appearance bases, and no-decision mass. Do not silently normalize away unknown candidates. The artificial test establishes the mechanism only; the audit's ±35% bound relies on the canonical producer's clipped team contexts, not a bound enforced by the evaluator for every accepted artifact.

## PR2 · Twin inventory is right, but advanced variance parity already fails

**F2/F3 / M-PFC-185–201, 251–253. Confirmed twin coverage plus new mismatch; P1 activation work.**

Two base-goalie fixtures, neutral and pace 1.2, give identical TypeScript/Python conditional means, unconditional means, baselines, variances and quantiles. This confirms those inspected twins, not every contract or fallback branch.

The v5 expected-assist overlay is different:

- TypeScript `mergeAdvancedSeasonArtifact`, `evaluator.ts:225-247`, carries the source conditional variance into the expected-assist alias; the evaluator then rebuilds the mixture variance.
- Python `advanced.py:1982-2006` copies the original assist endpoints, then reconstructs variance as `((high-low)/(2*z))²`. A lower bound already clipped to zero destroys the information needed for that inverse calculation.

**Executed actual Python `game_rows` and TS merge/evaluate fixture:** conditional A1=.4, conditional variance=.4, appearance=.8. Original unconditional mean=.32, variance=.3456, interval=[0,1.0733953795]. Both aliases retain that interval, but Python stores variance **.1753829136**, TS **.3456**. The Python aggregate accumulates the smaller value (`advanced.py:2014-2015`). The difference is therefore hidden by a per-game endpoint-only parity test and can change later horizon uncertainty.

Retain the upstream C17 finding with W1's qualifications: `evaluator.ts:234` really has `max(rate,residual80²)`, but the claimed ~90% coverage is the residual-dominated, unclamped normal illustration, not measured behavior of every target. Retain the .65 factor-loading/.4225 correlation correction and the separate cross-game independence assumption. The target copula does not solve common player/availability uncertainty across games.

**F3 needs a narrower variance-scaling statement.** Multiplying variance by m² is exact for the deterministic transformation mY. Changing a count intensity does not universally imply that transformation: Poisson variance grows linearly; an NB or calibrated residual model needs its own mean–dispersion relation. Do not prescribe “all residual variances ×m²” without a model contract.

There is a precise extra defect in the missing-variance fallback in **both** evaluators: the fallback `abs(conditional)` already contains m and is then multiplied by m again (`evaluator.ts:454-458`; `season.py:4381-4385`). With unadjusted GOALS mean=1, m=1.2, p=1, omitted variance produces **mean 1.2, variance 1.44**; explicit Poisson base variance=1 produces **variance 1.2**. This refutes the unconditional claim that the current branch is exact for a Poisson fallback. It does not prove omitted variances are normal canonical producer output.

**Remedy/acceptance:** carry explicit moments, never infer them from clipped endpoints. Specify source conditioning, alias identity and approved variance scaling in both languages. Preserve Bernoulli GP/GS variance safeguards from Astra part-3 PR8. Expand golden vectors to alias/clipped tails, missing moments, participation below 1, advanced overlays, context and final aggregates; identify which sampling seed/order/quantile convention must match rather than treating Monte Carlo differences as rounding. No missing scale or variance should silently become a calibrated-looking result.

## PR3 · Missingness must survive readers before totals can disclose it

**F6/F2 / M-PFC-248 and related heads. Retain and expand; P1 activation blocker.**

`fantasyProjectionTotal` really returns 3 for values `{GOALS:1}` with weights `{GOALS:3,FACEOFFS_WON:.1}`. A declared-but-absent SH_GOALS rate becomes zero in evaluation; a missing advanced rate and policy produce EXPECTED_GOALS=0 without a fallback flag in the accepted-input fixture. Valid explicitly modelled priors can be supported, but absence is not itself a verified zero or qualified prior.

**Correct F6's example:** faceoffs are already v3 primitives (`contracts.ts:44-45`). A normal v3 line does not omit them by contract; their fabricated source zeros are the separately proven ingestion issue from Astra part-2 PR1. TAKEAWAYS is a proper example of a v4 category absent from v3. The faceoff fixture remains a valid reduced/malformed-line counterexample, not canonical-v3 proof.

A calculator-only `{total,missingKeys}` change is insufficient:

- `admin.ts:72-77` and `queries.ts:33-38` call `Number(raw)`; **explicit null becomes 0**.
- The summary loader constructs a union of metric keys (`queries.ts:207-217`), then `mapPlayerSummary` maps missing per-row values through `summaryNumber` (`:303`, helper `:41-43`), which returns zero.
- `expandFantasyProjectionSummary`, `contracts.ts:370-372`, independently applies `Number(values[index] ?? 0)`.
- The interval display's `Number.isFinite(Number(...))` also treats null endpoints as finite (`fantasy-projections.tsx:270`).

**Executed transport round trip:** `{GOALS:1,TAKEAWAYS:null}`, with metric keys also containing absent FACEOFFS_WON, expands to `{GOALS:1,TAKEAWAYS:0,FACEOFFS_WON:0}`. After that, missing-key detection cannot recover the lost distinction.

**Remedy/acceptance:** version a nullable/support-aware representation through evaluator, reconciliation, stored/release values, full and compact readers, totals, table sorting and compare/detail display. Check only categories with nonzero valid scoring weights for required support; zero weight does not make a total incomplete. Validate invalid scoring weights separately. Include genuine zero, missing key, explicit null, unsupported v3/v4 category, zero-weight absence, positive and negative scoring weights, full/compact round trips, and a genuine zero-appearance outcome. Do not label a subtotal complete or rank unknowns as negative/zero value. Preserve the prior reviewed producer and settlement missingness remedies.

## PR4 · Keep the improper skill-score finding; correct probability and coverage claims

**F7 / M-PFC-258–259. Confirmed score defect, corrected mechanism and added null case; P1 before accuracy claims.**

The actual season scorer reproduces Astra part-2's Poisson(.2) example, baseline .19, probabilities summed through outcome 19:

| Forecast | Expected MAE | Expected squared error | Expected current skill index |
|---|---:|---:|---:|
| 0 | .2000000 | .2400000 | 88.9262829 |
| true mean .2 | .3274923 | .2000000 | 47.9512483 |

The clipped per-row absolute-error ratio (`settlement.ts:13-19,29-41`) is unsuitable as the primary mean score. Retain squared error or a valid distribution's proper score, same basis/population, and aggregate losses before normalizing against a common baseline. MAE can stay secondary. An actual=forecast=baseline zero produces 50, not 100. Zero baseline aggregate loss is unavailable for relative skill, not an epsilon-derived score.

**Correction:** log loss already calls `clippedProbability` (`:9-10,43-55`). F7's claim that an adjusted probability is unbounded “before log loss” is false. Invalid raw probabilities are still accepted: forecast=1.2, actual=1 yields Brier=.04 using 1.2, while log loss is approximately 1e-15 after clipping to almost 1. The score family is then evaluating inconsistent forecasts. Reject or mark unsupported an invalid probability before scoring; epsilon clipping should only protect logs for legitimate 0/1 probabilities, not legitimize 1.2. Test an honest Bernoulli(.9) forecast against an overconfident 1.0 with expected proper loss; that is not a claim that any one realized game must prefer .9.

**New null-endpoint defect:** `finite(null)` is zero (`:4-6`). Actual=forecast=baseline=0 with explicit null p10/p90 records **interval80Covered=true, intervalWidth=0**. Omitting both keys records no interval. Missing bounds must not fabricate a perfect [0,0] interval. Add null, absent, nonfinite and reversed bounds tests, plus legitimate [0,0].

The existing inclusive interval check is mathematically correct for a closed displayed interval. A Poisson(.2) interval [0,.77] covers P(Y=0)=.81873; discrete overcoverage is not itself a scoring bug. Distinguish exact/discrete coverage, randomized residual-boundary diagnostics and a claim of calibrated 80% equal-tailed endpoints. Keep decision 39's real evidence requirement.

## PR5 · Adjustment allocation needs the actual forecast horizon, not an expected-GP surrogate

**F7 / M-PFC-257–258. Confirmed fallback plus additional current-view mismatch; P1 for published accountability.**

`allocateSeasonTotalAdjustment` is algebraically conserving only when its denominator is the sum of the same game forecasts being adjusted (or its fallback denominator is the count/declared weights of those games). The importer supplies `releasePlayer.base_values[target]` and `base_values.GAMES_PLAYED` (`web/scripts/import-player-forecast-season-settlement.ts:325-329`).

- **Confirmed F7 fixture:** zero model total, delta=1, 82 scheduled components but expected GP=60 allocates **1.3666667** in total.
- **Additional source-to-helper case:** current-view aggregates include actuals (`seasonJobs.ts:983-986`), and publication copies those values into `base_values` (`admin.ts:323-326,408`). Game outputs contain only remaining evaluations (`seasonJobs.ts:944-975`). With 10 actual goals + 10 future one-goal means, base total=20 and delta=4, the importer allocates only **2** across those ten future games. The delta cannot be apportioned using a denominator containing already-realized actuals.
- The importer passes the **same original model per-game bounds** to model and published scores (`:331-339`). With changed means, those are not demonstrated published-forecast intervals. Defining the adjustment only at a season total does not identify a new per-game distribution.

These are synthetic/schema-lineage defects, not evidence of historical adjusted releases or their size. Preserve issued evidence rather than regenerating a supposedly issued per-game forecast after outcomes are known.

**Remedy/acceptance:** persist the allocation rule, eligible component manifest, remaining-model denominator and issuance-time adjusted per-game forecast/distribution, or explicitly withhold unsupported published per-game metrics. Enforce valid event bounds/coherence. Test conservation on opening/ROS/current views, nonzero actuals, zero baseline, partial participation, uneven means, signed PLUS_MINUS, new roster members and corrected outcomes. Scoring-version changes and any historical resettlement are distinct steps; resettlement requires approval.

## PR6 · EV replacement and newcomer/team heuristics need qualified claims

**F5 / M-PFC-206–208, 250. Retain the fitted-versus-served validation gap, conditional on the complete strength family.** `contracts.ts:516-548` runs only when all twelve strength keys are present. Complete fixture EV=10, PP=3, SH=1, EN=1, total=14 yields EV=9; omit one required key and EV remains 10. Thus “never reaches output” is too broad for every supported/reduced input, though true of the complete canonical reconciliation path when the total is supplied. Raw EV variance remains in metadata, but that does not mean its uncertainty is faithfully served: endpoint and per-draw reconciliation overwrite EV too. A variance=25 fixture retains metadata 25 while EV endpoints are reconstructed from total/non-EV components.

Keep total/component authority explicit, evaluate the **final reconciled head**, and disclose how frequently scaling/clamps bind. A new contract may mark EV derived, but do not remove existing heads or policy/history evidence in place. Test complete/reduced schema, absent total, conflicting components, clamps and final variance/distribution consistency. “Input lost” and clamp telemetry are useful acceptance requirements, not new owner choices.

**F8 / M-PFC-254–255. Arithmetic confirmed; replacement remains a model choice.** Actual newcomer prior on SH rates {0,0,0,.02,.04} produces zero rather than cohort arithmetic mean .012. An all-missing named target also becomes zero. The F4=.65/other=.35 constants survive with `confidence=0`, and the detail renderer displays their percentages without checking that confidence (`fantasy-projections.tsx:1721-1727`). Preserve fallback flags and honest missingness. But a cohort mean is not proved to be the correct expectation for a particular new player: cohort membership, age, league, role, exposure and selection matter. Mean/median replacement, .25 participation quantile and ×2.25 dispersion must be fitted/qualified or visibly labelled a heuristic prior. Do not present .012 as an empirically validated newcomer prediction.

**F9 / M-PFC-256. Sorting mechanism confirmed; two qualifications.** A zero-play-probability top-TOI forward stays on the first line. Tied PP/PK scores use stable order from `[...forwards,...defense]`, not a global total-TOI ordering: a 1500-second defenseman stays after 1300/1000-second forwards in the executed tie fixture. There is no universal NHL PP rule requiring a defenseman; absence of a position constraint alone is not a mathematical defect. The issue is presenting an ice-time order as inferred line combinations or PP/PK units without evidence. Define whether these are season-role estimates or today's availability before selecting a play-probability threshold; an injured season player is not necessarily excluded for the entire horizon. Rename or withhold unsupported units, with explicit availability and tie behavior.

## Other entries and retained safeguards

- **F3 team/advanced descriptions:** confirmed. Advanced skater targets bypass context (`evaluator.ts:290-297`); team rows copy the Python source's values during TS event work (`seasonJobs.ts:1066-1088`). TEAM_PACE is `(CF+CA)/2` per team-game (`advanced.py:1285-1290,2171`), whereas other team targets are rate × games. Keep units explicit and don't call these participation-integrated player heads.
- **F10 / 264:** confirmed statically. The roster-observation wrapper filters only the fresh-eligibility string (`web/lib/player-forecasts/modeledGoalieParticipation.ts:212-224`), retaining the frozen Sep29–Oct12 label from `:173`. Correct the successor method's limitations; preserve issued receipts. No new receipt or native serving activation was performed.
- **260/261:** retain the narrowly sound helper assessment. `gameContract.ts:435-467` validates same versions/player identity and explicit unique ordered games, propagates a null component, and delegates ratios to `:415-431`, which labels ratio-of-expectations and converts seconds to minutes. This is not an assertion that the research contract is deployed.
- **262/263:** retain upstream eligible-opportunity/unknown-label safeguards and statistical qualifications. No new calibration or current reach certification.

## Packet disposition, without inflating defect counts

All 84 entries are accounted for below. “Retain upstream” means no contradictory evidence found in this bounded cross-check, not a new independent calibration verdict.

| Entries | Disposition |
|---|---|
| 181,183 | Retain source/basis and goalie identity safeguards upstream; pace/variance qualifications PR1–2. |
| 182,184 | F1 confirmed in both languages; coupled-outcome remedy still required. |
| 185,188–201 | TS twin and support inventory retained; PR2–3, including advanced variance/source contracts. |
| 186–187 | Retain observed-assist alias naming concern; add executed TS/Python variance mismatch PR2. |
| 202–205 | Retain producer-proved EN/strength issues from Astra part-2 PR1; no fresh source prevalence claim. |
| 206–208 | F5 qualified by complete-family gate and final-output variance behavior, PR6. |
| 209–214 | Retain unqualified fitted heads/venue findings upstream; don't infer live accuracy. |
| 215–223 | Retain strength/TOI/faceoff producer and algebra qualifications; faceoffs are v3 primitives. |
| 224–238 | Retain upstream participation, units and primitive-head safeguards; PR2–3 preserve missingness and moments. |
| 239–247 | Team-copy description corrected; TEAM_PACE unit inspected; no empirical model qualification. |
| 248 | F6 confirmed and reader inventory expanded, PR3. |
| 249 | F4 confirmed; withdraw v5 final-output exemption, PR1. |
| 250 | Retain unknown/ratio/outcome safeguards; qualify EV replacement, PR6. |
| 251–253 | Twin coverage retained; final publication, alias moments and missing-variance cases added, PR1–2. |
| 254–256 | Heuristics reproduced; preserve labels/provenance and qualify prescriptions, PR6. |
| 257 | Allocation conservation limited to the actual component universe; current view added, PR5. |
| 258–259 | Improper primary score confirmed; log clipping corrected, missing intervals added, PR4–5. |
| 260–261 | Narrow helper soundness retained, research reach. |
| 262–263 | Retain upstream conditional participation assessment; no new empirical evidence. |
| 264 | Label defect retained, conditional reach. |

## Fix-agent handoff

1. **Evaluator/contract/reader lane:** jointly own `evaluator.ts`, `contracts.ts`, Python `season.py`/`advanced.py`, event quantiles in `seasonJobs.ts`, and publication `effectivePlayer`. Preserve moments and joint endpoints through every final reader, maintain correct role/participation semantics, and validate finite probability/moment invariants. Changing only the upstream simulator is not enough. Remove unjustified goalie pace only as part of a versioned coherent outcome treatment; do not replace goalie wins with team wins or change appearance-conditioned rates to per-start silently.
2. **Missingness/UI lane:** coordinate nullable/support contracts with `admin.numericRecord`, full/compact query readers, expansion, scoring total and page table/sort/compare/detail/interval readers. Decide which visible subtotal is useful, not whether missing equals zero. Keep proven source-field ingestion issues in scope separately. A tagged qualified prior is different from filling a hole with zero.
3. **Accountability lane:** unify correct scoring semantics across both settlement modules, retain proper component losses, fix missing intervals and probability validity, and specify issuance-time allocation. Include the importer's current/ROS population and band use. Version new scoring rather than rewriting historical meaning.
4. **Presentation/native-label lane:** honest newcomer priors, role-order labels, and successor roster-observation limitations. Do not invent a hard PP positional rule or a universally optimal newcomer mean/availability threshold.

The relevant owner decisions already settle proper scoring, unknown preservation, native non-activation and calibration evidence (38,39,41,46–48,63,65,78). No immediate owner question is needed to establish these defects. A product choice about showing a clearly labelled newcomer prior or withholding it can wait for a concrete qualified design. Cross-player/team outcome coherence requires the stated event universe; removing pace alone does not prove `sum wins ≤1` for arbitrary independent baseline priors. Keep native preview permissions denied. No production action, deployment, import, provider call, activation or repair is authorized by this review.

## Reproduction and verification

Artifacts beside this report:

- [`w3-season-part45-peer-fixtures.cjs`](w3-season-part45-peer-fixtures.cjs): actual TS functions, guarded offline harness and assertions.
- [`w3-season-part45-peer-fixtures.py`](w3-season-part45-peer-fixtures.py): actual Python AST extraction, including v5 game-row transformation; fake in-memory input stream only.
- [`w3-season-part45-peer-fixtures.json`](w3-season-part45-peer-fixtures.json): full synthetic results and SHA-256 hashes for inspected core sources.

From the repository root, with the already-installed web dependencies:

```sh
node tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/w3-season-part45-peer-fixtures.cjs
```

**Passed:** all retained fixture assertions; base TS/Python parity for the two stated goalie inputs; actual v5 publication, advanced-alias, missingness transport, settlement, allocation, EV/newcomer/deployment checks; no diff in reviewed implementation paths from `8d95393baa`; report/fixture diff inspection.

**Not run:** application test suite, full type-check/lint/build, browser rendering, DB/provider requests, production routes/configuration, trained artifact replay, deployment checks, prospective calibration or historical backfills. No source files changed, no commits or pushes. Passing diagnostic assertions means the reported mechanisms reproduce, not that the current implementation is correct or ready to activate.
