# Independent review: totals and plain-language support explanation

**No finding identified in the revised copy, numeric meaning or checked rendering. Acceptable for the dated local retrospective preview.** This is not operational, predictive or full accessibility acceptance.

Reviewed the actual three-file patch against `clear-totals-support-20261101-01/CHECKPOINT.md` on canonical `octoberBranch`, HEAD `dee1d7720b6025be72608932d0364319962e4674`. All **21 source/artifact pin checks matched**. Reconstructed the exact diff from the preserved before-images and installed files; it equals `CHANGE.patch`. Scorer, production reference, assembler, mapper, reader and snapshot pins are unchanged. See [PIN-RESULT.json](PIN-RESULT.json).

## Numeric meaning and wording

- `BlshPlayerDetail.tsx:165`–`:177` correctly identifies the appearance count, dates and **total observed ice time** beside the table. The caption and chart labels consistently identify totals. The historical comparison is the blended personal/position-reference rate applied to the current window's exposure, not a historical per-game average.
- The support explanation accurately summarizes the individual xG and shared on-ice xGF/xGA rate-change adjustment. It describes an estimated opportunity comparison without asserting individual playmaking, causally identified luck or future performance. Missing/estimated-input restrictions and the detailed additive components remain available. The summary does not replace those limitations.
- Gap is correctly defined as **support comparison minus actual**. Positive means less was recorded than the comparison; negative means more. Native track values remain distinct from the unitless normalized gap and bounded index. Context rates/ratios state their units separately. Table totals are rounded to two decimals, the gap to four; full saved values and four-decimal chart text are unchanged.
- The explicit aggregate-versus-streak distinction is correct: a low/high total over five appearances cannot establish five consecutive cold/hot individual performances. No current streak is fabricated. The comparison remains retrospective and all trusted/forecast flags remain false.

Independently rendered the actual detail component for these real saved cases:

| Case | Window | Preserved result |
| --- | --- | --- |
| Brent Burns | 5 appearances, 80.52 minutes | FP 9.10 actual / 8.60 historical / 7.55 support; gap −1.5546; conflicting and withheld |
| Justin Dowling | 4 appearances, 29.98 minutes | Zero-shot observation retained, numeric +19.29, saved BL membership |
| Jamie Benn | 5 appearances, 60.83 minutes | Production unavailable; no production table or figure |
| Matthew Grzelcyk | 1 appearance, 14.45 minutes | Singular caption and full-window totals, saved numeric score/withholding retained |
| Garrett Wilson | 2 appearances, 19.62 minutes | Cohort-only reference; saved +43.87 and withholding retained |

All **551 numeric profiles** have caption exposure equal to saved seconds/60 and appearance count equal to saved window membership. All **1,653 track gaps** exactly equal support minus actual. The entire 729-profile object remained unchanged during rendering; its underlying snapshot still has SHA-256 `2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8`. No score, ranking, eligibility or threshold change occurred. [RENDER-RESULT.json](RENDER-RESULT.json), [reproducer](verify-render.cjs) and retained HTML supply evidence.

## Visibility and accessibility

The main production explanation and table caption are outside collapsed disclosures, before the numbers. Column headers have explicit `scope="col"`, track headers `scope="row"`; all chart values are real text and SVGs remain decorative/nonfocusable. The optional chart uses a native details/summary disclosure. The prior window-age correction remains in place.

Independently inspected all four retained desktop/mobile screenshots. Text wraps readably at 320 pixels; charts stack. The wide table has a visible contained horizontal scroller, with the gap column reached by scrolling. The implementer's actual Chrome receipt records Tab/arrow scrolling, disclosure Enter/focus and Escape/focus return. This review checked source, retained images and rendered DOM; it did **not** repeat a live browser or assistive-technology session. No screen-reader-speech, axe or cross-browser accessibility-conformance claim follows.

## Checks and disposition

**Newly executed 10 focused tests, all passed; 62 deliberately skipped.** Coverage includes the revised labels/caption/columns/saved totals, negative/zero/invalid/unavailable charts, the four age-label regressions and production-404 guard. Tests ran with network disabled and an atomically acquired shared heavy slot, released afterward. [TEST-RESULT.json](TEST-RESULT.json) and `tests/` retain results. The retained complete 72-test/type/lint results were inspected, not newly rerun or claimed as independent full-suite execution.

Two review-harness mistakes were corrected before successful verification: the before-image layout is `before/web/...`, and DOM text must be read from `document.body`, not `Document.textContent`. Neither required an application change; passing tests were not repeated.

No remaining finding in this patch's scope. Existing stale capture/reference, field-level source discrepancies, incomplete provider/publication qualification, unvalidated practical threshold and predictive/operational limits remain. The upstream frozen diagnostic wording boundary from the previous review also remains unchanged. Downstream surfaces were not newly reviewed.

No application/source edits, new fitting/origin, holdout access, provider/database/production request, build, deployment or Git mutation. No denied, pending or uncertain action and no review blocker.
