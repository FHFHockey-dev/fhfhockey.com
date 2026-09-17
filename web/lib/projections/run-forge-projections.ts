import supabase from "lib/supabase/server";
import { resolveNullableCompatibilityValue } from "lib/rollingPlayerMetricCompatibility";
import { buildForgeInputProvenance } from "lib/projections/calibrationEligibility";
import { fetchRecentTeamLineCombinations } from "lib/projections/queries/line-combo-queries";
import { hasCompleteStoredPbpGame } from "lib/projections/pbpCompletenessServer";
import { classifyStoredShiftChartStrengthGame } from "lib/projections/shiftChartCompletenessServer";
// This file is the canonical projection runner that replaced the removed
// runProjectionV2 shim. Keep cleanup inventory updates alongside
// lib/projections/compatibilityInventory.ts so surviving compatibility surfaces
// stay explicit while transitional routes are retired.
import { reconcileTeamToPlayers } from "lib/projections/reconcile";
import {
  buildGoalieUncertainty,
  buildPlayerUncertainty,
  buildTeamUncertainty,
} from "lib/projections/uncertainty";
import {
  resolveSkaterRolloutConfig,
  selectSkaterRolloutScenarioMixture,
  selectSkaterRolloutStatLine,
} from "lib/projections/skaterRollout";
import {
  computeGoalieProjectionModel,
  type GoalieEvidence,
} from "lib/projections/goalieModel";
import type {
  GameRow,
  ForgeTeamGameStrengthRow,
  GoalieGameHistoryRow,
  GoalieRestSplitBucket,
  GoalieRestSplitProfile,
  GoalieWorkloadContext,
  LineCombinationContext,
  LineCombinationWithGameDateRow,
  LineCombinationRow,
  OpponentGoalieContext,
  PlayerTeamPositionRow,
  ReconciledSkaterVector,
  ReconciliationDistributionValidation,
  RollingSkaterMetricRow,
  RosterPlayerIdRow,
  RollingRow,
  RosterEventRow,
  RunProjectionOptions,
  RunProjectionResult,
  SkaterOnIceContextProfile,
  SkaterPpOpportunityAllocation,
  SkaterRestScheduleAdjustment,
  SkaterRoleBoundedUsage,
  SkaterRoleScenario,
  SkaterSampleShrinkageAdjustment,
  SkaterScenarioHorizonBlendResult,
  SkaterScenarioMetadata,
  SkaterScenarioStatLine,
  SkaterShotQualityProfile,
  SkaterTeamLevelContextAdjustment,
  SkaterTeammateAssistCoupling,
  SkaterTrendAdjustment,
  StarterScenario,
  StarterScenarioProjection,
  TeamDefensiveEnvironment,
  TeamFiveOnFiveProfile,
  TeamGoalieStarterContext,
  TeamNstExpectedGoalsProfile,
  TeamOffenseEnvironment,
  TeamStrengthPrior,
  WgoSkaterDeploymentProfile,
  ProjectionTotals,
} from "./types/run-forge-projections.types";
import {
  GOALIE_STALE_SOFT_DAYS,
  GOALIE_STALE_HARD_DAYS,
  SKATER_STALE_SOFT_DAYS,
  SKATER_STALE_HARD_DAYS,
  SKATER_SOFT_STALE_MIN_MULTIPLIER,
  LINE_COMBO_STALE_SOFT_DAYS,
  LINE_COMBO_STALE_HARD_DAYS,
  SKATER_ROLE_HISTORY_WINDOW_GAMES,
  B2B_REPEAT_STARTER_PENALTY,
  B2B_ALTERNATE_GOALIE_BOOST,
  TEAM_STRENGTH_WEAKER_GAP,
  WEAK_OPPONENT_GF_THRESHOLD,
  WEAKER_TEAM_B2B_PRIMARY_PENALTY,
  WEAKER_TEAM_B2B_BACKUP_BOOST,
  WEAK_OPPONENT_PRIMARY_REST_PENALTY,
  WEAK_OPPONENT_BACKUP_BOOST,
  LINE_COMBO_RECENCY_DECAY,
  LINE_COMBO_PRIOR_LOGIT_WEIGHT,
  GOALIE_GSAA_PRIOR_MAX_ABS,
  GOALIE_GSAA_PRIOR_WEIGHT,
  GOALIE_SEASON_START_PCT_WEIGHT,
  GOALIE_SEASON_START_PCT_BASELINE,
  GOALIE_SEASON_GAMES_PLAYED_WEIGHT,
  OPPONENT_RESTED_BOOST,
  OPPONENT_B2B_PENALTY,
  DEFENSE_B2B_FATIGUE_BOOST,
  OPPONENT_HOME_BOOST,
  OPPONENT_AWAY_PENALTY,
  GOALIE_HEAVY_WORKLOAD_PENALTY,
  GOALIE_VERY_HEAVY_WORKLOAD_PENALTY,
  GOALIE_BACK_TO_BACK_PENALTY,
  GOALIE_REST_SPLIT_MIN_GAMES,
  GOALIE_REST_SPLIT_MAX_ADJUSTMENT,
  TEAM_XG_BASELINE_PER_GAME,
  TEAM_XG_SHOTS_AGAINST_MAX_PCT,
  TEAM_XG_WIN_CONTEXT_MAX_PCT,
  TEAM_5V5_SAVE_PCT_BASELINE,
  TEAM_5V5_PDO_BASELINE,
  TEAM_5V5_MIN_SAMPLE_GAMES,
  TEAM_5V5_MAX_LEAGUE_SAVE_PCT_ADJ,
  TEAM_5V5_MAX_CONTEXT_PCT_ADJ,
  TEAM_NST_XGA_PER60_BASELINE,
  TEAM_NST_MAX_CONTEXT_PCT_ADJ,
  MAX_SUPPORTED_HORIZON_GAMES,
  HORIZON_DECAY_PER_GAME,
  HORIZON_B2B_PENALTY,
  HORIZON_ZERO_REST_PENALTY,
  HORIZON_LONG_REST_BOOST,
  SKATER_IXG_PER_SHOT_BASELINE,
  SKATER_RUSH_REBOUND_PER60_BASELINE,
  SKATER_SHOT_QUALITY_MIN_MULTIPLIER,
  SKATER_SHOT_QUALITY_MAX_MULTIPLIER,
  SKATER_CONVERSION_MIN_MULTIPLIER,
  SKATER_CONVERSION_MAX_MULTIPLIER,
  SKATER_ON_ICE_XG_PER60_BASELINE,
  SKATER_ON_ICE_POSSESSION_BASELINE,
  SKATER_ON_ICE_SHOT_ENV_MIN_MULTIPLIER,
  SKATER_ON_ICE_SHOT_ENV_MAX_MULTIPLIER,
  SKATER_ON_ICE_GOAL_ENV_MIN_MULTIPLIER,
  SKATER_ON_ICE_GOAL_ENV_MAX_MULTIPLIER,
  SKATER_ON_ICE_ASSIST_ENV_MIN_MULTIPLIER,
  SKATER_ON_ICE_ASSIST_ENV_MAX_MULTIPLIER,
  SKATER_TEAM_LEVEL_SHOT_MIN_MULTIPLIER,
  SKATER_TEAM_LEVEL_SHOT_MAX_MULTIPLIER,
  SKATER_TEAM_LEVEL_GOAL_MIN_MULTIPLIER,
  SKATER_TEAM_LEVEL_GOAL_MAX_MULTIPLIER,
  SKATER_TEAM_LEVEL_ASSIST_MIN_MULTIPLIER,
  SKATER_TEAM_LEVEL_ASSIST_MAX_MULTIPLIER,
  SKATER_OPP_GOALIE_GOAL_MIN_MULTIPLIER,
  SKATER_OPP_GOALIE_GOAL_MAX_MULTIPLIER,
  SKATER_OPP_GOALIE_ASSIST_MIN_MULTIPLIER,
  SKATER_OPP_GOALIE_ASSIST_MAX_MULTIPLIER,
  SKATER_REST_TOI_MIN_MULTIPLIER,
  SKATER_REST_TOI_MAX_MULTIPLIER,
  SKATER_REST_SHOT_MIN_MULTIPLIER,
  SKATER_REST_SHOT_MAX_MULTIPLIER,
  SKATER_REST_GOAL_MIN_MULTIPLIER,
  SKATER_REST_GOAL_MAX_MULTIPLIER,
  SKATER_REST_ASSIST_MIN_MULTIPLIER,
  SKATER_REST_ASSIST_MAX_MULTIPLIER,
  SKATER_SMALL_SAMPLE_TOI_SECONDS_SCALE,
  SKATER_SMALL_SAMPLE_SHOTS_SCALE,
  SKATER_SMALL_SAMPLE_LOW_WEIGHT_THRESHOLD,
  SKATER_SMALL_SAMPLE_CALLUP_WEIGHT_THRESHOLD,
  SKATER_TEAMMATE_ASSIST_ES_MIN_MULTIPLIER,
  SKATER_TEAMMATE_ASSIST_ES_MAX_MULTIPLIER,
  SKATER_TEAMMATE_ASSIST_PP_MIN_MULTIPLIER,
  SKATER_TEAMMATE_ASSIST_PP_MAX_MULTIPLIER,
  SKATER_ROLE_TOP_TOI_ES_MIN,
  SKATER_ROLE_TOP_TOI_ES_MAX,
  SKATER_ROLE_TOP_TOI_PP_MIN,
  SKATER_ROLE_TOP_TOI_PP_MAX,
  SKATER_ROLE_MIDDLE_TOI_ES_MIN,
  SKATER_ROLE_MIDDLE_TOI_ES_MAX,
  SKATER_ROLE_MIDDLE_TOI_PP_MIN,
  SKATER_ROLE_MIDDLE_TOI_PP_MAX,
  SKATER_ROLE_DEPTH_TOI_ES_MIN,
  SKATER_ROLE_DEPTH_TOI_ES_MAX,
  SKATER_ROLE_DEPTH_TOI_PP_MIN,
  SKATER_ROLE_DEPTH_TOI_PP_MAX,
  SKATER_ROLE_TOP_SOG_ES_MAX,
  SKATER_ROLE_TOP_SOG_PP_MAX,
  SKATER_ROLE_MIDDLE_SOG_ES_MAX,
  SKATER_ROLE_MIDDLE_SOG_PP_MAX,
  SKATER_ROLE_DEPTH_SOG_ES_MAX,
  SKATER_ROLE_DEPTH_SOG_PP_MAX,
  RECON_TOP_ES_SHARE_MAX,
  RECON_TOP_PP_SHARE_MAX,
  RECON_BLEND_TO_BASELINE,
  ROLE_SCENARIO_REVERSION_PER_GAME,
  ROLE_SCENARIO_VOLATILE_REVERSION_BONUS,
  SKATER_POOL_TARGET_COUNT,
  SKATER_POOL_MIN_VALID_COUNT,
  SKATER_POOL_SUPPLEMENTAL_FETCH_COUNT,
  SKATER_POOL_EMERGENCY_MAX_SINGLE_TOI_SECONDS,
  SKATER_POOL_EMERGENCY_MAX_AVG_TOI_SECONDS,
} from "./constants/projection-weights";
import {
  blendOnlineRate,
  clamp,
  computeRate,
  computeShotsFromRate,
  finiteOrNull,
  safeNumber,
  safeStdDev,
  sigmoid,
} from "./utils/number-utils";
import {
  buildSequentialHorizonScalarsFromDates,
  clampHorizonGames,
  daysBetweenDates,
  parseDateOnly,
} from "./utils/date-utils";
import {
  pickLatestByPlayer,
  toFiniteNumberArray,
} from "./utils/collection-utils";
import {
  augmentStarterModelMetaWithScenarioProjections,
  buildGoalieUncertaintyWithModel,
  buildSkaterUncertaintyWithModel,
  buildStarterHeuristicMetadata,
  buildStarterOverrideMetadata,
} from "./utils/projection-metadata-builders";
import {
  fetchLatestSkaterOnIceContextProfiles,
  fetchLatestSkaterShotQualityProfiles,
  fetchLatestSkaterTrendAdjustments,
  fetchLatestWgoSkaterDeploymentProfiles,
  fetchRollingRows,
} from "./queries/skater-queries";
import { type MarketTypeSummary } from "./queries/market-queries";
import {
  fetchCurrentTeamGoalieIds,
  fetchGoalieEvidence,
  fetchGoalieRestSplitProfile,
  fetchGoalieWorkloadContext,
  fetchLatestGoalieForTeam,
  fetchOpponentGoalieContextForGame,
  fetchTeamGoalieStarterContext,
  fetchTeamLineComboGoaliePrior,
} from "./queries/goalie-queries";
import {
  fetchTeamDefensiveEnvironment,
  fetchTeamFiveOnFiveProfile,
  fetchTeamNstExpectedGoalsProfile,
  fetchTeamOffenseEnvironment,
  fetchTeamRestDays,
  fetchTeamStrengthAverages,
  fetchTeamStrengthPrior,
  type TeamStrengthAverages,
} from "./queries/team-context-queries";
import { createRun, finalizeRun } from "./queries/run-lifecycle-queries";
import {
  computeSkaterOnIceContextAdjustments,
  computeSkaterOpponentGoalieContextAdjustments,
  computeSkaterRestScheduleAdjustments,
  computeSkaterSampleShrinkageAdjustments,
  computeSkaterShotQualityAdjustments,
  computeSkaterTeamLevelContextAdjustments,
  computeStrengthSplitConversionRates,
} from "./calculators/skater-adjustments";
import {
  blendTopStarterScenarioOutputs,
  buildTopStarterScenarios,
  computeStarterProbabilities,
  selectStarterCandidateGoalieIds,
} from "./calculators/goalie-starter";
import {
  computeGoalieRestSplitSavePctAdjustment,
  computeWorkloadSavePctPenalty,
  toGoalieRestSplitBucket,
} from "./calculators/goalie-save-pct-context";
import {
  blendSkaterScenarioStatLines,
  blendSkaterScenarioStatLinesAcrossHorizon,
  buildSkaterScenarioMetadata,
  computeSkaterTeamToiTargetWithPoolGuard,
  validateReconciledPlayerDistribution,
} from "./calculators/scenario-blending";
import {
  computeNstOpponentDangerAdjustment,
  computeTeamFiveOnFiveContextAdjustment,
  computeTeamStrengthContextAdjustment,
} from "./calculators/team-context-adjustments";
import {
  availabilityMultiplierForEvent,
  runProjectionPreflightStage,
} from "./stages/preflight-stage";
import {
  runMetricsFinalizationStage,
  type ProjectionMetricsFinalizationTarget,
} from "./stages/metrics-finalization-stage";
import {
  persistForgeGoalieProjection,
  persistForgePlayerProjectionRows,
  persistForgeTeamProjection,
  persistPerGameAnalyticsOutputs,
} from "./stages/persistence-stage";
import {
  runPerGameGoalieStage,
  type GoalieStageCandidate,
  type SelectedGoalieProjection,
} from "./stages/goalie-stage";
import { runPerGameSkaterStage } from "./stages/skater-stage";
import {
  ANALYTICS_MODEL_NAME,
  ANALYTICS_MODEL_VERSION,
  buildModelMarketFlagRow,
  GAME_MARKET_EDGE_THRESHOLDS,
  getConsensusLineValue,
  getProjectionValueForPropMarket,
  PLAYER_MARKET_EDGE_THRESHOLDS,
} from "./utils/market-output-builders";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

