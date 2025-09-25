# PRD: sKO Charts — Player Evaluation and Prediction

## 1) Purpose
- Provide a clear, reproducible method to evaluate per-game player performance and stabilize predictions by leveraging consistency (CV) from characteristic game patterns.
- Reflect insights from the Top Scorers Relationship Analysis in our sKO calculation and charting.

## 2) Background & Key Findings
- Ranking by points percentile (by position group F vs D) across seasons highlights features most associated with top scorers.
- Non-recursive metrics (excluding direct G/A/PTS and their rate variants) reveal drivers vs. outcomes more reliably.
- Share-style percentages (e.g., GF%, CF%) are best centered around neutral baselines and split into positive vs negative magnitudes to capture asymmetry.
- Context alignment matters: AS ↔ AS, PP ↔ PP, 5v5 ↔ 5v5, ES ↔ ES metrics correlate more cleanly with the corresponding point totals.
- Z-scoring and Top 5% vs Rest views expose robust differences and effect sizes beyond simple correlation.

Implication for sKO: Use an underlying game performance score (GameScore) but modulate predictions based on how characteristic the player’s performance has been recently (rolling CV vs thresholds).

## 3) Current Architecture (Relevant Files)
- `web/pages/skoCharts.tsx` — UI and prediction plumbing
- `web/lib/supabase/utils/statistics.ts` — summaries, characteristic scoring, thresholds, rolling & confidence helpers
- `web/lib/supabase/utils/calculations.ts` — base `calculateGameScore()`

## 4) sKO Metric Definition
- Base score per game: `GameScore = f(G, A1, A2, SOG, BLK, PD, PT, FOW, FOL, CF, CA, GF, GA)` (current linear weights in `calculateGameScore`).
- Characteristic Value (CV): weighted sum of squared capped z-scores across rated stats per game.
- Rolling CV: 10-game rolling average of CV.
- Confidence Multiplier: smooth function mapping rolling CV to [0.8, 1.0] using a smoothstep between T1 and T2 thresholds.
- sKO (stability-adjusted score): `sKO = GameScore × ConfidenceMultiplier`.

Notes:
- T1, T2 baselines derive from analytic expectations and are refined empirically each query using median (p50) and p90 of observed CV for that player’s timeline.
- Smoothstep ensures continuity (no harsh jumps) when confidence shifts.

## 5) User Flows
- User selects a player (autocomplete from `sko_skater_years`).
- System fetches most recent season, pulls game logs, computes:
  - Per-stat summaries and characteristic results per game
  - Empirical thresholds T1 (p50) and T2 (p90)
  - Rolling CV (window=10)
  - Smooth confidence multiplier per game
  - GameScore, PredictedGameScore, and sKO
- UI renders:
  - CV over time with thresholds
  - GameScore and predicted GameScore/ sKO trends
  - Game log table including computed fields

## 6) Changes Implemented
- `statistics.ts`:
  - Added `computeRollingAverage(values, window)` utility.
  - Added `computeConfidenceMultiplierSmooth(rollingCV, T1, T2, {min, max})` using smoothstep.
  - Added `computeEmpiricalThresholds(results, p1=0.5, p2=0.9)` for robust T1/T2.
- `skoCharts.tsx`:
  - Uses empirical thresholds to set effective T1/T2 displayed and applied.
  - Computes rolling CV once and applies smooth confidence function.
  - Exposes `sKO` per game as stability-adjusted predicted score.
- `calculations.ts`:
  - No change to baseline `calculateGameScore` weights (kept stable reference model).

## 7) Future Enhancements (Optional)
- Context-aware GameScore variants (AS/PP/5v5/ES) and their own context-specific sKO panels.
- Incorporate centered share metrics into characteristic scoring, splitting positive/negative magnitudes for asymmetry.
- Season-aware normalization for CV and thresholds.
- Alternate windows (e.g., 5/15 games) with adaptive choice based on games played.
- Add Top X% vs Rest highlights to UI (effect sizes) and z-score panels.

## 8) Acceptance Criteria
- sKO pipeline:
  - Rolling CV uses window size 10; no crashes on fewer than 10 games (uses partial-window average).
  - Confidence multiplier ranges [0.8, 1.0]; smooth transition between T1 and T2.
  - Effective thresholds use empirical p50 and p90 if finite; otherwise fall back to analytical T1/T2.
  - `sKO` is available in the processed game logs and used for predicted game score line.
