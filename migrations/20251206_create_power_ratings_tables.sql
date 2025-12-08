-- Drop existing materialized views if they exist (must be done before creating tables of same name)
DROP MATERIALIZED VIEW IF EXISTS team_power_ratings_daily;
DROP MATERIALIZED VIEW IF EXISTS team_power_ratings_daily__new;

-- Create team_power_ratings_daily table
CREATE TABLE IF NOT EXISTS team_power_ratings_daily (
    team_abbreviation text NOT NULL,
    date date NOT NULL,
    off_rating numeric,
    def_rating numeric,
    pace_rating numeric,
    xgf60 numeric,
    gf60 numeric,
    sf60 numeric,
    xga60 numeric,
    ga60 numeric,
    sa60 numeric,
    pace60 numeric,
    trend10 numeric,
    pp_tier integer,
    pk_tier integer,
    finishing_rating numeric,
    goalie_rating numeric,
    danger_rating numeric,
    special_rating numeric,
    discipline_rating numeric,
    variance_flag integer,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (team_abbreviation, date)
);

-- Create team_power_ratings_daily__new table
CREATE TABLE IF NOT EXISTS team_power_ratings_daily__new (
    team_abbreviation text NOT NULL,
    date date NOT NULL,
    off_rating numeric,
    def_rating numeric,
    pace_rating numeric,
    xgf60 numeric,
    gf60 numeric,
    sf60 numeric,
    xga60 numeric,
    ga60 numeric,
    sa60 numeric,
    pace60 numeric,
    trend10 numeric,
    pp_tier integer,
    pk_tier integer,
    finishing_rating numeric,
    goalie_rating numeric,
    danger_rating numeric,
    special_rating numeric,
    discipline_rating numeric,
    variance_flag integer,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (team_abbreviation, date)
);

-- Create indexes for performance if needed (though PK covers most lookups)
CREATE INDEX IF NOT EXISTS idx_team_power_ratings_daily_date ON team_power_ratings_daily (date);
CREATE INDEX IF NOT EXISTS idx_team_power_ratings_daily__new_date ON team_power_ratings_daily__new (date);
