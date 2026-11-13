# Penalty shots: column rollout and derived rebuild (F15, Astra AF-07, decision 149)

**Status: DRAFT. Not approved. Do not run.** Nothing here applies a migration, deploys, or calls a route on the strength of this document alone.

## TJ's direction (pop-up, 2026-11-13 ~15:20Z)
- Tonight: ship the shared adapter and its offline tests. Don't switch the derived builder or rebuild any game. AF-07 stays open in the builder.
- After the freeze: prepare one coordinated rollout:
  - separate penalty-shot shots and goals;
  - transactional persistence;
  - every reader that treats ES+PP+PK as all-situation.
- Penalty shots stay out of ES/PP/PK. Shootout attempts stay excluded.
- All-situation totals must match the official boxscore:
  - a scored penalty shot is 1 goal and 1 shot;
  - a saved one is 1 shot;
  - a miss is neither.
- Old rows carry a version or coverage marker, so no reader adds a penalty-shot count to an ES total that already includes it.
- Tests: a goal, a save, a miss and a shootout attempt, through the writer and the affected readers.
- Confirm the exact rebuild list against the official record. The migration, the deployment order and the bounded rebuild plan come back for separate approval.

## What shipped tonight
- `classifyEventStrengthBucket(digits, side)` in `web/lib/supabase/Upserts/nhlStrengthState.ts`. It is the shared adapter: `es`/`pp`/`pk` from `classifyTeamManpower`, and `null` for a penalty-shot code (a side with no skaters).
- Tests:
  - oriented home-shooter (1010) and away-shooter (0101) cases;
  - ordinary 5v5, PP, PK, OT and extra-attacker codes unchanged;
  - adapter = canonical manpower state for all 10,000 codes.
- `situation.test.ts` pins the remaining gap (AF-07 open): the adapter equals `strengthForTeam` on every valid code where both sides have skaters. For the two real 2026-27 penalty shots in the test, the adapter gives no bucket while the builder still says `es`. Flip that assertion when the builder switches.
- `situation.ts` and `buildStrengthTablesV2.ts` are unchanged. Stored rows are unchanged.
- **No STRENGTH_VERSION bump.** Normalized output is identical: one new export, and two parameter types widened to the four digits. `nhlRawGamecenter.test.ts` (the version-equality assertion) passes.

## Exposure: unchanged by penalty shots (confirmed from code)
Strength TOI in `shift_charts` comes from the penalty clock (`ingest/shifts.ts` → `buildPenaltyClock`), not from situation codes. In `penaltyClock.ts`:
- a `PS` infraction creates no box time (`unitsForPenalty`);
- a penalty-shot goal releases no minor (`:179`);
- `observedAdvantage` ignores codes with fewer than 3 skaters a side.

A penalty shot is taken with the clock stopped, so it has no elapsed time.

## Affected games
Source: read-only `pbp_plays` reads on 2026-11-13. `pg_stat_activity` was checked first (0–1 active, none long).

**2026-27:** 8 non-shootout penalty-shot events in 8 games: 2 goals, 6 saves, 0 misses. All are in regulation; none in OT.
- Orientation holds: every 1010 owner is the home team and every 0101 owner is the away team.
- Every game has stored derived rows (2 team rows and 38 player rows each).

| game | date | period | code | result | shooter team (home/away) |
|---|---|---|---|---|---|
| 2026020065 | 2026-10-08 | 2 | 1010 | goal | 54 (home) |
| 2026020094 | 2026-10-13 | 2 | 0101 | save | 55 (away) |
| 2026020101 | 2026-10-13 | 1 | 1010 | save | 18 (home) |
| 2026020119 | 2026-10-16 | 2 | 1010 | save | 21 (home) |
| 2026020131 | 2026-10-17 | 1 | 1010 | goal | 18 (home) |
| 2026020150 | 2026-10-20 | 2 | 0101 | save | 12 (away) |
| 2026020159 | 2026-10-22 | 2 | 0101 | save | 26 (away) |
| 2026020203 | 2026-10-29 | 2 | 0101 | save | 16 (away) |

**2025-26** (scope decision for TJ): 33 events in 33 games, 6 of them goals. 15 of those games have derived rows.

**Still to confirm before approval:**
- the list against the official record: NHL boxscore and play-by-play, plus the normalized `nhl_api_pbp_events` penalty-shot flag;
- missed penalty shots, which count nowhere;
- that no penalty shot is coded otherwise.

