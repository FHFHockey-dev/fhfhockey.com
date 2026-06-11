import {
  assertFeatureLeakageUsage,
  type FeatureLeakageValidationReport,
} from "lib/ml/featureLeakageRegistry";

export type NhlEdgeFeatureEntity =
  | "skater"
  | "team"
  | "goalie"
  | "skater_game"
  | "team_game"
  | "skater_shot_location_leader";
export type NhlEdgeFeatureAvailability = "pregame_safe_with_freshness";

export type NhlEdgeFeatureContract = {
  id: string;
  entity: NhlEdgeFeatureEntity;
  table: string;
  latestView: string | null;
  grain: string[];
  seasonScoped: boolean;
  gameTypeScoped: boolean;
  freshnessRule: "snapshot_date_lte_as_of_date";
  availability: NhlEdgeFeatureAvailability;
  modelUse: "allowed_with_as_of_join" | "display_or_leaderboard_only";
  fields: string[];
};

export type NhlEdgeFeatureJoinPlan = {
  contract: NhlEdgeFeatureContract;
  entity: NhlEdgeFeatureEntity;
  table: string;
  latestView: string | null;
  joinKeys: string[];
  requiredFilters: {
    season_id: number;
    game_type: number;
    snapshot_date_lte: string;
  };
  leakage: FeatureLeakageValidationReport;
};

const CONTRACTS: NhlEdgeFeatureContract[] = [
  {
    id: "edge_skater_metrics_daily",
    entity: "skater",
    table: "nhl_edge_skater_metrics_daily",
    latestView: "analytics.vw_nhl_edge_latest_skater_metrics",
    grain: ["snapshot_date", "season_id", "game_type", "player_id"],
    seasonScoped: true,
    gameTypeScoped: true,
    freshnessRule: "snapshot_date_lte_as_of_date",
    availability: "pregame_safe_with_freshness",
    modelUse: "allowed_with_as_of_join",
    fields: [
      "top_shot_speed_mph",
      "top_shot_speed_percentile",
      "max_skating_speed_mph",
      "max_skating_speed_percentile",
      "bursts_over_20",
      "bursts_over_20_percentile",
      "total_distance_miles",
      "total_distance_percentile",
      "max_game_distance_miles",
      "all_shots",
      "high_danger_shots",
      "mid_range_shots",
      "long_range_shots",
      "offensive_zone_pct",
      "offensive_zone_ev_pct",
      "neutral_zone_pct",
      "defensive_zone_pct",
    ],
  },
  {
    id: "edge_team_metrics_daily",
    entity: "team",
    table: "nhl_edge_team_metrics_daily",
    latestView: "analytics.vw_nhl_edge_latest_team_metrics",
    grain: ["snapshot_date", "season_id", "game_type", "team_id"],
    seasonScoped: true,
    gameTypeScoped: true,
    freshnessRule: "snapshot_date_lte_as_of_date",
    availability: "pregame_safe_with_freshness",
    modelUse: "allowed_with_as_of_join",
    fields: [
      "shot_attempts_over_90",
      "top_shot_speed_mph",
      "bursts_over_22",
      "bursts_over_20",
      "max_skating_speed_mph",
      "total_distance_miles",
      "all_shots",
      "high_danger_shots",
      "mid_range_shots",
      "long_range_shots",
      "offensive_zone_pct",
      "offensive_zone_ev_pct",
      "neutral_zone_pct",
      "defensive_zone_pct",
    ],
  },
  {
    id: "edge_goalie_metrics_daily",
    entity: "goalie",
    table: "nhl_edge_goalie_metrics_daily",
    latestView: "analytics.vw_nhl_edge_latest_goalie_metrics",
    grain: ["snapshot_date", "season_id", "game_type", "goalie_id"],
    seasonScoped: true,
    gameTypeScoped: true,
    freshnessRule: "snapshot_date_lte_as_of_date",
    availability: "pregame_safe_with_freshness",
    modelUse: "allowed_with_as_of_join",
    fields: [
      "edge_goals_against_avg",
      "edge_goals_against_avg_percentile",
      "games_above_900",
      "games_above_900_percentile",
      "goal_differential_per_60",
      "goal_differential_per_60_percentile",
      "goal_support_avg",
      "goal_support_avg_percentile",
      "point_pct",
      "point_pct_percentile",
      "all_save_pct",
      "high_danger_save_pct",
      "mid_range_save_pct",
      "long_range_save_pct",
    ],
  },
  {
    id: "edge_skater_shot_location_leaders_daily",
    entity: "skater_shot_location_leader",
    table: "nhl_edge_skater_shot_location_leaders_daily",
    latestView: null,
    grain: ["snapshot_date", "season_id", "game_type", "metric_key", "rank_order", "player_id"],
    seasonScoped: true,
    gameTypeScoped: true,
    freshnessRule: "snapshot_date_lte_as_of_date",
    availability: "pregame_safe_with_freshness",
    modelUse: "display_or_leaderboard_only",
    fields: ["all_value", "high_danger_value", "mid_range_value", "long_range_value"],
  },
  {
    id: "edge_skater_skating_distance_games_daily",
    entity: "skater_game",
    table: "nhl_edge_skater_skating_distance_games_daily",
    latestView: "analytics.vw_nhl_edge_latest_skater_skating_distance_games",
    grain: ["snapshot_date", "season_id", "game_type", "player_id", "game_id"],
    seasonScoped: true,
    gameTypeScoped: true,
    freshnessRule: "snapshot_date_lte_as_of_date",
    availability: "pregame_safe_with_freshness",
    modelUse: "allowed_with_as_of_join",
    fields: [
      "toi_all_seconds",
      "distance_skated_all_miles",
      "distance_skated_all_km",
      "toi_even_seconds",
      "distance_skated_even_miles",
      "toi_pp_seconds",
      "distance_skated_pp_miles",
      "toi_pk_seconds",
      "distance_skated_pk_miles",
    ],
  },
  {
    id: "edge_team_skating_distance_games_daily",
    entity: "team_game",
    table: "nhl_edge_team_skating_distance_games_daily",
    latestView: "analytics.vw_nhl_edge_latest_team_skating_distance_games",
    grain: ["snapshot_date", "season_id", "game_type", "team_id", "game_id"],
    seasonScoped: true,
    gameTypeScoped: true,
    freshnessRule: "snapshot_date_lte_as_of_date",
    availability: "pregame_safe_with_freshness",
    modelUse: "allowed_with_as_of_join",
    fields: [
      "toi_all_seconds",
      "distance_skated_all_miles",
      "distance_skated_all_km",
      "toi_even_seconds",
      "distance_skated_even_miles",
      "toi_pp_seconds",
      "distance_skated_pp_miles",
      "toi_pk_seconds",
      "distance_skated_pk_miles",
    ],
  },
];

