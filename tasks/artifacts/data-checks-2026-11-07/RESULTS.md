# Data checks after release #414 (2026-11-07)

These are production checks, mostly read-only: SELECTs through the Supabase plugin connector and one Vercel deployment-list read. TJ approved the two backfills in check 5 and check 6 by pop-up, and they ran once each with the bounds stated below. The exact queries are in `tasks/diaries/2026-11-07-claude-data-checks.md`.

| # | Check | Result |
|---|---|---|
| 1 | Hand-applied migrations | Loud alerts applied and both ledger rows inserted (TJ pop-up, follow-up below). All three are now `applied`, and the test passes 21/21. |
| 2 | Yahoo sticky status, step 5 | Passed and closed. |
| 3 | Luna in production | Confirmed. |
| 4 | `rosters.official_seen_at` | **Waiting.** The first nightly run is at 02:00 UTC on 11-08. |
| 5 | PP units rerun 09-29 → 10-30 | **Done**, with TJ's approval: 216/216 games, 0 failed, and 99.2% of rows now match WGO PP TOI. |
| 6 | NST goalie HD/GS | The 10-25 → 11-03 range was already complete. A new gap (11-04 → 11-06) was found and backfilled with TJ's approval. All 30 table/date combinations are verified. |

## 1. Hand-applied migrations

| Migration | In `schema_migrations` | Catalog | Registry state |
|---|---|---|---|
| 20261106210000 x_timeline_watchdog | no | `x_timeline_watchdog` is present: security definer, empty search_path, execute for service_role only. Cron job 401 `x-timeline-watchdog` runs every 5 minutes and is active. | unknown (unchanged) |
| 20261106220000 watchdog loud alerts | no | **Not applied.** `x_timeline_watchdog_label` doesn't exist, and the live watchdog has no `test_alert` mode and no 🚨 subject. | pending (unchanged) |
| 20261106233000 cron_job_audit index | no | `cron_job_audit_run_time_idx` is valid and ready. Its definition, `(run_time, job_name, status, rows_affected)`, matches the file. | unknown (unchanged) |

I added the readback to `stateEvidence` for rows 115–117 in `migration-authority.json`. The counts stay at 119 total, 79 applied and 10 pending, so `supportedBaselineMigration.test.ts` and the super-goal summary needed no edit. The test passes 21/21.

**Open items for TJ:**
- Loud alerts are still not applied.
- The other two need an approved `supabase migration repair --status applied` before they can be marked applied.

### Follow-up, 2026-11-07 about 22:15 UTC (TJ pop-up approval)

- **Approval:** TJ approved this through Chef and confirmed it by pop-up in this session ("Run both").
- **How it ran:** psql could not reach the database host from here (it is IPv6-only and the name did not resolve), so nothing ran that way. I ran it instead through the Supabase connector as one transaction: the migration file's SQL exactly as written, plus `schema_migrations` rows for 20261106210000, 20261106220000 and 20261106233000. For 210000 and 233000 that is a ledger row only, with no schema change.
- **Readback:**
  - The `prosrc` md5 of `x_timeline_watchdog` (`4ded5d0a…`) and `x_timeline_watchdog_label` (`823e0673…`) match the function bodies in the file.
  - Both functions have an empty `search_path`. The watchdog is security definer. Only service_role can execute them; anon and authenticated cannot.
  - `test_alert` mode is present.
  - The ledger has all three rows.
  - Cron 401 runs at 22:10, 22:15 and 22:20 succeeded.
- **Registry:** rows 115–117 are now `applied`. The counts are 119 total, 82 applied, 28 unknown and 9 pending, and the test and the summary are updated to match. `supportedBaselineMigration` passes 21/21.

## 2. Yahoo sticky status, step 5

The check used the 11-07 08:40 UTC `update-yahoo-players` run. The audit marks it `partial`, but only because 1,031 rows had no ownership data, which is Scout's lane. All 1,610 rows were upserted, with 0 rows omitted by the provider and 0 deferred.

