# B v2: three fixed multi-output development pipelines

**Planning only; no implementation, numeric access, fitting or scoring authorized by this proposal.** This supersedes the SOG-only scope and proposed 1%/5% nomination gates in B-APPROVAL-PROPOSAL.md (preserved SHA256 b5f9b454a58c9c3aad30c2ad40c204f70b7d157bdb6a170574b697ddd147dd59). Those restrictions were coordinator choices, not missing-field limitations or accepted scientific requirements. TJ's requested per-metric comparison is represented here by three complete multi-output pipelines, not separate searches or per-head tuned recipes.

## Exact approval wording

“Approve one private retrospective development comparison of exactly three fixed complete pipelines—expanding appearance means, recent-minutes × own historical rates, and recent-minutes × fixed pooled/shrunk historical rates—emitting G, A, SOG, HIT, BLK, positive-TOI-conditional PIM and conditional TOI. Use only the independently accepted revised-A normalized dataset dated October 7, 2025–January 13, 2026, with the formulas, d−2 chronology, exclusions, fallbacks, folds and single-run budget in B-MULTIOUTPUT-APPROVAL-PROPOSAL-v2.md. Require independent authority/allocation/code/runtime/synthetic acceptance before execution. Report per-target paired development losses, coverage, uncertainty and assembled-vector checks; no numerical improvement gate is required to report the scores, and there is no automatic promotion, per-target winner blend or consumer change. Retain the baseline unless a separately approved decision supports a change. Keep PPP/goalies deferred, January 14 onward closed, the original 829-span operation unstarted, and today's live pilot unchanged. No new source acquisition, production writes or deployment.”

Approval must bind this version/hash. It expands the prior one-active-head planning budget to three seven-output pipelines; it does not authorize the historical 73-slot menu. No execution is permitted merely because this draft exists.

## Inputs, population and immutable evidence

Durable revised-A root: `/Users/tim/Documents/FHFH-private/forge-core-skater-validation-20261015-v1/`.

| Artifact | SHA256 |
|---|---|
| protocol/reviews/support-review-v1.json | 6259940706360699ef359d64f1623ff5ec9881f2b58459013642d3cbde9e9baa |
| protocol/a-terminal-receipt.json | 5bf02fb550df10776394e0161b6c55de84b22afa8d3bd8c5a167424411a9b4fe |
| reports/support-counts.json | f0403b5744ea497bd91dd0379abe0f1b4ad88d4b26b9d01ceb1f85d5ebe99003 |
| labels/validated-records.json (inherited terminal binding; not read by coordinator) | e19b9753be67b7011b452d50f909055864a88c64c5959594617624a667c54c0e |

Each of seven targets has 15,983 validated positive-TOI unique player-games, one zero-TOI exclusion, 825 skaters, 444 games and 92 dates. These are target-support counts, not guaranteed forecast counts. Sparse/no-history availability and pool availability still determine forecast coverage. The archive is not a complete scheduled opportunity population. All historical work is exposed retrospective development, with zero original-as-of qualification.

Use only pinned normalized records and required identity/provenance metadata. Do not reopen mixed source archives or auxiliary goalie/PPP bodies. A lossless adapter maps CONDITIONAL_SKATER_MINUTES to legacy TIME_ON_ICE_PER_GAME in minutes, preserving IDs, game/date, historical membership, masks and unique player-game keys. Independently verify units, support and round-trip equality. Preserve A's positive-TOI PIM rule: missing/invalid/zero TOI and penalty-only cases excluded; missing target is not zero; valid zero counts remain valid. No reconstruction of excluded rows or use of current identity positions as historical features.

## Fixed dates and chronology

