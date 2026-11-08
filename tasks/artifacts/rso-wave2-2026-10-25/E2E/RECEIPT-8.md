# RSO-ONLINE receipt: attempt requests; offline only on a real failure (2026-10-26, Claude)

Contract (TJ): **"attempt requests, show offline only on a real failure, never stick on Checking access."** Lane RSO-ONLINE. TJ granted `e2e/roster-schedule-optimizer.spec.ts` for one line (AskUserQuestion: "Grant and update it"). Nothing committed. No production, network, Yahoo or DB access. No GIT_DIR. This supersedes the uncommitted HANG-DIAGNOSIS fix in the same file.

## Files (sha256)
| File | sha256 |
|---|---|
| web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx | 12ee91920317f7360bf408230a865acd38dd39a098064ccf822bc14d290e27f6 |
| web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx | 27029aa4e43533317824e657bb4f425a805148c45a86f217317947827d495138 |
| web/e2e/rso-continuity.spec.ts | c9d49bcace0ba5c37646dc5e04f5bad70f379a73e1fc0624354b128ef9709d19 |
| web/e2e/roster-schedule-optimizer.spec.ts | 32511ac4e77b8d8c6761c69769ce65d1a18c347516688efd11fa18bdb15d9c67 |

## Product changes (`RosterScheduleOptimizer.tsx`)
- **Real failure only:**
  - `trackedFetch` turns a fetch `TypeError` (the request never reached the server) into `NetworkFailure`, whose message is the offline text, and sets `networkFailed`.
  - Any response clears `networkFailed`. HTTP statuses never count as offline.
  - The `online` state, which mirrored `navigator.onLine`, and its listener effect are removed.
- **Access load always attempts and always settles:**
  - There is no `navigator.onLine` gate any more.
  - A 15 s deadline (`ACCESS_CHECK_TIMEOUT`) covers `authHeaders()`, the fetch and the body parse. On timeout the attempt is aborted and the status falls back to "Provider refresh is disabled until access can be verified. Try again shortly."
  - A preservation hold ends "checking" right away.
  - Visibility and `online` retries no longer consult `navigator.onLine`.
- **Status:** a new "Provider refresh is paused while preservation holds this plan." reason sits before the access branch. Within the access branch: checking → **offline (only when `networkFailed`)** → access error → upsell.
- **Planning reads:** `allowRead` no longer depends on `online` (`!networkSuspended && !planHeld`).
- **Explicit Refresh:** `refreshProvider` no longer gates on `navigator.onLine`. A real network failure surfaces as the offline text in the refresh feedback.
- **Auto-upkeep:**
  - The **first load** (`refresh(true)` at mount) attempts regardless of the flag.
  - Timed polls (`scheduleNext`) and online/offline/visibility-triggered refreshes still skip while `navigator.onLine === false` (conservative, saves provider reads).
- **Not changed (noted):** `web/hooks/useYahooDraftSync.ts:524` (draft dashboard) still returns early when `!navigator.onLine`, so a misreported flag can pause that sync too.

## Tests
- Component test (`RosterScheduleOptimizer.test.tsx`), new block "access and reads when navigator.onLine is wrong":
  - `onLine=false` with a working network loads `/access`, `/data` and `/provider`, with no "Checking" or "offline" text;
  - a real `TypeError` on `/access` shows the offline text and never "Checking";
  - fake timers with a hanging `/access`: "Checking…" at 1 s, the access-error reason after the 15 s deadline.
- Updated for the new contract:
  - "attempts the first load despite a misreported offline flag, keeps timed polling conservative and refreshes only a stale return": with the flag false, the first load reads once; timed polls stay paused; Refresh is **enabled** and an explicit click reads.
  - "keeps connected and saved snapshot schedules outside the shared-cache reload action" now asserts that viewing the save adds no reads (it no longer relies on offline to suppress the first load).
  - The preservation test "drains a dispatched account save…" now asserts the held reason, and no "Checking access…", after a visibility retry during the hold.
- The earlier HANG fix's regression test is replaced by the above (its "offline when the flag is false" expectation contradicts the new contract).
- **Mutation check against HEAD** (a `/private/tmp` git-archive copy, since deleted): with the new test file on HEAD's component, **exactly the 5 new or updated contract tests fail** and 207 pass (`run-8/rso-online-mut.log`).
- E2E:
  - `rso-continuity.spec.ts` case **7** stubs `navigator.onLine` to false (mocks working). Access is requested, the provider refresh runs, there is no "Checking"/"offline" text, planning finishes loading, Refresh is enabled, and an explicit refresh reads (screenshot `run-8/case7-misreported-offline.png`).
  - Case 1 now polls for its asynchronous `goalieWindow` save; it failed once in UTC on a read-after-select race.
  - `roster-schedule-optimizer.spec.ts:85`: with the flag false, Refresh is now expected **enabled** (it was `toBeDisabled`); no timed poll fires (reads stays 2).

## Runs
| Check | UTC | America/New_York |
|---|---|---|
| RSO suites (`lib/rosterScheduleOptimizer`, `__tests__/components/RosterScheduleOptimizer`, `components/RosterScheduleOptimizer`, `hooks`, `lib/in-season`) | **1635/1635** | **1635/1635** |
| E2E `rso-continuity.spec.ts` + `roster-schedule-optimizer.spec.ts`, isolated :3160, `--workers=1` | **55/55** | **55/55** |
| eslint (4 files) | 0 errors; the same 6 existing react-hooks warnings | |
| Whole-project `tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` | exit 0, 0 errors | |

Server: `PLAYWRIGHT_ISOLATED_NEXT=1` on :3160, non-loopback blocked in the specs, stopped (no listener).
