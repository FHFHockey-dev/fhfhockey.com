# HIR policy 3: IR activation after a Yahoo weekly lineup lock

- Date: 2026-10-25. Read-only research ticket from the orchestrator. Claude wrote this file and nothing else.
- No Git, no production, no provider calls, and no web requests to Yahoo.
- Citations are `path:line` in the `octoberBranch` working tree. The findings come from reading the code, and the key case was then confirmed with a scratch probe run outside the repo (see "Probe").

## Question

In a Yahoo weekly-lineup league, once the week's lineup has locked, can a player be moved from IR into an empty slot and count for the rest of that week?

## Answer

- **Yahoo's actual rule is not verified anywhere in the repo.** There is no Yahoo rules document, fixture or receipt that answers this. The RSO PRD lists weekly-lock qualification as still open, so it should not be treated as known.
- **The planning engine already takes a firm, conservative position:**
  - A weekly window's candidates are the players who were active or on the bench *at its lock time*. Anyone in IR, IR+ or NA at the lock, or added after it, sits out that window. They become eligible in the next window.
  - The player's skipped games are labelled "Not eligible at this weekly lineup lock".
- **The healthy-reserve helper does not follow that rule.** To price an activation, it puts the player straight onto the bench of the current roster. The timeline treats anyone on the starting roster as having been there forever. So in a locked window, the helper treats him as if he were active at the lock and can credit his games this week.
- **When this happens in practice:** only when the manager has supplied weekly windows and the current window's lock has already passed. Without supplied windows, or without lock evidence, the gain is already "unknown", so nothing is overstated today in those cases.

## Evidence

### Verified from code

| # | Finding | Where |
|---|---|---|
| 1 | Weekly candidates are the roster at `lockAt`. A player who was `IR`/`IR+`/`NA` at the lock, or joined after it (`since > lockAt`), is skipped for that window. | `web/lib/rosterScheduleOptimizer/planning.ts:729-735` |
| 2 | Those skipped games are labelled `weekly_lock`. Users see "Not eligible at this weekly lineup lock." | `planning.ts:945-951`; `web/components/RosterScheduleOptimizer/BenchDecisions.tsx:7` |
| 3 | An unlocked slot in the window can be filled, but only by a lock-time candidate. Only explicitly locked slots are skipped. | `planning.ts:534-549` (slot skip `:538`, candidate list `:535`) |
| 4 | Moves during a locked window are rejected when they touch a locked player. | `web/lib/rosterScheduleOptimizer/planningTimeline.ts:66-70`, `:85`, `:89`, `:124` |
| 5 | A planned acquisition is effective at its step time (`since: step.effectiveAt`), so an add after the lock waits until the next window. The tests cover this. | `planningTimeline.ts:127`; `web/lib/rosterScheduleOptimizer/planning.test.ts:798-807`; Task27 in `tasks/rso-goal-handoff.md:53-54` |
| 6 | Players on the starting roster get `since: "0000-01-01T00:00:00Z"`, which means "there before any lock". | `planningTimeline.ts:29-35` |
| 7 | **The helper's activation rewrites the base roster.** It moves the reserve player to `"bench"` (and moves a swap partner into reserve), then calls `evaluatePlan` with no steps. By finding 6, he counts as active at the lock. | `web/lib/rosterScheduleOptimizer/healthyReserves.ts:59-61`, `:72-75` |
| 8 | No `PlanStep` moves a player from reserve to active. `reserve` only moves *into* IR/IR+/NA. | `web/lib/rosterScheduleOptimizer/planningTypes.ts:205-207`; `planningTimeline.ts:83-86` |
| 9 | Unverified weekly windows make the plan illegal, so the helper's gain is unknown (null/null). | `planning.ts:722`, `:923`; test `healthyReserves.test.ts:106-113` |
| 10 | When the lock has passed and there are no lock records for the window, the plan is illegal ("Current weekly lineup lock lacks authoritative slot evidence"), so the gain is unknown. | `planning.ts:770-772`, `:923`, `:928` |
| 11 | For a Yahoo weekly league, the adapter sets `lineupMode: "weekly"` but marks the rules unsupported until the manager supplies verified windows. | `web/lib/integrations/yahoo/rosterPlanning.ts:410-415`; `web/lib/rosterScheduleOptimizer/providerRules.ts:6`, `:42-44` |
| 12 | Nothing in the code or tasks qualifies Yahoo's weekly lock or reserve semantics. AC-11 and RSO-8 (weekly full launch) are open, with "lock/reserve … semantics" listed as unverified. | `tasks/TASKS/prd-rso.md:208`, `:239`, `:282`; `tasks/rso-goal-handoff.md:168` |

### Assumed, not verified

- That Yahoo locks the **whole** weekly lineup at the weekly deadline, IR moves included. This is common knowledge about fantasy hockey, not repo evidence, and I did not check Yahoo.
- That a player activated after the lock gets no games that week even when a slot is open. Finding 1 encodes this for the engine, but no Yahoo source in the repo confirms it.

### What makes the helper overstate (confirmed by the probe below)

All of these have to be true:

1. The league is weekly and the manager has supplied windows (finding 11).
2. The current window's `lockAt` is before `asOf`.
3. Lock records exist for that window, so finding 10 doesn't make the plan illegal.
4. The activated player has an eligible slot that isn't locked.

