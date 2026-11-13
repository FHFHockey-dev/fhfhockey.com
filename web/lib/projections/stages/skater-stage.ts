import { starterBoardFlags } from "../starterBoardFlags";
import { bootstrapSkaterLine, loadSeasonBootstrap, type SeasonBootstrap } from "../seasonBootstrap";
import { buildNativePlayerGoalAccounting, buildNativeTeamGoalAccounting, buildNativeSkaterParticipationFields, selectConfirmedNativeSkaterCandidates, buildNativeRosterContributorCoverage } from "../nativeGoalAccounting";
import supabase from "lib/supabase/server";
import { getSeasonById, type SeasonDetails } from "lib/NHL/server";
import { loadSkaterRecencySeasons, regularSeasonRecencyDays } from "../utils/season-recency";
import { resolveNullableCompatibilityValue } from "lib/rollingPlayerMetricCompatibility";
import { fetchCurrentRosterPlayerIds, fetchSkaterRecencyEvents } from "../queries/skater-queries";
import { fetchRecentTeamLineCombinations } from "lib/projections/queries/line-combo-queries";
import { hasCompleteStoredPbpGame } from "lib/projections/pbpCompletenessServer";
import { classifyStoredShiftChartStrengthGame } from "lib/projections/shiftChartCompletenessServer";
// This file is the canonical projection runner that replaced the removed
// runProjectionV2 shim. Keep cleanup inventory updates alongside
// lib/projections/compatibilityInventory.ts so surviving compatibility surfaces
// stay explicit while transitional routes are retired.
import { reconcileTeamToPlayers } from "lib/projections/reconcile";
import { buildReserveSkaterLine, buildReserveSkaterRow, forgeReservePassEnabled, selectReserveSkaters } from "lib/projections/reserveProjections";
import { FORGE_LONG_ABSENCE_LOOKBACK_DAYS, buildTeamSkaterCoverage, recordTeamSkaterCoverage, skaterAvailabilityForGame, type SkaterCoverageUnknownReason } from "lib/projections/skaterCoverage";
import { timeAwayDisclosure, timeAwayEvidence } from "lib/projections/timeAwayDecay";
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
  LeaguePhysicalTotals,
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
  SKATER_ASSIST_SHARE_MIN,
  SKATER_ASSIST_SHARE_MAX,
  SKATER_TEAM_ASSISTS_PER_GOAL,
  SKATER_GOAL_CONVERSION_PRIORS,
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
  fetchLatestSkaterContextProfiles,
  fetchLatestSkaterTrendAdjustments,
  fetchLatestWgoSkaterDeploymentProfiles,
  fetchLeaguePhysicalTotals,
  fetchRollingRows,
} from "../queries/skater-queries";
import { type MarketTypeSummary } from "../queries/market-queries";
import {
  fetchCurrentTeamGoalieIds,
  fetchGoalieEvidence,
  fetchGoalieRestSplitProfile,
  fetchGoalieWorkloadContext,
  fetchLatestGoalieForTeam,
  fetchTeamGoalieStarterContext,
  fetchTeamLineComboGoaliePrior,
} from "../queries/goalie-queries";
import {
  fetchTeamDefensiveEnvironment,
  fetchTeamFiveOnFiveProfile,
  fetchTeamNstExpectedGoalsProfile,
  fetchTeamOffenseEnvironment,
  fetchTeamOfficialPpUsage,
  fetchTeamRestDays,
  fetchTeamStrengthAverages,
  fetchTeamStrengthPrior,
  type TeamOfficialPpUsage,
  type TeamStrengthAverages,
} from "../queries/team-context-queries";
import { createRun, finalizeRun } from "../queries/run-lifecycle-queries";
import {
  computeSkaterOnIceContextAdjustments,
  computeSkaterPhysicalEventRates,
  computeSkaterAssistShare,
  computeSkaterShotRatePer60,
  computeSkaterRestScheduleAdjustments,
  computeSkaterSampleShrinkageAdjustments,
  computeSkaterShotQualityAdjustments,
  computeSkaterTeamLevelContextAdjustments,
  computeStrengthSplitConversionRates,
  resolveAssistDenominators,
  skaterConversionPriorsAndBounds,
  SKATER_ASSIST_DENOMINATOR_DEFAULT,
  type SkaterAssistDenominatorOption,
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
  computeOpponentGoalieFinishingContext,
  fetchOpponentGoalieCandidateQuality,
  type OpponentGoalieFinishingContext,
} from "../opponentGoalieQuality";
import {
  getSeasonLeagueSavePct,
  type SeasonLeagueSavePctCache,
} from "../goalie/leagueSavePct";
import {
  SKATER_STRENGTH_ACCOUNTING_VERSION,
  allocateTeamPkToi,
  computeSkaterPkConversion,
  skaterPkWeightSeconds,
  splitTeamSkaterBudget,
} from "../calculators/skater-strength-buckets";
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
  persistForgeReserveProjectionRows,
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
  buildModelMarketProbabilityFlagRow,
  compareModelWithMarket,
  forgePropOverProbability,
  GAME_MARKET_EDGE_THRESHOLDS,
  getConsensusLineValue,
  getProjectionValueForPropMarket,
  quotesFromMarketSummary,
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
  // Declared adapter (rule 17): WGO per-game TOI is seconds; magnitude never selects minutes.
  return Number(n.toFixed(3));
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

