# Independent peer review: W2 BLSH

2026-11-11. Review of Fable's `aa264b4bcf5c176415456ec606bcdf65edfff88d`, canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; first inspected HEAD `76b25fb8fb60e6cde12b4cd2a5634e83ff1eadf1`. The inspected BLSH libraries, scripts, preview components/routes and retained-card adapter have no committed changes between that audit and the review's starting HEAD. This is additive review, not implementation or acceptance of a current data feed.

## Verdict

**Retain the frozen-snapshot and forecast-rule findings, but do not implement this audit verbatim.** Two additional defects reproduce in actual pure functions:

1. **Arm C loses track-specific exposure when it enters the scorer.** One measured Game Score game can borrow the precision of 20 fantasy-point games. In the fixture, its claimed reference-error variance is understated by **19.10× at the unchanged estimator weight**.
2. **PP shrinkage is misreported as an opportunity change.** Exactly unchanged TOI and PP usage produce a reported **−4.55 FP opportunity effect**, solely because the PP rate was shrunk and the comparison's baseline was not.

Fable's **167 of 448** legacy list members failing at least one current gate reproduces exactly. However, arm C cannot replace the frozen file by regeneration and hash updates alone: the reader expressly accepts only the stale arm-A policy, fixed October dates and 2022–24 reference history. Current acceptance remains closed. No production-visible P0 is established.

Several recommendations also need correction: top 25 per side and position was already chosen; BLSH's explicit retrospective contract is not invalidated merely by a failed next-five forecast; model-standardized variance is not calibration; raw fantasy points and signed Game Score are not Poisson counts; ES goals are not necessarily 5v5 goals; and the inherited claim that FORGE omits all extra-attacker production repeats a correction already resolved in Wave 1.

Fable's 6 sound / 9 mis-specified / 1 wrong tally is its classification, not an independently established count. The disposition table below is more useful than another aggregate count.

## Evidence and execution boundary

- Read the Wave 2 prompt, audit, packet references, relevant owner decisions, BLSH-specific November 3 decisions, November 4 baseline report, current BLSH owner diary and W1 sustainability/FORGE review and consolidation sections. Traced the consequential functions and immediate readers.
- **Executed:** 10 focused existing Vitest files, **296 passed, 111 skipped**, exit 0. Skipped checks require explicitly opted-in retained datasets/parity inputs or output-writing modes; they are not passes.
- **Executed:** in-memory compilation of actual TypeScript pure functions, with a small allowlist for local imports; fixtures, snapshot recount and parser counterexamples below. No external fetches, database clients, provider SDKs or application routes were invoked.
- **Reread, not regenerated:** saved forecast `forecast-dev-v2/RESULTS.json`. Its 28,876 origins / 511 players and the quoted contrasts agree with Fable. The report explicitly calls 2023–24 exposed, exploratory and not reviewed. No full forecast rerun or reserve evaluation.
- **Reported only:** Fable's 3,282-player-game database aggregate and Game Score population effect; the older baseline report's 47,224-row capture and development metrics. No database access here. The complete SQL/result transcript and Fable's throwaway snapshot scripts were not retained in its audit. Appendix A reproduces the principal snapshot gate counts and the new fixtures.
- No application edits, build, broad lint/typecheck, browser/production smoke, provider calls, database read/write, credential access, migration, deployment, commit or push. This report is the sole edited file and also contains the task's checkpoint record. Existing dirty work is preserved.

## 1. Reach and custody: three different paths

**Frozen research preview:** `web/pages/buy-low-sell-high/preview.tsx:11-16` returns 404 under `NODE_ENV=production`; otherwise `readCurrentBlshSnapshot` reads the fixed 9,559,567-byte October 28 artifact, verifies its SHA-256 and validates saved values (`researchSnapshot.server.ts:8-11,28-35`). The file is mapper v1, arm A, 729 profiles, 551 numeric, 264 BL and 184 SH. `BuyLowSellHighPreview.tsx:154` consequently takes its legacy path, not the v3 lists. The page visibly says retrospective, stale, untrusted and not future returns (`:148-167`). “Served” in this review means this **local saved preview**, not today's public application.

