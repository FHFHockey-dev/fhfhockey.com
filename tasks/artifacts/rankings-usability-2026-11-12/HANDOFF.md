# Rankings usability: local page-state improvements

Future release preparation is now recorded in **`RELEASE-PLAN.md`** with file-only application checks in `RELEASE-PREFLIGHT.json`. The two reviewed source hashes remain unchanged. The patch reproduces the exact candidate over the retained production base and pending Goalie candidate; it does **not** apply to the differing local `master`. Unrelated dirty Rankings stylesheet edits are excluded. No build/release slot is allocated to this lane and none was used.

Status: locally verified, uncommitted work for parent review on `octoberBranch`, based on `24b1cb4d3048a3dba8234cf92c62e8f2b72f877f`. No deployment, production request, database read, provider call, forecast, regeneration or migration occurred. The earlier goalie typecheck blocker is resolved by its owner; fresh typecheck passes.

Independent review is complete: `INDEPENDENT-REVIEW.md` reports no actionable finding or release-review blocker. No source corrections were required. The final page suite was explicitly rerun after review: **23/23 passed**; scoped lint passed with the same three existing image warnings. Diff whitespace and dry reverse-patch applicability checks also passed. Existing 13-scenario browser and typecheck evidence remains valid for the unchanged pinned candidate.

## Exact release-review candidate

Only these two files belong in this source candidate:

| Path | SHA-256 |
| --- | --- |
| `web/pages/rankings.tsx` | `6dfc9f9f598707cf8d7d9f07491ff9705eb969751493a8ae6551ad6f12490d04` |
| `web/__tests__/pages/rankings.test.tsx` | `24cb7433184acd1fe7d21b4ece79fcc234ac2d90bfbc3b9ee578e3b381a7b9d3` |

`SOURCE.patch` captures exactly those local changes against the base above; SHA-256 `b520d6a1ad0d6b6602a76bed8cde536ebc2007dcefeeab92429ef0717bd6f779`. It is already applied in the canonical checkout. Evidence, harness files, screenshots, coordination entries and diaries are not application release files. Preserve all other dirty work. No commit, push, merge or deployment is authorized by this handoff.

## Ownership and scope

Verified `CLAUDE-FIX-SPRINT-LEASE-RELEASE-20261112` and `CLAUDE-FIX-SPRINT-RELEASE-COMPLETE-20261112` in the cross-platform mailbox before source edits. L5 is closed and rankings leases are released. The release-complete entry records master `631a00c19`; this task did not independently query deployment status. The external `handoffs/fix-sprint/` path referenced by the lease notice is absent from this checkout. The repository mailbox contains the release text.

Exact application/test changes:

- `web/pages/rankings.tsx`
- `web/__tests__/pages/rankings.test.tsx`

Both paths were clean at entry. All math, request builders, data contracts, shared components/styles and other dirty work are preserved. Coordination consists only of appended entries in `tasks/artifacts/cross-platform/2026-10-24-coordination/CODEX-TO-CLAUDE.md`; the prior content is untouched. The task diary is a working note and must remain outside a release candidate.

## Result

- Metric Explorer, Deployment Tiers, Trending, Splits and WAR now distinguish a pending season lookup from empty results and surface season failures. A successful but empty season lookup also offers recovery instead of loading forever.
- Retry controls work with the filter shell collapsed. They retain the URL/filter/page context, retry only the active primary request, disable while pending and remain usable after another failure.
- Network failures and non-JSON responses use readable error text. Existing API `message` precedence over stable `error` codes is preserved.
- A stable polite status region announces loading, errors and readiness. Recovery controls are native named buttons, on a separate row from layout controls, using existing page styles.
- Browser review caught narrow-table error text outside the viewport. The error now appears beside Retry, with `aria-describedby`. After keyboard retry, focus returns to Retry on failure or the page heading on success; focus stays put when the reader has moved to another control.
- Layout/rank controls now wrap within this page at narrow widths. No shared stylesheet changed.
- Primary requests no longer automatically retry during an outage. Supporting snapshot/metadata/comparison requests retain automatic recovery capped at two retries. This is a request-volume bound, not a measured production latency or cost claim; reconnect/mount revalidation remains governed by existing SWR behavior.

## Verification

Node `22.23.4`; no dependency installation or build. Browser verification used a temporary loopback-only Vite fixture server, which was stopped and removed after verification.

