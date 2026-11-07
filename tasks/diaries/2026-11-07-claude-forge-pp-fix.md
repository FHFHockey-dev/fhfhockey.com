# 2026-11-07 Claude lane: forge-pp-fix

Scope: (1) FORGE derived strength labelling (situation.ts strengthForTeam + shootout exclusion, buildStrengthTablesV2),
(2) /api/toi PP TOI from forge toi_pp_seconds, (3) RC ref refs/rc/forge-pp-fix-20261107-01 (no push),
(4) size, not run, a build-projection-derived-v2 rebuild for 2025-26 + 2026-27. Chef = local_c4e6c533.
Source diagnosis: tasks/artifacts/data-checks-2026-11-07/RESULTS.md §7 (23d53b924).

## Decisions
- Strength = compare *effective* skaters: skaters minus one for a pulled goalie (the extra attacker).
  6v5 own goalie pulled -> es; 6v4 (pulled during a 5v4 PP) -> pp; PP team scoring into a shorthanded
  team's empty net (5v5 code, opp goalie 0) -> pp; 4v4 + pulled -> es. Matches NHL PPG/SHG convention.
- Shootout = periodtype "SO", or period >= 5 in preseason/regular-season game ids (type 01/02). Excluded from
  every bucket (shots, goals, assists). Same exclusion in buildGoalieGameV2 (shootout attempts inflated SA/GA too).
- shifts.ts has its own strength copy for TOI; untouched (toi_pp_seconds from shift_charts must not change).
- No DB reads: EDM fixtures built from the RESULTS §7 event table (codes 1560/0101), not live rows.

## State
- octoberBranch commit c7d3b58e3 (8 files: situation.ts/.test, buildStrengthTablesV2.ts/.test,
  buildGoalieGameV2.ts/.test, pages/api/toi.ts, __tests__/pages/api/toi.test.ts). Not pushed.
- /api/toi: PP TOI = forge toi_pp_seconds/60; share vs teamGameStats PP TOI of the team the player dressed for
  (old code keyed by date and could pick the opponent's row). skatersGameStats.powerPlayToi left alone.
- RC refs/rc/forge-pp-fix-20261107-01 = 1bdcf6e3e (parent origin/master 00ea36b39, merge-tree overlay; all 8
  touched files identical on master, so a clean overlay; imports present on master incl. forge types).
- Gate in clean git-archive export (scratchpad rc-forge-pp, git init, node_modules symlink):
  full Vitest 1223 files pass / 6 tests failed = timeouts under load (planning x2, planningReproducibility,
  ForecastExplorer, underlying-stats landing, update-line-sources); those 5 files re-run alone: 257/257 pass.
  npm run typecheck exit 0. eslint on 8 changed files exit 0.
- Sizing: side-session-notes/<chef>/forge-pp-fix-rebuild-sizing.md (estimates; no DB reads).
  Algorithm version deliberately NOT bumped (would flood the scheduled queue oldest-first).

## Next
- TJ pop-up on rebuild plan; report to Chef. Rebuild only after release.

## TJ pop-up 2026-11-07
- Rebuild: local background script after release (one date at a time, concurrency 1, stop on first failure).
- Exact-count SELECT approved. Q1 (read-only):
  select g."seasonId", g.type, min(g.date), max(g.date), count(distinct g.date) dates, count(*) games,
         count(*) filter (where s.derived_status = 'complete') derived_complete,
         sum(s.observed_player_rows) player_rows, sum(s.observed_team_rows) team_rows, sum(s.observed_goalie_rows) goalie_rows
  from games g left join projection_game_materialization_status s on s.game_id = g.id
  where g."seasonId" in (20252026, 20262027) and g.date <= '2026-11-06'
  group by 1,2 order by 1,2;
- Q1 run via Supabase MCP (project fyhftlxokyjtpndbkfse): "Connection terminated due to connection timeout" twice
  (connect-level, before execution). Not retried further; sizing stays estimated. Re-run Q1 before the rebuild.
- Reported to Chef. Lane waiting on release; rebuild script not written yet (after release, per TJ).
- Chef verified 1bdcf6e3e. Production Supabase down since ~23:03 UTC (TJ restarting): hold all queries until Chef
  says clear, then run Q1 once. No release or rebuild until Chef/TJ decide after DB is healthy.
- Q1 run once after the restart (30s timeout, OK). Only 258 games derived_complete: 2025-26 = 1 (playoffs);
  2026-27 = 257. 2025-26 forge rows come from a legacy writer; the current route would skip them
  (projection_inputs_unavailable). 2026-27 rebuild = 47 dates / 257 games. 2025-26 correction needs a TJ decision.
- TJ (via Chef): flag 2025-26 and fix 2026-27 only. Known-inflated note added to
  tasks/TASKS/forge-projections/context/forge-tables.md (player + team strength sections).
  2025-26 forge_*_game_strength PP goals/assists/shots are inflated (985 vs 789 PPG) and forge_goalie_game includes
  shootout attempts. They can't be rebuilt: legacy writer, no complete manifest, so the route skips them.
- My RC was merged into Chef's combined NST+FORGE candidate 457de21bf (gated by Chef).
- Next: wait for Chef's release signal, then run the 2026-27 rebuild with a local script, one date at a time
  09-19..11-06, stopping on the first failure. Check the connection count first and wait if it is > 40, with a short gap between dates.
- Rebuild script ready (not run): scratchpad rebuild-forge-derived-2026-27.ts. It mirrors processProjectionDerivedGame
  with the lib exports and checks pg_stat_activity through SUPABASE_DB_URL before each date (waits while > 40, gives up after 20 waits).
  It leaves a 3s gap between dates, skips projection_inputs_unavailable like the route, and stops on the first failure. The range is
  hard-bounded to 09-19..11-06. --plan checked locally in the RC export: 49 calendar dates, no DB calls.
  Run plan: export the released SHA, copy the script into web/scripts, and run it in the background with logs to the scratchpad.
- Release #415 is live (master a68f9b3d2; derived + toi files are identical to my RC). Clean export at scratchpad
  rel-a68f9b3d2 with the script copied in and env from web/.env.local via DOTENV_CONFIG_PATH. --plan with env: 49 dates, OK.
  Holding writes until Chef says "go" (data-checks rolling rebuild still running).
go from TJ in chat 2026-11-07T23:46:03Z; rebuild started
- Rebuild attempt 23:46Z stopped before any write: the pg guard hit getaddrinfo ENOTFOUND on db.<ref>.supabase.co
  (IPv6-only host, no A record). TJ (pop-up) chose a Codex handoff for the guard fix and the backfill:
  tasks/artifacts/forge-pp-fix-2026-11-07/CODEX-HANDOFF.md (+ script + REBUILD-SIZING.md). Lane is parked here.
