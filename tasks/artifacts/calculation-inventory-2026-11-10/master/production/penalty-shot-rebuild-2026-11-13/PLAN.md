# Penalty shots: column rollout and 8-game derived rebuild (F15, Astra AF-07, decision 149)

**Status: code built and verified locally. Nothing applied, deployed or run.** Each production step below needs TJ's own approval. This file doesn't authorize any of them.

## Decision
- Owner decision 149: penalty-shot goals and shots count in all-situation totals and in no strength bucket (ES, 5v5, PP, PK).
- TJ approved starting the coordinated rollout on 2026-11-13, via the Chef.
- Official totals:
  - a scored penalty shot is 1 goal and 1 shot;
  - a saved one is 1 shot;
  - a miss is neither;
  - shootout attempts are never counted.

## Ship order (each step approved separately)
1. **Apply migration `supabase/migrations/20261113200000_forge_strength_penalty_shot_split.sql`.**
   - Apply it alone, via the IPv4 session pooler with `psql -f`. The file has its own `begin/commit`, lock 5 s and statement 60 s.
   - Readback:
     - six columns: `shots_ps int`, `goals_ps int`, `penalty_shot_split_version smallint`, all nullable, on both tables;
     - two CHECKs: `forge_{player,team}_game_strength_penalty_shot_split_check`;
     - `persist_projection_game_derived_v2` exists, with EXECUTE for `service_role` only;
     - v1's ACL is unchanged;
     - every existing row has a null marker.
   - Then record `schema_migrations` and flip the authority row.
   - Safe before the code: v1 becomes a wrapper over v2 that stores legacy rows exactly as before. The PG15 proof shows the same receipt and the same rows, idempotently.
2. **Release the F15 code.** It reads and writes the new columns, so it must follow step 1:
   - the homepage SOG select;
   - the splits select;
   - the builder's v2 call.

   Before the migration, the homepage would hide SOG (the reader catches the error), the splits page would fail, and the derived build would fail closed with no writes.
3. **Rebuild the 8 games** with `ps-rebuild.py --execute` (below), after its dry run passes.
4. Projections pick up the change on their next nightly run. No extra recompute is proposed for 8 events.

New games become split rows as the nightly derived build writes them.

`PROJECTION_DERIVED_ALGORITHM_VERSION` is deliberately unchanged. A bump would make the scheduled derived queue rebuild every stored game. The row marker carries the change instead.

## What the code does
- **Builder** (`buildStrengthTablesV2.ts`):
  - classifies each counted event with the shared canonical adapter `classifyEventStrengthBucket` (8463912d8). A null answer (a penalty-shot code outside the shootout) goes to `shots_ps` / `goals_ps`.
  - Shootouts are still dropped first by `isShootoutPlay`.
  - An assisted penalty-shot goal is refused: the NHL awards none, and the stored 2026-27 goals have none.
  - Every row carries marker 1.
- **`situation.ts`**: `strengthForTeam` now serves only the penalty clock's exposure, which ignores codes with fewer than 3 skaters. Its doc says so.
- **Persistence**: `persistProjectionGameDerivedV2` calls the new RPC and refuses an unmarked row before calling it.
- **RPC v2** = v1 plus:
  - the three columns;
  - one marker per payload;
  - the row rule (marker null with PS null, or marker 1 with 0 ≤ `goals_ps` ≤ `shots_ps`);
  - team PS equal to the sum of player PS;
  - team PS equal to the stored play-by-play's penalty shots for that team (`PROJECTION_DERIVED_PENALTY_SHOT_EVIDENCE_MISMATCH`).
- **Readers.** All-situation = ES + PP + PK + (marker 1 ? PS : 0), in `lib/projections/derived/penaltyShotSplit.ts`. Legacy rows already hold penalty shots in ES, so nothing is counted twice. Updated:
  - `homepageGameAnalytics.ts`: the SOG pair. It fails closed on a missing PS count or an unknown marker.
  - `splitsServer.ts`: the landing-leader goals, and the matchup goals and shots. These are lenient, adding PS only on split rows.
- **Readers checked and left unchanged:**
  - `team-context-queries.ts`: `fetchTeamOffenseEnvironment` sums ES + PP, not an all-situation total, so penalty shots stay out (decision 149). `fetchTeamStrengthAverages` reads per strength.
  - `pages/api/toi.ts`, `PowerPlayCombos.tsx`: PP only.
  - `run-projection-v2.ts`, `xg/participation.ts`: freshness and participation only.
  - `sourceOwnership.ts`, `rollingForgePipeline.ts`, `goaliePipeline.ts`, `run-forge-projections.ts`, `qualify-native-players-offline.ts`: table names only.
  - No SQL view reads these tables.
- **Not changed here: canonical NST parity.** `nhlEventInclusion.ts` `includeInParity` drops penalty shots from parity "all". It sits in separate files and needs an on-ice/xG decision, so it is proposed as its own session ("F15b").
- **Build route:** `gameId=` builds one game on its `startDate`, so the rebuild touches only these 8 games and not every game on their 7 dates. An unknown or misdated id fails the date with no write.

## Affected games (confirmed 2026-11-13, read-only)
- The stored play-by-play holds exactly these 8 penalty shots outside the shootout in 2026-27: 2 goals, 6 saves, 0 misses, 0 in overtime. The runner re-checks this before any write.
- Each game has 2 team rows and 38 player rows.
- **Today's legacy all-situation totals equal the stored official NHL boxscores for all 8 games.** Shots and goals both match; for the two shootout games, goals are the score minus the shootout winner's extra goal. So the readback can require "equal to the official record" for every game.

