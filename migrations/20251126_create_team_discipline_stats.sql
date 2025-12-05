-- Create team_discipline_stats table
-- Tracks team-level discipline and physical metrics to predict opponent opportunities (PPs, Hits, Blocks)

CREATE TABLE IF NOT EXISTS team_discipline_stats (
    team_id INT NOT NULL,
    date DATE NOT NULL,
    season_id INT NOT NULL,

    -- Discipline & Special Teams Opportunities
    times_shorthanded_per_60 NUMERIC,      -- Predicts Opponent PP Opportunities
    times_powerplay_per_60 NUMERIC,        -- Predicts Own PP Opportunities
    penalties_taken_per_60 NUMERIC,        -- Explicit penalty tracking
    penalties_drawn_per_60 NUMERIC,        -- Explicit penalty drawing
    toi_shorthanded_per_game NUMERIC,      -- Average time spent on PK per game

    -- Physicality & Opponent Reactions
    hits_taken_per_60 NUMERIC,             -- Predicts Opponent Hit totals
    shots_blocked_by_opponent_per_60 NUMERIC, -- Predicts Opponent Block totals

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (team_id, date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_discipline_stats_date ON team_discipline_stats(date);
CREATE INDEX IF NOT EXISTS idx_team_discipline_stats_team_date ON team_discipline_stats(team_id, date);