const FALLBACK_SKATER_LOOKBACK_DAYS = 120;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export type {
  StarterContextForTest,
  StarterScenario,
} from "./types/run-forge-projections.types";
export {
  computeSkaterOnIceContextAdjustments,
  computeSkaterOpponentGoalieContextAdjustments,
  computeSkaterRestScheduleAdjustments,
  computeSkaterSampleShrinkageAdjustments,
  computeSkaterShotQualityAdjustments,
  computeSkaterTeamLevelContextAdjustments,
  computeStrengthSplitConversionRates,
} from "./calculators/skater-adjustments";
export {
  blendTopStarterScenarioOutputs,
  buildTopStarterScenarios,
  computeStarterProbabilities,
  selectStarterCandidateGoalieIds,
} from "./calculators/goalie-starter";
export {
  computeGoalieRestSplitSavePctAdjustment,
  toGoalieRestSplitBucket,
} from "./calculators/goalie-save-pct-context";
export { availabilityMultiplierForEvent } from "./stages/preflight-stage";
export {
  allocatePpToiByTeamOpportunity,
  applyRoleSpecificUsageBounds,
  assessLineCombinationRecency,
  blendToiSecondsWithDeploymentPrior,
  buildSkaterRoleScenarios,
  buildSkaterRoleTags,
  computeSkaterRoleStabilityMultiplier,
  computeTeammateAssistCoupling,
  constrainSkaterIdsToActiveRoster,
  filterActiveSkaterCandidateIds,
  mergeSkaterCandidatePoolForRecovery,
  normalizeWgoToiToSeconds,
  summarizeSkaterRoleContinuity,
} from "./stages/skater-stage";
export {
  blendSkaterScenarioStatLines,
  blendSkaterScenarioStatLinesAcrossHorizon,
  buildSkaterScenarioMetadata,
  computeSkaterTeamToiTargetWithPoolGuard,
  validateReconciledPlayerDistribution,
} from "./calculators/scenario-blending";
export {
  computeNstOpponentDangerAdjustment,
  computeTeamFiveOnFiveContextAdjustment,
  computeTeamStrengthContextAdjustment,
} from "./calculators/team-context-adjustments";