Then finding 7 puts him in the lock-time candidate set, and the alert shows a positive "+N pts / +N games" for **this** week. The engine's own rule (finding 1) would give zero. The existing tests don't cover this case: the only weekly helper test uses empty windows (finding 9).

### Probe (run 2026-10-25, outside the repo)

- **Setup:**
  - The fixture is copied from `healthyReserves.test.ts:17-46`: a (C) is active, b (C) is on the bench, and healthy D-man d (3 pts/game) is in IR. Games are on 10-05 and 10-06 at 23:00Z, and the D slot is empty.
  - I made it weekly, with one window from 10-05 to 10-12 that locks at 10-05T00:00Z.
- **How it ran:** a scratch Vitest file and config in Claude's scratchpad, not in the repo, using `web/vitest.config.mts` as the base. It ran under `/private/tmp/fhfh-heavy.lock`, and the lock was released afterwards. 1/1 passed (exit 0).

| Case | Helper activation for d |
|---|---|
| Before the lock (`asOf` 10-04T12Z) | +6 pts, +2 games (correct) |
| **After the lock** (`asOf` 10-05T12Z), manager locks: a in `C#1`, b benched | **+6 pts, +2 games (overstated; the engine's rule says 0 this week)** |
| After the lock, no lock records | null / null (unknown, as in finding 10) |

- **The engine itself is fooled the same way.** I evaluated the after-lock roster with d already moved to the bench, which is the helper's counterfactual. The plan is legal, with no limitations, and d is placed in `D#1` on both dates.
- **Option A's mechanism works.** I added the bench locks `{ d, 10-05, null }` and `{ d, 10-06, null }` to that activated run. The result is legal with no limitations, d gets 0 lineup rows, and the value and games equal the run without d (2 / 2). So the gain becomes 0 pts and 0 games.

## Options for TJ

| Option | Behaviour | Risk |
|---|---|---|
| **A. Follow the engine's lock rule (recommended)** | Once the current weekly window has locked, activating counts only from the next window. The alert says so instead of showing a this-week gain. | Might understate value if Yahoo actually allows activation into an empty slot mid-week. That is the safe direction, and it matches finding 1. |
| B. Keep today's behaviour | Any slot that isn't locked can take the activated player this week. | Overstates the gain if Yahoo locks IR moves. It also contradicts the planner's own weekly rule, so the alert and the itinerary could disagree. |
| C. Mark it unknown | In a locked weekly window, show "Gain unknown: Yahoo's weekly IR-activation rule is unverified". | Safe, but adds another unknown. It still needs the same lock detection as A. |

**Recommendation: A.** It reuses the engine's existing, tested weekly rule, never overstates a gain, and keeps the alert consistent with the planner. Revisit it only if RSO-8 / AC-11 Yahoo qualification proves that mid-week IR activation is allowed.

## The exact change for Option A

This is all within HIR's leased files. `planning.ts` and `planningTimeline.ts` don't change.

1. **`web/lib/rosterScheduleOptimizer/healthyReserves.ts`, in `activate` (`:72-75`):**
   - When `snapshot.rules.lineupMode === "weekly"`, find the current window with `lineupPeriodAtDate(localDate(snapshot.context.asOf, tz), snapshot.rules.lineupPeriods, tz)` from `planningDates.ts:4`.
   - If its `lockAt` is at or before `asOf`, run the activated roster with extra bench locks: `{ date, playerId: entry.playerId, slotId: null }` for every date from today to the end of that window. Append them to `snapshot.lockedAssignments`.
   - The engine already keeps bench-locked players out of the weekly seed and its swaps (`planning.ts:378`, `:543`). He is rostered at the window (finding 6), so this does not trip `invalidLocks` (`planning.ts:761`).
   - The swap partner keeps the locks he already has. If any of the partner's games in the window are slot-locked, the swap is already rejected by finding 4, so no extra rule is needed.
   - Return a new flag on `Activation`, for example `nextWindow: true`, so the alert can explain the result.
2. **`web/components/RosterScheduleOptimizer/HealthyReserveAlert.tsx`:** when `activation.nextWindow` is set, replace the gain line with "Weekly lineup is locked — activating him counts from next week." Keep the existing wording for a known gain that comes only from later windows in the horizon.
3. **Tests (`healthyReserves.test.ts`, `HealthyReserveAlert.test.tsx`):**
   - Weekly, verified window, `lockAt < asOf`, manager locks covering the occupied slots, one open slot. Expect activation `activeGames: 0`, `projectedPoints: 0` (or `null` if forecasts are missing), and `nextWindow: true`.
   - The same case with `lockAt > asOf`. Expect today's positive gain to be unchanged.
   - An alert test for the new text.
   - The new weekly test should fail against today's helper, because it would show a positive gain.
4. **Parent seam:** none. The alert already receives `HealthyReserve[]`.

## Not done

- No repo test was added or changed; only the scratch probe above was run. The Option A change itself is not implemented, so the alert text and the `nextWindow` flag are untested.
- The bench locks must go only into the activated run. In the "without" run, d is not on the roster, so a lock naming him would make that run illegal (`planning.ts:761`).
- No Yahoo documentation was consulted, as instructed. Option A's behaviour is the planner's existing rule, not a verified Yahoo rule.
