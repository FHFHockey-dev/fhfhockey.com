# Supabase Cron Export

- Exported: 2026-05-27T20:31:24.834Z
- Total jobs: 66
- Active jobs: 64

| Active | Schedule | Job | Method | Route | Latest status | Latest start |
| --- | --- | --- | --- | --- | --- | --- |
| yes | */20 * * * * | update-stats-job | GET | /api/v1/db/cron/update-stats-cron?count=4 | succeeded | 2026-05-27T20:20:00.460Z |
| yes | */25 * * * * | update-line-combinations-job | GET | /api/v1/db/update-line-combinations?count=10 | succeeded | 2026-05-27T20:25:00.291Z |
| yes | 0 0 * * * | update-teams-job | GET | /api/v1/db/update-teams | succeeded | 2026-05-27T00:00:00.059Z |
| yes | 0 1 * * * | update-seasons-job | GET | /api/v1/db/update-seasons | succeeded | 2026-05-27T01:00:00.140Z |
| yes | 0 10 * * * | daily-refresh-matview | SQL | SQL | succeeded | 2026-05-27T10:00:00.107Z |
| yes | 0 2 * * * | update-players-job | GET | /api/v1/db/update-players | succeeded | 2026-05-27T02:00:00.069Z |
| yes | 0 3 * * * | update-games-job | GET | /api/v1/db/update-games | succeeded | 2026-05-27T03:00:00.115Z |
| yes | 00 04 * * * | daily-refresh-nstwgo-matview | SQL | SQL | succeeded | 2026-05-27T04:00:00.067Z |
| yes | 00 11 * * * | update-power-rankings | GET | /api/v1/db/update-power-rankings | succeeded | 2026-05-27T11:00:00.176Z |
| yes | 00 13 * * * | daily-cron-report | GET | /api/v1/db/cron-report | succeeded | 2026-05-27T13:00:00.193Z |
| yes | 00 8 * * * | update-line-combinations-all | GET | /api/v1/db/update-line-combinations | succeeded | 2026-05-27T08:00:00.129Z |
| yes | 05 10 * * * | run-forge-projection-v2 | POST | /api/v1/db/run-projection-v2 | succeeded | 2026-05-27T10:05:00.037Z |
| yes | 05 8 * * * | update-power-play-combinations | GET | /api/v1/db/update-power-play-combinations?startDate= | succeeded | 2026-05-27T08:05:00.088Z |
| yes | 05 8 * * * | update-team-yearly-summary | GET | /api/v1/db/update-team-yearly-summary | succeeded | 2026-05-27T08:05:00.084Z |
| yes | 05 9 * * * | daily-refresh-goalie-unified-matview | SQL | SQL | succeeded | 2026-05-27T09:05:00.043Z |
| yes | 10 8 * * * | update-nst-tables-all | GET | /api/Teams/nst-team-stats?date=all | succeeded | 2026-05-27T08:10:00.096Z |
| yes | 10 9 * * * | update-team-ctpi-daily | GET | /api/v1/db/update-team-ctpi-daily | succeeded | 2026-05-27T09:10:00.073Z |
| yes | 12 9 * * * | update-team-sos | GET | /api/v1/db/update-team-sos | succeeded | 2026-05-27T09:12:00.079Z |
| yes | 15 8 * * * | update-rolling-player-averages | GET | /api/v1/db/update-rolling-player-averages | succeeded | 2026-05-27T08:15:00.098Z |
| yes | 15 8 * * * | update-standings-details | GET | /api/v1/db/update-standings-details?date=all | succeeded | 2026-05-27T08:15:00.119Z |
| yes | 15 9 * * * | update-team-power-ratings | GET | /api/v1/db/update-team-power-ratings | succeeded | 2026-05-27T09:15:00.057Z |
| yes | 20 10 * * * | update-season-stats-current-season | GET | /api/v1/db/update-season-stats | succeeded | 2026-05-27T10:20:00.069Z |
| yes | 20 7 * * * | update-yahoo-matchup-dates | GET | /api/v1/db/update-yahoo-weeks?game_key=nhl | succeeded | 2026-05-27T07:20:00.052Z |
| yes | 20 8 * * * | update-all-wgo-goalie-totals | GET | /api/v1/db/update-wgo-goalie-totals | succeeded | 2026-05-27T08:20:00.088Z |
| yes | 25 10 * * * | update-rolling-games-recent | GET | /api/v1/db/update-rolling-games?date=recent | succeeded | 2026-05-27T10:25:00.069Z |
| yes | 25 7 * * * | update-nst-gamelog | GET | /api/v1/db/update-nst-gamelog | succeeded | 2026-05-27T07:25:00.065Z |
| yes | 25 8 * * * | update-expected-goals | GET | /api/v1/db/update-expected-goals?date=all | succeeded | 2026-05-27T08:25:00.084Z |
| yes | 25 9 * * * | update-nhl-edge-stats | GET | /api/v1/db/update-nhl-edge-stats?action=all&limit=1000&concurrency=8 | succeeded | 2026-05-27T09:25:00.079Z |
| yes | 30 10 * * * | update-sko-stats-full-season | GET | /api/v1/db/update-sko-stats | succeeded | 2026-05-27T10:30:00.060Z |
| yes | 30 11 * * * | run-projection-accuracy | POST | /api/v1/db/run-projection-accuracy?projectionOffsetDays=0 | succeeded | 2026-05-27T11:30:00.060Z |
| yes | 30 7 * * * | update-all-wgo-skaters | GET | /api/v1/db/update-wgo-skaters?action=all | succeeded | 2026-05-27T07:30:00.037Z |
| yes | 30 8 * * * | update-nst-goalies | GET | /api/v1/db/update-nst-goalies | succeeded | 2026-05-27T08:30:00.053Z |
| yes | 30 9 * * * | update-goalie-projections-v2 | POST | /api/v1/db/update-goalie-projections-v2 | succeeded | 2026-05-27T09:30:00.037Z |
| yes | 35 10 * * * | update-wgo-averages | GET | /api/v1/db/update-wgo-averages | succeeded | 2026-05-27T10:35:00.040Z |
| yes | 35 11 * * * | game-predictions-forecast-h7 | GET | /api/v1/game-predictions/forecast?fromOffsetDays=7&toOffsetDays=7&limit=16&maxRuntimeMs=240000 | succeeded | 2026-05-27T11:35:00.046Z |
| yes | 35 7 * * * | update-all-wgo-goalies | GET | /api/v1/db/update-wgo-goalies?action=all | succeeded | 2026-05-27T07:35:00.056Z |
| yes | 35 9 * * * | update-player-underlying-stats-yesterday | GET | /api/v1/db/update-player-underlying-stats?startDate= | succeeded | 2026-05-27T09:35:00.086Z |
| yes | 35 9 * * * | update-wgo-teams | GET | /api/v1/db/run-fetch-wgo-data | succeeded | 2026-05-27T09:35:00.084Z |
| yes | 36 11 * * * | game-predictions-forecast-h3 | GET | /api/v1/game-predictions/forecast?fromOffsetDays=3&toOffsetDays=3&limit=16&maxRuntimeMs=240000 | succeeded | 2026-05-27T11:36:00.076Z |
| yes | 37 11 * * * | game-predictions-forecast-h1 | GET | /api/v1/game-predictions/forecast?fromOffsetDays=1&toOffsetDays=1&limit=16&maxRuntimeMs=240000 | succeeded | 2026-05-27T11:37:00.043Z |
| yes | 38 11 * * * | game-predictions-forecast-h0 | GET | /api/v1/game-predictions/forecast?fromOffsetDays=0&toOffsetDays=0&limit=16&maxRuntimeMs=240000 | succeeded | 2026-05-27T11:38:00.045Z |
| yes | 40 10 * * * | rebuild-sustainability-baselines | GET | /api/v1/db/sustainability/rebuild-baselines | succeeded | 2026-05-27T10:40:00.081Z |
| yes | 40 11 * * * | game-predictions-score-recent | GET | /api/v1/game-predictions/score?startDate= | succeeded | 2026-05-27T11:40:00.074Z |
| yes | 40 7 * * * | update-all-wgo-skater-totals | GET | /api/v1/db/update-wgo-totals?season=current | succeeded | 2026-05-27T07:40:00.069Z |
| yes | 40 8 * * * | update-yahoo-players | GET | /api/v1/db/update-yahoo-players?gameId=465 | succeeded | 2026-05-27T08:40:00.077Z |
| yes | 40 9 * * * | update-start-chart-projections | POST | /api/v1/db/update-start-chart-projections | succeeded | 2026-05-27T09:40:00.046Z |
| yes | 41 10 * * * | daily-refresh-player-totals-unified-matview | SQL | SQL | succeeded | 2026-05-27T10:41:00.166Z |
| yes | 42 10 * * * | rebuild-sustainability-priors | GET | /api/v1/sustainability/rebuild-priors?season=current | succeeded | 2026-05-27T10:42:01.024Z |
| yes | 43 10 * * * | rebuild-sustainability-window-z | GET | /api/v1/sustainability/rebuild-window-z?season=current&runAll=true | succeeded | 2026-05-27T10:43:00.065Z |
| yes | 44 10 * * * | rebuild-sustainability-score | GET | /api/v1/sustainability/rebuild-score?season=current&runAll=true | succeeded | 2026-05-27T10:44:00.069Z |
| yes | 45 10 * * * | update-predictions-sko | GET | /api/v1/ml/update-predictions-sko | succeeded | 2026-05-27T10:45:00.112Z |
| yes | 45 7 * * * | update-shift-charts | GET | /api/v1/db/update-shifts?action=all | succeeded | 2026-05-27T07:45:00.037Z |
| yes | 45 8 * * * | update-nst-current-season | GET | /api/v1/db/update-nst-current-season | succeeded | 2026-05-27T08:45:00.034Z |
| yes | 45 9 * * * | ingest-projection-inputs | POST | /api/v1/db/ingest-projection-inputs | succeeded | 2026-05-27T09:45:00.063Z |
| yes | 46 10 * * * | rebuild-sustainability-trend-bands | GET | /api/v1/sustainability/rebuild-trend-bands?runAll=true | succeeded | 2026-05-27T10:46:00.078Z |
| yes | 50 09 * * * | build-forge-derived-v2 | POST | /api/v1/db/build-projection-derived-v2 | succeeded | 2026-05-27T09:50:00.073Z |
| yes | 50 10 * * * | update-nst-team-daily-incremental | GET | /api/v1/db/update-nst-team-daily | succeeded | 2026-05-27T10:50:00.146Z |
| yes | 50 7 * * * | daily-refresh-player-unified-matview | SQL | SQL | succeeded | 2026-05-27T07:50:00.041Z |
| yes | 50 8 * * * | update-wigo-table-stats | GET | /api/v1/db/calculate-wigo-stats | succeeded | 2026-05-27T08:50:00.064Z |
| yes | 51 20 * * * | update-pbp | GET | /api/v1/db/update-PbP?gameId=recent | succeeded | 2026-05-26T20:51:00.073Z |
| yes | 55 10 * * * | update-nst-team-stats-all | GET | /api/Teams/nst-team-stats | succeeded | 2026-05-27T10:55:00.069Z |
| yes | 55 7 * * * | update-power-play-timeframes | GET | /api/v1/db/powerPlayTimeFrame?gameId=all | succeeded | 2026-05-27T07:55:00.097Z |
| yes | 55 8 * * * | sync-yahoo-players-to-sheet | GET | /api/internal/sync-yahoo-players-to-sheet?gameId=465 | succeeded | 2026-05-27T08:55:00.222Z |
| yes | 55 9 * * * | update-nst-team-daily | GET | /api/v1/db/update-nst-team-daily | succeeded | 2026-05-27T09:55:00.042Z |
| no | 15 10 * * * | refresh-team-power-ratings-daily | SQL | SQL | failed | 2026-01-22T10:15:00.094Z |
| no | 20 8 * * * | daily-refresh-team-power-ratings-daily | SQL | SQL | failed | 2026-01-22T08:20:00.054Z |
