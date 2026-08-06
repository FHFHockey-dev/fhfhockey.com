export type GoaliePipelineStageId =
  | "core_roster_schedule"
  | "line_combinations"
  | "projection_input_ingest"
  | "projection_relationship_build"
  | "projection_derived_v2"
  | "goalie_start_priors_v2"
  | "projection_run_v2"
  | "projection_accuracy";

export type GoaliePipelineStage = {
  id: GoaliePipelineStageId;
  order: number;
  label: string;
  endpoint: string;
  produces: string[];
  depends_on: GoaliePipelineStageId[];
};

export const GOALIE_FORGE_PIPELINE_ORDER: GoaliePipelineStage[] = [
  {
    id: "core_roster_schedule",
    order: 1,
    label: "Games/Teams/Players Freshness",
    endpoint: "/api/v1/db/update-games + /api/v1/db/update-teams + /api/v1/db/update-players",
    produces: ["games", "teams", "players"],
    depends_on: []
  },
  {
    id: "line_combinations",
    order: 2,
    label: "Line Combinations",
    endpoint: "/api/v1/db/update-line-combinations",
    produces: ["lineCombinations"],
    depends_on: ["core_roster_schedule"]
  },
  {
    id: "projection_input_ingest",
    order: 3,
    label: "Projection Input Ingest (PbP + Shifts)",
    endpoint: "/api/v1/db/ingest-projection-inputs",
    produces: ["pbp_games", "pbp_plays", "shift_charts"],
    depends_on: ["line_combinations"]
  },
  {
    id: "projection_relationship_build",
    order: 4,
    label: "Build Projection Relationships",
    endpoint: "/api/v1/db/shift-charts",
    produces: ["shift_charts relationship-owned columns"],
    depends_on: ["projection_input_ingest"]
  },
  {
    id: "projection_derived_v2",
    order: 5,
    label: "Build Derived Projection Inputs",
    endpoint: "/api/v1/db/build-projection-derived-v2",
    produces: [
      "forge_player_game_strength",
      "forge_team_game_strength",
      "forge_goalie_game"
    ],
    depends_on: ["projection_relationship_build"]
  },
  {
    id: "goalie_start_priors_v2",
    order: 6,
    label: "Goalie Start Priors",
    endpoint: "/api/v1/db/update-goalie-projections-v2",
    produces: ["goalie_start_projections"],
    depends_on: ["projection_derived_v2"]
  },
  {
    id: "projection_run_v2",
    order: 7,
    label: "Run FORGE Projections",
    endpoint: "/api/v1/db/run-projection-v2",
    produces: [
      "forge_runs",
      "forge_player_projections",
      "forge_team_projections",
      "forge_goalie_projections"
    ],
    depends_on: ["goalie_start_priors_v2"]
  },
  {
    id: "projection_accuracy",
    order: 8,
    label: "Run Accuracy + Calibration",
    endpoint: "/api/v1/db/run-projection-accuracy",
    produces: [
      "forge_projection_results",
      "forge_projection_accuracy_daily",
      "forge_projection_accuracy_player",
      "forge_projection_accuracy_stat_daily",
      "forge_projection_calibration_daily"
    ],
    depends_on: ["projection_run_v2"]
  }
];

export function getGoalieForgePipelineSpec() {
  return {
    version: "goalie-forge-pipeline-v2",
    stages: GOALIE_FORGE_PIPELINE_ORDER
  };
}
