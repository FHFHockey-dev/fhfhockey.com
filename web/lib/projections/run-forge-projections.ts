import supabase from "lib/supabase/server";
import { reconcileTeamToPlayers } from "lib/projections/reconcile";
import {
  buildGoalieUncertainty,
  buildPlayerUncertainty,
  buildTeamUncertainty
} from "lib/projections/uncertainty";
import { computeGoalieProjectionModel, type GoalieEvidence } from "lib/projections/goalieModel";
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
  PbpGameIdRow,
  PlayerTeamPositionRow,
  ReconciledSkaterVector,
  ReconciliationDistributionValidation,
  RollingSkaterMetricRow,
  RosterPlayerIdRow,
  RollingRow,
  RosterEventRow,
  RunProjectionOptions,
  RunProjectionResult,
  SeasonIdRow,
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
  ProjectionTotals
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
  sigmoid
} from "./utils/number-utils";
import {
  buildSequentialHorizonScalarsFromDates,
  clampHorizonGames,
  daysBetweenDates,
  parseDateOnly,
  toDayBoundsUtc
} from "./utils/date-utils";
import {
  pickLatestByPlayer,
  toFiniteNumberArray
} from "./utils/collection-utils";
import {
  augmentStarterModelMetaWithScenarioProjections,
  buildGoalieUncertaintyWithModel,
  buildSkaterUncertaintyWithModel,
  buildStarterHeuristicMetadata,
  buildStarterOverrideMetadata
} from "./utils/projection-metadata-builders";
import {
  fetchLatestSkaterOnIceContextProfiles,
  fetchLatestSkaterShotQualityProfiles,
  fetchLatestSkaterTrendAdjustments,
  fetchLatestWgoSkaterDeploymentProfiles,
  fetchRollingRows
} from "./queries/skater-queries";
import {
  fetchCurrentTeamGoalieIds,
  fetchGoalieEvidence,
  fetchGoalieRestSplitProfile,
  fetchGoalieWorkloadContext,
  fetchLatestGoalieForTeam,
  fetchOpponentGoalieContextForGame,
  fetchTeamGoalieStarterContext,
  fetchTeamLineComboGoaliePrior
} from "./queries/goalie-queries";
import {
  fetchTeamAbbreviationMap,
  fetchTeamDefensiveEnvironment,
  fetchTeamFiveOnFiveProfile,
  fetchTeamNstExpectedGoalsProfile,
  fetchTeamOffenseEnvironment,
  fetchTeamRestDays,
  fetchTeamStrengthAverages,
  fetchTeamStrengthPrior,
  type TeamStrengthAverages
} from "./queries/team-context-queries";
import { createRun, finalizeRun } from "./queries/run-lifecycle-queries";

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

export function normalizeWgoToiToSeconds(value: number | null | undefined): number | null {
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
  return Number((rollingWeight * rolling + (1 - rollingWeight) * prior).toFixed(3));
}

export function availabilityMultiplierForEvent(
  eventType: string,
  confidence: number
): number | null {
  const c =
    typeof confidence === "number" && Number.isFinite(confidence)
      ? confidence
      : 0.5;
  switch (eventType) {
    case "INJURY_OUT":
    case "INJURY_IR":
    case "IR":
    case "LTIR":
    case "SUSPENSION":
    case "NON_ROSTER":
    case "SENDDOWN":
      return 0;
    case "DTD":
      return clamp(1 - 0.6 * c, 0.2, 1);
    case "BENCHING":
      return clamp(1 - 0.45 * c, 0.35, 1);
    case "SCRATCH":
      return clamp(1 - 0.8 * c, 0.05, 1);
    case "RETURN":
    case "CALLUP":
      return 1;
    default:
      return null;
  }
}

async function hasPbpGame(gameId: number): Promise<boolean> {
  assertSupabase();
  const { data, error } = await supabase
    .from("pbp_games")
    .select("id")
    .eq("id", gameId)
    .maybeSingle<PbpGameIdRow>();
  if (error) throw error;
  return Number.isFinite(data?.id);
}

async function hasShiftTotals(gameId: number): Promise<boolean> {
  assertSupabase();
  const { count, error } = await supabase
    .from("shift_charts")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function fetchLatestLineCombinationForTeam(
  teamId: number,
  asOfDate: string
): Promise<LineCombinationContext> {
  assertSupabase();
  // Find the most recent game with line combos for this team strictly before the asOfDate.
  const { data, error } = await supabase
    .from("lineCombinations")
    .select(
      `
      gameId,
      teamId,
      forwards,
      defensemen,
      goalies,
      games!inner (
        date
      )
    `
    )
    .eq("teamId", teamId)
    .lt("games.date", asOfDate)
    .order("date", { foreignTable: "games", ascending: false })
    .limit(1)
    .maybeSingle<LineCombinationWithGameDateRow>();

  if (error) {
    console.warn(
      `Error fetching latest LC for team ${teamId} before ${asOfDate}:`,
      error
    );
    return { lineCombination: null, sourceGameDate: null };
  }

  if (!data) return { lineCombination: null, sourceGameDate: null };

  return {
    lineCombination: {
      gameId: Number(data.gameId),
      teamId: Number(data.teamId ?? teamId),
      forwards: toFiniteNumberArray(data.forwards),
      defensemen: toFiniteNumberArray(data.defensemen),
      goalies: toFiniteNumberArray(data.goalies)
    },
    sourceGameDate:
      typeof data.games?.date === "string" ? data.games.date : null
  };
}

async function fetchFallbackSkaterIdsForTeam(
  teamId: number,
  asOfDate: string,
  maxPlayers = 18
): Promise<number[]> {
  assertSupabase();
  const oneYearAgo = new Date(
    new Date(`${asOfDate}T00:00:00.000Z`).getTime() - 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("rolling_player_game_metrics")
    .select("player_id,game_date,toi_seconds_avg_last5,toi_seconds_avg_all")
    .eq("team_id", teamId)
    .eq("strength_state", "ev")
    .lt("game_date", asOfDate)
    .gt("game_date", oneYearAgo)
    .order("game_date", { ascending: false })
    .limit(1000);
  if (error) throw error;

  const latestByPlayer = new Map<number, { gameDate: string; toi: number }>();
  for (const row of (data ?? []) as RollingSkaterMetricRow[]) {
    const playerId = Number(row.player_id);
    const gameDate = typeof row.game_date === "string" ? row.game_date : null;
    if (!Number.isFinite(playerId) || !gameDate) continue;
    const toi = safeNumber(
      row.toi_seconds_avg_last5,
      safeNumber(row.toi_seconds_avg_all, 0)
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

async function fetchCurrentSeasonIdForDate(asOfDate: string): Promise<number> {
  assertSupabase();
  const asOfTimestamp = `${asOfDate}T23:59:59.999Z`;
  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .lte("startDate", asOfTimestamp)
    .order("startDate", { ascending: false })
    .limit(1)
    .maybeSingle<SeasonIdRow>();
  if (error) throw error;
  const seasonId = Number(data?.id);
  if (!Number.isFinite(seasonId)) {
    throw new Error(`Unable to resolve season id for as_of_date=${asOfDate}`);
  }
  return seasonId;
}

async function fetchActiveRosterSkaterIdsForTeamSeason(
  teamId: number,
  seasonId: number,
  maxPlayers = SKATER_POOL_SUPPLEMENTAL_FETCH_COUNT
): Promise<number[]> {
  assertSupabase();
  const { data, error } = await supabase
    .from("rosters")
    .select("playerId")
    .eq("teamId", teamId)
    .eq("seasonId", seasonId)
    .order("playerId", { ascending: true })
    .limit(Math.max(1, Math.floor(maxPlayers)));
  if (error) throw error;

  return Array.from(new Set((data ?? [])
    .map((row: RosterPlayerIdRow) => Number(row.playerId))
    .filter((id) => Number.isFinite(id))));
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
    args.activeRosterSkaterIds.filter((id) => Number.isFinite(id))
  );
  if (activeSet.size === 0) {
    return Array.from(new Set(args.candidateSkaterIds)).filter((id) =>
      Number.isFinite(id)
    );
  }
  const constrained = Array.from(new Set(args.candidateSkaterIds)).filter((id) =>
    activeSet.has(id)
  );
  if (constrained.length > 0) return constrained;
  return Array.from(activeSet).slice(0, fallbackCount);
}

async function fetchTeamSkaterRoleHistory(
  teamId: number,
  asOfDate: string,
  windowGames = SKATER_ROLE_HISTORY_WINDOW_GAMES
): Promise<Map<number, string[]>> {
  assertSupabase();
  const { data, error } = await supabase
    .from("lineCombinations")
    .select(
      `
      forwards,
      defensemen,
      games!inner (
        date
      )
    `
    )
    .eq("teamId", teamId)
    .lt("games.date", asOfDate)
    .order("date", { foreignTable: "games", ascending: false })
    .limit(windowGames);
  if (error) throw error;

  const roleHistoryByPlayer = new Map<number, string[]>();
  const rows = (data ?? []) as LineCombinationWithGameDateRow[];
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}

export type { StarterContextForTest, StarterScenario } from "./types/run-forge-projections.types";


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
  source: "line_combination" | "fallback_toi_rank";
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
      daysStale: null
    };
  }

  const daysStale = Math.max(
    0,
    daysBetweenDates(args.asOfDate, args.sourceGameDate)
  );
  return {
    isMissing: false,
    isSoftStale: daysStale > softDays,
    isHardStale: daysStale > hardDays,
    daysStale
  };
}

function toSkaterPositionGroup(position: string | null | undefined): "F" | "D" | "OTHER" {
  const p = typeof position === "string" ? position.toUpperCase() : "";
  if (p === "D") return "D";
  if (p === "C" || p === "L" || p === "R" || p === "LW" || p === "RW") return "F";
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
    source: "line_combination" | "fallback_toi_rank"
  ) => {
    if (roleByPlayerId.has(playerId)) return;
    roleByPlayerId.set(playerId, {
      esRole,
      unitTier: tierFromRole(esRole),
      roleRank,
      source
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
    const fallbackIds = Array.from(new Set(args.fallbackRankedSkaterIds)).filter((id) => {
      const meta = args.playerMetaById.get(id);
      return Boolean(meta) && meta?.team_id === args.teamId && meta?.position !== "G";
    });
    const forwards: number[] = [];
    const defensemen: number[] = [];
    const other: number[] = [];
    for (const playerId of fallbackIds) {
      const group = toSkaterPositionGroup(args.playerMetaById.get(playerId)?.position);
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
      setRole(playerId, "L4", forwards.length + defensemen.length + idx + 1, "fallback_toi_rank");
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
      volatilityIndex: 0
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
    volatilityIndex: Number(volatilityIndex.toFixed(4))
  };
}

export function computeSkaterRoleStabilityMultiplier(
  summary: SkaterRoleContinuitySummary
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
    0.9
  );
  const adjacentProb = clamp(
    0.28 - continuityShare * 0.12 + volatility * 0.18,
    0.08,
    0.42
  );
  const depthProb = clamp(1 - currentProb - adjacentProb, 0.03, 0.25);
  const scenarios: SkaterRoleScenario[] = [
    {
      role: currentRole,
      probability: currentProb,
      source: "current_role"
    },
    {
      role: adjacentRole(currentRole),
      probability: adjacentProb,
      source: "adjacent_role"
    },
    {
      role: currentRole.startsWith("D") ? "D3" : "L4",
      probability: depthProb,
      source: "depth_fallback"
    }
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
      (sum > 0 ? s.probability / sum : 1 / normalized.length).toFixed(4)
    )
  }));
}

function parseRoleRank(role: string): {
  family: "L" | "D" | null;
  rank: number | null;
} {
  if (role.startsWith("L")) {
    const rank = Number(role.slice(1));
    return { family: "L", rank: Number.isFinite(rank) ? rank : null };
  }
  if (role.startsWith("D")) {
    const rank = Number(role.slice(1));
    return { family: "D", rank: Number.isFinite(rank) ? rank : null };
  }
  return { family: null, rank: null };
}

function scenarioRoleScoringMultiplier(
  currentRole: string | null,
  scenarioRole: string
): {
  goal: number;
  assist: number;
} {
  const current = currentRole
    ? parseRoleRank(currentRole)
    : { family: null, rank: null };
  const scenario = parseRoleRank(scenarioRole);
  if (
    current.family == null ||
    scenario.family == null ||
    current.rank == null ||
    scenario.rank == null ||
    current.family !== scenario.family
  ) {
    return { goal: 0.97, assist: 0.97 };
  }
  const delta = current.rank - scenario.rank;
  const goal = clamp(1 + delta * 0.07, 0.82, 1.2);
  const assist = clamp(1 + delta * 0.09, 0.8, 1.24);
  return { goal: Number(goal.toFixed(4)), assist: Number(assist.toFixed(4)) };
}

export function blendSkaterScenarioStatLines(args: {
  currentRole: string | null;
  scenarios: SkaterRoleScenario[];
  baseGoalsEs: number;
  baseGoalsPp: number;
  baseAssistsEs: number;
  baseAssistsPp: number;
}): {
  blended: {
    goalsEs: number;
    goalsPp: number;
    assistsEs: number;
    assistsPp: number;
  };
  scenarioLines: SkaterScenarioStatLine[];
} {
  if (args.scenarios.length === 0) {
    return {
      blended: {
        goalsEs: args.baseGoalsEs,
        goalsPp: args.baseGoalsPp,
        assistsEs: args.baseAssistsEs,
        assistsPp: args.baseAssistsPp
      },
      scenarioLines: []
    };
  }
  const scenarioLines: SkaterScenarioStatLine[] = [];
  let blendedGoalsEs = 0;
  let blendedGoalsPp = 0;
  let blendedAssistsEs = 0;
  let blendedAssistsPp = 0;
  for (const scenario of args.scenarios) {
    const p = clamp(scenario.probability, 0, 1);
    const mult = scenarioRoleScoringMultiplier(args.currentRole, scenario.role);
    const goalsEs = args.baseGoalsEs * mult.goal;
    const goalsPp = args.baseGoalsPp * mult.goal;
    const assistsEs = args.baseAssistsEs * mult.assist;
    const assistsPp = args.baseAssistsPp * mult.assist;
    blendedGoalsEs += p * goalsEs;
    blendedGoalsPp += p * goalsPp;
    blendedAssistsEs += p * assistsEs;
    blendedAssistsPp += p * assistsPp;
    scenarioLines.push({
      role: scenario.role,
      probability: Number(p.toFixed(4)),
      goalsEs: Number(goalsEs.toFixed(4)),
      goalsPp: Number(goalsPp.toFixed(4)),
      assistsEs: Number(assistsEs.toFixed(4)),
      assistsPp: Number(assistsPp.toFixed(4))
    });
  }
  return {
    blended: {
      goalsEs: Number(blendedGoalsEs.toFixed(4)),
      goalsPp: Number(blendedGoalsPp.toFixed(4)),
      assistsEs: Number(blendedAssistsEs.toFixed(4)),
      assistsPp: Number(blendedAssistsPp.toFixed(4))
    },
    scenarioLines
  };
}

export function blendSkaterScenarioStatLinesAcrossHorizon(args: {
  currentRole: string | null;
  scenarios: SkaterRoleScenario[];
  baseGoalsEs: number;
  baseGoalsPp: number;
  baseAssistsEs: number;
  baseAssistsPp: number;
  horizonScalars: number[];
  roleContinuity: SkaterRoleContinuitySummary | null;
}): SkaterScenarioHorizonBlendResult {
  const scalars = args.horizonScalars.length > 0 ? args.horizonScalars : [1];
  const scenarioSeed =
    args.scenarios.length > 0
      ? args.scenarios
      : [
          {
            role: args.currentRole ?? "L4",
            probability: 1,
            source: "current_role" as const
          }
        ];
  const baseNormDenom = scenarioSeed.reduce(
    (acc, s) => acc + Math.max(0, s.probability),
    0
  );
  const baseNorm = scenarioSeed.map((s) => ({
    ...s,
    probability:
      baseNormDenom > 0
        ? clamp(s.probability / baseNormDenom, 0, 1)
        : 1 / scenarioSeed.length
  }));
  const baseUniformProb = 1 / baseNorm.length;
  const volatility = args.roleContinuity?.volatilityIndex ?? 0.35;

  let blendedGoalsEs = 0;
  let blendedGoalsPp = 0;
  let blendedAssistsEs = 0;
  let blendedAssistsPp = 0;
  const scenarioLineByRole = new Map<string, SkaterScenarioStatLine>();
  const horizonScenarioSummaries: Array<{
    gameIndex: number;
    topRole: string;
    topProbability: number;
  }> = [];
  const scalarTotal = scalars.reduce((acc, s) => acc + Math.max(0, s), 0) || 1;

  for (let gameIndex = 0; gameIndex < scalars.length; gameIndex += 1) {
    const scalar = Math.max(0, scalars[gameIndex] ?? 0);
    const reversion = clamp(
      gameIndex * ROLE_SCENARIO_REVERSION_PER_GAME +
        volatility * ROLE_SCENARIO_VOLATILE_REVERSION_BONUS,
      0,
      0.75
    );
    const gameScenarios = baseNorm.map((s) => ({
      ...s,
      probability: clamp(
        (1 - reversion) * s.probability + reversion * baseUniformProb,
        0,
        1
      )
    }));
    const gameProbDenom =
      gameScenarios.reduce((acc, s) => acc + s.probability, 0) || 1;
    const normalizedGameScenarios = gameScenarios.map((s) => ({
      ...s,
      probability: s.probability / gameProbDenom
    }));
    const top = normalizedGameScenarios
      .slice()
      .sort((a, b) => b.probability - a.probability)[0];
    horizonScenarioSummaries.push({
      gameIndex,
      topRole: top?.role ?? args.currentRole ?? "L4",
      topProbability: Number((top?.probability ?? 1).toFixed(4))
    });

    for (const scenario of normalizedGameScenarios) {
      const p = clamp(scenario.probability, 0, 1);
      const mult = scenarioRoleScoringMultiplier(
        args.currentRole,
        scenario.role
      );
      const goalsEs = args.baseGoalsEs * mult.goal;
      const goalsPp = args.baseGoalsPp * mult.goal;
      const assistsEs = args.baseAssistsEs * mult.assist;
      const assistsPp = args.baseAssistsPp * mult.assist;
      const weightedScalar = scalar / scalarTotal;
      blendedGoalsEs += weightedScalar * p * goalsEs;
      blendedGoalsPp += weightedScalar * p * goalsPp;
      blendedAssistsEs += weightedScalar * p * assistsEs;
      blendedAssistsPp += weightedScalar * p * assistsPp;
      const existing = scenarioLineByRole.get(scenario.role);
      if (!existing) {
        scenarioLineByRole.set(scenario.role, {
          role: scenario.role,
          probability: weightedScalar * p,
          goalsEs: weightedScalar * goalsEs,
          goalsPp: weightedScalar * goalsPp,
          assistsEs: weightedScalar * assistsEs,
          assistsPp: weightedScalar * assistsPp
        });
      } else {
        existing.probability += weightedScalar * p;
        existing.goalsEs += weightedScalar * goalsEs;
        existing.goalsPp += weightedScalar * goalsPp;
        existing.assistsEs += weightedScalar * assistsEs;
        existing.assistsPp += weightedScalar * assistsPp;
        scenarioLineByRole.set(scenario.role, existing);
      }
    }
  }

  const scenarioLines = Array.from(scenarioLineByRole.values())
    .sort((a, b) => b.probability - a.probability)
    .map((s) => ({
      role: s.role,
      probability: Number(s.probability.toFixed(4)),
      goalsEs: Number(s.goalsEs.toFixed(4)),
      goalsPp: Number(s.goalsPp.toFixed(4)),
      assistsEs: Number(s.assistsEs.toFixed(4)),
      assistsPp: Number(s.assistsPp.toFixed(4))
    }));

  return {
    blended: {
      goalsEs: Number(blendedGoalsEs.toFixed(4)),
      goalsPp: Number(blendedGoalsPp.toFixed(4)),
      assistsEs: Number(blendedAssistsEs.toFixed(4)),
      assistsPp: Number(blendedAssistsPp.toFixed(4))
    },
    scenarioLines,
    horizonScenarioSummaries
  };
}

