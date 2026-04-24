ALTER TABLE public.lines_gdl
  ADD COLUMN IF NOT EXISTS tweet_posted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.lines_gdl.tweet_posted_at IS
  'Best-effort posted date/time for the underlying GameDayTweets source tweet. Day-level precision is common when derived from oEmbed markup.';
