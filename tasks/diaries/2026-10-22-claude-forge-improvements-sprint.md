# 2026-10-22 claude (Chef): FORGE improvements sprint, collision-free lanes

## Scope
TJ assigned tasks 6, 7.1/7.2/7.4, 8 and 11.1–11.3 of
`tasks/TASKS/forge-projections/tasks-forge-projection-improvements-2026-10-22.md`.
Tasks 1–5, 7.3, 9 and 10 wait on Codex. Local changes only: no release, migration,
cron or production write without TJ's approval in this session.

## Staffing (Chef: Opus 5.5, xhigh)
| Lane | Tasks | Lease (exclusive) | Worker |
|---|---|---|---|
| A goalie | 7.1, 7.2, 7.4 | goalieModel.ts, stages/goalie-stage.ts, calculators/goalie-starter.ts (+tests), new web/scripts/forge-goalie-backtest.ts | Opus, high |
| B market | 6.1, 6.2 | utils/market-output-builders.ts (+test), new utils/devig.ts (+test) | Opus, medium |
| C distributions | 8.1, 8.2 | uncertainty.ts (+test), new dispersion.ts (+test), new web/scripts/fit-forge-dispersion.ts | Opus, high |
| D1 finalization | 11.1 | pages/api/v1/db/run-projection-v2.ts, lib/projections/run-forge-projections.ts (+tests) | Opus, high |
| D2 runner | 11.2, 11.3 | lib/routeRunner/*, route-runner-tick.ts, pages/db/runner.tsx, styles/RouteRunner.module.scss, runner tests | Opus, medium |

Budget: 5 workers, one attempt each plus at most one correction round; Chef runs the tsc and
integration checks once. TJ approved bounded read-only production SELECTs for A, C and D1
(at most 15 each) and read-only Vercel logs for D1.

## Collision guard
Codex P07/P08 pins: skater-queries, servedForecastLedger, scoreboard, forgeDailyBridge,
run-rolling-forge-pipeline, NST files, RSO planning files (uncommitted P07 edits in the tree).
No lane touches them. Goalie files and run-forge-projections.ts differ from master, so releases
need a port.

## State
- 16:0xZ: workers dispatched.
- Lane B done: devig.ts (+test), market-output-builders.ts additive (+368, no removals; new test). Chef re-ran 21/21 tests. Not wired: skater-stage ~3414 and goalie-stage ~826 still use mean − line; wire with Lane C's P(over) after Lane A releases goalie-stage. Found: veikkaus/tipsport store decimal odds in market_prices_daily.price_american (odds ingestion, Codex P09 area; flag to TJ). prop_market_prices_daily is empty in production.
- Lane D2 done: projection_resume contract (run-projection-v2 single date; 207 runtime_budget replays the same query; run_in_progress_elsewhere waits 150 s; the stall guard counts completed games), maxDurationMs budget param (40 s headroom), 422 freshness → blockedBy plus a "Re-queue with bypass" button. Stores contract null for the new type (check constraint; tick reads the registry). 16 files, +816/−100; Chef re-ran 70/70; removed one stray blank line in store.ts. Open: is the 40 s headroom enough, given D1's findings?
- Lane D1 done. Root cause: the last game (2026020165) stalled about 2 min on one await. The deadline was checked only between games, and the route had no limit below Vercel's 240 s, so it was killed at exactly 240 s (the abandoned work then failed RUN_LEASE_LOST at 15:32:30). Fix: settleBeforeLimit answers by min(budget + 15 s, 225 s) (budget capped at 210 s) with a resumable 207; games start only when the slowest game so far still fits. 4 files, +199/−18; Chef re-ran 41/41 and reviewed the helper (timer cleared; late rejection caught). This answers D2's headroom: the runner's ~180 s budget means an answer by ~195 s. Port: the route ports clean; the run-forge-projections hunks apply to master with offsets.
- Lane C done: NB dispersion fitted per stat × position (method of moments within player-seasons; alpha(mu) = a + b/mu; goalies pooled NB2; G/A stay Poisson), dispersion.ts plus fit script; uncertainty.ts gets an opt-in countModel (legacy output byte-identical), summarizeStatDistribution and probabilityOverLine. 2025-26 holdout: NB beats Poisson on every count stat (saves log 3.605 → 3.421; PIT TV 0.152 → 0.033). Chef re-ran 25/25. Data finding for TJ: wgo_skater_stats season 20242025 holds ~250k rows dated 1959–2024; goalie 20252026 includes playoffs.
- Chef wiring after Lane A: (1) skater-stage ~3414 and goalie-stage ~826: compareModelWithMarket + buildModelMarketProbabilityFlagRow with overProbability = probabilityOverLine; (2) pass countModel { negativeBinomial: true, position } to buildPlayerUncertainty/buildGoalieUncertainty; (3) replace Lane A's inline de-vig with devig.ts.

- Lane A done: goalie model (see the task list 7.x note). All 5 lanes accepted.
- Chef integration: goalieOutcomes uses devig.ts (proportional + book-sum guard 0.98–1.35, rejects decimal-odds rows); run-forge-projections passes gameMarketSummary to the goalie stage; skater and goalie prop flags use compareModelWithMarket + forgePropOverProbability (new helper in market-output-builders) and fill probability_over; both stages opt into NB quantiles. ANALYTICS_MODEL_VERSION kept (homepageGameAnalytics filters on it).
- Checks: 109 suites / 2,830 tests in the working tree. The one failure (forgeDailyBridge "planner accepts league points") comes from Codex P07's uncommitted planner edits: it passes 28/28 in HEAD plus only the sprint files. eslint clean on all sprint files. tsc running in that clean copy.
- Release port notes: the goalie lane depends on octoberBranch-only nullable GF/W (F1 HOLD commits); the D1 route ports clean, and its run-forge-projections hunks apply with offsets; the D2 runner files are on master already (R22/R23) plus this diff.

## Next
Review each report and diff, integrate (Lane B's P(over) consumes Lane C's distributions; Lane A's
moneyline de-vig is to be deduped with Lane B's devig.ts), run the checks, commit with explicit
paths, then ask TJ about releases.
