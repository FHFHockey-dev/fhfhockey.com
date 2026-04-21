CREATE TABLE IF NOT EXISTS public.lines_nhl (
  capture_key TEXT PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  game_id BIGINT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_abbreviation TEXT NOT NULL,
  team_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'nhl.com',
  source_url TEXT NULL,
  source_label TEXT NULL,
  status TEXT NOT NULL DEFAULT 'observed',
  line_1_player_ids BIGINT[] NULL,
  line_1_player_names TEXT[] NULL,
  line_2_player_ids BIGINT[] NULL,
  line_2_player_names TEXT[] NULL,
  line_3_player_ids BIGINT[] NULL,
  line_3_player_names TEXT[] NULL,
  line_4_player_ids BIGINT[] NULL,
  line_4_player_names TEXT[] NULL,
  pair_1_player_ids BIGINT[] NULL,
  pair_1_player_names TEXT[] NULL,
  pair_2_player_ids BIGINT[] NULL,
  pair_2_player_names TEXT[] NULL,
  pair_3_player_ids BIGINT[] NULL,
  pair_3_player_names TEXT[] NULL,
  goalie_1_player_id BIGINT NULL,
  goalie_1_name TEXT NULL,
  goalie_2_player_id BIGINT NULL,
  goalie_2_name TEXT NULL,
  scratches_player_ids BIGINT[] NULL,
  scratches_player_names TEXT[] NULL,
  injured_player_ids BIGINT[] NULL,
  injured_player_names TEXT[] NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lines_nhl_status_check
    CHECK (status = ANY (ARRAY['observed'::text, 'rejected'::text, 'superseded'::text]))
);

CREATE INDEX IF NOT EXISTS lines_nhl_snapshot_date_idx
  ON public.lines_nhl (snapshot_date DESC, team_id);

CREATE INDEX IF NOT EXISTS lines_nhl_game_idx
  ON public.lines_nhl (game_id, team_id);

COMMENT ON TABLE public.lines_nhl IS
  'Historical NHL.com projected lineup snapshots with explicit ordered line, pair, and goalie columns.';

CREATE TABLE IF NOT EXISTS public.lines_dfo (
  capture_key TEXT PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  game_id BIGINT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_abbreviation TEXT NOT NULL,
  team_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'dailyfaceoff',
  source_url TEXT NULL,
  source_label TEXT NULL,
  status TEXT NOT NULL DEFAULT 'observed',
  line_1_player_ids BIGINT[] NULL,
  line_1_player_names TEXT[] NULL,
  line_2_player_ids BIGINT[] NULL,
  line_2_player_names TEXT[] NULL,
  line_3_player_ids BIGINT[] NULL,
  line_3_player_names TEXT[] NULL,
  line_4_player_ids BIGINT[] NULL,
  line_4_player_names TEXT[] NULL,
  pair_1_player_ids BIGINT[] NULL,
  pair_1_player_names TEXT[] NULL,
  pair_2_player_ids BIGINT[] NULL,
  pair_2_player_names TEXT[] NULL,
  pair_3_player_ids BIGINT[] NULL,
  pair_3_player_names TEXT[] NULL,
  goalie_1_player_id BIGINT NULL,
  goalie_1_name TEXT NULL,
  goalie_2_player_id BIGINT NULL,
  goalie_2_name TEXT NULL,
  scratches_player_ids BIGINT[] NULL,
  scratches_player_names TEXT[] NULL,
  injured_player_ids BIGINT[] NULL,
  injured_player_names TEXT[] NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lines_dfo_status_check
    CHECK (status = ANY (ARRAY['observed'::text, 'rejected'::text, 'superseded'::text]))
);

CREATE INDEX IF NOT EXISTS lines_dfo_snapshot_date_idx
  ON public.lines_dfo (snapshot_date DESC, team_id);

CREATE INDEX IF NOT EXISTS lines_dfo_game_idx
  ON public.lines_dfo (game_id, team_id);

COMMENT ON TABLE public.lines_dfo IS
  'Historical DailyFaceoff lineup snapshots with explicit ordered line, pair, and goalie columns.';

CREATE TABLE IF NOT EXISTS public.lines_gdl (
  capture_key TEXT PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  game_id BIGINT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_abbreviation TEXT NOT NULL,
  team_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'gamedaytweets',
  source_url TEXT NULL,
  source_label TEXT NULL,
  status TEXT NOT NULL DEFAULT 'observed',
  line_1_player_ids BIGINT[] NULL,
  line_1_player_names TEXT[] NULL,
  line_2_player_ids BIGINT[] NULL,
  line_2_player_names TEXT[] NULL,
  line_3_player_ids BIGINT[] NULL,
  line_3_player_names TEXT[] NULL,
  line_4_player_ids BIGINT[] NULL,
  line_4_player_names TEXT[] NULL,
  pair_1_player_ids BIGINT[] NULL,
  pair_1_player_names TEXT[] NULL,
  pair_2_player_ids BIGINT[] NULL,
  pair_2_player_names TEXT[] NULL,
  pair_3_player_ids BIGINT[] NULL,
  pair_3_player_names TEXT[] NULL,
  goalie_1_player_id BIGINT NULL,
  goalie_1_name TEXT NULL,
  goalie_2_player_id BIGINT NULL,
  goalie_2_name TEXT NULL,
  scratches_player_ids BIGINT[] NULL,
  scratches_player_names TEXT[] NULL,
  injured_player_ids BIGINT[] NULL,
  injured_player_names TEXT[] NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lines_gdl_status_check
    CHECK (status = ANY (ARRAY['observed'::text, 'rejected'::text, 'superseded'::text]))
);

CREATE INDEX IF NOT EXISTS lines_gdl_snapshot_date_idx
  ON public.lines_gdl (snapshot_date DESC, team_id);

CREATE INDEX IF NOT EXISTS lines_gdl_game_idx
  ON public.lines_gdl (game_id, team_id);

COMMENT ON TABLE public.lines_gdl IS
  'Historical GameDayTweets lineup snapshots with explicit ordered line, pair, and goalie columns plus tweet-derived metadata.';
