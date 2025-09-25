-- public.rpc_sko_player_series
-- Wrapper to expose analytics RPC through PostgREST default search path.

CREATE OR REPLACE FUNCTION public.rpc_sko_player_series(
  p_player_id bigint,
  p_span integer DEFAULT 5,
  p_lambda_hot numeric DEFAULT 1.8,
  p_lambda_cold numeric DEFAULT 1.6,
  p_L_hot integer DEFAULT 2,
  p_L_cold integer DEFAULT 3
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT analytics.rpc_sko_player_series(
    p_player_id,
    p_span,
    p_lambda_hot,
    p_lambda_cold,
    p_L_hot,
    p_L_cold
  );
$$;

GRANT EXECUTE ON FUNCTION public.rpc_sko_player_series(
  p_player_id bigint,
  p_span integer,
  p_lambda_hot numeric,
  p_lambda_cold numeric,
  p_L_hot integer,
  p_L_cold integer
) TO authenticated, anon;
