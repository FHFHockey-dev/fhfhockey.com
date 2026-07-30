import supabase from "lib/supabase/server";
import { resolveNullableCompatibilityValue } from "lib/rollingPlayerMetricCompatibility";
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
} from "../types/run-forge-projections.types";
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
} from "../constants/projection-weights";
import {
  blendOnlineRate,
  clamp,
  computeRate,
  computeShotsFromRate,
  finiteOrNull,
  safeNumber,
  safeStdDev,
  sigmoid,
} from "../utils/number-utils";
import {
  buildSequentialHorizonScalarsFromDates,
  clampHorizonGames,
  daysBetweenDates,
  parseDateOnly,
} from "../utils/date-utils";
import {
  pickLatestByPlayer,
  toFiniteNumberArray,
} from "../utils/collection-utils";
import {
  augmentStarterModelMetaWithScenarioProjections,
  buildGoalieUncertaintyWithModel,
  buildSkaterUncertaintyWithModel,
  buildStarterHeuristicMetadata,
  buildStarterOverrideMetadata,
} from "../utils/projection-metadata-builders";
import {
  fetchLatestSkaterOnIceContextProfiles,
  fetchLatestSkaterShotQualityProfiles,
  fetchLatestSkaterTrendAdjustments,
  fetchLatestWgoSkaterDeploymentProfiles,
  fetchRollingRows,
} from "../queries/skater-queries";
import { type MarketTypeSummary } from "../queries/market-queries";
import {
  fetchCurrentTeamGoalieIds,
  fetchGoalieEvidence,
  fetchGoalieRestSplitProfile,
  fetchGoalieWorkloadContext,
  fetchLatestGoalieForTeam,
  fetchOpponentGoalieContextForGame,
  fetchTeamGoalieStarterContext,
  fetchTeamLineComboGoaliePrior,
} from "../queries/goalie-queries";
import {
  fetchTeamDefensiveEnvironment,
  fetchTeamFiveOnFiveProfile,
  fetchTeamNstExpectedGoalsProfile,
  fetchTeamOffenseEnvironment,
  fetchTeamRestDays,
  fetchTeamStrengthAverages,
  fetchTeamStrengthPrior,
  type TeamStrengthAverages,
} from "../queries/team-context-queries";
import { createRun, finalizeRun } from "../queries/run-lifecycle-queries";
import {
  computeSkaterOnIceContextAdjustments,
  computeSkaterOpponentGoalieContextAdjustments,
  computeSkaterRestScheduleAdjustments,
  computeSkaterSampleShrinkageAdjustments,
  computeSkaterShotQualityAdjustments,
  computeSkaterTeamLevelContextAdjustments,
  computeStrengthSplitConversionRates,
} from "../calculators/skater-adjustments";
import {
  blendTopStarterScenarioOutputs,
  buildTopStarterScenarios,
  computeStarterProbabilities,
  selectStarterCandidateGoalieIds,
} from "../calculators/goalie-starter";
import {
  computeGoalieRestSplitSavePctAdjustment,
  computeWorkloadSavePctPenalty,
  toGoalieRestSplitBucket,
} from "../calculators/goalie-save-pct-context";
import {
  blendSkaterScenarioStatLines,
  blendSkaterScenarioStatLinesAcrossHorizon,
  buildSkaterScenarioMetadata,
  computeSkaterTeamToiTargetWithPoolGuard,
  validateReconciledPlayerDistribution,
} from "../calculators/scenario-blending";
import {
  computeNstOpponentDangerAdjustment,
  computeTeamFiveOnFiveContextAdjustment,
  computeTeamStrengthContextAdjustment,
} from "../calculators/team-context-adjustments";
import {
  availabilityMultiplierForEvent,
  runProjectionPreflightStage,
} from "../stages/preflight-stage";
import {
  runMetricsFinalizationStage,
  type ProjectionMetricsFinalizationTarget,
} from "../stages/metrics-finalization-stage";
import {
  persistForgeGoalieProjection,
  persistForgePlayerProjectionRows,
  persistForgeTeamProjection,
  persistPerGameAnalyticsOutputs,
} from "../stages/persistence-stage";
import {
  runPerGameGoalieStage,
  type GoalieStageCandidate,
  type SelectedGoalieProjection,
} from "../stages/goalie-stage";
import {
  ANALYTICS_MODEL_NAME,
  ANALYTICS_MODEL_VERSION,
  buildModelMarketFlagRow,
  GAME_MARKET_EDGE_THRESHOLDS,
  getConsensusLineValue,
  getProjectionValueForPropMarket,
  PLAYER_MARKET_EDGE_THRESHOLDS,
} from "../utils/market-output-builders";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

const FALLBACK_SKATER_LOOKBACK_DAYS = 120;

export function normalizeWgoToiToSeconds(
  value: number | null | undefined,
): number | null {
  const n = finiteOrNull(value);
  if (n == null || n <= 0) return null;
  // WGO TOI/game fields are typically in minutes, but tolerate second-like values.
  if (n <= 60) return Number((n * 60).toFixed(3));
  if (n <= 3600) return Number(n.toFixed(3));
  return 3600;
}

export function blendToiSecondsWithDeploymentPrior(args: {
  rollingSeconds: number | null;
  deploymentPriorSeconds: number | null;
  rollingWeight: number;
}): number | null {
  const rolling = finiteOrNull(args.rollingSeconds);
  const prior = finiteOrNull(args.deploymentPriorSeconds);
  const rollingWeight = clamp(args.rollingWeight, 0, 1);
  if (rolling == null && prior == null) return null;
  if (rolling == null) return prior;
  if (prior == null) return rolling;
  return Number(
    (rollingWeight * rolling + (1 - rollingWeight) * prior).toFixed(3),
  );
}

async function fetchLatestLineCombinationForTeam(
  teamId: number,
  asOfDate: string,
): Promise<LineCombinationContext> {
  try {
    const row = (
      await fetchRecentTeamLineCombinations({
        teamId,
        asOfDate,
        limit: 1,
      })
    )[0];
    if (!row) return { lineCombination: null, sourceGameDate: null };

    return {
      lineCombination: {
        gameId: Number(row.gameId),
        teamId: Number(row.teamId ?? teamId),
        forwards: toFiniteNumberArray(row.forwards),
        defensemen: toFiniteNumberArray(row.defensemen),
        goalies: toFiniteNumberArray(row.goalies),
      },
      sourceGameDate:
        typeof row.games?.date === "string" ? row.games.date : null,
    };
  } catch (error) {
    console.warn(
      `Error fetching latest LC for team ${teamId} before ${asOfDate}:`,
      error,
    );
    return { lineCombination: null, sourceGameDate: null };
  }
}

