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
  LeaguePhysicalTotals,
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
import {
  buildResumableRunScopeKey,
  claimResumableRun,
  clearRunGameRows,
  createRun,
  finalizeRun,
  assertRunStillOwned,
  resumableRunLeaseExpiresAt,
  runWithClaimedRunWrites,
  writeClaimedRun,
  type ForgeRunClaim,
} from "./queries/run-lifecycle-queries";
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
  goalieStageLoaders,
  runPerGameGoalieStage,
  type GoalieStageArgs,
  type GoalieStageCandidate,
  type SelectedGoalieProjection,
} from "./stages/goalie-stage";
import type { SeasonLeagueSavePctCache } from "./goalie/leagueSavePct";
import { loadSkaterGameInputs, runPerGameSkaterStage, type SkaterStageArgs } from "./stages/skater-stage";
import {
  ANALYTICS_MODEL_NAME,
  ANALYTICS_MODEL_VERSION,
  buildGameMarketFlagRows,
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
  selectLineCombinationFallback,
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
import { captureProjectionInputs, replayProjectionInputs, projectionInputHash, capturedReadReceipt, type ProjectionInputRead } from "./inputCapture";
import { saveForgeInputSnapshot, publishForgeGameRevisions, projectionWritesHash, capturedGoalieStarts, capturedIssuedTargets, type ForgeInputSnapshot } from "./gameRevisions";
import { captureForgeIssuedContexts, forgeIssuedContextsFingerprint, type ForgeIssuedContextV1 } from "./issuedContext";
import { applyDailyBoardEvidence } from "./dailyBoardEvidence";
import { currentProducerClosureSha256 } from "./forgeProducerIdentity";
import { starterBoardFlags, starterBoardScopeAllowed } from "./starterBoardFlags";
import { assertPacket, type PregamePacket } from "./pregameCapture/packet";
import { latestInstant, microsFromEpochMs, parseInstantMicros } from "./pregameCapture/time";
import { forgeEnv } from "./forgeEnvScope";

export const projectionModelEnvironment = () => Object.fromEntries([
  "FORGE_SKATER_MODEL_MODE", "NHL_XG_TEAM_AGGREGATE_MODEL_VERSION", "NHL_XG_TEAM_AGGREGATE_FEATURE_VERSION",
  "NHL_XG_TEAM_AGGREGATE_WINDOW_GAMES", "NHL_XG_MODEL_VERSION",
  "START_CHART_GAME_REVISIONS", "STARTER_BOARD_COMPUTE_ENABLED", "STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED",
].map((key) => [key, forgeEnv()[key] ?? null]));

/** Every source the run may read, as audited on 2026-10-26 (tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/
 * EXTERNAL-INPUT-AUDIT.md): NHL first-party data, FHFH-derived tables and models, NST analytics, admin roster events,
 * relayed news and sportsbook prices (output flags only). None is a fantasy projection, ownership, rank or ADP source.
 * run-forge-projections.external-inputs.test.ts fails when the run's code can reach a source not listed here. */
export const FORGE_AUDITED_INPUT_SOURCES: ReadonlySet<string> = new Set([
  "games", "teams", "players", "rosters", "seasons", "fhfh_player_identities", "roster_optimizer_team_games",
  "skatersGameStats", "goaliesGameStats", "wgo_skater_stats", "wgo_goalie_stats", "wgo_team_stats",
  "pbp_games", "pbp_plays", "shift_charts", "nhl_api_shift_rows", "lineCombinations", "expected_goals",
  "forge_goalie_game", "forge_team_game_strength", "rolling_player_game_metrics", "rolling_player_metric_support_payloads",
  "forge_latest_rolling_rows", "forge_league_skater_physical_totals", "forge_latest_trend_bands", "player_stats_unified",
  "sustainability_trend_bands",
  "nst_team_all", "nst_team_stats", "nhl_team_data", "nhl_xg_team_rolling_aggregates", "goalie_start_projections",
  "forge_roster_events", "forge_board_news_events", "player_forecast_lineup_snapshots", "player_forecast_goalie_start_observations",
  "player_forecast_observation_conflicts", "player_forecast_lineup_assignments", "player_forecast_conflict_resolutions",
  "market_prices_daily", "prop_market_prices_daily",
  "forge_runs", "forge_player_projections", "forge_team_projections", "forge_goalie_projections", "forge_reserve_projections",
  "player_forecast_source_observations", "read_forge_game_revisions",
  // In-house xG registry (L14 selector pins the team prior); the shot-feature table is reachable only
  // through the registry module's imports and is not read by the run. Neither is a fantasy source.
  "nhl_xg_model_registry", "nhl_xg_shot_features",
]);
/** A third-party fantasy projection table: every configured source is a `PROJECTIONS_<season>_<source>` table, and so is
 * a new season's or source's. Matched by name so the runner never imports the provider configuration. */
export function isFantasyProjectionSource(name: string) {
  return /^projections_/i.test(name);
}
/** True only when the run's own captured reads show no fantasy projection source and nothing unaudited. An attempted
 * read counts, even a failed one: the run reached for the source. */
export function readsExcludeExternalFantasy(reads: readonly ProjectionInputRead[]) {
  return reads.length > 0 && reads.every(read => {
    const operation = read.request[0], name = String(operation?.args[0] ?? "");
    return (operation?.method === "from" || operation?.method === "rpc") && !isFantasyProjectionSource(name)
      && FORGE_AUDITED_INPUT_SOURCES.has(name);
  });
}
/** The exclusion label follows from the transcript, never from configuration such as the season-bootstrap flag. Only the
 * live snapshot, which publishes revisions, claims it; reconstructions and the run-start metrics stay unlabelled. */
const externalFantasyClaim = (reads: readonly ProjectionInputRead[]) =>
  readsExcludeExternalFantasy(reads) ? { externalFantasyInputsExcluded: true as const } : {};

/** FORGE model identity (TJ D3, 2026-10-26; codeVersion amended 2026-11-21): `configurationHash` is the canonical sha256
 * of the run's model environment. The heuristic has no fitted artifact, so `artifactHash` binds its code at `codeVersion`
 * under that configuration. `codeVersion` is the verified producer closure this build stamps (forgeProducerIdentity.ts),
 * not the deploy SHA, so a deploy that leaves the producer unchanged keeps the identity and an RSO review outlives the
 * release that ships it. The deploy SHA stays in `payload.codeVersion` as the release pin. Unbuilt code has no closure:
 * `codeVersion` and `artifactHash` are then null, and readers deny. v1 identities (keyed to the deploy SHA) are never
 * reviewable. It travels in the snapshot's `inputProvenance`, which revision publishing copies into every revision payload. */
export const FORGE_MODEL_IDENTITY_VERSION = "forge-model-identity-v2";
export function forgeModelIdentity(producerClosure: string | null, modelEnvironment: Record<string, string | null>) {
  const configurationHash = projectionInputHash(modelEnvironment);
  const codeVersion = typeof producerClosure === "string" && /^[a-f0-9]{64}$/.test(producerClosure) ? producerClosure : null;
  return { version: FORGE_MODEL_IDENTITY_VERSION, artifact: "no_fitted_artifact" as const, codeVersion, configurationHash,
    artifactHash: codeVersion === null ? null : projectionInputHash({ codeVersion, configurationHash }) };
}

/**
 * Whether the writer applies the season-opening bootstrap: a computing, single-horizon live run (no explicit cutoff)
 * for today or later in New York, with the bootstrap flag on. Pure, so a pregame capture can record the same decision.
 */
export function forgeSeasonBootstrapApplies(args: {
  compute: boolean; explicitCutoff: boolean; horizonGames: number; asOfDate: string; decisionAsOf: string;
  env?: Readonly<Record<string, string | undefined>>;
}): boolean {
  const env = args.env ?? process.env;
  return args.compute && !args.explicitCutoff && args.horizonGames === 1
    && env.STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED === "true"
    && args.asOfDate >= new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(args.decisionAsOf));
}

