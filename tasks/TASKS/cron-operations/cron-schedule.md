# ALL CRON JOBS:
```json
[
  {
    "jobid": 1,
    "jobname": "update-line-combinations-job",
    "schedule": "*/25 * * * *",
    "run_time_utc": null,
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-line-combinations?count=10"
  },
  {
    "jobid": 2,
    "jobname": "update-stats-job",
    "schedule": "*/20 * * * *",
    "run_time_utc": null,
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/cron/update-stats-cron?count=4"
  },
  {
    "jobid": 3,
    "jobname": "update-teams-job",
    "schedule": "0 0 * * *",
    "run_time_utc": "00:00 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-teams"
  },
  {
    "jobid": 5,
    "jobname": "update-seasons-job",
    "schedule": "0 1 * * *",
    "run_time_utc": "01:00 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-seasons"
  },
  {
    "jobid": 6,
    "jobname": "update-players-job",
    "schedule": "0 2 * * *",
    "run_time_utc": "02:00 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-players"
  },
  {
    "jobid": 7,
    "jobname": "update-games-job",
    "schedule": "0 3 * * *",
    "run_time_utc": "03:00 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-games"
  },
  {
    "jobid": 271,
    "jobname": "daily-refresh-nstwgo-matview",
    "schedule": "00 04 * * *",
    "run_time_utc": "04:00 UTC",
    "active": true,
    "method": "SQL"
  },
  {
    "jobid": 233,
    "jobname": "update-yahoo-matchup-dates",
    "schedule": "20 7 * * *",
    "run_time_utc": "07:20 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-yahoo-weeks?game_key=nhl"
  },
  {
    "jobid": 79,
    "jobname": "update-nst-gamelog",
    "schedule": "25 7 * * *",
    "run_time_utc": "07:25 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-nst-gamelog"
  },
  {
    "jobid": 9,
    "jobname": "update-all-wgo-skaters",
    "schedule": "30 7 * * *",
    "run_time_utc": "07:30 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-wgo-skaters?action=all"
  },
  {
    "jobid": 8,
    "jobname": "update-all-wgo-goalies",
    "schedule": "35 7 * * *",
    "run_time_utc": "07:35 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-wgo-goalies?action=all"
  },
  {
    "jobid": 14,
    "jobname": "update-all-wgo-skater-totals",
    "schedule": "40 7 * * *",
    "run_time_utc": "07:40 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-wgo-totals?season=current"
  },
  {
    "jobid": 16,
    "jobname": "update-shift-charts",
    "schedule": "45 7 * * *",
    "run_time_utc": "07:45 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-shifts?action=all"
  },
  {
    "jobid": 248,
    "jobname": "daily-refresh-player-unified-matview",
    "schedule": "50 7 * * *",
    "run_time_utc": "07:50 UTC",
    "active": true,
    "method": "SQL"
  },
  {
    "jobid": 23,
    "jobname": "update-power-play-timeframes",
    "schedule": "55 7 * * *",
    "run_time_utc": "07:55 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/powerPlayTimeFrame?gameId=all"
  },
  {
    "jobid": 24,
    "jobname": "update-line-combinations-all",
    "schedule": "00 8 * * *",
    "run_time_utc": "08:00 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-line-combinations"
  },
  {
    "jobid": 388,
    "jobname": "update-power-play-combinations",
    "schedule": "05 8 * * *",
    "run_time_utc": "08:05 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-power-play-combinations?startDate="
  },
  {
    "jobid": 247,
    "jobname": "update-team-yearly-summary",
    "schedule": "05 8 * * *",
    "run_time_utc": "08:05 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-team-yearly-summary"
  },
  {
    "jobid": 17,
    "jobname": "update-nst-tables-all",
    "schedule": "10 8 * * *",
    "run_time_utc": "08:10 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/Teams/nst-team-stats?date=all"
  },
  {
    "jobid": 278,
    "jobname": "update-rolling-player-averages",
    "schedule": "15 8 * * *",
    "run_time_utc": "08:15 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-rolling-player-averages"
  },
  {
    "jobid": 43,
    "jobname": "update-standings-details",
    "schedule": "15 8 * * *",
    "run_time_utc": "08:15 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-standings-details?date=all"
  },
  {
    "jobid": 76,
    "jobname": "update-all-wgo-goalie-totals",
    "schedule": "20 8 * * *",
    "run_time_utc": "08:20 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-wgo-goalie-totals"
  },
  {
    "jobid": 390,
    "jobname": "update-game-goal-projections",
    "schedule": "25 8 * * *",
    "run_time_utc": "08:25 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-game-goal-projections?date=all"
  },
  {
    "jobid": 99,
    "jobname": "update-nst-goalies",
    "schedule": "30 8 * * *",
    "run_time_utc": "08:30 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-nst-goalies"
  },
  {
    "jobid": 106,
    "jobname": "update-yahoo-players",
    "schedule": "40 8 * * *",
    "run_time_utc": "08:40 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-yahoo-players?gameId=465"
  },
  {
    "jobid": 220,
    "jobname": "update-nst-current-season",
    "schedule": "45 8 * * *",
    "run_time_utc": "08:45 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-nst-current-season"
  },
  {
    "jobid": 231,
    "jobname": "update-wigo-table-stats",
    "schedule": "50 8 * * *",
    "run_time_utc": "08:50 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/calculate-wigo-stats"
  },
  {
    "jobid": 251,
    "jobname": "sync-yahoo-players-to-sheet",
    "schedule": "55 8 * * *",
    "run_time_utc": "08:55 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/internal/sync-yahoo-players-to-sheet?gameId=465"
  },
  {
    "jobid": 272,
    "jobname": "daily-refresh-goalie-unified-matview",
    "schedule": "05 9 * * *",
    "run_time_utc": "09:05 UTC",
    "active": true,
    "method": "SQL"
  },
  {
    "jobid": 279,
    "jobname": "update-team-ctpi-daily",
    "schedule": "10 10 * * *",
    "run_time_utc": "10:10 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-team-ctpi-daily"
  },
  {
    "jobid": 365,
    "jobname": "update-team-sos",
    "schedule": "12 9 * * *",
    "run_time_utc": "09:12 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-team-sos"
  },
  {
    "jobid": 283,
    "jobname": "update-team-power-ratings",
    "schedule": "15 10 * * *",
    "run_time_utc": "10:15 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-team-power-ratings"
  },
  {
    "jobid": 389,
    "jobname": "update-nhl-edge-stats",
    "schedule": "25 9 * * *",
    "run_time_utc": "09:25 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-nhl-edge-stats?action=all&limit=1000&concurrency=8"
  },
  {
    "jobid": 364,
    "jobname": "update-goalie-projections-v2",
    "schedule": "30 9 * * *",
    "run_time_utc": "09:30 UTC",
    "active": true,
    "method": "POST",
    "route": "/api/v1/db/update-goalie-projections-v2"
  },
  {
    "jobid": 381,
    "jobname": "update-player-underlying-stats-yesterday",
    "schedule": "35 9 * * *",
    "run_time_utc": "09:35 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-player-underlying-stats?startDate="
  },
  {
    "jobid": 44,
    "jobname": "update-wgo-teams",
    "schedule": "35 9 * * *",
    "run_time_utc": "09:35 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/run-fetch-wgo-data"
  },
  {
    "jobid": 363,
    "jobname": "ingest-projection-inputs",
    "schedule": "45 9 * * *",
    "run_time_utc": "09:45 UTC",
    "active": true,
    "method": "POST",
    "route": "/api/v1/db/ingest-projection-inputs"
  },
  {
    "jobid": 305,
    "jobname": "build-forge-derived-v2",
    "schedule": "50 09 * * *",
    "run_time_utc": "09:50 UTC",
    "active": true,
    "method": "POST",
    "route": "/api/v1/db/build-projection-derived-v2"
  },
  {
    "jobid": 275,
    "jobname": "update-nst-team-daily",
    "schedule": "55 9 * * *",
    "run_time_utc": "09:55 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-nst-team-daily"
  },
  {
    "jobid": 391,
    "jobname": "update-lineup-deployment-tallies",
    "schedule": "55 9 * * *",
    "run_time_utc": "09:55 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-lineup-deployment-tallies"
  },
  {
    "jobid": 201,
    "jobname": "daily-refresh-matview",
    "schedule": "0 10 * * *",
    "run_time_utc": "10:00 UTC",
    "active": true,
    "method": "SQL"
  },
  {
    "jobid": 308,
    "jobname": "run-forge-projection-v2",
    "schedule": "05 10 * * *",
    "run_time_utc": "10:05 UTC",
    "active": true,
    "method": "POST",
    "route": "/api/v1/db/run-projection-v2",
    "auth": "Supabase Vault cron_secret"
  },
  {
    "jobid": 393,
    "jobname": "run-forge-projection-v2-weekly",
    "schedule": "12 10 * * *",
    "run_time_utc": "10:12 UTC",
    "active": true,
    "method": "POST",
    "route": "/api/v1/db/run-projection-v2?horizonGames=5",
    "auth": "Supabase Vault cron_secret",
    "verification": "Old token rejected 401; new token authorized 200; zero-game horizon-5 no-op returned HTTP 200 in 430 ms on production deployment dpl_D8gth3djEPB1JLZ6B2fAL44oETVE"
  },
  {
    "jobid": 318,
    "jobname": "update-season-stats-current-season",
    "schedule": "20 10 * * *",
    "run_time_utc": "10:20 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-season-stats"
  },
  {
    "jobid": 319,
    "jobname": "update-rolling-games-recent",
    "schedule": "25 10 * * *",
    "run_time_utc": "10:25 UTC",
    "active": false,
    "method": "GET",
    "route": "/api/v1/db/update-rolling-games?date=recent"
  },
  {
    "jobid": 321,
    "jobname": "update-sko-stats-full-season",
    "schedule": "30 10 * * *",
    "run_time_utc": "10:30 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-sko-stats"
  },
  {
    "jobid": 323,
    "jobname": "update-wgo-averages",
    "schedule": "35 10 * * *",
    "run_time_utc": "10:35 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-wgo-averages"
  },
  {
    "jobid": 326,
    "jobname": "rebuild-sustainability-baselines",
    "schedule": "40 10 * * *",
    "run_time_utc": "10:40 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/sustainability/rebuild-baselines"
  },
  {
    "jobid": 374,
    "jobname": "daily-refresh-player-totals-unified-matview",
    "schedule": "41 10 * * *",
    "run_time_utc": "10:41 UTC",
    "active": true,
    "method": "SQL"
  },
  {
    "jobid": 376,
    "jobname": "rebuild-sustainability-priors",
    "schedule": "42 10 * * *",
    "run_time_utc": "10:42 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/sustainability/rebuild-priors?season=current"
  },
  {
    "jobid": 370,
    "jobname": "rebuild-sustainability-window-z",
    "schedule": "43 10 * * *",
    "run_time_utc": "10:43 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/sustainability/rebuild-window-z?season=current&runAll=true"
  },
  {
    "jobid": 371,
    "jobname": "rebuild-sustainability-score",
    "schedule": "44 10 * * *",
    "run_time_utc": "10:44 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/sustainability/rebuild-score?season=current&runAll=true"
  },
  {
    "jobid": 327,
    "jobname": "update-predictions-sko",
    "schedule": "45 10 * * *",
    "run_time_utc": "10:45 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/ml/update-predictions-sko"
  },
  {
    "jobid": 372,
    "jobname": "rebuild-sustainability-trend-bands",
    "schedule": "46 10 * * *",
    "run_time_utc": "10:46 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/sustainability/rebuild-trend-bands?runAll=true"
  },
  {
    "jobid": 328,
    "jobname": "update-nst-team-daily-incremental",
    "schedule": "50 10 * * *",
    "run_time_utc": "10:50 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-nst-team-daily"
  },
  {
    "jobid": 329,
    "jobname": "update-nst-team-stats-all",
    "schedule": "55 10 * * *",
    "run_time_utc": "10:55 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/Teams/nst-team-stats"
  },
  {
    "jobid": 361,
    "jobname": "run-projection-accuracy",
    "schedule": "30 11 * * *",
    "run_time_utc": "11:30 UTC",
    "active": true,
    "method": "POST",
    "route": "/api/v1/db/run-projection-accuracy?projectionOffsetDays=0"
  },
  {
    "jobid": 392,
    "jobname": "update-player-trend-metrics",
    "schedule": "0 12 * * *",
    "run_time_utc": "12:00 UTC",
    "active": true,
    "method": "POST",
    "route": "/api/v1/db/update-player-trend-metrics"
  },
  {
    "jobid": 383,
    "jobname": "game-predictions-forecast-h7",
    "schedule": "35 11 * * *",
    "run_time_utc": "11:35 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/game-predictions/forecast?fromOffsetDays=7&toOffsetDays=7&limit=16&maxRuntimeMs=240000"
  },
  {
    "jobid": 384,
    "jobname": "game-predictions-forecast-h3",
    "schedule": "36 11 * * *",
    "run_time_utc": "11:36 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/game-predictions/forecast?fromOffsetDays=3&toOffsetDays=3&limit=16&maxRuntimeMs=240000"
  },
  {
    "jobid": 385,
    "jobname": "game-predictions-forecast-h1",
    "schedule": "37 11 * * *",
    "run_time_utc": "11:37 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/game-predictions/forecast?fromOffsetDays=1&toOffsetDays=1&limit=16&maxRuntimeMs=240000"
  },
  {
    "jobid": 386,
    "jobname": "game-predictions-forecast-h0",
    "schedule": "38 11 * * *",
    "run_time_utc": "11:38 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/game-predictions/forecast?fromOffsetDays=0&toOffsetDays=0&limit=16&maxRuntimeMs=240000"
  },
  {
    "jobid": 387,
    "jobname": "game-predictions-score-recent",
    "schedule": "40 11 * * *",
    "run_time_utc": "11:40 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/game-predictions/score?startDate="
  },
  {
    "jobid": 104,
    "jobname": "update-pbp",
    "schedule": "51 20 * * *",
    "run_time_utc": "20:51 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/update-PbP?gameId=recent"
  },
  {
    "jobid": 234,
    "jobname": "daily-cron-report",
    "schedule": "15 21 * * *",
    "run_time_utc": "21:15 UTC",
    "active": true,
    "method": "GET",
    "route": "/api/v1/db/cron-report"
  },
  {
    "jobid": 281,
    "jobname": "daily-refresh-team-power-ratings-daily",
    "schedule": "20 8 * * *",
    "run_time_utc": "08:20 UTC",
    "active": false,
    "method": "SQL"
  },
  {
    "jobid": 280,
    "jobname": "update-start-chart-projections",
    "schedule": "40 9 * * *",
    "run_time_utc": "09:40 UTC",
    "active": false,
    "method": "POST",
    "route": "/api/v1/db/update-start-chart-projections"
  },
  {
    "jobid": 277,
    "jobname": "refresh-team-power-ratings-daily",
    "schedule": "15 10 * * *",
    "run_time_utc": "10:15 UTC",
    "active": false,
    "method": "SQL"
  },
  {
    "jobid": 330,
    "jobname": "update-power-rankings",
    "schedule": "00 11 * * *",
    "run_time_utc": "11:00 UTC",
    "active": false,
    "method": "GET",
    "route": "/api/v1/db/update-power-rankings"
  }
]
```

