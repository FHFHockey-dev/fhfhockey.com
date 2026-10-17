# Independent review — frozen RSO visual redesign

Date: 2026-10-13

Decision: **Needs changes in the frozen visual slice: one P2 result-count defect and one LOW hit-area polish finding. No HIGH accessibility finding observed.** Cache integration and its combined compiler/readback are outside this verdict. No source edit was made.

## Scope, identities and concurrency

Full review mode using the make-interfaces-feel-better skill. React/Next components and established DraftDashboard SCSS/tokens; scope is the exact17-file visual candidate, local fallback mockup, retained desktop/mobile screenshots and isolated fixture evidence.

Reconstructed every candidate in memory from visual.patch and the released baseline copies. All baseline hashes and all17 resulting candidate hashes match owned-files.json/candidate.sha256 exactly. The patch is incremental against those released files, not HEAD.

| Evidence | SHA-256 |
| --- | --- |
| visual.patch | a2f0f069e2439249448fc9604091e99744b590398d148ac2fcd7c7d65092edf7 |
| candidate.sha256 | 067b1a5ce3ba388ebc28b20d143a7fb2f89b8402a6d4a74be05e6485ec128eb4 |
| owned-files.json | ca4511746f91bdd8a7b62bf50c40ecd19bf96c8547372f23febbcb8c6e8e0ce7 |
| browser-receipt.json | 70c2f9acbf3304b2058af623fa9eaf234430cd0679d2be7a985497d7b25807fb |
| after.cjs | d38ac26c11138ded6a92483ac00ef7500518120dcf9e7f8d2dace785dbd2a078 |
| tests.json | 0431968bf621c4de6dc0df057f10e08f806dd99d3c9df115a1dd26d181982ab1 |
| format-tests.json | 351f46fbd7fb78420a8d1578f746103bf2b6739588c9073a792055b19bd09d58 |

Fifteen current presentation files still match their frozen hashes after verification. The main component and nearest main test are moving separately with cache integration. At initial inspection their working hashes were bc6f980f74039ce64acc9aadb1667f8a7547ed5c7b311678270c6eec11e30e95 and634b7428d566fcba65fc44c33e8c6b86bcc562d025c034fb688490f8df37d6c5. These are observations, not accepted combined-candidate pins. Reviewed their frozen versions through the exact reconstructed patch; did not test or approve the cache increment.

Exact reviewed visual identities:

| File under web/ | SHA-256 |
| --- | --- |
| components/RosterScheduleOptimizer/CandidateBrowser.tsx | 4997f9433ea09d7ff2d67ce5df35f89a6abecc430733c0dcd39b43bc182d29fc |
| components/RosterScheduleOptimizer/RosterContribution.tsx | b217dc9f03df5862241150f4a9c01f5b6b6045acb3ac2e92f37815a8a6db828b |
| components/RosterScheduleOptimizer/CompactSchedule.tsx | f6f713f8b7b72991be8f301d46b692d789222bf2729a04cc27cce0ac9d35e9f6 |
| components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss | 369c0e6ef4c3dc9ee0c5567c81404738da07d71dc6ad64640e4ae6f725dc8c2c |
| components/RosterScheduleOptimizer/TeamScheduleContext.module.scss | f6309cbfcb17c162aaed282ddc32c4515de8e111f439cdc2f11ab895d35ced54 |
| components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx | 79b25bf852367117601a7ec77b5b46c16740c97b758e9a7499c2071d98c7fecb |
| components/RosterScheduleOptimizer/TeamScheduleContext.tsx | 9987dbe46804f9b883d6e598835cbcbf4fdb8062adce8b32e867f99a7b4b355e |
| components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx | 124f14a4834115716592a1bd6d294f68dfd086ebfb1946a1d7e6d5259fda38c6 |
| components/RosterScheduleOptimizer/CandidateCard.tsx | 77a87d5787eb66953035fa29ee7cfde2df1d7000e1e00d2d5d3075a05304f1ed |
| components/RosterScheduleOptimizer/CandidateCard.module.scss | 1082181c40bd18026a83b2857a3ad85069999c79f72c8637b253952967657aba |
| components/RosterScheduleOptimizer/CandidateCard.test.tsx | 04206659b79c893bbb80847bddd0c5ccbdcd679a0a8da1bff986bcabf4c98d7a |
| components/RosterScheduleOptimizer/InfoTooltip.tsx | edbf37198e95677235f360e4f6e99e17bd820b0532c7964c8213ff36d681cce7 |
| components/RosterScheduleOptimizer/InfoTooltip.module.scss | ed103a66cd13c204fe6b70c4bb05d08fa2d205de84cfc134f5666f89e4d2d9a0 |
| components/RosterScheduleOptimizer/InfoTooltip.test.tsx | c8853db8c8d8a55312d6b4db2f486f2212c8e95a1d4e214be14eaa64f3db6a4a |
| components/RosterScheduleOptimizer/RosterPlayerRow.tsx | caba4a50e14cc573800dfee0fd8052d8566a49582d26cd3883f8764cbd73f326 |
| components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx | e965f9caa1536619133398139f04122eebbcfcad66c04a7bd4b01c333ff7f06e |
| __tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx | 283591b74a3f2d495647bf7b58458b5987f1c0db4abe1567de2cac75bd01e16f |

