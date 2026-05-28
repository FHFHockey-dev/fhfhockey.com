-- Persisted inferred shot-assist candidates for in-house xG.
--
-- NHL public play-by-play does not expose pass events, so these rows are
-- heuristic candidates with confidence/provenance, not official assists.

CREATE TABLE IF NOT EXISTS public.nhl_xg_shot_assist_candidates (
  model_version text NOT NULL,
  feature_version integer NOT NULL,
  game_id bigint NOT NULL,
  event_id bigint NOT NULL,
  season_id bigint NULL,
  game_date date NULL,
  event_owner_team_id bigint NULL,
  shooter_player_id bigint NULL,
  shot_assist_player_id bigint NOT NULL,
  source_event_id bigint NOT NULL,
  source_event_type_desc_key text NULL,
  candidate_rank integer NOT NULL DEFAULT 1,
  confidence double precision NOT NULL,
  confidence_tier text NOT NULL,
  xg double precision NOT NULL,
  expected_primary_assists double precision NOT NULL,
  heuristic_reason text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, feature_version, game_id, event_id, candidate_rank),
  CONSTRAINT nhl_xg_shot_assist_candidates_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT nhl_xg_shot_assist_candidates_tier_check
    CHECK (confidence_tier IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_assist_candidates_player_date
  ON public.nhl_xg_shot_assist_candidates (
    shot_assist_player_id,
    game_date DESC,
    model_version
  );

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_assist_candidates_game
  ON public.nhl_xg_shot_assist_candidates (game_id, event_id);

COMMENT ON TABLE public.nhl_xg_shot_assist_candidates IS
  'Inferred primary shot-assist candidates from public NHL event sequences and approved in-house shot xG.';