/**
 * `postRunFailure`: the run finalized `succeeded` with its rows written, then a
 * later step that its outputs do not depend on failed.
 */
export type RunProjectionV2Result = RunProjectionResult & {
  postRunFailure?: { step: "save_input_snapshot"; message: string };
};

export async function runProjectionV2ForDate(
  asOfDate: string,
  opts?: RunProjectionOptions,
): Promise<RunProjectionV2Result> {
  assertSupabase();
  const decisionAsOf = opts?.decisionAsOf ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(decisionAsOf)) || Date.parse(decisionAsOf) > Date.now()) {
    throw new Error("Projection cutoff must be a valid timestamp no later than now.");
  }
  const { capture: captureFlag, compute: computeEnabled } = starterBoardFlags();
  if (computeEnabled && !captureFlag) throw new Error("Starter Board computation requires input capture.");
  // FORGE captures its inputs only for Starter Board computation, which needs
  // them. With compute off the capture flag still drives news intake, but a run
  // takes the resumable uncaptured path and saves no input snapshot.
  const captureEnabled = captureFlag && computeEnabled;
  // Existing full-slate FORGE jobs retain their legacy outputs and captured inputs,
  // but only explicitly scoped canary runs may publish new Starter Board revisions.
  const compute = computeEnabled && starterBoardScopeAllowed(opts?.gameIds);
  if (compute && (opts?.gameIds?.length ?? 0) > 16) throw new Error("Issued FORGE run exceeds the 16-game context limit.");
  const captureIssuedContext = compute && (opts?.horizonGames ?? 1) === 1 && Boolean(opts?.gameIds?.length);
  const seasonBootstrap = forgeSeasonBootstrapApplies({
    compute, explicitCutoff: Boolean(opts?.decisionAsOf), horizonGames: opts?.horizonGames ?? 1, asOfDate, decisionAsOf,
  });
  const codeVersion = process.env.FORGE_CODE_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA;
  if (captureEnabled && !codeVersion) throw new Error("Captured FORGE runs require an immutable FORGE_CODE_VERSION or deployment commit SHA.");
  const verifyExecution = (checkpoint: Parameters<NonNullable<RunProjectionOptions["executionGuard"]>["verify"]>[0]) => {
    if (!opts?.executionGuard) return;
    opts.executionGuard.verify(checkpoint);
    if (codeVersion !== opts.executionGuard.codeVersion || process.env.FORGE_CODE_VERSION !== codeVersion) {
      throw new Error("Local FORGE execution code version changed.");
    }
  };
  verifyExecution({ phase: "before_run" });
  if (opts?.issuedContextGuard && !captureIssuedContext) throw new Error("Calendar intent requires captured single-game scope.");
  if (opts?.localAttempt && (!captureIssuedContext || opts.gameIds?.length !== 1 || opts.boardLease)) {
    throw new Error("Local FORGE attempts require captured single-game scope without a queue lease.");
  }
  const reservation = opts?.localAttempt ? await (supabase as any).rpc("begin_forge_local_run", {
    p_operation_id: opts.localAttempt.operationId, p_date: asOfDate, p_game_id: opts.gameIds![0],
    p_code_version: codeVersion, p_expected_revision_id: opts.localAttempt.expectedRevisionId,
    p_lease_ms: opts.localAttempt.leaseMs,
  }) : compute ? await (supabase as any).rpc("begin_forge_game_run", {
    p_date: asOfDate, p_game_ids: opts?.gameIds ?? [], p_code_version: codeVersion,
    p_owner: opts?.boardLease?.owner ?? null, p_version: opts?.boardLease?.version ?? null,
  }) : null;
  if (reservation?.error) throw reservation.error;
  const localReceipt = opts?.localAttempt ? reservation?.data : null;
  if (opts?.localAttempt && (!localReceipt || localReceipt.version !== "forge-local-attempt-v1"
    || localReceipt.operationId !== opts.localAttempt.operationId || localReceipt.slateDate !== asOfDate
    || localReceipt.gameId !== opts.gameIds![0] || localReceipt.codeVersion !== codeVersion
    || localReceipt.expectedRevisionId !== opts.localAttempt.expectedRevisionId
    || localReceipt.leaseMs !== opts.localAttempt.leaseMs || typeof localReceipt.runId !== "string"
    || !Number.isFinite(Date.parse(localReceipt.reservedAt)) || !Number.isFinite(Date.parse(localReceipt.leaseExpiresAt)))) {
    throw new Error("Local FORGE reservation receipt does not match the immutable intent.");
  }
  // A live uncaptured run keeps one run_id per date and scope. When the deadline
  // stops it, it stays running and the next call projects only unfinished games.
  // Captured runs need every read in one snapshot, so they stay single-call.
  const resumeClaim = !reservation && !captureEnabled && !opts?.decisionAsOf
    ? await claimResumableRun(asOfDate, {
      scopeKey: buildResumableRunScopeKey(clampHorizonGames(opts?.horizonGames ?? 1), opts?.gameIds),
      leaseExpiresAt: resumableRunLeaseExpiresAt(opts?.deadlineMs),
    })
    : null;
  const runId: string = localReceipt?.runId ?? reservation?.data ?? resumeClaim?.runId ?? await createRun(asOfDate);
  if (localReceipt && (localReceipt.reservation !== "new" || localReceipt.state !== "active")) {
    // Never rerun or finalize an existing attempt after a lost response/restart.
    verifyExecution({ phase: "reserved", runId });
    throw new Error("Local FORGE attempt already exists; reconcile its immutable evidence without recomputing.");
  }
  if (!captureEnabled) {
    const calculate = () => runProjectionCalculations(asOfDate, { ...opts, decisionAsOf }, runId, resumeClaim ?? undefined);
    // A claimed run re-checks its lease before every output write and cleanup.
    return resumeClaim ? runWithClaimedRunWrites(resumeClaim, calculate) : calculate();
  }
  try {
    verifyExecution({ phase: "reserved", runId });
    let issuedContexts: ForgeIssuedContextV1[] | undefined;
    const capture = await captureProjectionInputs(async () => {
      const before = captureIssuedContext ? await captureForgeIssuedContexts(asOfDate, opts!.gameIds!) : undefined;
      if (opts?.issuedContextGuard) {
        if (!before) throw new Error("Calendar intent requires captured issued context.");
        opts.issuedContextGuard(before);
      }
      const result = await runProjectionCalculations(asOfDate, { ...opts, decisionAsOf, seasonBootstrap }, runId);
      if (before && !result.timedOut) {
        const after = await captureForgeIssuedContexts(asOfDate, opts!.gameIds!);
        opts?.issuedContextGuard?.(after);
        if (forgeIssuedContextsFingerprint(before) !== forgeIssuedContextsFingerprint(after)) {
          throw new Error("Issued FORGE schedule or roster context changed during calculation.");
        }
        issuedContexts = after;
      }
      return result;
    }, { deadlineMs: opts?.deadlineMs });
    if (capture.result.timedOut) return capture.result;
    const modelEnvironment = projectionModelEnvironment();
    const snapshot: ForgeInputSnapshot = {
      version: "forge-inputs-v1", runId, slateDate: asOfDate,
      inputCutoff: decisionAsOf,
      // Parsed instants, never string order: an offset-format cutoff must not outrank a later read.
      decisionAsOf: latestInstant(capture.reads.map((read) => read.receivedAt), decisionAsOf),
      capturedAt: new Date().toISOString(),
      codeVersion: codeVersion!,
      modelMode: resolveSkaterRolloutConfig().mode,
      modelEnvironment,
      seasonBootstrapApplied: seasonBootstrap,
      inputProvenance: { ...buildForgeInputProvenance(externalFantasyClaim(capture.reads)),
        modelIdentity: forgeModelIdentity(currentProducerClosureSha256(), modelEnvironment), capturedReads: capturedReadReceipt(capture.reads),
        ...(issuedContexts ? { issuedContexts, issuedTargets: capturedIssuedTargets(issuedContexts, capture.writes) } : {}) },
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
    verifyExecution({ phase: "before_snapshot", runId });
    let inputSnapshotId: string;
    try {
      inputSnapshotId = await saveForgeInputSnapshot(snapshot);
    } catch (error) {
      // The run already finalized succeeded. Without Starter Board computation
      // nothing is published from this snapshot (it is replay evidence), so the
      // run stands and the failure is reported instead of failing the run.
      if (compute) throw error;
      return { ...capture.result, postRunFailure: { step: "save_input_snapshot", message: getErrorMessage(error) } };
    }
    let publishedGames = 0;
    if (compute && snapshot.horizonGames === 1 && snapshot.replayClassification === "captured_live") {
      verifyExecution({ phase: "before_publish", runId, inputSnapshotId });
      publishedGames = await publishForgeGameRevisions(runId, inputSnapshotId);
    }
    return { ...capture.result, inputSnapshotId, publishedGames };
  } catch (error) {
    await finalizeRun(runId, "failed", {
      error: getErrorMessage(error), publication_failed: true,
      analytics_sidecar: {
        version: "forge-analytics-sidecar-scope-v1",
        status: opts?.localAttempt ? "omitted_fenced_local_attempt" : "enabled",
      },
    });
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
    player_forecast_lineup_snapshots: (args.controlledNews.lineups ?? []).map(row => ({ ...row, created_at: row.created_at ?? row.available_at })),
    player_forecast_goalie_start_observations: (args.controlledNews.goalies ?? []).map(row => ({ ...row, created_at: row.created_at ?? row.available_at })),
    player_forecast_observation_conflicts: (args.controlledNews.conflicts ?? []).map(row => ({ ...row, created_at: row.created_at ?? row.detected_at })),
    player_forecast_lineup_assignments: (args.controlledNews.lineups ?? []).flatMap(row => row.player_forecast_lineup_assignments.map((child, index) => ({
      ...child, id: `controlled:${row.id}:${index}`, snapshot_id: row.id, created_at: child.created_at ?? row.created_at ?? row.available_at,
    }))),
    player_forecast_conflict_resolutions: (args.controlledNews.conflicts ?? []).flatMap(row => row.player_forecast_conflict_resolutions.map((child, index) => ({
      ...child, id: `controlled:${row.id}:${index}`, conflict_id: row.id, created_at: child.created_at ?? child.resolved_at,
    }))),
  } : undefined });
  const snapshot: ForgeInputSnapshot = {
    version: "forge-inputs-v1", runId, slateDate: args.slateDate,
    decisionAsOf: latestInstant(capture.reads.map((read) => read.receivedAt), args.inputCutoff),
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
  const expectedContexts = snapshot.inputProvenance?.issuedContexts;
  const replay = await replayProjectionInputs(snapshot.reads, async () => {
    const before = expectedContexts ? await captureForgeIssuedContexts(snapshot.slateDate, snapshot.gameIds) : undefined;
    const result = await runProjectionCalculations(snapshot.slateDate, {
      decisionAsOf: snapshot.inputCutoff, horizonGames: snapshot.horizonGames, gameIds: snapshot.gameIds,
      seasonBootstrap: snapshot.seasonBootstrapApplied === true,
    }, snapshot.runId);
    if (before) {
      const after = await captureForgeIssuedContexts(snapshot.slateDate, snapshot.gameIds);
      if (forgeIssuedContextsFingerprint(before) !== forgeIssuedContextsFingerprint(after)
        || forgeIssuedContextsFingerprint(after) !== forgeIssuedContextsFingerprint(expectedContexts!)) {
        throw new Error("FORGE issued context replay mismatch.");
      }
    }
    return result;
  });
  const outputHash = projectionWritesHash(replay.writes);
  if (outputHash !== snapshot.outputHash) throw new Error("FORGE replay output mismatch; use the captured code/model version.");
  return { runId: snapshot.runId, outputHash, matched: true };
}

