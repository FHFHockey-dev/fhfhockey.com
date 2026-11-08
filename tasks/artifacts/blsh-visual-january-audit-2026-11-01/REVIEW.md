# Independent BLSH visualization and January packet audit

**One P2 display-label finding; no defect found in the new comparison bars or the checked January arithmetic/chronology.** The frozen January packet supports its explicitly descriptive retrospective claims. It does not establish practical utility, forecast validity or a validated materiality threshold.

Reviewed canonical `octoberBranch`, HEAD `f204eac735d03ebcf726695ae57caeca4e46a5be`, with existing shared changes preserved. Starting evidence was `/Users/tim/Documents/Codex/2026-10-27/task-3/native-production-visual-20261101-01/{CHECKPOINT,READINESS}.md`. This review made no application/source, original packet, master-list or Git changes.

## Severity-ranked findings

### P2 — Missing production is mislabeled as an old window

`web/lib/buyLowSellHigh/currentWindows.ts:180` sets `fresh` only when both production is numeric **and** the last game is within seven days of the recorded cutoff. `web/lib/buyLowSellHigh/displayProfile.ts:219` interprets every false value as `stale window; withheld from lists`. The preview prints that saved sentence at `BuyLowSellHighPreview.tsx:173`; the detail prints it at `BlshPlayerDetail.tsx:144`.

The pinned current snapshot contains **137 profiles aged 0–7 days at its saved cutoff** that receive this stale-window label because production is unavailable. Reproduced through the actual React detail component for Jamie Benn (`8473994`): last game October 27, recorded-through October 28, 3,650 seconds across five appearances, unavailable score, and the rendered text **“Last game 1 days before the recorded-through date (2026-10-28); stale window; withheld from lists.”** His missing-production reason is separately displayed, and no chart or numeric score is fabricated.

Impact is explanatory: the UI conflates evidence availability with event age. List withholding remains correct. The global November 1 stale-*capture* notice is also correct and is a separate clock. This predates the new bar patch; it does not invalidate the bars' saved-value parity.

Recommended bounded correction: distinguish age-qualified, old/unknown-age and unavailable-production descriptions while preserving frozen scores/list decisions. Test a recent missing-production profile, a genuinely old numeric profile and the capture-age notice separately. Do not silently rewrite the frozen snapshot or relax admission under the guise of this copy correction.

Evidence: [all 137 cases](STALE-LABEL-CASES.json), [actual component render reproduction](STALE-LABEL-RENDER.json), and [independent results](RESULT.json).

## Calculation lineage and visualization

- Verified **66 pin/receipt checks covering 58 unique files** across the visual slice, January inputs/source/receipt and annotation inputs. All matched. The installed detail/test hashes match `426b2e…a5e30ff8` / `53d178…a1215`; scorer, reference, assembler, mapper, reader and current snapshot pins match. The current snapshot remains `2f380c…909f2c8`, 9,559,567 bytes.
- Independently joined the snapshot to the exact pinned `current-refresh-20261029-01/replay-01/PROFILES-A-canonical.jsonl`: all **729 profiles** retain source-window IDs, saved scores and memberships, and all **1,653 displayed tracks** exactly retain observed, historical-at-current-TOI and support-conditioned totals. Population remains **551 numeric / 264 BL / 184 SH / 281 withheld**. See [parity check](PARITY-AND-ANNOTATION.json).
- Source lineage is direct: `productionReference.ts:43` derives FP (`3G + 2A + PPP + .2SOG + .2HIT + .25BLK`), G+A and the repository's signed Game Score; `supportGap.ts:268` scales process-rate changes by observed seconds/3,600; `:273`–`:288` combines correlated native gaps using the baseline joint covariance and applies `100g/(1+|g|)`. The mapper passes explanation totals through at `displayProfile.ts:174`. The new figure at `BlshPlayerDetail.tsx:84` reads those totals only.
- Bars have a common zero and one scale per track, including negative Game Score. All-zero totals remain zero. Missing/nonfinite totals withhold the figure. Unavailable profiles have no fabricated breakdown. Text supplies every value; SVGs are decorative and unfocusable. The comparison warns that cross-track lengths are not comparable and that support-conditioned production is retrospective.
- Uncertainty remains limited: the index uses working baseline covariance, while missing-process output covariance is recorded separately and explicitly not added to that scale (`supportGap.ts:280`, `:292`). Coefficient uncertainty is uncalibrated. The UI does not supply confidence intervals or probabilities; estimator weights and coverage tiers are correctly labeled as different concepts. The bars are point comparisons, not uncertainty bounds.
- Reviewed retained desktop and 320-pixel screenshots: readable wrapping and no visible figure overflow. Newly executed five comparison tests cover parity/restrictions, negative geometry, all-zero values, invalid values and unavailable profiles. This review did not start a browser/server or independently repeat keyboard/VoiceOver/axe checks. Prior keyboard QA remains retained implementer evidence.
- No download, print or image-export path exists in the reviewed BLSH page/components. The retained PNGs document browser QA; they are not evidence of a product export feature. No export requirement is asserted as a defect in this display-only slice.