| Period | Purpose | Per-target validated upper bound |
|---|---|---:|
| Oct 7–Nov 16, 2025 | Seed history only | 6,480 |
| Nov 17–30 | Development fold 1 | 2,340 |
| Dec 1–14 | Development fold 2 | 2,232 |
| Dec 15–Jan 2, 2026 | Development fold 3 | 2,879 |
| Jan 3–7 | Development fold 4 | 792 |
| Jan 8–13 | Separately reported exposed continuation | 1,260 |

December 19 is absent; do not fill it. The four folds total 8,243 supported player-games; the continuation adds 1,260, for at most 9,503 scored opportunities per target/pipeline. All periods are exposed, not untouched evaluation. January 14 onward remains reserved/closed; no historical untouched status is asserted.

At day d use only admitted history dated at most d−2, beginning Oct 7. Actual source/validation/execution clocks remain separate; the lag is a retrospective reconstruction rule, not proof of original availability. Forecast envelopes contain no current-day outcomes. Existing evaluator stages each day's scoring values only after all three forecast vectors/masks are frozen and hashed. This is procedural isolation, not a cure for prior exposure.

Recipes remain fixed through all folds and the continuation. History summaries may update deterministically under d−2; no adaptive model selector, tuning or retrospective replacement. Report folds 1–4 pooled and separately, and Jan 8–13 separately; do not use continuation to revise policies or create a preferred mixture. No winner is automatically deployed at the endpoint.

## Three complete pipelines, all seven outputs

For any count k in G/A/SOG/HIT/BLK/PIM, let Ck be the sum of eligible own prior counts, Ek the sum of minutes for those same valid target appearances, and nk their count. Let m5 be mean positive finite TOI over the last up-to-five eligible own prior appearance rows. Let Rpk be total eligible skater count k divided by total matching eligible skater minutes, including own records. All inputs are all-strength; no position/strength pooling, PP-role, news or teammate covariates are admitted. Current source scope is one season, so helper same-season history is expanding history.

| Complete pipeline | Each count k | Reported conditional TOI |
|---|---|---|
| M0 expanding anchor | Ck / nk | Own expanding mean minutes |
| M1 own rate / recent exposure | m5 × Ck / Ek | m5 |
| M2 fixed pooled shrinkage | m5 × (Ck + 180 × Rpk) / (Ek + 180) | (own total minutes + 10 × eligible pool mean minutes per appearance) / (own appearances + 10) |

The 180 pseudo-minutes for count rates and 10 pseudo-appearances for TOI are existing fixed helper recipes, not grids or newly estimated strengths. This is exactly three complete vectors. M1/M2 count heads use the same internal m5; M2's reported TOI is the separate shrunk TOI estimator. Log both and explicitly disclose that M2 counts do not multiply its reported TOI head. This is an empirical multi-output pipeline, not a claim of one shared latent exposure. Requiring counts to use M2's reported TOI would be a different recipe and must not be silently substituted.

No supported core target currently has a demonstrated missing-input blocker for these formulas. PIM rate × minutes is a testable conditional-mean hypothesis, not a required causal model: penalties can affect realized TOI, so only prior predicted exposure may be used. No actual current-game minutes in prediction. G/A are direct count methods, not a shot-conversion/on-ice teammate architecture. No strength-specific, finishing, distribution or participation claims. TOI needs no count likelihood assumption and is scored in minutes squared.

Exact references, inspected only as source text:

- `forge-full-development-20261014-v3/code/research_models.py`, SHA256 734fa6195c9fe0d3d9acef09c64c9c2607e79d2766a32dff289f3a5ffdc4e516, historical_baselines.
- Same root `code/fit_families.py`, SHA256 abbc97e7d8cf575f05b76ba76473d2da777036bf71b2a8618efdad3f1288fee4, pure fallback semantics only.

New wrapper must restrict outputs to season_rate/role_aware/empirical_bayes with prior_minutes=180 and unused recent_weight fixed at0.5; discard unused estimates without scoring/selecting them. Do not execute old skater_trials/choose entrypoints, PARAMETERS grids, prior selected blends or obsolete MAE/sample/percentage guards. Any focused helper extraction requires independent synthetic/source review before data access.

