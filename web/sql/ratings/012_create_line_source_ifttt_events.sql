CREATE TABLE IF NOT EXISTS public.line_source_ifttt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'ifttt',
  source_group TEXT NOT NULL,
  source_key TEXT NOT NULL,
  source_account TEXT NOT NULL,
  username TEXT NULL,
  text TEXT NULL,
  link_to_tweet TEXT NULL,
  tweet_id TEXT NULL,
  tweet_embed_code TEXT NULL,
  tweet_created_at TIMESTAMPTZ NULL,
  created_at_label TEXT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT line_source_ifttt_events_source_group_check
    CHECK (btrim(source_group) <> ''),
  CONSTRAINT line_source_ifttt_events_source_key_check
    CHECK (btrim(source_key) <> ''),
  CONSTRAINT line_source_ifttt_events_source_account_check
    CHECK (btrim(source_account) <> ''),
  CONSTRAINT line_source_ifttt_events_processing_status_check
    CHECK (processing_status = ANY (ARRAY[
      'pending'::text,
      'processed'::text,
      'rejected'::text,
      'failed'::text
    ]))
);

CREATE UNIQUE INDEX IF NOT EXISTS line_source_ifttt_events_source_tweet_unique_idx
  ON public.line_source_ifttt_events (source_key, tweet_id);

CREATE INDEX IF NOT EXISTS line_source_ifttt_events_processing_status_idx
  ON public.line_source_ifttt_events (
    processing_status,
    source_group,
    source_key,
    received_at DESC
  );

CREATE INDEX IF NOT EXISTS line_source_ifttt_events_received_at_idx
  ON public.line_source_ifttt_events (received_at DESC);

CREATE INDEX IF NOT EXISTS line_source_ifttt_events_source_account_idx
  ON public.line_source_ifttt_events (source_account, received_at DESC);

COMMENT ON TABLE public.line_source_ifttt_events IS
  'Generic raw IFTTT tweet discovery queue for tweet-derived lineup/news sources beyond the original CCC-specific pipeline.';

COMMENT ON COLUMN public.line_source_ifttt_events.source_group IS
  'Logical source family such as gdl_suite. Enables processing a related group together.';

COMMENT ON COLUMN public.line_source_ifttt_events.source_key IS
  'Stable parser/display key for one configured source account, such as gamedaygoalies, gamedaylines, or gamedaynewsnhl.';
