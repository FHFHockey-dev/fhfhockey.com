export type FeatureSourceUse =
  | "required"
  | "optional"
  | "current_only"
  | "serving_only"
  | "excluded";

export type AsOfRule =
  | "identity"
  | "strict_before_game_date"
  | "strict_before_start_time"
  | "current_prediction_only"
  | "serving_only";

export type GamePredictionFeatureSource = {
  id: string;
  tables: string[];
  featureGroup: string;
  use: FeatureSourceUse;
  asOfRule: AsOfRule;
  fallback: string;
  goNoGo: "go" | "go_with_caveat" | "limited" | "no_go";
};

export const GAME_PREDICTION_FEATURE_SET_VERSION = "game_features_v2";

export const GAME_PREDICTION_FEATURE_SOURCES: GamePredictionFeatureSource[] = [
  {
    id: "schedule_identity",
    tables: ["games", "teams", "seasons"],
    featureGroup: "schedule",
    use: "required",
    asOfRule: "identity",
    fallback: "Prediction unavailable if game or team identity is missing.",
    goNoGo: "go",
  },
  {
    id: "team_power",
    tables: ["team_power_ratings_daily"],
    featureGroup: "team_strength",
    use: "required",
    asOfRule: "strict_before_game_date",
    fallback: "Use wider lookback or preseason/team prior.",
    goNoGo: "go_with_caveat",
  },
  {
    id: "nst_team_gamelogs",
    tables: [
      "nst_team_gamelogs_as_counts",
      "nst_team_gamelogs_as_rates",
      "nst_team_gamelogs_pp_counts",
      "nst_team_gamelogs_pp_rates",
      "nst_team_gamelogs_pk_counts",
      "nst_team_gamelogs_pk_rates",
    ],
    featureGroup: "team_underlying",
    use: "optional",
    asOfRule: "strict_before_game_date",
    fallback: "Drop stale or missing NST features and rely on team power/WGO.",
    goNoGo: "go_with_caveat",
  },
  {
    id: "wgo_team_stats",
    tables: ["wgo_team_stats"],
    featureGroup: "team_form",
    use: "optional",
    asOfRule: "strict_before_game_date",
    fallback: "Use team power and standings when WGO rows are missing or unmapped.",
    goNoGo: "go_with_caveat",
  },
  {
    id: "standings",
    tables: ["nhl_standings_details"],
    featureGroup: "standings",
    use: "optional",
    asOfRule: "strict_before_game_date",
    fallback: "Drop stale or missing standings split fields.",
    goNoGo: "go",
  },
  {
    id: "goalie_starts",
    tables: ["goalie_start_projections"],
    featureGroup: "goalie",
    use: "required",
    asOfRule: "current_prediction_only",
    fallback: "Blend likely starters or fall back to team-level goalie strength.",
    goNoGo: "go_with_caveat",
  },
  {
    id: "goalie_quality",
    tables: [
      "wgo_goalie_stats",
      "vw_goalie_stats_unified",
      "nst_gamelog_goalie_all_counts",
      "nst_gamelog_goalie_all_rates",
      "nst_gamelog_goalie_5v5_counts",
      "nst_gamelog_goalie_5v5_rates",
      "nst_gamelog_goalie_ev_counts",
      "nst_gamelog_goalie_ev_rates",
      "nst_gamelog_goalie_pp_counts",
      "nst_gamelog_goalie_pp_rates",
      "nst_gamelog_goalie_pk_counts",
      "nst_gamelog_goalie_pk_rates",
    ],
    featureGroup: "goalie",
    use: "optional",
    asOfRule: "strict_before_game_date",
    fallback: "Use starter projection only or team-level goalie strength.",
    goNoGo: "go_with_caveat",
  },
  {
    id: "lineups",
    tables: ["lineCombinations", "lines_nhl", "lines_dfo", "lines_gdl", "lines_ccc"],
    featureGroup: "lineup_context",
    use: "current_only",
    asOfRule: "strict_before_start_time",
    fallback: "Omit lineup features and do not block game-level prediction.",
    goNoGo: "limited",
  },
  {
    id: "forge_projections",
    tables: ["forge_player_projections", "forge_goalie_projections", "forge_team_projections"],
    featureGroup: "optional_projection_context",
    use: "current_only",
    asOfRule: "current_prediction_only",
    fallback: "Omit FORGE context.",
    goNoGo: "limited",
  },
  {
    id: "latest_team_display_view",
    tables: ["nhl_team_data"],
    featureGroup: "excluded_training_source",
    use: "excluded",
    asOfRule: "current_prediction_only",
    fallback: "Use dated source tables instead.",
    goNoGo: "no_go",
  },
  {
    id: "prediction_serving",
    tables: ["game_prediction_outputs", "player_prediction_outputs"],
    featureGroup: "serving",
    use: "serving_only",
    asOfRule: "serving_only",
    fallback: "Use append-only history for evaluation.",
    goNoGo: "limited",
  },
];

export function getGamePredictionFeatureSources(): GamePredictionFeatureSource[] {
  return GAME_PREDICTION_FEATURE_SOURCES.map((source) => ({ ...source }));
}

export function getFeatureSourceByTable(tableName: string): GamePredictionFeatureSource | null {
  return (
    GAME_PREDICTION_FEATURE_SOURCES.find((source) => source.tables.includes(tableName)) ?? null
  );
}
