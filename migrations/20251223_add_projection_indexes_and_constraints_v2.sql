-- Additional constraints and access-pattern indexes for projection engine tables (v2)

-- Ensure roster events are anchored to at least a team or a player.
ALTER TABLE roster_events
ADD CONSTRAINT roster_events_subject_check
CHECK (team_id IS NOT NULL OR player_id IS NOT NULL);

-- Projection query patterns typically filter by (as_of_date, horizon_games) and/or (team_id/opponent_team_id).
CREATE INDEX IF NOT EXISTS idx_player_projections_v2_date_horizon
ON player_projections_v2 (as_of_date, horizon_games);

CREATE INDEX IF NOT EXISTS idx_player_projections_v2_date_team_horizon
ON player_projections_v2 (as_of_date, team_id, horizon_games);

CREATE INDEX IF NOT EXISTS idx_player_projections_v2_date_opponent_horizon
ON player_projections_v2 (as_of_date, opponent_team_id, horizon_games);

CREATE INDEX IF NOT EXISTS idx_team_projections_v2_date_horizon
ON team_projections_v2 (as_of_date, horizon_games);

CREATE INDEX IF NOT EXISTS idx_team_projections_v2_date_team_horizon
ON team_projections_v2 (as_of_date, team_id, horizon_games);

CREATE INDEX IF NOT EXISTS idx_goalie_projections_v2_date_horizon
ON goalie_projections_v2 (as_of_date, horizon_games);

CREATE INDEX IF NOT EXISTS idx_goalie_projections_v2_date_team_horizon
ON goalie_projections_v2 (as_of_date, team_id, horizon_games);

