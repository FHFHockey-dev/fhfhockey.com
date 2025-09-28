-- Migration: create sustainability_run_logs table
-- Purpose: Persist orchestrated sustainability pipeline run summaries (Task 5.1: run logging)
-- Generated: 2025-09-28

-- NOTE: Uses timestamptz for temporal correctness. Advisory locking uses pg advisory locks
-- and does NOT require a table; this table is purely for auditing / observability.

BEGIN;

-- Ensure referenced config table has a unique composite key (adjust if different in prod schema)
-- If model_sustainability_config already has PRIMARY KEY(model_version) and a stable config_hash
-- you may want a UNIQUE(model_version, config_hash) there. If that does not exist, either add it
-- or drop the FK below.

CREATE TABLE IF NOT EXISTS sustainability_run_logs (
    id BIGSERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL,
    model_version INTEGER NOT NULL,
    config_hash TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
    total_rows_scored INTEGER NOT NULL DEFAULT 0 CHECK (total_rows_scored >= 0),
    persisted_count INTEGER NOT NULL DEFAULT 0 CHECK (persisted_count >= 0),
    snapshot_n INTEGER NULL CHECK (snapshot_n IS NULL OR snapshot_n >= 0),
    status TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'error' (extend as needed)
    meta_json JSONB NULL,             -- phased timing, errors, incremental info, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Optional: tie back to config row if composite uniqueness exists
    CONSTRAINT fk_run_logs_config
        FOREIGN KEY (model_version)
        REFERENCES model_sustainability_config(model_version)
        ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE
);

-- If you add UNIQUE(model_version, config_hash) on model_sustainability_config you can instead:
-- ALTER TABLE sustainability_run_logs DROP CONSTRAINT fk_run_logs_config;
-- ALTER TABLE sustainability_run_logs
--   ADD CONSTRAINT fk_run_logs_config FOREIGN KEY (model_version, config_hash)
--   REFERENCES model_sustainability_config(model_version, config_hash) ON DELETE SET NULL;

COMMENT ON TABLE sustainability_run_logs IS 'Audit log for sustainability pipeline orchestrator runs.';
COMMENT ON COLUMN sustainability_run_logs.meta_json IS 'Arbitrary JSON details: phase timings, errors, incremental stats.';

-- For fast lookups of recent runs per season/model
CREATE INDEX IF NOT EXISTS idx_sustainability_run_logs_model_season_started
    ON sustainability_run_logs (model_version, season_id, started_at DESC);

-- For filtering by status quickly
CREATE INDEX IF NOT EXISTS idx_sustainability_run_logs_status
    ON sustainability_run_logs (status);

-- JSONB GIN index (optional). Use jsonb_path_ops for smaller index if queries are key-path exact matches.
CREATE INDEX IF NOT EXISTS idx_sustainability_run_logs_meta_gin
    ON sustainability_run_logs USING GIN (meta_json jsonb_path_ops);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION trg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_sustainability_run_logs_touch ON sustainability_run_logs;
CREATE TRIGGER trg_sustainability_run_logs_touch
BEFORE UPDATE ON sustainability_run_logs
FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

COMMIT;

-- Rollback snippet (manual):
-- BEGIN; DROP TABLE IF EXISTS sustainability_run_logs; DROP FUNCTION IF EXISTS trg_touch_updated_at(); COMMIT;