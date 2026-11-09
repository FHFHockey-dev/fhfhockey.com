# Targeted team_unit_toi rebuild (duplicate shift rows) — plan for TJ approval

Released code: master 620276ede (contains builder fix bab719dff). Target: the existing snapshot 2026-11-08 for both seasons. No new snapshot.

## Production dry runs (dryRun=true, released code)
| Game | Rows | 5v5 min/team | Dropped dup shifts | Dropped off-game shifts |
|---|---|---|---|---|
| 2025020565 | 122 (was 2) | BUF 52.6 | 750 | 676 |
| 2026020019 | 122 | WPG 49.3 (was 44) | 61 | 0 |
Both match the local replay.

## Games
- `rebuild-2025-26-game-ids.txt`: 257 games (231 regular + 26 playoff, 565 included). SCF G1 2025030411 is not in the list.
- `rebuild-2026-27-game-ids.txt`: 73 regular-season games already in the snapshot. Left out: 10 preseason games (not in the matrix) and 6 games from 11-07 that aren't built yet; nightly job 403 builds those with the fixed code.

## Expected change (local replay of released builder vs stored rows; per game in `rebuild-expected-per-game.tsv`)
| Season | Stored rows | New rows | Unchanged | Changed | Added | Stale (would remain) |
|---|---|---|---|---|---|---|
| 2025-26 | 33,276 | 33,897 | 3,714 | 29,533 | 650 | 29 |
| 2026-27 | 9,496 | 9,671 | 1,021 | 8,473 | 177 | 2 |
Every row is complete, and every team-game has ES units. Most "changed" rows only change pool TOI.
The route only upserts, so the 31 stale rows (15 games, trailing line or pair numbers that no longer exist, listed in `rebuild-stale-rows.tsv`) must be deleted by exact key after the writes.
Snapshot totals after: 2025-26 183,328 → 183,949; 2026-27 34,630 → 34,805.

## Steps
1. Backup (read-only): copy the 42,772 current rows for the 330 games to a CSV (about 15 MB). Location: the shared side-session notes folder, plus the scratchpad copy.
2. 34 calls, one at a time: `update-team-unit-toi?season=S&gameIds=<10 ids>&snapshot_date=2026-11-08&dryRun=false` (26 for 2025-26 and 8 for 2026-27). 10 s gap; activity check (≤40) before each call. About 10 minutes.
3. Delete the 31 stale rows by exact key (season, snapshot 2026-11-08, game, team, unit_type, unit_number). One statement, and it must report exactly 31.
4. Readback: per-game row counts equal the replay, totals as above, partial 0, F1 on both teams for every game.

## Stop rules
Stop on any of these:
- non-2xx (one retry only for a statement timeout, as before);
- generated rows ≠ upserted rows, or ≠ the replay's expected rows for the batch;
- partial > 0 or noES > 0;
- the snapshot isn't 2026-11-08;
- a call takes more than 60 s;
- activity stays above 40.

## Rollback
Delete the snapshot-2026-11-08 rows for the 330 games, then reload the backup CSV (`\copy` into team_unit_toi, all columns). That restores the exact pre-run rows.

## Run 11-09 00:00 UTC — stopped at batch 8 of 34 (by design)
- Batches aa–ag (70 games) wrote exactly the replay's counts; ah wrote 1,361 rows vs 1,362 expected → STOP. Nothing after ah ran. All rows are still complete. Stale-row delete not run.
- Cause: a writer bug, not the data. `fetchShiftRows` pages by offset (`range`) ordered by (game_id, period, start_seconds), which isn't unique. Postgres repeated some rows across pages and skipped others; the row count was the same but the content wasn't. Proof: the route dropped 52/39/26/64/32/34/68/33 "duplicates" vs the true 51/38/24/62/29/31/63/27 in the same inputs, and each extra one stands for a skipped real shift. `powerPlayCombinations` had no order at all.
- Scope: every call over 1,000 shift rows was affected (every day-based run, including the full 2025-26 rebuild and the 2026-27 fill). The loss is small (about 1–6 shifts per 10 games) but spread across both snapshots.
- Fix (local commit, needs release): order by `shift_id` as a unique tiebreak (PK game_id, shift_id), and order the power-play, players and games reads by their keys. Regression test: `teamUnitToiWriter.test.ts`.
- Backup CSV for the 330 games (42,772 rows, sha256 1406459511fb…) is in the side-session notes folder.
