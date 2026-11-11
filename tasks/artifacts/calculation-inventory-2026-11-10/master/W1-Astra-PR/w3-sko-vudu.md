# Independent peer review: W3-7 sKO and VuDu

2026-11-11. Review target: Fable's `audits/sko-vudu.md`, commit `7174249cb7eae7e711039e495c63a990112e22ea`. Canonical checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`. This is an additive review, not implementation or acceptance of a model. The original audit is preserved. Runtime sources were not edited.

## 0. Review brief

- Separate arithmetic/contract correctness, conformity to the owner's sustainability definition, and evidence of predictive usefulness.
- Follow legacy score, source-ingest, SQL research, Sko interpretation, VuDu and immediate consumers independently. A shared name is not shared lineage.
- Use decisions 32–35, 61, 63, 65, 68, 80 and `OWNER-INTENT-SKO-VUDU.md`; apply upstream BLSH, SQL and sustainability peer-review corrections.
- Verify exact code offline, including malformed input, incomplete exposure, forecast-use permissions, information time, zero variation and source-to-display semantics.
- Statistical standards: pooled ratio definitions; population SD versus CV; covariance of a difference; weighted quadratic-form moments; proper forecast scores and time-ordered validation. No universal community formula for sKO/VuDu is presumed.
- Done criteria: every one of the 32 packet entries accounted for, major claims reproduced or qualified, actual reach distinguished from reported production state, and a repair/validation handoff that does not prescribe an unvalidated replacement formula.

## Verdict

**Retain the audit's central conclusion, but do not implement its handoff unchanged.** No reviewed implementation is a completed, validated expression of the owner's full sKO/VuDu goal. The source contains useful descriptive pieces, real integrity defects, and substantial unfinished design. Those are different judgments.

The most important changes to the audit are:

1. **A stronger forecast-admission defect is missing.** Sko can use a forecast issued after the requested as-of time, and it discards target-level permission/provenance needed by comparisons. An actual FORGE target-view helper can supply a value approved for totals but expressly not comparisons; the interpreter still computes a gap and the trade path calls the result qualified and complete. These are **pre-promotion blockers**, not demonstrated production incidents.
2. **Unknown evidence can change the selected recent window.** A malformed availability time drops a known dated game and backfills an older result, unlike the negative-value branch that correctly retains an unknown placeholder. Unknown participation also leaves IPP and opportunity summaries using partial appearances without the same window-level completeness qualification.
3. **Opportunity is broader than mean minutes per appearance.** Null PP is one failure. Halved appearance opportunity can still be called steady; a one-game minutes change is reported with a ten-appearance `observedDuration`. Do not interpret that field as measured streak persistence.
4. **Fable overstates the legacy multiplier case.** The midpoint of 0.9 is real, but not intrinsically an arithmetic error; the ratio is scale/translation invariant on nondegenerate inputs. A same-day correlation does not prove that it taxes production rather than relative variability. Constant short series get 1.0, not 0.9. Its specified interpretation and empirical value remain unqualified.
5. **The proposed usual-range fix conflates three questions.** Recent unusualness against an old personal baseline, same-window process support, and a future forecast versus recent results require distinct comparisons. A current unusualness test is not a universal gate on a forecast outlook change. Recent SD/√n does not validate either one.
6. **The legacy classifier has a reproducible defect beyond its questionable thresholds.** Repeated identical primary-only-assist games are classified uncharacteristic because the current PA/SA ratio becomes 10 while those same historical ratios become infinity and are discarded.

**Verification:** 32 offline cases (31 exercising actual TypeScript implementations and one explicit SQL-expression mirror) and 172 existing tests passed. All 32 inventory entries have a disposition below. No production database access, provider requests, application endpoint calls, source edits, migrations, scheduling changes, commits, pushes or deployments were performed. No new production-visible P0 is established. Fable's live counts/cron observations remain its dated evidence, not independently remeasured facts.

## 1. Reach and lineage: keep the paths separate

| Path | Producer → immediate readers | What this review establishes |
|---|---|---|
| Legacy points × relative-SD score | `player_stats_unified` → `update-predictions-sko.ts:190-201,305-350,538` → `predictions_sko` → `get-predictions-sko.ts:167-244` → quarantined hook/leaderboard | Operational route and unauthenticated read handler exist in source. Writer is admin-gated and run-controlled, not simply feature-flagged off (`:706-710`). No mounted leaderboard caller found. Fable reports active daily cron/rows; not reverified here. |
| Legacy ancillary stats | NHL report inputs → `buildSkoSkaterStatsRow`/upsert → `sko_skater_stats` → dormant `fetchLegacySkoGameLogs` and research helpers | Stored IPP bug reproduces. Manual `fetchSKOskaterStats.js`/`fetchSKOyears.js` contain analogous calculations and direct writes; they were inspected, never executed. |
| SQL analytics sKO | WGO + NST joins → `vw_sko_skater_base` → moments/zscores → weighted/tanh score → `rpc_sko_player_series` | Distinct from `predictions_sko`. The named base view reads WGO/NST, **not `sko_skater_stats`**. No runtime TS RPC caller found; deployment equivalence is not reverified. |
| Sko Element | synthetic `fixtures.ts` → `interpretPlayer` → `SkoElementPreview` and fixture trade records | Only fixture invocation found outside tests. `/sko-element/preview` and `/buy-low-sell-high/trade` have production-build 404 guards. The trade route is **`/buy-low-sell-high/trade`, not `/trade`**. |
| `market.ts` watchlists | interpretation record → `weightedPointsGap`/`buildWatchlists` | Sign-based lists reproduce, but current non-test search finds **no caller of `buildWatchlists`**. This is an unmounted library path, not the current BLSH research-list UI. |
| Current BLSH research preview | retained research snapshot → `BuyLowSellHighPreview` | `pages/buy-low-sell-high/preview.tsx:12-15` reads the research snapshot, not Sko fixture watchlists. Preserve upstream Astra's snapshot/admission corrections. It also has a production-build 404 guard. |
| VuDu pure helper/context | `gap.ts:vuduSaveGap` (tests only); observed/forecast goalie inputs → `interpretGoalie` → fixture goalie table | Pooled observed ratios are useful. `gap.status` always remains `pending_goalie_adapter`; no live VuDu gap is demonstrated. |
| `combineSKO`/`computeLuck` | caller-supplied components → independent pure helpers | No non-test caller found. Do not claim the mismatched luck deltas currently feed `combineSKO`; they do not. |
| Sustainability “sKO v3” | `sustainability/score.ts:280-284` → read/entity surfaces → dashboard/Sandbox consumers | Explicitly outside Fable's packet entries, but not outside the four-name discussion. `read.ts:57-58`, `entitySurfaceServer.ts:664-665`, `pages/trendsSandbox.tsx:1889,2740-2749` show source reach. Existing sustainability peer reviews govern its defects; this is not another complete v3 audit. |