## January verification and denominators

Read actual `january-replication-20240115-01/pilot.cjs`, tests, audit, contract, frozen outputs, annotation code and disposition. The new verifier [audit.py](audit.py) uses the already released local 2022–24 history and existing January outputs; it does not dispatch a new origin, rerun fitting or use a reserved season.

Independently checked the exact last-up-to-five original current slots, original up-to-50 2022–23 personal slots, strictly prior dates, target exclusion, fitted-source hashes, donor weights, all **5,216 disjoint training blocks** against their raw-source X/Y/exposure, and all **553 donor rates**. Reconstructed coefficient algebra from stored Cxx/Cxy, current/reference process rates, conditional missing-process estimates, physical floors, native totals/rates, covariance normalization, bounded indices and full/removal memberships. This is arithmetic/closure verification of the saved fit, not an independent refit or new validation population.

| Quantity | Independently reconciled result |
| --- | ---: |
| Profiles / numeric | 824 / 816 |
| BL / SH / withheld | 336 / 251 / 237 |
| Unavailable | 8, all missing current process |
| Numeric aggregate conflicts | 51 |
| Observed-zero-shot profiles / numeric / listed | 42 / 41 / 16 |
| Remove-one variants | 3,883 |
| Numeric full-versus-removal comparisons | 3,811 |
| Sign disagreements among those comparisons | 534 |
| Empty removals, all unavailable | 34 |
| Diagnostic 3/3 candidates BL / SH | 93 / 80 |
| Conditional direction-stable / sensitive among those 173 | 137 / 36 |

The 534 sign changes use **3,811 comparable removal pairs**, not 824 independent players or all 3,883 variants. The stability denominator is the **173 diagnostic candidates**, not the entire population. These are dependent perturbations with frozen personal references/fits; none is a probability or a measure of coefficient-estimation uncertainty. The 237 withheld profiles include both numeric and unavailable cases. Empty removals and missing support stay null; low/zero shots do not veto a profile.

Maximum native total/rate residual was `7.11e-15`; maximum bounded-index residual `4.09e-14`; maximum component-sum residual `1.89e-15`. All checks passed. The original nine January synthetic tests also passed under a network-denying preload. See [RESULT.json](RESULT.json), [test receipts](TEST-RESULTS.json) and their logs.

## Claims supported and remaining gates

The packet correctly discloses retrospective corrected data, unqualified publication/revision timestamps, the simplified historical process gate, 2022–23-only shadow parameters and lack of current-2026 parameter parity. The January freeze/disposition preserves **3 FP and 3 FP/60 as a diagnostic hypothesis only**. The cited blinded review is purposive, not population utility evidence: all twelve boundary cards were called meaningful by both reviewers, including eight failing a magnitude condition. The two hypothetical imputation cards supply no empirical imputation-accuracy validation. No contrary predictive/utility claim was found in the reviewed checkpoint/readiness or UI.

Remaining gates:

1. Resolve the P2 age/availability label before treating all detail explanations as correct. It is separate from acceptance of the new bar geometry.
2. Intended-user decision context is still required before adopting an optional materiality filter. Continuous comparisons are supportable without inventing a meaningfulness boundary.
3. Present-day use still needs a separately authorized fresh capture and qualified operational reference/source policy. Capture is October 29 18:41:12.798646 UTC, events through October 28; historical reference ages are 894–1,451 days. Trusted/adopted remain false; the route returns 404 in production.
4. Retain the source limits already independently documented in `tasks/artifacts/rso-blsh-independent-review-2026-11-01/{PROVENANCE-REVIEW,CURRENT-BOX-REVIEW,SOURCE-VINTAGE-REVIEW}.md`: 3,407 current window rows partition as 2,728 matches + 99 differences + 580 unavailable; 46 count discrepancies occur even among exposure-qualified rows. NST native strength/model/publication evidence remains incomplete. The 150 qualified historical links are three fixed cases, not all references; 49 PPP values lack independent boxscore verification. This review consulted those accepted reports and did not repeat their full raw-body investigations.
5. Episode discovery, empirical memory-parameter selection, forecasting and trade value remain separate work. No holdout release is needed to accept this bounded retrospective arithmetic audit, and none occurred.

**Checks newly run:** 9 January synthetic tests and 14 focused comparison/capture-related component tests passed; 54 unrelated parser/reader/component tests were skipped by the explicit name filter. Frozen-output verifier and saved-profile parity/annotation checks passed; actual component rendering reproduced the P2 finding. Existing full 68-test/type/lint/browser receipts were inspected, not newly claimed as rerun. No production build, deployment, provider/database request, holdout access, dependency installation or application source change. No denied, pending or uncertain action; findings and gates are handed to the owner.
