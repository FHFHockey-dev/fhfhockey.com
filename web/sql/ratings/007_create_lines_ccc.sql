CREATE TABLE IF NOT EXISTS public.lines_ccc (
  capture_key TEXT PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tweet_posted_at TIMESTAMPTZ NULL,
  tweet_posted_label TEXT NULL,
  game_id BIGINT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id BIGINT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_abbreviation TEXT NULL,
  team_name TEXT NULL,
  source TEXT NOT NULL DEFAULT 'lines_ccc',
  source_url TEXT NULL,
  source_label TEXT NULL,
  source_handle TEXT NULL,
  author_name TEXT NULL,
  tweet_id TEXT NULL,
  tweet_url TEXT NULL,
  quoted_tweet_id TEXT NULL,
  quoted_tweet_url TEXT NULL,
  quoted_author_handle TEXT NULL,
  quoted_author_name TEXT NULL,
  primary_text_source TEXT NULL,
  classification TEXT NULL,
  detected_league TEXT NULL,
  nhl_filter_status TEXT NOT NULL DEFAULT 'accepted',
  nhl_filter_reason TEXT NULL,
  status TEXT NOT NULL DEFAULT 'observed',
  raw_text TEXT NULL,
  enriched_text TEXT NULL,
  quoted_raw_text TEXT NULL,
  quoted_enriched_text TEXT NULL,
  keyword_hits TEXT[] NULL,
  matched_player_ids BIGINT[] NULL,
  matched_player_names TEXT[] NULL,
  unmatched_names TEXT[] NULL,
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
  CONSTRAINT lines_ccc_status_check
    CHECK (status = ANY (ARRAY['observed'::text, 'rejected'::text, 'superseded'::text])),
  CONSTRAINT lines_ccc_nhl_filter_status_check
    CHECK (nhl_filter_status = ANY (ARRAY[
      'accepted'::text,
      'rejected_non_nhl'::text,
      'rejected_ambiguous'::text,
      'rejected_insufficient_text'::text
    ])),
  CONSTRAINT lines_ccc_primary_text_source_check
    CHECK (
      primary_text_source IS NULL
      OR primary_text_source = ANY (ARRAY[
        'wrapper_oembed'::text,
        'quoted_oembed'::text,
        'retweet_oembed'::text,
        'ifttt_text'::text,
        'manual_fixture'::text
      ])
    ),
  CONSTRAINT lines_ccc_accepted_team_required_check
    CHECK (
      status <> 'observed'
      OR nhl_filter_status <> 'accepted'
      OR (
        team_id IS NOT NULL
        AND team_abbreviation IS NOT NULL
        AND team_name IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS lines_ccc_snapshot_date_idx
  ON public.lines_ccc (snapshot_date DESC, team_id);

CREATE INDEX IF NOT EXISTS lines_ccc_game_idx
  ON public.lines_ccc (game_id, team_id);

CREATE INDEX IF NOT EXISTS lines_ccc_status_idx
  ON public.lines_ccc (status, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS lines_ccc_nhl_filter_status_idx
  ON public.lines_ccc (nhl_filter_status, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS lines_ccc_tweet_id_idx
  ON public.lines_ccc (tweet_id);

CREATE INDEX IF NOT EXISTS lines_ccc_quoted_tweet_id_idx
  ON public.lines_ccc (quoted_tweet_id);

CREATE UNIQUE INDEX IF NOT EXISTS lines_ccc_tweet_id_team_unique_idx
  ON public.lines_ccc (tweet_id, team_id)
  WHERE tweet_id IS NOT NULL
    AND team_id IS NOT NULL
    AND status = 'observed'
    AND nhl_filter_status = 'accepted';

CREATE UNIQUE INDEX IF NOT EXISTS lines_ccc_quoted_tweet_id_team_unique_idx
  ON public.lines_ccc (quoted_tweet_id, team_id)
  WHERE quoted_tweet_id IS NOT NULL
    AND team_id IS NOT NULL
    AND status = 'observed'
    AND nhl_filter_status = 'accepted';

COMMENT ON TABLE public.lines_ccc IS
  'Historical LinesLinesLines/CcCMiddleton tweet-derived lineup snapshots with quote-tweet provenance, NHL filtering, and explicit ordered line, pair, and goalie columns.';

COMMENT ON COLUMN public.lines_ccc.tweet_posted_at IS
  'Best-effort posted date/time for the wrapper or primary tweet. Keep nullable or day-precision when exact tweet timestamps are not available.';

COMMENT ON COLUMN public.lines_ccc.nhl_filter_status IS
  'Accepted and rejected audit state for CCC tweets, including non-NHL and ambiguous lineup-style content.';
