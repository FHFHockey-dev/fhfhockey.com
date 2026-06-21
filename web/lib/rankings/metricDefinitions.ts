export type ContextualRankingEntityType = "skater" | "goalie" | "team";

export type ContextualRankingStrengthState =
  | "all"
  | "5v5"
  | "ev"
  | "pp"
  | "pk";

export type ContextualRankingMetricPhase =
  | "phase_1"
  | "phase_2"
  | "phase_3"
  | "phase_4"
  | "phase_5"
  | "phase_6";

export type ContextualRankingMetricAvailability =
  | "available"
  | "unavailable"
  | "planned";

export type ContextualRankingPeerGroup = "position" | "deployment";

export type ContextualRankingSampleRequirements = {
  minimumGp: number;
  minimumToiSeconds: number;
  windowSource: string;
  notes?: readonly string[];
};

export type ContextualRankingMetricDefinition = {
  metricKey: string;
  displayName: string;
  entityType: ContextualRankingEntityType;
  category: string;
  description: string;
  formulaDescription: string;
  higherIsBetter: boolean;
  defaultStrengthState: ContextualRankingStrengthState;
  defaultPeerGroup: ContextualRankingPeerGroup;
  minimumGp: number;
  minimumToiSeconds: number;
  isRateStat: boolean;
  isPercentileEligible: boolean;
  phase: ContextualRankingMetricPhase;
  availabilityStatus: ContextualRankingMetricAvailability;
  sourceTable: string | null;
  sourceFields: readonly string[];
  applicableStrengthStates: readonly ContextualRankingStrengthState[];
  denominatorKey: string;
  denominatorDescription: string;
  sampleRequirements: ContextualRankingSampleRequirements;
  methodologyVersion: string;
  sourceQualityFlags: readonly string[];
  metadata?: Record<string, unknown>;
};

type ContextualRankingMetricDefinitionInput = Omit<
  ContextualRankingMetricDefinition,
  | "applicableStrengthStates"
  | "denominatorKey"
  | "denominatorDescription"
  | "sampleRequirements"
  | "methodologyVersion"
  | "sourceQualityFlags"
> &
  Partial<
    Pick<
      ContextualRankingMetricDefinition,
      | "applicableStrengthStates"
      | "denominatorKey"
      | "denominatorDescription"
      | "sampleRequirements"
      | "methodologyVersion"
      | "sourceQualityFlags"
    >
  >;

const DEFAULT_METHODOLOGY_VERSION = "contextual_rankings_v1";
const PLAYER_WINDOW_SOURCE = "player_last_n_games_played";
const TEAM_DEPLOYMENT_WINDOW_SOURCE = "team_last_n_games";

function defaultApplicableStrengthStates(
  definition: ContextualRankingMetricDefinitionInput,
): readonly ContextualRankingStrengthState[] {
  if (definition.defaultStrengthState === "5v5") return ["5v5"];
  if (definition.entityType !== "skater") return [definition.defaultStrengthState];
  return ["all", "5v5", "ev", "pp", "pk"];
}

function defaultDenominatorKey(definition: ContextualRankingMetricDefinitionInput) {
  if (definition.metricKey === "expected_shooting_percentage") {
    return "unblocked_attempts_pending_confirmation";
  }
  if (
    definition.metricKey === "goals_above_expected" ||
    definition.metricKey === "unrealized_xg"
  ) {
    return "none_count_difference";
  }
  if (definition.metricKey === "sax_percentage") return "shooting_percentage";
  if (definition.metricKey.endsWith("_percentage")) return "event_share";
  if (definition.metricKey === "results_luck_index") return "historical_baseline";
  if (
    definition.metricKey === "offense_rating" ||
    definition.metricKey === "defense_rating" ||
    definition.metricKey === "mcm_score"
  ) {
    return "component_percentiles";
  }
  if (definition.metricKey === "beast_tier") return "eligibility_thresholds";
  if (definition.isRateStat) return "toi_seconds";
  return "metric_specific";
}

