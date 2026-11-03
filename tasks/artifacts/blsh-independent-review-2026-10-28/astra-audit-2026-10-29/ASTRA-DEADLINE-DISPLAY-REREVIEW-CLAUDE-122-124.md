# Astra focused re-review: CLAUDE-122 / CLAUDE-124 and the retrospective display handoff

Completed review: 2026-10-29. Repository: `/Users/tim/Code/fhfhockey.com`. This report records the completed read-only review of the publication-deadline correction, recovered dry-run evidence and latest display-field proposal. It is a new artifact; it does not overwrite the earlier Astra audits.

**Verdict: the deadline finding is closed. All seven original findings are resolved at the reviewed hashes.** The publication guard passes the targeted independent checks. The display proposal is faithful to TJ's retrospective goal in its overall design, but several specific mappings need correction before implementation. These are display-contract corrections, not new numerical defects or reasons to rerun the model.

The current delegation authorized saving this report only. No product implementation, database, Git, production or reserved-season action was performed.

**Candidate and receipt identity**

- `CLAUDE-20261029-122` supplies the three corrected evaluator/runner/test pins, smoke log, forecast-report addendum and recovered dry-run log evidence.
- `CLAUDE-20261029-123` supplies the display-field proposal.
- The later `CLAUDE-20261029-124` supersedes the proposal hash with `c209e61e7f155e32d6a8f38fd0adcf3c0b2e1c8d2b6b6337d60accfbd1fb261e` and records A + official-receipt overlay as the selected first local snapshot. That latest file is the one reviewed here.
- The A + overlay choice is treated as a **provisional local research snapshot policy**, not a permanent or accepted operational baseline, deployment or permission to open reserved data.

All reviewed hashes appear at the end of this report. They matched during review and again when this report was prepared.

**Publication guard: closed**

The remaining issue in `ASTRA-FIX-ALL-REREVIEW-CLAUDE-121.md` was late expiration: the evaluator could pass its last checkpoint, finish additional calculations after the deadline, return a result and reach the runner's output writes.

The corrected candidate addresses both relevant boundaries:

1. `web/lib/buyLowSellHigh/forecastEvaluation.ts:338` checks `expired` after the final contrasts, metrics and subgroup aggregation and before returning the result. It throws `ForecastDeadlineExceeded("after the final calculation")` when expired.
2. `web/scripts/blsh/forecastDevRun.test.ts:67` prepares all RESULTS, ORIGINS and RECEIPT strings first.
3. At line 74 the runner calls `publishBeforeDeadline`, whose check at `forecastEvaluation.ts:33` occurs before the supplied directory-creation callback. If already expired, neither directory creation nor writing begins.

The checks remain cooperative. They establish that a run already over budget at these boundaries cannot begin publication. They are not a guarantee of hard interruption exactly at 60 minutes or of interrupting filesystem calls already in progress.

**Independent focused checks performed**

These used in-memory TypeScript transpilation and assertions against the real modules, with existing synthetic fixture builders and supplied callbacks. They did not run Vitest or write output files.

- **Original late-expiration reproduction:** the successful synthetic control now makes 56 deadline calls. On the second run, a `config.seed` getter advances the injected elapsed clock to 3,600,001 ms during the final contrast, after checkpoint 55. The added final check rejects with `ForecastDeadlineExceeded` and the “after the final calculation” message. The publication continuation is not reached. This reproduces the earlier failure mechanism rather than checking only a new early-stop case.
- **Early cooperative expiration:** expiration on the fourth check still rejects, with no subsequent computation continuing through the run.
- **Expiration during payload preparation:** after a successful synthetic evaluation, the injected clock passes the budget while preparing the final payload. Calling the real `publishBeforeDeadline` produces zero directory or write callbacks.
- **Within-budget control:** at the allowed budget boundary, the helper calls directory creation first, then RESULTS, ORIGINS and RECEIPT writing, in order.
- The synthetic successful control produced 310 origins with bootstrap = 1. It is a control for execution and publication behavior, not a new empirical forecast result.
- The added source tests cover final-calculation rejection and expiry after successful evaluation, including a within-budget control. The runner's actual serialization and call order were inspected.

