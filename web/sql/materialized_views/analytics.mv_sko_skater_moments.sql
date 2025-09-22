-- analytics.mv_sko_skater_moments
-- Refresh training baselines for SKO shrinkage math. Includes league-level medians/MADs
-- that exclude zero-only ratio metrics for robust scaling.

DROP MATERIALIZED VIEW IF EXISTS analytics.mv_sko_skater_moments CASCADE;
CREATE MATERIALIZED VIEW analytics.mv_sko_skater_moments AS
WITH base AS (
  SELECT
    player_id,
    COALESCE(position_code, 'F') AS position_code,
    date,
    shots,
    toi_per_game,
    pp_toi_per_game,
    o_zone_fo_percentage,
    on_ice_shooting_pct,
    shooting_percentage,
    ixg,
    ixg_per_60
  FROM analytics.vw_sko_skater_base
),
player_base AS (
  SELECT
    player_id,
    position_code,
    shots,
    toi_per_game,
    pp_toi_per_game,
    o_zone_fo_percentage,
    on_ice_shooting_pct,
    shooting_percentage,
    ixg,
    ixg_per_60,
    NULLIF(on_ice_shooting_pct, 0)::double precision AS onice_shooting_for_stats,
    NULLIF(shooting_percentage, 0)::double precision AS shooting_pct_for_stats
  FROM base
),
player_medians AS (
  SELECT
    player_id,
    position_code,
    COUNT(*) FILTER (WHERE shots IS NOT NULL) AS n_games,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY shots::double precision) AS shots_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY toi_per_game) AS toi_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY pp_toi_per_game) AS pp_toi_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY o_zone_fo_percentage) AS ozfo_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY on_ice_shooting_pct) AS onice_sh_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY shooting_percentage) AS shooting_pct_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ixg) AS ixg_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ixg_per_60) AS ixg_per_60_med
  FROM player_base
  GROUP BY player_id, position_code
),
player_mads AS (
  SELECT
    pb.player_id,
    pb.position_code,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(pb.shots::double precision - pm.shots_med)) AS shots_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(pb.toi_per_game - pm.toi_med)) AS toi_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(pb.pp_toi_per_game - pm.pp_toi_med)) AS pp_toi_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(pb.o_zone_fo_percentage - pm.ozfo_med)) AS ozfo_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(pb.on_ice_shooting_pct - pm.onice_sh_med)) AS onice_sh_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(pb.shooting_percentage - pm.shooting_pct_med)) AS shooting_pct_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(pb.ixg - pm.ixg_med)) AS ixg_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(pb.ixg_per_60 - pm.ixg_per_60_med)) AS ixg_per_60_mad_raw
  FROM player_base pb
    JOIN player_medians pm USING (player_id, position_code)
  GROUP BY pb.player_id, pb.position_code
),
league_base AS (
  SELECT
    position_code,
    shots,
    toi_per_game,
    pp_toi_per_game,
    o_zone_fo_percentage,
    NULLIF(on_ice_shooting_pct, 0)::double precision AS onice_shooting_for_stats,
    NULLIF(shooting_percentage, 0)::double precision AS shooting_pct_for_stats,
    ixg,
    ixg_per_60
  FROM base
),
league_medians AS (
  SELECT
    position_code,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY shots::double precision) AS shots_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY toi_per_game) AS toi_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY pp_toi_per_game) AS pp_toi_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY o_zone_fo_percentage) AS ozfo_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY onice_shooting_for_stats) AS onice_sh_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY shooting_pct_for_stats) AS shooting_pct_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ixg) AS ixg_med,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ixg_per_60) AS ixg_per_60_med
  FROM league_base
  GROUP BY position_code
),
league_mads AS (
  SELECT
    lb.position_code,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(lb.shots::double precision - lm.shots_med)) AS shots_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(lb.toi_per_game - lm.toi_med)) AS toi_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(lb.pp_toi_per_game - lm.pp_toi_med)) AS pp_toi_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(lb.o_zone_fo_percentage - lm.ozfo_med)) AS ozfo_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(lb.onice_shooting_for_stats - lm.onice_sh_med)) AS onice_sh_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(lb.shooting_pct_for_stats - lm.shooting_pct_med)) AS shooting_pct_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(lb.ixg - lm.ixg_med)) AS ixg_mad_raw,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(lb.ixg_per_60 - lm.ixg_per_60_med)) AS ixg_per_60_mad_raw
  FROM league_base lb
    JOIN league_medians lm USING (position_code)
  GROUP BY lb.position_code
)
SELECT
  pm.player_id,
  pm.position_code,
  pm.n_games,
  pm.shots_med,
  1.4826 * pmad.shots_mad_raw AS shots_mad,
  pm.toi_med,
  1.4826 * pmad.toi_mad_raw AS toi_mad,
  pm.pp_toi_med,
  1.4826 * pmad.pp_toi_mad_raw AS pp_toi_mad,
  pm.ozfo_med,
  1.4826 * pmad.ozfo_mad_raw AS ozfo_mad,
  pm.onice_sh_med,
  1.4826 * pmad.onice_sh_mad_raw AS onice_sh_mad,
  pm.shooting_pct_med,
  1.4826 * pmad.shooting_pct_mad_raw AS shooting_pct_mad,
  pm.ixg_med,
  1.4826 * pmad.ixg_mad_raw AS ixg_mad,
  pm.ixg_per_60_med,
  1.4826 * pmad.ixg_per_60_mad_raw AS ixg_per_60_mad,
  lm.shots_med AS league_shots_med,
  1.4826 * lmad.shots_mad_raw AS league_shots_mad,
  lm.toi_med AS league_toi_med,
  1.4826 * lmad.toi_mad_raw AS league_toi_mad,
  lm.pp_toi_med AS league_pp_toi_med,
  1.4826 * lmad.pp_toi_mad_raw AS league_pp_toi_mad,
  lm.ozfo_med AS league_ozfo_med,
  1.4826 * lmad.ozfo_mad_raw AS league_ozfo_mad,
  lm.onice_sh_med AS league_onice_sh_med,
  1.4826 * lmad.onice_sh_mad_raw AS league_onice_sh_mad,
  lm.shooting_pct_med AS league_shooting_pct_med,
  1.4826 * lmad.shooting_pct_mad_raw AS league_shooting_pct_mad,
  lm.ixg_med AS league_ixg_med,
  1.4826 * lmad.ixg_mad_raw AS league_ixg_mad,
  lm.ixg_per_60_med AS league_ixg_per_60_med,
  1.4826 * lmad.ixg_per_60_mad_raw AS league_ixg_per_60_mad
FROM player_medians pm
  JOIN player_mads pmad USING (player_id, position_code)
  JOIN league_medians lm USING (position_code)
  JOIN league_mads lmad USING (position_code);