**Trade/watchlist interpretation:** `pages/buy-low-sell-high/trade.tsx:12-24` is production-disabled and supplies fixtures. Sko divides the expected total by required scheduled team games (`skoElement/interpret.ts:88-97`), not appearances; weighted comparisons preserve unavailable components and freshness (`:367-383`). This is where FORGE expectation quality can propagate. The retrospective `productionReference`/`supportGap` path imports no FORGE scorer, so the sustainability → FORGE concern must not be applied to every BLSH entry.

**Retained player cards/current-input admission:** `PlayerAnalysisStudio` is not mounted by an application route in the bounded source search; its only importer is its test. `retainedBlsh.ts:5,52-60,65-83` pins the saved snapshot, preserves research-only claims and dated provenance, and does not run the latest list gates over old values. Its current binding remains false. Separately, `currentProcessEvidence.server.ts:13-17,113-140` has an empty default acceptance list. An approved producer/adapter or a parser passing local fixtures is not evidence that any real current packet has been accepted.

The current owner diary (`tasks/diaries/2026-11-08-codex-blsh-lane.md`, latest handoff November 9) preserves current-season weight 1.0, an untouched reserve, and outstanding exact-candidate independent/runtime review, native evidence and execution approval. It says complete latest-five census and operational serving remain later work. Read-only coordination used this record; no owner/source custodian was messaged and no ownership was changed. Its historical checks were not rerun or upgraded to fresh acceptance here.

## 2. Additional defects

### A1. Arm C gives partially observed tracks the precision of fully observed tracks

**P1 before arm-C adoption; M-BLSH-006/007/008. Not present in the served arm-A calculation.**

`productionReference.ts:184,194-201` admits a game on known FP and computes each track's rate from that track's own measured rows. That is correct missingness handling for the means. But `:201-214` computes just one `effectiveSeconds` over **all FP-usable games**. `weightedHistorySummary` then passes that scalar with all three rates (`:220-227`). `personalReference` treats every track's measurement covariance as `omega / exposure` (`:255-261`). `currentWindows.ts:211-227` wires these directly into the joint gap.

**Executed fixture:** 20 pre-window current-season games, 1,200 seconds each, complete FP and G+A, but GS present only in the first game. The baseline reports `trackGames=[20,20,1]`, `effectiveSeconds=24000`, and a usable `HistorySummary` with `n=20`, `seconds=24000`. No missing-track hold is applied because every aggregate rate is finite.

With a diagnostic prior `signal=I/1200`, `omega=I`, `mean_cov=0`, `metric=I`, the common personal weight is `20/21 = .952381`. GS's rate is actually measured over 1,200 seconds, not 24,000. At that **same** weight:

- Code's GS reference-error variance: `(1−w)²/1200 + w²/24000 = .00003968254`.
- Correct model-based GS variance: `(1−w)²/1200 + w²/1200 = .00075774754`.
- Understatement: **19.095238×**. A GS-only optimal weight for this prior would be .5; that is a diagnostic, not a claim that .5 is the corrected common three-track weight.

This is not a hypothetical unavailable API field: the November 4 baseline report explicitly says 10,600 of 47,224 2024–25 rows lack Game Score inputs. That dated count is not remeasured here; it establishes why this supported missingness branch matters.

**Smallest sound correction:** retain per-track masks, weighted exposure and cross-track overlap into the measurement covariance. Under the existing independent-game `Cov(Y_i)=T_i·Ω` model, define `D_j=Σ_i w_i T_i m_ij`. Then the rate-noise entry is

`N_jk = Ω_jk · Σ_i(w_i² T_i m_ij m_ik) / (D_j D_k)`.

Only when every track shares the same mask does this reduce to `Ω/T_eff`. Keeping a scalar shrinkage weight is possible: calculate it from the actual `N`, then propagate `w²N`; a matrix shrinkage redesign is not required to fix this bug. Alternatively withhold the joint score when a valid joint covariance cannot be supported, while retaining the available separate tracks. Do not silently discard all partial games and call that policy unchanged.

**Corrective tests:** the 20/20/1 example; append FP-only games and assert GS information does not increase; disjoint/overlapping track masks with analytical cross-covariances; heterogeneous seasonal weights and seconds; no GS observations remains unavailable; all-identical masks reproduce the previous effective-seconds formula. Test through `assembleProfiles`, not just the means. Metadata and list eligibility must not describe one GS game as 20 games of joint evidence.

### A2. PP shrinkage is counted as an opportunity change when opportunity is unchanged

