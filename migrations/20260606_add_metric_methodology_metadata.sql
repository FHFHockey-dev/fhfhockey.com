-- Add explicit methodology and denominator metadata for contextual ranking metrics.
-- Existing generic metadata JSONB remains for metric-specific details.

ALTER TABLE public.metric_definitions
  ADD COLUMN IF NOT EXISTS applicable_strength_states JSONB NOT NULL DEFAULT '["all","ev","pp","pk"]'::jsonb,
  ADD COLUMN IF NOT EXISTS denominator_key TEXT NOT NULL DEFAULT 'toi_seconds',
  ADD COLUMN IF NOT EXISTS denominator_description TEXT NOT NULL DEFAULT 'Total TOI seconds in the selected player-production window.',
  ADD COLUMN IF NOT EXISTS sample_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS methodology_version TEXT NOT NULL DEFAULT 'contextual_rankings_v1',
  ADD COLUMN IF NOT EXISTS source_quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.metric_definitions.applicable_strength_states IS
  'JSON array of strength states where the metric methodology is valid.';

COMMENT ON COLUMN public.metric_definitions.denominator_key IS
  'Stable key for the denominator used by this metric, such as toi_seconds or event_share.';

COMMENT ON COLUMN public.metric_definitions.denominator_description IS
  'Human-readable denominator methodology for API and UI display.';

COMMENT ON COLUMN public.metric_definitions.sample_requirements IS
  'JSON object describing minimum sample gates and window source semantics.';

COMMENT ON COLUMN public.metric_definitions.methodology_version IS
  'Published methodology version for interpreting this metric.';

COMMENT ON COLUMN public.metric_definitions.source_quality_flags IS
  'JSON array of source caveat flags, such as rink_scorekeeper_sensitive_unadjusted.';

UPDATE public.metric_definitions
SET
  applicable_strength_states = CASE
    WHEN default_strength_state = '5v5' THEN '["5v5"]'::jsonb
    WHEN entity_type = 'skater' THEN '["all","ev","pp","pk"]'::jsonb
    ELSE jsonb_build_array(default_strength_state)
  END,
  denominator_key = CASE
    WHEN metric_key IN ('expected_shooting_percentage', 'sax_percentage') THEN 'individual_unblocked_attempts'
    WHEN metric_key IN ('goals_above_expected', 'unrealized_xg') THEN 'none_count_difference'
    WHEN metric_key LIKE '%\_percentage' ESCAPE '\' THEN 'event_share'
    WHEN metric_key = 'results_luck_index' THEN 'historical_baseline'
    WHEN metric_key = 'mcm_score' THEN 'component_percentiles'
    WHEN metric_key = 'beast_tier' THEN 'eligibility_thresholds'
    WHEN is_rate_stat THEN 'toi_seconds'
    ELSE 'metric_specific'
  END,
  denominator_description = CASE
    WHEN is_rate_stat THEN 'Total TOI seconds in the selected player-production window.'
    WHEN metric_key IN ('expected_shooting_percentage', 'sax_percentage')
      THEN 'Individual unblocked shot attempts from approved shot-goal xG feature rows.'
    WHEN metric_key = 'mcm_score'
      THEN 'Weighted component percentiles from published contextual metric components.'
    WHEN metric_key = 'beast_tier'
      THEN 'Eligibility thresholds applied to contextual percentile components.'
    ELSE 'Metric-specific denominator described by the formula and methodology metadata.'
  END,
  sample_requirements = jsonb_build_object(
    'minimumGp', COALESCE(minimum_gp, 0),
    'minimumToiSeconds', COALESCE(minimum_toi_seconds, 0),
    'windowSource', CASE
      WHEN default_peer_group = 'deployment' THEN 'team_last_n_games'
      ELSE 'player_last_n_games_played'
    END
  ),
  methodology_version = 'contextual_rankings_v1',
  source_quality_flags = CASE
    WHEN metric_key IN ('hits_per_60', 'blocks_per_60', 'mcm_score', 'beast_tier')
      THEN '["rink_scorekeeper_sensitive_unadjusted"]'::jsonb
    WHEN metric_key IN ('expected_shooting_percentage', 'sax_percentage')
      THEN '["fenwick_xg_denominator_matched"]'::jsonb
    WHEN metric_key IN ('xga_per_60', 'on_ice_gf_percentage', 'on_ice_xgf_percentage')
      THEN '["context_influenced_unadjusted_on_ice"]'::jsonb
    ELSE '[]'::jsonb
  END;

