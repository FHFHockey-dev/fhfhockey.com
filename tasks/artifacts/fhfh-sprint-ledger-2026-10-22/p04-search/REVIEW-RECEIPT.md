# P04 — shared player search local candidate

Status: implemented locally; ready for independent review. No release or whole-S09 acceptance claimed.

## Scope and source evidence

- Checkout: `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`, starting HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15`.
- Assigned first P04 lease only: `web/components/StatsPage/PlayerSearchBar.tsx` and new adjacent `PlayerSearchBar.test.tsx`. No navigation/page follow-on, shared-file changes, ingestion or runner edits.
- Original source hash: `dc702cd14c1a27890d9f692030df09c3d6ec6cc4aecd3765584b11a65d1b71e0`. Target component was clean at start; unrelated dirty work preserved.
- Read root AGENTS.md and named WORK-PACKETS.md / HEALTH.md. Repository `.agents/skills` absent. Home `.agents/skills` contains only REA, which explicitly excludes ordinary source-repository analysis. Used available better-accessibility guidance; read Supabase skill, with its online docs/live verification superseded by the task's offline-only restriction.

The initial fixture suite mounted the actual component and controlled the existing Supabase chain with deferred promises. Against the original source, **11 failed / 1 passed**: newer-result overwrite, stale completion before the newer debounce, clear and short-input reopening, debounce work after unmount, missing loading/error/empty feedback, missing native keyboard targets, and responses reopening after blur/Escape. See `baseline-tests.log`. That log is from the initial 12-test revision, before two additional fixtures and the Link mock's forwardRef correction; it is not the final 14-test suite result.

## Final changes

- Increment request ownership immediately on input changes, selection and unmount; capture input as a string; cancel pending debounce on invalidation/unmount. Both resolved errors and thrown rejections are handled, and obsolete requests cannot write state.
- Clear previous results while the new query is pending. Render distinct loading, empty and safe error messages through a stable status region. Completion does not reopen a dismissed dropdown.
- Replace mouse-only `li` selection with native Next links to the same player routes (`prefetch={false}`), keeping existing list styling. Preserve modified-click navigation; ordinary selection clears search.
- Bound label/input association; result images are decorative to avoid duplicate link names. Arrow keys move focus among results; Escape returns focus to input and dismisses. Blur within the search keeps it open; leaving the whole control closes it. Natural Tab order and native link Enter activation are retained.

## Verification commands and results

Environment confirmed with `node --version` → `v22.11.0`, `npm --version` → `10.9.0`. Installed Vitest reports `v3.2.7`. No packages were installed or changed.

Run from `/Users/tim/Code/fhfhockey.com/web`:

```sh
npm test -- --run components/StatsPage/PlayerSearchBar.test.tsx > ../tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p04-search/fixed-tests.log 2>&1
./node_modules/.bin/eslint components/StatsPage/PlayerSearchBar.tsx components/StatsPage/PlayerSearchBar.test.tsx > ../tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p04-search/lint.log 2>&1
./node_modules/.bin/tsc --noEmit --project ../tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p04-search/tsconfig.json > ../tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p04-search/typecheck.log 2>&1
```

- Tests: exit 0, **14 passed**. Cover out-of-order completion, immediate invalidation, clear/short input, cancelled unmount debounce, current rejection and rejection after unmount, hidden previous results, 200ms debounce/10-row bound, loading/empty/resolved-error/recovery, stale error, native link semantics/arrow focus/internal blur/Escape, modified click, post-dismiss response.
- Scoped ESLint: exit 0, **0 errors / 1 warning** for the existing raw `<img>` (`@next/next/no-img-element`). No image-system redesign in this packet.
- Scoped TypeScript: exit 0, empty diagnostic output. Config roots are this component, its fixture and the established bootstrap declarations; imported dependencies are checked. No full application typecheck claim.
- From repository root: `git diff --check -- web/components/StatsPage/PlayerSearchBar.tsx` → exit 0. Final diff inspected; no unrelated source edits made by this worker.
- Fixture mocks `lib/supabase`, Next routing/link navigation, and makes global `fetch` throw. No real app routes, environment files or service clients are loaded by these fixtures. No network, production/NST requests, browser crawl, builds, migrations, dependency changes, commits, pushes or deployments executed.

## SHA256 pins

| File | SHA256 |
| --- | --- |
| `web/components/StatsPage/PlayerSearchBar.tsx` | `078fc18af0c5a50c5b1aa859f7bc99b13227c46025ed0138fd321bfe2f0a2826` |
| `web/components/StatsPage/PlayerSearchBar.test.tsx` | `dbe37d2a8d53c657c8e6cd130a951120642f875c4c10ccc9006e6e6802e2157c` |

Recheck with `shasum -a 256 web/components/StatsPage/PlayerSearchBar.tsx web/components/StatsPage/PlayerSearchBar.test.tsx` from repository root.

## Accessibility scope and limitations

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH, addressed | `PlayerSearchBar.tsx`, result rendering | Non-focusable mouse-only list items | Named native links, natural tab order, arrow focus and Escape | Keyboard users can reach and activate a player destination. |
| MEDIUM, addressed | `PlayerSearchBar.tsx`, blur/status handling | Timer closes even during internal focus; silence on empty/error | Focus containment; stable status text | Result interaction remains available and request outcomes are distinguishable. |

Approve the inspected DOM semantics and mocked keyboard handlers only. **Not verified:** native browser Tab/Enter navigation, Next router integration, screen-reader announcements, visible focus contrast, touch behavior, visual layout/zoom, live Supabase query behavior or latency. These require separate isolated browser/AT evidence. In-flight queries are ignored after invalidation, **not physically aborted**; 200ms debounce and limit10 are unchanged. No production cost savings claimed.

No shared-file conflict or denied/pending/uncertain tool action. No operation remains running. Source ownership may transfer to the independent reviewer/parent; later P04 page/navigation work remains outside this assignment. Diary retained for handoff; exclude it from release candidates.
