# Independent re-review — RSO visual corrections

Date: 2026-10-13

Decision: **Bounded ACCEPT of the three-file visual correction. Both prior visual findings are resolved; no remaining actionable finding in this increment.** The separate Yahoo cache reverse-owner P2 remains unresolved at this combined manifest. This is not acceptance of that cache reader or the complete current tree.

## Exact accepted identities

| File/artifact | SHA-256 |
| --- | --- |
| web/components/RosterScheduleOptimizer/CandidateBrowser.tsx | a2a9e229bf44e761f06cea8e01884c3cd9d15f83f1198d7432c8054211d4d254 |
| web/components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx | 81bf909f6135074bf28a0aedaca603fdb60a56e0b506e885d2efbae79ffe3b98 |
| web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss | e63f1b56d3047ba7273c5c8a372d204ae8466579c4521d3bc240bab1853bd7cb |
| candidate.sha256 | 21355140a36a4351e283fa75738e3d3c044e920bf7ac01e6c6efee88372e706a |
| review-corrections.patch | bd0e1749767afa9c88dce474f95c964766a937827ed276ccd4375d28a4c9dabc |
| combined-rso.sha256 | bf645584a66c789de44602930b778c6743028ae510c8a93f4529c5470f428c08 |
| browser-receipt.json | 70eb1ec9214776307f803ae8c4106743523b2891820c63a3408334d9b9f112f7 |

All three current files match the candidate pins. Before copies match the initially reviewed baselines4997f943…/e965f9ca…/369c0e6e…, and independent patch reconstruction yields all three corrected hashes exactly. The two combined manifests are byte-identical and all28 listed files match their pins on this check. Their main62e8342f… and nearest test634b7428… still represent the separately reviewed cache integration; the cache P2 source d9fcece2… is unchanged. Original first-pass patch/manifest/review evidence remains preserved.

## Finding closure and selective verification

P2 closure: supported and unavailable point groups now share one budget in each candidate list. Supported candidates retain existing points order, including0/negative values; unavailable candidates use the remaining budget in existing AGP order with their own truthful heading/warnings. Expansion depends on combined rows rather than either group separately. The selected Show count and search/team/position changes reset expansion. Category/schedule order retains its existing single-list behavior.

LOW closure: Find & filter now has40px desktop minimum dimensions and44px mobile dimensions. Manage's aligned grid column and summary are40px desktop and44px at both mobile breakpoints, including below360px. Protection and Manage retain separate targets and the compact visible ellipsis.

Independent command from web:

```sh
npm test -- --run components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx --reporter=dot
```

Actual result: **3 passed, exit0**. Two mixed-coverage regressions cover6+6 and3+3 supported/unavailable candidates, total count, unchanged ordering, missing values/warnings, combined expansion, changing Show count, and every filter reset. The earlier single-group case remains passing. Other card/tooltip behavior was unchanged; prior independent checks are not claimed as new runs. Owner's208 focused checks/lint and eight browser cases were inspected, not rerun or added to these counts.

## Interface evidence

Full mode, narrowly scoped to this correction, React/Next and established SCSS/tokens. Inspected corrected after-complete-1440.png, after-complete-320.png and after-candidates-390.png against the previously viewed fallback/reference and first-pass captures. Columns and controls remain in-frame, narrow roster metrics retain separate rows, and candidate ADD/DROP, negative tradeoffs, conditional and unavailable states remain visible.

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | Corrected desktop/narrow/candidate captures and mixed-value tests | Clear; compact labels and missing-value distinctions remain. Production font metrics unverified. |
| Surfaces | Corrected grid SCSS, screenshots and retained target bounds | Clear; targets meet40/44px and remain separated. |
| Animations | Correction diff and retained disclosure assertions | No new animation; no10% browser motion replay performed. |
| Icons | Manage ellipsis, protection and retained keyboard/tap assertions | Clear; visible icon unchanged while target grows. |
| Performance | Candidate budget/reset implementation and scoped tests | Clear within scope; fewer rendered mixed-coverage cards, no new network/effect work. No benchmark run. |

Read the owner receipt: eight complete/partial/conditional/empty desktop/mobile observations have no page errors/outbound requests or document horizontal overflow. Manage measures40x40 at1440 and44x44 at390/320, with4px protection separation. Filter disclosure measures281.7x40 desktop and308x44 mobile. Owner assertions cover repeated Enter and corner mouse/touch toggles without changing protection, existing tooltip interactions, dates, scrolling, exact selected swap and Undo. No fresh browser/server or user profile was used by this reviewer.

No actionable interface-polish findings remain in this corrected scope. Considered but rejected enlarging all row heights (the corrected target dimensions suffice) and removing the unavailable group to simplify count logic (its evidence distinction must remain). Production/header/fonts/assets, live Yahoo continuity, assistive-technology traversal and fresh independent browser execution remain unverified.

## Verdict and remaining gates

**Approve this visual correction.** The broader cache candidate still needs the reverse-owner equality correction and a new frozen manifest; this combined hash does not satisfy that independent finding. FORGE's sole combined TypeScript run remains pending and must target the final corrected source set. No original-issued forecast or public qualification follows from synthetic fixture acceptance.

A temporary local execution-bridge failure interrupted screenshot/patch checks; after recovery those checks were completed successfully. No source, compiler, live/account/provider/database request, Git/deployment, install or process modification occurred. Only this requested review report was intentionally written.
