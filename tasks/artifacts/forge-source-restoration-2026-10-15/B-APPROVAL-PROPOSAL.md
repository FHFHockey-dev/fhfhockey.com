# B: one finite SOG development comparison — approval proposal

Status: **PROPOSED, NOT AUTHORIZED OR EXECUTED**. Scout retains design ownership; TJ decides approval. No withheld numeric records were opened, imported, fitted or scored while preparing this document. Existing owner reviewed the named source contracts only. Proposed numerical policy choices below are explicit operational choices for approval, not accepted policy, literature-derived constants or demonstrated predictive thresholds.

## Requested decision

Approve one private retrospective SOG comparison on the accepted A dataset: the exact expanding-count anchor plus two existing complete challengers, four exposed development folds, separately reported Jan 8–13 diagnostics, one run and fixed endpoint. Approve the proposed 1% pooled-MSE gain / 5% per-fold-and-stratum harm limits for **research nomination only**, or supply different limits before implementation is frozen. No production promotion, prospective superiority or lineup-value claim follows B. Independent protocol/code/runtime/synthetic acceptance is required before any numeric execution. If TJ approves the comparison but not its numerical nomination policy, do not execute until that policy is resolved; do not inspect results to choose margins.

## Accepted inputs and boundaries

Durable input root: `/Users/tim/Documents/FHFH-private/forge-core-skater-validation-20261015-v1/`.

| Binding | SHA256 |
|---|---|
| protocol/reviews/support-review-v1.json | 6259940706360699ef359d64f1623ff5ec9881f2b58459013642d3cbde9e9baa |
| protocol/a-terminal-receipt.json | 5bf02fb550df10776394e0161b6c55de84b22afa8d3bd8c5a167424411a9b4fe |
| reports/support-counts.json | f0403b5744ea497bd91dd0379abe0f1b4ad88d4b26b9d01ceb1f85d5ebe99003 |
| labels/validated-records.json (inherited terminal pin, not coordinator-read) | e19b9753be67b7011b452d50f909055864a88c64c5959594617624a667c54c0e |

A validated 15,983 positive-TOI unique player-games for each of G/A/SOG/HIT/BLK/PIM/conditional TOI, across 825 skaters, 444 games, 92 dates. One zero-TOI row was excluded. These counts are validated target support, **not** guaranteed forecast/evaluation counts: history/fallback availability must still be accounted for. The selected archive is not a complete schedule/participation population. All values remain exposed retrospective development with zero original-as-of-qualified rows.

B reads only the accepted normalized dataset and required pinned metadata, never the mixed original archives or raw auxiliary goalie/PPP bodies. Lossless adapter: CONDITIONAL_SKATER_MINUTES → TIME_ON_ICE_PER_GAME in minutes; canonical/NHL IDs, game/date, historical membership and unique player-game keys preserved. Verify schema, units, per-head support, exclusions and adapter round-trip equality before evaluation. Do not infer historical roster eligibility from the current identity snapshot. No duplicate source versions or zero-TOI rows enter history/pools.

Original 829-span operation remains unstarted/blocked. The accepted 717-span A is immutable. PPP, goalies, SO, participation, starter/PP-role probabilities, strength-specific and unconditional heads are excluded. Jan 14, 2026 onward remains closed; no historical block is certified untouched. The old blend stays held. No new acquisition or allocation beyond the accepted normalized dates/heads is proposed.

## Dates, chronology and exposure

| Period | Role | Validated per-head upper bound |
|---|---|---:|
| Oct 7–Nov 16, 2025 | Seed history only; no selection score | 6,480 |
| Nov 17–30 | Development fold 1 | 2,340 |
| Dec 1–14 | Development fold 2 | 2,232 |
| Dec 15–Jan 2, 2026 | Development fold 3; Dec 19 absent | 2,879 |
| Jan 3–7 | Development fold 4 | 792 |
| Jan 8–13 | Separately exposed diagnostic continuation; excluded from nomination/tuning | 1,260 |

All four folds and the continuation are already exposed; current broader A validation is also exposure, not a repaired holdout. At a reconstructed day d origin, histories/pools contain admitted records dated at most d−2, starting Oct 7. This is a chronology convention, not proof those receipts existed then. Preserve real acquisition, validation and B execution clocks; never backdate issuance.

Build candidate envelopes without outcome values. Existing evaluator stages outcomes only after each day's three prediction files/omission masks are frozen and hashed. This procedural staging prevents current-day accidental leakage but does not erase prior exposure. Fixed policy parameters remain unchanged across all dates; updating deterministic history summaries is allowed. No daily adaptive policy selector. Nomination uses only folds 1–4 after the single run; Jan 8–13 losses cannot change it. Separately label continuation predictions as fixed-recipe retrospective diagnostics, not a previously unseen test of an already selected winner.

## Exactly three complete pipelines

Active head: **SOG**, chosen for validated coverage and predeclared consumer relevance, not preliminary wins. No second active target or hidden hyperparameter alternatives. Use all-strength appearance-conditional labels; no strength/position/news/role features are admitted.

