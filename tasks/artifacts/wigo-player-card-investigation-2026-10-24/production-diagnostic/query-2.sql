BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
WITH nhl AS (
  SELECT game_id, date, season_id, games_played, toi_per_game, pp_toi,
         goals, assists, points, total_primary_assists, shots, pp_points
  FROM public.wgo_skater_stats WHERE player_id = 8476453
  ORDER BY date DESC LIMIT 20
), individual AS (
  SELECT date_scraped, season, gp, toi, goals, total_points, shots, ixg, icf, iscfs, hdcf
  FROM public.nst_gamelog_as_counts WHERE player_id = 8476453
  ORDER BY date_scraped DESC LIMIT 20
), on_ice AS (
  SELECT date_scraped, season, gp, toi, gf, sf, xgf, xga, cf, scf
  FROM public.nst_gamelog_as_counts_oi WHERE player_id = 8476453
  ORDER BY date_scraped DESC LIMIT 20
)
SELECT 'nhl_log' AS source, to_jsonb(n) AS payload FROM nhl n
UNION ALL SELECT 'nst_individual_log', to_jsonb(i) FROM individual i
UNION ALL SELECT 'nst_on_ice_log', to_jsonb(o) FROM on_ice o;
ROLLBACK;
