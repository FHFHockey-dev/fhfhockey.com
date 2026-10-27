# Receipt: RSO-2b-A3, Preview-swap legality (2026-10-27)

**Status:** fixed locally, not committed (the orchestrator commits by pathspec). Base: `octoberBranch` at 7da3e8663. No production reads or writes, Yahoo calls, migrations, pushes, deploys or git mutations.

## Root cause
- `web/lib/rosterScheduleOptimizer/planning.ts`, `extensions()`, is the single source of timed add/drop/reserve steps for Best Fit cards (`candidateAcquisitionSteps` → `candidatePlanMetrics`) and for planner alternatives. When a move's action day is today, it clamped `at` to `snapshot.context.asOf` with `conditional: false`. That made the step "now" for exactly one read.
- Card plans run on the current-read snapshot. `withCurrentPlanningRead` (`currentPlanningRead.ts`) restamps `asOf` to the server's `evaluatedAt`, here 8:03 a.m. ET.
- The timeline check in the component uses the provider snapshot, whose `asOf` was older. So `at` was after `asOf` while `conditional` was false. That tripped the existing rule in `planningTimeline.ts`: "Future acquisition … must be conditional on availability recheck".
- The `yahoo-current-data` confirmation re-read then gave the provider snapshot a newer `asOf`, so `at < asOf`. `reconciliation.ts` then reported "Selected action time has passed". The UI's own check, `earliestSelectedTime < Date.now()`, fails a second later for the same reason.
- In short, a move timed at one read's `asOf` can be legal on that read only.

## Fix (at the source, checks unchanged)
- A move due today is now timed at the latest instant that gives the same outcome. New helper: `latestEquivalentActionAt(snapshot)`.
- That instant is 1 minute before the earliest boundary at or after `asOf`, taken across:
  - any snapshot game's scheduled puck drop;
  - the next league-local midnight;
  - acquisition period start or end;
  - lineup period start, lock or end.
- Evaluation reads the roster at game start, locks are day-granular, and no boundary lies between `asOf` and that instant. So assignments, projected points, the period charged and the next-day `effectiveAt` are all identical to the old "now" timing.
- The step is now after `asOf`, so the existing expression sets `conditional: true`: a future acquisition with an availability recheck. It stays legal on every newer read until that deadline. After the deadline, reconciliation still reports "time has passed", which is correct.
- If no instant fits (puck drop is under a minute away), it falls back to `asOf`, the old behaviour.
- **Unchanged:** `planningTimeline.ts`, `reconciliation.ts`, waiver clearance, next-day rules, and past-time detection.
- **Visible change:** same-day FA cards now show the existing "Recheck availability before claiming" line, as tomorrow-dated cards already did. The selected step shows the deadline as its action time, for example 7:59 p.m. ET before an 8 p.m. game, plus "Conditional".

## Changed files (final sha256)
| File | sha256 |
|---|---|
| `web/lib/rosterScheduleOptimizer/planning.ts` | `451b8d864bbc73a1419a5af1484110cee8b6cab7de5f2b44e241d1c329b35dde` |
| `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts` | `149d526aca762c76e250b26dd44d7e5eb6644d8990789aff77072a65e0b4d976` |

Diary (not a deliverable): `tasks/diaries/2026-10-27-claude-rso-swap-legality.md`.

## Regression tests
`candidatePlanMetrics.test.ts` › "Preview swap legality across newer reads" runs for `same_day` and `next_day`, in a New York league with the card read at 8:03 a.m. ET:
1. The card plan (`candidatePlanMetrics` → `candidatePlanForSort`) gives +9 net points. Its add+drop step is timed to the deadline: same_day at 19:59Z; next_day at 03:59Z with effect at 04:00Z. It is `conditional: true`.
2. `selectPlan`, copied the same way the component does it, is followed by `buildTimeline`, `reconcileIntent` and `evaluatePlan`. They are run on four snapshots: the provider snapshot older than the card read, the card read itself, the confirmation re-read (+20 s) and a manual Refresh (+42 min). Each is legal, has no reconciliation issues, and gives the same projected value.
3. 30 s after the deadline, reconciliation still flags "Selected action time has passed", and the suggested repair removes the step.
4. The defect's shape is still rejected by the timeline: a non-conditional step pinned to the read's `asOf`, checked on an older snapshot.

Both cases fail with the old clamp, which was swapped in temporarily and then restored, and pass with the fix.

## Commands and results (run from `web/`, `GIT_DIR` unset)
| Command | Result |
|---|---|
| `TZ=UTC npx vitest run lib/rosterScheduleOptimizer components/RosterScheduleOptimizer` | ✅ 41 files, 1015 tests passed |
| `TZ=America/New_York npx vitest run lib/rosterScheduleOptimizer components/RosterScheduleOptimizer` | ✅ 41 files, 1015 tests passed |
| `npx vitest run …candidatePlanMetrics.test.ts -t "Preview swap legality"` with the old clamp | ✅ 2 failed, as expected (step not timed or conditional); fix then restored |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock`, taken with noclobber and released after | ✅ exit 0 |
| `npx eslint lib/rosterScheduleOptimizer/planning.ts lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts` | ✅ clean |

Not run: the browser and real-account R4 re-run. That needs a new approved Yahoo window.

## Follow-ups (not in scope)
- The manual "Select add" path (`RosterScheduleOptimizer.tsx`, about line 981) times the step at `Date.now() + 60 s` and marks it conditional, so it goes stale after one minute. It is the same class of defect.
- The card text "Recheck availability before claiming" says "claiming" for free agents too. Possible copy tweak.
