# Fix lane L4a — NST SQL views, migrations, NST game-log ingest (2026-11-11)

## Scope
Brief: tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/L4a.md. Owned: new supabase/migrations/20261111*_fix_*.sql, web/sql/functions/**, web/pages/api/v1/db/update-nst-gamelog.ts + tests. Local only; never apply.

## Where
Branch octoberBranch (sole checkout). Commits: 11589483b (parser F1 + claim line), 04d2dfd82 (8 migrations, proofs, rollbacks, authority rows 125-132), f36c85e88 (ratio dash NULL, D12 migration 133, row 120 note), e24ec520d (per-60 dash NULL), f066be4ce (L1 ticket: skater faceoffs/PP/SH TOI nullable, migration 134).

## State / checks
- Claim CLAUDE-FIX-L4a-CLAIM-20261111 appended to CLAUDE-TO-CODEX.md (no Codex claims on my paths in last 60 lines of CODEX-TO-CLAUDE.md).
- Chef granted migration-authority.json + supportedBaselineMigration.test.ts in the brief; super-goal summary count also bumped (test pins it).
- No production reads (brief grants none).

## Decisions
- Season views: keep rows with gp = 1 AND a type-2 game in the row's season on date_scraped (NHL regular-season and playoff dates never overlap; no team join, per the trap).
- Parser: quarantine rows whose GP != 1 or whose player-link scope (fromseason/thruseason/stype) contradicts the request; reject a URL whose fd/td differ from the requested date.

## Done so far
- F1 parser: committed 11589483b; vitest 108/108; new test failed on old parser (4 rows written vs 1).
- Migrations (uncommitted until Chef answers the authority-JSON question): 20261111180000 counts (regular season + gp=1 + complete support), 180100 rates (NULL unknowns, OZ/(OZ+DZ)), 180200 Game Score scope + D6 comment, 180300 avg stats type 2, 180400 nhl_team_data season identity (+nst_season, nst_updated_at), 180500 gameOutcomes level=NULL, 180600 goalie weekly NULLs.
- Proofs: supabase/tests/nst_seasonlong_l4a.py (24 checks fail on baseline, pass after; types unchanged; rollback OK), supabase/tests/l4a_sql_readers.py (9 checks x 2 NST orders; props kept; rollback OK). Rollbacks: supabase/tests/nst_seasonlong_l4a_rollback.sql, l4a_sql_readers_rollback.sql.
- Typecheck exit 2 only from L6's dirty fetchRollingPlayerAverages.ts; none in my files. ESLint clean.

## SQL ticket after close (L5 via Chef, W2-P0-9 / decision 10)
- Migration 135 20261111181000_fix_goalie_totals_nst_units_aggregate_gsaa.sql: goalie_totals_unified NST rates minutes x 60 -> seconds; GSAA (all/5v5/HD) = SA x league GA/SA (same season, strength, goalie first-to-last date) - GA; complete-support NULLs. Proof supabase/tests/l4a_goalie_totals.py exit 0; rollback l4a_goalie_totals_rollback.sql; authority row 135 (135 total, 21 pending); baseline test 21/21. Readers: none in app code; dependent matview goalie_totals_unified_snapshot (refresh = separate approval).

## SQL ticket from L4b (decision 15 radar)
- Migration 136 20261111181100_add_nst_seasonlong_5v5_views.sql: new nst_seasonlong_5v5_counts/_counts_oi/_rates = es siblings from 125/126 renamed; SELECT grants to anon/authenticated/service_role (default grants gone since 20261020224500). Proof supabase/tests/l4a_nst_5v5_views.py exit 0; rollback drops only the 3 views. Authority 136 (136 total, 22 pending); test 21/21.

## SQL ticket from L9a (W2-1 C8, successor to applied order 88)
- Migration 137 20261112090000_guard_forge_league_skater_physical_totals_cutoff.sql (commit 9fb3c5a91): 88's body plus `and p_cutoff >= make_date(p_season_id / 10000, 9, 1)` in bounds; out-of-window cutoff -> four zero rows. search_path '', revoke, service_role grant kept. Proof supabase/tests/l4a_physical_totals_cutoff.py exit 0 (starts from 88, local md5 = prod 4d70925b...; new md5 0eec9782543c02db802b021c950ecf6e). Rollback restores 88 body. Authority 137 (137 total, 22 pending); test 21/21.

## SQL ticket from L10 (decisions 41/78)
- Migration 138 20261112100000_add_forge_ledger_forecast_basis_and_universe.sql (commit 77bc8e6f8): ledger.forecast_basis text CHECK (unconditional|conditional_dressed), nullable, no backfill; new forge_served_forecast_universe (PK served_date, player_id, game_id; player/game bigint like the ledger; season/class/team NOT NULL like the ledger) with ledger's RLS + grants + set_updated_at trigger. Proof supabase/tests/l4a_ledger_basis_universe.py exit 0. Rollback drops table + column (revert flag first). Authority 138 (137 had been applied by Chef: 138 total, 88 applied, 22 pending); test 21/21.

## SQL ticket from L15 (rule 5, bef023fa8)
- Migration 139 20261112110000_player_forecast_season_expected_games_nullable.sql (commit 16c5c095a): DROP NOT NULL on expected_games in player_forecast_season_player_aggregates and _release_players; nothing else. Proof supabase/tests/l4a_expected_games_nullable.py exit 0. Rollback refuses while NULL rows exist (tables append-only, so permanent after first NULL). Authority 139 (139 total, 23 pending); test 21/21.
- Gotcha: roles are cluster-wide and CREATE DATABASE can't share a multi-statement execute.

## SQL ticket from L20 (decision 134, VDP v0.4)
- Migration 140 20261112120000_add_predictions_sko_vdp_view.sql (commit 049ca206b): security_invoker view predictions_sko_vdp = all table columns + stability_sd (stability_cv for BMA v0.2-v0.4, finite only; mirrors stabilitySdOf) + vdp (= sko). No table change, no backfill (Chef's ticket overrides DEFINITION.md's "backfill"). SELECT to anon/authenticated/service_role. Proof supabase/tests/l4a_predictions_sko_vdp.py exit 0. Rollback drops view. Authority 140 (140 total, 24 pending); test 21/21.

## Chef ticket: goalie_totals_unified regular season (decision 69)
- 135 applied in prod (82f643878) exposed playoff rows without NST blanking NST values (73/98 5v5 GAA, 53 GSAA in 2025-26).
- Migration 141 20261112130000_goalie_totals_unified_regular_season.sql (commit 730242f62): 135 body + game_data WHERE EXISTS games type 2 / "seasonId" / date (rule of 125); totals, NST sums, league window all regular season. Proof l4a_goalie_totals.py extended (goalie 5 playoff rows, goalie 6 playoff-only; phases baseline -> 135 -> 141 -> rollback 141 -> rollback 135) exit 0. Rollback file restores 135 body. Authority 141 (141 total, 103 applied, 10 pending); test 21/21.
- 8480843's missing regular-season NST (2025-12-13) still blanks it (rule 13).

## Follow-up tickets (decisions 135, 138; claim CLAUDE-FIX-SPRINT-FOLLOWUP-CLAIM-20261113), commit e0dea7205
- 142 20261113090000_player_forecast_accountability_v2_skill.sql: nullable v2_skill numeric (<= 1, not NaN) on player_forecast_accountability_revisions; composite NOT NULL 0-100 untouched. Proof l4a_accountability_v2_skill.py exit 0. Rollback refuses once a v2 value is stored (append-only). Note: v2 writers must still supply a 0-100 composite (NOT NULL kept by decision).
- 143 20261113090100_percent_games_team_of_record_by_date.sql: 133 successor; multi-team percent_games = GP / sum of team stints' games (stint starts at first game for team; open last stint = ts GP - games before). Proof l4a_percent_games_tor.py exit 0 incl. seqscan-off index-probe check. Rollback = 133 views.
- Authority 142-143 pending (143 total, 104 applied, 11 pending); test 21/21.

## Next
ddf9c1669 verified by Chef; 135 and the snapshot refresh queued for TJ as separate approvals. Lane closed again. 01fbee34c (136) verified by Chef; queued for TJ before or with the L4b release. Lane closed again. 9fb3c5a91 (137) applied by Chef (1244512f9). 77bc8e6f8 (138) verified by Chef (bigint ids and NOT NULL accepted); queued for TJ, revert LEDGER_BASIS_SCHEMA_ENABLED before any rollback. Lane closed again. 16c5c095a (139) sent to Chef. 049ca206b (140) sent to Chef. 730242f62 (141) sent to Chef. e0dea7205 (142, 143) sent to Chef. Keep diary until the debrief records SHAs and apply plan.

## Gotchas
- CREATE OR REPLACE FUNCTION resets proconfig: keep 20260731035012's search_path.
- Unquoted heredocs expand $$ (PID) - use quoted heredocs for SQL/regex.
- Synthetic test HTML in update-nst-gamelog.test.ts has no GP column; real NST pages always do.
