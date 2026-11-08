# BLSH pagination P2 re-review — closed

**P2 closed for the exact corrected `candidate-v2.html`. No additional findings.** Independent local Chromium execution reproduced the original bug and verified the correction across the full, supported, unresolved and search-filtered lists at desktop and 320px widths. This report supersedes the pending runtime disposition in the preserved [earlier review](REVIEW.md).

Accepted correction: `/Users/tim/Documents/Codex/2026-10-27/task-3/current-evidence-visual-candidate-20261101-01/pagination-focus-fix-01/candidate-v2.html`, SHA-256 `097c0d2f399b094c04014b17da105bef074abb36f137da6d9624db42d2614b9b`. Packet receipt SHA-256: `541bd1accd9c8cf45b24d0daf9f0573271c37dcdae39cc510d197da27062f1d6`.

The original immutable HTML still reproduces the reported defect: after 725→740, focus falls to `BODY`, the result count moves to the top of the viewport, the first new row is 80,673.75px below it, and next Tab selects **Details for A.J. Greer**. This confirms the original trigger was exercised rather than inferred from the patch.

For the corrected candidate, all eight final-batch cases pass:

| Layout | View | Final transition | First newly revealed heading / next Tab target |
| --- | --- | --- | --- |
| 1440px | All | 725→740 | Yegor Sharangovich / his Details button |
| 1440px | FP supported | 475→482 | Zach Dean / his Details button |
| 1440px | FP unresolved/different | 250→258 | Yan Kuznetsov / his Details button |
| 1440px | Search `x` | 25→35 | Felix Unger Sörum / his Details button |
| 320px | All | 725→740 | Yegor Sharangovich / his Details button |
| 320px | FP supported | 475→482 | Zach Dean / his Details button |
| 320px | FP unresolved/different | 250→258 | Yan Kuznetsov / his Details button |
| 320px | Search `x` | 25→35 | Felix Unger Sörum / his Details button |

Every first-new heading is the active element, has `tabindex=-1`, is fully visible, and has a visible focus outline. The next actual Tab reaches that player's Details button. Enter opens detail and focuses its heading; Escape restores the correct Details button in all eight cases. Six intermediate 25→50 cases also pass across the three paginated evidence views at both widths. Clear filters returns focus to search. Both zero-shot views retain all 20 profiles and correctly hide pagination.

The desktop supported final batch has only seven rows. Chromium clamps scrolling at the document bottom, so its first-new row starts at 116.0625px and its heading at 133.671875px, fully inside the viewport. The first audit run had an overly strict assertion requiring row top below 100px and stopped there after the original reproduction and full-desktop correction passed. The resumed run checks the actual requirement—visible focused heading and correct next Tab—and passes. This is a harness correction, not a remaining application defect; the original/full-desktop checks were preserved and not rerun unnecessarily.

Evidence:

- [RESULT.json](RESULT.json): original defect reproduction and corrected full-desktop pass, followed by the too-strict harness assertion.
- [runtime-02/RESULT.json](runtime-02/RESULT.json): seven remaining final cases, intermediate cases, detail return, both zero-shot views and final successful state `PASS_P2_CLOSED`.
- [review.cjs](review.cjs): preserved original focused harness; [review-resume.cjs](review-resume.cjs): exact corrected/resumed harness used for the completed run.
- [runtime-02/final-1440.png](runtime-02/final-1440.png) and [runtime-02/final-320.png](runtime-02/final-320.png): independently inspected screenshots after detail-return focus, showing the correct visible Details target.

All 56 input/source pins match. The template and HTML change only the exact pagination handler. Embedded payload bytes remain identical to the original HTML and `DISPLAY-DATA.json`: **740 profiles, 3,461 selected records, 482 supported FP windows, 212 unresolved PPP fields and 20 zero-shot windows**. Metric values/nulls, source discrepancies, timestamps, no-score state, original artifact and all ten shared scorer/preview/snapshot files remain unchanged. The separate 150 dated PPP candidates remain uncomposed.

No horizontal overflow was observed in the eight tested final states. axe returned zero violations for the desktop and 320px search-final states. No external page requests or page errors occurred. Real assistive-screen-reader sessions, other engines and browser page zoom were not rerun for this narrow handler correction; their prior limitations remain. Applied the previously loaded better-accessibility guidance. **Approve for this focused pagination/accessibility re-review.**

The initial authorization denial was resolved by the parent's trusted transcript evidence that TJ explicitly restarted BLSH and directed continued progress. The single retry of the denied operation was approved and executed. Subsequent execution only completed the remaining already-authorized local checks after correcting the harness assertion. The original blocked handoff and its hashes remain preserved; no workaround bypassed a denial. No pending approval or execution blocker remains.

No source/application edits, provider/production/database requests, holdout access, repairs, scores, build, deployment or Git mutation. Browsers closed and all owned locks released. Full prior-sidecar, native NST, exact consumer/input and scoring qualifications remain separate; closing this UI finding does not weaken those gates.
