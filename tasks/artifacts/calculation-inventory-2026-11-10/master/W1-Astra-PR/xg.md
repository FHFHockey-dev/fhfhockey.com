# Independent peer review: W1-1 xG

Reviewed 2026-11-11 on `octoberBranch`, checkout HEAD `f6cdee012b8c16d330362cb88f81435d17f975ff`.

Sources: `../audits/xg-part1.md`, `../wave1-prompts/w1-1-xg-part1.md`, the xG packet and TRIAGE brief, `../OWNER-DECISIONS.md`, current implementation, and committed model/dataset artifacts. This is an additive review, not an implementation or a replacement of the original audit. Original audit and owner decisions were not edited.

## Assessment

**Accept the main leakage and stale-feature findings as fix-plan inputs, with the corrections below. Do not adopt the original remediation text verbatim.** Independent local checks confirm that the older artifact contains prohibited outcome features, the corrected candidate still uses a future-dependent flurry flag, isotonic calibration mishandles tied inputs, and rich rebound labels can change when an unrelated game is batched alongside them.

The original table really does contain 60 entries: 16 sound, 23 mis-specified and 21 wrong. Those counts describe Fable's classifications, not 60 new independent certifications. In particular, M-XG-002 contains an actual implementation defect, not only a methodological choice. Historical DB state and the unpublished 230-game refit are not independently reproduced here.

### Independently reproduced artifact metrics

All figures below were recalculated from `holdoutScores` using **only rows marked `split: test`**, natural-log loss, Brier loss and tie-aware Mann–Whitney AUC. Validation rows were excluded because the older model's isotonic calibrator was fitted there.

| Artifact / slice | Shots | Goals | Mean prediction | Observed rate | Log loss | Brier | AUC |
|---|---:|---:|---:|---:|---:|---:|---:|
| Corrected candidate `cfg2afcf561`, all | 17,834 | 1,295 | 0.07629430 | 0.07261411 | 0.24342914 | 0.06495965 | 0.71239226 |
| Corrected candidate, `strengthState = EV` | 14,305 | 891 | 0.06565139 | 0.06228591 | 0.21711971 | 0.05640692 | 0.73559619 |
| Earlier `cfg9bac2706`, all | 17,834 | 1,295 | 0.06852517 | 0.07261411 | 0.14210110 | 0.03969020 | 0.93360474 |