**P1 before promoting attached opportunity context; M-BLSH-003. Conditional research context, not a list-ranking change.**

At `opportunity.ts:133-137`, non-PP rate is calculated by subtracting **raw** PP production from the observed total, but PP rate is shrunk toward the cohort. At `:244,251` the adjusted total uses that shrunk PP rate and is compared with the **unshrunk** historical per-game total; their entire difference becomes `opportunityEffect`. `:258` attributes the residual after total-TOI impact to PP usage. `assess` explicitly says “The opportunity change alone is worth…” (`:169-196`). The mapper and v3 details carry that text through (`displayProfile.ts:268+`; `BlshCandidateLists.tsx:47-65`).

**Executed fixture:** 20 history games, each 1,200 total seconds, 180 PP seconds, 1 goal, 0 assists; alternating 0/1 PPP and FP 3/4. Historical FP/game = 3.5. Cohort PP FP rate .001/sec with default 3,600 pseudo-seconds. The five-game current window has exactly the historical average TOI and PP usage, and FP 17.5, exactly its per-game baseline.

- Raw personal PP rate `.0111111`, shrunk PP rate `.00605556` FP/sec.
- Unadjusted expectation **17.5**, adjusted expectation **12.95** FP.
- Reported opportunity effect **−4.55 FP**, `opportunityShift="decrease"`, adjusted z **2.26349** and adjusted sell-high evidence, despite both TOI and PP deltas being zero.
- Combined assessment safely remains balanced, but its text says the opportunity change alone is worth about −4.6 FP. Both usage lines correctly say unchanged. The contradiction is in attribution, not failure to calculate the two different reference estimates.

**Correction:** separate reference/model shrinkage from actual opportunity change. With the same fitted rates, compute opportunity-only effect as

`r_nonPP·(T_nonPP,current − n·T_nonPP,baseline/game) + r_PP·(T_PP,current − n·T_PP,baseline/game)`.

Keep the difference between that model's baseline and the unadjusted personal mean as a separately labelled **reference-estimation adjustment**. If the intended design instead preserves the historical mean when fitting the split rates, implement that explicitly and check feasibility; do not silently hide shrinkage in the non-PP component. Role inference must use the opportunity-only term. Separate the method-change residual even when displaying both original comparisons.

**Corrective tests:** unchanged usage must give exactly zero opportunity-only effect for any allowed cohort/pseudo-exposure; a pure PP reallocation at fixed total TOI must give `(r_PP−r_nonPP)·ΔPP`; a pure total-TOI change must use the declared allocation; changing cohort alone may change the model expectation but must not create a promotion/demotion. Assert the final mapped explanation as well as numbers.

The audit's “sound” M-003 verdict also conflicts with its own baseline-mean uncertainty caveat. Its `√(1+n/n_eff)` inflation formula is valid only under an independent, homoscedastic same-population baseline/window model. PP variance is a working approximation: cohort-rate and goal-share estimation, non-PP rate uncertainty and covariance are not fully propagated. For recency-weighted PP counts, game-normalized Kish exposure is not generally the effective **PP** exposure. Do not describe the whole uncertainty model as exactly Poisson-correct simply because one term has a Poisson-shaped formula.

## 3. Corrections to the audit and implementation plan

### R1. D1/D3 are real legacy-contract gaps, but the proposed migration is incomplete

The legacy gate recount is exact:

| Side | Listed | <20 personal games | <5 window games | Headline sign conflict | Any failure |
|---|---:|---:|---:|---:|---:|
| BL | 264 | 77 | 30 | 19 | 95 |
| SH | 184 | 46 | 10 | 28 | 72 |

Overlaps explain why the columns do not add. Legacy order and arm-A staleness remain genuine conditional issues. `displayProfile.ts:249-256,417-426` contains the new gates and headline ordering, but they are not retroactively applied by the fixed snapshot reader.

**Important blocker missing from the proposed fix:** `researchSnapshot.ts:257-264` accepts only season 20262027, October 26/28 cutoffs, arm A, official overlay and `stale=true`; `:284` confines every reference to 2022–24 and April 18, 2024 or earlier. An actual arm-C policy is rejected with `Invalid BLSH snapshot: selected provisional reference`, even before later membership checks. Changing the file hash/size cannot change that. Retained-card evidence and sidecars also have their own byte and review-scope bindings (`retainedBlsh.ts:5-12,55,65-74`).