Therefore narrow “no page shows a number from this family” and “the legacy score is the only part producing numbers” to the reviewed packet paths. Neither sentence is justified across all four variants. Static absence of a caller also cannot prove no external API or database consumer exists.

The read API already emits `compatibility_model_not_promoted`, optional missing-attribution/staleness warnings, explicit pagination and model identity (`get-predictions-sko.ts:92-107,217-239`). It is not silently claiming promoted-model status. Conversely, the hook consumes only `rows` (`useQuarantinedPredictionsSko.ts:60-65`) and has no model-name/version options, despite the API supporting them. A reader repair must preserve and display qualification, not merely rename a column.

## 2. Additional or materially broader implementation findings

### A1. Forecast information time, allowed use and target completeness are not preserved through Sko

**P1 before any non-fixture adoption. M-SKO-005/007/018/021/028/029; M-VUDU-003.**

`interpretPlayer` validates observation `asOf` and player identity, but not `forecast.readAsOf`, target cutoff/issuance time, source permission, game membership or per-target coverage (`interpret.ts:212-231`). `forecastExpiry` gathers only parseable expiries of non-null expectations and takes their minimum (`:100-105`). One valid target clock can mask another target's absent clock. `expectedPerTeamGame` checks scope/unit/null/positive denominator/expired status, but not finite nonnegative value, complete games or comparison approval (`:88-97`). The prior-read comparison similarly accepts an invalid timestamp because comparisons against `NaN` are false (`:257-261`).

**Executed results:**

- Interpretation as-of **2026-10-18 15:00Z**, forecast read/issued **2026-10-19 10:00Z**, expiry October 20: the points gap is still **−0.15/team game**, forecast status is `current`, and `forecastQualification` says `qualified` when `fixture=false`.
- Remove **every POINTS expiry** but retain other targets' valid expiries: POINTS still has a numeric gap and the record is `current`/`qualified`.
- Remove all target expiries: status becomes `unknown`; a two-player trade is still `complete=true`, but correctly labelled `experimental=true`. Preserve that existing warning in the description; the issue is not a wholly silent fallback.
- Actual AST-selected `gameExpectations.ts:targetView` produces a finite POINTS expectation with `{totals:true, comparison:false}`. This is a supported permission distinction, not an impossible field combination: `contributions.ts:333-354` resolves permissions independently, and `targetView` gates the displayed number on `totals` (`gameExpectations.ts:83-90`). Sko makes its comparison anyway. The final `compareTrade` returns **complete=true, experimental=false** with both players described as qualified.
- A total with `coveredGames=1`, `requiredGames=10`, but a numeric ten-game total is admitted by the interpreter and `playerPointsTotal`. This is a boundary-hardening case: the canonical current aggregate builder normally nulls incomplete totals (`gameExpectations.ts:193-204`). Do **not** claim that producer currently emits this inconsistency.

`forecastTotals` strips records to expected/unit/reason (`interpret.ts:354-355`). `trade.ts:22-33,98-109,129-166` cannot recover source clocks, per-target permissions or completeness after that loss. Its `qualified` state means little more than non-fixture + not-expired + complete horizon. The stricter `tradeValue/valuationComponents.ts:25,32-46` already demonstrates checks for read-as-of, distinct future games, per-target clocks/units/coverage, total reconciliation and totals/comparison permissions, while explicitly warning that a caller-supplied object is not proof of source admission.

**Repair:** preserve source admission at the observation/forecast adapter, then carry target-level eligibility and reasons into the interpretation record and every comparison consumer. Do not simply replace an expiry check or trust `fixture=false`. Validate finite values, compatible target/basis/strength/horizon, unique future game identities, exact covered target membership, clocks and permitted use. A cached/earlier forecast may be legitimate under an explicit policy; do not impose `readAsOf===asOf` everywhere without defining that policy. It must never be issued after the evaluated as-of. Likewise retain a valid observation-only mode rather than turning missing forecasts into zeros.

