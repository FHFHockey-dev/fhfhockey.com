import {
  DEFENSIVE_COMPOSITE_CAVEATS,
  DEFENSIVE_COMPOSITE_LABELS,
  DEFENSIVE_COMPOSITE_SOURCE_QUALITY_FLAGS,
} from "./defensiveCompositeMethodology";

export const SKATER_COMPOSITE_SOURCE_TABLE = "skater_composite_ratings" as const;

export const OFFENSE_RATING_CONTRACT = {
  label: "Offense Rating",
  outputField: "offense_rating",
  peerGroup: "deployment",
  scale: "percentile_0_to_100",
  formula:
    "0.35 * scoring_rate_score + 0.30 * chance_creation_score + 0.20 * playmaking_score + 0.15 * finishing_context_score",
  components: {
    scoring_rate_score: ["goals_per_60", "points_per_60"],
    chance_creation_score: ["ixg_per_60", "shot_attempts_per_60", "sog_per_60"],
    playmaking_score: ["primary_assists_per_60", "assists_per_60"],
    finishing_context_score: [
      "expected_shooting_percentage",
      "sax_percentage",
      "goals_above_expected",
    ],
  },
  caveats: [
    "Use percentiles in the active peer group, not raw values.",
    "Treat finishing components as context, not as the entire offensive rating.",
  ],
} as const;

export const DEFENSE_RATING_CONTRACT = {
  label: DEFENSIVE_COMPOSITE_LABELS.overall,
  outputField: "defense_rating",
  peerGroup: "deployment",
  scale: "percentile_0_to_100",
  formula:
    "0.45 * suppression_score + 0.35 * on_ice_process_score + 0.20 * physical_support_score",
  components: {
    suppression_score: ["xga_per_60"],
    on_ice_process_score: ["on_ice_xgf_percentage", "on_ice_gf_percentage"],
    physical_support_score: ["blocks_per_60"],
  },
  sourceQualityFlags: DEFENSIVE_COMPOSITE_SOURCE_QUALITY_FLAGS,
  caveats: DEFENSIVE_COMPOSITE_CAVEATS,
} as const;

export const MCM_COMPONENTS = {
  riff: ["sog_per_60", "hits_per_60", "blocks_per_60"],
  scoring: [
    "goals_per_60",
    "primary_assists_per_60",
    "points_per_60",
  ],
} as const;

export const MCM_SOURCE_PENDING_COMPONENTS = [
  {
    metricKey: "pp_points_per_60",
    originalRole: "power-play scoring component",
    reason:
      "Original MCM includes power-play points, but verified pp_points_per_60 ranking rows are not available in the current source contract.",
  },
] as const;

export const MCM_SCORE_CONTRACT = {
  label: "MCM Score",
  outputField: "mcm_score",
  peerGroup: "deployment",
  scale: "percentile_0_to_100",
  formula:
    "0.45 * average(top_2(riff_percentiles)) + 0.35 * max(live_scoring_percentiles) + 0.20 * average(live_component_percentiles)",
  componentGroups: MCM_COMPONENTS,
  sourcePendingComponents: MCM_SOURCE_PENDING_COMPONENTS,
  requiredOutputFields: [
    "mcm_score",
    "beast_tier",
    "total_flag_count",
    "riff_flag_count",
    "scoring_flag_count",
    "visible_thresholds",
  ],
  caveats: [
    "Hits and blocks are rink/scorekeeper-sensitive until a rink-adjusted source is verified.",
    "Power-play points are explicitly excluded from the live MCM calculation until pp_points_per_60 ranking rows are verified.",
    "MCM is a fantasy multi-category signal, not a pure NHL talent rating.",
  ],
} as const;

export const BEAST_TIER_GATES = [
  {
    tier: "BEAST+",
    minimumMcmScore: 88,
    riffThresholds: { count: 3, percentile: 80 },
    scoringThresholds: { count: 2, percentile: 75 },
    allCategoryThresholds: { count: 4, percentile: 80 },
  },
  {
    tier: "BEAST",
    minimumMcmScore: 80,
    riffThresholds: { count: 2, percentile: 75 },
    scoringThresholds: { count: 1, percentile: 70 },
    allCategoryThresholds: { count: 4, percentile: 70 },
  },
  {
    tier: "MCM",
    minimumMcmScore: 70,
    riffThresholds: { count: 2, percentile: 70 },
    scoringThresholds: { count: 1, percentile: 60 },
    allCategoryThresholds: null,
  },
  {
    tier: "MCM Watch",
    minimumMcmScore: null,
    riffThresholds: { count: 2, percentile: 60 },
    scoringThresholds: { count: 1, percentile: 60 },
    allCategoryThresholds: null,
  },
] as const;