**Plan:** retain the historical artifact as historical. Design an explicit successor serving/admission contract with reviewed data/method versions, per-player latest-window completeness, clocks, baseline coverage, mapper gates and new consumer provenance; test old and new paths separately. Alternatively disallow legacy directional lists while preserving a labelled historical inspection view. Do not loosen the old validator to pass new data or alter hashes as a substitute for review.

Arm C's current-season weight **1.0 is already selected and frozen**, not an unanswered blend choice (`productionReference.ts:141-158`; `blsh-baseline-2026-11-04/REPORT.md:summary/design`). The report acknowledges development-based selection and untested full three-season weights. The reserved 2025–26 season is the missing most-recent baseline season for 2026–27; this review does not authorize reading it or silently filling it. Before any adoption, fix A1 and distinguish missing history from confirmed zero history.

M-015's unconditional stale text is true under the current frozen contract, so it is a **successor-migration requirement**, not a currently false label. Fix all relevant text (`BuyLowSellHighPreview.tsx:153`, `currentStateLabel`, `retainedBlsh.ts:81`), not just one helper.

### R2. D2/D4 reopen settled BLSH choices and conflate retrospective evidence with forecasts

The BLSH-specific decision record is not in the audit's short owner-decision list but is directly referenced by its code:

- `blsh-brief-decisions-2026-11-03/DECISIONS.md:13-17`: eligible top **25 per side and position**, with full ranked lists one click away. Mapped v3 counts and `BlshCandidateLists` implement that presentation; the legacy snapshot does not. “Use top N” is not a new remedy needing a new size decision.
- `:27-39`: forecasts belong separately in trade comparisons; retrospective BLSH evidence may remain when forecasts are unavailable; a combined retrospective assessment must be justified for its retrospective purpose; forward decision claims require separate validation.
- `:35-41`: lead with league-scoring gap, separate supporting tracks, and do not treat equal weights as a validated headline. Raw-gap ordering is not automatically a bug because high-production players appear first. Audit the **remaining composite membership veto** separately from headline ranking and its retrospective justification.

The November 11 sustainability decisions require honest naming and out-of-sample evidence for persistence claims. They do not, by themselves, make the explicitly retrospective BLSH code a failed forecast. If decision 35 is intended to rename BLSH too, make that extension explicit; Fable itself lists the scope as a question. Do not declare a binding breach and simultaneously treat the scope as unresolved.

The adverse P2_transfer result is valid evidence **against promoting that transfer rule as a next-five forecast**. It is not sufficient to remove a same-window descriptive adjustment from all retrospective displays. Conversely, being descriptive does not make its association causal luck: `supportGap.ts:1-4` explicitly makes no causal-luck claim. Validate descriptive residual behavior, stability, missingness, attribution and ordinary-range coverage for that target; validate prospective decisions separately.

**Reject D2's suggested universal test:** FP is a weighted sum of correlated counts and GS can be negative. Neither has a simple Poisson-count distribution. A mid-p Poisson tail is not automatically uniform for discrete data, and equal BL/SH counts are not a correctness invariant for heterogeneous skewed production, asymmetric costs or a top-N interface. If a calibrated usual-range rule is chosen, specify the target, fitted distribution/empirical reference, parameter uncertainty, exclusion policy and expected tail coverage first; assess held-out coverage by player group and window size. Do not force equal candidate counts.

### R3. Forecast rule weakness confirmed, but narrow the claim and test the right estimand

`forecastEvaluation.ts:279-288` uses the P2−P0 MAE interval and **only the P2−P1 MAE point estimate**. It is not literally able to pass with P2 exactly equal to P1; it can pass on an arbitrarily small apparent improvement. The exact synthetic contrasts in Appendix A produce `forwardPromise=true` while P2−P1 RMSE is **+0.1 with CI [+0.05,+0.15]** and MAE improvement is merely −0.000001 with CI spanning zero. This confirms D5's weakness without a stochastic “add noise and it must always fail” oracle.

The saved actual FP results match Fable: P2−P1 MAE −.0006663 [−.0012142,−.0001693], RMSE −.0004197 [−.0010181,+.0001575]; P2_transfer−P1 RMSE +.0084155 [.0044435,.0122291]. Report the absolute units and small scale, not just significance.

