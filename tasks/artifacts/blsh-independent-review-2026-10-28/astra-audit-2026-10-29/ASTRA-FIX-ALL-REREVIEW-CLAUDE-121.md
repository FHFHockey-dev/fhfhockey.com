# Astra re-review: Claude BLSH fix-all pass (CLAUDE-20261029-121)

Completed review: 2026-10-29. Candidate: explanation v3.2, current-window dry run v4, forecast evaluator v2. Reviewed in the canonical `/Users/tim/Code/fhfhockey.com` checkout on `octoberBranch`; HEAD observed during review: `c3cf52629fd729a7deb829dcd5aa700a0217623a`.

This file records the completed independent review. It is separate from, and does not overwrite, `ASTRA-AUDIT-FINDINGS.md`, which concerns earlier candidates. The parent delegation subsequently authorized saving this new report. No product implementation or further empirical run was authorized or performed for this file handoff.

**Verdict: six of the seven findings are closed.** Explanation v3.2 passes the targeted re-review. The evaluator's primary numerical results and newly added secondary results are supported by the checks below. One narrow part of its deadline finding remains open: expiration during the final calculation can still lead to returning results and reaching the output-publication continuation. It did not affect the completed 985-second run and does not block retrospective display work.

**Disposition of all seven findings**

| Prior finding | Disposition | Independently checked evidence |
|---|---|---|
| Explanation: opposite mixes of official-overlay and raw games collapse to one revision label | Closed | Per-game revisions are retained. Opposite compositions with the same mixed label now withhold on-ice deltas with `current_reference_mixed_revision_composition`; a uniform-revision control retains its delta. |
| Explanation: ES/PP exceeding total passes when the other component is missing | Closed | Four independent cases: ES and PP individually above total, each tested on current and reference windows. Context is unverified, opportunity/context values unavailable, and the exposure-consistency reason appears. |
| Explanation: negative per-game counts/exposures cancel in aggregation | Closed | Development and current slots reject negative counts/exposures before summing. A fully assembled profile with cancelling negative/positive current and reference values retains null finishing context and per-slot invalid reasons. |
| Evaluator: greedy sensitivity schedule differs from every fifth eligible appearance | Closed | Exact synthetic IDs across eligibility gaps match the stated schedule. Independent selection from saved origins gives 5,992 origins and 511 players; selected target windows do not overlap within a player. |
| Evaluator: composite, evidence tiers and P1-H per-60 missing | Closed, with disclosed post-hoc composite choice | Added outputs reconcile from saved origins. Every P1-H per-60 track has n = 28,876 and equals P1's rate prediction. Composite normalization passes an independent known-value fixture. The empirical training covariance basis was selected after primary results were known; the report discloses this. |
| Evaluator/report: exit 1 and unhandled error called harmless | Closed | Corrected v1 forecast and three earlier dry-run reports explicitly record failed verification. The pinned forecast-v2 log shows one passed test, no unhandled error, and exit 0. The earlier failed v4 dry-run log is retained. The separate successful-v4-log evidence gap is described below. |
| Evaluator: duration guard checks only after work and writes | Partially closed; one publication-boundary gap remains | Cooperative checks now reject during work, and the early-expiration fixture produces no result. However, the final checkpoint precedes additional synchronous calculations; no fresh check occurs before creating/writing output. A late-expiration fixture still returns a result and reaches a publication continuation. |

**Exact remaining correction: deadline at publication**

Relevant locations in the reviewed candidate:

- `web/lib/buyLowSellHigh/forecastEvaluation.ts:311`: the last composite-contrast checkpoint occurs before the last contrast calculations, tier-position grouping, final metrics and subgroup aggregation.
- `web/scripts/blsh/forecastDevRun.test.ts:60`: the runner awaits the result.
- `web/scripts/blsh/forecastDevRun.test.ts:63`: it creates the output directory and then writes results, origins and receipt without a new deadline check.

Independent reproduction used the existing synthetic forecast fixtures through an in-memory TypeScript loader, without Vitest, filesystem output or an empirical refit:

1. Run the synthetic fixture with bootstrap = 1 and an always-false `expired` callback; count checkpoints. There are 55.
2. Repeat with an injected clock initially 0, budget 3,600,000 ms, and `expired` returning whether that clock exceeds the budget.
3. A `config.seed` getter advances the injected clock to 3,600,001 after the final checkpoint, while its final contrast is being calculated. It still returns the original seed.
4. Attach a `.then(...)` sentinel representing publication after the evaluator returns.

Observed:

```json
{"lastCheckpoint":55,"checks":55,"clock":3600001,"budget":3600000,"resultReturned":true,"publishContinuationReached":true,"origins":310}
```

The sentinel establishes that the evaluator returned after late expiration; no actual files were published by this reproduction. Inspection of the runner establishes that its next actions create/write output without checking the clock.