- UI:
  - Thresholds visible on the CV line chart.
  - GameScore and predicted GameScore/ sKO are plotted for selected player without errors.

## 9) Open Questions
- Should baseline GameScore weights be re-estimated with context-specific regression?
- Do we want separate visualizations for PP/5v5/ES sKO trends?
- Where to expose centered share asymmetry insights directly in the player page?

## 10) Operational Notes
- Outputs depend on Supabase `sko_skater_years` and game log fetchers; handle paging and network errors gracefully.
- All new utilities are pure and unit-testable; future tests should cover rolling averages, empirical quantiles, and smoothstep mapping.

### SQL tables:
#### player_stats_unified:
```sql

 WITH game_data AS (
         SELECT w.player_id,
            w.season_id,
            p.team_id,
            w.player_name,
            w.position_code,
            w.shoots_catches,
            w.date,
            w.games_played,
            w.points,
            w.goals,
            w.assists,
            w.shots,
            w.plus_minus,
            w.gw_goals,
            w.pp_points,
            w.sh_points,
            w.penalty_minutes,
            w.hits,
            w.blocked_shots,
            w.takeaways,
            w.giveaways,
            w.d_zone_faceoffs,
            w.ev_faceoffs,
            w.n_zone_faceoffs,
            w.o_zone_faceoffs,
            w.total_faceoffs,
            w.total_fol,
            w.total_fow,
            w.es_goals_against,
            w.es_goals_for,
            w.pp_assists,
            w.pp_goals,
            w.pp_goals_against,
            w.pp_goals_for,
            w.pp_individual_sat_for,
            w.pp_primary_assists,
            w.pp_secondary_assists,
            w.pp_shots,
            w.sh_assists,
            w.sh_goals,
            w.sh_primary_assists,
            w.sh_secondary_assists,
            w.sh_shots,
            w.penalties,
            w.penalties_drawn,
            w.assists_5v5,
            w.goals_5v5,
            w.points_5v5,
            w.primary_assists_5v5,
            w.secondary_assists_5v5,
            w.total_primary_assists,
            w.total_secondary_assists,
            w.shifts,
            w.missed_shots,
            w.toi_per_game,
            w.es_toi_per_game,
            w.pp_toi,
            w.sh_time_on_ice,
            w.ev_time_on_ice,
            w.toi_per_game_5v5,
            nc.toi AS nst_toi,
            nc.first_assists AS nst_first_assists,
            nc.second_assists AS nst_second_assists,
            nc.ixg AS nst_ixg,
            nc.icf AS nst_icf,
            nc.iff AS nst_iff,
            nc.iscfs AS nst_iscfs,
            nc.hdcf AS nst_hdcf,
            nc.rush_attempts AS nst_rush_attempts,
            nc.rebounds_created AS nst_rebounds_created,
            nc.penalties_drawn AS nst_penalties_drawn,
            nc.hits_taken AS nst_hits_taken,
            nc.faceoffs_won AS nst_faceoffs_won,
            nc.faceoffs_lost AS nst_faceoffs_lost,
            nco.cf AS nst_oi_cf,
            nco.ca AS nst_oi_ca,
            nco.ff AS nst_oi_ff,
            nco.fa AS nst_oi_fa,
            nco.sf AS nst_oi_sf,
            nco.sa AS nst_oi_sa,
            nco.gf AS nst_oi_gf,
            nco.ga AS nst_oi_ga,
            nco.xgf AS nst_oi_xgf,
            nco.xga AS nst_oi_xga,
            nco.scf AS nst_oi_scf,
            nco.sca AS nst_oi_sca,
            nco.hdcf AS nst_oi_hdcf,
            nco.hdca AS nst_oi_hdca,
            nco.hdgf AS nst_oi_hdgf,
            nco.hdga AS nst_oi_hdga,
            nco.mdcf AS nst_oi_mdcf,
            nco.mdca AS nst_oi_mdca,
            nco.mdgf AS nst_oi_mdgf,
            nco.mdga AS nst_oi_mdga,
            nco.ldcf AS nst_oi_ldcf,
            nco.ldca AS nst_oi_ldca,
            nco.ldgf AS nst_oi_ldgf,
            nco.ldga AS nst_oi_ldga,
            nco.off_zone_starts AS nst_oi_off_zone_starts,
            nco.neu_zone_starts AS nst_oi_neu_zone_starts,
            nco.def_zone_starts AS nst_oi_def_zone_starts,
            w.d_zone_faceoffs::double precision * w.d_zone_fo_percentage AS d_zone_fow,
            w.ev_faceoffs::double precision * w.ev_faceoff_percentage AS ev_fow,
            w.n_zone_faceoffs::double precision * w.n_zone_fo_percentage AS n_zone_fow,
            w.o_zone_faceoffs::double precision * w.o_zone_fo_percentage AS o_zone_fow,
            w.pp_toi::double precision / NULLIF(w.pp_toi_pct_per_game, 0::double precision) AS team_pp_toi,
            nc.player_id IS NOT NULL AS has_nst_counts,
            nco.player_id IS NOT NULL AS has_nst_counts_oi,
            nr.player_id IS NOT NULL AS has_nst_rates,
            nro.player_id IS NOT NULL AS has_nst_rates_oi
           FROM wgo_skater_stats w
             LEFT JOIN players p ON w.player_id = p.id
             LEFT JOIN nst_gamelog_as_counts nc ON w.player_id = nc.player_id AND w.date = nc.date_scraped AND w.season_id = nc.season
             LEFT JOIN nst_gamelog_as_counts_oi nco ON w.player_id = nco.player_id AND w.date = nco.date_scraped AND w.season_id = nco.season
             LEFT JOIN nst_gamelog_as_rates nr ON w.player_id = nr.player_id AND w.date = nr.date_scraped AND w.season_id = nr.season
             LEFT JOIN nst_gamelog_as_rates_oi nro ON w.player_id = nro.player_id AND w.date = nro.date_scraped AND w.season_id = nro.season
          WHERE w.games_played = 1 AND w.date >= '2023-01-01'::date AND w.player_id IS NOT NULL AND w.date IS NOT NULL
        )
 SELECT agg.player_id,
    agg.season_id,
    max(agg.player_name) AS player_name,
    array_agg(DISTINCT agg.team_id) AS team_ids,
    max(agg.position_code) AS position_code,
    max(agg.shoots_catches) AS shoots_catches,
    sum(agg.games_played) AS games_played,
    sum(agg.points) AS points_all_situations,
    sum(agg.goals) AS goals_all_situations,
    sum(agg.assists) AS assists_all_situations,
    sum(agg.shots) AS shots_all_situations,
    sum(agg.plus_minus) AS plus_minus,
    sum(agg.gw_goals) AS gw_goals,
    sum(agg.pp_points) AS pp_points,
    sum(agg.sh_points) AS sh_points,
    sum(agg.penalty_minutes) AS penalty_minutes,
    sum(agg.hits) AS hits,
    sum(agg.blocked_shots) AS blocked_shots,
    sum(agg.takeaways) AS takeaways,
    sum(agg.giveaways) AS giveaways,
    sum(agg.total_faceoffs) AS total_faceoffs,
    sum(agg.total_fol) AS total_fol,
    sum(agg.total_fow) AS total_fow,
    sum(agg.es_goals_against) AS es_goals_against,
    sum(agg.es_goals_for) AS es_goals_for,
    sum(agg.pp_assists) AS pp_assists,
    sum(agg.pp_goals) AS pp_goals,
    sum(agg.sh_assists) AS sh_assists,
    sum(agg.sh_goals) AS sh_goals,
    sum(agg.penalties) AS penalties,
    sum(agg.penalties_drawn) AS penalties_drawn,
    sum(agg.shifts) AS shifts,
    sum(agg.missed_shots) AS missed_shots,
    sum(agg.toi_per_game) AS toi_all_situations,
    sum(agg.ev_time_on_ice) AS toi_ev,
    sum(agg.es_toi_per_game) AS toi_es,
    sum(agg.pp_toi) AS toi_pp,
    sum(agg.sh_time_on_ice) AS toi_sh,
    sum(agg.toi_per_game_5v5) AS toi_5v5,
    sum(agg.goals)::numeric / NULLIF(sum(agg.shots), 0)::numeric AS shooting_pct_all_situations,
    sum(agg.total_fow)::numeric / NULLIF(sum(agg.total_faceoffs), 0)::numeric AS fow_pct_all_situations,
    sum(agg.d_zone_fow)::numeric / NULLIF(sum(agg.d_zone_faceoffs), 0)::numeric AS d_zone_fo_pct,
    sum(agg.ev_fow)::numeric / NULLIF(sum(agg.ev_faceoffs), 0)::numeric AS ev_faceoff_pct,
    sum(agg.n_zone_fow)::numeric / NULLIF(sum(agg.n_zone_faceoffs), 0)::numeric AS n_zone_fo_pct,
    sum(agg.o_zone_fow)::numeric / NULLIF(sum(agg.o_zone_faceoffs), 0)::numeric AS o_zone_fo_pct,
    sum(agg.es_goals_for)::numeric / NULLIF(sum(agg.es_goals_for) + sum(agg.es_goals_against), 0)::numeric AS es_gf_pct,
    sum(agg.pp_goals)::numeric / NULLIF(sum(agg.pp_shots), 0)::numeric AS pp_shooting_pct,
    sum(agg.sh_goals)::numeric / NULLIF(sum(agg.sh_shots), 0)::numeric AS sh_shooting_pct,
    sum(agg.pp_toi)::numeric::double precision / NULLIF(sum(agg.team_pp_toi), 0::double precision) AS pp_toi_pct_of_team,
    sum(agg.toi_per_game)::numeric / NULLIF(sum(agg.games_played), 0)::numeric AS avg_toi_per_game_all_situations,
    sum(agg.es_toi_per_game)::numeric / NULLIF(sum(agg.games_played), 0)::numeric AS avg_es_toi_per_game,
    sum(agg.toi_per_game)::numeric / NULLIF(sum(agg.shifts), 0)::numeric AS avg_toi_per_shift,
    sum(agg.pp_goals_for)::numeric * 3600.0 / NULLIF(sum(agg.pp_toi), 0)::numeric AS pp_gf_per_60,
    sum(agg.pp_goals)::numeric * 3600.0 / NULLIF(sum(agg.pp_toi), 0)::numeric AS pp_g_per_60,
    sum(agg.pp_points)::numeric * 3600.0 / NULLIF(sum(agg.pp_toi), 0)::numeric AS pp_p_per_60,
    sum(agg.pp_shots)::numeric * 3600.0 / NULLIF(sum(agg.pp_toi), 0)::numeric AS pp_s_per_60,
    sum(agg.sh_goals)::numeric * 3600.0 / NULLIF(sum(agg.sh_time_on_ice), 0)::numeric AS sh_g_per_60,
    (sum(agg.goals_5v5)::numeric * 3600.0)::double precision / NULLIF(sum(agg.toi_per_game_5v5), 0::double precision) AS g_per_60_5v5,
    (sum(agg.assists_5v5)::numeric * 3600.0)::double precision / NULLIF(sum(agg.toi_per_game_5v5), 0::double precision) AS a_per_60_5v5,
    (sum(agg.points_5v5)::numeric * 3600.0)::double precision / NULLIF(sum(agg.toi_per_game_5v5), 0::double precision) AS p_per_60_5v5,
    sum(agg.nst_toi) AS nst_toi_all_situations,
    sum(agg.nst_ixg) AS nst_ixg_all_situations,
    sum(agg.nst_icf) AS nst_icf_all_situations,
    sum(agg.nst_iff) AS nst_iff_all_situations,
    sum(agg.nst_iscfs) AS nst_iscfs_all_situations,
    sum(agg.nst_hdcf) AS nst_hdcf_all_situations,
    sum(agg.nst_rush_attempts) AS nst_rush_attempts_all_situations,
    sum(agg.nst_rebounds_created) AS nst_rebounds_created_all_situations,
    sum(agg.nst_penalties_drawn) AS nst_penalties_drawn_all_situations,
    sum(agg.nst_hits_taken) AS nst_hits_taken_all_situations,
    sum(agg.nst_faceoffs_won) AS nst_faceoffs_won_all_situations,
    sum(agg.nst_faceoffs_lost) AS nst_faceoffs_lost_all_situations,
    sum(agg.nst_oi_cf) AS nst_oi_cf_5v5,
    sum(agg.nst_oi_ca) AS nst_oi_ca_5v5,
    sum(agg.nst_oi_ff) AS nst_oi_ff_5v5,
    sum(agg.nst_oi_fa) AS nst_oi_fa_5v5,
    sum(agg.nst_oi_sf) AS nst_oi_sf_5v5,
    sum(agg.nst_oi_sa) AS nst_oi_sa_5v5,
    sum(agg.nst_oi_gf) AS nst_oi_gf_5v5,
    sum(agg.nst_oi_ga) AS nst_oi_ga_5v5,
    sum(agg.nst_oi_xgf) AS nst_oi_xgf_5v5,
    sum(agg.nst_oi_xga) AS nst_oi_xga_5v5,
    sum(agg.nst_oi_scf) AS nst_oi_scf_5v5,
    sum(agg.nst_oi_sca) AS nst_oi_sca_5v5,
    sum(agg.nst_oi_hdcf) AS nst_oi_hdcf_5v5,
    sum(agg.nst_oi_hdca) AS nst_oi_hdca_5v5,
    sum(agg.nst_oi_hdgf) AS nst_oi_hdgf_5v5,
    sum(agg.nst_oi_hdga) AS nst_oi_hdga_5v5,
    sum(agg.nst_oi_off_zone_starts) AS nst_oi_off_zone_starts_5v5,
    sum(agg.nst_oi_neu_zone_starts) AS nst_oi_neu_zone_starts_5v5,
    sum(agg.nst_oi_def_zone_starts) AS nst_oi_def_zone_starts_5v5,
    (sum(agg.goals) + sum(agg.nst_first_assists) + sum(agg.nst_second_assists))::numeric / NULLIF(sum(agg.nst_oi_gf), 0)::numeric AS nst_ipp_all,
    sum(agg.nst_oi_cf)::numeric / NULLIF(sum(agg.nst_oi_cf) + sum(agg.nst_oi_ca), 0)::numeric AS nst_oi_cf_pct_all,
    sum(agg.nst_oi_ff)::numeric / NULLIF(sum(agg.nst_oi_ff) + sum(agg.nst_oi_fa), 0)::numeric AS nst_oi_ff_pct_all,
    sum(agg.nst_oi_sf)::numeric / NULLIF(sum(agg.nst_oi_sf) + sum(agg.nst_oi_sa), 0)::numeric AS nst_oi_sf_pct_all,
    sum(agg.nst_oi_gf)::numeric / NULLIF(sum(agg.nst_oi_gf) + sum(agg.nst_oi_ga), 0)::numeric AS nst_oi_gf_pct_all,
    sum(agg.nst_oi_xgf)::numeric::double precision / NULLIF(sum(agg.nst_oi_xgf) + sum(agg.nst_oi_xga), 0::double precision) AS nst_oi_xgf_pct_all,
    sum(agg.nst_oi_scf)::numeric / NULLIF(sum(agg.nst_oi_scf) + sum(agg.nst_oi_sca), 0)::numeric AS nst_oi_scf_pct_all,
    sum(agg.nst_oi_hdcf)::numeric / NULLIF(sum(agg.nst_oi_hdcf) + sum(agg.nst_oi_hdca), 0)::numeric AS nst_oi_hdcf_pct_all,
    sum(agg.nst_oi_hdgf)::numeric::double precision / NULLIF(sum(agg.nst_oi_hdgf)::double precision + sum(agg.nst_oi_hdga), 0::double precision) AS nst_oi_hdgf_pct_all,
    sum(agg.nst_oi_mdcf)::numeric / NULLIF(sum(agg.nst_oi_mdcf) + sum(agg.nst_oi_mdca), 0)::numeric AS nst_oi_mdcf_pct_all,
    sum(agg.nst_oi_mdgf)::numeric / NULLIF(sum(agg.nst_oi_mdgf) + sum(agg.nst_oi_mdga), 0)::numeric AS nst_oi_mdgf_pct_all,
    sum(agg.nst_oi_gf)::numeric / NULLIF(sum(agg.nst_oi_sf), 0)::numeric AS nst_oi_shooting_pct_all,
    (sum(agg.nst_oi_sa) - sum(agg.nst_oi_ga))::numeric / NULLIF(sum(agg.nst_oi_sa), 0)::numeric AS nst_oi_save_pct_all,
    sum(agg.nst_oi_gf)::numeric / NULLIF(sum(agg.nst_oi_sf), 0)::numeric + (sum(agg.nst_oi_sa) - sum(agg.nst_oi_ga))::numeric / NULLIF(sum(agg.nst_oi_sa), 0)::numeric AS nst_oi_pdo_all,
    sum(agg.nst_oi_off_zone_starts)::numeric / NULLIF(sum(agg.nst_oi_off_zone_starts) + sum(agg.nst_oi_def_zone_starts), 0)::numeric AS nst_oi_off_zone_start_pct_all,
    sum(agg.goals)::numeric * 3600.0 / NULLIF(sum(agg.nst_toi), 0)::numeric AS nst_g_per_60_all_situations,
    sum(agg.nst_first_assists + agg.nst_second_assists)::numeric * 3600.0 / NULLIF(sum(agg.nst_toi), 0)::numeric AS nst_a_per_60_all_situations,
    sum(agg.goals + agg.nst_first_assists + agg.nst_second_assists)::numeric * 3600.0 / NULLIF(sum(agg.nst_toi), 0)::numeric AS nst_p_per_60_all_situations,
    sum(agg.shots)::numeric * 3600.0 / NULLIF(sum(agg.nst_toi), 0)::numeric AS nst_s_per_60_all_situations,
    sum(agg.nst_ixg) * 3600.0::double precision / NULLIF(sum(agg.nst_toi), 0)::double precision AS nst_ixg_per_60_all_situations,
    sum(agg.nst_icf)::numeric * 3600.0 / NULLIF(sum(agg.nst_toi), 0)::numeric AS nst_icf_per_60_all_situations,
    sum(agg.nst_iff)::numeric * 3600.0 / NULLIF(sum(agg.nst_toi), 0)::numeric AS nst_iff_per_60_all_situations,
    sum(agg.nst_iscfs)::numeric * 3600.0 / NULLIF(sum(agg.nst_toi), 0)::numeric AS nst_iscfs_per_60_all_situations,
    sum(agg.nst_hdcf)::numeric * 3600.0 / NULLIF(sum(agg.nst_toi), 0)::numeric AS nst_hdcf_per_60_all_situations,
    bool_or(agg.has_nst_counts) AS has_nst_counts,
    bool_or(agg.has_nst_counts_oi) AS has_nst_counts_oi,
    bool_or(agg.has_nst_rates) AS has_nst_rates,
    bool_or(agg.has_nst_rates_oi) AS has_nst_rates_oi,
    CURRENT_TIMESTAMP AS materialized_at
   FROM game_data agg
  GROUP BY agg.player_id, agg.season_id;
  ```

