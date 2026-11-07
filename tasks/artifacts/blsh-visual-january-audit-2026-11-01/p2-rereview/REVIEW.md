# Focused re-review: BLSH window-age label

**Disposition: the P2 finding is closed for the reviewed current-preview list and detail views. No new finding identified.** This accepts the display correction only; prior source/operational/utility/forecast limitations remain unchanged.

Reviewed `window-age-label-fix-20261101-01/CHECKPOINT.md`, the actual four-file change and new tests on canonical `octoberBranch`, HEAD `8a20ff91a8fffe24979ab208248fc06d9196e6aa`. All **25 source/receipt checks matched**. Reconstructed the complete diff from preserved `before/` files against actual installed files; it exactly equals the submitted `CHANGES.patch`. Evidence: [PIN-RESULT.json](PIN-RESULT.json).

`web/lib/buyLowSellHigh/researchSnapshot.ts:221` now formats age independently of the combined `fresh` flag: inclusive 0–7 days within the saved limit, greater than seven outside, null/noninteger/nonfinite/negative age unknown. The list at `BuyLowSellHighPreview.tsx:173` and detail at `BlshPlayerDetail.tsx:144` both use the helper. It introduces no I/O, scoring or eligibility change.

## Independently reproduced cases

Rendered the actual React detail component against the immutable snapshot, inspected explanatory list items separately from raw diagnostic JSON, and verified no input-object mutation:

| Case | Corrected rendered state | Preserved result |
| --- | --- | --- |
| Jamie Benn, `8473994` | Last game **1 day** before October 28; **within** the saved seven-day window-age limit | Score null; missing-production reason shown; list withheld; no figure fabricated |
| Garrett Wilson, `8475253` | Last game **11 days** before October 28; **outside** the saved seven-day window-age limit | Numeric score `43.86735762626921` (`+43.87` displayed); list withheld; three existing production-track figures |

All **729** saved profile age labels agree with their recorded ages. All **137** previously mislabeled recent unavailable profiles now receive the within-limit description. The separate 24-hour capture state remains stale on November 1. [RENDER-RESULT.json](RENDER-RESULT.json) and retained `8473994.html` / `8475253.html` contain the reproduction evidence.

## Tests and rendered evidence

**Newly ran 14 focused tests: all passed; 58 deliberately skipped.** The filter included all four new age regressions, capture-related tests and the production-404 guard. The regressions exercise Benn in both table/detail, old numeric Wilson, seven versus eight days with both values of `fresh`, unknown/invalid ages, stale capture, unchanged profiles and missing production. Tests used a network-denying preload and the atomically acquired shared heavy slot; the slot was released into this directory. [TEST-RESULT.json](TEST-RESULT.json) and `tests/` retain results/logs.

Independently inspected the retained desktop and 320-pixel Benn screenshots: the corrected wording and missing-production state are visible and wrap within the detail. This review used server rendering plus DOM/unit tests, not a new browser session. The implementer's browser receipt covers Wilson and capture state; no separate Wilson screenshot was presented. No VoiceOver/axe claim is made.

The retained 72-test/type/lint pass is consistent with the final installed pins. The earlier test failure searched the intentionally preserved diagnostic JSON; scoping its assertion to explanatory list items is appropriate because the raw saved record is deliberately immutable. The second wrapper failure concerned the superseded installation receipt, not a failing test or runtime-source mismatch. This independent test run exited zero.

## Preservation and remaining scope

Scorer, production reference, window assembler, mapper and immutable reader pins match the earlier accepted values. The current snapshot is unchanged at SHA-256 `2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8`; all saved scores, memberships and evidence therefore remain byte-identical. The historical v1 snapshot remains unchanged as well. The four-file patch introduces no holdout path or execution, and this review performed no holdout access.

**Known scope boundary, not a new finding:** the frozen DTO/raw diagnostic JSON and unchanged upstream mapper still contain the original `freshnessText`. The current explanatory views no longer consume it. Future snapshot packaging or another consumer must preserve this distinction or address the upstream wording separately; this review does not claim that the stored text was repaired.

No new origin, fit, January analysis, production request, provider/database call, build, deployment, source edit or Git mutation. The prior retrospective-validation conclusions remain unchanged. No denied, pending or uncertain action and no blocker to closing this display finding.
