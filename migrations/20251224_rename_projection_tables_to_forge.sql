-- Rename projection engine v2 tables to a shared FORGE prefix
-- FORGE — Forecasting & Outcome Reconciliation Game Engine

-- Run metadata
ALTER TABLE IF EXISTS projection_runs_v2 RENAME TO forge_runs;

-- Derived aggregates
ALTER TABLE IF EXISTS player_game_strength_v2 RENAME TO forge_player_game_strength;
ALTER TABLE IF EXISTS team_game_strength_v2 RENAME TO forge_team_game_strength;
ALTER TABLE IF EXISTS goalie_game_v2 RENAME TO forge_goalie_game;

-- Overrides/events
ALTER TABLE IF EXISTS roster_events RENAME TO forge_roster_events;

-- Projection outputs
ALTER TABLE IF EXISTS player_projections_v2 RENAME TO forge_player_projections;
ALTER TABLE IF EXISTS team_projections_v2 RENAME TO forge_team_projections;
ALTER TABLE IF EXISTS goalie_projections_v2 RENAME TO forge_goalie_projections;

