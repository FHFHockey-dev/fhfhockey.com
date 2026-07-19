BEGIN;

CREATE TABLE IF NOT EXISTS public.nhl_player_contracts (
  contract_key TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'nhlscraper',
  source_package_version TEXT NOT NULL,
  source_file TEXT NULL,
  player_id BIGINT NULL REFERENCES public.players(id) ON DELETE SET NULL,
  player_full_name TEXT NOT NULL CHECK (btrim(player_full_name) <> ''),
  position_code TEXT NULL,
  team_tri_code TEXT NULL,
  team_id INTEGER NULL,
  signed_with_team_tri_code TEXT NULL,
  signed_with_team_id INTEGER NULL,
  age_at_signing INTEGER NULL CHECK (age_at_signing IS NULL OR age_at_signing >= 0),
  start_season_id INTEGER NOT NULL,
  end_season_id INTEGER NOT NULL,
  contract_years INTEGER NULL CHECK (contract_years IS NULL OR contract_years >= 0),
  contract_value NUMERIC(14, 2) NULL,
  contract_aav NUMERIC(14, 2) NULL,
  signing_bonus NUMERIC(14, 2) NULL,
  two_year_cash NUMERIC(14, 2) NULL,
  three_year_cash NUMERIC(14, 2) NULL,
  resolution_status TEXT NOT NULL CHECK (
    resolution_status IN (
      'matched',
      'unmatched',
      'ambiguous',
      'not_attempted'
    )
  ),
  resolution_candidate_count INTEGER NOT NULL DEFAULT 0 CHECK (resolution_candidate_count >= 0),
  raw_contract JSONB NOT NULL DEFAULT '{}'::JSONB,
  provenance JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nhl_player_contracts_player
  ON public.nhl_player_contracts (player_id, start_season_id DESC)
  WHERE player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nhl_player_contracts_name
  ON public.nhl_player_contracts (player_full_name, start_season_id DESC);

CREATE INDEX IF NOT EXISTS idx_nhl_player_contracts_seasons
  ON public.nhl_player_contracts (start_season_id, end_season_id);

CREATE INDEX IF NOT EXISTS idx_nhl_player_contracts_team
  ON public.nhl_player_contracts (team_id, signed_with_team_id, start_season_id DESC);

ALTER TABLE public.nhl_player_contracts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.nhl_player_contracts TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.nhl_player_contracts FROM anon, authenticated;

DROP POLICY IF EXISTS "public_read" ON public.nhl_player_contracts;
CREATE POLICY "public_read"
  ON public.nhl_player_contracts
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.nhl_player_contracts IS
  'NHL player contract rows extracted from nhlscraper packaged contract data.';

COMMENT ON COLUMN public.nhl_player_contracts.two_year_cash IS
  'Two-year cash value present in nhlscraper internal .contracts_base but omitted from contracts().';

COMMENT ON COLUMN public.nhl_player_contracts.three_year_cash IS
  'Three-year cash value present in nhlscraper internal .contracts_base but omitted from contracts().';

COMMIT;;