> **Observed production snapshot (reconciled 2026-07-11):** The active
> dependency chain is WGO teams job 44 at `09:35` → incremental NST team job
> 275 at `09:55` → CTPI job 279 at `10:10` → team power job 283 at `10:15`
> UTC. The separate full NST job 329 remains at `10:55`. Player trends are
> owned by audited POST job 392 at `12:00`. The deployed writer probes passed;
> offseason trend serving remains truthfully blocked on the latest played date.

## Inbound scheduled-route authentication boundary

The machine-checked inventory in `web/lib/cron/cronAuditCoverage.ts` and
`web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts` freezes the
2026-07-18 pre-rollout contract:

- 59 active HTTP jobs resolve to 52 unique Pages API routes with no missing
  route owner.
- 17 routes already use the fail-closed `adminOnly` admin-or-exact-cron
  boundary; one destructive internal sheet-sync route intentionally uses an
  exact-`CRON_SECRET`-only guard; 34 routes remain explicitly unprotected and
  pending route-by-route migration.
- Static non-cron consumers are classified as 5 browser-admin-only routes,
  11 internal-server-only routes, 4 routes with both browser-admin and internal
  callers, and 32 cron-only routes. The manifest names every non-cron source
  file so later protection cannot silently break an admin surface or chained
  server call.