export { buildSequentialHorizonScalarsFromDates } from "./utils/date-utils";
import { captureProjectionInputs, replayProjectionInputs, projectionInputHash } from "./inputCapture";
import { saveForgeInputSnapshot, publishForgeGameRevisions, projectionWritesHash, capturedGoalieStarts, type ForgeInputSnapshot } from "./gameRevisions";
import { applyDailyBoardEvidence } from "./dailyBoardEvidence";
import { starterBoardFlags, starterBoardScopeAllowed } from "./starterBoardFlags";

const projectionModelEnvironment = () => Object.fromEntries([
  "FORGE_SKATER_MODEL_MODE", "NHL_XG_TEAM_AGGREGATE_MODEL_VERSION", "NHL_XG_TEAM_AGGREGATE_FEATURE_VERSION",
  "NHL_XG_TEAM_AGGREGATE_WINDOW_GAMES", "NHL_XG_MODEL_VERSION",
  "START_CHART_GAME_REVISIONS", "STARTER_BOARD_COMPUTE_ENABLED", "STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED",
].map((key) => [key, process.env[key] ?? null]));

export async function runProjectionV2ForDate(
  asOfDate: string,
  opts?: RunProjectionOptions,
): Promise<RunProjectionResult> {
  assertSupabase();
  const decisionAsOf = opts?.decisionAsOf ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(decisionAsOf)) || Date.parse(decisionAsOf) > Date.now()) {
    throw new Error("Projection cutoff must be a valid timestamp no later than now.");
  }
  const { capture: captureEnabled, compute: computeEnabled } = starterBoardFlags();
  if (computeEnabled && !captureEnabled) throw new Error("Starter Board computation requires input capture.");
  // Existing full-slate FORGE jobs retain their legacy outputs and captured inputs,
  // but only explicitly scoped canary runs may publish new Starter Board revisions.
  const compute = computeEnabled && starterBoardScopeAllowed(opts?.gameIds);
  const seasonBootstrap = compute && !opts?.decisionAsOf && (opts?.horizonGames ?? 1) === 1
    && process.env.STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED === "true"
    && asOfDate >= new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(decisionAsOf));
  const codeVersion = process.env.FORGE_CODE_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA;
  if (captureEnabled && !codeVersion) throw new Error("Captured FORGE runs require an immutable FORGE_CODE_VERSION or deployment commit SHA.");
  const reservation = compute ? await (supabase as any).rpc("begin_forge_game_run", {
    p_date: asOfDate, p_game_ids: opts?.gameIds ?? [], p_code_version: codeVersion,
    p_owner: opts?.boardLease?.owner ?? null, p_version: opts?.boardLease?.version ?? null,
  }) : null;
  if (reservation?.error) throw reservation.error;
  const runId: string = reservation?.data ?? await createRun(asOfDate);
  if (!captureEnabled) return runProjectionCalculations(asOfDate, { ...opts, decisionAsOf }, runId);
  try {
    const capture = await captureProjectionInputs(() => runProjectionCalculations(asOfDate, { ...opts, decisionAsOf, seasonBootstrap }, runId), { deadlineMs: opts?.deadlineMs });
    if (capture.result.timedOut) return capture.result;
    const snapshot: ForgeInputSnapshot = {
      version: "forge-inputs-v1", runId, slateDate: asOfDate,
      inputCutoff: decisionAsOf,
      decisionAsOf: capture.reads.reduce((latest, read) => read.receivedAt > latest ? read.receivedAt : latest, decisionAsOf),
      capturedAt: new Date().toISOString(),
      codeVersion: codeVersion!,
      modelMode: resolveSkaterRolloutConfig().mode,
      modelEnvironment: projectionModelEnvironment(),
      seasonBootstrapApplied: seasonBootstrap,
      inputProvenance: buildForgeInputProvenance(),
      dailyBoardEvidence: capture.writes.filter((ops) => ops[0]?.args[0] === "forge_runs")
        .map((ops) => (ops.find((op) => op.method === "update")?.args[0] as any)?.metrics?.daily_board_evidence)
        .find(Boolean) ?? { assertions: [], conflicts: [] },
      deterministicSeed: 0,
      horizonGames: opts?.horizonGames ?? 1,
      gameIds: opts?.gameIds ?? [],
      replayClassification: opts?.decisionAsOf || asOfDate < new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(decisionAsOf)) ? "historical_reconstruction" : "captured_live",
      reads: capture.reads,
      goalieStarts: capturedGoalieStarts(capture.reads, capture.writes),
      outputHash: projectionWritesHash(capture.writes),
    };
    const inputSnapshotId = await saveForgeInputSnapshot(snapshot);
    const publishedGames = compute && snapshot.horizonGames === 1 && snapshot.replayClassification === "captured_live"
      ? await publishForgeGameRevisions(runId, inputSnapshotId) : 0;
    return { ...capture.result, inputSnapshotId, publishedGames };
  } catch (error) {
    await finalizeRun(runId, "failed", { error: getErrorMessage(error), publication_failed: true });
    throw error;
  }
}