Shared history: eligible prior positive-TOI, historically bound, same-season rows. Prior recent window is last up-to-five verified eligible own appearances; require finite target support and positive finite minutes as the existing helper does. Let C be own cumulative SOG, E own cumulative minutes, n own appearances, and m5 mean eligible minutes in that window. Let Rp be summed eligible pooled skater SOG divided by summed eligible pooled skater minutes, including own rows. Pool is all admitted skaters, not position groups or a mean of individual rates.

| Policy | Fixed SOG mean with supported own history |
|---|---|
| M0 / season_rate | C / n |
| M1 / role_aware | m5 × C / E |
| M2 / EB180 | m5 × (C + 180 × Rp) / (E + 180) |

M0 is the reconstructed expanding appearance mean, not the full production-native/prior-season baseline. The source label role_aware does not establish authentic role inputs. The 180 pseudo-minutes are one fixed existing recipe, not a newly estimated or selected grid. M2 changes rate shrinkage from M1; their minute multipliers are identical. No clipping, calibration, reconciliation variants, actual-minute oracle, extra recency choice, alternative prior, distribution diagnostic or additional model family is included.

Shared fallback: with **no eligible own target history**, use the eligible pool's appearance-weighted mean SOG for all three policies; empty pool → missing. This differs from M2's exposure-weighted rate prior. Own history but missing required recent support → omission for all affected policies, including M0; do not quietly improve anchor coverage. Existing helper's empty exposure-pool branch uses own rate when defined; with admitted own positive exposure this should be unreachable, and must be tested/reported. Invalid/nonfinite estimates stop eligibility; never impute zero. Preserve every reason, history count, pool count and fallback flag.

Source references read as text only:

- private v3 `code/research_models.py`, SHA256 `734fa6195c9fe0d3d9acef09c64c9c2607e79d2766a32dff289f3a5ffdc4e516`, `historical_baselines`.
- private v3 `code/fit_families.py`, SHA256 `abbc97e7d8cf575f05b76ba76473d2da777036bf71b2a8618efdad3f1288fee4`, fallback semantics only.

Use a narrowly reviewed wrapper around one fixed prior_minutes=180 helper invocation (unused recent_weight pinned 0.5). Do not execute old skater_trials, forecast or choose entrypoints: they enumerate broader menus and inherit obsolete MAE/sample/fold rules. A bounded helper extraction, if needed to avoid producing other selectable estimates, requires code review before execution and no outcome access during implementation.

## Eligibility, coverage and reporting

Freeze one baseline-covered comparison population from pre-outcome availability masks. Every candidate must issue for **100% of M0-covered cases** in every fold; omissions cannot improve a score through a smaller intersection. Report all requested, excluded, missing-history, fallback, baseline-covered and paired counts by day/fold/head. Extra candidate coverage is descriptive only. Missing outcome is never zero. No candidate may exceed the baseline's fallback proportion; the declared shared branch should make them equal. Any coverage discrepancy requires explanation before nomination, with no post-result redesign.

Report pre-origin own-history bands 0, 1–4, 5+; prior position F/D; m5 usage bands below12,12–below20,20+ minutes; and prior recorded-team difference versus none/unknown. These are descriptive archive-derived groups, not certified rookie/return/trade or pregame roster states. Do not use target-day actual minutes to define groups. All nonempty groups remain visible, including tiny groups. Do not infer league-wide/current-season eligibility, participation, rookie or injury-return performance.

## Fixed scores, endpoint and proposed nomination rule

Primary: player-game-weighted SOG MSE on the fixed matched cases, w=1. Paired gain = mean[(y−M0)² − (y−candidate)²], positive is better; publish absolute squared-shot gain and relative gain when baseline MSE>0. Score final SOG values unchanged by downstream processing. Secondary RMSE, prediction-minus-observation bias, MAE and player-balanced MSE are descriptive and cannot choose the winner. Report each fold, all four pooled, and Jan 8–13 separately. No per-fold recipe switching.

**Proposed policy for TJ, not established predictive evidence:** a research nominee must (a) pass all integrity/coverage gates; (b) improve pooled folds1–4 MSE by at least **1%**; (c) worsen neither any development fold nor any nonempty declared one-way reporting group by more than **5% relative MSE**; and (d) pass assembled-output integrity checks. If a comparison baseline MSE is zero, require candidate MSE also zero for harm guards; no division by zero or claimed percentage gain. Tiny groups can block nomination under this conservative rule; report their counts, do not waive them after results. These choices limit observed development harm; they are not universal sufficiency or production thresholds.

Among qualifying challengers choose lowest pooled primary MSE; exact tie favors M1, then M2. If neither qualifies, retain M0. Float comparisons use reproducibly computed stored losses; any numerical tie tolerance must be frozen in executable review, used only for numerical equivalence and disclosed separately from practical margins. No nomination based on Jan8–13, another head, a secondary score or a favorable uncertainty setting. One endpoint after all permitted dates complete; no early winner inspection or outcome-driven retry. Report the unchanged M0 result even when a challenger wins.

