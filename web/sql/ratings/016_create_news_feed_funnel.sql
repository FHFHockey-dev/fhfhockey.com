CREATE TABLE IF NOT EXISTS public.news_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_review_item_id UUID NULL REFERENCES public.tweet_pattern_review_items(id) ON DELETE SET NULL,
  source_tweet_id TEXT NULL,
  source_url TEXT NULL,
  tweet_url TEXT NULL,
  source_label TEXT NULL,
  source_account TEXT NULL,
  team_id BIGINT NULL REFERENCES public.teams(id) ON DELETE SET NULL,
  team_abbreviation TEXT NULL,
  headline TEXT NOT NULL,
  blurb TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  subcategory TEXT NULL,
  card_status TEXT NOT NULL DEFAULT 'draft',
  observed_at TIMESTAMPTZ NULL,
  published_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT news_feed_items_headline_check CHECK (btrim(headline) <> ''),
  CONSTRAINT news_feed_items_category_check CHECK (btrim(category) <> ''),
  CONSTRAINT news_feed_items_card_status_check
    CHECK (card_status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))
);

CREATE INDEX IF NOT EXISTS news_feed_items_status_idx
  ON public.news_feed_items (card_status, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS news_feed_items_review_item_idx
  ON public.news_feed_items (source_review_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS news_feed_items_team_idx
  ON public.news_feed_items (team_id, card_status, published_at DESC);

CREATE INDEX IF NOT EXISTS news_feed_items_category_idx
  ON public.news_feed_items (category, subcategory, card_status, published_at DESC);

CREATE TABLE IF NOT EXISTS public.news_feed_item_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_item_id UUID NOT NULL REFERENCES public.news_feed_items(id) ON DELETE CASCADE,
  player_id INTEGER NULL REFERENCES public.players(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  team_id INTEGER NULL REFERENCES public.teams(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'subject',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT news_feed_item_players_player_name_check CHECK (btrim(player_name) <> ''),
  CONSTRAINT news_feed_item_players_role_check CHECK (btrim(role) <> '')
);

CREATE INDEX IF NOT EXISTS news_feed_item_players_item_idx
  ON public.news_feed_item_players (news_item_id, created_at ASC);

CREATE INDEX IF NOT EXISTS news_feed_item_players_player_idx
  ON public.news_feed_item_players (player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.news_feed_keyword_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_review_item_id UUID NULL REFERENCES public.tweet_pattern_review_items(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual_review',
  phrase TEXT NOT NULL,
  normalized_phrase TEXT NOT NULL,
  scope_key TEXT NOT NULL UNIQUE,
  category TEXT NULL,
  subcategory TEXT NULL,
  notes TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT news_feed_keyword_phrases_phrase_check CHECK (btrim(phrase) <> ''),
  CONSTRAINT news_feed_keyword_phrases_status_check
    CHECK (status = ANY (ARRAY['active'::text, 'ignored'::text]))
);

CREATE INDEX IF NOT EXISTS news_feed_keyword_phrases_review_item_idx
  ON public.news_feed_keyword_phrases (source_review_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS news_feed_keyword_phrases_category_idx
  ON public.news_feed_keyword_phrases (category, subcategory, status, created_at DESC);

COMMENT ON TABLE public.news_feed_items IS
  'Distilled hockey news cards derived from reviewed tweet updates and reusable across feed, player flags, line-combo badges, and other site surfaces.';

COMMENT ON TABLE public.news_feed_item_players IS
  'Player assignments attached to distilled news cards so one update can affect multiple players.';

COMMENT ON TABLE public.news_feed_keyword_phrases IS
  'Manual keyword and phrase candidates captured during tweet review for future classifier and regex updates.';
