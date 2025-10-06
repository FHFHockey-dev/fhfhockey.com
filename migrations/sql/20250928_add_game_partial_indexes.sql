-- Migration: Additional partial indexes optimized for GAME window queries
-- Date: 2025-09-28
-- Purpose: Implements optimization for frequent leaderboard and recency queries (Task 1.3)

BEGIN;

-- Partial index targeting leaderboard sorts (score desc) restricted to GAME rows only
CREATE INDEX IF NOT EXISTS idx_barometers_game_score_desc
  ON model_player_game_barometers (sustainability_score DESC, game_date DESC)
  WHERE window_type = 'GAME';

-- Optional covering index (player_id + date) just for GAME rows (can accelerate sparkline pulls if table grows large)
CREATE INDEX IF NOT EXISTS idx_barometers_game_player_date
  ON model_player_game_barometers (player_id, game_date DESC)
  WHERE window_type = 'GAME';

COMMIT;