/** Bounded diagnostic capture: no run reservation, publication or database writes. */
export async function captureForgeReconstruction(args: {
  slateDate: string; gameId: number; inputCutoff: string; codeVersion: string; deadlineMs: number;
  controlledNews?: { classification: "controlled_news_fixture"; lineups?: import("./dailyBoardEvidence").BoardLineupEvidence[];
    goalies?: import("./dailyBoardEvidence").BoardGoalieEvidence[]; conflicts?: import("./dailyBoardEvidence").BoardConflict[] };
}) {
  if (!starterBoardFlags().compute || !starterBoardFlags().capture) throw new Error("Reconstruction requires the captured Starter Board calculation path");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.slateDate) || !Number.isSafeInteger(args.gameId) || args.gameId <= 0
    || !args.codeVersion || !Number.isFinite(Date.parse(args.inputCutoff)) || Date.parse(args.inputCutoff) > Date.now()
    || !Number.isFinite(args.deadlineMs) || args.deadlineMs <= Date.now()) throw new Error("Invalid bounded reconstruction request");
  if (args.slateDate >= "2026-01-03" && args.slateDate <= "2026-04-16") throw new Error("Protected research holdout cannot be reconstructed under this contract");
  if (args.controlledNews && (args.controlledNews.classification !== "controlled_news_fixture"
    || [...args.controlledNews.lineups ?? [], ...args.controlledNews.goalies ?? [], ...args.controlledNews.conflicts ?? []]
      .some((row) => row.game_id !== args.gameId))) throw new Error("Controlled news must identify this game and remain explicitly synthetic");
  const runId = "00000000-0000-4000-8000-000000000001";
  const capture = await captureProjectionInputs(() => runProjectionCalculations(args.slateDate, {
    gameIds: [args.gameId], horizonGames: 1, decisionAsOf: args.inputCutoff, deadlineMs: args.deadlineMs,
  }, runId), { deadlineMs: args.deadlineMs, suppressWrites: true, controlledNewsReads: args.controlledNews ? {
    player_forecast_lineup_snapshots: args.controlledNews.lineups ?? [],
    player_forecast_goalie_start_observations: args.controlledNews.goalies ?? [],
    player_forecast_observation_conflicts: args.controlledNews.conflicts ?? [],
  } : undefined });
  const snapshot: ForgeInputSnapshot = {
    version: "forge-inputs-v1", runId, slateDate: args.slateDate,
    decisionAsOf: capture.reads.reduce((latest, read) => read.receivedAt > latest ? read.receivedAt : latest, args.inputCutoff),
    inputCutoff: args.inputCutoff, capturedAt: new Date().toISOString(), codeVersion: args.codeVersion,
    modelMode: resolveSkaterRolloutConfig().mode, modelEnvironment: projectionModelEnvironment(),
    inputProvenance: buildForgeInputProvenance(), deterministicSeed: 0, horizonGames: 1, gameIds: [args.gameId],
    replayClassification: "historical_reconstruction", reads: capture.reads,
    ...(args.controlledNews ? { controlledScenario: { classification: "controlled_news_fixture" as const, fixtureHash: projectionInputHash(args.controlledNews) } } : {}),
    outputHash: projectionWritesHash(capture.writes), goalieStarts: capturedGoalieStarts(capture.reads, capture.writes),
  };
  return { result: capture.result, snapshot, writes: capture.writes, snapshotHash: projectionInputHash(snapshot) };
}