export type ForgePregamePublicationSnapshot = Omit<ForgeInputSnapshot, "reads"> & {
  pregameCandidates: PregamePacket["candidates"];
};

/** Calculate one prospective publication from independently qualified private custody, without database I/O. */
export async function computeForgePregamePublication(packet: PregamePacket, args: { codeVersion: string; deadlineMs?: number }) {
  assertPacket(packet);
  const { binding, statedCutoff, seasonBootstrapApplied, reads, candidates } = packet;
  const { claimId: runId, gameId, slateDate, inputCutoff } = binding;
  const modelEnvironment = projectionModelEnvironment();
  const environmentHash = projectionInputHash(modelEnvironment);
  if (binding.codeVersion !== args.codeVersion || !packet.modelEnvironment || projectionInputHash(packet.modelEnvironment) !== environmentHash) {
    throw new Error("FORGE pregame packet code or model environment mismatch.");
  }
  if (!starterBoardFlags().compute || !starterBoardScopeAllowed([gameId])) {
    throw new Error("FORGE pregame game is outside the enabled computation scope.");
  }
  if (!readsExcludeExternalFantasy(reads) || reads.some(read => (read.result as { error?: unknown } | null)?.error != null)) {
    throw new Error("FORGE pregame packet contains failed or unaudited reads.");
  }
  const start = parseInstantMicros(binding.scheduledStart), cutoff = parseInstantMicros(statedCutoff);
  const now = microsFromEpochMs(Date.now());
  if (parseInstantMicros(inputCutoff) > cutoff || cutoff > now || now >= start
    || (args.deadlineMs !== undefined && (!Number.isFinite(args.deadlineMs) || args.deadlineMs <= Date.now()))) {
    throw new Error("FORGE pregame publication is outside the prospective calculation window.");
  }
  // Round the start down for the millisecond-grain projection deadline and recheck the exact instant before returning.
  const deadlineMs = Math.min(args.deadlineMs ?? Infinity, Number(start / BigInt(1000)));
  const gameIds = [gameId];
  const replay = await replayProjectionInputs(reads, async () => {
    const before = await captureForgeIssuedContexts(slateDate, gameIds);
    const result = await runProjectionCalculations(slateDate, {
      decisionAsOf: inputCutoff, horizonGames: 1, gameIds, seasonBootstrap: seasonBootstrapApplied, deadlineMs,
    }, runId, undefined, { omitPregameSidecars: true });
    if (result.timedOut || result.gamesProcessed !== 1) throw new Error("FORGE pregame calculation did not complete one game.");
    const after = await captureForgeIssuedContexts(slateDate, gameIds);
    const [context] = after;
    if (forgeIssuedContextsFingerprint(before) !== forgeIssuedContextsFingerprint(after)
      || context.game.homeTeamId !== binding.homeTeamId || context.game.awayTeamId !== binding.awayTeamId
      || parseInstantMicros(context.game.startTime) !== start
      || projectionInputHash(context.schedule.map((row) => row.revision)) !== binding.calendarRevision) {
      throw new Error("FORGE pregame packet does not match the captured calendar and roster context.");
    }
    // The closing context is observed from the retained reads, under their conservative availability bound.
    return { ...context, observedAt: statedCutoff };
  }, { rejectUnrecordedReads: true });

  const rowsFor = (table: string): Array<Record<string, unknown>> => replay.writes
    .filter(ops => ops[0]?.method === "from" && ops[0].args[0] === table)
    .flatMap(ops => {
      const write = ops.find(op => op.method === "upsert");
      if (!write) throw new Error(`Unexpected replay write to ${table}.`);
      const value = write.args[0];
      const values: unknown[] = Array.isArray(value) ? value : [value];
      return values.map(value => {
        const row = value as Record<string, unknown> | null;
        if (row?.run_id !== runId || row.game_id !== gameId || row.as_of_date !== slateDate || row.horizon_games !== 1
          || (row.team_id !== binding.homeTeamId && row.team_id !== binding.awayTeamId)) {
          throw new Error(`Replay write outside the bound pregame scope in ${table}.`);
        }
        return row;
      });
    });
  const rows = {
    players: rowsFor("forge_player_projections"), teams: rowsFor("forge_team_projections"),
    goalies: rowsFor("forge_goalie_projections"), reserves: rowsFor("forge_reserve_projections"),
  };
  const finalization = replay.writes.find(ops => ops[0]?.args[0] === "forge_runs")?.find(op => op.method === "update")?.args[0] as
    | { status: string; metrics: Record<string, unknown> & { daily_board_evidence?: ForgeInputSnapshot["dailyBoardEvidence"] } }
    | undefined;
  if (finalization?.status !== "succeeded" || finalization.metrics.player_rows !== rows.players.length
    || finalization.metrics.team_rows !== rows.teams.length || finalization.metrics.goalie_rows !== rows.goalies.length
    || rows.players.some(row => !candidates.skaters.includes(Number(row.player_id)))
    || rows.goalies.some(row => !candidates.goalies.includes(Number(row.goalie_id)))
    || rows.reserves.some(row => !(row.player_class === "goalie" ? candidates.goalies : candidates.reserves).includes(Number(row.player_id)))) {
    throw new Error("FORGE pregame rows do not match the captured candidate sets and succeeded run.");
  }
  const outputHash = projectionWritesHash(replay.writes);
  const issuedContexts = [replay.result];
  const snapshot: ForgePregamePublicationSnapshot = {
    version: "forge-inputs-v1", runId, slateDate, decisionAsOf: statedCutoff, inputCutoff, capturedAt: new Date().toISOString(),
    codeVersion: args.codeVersion, modelMode: resolveSkaterRolloutConfig().mode, modelEnvironment, seasonBootstrapApplied,
    inputProvenance: { ...buildForgeInputProvenance(externalFantasyClaim(reads)),
      modelIdentity: forgeModelIdentity(currentProducerClosureSha256(), modelEnvironment), capturedReads: capturedReadReceipt(reads),
      issuedContexts, issuedTargets: capturedIssuedTargets(issuedContexts, replay.writes) },
    dailyBoardEvidence: finalization.metrics.daily_board_evidence ?? { assertions: [], conflicts: [] },
    deterministicSeed: 0, horizonGames: 1, gameIds, replayClassification: "captured_live", pregameCandidates: candidates,
    goalieStarts: capturedGoalieStarts(reads, replay.writes), outputHash,
  };
  if (Date.now() > deadlineMs || microsFromEpochMs(Date.now()) >= start
    || projectionInputHash(projectionModelEnvironment()) !== environmentHash) {
    throw new Error("FORGE pregame calculation exceeded its deadline or the model environment changed.");
  }
  const metrics = { ...finalization.metrics, input_cutoff: inputCutoff, decision_as_of: statedCutoff,
    decision_as_of_by_game: { [gameId]: statedCutoff } };
  return { snapshot, rows, metrics, outputHash };
}