For unknown expiry decide an explicit unqualified display policy. For a historical prior forecast, validate authentic earlier issuance and the prior record's validity **at issuance**; it need not remain unexpired today. Surface schedule composition changes separately if “outlook change” compares different future game sets. Same horizon length does not prove a same-game forecast revision, but the current code does not promise identical games.

**Consumers/tests:** `expectedPerTeamGame`, `interpretGoalie`, weighted gap, `forecastTotals`, `market.ts`, `forecastQualification`, `playerPointsTotal`, `playerScoredValues`, `compareTrade`, Sko goalie/metric tables and `BlshTradeComparison.PlayerCard`. Assert final displayed/advisory eligibility for future, unknown, mixed-validity, revoked-comparison, incomplete and observation-only cases. Tests must prove denied fields cannot be recovered by summing raw totals.

Additional defensive cases reproduce NaN expected total → NaN gap with `direction="level"`, and 11 expected starts over a ten-game horizon. These are not shown to arise from the current qualified producer; they belong in the adapter validation matrix, not in a claim of observed production corruption.

### A2. Validation changes window membership, while partial IPP/opportunity can look complete

**P1 before adapter promotion; dormant currently. M-SKO-006/008/019/027.**

The negative-value branch deliberately preserves a dated game as unknown so an older game cannot replace it (`normalizeTeamGames`, `interpret.ts:42-45`). But malformed `availableAt`, invalid status or other structural failure takes `continue` (`:37-38`), after which `slice(-k)` selects the surviving rows (`:220-223`). The date check is only a regex; an impossible calendar date can pass.

**Executed:** in fixture f1, invalidating the newest game's availability time changes the ten-game window from **October 5–14 to October 4–13** and observed points from **0.9 to 0.8/team game**. It still reports ten games, zero unknown games and a numeric gap. The correctly handled negative-value control keeps October 5–14, one unknown and a withheld rate. `date="2026-99-99"` is accepted with `invalidRows=0` and becomes the reported window end.

Separately, the team-game points calculation withholds on unknown participation (`:70-80`), but `ipp` filters only appeared rows (`:275-282`) and `opportunityBlock` does the same (`:60-67`). With one of ten recent statuses unknown, the example withholds production yet emits **IPP .5** and **steady opportunity** from the other nine appearances. A conditional “among observed appearances” calculation can be useful, but it must carry its actual eligible/unknown coverage and must not pretend to describe the complete selected window. `observedPerAppearance` has the same conditional-sample qualification.

Pooled IPP also validates only the aggregate: a game with two points on one on-ice goal plus a game with zero points on three on-ice goals produces a plausible **.5**, hiding the impossible row. This contrasts with the goalie primitive checks, which validate each appeared game before pooling.

**Repair:** select the intended window from an identity-complete, point-in-time game/participation skeleton, then validate measurements within it. Preserve trusted in-window identities as unknown; if membership or availability cannot be established, mark the window incomplete rather than inventing an as-of fact or silently backfilling. Validate real dates and reconcile row timing with evidence cutoff. Supply season/game-type/time-zone and team-of-record membership in the adapter for decisions 16/18/61. A `date` documented in an evidence time zone (`contract.ts:53`) is currently compared to UTC midnight without that time zone in the contract (`interpret.ts:41`); intraday historical cutoffs require an explicit time convention.

For per-appearance/IPPs, either withhold the whole-window interpretation on unknown participation or label the conditional subset and expose target-specific counts. Validate integer count relationships per game before pooling. Adding a warning only to `diagnostics` is not enough when the visible metric still looks complete.

**Tests:** malformed clock versus known missing value, impossible date, conflicting duplicate, future-available revision, current-season short history and optional across-season history, traded player team-of-record windows, unknown versus confirmed absence, one-row count inconsistency hidden by pooled totals. Assert exact game IDs and final UI labels, not only mean arithmetic.

### A3. “Steady opportunity” and “observed duration” exceed what is measured

**P1 before interpreting support/persistence; dormant. Extends Fable D4, M-SKO-008.**

The audit's null-PP example is confirmed: unchanged TOI plus null recent PP time yields `direction="steady"` and the `conversion-not-role` sentence (`interpret.ts:121-133,304-305`). But changing this branch to require both means does not complete the fix.

**Executed further cases:**

- Prior ten appearances versus recent five appearances plus five confirmed absences, with identical 18 total/2 PP minutes per appearance: `steady`; total minutes per scheduled team game have fallen from **18 to 9**.
- Nine recent games at 18 minutes and only the newest at 38, versus a prior 18-minute block: mean change **+2**, direction `rising`, `observedDuration.appearances=10`. The actual altered-usage observation count is one. The current explanation says “Observed over 10 appearances,” not explicitly “ten-game streak,” so this is a **duration-contract shortfall**, not a claim that today's UI literally predicts a ten-game spell.

`roleEvidence` is largely display context: only the latest PP-unit label is surfaced, and it is filtered on `effectiveAt` with no `knownAt`/availability field (`contract.ts:88`, `interpret.ts:135-144`). Line/injury-replacement evidence cannot currently explain or qualify the classification. A retrospective report effective before as-of is not necessarily known before as-of. No actual leaked historical dataset is established here.

**Repair:** name the computed quantity narrowly, e.g. “total/PP minutes per observed appearance unchanged under rule …,” and never infer that all opportunity is unchanged or excluded as an explanation. Show appearance availability/share separately, and incorporate sourced role changes as contextual evidence without discounting or assuming permanence. Preserve mixed-direction/unknown states. Rename `observedDuration` to block coverage unless and until an explicit episode algorithm measures consecutive duration, onset, interruption and confirmation time. Include opportunity evidence availability clocks. No new numeric threshold is selected by this review.