No additional deadline correction is requested. The previously reviewed explanation fixes, frozen scorer and production reference remain unchanged.

**Numerical evidence retained**

Of the 16 pins recorded in the CLAUDE-121 report, 12 were unchanged. The only four changed files were the three declared evaluator/runner/test files and the forecast report with its addendum.

In particular, the full-run RESULTS, ORIGINS, RECEIPT and original forecast RUN.log remain unchanged. The explanation v3.2 source/tests, current-window source/tests, current dry-run runner, dry-run summary and corrected earlier report pins also remain unchanged. The production-reference file and first 317 lines of the scorer retain their established identities.

The earlier independent numerical verification therefore remains applicable: 28,876 forecast origins and primary results, 2,900 unchanged retrospective scores, corrected sensitivity schedule and secondary metrics. This focused turn did not repeat those computations or rebuild empirical gamma, donors or training covariance. The new guard does not require another full empirical run.

**Recovered dry-run and smoke evidence: what is established**

`dry-run-v4/RUN.log` has SHA-256:

```text
aa5f9fe6f72b10deb5c09e15e655d09e2a25eb9a16eedcbb2631ad070a8b1797
```

The file records:

- One test file passed and one test passed.
- Start time 08:04:22 as printed by Vitest, without independently established timezone metadata.
- Duration 137.81 seconds.
- No “Errors” count and no “Unhandled Errors” section.

The file does **not** contain the process exit status. `RUN-EVIDENCE.md` explicitly says the wrapper's `exit 0 in 139s` appeared only in the session's command output. The reviewer did not independently recover that session output. The note's claim that the file was copied unchanged from the original scratchpad is an implementer provenance statement; this review verifies the supplied file against its receipt pin, not its original scratchpad copy.

This is accurate evidence reporting: the successful test output is now available, while independent file-based verification of the process exit remains unavailable. It is not evidence that the successful run failed. No replacement run is warranted simply to manufacture a historical exit record. Future runners should append their actual process exit status to their logs.

The earlier failed first attempt remains separately preserved and must not be conflated with this successful test output.

The corrected-runner smoke log at `forecast-dev-v2/deadline-fix-smoke/RUN.log` records:

- One passed test, no recorded unhandled error.
- Vitest duration 55.10 seconds.
- An explicit `exit 0 in 56s` line.

That is evidence for the reported 40-player cost/smoke check with the corrected runner. It is not a full empirical rerun. The claimed equality of its RESULTS with the earlier smoke, apart from version labelling, was not independently compared in this focused review.

The full forecast-v2 log remains pinned and includes its own exit-0 line. The report addendum correctly distinguishes the full run's earlier code hashes from the later guard correction.

Claude's reported 199 passed BLSH tests, five skipped opt-in suites, TypeScript exit 0 and clean lint were not rerun by this reviewer. They remain implementer-reported checks, separate from the independent small checks above.

**Display handoff: what is sound**

The proposal is aligned with a retrospective BLSH tool:

- Preserve the historical v1 snapshot and add a separately versioned current-research contract.
- Keep all 725 captured players accessible through the selector and lists/withheld view.
- Separate buy-low and sell-high candidate lists; introduce no count or value cutoff.
- Display observed production, historical reference at current ice time, support adjustment and additive gap components.
- Separate evidence quantity from missingness, imputation and comparison restrictions.
- Keep calibrated confidence unavailable; do not turn personal estimator weights into confidence percentages.
- Preserve low/zero-shot observations and unavailable profiles.
- Present context as hypotheses and retain the false luck, market-value, forecast and trusted flags.
- Keep forward research separate from the retrospective view.
- Reuse the existing preview, parser, server reader and page while respecting Codex ownership.