function defaultDenominatorDescription(
  definition: ContextualRankingMetricDefinitionInput,
) {
  if (definition.isRateStat) {
    return "Total TOI seconds in the selected player-production window.";
  }
  if (definition.metricKey === "expected_shooting_percentage") {
    return "Pending denominator confirmation; xG-derived shot-quality metrics should use the source model's shot universe.";
  }
  if (definition.metricKey === "mcm_score") {
    return "Weighted component percentiles from published contextual metric components.";
  }
  if (
    definition.metricKey === "offense_rating" ||
    definition.metricKey === "defense_rating"
  ) {
    return "Weighted component percentiles from published skater composite rating rows.";
  }
  if (definition.metricKey === "beast_tier") {
    return "Eligibility thresholds applied to contextual percentile components.";
  }
  return "Metric-specific denominator described by the formula and methodology metadata.";
}

function defaultSourceQualityFlags(
  definition: ContextualRankingMetricDefinitionInput,
): readonly string[] {
  if (
    definition.metricKey === "hits_per_60" ||
    definition.metricKey === "blocks_per_60" ||
    definition.metricKey === "mcm_score" ||
    definition.metricKey === "beast_tier"
  ) {
    return ["rink_scorekeeper_sensitive_unadjusted"];
  }
  if (definition.metadata?.requiresDenominatorConfirmation === true) {
    return ["denominator_pending_confirmation"];
  }
  if (
    definition.metricKey === "xga_per_60" ||
    definition.metricKey === "on_ice_gf_percentage" ||
    definition.metricKey === "on_ice_xgf_percentage" ||
    definition.metricKey === "defense_rating"
  ) {
    return ["context_influenced_unadjusted_on_ice"];
  }
  return [];
}

function withMetricMethodologyDefaults(
  definition: ContextualRankingMetricDefinitionInput,
): ContextualRankingMetricDefinition {
  return {
    ...definition,
    applicableStrengthStates:
      definition.applicableStrengthStates ??
      defaultApplicableStrengthStates(definition),
    denominatorKey:
      definition.denominatorKey ?? defaultDenominatorKey(definition),
    denominatorDescription:
      definition.denominatorDescription ??
      defaultDenominatorDescription(definition),
    sampleRequirements:
      definition.sampleRequirements ?? {
        minimumGp: definition.minimumGp,
        minimumToiSeconds: definition.minimumToiSeconds,
        windowSource:
          definition.defaultPeerGroup === "deployment"
            ? TEAM_DEPLOYMENT_WINDOW_SOURCE
            : PLAYER_WINDOW_SOURCE,
      },
    methodologyVersion:
      definition.methodologyVersion ?? DEFAULT_METHODOLOGY_VERSION,
    sourceQualityFlags:
      definition.sourceQualityFlags ?? defaultSourceQualityFlags(definition),
  };
}