**Tests:** 10→5 appearances at fixed conditional minutes; PP unknown; opposing PP/total shifts; known line replacement at unchanged minutes; one-game versus sustained changes; retrospectively available role reports. Check the exact `conversion-not-role` and opportunity text as well as direction.

### A4. Legacy PA/SA transforms differ between the current game and its own baseline

**P2, dormant; M-SKO-010/012.**

`computeStatSummaries` maps positive primary assists with zero secondaries to infinity and filters it out (`statistics.ts:33-48`). `computeCharacteristicResults` maps the same observation to 10 (`:104-121`). Therefore a repeated ordinary observation is compared with a baseline that never contains it.

**Actual-function fixture:** six identical complete-stat games, each one primary/zero secondary assists. First game is insufficient history; each of the next five has weighted score **2.390811746**, above **T2=2.017097865**, and is labelled `Uncharacteristic`. All other features are constant, so the PA/SA representation alone explains the result.

**Repair if this retained variant is used:** declare one feature and transform, use it identically in baseline and evaluated observations, and preserve the zero-secondary/zero-assist cases explicitly. A capped ratio is a modeling choice; a primary-share or separate-count model would change the construct and requires definition/validation. Do not silently substitute a supposedly canonical formula. Refit thresholds only after the feature contract and missingness policy are fixed.

**Tests:** identical histories with primary-only, no assists and mixed assist counts; changing only representation must not change the classification. This does not authorize activating or deleting the dormant classifier.

### A5. SQL streak repair must fix identity, no-history and zero-scale cases together

**P2, dormant; M-SKO-016.**

Fable correctly identifies endpoint-only testing and cumulative starts (`analytics.rpc_sko_player_series.sql:120-128`). The offline expression mirror for flags **1,0,1,1,1,1,0** with L=3 yields starts at games 3,5,6 and cumulative IDs **null,null,1,1,2,3,3**. It both invents a start through a gap and retains an ID on a non-hot game. A valid retrospective run is games 3–6, with one run identity. This receipt is explicitly **not PostgreSQL execution**.

Two distinct zero-scale conditions must not be conflated:

- **No baseline:** median `mu0` is null. SQL comparisons yield false CASE branches, as Fable correctly refutes; this silently gives no hot/cold flags, not evidence of normality.
- **Established constant baseline:** `mu0` exists and MAD-derived `sigma0=0`. At `ewma=mu0`, both `>=0` tests are true (`:113-114`): the same neutral game is simultaneously hot and cold. A missing-history fallback cannot fix this case.

Gaps-and-islands is a suitable run-identification technique only after baseline/scale/flag definitions and parameter validation are settled. Specify whether start date is the **retrospective first run game** or the **time L consecutive games were confirmed**. Backdating onset must not give an online system future knowledge. Test L=1/2/3, interrupted runs, both directions, trailing non-hot games, missing history, positive-history zero MAD, and invalid span/L values.

The fixed 2021–24 baseline includes evaluated historical games, and upstream moments/zscores have their separate whole-history problems. Fixing streak IDs alone does not create point-in-time sustainability. Preserve the upstream SQL review's warning: a reported whitespace-normalized function-body hash is not full deployed-function/grant equivalence.

## 3. Corrections to Fable's statistics, classifications and remedies

### R1. D1/M-SKO-025: midpoint and dependence are not a proof of a broken volatility formula

Let a nondegenerate short/long series have SDs `sS,sL`. Away from the 1e-6 denominator guard, the smoothstep input is `(sS/sL−.8)/.4`. Adding a constant to every game leaves both SDs unchanged; multiplying every value by a positive constant multiplies both SDs and thresholds equally. **The multiplier is invariant to those transformations.**

Executed 20-game alternating 0/1 series: multiplier **.9**. Add 5 to every game: **.9** with much higher pace. Multiply by 3: **.9** with SD tripled. These counterexamples refute a general arithmetic claim that high scoring level itself is penalized. The overlapping windows and point-count distribution do affect sampling behavior; this is not a claim of unbiasedness, calibrated stability or predictive merit.

Correct the short-history assertion to: **with identical short/long memberships and positive SD, multiplier=.9**. Ten identical one-point games, a single two-point game and twenty scoreless games all have zero SD and multiplier **1**. The original packet's scoreless=.8 lead is indeed false. Calling .9 the numerical midpoint is exact; declaring “neutral must equal 1” or nulling all identical windows is a new interpretation/policy decision, not a theorem. A fully disclosed .9-centered relative-volatility summary may be retained under its own definition, as decision 80 requires; its use to discount predicted production still needs evidence.

The correlations 0.818/−0.313 and the 761/116 row counts are Fable's one-date database observations. They are not independently reproduced here, and cannot separate baseline scoring level, count variance, recent change, games available and overlapping-window effects. Do not infer a causal “tax on production” from them.

**Reject the proposed exact stationary-Poisson rate-invariance test.** Finite-sample SD-ratio distributions and zero-SD mass change with the rate. For n≤10, even the expectation is `.9 + .1·P(all n Poisson observations equal)`, which depends on the Poisson mean. Appropriate deterministic tests verify the actual affine invariance where the guard is inactive, finite output/bounds, order effects, zero/missing history and correct SD labels. Whether discounting improves forecasting requires a separate paired temporal experiment.

