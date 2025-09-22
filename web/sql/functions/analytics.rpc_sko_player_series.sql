-- analytics.rpc_sko_player_series
-- Returns SKO time series JSON enriched with season identifiers and metadata.

CREATE OR REPLACE FUNCTION analytics.rpc_sko_player_series(
  p_player_id bigint,
  p_span integer DEFAULT 5,
  p_lambda_hot numeric DEFAULT 1.8,
  p_lambda_cold numeric DEFAULT 1.6,
  p_L_hot integer DEFAULT 2,
  p_L_cold integer DEFAULT 3
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, public
AS $$
DECLARE
  alpha numeric := 2::numeric / (p_span + 1);
  mu0 numeric;
  sigma0 numeric;
  n_train integer;
  payload jsonb;
  v_player_name text;
  v_position text;
BEGIN
  BEGIN
    SELECT
      COALESCE(ws.player_name, CONCAT('Player ', p_player_id)),
      COALESCE(ws.position_code, 'F')
    INTO v_player_name, v_position
    FROM analytics.vw_sko_skater_base ws
    WHERE ws.player_id = p_player_id
    ORDER BY ws.date DESC
    LIMIT 1;
  EXCEPTION
    WHEN undefined_column THEN
      v_player_name := CONCAT('Player ', p_player_id);
      v_position := 'F';
  END;

  IF v_player_name IS NULL THEN
    v_player_name := CONCAT('Player ', p_player_id);
  END IF;

  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY sko),
    COUNT(*)
  INTO mu0, n_train
  FROM analytics.vw_sko_skater_scores
  WHERE player_id = p_player_id
    AND season_id IN (20212022, 20222023, 20232024);

  IF n_train IS NULL OR n_train = 0 OR mu0 IS NULL THEN
    sigma0 := 0;
  ELSE
    SELECT
      1.4826 * percentile_cont(0.5) WITHIN GROUP (ORDER BY ABS(sko - mu0))
    INTO sigma0
    FROM analytics.vw_sko_skater_scores
    WHERE player_id = p_player_id
      AND season_id IN (20212022, 20222023, 20232024);
  END IF;

  WITH RECURSIVE ordered AS (
    SELECT
      s.*,
      ROW_NUMBER() OVER (ORDER BY date, game_id NULLS LAST) AS rn
    FROM analytics.vw_sko_skater_scores s
    WHERE s.player_id = p_player_id
    ORDER BY date, game_id
  ),
  ewma AS (
    SELECT
      o.rn,
      o.season_id,
      o.game_id,
      o.date,
      o.sko,
      o.sko_raw,
      o.shots_z,
      o.ixg_z,
      o.ixg_per_60_z,
      o.toi_z,
      o.pp_toi_z,
      o.ozfo_z,
      o.onice_sh_z,
      o.shooting_pct_z,
      o.sko AS ewma
    FROM ordered o
    WHERE o.rn = 1
    UNION ALL
    SELECT
      o.rn,
      o.season_id,
      o.game_id,
      o.date,
      o.sko,
      o.sko_raw,
      o.shots_z,
      o.ixg_z,
      o.ixg_per_60_z,
      o.toi_z,
      o.pp_toi_z,
      o.ozfo_z,
      o.onice_sh_z,
      o.shooting_pct_z,
      alpha * o.sko + (1 - alpha) * e.ewma AS ewma
    FROM ordered o
      JOIN ewma e ON o.rn = e.rn + 1
  ),
  flags AS (
    SELECT
      e.*,
      CASE WHEN e.ewma - mu0 >= p_lambda_hot * sigma0 THEN 1 ELSE 0 END AS hot_flag,
      CASE WHEN mu0 - e.ewma >= p_lambda_cold * sigma0 THEN 1 ELSE 0 END AS cold_flag
    FROM ewma e
  ),
  streaks AS (
    SELECT
      f.*,
      CASE WHEN hot_flag = 1 AND lag(hot_flag, p_L_hot - 1, 0) OVER (ORDER BY rn) = 1 THEN 1 ELSE 0 END AS hot_start,
      CASE WHEN cold_flag = 1 AND lag(cold_flag, p_L_cold - 1, 0) OVER (ORDER BY rn) = 1 THEN 1 ELSE 0 END AS cold_start
    FROM flags f
  ),
  labeled AS (
    SELECT
      s.*,
      SUM(hot_start) OVER (ORDER BY rn) AS hot_streak_id,
      SUM(cold_start) OVER (ORDER BY rn) AS cold_streak_id
    FROM streaks s
  )
  SELECT jsonb_build_object(
      'player_id', p_player_id,
      'player_name', v_player_name,
      'position_code', v_position,
      'baseline', jsonb_build_object(
        'mu0', mu0,
        'sigma0', sigma0,
        'n_train', COALESCE(n_train, 0)
      ),
      'series', jsonb_agg(
        jsonb_build_object(
          'season_id', season_id,
          'game_id', game_id,
          'date', date,
          'sko', sko,
          'sko_raw', sko_raw,
          'ewma', ewma,
          'hot_flag', hot_flag,
          'cold_flag', cold_flag,
          'hot_streak_id', NULLIF(hot_streak_id, 0),
          'cold_streak_id', NULLIF(cold_streak_id, 0),
          'features', jsonb_build_object(
            'shots_z', shots_z,
            'ixg_z', ixg_z,
            'ixg_per_60_z', ixg_per_60_z,
            'toi_z', toi_z,
            'pp_toi_z', pp_toi_z,
            'oz_fo_pct_z', ozfo_z,
            'onice_sh_pct_z', onice_sh_z,
            'shooting_pct_z', shooting_pct_z
          )
        )
        ORDER BY rn
      )
    )
  INTO payload
  FROM labeled;

  RETURN payload;
END;
$$;
