-- Enable verified xG finishing metrics backed by rolling player windows.

UPDATE public.metric_definitions
SET
  availability_status = 'available',
  source_table = 'rolling_player_game_metrics',
  source_fields = '[
    {"last_n_numerator_field_pattern":"ixg_per_60_total_last{n}"},
    {"last_n_denominator_field_pattern":"shot_attempts_per_60_total_last{n}"},
    {"baseline_numerator_field_pattern":"ixg_per_60_ixg_{baseline_window}"},
    {"baseline_denominator_field_pattern":"shot_attempts_per_60_shot_attempts_{baseline_window}"}
  ]'::jsonb,
  metadata = jsonb_strip_nulls(metadata || '{
    "xg_shot_universe":"fenwick_unblocked",
    "shot_attempts_field_semantics":"rolling_player_game_metrics.shot_attempts_per_60_total_lastN and shot_attempts_per_60_shot_attempts_season are populated from verified individual unblocked-attempt sources."
  }'::jsonb),
  updated_at = NOW()
WHERE metric_key = 'expected_shooting_percentage';

UPDATE public.metric_definitions
SET
  availability_status = 'available',
  source_table = 'rolling_player_game_metrics',
  source_fields = '[
    {"last_n_goals_field_pattern":"goals_per_60_total_last{n}"},
    {"last_n_ixg_field_pattern":"ixg_per_60_total_last{n}"},
    {"last_n_attempts_field_pattern":"shot_attempts_per_60_total_last{n}"},
    {"baseline_goals_field_pattern":"goals_per_60_goals_{baseline_window}"},
    {"baseline_ixg_field_pattern":"ixg_per_60_ixg_{baseline_window}"},
    {"baseline_attempts_field_pattern":"shot_attempts_per_60_shot_attempts_{baseline_window}"}
  ]'::jsonb,
  metadata = jsonb_strip_nulls(metadata || '{
    "depends_on":["goals","ixg","individual_unblocked_attempts"],
    "xg_shot_universe":"fenwick_unblocked"
  }'::jsonb),
  updated_at = NOW()
WHERE metric_key = 'sax_percentage';

UPDATE public.metric_definitions
SET
  availability_status = 'available',
  source_table = 'rolling_player_game_metrics',
  source_fields = '[
    {"last_n_goals_field_pattern":"goals_per_60_total_last{n}"},
    {"last_n_ixg_field_pattern":"ixg_per_60_total_last{n}"},
    {"baseline_goals_field_pattern":"goals_per_60_goals_{baseline_window}"},
    {"baseline_ixg_field_pattern":"ixg_per_60_ixg_{baseline_window}"}
  ]'::jsonb,
  updated_at = NOW()
WHERE metric_key = 'goals_above_expected';

UPDATE public.metric_definitions
SET
  availability_status = 'available',
  source_table = 'rolling_player_game_metrics',
  source_fields = '[
    {"last_n_ixg_field_pattern":"ixg_per_60_total_last{n}"},
    {"last_n_goals_field_pattern":"goals_per_60_total_last{n}"},
    {"baseline_ixg_field_pattern":"ixg_per_60_ixg_{baseline_window}"},
    {"baseline_goals_field_pattern":"goals_per_60_goals_{baseline_window}"}
  ]'::jsonb,
  updated_at = NOW()
WHERE metric_key = 'unrealized_xg';