/** Replays recorded reads, suppressing all database writes and network access. */
export async function replayForgeSnapshot(snapshot: ForgeInputSnapshot, expectedHash: string) {
  if (!starterBoardFlags().capture) throw new Error("Replay requires Starter Board capture configuration.");
  if (projectionInputHash(snapshot) !== expectedHash || snapshot.version !== "forge-inputs-v1") {
    throw new Error("FORGE snapshot checksum or version mismatch.");
  }
  if (resolveSkaterRolloutConfig().mode !== snapshot.modelMode) throw new Error("FORGE replay model mode mismatch.");
  const currentEnvironment = projectionModelEnvironment();
  // Earlier v1 captures predate the split rollout flags. Compare every captured
  // setting, and preserve the legacy evidence-enabled execution semantics.
  const comparableEnvironment = Object.fromEntries(Object.keys(snapshot.modelEnvironment ?? {}).map((key) => [key, currentEnvironment[key] ?? null]));
  if (snapshot.modelEnvironment && (projectionInputHash(snapshot.modelEnvironment) !== projectionInputHash(comparableEnvironment)
    || (!("STARTER_BOARD_COMPUTE_ENABLED" in snapshot.modelEnvironment) && !starterBoardFlags().compute))) {
    throw new Error("FORGE replay environment mismatch; restore the captured non-secret model configuration.");
  }
  const replay = await replayProjectionInputs(snapshot.reads, () => runProjectionCalculations(snapshot.slateDate, {
    decisionAsOf: snapshot.inputCutoff, horizonGames: snapshot.horizonGames, gameIds: snapshot.gameIds,
    seasonBootstrap: snapshot.seasonBootstrapApplied === true,
  }, snapshot.runId));
  const outputHash = projectionWritesHash(replay.writes);
  if (outputHash !== snapshot.outputHash) throw new Error("FORGE replay output mismatch; use the captured code/model version.");
  return { runId: snapshot.runId, outputHash, matched: true };
}

