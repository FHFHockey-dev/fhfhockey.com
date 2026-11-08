# Independent BLSH local-persistence review

## Conclusion

No remaining source-review blocker in the 12 files pinned in `MANIFEST.json` (2026-11-07T22:30:18Z). The implementation owner confirmed its source/test freeze at these hashes; the adjacent retrospective owner also confirmed its final pins. This is a source-review conclusion, not whole-branch approval, a completed runtime verification, or release authorization.

Two P2 defects and one lower-priority namespace-transition defect found by this reviewer are fixed. The parent's separately discovered malformed-offer aggregation defect is also fixed and reviewed. Final combined verification remains with the parent/implementation owner.

## Findings and disposition

### P2, fixed: External draft deletion blocked all conflict recovery

- Original location: `web/components/blshTrade/BlshTradeComparison.tsx:62-73,104-108` at initial hash `cf750ea5d70c0b835a223b2a51964cc655b1e06d92ed01b631670c22c5ddcddd`.
- Reproducer: start with a nonempty saved draft, remove its namespace key or clear storage in a second tab, then try Reset/Save in the original tab. The hook correctly read an empty ready state, but the editor kept the previous baseline. Save/Reset rejected the conflict while Load was disabled because `present=false`. Reload was the only recovery.
- Final fix: `BlshTradeComparison.tsx:73-78,112` allows explicit loading of a ready empty state. This updates the baseline without silently discarding unsaved editor state on storage events.
- Regression: `BlshTradeComparison.test.tsx` covers another-tab deletion, retained editor state, conflict, enabled Load, then successful Reset. The browser harness also contains a real two-tab deletion-recovery scenario.
- Review method: static control-flow review plus reading owner regression source/logs. No reviewer-run browser test.

### P2, fixed: Inherited object names in unknown saved IDs crashed the editor

- Original locations: `BlshTradeComparison.tsx:180` and `retrospective.ts:36`, each using unguarded `evidence[id]`.
- Reproducer: persist a valid draft with `give: ["constructor"]` and `receive: ["fx-f3"]`, then render/reload. `toString` and `__proto__` also resolve inherited members from an ordinary evidence object. `retrospectivePlayer` treated the inherited member as a profile and dereferenced `profile.score.headline`, throwing instead of showing an unavailable identity.
- Final fix: both locations now use `Object.prototype.hasOwnProperty.call(evidence, id)` and supply undefined for inherited names. Ordinary unavailable IDs remain preserved/removable, and explicitly owned evidence entries with these names still work. No prototype mutation.
- Regressions: component tests cover all three persisted names, removal/save, and unchanged Object.prototype descriptors. Retrospective tests cover those names plus ordinary unknown IDs on both sides, and explicit own evidence entries.
- Review method: final guard and regression source inspection; adjacent owner's 22/22 passing log read.

### P3, fixed: Late fixture save completion could update a real editor after a namespace switch

- Original locations: `useBlshLocalState.ts:30-46`, `BlshTradeComparison.tsx:42-66` before editor extraction.
- Reproducer: defer a Web Locks request, begin fixture save, rerender the same component with non-fixture records, let the real state hydrate, then release the fixture request. Its old completion could place fixture selections/baseline/success notice in the real editor. The draft conflict guard protected a different persisted real draft; this was UI state contamination, not demonstrated real-key overwrite.
- Final fix: `BlshTradeComparison.tsx:42-48` keys the inner editor by fixture/real scope. Old callbacks remain attached to the unmounted editor and cannot change the new one.
- Regression: deferred Web Locks test verifies real unavailable identity/editor and real storage survive the fixture completion, while the intended fixture key is saved.
- Scope: current `/buy-low-sell-high/trade` is fixture-only. This was a reusable-component boundary concern, now resolved.

### Parent-found adjacent defect, fixed: Structurally invalid offers could double-count retrospective totals

- Location: `web/components/blshTrade/retrospective.ts:36-47`.
- Reproducer: a legacy draft contains duplicate IDs or the same ID on both sides; a missing forecast makes retrospective fallback offerable. The old combined-player-array/`ids.includes` aggregation could count repeated identities more than once.
- Final fix: lines 37-43 reject an empty side, duplicates on either side, and cross-side identities. Both side totals and net are null, with a reason; the original player IDs are retained rather than silently repaired. Valid offers retain the existing result.
- Regression: eight malformed-offer cases, including unknown duplicates/cross-side IDs, assert null totals/net, preserved IDs, and unchanged input/evidence. Final `retrospective.test.ts` log: 22/22 passed.

## Reviewed invariants

