# 2026-11-09 wgo_skater_stats statement timeouts (Claude lane, Chef local_c4e6c533)

## Scope
Diagnose and fix recurring statement timeouts on public wgo_skater_stats reads. Code + migration DRAFT only; nothing applied to production.

## Where
octoberBranch, /Users/tim/Code/fhfhockey.com (shared checkout).

## Findings so far
- Edge logs 14:12-20:22 UTC: coverage 500s come from SSR (`node` UA) `fetchBoxScoreCoverage` in web/pages/stats/player/[playerId].tsx, one season of dates per request (not career): MIN 2018-19, TBL 2022-23, ANA 2024-25, FLA 2025-26, even TBL 2026-27 with 16 dates timed out.
- 8 s 500s: `season_id=eq.20262027&games_played=gt.0&order=id.asc&limit=200` from browsers/crawlers = web/pages/variance/skaters.tsx fetchSeasonSkaterRowsPage (not the player page).

## Read-only production queries run (EXPLAIN only, no ANALYZE)
- pg_indexes + pg_class: 2,257,972 rows, 2.2 GB heap, 2.8 GB total. No index leads on team_abbrev or season_id.
- Coverage EXPLAIN (TBL, 16 dates): Index Scan Backward on idx_wgo_skater_stats_date, Filter team_abbrev. ~450 league rows per date read and filtered.
- Variance EXPLAIN (season_id=20262027, gp>0, order id, limit 200): Index Scan on pkey with Filter, walks the whole table (cost 1.57M).
- Date-bounded + order (date, player_id) EXPLAIN, first page and keyset page: idx_wgo_skater_stats_date range + Incremental Sort, stops at limit.
- One bounded count on 4 dates: game_id is null before 2024, so a game_id-based coverage probe is not possible.

## Cause
1. Coverage: no (team_abbrev, date) index; every listed date reads the whole league's rows. Lists were one season (not career) but long when the page judged a past season against the player's CURRENT team (e.g. MIN 2018-19 for a player then elsewhere: every MIN game "missed").
2. Variance page: season_id filter + order=id + offset paging walks the PK across 2.2 GB; current-season rows are at the end.

## Fix (code)
- components/PlayerStats/boxScoreCoverage.ts: fetchTeamBoxScoreDates (8-date sequential chunks, limit 40/date, stop on first error -> null) used by SSR page and useMissedGames; resolveSeasonTeamId (season log team: current team if present/empty, else the one other team, else null).
- pages/stats/player/[playerId].tsx: coverage via helper; season log selects team_abbrev / team_abbreviation; missed games judged against resolveSeasonTeamId.
- hooks/useMissedGames.ts: coverage via helper (hook only runs when the page passes no missedGames).
- components/SkaterPage/seasonSkaterRows.ts + pages/variance/skaters.tsx: keyset paging on (date, player_id) inside seasonDateWindow; later pages 1000 rows.
- Migration DRAFT supabase/migrations/20261109210000_wgo_skater_stats_team_date_index.sql (order 123, pending); test counts 123 / pending 9; summary line 123.

## Checks
- Vitest: boxScoreCoverage, seasonSkaterRows, useMissedGames, playerId, playerIdCrossTab, playerStatsContract, supportedBaselineMigration: all pass (7 files).
- eslint on changed files: exit 0.
- npm run typecheck: exit 2, only 4 errors in scripts/player-summaries-* (player-rollback lane), none in this lane's files.

## Next / pending approvals
- TJ pop-up to apply the index by hand (CONCURRENTLY form in header), then readback indisvalid + ledger row.
- Chef releases code.
