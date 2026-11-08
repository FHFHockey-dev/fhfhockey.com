# Final BLSH/sKO/VuDu accepted-slice proposal for Chef/L3

**Include the completed 17-file audit footprint, with the accepted L2 parser overlay, plus the separately accepted two-file closed process-evidence installation as its own slice.** Do not leave completed audit work out because it predates the six lanes. The previously accepted Yahoo test correction is separately tracked by L3 and is not duplicated here. This is an exact inclusion proposal, not a custody transfer, commit or release authorization.

Observed HEAD advanced concurrently to `5f6b4e7a3a893000fe31cc6928cd8736b56e5d39`; L2 performed no Git mutation. `AUDIT-INCLUSION-PINS.json` supplies **all 19 exact file paths, current SHA256, status, per-file diff hash and preflight comparison**. `AUDIT-INCLUSION.patch` captures the 17 tracked-file diffs at that HEAD; the two process-evidence files remain untracked full-file inputs, not represented by that patch.

**Attribution:** all 15 non-parser audit files still exactly match the six-lane preflight observation. The only two changed audit-footprint hashes are the accepted L2 parser/test candidates (`dc4cbb57…` / `a34517a7…`), whose installed hashes were verified. The 17-file current footprint is 555 insertions / 47 deletions: the original audit's 276 / 47 plus L2's 279 added parser/test lines. No extra successor hunk was discovered in this footprint.

## Concrete inclusion groups

Paths below are relative to `web/`; brace pairs name both exact files, expanded in the JSON manifest.

| Group | Include | Integration disposition |
|---|---|---|
| Parser/card consistency (6) | `lib/buyLowSellHigh/researchSnapshot{,.test}.ts`; `lib/buyLowSellHigh/displayProfile{,.test}.ts`; `lib/player-cards/retainedBlsh{,.test}.ts` | Keep together for the intended end-to-end semantics. Includes audit sign/withholding guards, L2 v3 validation, explicit assembler history-status handling, card unknown-direction/text on withheld profiles and test Uint8Array compatibility. Current assembler already supplies historyStatus; no assembler edit needed. Existing pinned arm-A bytes remain valid. |
| Independent BLSH detail (1) | `components/buyLowSellHigh/BlshPlayerDetail.tsx` | Safe existing-contract presentation: reads existing FP track amounts and optional direction text, explains support, absent market evidence and provisional opportunity. Does not require v3 snapshot replacement, new input admission, arm C or the process gate. Can ship with current pinned preview. |
| Coupled sKO/VuDu contract + UI (5) | `lib/skoElement/contract.ts`; `lib/skoElement/interpret{,.test}.ts`; `components/skoElement/SkoElementPreview{,.test}.tsx` | Treat as one slice: UI consumes new prior-window/goalie results fields, so do not cherry-pick UI alone. Contract v0.2 and interpreter provide disjoint personal prior blocks, preserved unknown game slots, goalie primitive/ratio validation and explicit start/relief missingness; expired derived forecast values abstain. UI exposes those fields using existing synthetic fixtures. No live adapter or forecast model change. |
| Independent VuDu population guard (2) | `lib/sko/gap{,.test}.ts` | Required expected-shot-population argument prevents comparing Fenwick/unknown populations with on-net SV%. Existing changed tests supply it. The audit's call-site review found only tests; the bounded relevant-directory trace here likewise found no live adapter call. Keep function and tests together. |
| Independent market validation (2) | `lib/buyLowSellHigh/market{,.test}.ts` | Reject nonfinite expectations/freshness, invalid shared horizon/scoring, overflow; preserve measured zero. No market data source or weighting adopted. |
| Support invariant regression (1) | `lib/buyLowSellHigh/supportGap.test.ts` | Existing scorer unchanged; retain the completed established-finisher regression, which prevents treating ordinary xG excess alone as a sell signal. |
| Separate closed process boundary (2) | `lib/buyLowSellHigh/currentProcessEvidence.server{,.test}.ts` | Include owner-reviewed default-closed installation at corrected hashes `9011207c…` / `fe82f1de…`. Both current full-file hashes match preflight and owner correction. These are separate owner provenance, not audit changes. |

## Process-evidence dependency clarified

The corrected server module imports `qualifyCurrentInputs` from `currentInput.ts`; the inspected production `lib/`, `pages/` and `components/` tree contains no static import/reference to `currentProcessEvidence` itself. The completed parser/card/UI slices therefore have **no runtime dependency on calling this gate**, and inclusion does not activate it. The pair matters to the whole-tree compilation candidate because both files are already present and TypeScript includes them; their old Buffer/BigInt errors were fixed. Keep the corrected installation as its own reviewed slice rather than attributing its earlier errors to the audit.

`CLOSED_PROCESS_EVIDENCE_POLICY.acceptances` remains empty. Compiler compatibility does not admit real NST source bytes. No consumer wiring, receipt acceptance, score recalculation or provider capture is implied.

## Evidence reused; no reruns

- Completed audit receipt `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`: final affected suite **407 passed / 4 skipped**, targeted lint and scoped diff checks, plus local desktop/mobile preview/interaction checks with requests isolated. Numeric and browser results remain dated evidence, not new execution here.
- Process owner correction: **87 focused checks**; FORGE's later provenance receipt records full typecheck success after correction. Neither is a fresh certificate for unrelated concurrent work.
- Accepted L2 parser: **74 canonical tests passed**, targeted isolated type/lint checks on the exact installed bytes and scoped diff check. No repeat in this disposition.
- This turn performed **read-only consequential hunk/dependency inspection and SHA/diff capture only**. No application tests, browser, typecheck, data reads outside existing code/receipts, or app edits.

## Genuine remaining gates, separated from inclusion

1. **Changing the saved BLSH snapshot:** obtain the exact authenticated source Profiles handoff, review a new mapper output with immutable numeric/evidence parity and update dependent server/card/sidecar pins together. This is not needed to include the current audit or parser. Existing snapshot/server/card pins were not changed.
2. **Arm-C adoption:** distinct assembler/history/reference-policy decision with exact source pins and reserved-season allocation. No reserved 2025–26 access or adoption here. Existing `currentWindows.ts`, `productionReference.ts`, `opportunity.ts`, trade fixture and snapshot/server paths have no current diff in this disposition.
3. **Fresh real sKO/VuDu evidence:** qualifying current-season receipts and accepted adapters remain missing. Preview is synthetic; goalie gap remains pending. Missing/unqualified FORGE expectations remain unavailable. Do not present completed arithmetic/UI checks as real-input or forecast-performance acceptance.
4. **Real current process scoring:** native receipt qualification and explicit acceptance are still needed; the closed gate's installation does not satisfy them. No new collection required for this candidate inclusion.
5. **Outstanding UI completeness:** position/top-25 list UX and opportunity presentation from the old mapper handoff are separate pending product work; today's BLSH detail changes do not claim to implement them. The already reported P3 team/date separator in the VuDu table remains a minor presentation issue, not a data-adoption blocker; no extra edit was authorized here.

No new blocker to including these local reviewed slices was found. Chef retains acceptance and L3 retains exact candidate composition; existing authors retain custody outside L2's grants. Remote release approval and broader release constraints remain separate from this inclusion proposal.