- Own version-2 key; real and fixture trade namespaces separated. Fixture reads never import legacy v1.
- Valid v1 is read without writes and copied only during an explicit mutation. The original v1 bytes remain unchanged. Empty v2 reset/clear records prevent old data from reappearing on reload.
- Invalid/future/malformed data remains untouched; saving is unavailable. Blocked reads and quota/write failures are surfaced without falsely claiming persistence or changing the displayed watch state optimistically.
- SSR/hydration effects only read. No mount-time write.
- New watch entries contain identity, kind and timestamp only. Legacy values remain preserved but are not presented as bookmark evidence. Missing saved IDs stay visible and removable.
- Section mutations read current storage and preserve unrelated draft/watchlist/market-reference state and keys. Save/reset rejects stale draft baselines instead of silently replacing another tab's draft.
- Trade selections persist no horizon, scoring, forecasts or research gaps. Retrospective evidence stays separate from forecast/custom scoring; the trade history-withheld headline/index remains neutral.
- Candidate membership/rank comes from the immutable supplied snapshot, not local bookmarks or URL state. Existing stale-capture, dated-evidence and research-only caveats remain present.
- Controls retain explicit labels/button types, hydration/pending disablement, status messages and appropriate local action target sizes. Existing detail focus/Escape restoration is preserved in source/tests.
- Web Locks serialize cooperating writes where available. The documented no-Web-Locks fallback cannot guarantee atomic simultaneous writes; no stronger claim is made.

## Verification boundaries

The reviewer ran no application tests, typecheck, lint, build, browser session, external-provider request or deployment, and changed no application/source/data files. Parent owns final verification.

Evidence read, not independently executed:

- Final owner receipts `../blsh-local-persistence-2026-11-07/CHECKS.json` and `RESULT.md` record **73/73 combined tests passed**, final canonical full TypeScript passed, and scoped lint passed. CHECKS.json records zero exit codes for tests/types/lint, Node v22.11.0 and an 8192 MiB typecheck heap. These supersede the earlier 48-test checkpoint and initial default-heap OOM; the failed attempt is not counted as a pass.
- Adjacent owner's `../blsh-retrospective-offer-guards-2026-11-07/vitest.log` also records 22/22 focused tests passed on final retrospective pins; those cases are included in the final combined suite.
- Final `../blsh-local-persistence-2026-11-07/browser.json` and `browser-final.log`, corroborated by RESULT.md, record passed actual Chromium component checks on the frozen code and final retrospective guard. Results include real two-tab deletion recovery, v1 preservation, fixture isolation, unavailable IDs, layout/focus checks, and empty runtime-error/blocked-request arrays. The reviewer read these records, not the browser itself.
- Browser harness source was inspected: actual components/styles, fixed retained candidate, isolated presentation router, localStorage/reload/two-tab interactions, v1 preservation, unavailable IDs, malformed storage, layout and focus. This is not the full Next route or production verification. No application verification remains pending in the owner's final receipt; broader release checks remain outside this review's scope.

## Pins and concurrency

See `MANIFEST.json` for exact SHA-256/byte counts of all 12 final reviewed files. Key final pins:

- `storage.ts`: `ee1dbe605c1103b212f1659b1439caedf23252acb6b45b3f6144b019206cb3c4`
- `useBlshLocalState.ts`: `4a84f620492520ab9483cf259895ff44f9543702c52f9f84b53381cee4ebad2e`
- `BlshCandidateLists.tsx`: `c64ed8194051f481a4eeca3f0f97536618a9ea3a799c0a936450ec79ccc70bbb`
- `BlshTradeComparison.tsx`: `01b6bbdfba1c0b246abfdcbbea13e05c3dda79f308a28d38e5c6846691171774`
- `BlshTradeComparison.test.tsx`: `d70910a3d14a4fed85b9e7bdbd46cbcdbfbc0389e024ee532e19d6d7cc0a0887`
- `retrospective.ts`: `9c5869cce3b6ce1ce961dab2ab9272917a84e5ed0a463e29e280ed5d4185fba1`
- `retrospective.test.ts`: `2b588c6bdd8a1ea49eea671414c13d5ee7061695f6451d3ca49f2da7f3b7c4d4`

Canonical checkout `/Users/tim/Code/fhfhockey.com`, `octoberBranch`. Concurrent HEAD moved from `7ee41022a1ff66e50986e1c8cd2e4ebf6e6e849a` through `f123bf3d1f12bf40f5db3282e6a64c45377469c5` to `620be8ffefa04670a6eb07bf09db61bae3508104` at final pin capture. The working tree also contains unrelated edits; none are covered by this conclusion. If any pinned file changes, re-review the changed scope before relying on it.
