# P04 P3 prefetch correction — 2026-10-22

Local correction ready for independent recheck. Addresses the concrete hover/touch caveat in [independent review](../../../claude-audit-independent-review-2026-10-22/p04-search/REVIEW.md). No browser or release acceptance claimed.

## Decision and minimal delta

There was no separate product requirement promising zero prefetch. The P04 implementation intended `prefetch={false}` to avoid speculative page loads, consistent with repository runtime/transfer cost guidance and the original search's selection-only navigation. Installed Next15.5.22 disables viewport prefetch with that flag but still invokes `router.prefetch` on mouse-enter and touch-start. The prior anchor-only mock hid those calls.

Changed only the result navigation boundary: a native `<a href>` replaces Next Link, and an unmodified ordinary activation prevents the browser default, clears the search, and calls the established `router.push` once. Actual href, natural tab stop, arrow focus, Escape, and modifier-native navigation remain. A keyboard-style click (`detail:0`) uses the same client navigation. No hover or touch handlers or speculative fetch path remain. Existing search request ownership/state logic is unchanged. There is no route prewarming, so selected-page loading receives no speculative head start; actual latency/cost are unmeasured.

## Reproduction and checks

Canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, HEAD `87ab20cbd6059d2e2116843f303ed00b4902c2ac`. Target files were clean and matched the original P04 candidate hashes before edits. Node **22.11.0**, npm **10.9.0**, installed Vitest **3.2.7**, installed Next **15.5.22**. No changes to packages/locks/configuration.

The adjacent fixture now keeps installed Next Link and router hook unmocked, with a real `RouterContext.Provider` whose routing operations are spies. Before changing the component, the expanded fixture ran against the real installed Link: **18 passed / 2 failed**, with **one prefetch call for mouse-enter and one for touch-start**. After the component correction, the same **20 tests passed**. This is actual Next event-handler regression coverage in jsdom; no mocked anchor implementation can hide prefetch again. The final component no longer imports Link.

Tests additionally confirm pointer-style and keyboard-style activation each navigate once; Ctrl/Meta/Shift/Alt clicks are not prevented by the component, do not clear input, and do not call `router.push`. A document listener observes that decision and then suppresses jsdom's native navigation. Prior stale-response, clearing, unmount, status, focus and dismissal fixtures remain passing. Supabase is mocked and unmocked `fetch` throws.

Exact commands from `web/` (before correction used the same test command with `before-tests.log` as output):

```sh
npm test -- --run components/StatsPage/PlayerSearchBar.test.tsx > ../tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p04-search/prefetch-correction/after-tests.log 2>&1
./node_modules/.bin/eslint components/StatsPage/PlayerSearchBar.tsx components/StatsPage/PlayerSearchBar.test.tsx > ../tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p04-search/prefetch-correction/lint.log 2>&1
./node_modules/.bin/tsc --noEmit --project ../tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p04-search/tsconfig.json > ../tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p04-search/prefetch-correction/typecheck.log 2>&1
```

- Final tests: exit0, **20 passed**; benign existing punycode deprecation warning.
- Scoped TypeScript: exit0, no diagnostics.
- Scoped ESLint: exit0, zero errors, one existing raw-image warning.
- Repository-root `git diff --check -- web/components/StatsPage/PlayerSearchBar.tsx web/components/StatsPage/PlayerSearchBar.test.tsx`: exit0.
- [delta.patch](delta.patch) contains only the two owned code/test files. Component delta: 7 insertions, 5 deletions. Test delta removes the Link mock and strengthens Next-context/event coverage.

## SHA256 pins

| File | Before | After |
| --- | --- | --- |
| `web/components/StatsPage/PlayerSearchBar.tsx` | `078fc18af0c5a50c5b1aa859f7bc99b13227c46025ed0138fd321bfe2f0a2826` | `ddd48a75a636aeba2721adf79f50bd44561c35d8399cc9e48e1b822c69bcc33f` |
| `web/components/StatsPage/PlayerSearchBar.test.tsx` | `dbe37d2a8d53c657c8e6cd130a951120642f875c4c10ccc9006e6e6802e2157c` | `33edc3fecc41818280146ed2cc6f3bec9172630418f31b3b1258a0f5366ce6e1` |

Delta patch SHA256: `f5a6c648b2dd0d34932a49d3c11152b72677b2dc271e17600a9af8b534c74a69`.

## Limits and handoff

Not verified: real browser Tab/Enter/default navigation, pointer/blur ordering, assistive technology, focus contrast, touch gestures, production traffic, cost or live route behavior. Synthetic touch dispatch demonstrates handler behavior only. In-flight search requests remain invalidated rather than aborted. The scoped accessibility semantics remain approved at the DOM/mock-event level only.

No shared-file conflict; no denied, pending or uncertain action; no running operation. No browser, real route/network/NST/production request, ingestion/runner edit, dependency/lockfile change, commit, push, migration or deployment. Source ownership is available to parent/reviewer. Prior receipts remain historical; these hashes supersede their candidate pins for this correction.