- There is no approved public unauthenticated exception. The target is
  `adminOnly` for every scheduled writer except the existing internal
  cron-secret-only sheet sync.

Rollout must remain route-by-route. Before wrapping a route, verify all named
browser callers supply an authenticated admin bearer, all named server callers
forward the exact cron bearer without logging it, and focused production-mode
tests prove missing/invalid rejection plus cron/admin admission. Deploy a small
coherent batch, run value-free 401/200 checks, then observe the scheduled audit
before continuing. If a caller contract fails, roll back only that route's
wrapper/caller batch to the preceding deployment; do not roll back the rotated
secret, Vault-backed cron commands, or unrelated protected routes. A bulk
cross-route enforcement change remains a breaking-contract checkpoint.



----------------------------------------------------------------------------------
-- Timeline (earliest -> latest)
--
-- - */25 * * * *: update-line-combinations-job
-- - */20 * * * *: update-stats-job
-- - 00:00 UTC / 19:00 EST: update-teams-job
-- - 01:00 UTC / 20:00 EST: update-seasons-job
-- - 02:00 UTC / 21:00 EST: update-players-job
-- - 03:00 UTC / 22:00 EST: update-games-job
-- - 04:00 UTC / 23:00 EST: daily-refresh-nstwgo-matview
-- - 07:20 UTC / 02:20 EST: update-yahoo-matchup-dates
-- - 07:25 UTC / 02:25 EST: update-nst-gamelog
-- - 07:30 UTC / 02:30 EST: update-all-wgo-skaters
-- - 07:35 UTC / 02:35 EST: update-all-wgo-goalies
-- - 07:40 UTC / 02:40 EST: update-all-wgo-skater-totals
-- - 07:45 UTC / 02:45 EST: update-shift-charts
-- - 07:50 UTC / 02:50 EST: daily-refresh-player-unified-matview
-- - 07:55 UTC / 02:55 EST: update-power-play-timeframes
-- - 08:00 UTC / 03:00 EST: update-line-combinations-all
-- - 08:05 UTC / 03:05 EST: update-power-play-combinations
-- - 08:05 UTC / 03:05 EST: update-team-yearly-summary
-- - 08:10 UTC / 03:10 EST: update-nst-tables-all
-- - 08:15 UTC / 03:15 EST: update-rolling-player-averages
-- - 08:15 UTC / 03:15 EST: update-standings-details
-- - 08:20 UTC / 03:20 EST: update-all-wgo-goalie-totals
-- - 08:25 UTC / 03:25 EST: update-game-goal-projections
-- - 08:30 UTC / 03:30 EST: update-nst-goalies
-- - 08:40 UTC / 03:40 EST: update-yahoo-players
-- - 08:45 UTC / 03:45 EST: update-nst-current-season
-- - 08:50 UTC / 03:50 EST: update-wigo-table-stats
-- - 08:55 UTC / 03:55 EST: sync-yahoo-players-to-sheet
-- - 09:05 UTC / 04:05 EST: daily-refresh-goalie-unified-matview
-- - 09:12 UTC / 04:12 EST: update-team-sos
-- - 09:25 UTC / 04:25 EST: update-nhl-edge-stats
-- - 09:30 UTC / 04:30 EST: update-goalie-projections-v2
-- - 09:35 UTC / 04:35 EST: update-player-underlying-stats-yesterday
-- - 09:35 UTC / 04:35 EST: update-wgo-teams
-- - 09:45 UTC / 04:45 EST: ingest-projection-inputs
-- - 09:50 UTC / 04:50 EST: build-forge-derived-v2
-- - 09:55 UTC / 04:55 EST: update-nst-team-daily
-- - 10:00 UTC / 05:00 EST: daily-refresh-matview
-- - 10:05 UTC / 05:05 EST: run-forge-projection-v2
-- - 10:10 UTC / 05:10 EST: update-team-ctpi-daily (after WGO/NST team sources)
-- - 10:12 UTC / 05:12 EST: run-forge-projection-v2-weekly (horizonGames=5, Vault-backed)
-- - 10:15 UTC / 05:15 EST: update-team-power-ratings (after WGO/NST team sources)
-- - 10:20 UTC / 05:20 EST: update-season-stats-current-season
-- - 10:25 UTC / 05:25 EST: update-rolling-games-recent
-- - 10:30 UTC / 05:30 EST: update-sko-stats-full-season
-- - 10:35 UTC / 05:35 EST: update-wgo-averages
-- - 10:40 UTC / 05:40 EST: rebuild-sustainability-baselines
-- - 10:41 UTC / 05:41 EST: daily-refresh-player-totals-unified-matview
-- - 10:42 UTC / 05:42 EST: rebuild-sustainability-priors
-- - 10:43 UTC / 05:43 EST: rebuild-sustainability-window-z
-- - 10:44 UTC / 05:44 EST: rebuild-sustainability-score
-- - 10:45 UTC / 05:45 EST: update-predictions-sko
-- - 10:46 UTC / 05:46 EST: rebuild-sustainability-trend-bands
-- - 10:50 UTC / 05:50 EST: update-nst-team-daily-incremental
-- - 10:55 UTC / 05:55 EST: update-nst-team-stats-all
-- - 11:30 UTC / 06:30 EST: run-projection-accuracy
-- - 11:34 UTC / 06:34 EST: game-predictions-ingest-espn-odds-h0-h7
-- - 11:35 UTC / 06:35 EST: game-predictions-forecast-h7
-- - 11:36 UTC / 06:36 EST: game-predictions-forecast-h3
-- - 11:37 UTC / 06:37 EST: game-predictions-forecast-h1
-- - 11:38 UTC / 06:38 EST: game-predictions-forecast-h0
-- - 11:40 UTC / 06:40 EST: game-predictions-score-recent
-- - 12:00 UTC / 07:00 EST: update-player-trend-metrics (proposed; deploy/runtime probe required)
-- - 17:34 UTC / 12:34 EST: game-predictions-ingest-espn-odds-h0-h1
-- - 20:51 UTC / 15:51 EST: update-pbp
-- - 21:10 UTC / 16:10 EST: game-predictions-ingest-espn-odds-utc-spillover
-- - 21:15 UTC / 16:15 EST: daily-cron-report
--
-- Schedule floor
-- - Daily report should run after the final scheduled data job.
-- - Current intended final data job: 21:10 UTC / 16:10 EST game-predictions-ingest-espn-odds-utc-spillover.
-- - Current intended report job: 21:15 UTC / 16:15 EST daily-cron-report.
-- - Direct NST cron starts should keep at least 15 minutes of separation where possible.
--
-- Gap notes
-- - update-stats-job and update-line-combinations-job are interval jobs and are not part of the daily floor cluster.
-- - update-power-rankings and update-start-chart-projections are intentionally inactive until replacement routes are available.
----------------------------------------------------------------------------------

  ----------------------------------------------------------------------------------
