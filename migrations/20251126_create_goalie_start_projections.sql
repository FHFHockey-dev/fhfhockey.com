-- Create goalie_start_projections table
-- Predicts who will start and how they will perform.

CREATE TABLE IF NOT EXISTS goalie_start_projections (
    game_id INT NOT NULL,
    team_id INT NOT NULL,
    player_id INT NOT NULL,
    
    start_probability NUMERIC CHECK (start_probability >= 0 AND start_probability <= 1), -- 0.0 - 1.0
    projected_gsaa_per_60 NUMERIC, -- Goals Saved Above Average projection
    confirmed_status BOOLEAN DEFAULT FALSE, -- True if starter is confirmed
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (game_id, player_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_goalie_start_projections_game ON goalie_start_projections(game_id);
CREATE INDEX IF NOT EXISTS idx_goalie_start_projections_team ON goalie_start_projections(team_id);
CREATE INDEX IF NOT EXISTS idx_goalie_start_projections_player ON goalie_start_projections(player_id);