async function fetchFallbackSkaterIdsForTeam(
  teamId: number,
  seasonId: number,
  asOfDate: string,
  maxPlayers = 18,
): Promise<number[]> {
  assertSupabase();
  const lookbackStart = new Date(
    new Date(`${asOfDate}T00:00:00.000Z`).getTime() -
      FALLBACK_SKATER_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .split("T")[0];
  const maxRows = Math.max(80, Math.floor(maxPlayers) * 8);

  const { data, error } = await supabase
    .from("rolling_player_game_metrics")
    .select("player_id,game_date,toi_seconds_avg_last5,toi_seconds_avg_all")
    .eq("season", seasonId)
    .eq("team_id", teamId)
    .eq("strength_state", "ev")
    .lt("game_date", asOfDate)
    .gte("game_date", lookbackStart)
    .order("game_date", { ascending: false })
    .limit(maxRows);
  if (error) throw error;

  const latestByPlayer = new Map<number, { gameDate: string; toi: number }>();
  for (const row of (data ?? []) as RollingSkaterMetricRow[]) {
    const playerId = Number(row.player_id);
    const gameDate = typeof row.game_date === "string" ? row.game_date : null;
    if (!Number.isFinite(playerId) || !gameDate) continue;
    const toi = safeNumber(
      row.toi_seconds_avg_last5,
      safeNumber(row.toi_seconds_avg_all, 0),
    );
    const existing = latestByPlayer.get(playerId);
    if (!existing || gameDate > existing.gameDate) {
      latestByPlayer.set(playerId, { gameDate, toi });
    }
  }

  return Array.from(latestByPlayer.entries())
    .sort((a, b) => {
      const toiDelta = b[1].toi - a[1].toi;
      if (Math.abs(toiDelta) > 1e-9) return toiDelta;
      return b[1].gameDate.localeCompare(a[1].gameDate);
    })
    .slice(0, Math.max(1, Math.floor(maxPlayers)))
    .map(([playerId]) => playerId);
}

async function fetchActiveRosterSkaterIdsForTeamSeason(
  teamId: number,
  seasonId: number,
  maxPlayers = SKATER_POOL_SUPPLEMENTAL_FETCH_COUNT,
): Promise<number[]> {
  assertSupabase();
  const { data, error } = await supabase
    .from("rosters")
    .select("playerId")
    .eq("teamId", teamId)
    .eq("seasonId", seasonId)
    .eq("is_current", true)
    .order("playerId", { ascending: true })
    .limit(Math.max(1, Math.floor(maxPlayers)));
  if (error) throw error;

  return Array.from(
    new Set(
      (data ?? [])
        .map((row: RosterPlayerIdRow) => Number(row.playerId))
        .filter((id) => Number.isFinite(id)),
    ),
  );
}

export function constrainSkaterIdsToActiveRoster(args: {
  candidateSkaterIds: number[];
  activeRosterSkaterIds: number[];
  fallbackCount?: number;
}): number[] {
  const fallbackCount = Number.isFinite(args.fallbackCount)
    ? Math.max(1, Math.floor(Number(args.fallbackCount)))
    : SKATER_POOL_TARGET_COUNT;
  const activeSet = new Set(
    args.activeRosterSkaterIds.filter((id) => Number.isFinite(id)),
  );
  if (activeSet.size === 0) {
    return Array.from(new Set(args.candidateSkaterIds)).filter((id) =>
      Number.isFinite(id),
    );
  }
  const constrained = Array.from(new Set(args.candidateSkaterIds)).filter(
    (id) => activeSet.has(id),
  );
  if (constrained.length > 0) return constrained;
  return Array.from(activeSet).slice(0, fallbackCount);
}

async function fetchTeamSkaterRoleHistory(
  teamId: number,
  asOfDate: string,
  windowGames = SKATER_ROLE_HISTORY_WINDOW_GAMES,
): Promise<Map<number, string[]>> {
  const roleHistoryByPlayer = new Map<number, string[]>();
  const rows = await fetchRecentTeamLineCombinations({
    teamId,
    asOfDate,
    limit: windowGames,
  });
  for (const row of rows) {
    const forwards = toFiniteNumberArray(row.forwards);
    const defensemen = toFiniteNumberArray(row.defensemen);

    forwards.forEach((playerId: number, idx: number) => {
      const line = Math.floor(idx / 3) + 1;
      const role = `L${Math.min(4, Math.max(1, line))}`;
      const existing = roleHistoryByPlayer.get(playerId) ?? [];
      existing.push(role);
      roleHistoryByPlayer.set(playerId, existing);
    });
    defensemen.forEach((playerId: number, idx: number) => {
      const pair = Math.floor(idx / 2) + 1;
      const role = `D${Math.min(3, Math.max(1, pair))}`;
      const existing = roleHistoryByPlayer.get(playerId) ?? [];
      existing.push(role);
      roleHistoryByPlayer.set(playerId, existing);
    });
  }

  return roleHistoryByPlayer;
}

type ActiveSkaterFilterResult = {
  eligibleSkaterIds: number[];
  recencyMultiplierByPlayerId: Map<number, number>;
  stats: {
    filteredByTeamOrPosition: number;
    filteredMissingRecentMetrics: number;
    filteredHardStale: number;
    softStalePenalized: number;
  };
  excludedSkaterIdsByReason: {
    teamOrPosition: number[];
    missingRecentMetrics: number[];
    hardStale: number[];
  };
};

type LineCombinationRecencyAssessment = {
  isMissing: boolean;
  isSoftStale: boolean;
  isHardStale: boolean;
  daysStale: number | null;
};

type SkaterRoleTag = {
  esRole: string;
  unitTier: "TOP" | "MIDDLE" | "DEPTH";
  roleRank: number;
  source: "line_combination" | "fallback_toi_rank" | "roster_event";
};

type SkaterRoleContinuitySummary = {
  windowGames: number;
  appearancesTracked: number;
  gamesInCurrentRole: number;
  continuityShare: number;
  roleChangeRate: number;
  volatilityIndex: number;
};

export function assessLineCombinationRecency(args: {
  asOfDate: string;
  sourceGameDate: string | null;
  softDays?: number;
  hardDays?: number;
}): LineCombinationRecencyAssessment {
  const softDays = Number.isFinite(args.softDays)
    ? Math.max(0, Math.floor(Number(args.softDays)))
    : LINE_COMBO_STALE_SOFT_DAYS;
  const hardDays = Number.isFinite(args.hardDays)
    ? Math.max(softDays + 1, Math.floor(Number(args.hardDays)))
    : LINE_COMBO_STALE_HARD_DAYS;

  if (!args.sourceGameDate) {
    return {
      isMissing: true,
      isSoftStale: false,
      isHardStale: true,
      daysStale: null,
    };
  }

  const daysStale = Math.max(
    0,
    daysBetweenDates(args.asOfDate, args.sourceGameDate),
  );
  return {
    isMissing: false,
    isSoftStale: daysStale > softDays,
    isHardStale: daysStale > hardDays,
    daysStale,
  };
}

function parseRosterEventPayload(payload: unknown): Record<string, unknown> {
  return payload != null && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : {};
}

function roleTagFromRosterEvent(
  event: RosterEventRow | null,
): SkaterRoleTag | null {
  if (!event) return null;
  const payload = parseRosterEventPayload(event.payload);
  const role = typeof payload.role === "string" ? payload.role : null;
  const lineNumber = Number(payload.lineNumber ?? payload.line_number);
  const ppUnit = Number(payload.ppUnit ?? payload.pp_unit);

  if (event.event_type === "LINE_CHANGE") {
    const rank = Number.isFinite(lineNumber)
      ? Math.max(1, Math.floor(lineNumber))
      : 3;
    const clampedRank = Math.min(4, rank);
    return {
      esRole: role ?? `L${clampedRank}`,
      unitTier:
        clampedRank <= 1 ? "TOP" : clampedRank <= 3 ? "MIDDLE" : "DEPTH",
      roleRank: clampedRank,
      source: "roster_event",
    };
  }

  if (event.event_type === "PP_UNIT_CHANGE") {
    const rank = Number.isFinite(ppUnit) ? Math.max(1, Math.floor(ppUnit)) : 2;
    const clampedRank = Math.min(3, rank);
    return {
      esRole: role ?? `PP${clampedRank}`,
      unitTier:
        clampedRank === 1 ? "TOP" : clampedRank === 2 ? "MIDDLE" : "DEPTH",
      roleRank: clampedRank,
      source: "roster_event",
    };
  }

  return null;
}

function toSkaterPositionGroup(
  position: string | null | undefined,
): "F" | "D" | "OTHER" {
  const p = typeof position === "string" ? position.toUpperCase() : "";
  if (p === "D") return "D";
  if (p === "C" || p === "L" || p === "R" || p === "LW" || p === "RW")
    return "F";
  return "OTHER";
}

function tierFromRole(role: string): "TOP" | "MIDDLE" | "DEPTH" {
  if (role === "L1" || role === "D1") return "TOP";
  if (role === "L2" || role === "D2") return "MIDDLE";
  return "DEPTH";
}

export function buildSkaterRoleTags(args: {
  lineCombination: LineCombinationRow | null;
  useFallbackRoles: boolean;
  fallbackRankedSkaterIds: number[];
  playerMetaById: Map<number, PlayerTeamPositionRow>;
  teamId: number;
}): Map<number, SkaterRoleTag> {
  const roleByPlayerId = new Map<number, SkaterRoleTag>();
  const setRole = (
    playerId: number,
    esRole: string,
    roleRank: number,
    source: "line_combination" | "fallback_toi_rank",
  ) => {
    if (roleByPlayerId.has(playerId)) return;
    roleByPlayerId.set(playerId, {
      esRole,
      unitTier: tierFromRole(esRole),
      roleRank,
      source,
    });
  };

  if (args.lineCombination && !args.useFallbackRoles) {
    const forwards = (args.lineCombination.forwards ?? []).filter((id) => {
      if (!Number.isFinite(id)) return false;
      const meta = args.playerMetaById.get(id);
      return (
        Boolean(meta) &&
        meta?.team_id === args.teamId &&
        toSkaterPositionGroup(meta?.position) === "F"
      );
    });
    const defensemen = (args.lineCombination.defensemen ?? []).filter((id) => {
      if (!Number.isFinite(id)) return false;
      const meta = args.playerMetaById.get(id);
      return (
        Boolean(meta) &&
        meta?.team_id === args.teamId &&
        toSkaterPositionGroup(meta?.position) === "D"
      );
    });

    forwards.forEach((playerId, idx) => {
      const line = Math.floor(idx / 3) + 1;
      const clampedLine = Math.min(4, Math.max(1, line));
      setRole(playerId, `L${clampedLine}`, idx + 1, "line_combination");
    });
    defensemen.forEach((playerId, idx) => {
      const pair = Math.floor(idx / 2) + 1;
      const clampedPair = Math.min(3, Math.max(1, pair));
      setRole(playerId, `D${clampedPair}`, idx + 1, "line_combination");
    });
  }

  if (roleByPlayerId.size === 0 || args.useFallbackRoles) {
    const fallbackIds = Array.from(
      new Set(args.fallbackRankedSkaterIds),
    ).filter((id) => {
      const meta = args.playerMetaById.get(id);
      return (
        Boolean(meta) && meta?.team_id === args.teamId && meta?.position !== "G"
      );
    });
    const forwards: number[] = [];
    const defensemen: number[] = [];
    const other: number[] = [];
    for (const playerId of fallbackIds) {
      const group = toSkaterPositionGroup(
        args.playerMetaById.get(playerId)?.position,
      );
      if (group === "F") forwards.push(playerId);
      else if (group === "D") defensemen.push(playerId);
      else other.push(playerId);
    }
    forwards.forEach((playerId, idx) => {
      const line = Math.floor(idx / 3) + 1;
      const clampedLine = Math.min(4, Math.max(1, line));
      setRole(playerId, `L${clampedLine}`, idx + 1, "fallback_toi_rank");
    });
    defensemen.forEach((playerId, idx) => {
      const pair = Math.floor(idx / 2) + 1;
      const clampedPair = Math.min(3, Math.max(1, pair));
      setRole(playerId, `D${clampedPair}`, idx + 1, "fallback_toi_rank");
    });
    other.forEach((playerId, idx) => {
      setRole(
        playerId,
        "L4",
        forwards.length + defensemen.length + idx + 1,
        "fallback_toi_rank",
      );
    });
  }

  return roleByPlayerId;
}

export function summarizeSkaterRoleContinuity(args: {
  currentRole: string;
  recentRoles: string[];
  windowGames?: number;
}): SkaterRoleContinuitySummary {
  const windowGames = Number.isFinite(args.windowGames)
    ? Math.max(1, Math.floor(Number(args.windowGames)))
    : SKATER_ROLE_HISTORY_WINDOW_GAMES;
  const roles = args.recentRoles.slice(0, windowGames);
  const appearancesTracked = roles.length;
  if (appearancesTracked === 0) {
    return {
      windowGames,
      appearancesTracked: 0,
      gamesInCurrentRole: 0,
      continuityShare: 0,
      roleChangeRate: 0,
      volatilityIndex: 0,
    };
  }

  const gamesInCurrentRole = roles.filter((r) => r === args.currentRole).length;
  const continuityShare = gamesInCurrentRole / appearancesTracked;
  let roleChanges = 0;
  for (let i = 0; i < roles.length - 1; i += 1) {
    if (roles[i] !== roles[i + 1]) roleChanges += 1;
  }
  const roleChangeRate =
    appearancesTracked > 1 ? roleChanges / (appearancesTracked - 1) : 0;
  const volatilityIndex = new Set(roles).size / appearancesTracked;

  return {
    windowGames,
    appearancesTracked,
    gamesInCurrentRole,
    continuityShare: Number(continuityShare.toFixed(4)),
    roleChangeRate: Number(roleChangeRate.toFixed(4)),
    volatilityIndex: Number(volatilityIndex.toFixed(4)),
  };
}

export function computeSkaterRoleStabilityMultiplier(
  summary: SkaterRoleContinuitySummary,
): number {
  if (summary.appearancesTracked <= 1) return 1;

  let penalty = 0;
  let bonus = 0;
  if (summary.continuityShare < 0.6) {
    penalty += (0.6 - summary.continuityShare) * 0.35;
  }
  penalty += summary.roleChangeRate * 0.12;
  if (summary.volatilityIndex > 0.5) {
    penalty += (summary.volatilityIndex - 0.5) * 0.2;
  }
  if (summary.appearancesTracked >= 4 && summary.continuityShare >= 0.75) {
    bonus += Math.min(0.05, (summary.continuityShare - 0.75) * 0.2);
  }

  return clamp(Number((1 - penalty + bonus).toFixed(4)), 0.7, 1.05);
}

function adjacentRole(role: string): string {
  if (role.startsWith("L")) {
    const n = Number(role.slice(1));
    if (Number.isFinite(n)) return `L${Math.min(4, Math.max(1, n + 1))}`;
  }
  if (role.startsWith("D")) {
    const n = Number(role.slice(1));
    if (Number.isFinite(n)) return `D${Math.min(3, Math.max(1, n + 1))}`;
  }
  return "L4";
}

export function buildSkaterRoleScenarios(args: {
  roleTag: SkaterRoleTag | null;
  roleContinuity: SkaterRoleContinuitySummary | null;
  maxScenarios?: number;
}): SkaterRoleScenario[] {
  const maxScenarios = Number.isFinite(args.maxScenarios)
    ? Math.max(1, Math.floor(Number(args.maxScenarios)))
    : 3;
  const currentRole = args.roleTag?.esRole ?? "L4";
  const continuityShare = args.roleContinuity?.continuityShare ?? 0.55;
  const volatility = args.roleContinuity?.volatilityIndex ?? 0.4;

  const currentProb = clamp(
    0.55 + continuityShare * 0.3 - volatility * 0.2,
    0.45,
    0.9,
  );
  const adjacentProb = clamp(
    0.28 - continuityShare * 0.12 + volatility * 0.18,
    0.08,
    0.42,
  );
  const depthProb = clamp(1 - currentProb - adjacentProb, 0.03, 0.25);
  const scenarios: SkaterRoleScenario[] = [
    {
      role: currentRole,
      probability: currentProb,
      source: "current_role",
    },
    {
      role: adjacentRole(currentRole),
      probability: adjacentProb,
      source: "adjacent_role",
    },
    {
      role: currentRole.startsWith("D") ? "D3" : "L4",
      probability: depthProb,
      source: "depth_fallback",
    },
  ];

  const merged = new Map<string, SkaterRoleScenario>();
  for (const s of scenarios) {
    const existing = merged.get(s.role);
    if (!existing) {
      merged.set(s.role, { ...s });
      continue;
    }
    existing.probability += s.probability;
    merged.set(s.role, existing);
  }
  const normalized = Array.from(merged.values())
    .sort((a, b) => b.probability - a.probability)
    .slice(0, maxScenarios);
  const sum = normalized.reduce((acc, s) => acc + s.probability, 0);
  return normalized.map((s) => ({
    ...s,
    probability: Number(
      (sum > 0 ? s.probability / sum : 1 / normalized.length).toFixed(4),
    ),
  }));
}

function computeSkaterRecencyMultiplier(daysSinceLastMetric: number): number {
  if (daysSinceLastMetric <= SKATER_STALE_SOFT_DAYS) return 1;
  if (daysSinceLastMetric > SKATER_STALE_HARD_DAYS) return 0;
  const span = Math.max(1, SKATER_STALE_HARD_DAYS - SKATER_STALE_SOFT_DAYS);
  const progress = clamp(
    (daysSinceLastMetric - SKATER_STALE_SOFT_DAYS) / span,
    0,
    1,
  );
  return clamp(
    1 - progress * (1 - SKATER_SOFT_STALE_MIN_MULTIPLIER),
    SKATER_SOFT_STALE_MIN_MULTIPLIER,
    1,
  );
}

export function filterActiveSkaterCandidateIds(args: {
  asOfDate: string;
  teamId: number;
  rawSkaterIds: number[];
  playerMetaById: Map<number, PlayerTeamPositionRow>;
  latestMetricDateByPlayerId: Map<number, string>;
}): ActiveSkaterFilterResult {
  const uniqueRaw = Array.from(new Set(args.rawSkaterIds)).filter((id) =>
    Number.isFinite(id),
  );
  const eligibleSkaterIds: number[] = [];
  const recencyMultiplierByPlayerId = new Map<number, number>();
  const stats = {
    filteredByTeamOrPosition: 0,
    filteredMissingRecentMetrics: 0,
    filteredHardStale: 0,
    softStalePenalized: 0,
  };
  const excludedSkaterIdsByReason = {
    teamOrPosition: [] as number[],
    missingRecentMetrics: [] as number[],
    hardStale: [] as number[],
  };

  for (const playerId of uniqueRaw) {
    const meta = args.playerMetaById.get(playerId);
    const isSkater = Boolean(
      meta && meta.position != null && meta.position !== "G",
    );
    const isOnTeam = Boolean(
      meta && meta.team_id != null && meta.team_id === args.teamId,
    );
    if (!isSkater || !isOnTeam) {
      stats.filteredByTeamOrPosition += 1;
      excludedSkaterIdsByReason.teamOrPosition.push(playerId);
      continue;
    }

    const latestMetricDate =
      args.latestMetricDateByPlayerId.get(playerId) ?? null;
    if (!latestMetricDate) {
      stats.filteredMissingRecentMetrics += 1;
      excludedSkaterIdsByReason.missingRecentMetrics.push(playerId);
      continue;
    }

    const daysSinceLastMetric = Math.max(
      0,
      daysBetweenDates(args.asOfDate, latestMetricDate),
    );
    const recencyMultiplier =
      computeSkaterRecencyMultiplier(daysSinceLastMetric);
    if (recencyMultiplier <= 0) {
      stats.filteredHardStale += 1;
      excludedSkaterIdsByReason.hardStale.push(playerId);
      continue;
    }

    if (recencyMultiplier < 1) stats.softStalePenalized += 1;
    recencyMultiplierByPlayerId.set(playerId, recencyMultiplier);
    eligibleSkaterIds.push(playerId);
  }

  return {
    eligibleSkaterIds,
    recencyMultiplierByPlayerId,
    stats,
    excludedSkaterIdsByReason,
  };
}

export function mergeSkaterCandidatePoolForRecovery(args: {
  baseSkaterIds: number[];
  supplementalSkaterIds: number[];
  targetCount?: number;
}): number[] {
  const targetCount = Number.isFinite(args.targetCount)
    ? Math.max(1, Math.floor(Number(args.targetCount)))
    : SKATER_POOL_TARGET_COUNT;
  const out: number[] = [];
  const seen = new Set<number>();
  for (const id of [...args.baseSkaterIds, ...args.supplementalSkaterIds]) {
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= targetCount) break;
  }
  return out;
}

function roleBasedPpShareWeight(roleTag: SkaterRoleTag | null): number {
  if (!roleTag) return 0.65;
  if (roleTag.unitTier === "TOP") return 1.8;
  if (roleTag.unitTier === "MIDDLE") return 1.05;
  return 0.35;
}

export function allocatePpToiByTeamOpportunity(args: {
  projectedByPlayer: Map<
    number,
    {
      toiPp: number;
      roleTag: SkaterRoleTag | null;
    }
  >;
  targetTeamPpSeconds: number;
}): SkaterPpOpportunityAllocation {
  const players = Array.from(args.projectedByPlayer.entries());
  if (players.length === 0 || args.targetTeamPpSeconds <= 0) {
    return {
      perPlayerPpToiSeconds: new Map<number, number>(),
      playersReweighted: 0,
    };
  }

  const weighted = players.map(([playerId, p]) => {
    const basePpToi = Math.max(0, p.toiPp);
    const opportunityEvidence = Math.sqrt(basePpToi + 1);
    const roleWeight = roleBasedPpShareWeight(p.roleTag);
    const weight = roleWeight * opportunityEvidence;
    return { playerId, basePpToi, weight };
  });
  const weightSum = weighted.reduce((acc, cur) => acc + cur.weight, 0);
  if (!Number.isFinite(weightSum) || weightSum <= 0) {
    return {
      perPlayerPpToiSeconds: new Map<number, number>(),
      playersReweighted: 0,
    };
  }

  const perPlayerPpToiSeconds = new Map<number, number>();
  let playersReweighted = 0;
  for (const row of weighted) {
    const allocated = (row.weight / weightSum) * args.targetTeamPpSeconds;
    const value = Number(clamp(allocated, 0, 1400).toFixed(3));
    perPlayerPpToiSeconds.set(row.playerId, value);
    if (Math.abs(value - row.basePpToi) > 1e-3) playersReweighted += 1;
  }
  return { perPlayerPpToiSeconds, playersReweighted };
}

function roleGroupKeyForTeammateCoupling(
  roleTag: SkaterRoleTag | null,
): string | null {
  if (!roleTag) return null;
  if (roleTag.esRole.startsWith("L")) return roleTag.esRole;
  if (roleTag.esRole.startsWith("D")) return roleTag.esRole;
  return null;
}

export function computeTeammateAssistCoupling(args: {
  roleTag: SkaterRoleTag | null;
  playerShotsEs: number;
  lineGroupShotsEs: number;
  teamShotsEs: number;
  playerPpShare: number;
}): SkaterTeammateAssistCoupling {
  const roleTag = args.roleTag;
  const teamShotsEs = Math.max(0, args.teamShotsEs);
  const playerShotsEs = Math.max(0, args.playerShotsEs);
  const lineGroupShotsEs = Math.max(0, args.lineGroupShotsEs);
  const playerPpShare = clamp(args.playerPpShare, 0, 1);

  if (teamShotsEs <= 0) {
    return {
      assistRateEsMultiplier: 1,
      assistRatePpMultiplier: 1,
      dependencyScore: 0,
    };
  }

  const playerEsShare = clamp(playerShotsEs / teamShotsEs, 0, 0.5);
  const lineShare = clamp(lineGroupShotsEs / teamShotsEs, 0, 0.85);
  const lineMateShare = clamp(lineShare - playerEsShare, 0, 0.75);
  const tierWeight =
    roleTag?.unitTier === "TOP"
      ? 1
      : roleTag?.unitTier === "MIDDLE"
        ? 0.72
        : 0.48;
  const lineDependency = clamp(lineMateShare * 1.65 * tierWeight, 0, 0.5);
  const ppDependency = clamp(
    playerPpShare * (0.9 + 0.35 * tierWeight),
    0,
    0.65,
  );
  const dependencyScore = clamp(
    lineDependency * 0.6 + ppDependency * 0.4,
    0,
    1,
  );

  const assistRateEsMultiplier = clamp(
    1 + (lineDependency - 0.14) * 0.62,
    SKATER_TEAMMATE_ASSIST_ES_MIN_MULTIPLIER,
    SKATER_TEAMMATE_ASSIST_ES_MAX_MULTIPLIER,
  );
  const assistRatePpMultiplier = clamp(
    1 + (ppDependency - 0.18) * 0.75,
    SKATER_TEAMMATE_ASSIST_PP_MIN_MULTIPLIER,
    SKATER_TEAMMATE_ASSIST_PP_MAX_MULTIPLIER,
  );

  return {
    assistRateEsMultiplier: Number(assistRateEsMultiplier.toFixed(4)),
    assistRatePpMultiplier: Number(assistRatePpMultiplier.toFixed(4)),
    dependencyScore: Number(dependencyScore.toFixed(4)),
  };
}