-- NHL Game Prediction Model Pipeline
----------------------------------------------------------------------------------
--
-- Goal: keep each Supabase HTTP GET beneath the Vercel 4m30s ceiling by
-- sequencing small prediction windows instead of running a full slate/backtest
-- in one request. Each prediction request defaults to a 240s internal deadline
-- and should normally finish much faster because it is capped by `limit`.
--
-- Live daily forecast snapshots:
--   11:34 UTC: /api/v1/game-predictions/ingest-espn-odds?fromOffsetDays=0&toOffsetDays=7&maxDates=8
--   17:34 UTC: /api/v1/game-predictions/ingest-espn-odds?fromOffsetDays=0&toOffsetDays=1&maxDates=2
--   21:10 UTC: /api/v1/game-predictions/ingest-espn-odds?fromOffsetDays=-1&toOffsetDays=1&maxDates=3
--   11:35 UTC: /api/v1/game-predictions/forecast?fromOffsetDays=7&toOffsetDays=7&limit=16&maxRuntimeMs=240000
--   11:36 UTC: /api/v1/game-predictions/forecast?fromOffsetDays=3&toOffsetDays=3&limit=16&maxRuntimeMs=240000
--   11:37 UTC: /api/v1/game-predictions/forecast?fromOffsetDays=1&toOffsetDays=1&limit=16&maxRuntimeMs=240000
--   11:38 UTC: /api/v1/game-predictions/forecast?fromOffsetDays=0&toOffsetDays=0&limit=16&maxRuntimeMs=240000
--
-- The odds captures are intentionally repeated because ESPN market availability
-- can change between morning and pregame. Post-start captures still write only
-- rejected source provenance, not model-eligible market snapshots.
--
-- These four prediction snapshots are intentionally separate. The repeated prediction
-- rows for a given game become the candlestick source: open, low, high, and
-- final pregame probability. The `sourceAsOfDate` defaults to the request day,
-- so future-game features are cut off at what was knowable when the cron ran.
--
-- Post-result scoring:
--   11:40 UTC: /api/v1/game-predictions/score?startDate={yesterday}&endDate={today}
--
-- Activation SQL now lives in the chronological floor-cluster itinerary below
-- at 11:34, 11:35, 11:36, 11:37, 11:38, 11:40, 17:34, and
-- 21:10 UTC so odds capture, forecast snapshots, and score pass sit beside
-- the rest of the daily schedule.
--
-- Research blind replay / accountability backfill:
--   /api/v1/game-predictions/backtest?seasonId=20252026&trainStartDate=2025-10-07&blindDate=2025-12-31&replayEndDate=2026-04-15&horizonDays=7,3,1,0&maxSimulationDays=3&persist=false
--
-- For the full blind replay, increase `maxSimulationDays` gradually or omit it
-- when running outside the Vercel timeout budget. The route trains on
-- 2025-10-07 through 2025-12-31, then simulates each date forward: it predicts
-- future games from the configured horizons, records the outcome once the
-- simulated date passes the game date, retrains, and continues.
--
-- Use `persist=true` only after a dry run returns expected counts and accuracy
-- behavior. Persisted backtests write aggregate candlestick rows to
-- game_prediction_accountability_games and daily accuracy rows to
-- game_prediction_accountability_daily.
----------------------------------------------------------------------------------