Uncertainty is development sensitivity, **not confirmation**: paired calendar-block bootstrap, 2,000 draws, fixed seed20261015, seven-calendar-day moving blocks over Nov17–Jan7 (empty dates retained); resample date-level loss sums and counts and recompute ratios, keeping the same blocks for all policies. One predeclared fourteen-day sensitivity repeats the calculation without selection rights. Show 95% percentile sensitivity intervals and leave-one-date/player concentration diagnostics; do not call them familywise confirmatory tests or alter nomination from their favorable endpoint. If dependence/stability assumptions are indefensible, label intervals uninterpretable and report paired loss differences only. No inferential superiority claim or production promotion is authorized; a future confirmation requires a separately approved window, practical absolute margin/error family and sealed endpoint.

## Assembled output checks, without expanding the search

For all three policy vectors, freeze G/A/HIT/BLK/PIM and reported conditional TOI to their exact season_rate anchors with the same availability/fallback contracts. Only SOG changes. This computes six fixed reference heads for integrity/secondary descriptions, not six extra challenger searches. Report their baseline coverage and per-target losses once; none can influence SOG recipe choice except explicit assembled integrity failure.

M1/M2 use m5 **internally**, while reported TOI remains M0 expanding mean. Log both quantities and do not claim the SOG count uses the exposed TOI-head forecast. Assert exact non-SOG identity across vectors, identical identity/game/day/cutoff/units/missingness, finite nonnegative admitted means, and no fabricated PPP/goalie zeros. Check whether G≤SOG holds for each assembled forecast; report all violations, do not clip or drop cases post hoc. Challenger-only new violations disqualify assembled nomination; existing anchor violations withhold assembled compatibility claims and require a separately reviewed remedy, not an implicit fourth pipeline.

No unweighted sum of heterogeneous head losses as a winner score. No actual league scoring weights/rosters/eligibility/cost snapshots are admitted here, so fantasy-point accuracy, RSO/Start Chart consumer readback, start/bench and drop/add utility are **deferred**. A symbolic check that a linear projection changes only by w_SOG×ΔSOG is synthetic algebra, not empirical points/decision evidence. Missing PPP/goalie dimensions prevent any complete fantasy-vector claim. No consumer UI/shared-file edits.

## Finite compute and run budget — proposed hard limits

- One new durable private root, proposed `/Users/tim/Documents/FHFH-private/forge-sog-development-b-20261015-v1/`; separate code/protocol/review/source-bindings/attempt/forecasts/losses/reports directories. Never overwrite A or prior trials.
- Sole existing FORGE executor, existing evaluator; no new workers. Independent gate includes exact new authority, input and adapter hashes, recipes/selection policy, executable and runtime pins, meaningful synthetic chronology/fallback/conflict/coverage/assembled invariants. Synthetic engineering tests are not a model run or predictive evidence.
- Exactly one real-data invocation, no automatic retry, concurrency1, CPU process limit1, max walltime30minutes and process memory8GiB; stop and retain failure if exceeded. These are proposed operating limits, not measured runtime promises. Implementation must demonstrate timeout/resource enforcement before gate acceptance.
- At most52 nonseed calendar origins, three SOG policies, 9,503 target opportunities each: at most28,509 SOG predictions. Six fixed reference heads add at most57,018 values; assembled vectors may reference those values instead of recomputing. No extra hyperparameter trials. Actual omissions reduce forecasts; never pad them.
- Fixed bootstrap budget4,000 total draws across the two block settings, shared paired arrays; no reruns until an interval becomes favorable. No real-data smoke test before the once-only attempt. Existing evaluator may audit frozen outputs and recompute accepted accounting/metrics within the reviewed gate; no alternate recipe or new model selection.
- Zero original/archive rereads, external requests, production writes, builds/deployment or scheduler modifications. Preserve the separate live pilot and its owners/deadlines; never delay or replace it with B. Check resource availability before starting; if a conflict exists, wait within approval rather than compete with the live task.

## Stops, artifacts and final decision

Reserve immutable attempt before numeric access. Stop on pin/adapter/date/isolation drift, unexpected target/cohort expansion, future-label access, resource overrun, nonfinite output, duplicate player-games, broken coverage accounting or runtime mismatch. Preserve partial artifacts and actual elapsed/resources/exposure; no repair-and-rerun without a new bounded decision. A low-performing but valid completed run is retained, never retried.

Keep normalized source binding and authorized durable copy, all first-pass predictions/masks/features-by-reference, per-day freezes, real execution clocks, exposure ledger, metric denominators, exclusions/fallbacks, bootstrap configuration, selection decision and terminal receipt outside `/tmp`. Retain an authorized verified second durable copy before any cleanup; a hash alone is not a backup. Numeric artifacts stay with the existing evaluator; coordinator receives support/aggregate metrics/pins/limits only. Independent final acceptance verifies recipes, chronology, every candidate including failures, byte/pin invariance and fixed-endpoint selection.

Deliver a research nominee or retain-M0/inconclusive result, never production qualification. B approval would not authorize Jan14+ access, live-pilot changes, D1, broader head searches, blended selections, future confirmation or consumer deployment. Any extension requires its own fixed scope before new results are inspected.