The selected A + overlay source was read and hashed:

```text
tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl
SHA-256 f8734686d13b78baf28ee12f0133c940a03f8171ff0510ec4c7a9b6f2286378b
Size 11,576,986 bytes
```

Its observed counts support the handoff's core claims:

| Quantity | Count |
|---|---:|
| Profiles | 725 |
| Numeric scores | 673 |
| Buy-low candidates | 360 |
| Sell-high candidates | 223 |
| Other / withheld profiles | 142 |
| Zero-shot windows | 19 |
| Zero-shot windows with numeric scores | 15 |
| Zero-shot list candidates | 7 |
| Profiles with 1–4 personal-reference games | 36 |

The display should preserve these records and existing membership/ranking semantics. Their breadth does not justify choosing a threshold merely to make a shorter list.

**Corrections required before mapping/rendering**

These corrections concern the proposal's interpretation of existing fields; no scorer or history-estimator change is needed.

| Location in DISPLAY-FIELD-HANDOFF.md | Problem established from the selected source | Required mapping |
|---|---|---|
| Line 87: tier's “else provisional” | All 52 unavailable-score profiles have a null explanation evidence tier. Treating every non-measured tier as provisional would falsely describe unavailable scores as estimates. | Distinguish measured, provisional and null/unavailable explicitly. Preserve the score reason. The existing v1 preview already has an unavailable state. |
| Line 99: false context verification becomes “could not be matched” | 151 reference contexts are absent because there is no supplied personal reference, not because an identity comparison failed. Garrett Wilson is one concrete example: no reference IDs/dates, `personalN = 0`, `no_personal_history_cohort`, and `reference_window_not_supplied`. | Render the recorded reason. Use “No personal reference window supplied; context comparison unavailable” for absence, and mismatch wording only for an actual mismatch. |
| Line 96: every P.coverage count rendered as “{count} games” | P.coverage also contains 151 profile-level no-history notes and 112 short-window notes, each with count 1. Those counts count notes, not one offending game. | Use game counts for `current_window_slot` / `reference_slot` only. Render personal-reference and current-window notes without converting their count into games. |
| Line 30: “up to ~900 days old” | The 574 available personal-reference ages range from 894 to 1,451 days; median 912. A total of 535 exceed 900 days. Hayden Hodgson's is 1,451 days; Filip Hallander's 1,432; Matt Kiersted's 1,392. | Remove the claimed upper bound or show the actual range and individual ages. Keep the reference explicitly stale and provisional. |
| Line 82: lastDateAgeDays described relative to as-of date | This field uses `eventThroughDate = 2026-10-26`. Capture/as-of is `2026-10-28T03:51:05.140251+00:00`. | Say “Last game {n} days before the recorded-through date” when displaying this field. Do not silently relabel it as an age from the capture date. |
| Line 70: normalizedWeight and normalizedContribution both labelled “Share of the index” | The first is a multiplier; the second contributes to the unbounded normalized gap. Neither is a percentage share of the bounded -100..100 display index. Brent Burns has normalized gap 1.3153743209023174 and displayed value 56.81043920318279. | Label the multiplier and “contribution to normalized gap” separately. Track contributions sum to the normalized gap; the displayed index is its separate bounded transform. |
| Line 14: introductory comparison describes underlying support alone | The model begins with a historical personal/cohort production reference and then applies a concurrent support adjustment. The baseline supplies most of the comparison. | Name both explicitly: “Recent production relative to a historical personal/cohort reference, adjusted for current underlying support.” Continue to show the reference and adjustment separately. |

These mappings must not merge evidence absence with invalid identity, estimated support or staleness. They can be corrected within the document/mapper work; they do not reopen the seven resolved scorer/evaluator findings.

A qualification concerning freshness: in the selected A + overlay data, every false `window.fresh` observed had a last-game age greater than seven days. Therefore this review did **not** find a selected-snapshot counterexample to the proposed stale-window wording itself. The supported correction is the date anchor, and the mapper should continue to preserve score-unavailable reasons separately.