export function applyRoleSpecificUsageBounds(args: {
  roleTag: SkaterRoleTag | null;
  toiEsSeconds: number;
  toiPpSeconds: number;
  sogPer60Es: number;
  sogPer60Pp: number;
}): SkaterRoleBoundedUsage {
  const tier = args.roleTag?.unitTier ?? "DEPTH";
  const limits =
    tier === "TOP"
      ? {
          toiEsMin: SKATER_ROLE_TOP_TOI_ES_MIN,
          toiEsMax: SKATER_ROLE_TOP_TOI_ES_MAX,
          toiPpMin: SKATER_ROLE_TOP_TOI_PP_MIN,
          toiPpMax: SKATER_ROLE_TOP_TOI_PP_MAX,
          sogEsMax: SKATER_ROLE_TOP_SOG_ES_MAX,
          sogPpMax: SKATER_ROLE_TOP_SOG_PP_MAX,
        }
      : tier === "MIDDLE"
        ? {
            toiEsMin: SKATER_ROLE_MIDDLE_TOI_ES_MIN,
            toiEsMax: SKATER_ROLE_MIDDLE_TOI_ES_MAX,
            toiPpMin: SKATER_ROLE_MIDDLE_TOI_PP_MIN,
            toiPpMax: SKATER_ROLE_MIDDLE_TOI_PP_MAX,
            sogEsMax: SKATER_ROLE_MIDDLE_SOG_ES_MAX,
            sogPpMax: SKATER_ROLE_MIDDLE_SOG_PP_MAX,
          }
        : {
            toiEsMin: SKATER_ROLE_DEPTH_TOI_ES_MIN,
            toiEsMax: SKATER_ROLE_DEPTH_TOI_ES_MAX,
            toiPpMin: SKATER_ROLE_DEPTH_TOI_PP_MIN,
            toiPpMax: SKATER_ROLE_DEPTH_TOI_PP_MAX,
            sogEsMax: SKATER_ROLE_DEPTH_SOG_ES_MAX,
            sogPpMax: SKATER_ROLE_DEPTH_SOG_PP_MAX,
          };

  const boundedToiEs = clamp(
    args.toiEsSeconds,
    limits.toiEsMin,
    limits.toiEsMax,
  );
  const boundedToiPp = clamp(
    args.toiPpSeconds,
    limits.toiPpMin,
    limits.toiPpMax,
  );
  const boundedSogEs = clamp(args.sogPer60Es, 1.2, limits.sogEsMax);
  const boundedSogPp = clamp(args.sogPer60Pp, 1.5, limits.sogPpMax);

  const wasBounded =
    Math.abs(boundedToiEs - args.toiEsSeconds) > 1e-6 ||
    Math.abs(boundedToiPp - args.toiPpSeconds) > 1e-6 ||
    Math.abs(boundedSogEs - args.sogPer60Es) > 1e-6 ||
    Math.abs(boundedSogPp - args.sogPer60Pp) > 1e-6;
  return {
    toiEsSeconds: Number(boundedToiEs.toFixed(3)),
    toiPpSeconds: Number(boundedToiPp.toFixed(3)),
    sogPer60Es: Number(boundedSogEs.toFixed(3)),
    sogPer60Pp: Number(boundedSogPp.toFixed(3)),
    wasBounded,
  };
}

async function fetchTeamHorizonScalars(
  teamId: number,
  asOfDate: string,
  horizonGames: number,
): Promise<number[]> {
  assertSupabase();
  const horizon = clampHorizonGames(horizonGames);
  if (horizon <= 1) return [1];

  const { data, error } = await supabase
    .from("games")
    .select("date")
    .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
    .gte("date", asOfDate)
    .order("date", { ascending: true })
    .limit(horizon);
  if (error) throw error;
  const dates = ((data ?? []) as Array<{ date: string | null }>)
    .map((r) => r.date)
    .filter((d): d is string => typeof d === "string");
  return buildSequentialHorizonScalarsFromDates(dates, horizon);
}