Retain the genuine D1 deficiencies: null points become zero (`:538`); the query has no game-type filter; the formula is an unshrunk recent pace, on appearance-derived inputs and a caller-provided horizon rather than a scheduled-team-game forecast. Its five-game default does not fulfill the canonical product's ten-team-game contract. Under decision 80, **rename/define it; do not silently reinterpret its stored historical totals or force a new horizon merely to match the new product**.

D2 is confirmed: `stability_cv` is population SD in points/game. `[0,2,0,2]` and `[1,3,1,3]` each produce SD 1, although their CVs are 1 and .5. Keep SD and CV distinct, preserve historical model/version semantics, and update the hook's model filters as well as field names. A model version bump alone does not stop the existing leaderboard from mixing versions/horizons.

### R2. D3: usual range, same-window support and forward outlook are distinct estimands

The code's current gap is **future FORGE expected rate − recent observed rate** (`interpret.ts:248-255,302`), not a contemporaneous process residual and not recent deviation from an established personal baseline. Its sign and native units are arithmetically correct for that particular comparison. “Rebound/Cooling watch” overstates a sign-only, unqualified fixture comparison; removing those words until an alert contract is accepted is a reasonable interim presentation action.

But replacing the sign rule with a universal recent-usual-range gate would answer the wrong question:

- Personal baseline 1, current output 1, future expectation .2 after role loss: recent results are ordinary, yet the forecast outlook is lower.
- Baseline .5, current output 1, future expectation 1 after promotion: recent results are unusual, yet the current level may be supported.

Neither example decides whether the forecast or promotion persists. They show why the axes must remain separate. Decision 33 governs unusualness; decision 32 additionally asks about support and persistence. An established own baseline is not supplied merely by adding one SE threshold to the forward comparison.

Fable's fixtures within one/two recent SEs are not calibrated false-alert counts. Even the claim that ignoring forecast error **must understate** noise is incorrect: `Var(F−R)=Var(F)+Var(R)−2Cov(F,R)`. Shared recent inputs may induce substantial covariance; when F=R, gap variance is zero despite positive SE(R). Count skew, overlapping games, forecast estimation and context changes add further issues. Do not promote SD/√n, a Poisson tail for fantasy points, equal list sizes, or an arbitrary threshold to a required acceptance oracle.

**Retain three named comparisons:** recent versus pre-window personal baseline; observed versus compatible same-window support expectation; forward forecast versus recent level. Admit a predictive alert only under a declared target/horizon/uncertainty protocol with later validation. Signed descriptive values can remain available sooner, with their units and qualifications.

### R3. D4/D7/D8 fixes need more than null checks or a different threshold

- **IPP:** per-appearance pooling on complete compatible rows is correct, but one on-ice goal is not five or ten appearances of information. The executed ten-appearance/one-goal fixture emits IPP 1 with the general metric's `sparse=false`. Carry actual on-ice-goal exposure, coverage, player baseline and reference version. There is no universally correct minimum denominator to invent here; flagging/shrinkage/withholding rules need justification. `ClassReference` currently has only value/source/status, not source seasons/cutoff/sample/version (`contract.ts:107`).
- **Positive SD is not floored to 1.** `statistics.ts:58` uses `sqrt(variance) || 1`, then a positive finite check. `[0,1]` gives **.5**. The issue is zero/undefined-scale fallback and unverified feature distribution, not a blanket unit floor.
- For correlated standard-normal features, `Var(Σw_j z_j²)=2 tr(W R W R)`, not `2Σw_j²` unless the cross-correlations vanish. Clipping, estimated means/scales and discrete ratios further invalidate that theoretical reference. “Highly Characteristic below the mean” is a chosen label, not intrinsically an arithmetic impossibility because the distribution is skewed.
- **Dropping missing terms but keeping full-feature thresholds** makes incomplete games look artificially ordinary. Recalibrate/qualify by the actual feature mask, or withhold when the defined diagnostic cannot be supported. Empirical quantiles must be pre-window and population/missingness compatible; they do not certify predictive calibration by themselves.
- The proposed “null IPP equals omitted IPP” test already passes in the broken code, since both become zero. Actual fixture scores are **3.264633479** for each. A useful test proves neither missing case is interpreted as a measured zero and that insufficient feature coverage is visible.

### R4. VuDu: correct gap sign, matched population and conditional meaning

For the *same actual on-net shots*, let `xGA=SA·(1−expectedSV)` and `GSAx=xGA−GA=SA·(observedSV−expectedSV)`. Then:

**`vuduSaveGap = 100·(expectedSV−observedSV) = −100·GSAx/SA`.**

Expected SV .90, observed 95/100: helper returns **−5 additional saves per 100**; GSAx is **+5**. Fable Q2's “a GSAx-per-100 diagnostic” must state the **opposite sign** under that convention. Preserve the agreed positive=rebound orientation, rather than accidentally flipping the function to a positive-GSAx convention.

The on-net guard is sound and returns null for unblocked-attempt expectations. It does not verify dates, strength/net state, model version, goalie attribution or identical event membership; the caller/adapter must. A residual against one xG model can include omitted skill/context/model error. Repeated elite stopping requires its own baseline before being called unsustainable.

A same-window expected stopping rate measures model-relative stopping residual; a future FORGE save ratio measures future-schedule outlook. Both may be useful, but they should be **separate labelled quantities**, not an ambiguous choice forced into one “expected SV%”. No helper needs a provider call or model activation to settle its sign/arithmetic.

