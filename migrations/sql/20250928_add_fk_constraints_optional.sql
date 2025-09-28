-- Migration: Add optional foreign key constraints for sustainability tables
-- Date: 2025-09-28
-- Notes:
--   Assumes existence of a `players` table with primary key `id` (BIGINT / INTEGER).
--   Uses dynamic checks; if table or column mismatch, logs NOTICE and continues.

BEGIN;

DO $$
DECLARE
  has_players BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
     WHERE table_name = 'players'
  ) INTO has_players;

  IF has_players THEN
    -- player_priors_cache FK
    BEGIN
      ALTER TABLE player_priors_cache
        ADD CONSTRAINT fk_player_priors_player
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'FK fk_player_priors_player already exists';
    WHEN undefined_column THEN
      RAISE NOTICE 'players.id column not found; skipping fk_player_priors_player';
    END;

    -- model_player_game_barometers FK
    BEGIN
      ALTER TABLE model_player_game_barometers
        ADD CONSTRAINT fk_barometers_player
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'FK fk_barometers_player already exists';
    WHEN undefined_column THEN
      RAISE NOTICE 'players.id column not found; skipping fk_barometers_player';
    END;

    -- sustainability_recompute_queue FK (nullable player_id)
    BEGIN
      ALTER TABLE sustainability_recompute_queue
        ADD CONSTRAINT fk_recompute_player
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'FK fk_recompute_player already exists';
    WHEN undefined_column THEN
      RAISE NOTICE 'players.id column not found; skipping fk_recompute_player';
    END;
  ELSE
    RAISE NOTICE 'players table not found; skipping FK constraints.';
  END IF;
END$$;

COMMIT;
