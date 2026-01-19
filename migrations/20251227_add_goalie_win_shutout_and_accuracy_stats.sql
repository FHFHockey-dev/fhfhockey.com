-- Add goalie win/shutout projection fields and per-stat accuracy diagnostics.

ALTER TABLE public.forge_goalie_projections
  ADD COLUMN IF NOT EXISTS proj_win_prob numeric NULL,
  ADD COLUMN IF NOT EXISTS proj_shutout_prob numeric NULL;

CREATE TABLE IF NOT EXISTS public.forge_projection_accuracy_stat_daily (
  date date NOT NULL,
  scope text NOT NULL,
  stat_key text NOT NULL,
  mae numeric NOT NULL,
  rmse numeric NOT NULL,
  player_count integer NOT NULL,
  error_abs_sum numeric NOT NULL,
  error_sq_sum numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT forge_projection_accuracy_stat_daily_pkey
    PRIMARY KEY (date, scope, stat_key)
);

CREATE INDEX IF NOT EXISTS idx_projection_accuracy_stat_daily_date
  ON public.forge_projection_accuracy_stat_daily (date);

CREATE INDEX IF NOT EXISTS idx_projection_accuracy_stat_daily_scope
  ON public.forge_projection_accuracy_stat_daily (scope);
