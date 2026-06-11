ALTER TABLE public.skater_composite_ratings
  ADD COLUMN IF NOT EXISTS peer_group_type TEXT NOT NULL DEFAULT 'all_skaters',
  ADD COLUMN IF NOT EXISTS peer_group_key TEXT NOT NULL DEFAULT 'all_skaters',
  ADD COLUMN IF NOT EXISTS position_group TEXT NULL,
  ADD COLUMN IF NOT EXISTS deployment_bucket TEXT NOT NULL DEFAULT 'all';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skater_composite_ratings_peer_group_type_check'
      AND conrelid = 'public.skater_composite_ratings'::regclass
  ) THEN
    ALTER TABLE public.skater_composite_ratings
      ADD CONSTRAINT skater_composite_ratings_peer_group_type_check
      CHECK (peer_group_type IN ('all_skaters', 'position', 'deployment', 'team'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skater_composite_ratings_peer_group_key_check'
      AND conrelid = 'public.skater_composite_ratings'::regclass
  ) THEN
    ALTER TABLE public.skater_composite_ratings
      ADD CONSTRAINT skater_composite_ratings_peer_group_key_check
      CHECK (length(peer_group_key) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skater_composite_ratings_position_group_check'
      AND conrelid = 'public.skater_composite_ratings'::regclass
  ) THEN
    ALTER TABLE public.skater_composite_ratings
      ADD CONSTRAINT skater_composite_ratings_position_group_check
      CHECK (position_group IS NULL OR position_group IN ('forward', 'defense'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skater_composite_ratings_deployment_bucket_check'
      AND conrelid = 'public.skater_composite_ratings'::regclass
  ) THEN
    ALTER TABLE public.skater_composite_ratings
      ADD CONSTRAINT skater_composite_ratings_deployment_bucket_check
      CHECK (
        deployment_bucket IN (
          'all',
          'L1', 'L2', 'L3', 'L4',
          'P1', 'P2', 'P3',
          'PP1', 'PP2', 'PP3',
          'PK1', 'PK2'
        )
      );
  END IF;
END $$;

ALTER TABLE public.skater_composite_ratings
  DROP CONSTRAINT IF EXISTS skater_composite_ratings_pkey;

ALTER TABLE public.skater_composite_ratings
  ADD CONSTRAINT skater_composite_ratings_pkey PRIMARY KEY (
    player_id,
    season_id,
    snapshot_date,
    window_type,
    window_size,
    strength_state,
    peer_group_type,
    peer_group_key
  );

CREATE INDEX IF NOT EXISTS idx_skater_composite_ratings_context_lookup
  ON public.skater_composite_ratings (
    season_id,
    snapshot_date DESC,
    window_type,
    window_size,
    strength_state,
    peer_group_type,
    peer_group_key,
    mcm_score DESC
  );

COMMENT ON COLUMN public.skater_composite_ratings.peer_group_type IS
  'Contextual peer group used to calculate percentile-based composite components.';

COMMENT ON COLUMN public.skater_composite_ratings.peer_group_key IS
  'Concrete peer group key, such as all_skaters, F, D, L1, PP1, or a team id.';

COMMENT ON COLUMN public.skater_composite_ratings.deployment_bucket IS
  'Deployment bucket represented by this composite row; all for unscoped rows.';
