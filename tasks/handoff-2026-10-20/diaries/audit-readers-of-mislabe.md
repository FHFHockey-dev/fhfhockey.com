# Handoff diary: audit readers of mislabelled `wgo_skater_stats.season_id` (2026-10-19)

## 1. Scope
- I did a read-only code audit, started by session `local_c39098ae-…` and continuing the `forge-hits-blocks-recenc` (`local_d181f1c6-…`) `_3ya` inflation diagnosis.
- No formal task ID was assigned.
- **Goal:** list every reader that filters or groups `wgo_skater_stats` by `season_id` without bounding by `date`. The aim was to cover the planned production `season_id` repair: about 253,257 rows dated 2010-12-20 → 2017-01-16, plus 105 rows dated 1959/1967, carry `season_id = 20242025`.

## 2. Where
- **Checkout:** `/Users/tim/Code/fhfhockey.com` on `octoberBranch`, at HEAD `8a6ac8adc` when the session started. I did not switch branches.
- **Files touched:** none in the repo, apart from this diary.
- **Findings note:** `/Users/tim/Library/Application Support/Claude/side-session-notes/local_d181f1c6-dfc5-4ea8-aa10-cfc6cd89d06d/wgo-season-id-consumers-2026-10-19.md`
- **Input note:** `sidecar-3ya-inflation-diagnosis-2026-10-19.md`, in the same folder.

## 3. State
- **Done:** a ranked findings note with file:line references, a recompute/refresh list, and a one-line repair verdict per reader.
- Nothing was committed, released or deployed.
- **Checks run:** `rg` and `sed` over the code only. I made no production or Supabase queries and ran no tests, because the task was read-only.
- **Key results:**
  - **Rolling writer** (`web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:3306`, reads at :2907 and :3016):
    - This is the only reader whose bad output is persisted, in `rolling_player_game_metrics`.
    - It feeds the FORGE hits/blocks `_3ya` priors (`skater-queries.ts:128-131`, `skater-adjustments.ts:477-480`) and the trends player page sidecar.
    - The data repair alone is not enough. It needs a recompute plus the writer guard.
  - **Readers the data repair alone fixes, because they read live:**
    - `/stats/player/[id]?season=20242025`: `[playerId].tsx:992`. It gives inflated season stats and game log when 2024-25 is selected; the default season is 2026-27.
    - WiGO game-log charts and RPC `get_skater_game_scores_for_season`. These are latent, because callers pass the current season, 20262027.
    - `check-rolling-player-coverage --season`
    - Legacy SKO views and RPC, which only carry wrong labels.
    - Dead hooks: `usePlayerStats`, `useWGOPlayerStats`, `fetchLegacySkoGameLogs`.
    - `performance_prediction.py`
  - **Not affected:**
    - `player_stats_unified` and `player_totals_unified` filter `date >= 2023-01-01`. So sustainability, `player_trend_metrics`, ML and impact ratings are clean.
    - `opponent_skater_allowed_by_position` is bounded to the last 500 days.
    - `mv_team_stats_nst_wgo` doesn't read `wgo_skater_stats` at all.

## 4. Next
- I had no planned next task; the audit is complete.
- **Suggested first step for the owner of the repair:** fold the findings note's "recompute and refresh list" into the repair plan.
  - **Required:** a bounded `rolling_player_game_metrics` recompute for 2026-27.
  - **Optional:** a historical recompute, and a refresh of `player_gamelogs_unified`.

## 5. Blocked / needs TJ
- **The production `season_id` data repair** is a production write and needs TJ's approval.
- **The bounded rolling recompute run** is a production route run and needs TJ's approval.
- **Whether to recompute history** (2024-25, 2025-26 and 2010–2019 rolling rows) is a separate decision for TJ.
- **The writer guard release** needs a release or deploy approval.

## 6. Insights
- **Correction:** the diagnosis note says to "refresh `mv_team_stats_nst_wgo`" after the repair. That's unnecessary: the MV reads `vw_team_stats_nst_wgo`, which reads `wgo_team_stats` and `nst_team_all` (baseline :12820, :12866, :13029).
- **This is the second time** rows have been wrongly labelled 20242025. The first was 1,905 rows from April 2023, repaired by `supabase/migrations/20260731015416_repair_wgo_player_season_identity.sql` and `web/scripts/repair-wgo-player-season-identity.ts`.
  - A guard in the rolling writer only protects that writer.
  - A DB-level check that `season_id` matches `date`, or an assertion at WGO ingestion (`update-wgo-skaters.ts`), would protect every reader.
- **The 105 rows dated 1959/1967** look like bad dates, not bad labels, so they need their own date fix.
- **`check-rolling-player-coverage --season 20242025` counts are inflated** until the repair. Don't use it to verify the recompute before then.
- **`player_gamelogs_unified` loses mislabelled rows rather than inflating**, because of its inner join on the NST season. Nothing in the code reads it.