- **Coverage:** all 1,610 game-477 rows were refreshed, and no stale flags remain.
- **Status counts, 11-04 → 11-07:**
  - DTD: 118 → 13
  - IR: 102 → 66
  - O: 40 → 10
  - IR-NR: 28 → 18
  - IR-LT: 22 → 18
  - NA: 888 → 791. This is a real Yahoo value for players off active rosters.
  - No status: 410 → 694
- **Named players:** McAvoy and Bedard are both clear.

These results are also recorded in `CLEANUP-PLAN.md` and in the Yahoo diary.

## 3. Luna in production

Vercel `list_deployments` (project `fhfhockey`, sha 00ea36b39, target production) returned one deployment: `dpl_Eq1QaL9XDs1Bp3oWd3v9NV3TCEJW`, READY, from master, release #414, created at about 21:16 UTC on 11-07. The tree at that commit contains `web/pages/api/internal/luna-binding-check.ts` and `luna-review.ts`.

## 4. `rosters.official_seen_at`

`update-players-job` (jobid 6) runs on schedule `0 2 * * *` and is active. Right now 0 of the 5,227 `is_current` rows have a stamp, which is expected: the migration was applied at 19:29 UTC and the first run after it is 02:00 UTC on 11-08. Two follow-ups remain after that run:
- Rerun the count query in the diary (Q7).
- Do a read-only replay of the pending Schwindt (FLA) and Hryckowian (DAL) queue items.

## 5. PP units rerun

**Sizing (before the run).** Every day from 10-31 to 11-06 already matched WGO `pp_toi` within 2 seconds on 100% of rows, because the fixed writer has been live since #402. The 09-29 → 10-30 range covered 32 dates and 216 games, with 6,098 stored rows of which 2,948 matched (48%). The plan was 32 one-day calls, about 648 NHL requests, and no NST or Yahoo calls.

**Run (TJ pop-up approval, 21:29–21:30 UTC on 11-07).** Calls went to `GET https://fhfhockey.com/api/v1/db/update-power-play-combinations?startDate=D&endDate=D`, one day per call, one call at a time, stopping on any non-200 response.

- I ran 09-29 alone first. It went from 84/135 matched to 118/120.
- The remaining 31 days took about 30 seconds in total.
- Every call returned HTTP 200: 216 games processed, 0 failed, 0 skipped.
- 15 rows were kept as `keptUnproven` across all days.

**After the run.** 5,046 of 5,085 rows match (99.2%). 1,013 stale rows were deleted under the boxscore-TOI guard.

The days still short of 100% are:

| Date | Matched / rows |
|---|---|
| 09-29 | 118/120 |
| 10-09 | 95/96 |
| 10-10 | 331/335 |
| 10-17 | 286/291 |
| 10-22 | 272/280 |
| 10-24 | 248/253 |
| 10-26 | 70/71 |
| 10-27 | 238/250 |
| 10-29 | 267/268 |

These are mostly the kept-unproven rows plus partial shift feeds. Inspect them, worst first: 10-27 and 10-22.

**Derived rebuilds (TJ pop-ups, 2026-11-07/08).**

- **Rolling player averages, 09-29 → 11-06: done.** All 752 players, 47,515 rows upserted to `rolling_player_game_metrics` and `rolling_player_metric_support_payloads`. That equals every row in the window.
  - **Verification:** `pp_unit` (strength `all`) matches the corrected `powerPlayCombinations.unit` on 6,181 of 6,181 rows.
  - **Run:** `executionProfile=overnight`, `fastMode`, `skipDiagnostics`, `bypassFreshnessBlockers=true` (approved after the first call hit the freshness gate), one call at a time, following the 207 resume loop through 31 calls between 22:28 and 00:38 UTC.
  - **Pause:** calls 11–13 and 27 hit 504s during the Supabase incident. Chef traced that incident to Lines P3 reprocessing, not this rebuild. The run was paused and then resumed gently: 60 s budget per call, a 60 s gap between calls, a `pg_stat_activity` check (≤ 40) before each call, and a stop if a call ran over 120 s or processed fewer than 5 players twice in a row.
  - **Note:** `updated_at` is not bumped by these upserts (the table has no trigger), so don't use it as evidence of a rewrite.