## 11) Population Plan for `predictions_sko`
- Populate via Next.js API endpoint (no SQL/materialized views): `GET /api/v1/ml/update-predictions-sko`.
- Params:
  - `asOfDate` (YYYY-MM-DD, default: today)
  - `horizon` (default: 5)
  - `lookbackDays` (default: 120)
  - `stabilityWindow` (default: 10)
  - `limitPlayers` (optional cap for testing)
- Flow:
  - Identify players with games in lookback window up to `asOfDate`.
  - Pull recent game logs; compute blended recent points rate (5/10/20 window).
  - Predict next-5-game total points = blended rate × horizon.
  - Compute stability using recent variability as CV proxy; smoothstep map to [0.8, 1.0].
  - sKO = predicted points × stability multiplier.
  - Upsert one row per player (`player_id, as_of_date, horizon_games`).
- Implementation reference: `web/pages/api/v1/ml/update-predictions-sko.ts` and `web/pages/api/v1/db/update-team-yearly-summary.ts`.

## 12) Expanded TODOs (Delta)
- API
  - [ ] Harden endpoint with paging/batching and concurrency controls.
  - [ ] Add auth/secret check for write operations.
  - [ ] Support `playerId` filter for on-demand updates.
  - [ ] Log run metadata to `cron_job_audit`/`job_run_details`.
