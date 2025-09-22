-- Smoke-test queries for SKO player series pipeline.

-- 1. Validate z-score ordering + null safety for a forward and defenseman.
SELECT
  player_id,
  date,
  shots,
  ixg,
  ixg_per_60,
  shots_z,
  ixg_z,
  ixg_per_60_z
FROM analytics.vw_sko_skater_zscores
WHERE player_id IN (8478402, 8477934)
ORDER BY player_id, date
LIMIT 20;

-- 2. Ensure scores view aligns with ridge coefficients.
SELECT
  player_id,
  date,
  sko_raw,
  sko
FROM analytics.vw_sko_skater_scores
WHERE player_id = 8478402
  AND season_id = 20242025
ORDER BY date DESC
LIMIT 10;

-- 3. RPC payload contract spot-check (casts JSON into columns for readability).
SELECT
  (payload ->> 'player_id')::bigint AS player_id,
  payload -> 'baseline' AS baseline,
  jsonb_array_length(payload -> 'series') AS n_games,
  (payload -> 'series' -> 0 ->> 'date')::date AS first_game_date
FROM analytics.rpc_sko_player_series(8478402, 5, 1.8, 1.6, 2, 3) AS payload;

-- 4. Cross-season sample to confirm ordering persists.
SELECT
  (g ->> 'date')::date AS game_date,
  (g ->> 'sko')::double precision AS sko,
  g -> 'features' AS features
FROM jsonb_array_elements(
  analytics.rpc_sko_player_series(8477934, 5, 1.8, 1.6, 2, 3)->'series'
) AS g
ORDER BY game_date
LIMIT 15;