## Complete fallback and coverage contract

- Eligible positive-TOI records enter windows once, after revision consensus. Preserve the helper's coupled availability: finite recent target support and finite positive recent minutes are needed even for M0. Do not silently make the anchor more available.
- No eligible own history for a target → same eligible pool appearance-weighted target mean for all three pipelines, including TOI. Empty pool → missing, not zero. This fallback is distinct from the exposure-weighted count-rate prior used by M2.
- Own target history but missing required recent support → explicit omission, no new fallback. Existing helper pool-rate-empty branch uses own rate if defined; test this branch without assuming it can occur with admitted own positive exposure.
- Preserve per-target requested, eligible, predicted, baseline-covered, paired, omitted and fallback counts/reasons by day/fold. Primary paired loss uses a fixed M0-covered population per target. If a challenger misses any M0-covered case, report coverage failure and do not present its smaller-intersection loss as the primary comparable score. Intersection results may be secondary with denominators; observed valid outputs are still retained. No post-result row deletion or zero filling.
- Report own-history bands0/1–4/5+; prior F/D/**UNKNOWN**; m5 below12/12–below20/20+/**UNKNOWN_NO_OWN_HISTORY_OR_SUPPORT**; prior recorded-team difference/no difference/unknown. No-history fallback rows explicitly occupy unknown position/usage buckets. Never use target-day position/actual minutes or invent pooled m5. Groups are descriptive, not nomination vetoes, and all nonempty groups retain counts. Archive-derived team changes are not authentic pregame trade/role information; rookie/return/current-season qualification remains unverified.

## Per-target evaluation and uncertainty

For each of seven outputs independently, primary mean score is player-game-weighted MSE (w=1) on the fixed matched population. Paired gain for each challenger is mean[(y−M0)^2−(y−Mc)^2], positive better. Publish absolute gain in squared target units and relative gain only when baseline MSE>0. Baseline zero loss means relative gain undefined, not infinite improvement. Secondary RMSE, prediction-minus-observation bias, MAE and player-balanced MSE are descriptive, not alternative winner-selection criteria.

Report every pipeline/head/fold, four-fold pooled result and separate Jan8–13 result, plus fallback/coverage and group summaries. Counts support these analyses but actual evaluation denominators remain gated by history availability. Do not require 1%, 5% or another invented predictive threshold merely to observe/report scores. A negative or small gain is a legitimate retained result, not grounds to rerun.

Exploratory paired calendar-block sensitivity: 2,000 draws using seven-day moving blocks over Nov17–Jan7, fixed seed20261015, empty calendar dates retained; paired day-level loss sums/counts are resampled together across all heads/pipelines, with ratios recomputed. Predeclare one fourteen-day sensitivity using2,000 additional draws. Use 95% percentile sensitivity intervals, per-date contributions and concentration diagnostics; no automatic significance claim, multiple-head discovery or chosen favorable block length. Repeated players, selective archive coverage, exposure and nonstationarity limit interpretation. If dependence assumptions are not defensible, report intervals as uninterpretable and retain descriptive paired differences. A full inferential promotion claim would need separately approved margins, multiplicity/error family, sample horizon and prospective endpoint.

There is no automatic selection/promotion gate in this B. Observed per-target rankings can be reported but cannot create a fourth “best head from each pipeline” vector. M0 remains the operational/default candidate; unconvincing or conflicting gains leave it unchanged. Even convincing-looking development gains only motivate a separately approved decision/confirmation protocol. No practical margin is inferred from the results.

## Combined-output checks

Retain the three complete seven-output vectors on a declared common-support set, alongside per-target sets. Verify identity/game/date/cutoff and unit consistency; finite nonnegative admitted values; missing versus zero; same frozen source/chronology; coherent fallback masks and reproducibility. Check G≤SOG for assembled predictions and report violations, including baseline violations. Do not clip/reconcile, substitute a head or remove inconvenient cases after scoring. Such failures limit assembled compatibility even when a head's loss is computable.

Show a matrix of seven per-target paired losses and coverage for each full pipeline. An optional descriptive vector summary is the equal-weight mean of per-head relative MSEs on **one common complete-vector case set**, recomputing each baseline loss on that same set. Exclude zero-baseline-loss heads from this ratio summary explicitly and show their absolute losses separately; always show included heads/denominators. This scale-normalized summary is not fantasy points, a primary selector or permission to hide a regressing head. Do not sum unscaled heterogeneous squared errors.

No authentic league scoring weights, roster/eligibility/lock/cost snapshots or full PPP/goalie vector are admitted. Therefore actual fantasy-point error, RSO/Start Chart readback, legal lineup utility and drop/add gains remain deferred. Synthetic linear-score algebra may test implementation only; it cannot supply empirical decision value. No consumer or shared forecasting source edits.

## Exact finite budget and engineering gate

Proposed new durable root: `/Users/tim/Documents/FHFH-private/forge-core-multioutput-development-b-20261015-v1/`. Preserve separate immutable authority, protocol/allocation, code/runtime pins, adapter checks, synthetic receipts, evaluator gate, attempt, daily vectors, exposure, metrics and terminal/final-review receipts. Retain authorized source bindings/copy outside temporary storage; no cleanup until an authorized second durable copy is verified.

- Existing sole FORGE executor and existing evaluator; no new workers or parallel model runs.
- One real-data invocation, no automatic retry, concurrency1, at most30minutes walltime and8GiB process memory. Gate must verify enforcement and actual resource logging; limits are proposed ceilings, not measured runtime promises. Do not compete with today's live pilot; check its owner/window before launch and wait if necessary without altering its schedule.
- At most52 nonseed origins, three complete pipelines × seven outputs ×9,503 supported opportunities = **199,563 forecast values maximum**. Seed is history only. Missing outputs remain missing; no padding. No extra recency/shrinkage/fallback variants. Each pipeline is the full fixed mapping, not a family containing hidden choices.
- One score pass over frozen forecasts, seven target metrics for each pipeline; exactly4,000 shared paired bootstrap draws across two fixed block settings. No resampling-setting search. Existing evaluator may audit frozen artifacts/recompute declared accounting and scores within the gate, not run alternative forecasts.
- Independent pre-execution gate binds direct approval to this exact protocol, normalized input hashes, adapter semantics, masks/fallbacks, all seven formulas, chronology, metrics/endpoint and runtime. Meaningful synthetic tests cover all formulas/units, no-own/empty-pool/missing-recent branches, unknown buckets, leakage/duplicate denial, coverage denominators, assembled invariants and budget enforcement. Synthetic engineering runs never count as real model execution or predictive evidence.
- No real-data smoke run before the once-only attempt. Stop and preserve evidence on pin/schema/date drift, source mismatch, leakage, unapproved scope, resource limit, nonfinite implementation failure or broken accounting. No partial-run “success” or repair/rerun without a new bounded decision. Ordinary model omissions/performance failures are reported as such, not concealed or automatically retried.
- Zero original archive rereads, new acquisitions, database/network calls, production writes, builds/deployments or scheduler changes. Numeric bodies remain with existing executor/evaluator; coordinator receives aggregate scores/coverage/uncertainty/pins only.

Final delivery: actual terminal status, exact executed input/code/protocol hashes, all three complete policies' per-target and assembled diagnostics, costs and omissions, independently accepted reproduction/accounting or precise failure. B is descriptive exposed development only. Original829 records, accepted A, protected Jan14+ boundary, held blend, PPP/goalie deferrals and separate live pilot remain unchanged. Any new recipe, per-head selected mixture, practical promotion policy, untouched/future evaluation or consumer integration needs separate approval.