/** Run-scoped read caches: one set per writer run, or per pregame collection. */
function createForgeRunCaches() {
  return {
    activeRosterSkaterIdsByTeamId: new Map<number, number[]>(),
    goalieEvidenceCache: new Map<string, GoalieEvidence>(),
    teamStrengthCache: new Map<string, TeamStrengthAverages>(),
    leaguePhysicalTotalsCache: new Map<string, LeaguePhysicalTotals | null>(),
    // One league save % read per run and date, shared by the skater and goalie stages.
    leagueSavePctCache: new Map() as SeasonLeagueSavePctCache,
    teamHorizonScalarsCache: new Map<string, number[]>(),
    teamSkaterRoleHistoryCache: new Map<string, Map<number, string[]>>(),
  };
}

/** Per-game read caches and stage outputs shared by the skater and goalie stages. */
function createForgeGameCaches() {
  return {
    teamShotsByTeamId: new Map<number, { shotsEs: number; shotsPp: number }>(),
    teamGoalsByTeamId: new Map<number, number>(),
    fallbackGoalieByTeamId: new Map<number, number | null>(),
    teamGoalieStarterContextCache: new Map<string, TeamGoalieStarterContext>(),
    teamDefensiveEnvironmentCache: new Map<string, TeamDefensiveEnvironment>(),
    teamOffenseEnvironmentCache: new Map<string, TeamOffenseEnvironment>(),
    teamRestDaysCache: new Map<string, number | null>(),
    teamStrengthPriorCache: new Map<string, TeamStrengthPrior | null>(),
    teamFiveOnFiveProfileCache: new Map<string, TeamFiveOnFiveProfile | null>(),
    teamNstExpectedGoalsCache: new Map<string, TeamNstExpectedGoalsProfile | null>(),
    teamLineComboGoaliePriorCache: new Map<string, Map<number, number>>(),
    goalieWorkloadContextCache: new Map<string, GoalieWorkloadContext>(),
    goalieRestSplitProfileCache: new Map<string, GoalieRestSplitProfile | null>(),
    currentTeamGoalieIdsCache: new Map<string, Set<number>>(),
    playerPredictionOutputRows: [] as Array<Record<string, unknown>>,
    modelMarketFlagRows: [] as Array<Record<string, unknown>>,
    selectedGoalieByTeamId: new Map<number, SelectedGoalieProjection>(),
    goalieCandidates: [] as GoalieStageCandidate[],
  };
}

