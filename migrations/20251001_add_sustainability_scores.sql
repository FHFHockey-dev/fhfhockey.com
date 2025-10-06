-- Step 4: Sustainability Scores table
-- Idempotent creation of sustainability_scores
CREATE TABLE IF NOT EXISTS sustainability_scores (
  player_id       INT4        NOT NULL,
  season_id       INTEGER     NOT NULL,
  snapshot_date   DATE        NOT NULL,
  position_group  TEXT        NOT NULL,
  window_code     TEXT        NOT NULL,
  s_raw           DOUBLE PRECISION NOT NULL,
  s_100           DOUBLE PRECISION NOT NULL,
  components      JSONB       NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, snapshot_date, window_code)
);
CREATE INDEX IF NOT EXISTS idx_susscore_season ON sustainability_scores (season_id);
CREATE INDEX IF NOT EXISTS idx_susscore_player ON sustainability_scores (player_id);
