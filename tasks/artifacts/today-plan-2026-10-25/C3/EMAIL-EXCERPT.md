# Daily Cron Briefing excerpt (supplied by TJ in chat, 2026-10-25)

Window 10/24/2026 9:00:48 AM EDT – 10/25/2026 9:00:48 AM EDT. Only the four C3 failures are kept; text is verbatim.

| # | Job / route | Time (EDT) | Error text | Elapsed | Last success |
|---|---|---|---|---|---|
| a | update-wigo-table-stats · `GET /api/v1/db/calculate-wigo-stats` | 10/25 4:50:01 AM | Invalid or duplicate regular-season NHL appearance for player 8476368. | <1s | Unknown in lookback |
| b | `POST /api/v1/db/update-player-underlying-stats?gameId=2026020179&warmLandingCache=true` · 6 failures | 10/25 6:10:38 AM | Player underlying stats ingest failed for every requested game. Evidence: game: 2026020179 \| NHL_NORMALIZATION_WRITER_BUSY; game: 2026020171 \| NHL_NORMALIZATION_WRITER_BUSY | 2s | Unknown in lookback |
| c | run-projection-accuracy · `POST /api/v1/db/run-projection-accuracy?projectionOffsetDays=0` | 10/25 7:30:16 AM | Latest succeeded projection run is excluded from calibration because native input provenance is missing or legacy. | 15s | 10/24 7:30:14 AM (unverified) |
| d | `/api/v1/db/forge-served-forecast-snapshot` | 10/25 8:32:40 AM | Planning read deadline exceeded | 2m 20s | 10/24 8:30:23 AM (unverified) |

Briefing footer: the success-history lookup was incomplete ("Source query deadline exceeded; totals unknown"), so every "last success" above is unverified.