Artifact sources:
- `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
- `web/scripts/output/xg-approval-run-20260522/logistic_l2-s20252026-p1-st1-f1-cfg9bac2706/model-artifact.json`

The dramatic older-model AUC is not evidence of model quality. Its feature contract actually fails on `isShortSideMiss` and `missReasonBucket`, while the candidate's contract passes despite retaining `isFlurryShot`. A future-dependence fixture establishes that additional leak directly, independently of any AUC benchmark.

## Corrections and additions to carry forward

### 1. The test set is not mostly playoffs

**Correct the summary include/exclude table and M-XG-018.** The candidate's test `rowId` values identify **139 regular-season games / 11,638 shots and 69 playoff games / 6,196 shots**. Playoff shots are 34.74%, not a majority. Its recorded test dates are 2026-03-30 through 2026-05-21. It is a late-season-plus-playoff holdout with a substantial playoff share.

The 0.735596 EV AUC is also not a certified 5v5 AUC: `strengthState = EV` can include other equal-strength states. The holdout rows do not carry `strengthExact`. Comparisons with a published 5v5 result require a matching event universe, seasons, empty-net policy and split. AUC 0.77–0.78 from another dataset is useful context, not a universal production acceptance threshold.

### 2. Fix the printed GSAA reference and follow the newer owner decision

**M-XG-039's reference formula is wrong.** It should read:

`GSAA = shots against × (1 − league save percentage) − goals against`.

The audit prints league SV% × SA − GA. With 30 SA, league SV% 0.900 and 3 GA, the correct result is 0; the printed formula gives 24.

The implementation does instead assign heuristic xGA − GA to `gsaa` (`web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1762-1782`), so the underlying defect is confirmed. But D6's proposed response, “rename GSAA to GSAx,” is **superseded** by owner decision 10: retain NST's GSAA definition and calculate it for the matching aggregate season/strength/date population. GSAx would be a separate column. Decision 12 also requires hiding heuristic xG now; wiring or relabelling the bucket estimator is not the approved next step.

### 3. Correct the drift-threshold magnitude; distinguish drift from calibration

**M-XG-043's “about 11 standard errors at 1,000 shots” is false.** At a 7% Bernoulli rate, `sqrt(0.07 × 0.93 / 1000) = 0.00807`; a 0.015 difference is about **1.86** standard errors even before allowing for game clustering or baseline uncertainty. A fixed threshold can still be poorly calibrated to sample size, but the cited magnitude does not support the stated criticism.

`buildArtifactDriftReport` compares current mean xG to baseline mean xG and current goal rate to baseline goal rate separately (`web/lib/xg/aggregates.ts:1010-1083`). That is a distribution-drift diagnostic, not a contemporaneous prediction-minus-outcome calibration test. Retain drift monitoring and add the latter separately. Do not replace one with the other or assume every shift in the mix of shot quality is model failure.

### 4. The optimizer is not converged; the L2 row-count diagnosis needs precision

The candidate artifact records training mean prediction 0.076707 versus goal rate 0.071700. With an unpenalized intercept and this unweighted training objective, a converged finite optimum has mean residual zero. The difference supports the nonconvergence finding.

However, `binaryLogistic.ts:93-125` already divides the data gradient by total weight before adding `l2 × weight`. Its objective is **mean log loss + λ/2 × squared weight norm**. D3 should not imply that the implementation accidentally makes λ grow with row count. Different libraries use different sum/mean conventions, so translating λ or C requires care. The rarity/scaling of individual features and a validation sweep can justify a different penalty; the sample does not establish `0.0005` as a production setting.

Use gradient-norm/objective convergence diagnostics as well as intercept calibration. Matching the training mean is necessary here, but not sufficient to prove every coefficient has converged. The condition is weighted when example weights are used.

### 5. Upgrade isotonic tie handling from “mis-specified” to an actual defect

The tie concern in M-XG-002 / D17 is directly reproducible using `fitProbabilityCalibrator`:

- Ten identical predictions of 0.2, seven zero labels followed by three one labels in row-ID order: prediction at 0.2 is **1e-9**.
- The same prediction/label pairs with reversed row IDs: prediction is **0.3**.
- Correct pooling of the one identical input value gives 0.3 regardless of IDs.

The cause is one initial block per row, tie-breaking by row ID, no pooling of equal inputs, and returning the first matching block (`web/lib/xg/calibration.ts:326-364,416-425`). Fix equal-input pooling and add permutation-invariance tests. Stepwise interpolation and extreme 0/1 blocks are separate modeling choices, not intrinsically invalid isotonic regression. Minimum block weights or linear interpolation should not be presented as mandatory mathematical repairs.

### 6. The flurry leak is proven, but the proposed AUC tests are not correctness tests

A direct call to `buildFlurryContexts` on two same-team shots three seconds apart marks the first shot `isFlurryShot = true`. Removing the later shot changes that first flag to false. `nhlFlurries.ts:209-245` computes membership from the completed sequence. `baselineDataset.ts:160-168,239-245` selects the field but does not forbid it.

Keep D2's prefix-invariance test and the backward-only feature recommendation. Add deterministic feature-lineage and target-counterfactual tests. D1/D8's AUC > 0.85 and D13's “AUC falls well below 0.95” can be investigation alarms, **not proof of leakage or proof of its removal**. Legitimate AUC depends on the prediction task and population; a leaky model can also have a modest AUC. Do not make passing a numerical upper bound substitute for examining how features are created.

M-XG-034's survival-product arithmetic is sound. A negative flurry coefficient plus survival adjustment is not, by itself, proof of a precisely quantified “double discount”; the feature leakage is the independently established problem.

### 7. State the historical DB / sample-refit evidence limits explicitly

The registry state, row counts, last populated dates, shift-age missingness percentages, blocked-shot owner/zone examples and “96% source loss” were reported by the original audit, not re-read from production in this review. The committed artifacts substantiate the old model's feature selection, not the current production registry state.

The 19,790-shot extract, offline fitting program, fitted models and bootstrap outputs were not included with the audit. Consequently the 0.748/0.761 AUCs and confidence intervals are **reported sample experiments**, not independently reproducible candidate performance or model approval. The original audit acknowledges the sample limitation; keep that qualification in every summary. Comparing many variants on the same reported test set also cannot establish a final untuned deployment estimate.

Before relying on that experiment for implementation choices, preserve the permitted local extract or its reproducible input manifest/hash, game IDs/splits, feature/version contract, fitting code, hyperparameters, seed, predictions and bootstrap definition. Refit only on the approved local copy. Do not run another broad production extraction simply to reproduce this review.

### 8. Do not overstate “unset artifact path means no scoring”

The normal scoring request fails with HTTP 400 when neither an environment path **nor a query path** is supplied. The route accepts `modelArtifactPath` before consulting the environment (`web/pages/api/v1/db/update-nhl-xg-shot-predictions.ts:66-75,365-374`). An unset environment variable is not proof that every possible invocation must fail.

A locally executed artifact-contract check rejects the older model. The route enforces this contract at lines 406-415. That does not retroactively hide already-persisted predictions or aggregates.

For FORGE, the code independently confirms the owner note: no model-version env override makes `fetchInHouseTeamStrengthPrior` return null before a query, then `fetchTeamStrengthPrior` falls back to `nhl_team_data` (`web/lib/projections/queries/team-context-queries.ts:184-189,280-285,339-381`). The missing-season-filter hazard is latent under an override, not demonstrated current contamination of FORGE. The fallback's own completeness/cutoff contract is outside this xG review.

### 9. Keep the consumer-specific demotion plan; correct the Timeline failure mode

The original owner question “demote … that hides last season's in-house xG” is unsafe. The current readers differ:

| Consumer | Independently checked selection behavior |
|---|---|
| Team Metrics Timeline | Reads approved aggregate rows directly, with no model-version or live-registry filter (`MetricsTimeline.tsx:158-167`). |
| Homepage game analytics | Resolves an active/champion, approved registry model, then queries its version/feature version (`homepageGameAnalytics.ts:369-394`). |
| xG Lab | Resolves the latest model version from its selected aggregate table unless explicitly supplied (`pages/api/v1/underlying-stats/xg.ts:265-281`). |
| FORGE team prior | Requires the env override described above; otherwise uses another source. |

**D27's suggested double-row failure is not what the current Timeline adapter does.** `metricsTimelineData.ts:50-65` keeps the first row for a game/date and rejects ambiguous different-game dates. A local fixture with same-game xGF values 3 and 7 returns one point with 3, not 10. The remaining defect is unpinned model selection: feature version/update order can pick a model without registry eligibility, and registry demotion alone does not exclude it. Add an active-model-selection test, not only a non-double-counting test.

Owner decision 5 explicitly leaves the champion serving pending a separately approved plan with registry backup. Enumerate readers, caches and historical consumers and define rollback before proposing a demotion. No registry change or aggregate deletion is authorized by this review.

### 10. Replace superseded rush and empty-net recommendations

- **Rush:** owner decision 8 is 4 seconds, no faceoff sources. D9's positive fixture at five seconds contradicts that contract. Use eligible-source examples at 4 s (true) and 5 s (false), and a faceoff at 1–4 s (false). Code still defaults to 10 seconds (`nhlRush.ts:5,214-220`). The blocked-shot zone asymmetry needs a preserved provider-shaped fixture before repair; this review did not independently re-obtain the original raw samples.
- **Empty nets:** decision 7 excludes empty-net shots from headline team/player/goalie xG totals and reports them separately. D5's unresolved choice about inclusion is no longer open. The two owner-relative net states must remain distinct. Avoid implementing exclusion using the current either-net-empty flag without specifying whether a shot against a present goalie with the shooter's own goalie pulled belongs to the retained population. The owner text explicitly calls for that distinction; preserve it in fixtures and labels.
- **Headline:** decisions 6/12 favor labelled NST headline xG and retire/hide the bucket estimate until a clean trained replacement is approved. Do not ship a renamed bucket estimate as the next step.

### 11. The shot-assist pagination issue is real; the measured loss is not established

`update-nhl-xg-shot-assists.ts:181-218` independently confirms unpaginated cross-products of up to 200 game IDs and 500 event IDs; local `supabase/config.toml:18` sets `max_rows = 1000`. This is sufficient to flag truncation risk. It does not establish the hosted setting, request sizes actually used, exact lost percentage or that all sparse output is caused by truncation. Shot-assist eligibility itself filters heavily.

Add a capped-client fixture with more than 1,000 matching prior rows and assert exact `(game_id,event_id)` coverage. Preserve source, eligible and resolved counts for a bounded future run. Do not use the roughly 158 stored rows as a measured 96% drop rate without the eligible denominator.

### 12. Created xG needs an attribution contract, not an unexplained conservation rule

The rolling-window defect is supported: rows are created for credited events, and `buildRollingRows` slices the last N such rows (`createdXg.ts:195-225,227-267,341-359`). That is not automatically the last N games played.

The cross-component credit sum can exceed a shot's xG. Whether that is inherently “wrong” depends on whether the metric promises **exclusive apportioned credit** or deliberately nonexclusive contributions. Capping the sum at shot xG is a reasonable design for exclusive credit, not a universal identity for every participation metric. Keep components labelled as proxies and decide their attribution contract before using a conservation test. Fix the games-played denominator independently.

## Other findings independently supported at source level

- **Rich rebound collision (M-XG-015/D18):** `reboundRichLabels.ts:125-128,173-178` indexes possession by event ID only. A synthetic game that labels a rebound when processed alone changes to `possession_break` / rebound 0 when an unrelated game with the same event IDs is appended. Preserve `(gameId,eventId)` identity throughout the chain.
- **Shot map (M-XG-052/D10):** current transforms map (−70,20) and (70,−20) to horizontal positions −20 and +20 (`ShotVisualization.tsx:393-416`), confirming the 40-foot mirror discrepancy for equivalent opposite-direction locations. Attack direction should come from game/team context rather than shot x alone.
- **Probability-space boosting mismatch (M-XG-022/D12):** installed learner fits residuals against an additive probability-scale value but applies a sigmoid only at prediction (`@fractal-solutions/xgboost-js/src/xgboost.js:22-41,120-125`); repository scorer repeats it (`shotFeaturePersistence.ts:593-601`). The mismatch is independently confirmed. Choosing a replacement solver is future implementation work.
- **Residual chronology (M-XG-028/D19):** unpadded event IDs are lexicographically ordered (`residualSkill.ts:40-43`). A numerical chronology invariant is warranted; the claimed optimal shrinkage magnitude was not independently fit.
- **Freeze labeling (M-XG-055/D15):** any immediate positive-gap stoppage qualifies without its reason (`nhlRebounds.ts:144-151`). Same-second frequency and error magnitude remain unmeasured here.
- **Miss reason mapping (M-XG-054/D14):** substring `short` and `crossbar` map as reported (`nhlMissReasons.ts:36-48`). Exact reason fixtures are appropriate. Merely moving the `over` check ahead of `crossbar` would not fix the string `above-crossbar`.
- **Travel (M-XG-016/D16):** team 68 is absent from the built-in map, previous venue timezone is necessary for previous-local-date calculation, and “four days” uses an inclusive 96-hour window (`travelFatigue.ts:68-102,192-201,282-307`). The affected season count was not measured here.
- **Operational feature drift (M-XG-045):** minimum scoring batch gate exists (`featureCoverage.ts:180-187`). Say inactive on undersized normal batches, not universally impossible: backfill scoring passes pages of unscored rows to the same scorer (`update-nhl-xg-shot-predictions.ts:440-480`). Missing-field contract checks remain separate and run for each supplied row (`shotFeaturePersistence.ts:356-376`).

## Verification and limits

**Passed:** four existing focused Vitest files, 13 tests:

`npm test -- --run lib/xg/calibration.test.ts lib/xg/binaryLogistic.test.ts lib/supabase/Upserts/nhlFlurries.test.ts lib/xg/reboundRichLabels.test.ts`

**Passed as bug reproductions:** read-only local `ts-node` calls directly into the existing implementation for (1) tied isotonic prediction row-ID sensitivity, (2) flurry prefix non-invariance, (3) old/candidate artifact feature-contract behavior, (4) cross-game rich rebound collision, and (5) same-game Timeline deduplication. These were in-memory fixtures, not persistent changes to application tests. Passing the 13 existing tests does not clear the reproduced defects.

**Passed:** independent Python recalculation of committed holdout metrics, game-type composition and original verdict counts; source tracing of the specific findings above. An initial metric scratch command had a syntax error; it was corrected before any numerical result was used.

**Not run:** production DB queries, provider requests, browser verification, full training/refits, full application test suite, lint/typecheck/build, migrations, backfills or deployment. No credentials were inspected. No code, original audit or owner-decision file was changed. No commit or push was made.

This is a targeted skeptical review of the consequential findings and proposed fixes, not a fresh certification of every lower-risk inventory entry. Entries not independently covered above retain their original evidence status. Before implementation, the next plan must carry the corrected owner contract, a durable local training dataset/version lineage, an explicit consumer migration/rollback design, and fresh held-out acceptance results after feature repair.
