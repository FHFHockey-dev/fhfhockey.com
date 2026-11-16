# F7: game-finality consumers + PK head unknown (2026-11-13)

## Scope
- Part A: move remaining finality consumers (F4 note "Other consumers") onto `lib/games/gameFinality.ts` (nhl-game-state-v1, read only).
- Part B: `lib/projections/modeledHeadTotals.ts`: a missing PK head is unknown, not 0.
- Freeze 18:30 UTC. Owned: the named files + tests. Not: gameFinality.ts, playerStatsLandingServer.ts, update-games.ts, F6/F8 files.

## Where
- `/Users/tim/Code/fhfhockey.com` on `octoberBranch` (base 53045f5b6).

## Checks / findings
- 14:30 UTC Part B read-only check (pg_stat_activity: 2 active, 0 s longest). forge_player_projections rows created 2026-11-13: as_of 11-13 h1 72/72 rows with all four PK heads, as_of 11-14 h1 500/500; 0 rows with ES+PP known but PK null. Heads are written on forge_player_projections.
- BUT forge_reserve_projections has no PK columns (reserveProjections.ts writes ES/PP only) and RSO's forgeDailyBridge feeds reserve rows through the same helper: a strict helper blanks every reserve skater and fails 61 RSO/FORGE tests (all pass on old code). Part B REVERTED; patch parked in notes folder `F7-partB-pk-unknown.patch`. Needs an F6/RSO decision.
- Gotcha: writer path `pkModeled=false` stores null PK and labels ES `all_non_pp_time` (PK time folded into ES); a strict helper would make those totals unknown too.
- Gotcha: `teamUnitToiNightly.ts` already gates on play-by-play game-end evidence (date filter is only candidacy).

- Part A done (uncommitted): teamStatsSummaryRefresh rebuild ids, teamStatsQueries coverage, 3 refresh windows, adminRouteHelpers (supabase + direct-pg path, which was `date < today OR ...`), player/goalie summary routes, nhlRawGamecenterRoute backfill. Tests added per file. teamUnitToiNightly left: already gated on pbp game-end evidence.
- pg_cron: update-games 03:00 UTC, update-player-underlying-stats 09:35 UTC.

- pages/db/index.tsx done (typed via `.returns<>()`: generated types predate migration 146). settlement.ts left: outcomes already need a FINAL/OFF boxscore; 8 h is the scope contract.
- pagedReadOrder.test.ts fixture needed startTime (rows without state or start are no longer final).
- Checks: eslint 21 files exit 0; typecheck #1 exit 2 (3 errors, db page) -> fixed, #2 running; 49 test files near the readers: 1 fail (pagedReadOrder) -> fixed.
- Hand-over note: notes folder `F7-finality-consumers-and-pk.md`.

- Typecheck #2 exit 0. Old-code proof: 11 new tests fail on HEAD sources, 49 pass; restored byte-identical. Nearby suite 44 files / 369 tests pass.
- Committed `5bb89aef1` (19 files, explicit pathspecs; diary left uncommitted).

- Chef verified 5bb89aef1, accepted Part B as reverted (waits for PK columns on forge_reserve_projections), assigned teamStats copy.
- teamStats coverage copy "scheduled games before today" -> "final games" (:638, :646), test pins both: committed `706937676`; 7/7 pass, eslint 0.

- 15:03 Chef: resume Part B as Astra AF-05 (P1, TJ-approved). Version-aware admission in modeledHeadTotals.ts: basis "pk_head" (strength accounting es_definition even_strength, or any PK head on the row: PK required, a missing PK head withholds) vs "pk_unmodelled" (es_definition all_non_pp_time, or no PK head at all: legacy rows, reserve lines; ES+PP labelled via pkBasis + SKATER_PK_BASIS_NOTES). ppPoints independent. sumModeledHeads now requires PK (featureBuilder already passes it).
- Consumer tests (one missing PK head): forge/players, start-chart, dailyDecisionReplay. run-projection-accuracy.test.ts is mid-edit by another lane (2 pre-existing failures with HEAD helper too) -> not touched.
- Gotcha: reserveProjections.test.ts source audit greps the reserve table name across lib/ -> never name it in a comment.
- Gotcha: never swap files while a background typecheck runs (typecheck #3 invalid).
- Bridge label patch (F12 owns forgeDailyBridge.ts): drafted in scratchpad bridge-patch/bridge.diff; shared limitation + reworded blank-head limitation + test.

- Typecheck #4: 0 errors in my files; 9 errors all `goalieShares` in F12's in-flight bridge/test/fixture. Committed AF-05 as `369e00828` (5 files). HEAD bridge + helper 100/100; bridge label patch 101/101 on temp copy web/__f7tmp__ (deleted); patch saved to notes `F7-AF05-bridge-label.patch`.

## Next
- Chef routes the bridge label patch to F12. Diary can retire once that lands.

## Blockers
- none