- Modeling Script (follow-up)
  - [ ] Replace baseline blend with ElasticNet/LightGBM predictions using `player_stats_unified` features.
  - [ ] Persist top feature contributions per prediction (e.g., SHAP or GBDT feature gain) into `top_features` JSONB.
  - [ ] Implement in-season rolling backtest (cutoff 2024-12-31; start 2025-01-01; step + retrain).
- Data
  - [ ] Add team/opponent strength, schedule density, home/away.
  - [ ] Ensure centered share features and pos/neg splits for stability scoring.
- UI
- [ ] Build `web/pages/trends/index.tsx` consuming `predictions_sko` with sKO tooltip and sorting.
- [ ] Add mini driver list (top_features) and sparkline trend.
- [ ] Surface transparency widgets (latest MAE/MAPE, MoE bands, historical accuracy trend) so users can track model quality over time.
- [ ] Add day-step simulation control on the Trends landing page that triggers the nightly pipeline (step forward + retrain) for controlled backtests.
- [ ] Implement `/trends/player/[playerId]` detail view with zoomable, brushable projected vs actual lines, candlestick overlay (green under/ red over) and crosshair cursor.
- [ ] Wire player search + row click-through from the Trends index to the player detail experience, keeping query params in sync.
- Ops
  - [ ] Nightly job to call `/api/v1/ml/update-predictions-sko` post-games.
  - [ ] Alerting if failure or unusually low updated rows.
