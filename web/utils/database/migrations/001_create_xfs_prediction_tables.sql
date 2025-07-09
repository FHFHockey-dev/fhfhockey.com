-- Migration: Create xFS Prediction Tables
-- Description: Creates tables for Expected Fantasy Score (xFS) predictions, audit logs, and supporting indexes
-- Date: 2025-07-08

-- Create xFS 5-game predictions table
CREATE TABLE IF NOT EXISTS xfs_predictions_5_game (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL,
    player_name TEXT,
    prediction_date DATE NOT NULL,
    game_date DATE NOT NULL,
    xfs_score DECIMAL(10,4) NOT NULL,
    min_xfs DECIMAL(10,4) NOT NULL,
    max_xfs DECIMAL(10,4) NOT NULL,
    confidence_interval DECIMAL(5,4) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, prediction_date, game_date)
);

-- Create xFS 10-game predictions table
CREATE TABLE IF NOT EXISTS xfs_predictions_10_game (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL,
    player_name TEXT,
    prediction_date DATE NOT NULL,
    game_date DATE NOT NULL,
    xfs_score DECIMAL(10,4) NOT NULL,
    min_xfs DECIMAL(10,4) NOT NULL,
    max_xfs DECIMAL(10,4) NOT NULL,
    confidence_interval DECIMAL(5,4) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, prediction_date, game_date)
);

-- Create xFS audit log table for tracking prediction accuracy
CREATE TABLE IF NOT EXISTS xfs_audit_log (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL,
    player_name TEXT,
    prediction_date DATE NOT NULL,
    game_date DATE NOT NULL,
    predicted_xfs DECIMAL(10,4) NOT NULL,
    actual_fantasy_score DECIMAL(10,4),
    accuracy_score DECIMAL(5,4),
    prediction_horizon INTEGER NOT NULL, -- 5 or 10 games
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, prediction_date, game_date, prediction_horizon)
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_xfs_5_game_player_id ON xfs_predictions_5_game(player_id);
CREATE INDEX IF NOT EXISTS idx_xfs_5_game_prediction_date ON xfs_predictions_5_game(prediction_date);
CREATE INDEX IF NOT EXISTS idx_xfs_5_game_game_date ON xfs_predictions_5_game(game_date);
CREATE INDEX IF NOT EXISTS idx_xfs_5_game_player_prediction_date ON xfs_predictions_5_game(player_id, prediction_date);

CREATE INDEX IF NOT EXISTS idx_xfs_10_game_player_id ON xfs_predictions_10_game(player_id);
CREATE INDEX IF NOT EXISTS idx_xfs_10_game_prediction_date ON xfs_predictions_10_game(prediction_date);
CREATE INDEX IF NOT EXISTS idx_xfs_10_game_game_date ON xfs_predictions_10_game(game_date);
CREATE INDEX IF NOT EXISTS idx_xfs_10_game_player_prediction_date ON xfs_predictions_10_game(player_id, prediction_date);

CREATE INDEX IF NOT EXISTS idx_xfs_audit_player_id ON xfs_audit_log(player_id);
CREATE INDEX IF NOT EXISTS idx_xfs_audit_prediction_date ON xfs_audit_log(prediction_date);
CREATE INDEX IF NOT EXISTS idx_xfs_audit_game_date ON xfs_audit_log(game_date);
CREATE INDEX IF NOT EXISTS idx_xfs_audit_horizon ON xfs_audit_log(prediction_horizon);

-- Add comments for table documentation
COMMENT ON TABLE xfs_predictions_5_game IS 'Stores Expected Fantasy Score predictions for 5-game horizons';
COMMENT ON TABLE xfs_predictions_10_game IS 'Stores Expected Fantasy Score predictions for 10-game horizons';
COMMENT ON TABLE xfs_audit_log IS 'Audit log for tracking xFS prediction accuracy and model performance';

COMMENT ON COLUMN xfs_predictions_5_game.player_id IS 'References player ID from existing player tables';
COMMENT ON COLUMN xfs_predictions_5_game.player_name IS 'Name of the player';
COMMENT ON COLUMN xfs_predictions_5_game.prediction_date IS 'Date when the prediction was made';
COMMENT ON COLUMN xfs_predictions_5_game.game_date IS 'Date of the game being predicted';
COMMENT ON COLUMN xfs_predictions_5_game.xfs_score IS 'Expected Fantasy Score prediction';
COMMENT ON COLUMN xfs_predictions_5_game.min_xfs IS 'Minimum expected fantasy score for candlestick charts';
COMMENT ON COLUMN xfs_predictions_5_game.max_xfs IS 'Maximum expected fantasy score for candlestick charts';
COMMENT ON COLUMN xfs_predictions_5_game.confidence_interval IS 'Confidence interval for the prediction (0.0-1.0)';

COMMENT ON COLUMN xfs_predictions_10_game.player_id IS 'References player ID from existing player tables';
COMMENT ON COLUMN xfs_predictions_10_game.player_name IS 'Name of the player';
COMMENT ON COLUMN xfs_predictions_10_game.prediction_date IS 'Date when the prediction was made';
COMMENT ON COLUMN xfs_predictions_10_game.game_date IS 'Date of the game being predicted';
COMMENT ON COLUMN xfs_predictions_10_game.xfs_score IS 'Expected Fantasy Score prediction';
COMMENT ON COLUMN xfs_predictions_10_game.min_xfs IS 'Minimum expected fantasy score for candlestick charts';
COMMENT ON COLUMN xfs_predictions_10_game.max_xfs IS 'Maximum expected fantasy score for candlestick charts';
COMMENT ON COLUMN xfs_predictions_10_game.confidence_interval IS 'Confidence interval for the prediction (0.0-1.0)';

COMMENT ON COLUMN xfs_audit_log.player_id IS 'References player ID from existing player tables';
COMMENT ON COLUMN xfs_audit_log.player_name IS 'Name of the player';
COMMENT ON COLUMN xfs_audit_log.prediction_date IS 'Date when the prediction was made';
COMMENT ON COLUMN xfs_audit_log.game_date IS 'Date of the actual game';
COMMENT ON COLUMN xfs_audit_log.predicted_xfs IS 'The predicted fantasy score';
COMMENT ON COLUMN xfs_audit_log.actual_fantasy_score IS 'The actual fantasy score achieved';
COMMENT ON COLUMN xfs_audit_log.accuracy_score IS 'Calculated accuracy score for the prediction';
COMMENT ON COLUMN xfs_audit_log.prediction_horizon IS 'Number of games in prediction horizon (5 or 10)';