----------------------------------------------------------------------------------
-- Player Underlying Stats Freshness
----------------------------------------------------------------------------------
--
-- Recommended primary path: invoke the dedicated one-game ingest route as soon as
-- your Supabase game-end trigger determines a game is final. This keeps the work
-- bounded to one game, refreshes raw gamecenter inputs plus per-game player
-- underlying summary snapshots, and is the safest way to stay under the 4m30s
-- timeout budget.
--
-- Route:
--   https://fhfhockey.com/api/v1/db/update-player-underlying-stats?gameId={gameId}
--
-- Preferred trigger implementation: keep the existing line-combo webhook intact
-- and add a second trigger on public."lineCombinations" that only fires on the
-- home-team row. Because lineCombinations stores exactly two rows per game
-- (home + away), this guard guarantees one underlying-stats refresh per game.
--
-- CREATE OR REPLACE FUNCTION public.on_new_player_underlying_stats()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- AS $$
-- DECLARE
--   url TEXT := 'https://fhfhockey.com/api/v1/db/update-player-underlying-stats';
--   headers JSONB := '{"Content-Type": "application/json", "Authorization": "Bearer <CRON_SECRET>"}'::jsonb;
--   home_team_id INTEGER;
-- BEGIN
--   SELECT "homeTeamId"
--   INTO home_team_id
--   FROM public."games"
--   WHERE id = NEW."gameId";
--
--   IF home_team_id IS NULL THEN
--     RETURN NEW;
--   END IF;
--
--   IF NEW."teamId" <> home_team_id THEN
--     RETURN NEW;
--   END IF;
--
--   PERFORM net.http_post(
--     url := url || '?gameId=' || NEW."gameId"::TEXT || '&warmLandingCache=true',
--     headers := headers,
--     timeout_milliseconds := 270000
--   );
--
--   RETURN NEW;
-- END;
-- $$;
--
-- DROP TRIGGER IF EXISTS after_player_underlying_stats_insert ON public."lineCombinations";
--
-- CREATE TRIGGER after_player_underlying_stats_insert
-- AFTER INSERT ON public."lineCombinations"
-- FOR EACH ROW
-- EXECUTE FUNCTION public.on_new_player_underlying_stats();
--
-- Recommended safety net: one daily catch-up for yesterday's games only. This is
-- intentionally date-bounded, not full-season, so it stays within the same 4m30s
-- timeout budget and can repair any missed game-end triggers.
--
-- SELECT cron.schedule(
--   'update-player-underlying-stats-yesterday',
--   '35 9 * * *', -- 09:35 UTC / 05:35 ET
--   $$
--     SELECT net.http_get(
--       url :=
--         'https://fhfhockey.com/api/v1/db/update-player-underlying-stats?startDate=' ||
--         to_char((CURRENT_DATE - INTERVAL '1 day')::date, 'YYYY-MM-DD') ||
--         '&endDate=' ||
--         to_char((CURRENT_DATE - INTERVAL '1 day')::date, 'YYYY-MM-DD') ||
--         '&warmLandingCache=true',
--       headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--       timeout_milliseconds := 270000
--     );
--   $$
-- );
--
-- Lineup deployment percentage grid tallies:
--   Refreshes player_lineup_deployment_tallies for the current season after
--   nightly line-combination and power-play-combination repair windows.
--
-- SELECT cron.schedule(
--   'update-lineup-deployment-tallies',
--   '55 9 * * *', -- 09:55 UTC / 05:55 ET
--   $$
--     SELECT net.http_get(
--       url := 'https://fhfhockey.com/api/v1/db/update-lineup-deployment-tallies?action=current',
--       headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--       timeout_milliseconds := 270000
--     );
--   $$
-- );
--
-- New generic incremental catch-up path: when you do not want to hardcode a date
-- window, use the explicit incremental query. It checks Supabase for the latest
-- covered player-summary day, reprocesses that day as a safety overwrite, and
-- then catches up through the latest finished regular-season games in the
-- current season.
--
-- Primary incremental URL:
--   https://fhfhockey.com/api/v1/db/update-player-underlying-stats?incremental=true&warmLandingCache=true
--
-- Summary-only incremental URL:
--   https://fhfhockey.com/api/v1/db/update-player-underlying-summaries?incremental=true&warmLandingCache=true
--
-- Recommended cron shape:
-- - keep the one-game finished-game trigger as the primary freshness path
-- - keep one daily bounded or incremental safety net
-- - use the summary-only incremental URL only as a lower-frequency repair job,
--   not as the primary postgame freshness trigger

