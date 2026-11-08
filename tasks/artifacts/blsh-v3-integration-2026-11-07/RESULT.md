# BLSH skater v3 integration: local review candidate

## Outcome
The first safe integration slice is implemented locally. It is not a completed or released BLSH product. Default runtime/player-card snapshot pins and the production-preview 404 remain unchanged.

The next evidence-only step is also complete and independently reviewed: 44 later official PPP matches composed into a separate candidate, with no runtime/source/score change. Unresolved PPP fields decrease from 212 to 168; supported selected windows increase from 482 to 507. Of the latter, 417 have five records. See PPP-COMPOSITION-REVIEW.md and `tasks/artifacts/blsh-ppp-later-composition-2026-11-07/REPORT.md`.

- Separate F/D buy-low and sell-high lists show the saved top 25, with full lists one click away.
- FHFH Standard points gap leads. NHL points and Game Score remain separate supporting tracks; missing values are unavailable, not zero.
- All profiles remain inspectable. Withheld reasons can be filtered and paged, without promoting thin or unknown history into a direction.
- Detail focus, Escape/Close, presentation URL state and provisional opportunity comparisons are implemented. Opportunity never changes list membership or rank.
- Mapper-v1 continues to use its existing presentation.

Application changes: `web/components/buyLowSellHigh/BlshCandidateLists.tsx`, its `.module.scss` and `.test.tsx`, and a three-line v3 dispatch in `BuyLowSellHighPreview.tsx`. Scorer, mapper, parser, existing detail component, runtime loader, player-card pins and unrelated work were not edited.

## Authenticated candidate
`/Users/tim/Documents/Codex/2026-11-07/blsh-v3-integration/2026-10-28.arm-a.mapper-v3.candidate.json`

- 10,243,796 bytes; SHA-256 `daf447b70fd8e08dc88a2e17162e0c1dd04863275cd7e23dbd923acca34e4485`.
- Source: original `PROFILES-A-canonical.jsonl`, 10,874,930 bytes, SHA-256 `0ea21a45568761851856964e7f925a097002c227c5dd7c1c5ddca7c072c6dfb4`. This matches the original runtime snapshot's source pin and saved capture receipt.
- Passed the current runtime parser. All 729 identities, original numeric scores, complete track/attribution values and selected current windows are unchanged. v3 adds presentation roles, eligibility gates and list ordering, not new empirical estimates.
- Lists: 169 buy-low / 112 sell-high / 448 withheld. F: 103 / 82. D: 66 / 30.
- Versus the v1 display, 167 previously listed players are withheld: 84 without personal history, 39 below the provisional 20-game minimum, 15 short windows, 29 conflicting headline direction. The underlying numeric scores did not change.
- Opportunity remains unavailable on all 729 original profiles. No comparison was invented to fill that gap.

`PACKAGE-RECEIPT.json` beside the candidate records all membership changes and preservation checks. `package-candidate.ts` is the offline reproduction script. It reads only the two pinned input files and runs the mapper/parser; it does not run empirical scoring, fetch data or read the reserved 2025–26 holdout. Compact JSON preserves the existing 12 MiB reader bound. No runtime repin is performed.

## Verification
- Thirteen authored synthetic component tests pass, covering top-25/full lists, F/D navigation/query state, withheld history/status/age, missing tracks, detail focus/Escape, v1 preservation, stale warnings and opportunity sign/non-mutation. A separate independent review found three issues; all were corrected and re-reviewed. See INDEPENDENT-REVIEW.md.
- Full canonical TypeScript check and scoped lint passed; final receipts/logs accompany this file.
- Real Chromium component checks passed at 1440×1000 and 390×844 with the authenticated candidate. Actual preview components and styles are used. A mobile overflow caused by a long withheld-reason selector was found and fixed; tables now scroll inside the page rather than widening it. Details use 44-pixel targets.
- Browser scope is explicitly narrower than end-to-end deployment: an isolated presentation router is used, not the full Next route/app providers. No `.env` files or live providers are loaded. Node and browser network guards allow only the local test server. An initial sandbox browser launch was blocked; the permitted external-sandbox local check ran successfully.
- `MANIFEST.json` records exact source/dependency hashes. The shared checkout continued changing in other lanes, so the manifest, not a claim that the entire working tree is isolated, identifies this candidate.
- The bounded source-readiness recheck and exact remaining evidence gates are recorded in SOURCE-READINESS.md. It distinguishes original Game Score nulls from the already reviewed, separately held research-copy trial.

## Remaining gates and exact next steps
1. Review this UI/candidate. If approved for local integration, update the immutable snapshot and all dependent runtime/player-card pins together, then rerun parser, preview/detail and card parity tests. Keep the production 404 until an explicit release decision. Verify the actual Next route after activation; component-browser success does not cover that step.
2. Qualify source evidence before issuing a fresh capture. Resolve the native NST raw-body/parser/revision receipt, carry forward only the exactly reviewed PPP composition, and retain TOI/exposure holds rather than accepting all matching point totals. The real source-gate acceptance arrays remain empty. This capture is old research, not a current recommendation.
3. Resolve the operational personal baseline without silently consuming the reserved 2025–26 holdout. Arm-C code and development comparisons exist, but its weights/current-season blend and operational input composition are not automatically adopted by this UI. Freeze the validation decision, inputs and qualified baseline before a new empirical scoring run.
4. Attach opportunity results only from qualified matching inputs; validate the adjustment separately and retain its non-ranking, provisional status until supported. This old candidate cannot demonstrate available opportunity data.
5. Finish the agreed first-pass product adapters separately: manager scoring, qualified current capture, original goalie/VuDu and trade-comparison paths, and watchlist/draft persistence where still required by the first-pass brief. Forecast availability must not block core skater lists. Yahoo market access/rights and observed-trade evidence are a separate priority, not permission to invent a market value or bundle every future product into this release.
6. Once the complete intended candidate is reviewed, create an exact release manifest and run the bounded release checks. No commit, push, remote build, DB write or deployment was performed in this slice.

Product authority: `tasks/artifacts/blsh-brief-decisions-2026-11-03/DECISIONS.md`. Original scope: `tasks/TASKS/prd-buy-low-sell-high.md`. Implementation diary: `tasks/diaries/2026-11-07-codex-blsh-v3-integration.md`.
