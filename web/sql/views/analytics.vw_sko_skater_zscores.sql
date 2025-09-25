-- analytics.vw_sko_skater_zscores
-- EB z-score view pulling from vw_sko_skater_base with shrinkage for ixG metrics.

CREATE OR REPLACE VIEW analytics.vw_sko_skater_zscores AS
WITH constants AS (
  SELECT 30.0::numeric AS kappa
),
weights AS (
  SELECT
    m.player_id,
    m.position_code,
    m.n_games,
    m.shots_med,
    m.shots_mad,
    m.toi_med,
    m.toi_mad,
    m.pp_toi_med,
    m.pp_toi_mad,
    m.ozfo_med,
    m.ozfo_mad,
    m.onice_sh_med,
    m.onice_sh_mad,
    m.shooting_pct_med,
    m.shooting_pct_mad,
    m.ixg_med,
    m.ixg_mad,
    m.ixg_per_60_med,
    m.ixg_per_60_mad,
    m.league_shots_med,
    m.league_shots_mad,
    m.league_toi_med,
    m.league_toi_mad,
    m.league_pp_toi_med,
    m.league_pp_toi_mad,
    m.league_ozfo_med,
    m.league_ozfo_mad,
    m.league_onice_sh_med,
    m.league_onice_sh_mad,
    m.league_shooting_pct_med,
    m.league_shooting_pct_mad,
    m.league_ixg_med,
    m.league_ixg_mad,
    m.league_ixg_per_60_med,
    m.league_ixg_per_60_mad,
    (m.n_games::numeric / (m.n_games::numeric + c.kappa))::double precision AS w_player,
    (c.kappa / (m.n_games::numeric + c.kappa))::double precision AS w_league
  FROM analytics.mv_sko_skater_moments m
  CROSS JOIN constants c
)
SELECT
  b.player_id,
  b.position_code,
  b.season_id,
  COALESCE(
    b.game_id,
    ROW_NUMBER() OVER (
      PARTITION BY b.player_id
      ORDER BY b.date, b.game_id NULLS LAST
    )
  ) AS game_id,
  b.date,
  b.shots,
  b.ixg,
  b.ixg_per_60,
  b.toi_per_game,
  b.pp_toi_per_game,
  b.o_zone_fo_percentage,
  b.on_ice_shooting_pct,
  b.shooting_percentage,
  w.n_games,
  w.w_player,
  w.w_league,
  CASE
    WHEN b.shots IS NULL THEN NULL
    ELSE (b.shots::double precision - (w.w_player * w.shots_med + w.w_league * w.league_shots_med)) /
      NULLIF(w.w_player * w.shots_mad + w.w_league * w.league_shots_mad, 0::double precision)
  END AS shots_z,
  CASE
    WHEN b.ixg IS NULL THEN NULL
    ELSE (b.ixg::double precision - (w.w_player * w.ixg_med + w.w_league * w.league_ixg_med)) /
      NULLIF(w.w_player * w.ixg_mad + w.w_league * w.league_ixg_mad, 0::double precision)
  END AS ixg_z,
  CASE
    WHEN b.ixg_per_60 IS NULL THEN NULL
    ELSE (b.ixg_per_60::double precision - (w.w_player * w.ixg_per_60_med + w.w_league * w.league_ixg_per_60_med)) /
      NULLIF(w.w_player * w.ixg_per_60_mad + w.w_league * w.league_ixg_per_60_mad, 0::double precision)
  END AS ixg_per_60_z,
  CASE
    WHEN b.toi_per_game IS NULL THEN NULL
    ELSE (b.toi_per_game - (w.w_player * w.toi_med + w.w_league * w.league_toi_med)) /
      NULLIF(w.w_player * w.toi_mad + w.w_league * w.league_toi_mad, 0::double precision)
  END AS toi_z,
  CASE
    WHEN b.pp_toi_per_game IS NULL THEN NULL
    ELSE (b.pp_toi_per_game - (w.w_player * w.pp_toi_med + w.w_league * w.league_pp_toi_med)) /
      NULLIF(w.w_player * w.pp_toi_mad + w.w_league * w.league_pp_toi_mad, 0::double precision)
  END AS pp_toi_z,
  CASE
    WHEN b.o_zone_fo_percentage IS NULL THEN NULL
    ELSE (b.o_zone_fo_percentage - (w.w_player * w.ozfo_med + w.w_league * w.league_ozfo_med)) /
      NULLIF(w.w_player * w.ozfo_mad + w.w_league * w.league_ozfo_mad, 0::double precision)
  END AS ozfo_z,
  CASE
    WHEN b.on_ice_shooting_pct IS NULL THEN NULL
    ELSE (b.on_ice_shooting_pct - (w.w_player * w.onice_sh_med + w.w_league * w.league_onice_sh_med)) /
      NULLIF(w.w_player * w.onice_sh_mad + w.w_league * w.league_onice_sh_mad, 0::double precision)
  END AS onice_sh_z,
  CASE
    WHEN b.shooting_percentage IS NULL THEN NULL
    ELSE (b.shooting_percentage - (w.w_player * w.shooting_pct_med + w.w_league * w.league_shooting_pct_med)) /
      NULLIF(w.w_player * w.shooting_pct_mad + w.w_league * w.league_shooting_pct_mad, 0::double precision)
  END AS shooting_pct_z
FROM analytics.vw_sko_skater_base b
  JOIN weights w ON w.player_id = b.player_id AND w.position_code = b.position_code;
