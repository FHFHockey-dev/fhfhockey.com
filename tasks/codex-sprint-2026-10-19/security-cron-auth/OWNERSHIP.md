# C-F2 ownership — before implementation

Owner: `01a1566f-c3e3-7fc0-9dd4-2f71a4a62233`; runtime turn_context confirms `gpt-6.1-sol` / `high`; checkout `octoberBranch`. Chef owns REGISTER.md and global checks.

96 A! inventory rows reconciled: **74 owned callers**, **22 excluded**. All owned files are clean except explicitly authorized P6-owned `update-nst-team-daily.ts`; preserve its complete existing deadline diff. Shared wrappers/helpers remain read-only. All changes limited to caller auth ordering and the existing focused test.

## Exact owned source files

- `web/pages/api/Teams/nst-team-stats.ts`
- `web/pages/api/v1/db/backfill-goalie-underlying-season.ts`
- `web/pages/api/v1/db/backfill-player-underlying-season.ts`
- `web/pages/api/v1/db/backfill-team-underlying-season.ts`
- `web/pages/api/v1/db/calculate-wigo-stats.ts`
- `web/pages/api/v1/db/catch-up-goalie-underlying.ts`
- `web/pages/api/v1/db/catch-up-player-underlying.ts`
- `web/pages/api/v1/db/catch-up-team-underlying.ts`
- `web/pages/api/v1/db/cron/update-stats-cron.ts`
- `web/pages/api/v1/db/draft-ranker-health.ts`
- `web/pages/api/v1/db/powerPlayTimeFrame.ts`
- `web/pages/api/v1/db/refresh-draft-ranker-community.ts`
- `web/pages/api/v1/db/refresh-draft-ranker-discovery.ts`
- `web/pages/api/v1/db/register-nhl-xg-model.ts`
- `web/pages/api/v1/db/run-fetch-wgo-data.ts`
- `web/pages/api/v1/db/sustainability/rebuild-baselines.ts`
- `web/pages/api/v1/db/update-PbP.ts`
- `web/pages/api/v1/db/update-entity-metric-rankings.ts`
- `web/pages/api/v1/db/update-games.ts`
- `web/pages/api/v1/db/update-goalie-underlying-stats.ts`
- `web/pages/api/v1/db/update-goalie-underlying-summaries.ts`
- `web/pages/api/v1/db/update-line-combinations/[id].ts`
- `web/pages/api/v1/db/update-line-combinations/index.ts`
- `web/pages/api/v1/db/update-lineup-deployment-tallies.ts`
- `web/pages/api/v1/db/update-market-prices.ts`
- `web/pages/api/v1/db/update-nhl-edge-stats.ts`
- `web/pages/api/v1/db/update-nhl-play-by-play.ts`
- `web/pages/api/v1/db/update-nhl-shift-charts.ts`
- `web/pages/api/v1/db/update-nhl-xg-aggregates.ts`
- `web/pages/api/v1/db/update-nhl-xg-shot-predictions.ts`
- `web/pages/api/v1/db/update-nhlscraper-contracts.ts`
- `web/pages/api/v1/db/update-nst-current-season.ts`
- `web/pages/api/v1/db/update-nst-goalies.ts`
- `web/pages/api/v1/db/update-nst-team-daily.ts`
- `web/pages/api/v1/db/update-player-impact-ratings.ts`
- `web/pages/api/v1/db/update-player-trend-metrics.ts`
- `web/pages/api/v1/db/update-player-underlying-stats.ts`
- `web/pages/api/v1/db/update-player-underlying-summaries.ts`
- `web/pages/api/v1/db/update-player/[playerId].ts`
- `web/pages/api/v1/db/update-players.ts`
- `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts`
- `web/pages/api/v1/db/update-power-play-combinations/index.ts`
- `web/pages/api/v1/db/update-rolling-games.ts`
- `web/pages/api/v1/db/update-season-stats.ts`
- `web/pages/api/v1/db/update-seasons.ts`
- `web/pages/api/v1/db/update-shifts.ts`
- `web/pages/api/v1/db/update-skater-composite-ratings.ts`
- `web/pages/api/v1/db/update-sko-stats.ts`
- `web/pages/api/v1/db/update-standings-details/index.ts`
- `web/pages/api/v1/db/update-stats/[gameId].ts`
- `web/pages/api/v1/db/update-team-ctpi-daily.ts`
- `web/pages/api/v1/db/update-team-power-ratings.ts`
- `web/pages/api/v1/db/update-team-sos.ts`
- `web/pages/api/v1/db/update-team-unit-toi.ts`
- `web/pages/api/v1/db/update-team-yearly-summary.ts`
- `web/pages/api/v1/db/update-wgo-averages.ts`
- `web/pages/api/v1/db/update-wgo-goalie-totals.ts`
- `web/pages/api/v1/db/upsert-csv.ts`
- `web/pages/api/v1/game-predictions/accuracy-loop.ts`
- `web/pages/api/v1/game-predictions/backfill-feature-snapshots.ts`
- `web/pages/api/v1/game-predictions/backtest-ablation.ts`
- `web/pages/api/v1/game-predictions/backtest.ts`
- `web/pages/api/v1/game-predictions/feature-signal-analysis.ts`
- `web/pages/api/v1/game-predictions/forecast.ts`
- `web/pages/api/v1/game-predictions/generate.ts`
- `web/pages/api/v1/game-predictions/import-market-odds.ts`
- `web/pages/api/v1/game-predictions/ingest-espn-odds.ts`
- `web/pages/api/v1/game-predictions/promote-model-version.ts`
- `web/pages/api/v1/game-predictions/score.ts`
- `web/pages/api/v1/sustainability/process-recompute-queue.ts`
- `web/pages/api/v1/sustainability/rebuild-priors.ts`
- `web/pages/api/v1/sustainability/rebuild-score.ts`
- `web/pages/api/v1/sustainability/rebuild-trend-bands.ts`
- `web/pages/api/v1/sustainability/rebuild-window-z.ts`