/** Current roster membership supplies candidates, never confirmed participation or rates. */
export function selectLineCombinationFallback(args: {
  rollingSkaterIds: number[];
  activeRosterSkaterIds: number[];
  seasonBootstrap: boolean;
}): { playerIds: number[]; rosterBootstrap: boolean } {
  const rosterBootstrap = args.rollingSkaterIds.length === 0 && args.seasonBootstrap;
  const candidates = rosterBootstrap ? args.activeRosterSkaterIds : args.rollingSkaterIds;
  return { playerIds: [...new Set(candidates)].filter(id => Number.isSafeInteger(id) && id > 0), rosterBootstrap };
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
    filteredInvalidSeasonEvidence: number;
    softStalePenalized: number;
  };
  excludedSkaterIdsByReason: {
    teamOrPosition: number[];
    missingRecentMetrics: number[];
    hardStale: number[];
    invalidSeasonEvidence: number[];
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

export function roleTagFromRosterEvent(
  event: RosterEventRow | null,
): SkaterRoleTag | null {
  if (!event) return null;
  const payload = parseRosterEventPayload(event.payload);
  const role = typeof payload.role === "string" ? payload.role : null;
  const lineNumber = Number(payload.lineNumber ?? payload.line_number);
  const ppUnit = Number(payload.ppUnit ?? payload.pp_unit);

  // A line or PP tweet without a line/unit number names no role: unknown, never a default L3/PP2
  // (BC W1-7 D2). The line combinations then supply the role.
  if (event.event_type === "LINE_CHANGE") {
    if (role == null && !(Number.isFinite(lineNumber) && lineNumber >= 1)) return null;
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
    if (role == null && !(Number.isFinite(ppUnit) && ppUnit >= 1)) return null;
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
  currentSeasonId: number;
  recencySeasons: readonly SeasonDetails[];
  recencyEventByPlayerId: ReadonlyMap<number, { date: string; seasonId: number; type: number }>;
  seasonBootstrapPlayerIds?: ReadonlySet<number>;
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
    filteredInvalidSeasonEvidence: 0,
    softStalePenalized: 0,
  };
  const excludedSkaterIdsByReason = {
    teamOrPosition: [] as number[],
    missingRecentMetrics: [] as number[],
    hardStale: [] as number[],
    invalidSeasonEvidence: [] as number[],
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
    if (args.seasonBootstrapPlayerIds?.has(playerId)) {
      eligibleSkaterIds.push(playerId);
      recencyMultiplierByPlayerId.set(playerId, 1);
      continue;
    }
    if (!latestMetricDate) {
      stats.filteredMissingRecentMetrics += 1;
      excludedSkaterIdsByReason.missingRecentMetrics.push(playerId);
      continue;
    }

    const event = args.recencyEventByPlayerId.get(playerId);
    const daysSinceLastMetric = event?.date !== latestMetricDate ? null : regularSeasonRecencyDays({
      eventDate: latestMetricDate, asOfDate: args.asOfDate,
      eventSeasonId: event.seasonId, eventGameType: event.type,
      currentSeasonId: args.currentSeasonId, seasons: args.recencySeasons,
    });
    if (daysSinceLastMetric === null) {
      stats.filteredInvalidSeasonEvidence += 1;
      excludedSkaterIdsByReason.invalidSeasonEvidence.push(playerId);
      continue;
    }
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

export function allocatePpToiByTeamOpportunity(args: {
  projectedByPlayer: Map<
    number,
    {
      toiPp: number;
      roleTag: SkaterRoleTag | null;
      officialPpToiAvgSec?: number | null;
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

  // Proportional to official last-10 PP TOI per game when known, else the pre-allocation PP TOI;
  // a zero weight gets zero time.
  const weighted = players.map(([playerId, p]) => {
    const basePpToi = Math.max(0, p.toiPp);
    const official = finiteOrNull(p.officialPpToiAvgSec);
    const weight = official != null ? Math.max(0, official) : basePpToi;
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

// Assist-rate clamps after the trend and teammate-coupling multipliers, per assist scale.
const SKATER_ASSIST_RATE_CLAMPS = {
  per_goal: {
    trend: { es: [0.4, 3.4], pp: [0.6, 4] },
    coupling: { es: [0.4, 3.6], pp: [0.6, 4.2] },
  },
  per_two_goals: {
    trend: { es: [0.2, 1.7], pp: [0.3, 2] },
    coupling: { es: [0.2, 1.8], pp: [0.3, 2.1] },
  },
} as const;

export function clampSkaterAssistRate(
  rate: number,
  strength: "es" | "pp",
  step: "trend" | "coupling",
  assistDenominator: SkaterAssistDenominatorOption,
): number {
  const convention = resolveAssistDenominators(assistDenominator)[strength];
  const [min, max] = SKATER_ASSIST_RATE_CLAMPS[convention][step][strength];
  return clamp(rate, min, max);
}

/** Holdout benchmark: fixed league conversion priors on the live per-strength assist scales. */
export function buildSkaterNaivePriorBaseline(args: {
  shotsEs: number;
  shotsPp: number;
}) {
  const { priors } = skaterConversionPriorsAndBounds(
    SKATER_ASSIST_DENOMINATOR_DEFAULT,
  );
  const goalsEs = args.shotsEs * priors.goalRateEs;
  const goalsPp = args.shotsPp * priors.goalRatePp;
  return {
    goal_rate_es: priors.goalRateEs,
    goal_rate_pp: priors.goalRatePp,
    assist_per_goal_es: priors.assistRateEs,
    assist_per_goal_pp: priors.assistRatePp,
    goals_es: goalsEs,
    goals_pp: goalsPp,
    assists_es: goalsEs * priors.assistRateEs,
    assists_pp: goalsPp * priors.assistRatePp,
  };
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
  /** Without a PP unit the role PP minimum does not apply. */
  hasPpUnit?: boolean;
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
    args.hasPpUnit === false ? 0 : limits.toiPpMin,
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

/**
 * Team PP share of skater time. Official WGO usage (PP over all-situation skater TOI) when present;
 * otherwise the strength table with PK time in the denominator, then the pre-allocation split.
 * `legacyPpShare` is the former ES+PP-denominator share, kept for the ledger.
 */
export function computeTeamPpShare(args: {
  official: TeamOfficialPpUsage | null;
  strengthAverages: TeamStrengthAverages;
  preAllocationToiEs: number;
  preAllocationToiPp: number;
}): {
  ppShare: number;
  legacyPpShare: number;
  source: "official_wgo" | "strength_table_pk_denominator";
} {
  const avgToiPp = safeNumber(args.strengthAverages.toiPpSecondsAvg, 0);
  const esPpDenom =
    safeNumber(args.strengthAverages.toiEsSecondsAvg, 0) + avgToiPp;
  const allDenom =
    esPpDenom + safeNumber(args.strengthAverages.toiPkSecondsAvg, 0);
  const fallbackDenom = args.preAllocationToiEs + args.preAllocationToiPp;
  const fallbackShare =
    fallbackDenom > 0 ? args.preAllocationToiPp / fallbackDenom : 0.1;
  const legacyPpShare = esPpDenom > 0 ? avgToiPp / esPpDenom : fallbackShare;
  const official = args.official;
  if (official && official.totalToiSkaterSecondsAvg > 0) {
    return {
      ppShare: official.ppToiSkaterSecondsAvg / official.totalToiSkaterSecondsAvg,
      legacyPpShare,
      source: "official_wgo",
    };
  }
  return {
    ppShare: allDenom > 0 ? avgToiPp / allDenom : fallbackShare,
    legacyPpShare,
    source: "strength_table_pk_denominator",
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
  seasonBootstrap?: boolean;
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
  ppEventByPlayer?: Map<number, RosterEventRow>;
  /** Official PP usage by team:asOfDate; a per-call cache is used when omitted. */
  teamOfficialPpUsageCache?: Map<string, TeamOfficialPpUsage | null>;
  dailyBoardEvidence?: import("../dailyBoardEvidence").DailyBoardEvidence;
  goalieOverrideByTeamId: Map<
    number,
    { goalieId: number; starterProb: number }
  >;
  activeRosterSkaterIdsByTeamId: Map<number, number[]>;
  teamHorizonScalarsCache: Map<string, number[]>;
  teamSkaterRoleHistoryCache: Map<string, Map<number, string[]>>;
  teamShotsByTeamId: Map<number, { shotsEs: number; shotsPp: number; shotsPk?: number | null }>;
  teamGoalsByTeamId: Map<number, number>;
  fallbackGoalieByTeamId: Map<number, number | null>;
  teamGoalieStarterContextCache: Map<string, TeamGoalieStarterContext>;
  teamDefensiveEnvironmentCache: Map<string, TeamDefensiveEnvironment>;
  teamOffenseEnvironmentCache: Map<string, TeamOffenseEnvironment>;
  teamRestDaysCache: Map<string, number | null>;
  teamStrengthPriorCache: Map<string, TeamStrengthPrior | null>;
  teamStrengthCache: Map<string, TeamStrengthAverages>;
  leaguePhysicalTotalsCache: Map<string, LeaguePhysicalTotals | null>;
  /** The run's league save % cache (shared with the goalie stage); a per-call cache when omitted. */
  leagueSavePctCache?: SeasonLeagueSavePctCache;
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
    leaguePhysicalTotalsCache,
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
  const localOfficialPpUsageCache = new Map<string, TeamOfficialPpUsage | null>();
  const localLeagueSavePctCache: SeasonLeagueSavePctCache = new Map();
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
        await fetchCurrentRosterPlayerIds(teamId, currentSeasonId),
      );
    }
    const activeRosterSkaterIds =
      activeRosterSkaterIdsByTeamId.get(teamId) ?? [];
    // No lineup means no team environment for reserve lines: the whole roster is unknown, counted, never silent.
    const recordTeamLineupUnavailable = async () => {
      const meta = await fetchPlayerMetaByIds(activeRosterSkaterIds);
      recordTeamSkaterCoverage(metrics, buildTeamSkaterCoverage({ gameId: game.id, teamId,
        eligibleIds: activeRosterSkaterIds.filter((id) => meta.get(id)?.position !== "G"), lineupIds: [], reserveIds: [],
        unknownReasonById: new Map(), defaultUnknownReason: "team_lineup_unavailable" }));
    };

    let usedLineComboFallback = false;
    let lineComboFallbackReason: "missing" | "hard_stale" | "empty" | "season_bootstrap_roster" | null =
      null;
    let fallbackCandidateCount = 0;

    if (
      lcRecency.isMissing ||
      lcRecency.isHardStale ||
      rawSkaterIds.length === 0
    ) {
      if (lcRecency.isMissing) metrics.data_quality.missing_line_combos += 1;
      const rollingSkaterIds = await fetchFallbackSkaterIdsForTeam(
        teamId,
        currentSeasonId,
        asOfDate,
        18,
      );
      const { playerIds: fallbackSkaterIds, rosterBootstrap } = selectLineCombinationFallback({
        rollingSkaterIds, activeRosterSkaterIds, seasonBootstrap: args.seasonBootstrap === true,
      });
      if (fallbackSkaterIds.length > 0) {
        rawSkaterIds = fallbackSkaterIds;
        usedLineComboFallback = true;
        lineComboFallbackReason = rosterBootstrap ? "season_bootstrap_roster" : lcRecency.isMissing
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
        await recordTeamLineupUnavailable();
        continue;
      }
    }
    rawSkaterIds = constrainSkaterIdsToActiveRoster({
      candidateSkaterIds: rawSkaterIds,
      activeRosterSkaterIds,
    });
    if (starterBoardFlags().compute) rawSkaterIds = selectConfirmedNativeSkaterCandidates({
      gameId: game.id, teamId, candidatePlayerIds: rawSkaterIds, currentRosterPlayerIds: activeRosterSkaterIds, evidence: args.dailyBoardEvidence,
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

    const seasonYear = Math.floor(game.id / 1_000_000);
    const bootstrapSeasonId = seasonYear * 10000 + seasonYear + 1;
    let bootstrap = args.seasonBootstrap
      ? await loadSeasonBootstrap(teamPositionFilteredSkaterIds, bootstrapSeasonId, asOfDate, "skater")
      : new Map<number, SeasonBootstrap>();
    const bootstrapEligible = () => new Set([...bootstrap].filter(([, prior]) => prior.currentSeasonGames === 0
      && prior.historyGames > 0).map(([id]) => id));
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
    // PK rows feed only the PK bucket; they never decide pool membership.
    let pkLatest = pickLatestByPlayer(await fetchRollingRows(
      teamPositionFilteredSkaterIds,
      "pk",
      asOfDate,
    ));
    // Hits and blocks only: the all-strength row keeps NHL counts where NST is missing.
    let allLatest = pickLatestByPlayer(await fetchRollingRows(
      teamPositionFilteredSkaterIds,
      "all",
      asOfDate,
    ));
    // League hit/block totals rescale prior-season history: one read per run and date; constant priors if it fails.
    const leaguePhysicalKey = `${currentSeasonId}:${asOfDate}`;
    if (!leaguePhysicalTotalsCache.has(leaguePhysicalKey)) {
      let totals: LeaguePhysicalTotals | null = null;
      try {
        totals = await fetchLeaguePhysicalTotals(currentSeasonId, asOfDate);
      } catch (error) {
        metrics.data_quality.physical_league_totals_unavailable =
          (metrics.data_quality.physical_league_totals_unavailable ?? 0) + 1;
        if (error instanceof Error && "reason" in error && error.reason === "rpc_missing") {
          metrics.warnings.push("physical_league_totals_rpc_missing:without_league_rescale");
        }
      }
      leaguePhysicalTotalsCache.set(leaguePhysicalKey, totals);
    }
    const leaguePhysicalTotals = leaguePhysicalTotalsCache.get(leaguePhysicalKey) ?? null;
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

    const recencySeasonCache = new Map<number, SeasonDetails | null>();
    const loadRecencySeasons = (dates: Map<number, string>) => loadSkaterRecencySeasons({
      currentSeasonId, latestEventDates: [...dates.values()], readSeason: async id => {
        if (!recencySeasonCache.has(id)) recencySeasonCache.set(id, await getSeasonById(id, supabase));
        return recencySeasonCache.get(id)!;
      },
    });
    let recencySeasons = await loadRecencySeasons(latestMetricDateByPlayerId);
    const loadRecencyEvents = async () => {
      const rows = teamPositionFilteredSkaterIds.map(id => {
        const ev = evLatest.get(id), pp = ppLatest.get(id);
        return ev && pp ? ev.game_date > pp.game_date ? ev : pp : ev ?? pp;
      }).filter((row): row is RollingRow => row != null);
      return fetchSkaterRecencyEvents(rows);
    };
    let recencyEventByPlayerId = await loadRecencyEvents();
    let activeSkaterFilter = filterActiveSkaterCandidateIds({
      currentSeasonId, recencySeasons, recencyEventByPlayerId,
      asOfDate,
      teamId,
      rawSkaterIds,
      playerMetaById,
      latestMetricDateByPlayerId,
      seasonBootstrapPlayerIds: bootstrapEligible(),
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

        if (args.seasonBootstrap) bootstrap = await loadSeasonBootstrap(teamPositionFilteredSkaterIds, bootstrapSeasonId, asOfDate, "skater");
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
        pkLatest = pickLatestByPlayer(await fetchRollingRows(
          teamPositionFilteredSkaterIds,
          "pk",
          asOfDate,
        ));
        allLatest = pickLatestByPlayer(await fetchRollingRows(
          teamPositionFilteredSkaterIds,
          "all",
          asOfDate,
        ));
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
        recencySeasons = await loadRecencySeasons(latestMetricDateByPlayerId);
        recencyEventByPlayerId = await loadRecencyEvents();
        activeSkaterFilter = filterActiveSkaterCandidateIds({
          currentSeasonId, recencySeasons, recencyEventByPlayerId,
          asOfDate,
          teamId,
          rawSkaterIds,
          playerMetaById,
          latestMetricDateByPlayerId,
          seasonBootstrapPlayerIds: bootstrapEligible(),
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
      await recordTeamLineupUnavailable();
      continue;
    }
    metrics.data_quality.filtered_skater_team_or_position +=
      activeSkaterFilter.stats.filteredByTeamOrPosition;
    metrics.data_quality.filtered_skater_missing_metrics +=
      activeSkaterFilter.stats.filteredMissingRecentMetrics;
    metrics.data_quality.filtered_skater_hard_stale +=
      activeSkaterFilter.stats.filteredHardStale;
    if (activeSkaterFilter.stats.filteredInvalidSeasonEvidence > 0) {
      metrics.warnings.push(`invalid regular-season recency evidence for game=${game.id} team=${teamId}; held_player_ids=${activeSkaterFilter.excludedSkaterIdsByReason.invalidSeasonEvidence.join(",")}`);
    }
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
      await recordTeamLineupUnavailable();
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
    // Opponent goalie (W1 P0 #21): posterior save quality from pre-cutoff history, mixed by start
    // probability with unresolved mass at league average; goals per shot scale by the ratio.
    const leagueSavePct = await getSeasonLeagueSavePct(asOfDate, args.leagueSavePctCache ?? localLeagueSavePctCache);
    if (leagueSavePct.warning && !metrics.warnings.includes(leagueSavePct.warning)) metrics.warnings.push(leagueSavePct.warning);
    const opponentGoalieCandidates = await fetchOpponentGoalieCandidateQuality({
      gameId: game.id,
      opponentTeamId,
      asOfDate,
      confirmedGoalieId: goalieOverrideByTeamId.get(opponentTeamId)?.starterProb === 1
        ? goalieOverrideByTeamId.get(opponentTeamId)?.goalieId : undefined,
    });
    const opponentGoalieFinishing = opponentGoalieCandidates.length > 0
      ? computeOpponentGoalieFinishingContext({ candidates: opponentGoalieCandidates, leagueSavePct: leagueSavePct.savePct })
      : null;
    if (opponentGoalieFinishing != null) {
      metrics.data_quality.opponent_goalie_context_profiles_found += 1;
      metrics.data_quality.opponent_goalie_context_adjustments_applied += 1;
    }
    // Assists are shares of on-ice goals, so they follow the goal effect rather than a second term.
    const opponentGoalieContextAdjustment = {
      sampleWeight: opponentGoalieFinishing?.resolvedStartMass ?? 0,
      goalRateMultiplier: opponentGoalieFinishing?.goalRateMultiplier ?? 1,
      assistRateMultiplier: opponentGoalieFinishing?.goalRateMultiplier ?? 1,
      starterCertainty: opponentGoalieFinishing?.candidates[0]?.startProbability ?? 0,
    };
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
      // The Q8 tiers remain an unqualified offline candidate; preserve Release C behavior.
      buckets: "legacy",
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
    const { shotQuality: shotQualityByPlayerId, onIceContext: onIceContextByPlayerId } = await fetchLatestSkaterContextProfiles(
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
        toiPk: number;
        shotsPk: number;
        goalRatePk: number;
        assistRatePk: number;
        /** Recent PK seconds per game x availability; null = no PK rolling row (unknown). */
        pkWeightSeconds: number | null;
        pkRow: RollingRow | undefined;
        trendShotMultiplier: number;
        trendGoalMultiplier: number;
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
        opponentGoalieFinishing: OpponentGoalieFinishingContext | null;
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
        ppOpportunityTargetSource:
          | "official_wgo"
          | "strength_table_pk_denominator"
          | null;
        ppOpportunityLegacyTeamTargetSeconds: number | null;
        ppOpportunityAllocationEvidence:
          | "official_last10_pp_toi"
          | "rolling_pp_toi";
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
        !ev && !pp && (emergencyMissingMetricSkaterIdSet.has(playerId) || bootstrapEligible().has(playerId));
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

      // Shot rates shrink once, to F/D priors by measured hours (task 4); no second games-based shrink.
      const shotPosition = playerMetaById.get(playerId)?.position ?? null;
      const shotRateMultiplier =
        shotQualityAdjustment.shotRateMultiplier *
        onIceContextAdjustment.shotEnvironmentMultiplier *
        teamLevelContextAdjustment.shotRateMultiplier *
        restScheduleAdjustment.shotRateMultiplier;
      const sogPer60EvPreBound = clamp(
        computeSkaterShotRatePer60({ position: shotPosition, strength: "es", shotsAll: ev?.shots_total_all, toiSecondsAll: ev?.toi_seconds_total_all,
          ratePer60All: resolveNullableCompatibilityValue("weighted_rate", ev?.sog_per_60_all, ev?.sog_per_60_avg_all),
          shotsRecent: ev?.shots_total_last5, toiRecentSeconds: ev?.toi_seconds_total_last5 }) * shotRateMultiplier,
        1.5,
        20,
      );
      const sogPer60PpPreBound = clamp(
        computeSkaterShotRatePer60({ position: shotPosition, strength: "pp", shotsAll: pp?.shots_total_all, toiSecondsAll: pp?.toi_seconds_total_all,
          ratePer60All: resolveNullableCompatibilityValue("weighted_rate", pp?.sog_per_60_all, pp?.sog_per_60_avg_all),
          shotsRecent: pp?.shots_total_last5, toiRecentSeconds: pp?.toi_seconds_total_last5 }) * shotRateMultiplier,
        2,
        28,
      );
      const ppRole = roleTagFromRosterEvent(args.ppEventByPlayer?.get(playerId) ?? null);
      const boundedUsage = applyRoleSpecificUsageBounds({
        roleTag,
        toiEsSeconds: shrunkToiEs,
        toiPpSeconds: shrunkToiPp,
        sogPer60Es: sogPer60EvPreBound,
        sogPer60Pp: sogPer60PpPreBound,
        hasPpUnit: ppRole != null,
      });
      const ppUsage = ppRole ? applyRoleSpecificUsageBounds({
        roleTag: ppRole, toiEsSeconds: shrunkToiEs, toiPpSeconds: shrunkToiPp,
        sogPer60Es: sogPer60EvPreBound, sogPer60Pp: sogPer60PpPreBound,
      }) : boundedUsage;
      if (boundedUsage.wasBounded) {
        metrics.data_quality.role_usage_bounds_applied += 1;
      }
      const boundedToiEs = boundedUsage.toiEsSeconds;
      const boundedToiPp = ppUsage.toiPpSeconds;
      const sogPer60Ev = boundedUsage.sogPer60Es;
      const sogPer60Pp = ppUsage.sogPer60Pp;

      const physicalRates = computeSkaterPhysicalEventRates({
        all: allLatest.get(playerId),
        position: playerMetaById.get(playerId)?.position ?? null,
        esPpToiSeconds: toiEs + toiPp,
        currentSeasonId,
        league: leaguePhysicalTotals,
      });

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
        position: playerMetaById.get(playerId)?.position ?? null,
      });
      // Goals per shot shrink to the F/D prior by measured shots (task 4). The small-sample shrink
      // stays, now toward that prior: it also damps the context goal multipliers above, which
      // compound to about 1.3 for some skaters until task 9 sizes them (dropping it, Q7, raised
      // forward goals per shot to 0.154 in the 10-13 pilot).
      const goalPrior = SKATER_GOAL_CONVERSION_PRIORS[shotPosition === "D" ? "D" : "F"];
      const goalRateEs = clamp(splitRates.goalRateEs * sampleWeight + (1 - sampleWeight) * goalPrior.es.perShot, 0.025, 0.3);
      const goalRatePp = clamp(splitRates.goalRatePp * sampleWeight + (1 - sampleWeight) * goalPrior.pp.perShot, 0.04, 0.45);
      // Assist rates are shares of on-ice goals for (task 3), shrunk to F/D priors; the
      // team-goal environment carries the goal context terms, so no assist multiplier applies.
      const assistPosition = playerMetaById.get(playerId)?.position ?? null;
      const assistRateEs = computeSkaterAssistShare({ goalsAll: ev?.goals_total_all, assistsAll: ev?.assists_total_all,
        ippAllPct: ev?.ipp_all, position: assistPosition, strength: "es" }).share;
      const assistRatePp = computeSkaterAssistShare({ goalsAll: pp?.goals_total_all, assistsAll: pp?.assists_total_all,
        ippAllPct: pp?.ipp_all, position: assistPosition, strength: "pp" }).share;

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

      const legacyAvailabilityMultiplier = playerAvailabilityMultiplier.get(playerId) ?? 1;
      // The line is his line if he plays (decision 132.2/132.3). The legacy DTD/benched multipliers are not calibrated
      // participation probabilities, so they never scale it: an uncertain player keeps his line and the row's
      // availability state says participation is unqualified (skaterAvailabilityForGame).
      const eventAvailabilityMultiplier = legacyAvailabilityMultiplier <= 0 ? 0 : 1;
      if (legacyAvailabilityMultiplier < 1) {
        metrics.data_quality.skater_availability_penalties_applied += 1;
      }
      const latestMetricDate = latestMetricDateByPlayerId.get(playerId) ?? null;
      const daysSinceLastMetric =
        latestMetricDate != null
          ? Math.max(0, daysBetweenDates(asOfDate, latestMetricDate))
          : null;
      // Time away is evidence on the row (timeAwayDisclosure), not a fixed-rate decline of the line (decision 132.2):
      // the soft-stale recency multiplier only reports what the old rule would have applied.
      const recencyMultiplier =
        activeSkaterFilter.recencyMultiplierByPlayerId.get(playerId) ?? 1;
      const availabilityMultiplier =
        eventAvailabilityMultiplier *
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
        assistRateEs: clamp(assistRateEs * trendAssistMultiplier, SKATER_ASSIST_SHARE_MIN, SKATER_ASSIST_SHARE_MAX),
        assistRatePp: clamp(assistRatePp * trendAssistMultiplier, SKATER_ASSIST_SHARE_MIN, SKATER_ASSIST_SHARE_MAX),
        // PK time, shots and conversion are allocated once the team budget is known.
        toiPk: 0,
        shotsPk: 0,
        goalRatePk: 0,
        assistRatePk: 0,
        pkWeightSeconds: (() => {
          const seconds = skaterPkWeightSeconds(pkLatest.get(playerId));
          return seconds == null ? null : seconds * restScheduleAdjustment.toiMultiplier * availabilityMultiplier;
        })(),
        pkRow: pkLatest.get(playerId),
        trendShotMultiplier,
        trendGoalMultiplier,
        hitsRate: physicalRates.hitsPer60,
        blocksRate: physicalRates.blocksPer60,
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
        opponentGoalieFinishing,
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
        ppOpportunityTargetSource: null,
        ppOpportunityLegacyTeamTargetSeconds: null,
        ppOpportunityAllocationEvidence: "rolling_pp_toi",
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
    const officialPpUsageCache =
      args.teamOfficialPpUsageCache ?? localOfficialPpUsageCache;
    const officialPpUsageKey = teamDateKey(teamId);
    if (!officialPpUsageCache.has(officialPpUsageKey)) {
      officialPpUsageCache.set(
        officialPpUsageKey,
        await fetchTeamOfficialPpUsage(teamId, asOfDate),
      );
    }
    const officialPpUsage = officialPpUsageCache.get(officialPpUsageKey) ?? null;
    const {
      ppShare,
      legacyPpShare,
      source: ppTargetSource,
    } = computeTeamPpShare({
      official: officialPpUsage,
      strengthAverages,
      preAllocationToiEs,
      preAllocationToiPp,
    });

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
      preAllocationTotalSeconds: Array.from(projected.values()).reduce(
        (acc, p) => acc + p.toiEs + p.toiPp + (p.pkWeightSeconds ?? 0),
        0,
      ),
    });
    if (guardedTeamToiTarget.wasCapped) {
      metrics.data_quality.skater_pool_emergency_toi_target_caps_applied += 1;
      metrics.warnings.push(
        `skater pool emergency TOI cap for game=${game.id} team=${teamId}; projected_count=${projectedSkaterCount} canonical_target=${targetSkaterSecondsCanonical} capped_target=${guardedTeamToiTarget.targetSeconds}`,
      );
    }
    const targetSkaterSeconds = guardedTeamToiTarget.targetSeconds;
    // Exclusive ES/PP/PK targets that add to the budget (decisions 24, 59).
    const teamBudget = splitTeamSkaterBudget({
      totalSeconds: targetSkaterSeconds,
      ppShare,
      strengthAverages,
    });
    const toiPpTarget = teamBudget.toiPpTarget;
    const legacyToiPpTarget = Math.round(
      clamp(legacyPpShare, 0, 0.5) * targetSkaterSeconds,
    );
    for (const [playerId, p] of projected) {
      p.ppOpportunityTargetSource = ppTargetSource;
      p.ppOpportunityLegacyTeamTargetSeconds = legacyToiPpTarget;
      p.ppOpportunityAllocationEvidence =
        officialPpUsage?.perPlayerPpToiAvgSec.has(playerId)
          ? "official_last10_pp_toi"
          : "rolling_pp_toi";
    }

    const ppAllocation = allocatePpToiByTeamOpportunity({
      projectedByPlayer: new Map(
        Array.from(projected.entries()).map(([playerId, p]) => [
          playerId,
          {
            toiPp: p.toiPp,
            roleTag: roleTagFromRosterEvent(args.ppEventByPlayer?.get(playerId) ?? null) ?? p.roleTag,
            officialPpToiAvgSec:
              officialPpUsage?.perPlayerPpToiAvgSec.get(playerId) ?? null,
          },
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
        SKATER_ASSIST_SHARE_MIN,
        SKATER_ASSIST_SHARE_MAX,
      );
      p.assistRatePp = clamp(
        p.assistRatePp * teammateCoupling.assistRatePpMultiplier,
        SKATER_ASSIST_SHARE_MIN,
        SKATER_ASSIST_SHARE_MAX,
      );
      p.teammateAssistEsMultiplier = teammateCoupling.assistRateEsMultiplier;
      p.teammateAssistPpMultiplier = teammateCoupling.assistRatePpMultiplier;
      p.teammateDependencyScore = teammateCoupling.dependencyScore;
      projected.set(playerId, p);
    }

    // PK bucket: the team PK target split by recent PK seconds, PK shots pinned to the team's
    // strength-table PK shots, conversion shrunk to each player's ES rates (labelled hypothesis).
    const pkAllocation =
      teamBudget.toiPkTarget == null
        ? null
        : allocateTeamPkToi({
            players: Array.from(projected.entries()).map(([playerId, p]) => ({
              playerId,
              weightSeconds: p.pkWeightSeconds,
            })),
            targetSeconds: teamBudget.toiPkTarget,
          });
    const pkModeled = pkAllocation != null && teamBudget.shotsPkTarget != null;
    const pkStatus: "modeled" | "unknown_team_pk_exposure" | "no_known_pk_history" =
      pkModeled ? "modeled" : teamBudget.toiPkTarget == null ? "unknown_team_pk_exposure" : "no_known_pk_history";
    if (pkModeled) {
      const teamPkSecondsAvg = safeNumber(strengthAverages.toiPkSecondsAvg, 0);
      const teamPkShotsPer60 = teamPkSecondsAvg > 0 ? (teamBudget.shotsPkTarget! * 3600) / teamPkSecondsAvg : 0;
      let rawPkShots = 0;
      for (const [playerId, p] of projected) {
        const conversion = computeSkaterPkConversion({
          pk: p.pkRow,
          position: playerMetaById.get(playerId)?.position ?? null,
          teamPkShotsPer60,
          esGoalRate: p.goalRateEs,
          esAssistShare: p.assistRateEs,
        });
        p.toiPk = pkAllocation!.perPlayer.get(playerId) ?? 0;
        p.shotsPk = (p.toiPk / 3600) * conversion.shotsPer60 * p.trendShotMultiplier;
        p.goalRatePk = clamp(conversion.goalRate * p.trendGoalMultiplier, 0, 1);
        p.assistRatePk = conversion.assistShare;
        rawPkShots += p.shotsPk;
      }
      const toiPkTotal = Array.from(projected.values()).reduce((acc, p) => acc + p.toiPk, 0);
      for (const p of projected.values()) {
        p.shotsPk = rawPkShots > 0
          ? (p.shotsPk / rawPkShots) * teamBudget.shotsPkTarget!
          : toiPkTotal > 0 ? (p.toiPk / toiPkTotal) * teamBudget.shotsPkTarget! : 0;
      }
    } else {
      metrics.data_quality.pk_bucket_unknown_teams = (metrics.data_quality.pk_bucket_unknown_teams ?? 0) + 1;
    }
    // Without a modeled PK bucket the ES target keeps all non-PP time (labelled "all_non_pp_time").
    const toiEsTarget = pkModeled ? teamBudget.toiEsTarget : targetSkaterSeconds - toiPpTarget;
    const esDefinition = pkModeled ? "even_strength" : "all_non_pp_time";

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
      officialPpUsage?.ppShotsAvg ?? strengthAverages.shotsPpAvg,
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

    // Assists come from the goals scored while a skater is on the ice: team goals at each
    // strength x his share of the five skater slots x his assist share, scaled so the team's
    // assists per goal match the league's at that strength.
    const assistTeam = { goalsEs: 0, goalsPp: 0, toiEs: 0, toiPp: 0, rawEs: 0, rawPp: 0 };
    const assistTeamPk = { goals: 0, toi: 0, raw: 0 };
    for (const p of projected.values()) {
      assistTeam.goalsEs += p.shotsEs * p.goalRateEs;
      assistTeam.goalsPp += p.shotsPp * p.goalRatePp;
      assistTeam.toiEs += p.toiEs;
      assistTeam.toiPp += p.toiPp;
      assistTeamPk.goals += p.shotsPk * p.goalRatePk;
      assistTeamPk.toi += p.toiPk;
    }
    const onIceGoals = (toi: number, teamToi: number, teamGoals: number) =>
      teamToi > 0 ? (teamGoals * 5 * toi) / teamToi : 0;
    for (const p of projected.values()) {
      assistTeam.rawEs += onIceGoals(p.toiEs, assistTeam.toiEs, assistTeam.goalsEs) * p.assistRateEs;
      assistTeam.rawPp += onIceGoals(p.toiPp, assistTeam.toiPp, assistTeam.goalsPp) * p.assistRatePp;
      assistTeamPk.raw += onIceGoals(p.toiPk, assistTeamPk.toi, assistTeamPk.goals) * p.assistRatePk;
    }
    const assistScaleEs = assistTeam.rawEs > 0 ? (SKATER_TEAM_ASSISTS_PER_GOAL.es * assistTeam.goalsEs) / assistTeam.rawEs : 0;
    const assistScalePp = assistTeam.rawPp > 0 ? (SKATER_TEAM_ASSISTS_PER_GOAL.pp * assistTeam.goalsPp) / assistTeam.rawPp : 0;
    // No fitted league PK assists-per-goal yet: the ES value is the labelled hypothesis (rule 12).
    const assistScalePk = assistTeamPk.raw > 0 ? (SKATER_TEAM_ASSISTS_PER_GOAL.es * assistTeamPk.goals) / assistTeamPk.raw : 0;
    const teamPkTotals = { toiSeconds: 0, shots: 0, goals: 0, assists: 0 };

    // Pass 1: every player's final line (scenario/rollout selection, then the season bootstrap).
    const finalLines = new Map<number, {
      shotsEs: number; shotsPp: number; shotsPk: number; goalsEs: number; goalsPp: number; goalsPk: number;
      assistsEs: number; assistsPp: number; assistsPk: number; projHits: number; projBlocks: number;
      baseGoalsEs: number; baseGoalsPp: number; baseAssistsEs: number; baseAssistsPp: number;
      preBootstrap: { goalsEs: number; goalsPp: number; assistsEs: number; assistsPp: number };
      scenarioBlend: ReturnType<typeof blendSkaterScenarioStatLinesAcrossHorizon>;
      seasonLine: ReturnType<typeof bootstrapSkaterLine> | null;
    }>();
    for (const [playerId, p] of projected.entries()) {
      let shotsEs = p.shotsEs;
      let shotsPp = p.shotsPp;
      let shotsPk = pkModeled ? p.shotsPk : 0;
      let goalsPk = pkModeled ? shotsPk * p.goalRatePk : 0;
      let assistsPk = pkModeled ? onIceGoals(p.toiPk, assistTeamPk.toi, assistTeamPk.goals) * p.assistRatePk * assistScalePk : 0;
      const baseGoalsEs = shotsEs * p.goalRateEs;
      const baseGoalsPp = shotsPp * p.goalRatePp;
      const baseAssistsEs = onIceGoals(p.toiEs, assistTeam.toiEs, assistTeam.goalsEs) * p.assistRateEs * assistScaleEs;
      const baseAssistsPp = onIceGoals(p.toiPp, assistTeam.toiPp, assistTeam.goalsPp) * p.assistRatePp * assistScalePp;
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
      const preBootstrap = { ...selectedSkaterStatLine };
      let goalsEs = selectedSkaterStatLine.goalsEs;
      let goalsPp = selectedSkaterStatLine.goalsPp;
      let assistsEs = selectedSkaterStatLine.assistsEs;
      let assistsPp = selectedSkaterStatLine.assistsPp;

      // Hits and blocks are all-situation rates applied once to the reconciled exclusive
      // ES + PP + PK seconds (without a PK bucket, ES already holds all non-PP time).
      const physicalToiHours = (p.toiEs + p.toiPp + (pkModeled ? p.toiPk : 0)) / 3600;
      let projHits = physicalToiHours * p.hitsRate;
      let projBlocks = physicalToiHours * p.blocksRate;
      const seasonPrior = bootstrap.get(playerId);
      const seasonLine = seasonPrior ? bootstrapSkaterLine({ goalsEs, goalsPp, assistsEs, assistsPp,
        goalsPk, assistsPk, shotsPk,
        shotsEs, shotsPp, hits: projHits, blocks: projBlocks }, seasonPrior, {
        goals: p.teamLevelGoalRateMultiplier * p.opponentGoalieGoalRateMultiplier * p.restScheduleGoalRateMultiplier,
        assists: p.teamLevelAssistRateMultiplier * p.opponentGoalieAssistRateMultiplier * p.restScheduleAssistRateMultiplier,
        shots: p.teamLevelShotRateMultiplier * p.restScheduleShotRateMultiplier,
        ppUsage: p.toiPp <= 0 ? 0 : seasonPrior.previous.PP_TOI
          ? clamp(p.toiPp / (seasonPrior.previous.PP_TOI * 60), 0, 2) : 1,
      }) : null;
      if (seasonLine) {
        ({ goalsEs, goalsPp, assistsEs, assistsPp, shotsEs, shotsPp } = seasonLine);
        goalsPk = seasonLine.goalsPk ?? goalsPk;
        assistsPk = seasonLine.assistsPk ?? assistsPk;
        shotsPk = seasonLine.shotsPk ?? shotsPk;
        projHits = seasonLine.hits; projBlocks = seasonLine.blocks;
      }
      finalLines.set(playerId, { shotsEs, shotsPp, shotsPk, goalsEs, goalsPp, goalsPk, assistsEs, assistsPp, assistsPk,
        projHits, projBlocks, baseGoalsEs, baseGoalsPp, baseAssistsEs, baseAssistsPp, preBootstrap, scenarioBlend, seasonLine });
    }

    // BC W1-6 A1 (rule 7): the bootstrap re-splits lines after reconciliation, so re-pin the final
    // serialized team shots per strength to their targets; goals and assists keep their per-shot
    // and per-goal rates. Without a bootstrap the reconciled sums already equal the targets.
    if ([...finalLines.values()].some((line) => line.seasonLine != null)) {
      const lines = [...finalLines.values()];
      const scaleTo = (target: number | null, pick: (line: (typeof lines)[number]) => number) => {
        const total = lines.reduce((sum, line) => sum + pick(line), 0);
        return target != null && Number.isFinite(target) && total > 0 ? target / total : 1;
      };
      const scaleEs = scaleTo(shotsEsTarget, (line) => line.shotsEs);
      const scalePp = scaleTo(shotsPpTarget, (line) => line.shotsPp);
      const scalePk = scaleTo(pkModeled ? teamBudget.shotsPkTarget : null, (line) => line.shotsPk);
      for (const line of lines) {
        line.shotsEs *= scaleEs; line.goalsEs *= scaleEs; line.assistsEs *= scaleEs;
        line.shotsPp *= scalePp; line.goalsPp *= scalePp; line.assistsPp *= scalePp;
        line.shotsPk *= scalePk; line.goalsPk *= scalePk; line.assistsPk *= scalePk;
      }
      metrics.data_quality.bootstrap_final_reconciliations = (metrics.data_quality.bootstrap_final_reconciliations ?? 0) + 1;
    }

    // Pass 2: serialize each final line once.
    for (const [playerId, p] of projected.entries()) {
      const finalLine = finalLines.get(playerId)!;
      const { shotsEs, shotsPp, shotsPk, goalsEs, goalsPp, goalsPk, assistsEs, assistsPp, assistsPk, projHits, projBlocks,
        baseGoalsEs, baseGoalsPp, baseAssistsEs, baseAssistsPp, scenarioBlend, seasonLine } = finalLine;
      // W1-7 N1: scenario lines move with the final line, so bands describe the served mean.
      const ratio = (final: number, pre: number) => (pre > 0 ? final / pre : 1);
      const finalScenarioLines = scenarioBlend.scenarioLines.map((scenario) => ({
        ...scenario,
        goalsEs: finalLine.preBootstrap.goalsEs > 0 ? scenario.goalsEs * ratio(goalsEs, finalLine.preBootstrap.goalsEs) : goalsEs,
        goalsPp: finalLine.preBootstrap.goalsPp > 0 ? scenario.goalsPp * ratio(goalsPp, finalLine.preBootstrap.goalsPp) : goalsPp,
        assistsEs: finalLine.preBootstrap.assistsEs > 0 ? scenario.assistsEs * ratio(assistsEs, finalLine.preBootstrap.assistsEs) : assistsEs,
        assistsPp: finalLine.preBootstrap.assistsPp > 0 ? scenario.assistsPp * ratio(assistsPp, finalLine.preBootstrap.assistsPp) : assistsPp,
      }));
      if (pkModeled) {
        teamPkTotals.toiSeconds += p.toiPk;
        teamPkTotals.shots += shotsPk;
        teamPkTotals.goals += goalsPk;
        teamPkTotals.assists += assistsPk;
      }
      const naivePriorGoalsEs = shotsEs * 0.095;
      const naivePriorGoalsPp = shotsPp * 0.145;
      const naivePriorAssistsEs = naivePriorGoalsEs * 1.44;
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
          ...(pkModeled ? { toiPkSeconds: p.toiPk, shotsPk, goalsPk, assistsPk } : {}),
        },
        horizonGames,
        teamHorizonScalars,
        selectSkaterRolloutScenarioMixture(
          skaterRollout,
          finalScenarioLines.map((s) => ({
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
        {
          negativeBinomial: true,
          position: playerMetaById.get(playerId)?.position ?? null,
        },
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
              goals_pk: pkModeled ? Number(goalsPk.toFixed(4)) : null,
              assists_pk: pkModeled ? Number(assistsPk.toFixed(4)) : null,
              shots_pk: pkModeled ? Number(shotsPk.toFixed(4)) : null,
              hits: Number(projHits.toFixed(4)),
              blocks: Number(projBlocks.toFixed(4)),
            },
            naive_prior: {
              definition:
                "fixed_league_conversion_priors_on_reconciled_opportunities",
              goal_rate_es: 0.095,
              goal_rate_pp: 0.145,
              assist_per_goal_es: 1.44,
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
            strength_accounting: {
              version: SKATER_STRENGTH_ACCOUNTING_VERSION,
              buckets: ["es", "pp", "pk"],
              exclusive: true,
              es_definition: esDefinition,
              pk_status: pkStatus,
              pk_history: p.pkWeightSeconds == null ? "no_pk_rolling_row" : "rolling_pk_row",
              pk_prior_basis: pkModeled ? "player_es_rates_with_es_prior_strengths_unfitted" : null,
              team_budget: {
                total_seconds: teamBudget.totalSeconds,
                // Exposure of absent skaters, unmodeled (D7); 0 for a complete pool.
                unmodeled_residual_seconds: guardedTeamToiTarget.unmodeledResidualSeconds ?? 0,
                projected_skater_count: projectedSkaterCount,
                es_target_seconds: toiEsTarget,
                pp_target_seconds: toiPpTarget,
                pk_target_seconds: pkModeled ? teamBudget.toiPkTarget : null,
                pk_shots_target: pkModeled ? teamBudget.shotsPkTarget : null,
                pk_share_source: pkModeled ? "forge_team_game_strength_last10" : null,
              },
              extra_attacker: "overlapping_attribute_within_strength_buckets",
              empty_net: {
                bucket: "goals_en",
                mean: null,
                basis: "included_in_strength_buckets_not_separately_estimated",
              },
              physical_exposure: "rates_applied_once_to_reconciled_bucket_seconds",
            },
            season_bootstrap: seasonLine?.disclosure ?? null,
            ...buildNativeSkaterParticipationFields({ gameId: game.id, teamId, playerId,
              compute: starterBoardFlags().compute, evidence: args.dailyBoardEvidence }),
            pp_role: roleTagFromRosterEvent(args.ppEventByPlayer?.get(playerId) ?? null)?.esRole ?? null,
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
              recency_multiplier_applied: false,
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
              scenario_stat_lines: finalScenarioLines.map((s) => ({
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
              version: p.opponentGoalieFinishing?.version ?? null,
              feature: p.opponentGoalieFinishing?.feature ?? null,
              source: p.opponentGoalieFinishing ? "forge_goalie_game_history_posterior" : null,
              league_save_pct: p.opponentGoalieFinishing?.leagueSavePct ?? null,
              expected_goals_allowed_per_shot: p.opponentGoalieFinishing
                ? Number(p.opponentGoalieFinishing.expectedGoalsAllowedPerShot.toFixed(6)) : null,
              unresolved_start_mass: p.opponentGoalieFinishing
                ? Number(p.opponentGoalieFinishing.unresolvedStartMass.toFixed(4)) : null,
              start_mass_normalized: p.opponentGoalieFinishing?.startMassNormalized ?? null,
              pass_through: p.opponentGoalieFinishing?.passThrough ?? null,
              candidates: (p.opponentGoalieFinishing?.candidates ?? []).map((c) => ({
                goalie_id: c.goalieId,
                start_probability: Number(c.startProbability.toFixed(4)),
                posterior_save_pct: Number(c.posteriorSavePct.toFixed(5)),
                history_shots_against: c.historyShotsAgainst,
              })),
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
            assist_rate_scale: {
              convention: { es: "per_goal", pp: "per_two_goals" },
            },
            pp_opportunity: {
              team_pp_target_seconds: p.ppOpportunityTeamTargetSeconds,
              allocated_player_pp_share: p.ppOpportunityAllocatedShare,
              target_source: p.ppOpportunityTargetSource,
              allocation_evidence: p.ppOpportunityAllocationEvidence,
              legacy_team_pp_target_seconds:
                p.ppOpportunityLegacyTeamTargetSeconds,
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

      const playerUpsert = {
        run_id: runId,
        as_of_date: asOfDate,
        horizon_games: horizonGames,
        game_id: game.id,
        player_id: playerId,
        team_id: teamId,
        opponent_team_id: opponentTeamId,
        // Integer columns: horizon scalars (decay, rest) make the scaled
        // seconds fractional for horizonGames > 1, so round to whole seconds.
        proj_toi_es_seconds: Math.round(p.toiEs * teamHorizonTotalScalar),
        proj_toi_pp_seconds: Math.round(p.toiPp * teamHorizonTotalScalar),
        proj_toi_pk_seconds: pkModeled ? Math.round(p.toiPk * teamHorizonTotalScalar) : null,
        proj_shots_es: Number((shotsEs * teamHorizonTotalScalar).toFixed(3)),
        proj_shots_pp: Number((shotsPp * teamHorizonTotalScalar).toFixed(3)),
        proj_shots_pk: pkModeled ? Number((shotsPk * teamHorizonTotalScalar).toFixed(3)) : null,
        proj_goals_es: Number((goalsEs * teamHorizonTotalScalar).toFixed(3)),
        proj_goals_pp: Number((goalsPp * teamHorizonTotalScalar).toFixed(3)),
        proj_goals_pk: pkModeled ? Number((goalsPk * teamHorizonTotalScalar).toFixed(3)) : null,
        proj_assists_es: Number(
          (assistsEs * teamHorizonTotalScalar).toFixed(3),
        ),
        proj_assists_pp: Number(
          (assistsPp * teamHorizonTotalScalar).toFixed(3),
        ),
        proj_assists_pk: pkModeled ? Number((assistsPk * teamHorizonTotalScalar).toFixed(3)) : null,
        proj_hits: Number((projHits * teamHorizonTotalScalar).toFixed(3)),
        proj_blocks: Number((projBlocks * teamHorizonTotalScalar).toFixed(3)),
        uncertainty: uncertaintyWithRole,
        updated_at: new Date().toISOString(),
      };
      playerUpserts.push({
        ...playerUpsert,
        uncertainty: {
          ...uncertaintyWithRole,
          native_goal_accounting: buildNativePlayerGoalAccounting(playerUpsert),
          availability: skaterAvailabilityForGame({ gameId: game.id, event: p.availabilityEvent, inLineup: true }),
          time_away: timeAwayDisclosure(timeAwayEvidence(p.latestMetricDate, asOfDate)),
        },
      });

      projectedPlayerMarketInputs.set(playerId, {
        teamId,
        opponentTeamId,
        shots: Number(
          ((shotsEs + shotsPp + shotsPk) * teamHorizonTotalScalar).toFixed(3),
        ),
        goals: Number(
          ((goalsEs + goalsPp + goalsPk) * teamHorizonTotalScalar).toFixed(3),
        ),
        assists: Number(
          ((assistsEs + assistsPp + assistsPk) * teamHorizonTotalScalar).toFixed(3),
        ),
        // Match the PP heads consumed by the board; rounding raw totals again can disagree.
        powerPlayPoints: Number(
          (playerUpsert.proj_goals_pp + playerUpsert.proj_assists_pp).toFixed(3),
        ),
        blockedShots: Number((projBlocks * teamHorizonTotalScalar).toFixed(3)),
        lineupSourceGameDate: lcContext.sourceGameDate,
        lineupRecencyDays: lcRecency.daysStale,
        availabilityEvent: p.availabilityEvent,
      });
    }

    // Reuse the same retained goalie-ID read later used by the goalie stage.
    // These members are outside the skater estimator, not zero offensive residuals.
    if (!currentTeamGoalieIdsCache.has(teamDateKey(teamId))) currentTeamGoalieIdsCache.set(
      teamDateKey(teamId), await fetchCurrentTeamGoalieIds(teamId),
    );
    const teamGoalAccounting = buildNativeTeamGoalAccounting({
      gameId: game.id,
      teamId,
      asOfDate,
      horizonGames,
      currentRosterPlayerIds: activeRosterSkaterIds,
      playerRows: playerUpserts,
    });
    const nativeRosterCoverage = buildNativeRosterContributorCoverage({
      gameId: game.id, teamId, currentRosterPlayerIds: activeRosterSkaterIds, projectedPlayerIds: playerUpserts.map(row => row.player_id),
      selection: {
        candidatePlayerIds: rawSkaterIds, eligiblePlayerIds: activeSkaterFilter.eligibleSkaterIds,
        unavailablePlayerIds: unavailableSkaters, knownGoaliePlayerIds: [...currentTeamGoalieIdsCache.get(teamDateKey(teamId))!],
        playerMetaById, excludedPlayerIds: activeSkaterFilter.excludedSkaterIdsByReason,
        compute: starterBoardFlags().compute, evidence: args.dailyBoardEvidence,
      },
    });
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

        const comparison = compareModelWithMarket({
          marketType,
          expectedValue,
          quotes: quotesFromMarketSummary(marketSummary),
          overProbability: forgePropOverProbability(
            playerMetaById.get(playerId)?.position ?? null,
          ),
        });
        if (comparison) {
          const outputRow = playerPredictionOutputRows[playerPredictionOutputRows.length - 1];
          outputRow.probability_over = Number(comparison.model.over.toFixed(4));
          const flagRow = buildModelMarketProbabilityFlagRow({
            asOfDate,
            entityType: "player",
            entityId: playerId,
            gameId: game.id,
            comparison,
            provider: marketSummary.sourceNames[0] ?? null,
            metadata: { horizon_games: horizonGames, run_id: runId },
          });
          if (flagRow) modelMarketFlagRows.push(flagRow);
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
      // Integer columns: round the horizon-scaled seconds (see player rows).
      proj_toi_es_seconds: Math.round(
        teamTotals.toiEsSeconds * teamHorizonTotalScalar,
      ),
      proj_toi_pp_seconds: Math.round(
        teamTotals.toiPpSeconds * teamHorizonTotalScalar,
      ),
      proj_toi_pk_seconds: pkModeled ? Math.round(teamPkTotals.toiSeconds * teamHorizonTotalScalar) : null,
      proj_shots_es: Number(
        (teamTotals.shotsEs * teamHorizonTotalScalar).toFixed(3),
      ),
      proj_shots_pp: Number(
        (teamTotals.shotsPp * teamHorizonTotalScalar).toFixed(3),
      ),
      proj_shots_pk: pkModeled ? Number((teamPkTotals.shots * teamHorizonTotalScalar).toFixed(3)) : null,
      proj_goals_es: teamGoalAccounting.reportedComponents.esMean,
      proj_goals_pp: teamGoalAccounting.reportedComponents.ppMean,
      proj_goals_pk: teamGoalAccounting.reportedComponents.pkMean,
      uncertainty: {
        ...buildTeamUncertainty(
          {
            toiEsSeconds: teamTotals.toiEsSeconds,
            toiPpSeconds: teamTotals.toiPpSeconds,
            shotsEs: teamTotals.shotsEs,
            shotsPp: teamTotals.shotsPp,
            goalsEs: teamTotals.goalsEs,
            goalsPp: teamTotals.goalsPp,
            ...(pkModeled ? { toiPkSeconds: teamPkTotals.toiSeconds, shotsPk: teamPkTotals.shots, goalsPk: teamPkTotals.goals } : {}),
          },
          horizonGames,
          teamHorizonScalars,
        ),
        native_goal_accounting: teamGoalAccounting,
        native_roster_contributor_coverage: nativeRosterCoverage,
      },
      updated_at: new Date().toISOString(),
    };

    teamRowsUpserted += await persistForgeTeamProjection(teamUpsert);

    // shotsPk is null when the PK bucket is unknown; goalie-stage reads ES + PP today (Codex ticket).
    teamShotsByTeamId.set(teamId, {
      shotsEs: Number(teamUpsert.proj_shots_es ?? 0),
      shotsPp: Number(teamUpsert.proj_shots_pp ?? 0),
      shotsPk: teamUpsert.proj_shots_pk,
    });
    // Team goals feed goalie win lambdas and game totals: all-situation, or unknown.
    // Without a PK bucket ES holds all non-PP time, so ES + PP is that run's all-situation line.
    const teamGoalsAllSituations = pkModeled ? teamGoalAccounting.reportedAllStrengthMean : teamGoalAccounting.reportedEsPpMean;
    if (teamGoalsAllSituations === null) teamGoalsByTeamId.delete(teamId);
    else teamGoalsByTeamId.set(teamId, teamGoalsAllSituations);

    // Reserve pass: every other current-roster skater gets an "if he dresses" line in its own table, after the team
    // row is written, so the lineup's TOI, goals and team totals above are untouched.
    const reservePassEnabled = forgeReservePassEnabled();
    const lineupPlayerIds = playerUpserts.map((row) => row.player_id);
    const teamGoalieIds = currentTeamGoalieIdsCache.get(teamDateKey(teamId))!;
    const nonLineupRosterIds = activeRosterSkaterIds.filter((id) => !lineupPlayerIds.includes(id) && !teamGoalieIds.has(id));
    const nonLineupMeta = reservePassEnabled ? await fetchPlayerMetaByIds(nonLineupRosterIds) : new Map<number, PlayerTeamPositionRow>();
    const reserveCandidates = !reservePassEnabled ? [] : selectReserveSkaters({
      teamId,
      rosterPlayerIds: activeRosterSkaterIds,
      lineupPlayerIds,
      goalieIds: teamGoalieIds,
      metaById: nonLineupMeta,
      ruledOutIds: [...playerAvailabilityMultiplier]
        .filter(([, multiplier]) => multiplier <= 0)
        .map(([id]) => id),
      hardStaleIds: activeSkaterFilter.excludedSkaterIdsByReason.hardStale,
      missingMetricIds:
        activeSkaterFilter.excludedSkaterIdsByReason.missingRecentMetrics,
    });
    const reserveProjectedIds: number[] = [];
    const coverageUnknownReasonById = new Map<number, SkaterCoverageUnknownReason>();
    for (const id of nonLineupRosterIds) {
      const meta = nonLineupMeta.get(id);
      if (!reservePassEnabled) continue;
      if (!meta) coverageUnknownReasonById.set(id, "missing_player_record");
      else if (meta.team_id !== teamId) coverageUnknownReasonById.set(id, "roster_team_conflict");
    }
    if (reserveCandidates.length > 0) {
      const reserveIds = reserveCandidates.map((c) => c.playerId);
      const [reserveEv, reservePp, reserveAll] = await Promise.all(
        (["ev", "pp", "all"] as const).map(async (strength) =>
          pickLatestByPlayer(
            await fetchRollingRows(reserveIds, strength, asOfDate),
          ),
        ),
      );
      // Long absences (decision 132.2): no even-strength or power-play row in the lineup's 365-day scope. His line comes
      // from his last active games, read from a wider but bounded window; the row discloses the time away.
      const longAbsentIds = reserveIds.filter((id) => !reserveEv.has(id) && !reservePp.has(id));
      if (longAbsentIds.length > 0) {
        const [longEv, longPp, longAll] = await Promise.all(
          (["ev", "pp", "all"] as const).map(async (strength) =>
            pickLatestByPlayer(
              await fetchRollingRows(longAbsentIds, strength, asOfDate, undefined, { lookbackDays: FORGE_LONG_ABSENCE_LOOKBACK_DAYS }),
            ),
          ),
        );
        for (const [target, source] of [[reserveEv, longEv], [reservePp, longPp], [reserveAll, longAll]] as const) {
          for (const [id, row] of source) if (!target.has(id)) target.set(id, row);
        }
        metrics.data_quality.reserve_skaters_long_absence_reads =
          (metrics.data_quality.reserve_skaters_long_absence_reads ?? 0) + longAbsentIds.length;
      }
      const reserveRows = reserveCandidates.flatMap((candidate) => {
        const line = buildReserveSkaterLine({
          position: candidate.position,
          ev: reserveEv.get(candidate.playerId),
          pp: reservePp.get(candidate.playerId),
          all: reserveAll.get(candidate.playerId),
          currentSeasonId,
          league: leaguePhysicalTotals,
          context: {
            toiMultiplier: restScheduleAdjustment.toiMultiplier,
            shotRateMultiplier:
              teamLevelContextAdjustment.shotRateMultiplier *
              restScheduleAdjustment.shotRateMultiplier,
            goalRateMultiplier:
              teamLevelContextAdjustment.goalRateMultiplier *
              opponentGoalieContextAdjustment.goalRateMultiplier *
              restScheduleAdjustment.goalRateMultiplier,
            assistRateMultiplier:
              teamLevelContextAdjustment.assistRateMultiplier *
              opponentGoalieContextAdjustment.assistRateMultiplier *
              restScheduleAdjustment.assistRateMultiplier,
          },
          team: { ...assistTeam, assistScaleEs, assistScalePp },
        });
        if (!line) {
          coverageUnknownReasonById.set(candidate.playerId, "no_nhl_usage_in_window");
          return [];
        }
        const latest = [reserveEv.get(candidate.playerId)?.game_date, reservePp.get(candidate.playerId)?.game_date]
          .filter((date): date is string => typeof date === "string").sort().at(-1) ?? null;
        // Availability and time away are states beside the if-plays line, never folded into it (decision 132.2/132.3);
        // a scratch for this game labels the row scratched_not_expected_to_dress (decision 31).
        const row = buildReserveSkaterRow({
          runId, asOfDate, horizonGames, gameId: game.id, playerId: candidate.playerId, teamId, opponentTeamId,
          reason: candidate.reason, line, horizonScalar: teamHorizonTotalScalar,
          evidence: {
            availabilityEventId: availabilityEventByPlayer.get(candidate.playerId)?.event_id ?? null,
            latestMetricDate: latest,
          },
          availability: skaterAvailabilityForGame({ gameId: game.id, event: availabilityEventByPlayer.get(candidate.playerId), inLineup: false }),
          timeAway: timeAwayDisclosure(timeAwayEvidence(latest, asOfDate)),
        });
        reserveProjectedIds.push(candidate.playerId);
        return [row];
      });
      metrics.data_quality.reserve_skaters_projected =
        (metrics.data_quality.reserve_skaters_projected ?? 0) + reserveRows.length;
      metrics.data_quality.reserve_skaters_without_metrics =
        (metrics.data_quality.reserve_skaters_without_metrics ?? 0) +
        reserveCandidates.length - reserveRows.length;
      await persistForgeReserveProjectionRows(reserveRows);
    }
    // Coverage (decision 132.4): every eligible skater of this team is a lineup row, a reserve row or unknown with a reason.
    recordTeamSkaterCoverage(metrics, buildTeamSkaterCoverage({
      gameId: game.id, teamId,
      eligibleIds: [...lineupPlayerIds, ...nonLineupRosterIds.filter((id) => nonLineupMeta.get(id)?.position !== "G")],
      lineupIds: lineupPlayerIds, reserveIds: reserveProjectedIds, unknownReasonById: coverageUnknownReasonById,
      defaultUnknownReason: reservePassEnabled ? "no_nhl_usage_in_window" : "reserve_pass_disabled",
    }));

    // Goalie: pick the highest probability starter from goalie_start_projections if available.
    const goalieOverride = goalieOverrideByTeamId.get(teamId);
    const { data: goalieStarts, error: gsErr } = await supabase
      .from("goalie_start_projections")
      .select(
        "player_id,start_probability,confirmed_status,l10_start_pct,season_start_pct,games_played,projected_gsaa_per_60,updated_at,game_date",
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
        rosterGoalieIds: [...currentTeamGoalieIds].sort((a, b) => a - b),
      });
    }
  }
  return { timedOut: false, playerRowsUpserted, teamRowsUpserted };
}
