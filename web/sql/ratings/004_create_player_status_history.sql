CREATE TABLE IF NOT EXISTS public.player_status_history (
  capture_key TEXT PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  player_id BIGINT NULL REFERENCES public.players(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  team_id BIGINT NULL REFERENCES public.teams(id) ON DELETE SET NULL,
  team_abbreviation TEXT NULL,
  status_state TEXT NOT NULL,
  raw_status TEXT NULL,
  status_detail TEXT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NULL,
  source_rank SMALLINT NOT NULL DEFAULT 1,
  status_expires_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_status_history_state_check
    CHECK (status_state = ANY (ARRAY['injured'::text, 'returning'::text]))
);

CREATE INDEX IF NOT EXISTS player_status_history_player_idx
  ON public.player_status_history (player_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS player_status_history_team_idx
  ON public.player_status_history (team_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS player_status_history_expiry_idx
  ON public.player_status_history (status_expires_at);

COMMENT ON TABLE public.player_status_history IS
  'Durable player availability history, including current injuries and expiring returning designations.';

CREATE OR REPLACE VIEW analytics.vw_player_status_current AS
WITH ranked AS (
  SELECT
    h.*,
    ROW_NUMBER() OVER (
      PARTITION BY
        COALESCE(h.player_id, -1),
        LOWER(h.player_name),
        COALESCE(h.team_id, -1)
      ORDER BY h.snapshot_date DESC, h.observed_at DESC, h.updated_at DESC
    ) AS rn
  FROM public.player_status_history h
  WHERE h.status_expires_at IS NULL OR h.status_expires_at > NOW()
)
SELECT
  capture_key,
  snapshot_date,
  observed_at,
  player_id,
  player_name,
  team_id,
  team_abbreviation,
  status_state,
  raw_status,
  status_detail,
  source_name,
  source_url,
  source_rank,
  status_expires_at,
  CASE
    WHEN status_state = 'returning' THEN 'Returning'
    ELSE COALESCE(raw_status, 'Out')
  END AS display_status,
  CASE
    WHEN status_state = 'returning' THEN 'positive'
    ELSE 'negative'
  END AS display_tone,
  metadata,
  updated_at
FROM ranked
WHERE rn = 1;

COMMENT ON VIEW analytics.vw_player_status_current IS
  'Latest active player availability state, including expiring returning designations.';

GRANT USAGE ON SCHEMA analytics TO service_role;
GRANT SELECT ON analytics.vw_player_status_current TO service_role;
