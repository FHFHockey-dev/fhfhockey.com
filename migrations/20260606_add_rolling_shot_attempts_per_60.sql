-- Add selected-window individual shot attempts (NST ICF) support for contextual rankings.
-- Existing on-ice CF and WGO SAT fields are intentionally not used for this metric.

DO $$
DECLARE
  column_name TEXT;
BEGIN
  FOREACH column_name IN ARRAY ARRAY[
    'shot_attempts_per_60_3ya',
    'shot_attempts_per_60_all',
    'shot_attempts_per_60_avg_3ya',
    'shot_attempts_per_60_avg_all',
    'shot_attempts_per_60_avg_career',
    'shot_attempts_per_60_avg_last10',
    'shot_attempts_per_60_avg_last20',
    'shot_attempts_per_60_avg_last3',
    'shot_attempts_per_60_avg_last5',
    'shot_attempts_per_60_avg_season',
    'shot_attempts_per_60_career',
    'shot_attempts_per_60_last10',
    'shot_attempts_per_60_last20',
    'shot_attempts_per_60_last3',
    'shot_attempts_per_60_last5',
    'shot_attempts_per_60_season',
    'shot_attempts_per_60_shot_attempts_3ya',
    'shot_attempts_per_60_shot_attempts_career',
    'shot_attempts_per_60_shot_attempts_season',
    'shot_attempts_per_60_toi_seconds_3ya',
    'shot_attempts_per_60_toi_seconds_career',
    'shot_attempts_per_60_toi_seconds_season',
    'shot_attempts_per_60_total_all',
    'shot_attempts_per_60_total_last10',
    'shot_attempts_per_60_total_last20',
    'shot_attempts_per_60_total_last3',
    'shot_attempts_per_60_total_last5'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.rolling_player_game_metrics ADD COLUMN IF NOT EXISTS %I DOUBLE PRECISION NULL',
      column_name
    );
  END LOOP;
END $$;