type ForgeStageBase = {
  asOfDate: string; runId: string; horizonGames: number; game: GameRow; deadlineMs: number;
  seasonBootstrap?: boolean; evidenceCutoffAt: string | null;
  skaterRollout: ReturnType<typeof resolveSkaterRolloutConfig>;
  preflight: Awaited<ReturnType<typeof runProjectionPreflightStage>>;
  runCaches: ReturnType<typeof createForgeRunCaches>;
  gameCaches: ReturnType<typeof createForgeGameCaches>;
};

/** The skater stage's arguments for one game; the writer and the pregame collector build them only here. */
function forgeSkaterStageArgs(base: ForgeStageBase, learningCounters: SkaterStageArgs["learningCounters"],
  metrics: Record<string, any>): SkaterStageArgs {
  const { preflight, runCaches, gameCaches } = base;
  return {
    asOfDate: base.asOfDate,
    runId: base.runId,
    horizonGames: base.horizonGames,
    game: base.game,
    deadlineMs: base.deadlineMs,
    currentSeasonId: preflight.currentSeasonId,
    seasonBootstrap: base.seasonBootstrap,
    skaterRollout: base.skaterRollout,
    teamAbbreviationById: preflight.teamAbbreviationById,
    ...applyDailyBoardEvidence({
      gameId: base.game.id, evidence: preflight.dailyBoardEvidence,
      playerAvailabilityMultiplier: preflight.playerAvailabilityMultiplier,
      availabilityEventByPlayer: preflight.availabilityEventByPlayer, roleEventByPlayer: preflight.roleEventByPlayer,
      ppEventByPlayer: preflight.ppEventByPlayer, goalieOverrideByTeamId: preflight.goalieOverrideByTeamId,
    }),
    dailyBoardEvidence: preflight.dailyBoardEvidence,
    activeRosterSkaterIdsByTeamId: runCaches.activeRosterSkaterIdsByTeamId,
    teamHorizonScalarsCache: runCaches.teamHorizonScalarsCache,
    teamSkaterRoleHistoryCache: runCaches.teamSkaterRoleHistoryCache,
    teamShotsByTeamId: gameCaches.teamShotsByTeamId,
    teamGoalsByTeamId: gameCaches.teamGoalsByTeamId,
    fallbackGoalieByTeamId: gameCaches.fallbackGoalieByTeamId,
    teamGoalieStarterContextCache: gameCaches.teamGoalieStarterContextCache,
    teamDefensiveEnvironmentCache: gameCaches.teamDefensiveEnvironmentCache,
    teamOffenseEnvironmentCache: gameCaches.teamOffenseEnvironmentCache,
    teamRestDaysCache: gameCaches.teamRestDaysCache,
    teamStrengthPriorCache: gameCaches.teamStrengthPriorCache,
    teamStrengthCache: runCaches.teamStrengthCache,
    leaguePhysicalTotalsCache: runCaches.leaguePhysicalTotalsCache,
    // One league save % read per run and date, shared with the goalie stage below.
    leagueSavePctCache: runCaches.leagueSavePctCache,
    teamFiveOnFiveProfileCache: gameCaches.teamFiveOnFiveProfileCache,
    teamNstExpectedGoalsCache: gameCaches.teamNstExpectedGoalsCache,
    teamLineComboGoaliePriorCache: gameCaches.teamLineComboGoaliePriorCache,
    currentTeamGoalieIdsCache: gameCaches.currentTeamGoalieIdsCache,
    playerPropContextByGamePlayerKey: preflight.playerPropContextByGamePlayerKey,
    playerPredictionOutputRows: gameCaches.playerPredictionOutputRows,
    modelMarketFlagRows: gameCaches.modelMarketFlagRows,
    goalieCandidates: gameCaches.goalieCandidates,
    learningCounters,
    metrics,
  };
}