export const SKATER_ARCHETYPE_TAG_CONTRACTS = [
  {
    key: "shoot_first",
    label: "Shoot First Proxy",
    status: "current_proxy",
    rule:
      "shot_attempts_per_60 percentile >= 75 and primary_assists_per_60 percentile < 70",
    components: ["shot_attempts_per_60", "sog_per_60", "primary_assists_per_60"],
  },
  {
    key: "pass_first",
    label: "Pass First Proxy",
    status: "current_proxy",
    rule:
      "primary_assists_per_60 percentile >= 75 and shot_attempts_per_60 percentile < 70",
    components: ["primary_assists_per_60", "assists_per_60", "shot_attempts_per_60"],
  },
  {
    key: "play_driver",
    label: "Play Driver Proxy",
    status: "current_proxy",
    rule:
      "on_ice_xgf_percentage percentile >= 70 and either shot_attempts_per_60 or primary_assists_per_60 percentile >= 70",
    components: [
      "on_ice_xgf_percentage",
      "shot_attempts_per_60",
      "primary_assists_per_60",
    ],
  },
] as const;

export const RESULTS_LUCK_INDEX_CONTRACT = {
  label: "Results Luck Index",
  outputField: "results_luck_index",
  centeredAt: 100,
  directionality: "higher_is_hotter_or_luckier",
  formula:
    "100 * current_results_signal / frozen_baseline_results_signal",
  currentResultsSignal:
    "weighted blend of verified rolling goals_above_expected, sax_percentage, ipp, and on-ice shooting context for the selected window",
  baseline:
    "prior season-to-date or historical player baseline that excludes the selected current window, blended with active peer-group average when player history is thin",
  minimumSampleRules: [
    "Do not calculate without a non-overlapping baseline.",
    "Exclude PP-specific luck components unless PP TOI meets the configured minimum.",
    "Return unavailable rather than leaking the selected current window into the baseline.",
  ],
  interpretationBands: [
    { label: "Running hot", min: 120, max: null },
    { label: "Slightly hot", min: 105, max: 119 },
    { label: "Normal", min: 95, max: 105 },
    { label: "Slightly cold", min: 80, max: 94 },
    { label: "Running cold", min: null, max: 79 },
  ],
} as const;

export const RESULTS_LUCK_SIGNAL_COMPONENTS = [
  {
    key: "goals_above_expected",
    label: "Goals Above Expected",
    weight: 0.35,
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "goals_per_60_total_{window}",
      "ixg_per_60_total_{window}",
      "goals_per_60_goals_{baseline_window}",
      "ixg_per_60_ixg_{baseline_window}",
    ],
    signal:
      "selected-window goals minus selected-window individual expected goals",
  },
  {
    key: "sax_percentage",
    label: "SAX%",
    weight: 0.25,
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "goals_per_60_total_{window}",
      "ixg_per_60_total_{window}",
      "shot_attempts_per_60_total_{window}",
      "goals_per_60_goals_{baseline_window}",
      "ixg_per_60_ixg_{baseline_window}",
      "shot_attempts_per_60_shot_attempts_{baseline_window}",
    ],
    signal:
      "selected-window actual shooting percentage minus expected shooting percentage",
  },
  {
    key: "ipp",
    label: "IPP",
    weight: 0.2,
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "ipp_points_{window}",
      "ipp_on_ice_goals_for_{window}",
      "ipp_points_{baseline_window}",
      "ipp_on_ice_goals_for_{baseline_window}",
    ],
    signal:
      "selected-window individual points share of on-ice goals for, compared with a selected-window-excluded baseline",
  },
  {
    key: "on_ice_shooting_context",
    label: "On-Ice Shooting Context",
    weight: 0.2,
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "on_ice_sh_pct_{window}",
      "on_ice_sh_pct_goals_for_{window}",
      "on_ice_sh_pct_shots_for_{window}",
      "oi_gf_total_{window}",
      "oi_xgf_total_{window}",
      "on_ice_sh_pct_{baseline_window}",
    ],
    signal:
      "selected-window on-ice shooting percentage and on-ice goals above expected context",
  },
] as const;

export const RESULTS_LUCK_BASELINE_PERSISTENCE_CONTRACT = {
  storageTable: SKATER_COMPOSITE_SOURCE_TABLE,
  storageField: "results_luck_index",
  requiredBaselineSource:
    "frozen selected-window-excluded player baseline with peer-group fallback metadata",
  allowedSourceTables: [
    "rolling_player_game_metrics",
    "skater_composite_ratings",
  ],
  blockedSourceTables: [
    {
      table: "player_baselines",
      reason:
        "Current sustainability baseline payloads include rolling window summaries, but do not by themselves prove the selected rankings window was excluded from the baseline.",
    },
  ],
  requiredProvenanceFields: [
    "baselineSource",
    "baselineSnapshotDate",
    "baselineWindowExcluded",
    "baselineWeight",
    "peerBaselineValue",
    "warnings",
  ],
  publishGate:
    "Only write non-null results_luck_index when baselineWindowExcluded is true or the row explicitly records a peer_fallback for season windows.",
} as const;
