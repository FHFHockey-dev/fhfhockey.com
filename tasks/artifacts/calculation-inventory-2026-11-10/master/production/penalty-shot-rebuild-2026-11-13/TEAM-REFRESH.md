# Team underlying summaries: penalty shots in all-situation totals (F15, decision 149)

**Status: code committed. Not released, not run.** The plan below starts with a read-only diff, after the release is live and with approval. Every write is a separate approval.

## TJ's spec (via the Chef, 2026-11-13)
> "Count each regulation or overtime penalty shot exactly once in all-situation totals, and count it as a goal only if scored. Update both teams' for/against totals. Exclude shootout attempts and leave ES/PP/PK unchanged. Test scored and saved attempts against the official boxscores."

## The change (`web/lib/underlying-stats/teamStatsSummaryRefresh.ts`)
- **Why it was missing.** Team rows are built from shot features, and shot features exclude penalty shots (and their xG), so team all-situation SF, GF, CF and FF never had them.
- **Where the attempts come from.** `collectPenaltyShotAttempts` takes them from the event stream, using the shared penalty-shot adapter `includeInAllSituationsOnly` (the same flag NST parity uses since `8a4a7d8d1`). That flag covers a goal, shot on goal or miss outside the shootout. Its codes, 1010 and 0101, are ones the canonical `classifyEventStrengthBucket` puts in no bucket.
- **How they are counted.** `accumulateTeamShotMetrics` counts each attempt once, and only in the `allStrengths` row of every score state it falls in (classified by the score before it, as other shots are).
  - The shooting team gets CF +1, FF +1, SF +1 for a goal or save, and GF +1 for a goal only.
  - The other team gets the matching CA, FA, SA and GA.
  - A miss counts as an attempt (CF, FF), not a shot.
- **What stays the same.**
  - ES, PP, PK, 5v5, 3v3, 5v4, 4v5 and the empty-net splits.
  - xG, scoring chances and the danger buckets: penalty shots stay out of xG, as decision 149 says nothing about xG.
  - TOI, which is built from on-ice segments that already exclude the penalty-shot event.
- **Shootouts:** still excluded.
- **Double counting:** an attempt is skipped if it ever appears as a shot feature.
- **Readers.** The team landing reads stored `allStrengths` rows directly (`teamStatsQueries.ts`); it never adds ES + PP + PK, so no reader recomputes "all" and none needed changing. At all strengths, the landing overlays official NHL season GF, GA, SF and SA when games played match. That covers full-season views; the native rows matter for CF and FF, score states, date ranges and partial coverage.

**Tests** (`teamStatsSummaryRefresh.test.ts`). Fixtures follow three of the 8 games' official boxscores:
- 2026020131: a home penalty-shot goal; official 24 / 5 and 26 / 2.
- 2026020101: a home save; official 28 / 2 and 25 / 5.
- 2026020094: an away save, in a shootout game with goals and saves on both sides; official 26 / 2 and 31 / 2.

All-situation SF, GF, SA and GA equal the boxscores for both teams. Other checks:
- ES is the boxscore minus the penalty shot.
- PP, PK and the empty-net splits are untouched.
- CF and CA rise by exactly 1.
- xG and scoring chances are unchanged.
- Tied / leading / trailing still partition the all-situation totals.

All 3 fail on the previous builder.

**Formula revision.** Team rows carry no version or revision column: they are mutable upserts keyed (game, team, strength, score_state). So there is nothing to bump, and nothing becomes stale by version.
- A rebuild changes only games that have a penalty shot; every other game rebuilds byte-identical.
- 2026-27: the 8 games below.
- 2025-26: the 33 games with a penalty shot keep the old totals unless rebuilt separately. That is not proposed here; say if wanted.

## Read-only diff mode (route change, same commit)
`POST /api/v1/db/rebuild-team-underlying-summaries` (admin; a dry run unless `dryRun=false`) now also accepts:
- `gameIds=<1-10 ids>`, in place of the 14-day date window. The 8 games span 22 days, so a window can't hold them alone. Each id must be a final game of the season, or the request gets a 400.
- `diff=true`, dry run only. It returns `diffRowCount`, `diffsTruncated` and up to 400 `diffs`: each stored row the rebuild would change, with every changed field's stored and rebuilt value (`compareTeamSummaryRows`).
- **Strictly read-only** (TJ): a successful dry run or diff writes no summary row and no cron-audit row. The route's audit contract skips it through `skipAuditWhenNoOp: isSuccessfulReadOnlyTeamSummaryRebuild`, as F9's writer dry run did. Writes, failures and non-2xx responses (including a rejected request) are still audited.
  - Proven by `__tests__/pages/api/v1/db/operational-route-auth.test.ts`, which runs the real wrapper and route: a successful 8-game diff makes no audit insert, while a write, a failed dry run and a 400 each make one. The no-audit case fails on the previous wrapper.

