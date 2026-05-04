CREATE TABLE IF NOT EXISTS public.tweet_pattern_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  source_table TEXT NOT NULL,
  source_row_key TEXT NOT NULL,
  source_group TEXT NULL,
  source_key TEXT NULL,
  source_account TEXT NULL,
  source_label TEXT NULL,
  source_handle TEXT NULL,
  author_name TEXT NULL,
  snapshot_date DATE NULL,
  source_created_at TIMESTAMPTZ NULL,
  tweet_id TEXT NULL,
  tweet_url TEXT NULL,
  source_url TEXT NULL,
  quoted_tweet_id TEXT NULL,
  quoted_tweet_url TEXT NULL,
  team_id BIGINT NULL REFERENCES public.teams(id) ON DELETE SET NULL,
  team_abbreviation TEXT NULL,
  parser_classification TEXT NULL,
  parser_filter_status TEXT NULL,
  parser_filter_reason TEXT NULL,
  keyword_hits TEXT[] NULL,
  review_text TEXT NULL,
  raw_text TEXT NULL,
  enriched_text TEXT NULL,
  quoted_text TEXT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_category TEXT NULL,
  reviewed_subcategory TEXT NULL,
  selected_highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tweet_pattern_review_items_source_table_check
    CHECK (btrim(source_table) <> ''),
  CONSTRAINT tweet_pattern_review_items_source_row_key_check
    CHECK (btrim(source_row_key) <> ''),
  CONSTRAINT tweet_pattern_review_items_review_status_check
    CHECK (review_status = ANY (ARRAY[
      'pending'::text,
      'reviewed'::text,
      'ignored'::text
    ]))
);

CREATE UNIQUE INDEX IF NOT EXISTS tweet_pattern_review_items_source_row_unique_idx
  ON public.tweet_pattern_review_items (source_table, source_row_key);

CREATE INDEX IF NOT EXISTS tweet_pattern_review_items_status_idx
  ON public.tweet_pattern_review_items (review_status, source_created_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS tweet_pattern_review_items_source_idx
  ON public.tweet_pattern_review_items (source_group, source_key, source_account, source_created_at DESC);

CREATE INDEX IF NOT EXISTS tweet_pattern_review_items_tweet_idx
  ON public.tweet_pattern_review_items (tweet_id, source_created_at DESC);

CREATE INDEX IF NOT EXISTS tweet_pattern_review_items_team_parser_idx
  ON public.tweet_pattern_review_items (team_id, parser_classification, parser_filter_status);

COMMENT ON TABLE public.tweet_pattern_review_items IS
  'Operational tweet-by-tweet manual review queue for pattern analysis, category assignment, evidence highlights, and downstream keyword/regression refinement.';