Required correction: retain cooperative checks during computation, and add a fresh deadline check immediately before the first output filesystem mutation. Prepare any substantial serialized payloads before this check so serialization cannot create another unchecked interval before publication. The existing exported `ForecastDeadlineExceeded` can express the stop; for example, check `Date.now() - started > BUDGET_MS` and throw with a publication-boundary location before `mkdirSync` or `writeFileSync`.

Required regression: let evaluation succeed, advance a fake clock beyond the deadline during the final calculation or before publication, then assert rejection and zero output-directory/file operations. Keep the existing regression for expiration while computation is still progressing. This is a focused runner/test correction; another full empirical run is not needed to verify it. The guard remains cooperative, not a guarantee of hard preemption exactly at 60 minutes.

**Independent numerical and behavioral verification**

The checks used read-only source inspection, in-memory Node/TypeScript fixtures, and Python readback of saved JSON/JSONL. They did not invoke a new full empirical evaluator or alter the frozen candidate.

- All 16 ready-receipt hashes matched. The 317-line frozen scorer prefix and entire production-reference module also matched their established hashes.
- All 28,876 forecast origins were compared with v1. Predictions, targets, TOI, process deltas, reference rates, floors and other existing fields are identical. Only `evidenceTier` and `per60.P1_H` were added.
- The primary results, funnels, training-origin summary, gamma, team-season contrasts, existing subgroup results and floors equal v1.
- Independently recomputed 266 MAE/RMSE values across primary, every-fifth, per-60, composite and evidence-tier outputs. Maximum absolute difference from saved values: approximately 3.67e-14.
- The evidence-tier counts reconcile: 26,048 measured origins / 494 players and 2,828 provisional origins / 477 players. Players can appear in both tiers. Position/tier coverage also reconciles.
- Independently reproduced two decisive new P2-minus-P1 bootstrap contrasts, each with 2,000 player-cluster resamples and the declared seed scheme:
  - Every-fifth FP MAE interval: [-0.0010034238483668753, 0.00039641654012695826].
  - Every-fifth FP RMSE interval: approximately [-0.0006534174166847873, 0.0007623700803912614].
  - Composite MAE interval: approximately [-0.001188695615550495, -0.00008360527451097876].
  - Composite RMSE interval: approximately [-0.0010462045435833955, 0.0002253480173614042].
- All 2,900 retrospective `result` objects and production axes equal dry run v3. There are 1,850 numeric results across the four arms.
- Excluding the explanation version label, exactly 36 profiles change explanation content, all in arm B with the official overlay. There are 41 newly withheld mixed-composition deltas: 35 assist-rate and six on-ice-finishing comparisons.
- Maximum observed absolute track reconciliation residual: approximately 3.55e-15; normalized reconciliation residual: 0. The small difference from the report's rounded residual does not affect the result.
- No new per-slot `invalid_<field>` reasons appeared in the saved profiles. Existing `wigoGameScore:missing_or_invalid_...` reasons concern the six unavailable on-ice goal fields; these were not misclassified as newly discovered negative data.
- The three explanation failure classes were independently reproduced against the corrected code, including current and reference sides.
- Synthetic players with all-zero shots and individual xG remain scoreable. Removing an individual-xG observation produces a separately labelled estimate rather than a shooting exclusion.
- A small synthetic end-to-end forecast run produced 310 origins with complete secondary arm/track coverage and the expected tier accounting. The early-expiration fixture rejected on its fourth checkpoint without reaching a publication continuation.

The saved arm counts remain:

| Reference / input arm | Numeric scores | Buy-low / sell-high candidates |
|---|---:|---:|
| A: 2022-24 reference, raw verified inputs | 252 / 725 | 106 / 115 |
| B: earlier 2026 games added, raw verified inputs | 252 / 725 | 106 / 116 |
| A: 2022-24 reference, official-receipt overlay | 673 / 725 | 360 / 223 |
| B: earlier 2026 games added, official-receipt overlay | 673 / 725 | 344 / 227 |

**Clean-run evidence and the remaining log gap**

The pinned `forecast-dev-v2/RUN.log` was directly inspected. It records one passed test, no unhandled error, approximately 985 seconds, and `exit 0 in 986s`. The receipt records 985.075 seconds and a 3,600-second budget. The earlier failed-run diagnosis is explicitly corrected in the forecast-v1 report and all three earlier dry-run reports.

The first failed v4 attempt's log exists at `dry-run-v4-failed-runner-error/RUN.log`; its SHA-256 is `c5417410f53f6fe4f1b27465c590731b3f822a8d00feb45318956be96c79fa1b`. It records one passed test plus one unhandled `Timeout calling "onTaskUpdate"` error. Preserving it is appropriate.