## Findings

### Result control consistency

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM / P2 | web/components/RosterScheduleOptimizer/CandidateBrowser.tsx:76 and:77; nearest test CandidateBrowser.presentation.test.tsx | Points-supported and points-unavailable groups each slice independently to the selected limit. Synthetic mixed input with six candidates in each group and alternativeCount5 renders10 articles. The “Show5” control and new count test imply a total count, while the test covers only one group. | Apply one display budget across the grouped result set, preserving points-first ordering and truthful missing-evidence grouping. Add a mixed supported/unsupported regression and verify expansion/filter reset. If the intended limit is per group instead, explicitly label that scope in the control. | A result-count control must describe the number it governs. The current UI doubles the selected count for mixed coverage, making the compact browser and its limit misleading. |

The defect is in the frozen, still hash-matching CandidateBrowser; it is independent of moving cache integration. It does not alter arithmetic or a selected plan's steps, but blocks acceptance of the advertised result-count behavior.

### Minimum hit area

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| LOW / P3 | web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss:307,:315,:328,:354,:362 | Find & filter has32px desktop minimum height. Collapsed Manage occupies a32px-wide grid column at desktop/mobile, despite40/44px heights. No hit-area extension is defined. | Give dense desktop disclosure targets at least40px in both dimensions and mobile Manage44px width, updating aligned grid columns without overlapping the adjacent protection target. Retain the small visible ellipsis if desired. | Minimum Hit Area: dense disclosure controls should retain a practical pointer/touch target while the table remains compact. This is a polish recommendation, not an observed keyboard failure or claimed WCAG violation. |

## Visual and behavior assessment

Inspected the fallback local Dark Fantasy Hockey Roster Optimizer Dashboard.png, before-1440.png, before-390.png, after-complete-1440.png, after-complete-390.png, after-candidates-390.png, after-itinerary-complete-390.png, after-conditional-1440.png, after-partial-1440.png and after-empty-1440.png. The supplied Library images were not available as bytes/pixels and were not inspected.

The redesign follows the fallback's three-panel hierarchy, wider individual schedule, compact aligned numeric roster columns and ranked paired acquisition cards, with established flat surfaces/accent rails. It remains an interpretation with different content, typography/header fixtures and accessible row sizing; it is not a verified pixel-identical match to the inaccessible updated reference.

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | Named desktop/mobile/partial/conditional screenshots, row/metric formatting source | Unknown ?, unavailable — and known-subtotal + remain distinct. Numeric columns align; tabular numerals retained. Production fonts and actual screen-reader traversal not verified. |
| Surfaces | Named screenshots, panel/card/row SCSS | Three desktop surfaces fit the retained1440x900 frame; mobile workspaces remain distinct. LOW dense disclosure hit-area finding above. |
| Animations | Tooltip lifecycle and static/disclosure source | No staged animation added; no new motion-dependent feedback. No browser motion replay at10% was performed; animated production behavior not verified. |
| Icons | InfoTooltip, Manage, protection, schedule source and captures | Help has named button,40px desktop/44px mobile target, visible focus and portal tooltip. Manage width issue noted above. Production images/logos not verified. |
| Performance | Tooltip listeners, candidate filtering, fixture bundler/real-worker evidence | Listeners clean up on close/unmount; guidance opens without network work. P2 doubled result display budget in mixed coverage. No independent performance benchmark. |

