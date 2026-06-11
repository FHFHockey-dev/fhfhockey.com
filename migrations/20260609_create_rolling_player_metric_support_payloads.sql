-- Durable support storage for rolling player recompute/compatibility payloads.
-- Keeps the primary rolling_player_game_metrics row narrow while preserving
-- historical, recompute-only, and legacy validation components that previously
-- made the row too wide for reliable PostgREST upserts.

CREATE TABLE IF NOT EXISTS public.rolling_player_metric_support_payloads (
  player_id BIGINT NOT NULL,
  game_date DATE NOT NULL,
  strength_state TEXT NOT NULL,
  season BIGINT NOT NULL,
  team_id BIGINT NULL,
  game_id BIGINT NULL,
  payload_schema_version INTEGER NOT NULL DEFAULT 1,
  support_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rolling_player_metric_support_payloads_pkey
    PRIMARY KEY (player_id, game_date, strength_state),
  CONSTRAINT rolling_player_metric_support_payloads_payload_object_ck
    CHECK (jsonb_typeof(support_payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_rolling_player_metric_support_payloads_snapshot
  ON public.rolling_player_metric_support_payloads (
    season,
    strength_state,
    game_date DESC,
    team_id,
    player_id
  );

CREATE INDEX IF NOT EXISTS idx_rolling_player_metric_support_payloads_payload_gin
  ON public.rolling_player_metric_support_payloads
  USING GIN (support_payload jsonb_path_ops);

ALTER TABLE public.rolling_player_metric_support_payloads
  ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.rolling_player_metric_support_payloads
  FROM anon, authenticated;

GRANT SELECT ON TABLE public.rolling_player_metric_support_payloads
  TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.rolling_player_metric_support_payloads
  TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rolling_player_metric_support_payloads'
      AND policyname = 'public_read'
  ) THEN
    CREATE POLICY "public_read"
      ON public.rolling_player_metric_support_payloads
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

COMMENT ON TABLE public.rolling_player_metric_support_payloads IS
  'JSONB support payloads for rolling_player_game_metrics rows. Stores recompute-only, historical compatibility, and validation support components so ranking rows can remain narrow.';

COMMENT ON COLUMN public.rolling_player_metric_support_payloads.support_payload IS
  'Versioned object keyed by payload category, such as recomputeSupport, historicalCompatibility, deprecatedCompatibility, and diagnostics.';

CREATE OR REPLACE FUNCTION public.truncate_rolling_player_game_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  TRUNCATE TABLE public.rolling_player_metric_support_payloads;
  TRUNCATE TABLE public.rolling_player_game_metrics;
END;
$$;

REVOKE ALL ON FUNCTION public.truncate_rolling_player_game_metrics() FROM public;
GRANT EXECUTE ON FUNCTION public.truncate_rolling_player_game_metrics() TO service_role;
