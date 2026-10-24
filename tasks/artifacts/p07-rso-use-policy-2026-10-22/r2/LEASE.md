# P07 R2 narrow correction lease

Parent authorized the two independently reproduced clock/expiry findings. All32R1pins match before edits; no workers or outside coordination. Exact correction paths:

- `web/lib/rosterScheduleOptimizer/currentPlanningRead.ts`
- `web/lib/rosterScheduleOptimizer/executionAdapter.ts`
- `web/lib/rosterScheduleOptimizer/executionAdapter.test.ts`
- `web/lib/player-forecasts/planningContributions.ts`
- `web/pages/api/v1/roster-schedule-optimizer/data.ts`
- `web/__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts`
- `web/hooks/useRosterPlanning.ts`
- `web/hooks/useRosterPlanning.test.tsx`

R1 and reviewer fixtures stay immutable. Offline fixtures only; no new schema/storage/secrets, actual network, provider/DB/NST calls, commits or deployment.