function cloneContract(contract: NhlEdgeFeatureContract): NhlEdgeFeatureContract {
  return {
    ...contract,
    grain: [...contract.grain],
    fields: [...contract.fields],
  };
}

export function getNhlEdgeFeatureContracts(): NhlEdgeFeatureContract[] {
  return CONTRACTS.map(cloneContract);
}

export function getNhlEdgeFeatureContractByEntity(
  entity: NhlEdgeFeatureEntity
): NhlEdgeFeatureContract | null {
  const contract = CONTRACTS.find((candidate) => candidate.entity === entity) ?? null;
  return contract ? cloneContract(contract) : null;
}

export function buildNhlEdgeFeatureJoinPlan(args: {
  entity: Exclude<NhlEdgeFeatureEntity, "skater_shot_location_leader">;
  seasonId: number;
  gameType: number;
  asOfDate: string;
}): NhlEdgeFeatureJoinPlan {
  const contract = getNhlEdgeFeatureContractByEntity(args.entity);
  if (!contract || contract.modelUse !== "allowed_with_as_of_join") {
    throw new Error(`No model-usable NHL EDGE feature contract for entity=${args.entity}.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.asOfDate)) {
    throw new Error("NHL EDGE feature join requires asOfDate in YYYY-MM-DD format.");
  }

  const leakage = assertFeatureLeakageUsage({
    usageMode: "pregame",
    tableNames: [contract.table],
  });

  return {
    contract,
    entity: args.entity,
    table: contract.table,
    latestView: contract.latestView,
    joinKeys: contract.grain.filter((key) => !["snapshot_date", "season_id", "game_type"].includes(key)),
    requiredFilters: {
      season_id: args.seasonId,
      game_type: args.gameType,
      snapshot_date_lte: args.asOfDate,
    },
    leakage,
  };
}

export function validateNhlEdgeSnapshotFreshness(args: {
  snapshotDate: string | null;
  asOfDate: string;
  maxAgeDays?: number;
}): { passed: boolean; ageDays: number | null; blockingReasons: string[] } {
  const maxAgeDays = args.maxAgeDays ?? 14;
  const blockingReasons: string[] = [];
  if (!args.snapshotDate) {
    return { passed: false, ageDays: null, blockingReasons: ["missing_edge_snapshot_date"] };
  }

  const snapshot = Date.parse(`${args.snapshotDate}T00:00:00.000Z`);
  const asOf = Date.parse(`${args.asOfDate}T00:00:00.000Z`);
  if (!Number.isFinite(snapshot) || !Number.isFinite(asOf)) {
    return { passed: false, ageDays: null, blockingReasons: ["invalid_edge_snapshot_date"] };
  }

  const ageDays = Math.floor((asOf - snapshot) / 86400000);
  if (ageDays < 0) blockingReasons.push("edge_snapshot_after_as_of_date");
  if (ageDays > maxAgeDays) blockingReasons.push("edge_snapshot_stale");

  return {
    passed: blockingReasons.length === 0,
    ageDays,
    blockingReasons,
  };
}
