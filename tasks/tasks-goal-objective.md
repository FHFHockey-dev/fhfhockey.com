## Relevant Files

- `web/components/RosterScheduleOptimizer/CompactSchedule.tsx` - Existing player schedule, groups, day controls and Bench disclosure.
- `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` - Dashboard integration and persistent presentation state.
- `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss` - Scoped panel, typography and row geometry.
- `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` - Existing component and grouping regressions.
- `web/e2e/roster-schedule-optimizer.spec.ts` - Existing isolated fixtures, viewport checks and visual evidence.

### Notes

- Objective: attachment `00fd52af-d32b-47ec-86d4-ddc9c9de8d5d/goal-objective.md`.
- Keep work uncommitted on `octoberBranch`; preserve unrelated Game Grid and offline-tooling work.
- Chef owns implementation, browser tests and final review. The bounded unit-coverage worker owns only the existing component test file.
- Browser evidence uses fictional local fixtures with remote requests blocked.

## Tasks

- [x] 1.0 Inspect and preserve the baseline.
  - [x] 1.1 Verify branch, inspect existing changes and record preservation hashes.
  - [x] 1.2 Reuse existing assignments, slot groups, position colors and mobile workspaces.
  - [x] 1.3 Record baseline checks and comparable screenshots before app edits.
- [x] 2.0 Refine the existing dashboard (depends on 1.3).
  - [x] 2.1 Calculate bounded row density from actual panel space and polish compact controls.
  - [x] 2.2 Keep unresolved slots honest and expose concise selected-day occupancy/slate summaries.
  - [x] 2.3 Preserve day and Bench state across workspaces; verify keyboard operation.
- [x] 3.0 Verify and deliver local evidence (depends on 2.0; unit coverage may proceed independently).
  - [x] 3.1 Run focused component/domain and browser tests plus applicable lint/type checks.
  - [x] 3.2 Inspect required desktop/mobile, large-roster, collapse and unavailable screenshots.
  - [x] 3.3 Review the diff and preserved hashes; report commands, results and limitations.
