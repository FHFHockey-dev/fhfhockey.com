-- Persist daily projection calibration snapshots for goalie diagnostics.

CREATE TABLE IF NOT EXISTS public.forge_projection_calibration_daily (
  date date NOT NULL,
  projection_date date NOT NULL,
  scope text NOT NULL,
  source_run_id uuid NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT forge_projection_calibration_daily_pkey PRIMARY KEY (date, scope)
);

CREATE INDEX IF NOT EXISTS idx_projection_calibration_daily_scope
  ON public.forge_projection_calibration_daily (scope);

CREATE INDEX IF NOT EXISTS idx_projection_calibration_daily_projection_date
  ON public.forge_projection_calibration_daily (projection_date);

CREATE INDEX IF NOT EXISTS idx_projection_calibration_daily_source_run
  ON public.forge_projection_calibration_daily (source_run_id);
