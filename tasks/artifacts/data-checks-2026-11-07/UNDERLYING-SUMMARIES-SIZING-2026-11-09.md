# Underlying summaries rebuild sizing, 2026-11-09 (read-only, not run)

**Why.** Player, goalie and team summaries were built from `nhl_api_shift_rows` pages with no unique order, so some rows repeated and others were skipped. The shared shift reader now has a `shift_id` tiebreak (`lib/underlying-stats/playerStatsLandingServer.ts:1216-1224`, fd131d278, on master).

## Current rows

| Entity | Table | 2025-26 | 2026-27 | Write behaviour |
|---|---|---|---|---|
| Player | `nhl_api_game_payloads_raw` (endpoint `landing`, derived player-summary source) | 32,847 rows / 1,498 games / 159 MB | 13,443 rows / 295 games / 45 MB | **Additive.** Conflict `game_id,endpoint,payload_hash`, ignoreDuplicates. The payload includes `generatedAt`, so a rebuild adds new rows and readers take the newest `fetched_at`. |
| Goalie | `goalie_underlying_summary_partitions` | 9,725 rows / 1,232 games | **0 rows** | Upsert in place (`game_id,strength,score_state`). No delete. |
| Team | `team_underlying_stats_summary` | 183,680 rows / 1,312 games | 32,340 rows / 231 games | Upsert in place (`game_id,team_id,strength,score_state`). No delete. |

Shift data covers 1,394 games in 2025-26 and 309 in 2026-27.

## Routes

- **Player:** `update-player-underlying-summaries?seasonId=…&startDate=…&endDate=…`, in date_range mode. It rebuilds from raw tables and ignores `batchSize`.
- **Goalie:** the same parameters on `update-goalie-underlying-summaries`. Date_range builds full player snapshots internally, so every call reads shifts again.
- **Team:** **no route rebuilds existing games.** The backfill and `?backfill=true` routes only pick games that have no summary. A date-range parameter calling `refreshTeamUnderlyingSummaryRowsForGameIds` (`lib/underlying-stats/teamStatsSummaryRefresh.ts:1178`) would be a code change.
- **Auth:** `adminOnly(withCronJobAudit)`. **There is no dryRun parameter: every call writes.**
- **External calls:** none on the `update-*` routes; they read stored tables only. `backfill-*` and `catch-up-*` re-ingest from the NHL API first, so they should not be used. No NST anywhere.

## Fix these before any rebuild (small code change, then a release)

Other paged reads that feed these summaries still lack a unique order:

- **No order at all:**
  - `pages/api/v1/db/update-player-underlying-summaries.ts:139-154` (`fetchSeasonGameIdSet`)
  - `lib/underlying-stats/playerStatsSummaryRefresh.ts:200-212`
  - `lib/underlying-stats/goalieStatsSummaryRefresh.ts:243-249`
  - These decide which games are selected, so games can be silently missed.
- **Ordered by `game_id, fetched_at desc` only, with ties:**
  - `goalieStatsSummaryRefresh.ts:169-179`: the shared-seed read, which has heavy ties.
  - `playerStatsSummaryRefresh.ts:62-77`
  - `playerStatsLandingServer.ts:1562-1573`: the Supabase fallback; direct Postgres is tried first.
  - `teamStatsSummaryRefresh.ts:1088-1096`
- **Fix:** add `id` or the PK as the last order column, and add a team date-range or `gameIds` rebuild mode.

## Proposed run, after that fix ships

- **Batching:** sequential one-week date windows, with an activity check (≤ 40) and a 21 s gap. Stop on any non-2xx, or on a call over 200 s (the cap is 240 s).
- **Calls:**

| Entity | 2025-26 (Oct 7 to the Final) | 2026-27 (to date) |
|---|---|---|
| Player | about 36 | about 5 |
| Goalie | about 36 | about 5 |
| Team | about 36, once the route exists | about 5, once the route exists |

  That is about 120 calls in all.
- **Runtime:** **untimed.** A single one-week probe call per entity has to be timed first. Expect 2–5 h in total at 60–200 s per call plus the gap, so it spans more than one night. Avoid the 08:25–10:05 UTC cron window.
- **Rows:**

| Entity | Effect |
|---|---|
| Player | Adds about 46k rows (about 200 MB) and keeps the old ones. A later cleanup could delete the superseded rows. |
| Goalie | Rewrites about 9.7k rows. 2026-27 would be filled for the first time. |
| Team | Rewrites about 216k rows. |

- **Backup and rollback:**

| Entity | Backup | Rollback |
|---|---|---|
| Player | None needed: the run only adds rows | Delete rows with `fetched_at` ≥ the run start |
| Goalie | CSV of the season's rows | Delete the rebuilt rows and reload the CSV |
| Team | CSV of the season's rows (chunked `\copy`, 200 games per chunk; the pooler ignores statement_timeout) | Delete the rebuilt rows and reload the CSV |

- **Stale keys:** goalie and team never delete keys that a rebuild no longer produces. Compare keys per game after each call, and delete exact keys (backed up) the way the team_unit_toi run did.
- **DB load:** each one-week call reads about 50 games' events, shifts (about 50 pages), roster spots and payloads in 50-game chunks. That is similar to one team_unit_toi batch, which kept activity at 16–21.