The successful `dry-run-v4/RUN.log` was absent from that output directory when checked. Claude's report/diary state that the successful v4 run exited 0 without an unhandled error; the reviewer independently verified its saved numerical outputs, but did not independently establish its clean command exit from a successful-run log. This is an evidence-packaging gap, not evidence that the successful run failed. Attach the existing successful log and its hash if available. Do not rerun solely to manufacture a replacement log or treat the report assertion as independent log verification.

Claude's 197 passed BLSH tests, five skipped opt-in suites, TypeScript exit 0 and clean lint remain implementer-reported checks; they were not rerun by this reviewer.

**Reconciliation with TJ's original retrospective goal**

The intended tool is player-specific recent production versus underlying support, with separate buy-low and sell-high views. Confidence/evidence strength and missingness should be separately visible. A player must not disappear merely because shots are low or zero. Predictive research is an additional question, not a prerequisite for this retrospective view.

The current score supports a qualified version of that goal:

- It starts with a personal/cohort production reference at recorded current ice time and applies a learned concurrent process adjustment based on individual xG/60 and shared on-ice xGF/xGA per 60.
- It exposes observed production, expected baseline, support adjustment and resulting gap. These are distinguishable quantities, not interchangeable explanations.
- The score is not solely a direct comparison of a player's goals with that player's xG. The personal reference is shrunk toward a cohort; the process relationship is fitted using donors. Cohort fallback must be visible.
- The explanation's finishing, shots and opportunity measures provide context. They are not additional independent score votes, causal identification of luck, or evidence that a role change will persist.
- A coverage tier is not calibrated confidence. In particular, one or two personal-reference games can still produce a “measured personal reference” tier. Show the game counts and estimator weight; do not display the weight as a confidence percentage.
- Missingness, imputation, extrapolation and source-comparison restrictions are separately represented. The confidence probability remains unavailable rather than fabricated.
- Zero shots and zero xG are valid observations. The checked code does not impose a whole-profile shooting gate. Missing or unqualified data can still make particular fields or the full three-track score unavailable; that is a different condition.
- The broad lists are expected under the existing concordant-direction rule. The A-overlay lists contain 583/673 numeric players (86.6%); that percentage alone does not prove a defect or determine a useful threshold.
- Baseline policy is still consequential. A uses stale 2022-24 history; B can change evidence modes when early-2026 history is incomplete. Neither should be silently presented as a fully qualified current operational reference.

The forecast findings do not invalidate this retrospective use. They do constrain predictive claims. The unchanged production reference supplies almost all improvement over the prior-season mean. On the corrected every-fifth sensitivity schedule, FP P2-minus-P1 is -0.0003125266676490904, with an interval including zero. The composite's small MAE improvement also has an RMSE interval including zero. Reusing the retrospective coefficient forward is worse than the reference alone. None of these results makes an arbitrary retrospective list cutoff appropriate.

**Shortest path to a usable retrospective tool**

1. Close the small publication-deadline gap with a focused regression, and attach the existing successful dry-run log if available. These are bounded evaluator/evidence follow-ups; do not restart the scientific investigation or empirical run.
2. Agree an exact display-field handoff with the Codex preview owner. The existing `web/components/buyLowSellHigh/BuyLowSellHighPreview.tsx` and `BlshPlayerDetail.tsx` already render historical lists/details, but do not consume the reviewed v4 profile/explanation contract. Reuse them instead of beginning another UI.
3. Make the observed totals, personal/cohort baseline, additive support components and resulting gap inspectable. Put window games/span, personal-reference games/weight/age, source revision restrictions, imputed processes and missing-data reasons beside the interpretation. Keep unavailable profiles accessible.
4. For an immediate local research snapshot, explicitly select and label the reference policy. A with the official-receipt overlay is a straightforward provisional choice, provided the stale reference and exploratory status are prominent. This is a recommendation for selection, not an authorization to change the accepted baseline or publish it.
5. Retain two directional candidate lists while showing evidence quantity and limitations. Do not pick a cutoff to force a desired list size. Any later evidence-based membership method should have a stated purpose and case checks, and preserve access to low/zero-shot and withheld profiles.
6. Treat qualification of a recent operational reference as its own bounded task. Do not use “complete games only” history compression as a silent modification of the frozen estimator. A different estimator requires its own method and comparison.
7. Keep forecast work separate. No reserved-season evaluation is needed to build or inspect the retrospective display. Any future confirmatory run must retain its separately frozen protocol and exposed-game treatment.

This review supports proceeding with the local retrospective display contract. It does not approve deployment, trusted trade recommendations, a live operational baseline, a new forecast claim or a new reserved-season run.

**Scope and limitations**

