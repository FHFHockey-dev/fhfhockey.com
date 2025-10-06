-- Migration: Create core tables for Sustainability Barometer feature
-- Date: 2025-09-28
-- Model Version: 1 (initial)
-- Idempotent: uses IF NOT EXISTS and ON CONFLICT patterns left to application layer

BEGIN;

/*
 Table: priors_cache
 Purpose: Store league × position Beta priors for regression-prone stats per season.
*/
CREATE TABLE IF NOT EXISTS priors_cache (
  season_id        INT NOT NULL,
  position_code    TEXT NOT NULL,              -- C, LW, RW, D
  stat_code        TEXT NOT NULL,              -- sh_pct | oish_pct | ipp
  alpha0           DOUBLE PRECISION NOT NULL,
  beta0            DOUBLE PRECISION NOT NULL,
  k                INT NOT NULL,
  league_mu        DOUBLE PRECISION NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (season_id, position_code, stat_code)
);

CREATE INDEX IF NOT EXISTS idx_priors_cache_season_pos ON priors_cache (season_id, position_code);

/*
 Table: player_priors_cache
 Purpose: Store player multi-season blended counts + posterior means.
*/
CREATE TABLE IF NOT EXISTS player_priors_cache (
  player_id        BIGINT NOT NULL,
  season_id        INT NOT NULL,               -- Target season for which prior applies
  position_code    TEXT NOT NULL,
  stat_code        TEXT NOT NULL,
  successes_blend  DOUBLE PRECISION NOT NULL,
  trials_blend     DOUBLE PRECISION NOT NULL,
  post_mean        DOUBLE PRECISION NOT NULL,
  rookie_status    BOOLEAN NOT NULL DEFAULT FALSE,
  model_version    INT NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, season_id, stat_code)
);

CREATE INDEX IF NOT EXISTS idx_player_priors_lookup ON player_priors_cache (player_id, season_id);
CREATE INDEX IF NOT EXISTS idx_player_priors_stat ON player_priors_cache (stat_code);

/*
 Table: sustainability_sigma_constants
 Purpose: Fixed standard deviation constants for initial ("fixed") σ mode; keyed by metric × position.
*/
CREATE TABLE IF NOT EXISTS sustainability_sigma_constants (
  metric_code    TEXT NOT NULL,
  position_code  TEXT NOT NULL,
  sigma          DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (metric_code, position_code)
);

/*
 Table: model_sustainability_config
 Purpose: Versioned configuration (weights, toggles, constants, modes) enabling reproducibility.
*/
CREATE TABLE IF NOT EXISTS model_sustainability_config (
  id              BIGSERIAL PRIMARY KEY,
  model_version   INT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  weights_json    JSONB NOT NULL,
  toggles_json    JSONB NOT NULL,
  constants_json  JSONB NOT NULL,
  sd_mode         TEXT NOT NULL CHECK (sd_mode IN ('fixed','empirical')),
  freshness_days  INT NOT NULL DEFAULT 45,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sustain_config_active_version ON model_sustainability_config (active DESC, model_version DESC);

/*
 Table: model_player_game_barometers
 Purpose: Persist sustainability scores per player per window (GAME, G5, G10, STD).
*/
CREATE TABLE IF NOT EXISTS model_player_game_barometers (
  id                        BIGSERIAL PRIMARY KEY,
  player_id                 BIGINT NOT NULL,
  game_id                   BIGINT,                           -- NULL for STD if not tied to specific game
  game_date                 DATE NOT NULL,
  season_id                 INT NOT NULL,
  window_type               TEXT NOT NULL,                    -- 'GAME' | 'G5' | 'G10' | 'STD'
  sustainability_score      INT NOT NULL CHECK (sustainability_score BETWEEN 0 AND 100),
  sustainability_score_raw  DOUBLE PRECISION NOT NULL CHECK (sustainability_score_raw >= 0 AND sustainability_score_raw <= 1),
  sustainability_quintile   SMALLINT,                         -- 0–4 dynamic tiers
  status                    TEXT NOT NULL,                    -- 'ok' | 'provisional' | 'missing_component'
  model_version             INT NOT NULL,
  config_hash               TEXT NOT NULL,
  components_json           JSONB NOT NULL,
  rookie_status             BOOLEAN NOT NULL DEFAULT FALSE,
  extreme_flag              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite & partial indexes for query patterns
CREATE INDEX IF NOT EXISTS idx_barometers_player_window_date ON model_player_game_barometers (player_id, window_type, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_barometers_window_score ON model_player_game_barometers (window_type, sustainability_score DESC);
CREATE INDEX IF NOT EXISTS idx_barometers_game_partial ON model_player_game_barometers (game_date DESC) WHERE window_type = 'GAME';
CREATE INDEX IF NOT EXISTS idx_barometers_model_version ON model_player_game_barometers (model_version);

/*
 Table: sustainability_distribution_snapshots
 Purpose: Store nightly distribution percentiles & summary statistics for tiering and drift monitoring.
*/
CREATE TABLE IF NOT EXISTS sustainability_distribution_snapshots (
  snapshot_date      DATE NOT NULL,
  season_id          INT NOT NULL,
  model_version      INT NOT NULL,
  window_type        TEXT NOT NULL DEFAULT 'GAME',
  percentiles_json   JSONB NOT NULL,
  stats_json         JSONB NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (snapshot_date, window_type, model_version)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_season_version ON sustainability_distribution_snapshots (season_id, model_version);

/*
 Table: sustainability_recompute_queue
 Purpose: Queue for retroactive recomputation triggered by config / data backfills.
*/
CREATE TABLE IF NOT EXISTS sustainability_recompute_queue (
  id            BIGSERIAL PRIMARY KEY,
  player_id     BIGINT,
  season_id     INT,
  reason        TEXT NOT NULL,                 -- 'config_change' | 'data_backfill'
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'done' | 'error'
  enqueued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_recompute_status ON sustainability_recompute_queue (status);
CREATE INDEX IF NOT EXISTS idx_recompute_player ON sustainability_recompute_queue (player_id, season_id);

COMMIT;
