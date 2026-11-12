# Goalie summary rebuild, 2026-27 regular season (decision 111): verified run plan

Status: RUN 2026-11-12 15:01:50Z–15:08:54Z with TJ's pop-up approval ("Run as planned"). Results below.

## Preconditions (verified 2026-11-12 ~14:58Z)
- **Release READY:** fhfhockey `dpl_137qFEpUhovkj9Q6NaPbD4jAHNzP` at master `631a00c19`. That is PR #430, and its tree equals candidate `27edf8381`. The other three projects cancelled, as expected.
- **Inventory:** 44 dates, 2026-09-29 to 2026-11-11. That covers 298 games, all `type = 2`, with 0 other game types on those dates.
  - Left out: the preseason dates 2026-09-25/26 (18 type-1 games) and 2026-11-12, which hasn't finished.
- **Source data:** all 298 games have stored `nhl_api_pbp_events` and `nhl_api_shift_rows`.
- **Current state:** 93 games have goalie partitions (743 rows). None is formulaRevision 2, so the new readers serve none of them. The other 205 games have no goalie partitions.
- **No conflicting writer:**
  - No pg_cron job, `web/vercel.json` cron or GitHub workflow calls a goalie summary route.
  - The table's last write was 2026-11-09 22:00Z, with 0 writes in the last 24 h.
  - Codex lanes work locally only.
  - Database: 0 active queries.
  - TJ: please don't run goalie `/db` routes while this runs.

## Route (summary-only)
`GET https://fhfhockey.com/api/v1/db/update-goalie-underlying-summaries?seasonId=20262027&gameType=2&startDate=D&endDate=D`
- **Date-range mode:** `preferSharedSnapshotSeed = false`. Every game in the range is rebuilt from the stored PBP events and shift rows.
- **No provider calls:** no NHL, NST or Yahoo request. There's no raw-ingest step; that step belongs to `backfill-goalie-underlying-season`, which isn't used.
- **What it writes:** only `goalie_underlying_summary_partitions`, by upsert on `(game_id, strength, score_state)`, with no deletes. Expect about 8 rows per game, roughly 2,400 in total.
- **Cache warming:** off on every daily call; `shouldWarmLandingCache` is false in date-range mode without the flag. It warms once, on the final call only (2026-11-11 with `&warmLandingCache=true`).
- **Auth:** Bearer `CRON_SECRET`, read from `web/.env.local` inside the script and never printed or logged.

## Load bounds
- Sequential, concurrency 1, one date per request: at most 44 requests, plus at most 1 retry per date and per-game splits (below). There's a 5 s pause between calls.
- **First call is the smallest day** (2026-09-30, 3 games), to measure the cost per game.
- **Large days are split:** if the measured seconds per game × a day's games would exceed 150 s, that day runs as single-game calls (`?gameId=`), still one at a time.
- **Database guard before every call:** `pg_stat_activity` must show 5 or fewer active queries and none older than 10 s; otherwise wait 60 s and check again, at most 3 times, then stop.
- **Stop at once on:**
  - a non-200 status or `success:false`;
  - a request taking more than 200 s (the route's `maxDuration` is 240 s);
  - `rowsUpserted = 0` for a date that has games;
  - a reconciliation failure.

## Partial-write reconciliation (read-only, after every call)
For that date's game ids:
1. Every game has an `allStrengths/allScores` partition, and every partition has `payload->formulaRevision >= 2`.
2. If a call failed partway, the upsert is idempotent. Rerun the same date once, or a single game by `gameId`. If it fails again, stop and report the exact games.
3. If a game keeps any partition below revision 2 (a key the new writer no longer produces), stop and list the keys. Deleting them needs a separate approval; nothing is deleted in this run.

## Final receipts
- Coverage: 298 of 298 games with revision-2 partitions; 0 revision-1 partitions left for 2026-27, or each one listed.
- One cached GET to `/api/v1/underlying-stats/goalies?seasonId=20262027`, which counts against the release smoke budget: more than 0 rows, and no "Recalculating" pending status.
- Total requests, total duration, and rows upserted per date, logged in the Chef diary.

## Not in this run
2025-26 (1,312 regular-season and 105 playoff games, 10,356 rev-1 partitions) gets its own pop-up. So do the player and shared summary rebuild, and the team rebuild.

## Results (2026-11-12)
- **Requests:** 44 date calls, all HTTP 200 with `success:true`. Durations ran from 1 to 8 s (173 s in total), so no day needed per-game splits. There were 0 retries and 0 DB-guard waits. The first call (2026-09-30, 3 games) took 6.1 s.
- **Rows upserted: 14,094 partitions**, about 47 per game. The plan estimated about 2,400 (8 per game, from the old writer). The new writer stores every strength × score-state partition for each goalie game, all within the plan's single target table.
- **Reconciliation after every call:** every game had all partitions at formulaRevision 2 and an `allStrengths/allScores` partition.
- **Final coverage, season 20262027:** 298 games, 14,094 partitions, 0 below revision 2. The 93 previously stored games were fully overwritten.
- **Cache warm:** once, on the final call (2026-11-11, `warmLandingCache=true`, 3.5 s).
- **Landing check (smoke GET 1 of 5):** `GET /api/v1/underlying-stats/goalies` returned 200 in 0.45 s, with 75 goalies over 2 pages and no `summaryStatus` pending. The first row was Adin Hill: 9 GP, SV% .911, GSAA +1.39.
- **Untouched:** no NHL, NST or Yahoo calls, no deletes, and no other table written.
