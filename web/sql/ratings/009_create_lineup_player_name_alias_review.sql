CREATE TABLE IF NOT EXISTS public.lineup_player_name_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  player_id INTEGER NOT NULL REFERENCES public.players(id),
  player_name TEXT NOT NULL,
  team_id INTEGER NULL REFERENCES public.teams(id),
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lineup_player_name_aliases_normalized_player_idx
  ON public.lineup_player_name_aliases (normalized_alias, player_id);

CREATE INDEX IF NOT EXISTS lineup_player_name_aliases_team_idx
  ON public.lineup_player_name_aliases (team_id, normalized_alias);

CREATE TABLE IF NOT EXISTS public.lineup_unresolved_player_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  source_url TEXT NULL,
  tweet_id TEXT NULL,
  raw_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  team_id INTEGER NULL REFERENCES public.teams(id),
  team_abbreviation TEXT NULL,
  context_text TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_player_id INTEGER NULL REFERENCES public.players(id),
  resolved_alias_id UUID NULL REFERENCES public.lineup_player_name_aliases(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lineup_unresolved_player_names_status_check
    CHECK (status IN ('pending', 'resolved', 'ignored'))
);

CREATE INDEX IF NOT EXISTS lineup_unresolved_player_names_status_idx
  ON public.lineup_unresolved_player_names (status, created_at DESC);

CREATE INDEX IF NOT EXISTS lineup_unresolved_player_names_team_idx
  ON public.lineup_unresolved_player_names (team_id, normalized_name);

COMMENT ON TABLE public.lineup_player_name_aliases IS
  'Manual parser alias/nickname mappings from source text names to canonical NHL player ids.';

COMMENT ON TABLE public.lineup_unresolved_player_names IS
  'Operational review queue for names the tweet/lineup parser could not map to a player id.';
