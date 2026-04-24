CREATE TABLE IF NOT EXISTS public.lines_ccc_ifttt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'ifttt',
  source_account TEXT NOT NULL DEFAULT 'CcCMiddleton',
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
  CONSTRAINT lines_ccc_ifttt_events_processing_status_check
    CHECK (processing_status = ANY (ARRAY[
      'pending'::text,
      'processed'::text,
      'rejected'::text,
      'failed'::text
    ]))
);

DROP INDEX IF EXISTS lines_ccc_ifttt_events_tweet_id_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS lines_ccc_ifttt_events_tweet_id_unique_idx
  ON public.lines_ccc_ifttt_events (tweet_id);

CREATE INDEX IF NOT EXISTS lines_ccc_ifttt_events_received_at_idx
  ON public.lines_ccc_ifttt_events (received_at DESC);

CREATE INDEX IF NOT EXISTS lines_ccc_ifttt_events_processing_status_idx
  ON public.lines_ccc_ifttt_events (processing_status, received_at DESC);

COMMENT ON TABLE public.lines_ccc_ifttt_events IS
  'Raw IFTTT tweet discovery events for the lines_ccc pipeline. These rows are a pending queue; parsing and NHL filtering happen downstream.';