const CONTEXTUAL_RANKING_METRIC_DEFINITION_INPUTS = [
  {
    metricKey: "goals_per_60",
    displayName: "Goals/60",
    entityType: "skater",
    category: "Results",
    description: "Goals scored per 60 minutes in the selected window.",
    formulaDescription: "goals / TOI seconds * 3600",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 300,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_1",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "goals_per_60_{window}",
      "goals_per_60_total_last{n}",
      "toi_seconds_total_last{n}",
      "goals_per_60_goals_{baseline_window}",
      "goals_per_60_toi_seconds_{baseline_window}",
    ],
    metadata: { windowSource: "player_last_n_games_played" },
  },
  {
    metricKey: "assists_per_60",
    displayName: "Assists/60",
    entityType: "skater",
    category: "Results",
    description: "Total assists per 60 minutes in the selected window.",
    formulaDescription: "assists / TOI seconds * 3600",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 300,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_1",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "assists_per_60_{window}",
      "assists_per_60_total_last{n}",
      "toi_seconds_total_last{n}",
      "assists_per_60_assists_{baseline_window}",
      "assists_per_60_toi_seconds_{baseline_window}",
    ],
    metadata: { windowSource: "player_last_n_games_played" },
  },
  {
    metricKey: "primary_assists_per_60",
    displayName: "Primary Assists/60",
    entityType: "skater",
    category: "Process",
    description: "Primary assists per 60 minutes in the selected window.",
    formulaDescription: "primary assists / TOI seconds * 3600",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 300,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_1",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "primary_assists_per_60_{window}",
      "primary_assists_per_60_total_last{n}",
      "toi_seconds_total_last{n}",
      "primary_assists_per_60_primary_assists_{baseline_window}",
      "primary_assists_per_60_toi_seconds_{baseline_window}",
    ],
    metadata: { windowSource: "player_last_n_games_played" },
  },
  {
    metricKey: "points_per_60",
    displayName: "Points/60",
    entityType: "skater",
    category: "Results",
    description: "Total points per 60 minutes in the selected window.",
    formulaDescription: "points / TOI seconds * 3600",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 300,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_1",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "points_total_last{n}",
      "toi_seconds_total_last{n}",
      "points_avg_{baseline_window}",
      "toi_seconds_avg_{baseline_window}",
    ],
    metadata: {
      derivedMetric: true,
      windowSource: "player_last_n_games_played",
    },
  },
  {
    metricKey: "pp_points_per_60",
    displayName: "Power-play Points/60",
    entityType: "skater",
    category: "Special Teams",
    description:
      "Power-play points per 60 minutes in the selected window; source contract is pending in the current ranking surface.",
    formulaDescription:
      "power-play points / power-play TOI seconds * 3600 once verified PP point and PP TOI fields are promoted into the ranking surface.",
    higherIsBetter: true,
    defaultStrengthState: "pp",
    defaultPeerGroup: "deployment",
    minimumGp: 1,
    minimumToiSeconds: 120,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_2",
    availabilityStatus: "unavailable",
    sourceTable: null,
    sourceFields: [],
    applicableStrengthStates: ["pp"],
    denominatorKey: "pp_toi_seconds_source_pending",
    denominatorDescription:
      "Verified player power-play TOI seconds in the selected player-production window; not available in the current matrix ranking contract.",
    sourceQualityFlags: ["source_pending"],
    metadata: {
      sourcePendingReason:
        "Original MCM includes PP points, but the live MCM contract excludes pp_points_per_60 until verified ranking rows are available.",
      requiredFields: ["power_play_points", "power_play_toi_seconds"],
    },
  },
  {
    metricKey: "sog_per_60",
    displayName: "SOG/60",
    entityType: "skater",
    category: "Process",
    description: "Shots on goal per 60 minutes in the selected window.",
    formulaDescription: "shots on goal / TOI seconds * 3600",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 300,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_1",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "sog_per_60_{window}",
      "sog_per_60_total_last{n}",
      "toi_seconds_total_last{n}",
      "sog_per_60_shots_{baseline_window}",
      "sog_per_60_toi_seconds_{baseline_window}",
    ],
    metadata: { windowSource: "player_last_n_games_played" },
  },
  {
    metricKey: "shot_attempts_per_60",
    displayName: "Shot Attempts/60",
    entityType: "skater",
    category: "Process",
    description: "Individual shot attempts per 60 minutes in the selected window.",
    formulaDescription:
      "NST individual Corsi For (ICF) / TOI seconds * 3600.",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 300,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_1",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "shot_attempts_per_60_{window}",
      "shot_attempts_per_60_total_last{n}",
      "toi_seconds_total_last{n}",
      "shot_attempts_per_60_shot_attempts_{baseline_window}",
      "shot_attempts_per_60_toi_seconds_{baseline_window}",
    ],
    metadata: {
      semanticSource: "nst_icf",
      windowSource: "player_last_n_games_played",
      rejectedSources: {
        "rolling_player_game_metrics.cf_*":
          "On-ice Corsi For, not individual shot attempts.",
        "wgo_skater_stats.sat_for":
          "Verified as an on-ice/team SAT field, not individual shot attempts.",
        "nst_gamelog_as_counts.iscfs":
          "Individual scoring chances, not all individual shot attempts.",
      },
    },
  },
  {
    metricKey: "hits_per_60",
    displayName: "Hits/60",
    entityType: "skater",
    category: "Fantasy composite",
    description: "Hits per 60 minutes in the selected window.",
    formulaDescription: "hits / TOI seconds * 3600",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 300,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_1",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "hits_per_60_{window}",
      "hits_per_60_total_last{n}",
      "toi_seconds_total_last{n}",
      "hits_per_60_hits_{baseline_window}",
      "hits_per_60_toi_seconds_{baseline_window}",
    ],
    metadata: { windowSource: "player_last_n_games_played" },
  },
  {
    metricKey: "blocks_per_60",
    displayName: "Blocks/60",
    entityType: "skater",
    category: "Fantasy composite",
    description: "Blocked shots per 60 minutes in the selected window.",
    formulaDescription: "blocks / TOI seconds * 3600",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 300,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_1",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "blocks_per_60_{window}",
      "blocks_per_60_total_last{n}",
      "toi_seconds_total_last{n}",
      "blocks_per_60_blocks_{baseline_window}",
      "blocks_per_60_toi_seconds_{baseline_window}",
    ],
    metadata: { windowSource: "player_last_n_games_played" },
  },
  {
    metricKey: "ixg_per_60",
    displayName: "Individual xG/60",
    entityType: "skater",
    category: "Process",
    description: "Individual expected goals per 60 minutes in the selected window.",
    formulaDescription: "individual xG / TOI seconds * 3600",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 300,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_1",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "ixg_per_60_{window}",
      "ixg_per_60_total_last{n}",
      "toi_seconds_total_last{n}",
      "ixg_per_60_ixg_{baseline_window}",
      "ixg_per_60_toi_seconds_{baseline_window}",
    ],
    metadata: {
      windowSource: "player_last_n_games_played",
      xgSemantic: "shot_quality_probability_sum",
      xgShotUniverse: "fenwick_unblocked",
      sourceExcludes: ["expected_goals"],
    },
  },
  {
    metricKey: "xga_per_60",
    displayName: "xGA/60",
    entityType: "skater",
    category: "Defense",
    description: "On-ice expected goals against per 60 minutes.",
    formulaDescription:
      "on-ice xGA / TOI seconds * 3600. Lower raw values are better.",
    higherIsBetter: false,
    defaultStrengthState: "5v5",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 600,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_3",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "rolling_player_game_metrics.oi_xga_total_{window}",
      "rolling_player_game_metrics.toi_seconds_total_{window}",
      "rolling_player_game_metrics.oi_xga_avg_{baseline_window}",
      "rolling_player_game_metrics.toi_seconds_avg_{baseline_window}",
    ],
    applicableStrengthStates: ["5v5"],
    metadata: {
      labelScope: "Defensive Impact in Context",
      caveat:
        "Raw 5v5 on-ice defensive rates are influenced by teammates, opponents, usage, zone starts, and score state until an adjusted RAPM/GAR-like model is available.",
    },
  },
  {
    metricKey: "penalties_taken_per_60",
    displayName: "Penalties Taken/60",
    entityType: "skater",
    category: "Discipline",
    description: "Penalties taken per 60 minutes.",
    formulaDescription:
      "penalties taken / TOI seconds * 3600. Lower raw values are better.",
    higherIsBetter: false,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 300,
    isRateStat: true,
    isPercentileEligible: true,
    phase: "phase_3",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "rolling_player_game_metrics.penalties_taken_per_60_{window}",
      "rolling_player_game_metrics.penalties_taken_per_60_total_{window}",
      "rolling_player_game_metrics.toi_seconds_total_{window}",
    ],
    metadata: {
      numeratorSource: "NST total_penalties",
      caveat: "Counts penalties taken, not penalty minutes.",
    },
  },
  {
    metricKey: "expected_shooting_percentage",
    displayName: "xS%",
    entityType: "skater",
    category: "Regression",
    description:
      "Expected shooting percentage based on individual xG and unblocked shot attempts.",
    formulaDescription: "individual xG / individual unblocked attempts * 100",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 600,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_3",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "rolling_player_game_metrics.ixg_per_60_total_{window}",
      "rolling_player_game_metrics.shot_attempts_per_60_total_{window}",
      "rolling_player_game_metrics.ixg_per_60_ixg_{baseline_window}",
      "rolling_player_game_metrics.shot_attempts_per_60_shot_attempts_{baseline_window}",
    ],
    denominatorKey: "individual_unblocked_attempts",
    denominatorDescription:
      "Individual unblocked shot attempts from approved shot-goal xG feature rows.",
    sourceQualityFlags: ["fenwick_xg_denominator_matched"],
    metadata: {
      xgShotUniverse: "fenwick_unblocked",
      shotAttemptsFieldSemantics:
        "nhl_xg_player_rolling_aggregates.shot_attempts is populated from is_unblocked_shot_attempt=true features.",
    },
  },
  {
    metricKey: "sax_percentage",
    displayName: "SAX%",
    entityType: "skater",
    category: "Regression",
    description: "Shooting percentage above expected.",
    formulaDescription: "actual shooting percentage - expected shooting percentage",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 600,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_3",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "rolling_player_game_metrics.goals_per_60_total_{window}",
      "rolling_player_game_metrics.ixg_per_60_total_{window}",
      "rolling_player_game_metrics.shot_attempts_per_60_total_{window}",
      "rolling_player_game_metrics.goals_per_60_goals_{baseline_window}",
      "rolling_player_game_metrics.ixg_per_60_ixg_{baseline_window}",
      "rolling_player_game_metrics.shot_attempts_per_60_shot_attempts_{baseline_window}",
    ],
    denominatorKey: "individual_unblocked_attempts",
    denominatorDescription:
      "Individual unblocked shot attempts from approved shot-goal xG feature rows.",
    sourceQualityFlags: ["fenwick_xg_denominator_matched"],
    metadata: {
      dependsOn: ["goals", "ixg", "individual_unblocked_attempts"],
      xgShotUniverse: "fenwick_unblocked",
    },
  },
  {
    metricKey: "goals_above_expected",
    displayName: "Goals Above Expected",
    entityType: "skater",
    category: "Regression",
    description: "Goals scored above individual expected goals.",
    formulaDescription: "goals - individual xG",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 600,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_3",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "rolling_player_game_metrics.goals_per_60_total_{window}",
      "rolling_player_game_metrics.ixg_per_60_total_{window}",
      "rolling_player_game_metrics.goals_per_60_goals_{baseline_window}",
      "rolling_player_game_metrics.ixg_per_60_ixg_{baseline_window}",
    ],
    metadata: { dependsOn: ["goals", "ixg"] },
  },
  {
    metricKey: "unrealized_xg",
    displayName: "Unrealized xG",
    entityType: "skater",
    category: "Regression",
    description: "Expected goals generated but not converted into goals.",
    formulaDescription: "individual xG - goals",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 600,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_3",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "rolling_player_game_metrics.ixg_per_60_total_{window}",
      "rolling_player_game_metrics.goals_per_60_total_{window}",
      "rolling_player_game_metrics.ixg_per_60_ixg_{baseline_window}",
      "rolling_player_game_metrics.goals_per_60_goals_{baseline_window}",
    ],
    metadata: { dependsOn: ["ixg", "goals"] },
  },
  {
    metricKey: "on_ice_gf_percentage",
    displayName: "On-ice GF%",
    entityType: "skater",
    category: "Results",
    description: "Share of on-ice goals that were goals for.",
    formulaDescription: "on-ice GF / (on-ice GF + on-ice GA)",
    higherIsBetter: true,
    defaultStrengthState: "ev",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 600,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_3",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "rolling_player_game_metrics.oi_gf_total_{window}",
      "rolling_player_game_metrics.oi_ga_total_{window}",
      "rolling_player_game_metrics.oi_gf_avg_{baseline_window}",
      "rolling_player_game_metrics.oi_ga_avg_{baseline_window}",
    ],
    applicableStrengthStates: ["5v5", "ev"],
    metadata: {
      caveat:
        "Raw on-ice result shares are teammate, opponent, usage, and score-state influenced.",
    },
  },
  {
    metricKey: "on_ice_xgf_percentage",
    displayName: "On-ice xGF%",
    entityType: "skater",
    category: "Process",
    description: "Share of on-ice expected goals that were expected goals for.",
    formulaDescription: "on-ice xGF / (on-ice xGF + on-ice xGA)",
    higherIsBetter: true,
    defaultStrengthState: "5v5",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 600,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_3",
    availabilityStatus: "available",
    sourceTable: "rolling_player_game_metrics",
    sourceFields: [
      "rolling_player_game_metrics.oi_xgf_total_{window}",
      "rolling_player_game_metrics.oi_xga_total_{window}",
      "rolling_player_game_metrics.oi_xgf_avg_{baseline_window}",
      "rolling_player_game_metrics.oi_xga_avg_{baseline_window}",
    ],
    applicableStrengthStates: ["5v5"],
    metadata: {
      caveat:
        "Raw 5v5 on-ice process shares are teammate, opponent, usage, and score-state influenced.",
    },
  },
  {
    metricKey: "rel_5v5_gf_percentage",
    displayName: "Relative 5v5 GF%",
    entityType: "skater",
    category: "Results",
    description: "Player 5v5 GF% relative to team-without-player baseline.",
    formulaDescription: "player 5v5 GF% - team 5v5 GF% without player",
    higherIsBetter: true,
    defaultStrengthState: "5v5",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 1200,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_3",
    availabilityStatus: "planned",
    sourceTable: null,
    sourceFields: [],
    metadata: { requiresTeamWithoutPlayerBaseline: true },
  },
  {
    metricKey: "rel_5v5_xgf_percentage",
    displayName: "Relative 5v5 xGF%",
    entityType: "skater",
    category: "Process",
    description: "Player 5v5 xGF% relative to team-without-player baseline.",
    formulaDescription: "player 5v5 xGF% - team 5v5 xGF% without player",
    higherIsBetter: true,
    defaultStrengthState: "5v5",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 1200,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_3",
    availabilityStatus: "planned",
    sourceTable: null,
    sourceFields: [],
    metadata: { requiresTeamWithoutPlayerBaseline: true },
  },
  {
    metricKey: "offense_rating",
    displayName: "Offense Rating",
    entityType: "skater",
    category: "Composite",
    description:
      "Published skater offensive composite sourced from skater_composite_ratings.",
    formulaDescription:
      "Weighted blend of scoring-rate, chance-creation, playmaking, and finishing-context percentile components.",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "deployment",
    minimumGp: 1,
    minimumToiSeconds: 600,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_2",
    availabilityStatus: "available",
    sourceTable: "skater_composite_ratings",
    sourceFields: [
      "skater_composite_ratings.offense_rating_overall",
      "skater_composite_ratings.offense_rating_deployment",
    ],
    metadata: {
      signalType: "contextual_percentile_composite",
      componentGroups: [
        "scoring_rate_score",
        "chance_creation_score",
        "playmaking_score",
        "finishing_context_score",
      ],
    },
  },
  {
    metricKey: "defense_rating",
    displayName: "Defensive Impact",
    entityType: "skater",
    category: "Composite",
    description:
      "Published contextual defensive-impact composite sourced from skater_composite_ratings.",
    formulaDescription:
      "Weighted blend of suppression, raw on-ice process, and physical-support percentile components.",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "deployment",
    minimumGp: 1,
    minimumToiSeconds: 600,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_2",
    availabilityStatus: "available",
    sourceTable: "skater_composite_ratings",
    sourceFields: [
      "skater_composite_ratings.defense_rating_overall",
      "skater_composite_ratings.defense_rating_deployment",
    ],
    metadata: {
      labelScope: "Defensive Impact in Context",
      signalType: "contextual_percentile_composite",
      caveat:
        "Uses context-influenced on-ice defensive inputs and should not be presented as adjusted defensive talent.",
    },
  },
  {
    metricKey: "results_luck_index",
    displayName: "Results Luck Index",
    entityType: "skater",
    category: "Regression",
    description: "Current results compared with historical or blended baseline results.",
    formulaDescription: "100 * current results / baseline results",
    higherIsBetter: false,
    defaultStrengthState: "all",
    defaultPeerGroup: "position",
    minimumGp: 1,
    minimumToiSeconds: 1200,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_3",
    availabilityStatus: "available",
    sourceTable: "skater_composite_ratings",
    sourceFields: [
      "skater_composite_ratings.results_luck_index",
      "skater_composite_ratings.components_json->resultsLuck.baselineProvenance",
    ],
    metadata: {
      centeredAt: 100,
      higherMeans: "hotter_or_luckier",
      baselineWindow: "non_overlapping_prior_season_to_date",
      fallback: "peer_average_blend_for_thin_prior_samples",
      baselineExcludesSelectedWindow: true,
      sparseUntilAllComponentsAvailable: true,
    },
  },
  {
    metricKey: "mcm_score",
    displayName: "MCM Score",
    entityType: "skater",
    category: "Fantasy composite",
    description:
      "Current-contract multi-category fantasy score based on verified live percentile components.",
    formulaDescription:
      "Weighted blend of riff score, live scoring score, and live category depth score; power-play points are excluded until pp_points_per_60 source rows are verified.",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "deployment",
    minimumGp: 1,
    minimumToiSeconds: 600,
    isRateStat: false,
    isPercentileEligible: true,
    phase: "phase_2",
    availabilityStatus: "available",
    sourceTable: "skater_composite_ratings",
    sourceFields: ["skater_composite_ratings.mcm_score"],
    metadata: {
      componentMetrics: [
        "sog_per_60",
        "hits_per_60",
        "blocks_per_60",
        "goals_per_60",
        "primary_assists_per_60",
        "points_per_60",
      ],
      sourcePendingComponents: ["pp_points_per_60"],
      componentCaveats: {
        hits_per_60: "RTSS event; not rink-adjusted in current sources.",
        blocks_per_60: "RTSS event; not rink-adjusted in current sources.",
        pp_points_per_60:
          "Original MCM component; excluded from the live MCM score until verified source rows exist.",
      },
      signalType: "fantasy_peripheral_composite",
    },
  },
  {
    metricKey: "beast_tier",
    displayName: "BEAST Tier",
    entityType: "skater",
    category: "Fantasy composite",
    description:
      "Current-contract tier label for qualified multi-category players.",
    formulaDescription:
      "Eligibility gates based on verified live MCM percentile thresholds; power-play points are source-pending and excluded.",
    higherIsBetter: true,
    defaultStrengthState: "all",
    defaultPeerGroup: "deployment",
    minimumGp: 1,
    minimumToiSeconds: 600,
    isRateStat: false,
    isPercentileEligible: false,
    phase: "phase_2",
    availabilityStatus: "available",
    sourceTable: "skater_composite_ratings",
    sourceFields: ["skater_composite_ratings.beast_tier"],
    metadata: {
      allowedTiers: ["MCM Watch", "MCM", "BEAST", "BEAST+"],
      sourcePendingComponents: ["pp_points_per_60"],
      componentCaveats: {
        hits_per_60: "RTSS event; not rink-adjusted in current sources.",
        blocks_per_60: "RTSS event; not rink-adjusted in current sources.",
        pp_points_per_60:
          "Original MCM component; excluded from live BEAST gates until verified source rows exist.",
      },
      signalType: "fantasy_peripheral_tier",
    },
  },
] as const satisfies readonly ContextualRankingMetricDefinitionInput[];

