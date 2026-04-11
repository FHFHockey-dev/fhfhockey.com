# Goalie Underlying Stats Runbook

## TL;DR

The goalie underlying pipeline now has its own dedicated persisted summary table and admin refresh routes.

It still reuses the shared raw Gamecenter ingest tables and the same aggregation math, but goalie summary persistence is now bespoke:

- raw ingest tables:
  - `games`
  - `nhl_api_game_payloads_raw`
  - `nhl_api_pbp_events`
  - `nhl_api_shift_rows`
  - `nhl_api_game_roster_spots`
- skater actuals tables:
  - `wgo_skater_stats`
  - `wgo_skater_stats_totals`
  - `wgo_skater_stats_playoffs`
  - `wgo_skater_stats_totals_playoffs`
  - `wgo_skater_stats_totals_ly`
- note:
  - these `wgo_*` skater tables are not the canonical underlying-stats storage tables
  - they belong to the separate WGO skater actuals / totals system
- dedicated goalie underlying summary storage:
  - `goalie_underlying_summary_partitions`
- canonical goalie writer routes:
  - `/api/v1/db/update-goalie-underlying-stats`
  - `/api/v1/db/update-goalie-underlying-summaries`
- canonical goalie read routes:
  - `/api/v1/underlying-stats/goalies`
  - `/api/v1/underlying-stats/goalies/{playerId}`
  - `/api/v1/underlying-stats/goalies/{playerId}/chart`

Operational rule:

- if the goalie underlying landing or detail page is stale or wrong, use the goalie-specific refresh routes first
- current goalie read routes still delegate through the shared aggregation engine, so the dedicated goalie table is an operator-facing persistence layer rather than the sole read source today

## Localhost Auth And Timeout

When you are running the Next app locally on `localhost:3000`, these admin routes do not require a Bearer token.

Why:

- `web/utils/adminOnlyMiddleware.ts` allows local-dev requests when `NODE_ENV !== production` and the request host is `localhost`, `127.0.0.1`, or `::1`

That means these work in a browser tab locally with no `CRON_SECRET` header:

- `http://localhost:3000/api/v1/db/backfill-player-underlying-season?seasonId=20252026`
- `http://localhost:3000/api/v1/db/backfill-goalie-underlying-season?seasonId=20252026`
- `http://localhost:3000/api/v1/db/catch-up-player-underlying?seasonId=20252026`
- `http://localhost:3000/api/v1/db/catch-up-goalie-underlying?seasonId=20252026`

Why your earlier curl stalled:

- the route was not blocked by auth
- the `curl -m 180` flag forced the client to give up after 180 seconds
- visiting the route directly in a browser avoids the client-side curl timeout

## Storage Contract

The goalie underlying surface is still a route/API namespace wrapper over the shared player-underlying aggregation engine.

- `web/lib/underlying-stats/goalieStatsServer.ts` delegates directly to `playerStatsLandingServer.ts`
- `web/lib/underlying-stats/playerStatsLandingServer.ts` builds summary rows for `onIce` and `goalies`
- `web/lib/underlying-stats/goalieStatsSummaryRefresh.ts` filters the shared `goalies` partitions and upserts them into `goalie_underlying_summary_partitions`

The shared partition rows under `derived://underlying-player-summary-v2/goalies/...` still exist as an intermediate artifact, and the current goalie read routes still resolve through the shared aggregation engine. The dedicated goalie persistence target now exists alongside that shared path:

- `goalie_underlying_summary_partitions`
- `source_url` values under `derived://underlying-goalie-summary-v1/{strength}/{scoreState}/{gameId}`

## Underlying Tables Vs WGO Tables

The earlier `wgo_skater_stats` answer was answering "what skater tables exist in the repo," not "what tables back the underlying-stats pipeline."

For the underlying-stats pipeline, the important tables are:

- `games`
- `nhl_api_game_payloads_raw`
- `nhl_api_pbp_events`
- `nhl_api_shift_rows`
- `nhl_api_game_roster_spots`
- `goalie_underlying_summary_partitions`

What each one does:

- `games` is the schedule / game catalog used to resolve game ids, dates, season ids, and game types.
- `nhl_api_game_payloads_raw` stores raw NHL Gamecenter payloads and also the shared derived summary partitions under `derived://underlying-player-summary-v2/...`.
- `nhl_api_pbp_events` stores normalized play-by-play rows.
- `nhl_api_shift_rows` stores normalized shift chart rows.
- `nhl_api_game_roster_spots` stores roster / identity context used by the shared aggregation build.
- `goalie_underlying_summary_partitions` is the dedicated goalie-only summary table you just created and applied in Supabase.

