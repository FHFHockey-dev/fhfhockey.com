export type FeatureLeakageCategory =
  | "pregame_safe"
  | "pregame_safe_with_freshness"
  | "in_game_only"
  | "postgame_descriptive"
  | "target_leakage"
  | "unknown";

export type FeatureUsageMode = "pregame" | "in_game" | "postgame_descriptive" | "training";

export type FeatureLeakageRegistryEntry = {
  id: string;
  category: FeatureLeakageCategory;
  featureGroup: string;
  tables: string[];
  featureKeys?: string[];
  freshnessRequired: boolean;
  rationale: string;
  ownerNotes?: string;
};

export type FeatureLeakageValidationReport = {
  passed: boolean;
  usageMode: FeatureUsageMode;
  entries: FeatureLeakageRegistryEntry[];
  blockingReasons: string[];
  warnings: string[];
  unknownFeatureIds: string[];
  unknownTables: string[];
};

const REGISTRY: FeatureLeakageRegistryEntry[] = [
  {
    id: "schedule_identity",
    category: "pregame_safe",
    featureGroup: "schedule",
    tables: ["games", "teams", "seasons"],
    freshnessRequired: false,
    rationale: "Game/team identity and scheduled puck drop are known before the game.",
  },
  {
    id: "travel_fatigue",
    category: "pregame_safe",
    featureGroup: "schedule_context",
    tables: ["nhl_xg_team_game_travel_fatigue_features"],
    freshnessRequired: false,
    rationale: "Derived only from schedule, home/away, and timezone inference.",
  },
  {
    id: "team_strength_asof",
    category: "pregame_safe_with_freshness",
    featureGroup: "team_strength",
    tables: ["team_power_ratings_daily", "team_ctpi_daily", "wgo_team_stats"],
    freshnessRequired: true,
    rationale: "Safe only when joined strictly as-of before the target game.",
  },
  {
    id: "nst_team_gamelogs_asof",
    category: "pregame_safe_with_freshness",
    featureGroup: "team_underlying",
    tables: [
      "nst_team_gamelogs_as_counts",
      "nst_team_gamelogs_as_rates",
      "nst_team_gamelogs_pp_counts",
      "nst_team_gamelogs_pp_rates",
      "nst_team_gamelogs_pk_counts",
      "nst_team_gamelogs_pk_rates",
    ],
    freshnessRequired: true,
    rationale: "Pregame-safe only when historical rows are cut off before puck drop.",
  },
  {
    id: "lineup_sources",
    category: "pregame_safe_with_freshness",
    featureGroup: "lineup_context",
    tables: [
      "lineCombinations",
      "lines_nhl",
      "lines_dfo",
      "lines_gdl",
      "lines_ccc",
      "lineup_source_provenance",
    ],
    freshnessRequired: true,
    rationale: "Pregame lineup features require observed-at/source freshness before start time.",
  },
  {
    id: "goalie_starter_signals",
    category: "pregame_safe_with_freshness",
    featureGroup: "goalie_starters",
    tables: ["goalie_start_projections", "starter_scenario_metadata"],
    freshnessRequired: true,
    rationale: "Starter signals are safe only as-of the prediction timestamp.",
  },
  {
    id: "injury_status_signals",
    category: "pregame_safe_with_freshness",
    featureGroup: "injury_status",
    tables: ["player_status_history", "lineup_source_provenance"],
    freshnessRequired: true,
    rationale: "Injury/status features require source timestamps and expiry handling.",
  },
  {
    id: "nhl_edge_metrics",
    category: "pregame_safe_with_freshness",
    featureGroup: "nhl_edge",
    tables: [
      "nhl_edge_skater_metrics_daily",
      "nhl_edge_goalie_metrics_daily",
      "nhl_edge_team_metrics_daily",
      "nhl_edge_skater_shot_location_leaders_daily",
      "nhl_edge_stats_daily",
    ],
    freshnessRequired: true,
    rationale: "EDGE rows are usable pregame only as historical/as-of features, not same-game outcomes.",
  },
  {
    id: "xg_shot_features",
    category: "in_game_only",
    featureGroup: "shot_xg",
    tables: ["nhl_xg_shot_features"],
    freshnessRequired: false,
    rationale: "Shot features describe an event that occurs during the game.",
  },
  {
    id: "xg_shot_predictions",
    category: "postgame_descriptive",
    featureGroup: "shot_xg",
    tables: ["nhl_xg_shot_predictions"],
    freshnessRequired: false,
    rationale: "Approved xG predictions describe already-observed shot events.",
  },
  {
    id: "xg_aggregates",
    category: "postgame_descriptive",
    featureGroup: "xg_aggregates",
    tables: [
      "nhl_xg_team_game_aggregates",
      "nhl_xg_team_rolling_aggregates",
      "nhl_xg_player_game_aggregates",
      "nhl_xg_player_rolling_aggregates",
      "nhl_xg_goalie_game_aggregates",
      "nhl_xg_goalie_rolling_aggregates",
      "nhl_xg_player_created_xg_game_aggregates",
      "nhl_xg_player_created_xg_rolling_aggregates",
      "nhl_xg_rebound_control_team_game_aggregates",
      "nhl_xg_rebound_control_player_game_aggregates",
      "nhl_xg_rebound_control_goalie_game_aggregates",
    ],
    freshnessRequired: false,
    rationale: "Aggregates summarize completed event-level xG outputs.",
  },
  {
    id: "shot_assists_and_transition",
    category: "postgame_descriptive",
    featureGroup: "created_xg",
    tables: [
      "nhl_xg_shot_assist_candidates",
      "nhl_xg_transition_events",
      "nhl_xg_transition_player_game_aggregates",
      "nhl_xg_transition_team_game_aggregates",
    ],
    freshnessRequired: false,
    rationale: "Inferred from completed PBP sequences and approved shot xG.",
  },
  {
    id: "qot_qoc_postgame_overlap",
    category: "postgame_descriptive",
    featureGroup: "qot_qoc",
    tables: [
      "nhl_xg_qot_qoc_player_game_features",
      "nhl_xg_qot_qoc_unit_game_features",
      "nhl_xg_qot_qoc_player_rolling_features",
    ],
    freshnessRequired: false,
    rationale: "Postgame shift-overlap QoT/QoC uses same-game deployment.",
  },
  {
    id: "adjusted_impact_postgame",
    category: "postgame_descriptive",
    featureGroup: "adjusted_impact",
    tables: ["nhl_xg_adjusted_impact_model_runs", "nhl_xg_adjusted_player_impacts"],
    freshnessRequired: false,
    rationale: "Adjusted impact is fit from observed same-game on-ice target outcomes.",
  },
  {
    id: "current_display_latest_only",
    category: "unknown",
    featureGroup: "latest_display",
    tables: ["nhl_team_data", "vw_goalie_stats_unified"],
    freshnessRequired: true,
    rationale: "Latest-only display surfaces need explicit as-of reconstruction before model use.",
  },
  {
    id: "direct_shot_goal_label",
    category: "target_leakage",
    featureGroup: "shot_xg",
    tables: [],
    featureKeys: ["shotEventType:goal", "eventTypeDescKey:goal", "label_goal", "isGoal"],
    freshnessRequired: false,
    rationale: "These fields directly encode the shot-goal label.",
  },
  {
    id: "prediction_outputs",
    category: "target_leakage",
    featureGroup: "serving_outputs",
    tables: ["game_prediction_outputs", "player_prediction_outputs"],
    freshnessRequired: false,
    rationale: "Serving outputs are predictions/results, not upstream model features.",
  },
];