- The empirical gamma fits, training-origin funnel and empirical training covariance used for composite weights were not independently rebuilt in this re-review. The formulas were inspected; gamma and prior primary results match v1; composite arithmetic was verified using saved weights and a known-value normalization fixture.
- The reviewer did not rerun the full empirical forecast, frozen historical parity replay, 197-test suite, TypeScript, lint, browser QA or a production build.
- Saved numerical equality is not proof that the simplified history gate equals the sealed original transport. That qualification remains unresolved.
- Unknown original publication/revision times prevent treating these reconstructions as issued forecasts.
- The overlay is the official-receipt research bundle, not the separate stored-play-by-play reconstruction.
- 2024-25 remained excluded; reserved 2025-26 was not opened. The prior exposure of game 2025020500 and its prescribed treatment remain part of any later holdout protocol, not resolved by this review.
- The product preview files were inspected only to identify the shortest integration path, not fully audited or changed.
- No source files, Claude-owned code, database, Git state, deployment, production service or lease register was modified. The shared heavy lock was absent when observed; the reviewer performed small local checks without launching a heavy empirical job.
- Saving this report creates only this new document and a separate Codex handoff diary. It transfers no source ownership.

**Reviewed SHA-256 pins**

All 16 full ready-receipt pins below matched during the completed review and again when this report was prepared. Paths are relative to `/Users/tim/Code/fhfhockey.com`.

| File | SHA-256 |
|---|---|
| `web/lib/buyLowSellHigh/supportGap.ts` | `d8b8d42a3ed7a6a66b7d7402ac62ea433c6a77702f086309fd21568ee27a5618` |
| `web/lib/buyLowSellHigh/supportGap.test.ts` | `1b192a4928972097f349210cbeb1aeaf2e6bb47d30a9d48e45da7acdc456b96f` |
| `web/lib/buyLowSellHigh/currentWindows.ts` | `e3d4c5f7878df7ccb26a348fa1824b9c9c1f65fea307161ceca6ec38f2214959` |
| `web/lib/buyLowSellHigh/currentWindows.test.ts` | `a365d831a3aa9947a39135768ca8c1ae0d1b1b961f581e687df36f339ba5ddc4` |
| `web/scripts/blsh/currentDryRun.test.ts` | `f1b759d5554e980376f9e96793a5dccb3a6a74632a893b334c0977d8d379f781` |
| `web/lib/buyLowSellHigh/forecastEvaluation.ts` | `10543e5ceda5218a4e0fb241c7df59d6ab394491f89e6d3a5f78f3583abd5f7b` |
| `web/lib/buyLowSellHigh/forecastEvaluation.test.ts` | `5775e7b7da8b8fe4b1199d6c8849421a114f603fd59aa4b7d826f58b8a8f049a` |
| `web/scripts/blsh/forecastDevRun.test.ts` | `4bacedc2ba30a5693c194c47a8b6a5a8f67c59910dc0cb100ffddd21982625d7` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/RESULTS.json` | `6b5a9e46f20150f15df8f1c5960b7b44320536f398e9a17818d1b4182d2b7f94` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/ORIGINS.jsonl` | `a942da2195db2d93e493f078bd882070f059d17c681a9e706a2926b206c581a9` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/RECEIPT.json` | `68db02ab5d6cd8845d0e22c43c4fd379f35853dc1357bc74f4b80079dc45012f` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/RUN.log` | `fcefeab40710739c5d384d9974a8310154a4bd906c7460604cabe066ab9126ab` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/FORECAST-DEV-V2-REPORT.md` | `9a8faaefc449cbb54a049adeaf12218ffbbe2933dd5cc743d8af5279f1e36ed0` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json` | `eb714e1f8613844123bb8b2d3732e4952b8cadea51651be483bb5d41e369947e` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/EXPLANATION-REVIEW.md` | `7b330e21bea837996e2f2502cd8cf0080b3f9d196ebbdc50cf7cc964330d4460` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev/FORECAST-DEV-REPORT.md` | `45809c4ad90cea94f27a42f752332e373422c235b142a628f686a31977b0a9fe` |

Additional unchanged estimator identities:

- First 317 lines of `web/lib/buyLowSellHigh/supportGap.ts`: `bc9d31c9ee866ad74045dc98ddf34e3607b71c17a63e11c46d10ae6970198d4c`.
- Entire `web/lib/buyLowSellHigh/productionReference.ts`: `9a56af85486c850aebc2df4d3ad218b43ca2bbeb3a7073453a0c38189a4be85e`.

The ready receipt is in `tasks/artifacts/cross-platform/2026-10-24-coordination/CLAUDE-TO-CODEX.md`, section `CLAUDE-20261029-121`. The prior seven findings are in `CODEX-TO-CLAUDE.md`, sections `CODEX-BLSH-EXPLANATION-V31-REVIEW-20261029` and `CODEX-BLSH-FORECAST-EVALUATOR-REVIEW-20261029`. Those earlier reviews and previous audit files remain preserved.
