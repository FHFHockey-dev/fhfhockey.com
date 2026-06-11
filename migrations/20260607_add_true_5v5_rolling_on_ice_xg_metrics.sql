-- Add rolling on-ice xGF/xGA support for true skater 5v5 contextual rankings.

DO $$
DECLARE
  column_name TEXT;
BEGIN
  FOREACH column_name IN ARRAY ARRAY[
    'oi_xgf_total_all',
    'oi_xgf_avg_all',
    'oi_xgf_total_last3',
    'oi_xgf_avg_last3',
    'oi_xgf_total_last5',
    'oi_xgf_avg_last5',
    'oi_xgf_total_last10',
    'oi_xgf_avg_last10',
    'oi_xgf_total_last20',
    'oi_xgf_avg_last20',
    'oi_xgf_avg_season',
    'oi_xgf_avg_3ya',
    'oi_xgf_avg_career',
    'oi_xga_total_all',
    'oi_xga_avg_all',
    'oi_xga_total_last3',
    'oi_xga_avg_last3',
    'oi_xga_total_last5',
    'oi_xga_avg_last5',
    'oi_xga_total_last10',
    'oi_xga_avg_last10',
    'oi_xga_total_last20',
    'oi_xga_avg_last20',
    'oi_xga_avg_season',
    'oi_xga_avg_3ya',
    'oi_xga_avg_career'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.rolling_player_game_metrics ADD COLUMN IF NOT EXISTS %I DOUBLE PRECISION NULL',
      column_name
    );
  END LOOP;
END $$;

ALTER TABLE public.rolling_player_game_metrics
DROP CONSTRAINT IF EXISTS rolling_player_game_metrics_strength_ck;

ALTER TABLE public.rolling_player_game_metrics
ADD CONSTRAINT rolling_player_game_metrics_strength_ck
CHECK (strength_state = ANY (ARRAY['all'::text, '5v5'::text, 'ev'::text, 'pp'::text, 'pk'::text]));

UPDATE public.metric_definitions
SET
  applicable_strength_states = '["all","5v5","ev","pp","pk"]'::jsonb,
  updated_at = now()
WHERE entity_type = 'skater'
  AND availability_status = 'available'
  AND source_table = 'rolling_player_game_metrics'
  AND metric_key NOT IN ('on_ice_gf_percentage');

UPDATE public.metric_definitions
SET
  applicable_strength_states = '["5v5","ev"]'::jsonb,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{caveat}',
    to_jsonb('Raw on-ice result shares are teammate, opponent, usage, and score-state influenced.'::text),
    true
  ),
  updated_at = now()
WHERE metric_key = 'on_ice_gf_percentage';

UPDATE public.metric_definitions
SET
  default_strength_state = '5v5',
  availability_status = 'available',
  source_table = 'rolling_player_game_metrics',
  source_fields = '[
    {"field":"rolling_player_game_metrics.oi_xga_total_{window}"},
    {"field":"rolling_player_game_metrics.toi_seconds_total_{window}"},
    {"field":"rolling_player_game_metrics.oi_xga_avg_{baseline_window}"},
    {"field":"rolling_player_game_metrics.toi_seconds_avg_{baseline_window}"}
  ]'::jsonb,
  applicable_strength_states = '["5v5"]'::jsonb,
  metadata = jsonb_build_object(
    'labelScope', 'Defensive Impact in Context',
    'caveat', 'Raw 5v5 on-ice defensive rates are influenced by teammates, opponents, usage, zone starts, and score state until an adjusted RAPM/GAR-like model is available.'
  ),
  source_quality_flags = '["context_influenced_unadjusted_on_ice"]'::jsonb,
  updated_at = now()
WHERE metric_key = 'xga_per_60';

UPDATE public.metric_definitions
SET
  availability_status = 'available',
  source_table = 'rolling_player_game_metrics',
  source_fields = '[
    {"field":"rolling_player_game_metrics.oi_xgf_total_{window}"},
    {"field":"rolling_player_game_metrics.oi_xga_total_{window}"},
    {"field":"rolling_player_game_metrics.oi_xgf_avg_{baseline_window}"},
    {"field":"rolling_player_game_metrics.oi_xga_avg_{baseline_window}"}
  ]'::jsonb,
  applicable_strength_states = '["5v5"]'::jsonb,
  metadata = jsonb_build_object(
    'caveat', 'Raw 5v5 on-ice process shares are teammate, opponent, usage, and score-state influenced.'
  ),
  source_quality_flags = '["context_influenced_unadjusted_on_ice"]'::jsonb,
  updated_at = now()
WHERE metric_key = 'on_ice_xgf_percentage';