| game | date | shooter | result | official SOG / goals (home team listed first) |
|---|---|---|---|---|
| 2026020065 | 2026-10-08 | 54 (home) | goal | 54: 43 / 3, 10: 24 / 3 (SO) |
| 2026020094 | 2026-10-13 | 55 (away) | save | 4: 26 / 2, 55: 31 / 2 (SO) |
| 2026020101 | 2026-10-13 | 18 (home) | save | 18: 28 / 2, 54: 25 / 5 |
| 2026020119 | 2026-10-16 | 21 (home) | save | 21: 32 / 5, 5: 32 / 2 |
| 2026020131 | 2026-10-17 | 18 (home) | goal | 18: 24 / 5, 19: 26 / 2 |
| 2026020150 | 2026-10-20 | 12 (away) | save | 23: 17 / 3, 12: 44 / 6 |
| 2026020159 | 2026-10-22 | 26 (away) | save | 2: 43 / 2, 26: 27 / 3 (OT) |
| 2026020203 | 2026-10-29 | 16 (away) | save | 17: 31 / 4, 16: 19 / 1 |

**2025-26** (33 events in 33 games, 6 goals, 15 with derived rows) is out of scope unless TJ asks. Those rows stay legacy, and every reader still sums them correctly.

## Runner: `ps-rebuild.py` (dry run by default)
- **Fail-closed gates, in order:**
  1. DB guard: at most 5 active queries, none older than 10 s; wait 60 s, at most 3 times, then exit 3.
  2. No call within 15 min of 09:50–11:00 UTC: the 10:05 rolling FORGE pipeline and pg_cron 305 at 10:25 both run the derived build. Otherwise exit 4.
  3. Migration applied: the six columns and v2 exist (exit 7).
  4. The production deployment is in master's history and its route and persistence contain the F15 markers. Read-only `gh api` (exit 7).
  5. The stored play-by-play's penalty shots equal the manifest exactly, and dates match (exit 6).
  6. Baseline per game: legacy totals against the boxscore, logged.
- **Dry run** (no flag) stops after the gates and prints the 8 planned calls. It writes nothing and makes no route request.
- **`--execute`**, per game in date order:
  - window check, guard, window check;
  - before-snapshot of every row to `run/before-<game>.json`;
  - one `GET …/build-projection-derived-v2?startDate=<date>&gameId=<id>&maxDurationMs=180000`, Bearer `CRON_SECRET` read from `web/.env.local` and never printed;
  - stop unless the response is HTTP 200, `success: true`, has no failures and `gamesVerified` = 1. A timeout (200 s) or network error stops the run as uncertain.
- **Key-by-key readback** (exit 6 on any difference), saved to `run/after-<game>.json`:
  - the same player keys, and both teams;
  - every row marked 1;
  - per player: ES + PP + PK + PS after equals ES + PP + PK before, for shots and goals;
  - ES drops by exactly its PS;
  - PP, PK, assists, TOI, team, opponent and date unchanged;
  - team PS equals the manifest (the shooter's team 1, or 1 / 1 for a goal; the other team 0);
  - team all-situation equals the official boxscore.
- **Resume:** each finished game id is appended to `run/ps-rebuild.done`, and a rerun skips it. The RPC is transactional, so a failed call commits nothing.
- **Bounds:** 8 calls, sequential, concurrency 1, 10 s apart, no retries inside the runner. On a stop, read the log, fix the cause and rerun; done games are skipped.
- **Final:** all 8 games fully split and equal to the official record, then `DONE`.
- **Offline tests:** `python3 -I test_ps_rebuild.py` (7 tests: shootout goal correction, legacy vs split sums, manifest PS, a clean readback, five failure cases, held-to-unchanged, windows).

## Verification done (local only)
- PG15 proof `supabase/tests/f15_penalty_shot_split.py`, 19 checks, RESULT OK:
  - before: the legacy writer works, and v2 is absent;
  - after:
    - rows keep their values and are marked legacy;
    - grants and v1's ACL are unchanged;
    - v1 replays idempotently with the same receipt;
    - a split payload stores, and its all-situation totals equal the official totals (the miss and the shootout goal count nowhere);
    - a split replay is idempotent;
    - a v1 rewrite returns the game to legacy without losing a shot;
    - six refusals: mixed markers, team ≠ player sum, a PS left in ES, a shootout goal as PS, goals_ps > shots_ps, marker 2;
    - the table CHECK refuses a legacy marker on a row with PS counts (23514);
  - rollback: it refuses while a split row exists, and after a legacy rebuild restores v1, the columns, constraints and grants exactly.
- Vitest, typecheck and ESLint: see the commit message.

## Rollback
1. Revert the F15 code.
2. Rebuild each split game with the reverted code. It calls v1, which now stores legacy rows.
3. Run `supabase/tests/f15_penalty_shot_split_rollback.sql`. It refuses while any split row remains, then restores v1 exactly as 20260720105524 defined it, drops v2, the CHECKs and the columns.

## Post-expiry OT boundaries
Not audited in this lane. `penaltyClock.ts` moves coincident regulation timers off the manpower clock at second 3600, and `ingest/shifts.test.ts:445` covers a carried minor expiring in overtime. A minor expiring exactly at 3600, and a held coincident release in OT, are left for a separate audit.
