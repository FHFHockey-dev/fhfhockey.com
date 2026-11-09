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

## Probe results, 2026-11-09 15:00 UTC

Approved by TJ by pop-up. Week 2026-10-12→18 of 2026-27, 50 games. Live routes after #423 (a5816ce6d).

| Entity | Route | Time | Rows | Readback |
|---|---|---|---|---|
| Team | `rebuild-team-underlying-summaries` dry run | 22 s | 7,000 generated, 0 stale | — |
| Team | the same route with `dryRun=false` | 40 s | 7,000 upserted | 7,000 rows / 50 games. Before: 4,760 rows on 34 games, so 16 games were missing. |
| Goalie | `update-goalie-underlying-summaries` date_range | 33 s | 399 | 399 rows / 50 games. None existed before. |
| Player | `update-player-underlying-summaries` date_range | **504 at 240 s** | 400 of about 1,400 inserted | Partial: 14 games complete (28 partitions each); game 2026020101 has 8 of 28 partitions new. Readers take the newest row per partition `source_url`, so each partition stays internally consistent. |

Peak DB conns during the probes: 13–14.

### Why the player probe failed

- The build took about 30 s. Four upsert statements of 100 rows each landed at 15:03:31–35.
- The fifth hit a statement timeout (PostgREST 504 at 15:03:42). The function then hung until Vercel's 240 s cutoff.
- Each row is about 37 kB (the individual and onIce partitions), so each statement carries about 3.7 MB, and every row fires per-row triggers (`projection-game` advisory lock, snapshot-head advance).
- From 15:03:42 to 15:05:09, unrelated API calls also returned 504/522 (players, forge_runs, line_source events).
- But statement timeouts on `wgo_skater_stats` started earlier (14:56, 15:02:32), so the database was already marginal; the probe is not the only cause.
- No other payload writers were active in the window.
- The database recovered by 15:07: 0 5xx errors, 28 conns, no lock waits.

### Rollback correction

`nhl_api_game_payloads_raw` is **immutable**: BEFORE DELETE and BEFORE UPDATE triggers raise an exception. The probe pop-up offered "delete player rows with fetched_at ≥ run start", and that rollback is **not possible**.

A real rollback would be to re-insert the backed-up previous payloads. The insert trigger lets a game revert to an earlier identity by moving its snapshot head back. That is untested.

The team and goalie rollbacks (CSV reload) are unaffected.

## Full both-season rebuild plan (not started; needs TJ's go)

**Guards on every call:**
- Check conns before the call and stop if they are over 40.
- 21 s gap between calls; never run in 08:25–10:05 UTC.
- Stop on any non-2xx, or on any `statement timeout` in postgres_logs since the previous call (checked through the logs API).
- No NST and no external API calls.

| Entity | Calls | Est. runtime | Backup | Rollback |
|---|---|---|---|---|
| Team (rebuild route, `gameType`=2 then 3) | 2025-26: about 27 regular + 9 playoff one-week windows. 2026-27: 6. About 42 in all, each ≤ 120 games. | about 42 × (40 s + 21 s) ≈ **45 min** | Chunked CSV of each season (183,680 + 34,580 rows) | Delete the rows for the rebuilt games, then reload the CSV. Stale keys are listed per call; delete those only by exact key, after a backup. |
| Goalie (date_range) | the same 42 windows | about 42 × (33 s + 21 s) ≈ **40 min** | CSV of 2025-26 (9,725 rows); 2026-27 is new | Delete the rebuilt games' rows, then reload the CSV |
| Player (date_range) | **Not runnable as is.** Needs either 1-day windows (about 270 calls, ≈ **2.7 h**, about 4 statements of 3.7 MB each per call) or, preferably, a small code change: `upsertSummarySnapshots` batches of 25 rows instead of 100 (keep one-week windows: about 42 calls, about 1 h). | see the previous column | None possible to delete. The previous payloads are already kept, and the CSV holds them. | Re-insert the previous payloads (untested) |

**Order:** team, then goalie, then player, after the player batch fix ships. Total about 2.5 h over one or two sessions.

## Progress, 2026-11-09

All runs approved by TJ by pop-up.

**Diagnosis of the 15:03 and 15:27 incidents (Chef, edge logs).**
- 15:03–15:06: the player probe's ~3.7 MB upserts stalled the API. Fixed by 25-row statements (be71f5802, #425).
- 15:11 and 15:23–15:24: Next.js build prerender storms from the #424/#425 releases collided with team windows 2–3, and the 503 burst followed at 15:27.
- The id tiebreak was not the cause, and neither was P3.
- 14:56: a minor blip, unexplained. The wgo_skater_stats statement timeouts recur (14:56, 15:02, 20:21, 20:22) independently of this work.

**Team.** Windows 1–25 are done (2025-10-07→2026-03-30): 1,177 games, 164,780 rows, every count exact, 0 stale keys. Stops:
- After window 24: a line_source_snapshots 500 and timeout, not from this route.
- After window 25: wgo_skater_stats timeouts.
- The 21:00 UTC cutoff.

**Remaining.**

| Entity | Windows left | Calls | Time at the slow pace |
|---|---|---|---|
| Team | 26–28 (2026-03-31→04-16) and 29–34 (all of 2026-27) | 9 | about 18 min |
| Goalie | 1–34 | 34 | about 70 min |
| Player | — | — | Waits for the #425 release and a rollback decision (re-insert old payloads, tested locally, or TJ accepting forward-only). |

**Suggestion.** The wgo_skater_stats timeouts are background noise. Scope the stop rule to errors on this route's own paths (`nhl_api_game_payloads_raw`, `nhl_api_shift_rows`, `nhl_api_pbp_events`, `team_underlying_stats_summary`, `goalie_underlying_summary_partitions`), plus any site-wide 5xx burst of 5 or more in a minute. That is TJ's call.

## Status, 2026-11-09 22:01 UTC

**Fixed before resuming.** The official-payload reads downloaded every derived copy, 156 MB for one week, to keep the 1.8 MB of official payloads. They now exclude derived rows in the query (0a438aa9b, #426). Calls fell from 30–78 s to 8–28 s.

| Entity | Done | Rows | Remaining |
|---|---|---|---|
| Team | **Complete**: 34/34 windows, 1,594 games | 223,160 (183,680 + 39,480), 0 stale | — |
| Goalie | Windows 1–29: all of 2025-26 (1,312 games) and the first 2026-27 week | 10,356 for 2025-26 | Windows 30–34, the rest of 2026-27 (about 5 calls, ~10 min) |
| Player | Not started | — | Waits for the rollback design |