UPDATE public.metric_definitions
SET
  metadata = jsonb_strip_nulls(
    metadata ||
    '{"label_scope":"Defensive Impact in Context","caveat":"Raw on-ice defensive rates are influenced by teammates, opponents, usage, zone starts, and score state until an adjusted RAPM/GAR-like model is available."}'::jsonb
  ),
  updated_at = NOW()
WHERE metric_key = 'xga_per_60';

UPDATE public.metric_definitions
SET
  metadata = jsonb_strip_nulls(
    metadata ||
    '{"caveat":"Raw on-ice result shares are teammate, opponent, usage, and score-state influenced."}'::jsonb
  ),
  updated_at = NOW()
WHERE metric_key = 'on_ice_gf_percentage';

UPDATE public.metric_definitions
SET
  metadata = jsonb_strip_nulls(
    metadata ||
    '{"caveat":"Raw on-ice process shares are teammate, opponent, usage, and score-state influenced."}'::jsonb
  ),
  updated_at = NOW()
WHERE metric_key = 'on_ice_xgf_percentage';

UPDATE public.metric_definitions
SET
  description = 'Expected shooting percentage based on individual xG and unblocked shot attempts.',
  formula_description = 'individual xG / individual unblocked attempts * 100.',
  source_table = 'nhl_xg_player_rolling_aggregates',
  source_fields = '[{"table":"nhl_xg_player_rolling_aggregates","field":"ixg"},{"table":"nhl_xg_player_rolling_aggregates","field":"shot_attempts","semantics":"individual_unblocked_attempts"}]'::jsonb,
  metadata = jsonb_strip_nulls(metadata || '{"xg_shot_universe":"fenwick_unblocked","shot_attempts_field_semantics":"nhl_xg_player_rolling_aggregates.shot_attempts is populated from is_unblocked_shot_attempt=true features."}'::jsonb),
  updated_at = NOW()
WHERE metric_key = 'expected_shooting_percentage';

UPDATE public.metric_definitions
SET
  source_table = 'nhl_xg_player_rolling_aggregates',
  source_fields = '[{"table":"nhl_xg_player_rolling_aggregates","field":"goals"},{"table":"nhl_xg_player_rolling_aggregates","field":"ixg"},{"table":"nhl_xg_player_rolling_aggregates","field":"shot_attempts","semantics":"individual_unblocked_attempts"}]'::jsonb,
  metadata = jsonb_strip_nulls(metadata || '{"depends_on":["goals","ixg","individual_unblocked_attempts"],"xg_shot_universe":"fenwick_unblocked"}'::jsonb),
  updated_at = NOW()
WHERE metric_key = 'sax_percentage';

UPDATE public.metric_definitions
SET
  metadata = jsonb_strip_nulls(
    metadata ||
    '{"component_caveats":{"hits_per_60":"RTSS event; not rink-adjusted in current sources.","blocks_per_60":"RTSS event; not rink-adjusted in current sources."},"signal_type":"fantasy_peripheral_composite"}'::jsonb
  ),
  updated_at = NOW()
WHERE metric_key = 'mcm_score';

UPDATE public.metric_definitions
SET
  metadata = jsonb_strip_nulls(
    metadata ||
    '{"component_caveats":{"hits_per_60":"RTSS event; not rink-adjusted in current sources.","blocks_per_60":"RTSS event; not rink-adjusted in current sources."},"signal_type":"fantasy_peripheral_tier"}'::jsonb
  ),
  updated_at = NOW()
WHERE metric_key = 'beast_tier';

UPDATE public.metric_definitions
SET
  metadata = jsonb_strip_nulls(
    metadata ||
    '{"baseline_window":"non_overlapping_prior_season_to_date","fallback":"peer_average_blend_for_thin_prior_samples","baseline_excludes_selected_window":true}'::jsonb
  ),
  updated_at = NOW()
WHERE metric_key = 'results_luck_index';
