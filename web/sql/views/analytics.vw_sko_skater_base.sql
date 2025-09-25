-- analytics.vw_sko_skater_base
-- Joins WGO skater stats with NST gamelog xG metrics and exposes player metadata.

DROP VIEW IF EXISTS analytics.vw_sko_skater_base;

CREATE VIEW analytics.vw_sko_skater_base AS
SELECT
  ws.player_id,
  ws.player_name,
  COALESCE(ws.position_code, 'F') AS position_code,
  COALESCE(ws.season_id, nc.season) AS season_id,
  ws.game_id,
  ws.date,
  ws.shots,
  ws.toi_per_game,
  ws.pp_toi_per_game,
  ws.o_zone_fo_percentage,
  ws.on_ice_shooting_pct,
  ws.shooting_percentage,
  nc.ixg,
  nr.ixg_per_60
FROM wgo_skater_stats ws
LEFT JOIN nst_gamelog_as_counts nc
  ON nc.player_id = ws.player_id
  AND nc.date_scraped = ws.date
LEFT JOIN nst_gamelog_as_rates nr
  ON nr.player_id = ws.player_id
  AND nr.date_scraped = ws.date;
