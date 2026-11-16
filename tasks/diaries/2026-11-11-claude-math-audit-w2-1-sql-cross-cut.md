# W2-1 SQL cross-cut math audit (Claude)

- Scope: audit every computing SQL function/view listed in TRIAGE section 2 "SQL cross-cut"; report only, no code changes.
- Where: octoberBranch; output `tasks/artifacts/calculation-inventory-2026-11-10/master/audits/sql-cross-cut.md`.
- State (11-11): started; reading binding context.
- Next: extract entry records from packets, catalog reads, repo diff, readers.
- Blockers: none.
- Gotchas: DB read-only, check pg_stat_activity before heavier reads; no jsonb reads.
- Checkpoint (11-11, evidence done): catalog hashes match repo for all baseline views/functions; not deployed: mock_draft_* (20260917133519), forge_league_skater_physical_totals (20261020211500), player_baselines_3yr, sql/001 matview, sustainability_sigma_constants. Key findings: nst_seasonlong_* mix playoff rows; nhl_team_data 3 rows/team; wgo season_id 20242025 holds 2010-2017 rows; legacy goal views live via cron 390.
- Next: write report, commit only the report.
- Done (11-11): report committed on octoberBranch (not pushed). Verdicts 7 sound / 26 mis-specified / 17 wrong / 2 undetermined. Open: 7 owner questions in the report's section 4. Diary can be retired once Chef consolidates Wave 2.
