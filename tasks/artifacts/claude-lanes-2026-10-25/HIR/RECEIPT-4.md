# HIR — RECEIPT-4: policy 3, option A (weekly lineup lock)

Lane HIR, Claude, 2026-10-25, 18:51–18:56Z (40-minute box). Base: HEAD `86583ba6b`. At the start, the leased files matched RECEIPT-3 (committed in `e65c00f02`): helper 715b7866…, test b978423a…, alert 61e95877…, alert test 40ba10d3….
- No Git writes, no GIT_DIR, synthetic fixtures only. No production, provider or DB calls. No pushes.
- `planning.ts` and `planningTimeline.ts` are read-only and untouched.
- The parent `RosterScheduleOptimizer.tsx` is unchanged (cc131437… = HEAD); no parent seam was needed.

## Change (per POLICY-3-RESEARCH.md, "The exact change for Option A")
- **`healthyReserves.ts`:**
  - In a weekly league, the helper finds the current weekly window with the planner's `lineupPeriodAtDate(localDate(asOf))`.
  - It treats the window as locked when `asOf > lockAt`. That is the same test the planner uses for a locked window (`planning.ts:770`).
  - When the window is locked, the activated run only gets bench locks `{ date, playerId, slotId: null }` for the activated player on every remaining game date in that window, from today on. The planner's existing weekly rule then keeps him out of this window.
  - Later windows in the horizon still count.
  - These activations carry `nextWindow: true`.
  - The "without" run gets no locks: he isn't on that roster, and a lock naming him would make it illegal.
  - Daily leagues, unlocked weekly windows, and weekly leagues with no current window are unchanged, and carry no `nextWindow` key.
- **Ranking:** this reuses the e65c00f02 assignment search unchanged. A locked-window activation is scored by its real (zero) this-week gain, so the bigger direct gain no longer wins, and ties keep roster order.
- **`HealthyReserveAlert.tsx`:**
  - With `nextWindow` and no positive known gain, the line reads "Weekly lineup is locked — activating him counts from next week" (`data-known="false"`).
  - With a known gain from later windows, it reads "Weekly lineup is locked; from next week: +N projected pts · +M active games" (`data-known="true"`).
  - All other wording is unchanged.

## Changed paths (final sha256)
| Path | sha256 |
|---|---|
| web/lib/rosterScheduleOptimizer/healthyReserves.ts | ae286a0c538e1c1ad483db751bc2c69edb13e299072327aaa6c4b24cde3e89b9 |
| web/lib/rosterScheduleOptimizer/healthyReserves.test.ts | db2b03b90633e1b8ba33729f08acc9813e5909f66e68ff7fead869f067519696 |
| web/components/RosterScheduleOptimizer/HealthyReserveAlert.tsx | b3099d43684d9eb2d2139c46aaaa5e59416a14886cbe844765d9e686a84596c9 |
| web/components/RosterScheduleOptimizer/HealthyReserveAlert.test.tsx | 7539b6824ae3c038cce055a0572d21a139f231a4ff0eef13ae916369e69989f5 |

Patch vs HEAD: `hir-4.patch` (sha256 684244163c09dfb72620ef81df62a3c29438dcd465728e14034c54241aa6af41), 4 files, +78/−8.
`web/next-env.d.ts` is still another lane's change. Leave it out.

## Regression tests
- **"prices no this-week gain once the weekly lineup has locked, and flags the next window"** (the research probe's case):
  - Setup: a weekly window from 10-05 to 10-12 that locked at 10-05T00Z; asOf is 10-05T12Z; the manager's locks have a in `C#1` and b on the bench.
  - Result for d: `{ swap: null, 0 pts, 0 games, nextWindow: true }`. The old code gave +6/+2.
  - Also covered: a later window w2 holding d's 10-13 game gives `{ +3, +1, nextWindow: true }`.
- **"leaves an unlocked weekly window and daily leagues unchanged"** (strict equality, so there is no `nextWindow` key):
  - Weekly before the lock (asOf 10-04T12Z): +6/+2.
  - The same dates and windows as a daily league at asOf 10-05T12Z: +6/+2, because both games are still to start.
- **"ranks locked-window activations by their (zero) this-week gain, so ties keep roster order"** (assignment from e65c00f02):
  - Unlocked: f (+10) beats d.
  - Locked: both are 0, so d takes the one open spot in roster order and f gets none.
- **Alert test "says a locked weekly lineup counts from next week…":** checks both wordings and that no "this week" text appears.
- **Original failures** (`receipt4-baseline-failures.txt`, sha256 1e339dcd…), run against the HEAD helper and alert:
  - The two locked-window helper tests and the alert test fail.
  - The 19 other tests pass, including the unlocked/daily test, which confirms that behaviour is unchanged.
  - The new versions were restored and confirmed byte-identical.

## Checks (all run locally under `/private/tmp/fhfh-heavy.lock`: mkdir, OWNER file, waited and never stolen, released by trap)
- Vitest on healthyReserves (17), alert (5), lineupGaps (10) and the parent `RosterScheduleOptimizer.points.test.tsx` (13): **45/45 passed.**
- Scoped tsc over the 4 files plus the parent: **exit 0.**
- Whole-project `npm run typecheck`: **exit 0, 0 errors.**
- eslint on the 4 files: **exit 0, no output.**
- No browser or E2E run.

## Limits
- Option A follows the planner's weekly rule, not a verified Yahoo rule. RSO-8 / AC-11 Yahoo qualification is still open.
- If a locked window has no lock records, the plan stays illegal and the gain shows as unknown. That is unchanged (research finding 10), and the alert shows the locked sentence because `nextWindow` is set.