export function buildSkaterScenarioMetadata(args: {
  scenarios: SkaterRoleScenario[];
  modelVersion?: string;
  topK?: number;
}): SkaterScenarioMetadata {
  const topK = Number.isFinite(args.topK)
    ? Math.max(1, Math.floor(Number(args.topK)))
    : 3;
  const modelVersion = args.modelVersion ?? "skater-role-scenario-v1";
  const normalized = args.scenarios
    .slice()
    .sort((a, b) => b.probability - a.probability)
    .slice(0, topK)
    .map((s) => ({
      role: s.role,
      probability: Number(clamp(s.probability, 0, 1).toFixed(4)),
      source: s.source
    }));
  return {
    modelVersion,
    scenarioCount: args.scenarios.length,
    topScenarioDrivers: normalized
  };
}

function computeSkaterRecencyMultiplier(daysSinceLastMetric: number): number {
  if (daysSinceLastMetric <= SKATER_STALE_SOFT_DAYS) return 1;
  if (daysSinceLastMetric > SKATER_STALE_HARD_DAYS) return 0;
  const span = Math.max(1, SKATER_STALE_HARD_DAYS - SKATER_STALE_SOFT_DAYS);
  const progress = clamp((daysSinceLastMetric - SKATER_STALE_SOFT_DAYS) / span, 0, 1);
  return clamp(
    1 - progress * (1 - SKATER_SOFT_STALE_MIN_MULTIPLIER),
    SKATER_SOFT_STALE_MIN_MULTIPLIER,
    1
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
    Number.isFinite(id)
  );
  const eligibleSkaterIds: number[] = [];
  const recencyMultiplierByPlayerId = new Map<number, number>();
  const stats = {
    filteredByTeamOrPosition: 0,
    filteredMissingRecentMetrics: 0,
    filteredHardStale: 0,
    softStalePenalized: 0
  };
  const excludedSkaterIdsByReason = {
    teamOrPosition: [] as number[],
    missingRecentMetrics: [] as number[],
    hardStale: [] as number[]
  };

  for (const playerId of uniqueRaw) {
    const meta = args.playerMetaById.get(playerId);
    const isSkater = Boolean(meta && meta.position != null && meta.position !== "G");
    const isOnTeam = Boolean(meta && meta.team_id != null && meta.team_id === args.teamId);
    if (!isSkater || !isOnTeam) {
      stats.filteredByTeamOrPosition += 1;
      excludedSkaterIdsByReason.teamOrPosition.push(playerId);
      continue;
    }

    const latestMetricDate = args.latestMetricDateByPlayerId.get(playerId) ?? null;
    if (!latestMetricDate) {
      stats.filteredMissingRecentMetrics += 1;
      excludedSkaterIdsByReason.missingRecentMetrics.push(playerId);
      continue;
    }

    const daysSinceLastMetric = Math.max(
      0,
      daysBetweenDates(args.asOfDate, latestMetricDate)
    );
    const recencyMultiplier = computeSkaterRecencyMultiplier(daysSinceLastMetric);
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
    excludedSkaterIdsByReason
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

export function computeSkaterTeamToiTargetWithPoolGuard(args: {
  canonicalTargetSeconds: number;
  projectedSkaterCount: number;
  ppShare: number;
  minValidSkaterCount?: number;
  maxSingleSkaterToiSeconds?: number;
  maxAvgToiPerProjectedSkaterSeconds?: number;
}): {
  targetSeconds: number;
  wasCapped: boolean;
  capReason: "undersized_projected_pool" | null;
} {
  const canonicalTarget = Math.max(
    0,
    Math.floor(Number(args.canonicalTargetSeconds) || 0)
  );
  const projectedSkaterCount = Math.max(
    0,
    Math.floor(Number(args.projectedSkaterCount) || 0)
  );
  const minValidSkaterCount = Number.isFinite(args.minValidSkaterCount)
    ? Math.max(1, Math.floor(Number(args.minValidSkaterCount)))
    : SKATER_POOL_MIN_VALID_COUNT;
  if (projectedSkaterCount >= minValidSkaterCount || canonicalTarget <= 0) {
    return {
      targetSeconds: canonicalTarget,
      wasCapped: false,
      capReason: null
    };
  }

  const ppShare = clamp(args.ppShare, 0, 0.5);
  const maxSingleSkaterToiSeconds = Number.isFinite(args.maxSingleSkaterToiSeconds)
    ? Math.max(600, Math.floor(Number(args.maxSingleSkaterToiSeconds)))
    : SKATER_POOL_EMERGENCY_MAX_SINGLE_TOI_SECONDS;
  const maxAvgToiPerProjectedSkaterSeconds = Number.isFinite(
    args.maxAvgToiPerProjectedSkaterSeconds
  )
    ? Math.max(300, Math.floor(Number(args.maxAvgToiPerProjectedSkaterSeconds)))
    : SKATER_POOL_EMERGENCY_MAX_AVG_TOI_SECONDS;

  const blendedTopShare =
    RECON_TOP_ES_SHARE_MAX * (1 - ppShare) + RECON_TOP_PP_SHARE_MAX * ppShare;
  const capByTopShare =
    blendedTopShare > 0
      ? Math.floor(maxSingleSkaterToiSeconds / blendedTopShare)
      : canonicalTarget;
  const capByAvgToi =
    projectedSkaterCount > 0
      ? projectedSkaterCount * maxAvgToiPerProjectedSkaterSeconds
      : 0;
  const emergencyCap = Math.max(1800, Math.min(capByTopShare, capByAvgToi));
  const targetSeconds = Math.min(canonicalTarget, emergencyCap);

  return {
    targetSeconds,
    wasCapped: targetSeconds < canonicalTarget,
    capReason: targetSeconds < canonicalTarget ? "undersized_projected_pool" : null
  };
}

export function computeSkaterShotQualityAdjustments(args: {
  profile: SkaterShotQualityProfile | null;
}): {
  sampleWeight: number;
  shotRateMultiplier: number;
  goalRateMultiplier: number;
  qualityPerShot: number | null;
  rushReboundPer60: number | null;
} {
  const profile = args.profile;
  if (!profile) {
    return {
      sampleWeight: 0,
      shotRateMultiplier: 1,
      goalRateMultiplier: 1,
      qualityPerShot: null,
      rushReboundPer60: null
    };
  }

  const shotsPer60 = finiteOrNull(profile.nstShotsPer60);
  const ixgPer60 = finiteOrNull(profile.nstIxgPer60);
  const rushPer60 = Math.max(0, finiteOrNull(profile.nstRushAttemptsPer60) ?? 0);
  const reboundsPer60 = Math.max(
    0,
    finiteOrNull(profile.nstReboundsCreatedPer60) ?? 0
  );
  const qualityPerShot =
    shotsPer60 != null && shotsPer60 > 0 && ixgPer60 != null
      ? ixgPer60 / shotsPer60
      : null;
  const rushReboundPer60 = rushPer60 + reboundsPer60;

  const shotsSignal = Math.max(0, shotsPer60 ?? 0);
  const sampleWeight = clamp(shotsSignal / (shotsSignal + 5), 0, 1);
  const qualityEdge =
    qualityPerShot != null
      ? clamp(
          (qualityPerShot - SKATER_IXG_PER_SHOT_BASELINE) /
            SKATER_IXG_PER_SHOT_BASELINE,
          -0.35,
          0.35
        )
      : 0;
  const rushReboundEdge = clamp(
    (rushReboundPer60 - SKATER_RUSH_REBOUND_PER60_BASELINE) /
      SKATER_RUSH_REBOUND_PER60_BASELINE,
    -0.5,
    0.5
  );

  const shotRateMultiplier = clamp(
    1 + sampleWeight * (qualityEdge * 0.05 + rushReboundEdge * 0.08),
    SKATER_SHOT_QUALITY_MIN_MULTIPLIER,
    SKATER_SHOT_QUALITY_MAX_MULTIPLIER
  );
  const goalRateMultiplier = clamp(
    1 + sampleWeight * (qualityEdge * 0.26 + rushReboundEdge * 0.07),
    SKATER_CONVERSION_MIN_MULTIPLIER,
    SKATER_CONVERSION_MAX_MULTIPLIER
  );

  return {
    sampleWeight: Number(sampleWeight.toFixed(4)),
    shotRateMultiplier: Number(shotRateMultiplier.toFixed(4)),
    goalRateMultiplier: Number(goalRateMultiplier.toFixed(4)),
    qualityPerShot:
      qualityPerShot == null ? null : Number(qualityPerShot.toFixed(4)),
    rushReboundPer60: Number(rushReboundPer60.toFixed(4))
  };
}

export function computeSkaterOnIceContextAdjustments(args: {
  profile: SkaterOnIceContextProfile | null;
}): {
  sampleWeight: number;
  shotEnvironmentMultiplier: number;
  goalEnvironmentMultiplier: number;
  assistEnvironmentMultiplier: number;
  possessionPct: number | null;
} {
  const profile = args.profile;
  if (!profile) {
    return {
      sampleWeight: 0,
      shotEnvironmentMultiplier: 1,
      goalEnvironmentMultiplier: 1,
      assistEnvironmentMultiplier: 1,
      possessionPct: null
    };
  }

  const xgfPer60 = finiteOrNull(profile.nstOiXgfPer60);
  const xgaPer60 = finiteOrNull(profile.nstOiXgaPer60);
  const possessionPct =
    normalizeRateOrPercent(profile.nstOiCfPct) ??
    normalizeRateOrPercent(profile.possessionPctSafe);
  const xgSignal = Math.max(0, (xgfPer60 ?? 0) + (xgaPer60 ?? 0));
  const sampleWeight = clamp(xgSignal / (xgSignal + 2.5), 0, 1);

  const offenseEdge =
    xgfPer60 != null
      ? clamp(
          (xgfPer60 - SKATER_ON_ICE_XG_PER60_BASELINE) /
            SKATER_ON_ICE_XG_PER60_BASELINE,
          -0.3,
          0.3
        )
      : 0;
  const defenseDrag =
    xgaPer60 != null
      ? clamp(
          (xgaPer60 - SKATER_ON_ICE_XG_PER60_BASELINE) /
            SKATER_ON_ICE_XG_PER60_BASELINE,
          -0.3,
          0.3
        )
      : 0;
  const possessionEdge =
    possessionPct != null
      ? clamp(
          (possessionPct - SKATER_ON_ICE_POSSESSION_BASELINE) /
            SKATER_ON_ICE_POSSESSION_BASELINE,
          -0.25,
          0.25
        )
      : 0;

  const shotEnvironmentMultiplier = clamp(
    1 + sampleWeight * (offenseEdge * 0.14 + possessionEdge * 0.1 - defenseDrag * 0.05),
    SKATER_ON_ICE_SHOT_ENV_MIN_MULTIPLIER,
    SKATER_ON_ICE_SHOT_ENV_MAX_MULTIPLIER
  );
  const goalEnvironmentMultiplier = clamp(
    1 + sampleWeight * (offenseEdge * 0.18 + possessionEdge * 0.07 - defenseDrag * 0.06),
    SKATER_ON_ICE_GOAL_ENV_MIN_MULTIPLIER,
    SKATER_ON_ICE_GOAL_ENV_MAX_MULTIPLIER
  );
  const assistEnvironmentMultiplier = clamp(
    1 + sampleWeight * (offenseEdge * 0.2 + possessionEdge * 0.13 - defenseDrag * 0.04),
    SKATER_ON_ICE_ASSIST_ENV_MIN_MULTIPLIER,
    SKATER_ON_ICE_ASSIST_ENV_MAX_MULTIPLIER
  );

  return {
    sampleWeight: Number(sampleWeight.toFixed(4)),
    shotEnvironmentMultiplier: Number(shotEnvironmentMultiplier.toFixed(4)),
    goalEnvironmentMultiplier: Number(goalEnvironmentMultiplier.toFixed(4)),
    assistEnvironmentMultiplier: Number(assistEnvironmentMultiplier.toFixed(4)),
    possessionPct:
      possessionPct == null ? null : Number(possessionPct.toFixed(4))
  };
}

export function computeSkaterTeamLevelContextAdjustments(args: {
  teamStrengthPrior: TeamStrengthPrior | null;
  opponentStrengthPrior: TeamStrengthPrior | null;
  teamFiveOnFiveProfile: TeamFiveOnFiveProfile | null;
  opponentFiveOnFiveProfile: TeamFiveOnFiveProfile | null;
  teamNstProfile: TeamNstExpectedGoalsProfile | null;
  opponentNstProfile: TeamNstExpectedGoalsProfile | null;
}): SkaterTeamLevelContextAdjustment {
  const teamStrength = args.teamStrengthPrior;
  const opponentStrength = args.opponentStrengthPrior;
  const teamFiveOnFive = args.teamFiveOnFiveProfile;
  const opponentFiveOnFive = args.opponentFiveOnFiveProfile;
  const teamNst = args.teamNstProfile;
  const opponentNst = args.opponentNstProfile;

  if (
    !teamStrength &&
    !opponentStrength &&
    !teamFiveOnFive &&
    !opponentFiveOnFive &&
    !teamNst &&
    !opponentNst
  ) {
    return {
      sampleWeight: 0,
      shotRateMultiplier: 1,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1,
      paceEdge: 0,
      opponentDefenseEdge: 0
    };
  }

  const teamXgfPerGame = teamStrength?.xgfPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const opponentXgaPerGame =
    opponentStrength?.xgaPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const teamPdo =
    normalizeRateOrPercent(teamFiveOnFive?.shootingPlusSavePct5v5) ??
    TEAM_5V5_PDO_BASELINE;
  const opponentSavePct5v5 =
    normalizeRateOrPercent(opponentFiveOnFive?.savePct5v5) ??
    TEAM_5V5_SAVE_PCT_BASELINE;
  const teamNstXgaPer60 = teamNst?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const opponentNstXgaPer60 =
    opponentNst?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const nstPaceProxy = (teamNstXgaPer60 + opponentNstXgaPer60) / 2;

  const strengthSampleRaw =
    Math.max(0, teamStrength?.xga ?? 0) + Math.max(0, opponentStrength?.xga ?? 0);
  const fiveOnFiveSampleRaw =
    Math.max(0, teamFiveOnFive?.gamesPlayed ?? 0) +
    Math.max(0, opponentFiveOnFive?.gamesPlayed ?? 0);
  const nstSampleRaw =
    Math.max(0, teamNst?.gamesPlayed ?? 0) + Math.max(0, opponentNst?.gamesPlayed ?? 0);
  const sampleWeight = clamp(
    strengthSampleRaw / (strengthSampleRaw + 260) * 0.35 +
      fiveOnFiveSampleRaw / (fiveOnFiveSampleRaw + 18) * 0.3 +
      nstSampleRaw / (nstSampleRaw + 40) * 0.35,
    0,
    1
  );

  const offenseEdge = clamp(
    (teamXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.22,
    0.22
  );
  const defenseLiabilityEdge = clamp(
    (opponentXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.22,
    0.22
  );
  const paceEdge = clamp(
    (nstPaceProxy - TEAM_NST_XGA_PER60_BASELINE) / TEAM_NST_XGA_PER60_BASELINE,
    -0.2,
    0.2
  );
  const pdoEdge = clamp(
    teamPdo - TEAM_5V5_PDO_BASELINE,
    -0.08,
    0.08
  );
  const opponentSaveEdge = clamp(
    TEAM_5V5_SAVE_PCT_BASELINE - opponentSavePct5v5,
    -0.03,
    0.03
  );

  const shotRateMultiplier = clamp(
    1 +
      sampleWeight *
        (offenseEdge * 0.14 +
          defenseLiabilityEdge * 0.18 +
          paceEdge * 0.2 +
          pdoEdge * 0.06),
    SKATER_TEAM_LEVEL_SHOT_MIN_MULTIPLIER,
    SKATER_TEAM_LEVEL_SHOT_MAX_MULTIPLIER
  );
  const goalRateMultiplier = clamp(
    1 +
      sampleWeight *
        (offenseEdge * 0.16 +
          defenseLiabilityEdge * 0.22 +
          opponentSaveEdge * 2.3 +
          paceEdge * 0.08),
    SKATER_TEAM_LEVEL_GOAL_MIN_MULTIPLIER,
    SKATER_TEAM_LEVEL_GOAL_MAX_MULTIPLIER
  );
  const assistRateMultiplier = clamp(
    1 +
      sampleWeight *
        (offenseEdge * 0.18 +
          defenseLiabilityEdge * 0.16 +
          paceEdge * 0.12 +
          pdoEdge * 0.08),
    SKATER_TEAM_LEVEL_ASSIST_MIN_MULTIPLIER,
    SKATER_TEAM_LEVEL_ASSIST_MAX_MULTIPLIER
  );

  return {
    sampleWeight: Number(sampleWeight.toFixed(4)),
    shotRateMultiplier: Number(shotRateMultiplier.toFixed(4)),
    goalRateMultiplier: Number(goalRateMultiplier.toFixed(4)),
    assistRateMultiplier: Number(assistRateMultiplier.toFixed(4)),
    paceEdge: Number(paceEdge.toFixed(4)),
    opponentDefenseEdge: Number(defenseLiabilityEdge.toFixed(4))
  };
}

export function computeSkaterOpponentGoalieContextAdjustments(args: {
  context: OpponentGoalieContext | null;
}): {
  sampleWeight: number;
  goalRateMultiplier: number;
  assistRateMultiplier: number;
  weightedProjectedGsaaPer60: number | null;
  starterCertainty: number;
} {
  const context = args.context;
  if (!context) {
    return {
      sampleWeight: 0,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1,
      weightedProjectedGsaaPer60: null,
      starterCertainty: 0
    };
  }

  const weightedGsaa = finiteOrNull(context.weightedProjectedGsaaPer60);
  const starterCertainty = context.isConfirmedStarter
    ? 1
    : clamp(context.topStarterProbability, 0, 1);
  const probabilityMass = clamp(context.probabilityMass, 0, 1);
  const sampleWeight = clamp(
    probabilityMass * (0.45 + 0.55 * starterCertainty),
    0,
    1
  );
  const qualityEdge =
    weightedGsaa != null ? clamp(weightedGsaa / GOALIE_GSAA_PRIOR_MAX_ABS, -1, 1) : 0;

  const goalRateMultiplier = clamp(
    1 + sampleWeight * (-qualityEdge * 0.18),
    SKATER_OPP_GOALIE_GOAL_MIN_MULTIPLIER,
    SKATER_OPP_GOALIE_GOAL_MAX_MULTIPLIER
  );
  const assistRateMultiplier = clamp(
    1 + sampleWeight * (-qualityEdge * 0.11),
    SKATER_OPP_GOALIE_ASSIST_MIN_MULTIPLIER,
    SKATER_OPP_GOALIE_ASSIST_MAX_MULTIPLIER
  );

  return {
    sampleWeight: Number(sampleWeight.toFixed(4)),
    goalRateMultiplier: Number(goalRateMultiplier.toFixed(4)),
    assistRateMultiplier: Number(assistRateMultiplier.toFixed(4)),
    weightedProjectedGsaaPer60:
      weightedGsaa == null ? null : Number(weightedGsaa.toFixed(4)),
    starterCertainty: Number(starterCertainty.toFixed(4))
  };
}

export function computeSkaterRestScheduleAdjustments(args: {
  teamRestDays: number | null;
  opponentRestDays: number | null;
  isHome: boolean;
}): SkaterRestScheduleAdjustment {
  const teamRestDays =
    Number.isFinite(args.teamRestDays) && args.teamRestDays != null
      ? Math.max(0, Number(args.teamRestDays))
      : null;
  const opponentRestDays =
    Number.isFinite(args.opponentRestDays) && args.opponentRestDays != null
      ? Math.max(0, Number(args.opponentRestDays))
      : null;

  if (teamRestDays == null && opponentRestDays == null) {
    return {
      sampleWeight: 0,
      toiMultiplier: 1,
      shotRateMultiplier: 1,
      goalRateMultiplier: 1,
      assistRateMultiplier: 1,
      restDelta: 0,
      teamRestDays: null,
      opponentRestDays: null
    };
  }

  const teamRest = teamRestDays ?? 1;
  const oppRest = opponentRestDays ?? 1;
  const restDelta = clamp((teamRest - oppRest) / 3, -1, 1);
  const teamFatiguePenalty = teamRest <= 0 ? 0.11 : teamRest === 1 ? 0.035 : 0;
  const teamRecoveryBoost = teamRest >= 3 ? 0.03 : teamRest === 2 ? 0.012 : 0;
  const opponentFatigueBoost = oppRest <= 0 ? 0.055 : oppRest === 1 ? 0.018 : 0;
  const homeIceEdge = args.isHome ? 0.012 : -0.004;

  const toiMultiplier = clamp(
    1 -
      teamFatiguePenalty +
      teamRecoveryBoost +
      restDelta * 0.03 +
      homeIceEdge * 0.6,
    SKATER_REST_TOI_MIN_MULTIPLIER,
    SKATER_REST_TOI_MAX_MULTIPLIER
  );
  const shotRateMultiplier = clamp(
    1 +
      opponentFatigueBoost -
      teamFatiguePenalty * 0.35 +
      restDelta * 0.045 +
      homeIceEdge * 0.45,
    SKATER_REST_SHOT_MIN_MULTIPLIER,
    SKATER_REST_SHOT_MAX_MULTIPLIER
  );
  const goalRateMultiplier = clamp(
    1 +
      opponentFatigueBoost * 0.72 -
      teamFatiguePenalty * 0.25 +
      restDelta * 0.035 +
      homeIceEdge * 0.8,
    SKATER_REST_GOAL_MIN_MULTIPLIER,
    SKATER_REST_GOAL_MAX_MULTIPLIER
  );
  const assistRateMultiplier = clamp(
    1 +
      opponentFatigueBoost * 0.5 -
      teamFatiguePenalty * 0.2 +
      restDelta * 0.04 +
      homeIceEdge * 0.55,
    SKATER_REST_ASSIST_MIN_MULTIPLIER,
    SKATER_REST_ASSIST_MAX_MULTIPLIER
  );

  return {
    sampleWeight: 1,
    toiMultiplier: Number(toiMultiplier.toFixed(4)),
    shotRateMultiplier: Number(shotRateMultiplier.toFixed(4)),
    goalRateMultiplier: Number(goalRateMultiplier.toFixed(4)),
    assistRateMultiplier: Number(assistRateMultiplier.toFixed(4)),
    restDelta: Number(restDelta.toFixed(4)),
    teamRestDays,
    opponentRestDays
  };
}

export function computeSkaterSampleShrinkageAdjustments(args: {
  evToiSecondsAll: number | null;
  ppToiSecondsAll: number | null;
  evShotsAll: number | null;
  ppShotsAll: number | null;
}): SkaterSampleShrinkageAdjustment {
  const evToi = Math.max(0, finiteOrNull(args.evToiSecondsAll) ?? 0);
  const ppToi = Math.max(0, finiteOrNull(args.ppToiSecondsAll) ?? 0);
  const evShots = Math.max(0, finiteOrNull(args.evShotsAll) ?? 0);
  const ppShots = Math.max(0, finiteOrNull(args.ppShotsAll) ?? 0);
  const evidenceToiSeconds = evToi + ppToi;
  const evidenceShots = evShots + ppShots;

  const toiEvidenceWeight = clamp(
    evidenceToiSeconds / (evidenceToiSeconds + SKATER_SMALL_SAMPLE_TOI_SECONDS_SCALE),
    0,
    1
  );
  const shotEvidenceWeight = clamp(
    evidenceShots / (evidenceShots + SKATER_SMALL_SAMPLE_SHOTS_SCALE),
    0,
    1
  );
  const sampleWeight = Number(
    clamp(toiEvidenceWeight * 0.58 + shotEvidenceWeight * 0.42, 0, 1).toFixed(4)
  );
  return {
    sampleWeight,
    isLowSample: sampleWeight < SKATER_SMALL_SAMPLE_LOW_WEIGHT_THRESHOLD,
    usedCallupFallback: sampleWeight < SKATER_SMALL_SAMPLE_CALLUP_WEIGHT_THRESHOLD,
    evidenceToiSeconds: Number(evidenceToiSeconds.toFixed(3)),
    evidenceShots: Number(evidenceShots.toFixed(3))
  };
}

export function computeStrengthSplitConversionRates(args: {
  evGoalsRecent: number;
  evShotsRecent: number;
  evGoalsAll: number;
  evShotsAll: number;
  evAssistsRecent: number;
  evAssistsAll: number;
  ppGoalsRecent: number;
  ppShotsRecent: number;
  ppGoalsAll: number;
  ppShotsAll: number;
  ppAssistsRecent: number;
  ppAssistsAll: number;
  goalRateMultiplier: number;
  assistRateMultiplier: number;
}): {
  goalRateEs: number;
  goalRatePp: number;
  assistRateEs: number;
  assistRatePp: number;
} {
  const adaptivePriorStrength = (opts: {
    baseStrength: number;
    evidenceDenom: number;
    evidenceScale: number;
    minStrength: number;
    maxStrength: number;
  }): number => {
    const denom = Math.max(0, opts.evidenceDenom);
    const shrinkFactor = opts.evidenceScale / (denom + opts.evidenceScale);
    const scaled = opts.baseStrength * (0.35 + 1.35 * shrinkFactor);
    return clamp(scaled, opts.minStrength, opts.maxStrength);
  };

  const evGoalPriorStrength = adaptivePriorStrength({
    baseStrength: 42,
    evidenceDenom:
      Math.max(0, args.evShotsAll) + Math.max(0, args.evShotsRecent),
    evidenceScale: 70,
    minStrength: 12,
    maxStrength: 72
  });
  const ppGoalPriorStrength = adaptivePriorStrength({
    baseStrength: 26,
    evidenceDenom:
      Math.max(0, args.ppShotsAll) + Math.max(0, args.ppShotsRecent),
    evidenceScale: 40,
    minStrength: 9,
    maxStrength: 54
  });
  const evAssistPriorStrength = adaptivePriorStrength({
    baseStrength: 22,
    evidenceDenom:
      Math.max(0, args.evGoalsAll * 2) + Math.max(0, args.evGoalsRecent * 2),
    evidenceScale: 36,
    minStrength: 8,
    maxStrength: 40
  });
  const ppAssistPriorStrength = adaptivePriorStrength({
    baseStrength: 16,
    evidenceDenom:
      Math.max(0, args.ppGoalsAll * 2) + Math.max(0, args.ppGoalsRecent * 2),
    evidenceScale: 24,
    minStrength: 6,
    maxStrength: 30
  });

  const goalRateEsRaw = blendOnlineRate({
    recentNumerator: args.evGoalsRecent,
    recentDenom: args.evShotsRecent,
    baseNumerator: args.evGoalsAll,
    baseDenom: args.evShotsAll,
    fallback: 0.095,
    priorStrength: evGoalPriorStrength,
    minRate: 0.025,
    maxRate: 0.24
  });
  const goalRatePpRaw = blendOnlineRate({
    recentNumerator: args.ppGoalsRecent,
    recentDenom: args.ppShotsRecent,
    baseNumerator: args.ppGoalsAll,
    baseDenom: args.ppShotsAll,
    fallback: 0.145,
    priorStrength: ppGoalPriorStrength,
    minRate: 0.04,
    maxRate: 0.36
  });
  const assistRateEsRaw = blendOnlineRate({
    recentNumerator: args.evAssistsRecent,
    recentDenom: args.evGoalsRecent * 2,
    baseNumerator: args.evAssistsAll,
    baseDenom: args.evGoalsAll * 2,
    fallback: 0.72,
    priorStrength: evAssistPriorStrength,
    minRate: 0.2,
    maxRate: 1.45
  });
  const assistRatePpRaw = blendOnlineRate({
    recentNumerator: args.ppAssistsRecent,
    recentDenom: args.ppGoalsRecent * 2,
    baseNumerator: args.ppAssistsAll,
    baseDenom: args.ppGoalsAll * 2,
    fallback: 0.95,
    priorStrength: ppAssistPriorStrength,
    minRate: 0.3,
    maxRate: 1.8
  });

  return {
    goalRateEs: clamp(goalRateEsRaw * args.goalRateMultiplier, 0.02, 0.3),
    goalRatePp: clamp(goalRatePpRaw * args.goalRateMultiplier, 0.03, 0.45),
    assistRateEs: clamp(assistRateEsRaw * args.assistRateMultiplier, 0.2, 1.7),
    assistRatePp: clamp(assistRatePpRaw * args.assistRateMultiplier, 0.3, 2)
  };
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
      playersReweighted: 0
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
      playersReweighted: 0
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
  roleTag: SkaterRoleTag | null
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
      dependencyScore: 0
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
    0.65
  );
  const dependencyScore = clamp(
    lineDependency * 0.6 + ppDependency * 0.4,
    0,
    1
  );

  const assistRateEsMultiplier = clamp(
    1 + (lineDependency - 0.14) * 0.62,
    SKATER_TEAMMATE_ASSIST_ES_MIN_MULTIPLIER,
    SKATER_TEAMMATE_ASSIST_ES_MAX_MULTIPLIER
  );
  const assistRatePpMultiplier = clamp(
    1 + (ppDependency - 0.18) * 0.75,
    SKATER_TEAMMATE_ASSIST_PP_MIN_MULTIPLIER,
    SKATER_TEAMMATE_ASSIST_PP_MAX_MULTIPLIER
  );

  return {
    assistRateEsMultiplier: Number(assistRateEsMultiplier.toFixed(4)),
    assistRatePpMultiplier: Number(assistRatePpMultiplier.toFixed(4)),
    dependencyScore: Number(dependencyScore.toFixed(4))
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
          sogPpMax: SKATER_ROLE_TOP_SOG_PP_MAX
        }
      : tier === "MIDDLE"
        ? {
            toiEsMin: SKATER_ROLE_MIDDLE_TOI_ES_MIN,
            toiEsMax: SKATER_ROLE_MIDDLE_TOI_ES_MAX,
            toiPpMin: SKATER_ROLE_MIDDLE_TOI_PP_MIN,
            toiPpMax: SKATER_ROLE_MIDDLE_TOI_PP_MAX,
            sogEsMax: SKATER_ROLE_MIDDLE_SOG_ES_MAX,
            sogPpMax: SKATER_ROLE_MIDDLE_SOG_PP_MAX
          }
        : {
            toiEsMin: SKATER_ROLE_DEPTH_TOI_ES_MIN,
            toiEsMax: SKATER_ROLE_DEPTH_TOI_ES_MAX,
            toiPpMin: SKATER_ROLE_DEPTH_TOI_PP_MIN,
            toiPpMax: SKATER_ROLE_DEPTH_TOI_PP_MAX,
            sogEsMax: SKATER_ROLE_DEPTH_SOG_ES_MAX,
            sogPpMax: SKATER_ROLE_DEPTH_SOG_PP_MAX
          };

  const boundedToiEs = clamp(
    args.toiEsSeconds,
    limits.toiEsMin,
    limits.toiEsMax
  );
  const boundedToiPp = clamp(
    args.toiPpSeconds,
    limits.toiPpMin,
    limits.toiPpMax
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
    wasBounded
  };
}

export function validateReconciledPlayerDistribution(args: {
  baselinePlayers: ReconciledSkaterVector[];
  reconciledPlayers: ReconciledSkaterVector[];
  targets: {
    toiEsSeconds: number;
    toiPpSeconds: number;
    shotsEs: number;
    shotsPp: number;
  };
}): ReconciliationDistributionValidation {
  const byBaselineId = new Map<number, ReconciledSkaterVector>();
  for (const p of args.baselinePlayers) byBaselineId.set(p.playerId, p);
  const players = args.reconciledPlayers.map((p) => ({ ...p }));
  if (players.length === 0) {
    return {
      players,
      wasAdjusted: false,
      topEsShareAfter: 0,
      topPpShareAfter: 0
    };
  }

  const totalEs = players.reduce(
    (acc, p) => acc + Math.max(0, p.toiEsSeconds),
    0
  );
  const totalPp = players.reduce(
    (acc, p) => acc + Math.max(0, p.toiPpSeconds),
    0
  );
  const topEsShareAfter =
    totalEs > 0
      ? Math.max(...players.map((p) => Math.max(0, p.toiEsSeconds) / totalEs))
      : 0;
  const topPpShareAfter =
    totalPp > 0
      ? Math.max(...players.map((p) => Math.max(0, p.toiPpSeconds) / totalPp))
      : 0;
  const needsAdjustment =
    topEsShareAfter > RECON_TOP_ES_SHARE_MAX ||
    topPpShareAfter > RECON_TOP_PP_SHARE_MAX;
  if (!needsAdjustment) {
    return {
      players,
      wasAdjusted: false,
      topEsShareAfter: Number(topEsShareAfter.toFixed(4)),
      topPpShareAfter: Number(topPpShareAfter.toFixed(4))
    };
  }

  const blended = players.map((p) => {
    const baseline = byBaselineId.get(p.playerId) ?? p;
    return {
      ...p,
      toiEsSeconds: Number(
        (
          (1 - RECON_BLEND_TO_BASELINE) * p.toiEsSeconds +
          RECON_BLEND_TO_BASELINE * baseline.toiEsSeconds
        ).toFixed(3)
      ),
      toiPpSeconds: Number(
        (
          (1 - RECON_BLEND_TO_BASELINE) * p.toiPpSeconds +
          RECON_BLEND_TO_BASELINE * baseline.toiPpSeconds
        ).toFixed(3)
      ),
      shotsEs: Number(
        (
          (1 - RECON_BLEND_TO_BASELINE) * p.shotsEs +
          RECON_BLEND_TO_BASELINE * baseline.shotsEs
        ).toFixed(3)
      ),
      shotsPp: Number(
        (
          (1 - RECON_BLEND_TO_BASELINE) * p.shotsPp +
          RECON_BLEND_TO_BASELINE * baseline.shotsPp
        ).toFixed(3)
      )
    };
  });

  const renormalize = (
    key: "toiEsSeconds" | "toiPpSeconds" | "shotsEs" | "shotsPp",
    target: number
  ) => {
    const sum = blended.reduce((acc, p) => acc + Math.max(0, p[key]), 0);
    const scale = sum > 0 ? target / sum : 1;
    for (const p of blended) {
      p[key] = Number((Math.max(0, p[key]) * scale).toFixed(3));
    }
  };
  renormalize("toiEsSeconds", args.targets.toiEsSeconds);
  renormalize("toiPpSeconds", args.targets.toiPpSeconds);
  renormalize("shotsEs", args.targets.shotsEs);
  renormalize("shotsPp", args.targets.shotsPp);

  const adjustedTotalEs = blended.reduce(
    (acc, p) => acc + Math.max(0, p.toiEsSeconds),
    0
  );
  const adjustedTotalPp = blended.reduce(
    (acc, p) => acc + Math.max(0, p.toiPpSeconds),
    0
  );
  const adjustedTopEsShare =
    adjustedTotalEs > 0
      ? Math.max(
          ...blended.map((p) => Math.max(0, p.toiEsSeconds) / adjustedTotalEs)
        )
      : 0;
  const adjustedTopPpShare =
    adjustedTotalPp > 0
      ? Math.max(
          ...blended.map((p) => Math.max(0, p.toiPpSeconds) / adjustedTotalPp)
        )
      : 0;

  return {
    players: blended,
    wasAdjusted: true,
    topEsShareAfter: Number(adjustedTopEsShare.toFixed(4)),
    topPpShareAfter: Number(adjustedTopPpShare.toFixed(4))
  };
}

function computeWorkloadSavePctPenalty(workload: GoalieWorkloadContext): number {
  let penalty = 0;
  if (workload.startsLast14Days >= 6) {
    penalty += GOALIE_VERY_HEAVY_WORKLOAD_PENALTY;
  } else if (workload.startsLast14Days >= 5) {
    penalty += GOALIE_HEAVY_WORKLOAD_PENALTY;
  }
  if (workload.isGoalieBackToBack) {
    penalty += GOALIE_BACK_TO_BACK_PENALTY;
  }
  return penalty;
}

export function toGoalieRestSplitBucket(
  daysSinceLastStart: number | null
): GoalieRestSplitBucket {
  if (daysSinceLastStart == null) return "4_plus";
  if (daysSinceLastStart <= 0) return "0";
  if (daysSinceLastStart === 1) return "1";
  if (daysSinceLastStart === 2) return "2";
  if (daysSinceLastStart === 3) return "3";
  return "4_plus";
}

export function computeGoalieRestSplitSavePctAdjustment(args: {
  profile: GoalieRestSplitProfile | null;
  daysSinceLastStart: number | null;
}): number {
  const { profile, daysSinceLastStart } = args;
  if (!profile) return 0;

  const bucket = toGoalieRestSplitBucket(daysSinceLastStart);
  const bucketGames = profile.gamesByBucket[bucket] ?? 0;
  const bucketSavePct = profile.savePctByBucket[bucket];
  if (
    !Number.isFinite(bucketGames) ||
    bucketGames < GOALIE_REST_SPLIT_MIN_GAMES ||
    !Number.isFinite(bucketSavePct)
  ) {
    return 0;
  }

  let weightedSavePctSum = 0;
  let weightedGames = 0;
  const buckets: GoalieRestSplitBucket[] = ["0", "1", "2", "3", "4_plus"];
  for (const b of buckets) {
    const games = profile.gamesByBucket[b] ?? 0;
    const savePct = profile.savePctByBucket[b];
    if (
      Number.isFinite(games) &&
      games > 0 &&
      Number.isFinite(savePct) &&
      savePct != null
    ) {
      weightedSavePctSum += games * savePct;
      weightedGames += games;
    }
  }
  if (weightedGames <= 0) return 0;

  const baselineSavePct = weightedSavePctSum / weightedGames;
  const sampleWeight = clamp(bucketGames / (bucketGames + 6), 0, 1);
  const delta = (bucketSavePct as number) - baselineSavePct;
  return clamp(
    delta * sampleWeight,
    -GOALIE_REST_SPLIT_MAX_ADJUSTMENT,
    GOALIE_REST_SPLIT_MAX_ADJUSTMENT
  );
}

export function computeTeamStrengthContextAdjustment(args: {
  defendingTeamPrior: TeamStrengthPrior | null;
  opponentTeamPrior: TeamStrengthPrior | null;
}): {
  shotsAgainstPctAdjustment: number;
  teamGoalsForPctAdjustment: number;
  opponentGoalsForPctAdjustment: number;
  sampleWeight: number;
} {
  const defending = args.defendingTeamPrior;
  const opponent = args.opponentTeamPrior;
  if (!defending && !opponent) {
    return {
      shotsAgainstPctAdjustment: 0,
      teamGoalsForPctAdjustment: 0,
      opponentGoalsForPctAdjustment: 0,
      sampleWeight: 0
    };
  }

  const defendingXgaPerGame = defending?.xgaPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const defendingXgfPerGame = defending?.xgfPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const opponentXgaPerGame = opponent?.xgaPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const opponentXgfPerGame = opponent?.xgfPerGame ?? TEAM_XG_BASELINE_PER_GAME;
  const defendingXgaRaw = Math.max(0, defending?.xga ?? 0);
  const opponentXgaRaw = Math.max(0, opponent?.xga ?? 0);
  const sampleWeight = clamp((defendingXgaRaw + opponentXgaRaw) / 280, 0, 1);

  const defenseLiabilityEdge = clamp(
    (defendingXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );
  const opponentOffenseEdge = clamp(
    (opponentXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );
  const teamOffenseEdge = clamp(
    (defendingXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );
  const opponentDefenseEdge = clamp(
    (opponentXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,
    -0.2,
    0.2
  );

  const shotsAgainstPctAdjustment = clamp(
    (defenseLiabilityEdge * 0.32 + opponentOffenseEdge * 0.36) * sampleWeight,
    -TEAM_XG_SHOTS_AGAINST_MAX_PCT,
    TEAM_XG_SHOTS_AGAINST_MAX_PCT
  );
  const teamGoalsForPctAdjustment = clamp(
    (teamOffenseEdge * 0.3 - opponentDefenseEdge * 0.24) * sampleWeight,
    -TEAM_XG_WIN_CONTEXT_MAX_PCT,
    TEAM_XG_WIN_CONTEXT_MAX_PCT
  );
  const opponentGoalsForPctAdjustment = clamp(
    (opponentOffenseEdge * 0.28 + defenseLiabilityEdge * 0.22) * sampleWeight,
    -TEAM_XG_WIN_CONTEXT_MAX_PCT,
    TEAM_XG_WIN_CONTEXT_MAX_PCT
  );

  return {
    shotsAgainstPctAdjustment,
    teamGoalsForPctAdjustment,
    opponentGoalsForPctAdjustment,
    sampleWeight
  };
}

function normalizeRateOrPercent(
  value: number | null | undefined
): number | null {
  if (!Number.isFinite(value)) return null;
  const raw = Number(value);
  if (raw < 0) return null;
  if (raw > 2 && raw <= 200) return raw / 100;
  return raw;
}

export function computeTeamFiveOnFiveContextAdjustment(args: {
  defendingTeamProfile: TeamFiveOnFiveProfile | null;
  opponentTeamProfile: TeamFiveOnFiveProfile | null;
}): {
  sampleWeight: number;
  leagueSavePctAdjustment: number;
  contextPctAdjustment: number;
} {
  const defending = args.defendingTeamProfile;
  const opponent = args.opponentTeamProfile;
  if (!defending && !opponent) {
    return {
      sampleWeight: 0,
      leagueSavePctAdjustment: 0,
      contextPctAdjustment: 0
    };
  }

  const defendingSavePct =
    normalizeRateOrPercent(defending?.savePct5v5) ?? TEAM_5V5_SAVE_PCT_BASELINE;
  const defendingSpsv =
    normalizeRateOrPercent(defending?.shootingPlusSavePct5v5) ?? TEAM_5V5_PDO_BASELINE;
  const opponentSpsv =
    normalizeRateOrPercent(opponent?.shootingPlusSavePct5v5) ?? TEAM_5V5_PDO_BASELINE;
  const defendingGames = Math.max(0, defending?.gamesPlayed ?? 0);
  const opponentGames = Math.max(0, opponent?.gamesPlayed ?? 0);
  const sampleWeight = clamp(
    (defendingGames + opponentGames) /
      (defendingGames + opponentGames + TEAM_5V5_MIN_SAMPLE_GAMES),
    0,
    1
  );

  const saveEdge = clamp(
    defendingSavePct - TEAM_5V5_SAVE_PCT_BASELINE,
    -0.03,
    0.03
  );
  const defendingPdoEdge = clamp(
    defendingSpsv - TEAM_5V5_PDO_BASELINE,
    -0.08,
    0.08
  );
  const opponentPdoEdge = clamp(
    opponentSpsv - TEAM_5V5_PDO_BASELINE,
    -0.08,
    0.08
  );

  const leagueSavePctAdjustment = clamp(
    (saveEdge * 0.75 + defendingPdoEdge * 0.2) * sampleWeight,
    -TEAM_5V5_MAX_LEAGUE_SAVE_PCT_ADJ,
    TEAM_5V5_MAX_LEAGUE_SAVE_PCT_ADJ
  );
  const contextPctAdjustment = clamp(
    (-saveEdge * 0.45 + opponentPdoEdge * 0.2) * sampleWeight,
    -TEAM_5V5_MAX_CONTEXT_PCT_ADJ,
    TEAM_5V5_MAX_CONTEXT_PCT_ADJ
  );

  return {
    sampleWeight,
    leagueSavePctAdjustment,
    contextPctAdjustment
  };
}

export function computeNstOpponentDangerAdjustment(args: {
  defendingTeamProfile: TeamNstExpectedGoalsProfile | null;
  opponentTeamProfile: TeamNstExpectedGoalsProfile | null;
}): { sampleWeight: number; contextPctAdjustment: number } {
  const defending = args.defendingTeamProfile;
  const opponent = args.opponentTeamProfile;
  if (!defending && !opponent) {
    return { sampleWeight: 0, contextPctAdjustment: 0 };
  }

  const defendingXgaPer60 =
    defending?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const opponentXgaPer60 = opponent?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE;
  const defendingGames = Math.max(0, defending?.gamesPlayed ?? 0);
  const opponentGames = Math.max(0, opponent?.gamesPlayed ?? 0);
  const sampleWeight = clamp(
    (defendingGames + opponentGames) / (defendingGames + opponentGames + 30),
    0,
    1
  );

  const defendingDangerEdge = clamp(
    (defendingXgaPer60 - TEAM_NST_XGA_PER60_BASELINE) /
      TEAM_NST_XGA_PER60_BASELINE,
    -0.25,
    0.25
  );
  const paceProxyEdge = clamp(
    (opponentXgaPer60 - TEAM_NST_XGA_PER60_BASELINE) /
      TEAM_NST_XGA_PER60_BASELINE,
    -0.2,
    0.2
  );

  const contextPctAdjustment = clamp(
    (defendingDangerEdge * 0.32 + paceProxyEdge * 0.12) * sampleWeight,
    -TEAM_NST_MAX_CONTEXT_PCT_ADJ,
    TEAM_NST_MAX_CONTEXT_PCT_ADJ
  );

  return {
    sampleWeight,
    contextPctAdjustment
  };
}

export { buildSequentialHorizonScalarsFromDates } from "./utils/date-utils";

async function fetchTeamHorizonScalars(
  teamId: number,
  asOfDate: string,
  horizonGames: number
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

export function blendTopStarterScenarioOutputs(opts: {
  scenarioProjections: StarterScenarioProjection[];
  fallbackProjection: Omit<
    StarterScenarioProjection,
    "goalie_id" | "rank" | "starter_probability_raw" | "starter_probability_top2_normalized"
  >;
}) {
  const weighted = {
    proj_shots_against: 0,
    proj_saves: 0,
    proj_goals_allowed: 0,
    proj_win_prob: 0,
    proj_shutout_prob: 0,
    modeled_save_pct: 0
  };
  let probabilityMass = 0;
  for (const s of opts.scenarioProjections) {
    const w = clamp(s.starter_probability_raw, 0, 1);
    probabilityMass += w;
    weighted.proj_shots_against += w * s.proj_shots_against;
    weighted.proj_saves += w * s.proj_saves;
    weighted.proj_goals_allowed += w * s.proj_goals_allowed;
    weighted.proj_win_prob += w * s.proj_win_prob;
    weighted.proj_shutout_prob += w * s.proj_shutout_prob;
    weighted.modeled_save_pct += w * s.modeled_save_pct;
  }

  const clampedMass = clamp(probabilityMass, 0, 1);
  const residualMass = 1 - clampedMass;
  const fallback = opts.fallbackProjection;
  return {
    probability_mass: Number(clampedMass.toFixed(4)),
    residual_probability_mass: Number(residualMass.toFixed(4)),
    proj_shots_against: weighted.proj_shots_against + residualMass * fallback.proj_shots_against,
    proj_saves: weighted.proj_saves + residualMass * fallback.proj_saves,
    proj_goals_allowed:
      weighted.proj_goals_allowed + residualMass * fallback.proj_goals_allowed,
    proj_win_prob: weighted.proj_win_prob + residualMass * fallback.proj_win_prob,
    proj_shutout_prob:
      weighted.proj_shutout_prob + residualMass * fallback.proj_shutout_prob,
    modeled_save_pct:
      weighted.modeled_save_pct + residualMass * fallback.modeled_save_pct
  };
}

async function fetchPlayerMetaByIds(
  playerIds: number[]
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
                  : String(row.position)
          } satisfies PlayerTeamPositionRow
        ] as const;
      })
      .filter(
        (entry): entry is readonly [number, PlayerTeamPositionRow] => entry != null
      )
  );
}

export function selectStarterCandidateGoalieIds(opts: {
  asOfDate: string;
  rawCandidateGoalieIds: number[];
  currentTeamGoalieIds: Set<number>;
  context: TeamGoalieStarterContext;
  goalieOverrideGoalieId?: number | null;
  limit?: number;
  priorStartProbByGoalieId?: Map<number, number>;
  confirmedStarterByGoalieId?: Map<number, boolean>;
}): number[] {
  const priorStartProbByGoalieId = opts.priorStartProbByGoalieId ?? new Map();
  const confirmedStarterByGoalieId = opts.confirmedStarterByGoalieId ?? new Map();
  const goalieOverrideGoalieId = opts.goalieOverrideGoalieId ?? null;
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Number(opts.limit)) : 3;

  return Array.from(new Set(opts.rawCandidateGoalieIds))
    .filter((goalieId) => {
      if (!Number.isFinite(goalieId)) return false;
      if (goalieOverrideGoalieId === goalieId) return true;
      if (opts.currentTeamGoalieIds.size > 0 && !opts.currentTeamGoalieIds.has(goalieId)) {
        return false;
      }
      const lastPlayed = opts.context.lastPlayedDateByGoalie.get(goalieId);
      if (!lastPlayed) return true;
      const daysSinceLastPlayed = Math.max(0, daysBetweenDates(opts.asOfDate, lastPlayed));
      return daysSinceLastPlayed <= GOALIE_STALE_HARD_DAYS;
    })
    .sort((a, b) => {
      const score = (goalieId: number) => {
        const starts = opts.context.startsByGoalie.get(goalieId) ?? 0;
        const priorProb = priorStartProbByGoalieId.get(goalieId) ?? 0.5;
        const isConfirmed = confirmedStarterByGoalieId.get(goalieId) ?? false;
        const lastPlayed = opts.context.lastPlayedDateByGoalie.get(goalieId);
        const daysSinceLastPlayed =
          lastPlayed != null ? Math.max(0, daysBetweenDates(opts.asOfDate, lastPlayed)) : 999;
        const isOverride = goalieOverrideGoalieId === goalieId;

        let s = 0;
        if (isOverride) s += 100;
        if (isConfirmed) s += 25;
        s += priorProb * 10;
        s += starts * 1.5;
        s -= Math.min(daysSinceLastPlayed, 120) / 30;
        return s;
      };
      return score(b) - score(a);
    })
    .slice(0, limit);
}

export function computeStarterProbabilities(opts: {
  asOfDate: string;
  candidateGoalieIds: number[];
  starterContext: TeamGoalieStarterContext;
  priorStartProbByGoalieId: Map<number, number>;
  lineComboPriorByGoalieId?: Map<number, number>;
  projectedGsaaPer60ByGoalieId?: Map<number, number>;
  seasonStartPctByGoalieId?: Map<number, number>;
  seasonGamesPlayedByGoalieId?: Map<number, number>;
  teamGoalsFor: number;
  opponentGoalsFor: number;
}): Map<number, number> {
  const probs = new Map<number, number>();
  const candidates = Array.from(new Set(opts.candidateGoalieIds)).filter((id) =>
    Number.isFinite(id)
  );
  if (candidates.length === 0) return probs;
  if (candidates.length === 1) {
    probs.set(candidates[0], 1);
    return probs;
  }

  const starts = opts.starterContext.startsByGoalie;
  const lineComboPriorByGoalieId = opts.lineComboPriorByGoalieId ?? new Map();
  const projectedGsaaPer60ByGoalieId =
    opts.projectedGsaaPer60ByGoalieId ?? new Map();
  const seasonStartPctByGoalieId = opts.seasonStartPctByGoalieId ?? new Map();
  const seasonGamesPlayedByGoalieId =
    opts.seasonGamesPlayedByGoalieId ?? new Map();
  const totalGames = Math.max(1, opts.starterContext.totalGames);
  const teamIsWeaker =
    opts.teamGoalsFor + TEAM_STRENGTH_WEAKER_GAP < opts.opponentGoalsFor;
  const opponentIsWeak = opts.opponentGoalsFor <= WEAK_OPPONENT_GF_THRESHOLD;
  const previousGameDate = opts.starterContext.previousGameDate;
  const isB2B =
    previousGameDate != null &&
    daysBetweenDates(opts.asOfDate, previousGameDate) === 1;
  const previousStarter = opts.starterContext.previousGameStarterGoalieId;
  const lastPlayedMap = opts.starterContext.lastPlayedDateByGoalie;

  const scores = candidates.map((goalieId) => {
    const l10Starts = starts.get(goalieId) ?? 0;
    const l10Share = l10Starts / totalGames;
    const priorProb = clamp(opts.priorStartProbByGoalieId.get(goalieId) ?? 0.5, 0.01, 0.99);
    const lineComboPrior = clamp(
      lineComboPriorByGoalieId.get(goalieId) ?? 0.5,
      0.05,
      0.95
    );
    const projectedGsaaPer60 = clamp(
      projectedGsaaPer60ByGoalieId.get(goalieId) ?? 0,
      -GOALIE_GSAA_PRIOR_MAX_ABS,
      GOALIE_GSAA_PRIOR_MAX_ABS
    );
    const seasonStartPct = clamp(
      seasonStartPctByGoalieId.get(goalieId) ?? GOALIE_SEASON_START_PCT_BASELINE,
      0,
      1
    );
    const seasonGamesPlayed = Math.max(0, seasonGamesPlayedByGoalieId.get(goalieId) ?? 0);
    const seasonGamesWeight = clamp(seasonGamesPlayed / (seasonGamesPlayed + 10), 0, 1);
    const isPrimary = l10Share >= 0.6;
    const playedYesterday = isB2B && previousStarter === goalieId;
    const lastPlayed = lastPlayedMap.get(goalieId) ?? null;
    const daysSinceLastPlayed =
      lastPlayed != null ? Math.max(0, daysBetweenDates(opts.asOfDate, lastPlayed)) : 999;

    let score = 0;
    // Core usage signal: if a goalie started 7/10, this pushes probability up materially.
    score += 2.4 * (l10Share - 0.5);
    // Preserve external prior signal when available.
    score += 0.7 * Math.log(priorProb / (1 - priorProb));
    // Recency-weighted line-combo goalie tags as a soft prior only.
    score += LINE_COMBO_PRIOR_LOGIT_WEIGHT * Math.log(lineComboPrior / (1 - lineComboPrior));
    // Quality prior from projected GSAA/60 (bounded, soft).
    score += GOALIE_GSAA_PRIOR_WEIGHT * projectedGsaaPer60;
    // Season starter-share prior, weighted by sample size.
    score +=
      GOALIE_SEASON_START_PCT_WEIGHT *
      (seasonStartPct - GOALIE_SEASON_START_PCT_BASELINE) *
      seasonGamesWeight;
    // Mild trust boost for goalies with stronger season sample.
    score += GOALIE_SEASON_GAMES_PLAYED_WEIGHT * seasonGamesWeight;

    // Back-to-back: goalie from game 1 is heavily discounted for game 2.
    if (playedYesterday) {
      score -= B2B_REPEAT_STARTER_PENALTY;
    } else if (isB2B && previousStarter != null) {
      score += B2B_ALTERNATE_GOALIE_BOOST;
    }

    // Weaker teams on B2B tend to lean backup usage.
    if (isB2B && teamIsWeaker && isPrimary) {
      score -= WEAKER_TEAM_B2B_PRIMARY_PENALTY;
    }
    if (isB2B && teamIsWeaker && !isPrimary) {
      score += WEAKER_TEAM_B2B_BACKUP_BOOST;
    }

    // Starter on a soft matchup can be rested for backup.
    if (opponentIsWeak && isPrimary) {
      score -= WEAK_OPPONENT_PRIMARY_REST_PENALTY;
    }
    if (opponentIsWeak && !isPrimary) {
      score += WEAK_OPPONENT_BACKUP_BOOST;
    }

    // Recency guardrail: goalies inactive for long stretches should be near-eliminated.
    if (daysSinceLastPlayed > GOALIE_STALE_HARD_DAYS) score -= 6;
    else if (daysSinceLastPlayed > GOALIE_STALE_SOFT_DAYS) score -= 3;
    else if (daysSinceLastPlayed > 14) score -= 0.8;
    if (daysSinceLastPlayed <= 7) score += 0.2;

    return { goalieId, score, daysSinceLastPlayed, lastPlayed };
  });

  if (scores.length === 2) {
    const [a, b] = scores;
    const pA = clamp(sigmoid(a.score - b.score), 0.02, 0.98);
    probs.set(a.goalieId, pA);
    probs.set(b.goalieId, 1 - pA);
    return probs;
  }

  const maxScore = Math.max(...scores.map((s) => s.score));
  const exps = scores.map((s) => Math.exp(s.score - maxScore));
  const denom = exps.reduce((acc, v) => acc + v, 0) || 1;
  scores.forEach((s, i) => {
    probs.set(s.goalieId, clamp(exps[i] / denom, 0.01, 0.98));
  });
  return probs;
}

export function buildTopStarterScenarios(opts: {
  probabilitiesByGoalieId: Map<number, number>;
  maxScenarios?: number;
}): StarterScenario[] {
  const maxScenarios = Number.isFinite(opts.maxScenarios)
    ? Math.max(1, Number(opts.maxScenarios))
    : 2;
  const ranked = Array.from(opts.probabilitiesByGoalieId.entries())
    .filter(([goalieId, probability]) => Number.isFinite(goalieId) && Number.isFinite(probability))
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxScenarios);
  if (ranked.length === 0) return [];

  const rawMass = ranked.reduce((sum, [, probability]) => sum + Math.max(0, probability), 0);
  const denom = rawMass > 0 ? rawMass : ranked.length;
  return ranked.map(([goalieId, rawProbability], idx) => ({
    goalieId,
    rawProbability,
    probability: clamp(Math.max(0, rawProbability) / denom, 0, 1),
    rank: idx + 1
  }));
}

export async function runProjectionV2ForDate(
  asOfDate: string,
  opts?: RunProjectionOptions
): Promise<RunProjectionResult> {
  assertSupabase();
  const runId = await createRun(asOfDate);

  const metrics: Record<string, any> = {
    as_of_date: asOfDate,
    horizon_games: clampHorizonGames(opts?.horizonGames ?? 1),
    started_at: new Date().toISOString(),
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
      assist_rate_recent_share: 0
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
      toi_scale_max: null as number | null
    },
    warnings: [] as string[]
  };

  try {
    const horizonGames = clampHorizonGames(opts?.horizonGames ?? 1);
    const teamDateKey = (teamId: number) => `${teamId}:${asOfDate}`;
    const playerDateKey = (playerId: number) => `${playerId}:${asOfDate}`;
    const currentSeasonId = await fetchCurrentSeasonIdForDate(asOfDate);
    const { data: games, error: gamesErr } = await supabase
      .from("games")
      .select("id,date,homeTeamId,awayTeamId")
      .eq("date", asOfDate);
    if (gamesErr) throw gamesErr;

    const teamStrengthCache = new Map<string, TeamStrengthAverages>();
    const { startTs, endTs } = toDayBoundsUtc(asOfDate);

    const teamIds = Array.from(
      new Set(
        ((games ?? []) as GameRow[])
          .flatMap((g) => [g.homeTeamId, g.awayTeamId])
          .filter((n) => n != null)
      )
    );
    const teamAbbreviationById = await fetchTeamAbbreviationMap(teamIds);

    const playerAvailabilityMultiplier = new Map<number, number>();
    const availabilityEventByPlayer = new Map<number, RosterEventRow>();
    const activeRosterSkaterIdsByTeamId = new Map<number, number[]>();
    const goalieEvidenceCache = new Map<string, GoalieEvidence>();
    const goalieOverrideByTeamId = new Map<
      number,
      { goalieId: number; starterProb: number }
    >();
    const learningCounters = {
      players: 0,
      goalRecent: 0,
      assistRecent: 0
    };

    if (teamIds.length > 0) {
      const { data: events, error: evErr } = await supabase
        .from("forge_roster_events")
        .select(
          "event_id,team_id,player_id,event_type,confidence,payload,effective_from,effective_to"
        )
        .in("team_id", teamIds)
        .lte("effective_from", endTs)
        .order("effective_from", { ascending: false })
        .limit(5000);
      if (evErr) throw evErr;

      const bestAvailabilityEventByPlayer = new Map<number, RosterEventRow>();

      for (const e of (events ?? []) as any[]) {
        const row = e as RosterEventRow;
        if (row.effective_to != null && row.effective_to < startTs) continue;
        if (row.player_id != null) {
          const mult = availabilityMultiplierForEvent(
            row.event_type,
            row.confidence
          );
          if (mult != null) {
            const existing = bestAvailabilityEventByPlayer.get(row.player_id);
            if (!existing || row.effective_from > existing.effective_from) {
              bestAvailabilityEventByPlayer.set(row.player_id, row);
            }
          }
        }

        if (
          row.team_id != null &&
          row.player_id != null &&
          (row.event_type === "GOALIE_START_CONFIRMED" ||
            row.event_type === "GOALIE_START_LIKELY")
        ) {
          const starterProb =
            row.event_type === "GOALIE_START_CONFIRMED"
              ? 1
              : clamp(row.confidence ?? 0.75, 0.5, 1);
          const existing = goalieOverrideByTeamId.get(row.team_id);
          if (!existing || starterProb > existing.starterProb) {
            goalieOverrideByTeamId.set(row.team_id, {
              goalieId: row.player_id,
              starterProb
            });
          }
        }
      }

      for (const [playerId, ev] of bestAvailabilityEventByPlayer.entries()) {
        const mult = availabilityMultiplierForEvent(
          ev.event_type,
          ev.confidence
        );
        if (mult != null) {
          playerAvailabilityMultiplier.set(playerId, mult);
          availabilityEventByPlayer.set(playerId, ev);
        }
      }
    }

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
      if (!(await hasPbpGame(game.id)))
        metrics.data_quality.missing_pbp_games += 1;
      if (!(await hasShiftTotals(game.id)))
        metrics.data_quality.missing_shift_totals += 1;

      // Removed: const lineCombos = await fetchLineCombinations(game.id);
      // We now fetch per-team latest LCs inside the loop.

      const teamShotsByTeamId = new Map<
        number,
        { shotsEs: number; shotsPp: number }
      >();
      const teamGoalsByTeamId = new Map<number, number>();
      const fallbackGoalieByTeamId = new Map<number, number | null>();
      const teamGoalieStarterContextCache = new Map<string, TeamGoalieStarterContext>();
      const teamDefensiveEnvironmentCache = new Map<string, TeamDefensiveEnvironment>();
      const teamOffenseEnvironmentCache = new Map<string, TeamOffenseEnvironment>();
      const teamRestDaysCache = new Map<string, number | null>();
      const teamStrengthPriorCache = new Map<string, TeamStrengthPrior | null>();
      const teamFiveOnFiveProfileCache = new Map<string, TeamFiveOnFiveProfile | null>();
      const teamNstExpectedGoalsCache = new Map<
        string,
        TeamNstExpectedGoalsProfile | null
      >();
      const teamLineComboGoaliePriorCache = new Map<string, Map<number, number>>();
      const goalieWorkloadContextCache = new Map<string, GoalieWorkloadContext>();
      const goalieRestSplitProfileCache = new Map<string, GoalieRestSplitProfile | null>();
      const currentTeamGoalieIdsCache = new Map<string, Set<number>>();
      const goalieCandidates: Array<{
        teamId: number;
        opponentTeamId: number;
        candidateGoalieIds: number[];
        priorStartProbByGoalieId: Map<number, number>;
        lineComboPriorByGoalieId: Map<number, number>;
        projectedGsaaPer60ByGoalieId: Map<number, number>;
        seasonStartPctByGoalieId: Map<number, number>;
        seasonGamesPlayedByGoalieId: Map<number, number>;
        override: { goalieId: number; starterProb: number } | null;
      }> = [];

      for (const teamId of [game.homeTeamId, game.awayTeamId]) {
        if (Date.now() > deadlineMs) {
          timedOut = true;
          break gamesLoop;
        }

        // Use the most recent line combination for this team (prior to today).
        const lcContext = await fetchLatestLineCombinationForTeam(teamId, asOfDate);
        const lc = lcContext.lineCombination;
        const lcRecency = assessLineCombinationRecency({
          asOfDate,
          sourceGameDate: lcContext.sourceGameDate
        });

        const opponentTeamId =
          teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
        if (!teamHorizonScalarsCache.has(teamDateKey(teamId))) {
          teamHorizonScalarsCache.set(teamDateKey(teamId),
            await fetchTeamHorizonScalars(teamId, asOfDate, horizonGames)
          );
        }
        const teamHorizonScalars = teamHorizonScalarsCache.get(teamDateKey(teamId)) ?? [1];
        const teamHorizonTotalScalar = teamHorizonScalars.reduce((sum, v) => sum + v, 0);
        if (lcRecency.isSoftStale && !lcRecency.isHardStale) {
          metrics.data_quality.stale_line_combos_soft += 1;
          metrics.warnings.push(
            `stale lineCombinations for game=${game.id} team=${teamId}; source_date=${lcContext.sourceGameDate ?? "none"} days_stale=${lcRecency.daysStale ?? "unknown"}`
          );
        }
        if (lcRecency.isHardStale) {
          metrics.data_quality.stale_line_combos_hard += 1;
        }

        let rawSkaterIds = (
          lc
            ? [...(lc.forwards ?? []), ...(lc.defensemen ?? [])]
            : []
        ).filter((n) => typeof n === "number");
        if (!activeRosterSkaterIdsByTeamId.has(teamId)) {
          activeRosterSkaterIdsByTeamId.set(
            teamId,
            await fetchActiveRosterSkaterIdsForTeamSeason(
              teamId,
              currentSeasonId,
              SKATER_POOL_SUPPLEMENTAL_FETCH_COUNT
            )
          );
        }
        const activeRosterSkaterIds =
          activeRosterSkaterIdsByTeamId.get(teamId) ?? [];

        let usedLineComboFallback = false;
        let lineComboFallbackReason: "missing" | "hard_stale" | "empty" | null = null;
        let fallbackCandidateCount = 0;

        if (lcRecency.isMissing || lcRecency.isHardStale || rawSkaterIds.length === 0) {
          if (lcRecency.isMissing) metrics.data_quality.missing_line_combos += 1;
          const fallbackSkaterIds = await fetchFallbackSkaterIdsForTeam(
            teamId,
            asOfDate,
            18
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
              `lineCombinations fallback used for game=${game.id} team=${teamId}; reason=${lcRecency.isMissing ? "missing" : lcRecency.isHardStale ? "hard_stale" : "empty"} source_date=${lcContext.sourceGameDate ?? "none"} days_stale=${lcRecency.daysStale ?? "unknown"} fallback_count=${fallbackSkaterIds.length}`
            );
          } else {
            metrics.data_quality.line_combo_hard_failures += 1;
            metrics.warnings.push(
              `lineCombinations hard-failure for game=${game.id} team=${teamId}; no usable line combos or fallback skaters`
            );
            continue;
          }
        }
        rawSkaterIds = constrainSkaterIdsToActiveRoster({
          candidateSkaterIds: rawSkaterIds,
          activeRosterSkaterIds
        });

        let playerMetaById = await fetchPlayerMetaByIds(rawSkaterIds);
        let skaterRoleTags = buildSkaterRoleTags({
          lineCombination: lc,
          useFallbackRoles: usedLineComboFallback,
          fallbackRankedSkaterIds: rawSkaterIds,
          playerMetaById,
          teamId
        });
        let teamPositionFilteredSkaterIds = Array.from(new Set(rawSkaterIds)).filter(
          (playerId) => {
            const meta = playerMetaById.get(playerId);
            if (!meta) return false;
            return meta.position !== "G" && meta.team_id === teamId;
          }
        );

        let evRows = await fetchRollingRows(teamPositionFilteredSkaterIds, "ev", asOfDate);
        let ppRows = await fetchRollingRows(teamPositionFilteredSkaterIds, "pp", asOfDate);
        let evLatest = pickLatestByPlayer(evRows);
        let ppLatest = pickLatestByPlayer(ppRows);
        let latestMetricDateByPlayerId = new Map<number, string>();
        for (const playerId of teamPositionFilteredSkaterIds) {
          const evDate = evLatest.get(playerId)?.game_date ?? null;
          const ppDate = ppLatest.get(playerId)?.game_date ?? null;
          const latestDate =
            evDate && ppDate ? (evDate > ppDate ? evDate : ppDate) : evDate ?? ppDate;
          if (latestDate) latestMetricDateByPlayerId.set(playerId, latestDate);
        }

        let activeSkaterFilter = filterActiveSkaterCandidateIds({
          asOfDate,
          teamId,
          rawSkaterIds,
          playerMetaById,
          latestMetricDateByPlayerId
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
          (playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) <= 0
        );
        let skaterIds = activeSkaterFilter.eligibleSkaterIds.filter(
          (playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) > 0
        );

        if (skaterIds.length < SKATER_POOL_MIN_VALID_COUNT) {
          metrics.data_quality.skater_pool_recovery_attempts += 1;
          const supplementalFallbackSkaterIds = await fetchFallbackSkaterIdsForTeam(
            teamId,
            asOfDate,
            SKATER_POOL_SUPPLEMENTAL_FETCH_COUNT
          );
          const supplementalRosterSkaterIds = activeRosterSkaterIds;
          const mergedRawSkaterIds = mergeSkaterCandidatePoolForRecovery({
            baseSkaterIds: rawSkaterIds,
            supplementalSkaterIds: [
              ...supplementalFallbackSkaterIds,
              ...supplementalRosterSkaterIds
            ],
            targetCount: SKATER_POOL_SUPPLEMENTAL_FETCH_COUNT
          });
          const mergedConstrainedRawSkaterIds = constrainSkaterIdsToActiveRoster({
            candidateSkaterIds: mergedRawSkaterIds,
            activeRosterSkaterIds,
            fallbackCount: SKATER_POOL_SUPPLEMENTAL_FETCH_COUNT
          });
          const baseUniqueCount = Array.from(new Set(rawSkaterIds)).length;
          const mergedUniqueCount = Array.from(
            new Set(mergedConstrainedRawSkaterIds)
          ).length;
          if (mergedUniqueCount > baseUniqueCount) {
            const previousRawSkaterIds = new Set(rawSkaterIds);
            rawSkaterIds = mergedConstrainedRawSkaterIds;
            skaterPoolRecoverySupplementalAdded = rawSkaterIds.filter(
              (id) => !previousRawSkaterIds.has(id)
            ).length;

            playerMetaById = await fetchPlayerMetaByIds(rawSkaterIds);
            const roleTagsFromSource = buildSkaterRoleTags({
              lineCombination: lc,
              useFallbackRoles: usedLineComboFallback,
              fallbackRankedSkaterIds: rawSkaterIds,
              playerMetaById,
              teamId
            });
            const fallbackRecoveryRoleTags = buildSkaterRoleTags({
              lineCombination: null,
              useFallbackRoles: true,
              fallbackRankedSkaterIds: rawSkaterIds,
              playerMetaById,
              teamId
            });
            skaterRoleTags = roleTagsFromSource;
            for (const [playerId, roleTag] of fallbackRecoveryRoleTags.entries()) {
              if (!skaterRoleTags.has(playerId)) {
                skaterRoleTags.set(playerId, roleTag);
              }
            }
            teamPositionFilteredSkaterIds = Array.from(new Set(rawSkaterIds)).filter(
              (playerId) => {
                const meta = playerMetaById.get(playerId);
                if (!meta) return false;
                return meta.position !== "G" && meta.team_id === teamId;
              }
            );

            evRows = await fetchRollingRows(teamPositionFilteredSkaterIds, "ev", asOfDate);
            ppRows = await fetchRollingRows(teamPositionFilteredSkaterIds, "pp", asOfDate);
            evLatest = pickLatestByPlayer(evRows);
            ppLatest = pickLatestByPlayer(ppRows);
            latestMetricDateByPlayerId = new Map<number, string>();
            for (const playerId of teamPositionFilteredSkaterIds) {
              const evDate = evLatest.get(playerId)?.game_date ?? null;
              const ppDate = ppLatest.get(playerId)?.game_date ?? null;
              const latestDate =
                evDate && ppDate
                  ? (evDate > ppDate ? evDate : ppDate)
                  : evDate ?? ppDate;
              if (latestDate) latestMetricDateByPlayerId.set(playerId, latestDate);
            }
            activeSkaterFilter = filterActiveSkaterCandidateIds({
              asOfDate,
              teamId,
              rawSkaterIds,
              playerMetaById,
              latestMetricDateByPlayerId
            });
            unavailableSkaters = activeSkaterFilter.eligibleSkaterIds.filter(
              (playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) <= 0
            );
            skaterIds = activeSkaterFilter.eligibleSkaterIds.filter(
              (playerId) => (playerAvailabilityMultiplier.get(playerId) ?? 1) > 0
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
                !skaterIds.includes(playerId)
            );
          const emergencyNeeded = Math.max(0, SKATER_POOL_TARGET_COUNT - skaterIds.length);
          if (emergencyNeeded > 0 && missingMetricEmergencyCandidates.length > 0) {
            const emergencyAddedIds = missingMetricEmergencyCandidates.slice(
              0,
              emergencyNeeded
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
            skaterPoolRecoverySupplementalAdded + skaterPoolRecoveryEmergencyIncluded;
          if (skaterIds.length >= SKATER_POOL_MIN_VALID_COUNT) {
            metrics.data_quality.skater_pool_recovery_restored += 1;
          } else {
            metrics.data_quality.skater_pool_recovery_failed += 1;
          }
          metrics.warnings.push(
            `skater pool recovery used for game=${game.id} team=${teamId}; path=${skaterPoolRecoveryPath} supplemental_added=${skaterPoolRecoverySupplementalAdded} missing_metrics_added=${skaterPoolRecoveryEmergencyIncluded} final_active_count=${skaterIds.length}`
          );
        }

        if (
          usedLineComboFallback &&
          activeSkaterFilter.eligibleSkaterIds.length === 0
        ) {
          metrics.data_quality.line_combo_hard_failures += 1;
          metrics.warnings.push(
            `lineCombinations fallback produced no active skaters for game=${game.id} team=${teamId}`
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
        metrics.data_quality.skater_unavailable_filtered += unavailableSkaters.length;
        const emergencyMissingMetricSkaterIdSet = new Set(
          activeSkaterFilter.excludedSkaterIdsByReason.missingRecentMetrics.filter((id) =>
            skaterIds.includes(id)
          )
        );

        if (skaterIds.length === 0) {
          metrics.warnings.push(
            `empty skaterIds for game=${game.id} team=${teamId}`
          );
          metrics.data_quality.empty_skater_rosters += 1;
          continue;
        }
        const teamAbbrev = teamAbbreviationById.get(teamId) ?? null;
        const opponentAbbrev = teamAbbreviationById.get(opponentTeamId) ?? null;
        if (!teamStrengthPriorCache.has(teamDateKey(teamId))) {
          teamStrengthPriorCache.set(teamDateKey(teamId),
            teamAbbrev
              ? await fetchTeamStrengthPrior(teamAbbrev, asOfDate)
              : null
          );
        }
        if (!teamStrengthPriorCache.has(teamDateKey(opponentTeamId))) {
          teamStrengthPriorCache.set(teamDateKey(opponentTeamId),
            opponentAbbrev
              ? await fetchTeamStrengthPrior(opponentAbbrev, asOfDate)
              : null
          );
        }
        if (!teamFiveOnFiveProfileCache.has(teamDateKey(teamId))) {
          teamFiveOnFiveProfileCache.set(teamDateKey(teamId),
            await fetchTeamFiveOnFiveProfile(teamId, asOfDate)
          );
        }
        if (!teamFiveOnFiveProfileCache.has(teamDateKey(opponentTeamId))) {
          teamFiveOnFiveProfileCache.set(teamDateKey(opponentTeamId),
            await fetchTeamFiveOnFiveProfile(opponentTeamId, asOfDate)
          );
        }
        if (!teamNstExpectedGoalsCache.has(teamDateKey(teamId))) {
          teamNstExpectedGoalsCache.set(teamDateKey(teamId),
            teamAbbrev
              ? await fetchTeamNstExpectedGoalsProfile(teamAbbrev, asOfDate)
              : null
          );
        }
        if (!teamNstExpectedGoalsCache.has(teamDateKey(opponentTeamId))) {
          teamNstExpectedGoalsCache.set(teamDateKey(opponentTeamId),
            opponentAbbrev
              ? await fetchTeamNstExpectedGoalsProfile(opponentAbbrev, asOfDate)
              : null
          );
        }
        const teamLevelContextAdjustment = computeSkaterTeamLevelContextAdjustments({
          teamStrengthPrior: teamStrengthPriorCache.get(teamDateKey(teamId)) ?? null,
          opponentStrengthPrior: teamStrengthPriorCache.get(teamDateKey(opponentTeamId)) ?? null,
          teamFiveOnFiveProfile: teamFiveOnFiveProfileCache.get(teamDateKey(teamId)) ?? null,
          opponentFiveOnFiveProfile:
            teamFiveOnFiveProfileCache.get(teamDateKey(opponentTeamId)) ?? null,
          teamNstProfile: teamNstExpectedGoalsCache.get(teamDateKey(teamId)) ?? null,
          opponentNstProfile: teamNstExpectedGoalsCache.get(teamDateKey(opponentTeamId)) ?? null
        });
        if (teamLevelContextAdjustment.sampleWeight > 0) {
          metrics.data_quality.team_level_context_teams_with_signal += 1;
          metrics.data_quality.team_level_context_adjustments_applied += 1;
        }
        const opponentGoalieContext = await fetchOpponentGoalieContextForGame({
          gameId: game.id,
          opponentTeamId
        });
        if (opponentGoalieContext != null) {
          metrics.data_quality.opponent_goalie_context_profiles_found += 1;
        }
        const opponentGoalieContextAdjustment =
          computeSkaterOpponentGoalieContextAdjustments({
            context: opponentGoalieContext
          });
        if (opponentGoalieContextAdjustment.sampleWeight > 0) {
          metrics.data_quality.opponent_goalie_context_adjustments_applied += 1;
        }
        if (!teamRestDaysCache.has(teamDateKey(teamId))) {
          teamRestDaysCache.set(teamDateKey(teamId), await fetchTeamRestDays(teamId, asOfDate));
        }
        if (!teamRestDaysCache.has(teamDateKey(opponentTeamId))) {
          teamRestDaysCache.set(teamDateKey(opponentTeamId),
            await fetchTeamRestDays(opponentTeamId, asOfDate)
          );
        }
        const restScheduleAdjustment = computeSkaterRestScheduleAdjustments({
          teamRestDays: teamRestDaysCache.get(teamDateKey(teamId)) ?? null,
          opponentRestDays: teamRestDaysCache.get(teamDateKey(opponentTeamId)) ?? null,
          isHome: teamId === game.homeTeamId
        });
        if (restScheduleAdjustment.sampleWeight > 0) {
          metrics.data_quality.rest_schedule_teams_with_signal += 1;
          metrics.data_quality.rest_schedule_adjustments_applied += 1;
        }
        const deploymentPriorByPlayerId =
          await fetchLatestWgoSkaterDeploymentProfiles(skaterIds, asOfDate);
        const shotQualityByPlayerId = await fetchLatestSkaterShotQualityProfiles(
          skaterIds,
          asOfDate
        );
        const onIceContextByPlayerId = await fetchLatestSkaterOnIceContextProfiles(
          skaterIds,
          asOfDate
        );
        const trendAdjustmentByPlayerId =
          await fetchLatestSkaterTrendAdjustments(skaterIds, asOfDate);
        metrics.data_quality.deployment_prior_profiles_found +=
          deploymentPriorByPlayerId.size;
        metrics.data_quality.shot_quality_profiles_found +=
          shotQualityByPlayerId.size;
        metrics.data_quality.on_ice_context_profiles_found +=
          onIceContextByPlayerId.size;
        if (!teamSkaterRoleHistoryCache.has(teamDateKey(teamId))) {
          teamSkaterRoleHistoryCache.set(teamDateKey(teamId),
            await fetchTeamSkaterRoleHistory(teamId, asOfDate)
          );
        }
        const roleHistoryByPlayerId =
          teamSkaterRoleHistoryCache.get(teamDateKey(teamId)) ?? new Map<number, string[]>();

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
            !ev &&
            !pp &&
            emergencyMissingMetricSkaterIdSet.has(playerId);
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
            safeNumber(ev?.toi_seconds_avg_all, 700)
          );
          const toiPp = safeNumber(
            pp?.toi_seconds_avg_last5,
            safeNumber(pp?.toi_seconds_avg_all, 120)
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
              rollingWeight: toiRollingWeightEs
            }) ?? toiEs;
          const blendedToiPp =
            blendToiSecondsWithDeploymentPrior({
              rollingSeconds: toiPp,
              deploymentPriorSeconds: toiPpDeploymentPrior,
              rollingWeight: toiRollingWeightPp
            }) ?? toiPp;
          const adjustedToiEs = clamp(
            blendedToiEs * restScheduleAdjustment.toiMultiplier,
            0,
            2600
          );
          const adjustedToiPp = clamp(
            blendedToiPp * restScheduleAdjustment.toiMultiplier,
            0,
            1300
          );
          if (toiEsDeploymentPrior != null || toiPpDeploymentPrior != null) {
            metrics.data_quality.deployment_prior_toi_blends_applied += 1;
          }
          const sampleShrinkage = computeSkaterSampleShrinkageAdjustments({
            evToiSecondsAll: finiteOrNull(ev?.toi_seconds_avg_all),
            ppToiSecondsAll: finiteOrNull(pp?.toi_seconds_avg_all),
            evShotsAll: finiteOrNull(ev?.shots_total_all),
            ppShotsAll: finiteOrNull(pp?.shots_total_all)
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
            ).toFixed(3)
          );
          const shrunkToiPp = Number(
            (
              sampleWeight * adjustedToiPp +
              (1 - sampleWeight) * safeNumber(pp?.toi_seconds_avg_all, 120)
            ).toFixed(3)
          );
          const roleTag = skaterRoleTags.get(playerId) ?? null;
          const shotQualityAdjustment =
            computeSkaterShotQualityAdjustments({ profile: shotQualityProfile });
          if (shotQualityProfile != null) {
            metrics.data_quality.shot_quality_adjustments_applied += 1;
          }
          const onIceContextAdjustment = computeSkaterOnIceContextAdjustments({
            profile: onIceContextProfile
          });
          if (onIceContextProfile != null) {
            metrics.data_quality.on_ice_context_adjustments_applied += 1;
          }

          const sogPer60EvRaw = safeNumber(
            ev?.sog_per_60_avg_last5,
            safeNumber(ev?.sog_per_60_avg_all, 6)
          );
          const sogPer60PpRaw = safeNumber(
            pp?.sog_per_60_avg_last5,
            safeNumber(pp?.sog_per_60_avg_all, 8)
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
            20
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
            28
          );
          const boundedUsage = applyRoleSpecificUsageBounds({
            roleTag,
            toiEsSeconds: shrunkToiEs,
            toiPpSeconds: shrunkToiPp,
            sogPer60Es: sogPer60EvPreBound,
            sogPer60Pp: sogPer60PpPreBound
          });
          if (boundedUsage.wasBounded) {
            metrics.data_quality.role_usage_bounds_applied += 1;
          }
          const boundedToiEs = boundedUsage.toiEsSeconds;
          const boundedToiPp = boundedUsage.toiPpSeconds;
          const sogPer60Ev = boundedUsage.sogPer60Es;
          const sogPer60Pp = boundedUsage.sogPer60Pp;

          const hitsPer60 = safeNumber(
            ev?.hits_per_60_avg_last5,
            safeNumber(ev?.hits_per_60_avg_all, 1)
          );
          const blocksPer60 = safeNumber(
            ev?.blocks_per_60_avg_last5,
            safeNumber(ev?.blocks_per_60_avg_all, 0.5)
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
              restScheduleAdjustment.assistRateMultiplier
          });
          const goalRateEs = clamp(
            splitRates.goalRateEs * sampleWeight + (1 - sampleWeight) * 0.095,
            0.025,
            0.3
          );
          const goalRatePp = clamp(
            splitRates.goalRatePp * sampleWeight + (1 - sampleWeight) * 0.145,
            0.04,
            0.45
          );
          const assistRateEs = clamp(
            splitRates.assistRateEs * sampleWeight + (1 - sampleWeight) * 0.72,
            0.2,
            1.7
          );
          const assistRatePp = clamp(
            splitRates.assistRatePp * sampleWeight + (1 - sampleWeight) * 0.95,
            0.3,
            2
          );

          const roleContinuity =
            roleTag != null
              ? summarizeSkaterRoleContinuity({
                  currentRole: roleTag.esRole,
                  recentRoles: roleHistoryByPlayerId.get(playerId) ?? []
                })
              : null;
          const roleStabilityMultiplier =
            roleContinuity != null
              ? computeSkaterRoleStabilityMultiplier(roleContinuity)
              : 1;
          const roleScenarios = buildSkaterRoleScenarios({
            roleTag,
            roleContinuity,
            maxScenarios: 3
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
          const trendAdjustment =
            trendAdjustmentByPlayerId.get(playerId) ?? null;
          const trendShotMultiplier = trendAdjustment?.shotRateMultiplier ?? 1;
          const trendGoalMultiplier = trendAdjustment?.goalRateMultiplier ?? 1;
          const trendAssistMultiplier =
            trendAdjustment?.assistRateMultiplier ?? 1;
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
            latestMetricDate,
            daysSinceLastMetric,
            recencyMultiplier,
            shotQualityProfileSourceDate:
              shotQualityProfile?.sourceDate ?? null,
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
            restScheduleOpponentRestDays:
              restScheduleAdjustment.opponentRestDays,
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
            trendAdjustment
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
          0
        );
        const preAllocationToiPp = Array.from(projected.values()).reduce(
          (acc, p) => acc + p.toiPp,
          0
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
                projectedSkaterCount
              );
        metrics.data_quality.skater_pool_projected_count_max =
          metrics.data_quality.skater_pool_projected_count_max == null
            ? projectedSkaterCount
            : Math.max(
                metrics.data_quality.skater_pool_projected_count_max,
                projectedSkaterCount
              );
        metrics.data_quality.skater_pool_projected_count_sum += projectedSkaterCount;
        if (projectedSkaterCount < SKATER_POOL_MIN_VALID_COUNT) {
          metrics.data_quality.skater_pool_underfilled_projected_teams += 1;
        }
        const guardedTeamToiTarget = computeSkaterTeamToiTargetWithPoolGuard({
          canonicalTargetSeconds: targetSkaterSecondsCanonical,
          projectedSkaterCount,
          ppShare
        });
        if (guardedTeamToiTarget.wasCapped) {
          metrics.data_quality.skater_pool_emergency_toi_target_caps_applied += 1;
          metrics.warnings.push(
            `skater pool emergency TOI cap for game=${game.id} team=${teamId}; projected_count=${projectedSkaterCount} canonical_target=${targetSkaterSecondsCanonical} capped_target=${guardedTeamToiTarget.targetSeconds}`
          );
        }
        const targetSkaterSeconds = guardedTeamToiTarget.targetSeconds;
        const toiPpTarget = Math.round(clamp(ppShare, 0, 0.5) * targetSkaterSeconds);
        const toiEsTarget = targetSkaterSeconds - toiPpTarget;

        const ppAllocation = allocatePpToiByTeamOpportunity({
          projectedByPlayer: new Map(
            Array.from(projected.entries()).map(([playerId, p]) => [
              playerId,
              { toiPp: p.toiPp, roleTag: p.roleTag }
            ])
          ),
          targetTeamPpSeconds: toiPpTarget
        });
        if (ppAllocation.perPlayerPpToiSeconds.size > 0) {
          metrics.data_quality.pp_opportunity_teams_modeled += 1;
          metrics.data_quality.pp_opportunity_players_reweighted +=
            ppAllocation.playersReweighted;
          for (const [
            playerId,
            allocatedPpToi
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
          0
        );
        const teamPpToiForCoupling = Array.from(projected.values()).reduce(
          (acc, p) => acc + p.toiPp,
          0
        );
        const lineGroupShotsEs = new Map<string, number>();
        for (const p of projected.values()) {
          const groupKey = roleGroupKeyForTeammateCoupling(p.roleTag);
          if (!groupKey) continue;
          lineGroupShotsEs.set(
            groupKey,
            (lineGroupShotsEs.get(groupKey) ?? 0) + p.shotsEs
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
            playerPpShare
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
            1.8
          );
          p.assistRatePp = clamp(
            p.assistRatePp * teammateCoupling.assistRatePpMultiplier,
            0.3,
            2.1
          );
          p.teammateAssistEsMultiplier =
            teammateCoupling.assistRateEsMultiplier;
          p.teammateAssistPpMultiplier =
            teammateCoupling.assistRatePpMultiplier;
          p.teammateDependencyScore = teammateCoupling.dependencyScore;
          projected.set(playerId, p);
        }

        const initialToiEs = Array.from(projected.values()).reduce(
          (acc, p) => acc + p.toiEs,
          0
        );
        const initialToiPp = Array.from(projected.values()).reduce(
          (acc, p) => acc + p.toiPp,
          0
        );
        const initialShotsEs = Array.from(projected.values()).reduce(
          (acc, p) => acc + p.shotsEs,
          0
        );
        const initialShotsPp = Array.from(projected.values()).reduce(
          (acc, p) => acc + p.shotsPp,
          0
        );

        const shotsEsTarget = safeNumber(
          strengthAverages.shotsEsAvg,
          initialShotsEs
        );
        const shotsPpTarget = safeNumber(
          strengthAverages.shotsPpAvg,
          initialShotsPp
        );

        const reconcileInputs = Array.from(projected.entries()).map(
          ([playerId, p]) => ({
            playerId,
            toiEsSeconds: p.toiEs,
            toiPpSeconds: p.toiPp,
            shotsEs: p.shotsEs,
            shotsPp: p.shotsPp
          })
        );
        const reconcileTargets = {
          toiEsSeconds: toiEsTarget,
          toiPpSeconds: toiPpTarget,
          shotsEs: shotsEsTarget,
          shotsPp: shotsPpTarget
        };
        const { players: reconciledPlayersRaw } = reconcileTeamToPlayers({
          players: reconcileInputs,
          targets: {
            toiEsSeconds: toiEsTarget,
            toiPpSeconds: toiPpTarget,
            shotsEs: shotsEsTarget,
            shotsPp: shotsPpTarget
          }
        });
        const reconciledValidation = validateReconciledPlayerDistribution({
          baselinePlayers: reconcileInputs,
          reconciledPlayers: reconciledPlayersRaw,
          targets: reconcileTargets
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
                reconciledValidation.topEsShareAfter
              );
        metrics.data_quality.reconciliation_top_pp_share_max =
          metrics.data_quality.reconciliation_top_pp_share_max == null
            ? reconciledValidation.topPpShareAfter
            : Math.max(
                metrics.data_quality.reconciliation_top_pp_share_max,
                reconciledValidation.topPpShareAfter
              );

        const totalToiBefore = initialToiEs + initialToiPp;
        const totalToiAfter = reconciledPlayers.reduce(
          (acc, p) => acc + p.toiEsSeconds + p.toiPpSeconds,
          0
        );
        const toiScale =
          totalToiBefore > 0 ? totalToiAfter / totalToiBefore : 1;

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
          assistsPp: 0
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
            roleContinuity: p.roleContinuity
          });
          if (p.roleScenarios.length > 0) {
            metrics.data_quality.role_scenario_blends_applied += 1;
            metrics.data_quality.role_scenario_horizon_games_modeled +=
              teamHorizonScalars.length;
          }
          const goalsEs = scenarioBlend.blended.goalsEs;
          const goalsPp = scenarioBlend.blended.goalsPp;
          const assistsEs = scenarioBlend.blended.assistsEs;
          const assistsPp = scenarioBlend.blended.assistsPp;

          const totalToiMinutes = (p.toiEs + p.toiPp) / 60;
          const projHits = (totalToiMinutes / 60) * p.hitsRate;
          const projBlocks = (totalToiMinutes / 60) * p.blocksRate;

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
              blocks: projBlocks
            },
            horizonGames,
            teamHorizonScalars,
            scenarioBlend.scenarioLines.map((s) => ({
              weight: s.probability,
              goalsEs: s.goalsEs,
              goalsPp: s.goalsPp,
              assistsEs: s.assistsEs,
              assistsPp: s.assistsPp,
              shotsEs,
              shotsPp
            })),
            p.trendAdjustment?.uncertaintyVolatilityMultiplier ?? 1
          );
          const scenarioMetadata = buildSkaterScenarioMetadata({
            scenarios: p.roleScenarios
          });
          const roleTag = p.roleTag;
          const uncertaintyWithRole = buildSkaterUncertaintyWithModel({
            uncertainty,
            model: {
              source: "heuristic_skater_role_model",
              skater_selection: {
                source: roleTag?.source ?? null,
                es_role: roleTag?.esRole ?? null,
                unit_tier: roleTag?.unitTier ?? null,
                role_rank: roleTag?.roleRank ?? null,
                used_line_combo_fallback: usedLineComboFallback,
                source_rows: {
                  line_combination_game_id: lc?.gameId ?? null,
                  line_combination_source_date:
                    lcContext.sourceGameDate ?? null,
                  roster_event_id: p.availabilityEvent?.event_id ?? null
                },
                fallback_path: {
                  used: usedLineComboFallback,
                  reason: lineComboFallbackReason,
                  fallback_candidate_count: fallbackCandidateCount
                },
                line_combo_recency: {
                  days_stale: lcRecency.daysStale,
                  class: lcRecency.isMissing
                    ? "MISSING"
                    : lcRecency.isHardStale
                      ? "HARD_STALE"
                      : lcRecency.isSoftStale
                        ? "SOFT_STALE"
                        : "FRESH"
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
                    no_ev_pp_gate: noMetricsPlayersSkipped
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
                    no_metrics_emergency_modeled:
                      noMetricsPlayersEmergencyIncluded
                  }
                },
                recency: {
                  latest_metric_date: p.latestMetricDate,
                  days_since_last_metric: p.daysSinceLastMetric,
                  recency_multiplier: Number(p.recencyMultiplier.toFixed(4))
                },
                trend_adjustment: {
                  applied: Boolean(p.trendAdjustment),
                  metric_key: p.trendAdjustment?.metricKey ?? null,
                  window_code: p.trendAdjustment?.windowCode ?? null,
                  snapshot_date: p.trendAdjustment?.snapshotDate ?? null,
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
                        ? Number(
                            p.trendAdjustment.shotRateMultiplier.toFixed(4)
                          )
                        : 1,
                    goal_rate:
                      p.trendAdjustment != null
                        ? Number(
                            p.trendAdjustment.goalRateMultiplier.toFixed(4)
                          )
                        : 1,
                    assist_rate:
                      p.trendAdjustment != null
                        ? Number(
                            p.trendAdjustment.assistRateMultiplier.toFixed(4)
                          )
                        : 1,
                    uncertainty_volatility:
                      p.trendAdjustment != null
                        ? Number(
                            p.trendAdjustment.uncertaintyVolatilityMultiplier.toFixed(
                              4
                            )
                          )
                        : 1
                  }
                },
                role_continuity: p.roleContinuity
                  ? {
                      window_games: p.roleContinuity.windowGames,
                      appearances_tracked: p.roleContinuity.appearancesTracked,
                      games_in_current_role:
                        p.roleContinuity.gamesInCurrentRole,
                      continuity_share: p.roleContinuity.continuityShare,
                      role_change_rate: p.roleContinuity.roleChangeRate,
                      volatility_index: p.roleContinuity.volatilityIndex,
                      stability_multiplier: p.roleStabilityMultiplier
                    }
                  : null,
                role_scenarios: {
                  top_probability: Number(
                    p.roleScenarioTopProbability.toFixed(4)
                  ),
                  scenario_metadata: {
                    model_version: scenarioMetadata.modelVersion,
                    scenario_count: scenarioMetadata.scenarioCount,
                    top_scenario_drivers:
                      scenarioMetadata.topScenarioDrivers.map((d) => ({
                        role: d.role,
                        probability: Number(d.probability.toFixed(4)),
                        source: d.source
                      }))
                  },
                  scenarios: p.roleScenarios.map((s) => ({
                    role: s.role,
                    probability: Number(s.probability.toFixed(4)),
                    source: s.source
                  })),
                  scenario_stat_lines: scenarioBlend.scenarioLines.map((s) => ({
                    role: s.role,
                    probability: Number(s.probability.toFixed(4)),
                    goals_es: Number(s.goalsEs.toFixed(4)),
                    goals_pp: Number(s.goalsPp.toFixed(4)),
                    assists_es: Number(s.assistsEs.toFixed(4)),
                    assists_pp: Number(s.assistsPp.toFixed(4))
                  })),
                  horizon_summaries: scenarioBlend.horizonScenarioSummaries.map(
                    (s) => ({
                      game_index: s.gameIndex,
                      top_role: s.topRole,
                      top_probability: Number(s.topProbability.toFixed(4))
                    })
                  )
                },
                availability: p.availabilityEvent
                  ? {
                      event_type: p.availabilityEvent.event_type,
                      confidence:
                        typeof p.availabilityEvent.confidence === "number" &&
                        Number.isFinite(p.availabilityEvent.confidence)
                          ? Number(p.availabilityEvent.confidence)
                          : null,
                      effective_from:
                        p.availabilityEvent.effective_from ?? null,
                      effective_to: p.availabilityEvent.effective_to ?? null,
                      event_multiplier: Number(
                        p.eventAvailabilityMultiplier.toFixed(4)
                      )
                    }
                  : null,
                shot_quality: {
                  source_date: p.shotQualityProfileSourceDate,
                  sample_weight: Number(p.shotQualitySampleWeight.toFixed(4)),
                  shot_rate_multiplier: Number(p.shotRateMultiplier.toFixed(4)),
                  goal_rate_multiplier: Number(p.goalRateMultiplier.toFixed(4)),
                  quality_per_shot: p.qualityPerShot,
                  rush_rebound_per_60: p.rushReboundPer60
                },
                on_ice_context: {
                  source_date: p.onIceContextSourceDate,
                  sample_weight: Number(p.onIceContextSampleWeight.toFixed(4)),
                  shot_environment_multiplier: Number(
                    p.shotEnvironmentMultiplier.toFixed(4)
                  ),
                  goal_environment_multiplier: Number(
                    p.goalEnvironmentMultiplier.toFixed(4)
                  ),
                  assist_environment_multiplier: Number(
                    p.assistEnvironmentMultiplier.toFixed(4)
                  ),
                  possession_pct: p.onIcePossessionPct
                },
                team_level_context: {
                  sample_weight: Number(p.teamLevelSampleWeight.toFixed(4)),
                  shot_rate_multiplier: Number(
                    p.teamLevelShotRateMultiplier.toFixed(4)
                  ),
                  goal_rate_multiplier: Number(
                    p.teamLevelGoalRateMultiplier.toFixed(4)
                  ),
                  assist_rate_multiplier: Number(
                    p.teamLevelAssistRateMultiplier.toFixed(4)
                  ),
                  pace_edge: Number(p.teamLevelPaceEdge.toFixed(4)),
                  opponent_defense_edge: Number(
                    p.teamLevelOpponentDefenseEdge.toFixed(4)
                  )
                },
                opponent_goalie_context: {
                  sample_weight: Number(
                    p.opponentGoalieSampleWeight.toFixed(4)
                  ),
                  goal_rate_multiplier: Number(
                    p.opponentGoalieGoalRateMultiplier.toFixed(4)
                  ),
                  assist_rate_multiplier: Number(
                    p.opponentGoalieAssistRateMultiplier.toFixed(4)
                  ),
                  weighted_projected_gsaa_per_60:
                    p.opponentGoalieWeightedGsaaPer60,
                  starter_certainty: Number(
                    p.opponentGoalieStarterCertainty.toFixed(4)
                  )
                },
                rest_schedule: {
                  sample_weight: Number(p.restScheduleSampleWeight.toFixed(4)),
                  team_rest_days: p.restScheduleTeamRestDays,
                  opponent_rest_days: p.restScheduleOpponentRestDays,
                  rest_delta: Number(p.restScheduleRestDelta.toFixed(4)),
                  toi_multiplier: Number(
                    p.restScheduleToiMultiplier.toFixed(4)
                  ),
                  shot_rate_multiplier: Number(
                    p.restScheduleShotRateMultiplier.toFixed(4)
                  ),
                  goal_rate_multiplier: Number(
                    p.restScheduleGoalRateMultiplier.toFixed(4)
                  ),
                  assist_rate_multiplier: Number(
                    p.restScheduleAssistRateMultiplier.toFixed(4)
                  )
                },
                small_sample: {
                  sample_weight: Number(p.smallSampleWeight.toFixed(4)),
                  is_low_sample: p.smallSampleIsLow,
                  used_callup_fallback: p.smallSampleUsedCallupFallback,
                  evidence_toi_seconds: Number(
                    p.smallSampleEvidenceToiSeconds.toFixed(3)
                  ),
                  evidence_shots: Number(p.smallSampleEvidenceShots.toFixed(3))
                },
                conversion_rates: {
                  goal_rate_es: Number(p.goalRateEs.toFixed(4)),
                  goal_rate_pp: Number(p.goalRatePp.toFixed(4)),
                  assist_rate_es: Number(p.assistRateEs.toFixed(4)),
                  assist_rate_pp: Number(p.assistRatePp.toFixed(4))
                },
                pp_opportunity: {
                  team_pp_target_seconds: p.ppOpportunityTeamTargetSeconds,
                  allocated_player_pp_share: p.ppOpportunityAllocatedShare
                },
                teammate_context: {
                  dependency_score: Number(
                    p.teammateDependencyScore.toFixed(4)
                  ),
                  assist_rate_es_multiplier: Number(
                    p.teammateAssistEsMultiplier.toFixed(4)
                  ),
                  assist_rate_pp_multiplier: Number(
                    p.teammateAssistPpMultiplier.toFixed(4)
                  )
                },
                role_usage_bounds: {
                  applied: p.roleUsageBoundsApplied,
                  bounded_sog_per_60_es: Number(p.boundedSogPer60Es.toFixed(3)),
                  bounded_sog_per_60_pp: Number(p.boundedSogPer60Pp.toFixed(3))
                }
              }
            }
          });

          playerUpserts.push({
            run_id: runId,
            as_of_date: asOfDate,
            horizon_games: horizonGames,
            game_id: game.id,
            player_id: playerId,
            team_id: teamId,
            opponent_team_id: opponentTeamId,
            proj_toi_es_seconds: Number((p.toiEs * teamHorizonTotalScalar).toFixed(3)),
            proj_toi_pp_seconds: Number((p.toiPp * teamHorizonTotalScalar).toFixed(3)),
            proj_toi_pk_seconds: null,
            proj_shots_es: Number((shotsEs * teamHorizonTotalScalar).toFixed(3)),
            proj_shots_pp: Number((shotsPp * teamHorizonTotalScalar).toFixed(3)),
            proj_shots_pk: null,
            proj_goals_es: Number((goalsEs * teamHorizonTotalScalar).toFixed(3)),
            proj_goals_pp: Number((goalsPp * teamHorizonTotalScalar).toFixed(3)),
            proj_goals_pk: null,
            proj_assists_es: Number((assistsEs * teamHorizonTotalScalar).toFixed(3)),
            proj_assists_pp: Number((assistsPp * teamHorizonTotalScalar).toFixed(3)),
            proj_assists_pk: null,
            proj_hits: Number((projHits * teamHorizonTotalScalar).toFixed(3)),
            proj_blocks: Number((projBlocks * teamHorizonTotalScalar).toFixed(3)),
            uncertainty: uncertaintyWithRole,
            updated_at: new Date().toISOString()
          });
        }

        const { error: playerErr } = await supabase
          .from("forge_player_projections")
          .upsert(playerUpserts, {
            onConflict: "run_id,game_id,player_id,horizon_games"
          });
        if (playerErr) throw playerErr;
        playerRowsUpserted += playerUpserts.length;

        const teamUpsert = {
          run_id: runId,
          as_of_date: asOfDate,
          horizon_games: horizonGames,
          game_id: game.id,
          team_id: teamId,
          opponent_team_id: opponentTeamId,
          proj_toi_es_seconds: Number(
            (teamTotals.toiEsSeconds * teamHorizonTotalScalar).toFixed(3)
          ),
          proj_toi_pp_seconds: Number(
            (teamTotals.toiPpSeconds * teamHorizonTotalScalar).toFixed(3)
          ),
          proj_toi_pk_seconds: null,
          proj_shots_es: Number((teamTotals.shotsEs * teamHorizonTotalScalar).toFixed(3)),
          proj_shots_pp: Number((teamTotals.shotsPp * teamHorizonTotalScalar).toFixed(3)),
          proj_shots_pk: null,
          proj_goals_es: Number((teamTotals.goalsEs * teamHorizonTotalScalar).toFixed(3)),
          proj_goals_pp: Number((teamTotals.goalsPp * teamHorizonTotalScalar).toFixed(3)),
          proj_goals_pk: null,
          uncertainty: buildTeamUncertainty({
            toiEsSeconds: teamTotals.toiEsSeconds,
            toiPpSeconds: teamTotals.toiPpSeconds,
            shotsEs: teamTotals.shotsEs,
            shotsPp: teamTotals.shotsPp,
            goalsEs: teamTotals.goalsEs,
            goalsPp: teamTotals.goalsPp
          }, horizonGames, teamHorizonScalars),
          updated_at: new Date().toISOString()
        };

        const { error: teamErr } = await supabase
          .from("forge_team_projections")
          .upsert(teamUpsert, {
            onConflict: "run_id,game_id,team_id,horizon_games"
          });
        if (teamErr) throw teamErr;
        teamRowsUpserted += 1;

        teamShotsByTeamId.set(teamId, {
          shotsEs: Number(teamUpsert.proj_shots_es ?? 0),
          shotsPp: Number(teamUpsert.proj_shots_pp ?? 0)
        });
        teamGoalsByTeamId.set(
          teamId,
          Number(
            ((teamTotals.goalsEs + teamTotals.goalsPp) * teamHorizonTotalScalar).toFixed(3)
          )
        );

        // Goalie: pick the highest probability starter from goalie_start_projections if available.
        const goalieOverride = goalieOverrideByTeamId.get(teamId);
        const { data: goalieStarts, error: gsErr } = await supabase
          .from("goalie_start_projections")
          .select(
            "player_id,start_probability,confirmed_status,l10_start_pct,season_start_pct,games_played,projected_gsaa_per_60"
          )
          .eq("game_id", game.id)
          .eq("team_id", teamId)
          .order("start_probability", { ascending: false })
          .limit(6);
        if (gsErr) throw gsErr;
        if (!fallbackGoalieByTeamId.has(teamId)) {
          fallbackGoalieByTeamId.set(
            teamId,
            await fetchLatestGoalieForTeam(teamId, asOfDate)
          );
        }
        const fallbackGoalieId = fallbackGoalieByTeamId.get(teamId) ?? null;
        if (!teamGoalieStarterContextCache.has(teamDateKey(teamId))) {
          teamGoalieStarterContextCache.set(teamDateKey(teamId),
            await fetchTeamGoalieStarterContext(teamId, asOfDate)
          );
        }
        if (!currentTeamGoalieIdsCache.has(teamDateKey(teamId))) {
          currentTeamGoalieIdsCache.set(teamDateKey(teamId),
            await fetchCurrentTeamGoalieIds(teamId)
          );
        }
        if (!teamLineComboGoaliePriorCache.has(teamDateKey(teamId))) {
          teamLineComboGoaliePriorCache.set(teamDateKey(teamId),
            await fetchTeamLineComboGoaliePrior(teamId, asOfDate)
          );
        }
        const context = teamGoalieStarterContextCache.get(teamDateKey(teamId)) as TeamGoalieStarterContext;
        const currentTeamGoalieIds = currentTeamGoalieIdsCache.get(teamDateKey(teamId)) as Set<number>;
        const lineComboPriorByGoalieId =
          teamLineComboGoaliePriorCache.get(teamDateKey(teamId)) ?? new Map<number, number>();

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
            clamp(Number((row as any)?.start_probability ?? 0.5), 0.01, 0.99)
          );
          confirmedStarterByGoalieId.set(
            goalieId,
            Boolean((row as any)?.confirmed_status)
          );
          const projectedGsaaPer60 = Number((row as any)?.projected_gsaa_per_60);
          if (Number.isFinite(projectedGsaaPer60)) {
            projectedGsaaPer60ByGoalieId.set(goalieId, projectedGsaaPer60);
          }
          const seasonStartPct = Number((row as any)?.season_start_pct);
          if (Number.isFinite(seasonStartPct)) {
            seasonStartPctByGoalieId.set(
              goalieId,
              clamp(seasonStartPct, 0, 1)
            );
          }
          const gamesPlayed = Number((row as any)?.games_played);
          if (Number.isFinite(gamesPlayed) && gamesPlayed >= 0) {
            seasonGamesPlayedByGoalieId.set(goalieId, gamesPlayed);
          }
        }

        const contextGoalies = Array.from(context.startsByGoalie.keys()).slice(0, 4);
        const rawCandidateGoalieIds = Array.from(
          new Set(
            [
              goalieOverride?.goalieId ?? null,
              ...(goalieStarts ?? []).map((r: any) => Number(r.player_id)),
              ...(lc?.goalies ?? []),
              ...contextGoalies,
              fallbackGoalieId
            ].filter((n): n is number => Number.isFinite(n))
          )
        );
        const candidateGoalieIds = selectStarterCandidateGoalieIds({
          asOfDate,
          rawCandidateGoalieIds,
          currentTeamGoalieIds,
          context,
          goalieOverrideGoalieId: goalieOverride?.goalieId ?? null,
          priorStartProbByGoalieId,
          confirmedStarterByGoalieId,
          limit: 3
        });

        if (candidateGoalieIds.length > 0) {
          goalieCandidates.push({
            teamId,
            opponentTeamId,
            candidateGoalieIds,
            priorStartProbByGoalieId,
            lineComboPriorByGoalieId,
            projectedGsaaPer60ByGoalieId,
            seasonStartPctByGoalieId,
            seasonGamesPlayedByGoalieId,
            override: goalieOverride ?? null
          });
        }
      }

      // Create goalie projections after both teams are projected so we can use opponent shots.
      for (const c of goalieCandidates) {
        if (Date.now() > deadlineMs) {
          timedOut = true;
          break gamesLoop;
        }
        const oppShots = teamShotsByTeamId.get(c.opponentTeamId);
        if (!oppShots) {
          metrics.warnings.push(
            `missing opponent shots for game=${game.id} team=${c.teamId}`
          );
          continue;
        }
        const opponentProjectedShotsAgainst = Number(
          (oppShots.shotsEs + oppShots.shotsPp).toFixed(3)
        );
        const defendingTeamAbbrev = teamAbbreviationById.get(c.teamId) ?? null;
        const opponentTeamAbbrev = teamAbbreviationById.get(c.opponentTeamId) ?? null;
        if (!teamStrengthPriorCache.has(teamDateKey(c.teamId))) {
          teamStrengthPriorCache.set(teamDateKey(c.teamId),
            defendingTeamAbbrev
              ? await fetchTeamStrengthPrior(defendingTeamAbbrev, asOfDate)
              : null
          );
        }
        if (!teamStrengthPriorCache.has(teamDateKey(c.opponentTeamId))) {
          teamStrengthPriorCache.set(teamDateKey(c.opponentTeamId),
            opponentTeamAbbrev
              ? await fetchTeamStrengthPrior(opponentTeamAbbrev, asOfDate)
              : null
          );
        }
        const defendingStrengthPrior = teamStrengthPriorCache.get(teamDateKey(c.teamId)) ?? null;
        const opponentStrengthPrior =
          teamStrengthPriorCache.get(teamDateKey(c.opponentTeamId)) ?? null;
        const teamStrengthContextAdjustment = computeTeamStrengthContextAdjustment({
          defendingTeamPrior: defendingStrengthPrior,
          opponentTeamPrior: opponentStrengthPrior
        });
        if (!teamFiveOnFiveProfileCache.has(teamDateKey(c.teamId))) {
          teamFiveOnFiveProfileCache.set(teamDateKey(c.teamId),
            await fetchTeamFiveOnFiveProfile(c.teamId, asOfDate)
          );
        }
        if (!teamFiveOnFiveProfileCache.has(teamDateKey(c.opponentTeamId))) {
          teamFiveOnFiveProfileCache.set(teamDateKey(c.opponentTeamId),
            await fetchTeamFiveOnFiveProfile(c.opponentTeamId, asOfDate)
          );
        }
        const defendingFiveOnFiveProfile =
          teamFiveOnFiveProfileCache.get(teamDateKey(c.teamId)) ?? null;
        const opponentFiveOnFiveProfile =
          teamFiveOnFiveProfileCache.get(teamDateKey(c.opponentTeamId)) ?? null;
        const teamFiveOnFiveContextAdjustment =
          computeTeamFiveOnFiveContextAdjustment({
            defendingTeamProfile: defendingFiveOnFiveProfile,
            opponentTeamProfile: opponentFiveOnFiveProfile
          });
        if (!teamNstExpectedGoalsCache.has(teamDateKey(c.teamId))) {
          teamNstExpectedGoalsCache.set(teamDateKey(c.teamId),
            defendingTeamAbbrev
              ? await fetchTeamNstExpectedGoalsProfile(defendingTeamAbbrev, asOfDate)
              : null
          );
        }
        if (!teamNstExpectedGoalsCache.has(teamDateKey(c.opponentTeamId))) {
          teamNstExpectedGoalsCache.set(teamDateKey(c.opponentTeamId),
            opponentTeamAbbrev
              ? await fetchTeamNstExpectedGoalsProfile(opponentTeamAbbrev, asOfDate)
              : null
          );
        }
        const defendingNstExpectedGoalsProfile =
          teamNstExpectedGoalsCache.get(teamDateKey(c.teamId)) ?? null;
        const opponentNstExpectedGoalsProfile =
          teamNstExpectedGoalsCache.get(teamDateKey(c.opponentTeamId)) ?? null;
        const nstOpponentDangerAdjustment = computeNstOpponentDangerAdjustment({
          defendingTeamProfile: defendingNstExpectedGoalsProfile,
          opponentTeamProfile: opponentNstExpectedGoalsProfile
        });
        if (!teamDefensiveEnvironmentCache.has(teamDateKey(c.teamId))) {
          teamDefensiveEnvironmentCache.set(teamDateKey(c.teamId),
            await fetchTeamDefensiveEnvironment(c.teamId, asOfDate)
          );
        }
        const defensiveEnv = teamDefensiveEnvironmentCache.get(teamDateKey(c.teamId)) as TeamDefensiveEnvironment;
        const teamSaAvg10 = defensiveEnv.avgShotsAgainstLast10;
        const teamSaAvg5 = defensiveEnv.avgShotsAgainstLast5;
        const trendAdj =
          teamSaAvg10 != null && teamSaAvg5 != null
            ? clamp((teamSaAvg5 - teamSaAvg10) * 0.25, -3, 3)
            : 0;
        const blendedShotsAgainst =
          teamSaAvg10 != null
            ? 0.65 * opponentProjectedShotsAgainst + 0.35 * teamSaAvg10 + trendAdj
            : opponentProjectedShotsAgainst;
        const adjustedBaseShotsAgainst = blendedShotsAgainst * (
          1 + teamStrengthContextAdjustment.shotsAgainstPctAdjustment
        );
        const baseShotsAgainst = Number(Math.max(0, adjustedBaseShotsAgainst).toFixed(3));
        const teamGoalsFor = teamGoalsByTeamId.get(c.teamId) ?? 0;
        if (!teamOffenseEnvironmentCache.has(teamDateKey(c.opponentTeamId))) {
          teamOffenseEnvironmentCache.set(teamDateKey(c.opponentTeamId),
            await fetchTeamOffenseEnvironment(c.opponentTeamId, asOfDate)
          );
        }
        if (!teamRestDaysCache.has(teamDateKey(c.teamId))) {
          teamRestDaysCache.set(teamDateKey(c.teamId), await fetchTeamRestDays(c.teamId, asOfDate));
        }
        if (!teamRestDaysCache.has(teamDateKey(c.opponentTeamId))) {
          teamRestDaysCache.set(teamDateKey(c.opponentTeamId),
            await fetchTeamRestDays(c.opponentTeamId, asOfDate)
          );
        }
        const opponentOffense = teamOffenseEnvironmentCache.get(teamDateKey(c.opponentTeamId)) as TeamOffenseEnvironment;
        const defendingRestDays = teamRestDaysCache.get(teamDateKey(c.teamId)) ?? null;
        const opponentRestDays = teamRestDaysCache.get(teamDateKey(c.opponentTeamId)) ?? null;
        const opponentIsHome = c.opponentTeamId === game.homeTeamId;

        const oppShots10 = opponentOffense.avgShotsForLast10;
        const oppShots5 = opponentOffense.avgShotsForLast5;
        const oppGoals10 = opponentOffense.avgGoalsForLast10;
        const oppGoals5 = opponentOffense.avgGoalsForLast5;
        const shotsTrendPct =
          baseShotsAgainst > 0 && oppShots5 != null
            ? clamp((oppShots5 - baseShotsAgainst) / baseShotsAgainst, -0.12, 0.18)
            : 0;
        const goalsTrendPct =
          oppGoals10 != null && oppGoals5 != null && oppGoals10 > 0
            ? clamp((oppGoals5 - oppGoals10) / oppGoals10, -0.1, 0.15)
            : 0;

        let contextPct = 0;
        contextPct += shotsTrendPct * 0.45;
        contextPct += goalsTrendPct * 0.35;
        if (opponentRestDays != null && opponentRestDays >= 2) contextPct += OPPONENT_RESTED_BOOST;
        if (opponentRestDays === 1) contextPct -= OPPONENT_B2B_PENALTY;
        if (defendingRestDays === 1) contextPct += DEFENSE_B2B_FATIGUE_BOOST;
        contextPct += opponentIsHome ? OPPONENT_HOME_BOOST : -OPPONENT_AWAY_PENALTY;
        contextPct += teamFiveOnFiveContextAdjustment.contextPctAdjustment;
        contextPct += nstOpponentDangerAdjustment.contextPctAdjustment;
        contextPct = clamp(contextPct, -0.15, 0.2);

        const shotsAgainst = Number(
          Math.max(0, baseShotsAgainst * (1 + contextPct)).toFixed(3)
        );
        const leagueSavePct = clamp(
          0.9 -
            contextPct * 0.04 +
            teamFiveOnFiveContextAdjustment.leagueSavePctAdjustment,
          0.88,
          0.92
        );
        const adjustedTeamGoalsFor = Number(
          Math.max(
            0,
            teamGoalsFor * (1 + teamStrengthContextAdjustment.teamGoalsForPctAdjustment)
          ).toFixed(3)
        );

        let selectedGoalieId: number | null = null;
        let starterProb = 0.5;
        let starterModelMeta: Record<string, unknown> = {};
        let topStarterScenarios: StarterScenario[] = [];
        if (c.override) {
          selectedGoalieId = c.override.goalieId;
          starterProb = c.override.starterProb;
          topStarterScenarios = [
            {
              goalieId: selectedGoalieId,
              rank: 1,
              rawProbability: starterProb,
              probability: 1
            }
          ];
          starterModelMeta = buildStarterOverrideMetadata({
            selectedGoalieId,
            starterProb,
            topStarterScenarios
          });
        } else {
          const starterContext =
            teamGoalieStarterContextCache.get(teamDateKey(c.teamId)) ??
            (await fetchTeamGoalieStarterContext(c.teamId, asOfDate));
          teamGoalieStarterContextCache.set(teamDateKey(c.teamId), starterContext);
          const opponentGoalsForRaw = teamGoalsByTeamId.get(c.opponentTeamId) ?? 0;
          const opponentGoalsFor = Number(
            Math.max(
              0,
              opponentGoalsForRaw *
                (1 + teamStrengthContextAdjustment.opponentGoalsForPctAdjustment)
            ).toFixed(3)
          );
          const teamIsWeaker =
            adjustedTeamGoalsFor + TEAM_STRENGTH_WEAKER_GAP < opponentGoalsFor;
          const opponentIsWeak = opponentGoalsFor <= WEAK_OPPONENT_GF_THRESHOLD;
          const isB2B =
            starterContext.previousGameDate != null &&
            daysBetweenDates(asOfDate, starterContext.previousGameDate) === 1;
          const probs = computeStarterProbabilities({
            asOfDate,
            candidateGoalieIds: c.candidateGoalieIds,
            starterContext,
            priorStartProbByGoalieId: c.priorStartProbByGoalieId,
            lineComboPriorByGoalieId: c.lineComboPriorByGoalieId,
            projectedGsaaPer60ByGoalieId: c.projectedGsaaPer60ByGoalieId,
            seasonStartPctByGoalieId: c.seasonStartPctByGoalieId,
            seasonGamesPlayedByGoalieId: c.seasonGamesPlayedByGoalieId,
            teamGoalsFor: adjustedTeamGoalsFor,
            opponentGoalsFor
          });
          const ranked = Array.from(probs.entries()).sort((a, b) => b[1] - a[1]);
          topStarterScenarios = buildTopStarterScenarios({
            probabilitiesByGoalieId: probs,
            maxScenarios: 2
          });
          if (ranked.length > 0) {
            selectedGoalieId = ranked[0][0];
            starterProb = ranked[0][1];
          }
          starterModelMeta = buildStarterHeuristicMetadata({
            asOfDate,
            selectedGoalieId,
            starterProb,
            rankedGoalies: ranked,
            topStarterScenarios,
            starterContext,
            priorMaps: {
              projectedGsaaPer60ByGoalieId: c.projectedGsaaPer60ByGoalieId,
              seasonStartPctByGoalieId: c.seasonStartPctByGoalieId,
              seasonGamesPlayedByGoalieId: c.seasonGamesPlayedByGoalieId,
              lineComboPriorByGoalieId: c.lineComboPriorByGoalieId
            },
            daysBetweenDates,
            isBackToBack: isB2B,
            teamIsWeaker,
            opponentIsWeak,
            opponentProjectedShotsAgainst,
            teamSaAvg10,
            teamSaAvg5,
            trendAdj,
            teamStrengthContextAdjustment,
            teamFiveOnFiveContextAdjustment,
            nstOpponentDangerAdjustment,
            baseShotsAgainst,
            shotsAgainst,
            opponentContext: {
              opponentIsHome,
              oppShots10,
              oppShots5,
              oppGoals10,
              oppGoals5,
              defendingRestDays,
              opponentRestDays
            },
            defendingNstExpectedGoalsProfile,
            opponentNstExpectedGoalsProfile,
            defendingFiveOnFiveProfile,
            opponentFiveOnFiveProfile,
            defendingStrengthPrior,
            opponentStrengthPrior,
            teamGoalsFor,
            adjustedTeamGoalsFor,
            opponentGoalsFor,
            contextPct,
            leagueSavePct
          });
        }

        if (selectedGoalieId == null) continue;
        if (!goalieEvidenceCache.has(playerDateKey(selectedGoalieId))) {
          goalieEvidenceCache.set(playerDateKey(selectedGoalieId),
            await fetchGoalieEvidence(selectedGoalieId, asOfDate)
          );
        }
        if (!goalieWorkloadContextCache.has(playerDateKey(selectedGoalieId))) {
          goalieWorkloadContextCache.set(playerDateKey(selectedGoalieId),
            await fetchGoalieWorkloadContext(selectedGoalieId, asOfDate)
          );
        }
        if (!goalieRestSplitProfileCache.has(playerDateKey(selectedGoalieId))) {
          goalieRestSplitProfileCache.set(playerDateKey(selectedGoalieId),
            await fetchGoalieRestSplitProfile(selectedGoalieId, asOfDate)
          );
        }
        const evidence = goalieEvidenceCache.get(playerDateKey(selectedGoalieId)) as GoalieEvidence;
        const workload = goalieWorkloadContextCache.get(playerDateKey(selectedGoalieId)) as GoalieWorkloadContext;
        const restSplitProfile = goalieRestSplitProfileCache.get(playerDateKey(selectedGoalieId)) ?? null;
        const workloadSavePctPenalty = computeWorkloadSavePctPenalty(workload);
        const restSplitSavePctAdjustment = computeGoalieRestSplitSavePctAdjustment({
          profile: restSplitProfile,
          daysSinceLastStart: workload.daysSinceLastStart
        });
        const adjustedLeagueSavePct = clamp(
          leagueSavePct - workloadSavePctPenalty + restSplitSavePctAdjustment,
          0.86,
          0.92
        );
        const goalieModel = computeGoalieProjectionModel({
          projectedShotsAgainst: shotsAgainst,
          starterProbability: starterProb,
          projectedGoalsFor: adjustedTeamGoalsFor,
          evidence,
          leagueSavePct: adjustedLeagueSavePct
        });
        const selectedGoalieFullStartModel = computeGoalieProjectionModel({
          projectedShotsAgainst: shotsAgainst,
          starterProbability: 1,
          projectedGoalsFor: adjustedTeamGoalsFor,
          evidence,
          leagueSavePct: adjustedLeagueSavePct
        });

        const scenarioProjections: StarterScenarioProjection[] = [];
        for (const scenario of topStarterScenarios) {
          if (!goalieEvidenceCache.has(playerDateKey(scenario.goalieId))) {
            goalieEvidenceCache.set(playerDateKey(scenario.goalieId),
              await fetchGoalieEvidence(scenario.goalieId, asOfDate)
            );
          }
          if (!goalieWorkloadContextCache.has(playerDateKey(scenario.goalieId))) {
            goalieWorkloadContextCache.set(playerDateKey(scenario.goalieId),
              await fetchGoalieWorkloadContext(scenario.goalieId, asOfDate)
            );
          }
          if (!goalieRestSplitProfileCache.has(playerDateKey(scenario.goalieId))) {
            goalieRestSplitProfileCache.set(playerDateKey(scenario.goalieId),
              await fetchGoalieRestSplitProfile(scenario.goalieId, asOfDate)
            );
          }
          const scenarioEvidence = goalieEvidenceCache.get(playerDateKey(scenario.goalieId)) as GoalieEvidence;
          const scenarioWorkload = goalieWorkloadContextCache.get(playerDateKey(scenario.goalieId)) as GoalieWorkloadContext;
          const scenarioRestSplitProfile =
            goalieRestSplitProfileCache.get(playerDateKey(scenario.goalieId)) ?? null;
          const scenarioWorkloadPenalty =
            computeWorkloadSavePctPenalty(scenarioWorkload);
          const scenarioRestSplitAdjustment =
            computeGoalieRestSplitSavePctAdjustment({
              profile: scenarioRestSplitProfile,
              daysSinceLastStart: scenarioWorkload.daysSinceLastStart
            });
          const scenarioLeagueSavePct = clamp(
            leagueSavePct - scenarioWorkloadPenalty + scenarioRestSplitAdjustment,
            0.86,
            0.92
          );
          const scenarioModel = computeGoalieProjectionModel({
            projectedShotsAgainst: shotsAgainst,
            starterProbability: 1,
            projectedGoalsFor: adjustedTeamGoalsFor,
            evidence: scenarioEvidence,
            leagueSavePct: scenarioLeagueSavePct
          });
          scenarioProjections.push({
            goalie_id: scenario.goalieId,
            rank: scenario.rank,
            starter_probability_raw: Number(scenario.rawProbability.toFixed(4)),
            starter_probability_top2_normalized: Number(scenario.probability.toFixed(4)),
            proj_shots_against: shotsAgainst,
            proj_saves: Number(scenarioModel.projectedSaves.toFixed(3)),
            proj_goals_allowed: Number(scenarioModel.projectedGoalsAllowed.toFixed(3)),
            proj_win_prob: Number(scenarioModel.winProbability.toFixed(4)),
            proj_shutout_prob: Number(scenarioModel.shutoutProbability.toFixed(4)),
            modeled_save_pct: Number(scenarioModel.modeledSavePct.toFixed(4)),
            workload_save_pct_penalty: Number(scenarioWorkloadPenalty.toFixed(4)),
            rest_split_save_pct_adjustment: Number(
              scenarioRestSplitAdjustment.toFixed(4)
            )
          });
        }
        const blendedProjection = blendTopStarterScenarioOutputs({
          scenarioProjections,
          fallbackProjection: {
            proj_shots_against: shotsAgainst,
            proj_saves: Number(selectedGoalieFullStartModel.projectedSaves.toFixed(3)),
            proj_goals_allowed: Number(
              selectedGoalieFullStartModel.projectedGoalsAllowed.toFixed(3)
            ),
            proj_win_prob: Number(selectedGoalieFullStartModel.winProbability.toFixed(4)),
            proj_shutout_prob: Number(
              selectedGoalieFullStartModel.shutoutProbability.toFixed(4)
            ),
            modeled_save_pct: Number(selectedGoalieFullStartModel.modeledSavePct.toFixed(4)),
            workload_save_pct_penalty: Number(workloadSavePctPenalty.toFixed(4)),
            rest_split_save_pct_adjustment: Number(
              restSplitSavePctAdjustment.toFixed(4)
            )
          }
        });

        const goalsAllowed = blendedProjection.proj_goals_allowed;
        const saves = blendedProjection.proj_saves;
        const winProb = blendedProjection.proj_win_prob;
        const shutoutProb = blendedProjection.proj_shutout_prob;
        const uncertaintyScenarioMixture = [
          ...scenarioProjections.map((s) => ({
            weight: s.starter_probability_raw,
            shotsAgainst: s.proj_shots_against,
            goalsAllowed: s.proj_goals_allowed,
            saves: s.proj_saves
          })),
          ...(blendedProjection.residual_probability_mass > 0
            ? [
                {
                  weight: blendedProjection.residual_probability_mass,
                  shotsAgainst,
                  goalsAllowed: Number(
                    selectedGoalieFullStartModel.projectedGoalsAllowed.toFixed(3)
                  ),
                  saves: Number(selectedGoalieFullStartModel.projectedSaves.toFixed(3))
                }
              ]
            : [])
        ];
        starterModelMeta = augmentStarterModelMetaWithScenarioProjections({
          starterModelMeta,
          scenarioProjections,
          blendedProjection
        });
        const defendingTeamScalars = teamHorizonScalarsCache.get(teamDateKey(c.teamId)) ?? [1];
        const opponentTeamScalars = teamHorizonScalarsCache.get(teamDateKey(c.opponentTeamId)) ?? [1];
        const goalieHorizonScalars = Array.from({ length: horizonGames }, (_, idx) => {
          const d = defendingTeamScalars[idx] ?? 1;
          const o = opponentTeamScalars[idx] ?? 1;
          return Number(((d + o) / 2).toFixed(4));
        });
        const goalieHorizonTotalScalar = goalieHorizonScalars.reduce((sum, v) => sum + v, 0);
        const restSplitBucket = toGoalieRestSplitBucket(workload.daysSinceLastStart);
        const restSplitBucketGames =
          restSplitProfile?.gamesByBucket?.[restSplitBucket] ?? null;
        const restSplitBucketSavePct =
          restSplitProfile?.savePctByBucket?.[restSplitBucket] ?? null;
        const goalieUncertainty = buildGoalieUncertaintyWithModel({
          baseGoalieUncertainty: buildGoalieUncertainty({
            shotsAgainst,
            goalsAllowed,
            saves
          }, horizonGames, goalieHorizonScalars, uncertaintyScenarioMixture),
          blendedProjection,
          goalieModel,
          evidence,
          workload,
          workloadSavePctPenalty,
          restSplitBucket,
          restSplitBucketGames,
          restSplitBucketSavePct,
          restSplitSavePctAdjustment,
          restSplitProfile,
          adjustedLeagueSavePct,
          horizonGames,
          goalieHorizonScalars,
          selectedGoalieId,
          starterProb,
          scenarioProjections,
          goalieHorizonTotalScalar,
          shotsAgainst,
          starterModelMeta
        });

        const goalieUpsert = {
          run_id: runId,
          as_of_date: asOfDate,
          horizon_games: horizonGames,
          game_id: game.id,
          goalie_id: selectedGoalieId,
          team_id: c.teamId,
          opponent_team_id: c.opponentTeamId,
          starter_probability: Number(starterProb.toFixed(4)),
          proj_shots_against: Number((shotsAgainst * goalieHorizonTotalScalar).toFixed(3)),
          proj_goals_allowed: Number((goalsAllowed * goalieHorizonTotalScalar).toFixed(3)),
          proj_saves: Number((saves * goalieHorizonTotalScalar).toFixed(3)),
          proj_win_prob: Number((winProb * goalieHorizonTotalScalar).toFixed(4)),
          proj_shutout_prob: Number((shutoutProb * goalieHorizonTotalScalar).toFixed(4)),
          uncertainty: goalieUncertainty as any,
          updated_at: new Date().toISOString()
        };

        const { error: goalieErr } = await supabase
          .from("forge_goalie_projections")
          .upsert(goalieUpsert, {
            onConflict: "run_id,game_id,goalie_id,horizon_games"
          });
        if (goalieErr) throw goalieErr;
        goalieRowsUpserted += 1;
      }

      metrics.games += 1;
    }

    metrics.player_rows = playerRowsUpserted;
    metrics.team_rows = teamRowsUpserted;
    metrics.goalie_rows = goalieRowsUpserted;
    const learningPlayers = learningCounters.players;
    metrics.learning.players_considered = learningPlayers;
    metrics.learning.goal_rate_recent_players = learningCounters.goalRecent;
    metrics.learning.assist_rate_recent_players = learningCounters.assistRecent;
    metrics.learning.goal_rate_recent_share =
      learningPlayers > 0 ? learningCounters.goalRecent / learningPlayers : 0;
    metrics.learning.assist_rate_recent_share =
      learningPlayers > 0 ? learningCounters.assistRecent / learningPlayers : 0;
    metrics.data_quality.skater_pool_projected_count_avg =
      metrics.data_quality.skater_pool_projected_teams > 0
        ? Number(
            (
              metrics.data_quality.skater_pool_projected_count_sum /
              metrics.data_quality.skater_pool_projected_teams
            ).toFixed(3)
          )
        : null;
    metrics.finished_at = new Date().toISOString();
    metrics.timed_out = timedOut;

    await finalizeRun(runId, timedOut ? "failed" : "succeeded", metrics);
    return {
      runId,
      gamesProcessed: metrics.games,
      playerRowsUpserted,
      teamRowsUpserted,
      goalieRowsUpserted,
      timedOut
    };
  } catch (e) {
    metrics.finished_at = new Date().toISOString();
    metrics.error = getErrorMessage(e);
    await finalizeRun(runId, "failed", metrics);
    throw e;
  }
}
