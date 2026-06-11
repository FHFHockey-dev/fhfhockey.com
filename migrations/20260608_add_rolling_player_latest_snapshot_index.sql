-- Improve contextual rankings latest-player snapshot reads.
--
-- The rankings matrix needs recent rolling rows by season, strength, and game
-- date, then dedupes to the newest row per player. Existing indexes are close
-- but either place team_id before player_id or include line/PP context columns
-- before game_date. This index matches the cold snapshot read path directly.

CREATE INDEX IF NOT EXISTS idx_rpgm_latest_snapshot_lookup
  ON public.rolling_player_game_metrics (
    season,
    strength_state,
    game_date DESC,
    player_id,
    updated_at DESC NULLS LAST
  );
