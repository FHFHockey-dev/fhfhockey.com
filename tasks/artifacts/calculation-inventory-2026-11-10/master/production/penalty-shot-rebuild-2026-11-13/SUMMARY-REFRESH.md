# Underlying-stats summary refresh for the 8 penalty-shot games (F15, decision 149)

**Status: dry run passed on 2026-11-13 at 17:56Z (read-only), against deployment `b6d43efdc`. Not approved; nothing written.** `--execute` writes and needs TJ's approval.

## Why
`8a4a7d8d1` (released in #437, master `b6d43efdc`) makes NST parity "all" count penalty shots outside the shootout:
- the shooter's goals, shots, iCF and iFF;
- the goalie's shots against, saves and goals against.

They count in no strength split, no on-ice stat and no xG.

The underlying-stats landing doesn't compute parity live. It reads stored per-game summary partitions, so these 8 games keep their old "all" figures until their partitions are rebuilt.

Example, read-only on 2026-11-13: in 2026020065, Jack Eichel (8478403) scored on a penalty shot. His stored `individual/allStrengths` line reads 0 goals, 5 shots, iCF 7 and iFF 5. After the refresh it should read 1 goal, 6 shots, iCF 8 and iFF 6.

## What is rewritten (and what is not)
| store | key | written by | per refresh of one game |
|---|---|---|---|
| `nhl_api_game_payloads_raw`, endpoint `landing`, `source_url` `derived://underlying-player-summary-v2/<mode>/<strength>/[<scoreState>/]<gameId>` | append-only; readers take the newest row per `source_url` | `GET /api/v1/db/update-player-underlying-summaries?gameId=<id>&seasonId=20262027&gameType=2` | one new row per partition (every partition gets a fresh `generatedAt`, hence a fresh hash) |
| `goalie_underlying_summary_partitions` | upsert on `(game_id, strength, score_state)` | `GET /api/v1/db/update-goalie-underlying-summaries?gameId=<id>&seasonId=20262027&gameType=2` | one upsert per goalie partition |

**Both calls run in game mode.**
- No backfill and no legacy migration.
- The goalie route rebuilds from raw (`preferSharedSnapshotSeed` is false outside backfill), so it never copies a stale shared partition.
- The landing cache is not warmed: `warmLandingCache` is not passed, and game mode never warms it.

**Rows touched.** These are the current partitions (version 1, formula revision 2), read-only from the dry run on 2026-11-13. Each refresh writes one new row per current partition; orphans are not rewritten.

| game | heads | current: new rows written | orphans left untouched | goalie partition upserts |
|---|---|---|---|---|
| 2026020065 | 135 | 135 | 0 | 43 |
| 2026020094 | 160 | 156 | 4: `individual`/`onIce` × `withEmptyNet`/`againstEmptyNet` (2026-11-09) | 52 |
| 2026020101 | 153 | 147 | 6: the same 4, plus `individual`/`onIce` `threeOnThree` (2026-10-14) | 49 |
| 2026020119 | 147 | 145 | 2: `individual`/`onIce` `threeOnThree` (2026-10-17) | 47 |
| 2026020131 | 135 | 133 | 2: `threeOnThree` (2026-10-18) | 43 |
| 2026020150 | 159 | 157 | 2: `threeOnThree` (2026-10-21) | 51 |
| 2026020159 | 152 | 152 | 0 | 48 |
| 2026020203 | 135 | 133 | 2: `threeOnThree` (2026-10-30) | 43 |
| **total** | 1,176 | **1,158** (about 37 kB each, about 43 MB appended) | 18 | **376** (no goalie orphans) |

### Orphan partitions (diagnosis of the 17:54Z dry-run stop)
- **The stop.** The first dry run stopped at 2026020094 with "game lacks current summaries". The cause was 4 heads with no formula revision.
- **What they are.** All 18 orphans across six games are leftovers from older builds: 2026-10-14 to 10-30 and 2026-11-09.
  - They are `threeOnThree` partitions in regulation-only games, and empty-net partitions from before decision 84.
  - The 2026-11-12 revision-2 rebuild of each game wrote every other partition and none of these, because the current builder no longer produces them.
- **Cause.** They pre-date today's work. The derived penalty-shot rebuild touches only `forge_*_game_strength` and `forge_goalie_game`, and the strength-v2 heads are unrelated.
- **Not served.** The landing reader skips any payload that isn't current (`isCurrentPlayerStatsSummaryPayload`).
- **Unaffected by the refresh.** It rebuilds the current partitions only: the builder still doesn't produce these, and the penalty-shot change adds no strength partition. So the orphans stay exactly as they are, and the readback requires them byte-for-byte unchanged.
- **No separate expected deltas** are needed.
- **No goalie orphans.** The goalie table rows are all current.
- **Cleanup is out of scope.** Removing the orphans would mean appending current empty partitions or changing the reader; it is not part of this plan.

**Formula revision stays at 2.** Bumping `PLAYER_STATS_SUMMARY_FORMULA_REVISION` would mark every stored summary stale and force a broad rebuild. The new rows carry revision 2, like the rows they supersede. The runner checks the deployed constant is still `2`.

**Not refreshed: team underlying summaries.** They are built from shot features (`teamStatsSummaryRefresh.ts` `accumulateTeamShotMetrics`), and shot features still exclude penalty shots, so a rebuild would write identical rows.

This leaves a separate decision-149 gap: team underlying "all" GF and SF don't count penalty shots. It's not in this plan; a fix needs its own change to the team summary builder.

**Calls:** 16 (8 games × 2), sequential, 10 s apart. No NHL, NST or Yahoo request is made: the builds read stored events, shifts and roster rows.

## Runner: `summary-refresh.py`
**Fail-closed gates, in order:**
1. **DB guard:** at most 5 active queries, none older than 10 s. Waits 60 s, at most 3 times, then exit 3.
2. **Windows:** no call within 15 minutes of 08:00–08:20 or 09:25–11:40 UTC (exit 4). The window is checked before and after each DB guard.
3. **Deployed code** (read-only `gh api`): the production deployment is in master's history, contains `includeInAllSituationsOnly` and `allSituationsOnly`, and keeps `PLAYER_STATS_SUMMARY_FORMULA_REVISION = 2` (exit 7).
4. **Manifest:** the stored play-by-play's penalty-shot attempts for 2026-27 equal the 8 rows in the table below, matching shooter, goalie and result (exit 6).

   | game | shooter | goalie | result |
   |---|---|---|---|
   | 2026020065 | 8478403 | 8475683 | goal |
   | 2026020094 | 8474586 | 8478435 | save |
   | 2026020101 | 8480835 | 8478499 | save |
   | 2026020119 | 8477492 | 8481668 | save |
   | 2026020131 | 8476539 | 8476412 | goal |
   | 2026020150 | 8478427 | 8482447 | save |
   | 2026020159 | 8477960 | 8473575 | save |
   | 2026020203 | 8483493 | 8476434 | save |
5. **Before-snapshot** of every player partition head and goalie partition row, saved to `run/summary-before-<game>.jsonl`.
   - Heads that are not version 1 / revision 2 are orphans: they are named in the log and left untouched.
   - The gate stops a game that has no current partitions, no current `individual` or `goalies` `allStrengths` partition, or any non-current payload newer than its current build.
   - The log shows each shooter's and goalie's current "all" line next to the expected one.

**Dry run** (no flag) stops after step 5. It reads only, and writes only local files.

**`--execute --max-games 1` first, then `--execute`.** For each game:
- window, guard, window;
- a fresh before-snapshot;
- the player call;
- a readback;
- window, guard, window;
- the goalie call;
- a readback, saved to `run/summary-after-<game>.jsonl`;
- the game id goes to `run/summary-refresh.done`, and reruns skip it.

**Route checks:** HTTP 200, `success: true`, `mode: "game"`, `gameIds: [game]`, and `rowsUpserted` equal to the snapshot's **current** partition count. A 240 s timeout or a network error is an uncertain outcome: the runner stops (exit 5 or 2).

**Readback** (exit 6 on any difference). Only metrics and TOI are compared; names and labels are ignored.
- Same partition set.
- Every current player head is newer than before and carries version 1 / revision 2.
- Every orphan is unchanged.
- **allStrengths / allScores:**
  - the shooter's `individual` goals, shots, iCf and iFf move by exactly the penalty shot (a goal adds 1 / 1 / 1 / 1, a save 0 / 1 / 1 / 1);
  - the goalie's `goalies` shotsAgainst, saves and goalsAgainst move by exactly 1 / (1 − goal) / goal;
  - every other metric of every row is unchanged.
- **allStrengths score states:** exactly one of tied, leading or trailing carries the same move. upOne, downOne and withinOne either carry it or are unchanged.
- **Every other strength, and all of `onIce`:** every row unchanged.
- **The goalie table:** the same rules, by (strength, score_state).

## Stop rules
- Exit 3: busy database.
- Exit 4: a window.
- Exit 7: deployment not ready.
- Exit 6: manifest, stale summaries, readback or row-count mismatch.
- Exit 2 or 5: HTTP or body failure, or timeout.
- No retries inside the runner.

A stop after a player call leaves the new rows in place, because the table is append-only. Review `summary-run.jsonl` and the before/after files before deciding anything. A rebuild from unchanged sources is deterministic apart from `generatedAt`.

**What can make a correct-code game stop:** a partition that legitimately differs for another reason since 2026-11-12 ~20:10Z, when the current heads were written. For example, another lane's formula change released in #437 without a revision bump, or a stored-data repair. That is why the first live run is one game.

## Rollback (only if a readback shows a real defect)
- **Player partitions** (append-only): re-insert each backed-up payload from `run/summary-before-<game>.jsonl` as a new row with a `generatedAt` / `fetched_at` newer than every current head. That gives it a fresh hash.
  - This is the method in `web/lib/underlying-stats/playerSummaryRollbackPlan.ts`, proven locally by `supabase/tests/player_summaries_rollback.py`.
  - It needs its own approval and a bounded insert of at most 1,158 rows.
- **Goalie partitions:** upsert the backed-up rows (at most 376).
- **Served cache:** the landing's season aggregate is cached in process for up to 10 minutes per instance, so figures may lag by that much after either direction.

## Dry run, 2026-11-13 17:56Z (read-only): DRY_RUN_OK
- Deployment `b6d43efdc` carries the parity fix and revision 2.
- The stored play-by-play's penalty-shot attempts equal the manifest.
- All 8 games pass the baseline gate, with 18 orphans named.

Each line below is shooter goals / shots / iCF / iFF, then goalie shots against / saves / goals against, now → expected:

| game | shooter (now → expected) | goalie (now → expected) |
|---|---|---|
| 2026020065 | 8478403 (Eichel): 0/5/7/5 → 1/6/8/6 | 8475683: 42/40/2 → 43/40/3 |
| 2026020094 | 8474586: 0/2/3/3 → 0/3/4/4 | 8478435: 30/28/2 → 31/29/2 |
| 2026020101 | 8480835: 0/1/1/1 → 0/2/2/2 | 8478499: 27/25/2 → 28/26/2 |
| 2026020119 | 8477492: 1/8/10/8 → 1/9/11/9 | 8481668: 31/26/5 → 32/27/5 |
| 2026020131 | 8476539: 0/3/3/3 → 1/4/4/4 | 8476412: 23/19/4 → 24/19/5 |
| 2026020150 | 8478427: 0/3/10/6 → 0/4/11/7 | 8482447: 42/37/5 → 43/38/5 |
| 2026020159 | 8477960: 0/4/7/7 → 0/5/8/8 | 8473575: 26/23/3 → 27/24/3 |
| 2026020203 | 8483493: 0/0/0/0 → 0/1/1/1 | 8476434: 18/17/1 → 19/18/1 |

**External cross-check:** every goalie's expected shots against and goals against equals the official boxscore SOG and goals of the shooting team (shootout goal removed). The one exception is 2026020150: the official 44 SOG / 6 goals includes one empty-net goal, which no goalie faced.

## What TJ should check after the refresh
The **player** and **goalie** underlying-stats landings. Both read these partitions.
- `/underlying-stats/playerStats`: 2026-27, regular season, all strengths, individual counts. Eichel's 2026020065 penalty-shot goal should now count in his goals and shots.
- `/underlying-stats/goalieStats`: the goalie's shots against and saves or goals against.

The season aggregate is cached in process for up to 10 minutes per instance, so allow that long.

The **team** landing (`/underlying-stats/teamStats`) is not affected and should not change. Its "all" GF and SF still leave out penalty shots; that is a separate decision-149 gap the Chef is taking to TJ.

## Verification done (offline)
- `python3 -I test_summary_refresh.py`: 8 tests, OK, now including orphans left untouched, a changed orphan caught, and the baseline gate. They cover partition parsing, the expected moves, a clean penalty-shot goal readback, and eight failure cases:
  - allScores missed;
  - two primary score states;
  - a move inside a strength split;
  - an on-ice change;
  - a teammate change;
  - a save counted as a goal;
  - an old revision;
  - a dropped partition.

  They also cover the goalie table rules and the windows.
- **Read-only facts** (DB guard: 1 active, 0 s):
  - the partition counts above;
  - all current heads were written 2026-11-12 between 20:09 and 20:26Z;
  - the score-state partition names;
  - Eichel's current line.
