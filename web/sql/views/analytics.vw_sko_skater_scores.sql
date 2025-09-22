-- analytics.vw_sko_skater_scores
-- Applies ridge weights to z-scores and bounds via tanh.

CREATE OR REPLACE VIEW analytics.vw_sko_skater_scores AS
SELECT
  z.player_id,
  z.position_code,
  z.season_id,
  z.game_id,
  z.date,
  z.shots_z,
  z.ixg_z,
  z.ixg_per_60_z,
  z.toi_z,
  z.pp_toi_z,
  z.ozfo_z,
  z.onice_sh_z,
  z.shooting_pct_z,
  (
    -0.03::double precision
    + 0.24::double precision * COALESCE(z.shots_z, 0::double precision)
    + 0.28::double precision * COALESCE(z.ixg_z, 0::double precision)
    + 0.13::double precision * COALESCE(z.ixg_per_60_z, 0::double precision)
    + 0.09::double precision * COALESCE(z.toi_z, 0::double precision)
    + 0.07::double precision * COALESCE(z.pp_toi_z, 0::double precision)
    + 0.09::double precision * COALESCE(z.ozfo_z, 0::double precision)
    - 0.06::double precision * COALESCE(z.onice_sh_z, 0::double precision)
    - 0.05::double precision * COALESCE(z.shooting_pct_z, 0::double precision)
  ) AS sko_raw,
  tanh(
    -0.03::double precision
    + 0.24::double precision * COALESCE(z.shots_z, 0::double precision)
    + 0.28::double precision * COALESCE(z.ixg_z, 0::double precision)
    + 0.13::double precision * COALESCE(z.ixg_per_60_z, 0::double precision)
    + 0.09::double precision * COALESCE(z.toi_z, 0::double precision)
    + 0.07::double precision * COALESCE(z.pp_toi_z, 0::double precision)
    + 0.09::double precision * COALESCE(z.ozfo_z, 0::double precision)
    - 0.06::double precision * COALESCE(z.onice_sh_z, 0::double precision)
    - 0.05::double precision * COALESCE(z.shooting_pct_z, 0::double precision)
  ) AS sko
FROM analytics.vw_sko_skater_zscores z;