So the correct mental model is:

- `wgo_skater_stats*` tables are not the underlying-stats tables
- the shared underlying ingest and summary pipeline uses the `nhl_api_*` tables above
- the new goalie-only persistence layer is `goalie_underlying_summary_partitions`

## Population Itinerary

If your goal is "populate the new goalie-only table after the migration was applied," use this order.

### 1. Seed the new goalie table from already-built shared goalie summaries

Run this first if the shared player / goalie underlying pipeline has already been healthy, because it is the cheapest way to populate `goalie_underlying_summary_partitions`.

Browser-friendly URL:

```text
http://localhost:3000/api/v1/db/update-goalie-underlying-summaries?seasonId=20252026&backfill=true&limit=25
```

Curl form:

```bash
cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-goalie-underlying-summaries?seasonId=20252026&backfill=true&limit=25"
```
What this does:

- looks for finished games in the requested season that are not yet present in `goalie_underlying_summary_partitions`
- prefers seeding from the shared `derived://underlying-player-summary-v2/goalies/...` partitions already stored in `nhl_api_game_payloads_raw`
- upserts the goalie-only rows into `goalie_underlying_summary_partitions`

Run the same URL repeatedly until the response comes back with:

- `requestedGameCount: 0`
- `gameIds: []`

That means the dedicated goalie table is fully seeded for the current shared-summary coverage.

### 2. Catch up any missing raw coverage or newly finished games

Once the cheap summary seeding is done, run the full ingest route to cover any games that are still missing raw NHL inputs or new games that finished after the shared summaries were last built.

Browser-friendly URL:

```text
http://localhost:3000/api/v1/db/catch-up-goalie-underlying?seasonId=20252026
```

Equivalent lower-level route:

```text
http://localhost:3000/api/v1/db/update-goalie-underlying-stats?incremental=true&catchUp=true&batchSize=5&warmLandingCache=true&seasonId=20252026
```

Curl form:

```bash
cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/catch-up-goalie-underlying?seasonId=20252026"
```

What this does:

- resolves unfinished dedicated goalie coverage by checking `goalie_underlying_summary_partitions`
- fetches raw NHL Gamecenter inputs for the selected games
- rebuilds goalie-only summary rows for those successful games
- upserts the rebuilt rows into `goalie_underlying_summary_partitions`

Keep using this URL until the response comes back with either:

- `requestedGameCount: 0`
- or `catchUpCompleted: true` and no failed game ids

### 3. Use targeted full refresh for a single missing game

If you know one specific game is wrong or absent, use the one-game full ingest route instead of another broad catch-up run.

```bash
cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-goalie-underlying-stats?gameId=2025021196"
```

Use this when:

- one game is missing from the goalie table
- one game has stale goalie summary values
- you want a smoke test before a bigger batch run

### 4. Use targeted date-range full refresh when a known slice is stale

If you know the stale coverage is limited to a narrow date window, use the range form of the full route.

```bash
cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-goalie-underlying-stats?seasonId=20252026&startDate=2026-03-31&endDate=2026-04-03"
```

Use this when:

- several adjacent games are stale
- a previous run failed over a known date window
- you want to avoid re-running the whole catch-up window

### 5. Use summary-only refresh for a single game after raw data is confirmed healthy

If raw ingest tables already look correct and you only want to rebuild the goalie-only summary row set, use the summary-only route.

```bash
cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-goalie-underlying-summaries?gameId=2025021196"
```

Use this when:

- `nhl_api_game_payloads_raw`, `nhl_api_pbp_events`, and `nhl_api_shift_rows` are already correct
- the dedicated goalie table needs to be rebuilt without another raw fetch

### 6. Verify the dedicated goalie table was populated before checking the UI

The current goalie read routes still flow through the shared aggregation engine, so verifying the UI alone does not prove the dedicated goalie table was populated.

The response fields to watch on the writer routes are:

- `summaryRowsUpserted` on `/api/v1/db/update-goalie-underlying-stats`
- `rowsUpserted` on `/api/v1/db/update-goalie-underlying-summaries`
- `requestedGameCount` reaching `0` on backfill / incremental follow-up runs

After that, you can still smoke-test the shared goalie read contract with:

- `/api/v1/underlying-stats/goalies`
- `/api/v1/underlying-stats/goalies/{playerId}`
- `/api/v1/underlying-stats/goalies/{playerId}/chart`

## Recommended Order

For a newly migrated environment, the strict order should be:

1. `/api/v1/db/update-goalie-underlying-summaries?seasonId=...&backfill=true&limit=25`
2. Repeat step 1 until `requestedGameCount` is `0`
3. `/api/v1/db/update-goalie-underlying-stats?incremental=true&catchUp=true&batchSize=5&warmLandingCache=true`
4. Use one-game or date-range variants of `/api/v1/db/update-goalie-underlying-stats` only for cleanup or spot fixes
5. Use one-game `/api/v1/db/update-goalie-underlying-summaries?gameId=...` only when raw data is already healthy and you want a cheap rebuild

If you want the simplest browser URLs instead of the lower-level batch routes, use this order:

1. `http://localhost:3000/api/v1/db/backfill-goalie-underlying-season?seasonId=20252026`
2. After that finishes, `http://localhost:3000/api/v1/db/catch-up-goalie-underlying?seasonId=20252026`

And for the shared skater / player underlying pipeline, use:

1. `http://localhost:3000/api/v1/db/backfill-player-underlying-season?seasonId=20252026`
2. After that finishes, `http://localhost:3000/api/v1/db/catch-up-player-underlying?seasonId=20252026`

These new convenience routes do the looping for you instead of requiring repeated manual `backfill=true&limit=...` requests.

## Refresh Recipe

### 1. Full raw ingest plus goalie-only summary rebuild for affected game ids or date range

Single game:

```bash
cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-goalie-underlying-stats?gameId=2025021196"
```

Date range in one season:

```bash
cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-goalie-underlying-stats?seasonId=20252026&startDate=2026-03-31&endDate=2026-04-03"
```

Incremental catch-up:

```bash
cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-goalie-underlying-stats?incremental=true&warmLandingCache=true"
```

Use this first when a goalie is missing games, missing TOI, missing saves/goals-against rows, or the goalie landing/detail numbers are stale.

### 2. Summary-only rebuild when raw coverage is already correct

Single game:

```bash
cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-goalie-underlying-summaries?gameId=2025021196"
```

Backfill missing summaries for a season:

```bash
cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-goalie-underlying-summaries?seasonId=20252026&backfill=true&limit=25"
```

Incremental summary-only catch-up:

```bash
cd /Users/tim/Code/fhfhockey.com/web
set -a && source .env.local && set +a
curl -i -sS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/v1/db/update-goalie-underlying-summaries?incremental=true&warmLandingCache=true"
```

Use this only when the raw Gamecenter/shift coverage is already correct and you just need the dedicated goalie summary partitions rebuilt or reseeded.

## Verify The Goalie Read Contract

Landing query example:

```bash
curl -sS \
  "http://localhost:3000/api/v1/underlying-stats/goalies?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=allStrengths&scoreState=allScores&statMode=goalies&displayMode=rates&venue=all&tradeMode=combine&scope=none&sortKey=savePct&sortDirection=desc&page=1&pageSize=100"
```

Detail query example:

```bash
curl -sS \
  "http://localhost:3000/api/v1/underlying-stats/goalies/8477424?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=allStrengths&scoreState=allScores&statMode=goalies&displayMode=rates&venue=all&tradeMode=combine&scope=none&sortKey=seasonId&sortDirection=desc&page=1&pageSize=50"
```

Chart query example:

```bash
curl -sS \
  "http://localhost:3000/api/v1/underlying-stats/goalies/8477424/chart?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=allStrengths&scoreState=allScores&statMode=goalies&displayMode=rates&metricKey=savePct"
```

## What Is Separate From This Pipeline

These goalie tables do exist, but they are not the canonical storage path for the dedicated goalie underlying landing/detail surfaces:

- `wgo_goalie_stats`
- `wgo_goalie_stats_totals`
- `goalie_stats_unified`

Those tables belong to older goalie actuals, trend, and validation surfaces.

There are also separate goalie projection tables and writers for the projection system:

- `goalie_start_projections`
- `forge_goalie_game`
- `forge_goalie_projections`
- `/api/v1/db/update-goalie-projections-v2`

Those are not the refresh path for `/underlying-stats/goalieStats`.

## Practical Answer

If your question is “what are the skater tables, and do goalies now have their own underlying table family and writer?” the answer is:

- skater tables are `wgo_skater_stats`, `wgo_skater_stats_totals`, `wgo_skater_stats_playoffs`, `wgo_skater_stats_totals_playoffs`, and `wgo_skater_stats_totals_ly`
- dedicated goalie underlying persistence now includes `goalie_underlying_summary_partitions`
- the goalie writer endpoints are `/api/v1/db/update-goalie-underlying-stats` and `/api/v1/db/update-goalie-underlying-summaries`
- current goalie read routes still flow through the shared aggregation engine, so reader cutover is a separate follow-up if you want the bespoke table to become the only source of truth