**Existing preview contract and shortest implementation path**

The existing `researchSnapshot.ts` accepts only the frozen `fhfh.blsh.historical-snapshot.v1` contract, 2023-24 season and 2024-04-18 snapshot date. The handoff correctly calls for version dispatch rather than feeding new profiles through that historical parser unchanged.

The existing `researchSnapshot.server.ts` reads one immutable local file, checks a SHA-256 pin and a size bound, and then parses it. The existing preview page returns 404 in production. Preserve those properties for the local v2 preview: no database/network reads, runtime refit or accidental production exposure.

Shortest next steps:

1. Record the deadline ticket as closed. Retain the recovered dry-run log and its explicit exit-status limitation. Do not request another full model run.
2. Correct the display proposal's mappings above. These are bounded wording/data-contract changes.
3. Have the Codex preview owner own the small pure mapper, the new pinned local snapshot and the version-dispatched rendering. This avoids an additional ownership transfer. Alternatively, explicitly clear an exact new mapper/test path for Claude before delegating that implementation.
4. Package the selected saved A + overlay profiles without refitting. Record the snapshot's own path/hash and the input profile hash. Retain the historical v1 file and pin.
5. Keep the v2 banner provisional and stale, retain all 725 profiles, two candidate lists and the withheld view. Keep unavailable values and reasons separate from zero and from estimated support.
6. Verify the exact mapping corrections and fixture counts, including 52 null tiers, 151 absent reference contexts, non-game coverage notes, maximum reference age, date anchors, normalized contributions and the 19 zero-shot profiles.
7. Run proportionate mapper/parser/component checks and the relevant local preview checks, preserving historical-v1 rendering and production 404 behavior. Keep reference-policy selection confined to this provisional snapshot.

No permanent baseline, threshold, forecast or holdout decision is needed to deliver that local retrospective preview. Qualification of a recent operational reference, stored-play-by-play reconstruction, and any later evidence-based membership rule remain separate tasks.

**Verification scope and limits**

- Source inspection covered the corrected guard, tests and runner; the existing preview parser/server/page contract; relevant explanation types/formulas; the latest display handoff; and saved A + overlay profiles.
- Independent execution was limited to small in-memory checks with supplied filesystem callbacks. No empirical evaluator rerun or actual output publication occurred.
- No full Vitest suite, TypeScript, lint, browser tests, production build or visual UI verification was performed by this reviewer.
- No display mapper or v2 snapshot implementation exists as a result of this review. The proposal is assessed for implementation; rendered behavior has not been accepted.
- Numerical/model qualification limits from the earlier report remain: simplified history gate not established equivalent to sealed transport, unknown original publication/revision timing, and no calibrated confidence or causal/market claim.
- The official-receipt overlay remains distinct from the separately reconstructed stored-play-by-play rows.
- 2024-25 qualification and reserved 2025-26 were not opened or changed. No new forecasting authority follows from the review.
- No source, Claude-owned implementation, database, Git, lease register, production service or deployment was modified. The heavy lock was absent when observed; no heavy empirical job was launched.
- The follow-up file handoff creates only this report and a separate Codex diary. Prior audit files are preserved.

**Exact reviewed hashes**

Paths below are relative to `/Users/tim/Code/fhfhockey.com`. The table includes the corrected candidate/evidence, selected display source, and unchanged prior pins rechecked in the focused review. All matched again when this report was saved.

