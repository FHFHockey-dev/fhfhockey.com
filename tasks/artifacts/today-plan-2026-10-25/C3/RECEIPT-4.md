# C3 receipt 4 — route-runner tick test failure: test-clock time bomb, not a route regression

- **Ticket:** `web/__tests__/pages/api/v1/db/route-runner.test.ts`, case "route runner tick route > runs one step for the cron bearer and writes one small audit row". It expected `stepped`/`complete` and got `idle`. Checkout `octoberBranch` at HEAD `86583ba6b`. No Git commands, no commits, no GIT_DIR, and no cron, ETL, refresh or live calls.

## Root cause: time-dependent fixture

- `makeJob()` in `web/lib/routeRunner/memoryStore.testHelper.ts:13-38` hard-codes `created_at: "2026-10-22T09:00:00.000Z"` and `expires_at: "2026-10-25T09:00:00.000Z"`, the 72-hour job lifetime.
- The tick route (`web/pages/api/v1/db/route-runner-tick.ts`) calls `runRouteRunnerTick` without a `now`, so `web/lib/routeRunner/tick.ts:187` falls back to the **real** `Date.now`.
- After **2026-10-25T09:00Z** the real clock is past the fixture's `expires_at`. `store.expireJobs(nowIso)` (`tick.ts:191`) marks the job `failed`/"Expired" and `listRunnable` finds nothing, so the tick correctly returns `{ action: "idle", expired: 1 }`.
- That is why it "fails identically on origin/octoberBranch before today's commits". The trigger was the date, not a code change.
- Every other fixture user already pins the clock to `2026-10-22T10:00:00.000Z`: `lib/routeRunner/tick.test.ts:11` and `lib/routeRunner/store.test.ts:26` pass a fixed `NOW`. Only the route-level test used real time.
- **The route is correct:** expiring a job past `expires_at` is the intended behaviour. **No route or lib code was changed.**

## Fix (test only)

- In the file's top-level `beforeEach`: `vi.useFakeTimers({ toFake: ["Date"] })` plus `vi.setSystemTime(new Date("2026-10-22T10:00:00.000Z"))`. In `afterEach`: `vi.useRealTimers()`.
- Only `Date` is faked; real timers and promises are untouched. The clock matches the fixture's `NOW` in the lib tests, and it is pinned file-wide so the job-API cases (`not_before`, `run_now`, `cancel`) cannot become time bombs either.

## Files

| Path | Status | sha256 |
|---|---|---|
| `web/__tests__/pages/api/v1/db/route-runner.test.ts` | **changed** (+6 lines) | `36ce2dbeb5c473ba50ed652b4682cd62b8e1fb3423dc552c3fbea45456ffeef0` (HEAD `1c1e6606…`) |
| `web/pages/api/v1/db/route-runner-tick.ts` | read only, unchanged | `2847f34e0544a0f05557ddc61fd2498aa29cbb4219b2896a7799ff91830b153c` |
| `web/lib/routeRunner/tick.ts` | read only, unchanged | `61345ec8ec2eaae85ae5704a56377053cfb5cfcf59437cb2dfafb9a84f6979f9` |
| `web/lib/routeRunner/memoryStore.testHelper.ts` | read only, unchanged | `3b53dcf580e8c06ab4985cdb13418b95a39a3ab49150a4cf026aa6ab86bd6c61` |

No other cron files were touched.

## Checks

| Check | Result |
|---|---|
| Before the fix: `route-runner.test.ts` | 1 failed / 12 passed (`action: "idle"`), reproduced |
| After the fix: `route-runner.test.ts`, run 3× | **13/13, 13/13, 13/13** |
| Route-runner suite: `lib/routeRunner/{core,store,options,tick}.test.ts`, `__tests__/pages/db/runner.test.tsx`, `route-runner.test.ts` | **78/78 passed** (6 files) |
| ESLint on `route-runner.test.ts` | **passed** (exit 0) |
| Whole-project typecheck | not run (test-only change; no type surface changed) |

## Note

`makeJob()` itself still hard-codes absolute dates. Any future test that calls it through real time will break the same way. The pin added here is the local fix; changing the shared helper was outside this ticket's file list.