**Keep decision 65:** freeze a primary paired squared-error contrast against the relevant reference and retain MAE secondarily. The reference-alone comparison must be the direct process-increment test, with practical effect size and uncertainty. Do not silently rewrite the old exploratory preregistered verdict; issue a newly versioned protocol/report. The old boolean only says to consider freezing a reserved protocol, not that performance or release was accepted.

**Scope limits that matter:**

- At each origin the prior, donor summaries and process model are rebuilt from dates before the window (`:155-176`); P2_transfer is the same fitting **algorithm**, not necessarily the exact frozen current snapshot coefficients.
- Evaluation requires a prior-season 50-game comparator, complete current and target tracks, five future appearances, no known team change across window+target and limited gaps (`:66-69,147-165`). Thus results are conditional on a stable/complete survivor population and do not validate rookies, injuries, trades or missing-GS windows. Future-dependent eligibility is not automatically data leakage into fitted inputs, but it changes the deployment population.
- Training gives equal total player weight (`:108-121`); evaluation losses are origin-weighted (`:248-265`). A player-cluster bootstrap preserves each player's repeated-origin dependence but does **not** turn the score into equal-player weighting. State the intended estimand. Shared games/team shocks remain a dependence issue; the runner already reports team-season and every-fifth sensitivities (`:299-319`), which the audit's summary omits.
- `baselineEvaluation.test.ts` is another experiment, not validation of the full shrunk/support pipeline. It evaluates unshrunk per-game/per-60 baselines against 10–20 subsequent usable games and uses its own comparison population (`:38-68,99-110`). Its reported improvement cannot validate A1's covariance or the final list decisions.

### R4. Distinguish mathematical identities, modeling choices and calibration

For M-008, `a = w / sd / √(w'Rw)` indeed yields **a'Va=1 for the supplied V** (`productionReference.ts:277-294`). It does not give the real gap unit variance “by construction.” The saved cross-sectional SD .998 is not a calibration test: it mixes players, estimated means and uncertainties, selected numeric cases, and heterogeneous exposure.

**Executed counterexample:** pass `V=I`, reference rate `[10,10,10]`, one-second exposure, and six equally likely observations whose deviations are `±3√3` in each coordinate. Actual normalized gaps are `[3,−3,3,−3,3,−3]`, population SD **3**, although the normalizer uses a'Va=1. Algebra can be correct while the covariance model is wrong. Test held-out centering, conditional variance and range/tail coverage, not one marginal SD.

D7's scalar shrinkage is a defensible constrained loss-minimizing estimator, though it can be less efficient than track/matrix weights. `observedCov + noise` is a **choice of metric and PSD-projection units** (`:239-247`), not an extra addition of that same noise into the final predictive covariance. The method-of-moments signal subtracts noise once. Without a specified intended loss or a predictive comparison, “noise counted twice” does not establish a numeric defect. Document the loss and compare alternatives; don't turn “more shrinkage for the noisy track” into an oracle for the existing scalar-weight contract.

The covariance at `:261` is an **unconditional estimator-error covariance under the fixed model**, not generally the conditional Bayesian posterior covariance for an arbitrary common weight. Hyperparameter uncertainty, nonstationarity and partial-track exposure (A1) prevent an unconditional claim that its scale is honest. A matrix alternative must also handle output constraints and covariance validity, not simply replace one formula.

Fable explicitly did not read `web/scripts/blsh/**` despite the prompt requesting read-only inspection (`audits/blsh-buy-low-sell-high.md:145-148`). This review inspected the dry-run, forecast and baseline-evaluation runners. The first two consume a pinned prebuilt `ORIGINAL-BLOCK-CATALOG.jsonl` (`currentDryRun.test.ts:52`, `forecastDevRun.test.ts:50`); they do not independently reconstruct its outcome units. Source-level dimensional consistency is not a fresh validation of the external historic block producer or its full data custody. That remains a limit on unconditional stage-2/4 acceptance.

M-009's conditional imputation algebra and M-016's dimensionless PSD checks are supported by source/tests. Their model assumptions are still assumptions: within-player block covariance need not be the exact conditional law of every differently weighted current-minus-reference vector. The implementation explicitly retains imputed-output variance separately and labels its scale uncalibrated (`supportGap.ts:200-241,280-292`). Keep those disclosures; do not infer calibrated confidence from “sound algebra.”

### R5. Correct two upstream/source-definition remedies

