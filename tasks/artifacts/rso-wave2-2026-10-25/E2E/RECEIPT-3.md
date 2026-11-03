# RSO-CLOCK receipt: time-dependent test failures (2026-10-26, Claude)

Lane RSO-CLOCK. Test-side only; **no product source touched**. Nothing committed. No production, network, Yahoo or DB access. No GIT_DIR. No HEAD files were swapped into the canonical tree.

## Files changed (sha256)
| File | sha256 |
|---|---|
| web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx | 13925e75891d4323b1032daa615562ca70541bc25a57b2ca00ba6b02c94cf793 |
| web/e2e/roster-schedule-optimizer.spec.ts | c1c13454f6d9a9a885f12514fb575800865465ae923bd513ebf0d48b738f0351 |

Not changed: `web/e2e/roster-schedule-optimizer-fixtures.ts`, `web/components/RosterScheduleOptimizer/*.test.tsx`, and all product source.

## Root causes and fixes
| Case | Root cause | Fix (assertions unchanged) |
|---|---|---|
| Component "separates planned adds from allowance" ×3 and "keeps refreshed provider authority through undo and reopen…" | `defaultWorkspace()` uses the real clock. The fixture period runs from now (UTC) to this week's end (`endDate` in local time). Between 00:00 UTC Monday and local midnight, start > end, so `workspaceSchema` rejects the seeded workspace ("Invalid acquisition period bounds"). | `pinMidweek()` fakes only `Date` (`vi.useFakeTimers({ toFake: ["Date"] })`) at Wed 2026-10-14T16:00Z, which is mid-week in UTC and America/*. The existing `afterEach` restores real timers. |
| E2E 639 "shows sequential stream occupants…" | (1) **Clock time bomb:** the Node route stamped forecasts `issuedAt: new Date()` (real time) while the page clock is pinned to 2026-09-21. Once real time passed that date, forecasts were "issued after" the read. (2) **TZ:** the pinned 2026-09-21T00:00Z is Sunday in America/*, so the current week ended before the fixture's games. (3) **Ordering:** names were reviewed before the current-read catalog had loaded. | `issuedAt` fixed to 2026-09-20T00:00Z; planning time moved to 2026-09-21T16:00Z (the same Monday in UTC and America/*); the test waits for "Bravo Center" in the Candidate browser before pasting names. |
| E2E 1359 "candidate feedback views…" | Read-after-click races on asynchronous local persistence (fails in America/New_York, passes in UTC). | `expect.poll` waits for the marked availability, and for the selected add before capturing `selectedIntent`. |
| E2E 537 "connected manager bench locks…" and 594 "provider refresh adopts the authoritative league timezone…" | **Not clock-related.** They sign in via `installDraftProAuthenticatedFixtures` but, unlike their sibling tests, do not mirror the session to the configured project's storage key (`sb-<project>-auth-token`). The page stayed signed out. Environment-dependent: this only works when the app's Supabase URL is 127.0.0.1. | Added the same two-line storage-key mirror the other signed-in tests use. |
| E2E 2042 "compact short desktop and mobile…" (found during verification) | Not clock-related. A scroll-sync race: `expectDaySliderAligned` measured once, right after a programmatic `scrollLeft = 120`, before the thumb re-synced. Failed 3 of 5 in UTC (delta exactly 120 px). | The helper now retries the same ≤ 1 px check with `expect.poll` until layout settles. Observation files are still written. |

No product root cause found. One observation: local persistence is asynchronous by design, so tests must poll storage after UI actions.

## Runs (2026-10-26 ~00:50–01:14 UTC, i.e. inside the Sunday-evening America/* window that triggered the failures)
| Check | UTC | America/New_York |
|---|---|---|
| RSO unit and component suites (`lib/rosterScheduleOptimizer` incl. `dailyAcceptance.*`, `__tests__/components/RosterScheduleOptimizer`, `components/RosterScheduleOptimizer`, `hooks`, `lib/in-season`) | 79 files, **1631/1631** | 79 files, **1631/1631** |
| E2E `roster-schedule-optimizer.spec.ts` + `rso-continuity.spec.ts`, isolated :3160, `--workers=1` | **54/54** (`run-3/e2e-UTC.log`) | **54/54** (`run-3/e2e-America-New_York.log`) |
| Targeted repeats | 639 ×2 (also passes in America/Los_Angeles); 1359 ×2; 537 and 594 ×1; slider-alignment users ×3 (18/18) | same |
| eslint (both changed files) | clean (exit 0, no warnings) | |

Server: `PLAYWRIGHT_ISOLATED_NEXT=1 npm run dev:stable -- -p 3160`. The specs block non-loopback requests. Ports 3000 and 3105 were untouched. The server is stopped (no listener). TZ for E2E was set via the Playwright process's `TZ` env, which the browser inherits.

## Remaining real-clock uses (not failing; noted, not changed)
`roster-schedule-optimizer.spec.ts` route handlers at ~436, ~454 and ~1017 still use `new Date()` for account `updatedAt` and a provider snapshot `asOf`. None feeds a validity check today.
