# Receipt: RSO-2b-A3 follow-up, manual "Select add" timing (2026-10-27)

**Status:** fixed locally and not committed; the orchestrator commits by pathspec. Base: `octoberBranch` at 74ebba759, the committed 2b-A3 card fix. No production reads or writes, Yahoo calls, migrations, pushes, deploys or git mutations.

## Defect
`chooseCandidate` in `RosterScheduleOptimizer.tsx` (the "Select add" button) timed the add at `Date.now() + 60 s` with `conditional: true`.
- Any read or Refresh more than a minute later has a newer `asOf`.
- `reconcileIntent` then reports "Selected action time has passed".
- The UI's `earliestSelectedTime < Date.now()` check reports the same thing.

This is the same class as the card defect: a "now" move pinned to an instant that ages at once.

## Fix (one rule, reused)
- **`planning.ts`:** `latestEquivalentActionAt` is now exported and takes `Pick<PlanningSnapshot, "context" | "games" | "rules">`. Its behaviour is unchanged.
- **`RosterScheduleOptimizer.tsx`:** `chooseCandidate` calls the helper with `asOf` set to the click time, the current snapshot's games and the effective `rules`. The add is due one minute before the earliest boundary at or after the click: the next puck drop, league midnight, or an acquisition or lineup period boundary. It stays `conditional: true`, and `effectiveAt` still comes from `acquisitionEffectiveAt`, which applies next-day and waiver clearance.
- **Guard:** puck drops are only known from a complete schedule. The helper is used only when `snapshot.evidence.schedule.completeness === "complete"`. Otherwise the add keeps the old one-minute lead, which is also the fallback when no instant fits.
- **Unchanged:** the timeline and reconciliation checks, and the "claiming" copy.

## Changed files (final sha256)
| File | sha256 |
|---|---|
| `web/lib/rosterScheduleOptimizer/planning.ts` | `cfefc38ea50a29e944b545509d5fee37cddc4ce72850a43330df64b37fb63211` |
| `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | `8dc0ac2ca76093a05ad216e60261156b8976af58815ee3aac9eb9a8bfae8a20d` |
| `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` | `b72b79631a475b8ebd28c70dce9ff9ebe7605ec3be41c259b2c123ef0e14d056` |

Diary (not a deliverable): `tasks/diaries/2026-10-27-claude-rso-swap-legality.md`.

## Regression test
The new test is "times a same-day Select add at its real deadline so it stays legal on later reads". It sits next to the existing Select add tests in the component suite. Setup: a manual same-day league in New York, the click at 8:03 a.m. ET, and a complete schedule with a 7 p.m. ET game.
1. The saved step has `at` and `effectiveAt` at 22:59Z and `conditional: true`.
2. `buildTimeline` is legal and `reconcileIntent` reports no issues on the confirmation re-read (+20 s) and on a manual Refresh (+42 min).
3. 30 seconds after the deadline, reconciliation still reports "Selected action time has passed".

With the old one-minute timing forced back in temporarily, the test fails. The file was then restored byte-identical (sha256 checked). The existing next-day, conditional and unknown-timing Select add tests pass unchanged; their fixtures have no complete schedule, so they take the fallback.

## Commands and results (from `web/`, `GIT_DIR` unset)
| Command | Result |
|---|---|
| `TZ=UTC npx vitest run lib/rosterScheduleOptimizer components/RosterScheduleOptimizer` (also matches `__tests__/components/RosterScheduleOptimizer`) | ✅ 41 files, 1016 tests passed |
| `TZ=America/New_York npx vitest run lib/rosterScheduleOptimizer components/RosterScheduleOptimizer` | ✅ 41 files, 1016 tests passed |
| New test with the deadline disabled | ✅ 1 failed, as expected; file then restored |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock`, taken with noclobber and released after | ✅ exit 0 |
| `npx eslint` on the 3 touched files | ✅ 0 errors. 6 `react-hooks/exhaustive-deps` warnings in `RosterScheduleOptimizer.tsx` at lines 346–749, the same 6 as HEAD (checked by linting `git show HEAD:` through stdin). None are new. |

**Not run:** a browser check and the real-account R4 re-run. Both need an approved Yahoo window.