function cloneEntry(entry: FeatureLeakageRegistryEntry): FeatureLeakageRegistryEntry {
  return {
    ...entry,
    tables: [...entry.tables],
    featureKeys: entry.featureKeys ? [...entry.featureKeys] : undefined,
  };
}

function isCategoryAllowed(category: FeatureLeakageCategory, mode: FeatureUsageMode): boolean {
  if (category === "target_leakage" || category === "unknown") return false;
  if (mode === "pregame") {
    return category === "pregame_safe" || category === "pregame_safe_with_freshness";
  }
  if (mode === "in_game") {
    return (
      category === "pregame_safe" ||
      category === "pregame_safe_with_freshness" ||
      category === "in_game_only"
    );
  }
  if (mode === "training") {
    return true;
  }
  return true;
}

export function getFeatureLeakageRegistry(): FeatureLeakageRegistryEntry[] {
  return REGISTRY.map(cloneEntry);
}

export function getFeatureLeakageEntryById(id: string): FeatureLeakageRegistryEntry | null {
  const entry = REGISTRY.find((candidate) => candidate.id === id);
  return entry ? cloneEntry(entry) : null;
}

export function getFeatureLeakageEntriesByTable(tableName: string): FeatureLeakageRegistryEntry[] {
  return REGISTRY.filter((entry) => entry.tables.includes(tableName)).map(cloneEntry);
}

