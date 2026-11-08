# Astra independent audit: BLSH exploratory current-season dry run

Completed 2026-10-29. Saved from the completed audit for Claude at TJ's request.

**Recommendation: choose the forecast test before setting a predictive list threshold, after correcting the reporting and explanation defects.** Forecast success is not required for the retrospective product: the [roadmap explicitly separates those objectives](/Users/tim/Documents/Codex/2026-10-25/task-2/BLSH-SCORE-ROADMAP-20261026-v5.md:13). The 87% membership rate alone cannot justify a cutoff or establish that a particular list size is scientifically appropriate.

This audit continued from Sol's checkpoint, treating it as leads rather than accepted conclusions. Material findings were independently checked against the saved profiles, current code, input qualification, frozen development cases and receipts. The review itself was read-only. This handoff creates only this new report and a separate task diary; it authorizes no fixes or production action.

## Scope and ownership

- Repository: `/Users/tim/Code/fhfhockey.com`, canonical `octoberBranch`; observed HEAD `e4fb6f1467401983abe63d69277b75df151e0395`.
- Main report reviewed: [DRY-RUN-REPORT.md](../dry-run/DRY-RUN-REPORT.md), with [SUMMARY.json](../dry-run/SUMMARY.json) and all four `PROFILES-*.jsonl` files.
- Additional sources: [RECONCILIATION.md](../RECONCILIATION.md), [EXPLANATION-REVIEW.md](../EXPLANATION-REVIEW.md), current assembler/scorer/exporter/runner, frozen current request and official overlay, and frozen development case/model/training artifacts.
- Prior explanation review: thread `01a185ae-3826-7723-a624-850b30a80005`; the source and test hashes remain identical to that review, and the material defects were independently reproduced during this continuation.
- Before saving, both ownership registers were read. Claude's BLSH-SUPPORTGAP lease covers the parent artifact directory; the latest coordinating delegation explicitly authorizes a new audit file/subdirectory here. This destination was absent. Existing files and ownership registers are preserved.
- No product edits, database reads or writes, provider calls, deployments, Git mutations, deletions or holdout access were performed by this audit. No new release or analytical acceptance is implied.

## Confirmed results

| Arm | Scored / 725 | Buy / sell | Listed / scored |
|---|---:|---:|---:|
| A, raw | 252 | 106 / 115 | 87.7% |
| B, raw | 252 | 106 / 116 | 88.1% |
| A, official overlay | 673 | 360 / 223 | 86.6% |
| B, official overlay | 673 | 344 / 227 | 84.8% |

Arm A uses development history from 2022–24. Arm B adds strictly earlier 2026 games to the personal reference. All four outputs remain exploratory.

The current request, overlay, block catalog and six original parquet hashes match their recorded pins. The overlay applies **1,463 official-census patches**, all proposing zeros for the six missing goal fields. No supplied overlay patch is withheld or unmatched. This does not test or qualify the separate **1,459-row stored-PBP reconstruction**. Its four unresolved nulls, two control discrepancies and 116 newer rows remain separate questions under that method.

## Seven findings

### 1. The NST explanation is wrong

All 52 overlay-blocked players have NST rows; 51 have at least one qualified row. Their problem is that no process dimension has complete qualification across every selected game. John Tavares has four qualified individual and on-ice games out of five, but the missing game makes each aggregate process rate unavailable. All 15 raw-arm process-blocked players also have qualified rows.