The observed ratio aggregation is confirmed: a 27/30, three-GA, 60-minute start plus a 2/3, one-GA, ten-minute relief appearance yields SV **29/33=.8787879**, GAA **240/70=3.4285714**, start share **1/2**. Unknown participation and inconsistent goalie primitives correctly withhold ratios. Ratio of expected totals is honestly labelled and is not the expected value of a future realized ratio. Preserve that distinction.

For skaters, `expectedPerAppearanceConditional` is the **unweighted mean of per-game conditional forecasts**, as its internal contract explicitly says. It is not generally the ratio of expected total to expected appearances. Fixture with five games `(p=.1, μ=10)` and five `(p=.9, μ=1)` displays **5.5**, while `Σpμ/Σp=1.9`. Neither generally equals `E[realized total/realized appearances | appearances>0]`. Label the first “mean if-play forecast across scheduled games,” or deliberately choose a different contract; do not silently swap estimands.

VuDu still needs qualified workload/start/relief/no-appearance contributions, danger/environment, stopping baseline and uncertainty. Mix counts/exposures first under decision 63, then form ratios. Team win is not the goalie's own credited win; W/L/OTL/no-decision must reconcile to the credited event. No placeholder saves gap, guessed prior or skater weights can complete this design.

### R5. Preserve correct warnings, and do not make unnecessary production decisions from this review

- D5's missing-component/impossible-IPP defect is reproduced; the precise cause of Fable's 42 source rows is **not** established. Validate joins, strength classification and matching goal populations before declaring extra-attacker omission. Repair the canonical builder and review both manual writers before any reuse. `fetchSKOyears.js:173-176` additionally treats zero shots as missing SOG/60; that is a dormant manual-writer behavior, not the live builder's result.
- D6's mixed `computeLuck` signs are real, but `computeLuck` and `combineSKO` are unwired helpers. Test each component's stated sign independently; goals above xG do not force the other input deltas to have the same sign. Real process/context disagreement must remain representable.
- D10's pooled hit rate can describe a **trial-weighted micro-average** across heterogeneous category events if labelled that way. Heterogeneous categories alone do not make arithmetic wrong or prove forecast calibration. Null rates with positive sample count and no-data→0 are defects; preserve denominators and unavailable status. `MetricCards` is unmounted.
- Retain upstream Astra corrections: immutable BLSH artifacts cannot be regenerated/rehashed into acceptance; complete-case/arm-C covariance concerns remain; failing a forward test does not refute an honest same-window diagnostic; FORGE does not omit every extra-attacker event; no blanket EA add-on is justified.
- Q1/Q3 are operational/consumer questions, not mathematical repair prerequisites. Do not pause useful source-history capture or gate the public API merely because a formula is unvalidated. Inventory consumers, retention/research value, costs and compatibility first; obtain an appropriately scoped operational decision. Static call search is not access-log evidence. No such action is authorized by this review.

## 4. Disposition of all 32 inventory entries

This is a reconciled coverage table, not a new misleading single tally. One entry can have sound arithmetic, an incomplete product contract and no demonstrated predictive evidence at the same time. “Covered” preserves the named upstream finding; it does not independently certify deployed SQL.

| Entry | Review disposition |
|---|---|
| M-SKO-001 | Covered by SQL review: historical/reference and join-grain problems retained; no new deployment proof. |
| M-SKO-002 | Covered: shrinkage of medians/MADs with κ=30 is an unqualified modeling choice, not validated EB from the name. |
| M-SKO-003 | Covered: fixed coefficients/null-z substitution retained; define/version, do not infer ridge training from a comment. |
| M-SKO-004 | Legacy umbrella: mis-specified as full canonical sustainability; R1 corrects alleged multiplier arithmetic defect. |
| M-SKO-005 | Correct native forward-minus-recent subtraction on admitted inputs; A1 and R2 materially qualify “mis-specified”. |
| M-SKO-006 | Pooled complete-case arithmetic sound; A2 partial/inconsistent row coverage and R3 exposure/reference contract defects. |
| M-SKO-007 | Linear weighted mean arithmetic sound; inherits A1/R2; no probability/variance calibration follows. |
| M-SKO-008 | Fable D4 confirmed and broadened by A2/A3. |
| M-SKO-009 | Pure gap/basis/transform helpers sound on declared domains; display scale remains a proposal, not an adopted metric. |
| M-SKO-010 | Inverse ratings are normalized correctly; research justification/threshold distribution unqualified; A4/R3 apply. |
| M-SKO-011 | Smoothstep and empirical quantile arithmetic sound for their explicit rules; invalid-input→1 is not confidence, and empirical quantiles require an as-of protocol. |
| M-SKO-012 | Mis-specified classifier plus genuine PA/SA baseline/current mismatch (A4); correct SD-floor claim and tests (R3). |
| M-SKO-013 | Covered by BLSH D6/Astra R5: preserve house Game Score versus true 5v5 distinction and dormant reader lineage. |
| M-SKO-014 | Recent-points forecast contract/coverage deficiencies retained; rename/define under decision 80, no automatic canonical-horizon retrofit. |
| M-SKO-015 | Fixed component score retained under its own name; luck-sign inconsistency confirmed but not wired into composite. |
| M-SKO-016 | Endpoint-only streak detection wrong; A5 adds inherited IDs, constant-baseline simultaneous flags and onset-time qualification. |
| M-SKO-017 | Incomplete/impossible stored IPP reproduced; production prevalence/cause remains Fable's evidence. |
| M-SKO-018 | Disjoint prior block accurately disclosed, not established baseline; A1 prior clock and R4 conditional/outlook semantics qualify “sound”. |
| M-SKO-019 | Confirmed absence zero/per-appearance distinction correct; A2 malformed-membership and incomplete-subset qualifications. |
| M-SKO-020 | n−1 sample SD arithmetic correct; not forecast spread, mean uncertainty or calibrated usual range. |
| M-SKO-021 | Cannot be unqualified “sound”: A1 information-time/use/coverage boundary; R4 conditional-mean label. |
| M-SKO-022 | Same canonical row builder as 017; include dormant manual writer contracts without double-counting. |
| M-SKO-023 | Micro-average interpretable when defined; null hit-rate and missingness handling wrong, dormant. |
| M-SKO-024 | SD misnamed CV confirmed. Preserve historical version semantics in any migration/API alias. |
| M-SKO-025 | Reclassify “wrong” to unqualified/mis-specified interpretation; arithmetic midpoint/invariance is correct, predictive discount unsupported (R1). |
| M-SKO-026 | Score algebra correct; legacy construct and cross-model/horizon reader selection need definition/repair. |
| M-SKO-027 | Alias of 018/019; A1/A2/A3 apply, no extra defect count. |
| M-SKO-028 | Alias of 005/021; A1/R2/R4 apply. |
| M-SKO-029 | SD sound and prior-block meaning disclosed; A1 clock checks/outlook comparability remain. |
| M-VUDU-001 | Native-unit helper correct for matched populations; negative GSAx/SA convention, no own-baseline or predictive validation (R4). |
| M-VUDU-002 | Per-game primitive checking and pooled ratios confirmed; adapter membership/provenance requirements remain. |
| M-VUDU-003 | Honest pending-gap status and ratio pass-through; inherits A1 admission requirements, not a completed VuDu metric. |

