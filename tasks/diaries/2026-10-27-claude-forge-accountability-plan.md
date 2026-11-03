# FORGE accountability table — plan (Claude)

- Scope: plan only (no code, migrations, prod writes, deploys) for a page showing FORGE projections vs actuals: by date, per-game vs totals, variance, projection drift across issue dates.
- Where: octoberBranch, shared checkout; only new files: this diary + `tasks/` plan file. Commit nothing.
- State: started 2026-10-27; reading forge routes/libs.
- Next: locate projection storage + revision history, actuals, scoring join.
- Blockers: read-only Supabase queries need TJ OK.
- Gotchas: FORGE must never read draft-dashboard PROJECTIONS_* tables.

## Checkpoint 1 (code research done)
- Grade source: `forge_served_forecast_ledger` (one row per served_date × player × game × source; snapshot cron 12:30 UTC game day only; settle cron 11:00 UTC; exp_/act_ per stat + fantasy points with DEFAULT weights). Existing read: `/api/v1/forge/scoreboard` (service role, 120k-row cap).
- Drift source: `forge_player_projections` / `forge_goalie_projections` keyed (run_id, game_id, player, horizon_games); each run keeps rows; no pruning found. `forge_game_revisions` (run_id, game_id, decision_as_of) + `forge_final_pregame_revisions`.
- Legacy: `forge_projection_results` (latest run per date, horizon 1, predicted_fp/actual_fp).
- TJ answers (pop-up): DB reads OK (read-only); grade = what RSO showed (ledger); scoring = default league; audience = PUBLIC page.
- Next: read-only sizing queries, then write plan.

## Checkpoint 2 (plan written)
- Read-only sizing (4 SELECTs via Supabase MCP, TJ OK): ledger 3.9k rows since 2026-10-22; forge_player_projections 37k rows, 1 issue date/game (game-day only) → drift needs new capture; 105 run dates lost their rows (unexplained, out of scope).
- TJ pop-up 2: 4 drift checkpoints (D-6/-3/-1/0); start at Oct 22; no-shows counted separately; show naive_last5 baseline.
- Deliverable: `tasks/prd-forge-accountability-table.md`. Nothing committed.
- Next: Chef/TJ approve phase 1 (no migration) → implementation session.

## Checkpoint 3 (TJ clarification via orchestrator)
- TJ: standalone page, leads with overall model accuracy (error/bias, trend, calibration); the per-player table is the drill-down; purpose is public accountability. Plan restructured (Goal, UI sections 1/2, `overview` API view, delivery step 1, open item 4 on scoreboard view vs checkpoints). Still planning only, uncommitted.
