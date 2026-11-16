# Rankings goalie/team matrix flags + goalie N/A diagnosis

## Scope
Why /rankings goalie + team matrices flag nearly every cell ("!" / "~") and why goalie metrics other than SV% read N/A since ~00:12 11-09. Side session of local_ed7b4c08. Do not touch superstyle-owned files (rankings.tsx, Rankings.module.scss, vars.scss, components/Rankings/*, rankingUrlState.ts, e2e/rankings.spec.ts).

## Where
octoberBranch, HEAD 483205af5. Codex lane (diary 2026-11-09-codex-rankings-matrix-integration.md) has uncommitted, finished patches in web/lib/rankings/goalieMatrix.ts(+test), teamMatrix.ts(+test).

## Findings (read-only, bounded SQL on prod)
- Page default season is 20252026 (rankingUrlState.ts DEFAULT_RANKINGS_FILTERS, superstyle-owned) although 2026-27 is live.
- goalie_stats_unified = view over matview internal_stats.goalie_stats_unified (materialized 2026-11-08 09:05). 2025-26: 2,940 rows, 281 lack NST 5v5: 1 on 12-09, 108 on 04-11..04-16 (regular season; NST has NO gamelog rows on those dates in any goalie table), and ~87 playoff rows 04-18..06-11 (WGO keeps playoff games under season_id 20252026; NST gamelogs are regular season only).
- NST goalie tables carry 98 rows dated 2026-04-17 (no games that day) with season-cumulative values (gp up to 64): wrong rows, not per-game.
- 2026-27: 584 rows, 3 lack NST: Hart + Bussi on 2026-06-14 (SCF playoff games mis-labelled 20262027) and Murray 2026-10-10 (no_nst_match).
- seasons table: 20252026 start 2025-10-07, regularSeasonEndDate 2026-04-17; 20262027 start 2026-09-29.
- Codex goalie patch: any row missing NST -> metric null for the whole window (intentional per its diary). With the April gap + playoffs, nearly every 2025-26 goalie loses every NST metric -> symptom 2. Pre-patch the same gap only added partial_* warnings -> symptom 1.
- Team: every row carries the permanent "raw_contextual_team_style" warning -> "!" on every cell. "~" fires when record.styleSnapshotDate != latestPowerDate; power snapshot D is built through D-1 games, so this is always off by >=1 day. Old code also took the latest power date across seasons (2026-11-08 vs 2025-26 style 2026-04-16); the Codex patch bounds it to the season.
- Team API slowness: team_unit_toi 2025-26 snapshot 2026-11-08 has 183,484 rows, read in 184 sequential offset pages ordered by game_date,id (no matching index).

## State
- Diagnosis complete. TJ pop-up: code fixes -> hand to Codex lane (no Claude edits); keep the complete-window policy and backfill; NST backfill written up for later, nothing run.
- Hand-over: tasks/artifacts/rankings-matrix-flags-2026-11-09/HANDOFF.md (copy in the shared notes folder); mailbox entry CLAUDE-RANKINGS-MATRIX-FLAGS-HANDOFF-20261109 in CLAUDE-TO-CODEX.md.
- Extra finding: Matt Murray 2026-10-10 NST row keyed to 8476899 (wrong Murray) instead of 8483575.
- No Vitest/typecheck run: no code changed.

- 11-09: TJ approved P1-P3. P1 blocked: the route is current-season only (clamps startDate; reverse = forward sweep; catchup current-season). P2/P3 dry counts OK (976 rows to delete; 10 Murray rows); the single transactional SQL call was declined at the tool prompt -> no DB change.

- Retried once on TJ's pop-up; declined again (the tool seems to block write SQL here). SQL saved for TJ: tasks/artifacts/rankings-matrix-flags-2026-11-09/p2-p3-nst-goalie-fix.sql. Proposed NST-lane card task_e166abbc (past-season season= param) for P1.

- NST lane (local_683992ec) committed 91dc3e5a4 (season= refill for completed seasons); waits for Chef's next batch release. Re-checked after an app restart: DB unchanged (98 rows on 04-17, 0 on 04-11..16, Murray not re-keyed, matview still 11-08 09:05).

- 11-09 ~02:15 UTC: P1 refill ran in the NST session after TJ re-approved (01:44-02:11 UTC). My SELECT check: 108 5v5_counts rows on 04-11..16, max gp 1, 0 WGO rows unmatched. The matview is not refreshed yet (still 11-08 09:05), so 108 view rows still lack NST until the next refresh. P2/P3 SQL still waits for TJ.

- 11-09 later: verified by SELECT. P2 done (0 rows dated 04-17 in all 10 tables; the expected count in the SQL file was corrected to 978, since 976 was my arithmetic slip). P3 done (Murray row under 8483575). Matview refreshed 02:45:46 UTC. Regular-season NST gaps in both seasons: 1 row (Blackwood 2025-12-09). Same-name goalie mapping fix released by the NST session (master a0354f891).

## Next
Data work done. Still open: the Codex lane's 3 code fixes (regular-season goalie window, team row warning, team stale rule) and the superstyle items (default season, '!' scoping).

## Gotchas
- update-nst-goalies incremental mode only handles the current season; a 2025-26 backfill needs reverse mode or the catchup path. NST lane is Claude-owned since TJ decision 2026-11-07.