## Rollout design (post-freeze, for approval)
1. **Migration** (additive, applied alone):
   - On `forge_player_game_strength` and `forge_team_game_strength`, add `shots_ps int null`, `goals_ps int null` and `penalty_shot_split_version smallint null`.
   - `null` marks a legacy row: any penalty shot is still inside ES.
   - `1` marks a split row: `shots_ps`/`goals_ps` are non-null and ≥ 0, and penalty shots are in no bucket. A CHECK enforces this.
   - Add a new `persist_projection_game_derived_v2` RPC with the extra recordset fields and the same validation. Version 1 stays for the old code.
   - No assists column: NHL awards no assists on a penalty-shot goal. The writer test asserts a PS goal adds no assist anywhere.
2. **Code** (one deploy, after the migration):
   - The builder classifies with `classifyEventStrengthBucket`. A `null` result goes to `*_ps` and stamps version 1. Shootouts are still dropped first by `isShootoutPlay`.
   - Persistence calls the new RPC.
   - Readers compute all-situation as ES+PP+PK + (version = 1 ? PS : 0).
3. **Readers to audit** (from a grep of the tables' readers). Known ES+PP+PK sums:
   - `homepageGameAnalytics.ts:388`: the SOG pair;
   - `splitsServer.ts:493` and `:746`: goals, assists and shots.

   Also check:
   - `team-context-queries.ts`;
   - `run-forge-projections.ts`;
   - `skater-stage.ts` (F13 owns this file today);
   - `goaliePipeline.ts`, `rollingForgePipeline.ts`, `xg/participation.ts`;
   - `pages/api/toi.ts`, `PowerPlayCombos.tsx`, `predictions/sourceOwnership.ts`;
   - `scripts/qualify-native-players-offline.ts`.

   Strength-rate readers (ES/PP/PK per TOI) correctly exclude PS.
4. **Build route:** add `gameId=` to `build-projection-derived-v2`, so the rebuild touches affected games only. It is date-based today: 7 dates hold the 8 games, and 2026-10-13 holds two of them.
5. **Tests:** the goal, save, miss and shootout fixtures, home and away shooter, through the builder, the RPC payload and each affected reader. Old-row cases (version null) must not double-count.
6. **Unrelated finding:** canonical parity also drops penalty shots from parity "all" (`nhlEventInclusion.ts`: `includeInParity`). Decide whether decision 149 applies there too.

## Rebuild loop (draft; TJ's terminal, after migration, deploy and approval)
- **Preconditions:**
  - migration applied and read back;
  - deploy READY at the approved SHA;
  - the game list confirmed;
  - no derived-build cron is running: check the schedule and wait for any run to finish.
- **Route:** `GET https://fhfhockey.com/api/v1/db/build-projection-derived-v2?gameId=G`, or `startDate=D&endDate=D` if `gameId` isn't added. That reaches 7 dates, and the other games on those dates are rewritten idempotently.
  - Auth: Bearer `CRON_SECRET`, read from `web/.env.local` inside the script and never printed. Confirm `adminOnly` accepts it.
  - DB-only: no NHL, NST or Yahoo requests.
- **Load bounds:**
  - Sequential, concurrency 1, 10 s between calls.
  - At most 8 calls (or 7), plus at most 1 retry each.
- **DB guard before every call:** `pg_stat_activity` must show 5 or fewer active queries and none older than 10 s. Otherwise wait 60 s, at most 3 times, then stop.
- **Stop at once on:**
  - a non-200 status, or a failure or partial status in the body;
  - a call taking more than 200 s;
  - a readback failure.
- **Resume:**
  - A state file (`$TMPDIR/ps-rebuild.done`) records each finished game id, and the loop skips listed ids.
  - The RPC is transactional, so a failed call commits nothing for that game. Rerun the same id once; if it fails again, stop and report.
- **Readback** (read-only, per game):
  - both team rows and all player rows carry `penalty_shot_split_version = 1`;
  - the shooter team's `shots_ps`/`goals_ps` equal the table above;
  - ES+PP+PK+PS for shots and goals equals the official boxscore SOG and goals for both teams;
  - the ES count drops by exactly the penalty-shot events.
- **Final receipts:** 8 of 8 games at version 1; total calls, durations and retries.
- **Downstream:** projections pick up the change on their next nightly run. No extra recompute is proposed for 8 events.

## Post-expiry OT boundaries
Not audited in this lane, as Astra noted. What I saw in passing:
- `penaltyClock.ts` moves coincident regulation timers off the manpower clock at second 3600 (Rule 84.3).
- `ingest/shifts.test.ts:445` covers a carried regulation minor that expires inside overtime.

I did not look for a fixture where a minor expires exactly at 3600, or where a held coincident service later releases a serial penalty in OT. Leave both for a separate audit.