| File | SHA-256 |
|---|---|
| `web/lib/buyLowSellHigh/supportGap.ts` | `d8b8d42a3ed7a6a66b7d7402ac62ea433c6a77702f086309fd21568ee27a5618` |
| `web/lib/buyLowSellHigh/supportGap.test.ts` | `1b192a4928972097f349210cbeb1aeaf2e6bb47d30a9d48e45da7acdc456b96f` |
| `web/lib/buyLowSellHigh/currentWindows.ts` | `e3d4c5f7878df7ccb26a348fa1824b9c9c1f65fea307161ceca6ec38f2214959` |
| `web/lib/buyLowSellHigh/currentWindows.test.ts` | `a365d831a3aa9947a39135768ca8c1ae0d1b1b961f581e687df36f339ba5ddc4` |
| `web/scripts/blsh/currentDryRun.test.ts` | `f1b759d5554e980376f9e96793a5dccb3a6a74632a893b334c0977d8d379f781` |
| `web/lib/buyLowSellHigh/forecastEvaluation.ts` | `8d7f9c4a010fe94962cd3168ff796ef505375117a3369af4b0acc408619d5634` |
| `web/lib/buyLowSellHigh/forecastEvaluation.test.ts` | `33a86d0ca7784f264bd25ca27722a2400bd3639560ad99cf524d16a0e4a1d93d` |
| `web/scripts/blsh/forecastDevRun.test.ts` | `1ce7764ec9a4d90e18740688e60dc113e930d11af3549cb8d9670551797ff765` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/RESULTS.json` | `6b5a9e46f20150f15df8f1c5960b7b44320536f398e9a17818d1b4182d2b7f94` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/ORIGINS.jsonl` | `a942da2195db2d93e493f078bd882070f059d17c681a9e706a2926b206c581a9` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/RECEIPT.json` | `68db02ab5d6cd8845d0e22c43c4fd379f35853dc1357bc74f4b80079dc45012f` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/RUN.log` | `fcefeab40710739c5d384d9974a8310154a4bd906c7460604cabe066ab9126ab` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/FORECAST-DEV-V2-REPORT.md` | `1962ce6d2e7a63d02aac09db8e53591c18308e8796f6a4d43154ed025f84e4c2` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json` | `eb714e1f8613844123bb8b2d3732e4952b8cadea51651be483bb5d41e369947e` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/EXPLANATION-REVIEW.md` | `7b330e21bea837996e2f2502cd8cf0080b3f9d196ebbdc50cf7cc964330d4460` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev/FORECAST-DEV-REPORT.md` | `45809c4ad90cea94f27a42f752332e373422c235b142a628f686a31977b0a9fe` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/RUN.log` | `aa5f9fe6f72b10deb5c09e15e655d09e2a25eb9a16eedcbb2631ad070a8b1797` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/RUN-EVIDENCE.md` | `78128dabc803228ebc1c242ff6d8a121ffd26769ae3570d2a51759a4cab72320` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/deadline-fix-smoke/RUN.log` | `0525ceb69d009e7b10949e7a9be2cf1042af41b877d5daf441c71aaa1e2bd229` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/DISPLAY-FIELD-HANDOFF.md` | `c209e61e7f155e32d6a8f38fd0adcf3c0b2e1c8d2b6b6337d60accfbd1fb261e` |
| `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl` | `f8734686d13b78baf28ee12f0133c940a03f8171ff0510ec4c7a9b6f2286378b` |
| `web/lib/buyLowSellHigh/productionReference.ts` | `9a56af85486c850aebc2df4d3ad218b43ca2bbeb3a7073453a0c38189a4be85e` |

The first 317 lines of `web/lib/buyLowSellHigh/supportGap.ts` retain SHA-256 `bc9d31c9ee866ad74045dc98ddf34e3607b71c17a63e11c46d10ae6970198d4c`.

The ready receipts are in `tasks/artifacts/cross-platform/2026-10-24-coordination/CLAUDE-TO-CODEX.md`, sections CLAUDE-20261029-122, -123 and -124. The prior re-review is `astra-audit-2026-10-29/ASTRA-FIX-ALL-REREVIEW-CLAUDE-121.md`, SHA-256 `22786edbc037f1509c5d165d96fdb9368e5af92aa42dd58cb612f60eaac14800`. The closure here supersedes that report's remaining deadline finding; its evidence and other limitations remain preserved.
