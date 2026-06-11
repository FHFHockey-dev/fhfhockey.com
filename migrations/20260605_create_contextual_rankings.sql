-- Contextual rankings schema contract.
--
-- This migration intentionally reuses existing source tables for Phase 1:
-- - public.rolling_player_game_metrics for skater player-window metric values
-- - public.lineCombinations / public.powerPlayCombinations for deployment context
-- - existing WGO, NST, and NHL xG aggregate tables as fallback/enrichment sources
--
-- It creates only the durable schema gaps needed by the contextual rankings PRD:
-- a central metric registry, an optional precomputed ranking result table, and
-- a composite skater scaffold for later MCM / BEAST / archetype phases.

CREATE TABLE IF NOT EXISTS public.metric_definitions (
  metric_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  formula_description TEXT NOT NULL,
  higher_is_better BOOLEAN NOT NULL DEFAULT TRUE,
  default_strength_state TEXT NOT NULL DEFAULT 'all',
  default_peer_group TEXT NULL,
  minimum_gp INTEGER NULL,
  minimum_toi_seconds DOUBLE PRECISION NULL,
  minimum_starts INTEGER NULL,
  minimum_shots_against INTEGER NULL,
  is_rate_stat BOOLEAN NOT NULL DEFAULT FALSE,
  is_percentile_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  phase TEXT NOT NULL DEFAULT 'phase_1',
  availability_status TEXT NOT NULL DEFAULT 'available',
  source_table TEXT NULL,
  source_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  applicable_strength_states JSONB NOT NULL DEFAULT '["all","ev","pp","pk"]'::jsonb,
  denominator_key TEXT NOT NULL DEFAULT 'toi_seconds',
  denominator_description TEXT NOT NULL DEFAULT 'Total TOI seconds in the selected player-production window.',
  sample_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  methodology_version TEXT NOT NULL DEFAULT 'contextual_rankings_v1',
  source_quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT metric_definitions_entity_type_check
    CHECK (entity_type IN ('skater', 'goalie', 'team')),
  CONSTRAINT metric_definitions_strength_state_check
    CHECK (default_strength_state IN ('all', '5v5', 'ev', 'pp', 'pk')),
  CONSTRAINT metric_definitions_phase_check
    CHECK (phase IN ('phase_1', 'phase_2', 'phase_3', 'phase_4', 'phase_5', 'phase_6')),
  CONSTRAINT metric_definitions_availability_status_check
    CHECK (availability_status IN ('available', 'unavailable', 'planned')),
  CONSTRAINT metric_definitions_minimums_check
    CHECK (
      (minimum_gp IS NULL OR minimum_gp >= 0)
      AND (minimum_toi_seconds IS NULL OR minimum_toi_seconds >= 0)
      AND (minimum_starts IS NULL OR minimum_starts >= 0)
      AND (minimum_shots_against IS NULL OR minimum_shots_against >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_metric_definitions_entity_phase
  ON public.metric_definitions (entity_type, phase, availability_status);

CREATE INDEX IF NOT EXISTS idx_metric_definitions_category
  ON public.metric_definitions (entity_type, category, display_name);

COMMENT ON TABLE public.metric_definitions IS
  'Central metric registry for contextual rankings. Formulas and display metadata live here instead of React table components.';

COMMENT ON COLUMN public.metric_definitions.source_fields IS
  'JSON array of source field descriptors verified against the actual Supabase schema.';

COMMENT ON COLUMN public.metric_definitions.denominator_key IS
  'Stable key for the denominator used by this metric, such as toi_seconds or event_share.';

COMMENT ON COLUMN public.metric_definitions.sample_requirements IS
  'JSON object describing minimum sample gates and window source semantics.';

INSERT INTO public.metric_definitions (
  metric_key,
  display_name,
  entity_type,
  category,
  description,
  formula_description,
  higher_is_better,
  default_strength_state,
  default_peer_group,
  minimum_gp,
  minimum_toi_seconds,
  minimum_starts,
  minimum_shots_against,
  is_rate_stat,
  is_percentile_eligible,
  phase,
  availability_status,
  source_table,
  source_fields,
  metadata
)
VALUES
  (
    'goals_per_60',
    'Goals/60',
    'skater',
    'Results',
    'Goals scored per 60 minutes in the selected window.',
    'goals / TOI seconds * 3600, sourced from verified rolling player metric components.',
    TRUE,
    'all',
    'position',
    1,
    300,
    NULL,
    NULL,
    TRUE,
    TRUE,
    'phase_1',
    'available',
    'rolling_player_game_metrics',
    '[{"window_field_pattern":"goals_per_60_{window}"},{"last_n_total_field_pattern":"goals_per_60_total_last{n}"},{"last_n_toi_field_pattern":"toi_seconds_total_last{n}"},{"baseline_numerator_field_pattern":"goals_per_60_goals_{baseline_window}"},{"baseline_toi_field_pattern":"goals_per_60_toi_seconds_{baseline_window}"}]'::jsonb,
    '{"window_source":"player_last_n_games_played"}'::jsonb
  ),
  (
    'assists_per_60',
    'Assists/60',
    'skater',
    'Results',
    'Total assists per 60 minutes in the selected window.',
    'assists / TOI seconds * 3600, sourced from verified rolling player metric components.',
    TRUE,
    'all',
    'position',
    1,
    300,
    NULL,
    NULL,
    TRUE,
    TRUE,
    'phase_1',
    'available',
    'rolling_player_game_metrics',
    '[{"window_field_pattern":"assists_per_60_{window}"},{"last_n_total_field_pattern":"assists_per_60_total_last{n}"},{"last_n_toi_field_pattern":"toi_seconds_total_last{n}"},{"baseline_numerator_field_pattern":"assists_per_60_assists_{baseline_window}"},{"baseline_toi_field_pattern":"assists_per_60_toi_seconds_{baseline_window}"}]'::jsonb,
    '{"window_source":"player_last_n_games_played"}'::jsonb
  ),
  (
    'primary_assists_per_60',
    'Primary Assists/60',
    'skater',
    'Process',
    'Primary assists per 60 minutes in the selected window.',
    'primary assists / TOI seconds * 3600, sourced from verified rolling player metric components.',
    TRUE,
    'all',
    'position',
    1,
    300,
    NULL,
    NULL,
    TRUE,
    TRUE,
    'phase_1',
    'available',
    'rolling_player_game_metrics',
    '[{"window_field_pattern":"primary_assists_per_60_{window}"},{"last_n_total_field_pattern":"primary_assists_per_60_total_last{n}"},{"last_n_toi_field_pattern":"toi_seconds_total_last{n}"},{"baseline_numerator_field_pattern":"primary_assists_per_60_primary_assists_{baseline_window}"},{"baseline_toi_field_pattern":"primary_assists_per_60_toi_seconds_{baseline_window}"}]'::jsonb,
    '{"window_source":"player_last_n_games_played"}'::jsonb
  ),
  (
    'points_per_60',
    'Points/60',
    'skater',
    'Results',
    'Total points per 60 minutes in the selected window.',
    'points / TOI seconds * 3600, derived from verified rolling player points and TOI fields.',
    TRUE,
    'all',
    'position',
    1,
    300,
    NULL,
    NULL,
    TRUE,
    TRUE,
    'phase_1',
    'available',
    'rolling_player_game_metrics',
    '[{"derived_metric":true},{"last_n_total_field_pattern":"points_total_last{n}"},{"last_n_toi_field_pattern":"toi_seconds_total_last{n}"},{"baseline_avg_field_pattern":"points_avg_{baseline_window}"},{"baseline_toi_avg_field_pattern":"toi_seconds_avg_{baseline_window}"}]'::jsonb,
    '{"window_source":"player_last_n_games_played"}'::jsonb
  ),
  (
    'sog_per_60',
    'SOG/60',
    'skater',
    'Process',
    'Shots on goal per 60 minutes in the selected window.',
    'shots on goal / TOI seconds * 3600, sourced from verified rolling player metric components.',
    TRUE,
    'all',
    'position',
    1,
    300,
    NULL,
    NULL,
    TRUE,
    TRUE,
    'phase_1',
    'available',
    'rolling_player_game_metrics',
    '[{"window_field_pattern":"sog_per_60_{window}"},{"last_n_total_field_pattern":"sog_per_60_total_last{n}"},{"last_n_toi_field_pattern":"toi_seconds_total_last{n}"},{"baseline_numerator_field_pattern":"sog_per_60_shots_{baseline_window}"},{"baseline_toi_field_pattern":"sog_per_60_toi_seconds_{baseline_window}"}]'::jsonb,
    '{"window_source":"player_last_n_games_played"}'::jsonb
  ),
  (
    'shot_attempts_per_60',
    'Shot Attempts/60',
    'skater',
    'Process',
    'Individual shot attempts per 60 minutes in the selected window.',
    'NST individual Corsi For (ICF) / TOI seconds * 3600.',
    TRUE,
    'all',
    'position',
    1,
    300,
    NULL,
    NULL,
    TRUE,
    TRUE,
    'phase_1',
    'available',
    'rolling_player_game_metrics',
    '[{"window_field_pattern":"shot_attempts_per_60_{window}"},{"last_n_total_field_pattern":"shot_attempts_per_60_total_last{n}"},{"last_n_toi_field_pattern":"toi_seconds_total_last{n}"},{"baseline_numerator_field_pattern":"shot_attempts_per_60_shot_attempts_{baseline_window}"},{"baseline_toi_field_pattern":"shot_attempts_per_60_toi_seconds_{baseline_window}"}]'::jsonb,
    '{"semantic_source":"nst_icf","window_source":"player_last_n_games_played","rejected_sources":{"rolling_player_game_metrics.cf_*":"On-ice Corsi For, not individual shot attempts.","wgo_skater_stats.sat_for":"Verified as an on-ice/team SAT field, not individual shot attempts.","nst_gamelog_as_counts.iscfs":"Individual scoring chances, not all individual shot attempts."}}'::jsonb
  ),
  (
    'hits_per_60',
    'Hits/60',
    'skater',
    'Fantasy composite',
    'Hits per 60 minutes in the selected window.',
    'hits / TOI seconds * 3600, sourced from verified rolling player metric components.',
    TRUE,
    'all',
    'position',
    1,
    300,
    NULL,
    NULL,
    TRUE,
    TRUE,
    'phase_1',
    'available',
    'rolling_player_game_metrics',
    '[{"window_field_pattern":"hits_per_60_{window}"},{"last_n_total_field_pattern":"hits_per_60_total_last{n}"},{"last_n_toi_field_pattern":"toi_seconds_total_last{n}"},{"baseline_numerator_field_pattern":"hits_per_60_hits_{baseline_window}"},{"baseline_toi_field_pattern":"hits_per_60_toi_seconds_{baseline_window}"}]'::jsonb,
    '{"window_source":"player_last_n_games_played"}'::jsonb
  ),
  (
    'blocks_per_60',
    'Blocks/60',
    'skater',
    'Fantasy composite',
    'Blocked shots per 60 minutes in the selected window.',
    'blocks / TOI seconds * 3600, sourced from verified rolling player metric components.',
    TRUE,
    'all',
    'position',
    1,
    300,
    NULL,
    NULL,
    TRUE,
    TRUE,
    'phase_1',
    'available',
    'rolling_player_game_metrics',
    '[{"window_field_pattern":"blocks_per_60_{window}"},{"last_n_total_field_pattern":"blocks_per_60_total_last{n}"},{"last_n_toi_field_pattern":"toi_seconds_total_last{n}"},{"baseline_numerator_field_pattern":"blocks_per_60_blocks_{baseline_window}"},{"baseline_toi_field_pattern":"blocks_per_60_toi_seconds_{baseline_window}"}]'::jsonb,
    '{"window_source":"player_last_n_games_played"}'::jsonb
  ),
  (
    'ixg_per_60',
    'Individual xG/60',
    'skater',
    'Process',
    'Individual expected goals per 60 minutes in the selected window.',
    'individual xG / TOI seconds * 3600, sourced from verified rolling player metric components.',
    TRUE,
    'all',
    'position',
    1,
    300,
    NULL,
    NULL,
    TRUE,
    TRUE,
    'phase_1',
    'available',
    'rolling_player_game_metrics',
    '[{"window_field_pattern":"ixg_per_60_{window}"},{"last_n_total_field_pattern":"ixg_per_60_total_last{n}"},{"last_n_toi_field_pattern":"toi_seconds_total_last{n}"},{"baseline_numerator_field_pattern":"ixg_per_60_ixg_{baseline_window}"},{"baseline_toi_field_pattern":"ixg_per_60_toi_seconds_{baseline_window}"}]'::jsonb,
    '{"window_source":"player_last_n_games_played"}'::jsonb
  ),
  (
    'xga_per_60',
    'xGA/60',
    'skater',
    'Defense',
    'On-ice expected goals against per 60 minutes.',
    'on-ice xGA / TOI seconds * 3600. Lower raw values are better and must be normalized before ranking.',
    FALSE,
    '5v5',
    'position',
    1,
    600,
    NULL,
    NULL,
    TRUE,
    TRUE,
    'phase_3',
    'planned',
    'player_stats_unified',
    '[{"table":"player_stats_unified","field":"nst_oi_xga_per_60"},{"table":"nst_gamelog_as_rates_oi","field":"xga_per_60"}]'::jsonb,
    '{"planned_use":"lower_is_better_directionality_regression_test","label_scope":"Defensive Impact in Context","caveat":"Raw on-ice defensive rates are influenced by teammates, opponents, usage, zone starts, and score state until an adjusted RAPM/GAR-like model is available."}'::jsonb
  ),
  (
    'penalties_taken_per_60',
    'Penalties Taken/60',
    'skater',
    'Discipline',
    'Penalties taken per 60 minutes.',
    'penalties taken / TOI seconds * 3600. Lower raw values are better and must be normalized before ranking.',
    FALSE,
    'all',
    'position',
    1,
    300,
    NULL,
    NULL,
    TRUE,
    TRUE,
    'phase_3',
    'planned',
    'wgo_skater_stats',
    '[{"table":"wgo_skater_stats","field":"penalties_taken_per_60"}]'::jsonb,
    '{"planned_use":"lower_is_better_directionality_regression_test"}'::jsonb
  ),
  (
    'expected_shooting_percentage',
    'xS%',
    'skater',
    'Regression',
    'Expected shooting percentage based on individual xG and unblocked shot attempts.',
    'individual xG / individual unblocked attempts * 100.',
    TRUE,
    'all',
    'position',
    1,
    600,
    NULL,
    NULL,
    FALSE,
    TRUE,
    'phase_3',
    'planned',
    'nhl_xg_player_rolling_aggregates',
    '[{"table":"nhl_xg_player_rolling_aggregates","field":"ixg"},{"table":"nhl_xg_player_rolling_aggregates","field":"shot_attempts","semantics":"individual_unblocked_attempts"}]'::jsonb,
    '{"xg_shot_universe":"fenwick_unblocked","shot_attempts_field_semantics":"nhl_xg_player_rolling_aggregates.shot_attempts is populated from is_unblocked_shot_attempt=true features."}'::jsonb
  ),
  (
    'sax_percentage',
    'SAX%',
    'skater',
    'Regression',
    'Shooting percentage above expected.',
    'actual shooting percentage - expected shooting percentage.',
    TRUE,
    'all',
    'position',
    1,
    600,
    NULL,
    NULL,
    FALSE,
    TRUE,
    'phase_3',
    'planned',
    'nhl_xg_player_rolling_aggregates',
    '[{"table":"nhl_xg_player_rolling_aggregates","field":"goals"},{"table":"nhl_xg_player_rolling_aggregates","field":"ixg"},{"table":"nhl_xg_player_rolling_aggregates","field":"shot_attempts","semantics":"individual_unblocked_attempts"}]'::jsonb,
    '{"depends_on":["goals","ixg","individual_unblocked_attempts"],"xg_shot_universe":"fenwick_unblocked"}'::jsonb
  ),
  (
    'goals_above_expected',
    'Goals Above Expected',
    'skater',
    'Regression',
    'Goals scored above individual expected goals.',
    'goals - individual xG.',
    TRUE,
    'all',
    'position',
    1,
    600,
    NULL,
    NULL,
    FALSE,
    TRUE,
    'phase_3',
    'planned',
    NULL,
    '[]'::jsonb,
    '{"depends_on":["goals","ixg"]}'::jsonb
  ),
  (
    'unrealized_xg',
    'Unrealized xG',
    'skater',
    'Regression',
    'Expected goals generated but not converted into goals.',
    'individual xG - goals.',
    TRUE,
    'all',
    'position',
    1,
    600,
    NULL,
    NULL,
    FALSE,
    TRUE,
    'phase_3',
    'planned',
    NULL,
    '[]'::jsonb,
    '{"depends_on":["ixg","goals"]}'::jsonb
  ),
  (
    'on_ice_gf_percentage',
    'On-ice GF%',
    'skater',
    'Results',
    'Share of on-ice goals that were goals for.',
    'on-ice GF / (on-ice GF + on-ice GA).',
    TRUE,
    '5v5',
    'position',
    1,
    600,
    NULL,
    NULL,
    FALSE,
    TRUE,
    'phase_3',
    'planned',
    'player_stats_unified',
    '[{"table":"player_stats_unified","field":"nst_oi_gf_pct"}]'::jsonb,
    '{"caveat":"Raw on-ice result shares are teammate, opponent, usage, and score-state influenced."}'::jsonb
  ),
  (
    'on_ice_xgf_percentage',
    'On-ice xGF%',
    'skater',
    'Process',
    'Share of on-ice expected goals that were expected goals for.',
    'on-ice xGF / (on-ice xGF + on-ice xGA).',
    TRUE,
    '5v5',
    'position',
    1,
    600,
    NULL,
    NULL,
    FALSE,
    TRUE,
    'phase_3',
    'planned',
    'player_stats_unified',
    '[{"table":"player_stats_unified","field":"nst_oi_xgf_pct"}]'::jsonb,
    '{"caveat":"Raw on-ice process shares are teammate, opponent, usage, and score-state influenced."}'::jsonb
  ),
  (
    'rel_5v5_gf_percentage',
    'Relative 5v5 GF%',
    'skater',
    'Results',
    'Player 5v5 GF% relative to team-without-player baseline.',
    'player 5v5 GF% - team 5v5 GF% without player.',
    TRUE,
    '5v5',
    'position',
    1,
    1200,
    NULL,
    NULL,
    FALSE,
    TRUE,
    'phase_3',
    'planned',
    NULL,
    '[]'::jsonb,
    '{"requires_team_without_player_baseline":true}'::jsonb
  ),
  (
    'rel_5v5_xgf_percentage',
    'Relative 5v5 xGF%',
    'skater',
    'Process',
    'Player 5v5 xGF% relative to team-without-player baseline.',
    'player 5v5 xGF% - team 5v5 xGF% without player.',
    TRUE,
    '5v5',
    'position',
    1,
    1200,
    NULL,
    NULL,
    FALSE,
    TRUE,
    'phase_3',
    'planned',
    NULL,
    '[]'::jsonb,
    '{"requires_team_without_player_baseline":true}'::jsonb
  ),
  (
    'results_luck_index',
    'Results Luck Index',
    'skater',
    'Regression',
    'Current results compared with historical or blended baseline results, centered around 100.',
    '100 * current results / baseline results, with PP samples gated or regressed.',
    FALSE,
    'all',
    'position',
    1,
    1200,
    NULL,
    NULL,
    FALSE,
    TRUE,
    'phase_3',
    'planned',
    NULL,
    '[]'::jsonb,
    '{"centered_at":100,"higher_means":"hotter_or_luckier","baseline_window":"non_overlapping_prior_season_to_date","fallback":"peer_average_blend_for_thin_prior_samples","baseline_excludes_selected_window":true}'::jsonb
  ),
  (
    'mcm_score',
    'MCM Score',
    'skater',
    'Fantasy composite',
    'Multi-category fantasy score based on percentile components.',
    'Weighted blend of riff score, scoring score, and category depth score.',
    TRUE,
    'all',
    'deployment',
    1,
    600,
    NULL,
    NULL,
    FALSE,
    TRUE,
    'phase_2',
    'planned',
    'skater_composite_ratings',
    '[{"table":"skater_composite_ratings","field":"mcm_score"}]'::jsonb,
    '{"component_metrics":["sog_per_60","hits_per_60","blocks_per_60","goals_per_60","primary_assists_per_60","points_per_60","pp_points_per_60"],"component_caveats":{"hits_per_60":"RTSS event; not rink-adjusted in current sources.","blocks_per_60":"RTSS event; not rink-adjusted in current sources."},"signal_type":"fantasy_peripheral_composite"}'::jsonb
  ),
  (
    'beast_tier',
    'BEAST Tier',
    'skater',
    'Fantasy composite',
    'Tier label for qualified multi-category players.',
    'Eligibility gates based on multiple riff and scoring percentile thresholds.',
    TRUE,
    'all',
    'deployment',
    1,
    600,
    NULL,
    NULL,
    FALSE,
    FALSE,
    'phase_2',
    'planned',
    'skater_composite_ratings',
    '[{"table":"skater_composite_ratings","field":"beast_tier"}]'::jsonb,
    '{"allowed_tiers":["MCM Watch","MCM","BEAST","BEAST+"],"component_caveats":{"hits_per_60":"RTSS event; not rink-adjusted in current sources.","blocks_per_60":"RTSS event; not rink-adjusted in current sources."},"signal_type":"fantasy_peripheral_tier"}'::jsonb
  )
ON CONFLICT (metric_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  entity_type = EXCLUDED.entity_type,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  formula_description = EXCLUDED.formula_description,
  higher_is_better = EXCLUDED.higher_is_better,
  default_strength_state = EXCLUDED.default_strength_state,
  default_peer_group = EXCLUDED.default_peer_group,
  minimum_gp = EXCLUDED.minimum_gp,
  minimum_toi_seconds = EXCLUDED.minimum_toi_seconds,
  minimum_starts = EXCLUDED.minimum_starts,
  minimum_shots_against = EXCLUDED.minimum_shots_against,
  is_rate_stat = EXCLUDED.is_rate_stat,
  is_percentile_eligible = EXCLUDED.is_percentile_eligible,
  phase = EXCLUDED.phase,
  availability_status = EXCLUDED.availability_status,
  source_table = EXCLUDED.source_table,
  source_fields = EXCLUDED.source_fields,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

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

CREATE TABLE IF NOT EXISTS public.entity_metric_rankings (
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  team_id SMALLINT NULL REFERENCES public.teams(id),
  season_id INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  window_type TEXT NOT NULL,
  window_size INTEGER NOT NULL DEFAULT 0,
  window_semantics TEXT NOT NULL,
  strength_state TEXT NOT NULL,
  metric_key TEXT NOT NULL REFERENCES public.metric_definitions(metric_key),
  peer_group_type TEXT NOT NULL,
  peer_group_key TEXT NOT NULL,
  position_group TEXT NULL,
  deployment_bucket TEXT NULL,
  raw_value DOUBLE PRECISION NULL,
  normalized_value DOUBLE PRECISION NULL,
  raw_rank INTEGER NULL,
  percentile DOUBLE PRECISION NULL,
  qualified_peer_count INTEGER NOT NULL DEFAULT 0,
  minimum_sample_met BOOLEAN NOT NULL DEFAULT FALSE,
  sample_confidence TEXT NOT NULL DEFAULT 'low',
  games_played INTEGER NULL,
  toi_seconds DOUBLE PRECISION NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  methodology_version TEXT NOT NULL DEFAULT 'contextual_rankings_v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entity_metric_rankings_pkey PRIMARY KEY (
    entity_type,
    entity_id,
    season_id,
    snapshot_date,
    window_type,
    window_size,
    strength_state,
    metric_key,
    peer_group_type,
    peer_group_key
  ),
  CONSTRAINT entity_metric_rankings_entity_type_check
    CHECK (entity_type IN ('skater', 'goalie', 'team')),
  CONSTRAINT entity_metric_rankings_window_type_check
    CHECK (window_type IN ('season', 'last_5', 'last_10', 'last_20', 'last_40', 'last_82', 'past_240_games', 'custom')),
  CONSTRAINT entity_metric_rankings_window_size_check
    CHECK (window_size >= 0),
  CONSTRAINT entity_metric_rankings_window_semantics_check
    CHECK (window_semantics IN ('player_last_n_games_played', 'team_last_n_games', 'season_to_date', 'custom')),
  CONSTRAINT entity_metric_rankings_strength_state_check
    CHECK (strength_state IN ('all', '5v5', 'ev', 'pp', 'pk')),
  CONSTRAINT entity_metric_rankings_sample_confidence_check
    CHECK (sample_confidence IN ('low', 'medium', 'high')),
  CONSTRAINT entity_metric_rankings_percentile_check
    CHECK (percentile IS NULL OR (percentile >= 0 AND percentile <= 100)),
  CONSTRAINT entity_metric_rankings_rank_check
    CHECK (raw_rank IS NULL OR raw_rank >= 1),
  CONSTRAINT entity_metric_rankings_peer_count_check
    CHECK (qualified_peer_count >= 0),
  CONSTRAINT entity_metric_rankings_sample_check
    CHECK (
      (games_played IS NULL OR games_played >= 0)
      AND (toi_seconds IS NULL OR toi_seconds >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_entity_metric_rankings_lookup
  ON public.entity_metric_rankings (
    entity_type,
    season_id,
    window_type,
    window_size,
    strength_state,
    metric_key,
    peer_group_type,
    peer_group_key,
    raw_rank
  );

CREATE INDEX IF NOT EXISTS idx_entity_metric_rankings_filters
  ON public.entity_metric_rankings (
    entity_type,
    season_id,
    metric_key,
    position_group,
    deployment_bucket,
    team_id,
    percentile DESC
  );

CREATE INDEX IF NOT EXISTS idx_entity_metric_rankings_entity
  ON public.entity_metric_rankings (
    entity_type,
    entity_id,
    season_id,
    snapshot_date DESC
  );

CREATE INDEX IF NOT EXISTS idx_entity_metric_rankings_methodology_snapshot
  ON public.entity_metric_rankings (methodology_version, snapshot_date DESC);

COMMENT ON TABLE public.entity_metric_rankings IS
  'Optional precomputed contextual ranking results. The API may use this table or an equivalent RPC fed by verified aggregate sources.';

COMMENT ON COLUMN public.entity_metric_rankings.methodology_version IS
  'Contextual ranking methodology version used to publish this snapshot row.';

CREATE TABLE IF NOT EXISTS public.skater_composite_ratings (
  player_id BIGINT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id SMALLINT NULL REFERENCES public.teams(id),
  season_id INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  window_type TEXT NOT NULL,
  window_size INTEGER NOT NULL DEFAULT 0,
  window_semantics TEXT NOT NULL,
  strength_state TEXT NOT NULL DEFAULT 'all',
  offense_rating_overall DOUBLE PRECISION NULL,
  offense_rating_deployment DOUBLE PRECISION NULL,
  defense_rating_overall DOUBLE PRECISION NULL,
  defense_rating_deployment DOUBLE PRECISION NULL,
  mcm_score DOUBLE PRECISION NULL,
  beast_tier TEXT NULL,
  shoot_first_score DOUBLE PRECISION NULL,
  pass_first_score DOUBLE PRECISION NULL,
  play_driver_score DOUBLE PRECISION NULL,
  results_luck_index DOUBLE PRECISION NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  components_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  methodology_version TEXT NOT NULL DEFAULT 'contextual_rankings_v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT skater_composite_ratings_pkey PRIMARY KEY (
    player_id,
    season_id,
    snapshot_date,
    window_type,
    window_size,
    strength_state
  ),
  CONSTRAINT skater_composite_ratings_window_type_check
    CHECK (window_type IN ('season', 'last_5', 'last_10', 'last_20', 'last_40', 'last_82', 'past_240_games', 'custom')),
  CONSTRAINT skater_composite_ratings_window_size_check
    CHECK (window_size >= 0),
  CONSTRAINT skater_composite_ratings_window_semantics_check
    CHECK (window_semantics IN ('player_last_n_games_played', 'team_last_n_games', 'season_to_date', 'custom')),
  CONSTRAINT skater_composite_ratings_strength_state_check
    CHECK (strength_state IN ('all', '5v5', 'ev', 'pp', 'pk')),
  CONSTRAINT skater_composite_ratings_beast_tier_check
    CHECK (beast_tier IS NULL OR beast_tier IN ('MCM Watch', 'MCM', 'BEAST', 'BEAST+')),
  CONSTRAINT skater_composite_ratings_score_ranges_check
    CHECK (
      (offense_rating_overall IS NULL OR (offense_rating_overall >= 0 AND offense_rating_overall <= 100))
      AND (offense_rating_deployment IS NULL OR (offense_rating_deployment >= 0 AND offense_rating_deployment <= 100))
      AND (defense_rating_overall IS NULL OR (defense_rating_overall >= 0 AND defense_rating_overall <= 100))
      AND (defense_rating_deployment IS NULL OR (defense_rating_deployment >= 0 AND defense_rating_deployment <= 100))
      AND (mcm_score IS NULL OR (mcm_score >= 0 AND mcm_score <= 100))
      AND (shoot_first_score IS NULL OR (shoot_first_score >= 0 AND shoot_first_score <= 100))
      AND (pass_first_score IS NULL OR (pass_first_score >= 0 AND pass_first_score <= 100))
      AND (play_driver_score IS NULL OR (play_driver_score >= 0 AND play_driver_score <= 100))
      AND (results_luck_index IS NULL OR results_luck_index >= 0)
    )
);

CREATE OR REPLACE FUNCTION public.set_contextual_snapshot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entity_metric_rankings_updated_at
  ON public.entity_metric_rankings;

CREATE TRIGGER trg_entity_metric_rankings_updated_at
  BEFORE UPDATE ON public.entity_metric_rankings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contextual_snapshot_updated_at();

DROP TRIGGER IF EXISTS trg_skater_composite_ratings_updated_at
  ON public.skater_composite_ratings;

CREATE TRIGGER trg_skater_composite_ratings_updated_at
  BEFORE UPDATE ON public.skater_composite_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contextual_snapshot_updated_at();

CREATE INDEX IF NOT EXISTS idx_skater_composite_ratings_lookup
  ON public.skater_composite_ratings (
    season_id,
    window_type,
    window_size,
    strength_state,
    team_id
  );

CREATE INDEX IF NOT EXISTS idx_skater_composite_ratings_mcm
  ON public.skater_composite_ratings (
    season_id,
    snapshot_date DESC,
    mcm_score DESC
  )
  WHERE mcm_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_skater_composite_ratings_methodology_snapshot
  ON public.skater_composite_ratings (methodology_version, snapshot_date DESC);

COMMENT ON TABLE public.skater_composite_ratings IS
  'Composite skater ratings scaffold for MCM / BEAST and later archetype phases. Existing skater_offensive_ratings_daily and skater_defensive_ratings_daily remain separate rating sources.';

COMMENT ON COLUMN public.skater_composite_ratings.methodology_version IS
  'Contextual composite methodology version used to publish this snapshot row.';

CREATE INDEX IF NOT EXISTS idx_rolling_player_game_metrics_contextual_lookup
  ON public.rolling_player_game_metrics (
    season,
    strength_state,
    game_date DESC,
    team_id,
    player_id
  );

CREATE INDEX IF NOT EXISTS idx_rolling_player_game_metrics_contextual_role
  ON public.rolling_player_game_metrics (
    season,
    strength_state,
    line_combo_group,
    line_combo_slot,
    pp_unit,
    game_date DESC
  );

CREATE INDEX IF NOT EXISTS idx_line_combinations_contextual_lookup
  ON public."lineCombinations" ("gameId", "teamId");

CREATE INDEX IF NOT EXISTS idx_power_play_combinations_contextual_lookup
  ON public."powerPlayCombinations" ("gameId", "playerId", unit);
