# F19: served FORGE snapshot bridge timeout (Claude lane, 2026-11-14)

## Scope
Offline fix for `GET /api/v1/db/forge-served-forecast-snapshot` failing at about 12:32Z with "Planning read deadline exceeded".
Claimed paths (CLAUDE-FIX-F19-FORGE-SNAPSHOT-BRIDGE-TIMEOUT-CLAIM-20261114): forgeDailyBridge.ts and its test, planningInputs.ts,
the snapshot route and its test, externalInputProof.ts and dailyBoardEvidence.ts (signal plumbing only). No push, deploy or route run.

## Where
- Branch `octoberBranch`, base `7d97915c0`. Code commit `127a7b496` (5 files: planningInputs.ts, forgeDailyBridge.ts and test, route and test).

## Evidence (read-only production, 2026-11-14)
- pg_stat_activity: 0 active before reads.
- Vercel log, request `mjcbl-1794659421027-e74e1616b174`: the error stack is `at Timeout.<anonymous>`, so a withinDeadline timer
  fired. The bridge's read deadline is at most 6 s after the stage starts, but the timer ran at 141.4 s: it was about 135 s late,
  so the event loop was blocked, or the process stalled, while the reads were in flight.
- cron_job_audit, last 12 days: every failure is 128 to 182 s and lands in whichever stage is in flight at about 12:30:21 to 12:30:25
  (11-13 `planning_inputs` 182 s; 11-09, 11-10 and 11-11 `history_reads`; 11-05 and 11-14 `forge_bridge`; 11-03 `market`).
  Successes take 3 to 4 s. So the stall is not in the bridge.
- `/api/v1/db/auto-news-feed-items` (cron `*/30`) starts at 12:30:11 daily and runs 140 to 207 s. On 4 failure days the snapshot's
  late timer fires 2 to 3 s before auto-news ends; on 3 days it fires 20 to 23 s before. All `pages/api/**` share one function
  config (maxDuration 240). Inferred, not proven: auto-news runs about 2 minutes of synchronous CPU in the same instance.
- Bridge inputs on 11-14 are small: 13 latest runs, 3,007 skater rows, 168 goalie rows, 0 reserve rows, 0 board-evidence rows.
- `lib/projections/dailyBoardEvidence.ts` is a required FORGE producer-closure module (scripts/forge-producer-closure.ts, 236
  modules). Editing it changes the closure hash, so new runs would be unproven until re-verified. Not edited: the signal is bound
  at the client the bridge passes in. externalInputProof.ts, planningInputs.ts, the bridge and the route are outside the closure.

## Plan / state
1. planningInputs: withinDeadline refuses a result that settles after its deadline; the deadline error carries `lateMs` (how late
   the timer ran); `abortableReads(db, signal)` binds a signal to a reader's queries.
2. Bridge: per-branch timing (runs, proof, each read, board evidence, build); proof and board evidence get the abort signal.
3. Route: proof read bounded by the absolute deadline; deadline checked after the bridge and before ledger and market writes;
   the error names the slowest bridge branch, any pending branches and the timer lag.
4. Tests in forgeDailyBridge.test.ts and the route test.

## Checks (2026-11-14, all local)
- forgeDailyBridge.test.ts 95/95; route test 16/16. Mutation check: with the fixes reverted, the 3 new bridge tests and the 4 new
  route tests fail. Dependent suites (15 files, 503 tests) pass. `npm run typecheck` exit 0. ESLint on the 5 files exit 0.
- FORGE producer closure: `86b716bc75bb4118...`, 236 modules, the same before and after.

## Next step
Commit, then report to the Chef. The Chef verifies and builds the release candidate. Nothing is pushed or deployed.

## Insights
- A late timer means a blocked event loop; it is not a slow read. `lateMs` in the error tells the two apart next time.
- The stall cannot be fixed inside this route without a longer deadline. The real fix is to move the cron off 12:30, or to make
  auto-news yield. Both are outside this lane (vercel.json and the auto-news route are not claimed).
