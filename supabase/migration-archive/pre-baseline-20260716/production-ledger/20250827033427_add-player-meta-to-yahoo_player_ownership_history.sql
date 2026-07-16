ALTER TABLE IF EXISTS public.yahoo_player_ownership_history
ADD COLUMN IF NOT EXISTS player_name text,
ADD COLUMN IF NOT EXISTS player_id bigint,
ADD COLUMN IF NOT EXISTS game_id text,
ADD COLUMN IF NOT EXISTS season_start_year integer,
ADD COLUMN IF NOT EXISTS season_id bigint,
ADD COLUMN IF NOT EXISTS league_id text;

-- Add unique constraint for idempotent upserts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.contype = 'u' AND t.relname = 'yahoo_player_ownership_history' AND array_to_string(c.conkey, ',') LIKE '%1%'
    ) THEN
        BEGIN
            ALTER TABLE public.yahoo_player_ownership_history
            ADD CONSTRAINT yahoo_player_ownership_history_player_key_date_unique UNIQUE (player_key, ownership_date);
        EXCEPTION WHEN duplicate_object THEN
            -- ignore
        END;
    END IF;
END$$;

-- Create indexes to speed common queries
CREATE INDEX IF NOT EXISTS idx_yahoo_player_ownership_history_player_key ON public.yahoo_player_ownership_history (player_key);
CREATE INDEX IF NOT EXISTS idx_yahoo_player_ownership_history_player_id ON public.yahoo_player_ownership_history (player_id);
CREATE INDEX IF NOT EXISTS idx_yahoo_player_ownership_history_season_start_year ON public.yahoo_player_ownership_history (season_start_year);
CREATE INDEX IF NOT EXISTS idx_yahoo_player_ownership_history_game_id ON public.yahoo_player_ownership_history (game_id);
;
