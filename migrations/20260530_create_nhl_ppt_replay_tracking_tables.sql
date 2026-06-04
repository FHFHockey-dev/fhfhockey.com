BEGIN;

CREATE TABLE IF NOT EXISTS public.nhl_ppt_replay_payloads_raw (
  game_id BIGINT NOT NULL,
  event_id BIGINT NOT NULL,
  season_id BIGINT NULL,
  game_date DATE NULL,
  game_type INTEGER NULL,
  game_state TEXT NULL,
  event_type TEXT NULL,
  ppt_replay_url TEXT NOT NULL CHECK (btrim(ppt_replay_url) <> ''),
  fetch_status TEXT NOT NULL CHECK (
    fetch_status IN ('fetched', 'failed', 'skipped')
  ),
  http_status INTEGER NULL,
  payload_hash TEXT NULL,
  payload JSONB NULL,
  frame_count INTEGER NOT NULL DEFAULT 0 CHECK (frame_count >= 0),
  entity_frame_count INTEGER NOT NULL DEFAULT 0 CHECK (entity_frame_count >= 0),
  error_message TEXT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_ppt_replay_payloads_raw_season_date
  ON public.nhl_ppt_replay_payloads_raw (season_id, game_date DESC, event_type);

CREATE INDEX IF NOT EXISTS idx_nhl_ppt_replay_payloads_raw_status
  ON public.nhl_ppt_replay_payloads_raw (fetch_status, fetched_at DESC);

CREATE TABLE IF NOT EXISTS public.nhl_ppt_replay_frames (
  game_id BIGINT NOT NULL,
  event_id BIGINT NOT NULL,
  frame_index INTEGER NOT NULL CHECK (frame_index >= 0),
  frame_timestamp BIGINT NULL,
  tracking_object_id TEXT NOT NULL,
  player_id BIGINT NULL,
  is_puck BOOLEAN NOT NULL DEFAULT FALSE,
  team_id BIGINT NULL,
  team_abbrev TEXT NULL,
  sweater_number INTEGER NULL,
  x DOUBLE PRECISION NULL,
  y DOUBLE PRECISION NULL,
  ppt_replay_url TEXT NOT NULL CHECK (btrim(ppt_replay_url) <> ''),
  provenance JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, event_id, frame_index, tracking_object_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_ppt_replay_frames_player
  ON public.nhl_ppt_replay_frames (player_id, game_id, event_id)
  WHERE player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nhl_ppt_replay_frames_event
  ON public.nhl_ppt_replay_frames (game_id, event_id, frame_index);

CREATE INDEX IF NOT EXISTS idx_nhl_ppt_replay_frames_puck
  ON public.nhl_ppt_replay_frames (game_id, event_id, frame_index)
  WHERE is_puck = TRUE;

COMMENT ON TABLE public.nhl_ppt_replay_payloads_raw IS
  'Raw NHL public pptReplayUrl sprite JSON payloads discovered only from gamecenter play-by-play fields.';

COMMENT ON TABLE public.nhl_ppt_replay_frames IS
  'Normalized frame/object coordinates from NHL public goal-replay sprite JSON payloads.';

COMMIT;
