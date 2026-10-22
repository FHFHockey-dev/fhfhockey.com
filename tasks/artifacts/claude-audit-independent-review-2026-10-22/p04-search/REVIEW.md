# P04 search independent review — 2026-10-22

**Qualified acceptance for latest-query ownership, status, and mocked keyboard/link navigation. No blocking stale-result or stale-navigation defect demonstrated.** One P3 resource-use caveat remains below. Browser/AT/touch acceptance and whole-S09/release acceptance are not implied.

## P3 — `prefetch={false}` does not suppress hover/touch prefetch with installed Pages Router Link

At `web/components/StatsPage/PlayerSearchBar.tsx:157–160`, the new Next links pass `prefetch={false}`. Installed Next **15.5.22** `dist/client/link.js` uses that flag for viewport prefetch, but its mouse-enter and touch-start handlers still call `router.prefetch` with `priority: true` and `bypassPrefetchedCheck: true`.

A fixture retaining real installed Next Link and a mocked router dispatched one mouse-enter and one touch-start against a result. It observed **two prefetch calls** to `/stats/player/101`, without selecting/navigating. The explicit no-prefetch assertion fails; this was invisible to the owner's anchor-only Link mock. See [independent log](independent-tests.log) and [fixture](reviewSearchNavigation.test.tsx).

This is a concrete newly introduced speculative-load path and a nonblocking follow-up under the repository's runtime/transfer cost controls. It is **not** stale navigation or evidence that two production database/API requests occurred. Actual traffic, cache deduplication, transferred bytes, and cost are unmeasured. Parent should retain this limitation or assign a bounded no-hover-prefetch correction if that is the intended contract; a native anchor can preserve keyboard/modified-click semantics without Next's implicit prefetch. No code was changed here.

## Verified behavior

- Immediate generation increment on every input change prevents old success/empty/resolved-error/rejected-error updates, including during the newer debounce and while the new request is loading.
- Input clearing/shortening removes old DOM navigation targets and cancels queued debounce. Unmount cancels queued work and invalidates in-flight completions; a later mount stays empty. Outstanding network work is ignored, not physically aborted.
- Loading, empty, safe error, and recovered-result states remain distinct; no backend error detail is rendered. Dismissal does not reopen when a pending response arrives; focusing again can expose the current query's results/status.
- Native anchors have correct player hrefs and normal tab stops. Arrow movement/internal focus/Escape work in jsdom. With the real installed Next Link and mocked router, ordinary activation clears input and calls `router.push` once for the chosen fresh player. Ctrl/Meta/Shift/Alt activation is left to native navigation and does not clear search or call router push.
- No stale result remains available in the DOM after a new query starts; stale outcomes cannot create navigable links or stop newer loading.

## Independent checks

Fresh isolated snapshot: `/tmp/fhfh-queue-check-mx4zwpjs/isolation/snapshot/web`. Node **22.11.0**, npm **10.9.0**. Used the queue's source-copy recipe, isolated home/tmp, cleared synthetic environment and socket/HTTP(S)/unmocked-fetch denial. Supabase and router effects were mocked; installed Next Link was real in the independent fixture. No tests ran with the canonical checkout as test root.

| Check | Result | Evidence |
| --- | --- | --- |
| Owner's focused fixture | **14 passed** | [log](owner-tests.log) |
| Independent real-Link/race fixture | **10 passed, 1 failed** (prefetch caveat only) | [log](independent-tests.log) |
| Component/test scoped TypeScript | **Passed**, exit 0 | [config](tsconfig.p04.json), [log](typecheck.log) |
| Component/test ESLint | **Passed**, exit 0; 0 errors, existing raw-image warning | [log](lint.log) |
| Current source/test, isolated snapshot, original source | Exact hashes matched before/after | [start](hash-verification-start.json), [end](hash-verification-end.json) |

An initial reviewer fixture artificially clicked an already-detached anchor, producing jsdom's unsupported native-navigation warning. That test was corrected to inspect removal of the old DOM target (the actual user-reachable property) and rerun. The final retained log has no such warning. Native browser Enter/default navigation remains unverified; the ordinary-activation test uses a keyboard-style click (`detail: 0`), not a claim of browser Enter simulation.

Commands used the existing packet `run-tests.sh`/`run-check.sh` offline wrappers with this snapshot: the two named test files, `npm exec --offline -- tsc --noEmit --project tsconfig.p04.json`, and ESLint on the component/test only. Original owner's 11-before-failure claim was inspected, not independently rerun; its before component hash was independently matched to `git show HEAD`.

## Identity and limits

`octoberBranch`, tested snapshot HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15`. Before handoff, unrelated route-runner/admin-gate commits advanced canonical HEAD to `716896be8325a64f5cbd3ece9a1fdab48c50733f`; end verification caught the movement and confirmed both P04 file hashes still match the tested snapshot. Those unrelated changes are not qualified here.

| File | SHA-256 |
| --- | --- |
| `web/components/StatsPage/PlayerSearchBar.tsx` | `078fc18af0c5a50c5b1aa859f7bc99b13227c46025ed0138fd321bfe2f0a2826` |
| `web/components/StatsPage/PlayerSearchBar.test.tsx` | `dbe37d2a8d53c657c8e6cd130a951120642f875c4c10ccc9006e6e6802e2157c` |
| Original source at HEAD | `dc702cd14c1a27890d9f692030df09c3d6ec6cc4aecd3765584b11a65d1b71e0` |

Not verified: real browser pointer/blur ordering, native Tab/Enter navigation, screen-reader announcements, focus contrast, touch interaction, visual layout/zoom, live Supabase query behavior, full page integration, production cost or traffic. The touch-start test dispatches only a synthetic event to inspect Next's handler. No application or owner-artifact edits, network/provider/production requests, builds, installations, commits, pushes, or deployments. P03 was untouched. No denied/pending/uncertain external action; parent owns integration and the nonblocking prefetch follow-up.
