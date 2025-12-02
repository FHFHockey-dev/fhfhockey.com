-- Create player_projections table (Start Chart output)
-- Stores per-game projections for skaters including matchup grading

CREATE TABLE IF NOT EXISTS player_projections (
    player_id           BIGINT      NOT NULL,
    game_id             BIGINT      NOT NULL,
    opponent_team_id    BIGINT      NOT NULL,
    proj_goals          NUMERIC,
    proj_assists        NUMERIC,
    proj_shots          NUMERIC,
    proj_pp_points      NUMERIC,
    proj_hits           NUMERIC,
    proj_blocks         NUMERIC,
    proj_pim            NUMERIC,
    proj_fantasy_points NUMERIC,
    matchup_grade       NUMERIC, -- 0-100 score of matchup favorability
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (player_id, game_id)
);

-- Helpful indexes for lookup by game and opponent
CREATE INDEX IF NOT EXISTS idx_player_projections_game ON player_projections (game_id);
CREATE INDEX IF NOT EXISTS idx_player_projections_player ON player_projections (player_id);
CREATE INDEX IF NOT EXISTS idx_player_projections_opponent ON player_projections (opponent_team_id);