<!-- cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-player-underlying-summaries?incremental=true&warmLandingCache=true" -->


----------------------------------------------------------------------------------
-- 03:00 EST Floor Cluster And Remaining Legacy Holds
----------------------------------------------------------------------------------

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-yahoo-matchup-dates',
--     '00 8 * * *', -- 08:00 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-yahoo-weeks?game_key=nhl',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 240000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:10 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:10 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||   16 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- WORKING 1/6/26
-- SELECT cron.schedule(
--     'update-nst-gamelog',
--     '10 8 * * *', -- 08:10 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-gamelog',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:01 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:01 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-skaters',
--     '01 8 * * *', -- 08:01 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-wgo-skaters?action=all',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:02 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:02 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-goalies',
--     '02 8 * * *', -- 08:02 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-wgo-goalies?action=all',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:04 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:04 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-skater-totals',
--     '04 8 * * *', -- 08:04 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-wgo-totals?season=current',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- STATUS: 404 NOT FOUND
-- SELECT cron.schedule(
--     'update-shift-charts',
--     '45 7 * * *', -- 07:45 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-shifts?action=all',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-rolling-player-averages',
--     '15 8 * * *', -- 08:15 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-rolling-player-averages',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:06 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:06 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-player-unified-matview',
--     '06 8 * * *', -- 08:06 UTC
--     'REFRESH MATERIALIZED VIEW player_stats_unified;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:07 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:07 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-power-play-timeframes',
--     '07 8 * * *', -- 08:07 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/powerPlayTimeFrame?gameId=all',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:08 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:08 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-line-combinations-all',
--     '08 8 * * *', -- 08:08 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-line-combinations',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

-- SELECT cron.schedule(
--     'update-power-play-combinations',
--     '05 8 * * *', -- 08:05 UTC
--     $$
--         SELECT net.http_get(
--             url :=
--               'https://fhfhockey.com/api/v1/db/update-power-play-combinations?startDate=' ||
--               to_char((CURRENT_DATE - INTERVAL '2 days')::date, 'YYYY-MM-DD') ||
--               '&endDate=' ||
--               to_char(CURRENT_DATE::date, 'YYYY-MM-DD'),
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:09 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:09 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    1 URL    |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-yearly-summary',
--     '09 8 * * *', -- 08:09 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-yearly-summary',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    4 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-tables-all',
--     '30 8 * * *', -- 08:30 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/Teams/nst-team-stats?date=all',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:12 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:12 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-standings-details',
--     '12 8 * * *', -- 08:12 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-standings-details?date=all',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:14 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:14 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-goalie-totals',
--     '14 8 * * *', -- 08:14 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-wgo-goalie-totals',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-game-goal-projections',
--     '15 8 * * *', -- 08:15 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-game-goal-projections?date=all',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||   10 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-goalies',
--     '45 8 * * *', -- 08:45 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-goalies',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:17 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:17 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-yahoo-players',
--     '17 8 * * *', -- 08:17 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-yahoo-players?gameId=465',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    4 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-current-season',
--     '15 9 * * *', -- 09:15 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-current-season',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-wigo-table-stats',
--     '50 8 * * *', -- 08:50 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/calculate-wigo-stats',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'sync-yahoo-players-to-sheet',
--     '55 8 * * *', -- 08:55 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/internal/sync-yahoo-players-to-sheet?gameId=465',
--             headers := '{"Authorization":"Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-rolling-player-averages',
--     '15 8 * * *', -- 08:15 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/update-rolling-player-averages',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-goalie-unified-matview',
--     '05 9 * * *', -- 09:05 UTC
--     'REFRESH MATERIALIZED VIEW goalie_stats_unified;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:10 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:10 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-ctpi-daily',
--     '10 10 * * *', -- 10:10 UTC; WGO 09:35 and NST 09:55 must finish first
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-ctpi-daily',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:11 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:11 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-sos',
--     '11 9 * * *', -- 09:11 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-sos',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 240000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-power-ratings',
--     '15 10 * * *', -- 10:15 UTC; WGO 09:35 and NST 09:55 must finish first
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-power-ratings',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:13 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:13 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- DISABLED IN PASS 3:
-- Keep this historical schedule snippet only until the legacy route stub
-- and audit artifacts are fully retired.

-- SELECT cron.schedule(
--     'update-team-power-ratings-new',
--     '13 9 * * *', -- 09:13 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-power-ratings-new',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:25 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:25 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nhl-edge-stats',
--     '25 9 * * *', -- 09:25 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nhl-edge-stats?action=all&limit=1000&concurrency=8',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-goalie-projections-v2',
--     '30 9 * * *', -- 09:30 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/update-goalie-projections-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:14 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:14 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-wgo-teams',
--     '14 9 * * *', -- 09:14 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/run-fetch-wgo-data',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- RETIRED IN PASS 3:
-- `update-start-chart-projections` was removed after `/api/v1/start-chart`
-- and the other surviving skater readers were moved to canonical
-- `forge_player_projections`. There is no replacement cron job because the
-- legacy `player_projections` materializer no longer has live readers.

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'ingest-projection-inputs',
--     '45 9 * * *', -- 09:45 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/ingest-projection-inputs',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- 09:50 UTC (after rolling averages + goalie starts)
-- SELECT cron.schedule(
--     'build-forge-derived-v2',
--     '50 9 * * *', -- 09:50 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/build-projection-derived-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:51 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:51 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- Daily xG feature refresh. This uses bounded incremental backfill selection:
-- it only selects past games that have normalized NHL API PBP rows and do not
-- already have persisted xG shot-feature rows for the configured version.
-- SELECT cron.schedule(
--     'update-nhl-xg-shot-features',
--     '51 9 * * *', -- 09:51 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nhl-xg-shot-features?backfill=true&featureVersion=1&parserVersion=1&strengthVersion=1&limit=25&gameBatchSize=1&upsertBatchSize=500',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:52 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:52 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- Daily xG prediction refresh. This depends on `NHL_XG_MODEL_ARTIFACT_PATH`
-- being configured in the deployed environment; do not pass local artifact
-- paths through production cron URLs.
-- SELECT cron.schedule(
--     'update-nhl-xg-shot-predictions',
--     '52 9 * * *', -- 09:52 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nhl-xg-shot-predictions?backfill=true&featureVersion=1&predictionType=shot_goal&limit=3000&upsertBatchSize=500',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    8 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-team-daily',
--     '55 9 * * *', -- 09:55 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-team-daily',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-matview',
--     '0 10 * * *', -- 10:00 UTC
--     'REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- 10:05 UTC (after derived tables are built)
-- SELECT cron.schedule(
--     'run-forge-projection-v2',
--     '05 10 * * *', -- 10:05 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/run-projection-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

-- 10:12 UTC option-A weekly owner (approved 2026-07-11; ACTIVE as job 393):
-- - runs after the daily writer's 4m30s ceiling plus buffer
-- - owns only genuine horizon-5 output
-- - uses a separate run id on the same as-of date
-- - must use a Vault-backed Authorization header
-- - jobs 308 and 393 are active and use the canonical Vault lookup after the
--   value-free 2026-07-14 rotation/conversion gate
-- - the commented SQL below is reference-only; production job 393 already exists
--
-- SELECT cron.schedule(
--   'run-forge-projection-v2-weekly',
--   '12 10 * * *',
--   $$
--     SELECT net.http_post(
--       url := 'https://fhfhockey.com/api/v1/db/run-projection-v2?horizonGames=5',
--       body := '{}'::jsonb,
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || (
--           SELECT decrypted_secret FROM vault.decrypted_secrets
--           WHERE name = 'cron_secret'
--         ),
--         'Content-Type', 'application/json'
--       ),
--       timeout_milliseconds := 300000
--     );
--   $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--   'refresh-team-power-ratings-daily',
--   '15 10 * * *', -- 10:15 UTC
--   $$
--     WITH s AS (
--       SELECT *
--       FROM public.seasons
--       ORDER BY id DESC
--       LIMIT 1
--     )
--     SELECT public.refresh_team_power_ratings(
--       (SELECT startDate FROM s),
--       LEAST(
--         (now() AT TIME ZONE 'America/New_York')::date,
--         (SELECT regularSeasonEndDate FROM s)
--       )
--     );
--   $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:20 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:20 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-season-stats-current-season',
--     '20 10 * * *', -- 10:20 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-season-stats',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:25 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:25 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- DISABLED IN PASS 3:
-- Keep this historical schedule snippet only until the legacy route stub
-- and audit artifacts are fully retired.

-- SELECT cron.schedule(
--     'update-rolling-games-recent',
--     '25 10 * * *', -- 10:25 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-rolling-games?date=recent',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-sko-stats-full-season',
--     '30 10 * * *', -- 10:30 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-sko-stats',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:35 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:35 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-wgo-averages',
--     '35 10 * * *', -- 10:35 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-wgo-averages',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-player-totals-unified-matview',
--     '40 10 * * *', -- 10:40 UTC
--     'REFRESH MATERIALIZED VIEW player_totals_unified;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:42 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:42 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-baselines',
--     '42 10 * * *', -- 10:42 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/sustainability/rebuild-baselines',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:43 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:43 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-priors',
--     '43 10 * * *', -- 10:43 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-priors?season=current',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:44 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:44 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-window-z-batch-000',
--     '44 10 * * *', -- 10:44 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-window-z?season=current&offset=0&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-window-z-batch-250',
--     '45 10 * * *', -- 10:45 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-window-z?season=current&offset=250&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:46 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:46 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-window-z-batch-500',
--     '46 10 * * *', -- 10:46 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-window-z?season=current&offset=500&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:47 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:47 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-window-z-batch-750',
--     '47 10 * * *', -- 10:47 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-window-z?season=current&offset=750&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:48 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:48 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-score-batch-000',
--     '48 10 * * *', -- 10:48 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-score?season=current&offset=0&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:49 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:49 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-score-batch-250',
--     '49 10 * * *', -- 10:49 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-score?season=current&offset=250&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-score-batch-500',
--     '50 10 * * *', -- 10:50 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-score?season=current&offset=500&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:51 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:51 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-score-batch-750',
--     '51 10 * * *', -- 10:51 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-score?season=current&offset=750&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:52 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:52 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-trend-bands-batch-000',
--     '52 10 * * *', -- 10:52 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-trend-bands?offset=0&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:53 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:53 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-trend-bands-batch-250',
--     '53 10 * * *', -- 10:53 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-trend-bands?offset=250&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:54 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:54 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-trend-bands-batch-500',
--     '54 10 * * *', -- 10:54 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-trend-bands?offset=500&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-trend-bands-batch-750',
--     '55 10 * * *', -- 10:55 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-trend-bands?offset=750&limit=250',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:56 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:56 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-predictions-sko',
--     '56 10 * * *', -- 10:56 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/ml/update-predictions-sko',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- DISABLED IN PASS 3:
-- Keep this historical schedule snippet only until the legacy route stub
-- and audit artifacts are fully retired.

-- SELECT cron.schedule(
--     'update-power-rankings',
--     '00 11 * * *', -- 11:00 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-power-rankings',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-team-daily-incremental',
--     '05 11 * * *', -- 11:05 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-team-daily',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:20 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:20 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-team-stats-all',
--     '20 11 * * *', -- 11:20 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/Teams/nst-team-stats',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'run-projection-accuracy',
--     '30 11 * * *', -- 11:30 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/run-projection-accuracy?projectionOffsetDays=0',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:34 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:34 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- Pregame market snapshot capture for current-through-seven-day prediction windows.
-- SELECT cron.schedule(
--     'game-predictions-ingest-espn-odds-h0-h7',
--     '34 11 * * *', -- 11:34 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/game-predictions/ingest-espn-odds?fromOffsetDays=0&toOffsetDays=7&maxDates=8',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 270000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:35 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:35 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- Forecast candlestick pass 1/4: seven-day horizon snapshot.
-- SELECT cron.schedule(
--     'game-predictions-forecast-h7',
--     '35 11 * * *', -- 11:35 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/game-predictions/forecast?fromOffsetDays=7&toOffsetDays=7&limit=16&maxRuntimeMs=240000',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 270000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:36 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:36 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- Forecast candlestick pass 2/4: three-day horizon snapshot.
-- SELECT cron.schedule(
--     'game-predictions-forecast-h3',
--     '36 11 * * *', -- 11:36 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/game-predictions/forecast?fromOffsetDays=3&toOffsetDays=3&limit=16&maxRuntimeMs=240000',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 270000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:37 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:37 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- Forecast candlestick pass 3/4: one-day horizon snapshot.
-- SELECT cron.schedule(
--     'game-predictions-forecast-h1',
--     '37 11 * * *', -- 11:37 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/game-predictions/forecast?fromOffsetDays=1&toOffsetDays=1&limit=16&maxRuntimeMs=240000',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 270000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:38 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:38 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- Forecast candlestick pass 4/4: same-day final pregame snapshot.
-- SELECT cron.schedule(
--     'game-predictions-forecast-h0',
--     '38 11 * * *', -- 11:38 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/game-predictions/forecast?fromOffsetDays=0&toOffsetDays=0&limit=16&maxRuntimeMs=240000',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 270000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- Post-result scoring pass for the most recent finished window.
-- SELECT cron.schedule(
--     'game-predictions-score-recent',
--     '40 11 * * *', -- 11:40 UTC
--     $$
--         SELECT net.http_get(
--             url :=
--                 'https://fhfhockey.com/api/v1/game-predictions/score?startDate=' ||
--                 to_char((CURRENT_DATE - INTERVAL '1 day')::date, 'YYYY-MM-DD') ||
--                 '&endDate=' ||
--                 to_char(CURRENT_DATE::date, 'YYYY-MM-DD'),
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 270000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  17:34 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  12:34 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- Afternoon same-day market snapshot capture for nearer pregame odds.
-- SELECT cron.schedule(
--     'game-predictions-ingest-espn-odds-h0-h1',
--     '34 17 * * *', -- 17:34 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/game-predictions/ingest-espn-odds?fromOffsetDays=0&toOffsetDays=1&maxDates=2',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 270000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  20:51 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  15:51 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- ACTIVE FINAL DATA JOB
-- SELECT cron.schedule(
--     'update-pbp',
--     '51 20 * * *', -- 20:51 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-PbP?gameId=recent',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  21:10 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  16:10 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- Late pregame market snapshot capture with UTC/ET date-spillover coverage.
-- SELECT cron.schedule(
--     'game-predictions-ingest-espn-odds-utc-spillover',
--     '10 21 * * *', -- 21:10 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/game-predictions/ingest-espn-odds?fromOffsetDays=-1&toOffsetDays=1&maxDates=3',
--             headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 270000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  21:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  16:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-cron-report',
--     '15 21 * * *', -- 21:15 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/cron-report',
--             headers := '{"Authorization":"Bearer <CRON_SECRET>"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- NEED TO ADD
--
-- A-FORGE-DASH production activation patch (applied 2026-07-11; retained as history):
--
-- 1. Deploy the local CTPI/team-power pagination/lookback changes and the
--    audited update-player-trend-metrics POST route.
-- 2. Run one bounded manual probe of each deployed writer and inspect
--    cron_job_audit plus source-date/non-flat output before enabling schedules.
-- 3. Apply the dependency-order changes only after the probes pass:
--
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'update-team-ctpi-daily'),
--   schedule := '10 10 * * *'
-- );
--
-- SELECT cron.alter_job(
--   job_id := (SELECT jobid FROM cron.job WHERE jobname = 'update-team-power-ratings'),
--   schedule := '15 10 * * *'
-- );
--
-- SELECT cron.schedule(
--   'update-player-trend-metrics',
--   '0 12 * * *',
--   $$
--     SELECT net.http_post(
--       url := 'https://fhfhockey.com/api/v1/db/update-player-trend-metrics',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || (
--           SELECT decrypted_secret
--           FROM vault.decrypted_secrets
--           WHERE name = 'cron_secret'
--         ),
--         'Content-Type', 'application/json'
--       ),
--       body := '{}'::jsonb,
--       timeout_milliseconds := 300000
--     );
--   $$
-- );
--
-- Post-activation evidence recorded 2026-07-11:
-- - WGO 09:35 and NST 09:55 finish before CTPI 10:10 and power 10:15.
-- - current `/api/team-ratings` has 32 rows and more than one `trend10` value.
-- - bounded player-trend audit succeeded in 17.33s; offseason window had zero eligible writes.
-- - player-trends/skater-power resolve to latest eligible 2026-05-09 and truthfully block a 64-day fallback.
--
-- Other static dashboard-critical URLs that are not currently scheduled above:
--
-- Core FORGE preflight inputs:
-- - https://fhfhockey.com/api/v1/db/update-seasons
-- - https://fhfhockey.com/api/v1/db/update-teams
-- - https://fhfhockey.com/api/v1/db/update-games
-- - https://fhfhockey.com/api/v1/db/update-players
--
-- Dashboard trend refresh compatibility reader/manual rebuild route:
-- - https://fhfhockey.com/api/v1/trends/player-trends
--
-- Notes:
-- - Sustainability rebuild follow-ups and player_totals_unified refresh are now
--   scheduled above using static cron-safe defaults.

----------------------------------------------------------------------------------
-- Vercel cron safety net (web/vercel.json)
--
-- These jobs cover dashboard-critical FORGE freshness outside Supabase pg_cron.
-- Keep long sustainability rebuilds chunked by offset so each invocation stays
-- under the Vercel function maxDuration.
--
-- 10:05 UTC: run rolling FORGE pipeline, downstream projections included.
-- 10:42 UTC: rebuild sustainability priors with limit=2000.
-- 10:43/10:48/10:53 UTC: rebuild sustainability window-z offsets 0/250/500.
-- 11:00/11:06/11:12 UTC: rebuild sustainability scores offsets 0/250/500.
-- 11:18/11:23/11:28/11:33 UTC: rebuild sustainability trend bands offsets 0/250/500/750.
-- 11:34/17:34/21:10 UTC: capture ESPN market odds snapshots for upcoming NHL predictions.
-- 11:45 UTC: refresh roster-adjusted game predictions.
-- 13:00 UTC: run cron-report.
