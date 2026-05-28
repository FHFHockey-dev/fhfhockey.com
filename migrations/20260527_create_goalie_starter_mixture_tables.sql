-- First-class goalie starter mixture distributions and branch projection outputs.

CREATE TABLE IF NOT EXISTS public.nhl_goalie_starter_mixture_distributions (
  mixture_version text NOT NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  team_id bigint NOT NULL,
  goalie_id bigint NOT NULL,
  as_of_timestamp timestamptz NOT NULL,
  source_name text NOT NULL,
  source_updated_at timestamptz NULL,
  source_confidence text NOT NULL,
  raw_start_probability double precision NOT NULL,
  adjusted_start_probability double precision NOT NULL,
  normalized_start_probability double precision NOT NULL,
  rank integer NOT NULL,
  confirmed_status boolean NOT NULL DEFAULT false,
  is_manual_override boolean NOT NULL DEFAULT false,
  is_stale boolean NOT NULL DEFAULT false,
  is_hard_stale boolean NOT NULL DEFAULT false,
  is_back_to_back boolean NOT NULL DEFAULT false,
  previous_game_starter_goalie_id bigint NULL,
  probability_mass double precision NOT NULL DEFAULT 1,
  residual_probability_mass double precision NOT NULL DEFAULT 0,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (mixture_version, game_id, team_id, goalie_id, as_of_timestamp),
  CONSTRAINT nhl_goalie_starter_mixture_confidence_check
    CHECK (source_confidence IN ('high', 'medium', 'low')),
  CONSTRAINT nhl_goalie_starter_mixture_probability_check
    CHECK (
      raw_start_probability BETWEEN 0 AND 1
      AND adjusted_start_probability BETWEEN 0 AND 1
      AND normalized_start_probability BETWEEN 0 AND 1
      AND probability_mass BETWEEN 0 AND 1
      AND residual_probability_mass BETWEEN 0 AND 1
    )
);

CREATE INDEX IF NOT EXISTS idx_nhl_goalie_starter_mixture_game_team_rank
  ON public.nhl_goalie_starter_mixture_distributions (
    game_id,
    team_id,
    rank,
    as_of_timestamp DESC
  );

CREATE INDEX IF NOT EXISTS idx_nhl_goalie_starter_mixture_goalie_date
  ON public.nhl_goalie_starter_mixture_distributions (
    goalie_id,
    game_date DESC,
    mixture_version
  );

CREATE TABLE IF NOT EXISTS public.nhl_goalie_starter_mixture_projection_branches (
  branch_key text NOT NULL,
  mixture_version text NOT NULL,
  projection_version text NOT NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  team_id bigint NOT NULL,
  goalie_id bigint NOT NULL,
  as_of_timestamp timestamptz NOT NULL,
  branch_rank integer NOT NULL,
  branch_probability double precision NOT NULL,
  proj_shots_against double precision NULL,
  proj_saves double precision NULL,
  proj_goals_allowed double precision NULL,
  proj_win_prob double precision NULL,
  proj_shutout_prob double precision NULL,
  modeled_save_pct double precision NULL,
  weighted_proj_shots_against double precision NULL,
  weighted_proj_saves double precision NULL,
  weighted_proj_goals_allowed double precision NULL,
  weighted_proj_win_prob double precision NULL,
  weighted_proj_shutout_prob double precision NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (branch_key),
  CONSTRAINT nhl_goalie_starter_branch_probability_check
    CHECK (branch_probability BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS idx_nhl_goalie_starter_branch_game_team_rank
  ON public.nhl_goalie_starter_mixture_projection_branches (
    game_id,
    team_id,
    branch_rank,
    as_of_timestamp DESC
  );

COMMENT ON TABLE public.nhl_goalie_starter_mixture_distributions IS
  'First-class goalie starter probability distributions by game/team/goalie with source confidence and as-of timestamp.';

COMMENT ON TABLE public.nhl_goalie_starter_mixture_projection_branches IS
  'Scenario branch-level goalie projection outputs weighted by starter mixture probability.';