async function fetchPlayerMetaByIds(
  playerIds: number[],
): Promise<Map<number, PlayerTeamPositionRow>> {
  assertSupabase();
  if (playerIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("players")
    .select("id,team_id,position")
    .in("id", playerIds);
  if (error) throw error;
  return new Map(
    ((data ?? []) as Array<any>)
      .map((row) => {
        const id = Number(row?.id);
        if (!Number.isFinite(id)) return null;
        return [
          id,
          {
            id,
            team_id: Number.isFinite(row?.team_id) ? Number(row.team_id) : null,
            position:
              typeof row?.position === "string"
                ? row.position
                : row?.position == null
                  ? null
                  : String(row.position),
          } satisfies PlayerTeamPositionRow,
        ] as const;
      })
      .filter(
        (entry): entry is readonly [number, PlayerTeamPositionRow] =>
          entry != null,
      ),
  );
}

export async function runPerGameSkaterStage(args: {
  asOfDate: string;
  runId: string;
  horizonGames: number;
  game: GameRow;
  deadlineMs: number;
  currentSeasonId: number;
  skaterRollout: ReturnType<typeof resolveSkaterRolloutConfig>;
  teamAbbreviationById: Map<number, string>;
  playerAvailabilityMultiplier: Map<number, number>;
  availabilityEventByPlayer: Map<number, RosterEventRow>;
  roleEventByPlayer: Map<number, RosterEventRow>;
  goalieOverrideByTeamId: Map<
    number,
    { goalieId: number; starterProb: number }
  >;
  activeRosterSkaterIdsByTeamId: Map<number, number[]>;
  teamHorizonScalarsCache: Map<string, number[]>;
  teamSkaterRoleHistoryCache: Map<string, Map<number, string[]>>;
  teamShotsByTeamId: Map<number, { shotsEs: number; shotsPp: number }>;
  teamGoalsByTeamId: Map<number, number>;
  fallbackGoalieByTeamId: Map<number, number | null>;
  teamGoalieStarterContextCache: Map<string, TeamGoalieStarterContext>;
  teamDefensiveEnvironmentCache: Map<string, TeamDefensiveEnvironment>;
  teamOffenseEnvironmentCache: Map<string, TeamOffenseEnvironment>;
  teamRestDaysCache: Map<string, number | null>;
  teamStrengthPriorCache: Map<string, TeamStrengthPrior | null>;
  teamStrengthCache: Map<string, TeamStrengthAverages>;
  teamFiveOnFiveProfileCache: Map<string, TeamFiveOnFiveProfile | null>;
  teamNstExpectedGoalsCache: Map<string, TeamNstExpectedGoalsProfile | null>;
  teamLineComboGoaliePriorCache: Map<string, Map<number, number>>;
  currentTeamGoalieIdsCache: Map<string, Set<number>>;
  playerPropContextByGamePlayerKey: Map<
    string,
    Record<string, MarketTypeSummary>
  >;
  playerPredictionOutputRows: Array<Record<string, unknown>>;
  modelMarketFlagRows: Array<Record<string, unknown>>;
  goalieCandidates: GoalieStageCandidate[];
  learningCounters: {
    players: number;
    goalRecent: number;
    assistRecent: number;
  };
  metrics: Record<string, any>;
}): Promise<{
  timedOut: boolean;
  playerRowsUpserted: number;
  teamRowsUpserted: number;
}> {
  const {
    asOfDate,
    runId,
    horizonGames,
    game,
    deadlineMs,
    currentSeasonId,
    skaterRollout,
    teamAbbreviationById,
    playerAvailabilityMultiplier,
    availabilityEventByPlayer,
    roleEventByPlayer,
    goalieOverrideByTeamId,
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
  } = args;
  const teamDateKey = (teamId: number) => `${teamId}:${asOfDate}`;
  let playerRowsUpserted = 0;
  let teamRowsUpserted = 0;
  const projectedPlayerMarketInputs = new Map<
    number,
    {
      teamId: number;
      opponentTeamId: number;
      shots: number;
      goals: number;
      assists: number;
      powerPlayPoints: number;
      blockedShots: number;
      lineupSourceGameDate: string | null;
      lineupRecencyDays: number | null;
      availabilityEvent: RosterEventRow | null;
    }
  >();
  for (const teamId of [game.homeTeamId, game.awayTeamId]) {
    if (Date.now() > deadlineMs) {
      return { timedOut: true, playerRowsUpserted, teamRowsUpserted };
    }

    // Use the most recent line combination for this team (prior to today).
    const lcContext = await fetchLatestLineCombinationForTeam(teamId, asOfDate);
    const lc = lcContext.lineCombination;
    const lcRecency = assessLineCombinationRecency({
      asOfDate,
      sourceGameDate: lcContext.sourceGameDate,
    });

    const opponentTeamId =
      teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
    if (!teamHorizonScalarsCache.has(teamDateKey(teamId))) {
      teamHorizonScalarsCache.set(
        teamDateKey(teamId),
        await fetchTeamHorizonScalars(teamId, asOfDate, horizonGames),
      );
    }
    const teamHorizonScalars = teamHorizonScalarsCache.get(
      teamDateKey(teamId),
    ) ?? [1];
    const teamHorizonTotalScalar = teamHorizonScalars.reduce(
      (sum, v) => sum + v,
      0,
    );
    if (lcRecency.isSoftStale && !lcRecency.isHardStale) {
      metrics.data_quality.stale_line_combos_soft += 1;
      metrics.warnings.push(
        `stale lineCombinations for game=${game.id} team=${teamId}; source_date=${lcContext.sourceGameDate ?? "none"} days_stale=${lcRecency.daysStale ?? "unknown"}`,
      );
    }
    if (lcRecency.isHardStale) {
      metrics.data_quality.stale_line_combos_hard += 1;
    }

    let rawSkaterIds = (
      lc ? [...(lc.forwards ?? []), ...(lc.defensemen ?? [])] : []
    ).filter((n) => typeof n === "number");
    if (!activeRosterSkaterIdsByTeamId.has(teamId)) {
      activeRosterSkaterIdsByTeamId.set(
        teamId,
        await fetchActiveRosterSkaterIdsForTeamSeason(
          teamId,
          currentSeasonId,
          SKATER_POOL_SUPPLEMENTAL_FETCH_COUNT,
        ),
      );
    }
    const activeRosterSkaterIds =
      activeRosterSkaterIdsByTeamId.get(teamId) ?? [];

    let usedLineComboFallback = false;
    let lineComboFallbackReason: "missing" | "hard_stale" | "empty" | null =
      null;
    let fallbackCandidateCount = 0;

    if (
      lcRecency.isMissing ||
      lcRecency.isHardStale ||
      rawSkaterIds.length === 0
    ) {
      if (lcRecency.isMissing) metrics.data_quality.missing_line_combos += 1;
      const fallbackSkaterIds = await fetchFallbackSkaterIdsForTeam(
        teamId,
        currentSeasonId,
        asOfDate,
        18,
      );
      if (fallbackSkaterIds.length > 0) {
        rawSkaterIds = fallbackSkaterIds;
        usedLineComboFallback = true;
        lineComboFallbackReason = lcRecency.isMissing
          ? "missing"
          : lcRecency.isHardStale
            ? "hard_stale"
            : "empty";
        fallbackCandidateCount = fallbackSkaterIds.length;
        metrics.data_quality.line_combo_fallbacks_used += 1;
        metrics.warnings.push(
          `lineCombinations fallback used for game=${game.id} team=${teamId}; reason=${lcRecency.isMissing ? "missing" : lcRecency.isHardStale ? "hard_stale" : "empty"} source_date=${lcContext.sourceGameDate ?? "none"} days_stale=${lcRecency.daysStale ?? "unknown"} fallback_count=${fallbackSkaterIds.length}`,
        );
      } else {
        metrics.data_quality.line_combo_hard_failures += 1;
        metrics.warnings.push(
          `lineCombinations hard-failure for game=${game.id} team=${teamId}; no usable line combos or fallback skaters`,
        );
        continue;
      }
    }
    rawSkaterIds = constrainSkaterIdsToActiveRoster({
      candidateSkaterIds: rawSkaterIds,
      activeRosterSkaterIds,
    });

    let playerMetaById = await fetchPlayerMetaByIds(rawSkaterIds);
    let skaterRoleTags = buildSkaterRoleTags({
      lineCombination: lc,
      useFallbackRoles: usedLineComboFallback,
      fallbackRankedSkaterIds: rawSkaterIds,
      playerMetaById,
      teamId,
    });
    let teamPositionFilteredSkaterIds = Array.from(
      new Set(rawSkaterIds),
    ).filter((playerId) => {
      const meta = playerMetaById.get(playerId);
      if (!meta) return false;
      return meta.position !== "G" && meta.team_id === teamId;
    });

    let evRows = await fetchRollingRows(
      teamPositionFilteredSkaterIds,
      "ev",
      asOfDate,
    );
    let ppRows = await fetchRollingRows(
      teamPositionFilteredSkaterIds,
      "pp",
      asOfDate,
    );
    let evLatest = pickLatestByPlayer(evRows);
    let ppLatest = pickLatestByPlayer(ppRows);
    let latestMetricDateByPlayerId = new Map<number, string>();
    for (const playerId of teamPositionFilteredSkaterIds) {
      const evDate = evLatest.get(playerId)?.game_date ?? null;
      const ppDate = ppLatest.get(playerId)?.game_date ?? null;
      const latestDate =
        evDate && ppDate
          ? evDate > ppDate
            ? evDate
            : ppDate
          : (evDate ?? ppDate);
      if (latestDate) latestMetricDateByPlayerId.set(playerId, latestDate);
    }

    let activeSkaterFilter = filterActiveSkaterCandidateIds({
      asOfDate,
      teamId,
      rawSkaterIds,
      playerMetaById,
      latestMetricDateByPlayerId,
    });
    let skaterPoolRecoveryPath:
      | "none"
      | "supplemental_fallback_union"
      | "supplemental_fallback_plus_roster_union"
      | "missing_metrics_emergency_inclusion"
      | "supplemental_plus_missing_metrics" = "none";
    let skaterPoolRecoverySupplementalAdded = 0;
    let skaterPoolRecoveryEmergencyIncluded = 0;

    let unavailableSkaters = activeSkaterFilter.eligibleSkaterIds.filter(
      (playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) <= 0,
    );
    let skaterIds = activeSkaterFilter.eligibleSkaterIds.filter(
      (playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) > 0,
    );

    if (skaterIds.length < SKATER_POOL_MIN_VALID_COUNT) {
      metrics.data_quality.skater_pool_recovery_attempts += 1;
      const supplementalFallbackSkaterIds = await fetchFallbackSkaterIdsForTeam(
        teamId,
        currentSeasonId,
        asOfDate,
        SKATER_POOL_SUPPLEMENTAL_FETCH_COUNT,
      );
      const supplementalRosterSkaterIds = activeRosterSkaterIds;
      const mergedRawSkaterIds = mergeSkaterCandidatePoolForRecovery({
        baseSkaterIds: rawSkaterIds,
        supplementalSkaterIds: [
          ...supplementalFallbackSkaterIds,
          ...supplementalRosterSkaterIds,
        ],
        targetCount: SKATER_POOL_SUPPLEMENTAL_FETCH_COUNT,
      });
      const mergedConstrainedRawSkaterIds = constrainSkaterIdsToActiveRoster({
        candidateSkaterIds: mergedRawSkaterIds,
        activeRosterSkaterIds,
        fallbackCount: SKATER_POOL_SUPPLEMENTAL_FETCH_COUNT,
      });
      const baseUniqueCount = Array.from(new Set(rawSkaterIds)).length;
      const mergedUniqueCount = Array.from(
        new Set(mergedConstrainedRawSkaterIds),
      ).length;
      if (mergedUniqueCount > baseUniqueCount) {
        const previousRawSkaterIds = new Set(rawSkaterIds);
        rawSkaterIds = mergedConstrainedRawSkaterIds;
        skaterPoolRecoverySupplementalAdded = rawSkaterIds.filter(
          (id) => !previousRawSkaterIds.has(id),
        ).length;

        playerMetaById = await fetchPlayerMetaByIds(rawSkaterIds);
        const roleTagsFromSource = buildSkaterRoleTags({
          lineCombination: lc,
          useFallbackRoles: usedLineComboFallback,
          fallbackRankedSkaterIds: rawSkaterIds,
          playerMetaById,
          teamId,
        });
        const fallbackRecoveryRoleTags = buildSkaterRoleTags({
          lineCombination: null,
          useFallbackRoles: true,
          fallbackRankedSkaterIds: rawSkaterIds,
          playerMetaById,
          teamId,
        });
        skaterRoleTags = roleTagsFromSource;
        for (const [playerId, roleTag] of fallbackRecoveryRoleTags.entries()) {
          if (!skaterRoleTags.has(playerId)) {
            skaterRoleTags.set(playerId, roleTag);
          }
        }
        teamPositionFilteredSkaterIds = Array.from(
          new Set(rawSkaterIds),
        ).filter((playerId) => {
          const meta = playerMetaById.get(playerId);
          if (!meta) return false;
          return meta.position !== "G" && meta.team_id === teamId;
        });

        evRows = await fetchRollingRows(
          teamPositionFilteredSkaterIds,
          "ev",
          asOfDate,
        );
        ppRows = await fetchRollingRows(
          teamPositionFilteredSkaterIds,
          "pp",
          asOfDate,
        );
        evLatest = pickLatestByPlayer(evRows);
        ppLatest = pickLatestByPlayer(ppRows);
        latestMetricDateByPlayerId = new Map<number, string>();
        for (const playerId of teamPositionFilteredSkaterIds) {
          const evDate = evLatest.get(playerId)?.game_date ?? null;
          const ppDate = ppLatest.get(playerId)?.game_date ?? null;
          const latestDate =
            evDate && ppDate
              ? evDate > ppDate
                ? evDate
                : ppDate
              : (evDate ?? ppDate);
          if (latestDate) latestMetricDateByPlayerId.set(playerId, latestDate);
        }
        activeSkaterFilter = filterActiveSkaterCandidateIds({
          asOfDate,
          teamId,
          rawSkaterIds,
          playerMetaById,
          latestMetricDateByPlayerId,
        });
        unavailableSkaters = activeSkaterFilter.eligibleSkaterIds.filter(
          (playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) <= 0,
        );
        skaterIds = activeSkaterFilter.eligibleSkaterIds.filter(
          (playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) > 0,
        );
        skaterPoolRecoveryPath =
          supplementalRosterSkaterIds.length > 0
            ? "supplemental_fallback_plus_roster_union"
            : "supplemental_fallback_union";
      }
    }

    if (skaterIds.length < SKATER_POOL_MIN_VALID_COUNT) {
      const missingMetricEmergencyCandidates =
        activeSkaterFilter.excludedSkaterIdsByReason.missingRecentMetrics.filter(
          (playerId) =>
            (playerAvailabilityMultiplier.get(playerId) ?? 1) > 0 &&
            !skaterIds.includes(playerId),
        );
      const emergencyNeeded = Math.max(
        0,
        SKATER_POOL_TARGET_COUNT - skaterIds.length,
      );
      if (emergencyNeeded > 0 && missingMetricEmergencyCandidates.length > 0) {
        const emergencyAddedIds = missingMetricEmergencyCandidates.slice(
          0,
          emergencyNeeded,
        );
        skaterIds = [...skaterIds, ...emergencyAddedIds];
        skaterPoolRecoveryEmergencyIncluded = emergencyAddedIds.length;
        skaterPoolRecoveryPath =
          skaterPoolRecoveryPath === "supplemental_fallback_union"
            ? "supplemental_plus_missing_metrics"
            : "missing_metrics_emergency_inclusion";
      }
    }

    if (skaterPoolRecoveryPath !== "none") {
      metrics.data_quality.skater_pool_recovery_activated += 1;
      metrics.data_quality.skater_pool_recovery_candidates_added +=
        skaterPoolRecoverySupplementalAdded +
        skaterPoolRecoveryEmergencyIncluded;
      if (skaterIds.length >= SKATER_POOL_MIN_VALID_COUNT) {
        metrics.data_quality.skater_pool_recovery_restored += 1;
      } else {
        metrics.data_quality.skater_pool_recovery_failed += 1;
      }
      metrics.warnings.push(
        `skater pool recovery used for game=${game.id} team=${teamId}; path=${skaterPoolRecoveryPath} supplemental_added=${skaterPoolRecoverySupplementalAdded} missing_metrics_added=${skaterPoolRecoveryEmergencyIncluded} final_active_count=${skaterIds.length}`,
      );
    }

    if (
      usedLineComboFallback &&
      activeSkaterFilter.eligibleSkaterIds.length === 0
    ) {
      metrics.data_quality.line_combo_hard_failures += 1;
      metrics.warnings.push(
        `lineCombinations fallback produced no active skaters for game=${game.id} team=${teamId}`,
      );
      continue;
    }
    metrics.data_quality.filtered_skater_team_or_position +=
      activeSkaterFilter.stats.filteredByTeamOrPosition;
    metrics.data_quality.filtered_skater_missing_metrics +=
      activeSkaterFilter.stats.filteredMissingRecentMetrics;
    metrics.data_quality.filtered_skater_hard_stale +=
      activeSkaterFilter.stats.filteredHardStale;
    metrics.data_quality.soft_stale_skater_penalties +=
      activeSkaterFilter.stats.softStalePenalized;
    metrics.data_quality.skater_unavailable_filtered +=
      unavailableSkaters.length;
    const emergencyMissingMetricSkaterIdSet = new Set(
      activeSkaterFilter.excludedSkaterIdsByReason.missingRecentMetrics.filter(
        (id) => skaterIds.includes(id),
      ),
    );

    if (skaterIds.length === 0) {
      metrics.warnings.push(
        `empty skaterIds for game=${game.id} team=${teamId}`,
      );
      metrics.data_quality.empty_skater_rosters += 1;
      continue;
    }
    const teamAbbrev = teamAbbreviationById.get(teamId) ?? null;
    const opponentAbbrev = teamAbbreviationById.get(opponentTeamId) ?? null;
    if (!teamStrengthPriorCache.has(teamDateKey(teamId))) {
      teamStrengthPriorCache.set(
        teamDateKey(teamId),
        teamAbbrev
          ? await fetchTeamStrengthPrior(teamAbbrev, asOfDate, teamId)
          : null,
      );
    }
    if (!teamStrengthPriorCache.has(teamDateKey(opponentTeamId))) {
      teamStrengthPriorCache.set(
        teamDateKey(opponentTeamId),
        opponentAbbrev
          ? await fetchTeamStrengthPrior(
              opponentAbbrev,
              asOfDate,
              opponentTeamId,
            )
          : null,
      );
    }
    if (!teamFiveOnFiveProfileCache.has(teamDateKey(teamId))) {
      teamFiveOnFiveProfileCache.set(
        teamDateKey(teamId),
        await fetchTeamFiveOnFiveProfile(teamId, asOfDate),
      );
    }
    if (!teamFiveOnFiveProfileCache.has(teamDateKey(opponentTeamId))) {
      teamFiveOnFiveProfileCache.set(
        teamDateKey(opponentTeamId),
        await fetchTeamFiveOnFiveProfile(opponentTeamId, asOfDate),
      );
    }
    if (!teamNstExpectedGoalsCache.has(teamDateKey(teamId))) {
      teamNstExpectedGoalsCache.set(
        teamDateKey(teamId),
        teamAbbrev
          ? await fetchTeamNstExpectedGoalsProfile(teamAbbrev, asOfDate)
          : null,
      );
    }
    if (!teamNstExpectedGoalsCache.has(teamDateKey(opponentTeamId))) {
      teamNstExpectedGoalsCache.set(
        teamDateKey(opponentTeamId),
        opponentAbbrev
          ? await fetchTeamNstExpectedGoalsProfile(opponentAbbrev, asOfDate)
          : null,
      );
    }
    const teamLevelContextAdjustment = computeSkaterTeamLevelContextAdjustments(
      {
        teamStrengthPrior:
          teamStrengthPriorCache.get(teamDateKey(teamId)) ?? null,
        opponentStrengthPrior:
          teamStrengthPriorCache.get(teamDateKey(opponentTeamId)) ?? null,
        teamFiveOnFiveProfile:
          teamFiveOnFiveProfileCache.get(teamDateKey(teamId)) ?? null,
        opponentFiveOnFiveProfile:
          teamFiveOnFiveProfileCache.get(teamDateKey(opponentTeamId)) ?? null,
        teamNstProfile:
          teamNstExpectedGoalsCache.get(teamDateKey(teamId)) ?? null,
        opponentNstProfile:
          teamNstExpectedGoalsCache.get(teamDateKey(opponentTeamId)) ?? null,
      },
    );
    if (teamLevelContextAdjustment.sampleWeight > 0) {
      metrics.data_quality.team_level_context_teams_with_signal += 1;
      metrics.data_quality.team_level_context_adjustments_applied += 1;
    }
    const opponentGoalieContext = await fetchOpponentGoalieContextForGame({
      gameId: game.id,
      opponentTeamId,
    });
    if (opponentGoalieContext != null) {
      metrics.data_quality.opponent_goalie_context_profiles_found += 1;
    }
    const opponentGoalieContextAdjustment =
      computeSkaterOpponentGoalieContextAdjustments({
        context: opponentGoalieContext,
      });
    if (opponentGoalieContextAdjustment.sampleWeight > 0) {
      metrics.data_quality.opponent_goalie_context_adjustments_applied += 1;
    }
    if (!teamRestDaysCache.has(teamDateKey(teamId))) {
      teamRestDaysCache.set(
        teamDateKey(teamId),
        await fetchTeamRestDays(teamId, asOfDate),
      );
    }
    if (!teamRestDaysCache.has(teamDateKey(opponentTeamId))) {
      teamRestDaysCache.set(
        teamDateKey(opponentTeamId),
        await fetchTeamRestDays(opponentTeamId, asOfDate),
      );
    }
    const restScheduleAdjustment = computeSkaterRestScheduleAdjustments({
      teamRestDays: teamRestDaysCache.get(teamDateKey(teamId)) ?? null,
      opponentRestDays:
        teamRestDaysCache.get(teamDateKey(opponentTeamId)) ?? null,
      isHome: teamId === game.homeTeamId,
    });
    if (restScheduleAdjustment.sampleWeight > 0) {
      metrics.data_quality.rest_schedule_teams_with_signal += 1;
      metrics.data_quality.rest_schedule_adjustments_applied += 1;
    }
    const deploymentPriorByPlayerId =
      await fetchLatestWgoSkaterDeploymentProfiles(skaterIds, asOfDate);
    const shotQualityByPlayerId = await fetchLatestSkaterShotQualityProfiles(
      skaterIds,
      asOfDate,
    );
    const onIceContextByPlayerId = await fetchLatestSkaterOnIceContextProfiles(
      skaterIds,
      asOfDate,
    );
    const trendAdjustmentFetch = await fetchLatestSkaterTrendAdjustments(
      skaterIds,
      asOfDate,
    );
    const trendAdjustmentByPlayerId = trendAdjustmentFetch.adjustments;
    metrics.data_quality.deployment_prior_profiles_found +=
      deploymentPriorByPlayerId.size;
    metrics.data_quality.shot_quality_profiles_found +=
      shotQualityByPlayerId.size;
    metrics.data_quality.on_ice_context_profiles_found +=
      onIceContextByPlayerId.size;
    metrics.data_quality.trend_adjustment_rows_eligible +=
      trendAdjustmentFetch.diagnostics.eligibleRows;
    metrics.data_quality.trend_adjustment_players_with_rows +=
      trendAdjustmentFetch.diagnostics.playersWithRows;
    metrics.data_quality.trend_adjustment_players_adjusted +=
      trendAdjustmentFetch.diagnostics.playersAdjusted;
    metrics.data_quality.trend_adjustment_players_missing_rows +=
      trendAdjustmentFetch.diagnostics.playersMissingRows;
    metrics.data_quality.trend_adjustment_players_neutralized_by_recency +=
      trendAdjustmentFetch.diagnostics.playersNeutralizedByRecency;
    metrics.data_quality.trend_adjustment_soft_stale_selected +=
      trendAdjustmentFetch.diagnostics.selectedSoftStaleRows;
    metrics.data_quality.trend_adjustment_hard_stale_selected +=
      trendAdjustmentFetch.diagnostics.selectedHardStaleRows;
    if (trendAdjustmentFetch.diagnostics.fetchFailed) {
      metrics.data_quality.trend_adjustment_fetch_failures += 1;
      metrics.warnings.push(
        `Trend adjustments unavailable for team ${teamAbbreviationById.get(teamId) ?? teamId}; projections continued without sustainability trend modifiers.`,
      );
    } else if (trendAdjustmentFetch.diagnostics.selectedHardStaleRows > 0) {
      metrics.warnings.push(
        `Trend adjustments for team ${teamAbbreviationById.get(teamId) ?? teamId} included ${trendAdjustmentFetch.diagnostics.selectedHardStaleRows} hard-stale rows; those signals were decayed to neutral.`,
      );
    }
    if (!teamSkaterRoleHistoryCache.has(teamDateKey(teamId))) {
      teamSkaterRoleHistoryCache.set(
        teamDateKey(teamId),
        await fetchTeamSkaterRoleHistory(teamId, asOfDate),
      );
    }
    const roleHistoryByPlayerId =
      teamSkaterRoleHistoryCache.get(teamDateKey(teamId)) ??
      new Map<number, string[]>();

    // Initial per-player TOI estimates (seconds)
    const projected = new Map<
      number,
      {
        toiEs: number;
        toiPp: number;
        shotsEs: number;
        shotsPp: number;
        goalRateEs: number;
        goalRatePp: number;
        assistRateEs: number;
        assistRatePp: number;
        hitsRate: number;
        blocksRate: number;
        roleTag: SkaterRoleTag | null;
        roleContinuity: SkaterRoleContinuitySummary | null;
        roleStabilityMultiplier: number;
        eventAvailabilityMultiplier: number;
        availabilityEvent: RosterEventRow | null;
        roleEvent: RosterEventRow | null;
        latestMetricDate: string | null;
        daysSinceLastMetric: number | null;
        recencyMultiplier: number;
        shotQualityProfileSourceDate: string | null;
        shotQualitySampleWeight: number;
        shotRateMultiplier: number;
        goalRateMultiplier: number;
        qualityPerShot: number | null;
        rushReboundPer60: number | null;
        onIceContextSourceDate: string | null;
        onIceContextSampleWeight: number;
        shotEnvironmentMultiplier: number;
        goalEnvironmentMultiplier: number;
        assistEnvironmentMultiplier: number;
        onIcePossessionPct: number | null;
        teamLevelSampleWeight: number;
        teamLevelShotRateMultiplier: number;
        teamLevelGoalRateMultiplier: number;
        teamLevelAssistRateMultiplier: number;
        teamLevelPaceEdge: number;
        teamLevelOpponentDefenseEdge: number;
        opponentGoalieSampleWeight: number;
        opponentGoalieGoalRateMultiplier: number;
        opponentGoalieAssistRateMultiplier: number;
        opponentGoalieWeightedGsaaPer60: number | null;
        opponentGoalieStarterCertainty: number;
        restScheduleSampleWeight: number;
        restScheduleToiMultiplier: number;
        restScheduleShotRateMultiplier: number;
        restScheduleGoalRateMultiplier: number;
        restScheduleAssistRateMultiplier: number;
        restScheduleRestDelta: number;
        restScheduleTeamRestDays: number | null;
        restScheduleOpponentRestDays: number | null;
        smallSampleWeight: number;
        smallSampleIsLow: boolean;
        smallSampleUsedCallupFallback: boolean;
        smallSampleEvidenceToiSeconds: number;
        smallSampleEvidenceShots: number;
        ppOpportunityTeamTargetSeconds: number | null;
        ppOpportunityAllocatedShare: number | null;
        teammateAssistEsMultiplier: number;
        teammateAssistPpMultiplier: number;
        teammateDependencyScore: number;
        roleUsageBoundsApplied: boolean;
        boundedSogPer60Es: number;
        boundedSogPer60Pp: number;
        roleScenarios: SkaterRoleScenario[];
        roleScenarioTopProbability: number;
        trendAdjustment: SkaterTrendAdjustment | null;
      }
    >();
    let roleScenarioPlayersModeled = 0;
    let roleScenarioCountTotal = 0;
    let noMetricsPlayersSkipped = 0;
    let noMetricsPlayersEmergencyIncluded = 0;

    for (const playerId of skaterIds) {
      const ev = evLatest.get(playerId);
      const pp = ppLatest.get(playerId);
      const isEmergencyMissingMetricsInclusion =
        !ev && !pp && emergencyMissingMetricSkaterIdSet.has(playerId);
      if (!ev && !pp && !isEmergencyMissingMetricsInclusion) {
        noMetricsPlayersSkipped += 1;
        continue;
      }
      if (isEmergencyMissingMetricsInclusion) {
        noMetricsPlayersEmergencyIncluded += 1;
        metrics.data_quality.skater_pool_emergency_missing_metrics_included += 1;
      }

      if (!ev) metrics.data_quality.missing_ev_metrics_players += 1;
      if (!pp) metrics.data_quality.missing_pp_metrics_players += 1;

      const toiEs = safeNumber(
        ev?.toi_seconds_avg_last5,
        safeNumber(ev?.toi_seconds_avg_all, 700),
      );
      const toiPp = safeNumber(
        pp?.toi_seconds_avg_last5,
        safeNumber(pp?.toi_seconds_avg_all, 120),
      );
      const deploymentPrior = deploymentPriorByPlayerId.get(playerId) ?? null;
      const shotQualityProfile = shotQualityByPlayerId.get(playerId) ?? null;
      const onIceContextProfile = onIceContextByPlayerId.get(playerId) ?? null;
      const toiEsDeploymentPrior = deploymentPrior?.esToiPerGameSec ?? null;
      const toiPpDeploymentPrior = deploymentPrior?.ppToiPerGameSec ?? null;
      const toiRollingWeightEs = ev != null ? 0.8 : 0.45;
      const toiRollingWeightPp = pp != null ? 0.8 : 0.45;
      const blendedToiEs =
        blendToiSecondsWithDeploymentPrior({
          rollingSeconds: toiEs,
          deploymentPriorSeconds: toiEsDeploymentPrior,
          rollingWeight: toiRollingWeightEs,
        }) ?? toiEs;
      const blendedToiPp =
        blendToiSecondsWithDeploymentPrior({
          rollingSeconds: toiPp,
          deploymentPriorSeconds: toiPpDeploymentPrior,
          rollingWeight: toiRollingWeightPp,
        }) ?? toiPp;
      const adjustedToiEs = clamp(
        blendedToiEs * restScheduleAdjustment.toiMultiplier,
        0,
        2600,
      );
      const adjustedToiPp = clamp(
        blendedToiPp * restScheduleAdjustment.toiMultiplier,
        0,
        1300,
      );
      if (toiEsDeploymentPrior != null || toiPpDeploymentPrior != null) {
        metrics.data_quality.deployment_prior_toi_blends_applied += 1;
      }
      const sampleShrinkage = computeSkaterSampleShrinkageAdjustments({
        evToiSecondsAll: finiteOrNull(ev?.toi_seconds_avg_all),
        ppToiSecondsAll: finiteOrNull(pp?.toi_seconds_avg_all),
        evShotsAll: finiteOrNull(ev?.shots_total_all),
        ppShotsAll: finiteOrNull(pp?.shots_total_all),
      });
      if (sampleShrinkage.isLowSample) {
        metrics.data_quality.small_sample_players += 1;
        metrics.data_quality.small_sample_shrinkage_applied += 1;
      }
      if (sampleShrinkage.usedCallupFallback) {
        metrics.data_quality.small_sample_callup_fallbacks += 1;
      }
      const sampleWeight = sampleShrinkage.sampleWeight;
      const shrunkToiEs = Number(
        (
          sampleWeight * adjustedToiEs +
          (1 - sampleWeight) * safeNumber(ev?.toi_seconds_avg_all, 700)
        ).toFixed(3),
      );
      const shrunkToiPp = Number(
        (
          sampleWeight * adjustedToiPp +
          (1 - sampleWeight) * safeNumber(pp?.toi_seconds_avg_all, 120)
        ).toFixed(3),
      );
      const roleEvent = roleEventByPlayer.get(playerId) ?? null;
      const rosterEventRoleTag = roleTagFromRosterEvent(roleEvent);
      const roleTag =
        rosterEventRoleTag ?? skaterRoleTags.get(playerId) ?? null;
      const shotQualityAdjustment = computeSkaterShotQualityAdjustments({
        profile: shotQualityProfile,
      });
      if (shotQualityProfile != null) {
        metrics.data_quality.shot_quality_adjustments_applied += 1;
      }
      const onIceContextAdjustment = computeSkaterOnIceContextAdjustments({
        profile: onIceContextProfile,
      });
      if (onIceContextProfile != null) {
        metrics.data_quality.on_ice_context_adjustments_applied += 1;
      }

      const sogPer60EvRaw = safeNumber(
        resolveNullableCompatibilityValue(
          "weighted_rate",
          ev?.sog_per_60_last5,
          ev?.sog_per_60_avg_last5,
        ),
        safeNumber(
          resolveNullableCompatibilityValue(
            "weighted_rate",
            ev?.sog_per_60_all,
            ev?.sog_per_60_avg_all,
          ),
          6,
        ),
      );
      const sogPer60PpRaw = safeNumber(
        resolveNullableCompatibilityValue(
          "weighted_rate",
          pp?.sog_per_60_last5,
          pp?.sog_per_60_avg_last5,
        ),
        safeNumber(
          resolveNullableCompatibilityValue(
            "weighted_rate",
            pp?.sog_per_60_all,
            pp?.sog_per_60_avg_all,
          ),
          8,
        ),
      );
      const sogPer60EvPreBound = clamp(
        sogPer60EvRaw *
          shotQualityAdjustment.shotRateMultiplier *
          onIceContextAdjustment.shotEnvironmentMultiplier *
          teamLevelContextAdjustment.shotRateMultiplier *
          restScheduleAdjustment.shotRateMultiplier *
          sampleWeight +
          (1 - sampleWeight) * 6,
        1.5,
        20,
      );
      const sogPer60PpPreBound = clamp(
        sogPer60PpRaw *
          shotQualityAdjustment.shotRateMultiplier *
          onIceContextAdjustment.shotEnvironmentMultiplier *
          teamLevelContextAdjustment.shotRateMultiplier *
          restScheduleAdjustment.shotRateMultiplier *
          sampleWeight +
          (1 - sampleWeight) * 8,
        2,
        28,
      );
      const boundedUsage = applyRoleSpecificUsageBounds({
        roleTag,
        toiEsSeconds: shrunkToiEs,
        toiPpSeconds: shrunkToiPp,
        sogPer60Es: sogPer60EvPreBound,
        sogPer60Pp: sogPer60PpPreBound,
      });
      if (boundedUsage.wasBounded) {
        metrics.data_quality.role_usage_bounds_applied += 1;
      }
      const boundedToiEs = boundedUsage.toiEsSeconds;
      const boundedToiPp = boundedUsage.toiPpSeconds;
      const sogPer60Ev = boundedUsage.sogPer60Es;
      const sogPer60Pp = boundedUsage.sogPer60Pp;

      const hitsPer60 = safeNumber(
        resolveNullableCompatibilityValue(
          "weighted_rate",
          ev?.hits_per_60_last5,
          ev?.hits_per_60_avg_last5,
        ),
        safeNumber(
          resolveNullableCompatibilityValue(
            "weighted_rate",
            ev?.hits_per_60_all,
            ev?.hits_per_60_avg_all,
          ),
          1,
        ),
      );
      const blocksPer60 = safeNumber(
        resolveNullableCompatibilityValue(
          "weighted_rate",
          ev?.blocks_per_60_last5,
          ev?.blocks_per_60_avg_last5,
        ),
        safeNumber(
          resolveNullableCompatibilityValue(
            "weighted_rate",
            ev?.blocks_per_60_all,
            ev?.blocks_per_60_avg_all,
          ),
          0.5,
        ),
      );

      const shotsEs = computeShotsFromRate(boundedToiEs, sogPer60Ev);
      const shotsPp = computeShotsFromRate(boundedToiPp, sogPer60Pp);

      // Online learning: blend recent and season-long conversion rates.
      const goalsTotal = safeNumber(ev?.goals_total_all, 0);
      const shotsTotal = safeNumber(ev?.shots_total_all, 0);
      const assistsTotal = safeNumber(ev?.assists_total_all, 0);
      const goalsRecent = safeNumber(ev?.goals_total_last5, 0);
      const shotsRecent = safeNumber(ev?.shots_total_last5, 0);
      const assistsRecent = safeNumber(ev?.assists_total_last5, 0);
      const ppGoalsTotal = safeNumber(pp?.goals_total_all, 0);
      const ppShotsTotal = safeNumber(pp?.shots_total_all, 0);
      const ppAssistsTotal = safeNumber(pp?.assists_total_all, 0);
      const ppGoalsRecent = safeNumber(pp?.goals_total_last5, 0);
      const ppShotsRecent = safeNumber(pp?.shots_total_last5, 0);
      const ppAssistsRecent = safeNumber(pp?.assists_total_last5, 0);
      if (ppShotsTotal <= 0 && ppShotsRecent <= 0) {
        metrics.data_quality.missing_pp_conversion_samples += 1;
      }

      learningCounters.players += 1;
      if (shotsRecent > 0) learningCounters.goalRecent += 1;
      if (goalsRecent > 0) learningCounters.assistRecent += 1;

      const splitRates = computeStrengthSplitConversionRates({
        evGoalsRecent: goalsRecent,
        evShotsRecent: shotsRecent,
        evGoalsAll: goalsTotal,
        evShotsAll: shotsTotal,
        evAssistsRecent: assistsRecent,
        evAssistsAll: assistsTotal,
        ppGoalsRecent,
        ppShotsRecent,
        ppGoalsAll: ppGoalsTotal,
        ppShotsAll: ppShotsTotal,
        ppAssistsRecent,
        ppAssistsAll: ppAssistsTotal,
        goalRateMultiplier:
          shotQualityAdjustment.goalRateMultiplier *
          onIceContextAdjustment.goalEnvironmentMultiplier *
          teamLevelContextAdjustment.goalRateMultiplier *
          opponentGoalieContextAdjustment.goalRateMultiplier *
          restScheduleAdjustment.goalRateMultiplier,
        assistRateMultiplier:
          onIceContextAdjustment.assistEnvironmentMultiplier *
          teamLevelContextAdjustment.assistRateMultiplier *
          opponentGoalieContextAdjustment.assistRateMultiplier *
          restScheduleAdjustment.assistRateMultiplier,
      });
      const goalRateEs = clamp(
        splitRates.goalRateEs * sampleWeight + (1 - sampleWeight) * 0.095,
        0.025,
        0.3,
      );
      const goalRatePp = clamp(
        splitRates.goalRatePp * sampleWeight + (1 - sampleWeight) * 0.145,
        0.04,
        0.45,
      );
      const assistRateEs = clamp(
        splitRates.assistRateEs * sampleWeight + (1 - sampleWeight) * 0.72,
        0.2,
        1.7,
      );
      const assistRatePp = clamp(
        splitRates.assistRatePp * sampleWeight + (1 - sampleWeight) * 0.95,
        0.3,
        2,
      );

      const roleContinuity =
        roleTag != null
          ? summarizeSkaterRoleContinuity({
              currentRole: roleTag.esRole,
              recentRoles: roleHistoryByPlayerId.get(playerId) ?? [],
            })
          : null;
      const roleStabilityMultiplier =
        roleContinuity != null
          ? computeSkaterRoleStabilityMultiplier(roleContinuity)
          : 1;
      const roleScenarios = buildSkaterRoleScenarios({
        roleTag,
        roleContinuity,
        maxScenarios: 3,
      });
      const roleScenarioTopProbability = roleScenarios[0]?.probability ?? 1;
      roleScenarioPlayersModeled += 1;
      roleScenarioCountTotal += roleScenarios.length;
      if (roleStabilityMultiplier < 1) {
        metrics.data_quality.role_volatility_penalties_applied += 1;
      } else if (roleStabilityMultiplier > 1) {
        metrics.data_quality.role_continuity_boosts_applied += 1;
      }

      const eventAvailabilityMultiplier =
        playerAvailabilityMultiplier.get(playerId) ?? 1;
      if (eventAvailabilityMultiplier < 1) {
        metrics.data_quality.skater_availability_penalties_applied += 1;
      }
      const latestMetricDate = latestMetricDateByPlayerId.get(playerId) ?? null;
      const daysSinceLastMetric =
        latestMetricDate != null
          ? Math.max(0, daysBetweenDates(asOfDate, latestMetricDate))
          : null;
      const recencyMultiplier =
        activeSkaterFilter.recencyMultiplierByPlayerId.get(playerId) ?? 1;
      const availabilityMultiplier =
        eventAvailabilityMultiplier *
        recencyMultiplier *
        roleStabilityMultiplier;
      if (availabilityMultiplier <= 0) continue;
      const trendAdjustment = trendAdjustmentByPlayerId.get(playerId) ?? null;
      const trendShotMultiplier = trendAdjustment?.shotRateMultiplier ?? 1;
      const trendGoalMultiplier = trendAdjustment?.goalRateMultiplier ?? 1;
      const trendAssistMultiplier = trendAdjustment?.assistRateMultiplier ?? 1;
      projected.set(playerId, {
        toiEs: boundedToiEs * availabilityMultiplier,
        toiPp: boundedToiPp * availabilityMultiplier,
        shotsEs: shotsEs * availabilityMultiplier * trendShotMultiplier,
        shotsPp: shotsPp * availabilityMultiplier * trendShotMultiplier,
        goalRateEs: clamp(goalRateEs * trendGoalMultiplier, 0.025, 0.3),
        goalRatePp: clamp(goalRatePp * trendGoalMultiplier, 0.04, 0.45),
        assistRateEs: clamp(assistRateEs * trendAssistMultiplier, 0.2, 1.7),
        assistRatePp: clamp(assistRatePp * trendAssistMultiplier, 0.3, 2),
        hitsRate: hitsPer60,
        blocksRate: blocksPer60,
        roleTag,
        roleContinuity,
        roleStabilityMultiplier,
        eventAvailabilityMultiplier,
        availabilityEvent: availabilityEventByPlayer.get(playerId) ?? null,
        roleEvent,
        latestMetricDate,
        daysSinceLastMetric,
        recencyMultiplier,
        shotQualityProfileSourceDate: shotQualityProfile?.sourceDate ?? null,
        shotQualitySampleWeight: shotQualityAdjustment.sampleWeight,
        shotRateMultiplier: shotQualityAdjustment.shotRateMultiplier,
        goalRateMultiplier: shotQualityAdjustment.goalRateMultiplier,
        qualityPerShot: shotQualityAdjustment.qualityPerShot,
        rushReboundPer60: shotQualityAdjustment.rushReboundPer60,
        onIceContextSourceDate: onIceContextProfile?.sourceDate ?? null,
        onIceContextSampleWeight: onIceContextAdjustment.sampleWeight,
        shotEnvironmentMultiplier:
          onIceContextAdjustment.shotEnvironmentMultiplier,
        goalEnvironmentMultiplier:
          onIceContextAdjustment.goalEnvironmentMultiplier,
        assistEnvironmentMultiplier:
          onIceContextAdjustment.assistEnvironmentMultiplier,
        onIcePossessionPct: onIceContextAdjustment.possessionPct,
        teamLevelSampleWeight: teamLevelContextAdjustment.sampleWeight,
        teamLevelShotRateMultiplier:
          teamLevelContextAdjustment.shotRateMultiplier,
        teamLevelGoalRateMultiplier:
          teamLevelContextAdjustment.goalRateMultiplier,
        teamLevelAssistRateMultiplier:
          teamLevelContextAdjustment.assistRateMultiplier,
        teamLevelPaceEdge: teamLevelContextAdjustment.paceEdge,
        teamLevelOpponentDefenseEdge:
          teamLevelContextAdjustment.opponentDefenseEdge,
        opponentGoalieSampleWeight:
          opponentGoalieContextAdjustment.sampleWeight,
        opponentGoalieGoalRateMultiplier:
          opponentGoalieContextAdjustment.goalRateMultiplier,
        opponentGoalieAssistRateMultiplier:
          opponentGoalieContextAdjustment.assistRateMultiplier,
        opponentGoalieWeightedGsaaPer60:
          opponentGoalieContextAdjustment.weightedProjectedGsaaPer60,
        opponentGoalieStarterCertainty:
          opponentGoalieContextAdjustment.starterCertainty,
        restScheduleSampleWeight: restScheduleAdjustment.sampleWeight,
        restScheduleToiMultiplier: restScheduleAdjustment.toiMultiplier,
        restScheduleShotRateMultiplier:
          restScheduleAdjustment.shotRateMultiplier,
        restScheduleGoalRateMultiplier:
          restScheduleAdjustment.goalRateMultiplier,
        restScheduleAssistRateMultiplier:
          restScheduleAdjustment.assistRateMultiplier,
        restScheduleRestDelta: restScheduleAdjustment.restDelta,
        restScheduleTeamRestDays: restScheduleAdjustment.teamRestDays,
        restScheduleOpponentRestDays: restScheduleAdjustment.opponentRestDays,
        smallSampleWeight: sampleShrinkage.sampleWeight,
        smallSampleIsLow: sampleShrinkage.isLowSample,
        smallSampleUsedCallupFallback: sampleShrinkage.usedCallupFallback,
        smallSampleEvidenceToiSeconds: sampleShrinkage.evidenceToiSeconds,
        smallSampleEvidenceShots: sampleShrinkage.evidenceShots,
        ppOpportunityTeamTargetSeconds: null,
        ppOpportunityAllocatedShare: null,
        teammateAssistEsMultiplier: 1,
        teammateAssistPpMultiplier: 1,
        teammateDependencyScore: 0,
        roleUsageBoundsApplied: boundedUsage.wasBounded,
        boundedSogPer60Es: boundedUsage.sogPer60Es,
        boundedSogPer60Pp: boundedUsage.sogPer60Pp,
        roleScenarios,
        roleScenarioTopProbability,
        trendAdjustment,
      });
    }
    if (roleScenarioPlayersModeled > 0) {
      metrics.data_quality.role_scenarios_players_modeled +=
        roleScenarioPlayersModeled;
      const avgCount = roleScenarioCountTotal / roleScenarioPlayersModeled;
      metrics.data_quality.role_scenarios_avg_count =
        metrics.data_quality.role_scenarios_avg_count == null
          ? avgCount
          : (metrics.data_quality.role_scenarios_avg_count + avgCount) / 2;
    }
    if (noMetricsPlayersSkipped > 0) {
      metrics.data_quality.skater_pool_players_dropped_no_ev_pp_gate +=
        noMetricsPlayersSkipped;
    }

    // Task 3.6 reconciliation: hard constraints for team TOI + shots (by strength).
    const targetSkaterSecondsCanonical = 60 * 60 * 5;
    const strengthAverages =
      teamStrengthCache.get(teamDateKey(teamId)) ??
      (await fetchTeamStrengthAverages(teamId, asOfDate));
    teamStrengthCache.set(teamDateKey(teamId), strengthAverages);

    const preAllocationToiEs = Array.from(projected.values()).reduce(
      (acc, p) => acc + p.toiEs,
      0,
    );
    const preAllocationToiPp = Array.from(projected.values()).reduce(
      (acc, p) => acc + p.toiPp,
      0,
    );
    const avgToiEs = strengthAverages.toiEsSecondsAvg;
    const avgToiPp = strengthAverages.toiPpSecondsAvg;
    const toiDenom =
      (typeof avgToiEs === "number" ? avgToiEs : 0) +
      (typeof avgToiPp === "number" ? avgToiPp : 0);
    const fallbackDenom = preAllocationToiEs + preAllocationToiPp;

    const ppShare =
      toiDenom > 0
        ? safeNumber(avgToiPp, 0) / toiDenom
        : fallbackDenom > 0
          ? preAllocationToiPp / fallbackDenom
          : 0.1;

    const projectedSkaterCount = projected.size;
    metrics.data_quality.skater_pool_projected_teams += 1;
    metrics.data_quality.skater_pool_projected_count_min =
      metrics.data_quality.skater_pool_projected_count_min == null
        ? projectedSkaterCount
        : Math.min(
            metrics.data_quality.skater_pool_projected_count_min,
            projectedSkaterCount,
          );
    metrics.data_quality.skater_pool_projected_count_max =
      metrics.data_quality.skater_pool_projected_count_max == null
        ? projectedSkaterCount
        : Math.max(
            metrics.data_quality.skater_pool_projected_count_max,
            projectedSkaterCount,
          );
    metrics.data_quality.skater_pool_projected_count_sum +=
      projectedSkaterCount;
    if (projectedSkaterCount < SKATER_POOL_MIN_VALID_COUNT) {
      metrics.data_quality.skater_pool_underfilled_projected_teams += 1;
    }
    const guardedTeamToiTarget = computeSkaterTeamToiTargetWithPoolGuard({
      canonicalTargetSeconds: targetSkaterSecondsCanonical,
      projectedSkaterCount,
      ppShare,
    });
    if (guardedTeamToiTarget.wasCapped) {
      metrics.data_quality.skater_pool_emergency_toi_target_caps_applied += 1;
      metrics.warnings.push(
        `skater pool emergency TOI cap for game=${game.id} team=${teamId}; projected_count=${projectedSkaterCount} canonical_target=${targetSkaterSecondsCanonical} capped_target=${guardedTeamToiTarget.targetSeconds}`,
      );
    }
    const targetSkaterSeconds = guardedTeamToiTarget.targetSeconds;
    const toiPpTarget = Math.round(
      clamp(ppShare, 0, 0.5) * targetSkaterSeconds,
    );
    const toiEsTarget = targetSkaterSeconds - toiPpTarget;

    const ppAllocation = allocatePpToiByTeamOpportunity({
      projectedByPlayer: new Map(
        Array.from(projected.entries()).map(([playerId, p]) => [
          playerId,
          { toiPp: p.toiPp, roleTag: p.roleTag },
        ]),
      ),
      targetTeamPpSeconds: toiPpTarget,
    });
    if (ppAllocation.perPlayerPpToiSeconds.size > 0) {
      metrics.data_quality.pp_opportunity_teams_modeled += 1;
      metrics.data_quality.pp_opportunity_players_reweighted +=
        ppAllocation.playersReweighted;
      for (const [
        playerId,
        allocatedPpToi,
      ] of ppAllocation.perPlayerPpToiSeconds) {
        const cur = projected.get(playerId);
        if (!cur) continue;
        const oldPpToi = Math.max(0, cur.toiPp);
        const shotScale =
          oldPpToi > 0 ? clamp(allocatedPpToi / oldPpToi, 0.25, 4) : 1;
        cur.toiPp = allocatedPpToi;
        cur.shotsPp = Number((cur.shotsPp * shotScale).toFixed(3));
        cur.ppOpportunityTeamTargetSeconds = toiPpTarget;
        cur.ppOpportunityAllocatedShare =
          toiPpTarget > 0
            ? Number((allocatedPpToi / toiPpTarget).toFixed(4))
            : null;
        projected.set(playerId, cur);
      }
    }

    const teamShotsEsForCoupling = Array.from(projected.values()).reduce(
      (acc, p) => acc + p.shotsEs,
      0,
    );
    const teamPpToiForCoupling = Array.from(projected.values()).reduce(
      (acc, p) => acc + p.toiPp,
      0,
    );
    const lineGroupShotsEs = new Map<string, number>();
    for (const p of projected.values()) {
      const groupKey = roleGroupKeyForTeammateCoupling(p.roleTag);
      if (!groupKey) continue;
      lineGroupShotsEs.set(
        groupKey,
        (lineGroupShotsEs.get(groupKey) ?? 0) + p.shotsEs,
      );
    }
    for (const [playerId, p] of projected.entries()) {
      const groupKey = roleGroupKeyForTeammateCoupling(p.roleTag);
      const groupShots =
        groupKey != null
          ? (lineGroupShotsEs.get(groupKey) ?? p.shotsEs)
          : p.shotsEs;
      const playerPpShare =
        teamPpToiForCoupling > 0 ? p.toiPp / teamPpToiForCoupling : 0;
      const teammateCoupling = computeTeammateAssistCoupling({
        roleTag: p.roleTag,
        playerShotsEs: p.shotsEs,
        lineGroupShotsEs: groupShots,
        teamShotsEs: teamShotsEsForCoupling,
        playerPpShare,
      });
      if (
        Math.abs(teammateCoupling.assistRateEsMultiplier - 1) > 1e-3 ||
        Math.abs(teammateCoupling.assistRatePpMultiplier - 1) > 1e-3
      ) {
        metrics.data_quality.teammate_coupling_players_adjusted += 1;
      }
      p.assistRateEs = clamp(
        p.assistRateEs * teammateCoupling.assistRateEsMultiplier,
        0.2,
        1.8,
      );
      p.assistRatePp = clamp(
        p.assistRatePp * teammateCoupling.assistRatePpMultiplier,
        0.3,
        2.1,
      );
      p.teammateAssistEsMultiplier = teammateCoupling.assistRateEsMultiplier;
      p.teammateAssistPpMultiplier = teammateCoupling.assistRatePpMultiplier;
      p.teammateDependencyScore = teammateCoupling.dependencyScore;
      projected.set(playerId, p);
    }

    const initialToiEs = Array.from(projected.values()).reduce(
      (acc, p) => acc + p.toiEs,
      0,
    );
    const initialToiPp = Array.from(projected.values()).reduce(
      (acc, p) => acc + p.toiPp,
      0,
    );
    const initialShotsEs = Array.from(projected.values()).reduce(
      (acc, p) => acc + p.shotsEs,
      0,
    );
    const initialShotsPp = Array.from(projected.values()).reduce(
      (acc, p) => acc + p.shotsPp,
      0,
    );

    const shotsEsTarget = safeNumber(
      strengthAverages.shotsEsAvg,
      initialShotsEs,
    );
    const shotsPpTarget = safeNumber(
      strengthAverages.shotsPpAvg,
      initialShotsPp,
    );

    const reconcileInputs = Array.from(projected.entries()).map(
      ([playerId, p]) => ({
        playerId,
        toiEsSeconds: p.toiEs,
        toiPpSeconds: p.toiPp,
        shotsEs: p.shotsEs,
        shotsPp: p.shotsPp,
      }),
    );
    const reconcileTargets = {
      toiEsSeconds: toiEsTarget,
      toiPpSeconds: toiPpTarget,
      shotsEs: shotsEsTarget,
      shotsPp: shotsPpTarget,
    };
    const { players: reconciledPlayersRaw } = reconcileTeamToPlayers({
      players: reconcileInputs,
      targets: {
        toiEsSeconds: toiEsTarget,
        toiPpSeconds: toiPpTarget,
        shotsEs: shotsEsTarget,
        shotsPp: shotsPpTarget,
      },
    });
    const reconciledValidation = validateReconciledPlayerDistribution({
      baselinePlayers: reconcileInputs,
      reconciledPlayers: reconciledPlayersRaw,
      targets: reconcileTargets,
    });
    const reconciledPlayers = reconciledValidation.players;
    if (reconciledValidation.wasAdjusted) {
      metrics.data_quality.reconciliation_distribution_adjustments += 1;
    }
    metrics.data_quality.reconciliation_top_es_share_max =
      metrics.data_quality.reconciliation_top_es_share_max == null
        ? reconciledValidation.topEsShareAfter
        : Math.max(
            metrics.data_quality.reconciliation_top_es_share_max,
            reconciledValidation.topEsShareAfter,
          );
    metrics.data_quality.reconciliation_top_pp_share_max =
      metrics.data_quality.reconciliation_top_pp_share_max == null
        ? reconciledValidation.topPpShareAfter
        : Math.max(
            metrics.data_quality.reconciliation_top_pp_share_max,
            reconciledValidation.topPpShareAfter,
          );

    const totalToiBefore = initialToiEs + initialToiPp;
    const totalToiAfter = reconciledPlayers.reduce(
      (acc, p) => acc + p.toiEsSeconds + p.toiPpSeconds,
      0,
    );
    const toiScale = totalToiBefore > 0 ? totalToiAfter / totalToiBefore : 1;

    if (Math.abs(toiScale - 1) > 0.01) {
      metrics.data_quality.toi_scaled_teams += 1;
      metrics.data_quality.toi_scale_min =
        metrics.data_quality.toi_scale_min == null
          ? toiScale
          : Math.min(metrics.data_quality.toi_scale_min, toiScale);
      metrics.data_quality.toi_scale_max =
        metrics.data_quality.toi_scale_max == null
          ? toiScale
          : Math.max(metrics.data_quality.toi_scale_max, toiScale);
    }

    for (const rp of reconciledPlayers) {
      const cur = projected.get(rp.playerId);
      if (!cur) continue;
      cur.toiEs = rp.toiEsSeconds;
      cur.toiPp = rp.toiPpSeconds;
      cur.shotsEs = rp.shotsEs;
      cur.shotsPp = rp.shotsPp;
      projected.set(rp.playerId, cur);
    }

    const playerUpserts = [];
    const teamTotals: ProjectionTotals = {
      toiEsSeconds: 0,
      toiPpSeconds: 0,
      shotsEs: 0,
      shotsPp: 0,
      goalsEs: 0,
      goalsPp: 0,
      assistsEs: 0,
      assistsPp: 0,
    };

    for (const [playerId, p] of projected.entries()) {
      const shotsEs = p.shotsEs;
      const shotsPp = p.shotsPp;
      const baseGoalsEs = shotsEs * p.goalRateEs;
      const baseGoalsPp = shotsPp * p.goalRatePp;
      const baseAssistsEs = baseGoalsEs * p.assistRateEs;
      const baseAssistsPp = baseGoalsPp * p.assistRatePp;
      const scenarioBlend = blendSkaterScenarioStatLinesAcrossHorizon({
        currentRole: p.roleTag?.esRole ?? null,
        scenarios: p.roleScenarios,
        baseGoalsEs,
        baseGoalsPp,
        baseAssistsEs,
        baseAssistsPp,
        horizonScalars: teamHorizonScalars,
        roleContinuity: p.roleContinuity,
      });
      if (skaterRollout.mode === "candidate" && p.roleScenarios.length > 0) {
        metrics.data_quality.role_scenario_blends_applied += 1;
        metrics.data_quality.role_scenario_horizon_games_modeled +=
          teamHorizonScalars.length;
      }
      const selectedSkaterStatLine = selectSkaterRolloutStatLine({
        config: skaterRollout,
        candidate: scenarioBlend.blended,
        baseline: {
          goalsEs: baseGoalsEs,
          goalsPp: baseGoalsPp,
          assistsEs: baseAssistsEs,
          assistsPp: baseAssistsPp,
        },
      });
      const goalsEs = selectedSkaterStatLine.goalsEs;
      const goalsPp = selectedSkaterStatLine.goalsPp;
      const assistsEs = selectedSkaterStatLine.assistsEs;
      const assistsPp = selectedSkaterStatLine.assistsPp;

      const totalToiMinutes = (p.toiEs + p.toiPp) / 60;
      const projHits = (totalToiMinutes / 60) * p.hitsRate;
      const projBlocks = (totalToiMinutes / 60) * p.blocksRate;
      const naivePriorGoalsEs = shotsEs * 0.095;
      const naivePriorGoalsPp = shotsPp * 0.145;
      const naivePriorAssistsEs = naivePriorGoalsEs * 0.72;
      const naivePriorAssistsPp = naivePriorGoalsPp * 0.95;

      teamTotals.toiEsSeconds += p.toiEs;
      teamTotals.toiPpSeconds += p.toiPp;
      teamTotals.shotsEs += shotsEs;
      teamTotals.shotsPp += shotsPp;
      teamTotals.goalsEs += goalsEs;
      teamTotals.goalsPp += goalsPp;
      teamTotals.assistsEs += assistsEs;
      teamTotals.assistsPp += assistsPp;

      const uncertainty = buildPlayerUncertainty(
        {
          toiEsSeconds: p.toiEs,
          toiPpSeconds: p.toiPp,
          shotsEs,
          shotsPp,
          goalsEs,
          goalsPp,
          assistsEs,
          assistsPp,
          hits: projHits,
          blocks: projBlocks,
        },
        horizonGames,
        teamHorizonScalars,
        selectSkaterRolloutScenarioMixture(
          skaterRollout,
          scenarioBlend.scenarioLines.map((s) => ({
            weight: s.probability,
            goalsEs: s.goalsEs,
            goalsPp: s.goalsPp,
            assistsEs: s.assistsEs,
            assistsPp: s.assistsPp,
            shotsEs,
            shotsPp,
          })),
        ),
        p.trendAdjustment?.uncertaintyVolatilityMultiplier ?? 1,
      );
      const scenarioMetadata = buildSkaterScenarioMetadata({
        scenarios: p.roleScenarios,
      });
      const roleTag = p.roleTag;
      const uncertaintyWithRole = buildSkaterUncertaintyWithModel({
        uncertainty,
        model: {
          source:
            skaterRollout.mode === "candidate"
              ? "heuristic_skater_role_model"
              : "scenario_free_current_rate_model",
          rollout: skaterRollout,
          holdout_baselines: {
            current_baseline: {
              definition:
                "scenario_free_current_rate_model_on_reconciled_opportunities",
              goals_es: Number(baseGoalsEs.toFixed(4)),
              goals_pp: Number(baseGoalsPp.toFixed(4)),
              assists_es: Number(baseAssistsEs.toFixed(4)),
              assists_pp: Number(baseAssistsPp.toFixed(4)),
              shots_es: Number(shotsEs.toFixed(4)),
              shots_pp: Number(shotsPp.toFixed(4)),
              hits: Number(projHits.toFixed(4)),
              blocks: Number(projBlocks.toFixed(4)),
            },
            naive_prior: {
              definition:
                "fixed_league_conversion_priors_on_reconciled_opportunities",
              goal_rate_es: 0.095,
              goal_rate_pp: 0.145,
              assist_per_goal_es: 0.72,
              assist_per_goal_pp: 0.95,
              goals_es: Number(naivePriorGoalsEs.toFixed(4)),
              goals_pp: Number(naivePriorGoalsPp.toFixed(4)),
              assists_es: Number(naivePriorAssistsEs.toFixed(4)),
              assists_pp: Number(naivePriorAssistsPp.toFixed(4)),
              shots_es: Number(shotsEs.toFixed(4)),
              shots_pp: Number(shotsPp.toFixed(4)),
              hits: Number(projHits.toFixed(4)),
              blocks: Number(projBlocks.toFixed(4)),
            },
          },
          skater_selection: {
            source: roleTag?.source ?? null,
            es_role: roleTag?.esRole ?? null,
            unit_tier: roleTag?.unitTier ?? null,
            role_rank: roleTag?.roleRank ?? null,
            used_line_combo_fallback: usedLineComboFallback,
            source_rows: {
              line_combination_game_id: lc?.gameId ?? null,
              line_combination_source_date: lcContext.sourceGameDate ?? null,
              roster_event_id:
                p.roleEvent?.event_id ?? p.availabilityEvent?.event_id ?? null,
            },
            fallback_path: {
              used: usedLineComboFallback,
              reason: lineComboFallbackReason,
              fallback_candidate_count: fallbackCandidateCount,
            },
            line_combo_recency: {
              days_stale: lcRecency.daysStale,
              class: lcRecency.isMissing
                ? "MISSING"
                : lcRecency.isHardStale
                  ? "HARD_STALE"
                  : lcRecency.isSoftStale
                    ? "SOFT_STALE"
                    : "FRESH",
            },
            active_pool: {
              raw_candidate_count: Array.from(new Set(rawSkaterIds)).length,
              team_position_candidate_count:
                teamPositionFilteredSkaterIds.length,
              eligible_candidate_count:
                activeSkaterFilter.eligibleSkaterIds.length,
              available_candidate_count: skaterIds.length,
              projected_candidate_count: projectedSkaterCount,
              dropped_candidate_counts: {
                team_or_position:
                  activeSkaterFilter.stats.filteredByTeamOrPosition,
                missing_recent_metrics:
                  activeSkaterFilter.stats.filteredMissingRecentMetrics,
                hard_stale: activeSkaterFilter.stats.filteredHardStale,
                unavailable: unavailableSkaters.length,
                no_ev_pp_gate: noMetricsPlayersSkipped,
              },
              fallback_recovery: {
                path:
                  skaterPoolRecoveryPath === "none"
                    ? null
                    : skaterPoolRecoveryPath,
                supplemental_candidates_added:
                  skaterPoolRecoverySupplementalAdded,
                missing_metrics_emergency_included:
                  skaterPoolRecoveryEmergencyIncluded,
                no_metrics_emergency_modeled: noMetricsPlayersEmergencyIncluded,
              },
            },
            recency: {
              latest_metric_date: p.latestMetricDate,
              days_since_last_metric: p.daysSinceLastMetric,
              recency_multiplier: Number(p.recencyMultiplier.toFixed(4)),
            },
            trend_adjustment: {
              selected: Boolean(p.trendAdjustment),
              applied: p.trendAdjustment?.effectState === "applied",
              effect_state: p.trendAdjustment?.effectState ?? "none",
              neutralized_by_recency:
                p.trendAdjustment?.effectState === "neutralized_by_recency",
              metric_key: p.trendAdjustment?.metricKey ?? null,
              window_code: p.trendAdjustment?.windowCode ?? null,
              snapshot_date: p.trendAdjustment?.snapshotDate ?? null,
              age_days: p.trendAdjustment?.ageDays ?? null,
              recency_class: p.trendAdjustment?.recencyClass ?? null,
              value:
                p.trendAdjustment != null
                  ? Number(p.trendAdjustment.value.toFixed(6))
                  : null,
              ci_lower:
                p.trendAdjustment != null
                  ? Number(p.trendAdjustment.ciLower.toFixed(6))
                  : null,
              ci_upper:
                p.trendAdjustment != null
                  ? Number(p.trendAdjustment.ciUpper.toFixed(6))
                  : null,
              n_eff: p.trendAdjustment?.nEff ?? null,
              confidence:
                p.trendAdjustment != null
                  ? Number(p.trendAdjustment.confidence.toFixed(4))
                  : null,
              signed_distance:
                p.trendAdjustment != null
                  ? Number(p.trendAdjustment.signedDistance.toFixed(4))
                  : null,
              multipliers: {
                shot_rate:
                  p.trendAdjustment != null
                    ? Number(p.trendAdjustment.shotRateMultiplier.toFixed(4))
                    : 1,
                goal_rate:
                  p.trendAdjustment != null
                    ? Number(p.trendAdjustment.goalRateMultiplier.toFixed(4))
                    : 1,
                assist_rate:
                  p.trendAdjustment != null
                    ? Number(p.trendAdjustment.assistRateMultiplier.toFixed(4))
                    : 1,
                uncertainty_volatility:
                  p.trendAdjustment != null
                    ? Number(
                        p.trendAdjustment.uncertaintyVolatilityMultiplier.toFixed(
                          4,
                        ),
                      )
                    : 1,
              },
            },
            role_continuity: p.roleContinuity
              ? {
                  window_games: p.roleContinuity.windowGames,
                  appearances_tracked: p.roleContinuity.appearancesTracked,
                  games_in_current_role: p.roleContinuity.gamesInCurrentRole,
                  continuity_share: p.roleContinuity.continuityShare,
                  role_change_rate: p.roleContinuity.roleChangeRate,
                  volatility_index: p.roleContinuity.volatilityIndex,
                  stability_multiplier: p.roleStabilityMultiplier,
                }
              : null,
            role_scenarios: {
              top_probability: Number(p.roleScenarioTopProbability.toFixed(4)),
              scenario_metadata: {
                model_version: scenarioMetadata.modelVersion,
                scenario_count: scenarioMetadata.scenarioCount,
                top_scenario_drivers: scenarioMetadata.topScenarioDrivers.map(
                  (d) => ({
                    role: d.role,
                    probability: Number(d.probability.toFixed(4)),
                    source: d.source,
                  }),
                ),
              },
              scenarios: p.roleScenarios.map((s) => ({
                role: s.role,
                probability: Number(s.probability.toFixed(4)),
                source: s.source,
              })),
              scenario_stat_lines: scenarioBlend.scenarioLines.map((s) => ({
                role: s.role,
                probability: Number(s.probability.toFixed(4)),
                goals_es: Number(s.goalsEs.toFixed(4)),
                goals_pp: Number(s.goalsPp.toFixed(4)),
                assists_es: Number(s.assistsEs.toFixed(4)),
                assists_pp: Number(s.assistsPp.toFixed(4)),
              })),
              horizon_summaries: scenarioBlend.horizonScenarioSummaries.map(
                (s) => ({
                  game_index: s.gameIndex,
                  top_role: s.topRole,
                  top_probability: Number(s.topProbability.toFixed(4)),
                }),
              ),
            },
            availability: p.availabilityEvent
              ? {
                  event_type: p.availabilityEvent.event_type,
                  confidence:
                    typeof p.availabilityEvent.confidence === "number" &&
                    Number.isFinite(p.availabilityEvent.confidence)
                      ? Number(p.availabilityEvent.confidence)
                      : null,
                  effective_from: p.availabilityEvent.effective_from ?? null,
                  effective_to: p.availabilityEvent.effective_to ?? null,
                  event_multiplier: Number(
                    p.eventAvailabilityMultiplier.toFixed(4),
                  ),
                }
              : null,
            shot_quality: {
              source_date: p.shotQualityProfileSourceDate,
              sample_weight: Number(p.shotQualitySampleWeight.toFixed(4)),
              shot_rate_multiplier: Number(p.shotRateMultiplier.toFixed(4)),
              goal_rate_multiplier: Number(p.goalRateMultiplier.toFixed(4)),
              quality_per_shot: p.qualityPerShot,
              rush_rebound_per_60: p.rushReboundPer60,
            },
            on_ice_context: {
              source_date: p.onIceContextSourceDate,
              sample_weight: Number(p.onIceContextSampleWeight.toFixed(4)),
              shot_environment_multiplier: Number(
                p.shotEnvironmentMultiplier.toFixed(4),
              ),
              goal_environment_multiplier: Number(
                p.goalEnvironmentMultiplier.toFixed(4),
              ),
              assist_environment_multiplier: Number(
                p.assistEnvironmentMultiplier.toFixed(4),
              ),
              possession_pct: p.onIcePossessionPct,
            },
            team_level_context: {
              sample_weight: Number(p.teamLevelSampleWeight.toFixed(4)),
              shot_rate_multiplier: Number(
                p.teamLevelShotRateMultiplier.toFixed(4),
              ),
              goal_rate_multiplier: Number(
                p.teamLevelGoalRateMultiplier.toFixed(4),
              ),
              assist_rate_multiplier: Number(
                p.teamLevelAssistRateMultiplier.toFixed(4),
              ),
              pace_edge: Number(p.teamLevelPaceEdge.toFixed(4)),
              opponent_defense_edge: Number(
                p.teamLevelOpponentDefenseEdge.toFixed(4),
              ),
            },
            opponent_goalie_context: {
              sample_weight: Number(p.opponentGoalieSampleWeight.toFixed(4)),
              goal_rate_multiplier: Number(
                p.opponentGoalieGoalRateMultiplier.toFixed(4),
              ),
              assist_rate_multiplier: Number(
                p.opponentGoalieAssistRateMultiplier.toFixed(4),
              ),
              weighted_projected_gsaa_per_60: p.opponentGoalieWeightedGsaaPer60,
              starter_certainty: Number(
                p.opponentGoalieStarterCertainty.toFixed(4),
              ),
            },
            rest_schedule: {
              sample_weight: Number(p.restScheduleSampleWeight.toFixed(4)),
              team_rest_days: p.restScheduleTeamRestDays,
              opponent_rest_days: p.restScheduleOpponentRestDays,
              rest_delta: Number(p.restScheduleRestDelta.toFixed(4)),
              toi_multiplier: Number(p.restScheduleToiMultiplier.toFixed(4)),
              shot_rate_multiplier: Number(
                p.restScheduleShotRateMultiplier.toFixed(4),
              ),
              goal_rate_multiplier: Number(
                p.restScheduleGoalRateMultiplier.toFixed(4),
              ),
              assist_rate_multiplier: Number(
                p.restScheduleAssistRateMultiplier.toFixed(4),
              ),
            },
            small_sample: {
              sample_weight: Number(p.smallSampleWeight.toFixed(4)),
              is_low_sample: p.smallSampleIsLow,
              used_callup_fallback: p.smallSampleUsedCallupFallback,
              evidence_toi_seconds: Number(
                p.smallSampleEvidenceToiSeconds.toFixed(3),
              ),
              evidence_shots: Number(p.smallSampleEvidenceShots.toFixed(3)),
            },
            conversion_rates: {
              goal_rate_es: Number(p.goalRateEs.toFixed(4)),
              goal_rate_pp: Number(p.goalRatePp.toFixed(4)),
              assist_rate_es: Number(p.assistRateEs.toFixed(4)),
              assist_rate_pp: Number(p.assistRatePp.toFixed(4)),
            },
            pp_opportunity: {
              team_pp_target_seconds: p.ppOpportunityTeamTargetSeconds,
              allocated_player_pp_share: p.ppOpportunityAllocatedShare,
            },
            teammate_context: {
              dependency_score: Number(p.teammateDependencyScore.toFixed(4)),
              assist_rate_es_multiplier: Number(
                p.teammateAssistEsMultiplier.toFixed(4),
              ),
              assist_rate_pp_multiplier: Number(
                p.teammateAssistPpMultiplier.toFixed(4),
              ),
            },
            role_usage_bounds: {
              applied: p.roleUsageBoundsApplied,
              bounded_sog_per_60_es: Number(p.boundedSogPer60Es.toFixed(3)),
              bounded_sog_per_60_pp: Number(p.boundedSogPer60Pp.toFixed(3)),
            },
          },
        },
      });

      playerUpserts.push({
        run_id: runId,
        as_of_date: asOfDate,
        horizon_games: horizonGames,
        game_id: game.id,
        player_id: playerId,
        team_id: teamId,
        opponent_team_id: opponentTeamId,
        proj_toi_es_seconds: Number(
          (p.toiEs * teamHorizonTotalScalar).toFixed(3),
        ),
        proj_toi_pp_seconds: Number(
          (p.toiPp * teamHorizonTotalScalar).toFixed(3),
        ),
        proj_toi_pk_seconds: null,
        proj_shots_es: Number((shotsEs * teamHorizonTotalScalar).toFixed(3)),
        proj_shots_pp: Number((shotsPp * teamHorizonTotalScalar).toFixed(3)),
        proj_shots_pk: null,
        proj_goals_es: Number((goalsEs * teamHorizonTotalScalar).toFixed(3)),
        proj_goals_pp: Number((goalsPp * teamHorizonTotalScalar).toFixed(3)),
        proj_goals_pk: null,
        proj_assists_es: Number(
          (assistsEs * teamHorizonTotalScalar).toFixed(3),
        ),
        proj_assists_pp: Number(
          (assistsPp * teamHorizonTotalScalar).toFixed(3),
        ),
        proj_assists_pk: null,
        proj_hits: Number((projHits * teamHorizonTotalScalar).toFixed(3)),
        proj_blocks: Number((projBlocks * teamHorizonTotalScalar).toFixed(3)),
        uncertainty: uncertaintyWithRole,
        updated_at: new Date().toISOString(),
      });

      projectedPlayerMarketInputs.set(playerId, {
        teamId,
        opponentTeamId,
        shots: Number(
          ((shotsEs + shotsPp) * teamHorizonTotalScalar).toFixed(3),
        ),
        goals: Number(
          ((goalsEs + goalsPp) * teamHorizonTotalScalar).toFixed(3),
        ),
        assists: Number(
          ((assistsEs + assistsPp) * teamHorizonTotalScalar).toFixed(3),
        ),
        powerPlayPoints: Number(
          ((goalsPp + assistsPp) * teamHorizonTotalScalar).toFixed(3),
        ),
        blockedShots: Number((projBlocks * teamHorizonTotalScalar).toFixed(3)),
        lineupSourceGameDate: lcContext.sourceGameDate,
        lineupRecencyDays: lcRecency.daysStale,
        availabilityEvent: p.availabilityEvent,
      });
    }

    playerRowsUpserted += await persistForgePlayerProjectionRows(playerUpserts);

    for (const [
      playerId,
      projectionInput,
    ] of projectedPlayerMarketInputs.entries()) {
      if (projectionInput.teamId !== teamId) continue;
      const marketSummaryByType =
        playerPropContextByGamePlayerKey.get(`${game.id}:${playerId}`) ?? null;
      if (!marketSummaryByType) continue;

      for (const [marketType, marketSummary] of Object.entries(
        marketSummaryByType,
      )) {
        const expectedValue = getProjectionValueForPropMarket({
          marketType,
          projection: {
            shots: projectionInput.shots,
            goals: projectionInput.goals,
            assists: projectionInput.assists,
            powerPlayPoints: projectionInput.powerPlayPoints,
            blockedShots: projectionInput.blockedShots,
            saves: null,
          },
        });
        if (expectedValue == null) continue;

        playerPredictionOutputRows.push({
          snapshot_date: asOfDate,
          game_id: game.id,
          player_id: playerId,
          team_id: projectionInput.teamId,
          opponent_team_id: projectionInput.opponentTeamId,
          model_name: ANALYTICS_MODEL_NAME,
          model_version: ANALYTICS_MODEL_VERSION,
          prediction_scope: "pregame",
          metric_key: marketType,
          expected_value: expectedValue,
          floor_value: null,
          ceiling_value: null,
          probability_over: null,
          line_value: getConsensusLineValue(marketSummary),
          components: {
            market_inputs: marketSummary,
            projection_inputs: {
              lineup_source_game_date: projectionInput.lineupSourceGameDate,
              lineup_recency_days: projectionInput.lineupRecencyDays,
            },
          },
          provenance: {
            provider: marketSummary.sourceNames[0] ?? null,
            input_family: "forge-player-projection",
          },
          metadata: {
            horizon_games: horizonGames,
            run_id: runId,
            availability_event: projectionInput.availabilityEvent
              ? {
                  event_type: projectionInput.availabilityEvent.event_type,
                  confidence:
                    projectionInput.availabilityEvent.confidence ?? null,
                  effective_from:
                    projectionInput.availabilityEvent.effective_from ?? null,
                  effective_to:
                    projectionInput.availabilityEvent.effective_to ?? null,
                }
              : null,
          },
        });

        const consensusLineValue = getConsensusLineValue(marketSummary);
        const edgeThreshold = PLAYER_MARKET_EDGE_THRESHOLDS[marketType] ?? 0.25;
        if (consensusLineValue != null) {
          const edgeValue = expectedValue - consensusLineValue;
          if (Math.abs(edgeValue) >= edgeThreshold) {
            modelMarketFlagRows.push(
              buildModelMarketFlagRow({
                asOfDate,
                entityType: "player",
                entityId: playerId,
                gameId: game.id,
                marketType,
                flagType: edgeValue > 0 ? "model_over" : "model_under",
                edgeValue,
                reasons: [
                  {
                    expected_value: expectedValue,
                    line_value: consensusLineValue,
                    sportsbook_count: marketSummary.sportsbookKeys.length,
                  },
                ],
                provider: marketSummary.sourceNames[0] ?? null,
                metadata: {
                  horizon_games: horizonGames,
                  run_id: runId,
                },
              }),
            );
          }
        }
      }
    }

    const teamUpsert = {
      run_id: runId,
      as_of_date: asOfDate,
      horizon_games: horizonGames,
      game_id: game.id,
      team_id: teamId,
      opponent_team_id: opponentTeamId,
      proj_toi_es_seconds: Number(
        (teamTotals.toiEsSeconds * teamHorizonTotalScalar).toFixed(3),
      ),
      proj_toi_pp_seconds: Number(
        (teamTotals.toiPpSeconds * teamHorizonTotalScalar).toFixed(3),
      ),
      proj_toi_pk_seconds: null,
      proj_shots_es: Number(
        (teamTotals.shotsEs * teamHorizonTotalScalar).toFixed(3),
      ),
      proj_shots_pp: Number(
        (teamTotals.shotsPp * teamHorizonTotalScalar).toFixed(3),
      ),
      proj_shots_pk: null,
      proj_goals_es: Number(
        (teamTotals.goalsEs * teamHorizonTotalScalar).toFixed(3),
      ),
      proj_goals_pp: Number(
        (teamTotals.goalsPp * teamHorizonTotalScalar).toFixed(3),
      ),
      proj_goals_pk: null,
      uncertainty: buildTeamUncertainty(
        {
          toiEsSeconds: teamTotals.toiEsSeconds,
          toiPpSeconds: teamTotals.toiPpSeconds,
          shotsEs: teamTotals.shotsEs,
          shotsPp: teamTotals.shotsPp,
          goalsEs: teamTotals.goalsEs,
          goalsPp: teamTotals.goalsPp,
        },
        horizonGames,
        teamHorizonScalars,
      ),
      updated_at: new Date().toISOString(),
    };

    teamRowsUpserted += await persistForgeTeamProjection(teamUpsert);

    teamShotsByTeamId.set(teamId, {
      shotsEs: Number(teamUpsert.proj_shots_es ?? 0),
      shotsPp: Number(teamUpsert.proj_shots_pp ?? 0),
    });
    teamGoalsByTeamId.set(
      teamId,
      Number(
        (
          (teamTotals.goalsEs + teamTotals.goalsPp) *
          teamHorizonTotalScalar
        ).toFixed(3),
      ),
    );

    // Goalie: pick the highest probability starter from goalie_start_projections if available.
    const goalieOverride = goalieOverrideByTeamId.get(teamId);
    const { data: goalieStarts, error: gsErr } = await supabase
      .from("goalie_start_projections")
      .select(
        "player_id,start_probability,confirmed_status,l10_start_pct,season_start_pct,games_played,projected_gsaa_per_60",
      )
      .eq("game_id", game.id)
      .eq("team_id", teamId)
      .order("start_probability", { ascending: false })
      .limit(6);
    if (gsErr) throw gsErr;
    if (!fallbackGoalieByTeamId.has(teamId)) {
      fallbackGoalieByTeamId.set(
        teamId,
        await fetchLatestGoalieForTeam(teamId, asOfDate),
      );
    }
    const fallbackGoalieId = fallbackGoalieByTeamId.get(teamId) ?? null;
    if (!teamGoalieStarterContextCache.has(teamDateKey(teamId))) {
      teamGoalieStarterContextCache.set(
        teamDateKey(teamId),
        await fetchTeamGoalieStarterContext(teamId, asOfDate),
      );
    }
    if (!currentTeamGoalieIdsCache.has(teamDateKey(teamId))) {
      currentTeamGoalieIdsCache.set(
        teamDateKey(teamId),
        await fetchCurrentTeamGoalieIds(teamId),
      );
    }
    if (!teamLineComboGoaliePriorCache.has(teamDateKey(teamId))) {
      teamLineComboGoaliePriorCache.set(
        teamDateKey(teamId),
        await fetchTeamLineComboGoaliePrior(teamId, asOfDate),
      );
    }
    const context = teamGoalieStarterContextCache.get(
      teamDateKey(teamId),
    ) as TeamGoalieStarterContext;
    const currentTeamGoalieIds = currentTeamGoalieIdsCache.get(
      teamDateKey(teamId),
    ) as Set<number>;
    const lineComboPriorByGoalieId =
      teamLineComboGoaliePriorCache.get(teamDateKey(teamId)) ??
      new Map<number, number>();

    const priorStartProbByGoalieId = new Map<number, number>();
    const confirmedStarterByGoalieId = new Map<number, boolean>();
    const projectedGsaaPer60ByGoalieId = new Map<number, number>();
    const seasonStartPctByGoalieId = new Map<number, number>();
    const seasonGamesPlayedByGoalieId = new Map<number, number>();
    for (const row of goalieStarts ?? []) {
      const goalieId = Number((row as any)?.player_id);
      if (!Number.isFinite(goalieId)) continue;
      priorStartProbByGoalieId.set(
        goalieId,
        clamp(Number((row as any)?.start_probability ?? 0.5), 0.01, 0.99),
      );
      confirmedStarterByGoalieId.set(
        goalieId,
        Boolean((row as any)?.confirmed_status),
      );
      const projectedGsaaPer60 = Number((row as any)?.projected_gsaa_per_60);
      if (Number.isFinite(projectedGsaaPer60)) {
        projectedGsaaPer60ByGoalieId.set(goalieId, projectedGsaaPer60);
      }
      const seasonStartPct = Number((row as any)?.season_start_pct);
      if (Number.isFinite(seasonStartPct)) {
        seasonStartPctByGoalieId.set(goalieId, clamp(seasonStartPct, 0, 1));
      }
      const gamesPlayed = Number((row as any)?.games_played);
      if (Number.isFinite(gamesPlayed) && gamesPlayed >= 0) {
        seasonGamesPlayedByGoalieId.set(goalieId, gamesPlayed);
      }
    }
    if (goalieOverride) {
      priorStartProbByGoalieId.set(
        goalieOverride.goalieId,
        goalieOverride.starterProb,
      );
      confirmedStarterByGoalieId.set(
        goalieOverride.goalieId,
        goalieOverride.starterProb >= 1,
      );
    }

    const contextGoalies = Array.from(context.startsByGoalie.keys()).slice(
      0,
      4,
    );
    const rawCandidateGoalieIds = Array.from(
      new Set(
        [
          goalieOverride?.goalieId ?? null,
          ...(goalieStarts ?? []).map((r: any) => Number(r.player_id)),
          ...(lc?.goalies ?? []),
          ...contextGoalies,
          fallbackGoalieId,
        ].filter((n): n is number => Number.isFinite(n)),
      ),
    );
    const candidateGoalieIds = selectStarterCandidateGoalieIds({
      asOfDate,
      rawCandidateGoalieIds,
      currentTeamGoalieIds,
      context,
      goalieOverrideGoalieId: goalieOverride?.goalieId ?? null,
      priorStartProbByGoalieId,
      confirmedStarterByGoalieId,
      limit: 3,
    });

    if (candidateGoalieIds.length > 0) {
      goalieCandidates.push({
        teamId,
        opponentTeamId,
        candidateGoalieIds,
        priorStartProbByGoalieId,
        confirmedStarterByGoalieId,
        lineComboPriorByGoalieId,
        projectedGsaaPer60ByGoalieId,
        seasonStartPctByGoalieId,
        seasonGamesPlayedByGoalieId,
        override: goalieOverride ?? null,
      });
    }
  }
  return { timedOut: false, playerRowsUpserted, teamRowsUpserted };
}