/** The goalie stage's arguments for one game; the writer and the pregame collector build them only here. */
function forgeGoalieStageArgs(base: ForgeStageBase, metrics: { warnings: string[] }): GoalieStageArgs {
  const { preflight, runCaches, gameCaches } = base;
  return {
    seasonBootstrap: base.seasonBootstrap,
    dailyBoardEvidence: preflight.dailyBoardEvidence,
    evidenceCutoffAt: base.evidenceCutoffAt,
    asOfDate: base.asOfDate,
    runId: base.runId,
    horizonGames: base.horizonGames,
    game: base.game,
    deadlineMs: base.deadlineMs,
    goalieCandidates: gameCaches.goalieCandidates,
    teamShotsByTeamId: gameCaches.teamShotsByTeamId,
    teamGoalsByTeamId: gameCaches.teamGoalsByTeamId,
    teamAbbreviationById: preflight.teamAbbreviationById,
    teamStrengthPriorCache: gameCaches.teamStrengthPriorCache,
    teamFiveOnFiveProfileCache: gameCaches.teamFiveOnFiveProfileCache,
    teamNstExpectedGoalsCache: gameCaches.teamNstExpectedGoalsCache,
    teamDefensiveEnvironmentCache: gameCaches.teamDefensiveEnvironmentCache,
    teamOffenseEnvironmentCache: gameCaches.teamOffenseEnvironmentCache,
    teamRestDaysCache: gameCaches.teamRestDaysCache,
    teamGoalieStarterContextCache: gameCaches.teamGoalieStarterContextCache,
    goalieEvidenceCache: runCaches.goalieEvidenceCache,
    goalieWorkloadContextCache: gameCaches.goalieWorkloadContextCache,
    goalieRestSplitProfileCache: gameCaches.goalieRestSplitProfileCache,
    teamHorizonScalarsCache: runCaches.teamHorizonScalarsCache,
    playerPropContextByGamePlayerKey: preflight.playerPropContextByGamePlayerKey,
    selectedGoalieByTeamId: gameCaches.selectedGoalieByTeamId,
    playerPredictionOutputRows: gameCaches.playerPredictionOutputRows,
    modelMarketFlagRows: gameCaches.modelMarketFlagRows,
    gameMarketSummary: preflight.gameMarketContextByGameId.get(base.game.id),
    leagueSavePctCache: runCaches.leagueSavePctCache,
    metrics,
  };
}

/**
 * Stored PBP and shift-chart completeness of each slate team's previous game, read the same way by the writer and the
 * native-input collector. The previous game is the team's newest game before both the target date and the Eastern
 * date of the information cutoff, so a forward-dated run checks games already played. (Audit L1: the target game
 * itself is always pregame, so checking it counted every game.) A game shared by two slate teams is checked once.
 */
async function readForgeGameCompleteness(
  game: GameRow,
  decisionAsOf: string,
  checkedGameIds: Set<number>,
  metrics: Record<string, any>,
) {
  const cutoffDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(decisionAsOf));
  const beforeDate = game.date < cutoffDate ? game.date : cutoffDate;
  for (const teamId of [game.homeTeamId, game.awayTeamId]) {
    const { data, error } = await supabase
      .from("games")
      .select("id,date")
      .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
      .lt("date", beforeDate)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const previousGameId = Number((data as { id?: unknown } | null)?.id);
    if (!Number.isSafeInteger(previousGameId) || previousGameId <= 0 || checkedGameIds.has(previousGameId)) continue;
    checkedGameIds.add(previousGameId);
    if (!(await hasCompleteStoredPbpGame(previousGameId))) {
      metrics.data_quality.missing_pbp_games += 1;
      metrics.warnings.push(`previous game ${previousGameId} of team=${teamId} (before game=${game.id}) has no complete stored PBP`);
    } else if ((await classifyStoredShiftChartStrengthGame({ gameId: previousGameId })).status !== "complete") {
      metrics.data_quality.missing_shift_totals += 1;
      metrics.warnings.push(`previous game ${previousGameId} of team=${teamId} (before game=${game.id}) has incomplete stored shift totals`);
    }
  }
}

export type ForgeNativeCandidates = { skaters: number[]; goalies: number[]; reserves: number[] };

/**
 * The writer's native reads for one slate scope, with no scoring and no writes: preflight, each game's PBP and shift
 * completeness, both teams' skater loaders and the goalie loader, built from the same stage arguments as
 * runProjectionCalculations. Data-quality bookkeeping goes to a scratch object. Candidate sets are what the loaders
 * selected: lineup skaters, goalie candidates with roster goalies (when the reserve pass is on), reserve skaters.
 */
