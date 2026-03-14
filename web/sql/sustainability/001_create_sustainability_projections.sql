-- Sustainability projection snapshots and optional per-opponent breakdowns.
-- One row stores one metric at one horizon for one player snapshot.

CREATE TABLE IF NOT EXISTS public.sustainability_projections (
  player_id BIGINT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  metric_key TEXT NOT NULL,
  horizon_games SMALLINT NOT NULL,
  projection_type TEXT NOT NULL DEFAULT 'snapshot',
  scope_key TEXT NOT NULL DEFAULT 'overall',

  game_id BIGINT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id SMALLINT NULL REFERENCES public.teams(id),
  opponent_team_id SMALLINT NULL REFERENCES public.teams(id),

  expected_value DOUBLE PRECISION NOT NULL,
  band50_lower DOUBLE PRECISION NULL,
  band50_upper DOUBLE PRECISION NULL,
  band80_lower DOUBLE PRECISION NULL,
  band80_upper DOUBLE PRECISION NULL,

  rate_per_60 DOUBLE PRECISION NULL,
  toi_seconds DOUBLE PRECISION NULL,
  attempts DOUBLE PRECISION NULL,
  expected_wins DOUBLE PRECISION NULL,
  distribution_model TEXT NULL,

  opponent_adjustment JSONB NOT NULL DEFAULT '{}'::jsonb,
  distribution_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sustainability_projections_pkey PRIMARY KEY (
    player_id,
    snapshot_date,
    metric_key,
    horizon_games,
    projection_type,
    scope_key
  ),
  CONSTRAINT sustainability_projections_horizon_check
    CHECK (horizon_games >= 1 AND horizon_games <= 10),
  CONSTRAINT sustainability_projections_type_check
    CHECK (projection_type = ANY (ARRAY['snapshot'::text, 'opponent_game'::text])),
  CONSTRAINT sustainability_projections_scope_check
    CHECK (char_length(scope_key) > 0),
  CONSTRAINT sustainability_projections_distribution_model_check
    CHECK (
      distribution_model IS NULL
      OR distribution_model = ANY (ARRAY['poisson'::text, 'negbin'::text, 'rate'::text])
    ),
  CONSTRAINT sustainability_projections_band50_check
    CHECK (
      band50_lower IS NULL
      OR band50_upper IS NULL
      OR band50_lower <= band50_upper
    ),
  CONSTRAINT sustainability_projections_band80_check
    CHECK (
      band80_lower IS NULL
      OR band80_upper IS NULL
      OR band80_lower <= band80_upper
    ),
  CONSTRAINT sustainability_projections_game_scope_check
    CHECK (
      (projection_type = 'snapshot' AND scope_key = 'overall')
      OR (
        projection_type = 'opponent_game'
        AND game_id IS NOT NULL
        AND opponent_team_id IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_sustainability_projections_snapshot_date
  ON public.sustainability_projections (snapshot_date);

CREATE INDEX IF NOT EXISTS idx_sustainability_projections_player_date
  ON public.sustainability_projections (player_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_sustainability_projections_metric
  ON public.sustainability_projections (metric_key, horizon_games);

CREATE INDEX IF NOT EXISTS idx_sustainability_projections_game
  ON public.sustainability_projections (game_id)
  WHERE game_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sustainability_projections_type_scope
  ON public.sustainability_projections (projection_type, scope_key);
