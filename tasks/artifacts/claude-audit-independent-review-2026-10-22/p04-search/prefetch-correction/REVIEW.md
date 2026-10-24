# P04 prefetch correction — independent re-review, 2026-10-22

**Qualified acceptance. The P3 hover/touch prefetch finding from the [original independent review](../REVIEW.md) is closed for the pinned correction below. No new defect demonstrated.** This accepts the navigation correction at the source and isolated DOM/event-fixture level, not browser, accessibility, full-S09, or release acceptance. Parent owns integration.

## Findings and evidence

- The corrected component uses a native anchor with a real player href and no hover/touch handler. The installed Next router hook remains real; router operations are spies. The previously failing independent hover-plus-touch oracle now records **zero prefetch calls and zero pushes**. The owner's separate hover and touch assertions also pass. The old failure was established in the earlier independent review; its baseline suite was not repeated here.
- Ordinary pointer activation and keyboard-style activation (`detail: 0`) prevent native duplicate navigation, clear the input/results, and call `router.push` exactly once with the selected player URL. The independent fixture checks no `replace`, `back`, or `forward` call. This verifies the component's history API choice, not actual browser history traversal.
- Ctrl/Meta/Shift/Alt clicks and middle-button `auxclick` retain the search and href, do not call the router, and are not prevented by the component. A fixture listener observes that decision before suppressing jsdom's native navigation. An already-prevented activation neither clears nor routes. Natural anchor tab stops and arrow focus remain intact in jsdom.
- Existing latest-query, clear, unmount, stale success/error/loading, dismissal, and fresh-result-target coverage remains passing. The patch does not modify request generation, debounce, status, or focus logic. Outstanding requests are still invalidated rather than aborted.
- Actual delta inspected: only the component's import/hook/link activation boundary changes, alongside stronger owner tests. Reversing `delta.patch` in a private copy exactly reproduces both previously reviewed source hashes. No application or owner artifact was edited by this review.

## Checks actually run

Fresh isolated snapshot: `/tmp/fhfh-queue-check-tuhnc30g/isolation/snapshot/web`. Node **22.11.0**, npm **10.9.0**, Vitest **3.2.7**. Used the original queue's source-copy recipe, synthetic cleared environment, isolated home/tmp, socket/HTTP(S) denial, and unmocked-fetch denial. No tests ran with the canonical checkout as their test root; Supabase and router effects were mocked.

| Check | Result | Evidence |
| --- | --- | --- |
| Owner search fixture | **20 passed** | [tests.log](tests.log) |
| Independent search/navigation fixture | **14 passed** | [fixture](reviewSearchNavigation.test.tsx), [tests.log](tests.log) |
| Component/owner-test scoped TypeScript | **Passed**, exit 0 | [config](tsconfig.p04.json), [typecheck.log](typecheck.log) |
| Component/owner-test ESLint | **Passed**, exit 0; zero errors, one existing raw-image warning | [lint.log](lint.log) |
| Component/owner-test `git diff --check` | **Passed**, exit 0 | [end verification](hash-verification-end.json) |
| Current/snapshot/reverse-patch identity | Exact matches; source unchanged at handoff | [start](hash-verification-start.json), [end](hash-verification-end.json) |

The independent fixture preserves the previous no-prefetch assertion. Its former expectation of Next Link's internal two-argument `push` call was replaced by a URL assertion and explicit no-replace/back/forward assertions, because this correction deliberately calls the public `router.push(url)` API directly. Three added cases cover previously prevented, middle-button, and ordinary pointer activation. No prefetch or navigation assertion was weakened.

Commands used the existing A7–A9 packet offline wrappers with the snapshot above:

```text
run-check.sh <snapshot> node --version
run-check.sh <snapshot> npm --version
run-tests.sh <snapshot> components/StatsPage/PlayerSearchBar.test.tsx components/StatsPage/reviewSearchNavigation.test.tsx
run-check.sh <snapshot> npm exec --offline -- tsc --noEmit --project tsconfig.p04.json
run-check.sh <snapshot> npm exec --offline -- eslint components/StatsPage/PlayerSearchBar.tsx components/StatsPage/PlayerSearchBar.test.tsx
git diff --check -- web/components/StatsPage/PlayerSearchBar.tsx web/components/StatsPage/PlayerSearchBar.test.tsx
```

## Identity and limits

Canonical branch `octoberBranch`; snapshot and final HEAD both `a6e9f8b61903ed4bb2bba6b21bf8597f51ac85d0`. These are working-tree candidate pins, not a claim that HEAD contains the correction. Canonical HEAD moved before staging due to other work; acceptance is tied to the source hashes, not those unrelated changes.

| File | SHA-256 |
| --- | --- |
| `web/components/StatsPage/PlayerSearchBar.tsx` | `ddd48a75a636aeba2721adf79f50bd44561c35d8399cc9e48e1b822c69bcc33f` |
| `web/components/StatsPage/PlayerSearchBar.test.tsx` | `33edc3fecc41818280146ed2cc6f3bec9172630418f31b3b1258a0f5366ce6e1` |
| Owner `prefetch-correction/delta.patch` | `f5a6c648b2dd0d34932a49d3c11152b72677b2dc271e17600a9af8b534c74a69` |

Not verified: real browser Tab/Enter/default navigation or Back/Forward traversal, pointer/blur ordering, touch gestures, assistive technology, focus contrast/layout, live player routes, source/provider behavior, actual latency, production traffic, or cost. Synthetic touch checks handler behavior only. Router spies prove the chosen navigation operation, not the framework's or browser's history implementation. Removing prefetch removes speculative route prewarming; its user-visible latency tradeoff is unmeasured.

P01 and P03 were not rerun. No app/owner-artifact edits, env/credential reads, network/provider/production requests, browser, build, dependency installation, commit, push, or deployment. No blocked, denied, pending, or uncertain action; all review processes completed.