- **Lineup deployment tallies:** left to the 09:55 UTC cron (`action=current`, which rebuilds the whole season), as TJ chose.
- **team_unit_toi: not populated.** TJ chose to stop and log the coverage gap. This table has never been populated for 2026-27, so nothing is stale.
  - **32-day dry run:** timed out on `nhl_api_shift_rows`.
  - **1-day dry run** (09-29, `dryRun=true`): HTTP 200 in 1 s. It read 5 games and 3,996 shifts and generated 34 rows: 30 power-play rows, but only 2 forward and 2 defense rows across 10 team-games. The writer's even-strength unit coverage is far below what full lines and pairs would give, so this is a finding for the table's owner.
  - **Safe size for a first population:** one day per call. A full run would be about 32 calls and roughly 1.4k rows.

## 6. NST goalie HD/GS

**Read-only check first.** TJ's 11-01 backfill held. Checked against WGO with the card's join, every date from 10-25 to 11-03 is complete. A new gap opened after that:

| Date | WGO goalies | NST `all_counts` |
|---|---|---|
| 11-04 | 8 | 0 |
| 11-05 | 22 | 0 |
| 11-06 | 7 | 0 |

All ten tables stopped at 11-03, except `5v5_counts`, which reached 11-04. There have been no `update-nst-goalies` audit rows since the 11-01 /db runs, so the 08:30 cron runs are going unaudited again. The released route still calls `fetchNstTextByUrl` with no `requestControl` (origin/master; the last change was #380). That means the writer fix is unreleased and **the gap will regrow** until it ships. That fix belongs to the NST lane (now Claude) and has not been done here.

**Sizing.** The backfill needed 29 URLs: 9 for 11-04 (all but `5v5Counts`), 10 for 11-05 and 10 for 11-06. The released client forces 21-second spacing, so the run could not be a true burst.

**Run (TJ pop-up approval).** Every call used the same fixed URL, `GET https://fhfhockey.com/api/v1/db/update-nst-goalies?runMode=incremental&overwrite=false&startDate=2026-11-04&maxDays=3&maxUrls=6&requestIntervalMs=21000`, so the window could not reach 11-07. Calls ran one at a time, with at most 6 planned.

- 5 calls from 21:29 to 21:40 UTC, all HTTP 200, and the last one finished with `stoppedEarly: false`.
- 29 URLs processed. `5v5Counts` for 11-04 was skipped because it already existed, and skipped URLs make no NST request.
- At 21-second spacing, this is at most 3 requests a minute and 15 per 5 minutes, which is within all four NST windows.

**Verification (SELECT only, all 30 combinations).** For each of the 10 tables on 11-04, 11-05 and 11-06, I checked the row count, matches to WGO goalies by id and date, non-null `toi`, and, for the counts tables, non-null `hd_shots_against`:

| Date | WGO goalies | Rows in each table | WGO matches | Non-null toi and HD |
|---|---|---|---|---|
| 11-04 | 8 | 8 (all 10 tables) | 8 | all |
| 11-05 | 22 | 22 (all 10 tables) | 22 | all |
| 11-06 | 7 | 7 in 8 tables; 6 in `pp_counts` and `pp_rates` | all rows | all |

On 11-06, one goalie has no PP row. The PP tables usually run lower, because a goalie who faced no power play gets no row. The table the card reads, `all_counts`, is complete.

No rows dated 11-07 were written. All 30 combinations are present, and no table/date is missing.

## 7. Power-play data gaps (diagnosis only, 2026-11-07)

This is a read-only diagnosis that TJ approved by pop-up. I made no code or data changes. The queries are Q17–Q23 in the diary.

### Gap 1: `forge_player_game_strength` PP goals and assists are inflated. FORGE is wrong; NHL is right.

**Evidence.** For McDavid and Draisaitl in EDM games 2026020133–2026020260, `skatersGameStats` (the NHL boxscore plus landing data) agrees with `wgo_skater_stats` on every game. The forge table differs in only three games, and the PBP goal events explain each one:

| Game | Event | `situationCode` | What forge did | What NHL does |
|---|---|---|---|---|
| 163 | McDavid goal, P3 18:32 | `1560` (EDM at home with the goalie pulled, 6v5) | Counted a PP goal | Counts an even-strength goal |
| 239 | McDavid shootout goal, period 5 | `0101` | Counted a PP goal | Doesn't count it as a goal at all; the boxscore shows 0 goals |
| 260 | Draisaitl goal with a McDavid assist, P3 19:15 | `1560` | Counted a PP goal and a PP assist | Counts both at even strength |

**Root cause.** In `web/lib/projections/derived/situation.ts`, `strengthForTeam` returns `"pp"` whenever a team has more skaters than its opponent. It ignores the goalie digits, so:

- An extra attacker with the goalie pulled (6v5, or 5v4 at 4-on-4 with the goalie pulled) counts as a power play.
- Shootout attempts, recorded as 1v0, count as power-play goals and shots.

`web/lib/projections/derived/buildStrengthTablesV2.ts` (`preparePlayerGameStrengthV2`, around lines 264–298) applies that result to shots, goals and both assists. The writer route is `/api/v1/db/build-projection-derived-v2`, stage `projection_derived_build` of the rolling FORGE pipeline. It also feeds `forge_team_game_strength`.

**Scope.** Every team and every season in the table, since the start (the 2025-26 rows from 2025-10-01 onward).

| Season | Forge PPG | NHL PPG | Forge PPA | NHL PPA | Player-games that differ |
|---|---|---|---|---|---|
| 2025-26 | 985 | 789 | 1,689 | 1,520 | 359 |
| 2026-27 (to 11-05) | 448 | 368 | 782 | 705 | 157 |

The 2026-27 regular-season PBP shows exactly where the extra goals come from. Forge's rule labels 450 goals as PP:

- 37 are shootout goals.
- 46 are extra-attacker goals.
- **367** remain. That matches NHL's 368.

Preseason adds 20 extra-attacker goals out of 83.

**Fix outline (not done).**
1. Skip shootout periods for regular-season games (period ≥ 5, game type 02).
2. Take the goalie digit into account. One approach: compare skaters minus pulled goalies on each side, so a 6v5 with your own goalie pulled counts as ES. The other is to classify a pulled goalie as ES, or as its own empty-net bucket.
3. Rebuild the derived tables.

PP TOI (`toi_pp_seconds`) comes from `shift_charts.total_pp_toi`, a separate builder, so this bug doesn't touch it.

**Readers affected:**
- FORGE player and team projections (PP scoring rates)
- `/splits` (`lib/splits/splitsServer.ts`)
- `PowerPlayCombos`
- the Lines superstyle PPP figures

**Owner:** the FORGE derived builder. Scout keeps the FORGE release, so this needs routing.

### Gap 2: `skatersGameStats.powerPlayToi` is always "00:00". It is a placeholder, and the NHL source has no PP TOI.

**Root cause.** `web/pages/api/v1/db/update-stats/[gameId].ts:671-672` hardcodes `powerPlayToi: "00:00"` and `shorthandedToi: "00:00"` under the comment "Defaults for stats needing other data sources", and `faceoffs` is hardcoded to `"0/0"` the same way. This dates from commit 2b260940f (2025-04-08). The NHL boxscore skater payload stored in `nhl_api_game_payloads_raw` has no PP or SH TOI field. Its keys are assists, blockedShots, faceoffWinningPctg, giveaways, goals, hits, name, pim, playerId, plusMinus, points, position, powerPlayGoals, shifts, sog, sweaterNumber, takeaways and toi. Team PP TOI is scraped from HTML separately (around line 486).

**Scope.**
- Every row from 2015-16 through 2026-27 is `"00:00"`, apart from 2022-23 (35% zero) and 2023-24 (53% zero), which an older writer filled in partly.
- 11,844 rows so far this season, all `"00:00"`.
- `faceoffs` is `"0/0"` on the same rows.

**Readers affected:** `/api/toi` → `components/TimeOnIceChart`, whose PP TOI share is always 0. `percentile-rank` imports only `getInterval` from that route.

**Fix outline (not done).** Get player-game PP TOI from a source that has it:
- `powerPlayCombinations.PPTOI`, which now matches NHL.com after today's rerun;
- `wgo_skater_stats.pp_toi`;
- or `forge_player_game_strength.toi_pp_seconds`.

That can happen in the update-stats writer, or `/api/toi` can read one of these directly. Otherwise, mark the columns as not populated.

**Owner:** the game-stats ingestion route `update-stats/[gameId].ts` plus the `/api/toi` reader. Ownership is not settled.

## 8. team_unit_toi even-strength gap: root cause and fix (TJ, 2026-11-08; backfill held)

**Root cause.** In `web/lib/rankings/teamUnitToiBuilder.ts`, `positionGroup` treated only `C`, `LW`, `RW` and `F` as forwards. `players.position` stores NHL's single-letter wing codes, `L` and `R`; there are 701 `L` and 668 `R` rows and no `LW`/`RW` at all. So every winger had no position group, almost no 5v5 segment had exactly 3 forwards and 2 defensemen, and forward lines and defense pairs nearly disappeared. In game 2026020003, 10 of the 24 forwards (6 `R`, 4 `L`) fell out this way. The existing tests used `LW`/`RW` fixtures, so they never caught it.

**Replay (local, read-only inputs, no writes).** The 09-29 inputs (5 games, 3,996 shifts, 190 players, 120 PP rows) are identical to the production dry run:

| Builder | Rows | Forward lines | Defense pairs | PP | Team-games with ES rows |
|---|---|---|---|---|---|
| Released (HEAD) | 34 | 2 | 2 | 30 | 2/10 (matches the production dry run exactly) |
| Fixed | 656 | 486 | 140 | 30 | 10/10 |

Game 2026020003 alone goes from 10 rows to 131.

**Fix (local, not released).**
1. `positionGroup` now also accepts `L` and `R`.
2. Source coverage gating: any team-game with a skater whose position is missing or unrecognised now gets `coverage_status: "partial"` with the warning `unclassified_skater_positions:<ids>`, instead of `complete`. The team-matrix reader already surfaces `partial`.
3. The writer's `coverage` result reports `teamGamesWithoutEvenStrengthRows` and `partialRows`, so a dry run shows any gap before writing.

Two regression tests were added: L/R wingers form lines, and an unknown position marks only that team-game partial. Builder tests pass 6/6, the rankings folder 32 files / 246 tests, eslint is clean and `npm run typecheck` exits 0. The production route still runs the released code, so **a backfill needs this released first.**

**Source coverage (2026-27, SELECT).** All 264 regular-season games through 11-06 have shift rows for both teams plus `powerPlayCombinations` rows, including all 216 in 09-29 → 10-30. The minimum is 41,765 skater-seconds per game, so no game is short. In the 09-29 replay, no player had an unrecognised position.

**Preseason does not belong.**
- Only 31 of 65 preseason games have shift rows.
- The existing 2025-26 rows are regular season (`02`) and playoffs (`03`) only.
- The window 09-29 → 10-30 contains no preseason games.

The builder filters by season and date but not by game type, so any future range must start on or after 2026-09-29 (or be filtered to game types 02 and 03).

**Snapshot pinning (reader contract).** `teamMatrix.ts` `fetchLatestTeamUnitToiSnapshotDate` takes the newest `snapshot_date` for the whole season, then reads only that snapshot. A backfill must therefore write every game under one pinned `snapshot_date`, passed explicitly on every call. Per-day writes are not atomic, so readers will see a partial season until the last day lands. Run the days back to back and verify the total row count once at the end.

**2025-26 is affected too.** The existing 12,929 rows (one snapshot, 2026-06-22) average 9.5 rows per regular-season game: 2,514 forward-line and 2,744 defense-pair rows across 1,308 games. They were built with the same broken mapping. A rebuild would need its own pinned snapshot covering the whole season, because the reader uses the latest snapshot only.

### Follow-up, 2026-11-08: released fix verified, 2026-27 backfilled (TJ pop-ups)

**Production dry run on release #416** (master 46f971753), 09-29, `dryRun=true`: 656 rows (486 F, 140 D, 30 PP), `teamGamesWithoutEvenStrengthRows` 0, `partialRows` 0, nothing written. This is identical to the local replay.

**Backfill (TJ: "Run it as planned").** It ran from 08:41 to 08:48 UTC.

- **Calls:** 39 one-day calls to `update-team-unit-toi`, 09-29 through 11-06, each with `dryRun=false` and `snapshot_date=2026-11-08`. Calls ran one at a time with a 10 s gap; `pg_stat_activity` read 12–21.
- **Window:** 11-07 was left out because 10 of its 12 games had no shift rows yet.
- **Result:** every call returned HTTP 200 with upserted equal to generated, no partial rows and no team-game missing ES rows. 34,630 rows in total.

**Readback (SELECT).**

| Check | Result |
|---|---|
| Rows for season 20262027 | 34,630, matching the script total |
| Games / team-games | 264 / 528 |
| Snapshot dates | one: 2026-11-08 |
| Coverage status | all `complete` |
| Forward-line / defense-pair / PP rows | 25,692 / 7,525 / 1,413 |
| Team-games with a top forward line and a top defense pair | 528/528 |
| Non-regular-season rows | 0 |

**Rollback, if ever needed:** delete season 20262027 where `snapshot_date = '2026-11-08'`. There were no 2026-27 rows before this run.

**Ongoing:** no cron writes this table. New dates need a run with the same pinned snapshot date; a later snapshot date would hide this one, because the reader takes only the latest snapshot. **2025-26** is still the old broken build and is a separate decision.

## 4. `rosters.official_seen_at` follow-up (2026-11-08, SELECT only)

- **Run:** the 02:00 UTC `update-players` run succeeded (cron and audit, `dryRun=false`). It stamped 795 of the 5,227 `is_current` rows, across all 32 teams, all between 02:00:22 and 02:00:24.
- **Stamps:**
  - Cole Schwindt (FLA, 8481655): stamped. Kai Schwindt (8483878): not stamped.
  - Justin Hryckowian (DAL, 8484829): stamped. Dylan Hryckowian (8486130): not stamped.
  - Duplicate rows from other seasons, and Cole's stale VGK row, are null.
- **Expected effect:** the stamps match the earlier simulated replay, where FLA Schwindt resolved to Cole on 15 of 16 items and DAL Hryckowian to Justin on 16 of 16. That's an inference from identical inputs; the replay was not re-run.
- **Still pending:** `tweet_pattern_review_items` mentioning either name — DAL 19, FLA 4, CAR 1, untagged 51. They clear only through a replay or an alias review, which is a write and needs TJ's approval.

### Follow-up, 2026-11-08: Schwindt/Hryckowian backlog cleared (TJ pop-up)

**Where the backlog actually was.** The queue is `lineup_unresolved_player_names`; `tweet_pattern_review_items` only mirrors its source rows. It held 37 pending rows: FLA "Schwindt" 16, DAL "Hryckowian" 20 and CAR 1. None were created after the 02:00 UTC stamps.

**The live tie-break works.** FLA warmup tweets ingested at 17:38 UTC on 11-08 left 0 unresolved rows; the equivalent tweets on 11-07, before the stamps, left 2 each.

**Why not a processor replay.** `update-line-sources` and `update-lines-ccc` with `reprocess` would also rewrite line combinations, forecasts and snapshots, and send emails. They would also resolve old tweets against *today's* roster: October tweets about Dylan Hryckowian (NHL from 10-25 to 10-28) would flip to Justin.

**What ran instead.** Bounded `POST /api/v1/db/player-name-aliases` calls, one row at a time, 37 calls, all HTTP 200:

| Action | Rows |
|---|---|
| `assign_occurrence` FLA → Cole Schwindt (8481655), 10-19 → 11-07 | 15 |
| `assign_occurrence` DAL → Justin Hryckowian (8484829), 10-14 → 11-08 (none in Dylan's stint) | 19 |
| `ignore`: CAR 09-22 (Panthers preseason lineup filed under CAR), DAL 11-08 (Texas Stars AHL lineup), FLA 09-20 (preseason, Cole or Kai unclear; TJ chose ignore) | 3 |

`assign_occurrence` changes only that row. It learns no surname alias and re-parses nothing.

**Readback.** 0 still pending. 34 rows `resolved` with `resolutionScope=occurrence`, 3 `ignored`, and 0 new rows in `lineup_player_name_aliases`. The historical tweets' stored line parses are unchanged; that was deliberate.