**Game Score, D6:** confirm that `outcomes` adds ES+PP+SH on-ice goals (`productionReference.ts:55-58`). The small one-PP-goal synthetic result is +.15. But replacing the sum with `es_goals_*` does **not** prove canonical 5v5: even strength may include 4v4 and 3v3. Fable's SAT strength is explicitly inferred, not source-verified. Preserve the named house variant and disclose its exact definition, or obtain a true matching-strength source before claiming Luszczyszyn parity. Test 5v5, 4v4, 3v3, PP and SH separately. Its real-data effect size remains Fable's dated aggregate, not a verified canonical-Game-Score difference here.

**Inherited FORGE claim, D8/M-002:** the W1 review and `BATCH-BC-CONSOLIDATED.md:54-66` already correct “all extra-attacker production is missing.” The classifier can include ordinary 6v5/5v6 in ES; PK omission and exclusive strength/net-state accounting are the real issues. Do not copy the −5.5% sample number as a measured BLSH effect or add a blanket extra-attacker term that could double count. Trace a qualified final forecast through Sko before assigning downstream magnitude. The fixture trade path establishes compatibility, not a live defective forecast.

## 4. Per-entry disposition

| Entry | Independent disposition and next action |
|---|---|
| 001 | Retain forecast-rule concern, but exploratory-only; direct fixed-contrast counterexample reproduced. Correct population/weighting and preregistration language (R3). |
| 002 | Unit/freshness paths supported; conditional inherited source risk, not live measured impact. Correct extra-attacker attribution (R5). |
| 003 | **Not sound as stated:** new false opportunity attribution reproduced (A2); uncertainty remains a working model. |
| 004 | Arithmetic is an explicitly named house variant; source-strength equivalence undetermined, and ES-only is not proof of 5v5 (R5). |
| 005 | Prior-only/leave-target-out construction supported. Cohort selection and metric need documented modeling target, not automatic replacement (R4). |
| 006 | Pre-window weighted means supported; **joint scorer handoff wrong under partial tracks** (A1). Stale served arm is a separate migration problem (R1). |
| 007 | Scalar shrinkage is a constrained model choice; covariance fails on A1 inputs. Posterior terminology and proposed matrix remedy need qualification. |
| 008 | Normalization identity sound for supplied covariance; no empirical calibration established. A1 can corrupt that covariance. |
| 009 | Conditional linear algebra supported, with working-covariance and missing-process uncertainty qualifications retained. |
| 010 | Sign rule implemented as described; top-N chosen already. Combined retrospective membership still needs its own justification, not a universal Poisson/equal-tail test. |
| 011 | Legacy snapshot misses current gates; **167/448 reproduced**. v3 gates are separate from actual loader/admission and need a successor contract. |
| 012 | Additive explanations/unknown separation covered by source and support tests; causal-luck and predictive interpretations remain expressly excluded. No new full source-evidence validation. |
| 013 | β=.5 within-player association is provisional; negative transfer test limits forecasts, not every retrospective use. Season allowlist is a frozen research guard, not permission to open reserve inputs. |
| 014 | Focused qualification tests pass; native policy is closed and complete-current-window provenance remains unestablished. “Sound” is not acceptance of real data. |
| 015 | Current stale label matches the frozen contract. Generalize all labels with the new contract, not a stand-alone current P2. |
| 016 | Covariance validation/geometry tests pass. Numerical validity is not statistical model validation. |

## 5. Follow-up priorities and unresolved choices

1. Fix A1 and A2 locally in the owning lanes with their counterexamples, before promoting arm C/opportunity context. Keep baseline weight 1.0 and the reserve boundary unchanged.
2. Choose the safe historical-preview behavior and define the successor snapshot/admission contract. No current-serving work is cleared by this review.
3. Reconcile BLSH-specific top-25, league-headline and retrospective decisions with any intended extension of sustainability naming/persistence decisions. Do not ask the owner to choose a list size already chosen.
4. Preserve and version the forecast protocol; design the new primary loss/contrast and operational population before reserved evaluation. Qualification, practical benefit and release are separate decisions.
5. Decide whether to retain the accurately documented Game Score variant or source genuine matched 5v5 inputs. No inferred source definition should settle that choice.

