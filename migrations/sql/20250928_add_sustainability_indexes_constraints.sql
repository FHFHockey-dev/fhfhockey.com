-- Migration: Add additional indexes & constraints for Sustainability Barometer
-- Purpose: Implements sub-task 1.2 (composite indexes, uniqueness, check constraints, performance tuning)
-- Date: 2025-09-28

BEGIN;

-- Ensure window_type domain consistency (GAME, G5, G10, STD)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'chk_barometers_window_type'
      AND c.conrelid = 'model_player_game_barometers'::regclass
  ) THEN
    -- Add NOT VALID first to avoid a full table scan/block; then validate
    ALTER TABLE model_player_game_barometers
      ADD CONSTRAINT chk_barometers_window_type
      CHECK (window_type IN ('GAME','G5','G10','STD')) NOT VALID;

    ALTER TABLE model_player_game_barometers
      VALIDATE CONSTRAINT chk_barometers_window_type;
  END IF;
END
$$;

-- Optional uniqueness: prevent duplicate rows for same player/window/date/model_version
-- (Allows coexistence of different model versions for same date if version changes.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_barometers_player_window_date_version
  ON model_player_game_barometers (player_id, window_type, game_date, model_version);

-- Composite retrieval index (player summary lookups by season & player)
CREATE INDEX IF NOT EXISTS idx_barometers_player_season_window
  ON model_player_game_barometers (player_id, season_id, window_type, game_date DESC);

-- Tier filtering & leaderboard sorting (common pattern: window_type + quintile + recent date)
CREATE INDEX IF NOT EXISTS idx_barometers_window_quintile_date
  ON model_player_game_barometers (window_type, sustainability_quintile, game_date DESC);

-- Combined index to support config/version-based drilling or auditing
CREATE INDEX IF NOT EXISTS idx_barometers_version_hash
  ON model_player_game_barometers (model_version, config_hash);

-- Player priors quick lookup by stat across versions (if multiple versions retained)
CREATE INDEX IF NOT EXISTS idx_player_priors_player_stat
  ON player_priors_cache (player_id, stat_code, season_id);

COMMIT;