export async function loadForgeNativeInputs(asOfDate: string, opts: {
  gameIds: number[]; decisionAsOf: string; deadlineMs: number; seasonBootstrap?: boolean;
}): Promise<{ candidates: ForgeNativeCandidates }> {
  const metrics = { warnings: [] as string[], data_quality: { trend_adjustment_fetch_failures: 0 } as Record<string, any> };
  const learningCounters = { players: 0, goalRecent: 0, assistRecent: 0 };
  const preflight = await runProjectionPreflightStage({
    asOfDate,
    decisionAsOf: opts.decisionAsOf,
    requestedGameIds: opts.gameIds,
  });
  const runCaches = createForgeRunCaches();
  const skaterRollout = resolveSkaterRolloutConfig();
  const skaters = new Set<number>(), goalies = new Set<number>(), reserves = new Set<number>();
  const completenessCheckedGameIds = new Set<number>();
  for (const game of (preflight.games ?? []) as GameRow[]) {
    if (Date.now() > opts.deadlineMs) throw new Error("FORGE native input collection passed its deadline.");
    await readForgeGameCompleteness(game, opts.decisionAsOf, completenessCheckedGameIds, metrics);
    const gameCaches = createForgeGameCaches();
    const base: ForgeStageBase = {
      asOfDate, runId: "native-input-collection", horizonGames: 1, game, deadlineMs: opts.deadlineMs,
      seasonBootstrap: opts.seasonBootstrap, evidenceCutoffAt: opts.decisionAsOf, skaterRollout, preflight, runCaches, gameCaches,
    };
    const teams = await loadSkaterGameInputs(forgeSkaterStageArgs(base, learningCounters, metrics));
    // The writer runs on without trend modifiers when the trend-band read fails or is incomplete; a capture refuses.
    if (metrics.data_quality.trend_adjustment_fetch_failures > 0) {
      throw new Error(`Native input collection refuses: the sustainability trend-band read failed for ${metrics.data_quality.trend_adjustment_fetch_failures} team(s).`);
    }
    for (const team of teams) {
      // The writer adds a team's goalie candidates once its compute completes; every loaded team completes.
      if (team.goalieCandidate) gameCaches.goalieCandidates.push(team.goalieCandidate);
      team.lineupPlayerIds.forEach((id) => skaters.add(id));
      team.reserveCandidates.forEach((candidate) => reserves.add(candidate.playerId));
    }
    const projectedTeamIds = new Set(teams.map((team) => team.teamId));
    const goalieInputs = await goalieStageLoaders.game(forgeGoalieStageArgs(base, metrics), (teamId) => projectedTeamIds.has(teamId));
    for (const ids of goalieInputs.goalieIdsByTeamId.values()) ids.forEach((id) => goalies.add(id));
  }
  const sorted = (ids: Set<number>) => [...ids].sort((a, b) => a - b);
  return { candidates: { skaters: sorted(skaters), goalies: sorted(goalies), reserves: sorted(reserves) } };
}