No requested engineering check was blocked. Deliberately unperformed work includes production verification, reserved-data use, a complete reproduction of historic external block/export custody, full-model refitting and current native-packet admission. No denied or uncertain external action occurred.

## 6. Checkpoint record and source pins

- Start: inspected repository instructions and dirty state; claimed this report only. Read source and owner context without modifying active lanes.
- Material checkpoint: notified the coordinating reviewer of settled top-25/retrospective decisions, then of A1/A2, the exact legacy count reproduction and the arm-C parser barrier.
- Final verification: focused tests and offline fixtures completed; source differences from the audit commit were empty for the named BLSH paths. Checked report whitespace and retained only the owned report change. No process, server or output-writing research run left active.

SHA-256 source pins for Appendix A:

- `productionReference.ts`: `ec3afb69ff6001068586d50faf718585f17392524196cb343020f3b98eda192e`
- `opportunity.ts`: `9d35fc8a9c09f34caa9d618e6e1ae78f0b9e5e05113b18e2cf2b302610f83e1f`
- `forecastEvaluation.ts`: `8d7f9c4a010fe94962cd3168ff796ef505375117a3369af4b0acc408619d5634`
- `researchSnapshot.ts`: `dc4cbb57a93a6e2cdae66d48b0519704c17f0a7d49451bfa546eafeb885b2cb7`
- Saved October 28 snapshot: `2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8`.

## Appendix A. Reproduce locally without services or file writes

Run from `web/` with the existing TypeScript package. These are **current-defect reproduction assertions**, not desired regression expectations after correction. Only the named pure modules and local snapshot are read; no output artifact is written.

