-- Projection engine derived per-game aggregates (v2)
-- These tables are populated by the compute layer and are used as inputs to the projection engine.

CREATE TABLE IF NOT EXISTS player_game_strength_v2 (
    game_id BIGINT NOT NULL REFERENCES games(id),
    player_id BIGINT NOT NULL REFERENCES players(id),
    team_id SMALLINT NOT NULL REFERENCES teams(id),
    opponent_team_id SMALLINT NULL REFERENCES teams(id),
    game_date DATE NOT NULL,

    toi_es_seconds INTEGER NULL,
    toi_pp_seconds INTEGER NULL,
    toi_pk_seconds INTEGER NULL,

    shots_es INTEGER NULL,
    shots_pp INTEGER NULL,
    shots_pk INTEGER NULL,

    goals_es INTEGER NULL,
    goals_pp INTEGER NULL,
    goals_pk INTEGER NULL,

    assists_es INTEGER NULL,
    assists_pp INTEGER NULL,
    assists_pk INTEGER NULL,

    hits INTEGER NULL,
    blocks INTEGER NULL,
    pim INTEGER NULL,
    plus_minus INTEGER NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_game_strength_v2_game_date
ON player_game_strength_v2 (game_date);

CREATE INDEX IF NOT EXISTS idx_player_game_strength_v2_team_game
ON player_game_strength_v2 (team_id, game_id);

CREATE TABLE IF NOT EXISTS team_game_strength_v2 (
    game_id BIGINT NOT NULL REFERENCES games(id),
    team_id SMALLINT NOT NULL REFERENCES teams(id),
    opponent_team_id SMALLINT NULL REFERENCES teams(id),
    game_date DATE NOT NULL,

    toi_es_seconds INTEGER NULL,
    toi_pp_seconds INTEGER NULL,
    toi_pk_seconds INTEGER NULL,

    shots_es INTEGER NULL,
    shots_pp INTEGER NULL,
    shots_pk INTEGER NULL,

    goals_es INTEGER NULL,
    goals_pp INTEGER NULL,
    goals_pk INTEGER NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (game_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_game_strength_v2_game_date
ON team_game_strength_v2 (game_date);

CREATE INDEX IF NOT EXISTS idx_team_game_strength_v2_team_game
ON team_game_strength_v2 (team_id, game_id);

CREATE TABLE IF NOT EXISTS goalie_game_v2 (
    game_id BIGINT NOT NULL REFERENCES games(id),
    goalie_id BIGINT NOT NULL REFERENCES players(id),
    team_id SMALLINT NOT NULL REFERENCES teams(id),
    opponent_team_id SMALLINT NULL REFERENCES teams(id),
    game_date DATE NOT NULL,

    shots_against INTEGER NULL,
    goals_allowed INTEGER NULL,
    saves INTEGER NULL,
    toi_seconds INTEGER NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (game_id, goalie_id)
);

CREATE INDEX IF NOT EXISTS idx_goalie_game_v2_game_date
ON goalie_game_v2 (game_date);

CREATE INDEX IF NOT EXISTS idx_goalie_game_v2_team_game
ON goalie_game_v2 (team_id, game_id);