export const CONTEXTUAL_RANKING_METRIC_DEFINITIONS =
  CONTEXTUAL_RANKING_METRIC_DEFINITION_INPUTS.map(
    withMetricMethodologyDefaults,
  );

export type ContextualRankingMetricKey =
  (typeof CONTEXTUAL_RANKING_METRIC_DEFINITION_INPUTS)[number]["metricKey"];

export const CONTEXTUAL_RANKING_METRIC_KEYS =
  CONTEXTUAL_RANKING_METRIC_DEFINITIONS.map(
    (definition) => definition.metricKey,
  ) as ContextualRankingMetricKey[];

export const AVAILABLE_CONTEXTUAL_RANKING_METRIC_KEYS =
  CONTEXTUAL_RANKING_METRIC_DEFINITIONS.filter(
    (definition) => definition.availabilityStatus === "available",
  ).map((definition) => definition.metricKey as ContextualRankingMetricKey);

export function getContextualRankingMetricDefinition(metricKey: string) {
  return CONTEXTUAL_RANKING_METRIC_DEFINITIONS.find(
    (definition) => definition.metricKey === metricKey,
  );
}

export function listContextualRankingMetrics(filters?: {
  entityType?: ContextualRankingEntityType;
  phase?: ContextualRankingMetricPhase;
  availabilityStatus?: ContextualRankingMetricAvailability;
}) {
  return CONTEXTUAL_RANKING_METRIC_DEFINITIONS.filter((definition) => {
    if (filters?.entityType && definition.entityType !== filters.entityType) {
      return false;
    }
    if (filters?.phase && definition.phase !== filters.phase) {
      return false;
    }
    if (
      filters?.availabilityStatus &&
      definition.availabilityStatus !== filters.availabilityStatus
    ) {
      return false;
    }
    return true;
  });
}