| Check | Result |
| --- | --- |
| New regressions on original source | 7 failed before implementation, establishing missing loading/status/recovery and automatic retry behavior |
| `DEBUG_PRINT_LIMIT=0 npm test -- --run __tests__/pages/rankings.test.tsx` | Passed: 23 tests, including existing URL, sorting, pagination, entity, selection and stale-window tests |
| Real SWR with synthetic `fetch` fixtures | Passed: one explicit retry for the same URL; no duplicate in-flight retry; goalie/team/trending recovery; repeated failure stays recoverable; readable API message retained |
| `npx eslint --report-unused-disable-directives-severity warn pages/rankings.tsx __tests__/pages/rankings.test.tsx` | Passed with three pre-existing `@next/next/no-img-element` warnings and no errors |
| `git diff --check` on the two owned source/test paths | Passed |
| `npx tsc --noEmit --incremental false` | Failed: Node default ~4 GB heap exhausted (exit 134), no usable compiler result |
| `npm run typecheck -- --incremental false` | Passed on resume and after functional focus/error fixes. The earlier two goalie-file errors were resolved by that file's owner. |
| `node tasks/artifacts/rankings-usability-2026-11-12/browser.mjs` | Passed: 13 isolated Chromium scenarios; zero external requests, API requests or page errors. |
| Scoped axe on retry/error/status at 320, 390 and 1440 pixels | Passed: 13 checks at each width, zero violations or incomplete checks. Error text and buttons fit; native focus indicator present; toolbar buttons no longer collide. |

## Browser evidence and reproduction

Run the command above from the repository root. `browser.mjs` imports the actual rankings page and styles, extracts the existing synthetic fixture section from its unit test, and replaces only Next router/head and the current-season hook. It loads no `.env` files, rejects production reader imports, replaces all data fetches with synthetic responses, and blocks browser API/external requests. It uses real SWR. Temporary fixture files and the loopback server are cleaned up after a successful run. Local browser/listener execution required sandbox escalation; the first sandbox-only bind failed with EPERM. A temporary-directory realpath issue in the harness was fixed before application checks.

`BROWSER-RESULT.json` records all 13 scenarios: HTML/network keyboard recovery, duplicate-pending prevention, no automatic primary retry over 60 simulated seconds, repeated-failure focus recovery, empty season, all five secondary season loading/error/recovery flows, and responsive error/retry/toolbar checks with scoped axe. `retry-320.png`, `retry-390.png`, and `retry-1440.png` are final screenshots. `CHECKS.json` pins the final two application/test files and verification outcomes.

## Accessibility review: inspected page states

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| Medium | `web/pages/rankings.tsx:1809` | Loading/error changes had no page status announcement | Stable polite status region carries the active view state | Dynamic content should announce updates without moving focus |
| Medium | `web/pages/rankings.tsx:1775` | No explicit recovery; table error could be outside the narrow viewport | Visible described-by error, native retry buttons and focus recovery | Keyboard users can understand and recover from failure without losing their place |
| Medium | `web/pages/rankings.tsx:2027` and secondary panels below it | Season readiness/failure omitted, allowing misleading empty views | Pending and error states propagate to each active secondary panel | Communicate unavailable state accurately before presenting results |
| Medium | `web/pages/rankings.tsx:1724` | Layout/rank control text collided at 320 pixels | Page-local toolbar wrapping preserves each control | Controls remain legible at narrow widths |

Approve the inspected page-state changes based on source, DOM fixtures and isolated browser verification. This is not approval of uninspected accessibility coverage.

## Remaining gates and limits

- No local acceptance blocker remains for this bounded patch. Parent review and release authorization are separate; the source is uncommitted and not deployed.
- Native screen-reader speech and the full Next.js shell are **not verified**. The existing live-data `web/e2e/rankings.spec.ts` was not run. Browser fixtures deliberately replace the shell/router/season seams and use local global CSS without remote font imports plus placeholder imagery; no full-page accessibility conformance claim is made.
- No production timing, database query performance or generated ranking correctness was measured or changed. Source code is local only; release review/authorization is separate.
- Ancillary snapshot/comparison error UX and drawer behavior are unchanged apart from readable transport errors and the retry cap; this was a bounded primary-page audit, not an exhaustive component audit.
- Independent review source-traced tab/season transitions during a pending explicit retry and ancillary retry bounds, but those particular timing paths were not separately executed. The reviewer found no actionable issue; this is a coverage limit, not a runtime pass claim.
