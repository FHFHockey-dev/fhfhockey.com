# 2026-10-27 · claude · RSO card stats (compact card, L/PP chips, L5 GP)

- **Scope:** CandidateCard compact layout; line/PP deployment chips; last-5-GP box score. Started by Chef (rso orchestrator).
- **Where:** octoberBranch, canonical checkout. Files: CandidateCard.{tsx,module.scss,test.tsx}, lib/rosterScheduleData/planning{,.test}.ts,
  lib/rosterScheduleOptimizer/{recentForm,planningTypes}.ts, lib/in-season/workspaceSchema{,.test}.ts.
- **Decisions:** deployment source = `lineCombinations` (+ `games!inner` date) newest game per team in 14 days, then
  `powerPlayCombinations` for those game ids. PP unit 3 is a catch-all (players 10+), so only PP1/PP2 shown. Stale = lineup >7 days
  old or older than the player's last WGO game. L5 = same WGO rows (`lastFiveTotals`), zeros omitted like recentTotals.
  Schema: two optional player fields (`lastFive`, `deployment`) on one added line; report to Chef.
- **State:** committed 4399669855a1 (10 files incl. receipt). RSO tests 2056/2056 in UTC and NY; tsc exit 0 (heavy lock taken and released); eslint clean; pure check ok.
- **Next:** Chef integrates/releases. Not done: visual phone-width preview (DOM tests only).
- **Gotchas:** `lastFive` name collided with a local in the form loop (renamed `boxScore`). Deployment promise has `.catch(() => null)`
  so it never becomes an unhandled rejection while the WGO reads run.