## Runner: `team-refresh.py` (default: the diff, no summary write)
**Gates:**
1. DB guard: at most 5 active queries, none older than 10 s.
2. Windows: no call within 15 minutes of 08:00–08:20 or 09:25–11:40 UTC.
3. Deployed code contains the builder (`collectPenaltyShotAttempts`, `compareTeamSummaryRows`), the route (`MAX_REBUILD_GAME_IDS`, `reportDiffs: diff`) and the audit skip (`skipAuditWhenNoOp: isSuccessfulReadOnlyTeamSummaryRebuild`). Read-only `gh api`. The diff never runs on code that would audit it.
4. Manifest: the stored play-by-play's penalty-shot attempts equal the 8 (game, shooting team, result) rows below.

| game | shooting team | result | official, shooter team first (SOG / goals) |
|---|---|---|---|
| 2026020065 | 54 | goal | 54: 43 / 3, 10: 24 / 3 (SO) |
| 2026020094 | 55 | save | 55: 31 / 2, 4: 26 / 2 (SO) |
| 2026020101 | 18 | save | 18: 28 / 2, 54: 25 / 5 |
| 2026020119 | 21 | save | 21: 32 / 5, 5: 32 / 2 |
| 2026020131 | 18 | goal | 18: 24 / 5, 19: 26 / 2 |
| 2026020150 | 12 | save | 12: 44 / 6, 23: 17 / 3 |
| 2026020159 | 26 | save | 26: 27 / 3, 2: 43 / 2 (OT) |
| 2026020203 | 16 | save | 16: 19 / 1, 17: 31 / 4 |

**Diff (default).** One `POST` with all 8 ids and `diff=true`, and no `dryRun` parameter, so the route's default dry run applies. It writes nothing, not even an audit row.
- It must be a complete dry run: `rowsUpserted` 0, not truncated, no stale keys.
- Every difference must be the penalty shot:
  - `allStrengths` only;
  - the shooting team changes by exactly CF +1, FF +1, SF +1, GF +goal, and the other team by exactly CA +1, FA +1, SA +1, GA +goal;
  - `allScores` carries it, and exactly one of tied / leading / trailing (withinOne, upOne and downOne either carry it or not);
  - no other game or field changes.
- The rebuilt all-situation SF of the shooting team must equal its official SOG, and its GF the official goals when the attempt was scored.
- Saved to `run/team-diff-<UTC>.json` and `run/team-diff-approved.json`.

  **Expected size:** 140 rows generated per game (2 teams × 10 strengths × 7 score states), 1,120 in all. About 4–8 changed rows per game: each team's `allStrengths` allScores, one primary score state, and up to 2 of withinOne, upOne and downOne.

**`--execute`** (after TJ approves the diff). Per game, 2 calls (16 in all), 10 s apart:
1. Window, guard, window.
2. Re-diff that game, and require it to equal the approved diff.
3. Before-snapshot to `run/team-before-<game>.json`.
4. Window, guard, window.
5. Write (`gameIds=<game>&dryRun=false`). Require `rowsUpserted` = `rowsGenerated` = 140 and `staleKeyCount` 0.
6. Readback, key by key: diff rows equal their rebuilt values, and every other row is unchanged.
7. The game id goes to `run/team-refresh.done`, and reruns skip it.

**Stop rules:**

| exit | cause |
|---|---|
| 2 | HTTP or body failure |
| 3 | busy database |
| 4 | a window |
| 5 | timeout (uncertain outcome; read back by hand) |
| 6 | diff, manifest or readback mismatch |
| 7 | deployment not ready |

There are no retries inside the runner.

**Rollback:** upsert the rows from `run/team-before-<game>.json`, at most 140 per game. The table is mutable.

**Offline tests:** `python3 -I test_team_refresh.py` (6 tests). They cover the official totals with the shootout goal removed, the expected changes, a clean diff, and nine failure cases:
- a strength split moved;
- counted twice;
- xG changed;
- allScores missing;
- two primary states;
- an unexpected game;
- a stored row missing;
- stale keys;
- SF that differs from the boxscore.

They also cover the readback and the windows.

## What TJ should check after the write
`/underlying-stats/teamStats`: 2026-27, all strengths. For a date range covering one of the 8 games, or with CF / FF shown, the shooting team gains the penalty shot. Full-season SF and GF may already show official NHL values through the overlay.
