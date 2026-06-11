-- Enable EV-backed on-ice GF% using existing rolling on-ice goal fields.

UPDATE public.metric_definitions
SET
  default_strength_state = 'ev',
  applicable_strength_states = '["ev"]'::jsonb,
  availability_status = 'available',
  source_table = 'rolling_player_game_metrics',
  source_fields = '[
    {"last_n_gf_field_pattern":"oi_gf_total_last{n}"},
    {"last_n_ga_field_pattern":"oi_ga_total_last{n}"},
    {"baseline_gf_field_pattern":"oi_gf_avg_{baseline_window}"},
    {"baseline_ga_field_pattern":"oi_ga_avg_{baseline_window}"}
  ]'::jsonb,
  metadata = jsonb_strip_nulls(metadata || '{
    "source_strength_semantics":"ev",
    "caveat":"EV-backed raw on-ice result shares are teammate, opponent, usage, and score-state influenced. Do not label as true 5v5 until true 5v5 rows are available."
  }'::jsonb),
  updated_at = NOW()
WHERE metric_key = 'on_ice_gf_percentage';