## 5. Foundation repair and validation handoff

### Stage 1: preserve lineage and fix deterministic contracts without claiming a new metric

**Legacy lane:** `update-predictions-sko.ts`, `get-predictions-sko.ts`, `useQuarantinedPredictionsSko.ts`, `PredictionsLeaderboard`, `PlayerTable`, `SkoExplainer`, `MetricCards`, run-control version key and types. Define/rename the retained construct, correctly expose SD, retain unknown points, select complete model+horizon identity, and propagate source warnings. Make any changed numerical behavior separately versioned. Do not overwrite historical v0.2/v0.3 meanings or automatically replace .9 with 1/null as an asserted mathematical fix.

**Source-ingest lane:** `buildSkoSkaterStatsRow`, upsert validation and dormant manual counterparts. Validate source completeness/units/grain and IPP numerator/denominator before writing a usable derived value. Keep zero shots with positive TOI as zero rate. Record target-specific unavailability reasons. A durable reason column may require a reviewed schema change. Production backfill is a separate, bounded approved step.

**Interpretation-admission lane:** `skoElement/contract.ts`, `interpret.ts`, future observed/forecast adapters, fixtures and final rendering. Implement A1/A2 first, preserving recorded source version/cutoff/use constraints instead of spreading more ad hoc booleans. Update every raw-total consumer in `buyLowSellHigh/trade.ts` and the forecast cards; coordinate ownership of that lane. An existing stricter adapter is a reference, not a license to bypass upstream admission or silently unify incompatible architectures.

**Opportunity/description lane:** implement A3, separate unknown coverage and appearances from conditional minutes, preserve role evidence and its knowledge time, and distinguish window coverage from actual episode duration. Keep signed forecast-gap text separate from usual-range/persistence alerts. No scoring constants need to be guessed for these repairs.

**Retained research lane:** repair PA/SA representation and SQL run logic only within an agreed retained use, with identical pre-window transformations and mask-qualified thresholds. Keep research/dormant labels. SQL deployment, permissions, rebuild and activation require their own approval; no deletion follows from this audit.

### Stage 2: finish the actual owner-defined inputs

Before a non-fixture sKO/VuDu release, require an explicit contract for:

1. **Current state:** selected target, units, exact recent games, actual n, eligibility/participation, compatible strength/net state, team-of-record and measured versus unknown values.
2. **Personal baseline:** established pre-window evidence, separate F/D/G classes, known-at/source versions, recency and sparse-history treatment, prior exposure and uncertainty. The immediately preceding block can remain a local comparison but cannot substitute for all of this.
3. **Support:** compatible same-window individual process, on-ice/context and conversion evidence, with overlap/correlation and attribution limitations visible. The current Sko contract's boxscore rates/IPP/opportunity are not an implemented complete chance-quality/support model.
4. **Opportunity:** available appearances, total/PP/deployment, role changes and unresolved duration/persistence. A promotion is neither discarded nor assumed permanent.
5. **Forward outlook:** accepted FORGE output over the next ten scheduled team games, with 5/20 alternatives, frozen issuance, conditional/unconditional basis and qualified participation. Sko stays an interpretation layer, not a competing forecaster.
6. **VuDu:** matched shot/model universe; separate workload, danger/environment and stopping; credited start/relief/no-appearance/outcome events; own stopping baseline; exposure-pooled ratios and uncertainty. Same-window stopping residual and future ratio outlook are separate fields.
7. **Honest output:** gap, baseline/current state, support, opportunity, actual episode duration where measured, source/cutoff/version, coverage and uncertainty. No percentile=confidence, score=continuation probability, or missing=neutral conversion.

Decision 80 preserves and names the other variants as candidates for the intended sustainability concept. It does not constitute evidence that their present outputs are calibrated likelihoods. Decision 32 still requires inputs/weights to earn their place out of sample. Neither decision chooses an exact score equation, scale or replacement backronym.

