ALTER TABLE public.tweet_pattern_review_items
  ADD COLUMN IF NOT EXISTS review_assignments JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tweet_pattern_review_items.review_assignments IS
  'Manual one-to-many review assignments for a tweet, including category, subcategory, linked players, evidence phrases, and reviewer notes.';