```sh
node <<'NODE'
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),assert=require('node:assert/strict');
const allowed=new Set(['productionReference','opportunity','supportGap','forecastEvaluation','researchSnapshot']);
const cache={};
function load(name){
  if(!allowed.has(name))throw Error('Unapproved import '+name);
  if(cache[name])return cache[name];
  const filename=path.resolve('lib/buyLowSellHigh',name+'.ts'),e=cache[name]={};
  const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new vm.Script('(function(exports,require){'+js+'\n})',{filename})
    .runInThisContext()(e,s=>load(s.replace('./','')));return e;
}
const pr=load('productionReference'),op=load('opportunity');
const sn=load('researchSnapshot'),fe=load('forecastEvaluation');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
// A1: one GS game inherits twenty games of exposure.
const games=Array.from({length:20},(_,i)=>({id:i+1,season:20262027,
  date:`2026-10-${String(i+1).padStart(2,'0')}`,gamesPlayed:1,seconds:1200,
  tracks:[3,1,i===0?1:null]}));
const b=pr.weightedBaseline(games,20262027,'2026-11-01',[20232024,20242025,20252026]);
const [h,reason]=pr.weightedHistorySummary(b,1,'F');
assert.deepEqual(b.trackGames,[20,20,1]);assert.equal(reason,null);assert.equal(h.seconds,24000);
const I=[[1,0,0],[0,1,0],[0,0,1]],zero=I.map(r=>r.map(()=>0));
const prior={position:'F',donors:2,donor_ids:[2,3],mu:[.001,.001,.001],omega:I,
  signal:I.map(r=>r.map(x=>x/1200)),mean_cov:zero,metric:I,
  variance_component_eigenvalues:[1,1,1],donor_end_dates:[]};
const ref=pr.personalReference(prior,h),w=ref.personal_weight;
near(w,20/21);const actual=((1-w)**2+w*w)/1200;
near(actual/ref.covariance[2][2],19.095238095238095);
console.log('A1',{trackGames:b.trackGames,seconds:h.seconds,weight:w,
  claimedVariance:ref.covariance[2][2],actualVarianceAtSameWeight:actual});
// A2: unchanged usage, but shrinkage is called an opportunity effect.
const history=op.summarizeOpportunityHistory(Array.from({length:20},(_,i)=>({
  seconds:1200,ppSeconds:180,goals:1,assists:0,ppPoints:i%2,tracks:[3+i%2,1,i%2]})),
  {cohort:{ppRate:[.001,.00025],goalShare:1}});
const r=op.compareOpportunity(history,{games:5,seconds:6000,ppSeconds:900,observed:[17.5,5,2.5]});
near(r.changes.toi.delta,0);near(r.changes.pp.delta,0);
near(r.tracks[0].perGame.expected,17.5);near(r.tracks[0].adjusted.expected,12.95);
near(r.headline.opportunityEffect,-4.55);assert.equal(r.headline.opportunityShift,'decrease');
console.log('A2',r.headline);
// R1: real saved file, legacy gate counts and arm-C rejection.
const s=JSON.parse(fs.readFileSync('lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json','utf8'));
sn.parseCurrentResearchSnapshot(s);assert.equal(s.mapperVersion,'blsh-display-profile-v1');
assert.equal(s.profiles.length,729);assert.equal(s.profiles.filter(p=>p.score.value!==null).length,551);
for(const [side,expected] of [['BL',[264,77,30,19,95]],['SH',[184,46,10,28,72]]]){
  const rows=s.profiles.filter(p=>p.score.list===side);
  const thin=p=>p.evidence.reference.personalGames<20,short=p=>p.evidence.window.games<5;
  const conflict=p=>side==='BL'?p.tracks[0].gap<=0:p.tracks[0].gap>=0;
  const counts=[rows.length,rows.filter(thin).length,rows.filter(short).length,
    rows.filter(conflict).length,rows.filter(p=>thin(p)||short(p)||conflict(p)).length];
  assert.deepEqual(counts,expected);console.log('R1',side,counts);
}
const c=structuredClone(s);c.referencePolicy.arm='C_weighted_personal_baseline';c.referencePolicy.stale=false;
assert.throws(()=>sn.parseCurrentResearchSnapshot(c),/selected provisional reference/);
// R3: negligible MAE increment, statistically adverse RMSE increment still passes.
const contrast=(arms,track,maeDiff,maeDiffCI,rmseDiff,rmseDiffCI)=>
  ({arms,track,maeDiff,maeDiffCI,rmseDiff,rmseDiffCI,n:100,clusters:20});
const verdict=fe.decision([
  contrast(['P2','P0'],'fantasy_points',-1,[-2,-.5],-.5,[-1,-.2]),
  contrast(['P2','P1'],'fantasy_points',-.000001,[-.1,.1],.1,[.05,.15]),
  contrast(['P2','P0'],'goals_plus_assists',-1,[-2,-.5],-.5,[-1,-.2]),
  contrast(['P2','P0'],'wigo_game_score',-1,[-2,-.5],-.5,[-1,-.2])]);
assert.equal(verdict.forwardPromise,true);console.log('R3',verdict);
// R4: assumed unit variance does not give the data unit variance.
const reference={rate:[10,10,10],covariance:I,omega:zero,
  personal_weight:1,personal_n:50,personal_seconds:50},z=[];
for(let j=0;j<3;j++)for(const sign of [-1,1]){
  const y=[10,10,10];y[j]+=sign*3*Math.sqrt(3);
  z.push(pr.productionGap(reference,y,1).normalized_gap);
}
near(Math.sqrt(z.reduce((sum,x)=>sum+x*x,0)/z.length),3);console.log('R4',z);
console.log('All current-defect reproduction assertions passed.');
NODE
```

Focused existing-test command actually executed, exit 0, 296 passed / 111 skipped:

```sh
env -u BLSH_RETAINED_TEST_ROOT -u BLSH_DEV_HISTORY -u BLSH_V1_EXPOSURE_DIR \
  -u BLSH_V1_RUN_DIR -u BLSH_DISPLAY_OUT -u BLSH_PARITY_RECEIPT \
  npm test -- --run \
  lib/buyLowSellHigh/productionReference.test.ts \
  lib/buyLowSellHigh/supportGap.test.ts \
  lib/buyLowSellHigh/opportunity.test.ts \
  lib/buyLowSellHigh/forecastEvaluation.test.ts \
  lib/buyLowSellHigh/currentInput.test.ts \
  lib/buyLowSellHigh/currentWindows.test.ts \
  lib/buyLowSellHigh/researchSnapshot.test.ts \
  lib/buyLowSellHigh/researchSnapshot.server.test.ts \
  lib/buyLowSellHigh/displayProfile.test.ts \
  lib/player-cards/retainedBlsh.test.ts
```

Passing the existing suite does not clear A1/A2; the new fixtures expose missing invariants. The 111 skipped checks are not empirical/parity evidence. Two shell documentation/path inspections initially used the repository-relative path from `web/` and found no file; they were corrected without creating collateral files. The final Appendix A script was extracted from this report and executed successfully.
