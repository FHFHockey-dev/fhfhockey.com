-- Persisted public-PBP transition proxies for in-house xG.
--
-- These rows are inferred from possession/rush context, not puck-tracking
-- zone-entry data. Confidence/provenance are part of the contract.

CREATE TABLE IF NOT EXISTS public.nhl_xg_transition_events (
  model_version text NOT NULL,
  feature_version integer NOT NULL,
  game_id bigint NOT NULL,
  event_id bigint NOT NULL,
  transition_type text NOT NULL,
  season_id bigint NULL,
  game_date date NULL,
  team_id bigint NULL,
  player_id bigint NULL,
  source_event_id bigint NULL,
  source_event_type_desc_key text NULL,
  confidence double precision NOT NULL,
  confidence_tier text NOT NULL,
  shot_event_id bigint NOT NULL,
  shot_xg double precision NOT NULL,
  transition_created_xg double precision NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, feature_version, game_id, event_id, transition_type),
  CONSTRAINT nhl_xg_transition_events_type_check
    CHECK (
      transition_type IN (
        'controlled_entry_proxy',
        'dump_in_entry_proxy',
        'controlled_exit_proxy',
        'failed_exit_against_proxy',
        'entry_assist_proxy',
        'transition_created_shot'
      )
    ),
  CONSTRAINT nhl_xg_transition_events_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT nhl_xg_transition_events_tier_check
    CHECK (confidence_tier IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_transition_events_player_date
  ON public.nhl_xg_transition_events (player_id, game_date DESC, transition_type)
  WHERE player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nhl_xg_transition_events_team_date
  ON public.nhl_xg_transition_events (team_id, game_date DESC, transition_type)
  WHERE team_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.nhl_xg_transition_game_aggregates (
  model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  entity_type text NOT NULL,
  entity_id bigint NOT NULL,
  controlled_entries integer NOT NULL DEFAULT 0,
  controlled_exits integer NOT NULL DEFAULT 0,
  failed_exits_against integer NOT NULL DEFAULT 0,
  entry_assists integer NOT NULL DEFAULT 0,
  transition_created_shots integer NOT NULL DEFAULT 0,
  transition_created_xg double precision NOT NULL DEFAULT 0,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, feature_version, game_id, entity_type, entity_id),
  CONSTRAINT nhl_xg_transition_game_aggregates_entity_type_check
    CHECK (entity_type IN ('team', 'player'))
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_transition_game_aggregates_entity_date
  ON public.nhl_xg_transition_game_aggregates (
    entity_type,
    entity_id,
    game_date DESC,
    model_version
  );

COMMENT ON TABLE public.nhl_xg_transition_events IS
  'Inferred transition proxy events from public NHL PBP possession/rush context and approved in-house shot xG.';

COMMENT ON TABLE public.nhl_xg_transition_game_aggregates IS
  'Team/player game aggregates for inferred public-PBP transition proxy events.';
