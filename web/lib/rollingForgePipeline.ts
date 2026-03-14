import type { RollingForgePipelineMode } from "./rollingPlayerOperationalPolicy";

export type RollingForgePipelineStageId =
  | "core_entity_freshness"
  | "upstream_skater_sources"
  | "contextual_builders"
  | "rolling_player_recompute"
  | "projection_input_ingest"
  | "projection_derived_build"
  | "projection_execution"
  | "downstream_projection_consumers"
  | "monitoring";

export type RollingForgePipelineStage = {
  id: RollingForgePipelineStageId;
  order: number;
  label: string;
  modes: RollingForgePipelineMode[];
  operatorSurface: string;
  routes: string[];
  produces: string[];
  depends_on: RollingForgePipelineStageId[];
  skippableInDaily: boolean;
  blocking: boolean;
};

export const ROLLING_FORGE_PIPELINE_ORDER: RollingForgePipelineStage[] = [
  {
    id: "core_entity_freshness",
    order: 1,
    label: "Core Entity Freshness",
    modes: ["overnight", "daily_incremental", "targeted_repair"],
    operatorSurface: "upstream entity freshness",
    routes: [
      "/api/v1/db/update-games",
      "/api/v1/db/update-teams",
      "/api/v1/db/update-players"
    ],
    produces: ["games", "teams", "players", "rosters"],
    depends_on: [],
    skippableInDaily: true,
    blocking: true
  },
  {
    id: "upstream_skater_sources",
    order: 2,
    label: "Upstream Skater Sources",
    modes: ["overnight", "daily_incremental", "targeted_repair"],
    operatorSurface: "upstream skater-source freshness",
    routes: [
      "/api/v1/db/update-nst-gamelog",
      "/api/v1/db/update-wgo-skaters",
      "/api/v1/db/update-wgo-totals",
      "/api/v1/db/update-wgo-averages",
      "/api/v1/db/update-wgo-ly"
    ],
    produces: ["nst_gamelog_*", "wgo_skater_stats", "wgo_support_tables"],
    depends_on: ["core_entity_freshness"],
    skippableInDaily: false,
    blocking: true
  },
  {
    id: "contextual_builders",
    order: 3,
    label: "Contextual Builders",
    modes: ["overnight", "daily_incremental", "targeted_repair"],
    operatorSurface: "contextual-builder freshness",
    routes: [
      "/api/v1/db/update-line-combinations",
      "/api/v1/db/update-power-play-combinations/[gameId]"
    ],
    produces: ["lineCombinations", "powerPlayCombinations"],
    depends_on: ["core_entity_freshness"],
    skippableInDaily: false,
    blocking: true
  },
  {
    id: "rolling_player_recompute",
    order: 4,
    label: "Rolling Player Recompute",
    modes: ["overnight", "daily_incremental", "targeted_repair"],
    operatorSurface: "rolling-player recompute",
    routes: ["/api/v1/db/update-rolling-player-averages"],
    produces: ["rolling_player_game_metrics"],
    depends_on: ["upstream_skater_sources", "contextual_builders"],
    skippableInDaily: false,
    blocking: true
  },
  {
    id: "projection_input_ingest",
    order: 5,
    label: "Projection Input Ingest",
    modes: ["overnight", "daily_incremental"],
    operatorSurface: "projection-input ingest",
    routes: ["/api/v1/db/ingest-projection-inputs"],
    produces: ["pbp_games", "pbp_plays", "shift_charts"],
    depends_on: ["core_entity_freshness"],
    skippableInDaily: false,
    blocking: true
  },
  {
    id: "projection_derived_build",
    order: 6,
    label: "Projection Derived Build",
    modes: ["overnight", "daily_incremental"],
    operatorSurface: "projection-derived build",
    routes: ["/api/v1/db/build-projection-derived-v2"],
    produces: [
      "forge_player_game_strength",
      "forge_team_game_strength",
      "forge_goalie_game"
    ],
    depends_on: ["projection_input_ingest", "contextual_builders"],
    skippableInDaily: false,
    blocking: true
  },
  {
    id: "projection_execution",
    order: 7,
    label: "Projection Execution",
    modes: ["overnight", "daily_incremental"],
    operatorSurface: "projection execution",
    routes: [
      "/api/v1/db/update-goalie-projections-v2",
      "/api/v1/db/run-projection-v2"
    ],
    produces: [
      "goalie_start_projections",
      "forge_runs",
      "forge_player_projections",
      "forge_team_projections",
      "forge_goalie_projections"
    ],
    depends_on: ["rolling_player_recompute", "projection_derived_build"],
    skippableInDaily: false,
    blocking: true
  },
  {
    id: "downstream_projection_consumers",
    order: 8,
    label: "Downstream Projection Consumers",
    modes: ["overnight", "daily_incremental"],
    operatorSurface: "downstream consumer refresh",
    routes: [
      "/api/v1/db/update-start-chart-projections",
      "/api/v1/db/run-projection-accuracy"
    ],
    produces: ["start_chart_projections", "projection_accuracy_tables"],
    depends_on: ["projection_execution"],
    skippableInDaily: true,
    blocking: false
  },
  {
    id: "monitoring",
    order: 9,
    label: "Monitoring",
    modes: ["overnight", "daily_incremental", "targeted_repair"],
    operatorSurface: "monitoring",
    routes: ["/api/v1/db/cron-report"],
    produces: ["cron_job_audit_report"],
    depends_on: ["projection_execution", "downstream_projection_consumers"],
    skippableInDaily: true,
    blocking: false
  }
];

export function getRollingForgePipelineSpec() {
  return {
    version: "rolling-forge-pipeline-v1",
    stages: ROLLING_FORGE_PIPELINE_ORDER
  };
}

export function getRollingForgeStagesForMode(mode: RollingForgePipelineMode) {
  return ROLLING_FORGE_PIPELINE_ORDER.filter((stage) =>
    stage.modes.includes(mode)
  );
}
