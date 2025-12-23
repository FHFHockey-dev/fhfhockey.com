-- Projection engine output tables (v2)
-- These tables are written by the compute layer and served by the API.

CREATE TABLE IF NOT EXISTS player_projections_v2 (
    run_id UUID NOT NULL REFERENCES projection_runs_v2(run_id),
    as_of_date DATE NOT NULL,
    horizon_games SMALLINT NOT NULL,

    game_id BIGINT NOT NULL REFERENCES games(id),
    player_id BIGINT NOT NULL REFERENCES players(id),
    team_id SMALLINT NOT NULL REFERENCES teams(id),
    opponent_team_id SMALLINT NOT NULL REFERENCES teams(id),

    proj_toi_es_seconds INTEGER NULL,
    proj_toi_pp_seconds INTEGER NULL,
    proj_toi_pk_seconds INTEGER NULL,

    proj_shots_es NUMERIC NULL,
    proj_shots_pp NUMERIC NULL,
    proj_shots_pk NUMERIC NULL,

    proj_goals_es NUMERIC NULL,
    proj_goals_pp NUMERIC NULL,
    proj_goals_pk NUMERIC NULL,

    proj_assists_es NUMERIC NULL,
    proj_assists_pp NUMERIC NULL,
    proj_assists_pk NUMERIC NULL,

    proj_hits NUMERIC NULL,
    proj_blocks NUMERIC NULL,
    proj_pim NUMERIC NULL,
    proj_plus_minus NUMERIC NULL,

    uncertainty JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT player_projections_v2_horizon_check CHECK (horizon_games >= 1 AND horizon_games <= 10),
    PRIMARY KEY (run_id, game_id, player_id, horizon_games)
);

CREATE INDEX IF NOT EXISTS idx_player_projections_v2_as_of_date
ON player_projections_v2 (as_of_date);

CREATE INDEX IF NOT EXISTS idx_player_projections_v2_game
ON player_projections_v2 (game_id);

CREATE INDEX IF NOT EXISTS idx_player_projections_v2_player
ON player_projections_v2 (player_id);

CREATE INDEX IF NOT EXISTS idx_player_projections_v2_team
ON player_projections_v2 (team_id);

CREATE TABLE IF NOT EXISTS team_projections_v2 (
    run_id UUID NOT NULL REFERENCES projection_runs_v2(run_id),
    as_of_date DATE NOT NULL,
    horizon_games SMALLINT NOT NULL,

    game_id BIGINT NOT NULL REFERENCES games(id),
    team_id SMALLINT NOT NULL REFERENCES teams(id),
    opponent_team_id SMALLINT NOT NULL REFERENCES teams(id),

    proj_toi_es_seconds INTEGER NULL,
    proj_toi_pp_seconds INTEGER NULL,
    proj_toi_pk_seconds INTEGER NULL,

    proj_shots_es NUMERIC NULL,
    proj_shots_pp NUMERIC NULL,
    proj_shots_pk NUMERIC NULL,

    proj_goals_es NUMERIC NULL,
    proj_goals_pp NUMERIC NULL,
    proj_goals_pk NUMERIC NULL,

    uncertainty JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT team_projections_v2_horizon_check CHECK (horizon_games >= 1 AND horizon_games <= 10),
    PRIMARY KEY (run_id, game_id, team_id, horizon_games)
);

CREATE INDEX IF NOT EXISTS idx_team_projections_v2_as_of_date
ON team_projections_v2 (as_of_date);

CREATE INDEX IF NOT EXISTS idx_team_projections_v2_game
ON team_projections_v2 (game_id);

CREATE INDEX IF NOT EXISTS idx_team_projections_v2_team
ON team_projections_v2 (team_id);

CREATE TABLE IF NOT EXISTS goalie_projections_v2 (
    run_id UUID NOT NULL REFERENCES projection_runs_v2(run_id),
    as_of_date DATE NOT NULL,
    horizon_games SMALLINT NOT NULL,

    game_id BIGINT NOT NULL REFERENCES games(id),
    goalie_id BIGINT NOT NULL REFERENCES players(id),
    team_id SMALLINT NOT NULL REFERENCES teams(id),
    opponent_team_id SMALLINT NOT NULL REFERENCES teams(id),

    starter_probability NUMERIC NULL,
    proj_shots_against NUMERIC NULL,
    proj_saves NUMERIC NULL,
    proj_goals_allowed NUMERIC NULL,

    uncertainty JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT goalie_projections_v2_horizon_check CHECK (horizon_games >= 1 AND horizon_games <= 10),
    CONSTRAINT goalie_projections_v2_starter_prob_check CHECK (
        starter_probability IS NULL OR (starter_probability >= 0 AND starter_probability <= 1)
    ),
    PRIMARY KEY (run_id, game_id, goalie_id, horizon_games)
);

CREATE INDEX IF NOT EXISTS idx_goalie_projections_v2_as_of_date
ON goalie_projections_v2 (as_of_date);

CREATE INDEX IF NOT EXISTS idx_goalie_projections_v2_game
ON goalie_projections_v2 (game_id);

CREATE INDEX IF NOT EXISTS idx_goalie_projections_v2_goalie
ON goalie_projections_v2 (goalie_id);