async function runProjectionCalculations(asOfDate: string, opts: RunProjectionOptions | undefined, runId: string): Promise<RunProjectionResult> {
  const skaterRollout = resolveSkaterRolloutConfig();

  const metrics: Record<string, any> = {
    as_of_date: asOfDate,
    horizon_games: clampHorizonGames(opts?.horizonGames ?? 1),
    input_provenance: buildForgeInputProvenance(),
    decision_as_of: opts?.decisionAsOf,
    board_lease: opts?.boardLease ?? null,
    execution_scope: {
      mode: opts?.gameIds?.length ? "selected_games" : "full_slate",
      requested_game_ids: opts?.gameIds ?? [],
    },
    started_at: new Date().toISOString(),
    skater_rollout: skaterRollout,
    games: 0,
    player_rows: 0,
    team_rows: 0,
    goalie_rows: 0,
    learning: {
      recent_window_games: 5,
      goal_rate_prior_strength: "adaptive",
      assist_rate_prior_strength: "adaptive",
      players_considered: 0,
      goal_rate_recent_players: 0,
      assist_rate_recent_players: 0,
      goal_rate_recent_share: 0,
      assist_rate_recent_share: 0,
    },
    data_quality: {
      missing_pbp_games: 0,
      missing_shift_totals: 0,
      missing_line_combos: 0,
      stale_line_combos_soft: 0,
      stale_line_combos_hard: 0,
      line_combo_fallbacks_used: 0,
      line_combo_hard_failures: 0,
      empty_skater_rosters: 0,
      filtered_skater_team_or_position: 0,
      filtered_skater_missing_metrics: 0,
      filtered_skater_hard_stale: 0,
      soft_stale_skater_penalties: 0,
      role_volatility_penalties_applied: 0,
      role_continuity_boosts_applied: 0,
      skater_availability_penalties_applied: 0,
      skater_unavailable_filtered: 0,
      skater_pool_recovery_attempts: 0,
      skater_pool_recovery_activated: 0,
      skater_pool_recovery_restored: 0,
      skater_pool_recovery_failed: 0,
      skater_pool_recovery_candidates_added: 0,
      skater_pool_emergency_missing_metrics_included: 0,
      skater_pool_players_dropped_no_ev_pp_gate: 0,
      skater_pool_projected_teams: 0,
      skater_pool_projected_count_min: null as number | null,
      skater_pool_projected_count_max: null as number | null,
      skater_pool_projected_count_sum: 0,
      skater_pool_projected_count_avg: null as number | null,
      skater_pool_underfilled_projected_teams: 0,
      skater_pool_emergency_toi_target_caps_applied: 0,
      missing_ev_metrics_players: 0,
      missing_pp_metrics_players: 0,
      deployment_prior_profiles_found: 0,
      deployment_prior_toi_blends_applied: 0,
      shot_quality_profiles_found: 0,
      shot_quality_adjustments_applied: 0,
      on_ice_context_profiles_found: 0,
      on_ice_context_adjustments_applied: 0,
      trend_adjustment_rows_eligible: 0,
      trend_adjustment_players_with_rows: 0,
      trend_adjustment_players_adjusted: 0,
      trend_adjustment_players_missing_rows: 0,
      trend_adjustment_players_neutralized_by_recency: 0,
      trend_adjustment_soft_stale_selected: 0,
      trend_adjustment_hard_stale_selected: 0,
      trend_adjustment_fetch_failures: 0,
      team_level_context_teams_with_signal: 0,
      team_level_context_adjustments_applied: 0,
      opponent_goalie_context_profiles_found: 0,
      opponent_goalie_context_adjustments_applied: 0,
      rest_schedule_teams_with_signal: 0,
      rest_schedule_adjustments_applied: 0,
      small_sample_players: 0,
      small_sample_shrinkage_applied: 0,
      small_sample_callup_fallbacks: 0,
      missing_pp_conversion_samples: 0,
      pp_opportunity_teams_modeled: 0,
      pp_opportunity_players_reweighted: 0,
      teammate_coupling_players_adjusted: 0,
      role_usage_bounds_applied: 0,
      reconciliation_distribution_adjustments: 0,
      reconciliation_top_es_share_max: null as number | null,
      reconciliation_top_pp_share_max: null as number | null,
      role_scenarios_players_modeled: 0,
      role_scenarios_avg_count: null as number | null,
      role_scenario_blends_applied: 0,
      role_scenario_horizon_games_modeled: 0,
      toi_scaled_teams: 0,
      toi_scale_min: null as number | null,
      toi_scale_max: null as number | null,
    },
    warnings: [] as string[],
  };

  try {
    const horizonGames = clampHorizonGames(opts?.horizonGames ?? 1);
    const teamDateKey = (teamId: number) => `${teamId}:${asOfDate}`;
    const playerDateKey = (playerId: number) => `${playerId}:${asOfDate}`;
    const preflight = await runProjectionPreflightStage({
      asOfDate,
      decisionAsOf: opts?.decisionAsOf,
      requestedGameIds: opts?.gameIds ?? [],
    });

    const currentSeasonId = preflight.currentSeasonId;
    metrics.daily_board_evidence = preflight.dailyBoardEvidence;
    const games = preflight.games;
    const teamAbbreviationById = preflight.teamAbbreviationById;
    const playerAvailabilityMultiplier = preflight.playerAvailabilityMultiplier;
    const availabilityEventByPlayer = preflight.availabilityEventByPlayer;
    const roleEventByPlayer = preflight.roleEventByPlayer;
    const goalieOverrideByTeamId = preflight.goalieOverrideByTeamId;
    const gameMarketContextByGameId = preflight.gameMarketContextByGameId;
    const playerPropContextByGamePlayerKey =
      preflight.playerPropContextByGamePlayerKey;

    const activeRosterSkaterIdsByTeamId = new Map<number, number[]>();
    const goalieEvidenceCache = new Map<string, GoalieEvidence>();
    const teamStrengthCache = new Map<string, TeamStrengthAverages>();
    const learningCounters = {
      players: 0,
      goalRecent: 0,
      assistRecent: 0,
    };

    const deadlineMs = safeNumber(opts?.deadlineMs, Number.POSITIVE_INFINITY);
    let timedOut = false;

    let playerRowsUpserted = 0;
    let teamRowsUpserted = 0;
    let goalieRowsUpserted = 0;
    const teamHorizonScalarsCache = new Map<string, number[]>();
    const teamSkaterRoleHistoryCache = new Map<string, Map<number, string[]>>();

    gamesLoop: for (const game of (games ?? []) as GameRow[]) {
      if (Date.now() > deadlineMs) {
        timedOut = true;
        break gamesLoop;
      }
      const pbpComplete = await hasCompleteStoredPbpGame(game.id);
      if (!pbpComplete) {
        metrics.data_quality.missing_pbp_games += 1;
      } else if (
        (await classifyStoredShiftChartStrengthGame({ gameId: game.id }))
          .status !== "complete"
      ) {
        metrics.data_quality.missing_shift_totals += 1;
      }

      // Removed: const lineCombos = await fetchLineCombinations(game.id);
      // We now fetch per-team latest LCs inside the loop.

      const teamShotsByTeamId = new Map<
        number,
        { shotsEs: number; shotsPp: number }
      >();
      const teamGoalsByTeamId = new Map<number, number>();
      const fallbackGoalieByTeamId = new Map<number, number | null>();
      const teamGoalieStarterContextCache = new Map<
        string,
        TeamGoalieStarterContext
      >();
      const teamDefensiveEnvironmentCache = new Map<
        string,
        TeamDefensiveEnvironment
      >();
      const teamOffenseEnvironmentCache = new Map<
        string,
        TeamOffenseEnvironment
      >();
      const teamRestDaysCache = new Map<string, number | null>();
      const teamStrengthPriorCache = new Map<
        string,
        TeamStrengthPrior | null
      >();
      const teamFiveOnFiveProfileCache = new Map<
        string,
        TeamFiveOnFiveProfile | null
      >();
      const teamNstExpectedGoalsCache = new Map<
        string,
        TeamNstExpectedGoalsProfile | null
      >();
      const teamLineComboGoaliePriorCache = new Map<
        string,
        Map<number, number>
      >();
      const goalieWorkloadContextCache = new Map<
        string,
        GoalieWorkloadContext
      >();
      const goalieRestSplitProfileCache = new Map<
        string,
        GoalieRestSplitProfile | null
      >();
      const currentTeamGoalieIdsCache = new Map<string, Set<number>>();
      const playerPredictionOutputRows: Array<Record<string, unknown>> = [];
      const modelMarketFlagRows: Array<Record<string, unknown>> = [];
      const selectedGoalieByTeamId = new Map<
        number,
        SelectedGoalieProjection
      >();
      const goalieCandidates: GoalieStageCandidate[] = [];

      const skaterStageResult = await runPerGameSkaterStage({
        asOfDate,
        runId,
        horizonGames,
        game,
        deadlineMs,
        currentSeasonId,
        seasonBootstrap: opts?.seasonBootstrap,
        skaterRollout,
        teamAbbreviationById,
        ...applyDailyBoardEvidence({
          gameId: game.id, evidence: preflight.dailyBoardEvidence,
          playerAvailabilityMultiplier, availabilityEventByPlayer, roleEventByPlayer,
          ppEventByPlayer: preflight.ppEventByPlayer, goalieOverrideByTeamId,
        }),
        dailyBoardEvidence: preflight.dailyBoardEvidence,
        activeRosterSkaterIdsByTeamId,
        teamHorizonScalarsCache,
        teamSkaterRoleHistoryCache,
        teamShotsByTeamId,
        teamGoalsByTeamId,
        fallbackGoalieByTeamId,
        teamGoalieStarterContextCache,
        teamDefensiveEnvironmentCache,
        teamOffenseEnvironmentCache,
        teamRestDaysCache,
        teamStrengthPriorCache,
        teamStrengthCache,
        teamFiveOnFiveProfileCache,
        teamNstExpectedGoalsCache,
        teamLineComboGoaliePriorCache,
        currentTeamGoalieIdsCache,
        playerPropContextByGamePlayerKey,
        playerPredictionOutputRows,
        modelMarketFlagRows,
        goalieCandidates,
        learningCounters,
        metrics,
      });
      playerRowsUpserted += skaterStageResult.playerRowsUpserted;
      teamRowsUpserted += skaterStageResult.teamRowsUpserted;
      if (skaterStageResult.timedOut) {
        timedOut = true;
        break gamesLoop;
      }

      // Create goalie projections after both teams are projected so we can use opponent shots.
      const goalieStageResult = await runPerGameGoalieStage({
        seasonBootstrap: opts?.seasonBootstrap,
        asOfDate,
        runId,
        horizonGames,
        game,
        deadlineMs,
        goalieCandidates,
        teamShotsByTeamId,
        teamGoalsByTeamId,
        teamAbbreviationById,
        teamStrengthPriorCache,
        teamFiveOnFiveProfileCache,
        teamNstExpectedGoalsCache,
        teamDefensiveEnvironmentCache,
        teamOffenseEnvironmentCache,
        teamRestDaysCache,
        teamGoalieStarterContextCache,
        goalieEvidenceCache,
        goalieWorkloadContextCache,
        goalieRestSplitProfileCache,
        teamHorizonScalarsCache,
        playerPropContextByGamePlayerKey,
        selectedGoalieByTeamId,
        playerPredictionOutputRows,
        modelMarketFlagRows,
        metrics: metrics as { warnings: string[] },
      });
      goalieRowsUpserted += goalieStageResult.goalieRowsUpserted;
      if (goalieStageResult.timedOut) {
        timedOut = true;
        break gamesLoop;
      }

      const homeExpectedGoals = teamGoalsByTeamId.get(game.homeTeamId) ?? null;
      const awayExpectedGoals = teamGoalsByTeamId.get(game.awayTeamId) ?? null;
      const totalExpectedGoals =
        homeExpectedGoals != null && awayExpectedGoals != null
          ? Number((homeExpectedGoals + awayExpectedGoals).toFixed(3))
          : null;
      const spreadProjection =
        homeExpectedGoals != null && awayExpectedGoals != null
          ? Number((homeExpectedGoals - awayExpectedGoals).toFixed(3))
          : null;
      const gameMarketSummary = gameMarketContextByGameId.get(game.id) ?? {};
      const homeGoalie = selectedGoalieByTeamId.get(game.homeTeamId) ?? null;
      const awayGoalie = selectedGoalieByTeamId.get(game.awayTeamId) ?? null;
      const totalMarketSummary = gameMarketSummary["totals"];
      const spreadMarketSummary = gameMarketSummary["spreads"];
      const totalLineValue =
        totalMarketSummary?.outcomes.find(
          (outcome) => outcome.outcomeKey === "over",
        )?.averageLineValue ?? getConsensusLineValue(totalMarketSummary);
      if (totalExpectedGoals != null && totalLineValue != null) {
        const edgeValue = totalExpectedGoals - totalLineValue;
        if (Math.abs(edgeValue) >= GAME_MARKET_EDGE_THRESHOLDS.totals) {
          modelMarketFlagRows.push(
            buildModelMarketFlagRow({
              asOfDate,
              entityType: "game",
              entityId: game.id,
              gameId: game.id,
              marketType: "totals",
              flagType: edgeValue > 0 ? "model_over" : "model_under",
              edgeValue,
              reasons: [
                {
                  expected_value: totalExpectedGoals,
                  line_value: totalLineValue,
                  sportsbook_count:
                    totalMarketSummary?.sportsbookKeys.length ?? 0,
                },
              ],
              provider: totalMarketSummary?.sourceNames[0] ?? null,
              metadata: {
                horizon_games: horizonGames,
                run_id: runId,
              },
            }),
          );
        }
      }

      const homeTeamAbbreviation =
        teamAbbreviationById.get(game.homeTeamId) ?? null;
      const homeSpreadLineValue =
        homeTeamAbbreviation != null
          ? (spreadMarketSummary?.outcomes.find(
              (outcome) =>
                outcome.outcomeKey === `team:${homeTeamAbbreviation}`,
            )?.averageLineValue ?? null)
          : null;
      if (spreadProjection != null && homeSpreadLineValue != null) {
        const edgeValue = spreadProjection - homeSpreadLineValue;
        if (Math.abs(edgeValue) >= GAME_MARKET_EDGE_THRESHOLDS.spreads) {
          modelMarketFlagRows.push(
            buildModelMarketFlagRow({
              asOfDate,
              entityType: "game",
              entityId: game.id,
              gameId: game.id,
              marketType: "spreads",
              flagType: edgeValue > 0 ? "model_home_cover" : "model_away_cover",
              edgeValue,
              reasons: [
                {
                  expected_value: spreadProjection,
                  line_value: homeSpreadLineValue,
                  sportsbook_count:
                    spreadMarketSummary?.sportsbookKeys.length ?? 0,
                },
              ],
              provider: spreadMarketSummary?.sourceNames[0] ?? null,
              metadata: {
                horizon_games: horizonGames,
                run_id: runId,
              },
            }),
          );
        }
      }

      const gamePredictionOutput = {
        snapshot_date: asOfDate,
        game_id: game.id,
        model_name: ANALYTICS_MODEL_NAME,
        model_version: ANALYTICS_MODEL_VERSION,
        prediction_scope: "pregame",
        home_team_id: game.homeTeamId,
        away_team_id: game.awayTeamId,
        home_win_probability: null,
        away_win_probability: null,
        home_expected_goals: homeExpectedGoals,
        away_expected_goals: awayExpectedGoals,
        total_expected_goals: totalExpectedGoals,
        spread_projection: spreadProjection,
        components: {
          market_inputs: gameMarketSummary,
          selected_goalies: {
            home: homeGoalie,
            away: awayGoalie,
          },
        },
        provenance: {
          game_market_provider:
            Object.values(gameMarketSummary)[0]?.sourceNames?.[0] ?? null,
          input_family: "forge-game-projection",
        },
        metadata: {
          horizon_games: horizonGames,
          run_id: runId,
        },
      };

      await persistPerGameAnalyticsOutputs({
        asOfDate,
        gameId: game.id,
        modelName: ANALYTICS_MODEL_NAME,
        modelVersion: ANALYTICS_MODEL_VERSION,
        playerPredictionOutputRows,
        gamePredictionOutput,
        modelMarketFlagRows,
      });

      metrics.games += 1;
    }

    runMetricsFinalizationStage({
      metrics: metrics as ProjectionMetricsFinalizationTarget,
      playerRowsUpserted,
      teamRowsUpserted,
      goalieRowsUpserted,
      learningCounters,
      timedOut,
    });

    await finalizeRun(runId, timedOut ? "failed" : "succeeded", metrics);
    return {
      runId,
      gamesProcessed: metrics.games,
      playerRowsUpserted,
      teamRowsUpserted,
      goalieRowsUpserted,
      timedOut,
    };
  } catch (e) {
    metrics.finished_at = new Date().toISOString();
    metrics.error = getErrorMessage(e);
    await finalizeRun(runId, "failed", metrics);
    throw e;
  }
}
