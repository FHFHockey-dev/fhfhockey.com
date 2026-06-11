-- Enable contextual shot attempts/60 after the rolling ICF field family exists.

UPDATE public.metric_definitions
SET
  formula_description = 'NST individual Corsi For (ICF) / TOI seconds * 3600.',
  availability_status = 'available',
  source_table = 'rolling_player_game_metrics',
  source_fields = '[
    {"window_field_pattern":"shot_attempts_per_60_{window}"},
    {"last_n_total_field_pattern":"shot_attempts_per_60_total_last{n}"},
    {"last_n_toi_field_pattern":"toi_seconds_total_last{n}"},
    {"baseline_numerator_field_pattern":"shot_attempts_per_60_shot_attempts_{baseline_window}"},
    {"baseline_toi_field_pattern":"shot_attempts_per_60_toi_seconds_{baseline_window}"}
  ]'::jsonb,
  metadata = '{
    "semantic_source":"nst_icf",
    "window_source":"player_last_n_games_played",
    "rejected_sources":{
      "rolling_player_game_metrics.cf_*":"On-ice Corsi For, not individual shot attempts.",
      "wgo_skater_stats.sat_for":"Verified as an on-ice/team SAT field, not individual shot attempts.",
      "nst_gamelog_as_counts.iscfs":"Individual scoring chances, not all individual shot attempts."
    }
  }'::jsonb,
  updated_at = NOW()
WHERE metric_key = 'shot_attempts_per_60';