export function getFeatureLeakageEntriesByFeatureKey(
  featureKey: string
): FeatureLeakageRegistryEntry[] {
  return REGISTRY.filter((entry) => entry.featureKeys?.includes(featureKey)).map(cloneEntry);
}

export function validateFeatureLeakageUsage(args: {
  usageMode: FeatureUsageMode;
  featureIds?: string[];
  tableNames?: string[];
  featureKeys?: string[];
}): FeatureLeakageValidationReport {
  const entriesById = new Map<string, FeatureLeakageRegistryEntry>();
  const unknownFeatureIds: string[] = [];
  const unknownTables: string[] = [];

  for (const featureId of args.featureIds ?? []) {
    const entry = REGISTRY.find((candidate) => candidate.id === featureId);
    if (entry) entriesById.set(entry.id, entry);
    else unknownFeatureIds.push(featureId);
  }

  for (const tableName of args.tableNames ?? []) {
    const matches = REGISTRY.filter((entry) => entry.tables.includes(tableName));
    if (matches.length === 0) {
      unknownTables.push(tableName);
    } else {
      for (const entry of matches) entriesById.set(entry.id, entry);
    }
  }

  for (const featureKey of args.featureKeys ?? []) {
    const matches = REGISTRY.filter((entry) => entry.featureKeys?.includes(featureKey));
    if (matches.length === 0) continue;
    for (const entry of matches) entriesById.set(entry.id, entry);
  }

  const entries = Array.from(entriesById.values()).sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    if (!isCategoryAllowed(entry.category, args.usageMode)) {
      blockingReasons.push(`${entry.id}:${entry.category}_not_allowed_for_${args.usageMode}`);
    }
    if (entry.category === "pregame_safe_with_freshness") {
      warnings.push(`${entry.id}:requires_as_of_freshness_validation`);
    }
  }

  for (const featureId of unknownFeatureIds) {
    blockingReasons.push(`${featureId}:unregistered_feature_id`);
  }
  for (const tableName of unknownTables) {
    blockingReasons.push(`${tableName}:unregistered_table`);
  }

  return {
    passed: blockingReasons.length === 0,
    usageMode: args.usageMode,
    entries: entries.map(cloneEntry),
    blockingReasons,
    warnings,
    unknownFeatureIds,
    unknownTables,
  };
}

export function assertFeatureLeakageUsage(args: {
  usageMode: FeatureUsageMode;
  featureIds?: string[];
  tableNames?: string[];
  featureKeys?: string[];
}): FeatureLeakageValidationReport {
  const report = validateFeatureLeakageUsage(args);
  if (!report.passed) {
    throw new Error(`Feature leakage validation failed: ${report.blockingReasons.join(", ")}`);
  }
  return report;
}