### Stage 3: validate each claim on its own target

This is a research plan, **not authorization to collect data, fit/activate models or reuse a holdout**.

- **Description/measurement:** reconcile source counts/exposures and signed units; verify window membership, missingness and attribution invariants. A failed forward test does not invalidate a correctly labelled retrospective diagnostic.
- **Usual range:** freeze pre-window player/position references. Estimate the stated window-size outcome distribution including baseline estimation, participation and source uncertainty. Evaluate later held-out coverage and interval score/PIT as appropriate to discrete data; report by position, exposure, season phase and missingness. Do not declare calibration from one sample SD or nominal coverage in a tiny sample.
- **Support/persistence:** compare a recent-pace/no-change reference, a shrunk own-player baseline, and baseline+opportunity before adding process and each retained composite. Test incremental predictive value at identical cutoffs/populations and final served quantity. For mean targets use paired squared error/proper scores; MAE is secondary. For probabilities require proper scoring and reliability, not an unexplained score transform.
- **Temporal integrity:** freeze inputs, transforms, reference populations, provider/model versions, clocks and issuance. Keep development/selection/evaluation separate. Purge overlapping target games across splits, account for rolling-window/player/team dependence and report effective sample/uncertainty. The 2025–26 lockbox is consumed; no relabelling it as fresh.
- **Deployment population:** include the declared treatment of rookies, injuries, scratches, trades, relief and no appearances. Do not validate only stable complete-case survivors and generalize to all players. Confirmed zero belongs only on the unconditional basis; unresolved outcomes remain unresolved.
- **Streak research:** retrospective before/during/end alignment is legitimate for exploration, but eventual streak membership/end cannot be a live feature. Declare onset, confirmation, interruptions, right censoring and team-game clock before evaluation.
- **Single-number decision:** the owner wants a clear summary, but conflicting components should remain visible. Compare composite candidates through ablation and stability/coverage tests. Do not choose weights from raw correlations, surveys, nominal unit variance or an arbitrary prevalence of “hot” players.

### Decisions genuinely still needed

Not blockers to arithmetic/admission repairs: final headline target/composite arrangement, numerical scale, qualified alert meaning/threshold, persistence/role scenario contract and VuDu expectation interfaces. Preserve the already-settled own baseline, opportunity inclusion, F/D separation, goalie-specific treatment and 10-team-game horizon.

Operational choices about the two legacy jobs or public read endpoint require consumer/use/cost evidence and explicit scope. The audit's suggested pauses and API gating are not automatically part of a math repair. Nothing should be deleted or activated to make the naming cleaner.

## 6. Reproduction and evidence limits

Artifacts in this directory:

- `w3-sko-vudu-fixtures.cjs`: 32 offline characterization cases, including the explicitly distinguished SQL-expression mirror. Pure modules are transpiled verbatim; exported route helpers are selected from the source AST with exact bodies and dependencies, avoiding route imports/credentials. A closed module allowlist and VM provide no database, filesystem, clock service or network capability to evaluated modules.
- `w3-sko-vudu-fixtures.json`: exact synthetic results and source SHA-256s. NaN is explicitly stringified in its diagnostic case; other ordinary JSON nulls are not silently treated as zero.
- `w3-sko-vudu-source-manifest.json`: 54 source/test pins versus target commit; all match.
- `w3-sko-vudu-existing-tests.log`: 10 files / 165 tests passed.
- `w3-sko-vudu-legacy-tests.log`: two files / seven tests passed.
- `w3-sko-vudu-run-tests.sh`: syntax-checked reproducible command to re-run the same 12 suites together.
- `w3-sko-vudu-offline-preload.cjs`: outbound fetch/HTTP(S) denial used for existing tests. Route test “upsert” and log messages concern their test-owned in-memory mocks, not production writes.

From the repository root, reproduce fixtures with:

```sh
node tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/w3-sko-vudu-fixtures.cjs
# Optional re-run of the 12 existing test files:
sh tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/w3-sko-vudu-run-tests.sh
```

Existing tests used the installed Node **22.23.4**/Vitest, an otherwise cleared environment, explicit inert Supabase URL/keys and the offline preload. No dependency installation or build was needed. The first invocation also supplied a nonexistent `statistics.test.ts` filter; Vitest ran the other ten existing files, not that nonexistent file. The discovered `legacySko.test.ts` was then run separately with `sko-output-authority.test.ts`. No tests are claimed for a nonexistent path.

The focused suites were: `gap`, `interpret`, `market`, `trade`, Sko preview, trade comparison, legacy get/update prediction routes, source stats helper/route, legacy calculation/data-fetch helpers, and retained-output authority. These test correctness of their encoded cases, **not** scientific validity, actual source coverage, source calibration or a deployed UI. The characterization fixtures deliberately assert observed failure modes; a future repair should replace those assertions with the intended protective contract.

The SQL streak case is a source-checked JS mirror of the relevant expressions; no local or remote Postgres was started. Full function/grant/catalog equivalence and exact production schedules/contents were not checked. Fable's 761 prediction rows, 116 short-series rows, correlations and 10,223/42/2,157/4,701 source counts are retained only as its November 11 observations. The original report does not retain a row-level source snapshot or executable numeric receipt sufficient to independently recreate them offline.

No full application build, global typecheck, browser crawl, production request, model fitting on player data or holdout evaluation was run. These would not resolve the unchosen statistical estimands. The work ends with a verified review and scoped handoff, not a claim that sKO/VuDu is fixed or ready for release.