The [assembler's complete-window rule](/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/currentWindows.ts:89) explains the result. The report's “no NST rows in the window” wording does not. Report incomplete window coverage and its reasons. Changing that rule would be a methodological change, not a reporting fix; do not silently drop games, fill zeros or change denominators to improve coverage.

### 2. Coverage denominators need precision

The overlay recovers 421 of the 458 production-blocked players. Another 37 remain process-blocked, joining the original 15: `252 + 421 = 673`, and `15 + 37 = 52`. The 252 scores shared by raw and overlay Arm A are unchanged.

There are 112 players with fewer than five games. **92 score with the overlay**, versus 32 raw. In each overlay arm, 57 short-window players reach a list, including eight with one appearance. The report should not imply that all 112 score. These counts are descriptive; they do not justify inventing a minimum-game threshold.

Numeric coverage also differs from measured personal-reference coverage. A overlay has 477 measured-tier and 196 provisional scores; B overlay has 152 measured-tier and 521 provisional scores. A's lists contain 159 provisional entries; B's contain 445. Numeric availability and directional membership are not validated evidence strength.

### 3. Baseline sensitivity includes missingness effects

A versus B overlay produces **40/673 sign flips**, a maximum **48.8176-point** movement and 56 changed list assignments across 725 players. That comparison is absent from the runner's summary comparison set.

Of the reported 27 raw-arm sign flips, **19 coincide with B losing its personal production history to missing measurements**. All 26 flips between raw B and overlay B coincide with restoring that history. The raw-arm comparisons therefore cannot be interpreted solely as sensitivity to adding recent performance. Prefix NST gaps also change personal/cohort process-reference modes; B's measured tier falls from A's 477 to 152 even with the overlay.

See [history construction and scoring](/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/currentWindows.ts:131). Preserve these comparisons and distinguish changes in measured performance from changes in available reference evidence before choosing a baseline policy.

### 4. The adjustment statistic is reproducible; define it explicitly

For all 673 numeric A-overlay scores, the ratio

`abs(FP support adjustment) / abs(final FP support gap)`

has median **18.6229%** and exclusive-method 90th percentile **108.668%**, rounding to the reported **19% / 109%**. The earlier checkpoint's suspected numerical discrepancy is resolved.

For comparison, dividing by the absolute baseline gap instead yields median 17.3604%; using inclusive quantiles with the final support-gap denominator yields p90 106.226%. Specify the denominator and quantile convention in the report. This ratio can become large near a zero gap and is neither explained variance nor causal attribution.

### 5. Some case wording exceeds the evidence

The [representative examples](/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-independent-review-2026-10-28/dry-run/DRY-RUN-REPORT.md:73) need these corrections:

- **Hyman:** the shot-rate decline is observed, but shots and ES minutes are not direct process-correction predictors. His FP correction is approximately **−0.345**, principally the negative ixG contribution. The figures do not establish a persistent underlying decline. Describe the measured window change and the actual model inputs separately.
- **Coronato:** his FP gap is approximately **−12.554**, consisting of baseline gap **−12.927** plus process correction **+0.373**. Saying the remaining gap is “mostly on-ice finishing” is unsupported: the finishing residual is contextual, not an attributed score component.
- **Opportunity:** total ice time is incorporated. PP-share, role and linemate changes are not separately modelled. “Extra opportunity already counted” needs that qualification; a rise in PP minutes cannot be treated as fully adjusted merely because total TOI increased.
- **Reference length:** the introduction says every example has 50 reference games; Coronato has 35.

The saved numerical examples otherwise reconcile to their score components. Finishing residuals can motivate hypotheses, but they do not identify luck, persistent ability, market value or the causal source of the score gap.

### 6. The five explanation defects remain reproducible

Independent in-memory fixtures confirmed the prior review's material defects in the unchanged explanation layer:

1. Window matching does not establish player/game identity or agreement with scored outcome totals. Different identities and goals with matching aggregate seconds/counts are accepted.
2. State-specific per-60 calculations use total exposure. In a fixture with PP goals 2, ixG 1, PP seconds 600 and total seconds 3,600, the reported difference is 1 instead of 6 per PP 60.
3. Current/reference scopes can differ while a delta remains available. The [window contract](/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/supportGap.ts:337) also lacks the source/model metadata needed to enforce compatibility.
4. Cancelling coefficient changes or reordered feature names can alter attribution while passing the summed model-match check with zero reconciliation residual.
5. Invalid numeric inputs can fail open: NaN seconds and infinite goals can produce an “available” NaN result.

See [explanation arithmetic and checks](/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/supportGap.ts:386). The current caller uses all-situations scopes and the fitted model, avoiding some triggers in these particular profiles. That does not repair the API contract or demonstrate valid general explanation inputs.

### 7. The exported history is unpinned at consumption

The [runner reads `dev-history.jsonl` without a hash](/Users/tim/Code/fhfhockey.com/web/scripts/blsh/currentDryRun.test.ts:38). The [exporter](/Users/tim/Code/fhfhockey.com/web/scripts/blsh/export_dev_history.py) records hashes of source parquet files but not the generated JSONL. Source verification therefore does not authenticate the derivative between export and consumption.

No corruption was found. Close the reproducibility gap by recording the derivative hash and verifying it at consumption, with the source/exporter provenance retained. Do not claim every consumed file is pin-verified until that boundary is covered.

## Retrospective case audit

All **29 frozen development cases** in [CASE-REVIEW.json](/Users/tim/Documents/Codex/2026-10-25/task-2/support-conditioned-ranking-v1/run-guarded-v1/CASE-REVIEW.json) were checked: 28 numeric and one unavailable. These comprise the four saved top-five list/tier groups plus nine saved archetypes. All selected case copies match the frozen candidate population.

Checks passed for H/W identity separation and chronology, support-model cutoff, target exclusion, exact reconstructed support-training membership hashes, process adjustments, physical floors and normalized scores. Maximum adjustment/support arithmetic error was **1.78e-15**. The six inspected archived case/model/pool/catalog/candidate/ranking files match their run-receipt hashes.

The cases demonstrate intended distinctions:

- Zero-shot Jonah Gadjovich remains scoreable, with provisional reference limitations visible.
- Liam O'Brien's conflicting baseline/support result is withheld from directional lists.
- Conor Timmins' absent current window remains unavailable, rather than becoming a neutral zero.
- Sparse and missing-process examples retain their estimation modes and coverage reasons.

They also expose a temporal interpretation limitation. Patrick Brown's “fresh” five-appearance window spans **66 days** (2023-11-22 through 2024-01-27); Gadjovich's spans 26 days. Freshness means a recent last appearance, not five recent calendar games. Show dates and span before calling these hot/cold runs. This observation does not establish a new gap cutoff.

This completes the saved-case arithmetic and interpretation review. It does not establish robustness to alternate windows, outliers, source revisions or role changes. The source-row qualification and all upstream estimator fits were not independently rebuilt here.

## Temporal leakage and holdout constraints

No W/H overlap or reference date reaching W was found in the 2,900 current profiles. The current development donor pool precedes 2026. For earlier backtests, rebuild donor histories at every origin: the [current assembler takes the final development 50](/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/currentWindows.ts:117), while [fitProductionPrior correctly rejects later-ending donors](/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/productionReference.ts:141). Reusing that current-season pool unchanged is unsuitable for earlier evaluation origins; retain the guard rather than bypassing it.

Event chronology does not prove historical source availability. The current capture was available **2026-10-28 03:51 UTC**, with events through October 26. It cannot be represented as an October 26 issued prediction. Historical source publication/revision timing remains unproved, so a replay remains retrospective unless actual issuance evidence exists.

The [2024–25 validation report](/Users/tim/Documents/Codex/2026-10-25/task-2/validation-evaluator-v2/VALIDATION-20242025-HANDBACK.md:7) supports the frozen prior mean as a comparator: it had the lowest observed MAE and RMSE among the reported controls on the common cohort. That report explicitly says the formal predictive-improvement gate was **not tested**. Neither those descriptive losses nor this dry run establish forecasting or trading efficacy.

- 2022–23 and 2023–24 are exposed development data.
- 2024–25 has already been exposed retrospectively; qualification for this assembler remains unresolved. It is not an untouched test set.
- 2025–26 remains reserved for the prescribed single evaluation. There is disclosed prior exposure to official summaries of game **2025020500**. Freeze treatment of that game and overlapping feature/reference/target windows before evaluation; do not call the whole season wholly unseen.
- Before opening the reserve, freeze the score definition, features, baseline, eligibility, forecast mapping if applicable, evaluation criteria and selection decisions. Preserve the complete result regardless of outcome.
- After evaluation, any operational-reference release and refit must remain distinct from the frozen evaluation. If revised after observing the holdout, mark that holdout consumed and seek later untouched or prospective confirmation.

The [owner-decision record](../RECONCILIATION.md:124) supplies the freeze → one-time evaluation → record → subsequent baseline-release sequence. This audit does not execute any of those steps or expand their authority.

## Ordered correction and validation plan

1. **Correct reporting.** Fix coverage descriptions, short-window denominators, the missing A/B-overlay comparison, statistic definition and case claims. Preserve the exploratory outputs.
2. **Repair explanation integrity and provenance.** Close the five explanation defects and pin the exported history. Verify targeted regressions and real-window explanation replay; arithmetic reconciliation alone is insufficient.
3. **Resolve descriptive policy through cases.** Review the baseline, window-span and missingness policies using the fixed cases and disclosed failures. Keep provisional tiers visible. Do not choose policies because they produce more attractive lists. Forecast success remains separate from acceptance of a clearly defined retrospective tool.
4. **Freeze the separate forecast question.** Specify prediction formula, units, origin timing, next-five target, season-end censoring, baseline, eligibility, metrics and comparison arms before evaluating. `E_support` is a current-window expectation; its conversion into a future prediction must be explicit. Do not use realized future TOI as an undeclared input or compare totals to per-appearance means. Account for origins lacking five future appearances without silently crossing a season boundary.
5. **Evaluate chronological development predictions.** Compare with the frozen prior mean on identical origins. Include the unchanged production reference to isolate the process correction. Report paired MAE/RMSE, player-clustered uncertainty and coverage by tier; disclose remaining shared-game dependence and any multiplicity. Set no score cutoff merely to reduce membership, and do not interpret the normalized score as a calibrated probability or z-score.
6. **Freeze selection before the reserved evaluation.** Record all outcomes, including failures. Keep later refitting and operational baseline use distinct. No numerical acceptance threshold, minimum sample cutoff or desired list size has been invented by this audit.

## Verification performed and limitations

Performed during the independent continuation:

- Recomputed all four profile counts, list counts, short-window counts, A/B-overlay sensitivity and relevant missing-history flip counts.
- Replayed frozen current-input overlay qualification in memory, including the 52 process-blocked players' underlying row availability.
- Independently reproduced the material explanation defects with in-memory TypeScript fixtures.
- Verified hashes of the current request, official overlay, six original parquet sources and relevant archived evidence files; recorded source/test pins below.
- Checked all **1,850 numeric results across the four current arms** for additive and normalized reconciliation. Maximum track residual was **3.55e-15**. Checked exploratory/trust flags and current reference chronology.
- Checked all 29 saved development cases and reconstructed support-training membership for the 28 numeric cases, without refitting the models.
- Reproduced the 19% / 109% statistic with an explicit denominator and exclusive quantile method.

Not performed or independently established:

- The full current dry run was not rerun; byte-identical two-run determinism remains implementer-reported.
- The 165-test suite, historical estimator parity replay, type-check and lint were not rerun.
- Underlying official goal reports were not re-reviewed; stored-PBP qualification was not performed.
- The simplified history gate was not proved equivalent to sealed transport; calendar omissions were not repaired.
- The 2024–25 inputs were not qualified for this assembler, and 2025–26 was not opened.
- Archived production-donor end dates were not available in the inspected case records and were not independently reconstructed. Support-model training chronology was checked through saved membership, catalog dates and cutoffs.
- No new forecast experiment, perturbation/outlier study, live feed qualification, production behavior check or release validation was run.

An initial case-check script expected a `donor_end_dates` field that is absent from the archived production-prior record. That attempt stopped with a KeyError; the subsequent check explicitly omitted that unavailable claim and passed the supported checks described above. It did not weaken or bypass an application guard.

## Evidence pins

These identify reviewed bytes, not approval or scientific acceptance.

| File | SHA-256 |
|---|---|
| `web/lib/buyLowSellHigh/supportGap.ts` | `5a760cf7cb2c3275a0893b8c7d65d54fc57d043f286d0a67fa117e2aa5384326` |
| `web/lib/buyLowSellHigh/supportGap.test.ts` | `7f99c30cc5efdc6a167837f7a61e0df6f935458d7989e056cbafbad68e13935b` |
| `web/lib/buyLowSellHigh/currentWindows.ts` | `f0dd0e0a0a93f946fbe5945af16fe3edad55dfd7702db218d6e910605eff4a95` |
| `web/scripts/blsh/currentDryRun.test.ts` | `19b076d26eaf6aed9bd8c5c9b18b08e4e5bbd218434b248b88593366ea8b1793` |
| `web/scripts/blsh/export_dev_history.py` | `688b5d6375cf7ecf674c3f19e1c2aecef774cab459236ef3042f3afb0e51c26a` |
| Frozen `CURRENT-REQUEST.json` | `6a76d0e8c36636eb5afe6adab46c677ace55214a8dafae4e9d11e28f1c53c5a8` |
| Frozen `RESEARCH-GOAL-BUNDLE.json` | `6c8b5dfa025dac1bfbe3b1018fc6b255ca7abcce41b520111eb14451ce89e95b` |
| Frozen `ORIGINAL-BLOCK-CATALOG.jsonl` | `f60056cd5ab6b80688d130661d2efbaacfe31c001de7b690a634514900ded529` |
| Frozen `CASE-REVIEW.json` | `4f66b7bbcdb20dcc469845beabd8abc8f7e53347baf17e7656882065a06bb184` |

Frozen current inputs are under `/Users/tim/Documents/Codex/2026-10-27/task-3/current-research-overlay-01/`. Frozen development run files are under `/Users/tim/Documents/Codex/2026-10-25/task-2/support-conditioned-ranking-v1/run-guarded-v1/`.