Critical schedule coverage, provisional/capacity-only status, over-capacity bench notice, unavailable forecasts, missing comparison evidence, conditional availability and reserve prerequisites remain visible rather than being placed only in hover guidance. In inspected conditional/partial captures unavailable points remain unavailable; missing opportunities are not converted to zero. Empty state preserves visible readiness/rule prompts.

Roster and schedule metrics read existing contribution ledger fields for the selected range. Schedule presentation does not recalculate a displayed week's counts as the entire horizon. Compact metrics preserve full semantic text in supplied labels/evidence disclosure; actual assistive-technology announcement is unverified. Existing native details expose daily contribution and management controls; protect remains persistent outside disclosure.

Acquisition cards visibly retain ADD and every DROP, paired net AGP/points, negative tradeoffs, conditional warnings and reserve prerequisites. The exact compared steps are sent unchanged to the selection callback; the frozen main handler copies all step fields/dependencies through the existing editIntent flow. Existing readiness/read-only and null/net-gain selection guards are preserved. Frozen intent-revision binding hides selected-plan status after Undo. No provider action or forecast/probability calculation is introduced by this presentation patch.

## Selective verification

Independent command from web:

```sh
npm test -- --run components/RosterScheduleOptimizer/InfoTooltip.test.tsx components/RosterScheduleOptimizer/CandidateCard.test.tsx components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx --reporter=dot
```

Actual: **7 tests passed,3 files passed, exit0**. Checks cover repeated focus/Escape dismissal, tap toggling/outside dismissal, hover transfer, exact selected steps, missing-point disable guard, negative-point/reserve tradeoffs and single-group result expansion/filter reset.

An additional in-memory React static-render probe mocked only candidate metrics, supplied six points-supported and six unsupported synthetic candidates, and set alternativeCount5. Actual rendered article count was10, confirming P2. The expected useLayoutEffect server-render warning from this synthetic probe is not a production SSR finding; actual RSO fixture uses ClientOnly. No application source/test file was written for the probe.

Read owner test JSON: five files,205 passed; four later formatting checks passed and specifically cover unknown range, supported collapsed active points/reserve separation, unmatched roster and range-versus-week ledger behavior. These are retained owner results, not independent reruns, and overlap with the seven tests above.

Read after.cjs/fixture evidence and browser-receipt.json. The script bundles actual page/Container/ClientOnly/styles and real planning/candidate workers with synthetic auth/API/calendar and substituted header/Next wrappers. It intercepts/aborts non-fixture network requests and uses fresh isolated contexts; local fixture reads are recorded separately. No user's browser/profile was inspected or reused by this reviewer.

The retained eight complete/partial/conditional/empty × desktop/mobile scenarios have no page errors, document width equal viewport width, desktop document height900 and panel bottoms within900. Owner script asserts tooltip keyboard Enter/Escape with retained focus and viewport bounds, repeated touch toggling, management/evidence disclosure, top-five expansion, exact timed add/drop selection, Undo/status dismissal, dates retained, tabs, roster scrolling, mobile schedule scrolling and320px overflow. These assertions and screenshots were inspected; no fresh browser run was performed here.

## Considered but rejected

| Location | Candidate | Rejected because |
| --- | --- | --- |
| Roster/schedule rows | Shrink all row heights toward the mockup's approximately28px density | Existing40/44px controls and readable evidence are more useful than exact synthetic density; only the undersized disclosure targets need adjustment. |
| Panels and candidate cards | Add the mockup's decorative glow/gradient effects | Existing DraftDashboard flat surfaces and accent rails establish hierarchy without a second style system or unrelated decoration. |
| Missing/conditional projections | Fill empty values to resemble the complete mockup | Unknown/unavailable states and private conditional semantics are substantive evidence boundaries; visual similarity cannot justify invented numbers. |

## Verdict and remaining gates

**Needs changes** for the P2 count control; LOW target sizing is a separate polish follow-up. No HIGH finding or additional swap/ledger/tooltip correctness blocker observed within this frozen slice.

Unverified: inaccessible updated Library reference, production header/font/image metrics, signed-in Yahoo/provider continuity, actual screen-reader traversal, live browser behavior independently rerun, moving cache integration, combined final hashes and reserved full TypeScript. The coordinator must reconcile corrected presentation with cache changes and obtain the designated combined compile; this report does not approve the current moving main/test files or a deployment.

No source edit, compiler, live/account/provider request, acquisition, Git action, install, commit/push/deployment or process interference occurred. Only this requested report was intentionally written.
