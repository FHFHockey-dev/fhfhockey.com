# S-B1 served-forecast ledger (worker, 2026-10-21)
- Scope: pure `web/lib/player-forecasts/servedForecastLedger.ts` (+test), snapshot route `web/pages/api/v1/db/forge-served-forecast-snapshot.ts` (+test), migration SQL appended to design doc §7 (no file under supabase/migrations — coordinator change).
- Branch octoberBranch, nothing committed. forgeDailyBridge.ts: `teamStrengthPriors`/`teamWinProbability` already exported, no edit needed.
- Gotchas: `games` has no status column (route uses loadPlanningInputs games for status/startsAt); `wgo_goalie_stats` keys goalies by `goalie_id`; `goalie_stats_unified` has no `game_id` in generated types (affects S-B2 settle).
- State: done, uncommitted. Vitest 39/39 (ledger 9, route 3, bridge 27); eslint clean on 4 new files. tsc not run (Chef). Migration SQL in design doc §7, not filed/applied.
- Next: Chef runs tsc, files migration 93, S-B2 settle must handle goalie_stats_unified lacking game_id.