async function runProjectionCalculations(
  asOfDate: string,
  opts: RunProjectionOptions | undefined,
  runId: string,
  claim?: ForgeRunClaim,
  lifecycle?: { omitPregameSidecars?: boolean },
): Promise<RunProjectionResult> {
  const skaterRollout = resolveSkaterRolloutConfig();
  const completedGameIds = new Set(claim?.completedGameIds ?? []);

  const metrics: Record<string, any> = {
    as_of_date: asOfDate,
    horizon_games: clampHorizonGames(opts?.horizonGames ?? 1),
    input_provenance: buildForgeInputProvenance(),
    decision_as_of: opts?.decisionAsOf,
    board_lease: opts?.boardLease ?? null,
    analytics_sidecar: {
      version: "forge-analytics-sidecar-scope-v1",
      status: opts?.localAttempt ? "omitted_fenced_local_attempt"
        : lifecycle?.omitPregameSidecars ? "omitted_fenced_pregame_publication" : "enabled",
    },
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
      physical_league_totals_unavailable: 0,
      missing_pp_metrics_players: 0,
      deployment_prior_profiles_found: 0,
      deployment_prior_toi_blends_applied: 0,
      shot_quality_profiles_found: 0,
      shot_quality_adjustments_applied: 0,
      on_ice_context_profiles_found: 0,
      on_ice_context_adjustments_applied: 0,
      trend_adjustment_candidate_rows: 0,
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

    const runCaches = createForgeRunCaches();
    const learningCounters = {
      players: 0,
      goalRecent: 0,
      assistRecent: 0,
    };

    const deadlineMs = safeNumber(opts?.deadlineMs, Number.POSITIVE_INFINITY);
    let timedOut = false;

    // A resumed run continues the totals its earlier invocations stored.
    const prior = claim?.resumed ? (claim.priorMetrics as Record<string, any>) : null;
    if (prior) {
      metrics.started_at = prior.started_at ?? metrics.started_at;
      metrics.games = safeNumber(prior.games, 0);
      metrics.warnings = Array.isArray(prior.warnings) ? [...prior.warnings] : [];
      Object.assign(metrics.data_quality, prior.data_quality ?? {});
      learningCounters.players = safeNumber(prior.learning?.players_considered, 0);
      learningCounters.goalRecent = safeNumber(prior.learning?.goal_rate_recent_players, 0);
      learningCounters.assistRecent = safeNumber(prior.learning?.assist_rate_recent_players, 0);
    }
    let playerRowsUpserted = safeNumber(prior?.player_rows, 0);
    let teamRowsUpserted = safeNumber(prior?.team_rows, 0);
    let goalieRowsUpserted = safeNumber(prior?.goalie_rows, 0);

    const slateGames = (games ?? []) as GameRow[];
    const pendingGames = slateGames.filter((game) => !completedGameIds.has(game.id));
    // An earlier invocation may have stopped partway through one of these games.
    if (claim?.resumed) await clearRunGameRows(runId, pendingGames.map((game) => game.id));
    // Totals as of the last finished game; a stopped run stores these, not the
    // partial counts of the game it was in.
    const takeCheckpoint = () => {
      const snapshot = structuredClone(metrics);
      runMetricsFinalizationStage({
        metrics: snapshot as ProjectionMetricsFinalizationTarget,
        playerRowsUpserted,
        teamRowsUpserted,
        goalieRowsUpserted,
        learningCounters,
        timedOut: false,
      });
      delete snapshot.finished_at;
      delete snapshot.timed_out;
      return { metrics: snapshot, playerRowsUpserted, teamRowsUpserted, goalieRowsUpserted };
    };
    let checkpoint = claim ? takeCheckpoint() : null;
    const resumeSummary = () => ({
      resumed: claim!.resumed,
      invocations: claim!.invocations,
      completedGames: slateGames.filter((game) => completedGameIds.has(game.id)).length,
      totalGames: slateGames.length,
      pendingGames: slateGames.filter((game) => !completedGameIds.has(game.id)).length,
    });

    // A resumable run pauses cheaply, so after its first game it starts another
    // only while the slowest game so far still fits before the deadline. The
    // deadline then bounds when games end, not just when they start.
    let slowestGameMs = 0;
    const completenessCheckedGameIds = new Set<number>();
    gamesLoop: for (const game of pendingGames) {
      const gameStartedAt = Date.now();
      if (gameStartedAt > deadlineMs || (claim && gameStartedAt + slowestGameMs > deadlineMs)) {
        timedOut = true;
        break gamesLoop;
      }
      // Ownership is re-confirmed at each game and stage boundary (a no-op
      // outside a claimed run); each write checks only the lease deadline.
      await assertRunStillOwned();
      await readForgeGameCompleteness(game, opts?.decisionAsOf ?? new Date().toISOString(), completenessCheckedGameIds, metrics);

      // Removed: const lineCombos = await fetchLineCombinations(game.id);
      // We now fetch per-team latest LCs inside the loop.

      const gameCaches = createForgeGameCaches();
      const { teamGoalsByTeamId, playerPredictionOutputRows, modelMarketFlagRows, selectedGoalieByTeamId } = gameCaches;

      const stageBase = {
        asOfDate, runId, horizonGames, game, deadlineMs, seasonBootstrap: opts?.seasonBootstrap,
        evidenceCutoffAt: opts?.decisionAsOf ?? null, skaterRollout, preflight, runCaches, gameCaches,
      };
      const skaterStageResult = await runPerGameSkaterStage(forgeSkaterStageArgs(stageBase, learningCounters, metrics));
      playerRowsUpserted += skaterStageResult.playerRowsUpserted;
      teamRowsUpserted += skaterStageResult.teamRowsUpserted;
      if (skaterStageResult.timedOut) {
        timedOut = true;
        break gamesLoop;
      }

      // Create goalie projections after both teams are projected so we can use opponent shots.
      await assertRunStillOwned();
      const goalieStageResult = await runPerGameGoalieStage(forgeGoalieStageArgs(stageBase, metrics as { warnings: string[] }));
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
      // Totals and spreads are compared per book in probability space
      // (decision 30): spread = P(home covers) with the overtime rule stated,
      // against each book's de-vigged pair; lines are never averaged.
      modelMarketFlagRows.push(
        ...buildGameMarketFlagRows({
          asOfDate,
          gameId: game.id,
          homeExpectedGoals,
          awayExpectedGoals,
          homeTeamAbbreviation:
            teamAbbreviationById.get(game.homeTeamId) ?? null,
          awayTeamAbbreviation:
            teamAbbreviationById.get(game.awayTeamId) ?? null,
          totalsSummary: gameMarketSummary["totals"],
          spreadsSummary: gameMarketSummary["spreads"],
          metadata: {
            horizon_games: horizonGames,
            run_id: runId,
          },
        }),
      );

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

      // Issued revisions use the FORGE rows. The optional analytics replacement
      // deletes prior sidecar rows, outside the fenced local transport contract.
      if (!opts?.localAttempt && !lifecycle?.omitPregameSidecars) {
        await assertRunStillOwned();
        await persistPerGameAnalyticsOutputs({
          asOfDate,
          gameId: game.id,
          modelName: ANALYTICS_MODEL_NAME,
          modelVersion: ANALYTICS_MODEL_VERSION,
          playerPredictionOutputRows,
          gamePredictionOutput,
          modelMarketFlagRows,
        });
      }

      metrics.games += 1;
      if (claim) {
        completedGameIds.add(game.id);
        checkpoint = takeCheckpoint();
        await writeClaimedRun(claim, {
          status: "running",
          metrics: checkpoint.metrics,
          completedGameIds: [...completedGameIds],
          leaseExpiresAt: resumableRunLeaseExpiresAt(opts?.deadlineMs),
        });
      }
      slowestGameMs = Math.max(slowestGameMs, Date.now() - gameStartedAt);
    }

    if (claim && checkpoint && timedOut) {
      // Leave the run running and release the lease for the next invocation.
      await writeClaimedRun(claim, {
        status: "running",
        metrics: checkpoint.metrics,
        completedGameIds: [...completedGameIds],
      });
      return {
        runId,
        gamesProcessed: checkpoint.metrics.games,
        playerRowsUpserted: checkpoint.playerRowsUpserted,
        teamRowsUpserted: checkpoint.teamRowsUpserted,
        goalieRowsUpserted: checkpoint.goalieRowsUpserted,
        timedOut,
        resume: resumeSummary(),
      };
    }

    runMetricsFinalizationStage({
      metrics: metrics as ProjectionMetricsFinalizationTarget,
      playerRowsUpserted,
      teamRowsUpserted,
      goalieRowsUpserted,
      learningCounters,
      timedOut,
    });

    if (claim) {
      await writeClaimedRun(claim, {
        status: "succeeded",
        metrics,
        completedGameIds: [...completedGameIds],
      });
    } else {
      await finalizeRun(runId, timedOut ? "failed" : "succeeded", metrics);
    }
    return {
      runId,
      gamesProcessed: metrics.games,
      playerRowsUpserted,
      teamRowsUpserted,
      goalieRowsUpserted,
      timedOut,
      ...(claim ? { resume: resumeSummary() } : {}),
    };
  } catch (e) {
    metrics.finished_at = new Date().toISOString();
    metrics.error = getErrorMessage(e);
    if (!claim) {
      await finalizeRun(runId, "failed", metrics);
    } else if ((e as { code?: unknown })?.code !== "RUN_LEASE_LOST") {
      // Another invocation that took the run over owns its outcome.
      await writeClaimedRun(claim, {
        status: "failed",
        metrics,
        completedGameIds: [...completedGameIds],
      }).catch((writeError) => {
        if ((writeError as { code?: unknown })?.code !== "RUN_LEASE_LOST") throw writeError;
      });
    }
    throw e;
  }
}
