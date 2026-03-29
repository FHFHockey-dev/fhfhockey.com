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

export type RollingForgeDependencyContractStage = {
  id: RollingForgePipelineStageId;
  order: number;
  label: string;
  operatorSurface: string;
  routes: string[];
  depends_on: RollingForgePipelineStageId[];
  produces: string[];
  healthyRunRequirement: string;
};

export type RollingForgeDependencyContract = {
  version: string;
  summary: string;
  healthyRunRule: string;
  validationRule: string;
  falseHealthySignals: string[];
  stages: RollingForgeDependencyContractStage[];
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
      "/api/v1/db/update-power-play-combinations",
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
    label: "Projection Accuracy Refresh",
    modes: ["overnight", "daily_incremental"],
    operatorSurface: "projection accuracy refresh",
    routes: ["/api/v1/db/run-projection-accuracy"],
    produces: [
      "forge_projection_results",
      "forge_projection_accuracy_daily",
      "forge_projection_accuracy_player",
      "forge_projection_accuracy_stat_daily",
      "forge_projection_calibration_daily"
    ],
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
    version: "rolling-forge-pipeline-v3",
    stages: ROLLING_FORGE_PIPELINE_ORDER
  };
}

export function getRollingForgeStagesForMode(mode: RollingForgePipelineMode) {
  return ROLLING_FORGE_PIPELINE_ORDER.filter((stage) =>
    stage.modes.includes(mode)
  );
}

const DEPENDENCY_STAGE_REQUIREMENTS: Record<
  RollingForgePipelineStageId,
  string
> = {
  core_entity_freshness:
    "Games, teams, players, and rosters must refresh before any downstream freshness check is meaningful.",
  upstream_skater_sources:
    "NST and WGO skater-source tables must refresh before rolling_player_game_metrics is trusted.",
  contextual_builders:
    "Line and power-play context must refresh before rolling outputs or projection preflight are treated as healthy.",
  rolling_player_recompute:
    "rolling_player_game_metrics must be recomputed after both skater sources and contextual builders are fresh.",
  projection_input_ingest:
    "PBP and shift inputs must be ingested before projection-derived tables are rebuilt for the same window.",
  projection_derived_build:
    "Derived player, team, and goalie strength tables must be rebuilt after ingest and contextual refresh.",
  projection_execution:
    "Goalie start priors and FORGE projections are only healthy after rolling_player_game_metrics and derived tables are fresh for the same execution window.",
  downstream_projection_consumers:
    "Accuracy refresh only evaluates projection_execution outputs; it never repairs stale canonical projections.",
  monitoring:
    "Monitoring is diagnostic only and cannot make an otherwise stale run healthy."
};

export function getRollingForgeDependencyContract(): RollingForgeDependencyContract {
  return {
    version: "rolling-forge-operator-order-v1",
    summary:
      "Canonical rolling-to-FORGE dependency order for operator surfaces and preflight messaging.",
    healthyRunRule:
      "A healthy run requires each blocking stage to complete in order; success in a later stage does not excuse stale or skipped prerequisites.",
    validationRule:
      "Do not validate projections, dashboard readers, or downstream materializers until rolling_player_game_metrics, projection ingest, and projection-derived tables are all fresh for the intended date window.",
    falseHealthySignals: [
      "A successful rolling recompute does not imply projection ingest or derived tables are current.",
      "A successful ingest run does not imply rolling_player_game_metrics or contextual builders are fresh.",
      "A successful downstream accuracy refresh does not imply projection_execution used healthy upstream inputs."
    ],
    stages: ROLLING_FORGE_PIPELINE_ORDER.map((stage) => ({
      id: stage.id,
      order: stage.order,
      label: stage.label,
      operatorSurface: stage.operatorSurface,
      routes: stage.routes,
      depends_on: stage.depends_on,
      produces: stage.produces,
      healthyRunRequirement: DEPENDENCY_STAGE_REQUIREMENTS[stage.id]
    }))
  };
}

export function getRollingForgeStageDependencyContract(
  stageId: RollingForgePipelineStageId
) {
  const contract = getRollingForgeDependencyContract();
  const stage = contract.stages.find((entry) => entry.id === stageId);
  if (!stage) {
    throw new Error(`Unknown rolling-forge stage: ${stageId}`);
  }

  return {
    version: contract.version,
    summary: contract.summary,
    healthyRunRule: contract.healthyRunRule,
    validationRule: contract.validationRule,
    falseHealthySignals: contract.falseHealthySignals,
    currentStage: stage,
    prerequisiteStages: contract.stages.filter((entry) =>
      stage.depends_on.includes(entry.id)
    ),
    downstreamStages: contract.stages.filter((entry) =>
      entry.depends_on.includes(stage.id)
    )
  };
}
