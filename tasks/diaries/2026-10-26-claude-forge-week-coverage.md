# FORGE week coverage for RSO — diary (2026-10-26, Claude)

## Scope
Diagnose why RSO lacks FORGE per-game projections for all players for the whole Mon–Sun week; propose a bounded fix with cost. No pipeline changes, prod writes, cron/ETL runs or recomputes before TJ approves.

## Where
- Checkout: /Users/tim/Code/fhfhockey.com, octoberBranch @ 28335fd46 (prod = master 538100d41)
- Output: tasks/artifacts/forge-week-coverage-2026-10-26/DIAGNOSIS.md

## State
- Diagnosis written: tasks/artifacts/forge-week-coverage-2026-10-26/DIAGNOSIS.md (+ measure/ script and output).
- Checks: read-only loadPlanningData run against current data (vitest scratch config, GIT_DIR unset), read-only SQL. No writes, no runs.
- Finding: horizon fine (all 7 dates); population is the gap (1847/2973 = 62%; 378 players get 0 games). Planner turns one unknown into whole-team "—".

## Next
- TJ redirected (10-26): FORGE runs must cover ALL players (waiver-wire FA FP projections). Revised plan B' (reserve pass) in DIAGNOSIS.md; needs an implementation lane. No code changed.

## Blockers / approvals
- 10-26: TJ chose "orchestrator lane". Handoff sent to the parent session local_9e054d08 (queued) and saved in the shared notes as forge-week-coverage-handoff.md. The parent proposed a "FORGE reserve pass: project all rostered players" session card; it is waiting for TJ to start it. The new session will ask the 3 open choices before coding. My part is done; reserve-row marker and payload approach are open design choices.

## Insights
- Coverage is all-or-nothing per player; FORGE projects lineups (~18 skaters/team), not rosters.
- Expanded client byte budget (4 MB) is binding if the population is filled: 1.57 KB/row expanded.
