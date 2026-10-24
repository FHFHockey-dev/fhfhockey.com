# Review lane (Claude) — 2026-10-22

## Scope
Codex review concerns 6.2 (Yes-only de-vig assumptions), 7.2 (team vs goalie W populations), 11.3 (bypass re-queue approval) on `6b4898a95` / `d45a287f0`.
Files: devig.ts, market-output-builders.ts (+tests); goalieModel.ts, goalie/*, goalie-stage.ts, goaliePipeline.test.ts, forge-goalie-backtest.ts (+test); routeRunner/*, pages/db/runner.tsx, RouteRunner.module.scss, runner + route-runner tests.

## Where
octoberBranch, start HEAD cbb4f6836. My files clean at start.

## State
- Started; reading code.

## Next

## Blockers / approvals

## Gotchas
- Decisions (TJ pop-ups): 6.2 suppress model_under when no book at the line has an Under; 7.2 approved ≤6 read-only SELECTs (fyhftlxokyjtpndbkfse, wgo_goalie_stats/wgo_team_stats 2025-26 regular season) for a holdout fixture in scratchpad.
- Finding: stored proj_win_prob = starter-weighted blend Σp_g·W(g|start)·0.984 (slot expectation). Consumers disagree: api/v1/forge/goalies.ts renormalises it per matchup (team W); forgeDailyBridge reads it as goalie W with GAMES_STARTED 1; run-projection-accuracy scores it vs credited wins. Not my files → follow-ups.
- 6.2 committed 6f0c58471 (devig + market builders, 31/31 utils tests, eslint clean). Env knob FORGE_YES_ONLY_OVERROUND; no stage edits needed.
- 7.2 code: goalieWinPopulations (relief split by start prob), goalie-stage uncertainty.win_populations (team vs candidate populations, proj_win_prob labelled as team goalie slot; proj_win_prob value unchanged), scorer scoreWinPopulations + --candidates fixture. 102/102 goalie tests, eslint clean.
- 7.2 holdout: 6/6 approved SELECTs used (one timed out; 2024-25/2025-26 wgo_goalie_stats rows lack game_id/team, so roster spots supply them). Results + SQL in shared notes review-lane-7.2/. Team W Brier 0.2490 (2,452 team-games, sums exactly 1); W|start 0.2488 (2,452 starts); unconditional 0.1852 (4,903 dressed candidates) vs 0.2520 if team W is misused.
- 11.3 code: core checkFreshnessBypass (signed-in admin, confirmed, blocker count must match source job, query must equal source's re-queue path; else 403/400/409), describeFreshnessBlock, JobProgress.freshnessBypass + blockerCount carried across steps; tick marks every step result of a bypassed job (completion → warn); jobs.ts (outside listed files, minimal hook, clean before) records approval as warn event + job progress; runner.tsx confirmation alertdialog (count, reason, checkbox) + banner + list badge; scss pure OK. 78/78 runner tests, eslint clean. tsc running under /private/tmp/fhfh-heavy.lock.
- tsc --noEmit exit 0 (under heavy lock, released). 11.3 committed.
- Next: report to Chef; follow-ups listed in shared notes review-lane-2026-10-22.md.