## Existing test ownership

- `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`

## Every excluded A! row

| Inventory row | Source path | Reason |
| --- | --- | --- |
| 18 | `web/pages/api/internal/sync-yahoo-players-to-sheet.ts` | Yahoo internal-secret sheet writer; bespoke auth also outside export-only scope |
| 93 | `web/pages/api/v1/db/auto-news-feed-items.ts` | Active adjacent owner: auto-news-feed-items |
| 97 | `web/pages/api/v1/db/build-projection-derived-v2.ts` | Active adjacent owner and fenced projection/FORGE imports |
| 103 | `web/pages/api/v1/db/cron-report.ts` | Chef reserved cron-report for email-contract task |
| 104 | `web/pages/api/v1/db/cron/update-roster-optimizer-schedule-daily.ts` | Active adjacent RSO owner; untracked route and fenced rosterScheduleData imports |
| 108 | `web/pages/api/v1/db/ingest-projection-inputs.ts` | Active adjacent owner and fenced projection/FORGE imports |
| 109 | `web/pages/api/v1/db/manual-refresh-yahoo-token.ts` | Yahoo token route |
| 119 | `web/pages/api/v1/db/run-projection-accuracy.ts` | Literal run-projection* fence and projection imports |
| 120 | `web/pages/api/v1/db/run-projection-v2.ts` | Literal run-projection* fence and projection imports |
| 121 | `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` | Literal run-*forge* fence and projection/FORGE imports |
| 127 | `web/pages/api/v1/db/sweep-gamecenter-normalization.ts` | Active adjacent sweep-gamecenter-normalization owner |
| 132 | `web/pages/api/v1/db/update-game-goal-projections/index.ts` | Projection consumer; conservative Claude adjacency exclusion |
| 134 | `web/pages/api/v1/db/update-goalie-projections-v2.ts` | Projection consumer with fenced projection import |
| 141 | `web/pages/api/v1/db/update-line-sources.ts` | Active adjacent update-line-sources owner; tweet/IFTTT and projection adjacency |
| 142 | `web/pages/api/v1/db/update-lines-ccc.ts` | Active adjacent update-lines-ccc owner; tweet/IFTTT adjacency |
| 144 | `web/pages/api/v1/db/update-lineup-source-provenance.ts` | Lineup source/tweet provenance consumer; conservative IFTTT adjacency exclusion |
| 169 | `web/pages/api/v1/db/update-player-statuses.ts` | Tweet/news status provenance consumer; conservative IFTTT adjacency exclusion |
| 179 | `web/pages/api/v1/db/update-rolling-player-averages.ts` | FORGE pipeline dependency; conservative Claude adjacency exclusion |
| 194 | `web/pages/api/v1/db/update-teams.ts` | FORGE link dependency; conservative Claude adjacency exclusion |
| 200 | `web/pages/api/v1/db/update-yahoo-players.ts` | Yahoo player writer |
| 201 | `web/pages/api/v1/db/update-yahoo-weeks.ts` | Yahoo week writer |
| 257 | `web/pages/api/v1/ml/update-predictions-sko.ts` | SKO prediction control consumer; conservative adjacent pipeline ownership exclusion |

## Lane artifacts

This lane may create OWNERSHIP.md, BASELINE.json, HANDOFF.md and focused local test evidence only. No shared register writes. No network, Git mutation, production calls, shared helper edits or global checks.
