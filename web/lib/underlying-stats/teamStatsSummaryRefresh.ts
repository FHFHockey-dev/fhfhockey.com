import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";
import { type GameFinalityInput, resolveGameFinality } from "lib/games/gameFinality";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import serviceRoleClient from "lib/supabase/server";
import { evaluateNormalizedEventInclusion } from "lib/supabase/Upserts/nhlEventInclusion";
import {
  buildRunningScoreByEventKey,
  getSideScoreDiff,
  runningScoreEventKey,
  type RunningScore,
} from "lib/supabase/Upserts/nhlScoreState";
import {
  classifyTeamManpower,
  parseSituationCode,
  type TeamManpowerContext,
} from "lib/supabase/Upserts/nhlStrengthState";

import {
  buildPlayerStatsLandingParityByGame,
  fetchPlayerStatsLandingGamesByIds,
  fetchPlayerStatsLandingSourceBundleForGames,
  PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
  type PlayerStatsLandingNativeGameParity,
  type PlayerStatsSourceEventRow,
} from "./playerStatsLandingServer";
import type {
  PlayerStatsScoreState,
  PlayerStatsStrength,
} from "./playerStatsTypes";
import {
  matchesUnderlyingScoreState,
  matchesUnderlyingStrength,
} from "./underlyingStrengthPredicate";

const NHL_REGULATION_PERIOD_SECONDS = 20 * 60;
const NHL_REGULAR_SEASON_OVERTIME_SECONDS = 5 * 60;

const SHOT_ATTEMPT_TYPES = new Set(["goal", "shot-on-goal", "missed-shot", "blocked-shot"]);
const UNBLOCKED_ATTEMPT_TYPES = new Set(["goal", "shot-on-goal", "missed-shot"]);
const SHOT_ON_GOAL_TYPES = new Set(["goal", "shot-on-goal"]);

const TEAM_STATS_SUMMARY_SUPPORTED_STRENGTHS: readonly PlayerStatsStrength[] = [
  "allStrengths",
  "evenStrength",
  "fiveOnFive",
  "powerPlay",
  "penaltyKill",
  "fiveOnFourPP",
  "fourOnFivePK",
  "threeOnThree",
  "withEmptyNet",
  "againstEmptyNet",
];
const TEAM_STATS_SUMMARY_SUPPORTED_SCORE_STATES: readonly PlayerStatsScoreState[] = [
  "allScores",
  "tied",
  "leading",
  "trailing",
  "withinOne",
  "upOne",
  "downOne",
];

export const TEAM_STATS_SUMMARY_TABLE = "team_underlying_stats_summary";

type TeamUnderlyingSupabaseClient = SupabaseClient<Database>;

type TeamUnderlyingSummaryRow = {
  game_id: number;
  season_id: number;
  game_type: number;
  game_date: string;
  team_id: number;
  opponent_team_id: number;
  venue: "home" | "away";
  is_home: boolean;
  strength: PlayerStatsStrength;
  score_state: PlayerStatsScoreState;
  toi_seconds: number;
  wins: number;
  losses: number;
  otl: number;
  row_wins: number;
  points: number;
  cf: number;
  ca: number;
  ff: number;
  fa: number;
  sf: number;
  sa: number;
  gf: number;
  ga: number;
  xgf: number;
  xga: number;
  scf: number;
  sca: number;
  scsf: number;
  scsa: number;
  scgf: number;
  scga: number;
  hdcf: number;
  hdca: number;
  hdsf: number;
  hdsa: number;
  hdgf: number;
  hdga: number;
  mdcf: number;
  mdca: number;
  mdsf: number;
  mdsa: number;
  mdgf: number;
  mdga: number;
  ldcf: number;
  ldca: number;
  ldsf: number;
  ldsa: number;
  ldgf: number;
  ldga: number;
};

type TeamStrengthSegment = {
  periodNumber: number;
  startSecond: number;
  endSecond: number;
  /** Manpower context per side (decision 70), from the event's situation code. */
  home: TeamManpowerContext | null;
  away: TeamManpowerContext | null;
  /** Score once the starting event is applied: intervals use the score after (decision 11). */
  scoreAfter: RunningScore | null;
};

type TeamShotMetrics = Omit<
  TeamUnderlyingSummaryRow,
  | "game_id"
  | "season_id"
  | "game_type"
  | "game_date"
  | "team_id"
  | "opponent_team_id"
  | "venue"
  | "is_home"
  | "strength"
  | "score_state"
  | "toi_seconds"
  | "wins"
  | "losses"
  | "otl"
  | "row_wins"
  | "points"
>;

type TeamGameOutcome = {
  winnerTeamId: number | null;
  outcomeType: "regulation" | "overtime" | "shootout" | null;
};

type OfficialGamePayload = {
  gameOutcome?: {
    lastPeriodType?: unknown;
  } | null;
  periodDescriptor?: {
    periodType?: unknown;
  } | null;
  homeTeam?: {
    id?: unknown;
    score?: unknown;
  } | null;
  awayTeam?: {
    id?: unknown;
    score?: unknown;
  } | null;
  summary?: {
    scoring?: Array<{
      periodDescriptor?: {
        periodType?: unknown;
      } | null;
    }> | null;
  } | null;
};

type OfficialGamePayloadRow = {
  game_id: number | string | null;
  payload: unknown;
  source_url: string | null;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function defaultMetrics(): TeamShotMetrics {
  return {
    cf: 0,
    ca: 0,
    ff: 0,
    fa: 0,
    sf: 0,
    sa: 0,
    gf: 0,
    ga: 0,
    xgf: 0,
    xga: 0,
    scf: 0,
    sca: 0,
    scsf: 0,
    scsa: 0,
    scgf: 0,
    scga: 0,
    hdcf: 0,
    hdca: 0,
    hdsf: 0,
    hdsa: 0,
    hdgf: 0,
    hdga: 0,
    mdcf: 0,
    mdca: 0,
    mdsf: 0,
    mdsa: 0,
    mdgf: 0,
    mdga: 0,
    ldcf: 0,
    ldca: 0,
    ldsf: 0,
    ldsa: 0,
    ldgf: 0,
    ldga: 0,
  };
}

function sortEvents(events: readonly PlayerStatsSourceEventRow[]) {
  return [...events].sort((left, right) => {
    if (left.game_id !== right.game_id) {
      return left.game_id - right.game_id;
    }

    const leftOrder = left.sort_order ?? left.event_id;
    const rightOrder = right.sort_order ?? right.event_id;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.event_id - right.event_id;
  });
}

const PLAYOFF_GAME_TYPE = 3;
const TERMINAL_EVENT_TYPES = new Set(["period-end", "game-end"]);

function isOvertimePeriodType(periodType: string | null | undefined) {
  const normalized = periodType?.trim().toUpperCase() ?? null;
  return (
    normalized === "OT" ||
    normalized === "OVERTIME" ||
    normalized === "REGULAR_SEASON_OT"
  );
}

function resolveEventSide(
  teamId: number | null | undefined,
  homeTeamId: number,
  awayTeamId: number
): "home" | "away" | null {
  if (teamId === homeTeamId) return "home";
  if (teamId === awayTeamId) return "away";
  return null;
}

/** Running score per event (L1 helper); the owner side comes from the team id. */
function buildTeamRunningScores(
  events: readonly PlayerStatsSourceEventRow[],
  homeTeamId: number,
  awayTeamId: number
) {
  return buildRunningScoreByEventKey(
    events.map((event) => ({
      ...event,
      event_owner_side: resolveEventSide(
        event.event_owner_team_id,
        homeTeamId,
        awayTeamId
      ),
    }))
  );
}

/**
 * The clock-time an interval starting at this event can last. Overtime is
 * sudden death (W2-3 A2): no time follows an overtime goal or a terminal marker.
 * Playoff overtime periods are 20 minutes.
 */
function resolvePeriodDurationSeconds(
  event: PlayerStatsSourceEventRow,
  gameType?: number | null
): number | null {
  if (
    event.period_seconds_elapsed != null &&
    event.time_remaining_seconds != null
  ) {
    return event.period_seconds_elapsed + event.time_remaining_seconds;
  }

  const normalizedPeriodType = event.period_type?.trim().toUpperCase() ?? null;

  if (normalizedPeriodType === "SO" || normalizedPeriodType === "SHOOTOUT") {
    return 0;
  }

  if (isOvertimePeriodType(normalizedPeriodType)) {
    return gameType === PLAYOFF_GAME_TYPE
      ? NHL_REGULATION_PERIOD_SECONDS
      : NHL_REGULAR_SEASON_OVERTIME_SECONDS;
  }

  return NHL_REGULATION_PERIOD_SECONDS;
}

function endsPlayAfterEvent(event: PlayerStatsSourceEventRow) {
  if (TERMINAL_EVENT_TYPES.has(event.type_desc_key ?? "")) {
    return true;
  }

  return event.type_desc_key === "goal" && isOvertimePeriodType(event.period_type);
}

function buildStrengthSegments(
  events: readonly PlayerStatsSourceEventRow[],
  homeTeamId: number,
  awayTeamId: number,
  gameType?: number | null
): TeamStrengthSegment[] {
  const runningScores = buildTeamRunningScores(events, homeTeamId, awayTeamId);
  const sorted = sortEvents(events).filter(
    (event) =>
      evaluateNormalizedEventInclusion(event).includeInOnIceParity &&
      event.period_number != null &&
      event.period_seconds_elapsed != null
  );
  const segments: TeamStrengthSegment[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index];
    const periodNumber = event.period_number;
    const next =
      index < sorted.length - 1 &&
      sorted[index + 1].game_id === event.game_id &&
      sorted[index + 1].period_number === event.period_number
        ? sorted[index + 1]
        : null;
    const parsed = parseSituationCode(event.situation_code);
    const startSecond = event.period_seconds_elapsed ?? null;
    const endSecond = endsPlayAfterEvent(event)
      ? startSecond
      : next?.period_seconds_elapsed ?? resolvePeriodDurationSeconds(event, gameType);

    if (
      periodNumber == null ||
      parsed == null ||
      startSecond == null ||
      endSecond == null ||
      endSecond <= startSecond
    ) {
      continue;
    }

    segments.push({
      periodNumber,
      startSecond,
      endSecond,
      home: classifyTeamManpower(parsed, "home"),
      away: classifyTeamManpower(parsed, "away"),
      scoreAfter:
        runningScores.get(runningScoreEventKey(event.game_id, event.event_id))?.after ??
        null,
    });
  }

  return segments;
}

function getDangerBucket(args: {
  shotDistanceFeet: number | null;
  shotAngleDegrees: number | null;
}) {
  if (args.shotDistanceFeet == null || args.shotAngleDegrees == null) {
    return null;
  }

  if (args.shotDistanceFeet <= 20 && args.shotAngleDegrees <= 35) {
    return "high" as const;
  }

  if (args.shotDistanceFeet <= 40 && args.shotAngleDegrees <= 50) {
    return "medium" as const;
  }

  return "low" as const;
}

function getApproximateXgValue(args: {
  isGoal: boolean;
  isReboundShot: boolean;
  isRushShot: boolean;
  crossedRoyalRoad: boolean | null;
  shotDistanceFeet: number | null;
  shotAngleDegrees: number | null;
}) {
  const dangerBucket = getDangerBucket(args);

  if (dangerBucket == null) {
    return null;
  }

  let value =
    dangerBucket === "high" ? 0.18 : dangerBucket === "medium" ? 0.08 : 0.02;

  if (args.isReboundShot) {
    value += 0.03;
  }

  if (args.isRushShot) {
    value += 0.02;
  }

  if (args.crossedRoyalRoad) {
    value += 0.02;
  }

  if (args.isGoal) {
    value = Math.max(value, 0.25);
  }

  return Math.min(value, 0.95);
}

function isScoringChance(args: {
  shotDistanceFeet: number | null;
  shotAngleDegrees: number | null;
}) {
  const bucket = getDangerBucket(args);
  return bucket === "high" || bucket === "medium";
}

function accumulateTeamToiSeconds(args: {
  segments: readonly TeamStrengthSegment[];
  teamId: number;
  homeTeamId: number;
  awayTeamId: number;
  strength: PlayerStatsStrength;
  scoreState: PlayerStatsScoreState;
}) {
  let total = 0;
  const side = resolveEventSide(args.teamId, args.homeTeamId, args.awayTeamId);

  for (const segment of args.segments) {
    const context = side === "home" ? segment.home : side === "away" ? segment.away : null;

    if (
      !matchesUnderlyingStrength(args.strength, context) ||
      !matchesUnderlyingScoreState(
        args.scoreState,
        getSideScoreDiff(segment.scoreAfter, side)
      )
    ) {
      continue;
    }

    total += segment.endSecond - segment.startSecond;
  }

  return total;
}

type TeamShotEventContext = {
  situationByEventId: Map<number, ReturnType<typeof parseSituationCode>>;
  runningScores: ReturnType<typeof buildTeamRunningScores>;
};

function buildTeamShotEventContext(
  events: readonly PlayerStatsSourceEventRow[],
  homeTeamId: number,
  awayTeamId: number
): TeamShotEventContext {
  return {
    situationByEventId: new Map(
      events.map((event) => [event.event_id, parseSituationCode(event.situation_code)])
    ),
    runningScores: buildTeamRunningScores(events, homeTeamId, awayTeamId),
  };
}

function accumulateTeamShotMetrics(args: {
  gameParity: PlayerStatsLandingNativeGameParity;
  eventContext: TeamShotEventContext;
  teamId: number;
  strength: PlayerStatsStrength;
  scoreState: PlayerStatsScoreState;
}) {
  const metrics = defaultMetrics();
  const { game } = args.gameParity;
  const side = resolveEventSide(args.teamId, game.homeTeamId, game.awayTeamId);

  for (const shot of args.gameParity.shotFeatures) {
    if (shot.isShootoutEvent) {
      continue;
    }

    // Events are classified by the score before them (a goal never sees its own goal).
    const scoreBefore =
      args.eventContext.runningScores.get(runningScoreEventKey(game.id, shot.eventId))
        ?.before ?? null;

    if (
      !matchesUnderlyingScoreState(args.scoreState, getSideScoreDiff(scoreBefore, side))
    ) {
      continue;
    }

    // Team-oriented manpower from the event's situation code (decision 70),
    // never the away-first strength_exact string.
    const context = classifyTeamManpower(
      args.eventContext.situationByEventId.get(shot.eventId) ?? null,
      side
    );

    if (!matchesUnderlyingStrength(args.strength, context)) {
      continue;
    }

    const isTeamOwner = shot.eventOwnerTeamId === args.teamId;

    const shotOnGoal = SHOT_ON_GOAL_TYPES.has(shot.shotEventType ?? "");
    const shotAttempt = SHOT_ATTEMPT_TYPES.has(shot.shotEventType ?? "");
    const unblockedAttempt = UNBLOCKED_ATTEMPT_TYPES.has(shot.shotEventType ?? "");
    const xgValue = getApproximateXgValue(shot);
    const dangerBucket = getDangerBucket(shot);
    const scoringChance = isScoringChance(shot);

    if (isTeamOwner) {
      if (!shot.isOwnGoal && shotAttempt) {
        metrics.cf += 1;
      }

      if (!shot.isOwnGoal && unblockedAttempt) {
        metrics.ff += 1;
      }

      if (!shot.isOwnGoal && shotOnGoal) {
        metrics.sf += 1;
      }

      if (shot.isGoal) {
        metrics.gf += 1;
      }

      if (!shot.isOwnGoal && xgValue != null) {
        metrics.xgf += xgValue;
      }

      if (!shot.isOwnGoal && scoringChance) {
        metrics.scf += 1;
        if (shotOnGoal) {
          metrics.scsf += 1;
        }
        if (shot.isGoal) {
          metrics.scgf += 1;
        }
      }

      if (!shot.isOwnGoal && dangerBucket === "high") {
        metrics.hdcf += 1;
        if (shotOnGoal) {
          metrics.hdsf += 1;
        }
        if (shot.isGoal) {
          metrics.hdgf += 1;
        }
      } else if (!shot.isOwnGoal && dangerBucket === "medium") {
        metrics.mdcf += 1;
        if (shotOnGoal) {
          metrics.mdsf += 1;
        }
        if (shot.isGoal) {
          metrics.mdgf += 1;
        }
      } else if (!shot.isOwnGoal && dangerBucket === "low") {
        metrics.ldcf += 1;
        if (shotOnGoal) {
          metrics.ldsf += 1;
        }
        if (shot.isGoal) {
          metrics.ldgf += 1;
        }
      }

      continue;
    }

    if (!shot.isOwnGoal && shotAttempt) {
      metrics.ca += 1;
    }

    if (!shot.isOwnGoal && unblockedAttempt) {
      metrics.fa += 1;
    }

    if (!shot.isOwnGoal && shotOnGoal) {
      metrics.sa += 1;
    }

    if (shot.isGoal) {
      metrics.ga += 1;
    }

    if (!shot.isOwnGoal && xgValue != null) {
      metrics.xga += xgValue;
    }

    if (!shot.isOwnGoal && scoringChance) {
      metrics.sca += 1;
      if (shotOnGoal) {
        metrics.scsa += 1;
      }
      if (shot.isGoal) {
        metrics.scga += 1;
      }
    }

    if (!shot.isOwnGoal && dangerBucket === "high") {
      metrics.hdca += 1;
      if (shotOnGoal) {
        metrics.hdsa += 1;
      }
      if (shot.isGoal) {
        metrics.hdga += 1;
      }
    } else if (!shot.isOwnGoal && dangerBucket === "medium") {
      metrics.mdca += 1;
      if (shotOnGoal) {
        metrics.mdsa += 1;
      }
      if (shot.isGoal) {
        metrics.mdga += 1;
      }
    } else if (!shot.isOwnGoal && dangerBucket === "low") {
      metrics.ldca += 1;
      if (shotOnGoal) {
        metrics.ldsa += 1;
      }
      if (shot.isGoal) {
        metrics.ldga += 1;
      }
    }
  }

  return metrics;
}

function resolveGameOutcomeFromEvents(args: {
  events: readonly PlayerStatsSourceEventRow[];
  homeTeamId: number;
  awayTeamId: number;
}): TeamGameOutcome {
  const sorted = sortEvents(args.events);
  let homeScore = 0;
  let awayScore = 0;
  let hasOvertime = false;
  let hasShootout = false;

  for (const event of sorted) {
    const normalizedPeriodType = event.period_type?.trim().toUpperCase() ?? null;

    if (
      normalizedPeriodType === "OT" ||
      normalizedPeriodType === "OVERTIME" ||
      normalizedPeriodType === "REGULAR_SEASON_OT"
    ) {
      hasOvertime = true;
    }

    if (normalizedPeriodType === "SO" || normalizedPeriodType === "SHOOTOUT") {
      hasShootout = true;
    }

    if (event.home_score != null) {
      homeScore = Math.max(homeScore, event.home_score);
    }

    if (event.away_score != null) {
      awayScore = Math.max(awayScore, event.away_score);
    }
  }

  if (homeScore === awayScore) {
    return {
      winnerTeamId: null,
      outcomeType: hasShootout ? "shootout" : hasOvertime ? "overtime" : null,
    };
  }

  return {
    winnerTeamId: homeScore > awayScore ? args.homeTeamId : args.awayTeamId,
    outcomeType: hasShootout ? "shootout" : hasOvertime ? "overtime" : "regulation",
  };
}

function normalizeOfficialOutcomeType(lastPeriodType: unknown): TeamGameOutcome["outcomeType"] {
  const normalized =
    typeof lastPeriodType === "string"
      ? lastPeriodType.trim().toUpperCase()
      : null;

  if (normalized === "SO" || normalized === "SHOOTOUT") {
    return "shootout";
  }

  if (
    normalized === "OT" ||
    normalized === "OVERTIME" ||
    normalized === "REGULAR_SEASON_OT"
  ) {
    return "overtime";
  }

  if (normalized === "REG") {
    return "regulation";
  }

  return null;
}

function resolveOfficialPayloadPeriodType(payload: OfficialGamePayload): unknown {
  const rootPeriodType = payload.periodDescriptor?.periodType;
  if (typeof rootPeriodType === "string" && rootPeriodType.trim().length > 0) {
    return rootPeriodType;
  }

  const scoringPeriods = Array.isArray(payload.summary?.scoring)
    ? payload.summary?.scoring
    : [];

  for (let index = scoringPeriods.length - 1; index >= 0; index -= 1) {
    const periodType = scoringPeriods[index]?.periodDescriptor?.periodType;
    if (typeof periodType === "string" && periodType.trim().length > 0) {
      return periodType;
    }
  }

  return payload.gameOutcome?.lastPeriodType;
}

export function resolveGameOutcomeFromOfficialPayload(args: {
  payload: unknown;
  homeTeamId: number;
  awayTeamId: number;
}): TeamGameOutcome | null {
  if (!isObjectRecord(args.payload)) {
    return null;
  }

  const payload = args.payload as OfficialGamePayload;
  const homeTeam = isObjectRecord(payload.homeTeam) ? payload.homeTeam : null;
  const awayTeam = isObjectRecord(payload.awayTeam) ? payload.awayTeam : null;
  const homeTeamId = Number(homeTeam?.id);
  const awayTeamId = Number(awayTeam?.id);
  const homeScore = Number(homeTeam?.score);
  const awayScore = Number(awayTeam?.score);

  if (
    !Number.isFinite(homeTeamId) ||
    !Number.isFinite(awayTeamId) ||
    !Number.isFinite(homeScore) ||
    !Number.isFinite(awayScore) ||
    homeTeamId !== args.homeTeamId ||
    awayTeamId !== args.awayTeamId ||
    homeScore === awayScore
  ) {
    return null;
  }

  return {
    winnerTeamId: homeScore > awayScore ? args.homeTeamId : args.awayTeamId,
    outcomeType: normalizeOfficialOutcomeType(resolveOfficialPayloadPeriodType(payload)),
  };
}

function resolveGameOutcome(args: {
  events: readonly PlayerStatsSourceEventRow[];
  homeTeamId: number;
  awayTeamId: number;
  officialPayload?: unknown;
}): TeamGameOutcome {
  const officialOutcome =
    args.officialPayload == null
      ? null
      : resolveGameOutcomeFromOfficialPayload({
          payload: args.officialPayload,
          homeTeamId: args.homeTeamId,
          awayTeamId: args.awayTeamId,
        });

  if (officialOutcome != null) {
    return officialOutcome;
  }

  return resolveGameOutcomeFromEvents(args);
}

// An unresolved winner stores zeros (the columns are NOT NULL); readers treat a
// game with W + L + OTL = 0 as unresolved and drop it from the record (W2-3 D12).
function buildStandingsOutcome(args: {
  teamId: number;
  opponentTeamId: number;
  gameOutcome: TeamGameOutcome;
  gameType?: number | null;
}) {
  if (args.gameOutcome.winnerTeamId == null) {
    return {
      wins: 0,
      losses: 0,
      otl: 0,
      row_wins: 0,
      points: 0,
    };
  }

  if (args.gameOutcome.winnerTeamId === args.teamId) {
    return {
      wins: 1,
      losses: 0,
      otl: 0,
      row_wins: args.gameOutcome.outcomeType === "shootout" ? 0 : 1,
      points: 2,
    };
  }

  // Playoff games have no overtime-loss point: an overtime loss is a loss.
  const overtimeLoss =
    args.gameType !== PLAYOFF_GAME_TYPE &&
    (args.gameOutcome.outcomeType === "overtime" ||
      args.gameOutcome.outcomeType === "shootout");

  return {
    wins: 0,
    losses: overtimeLoss ? 0 : 1,
    otl: overtimeLoss ? 1 : 0,
    row_wins: 0,
    points: overtimeLoss ? 1 : 0,
  };
}

export function buildTeamUnderlyingSummaryRowsForGame(args: {
  gameParity: PlayerStatsLandingNativeGameParity;
  events: readonly PlayerStatsSourceEventRow[];
  officialPayload?: unknown;
}) {
  const { game } = args.gameParity;
  const gameType = game.type;

  if (gameType == null) {
    return [];
  }

  const strengthSegments = buildStrengthSegments(
    args.events,
    game.homeTeamId,
    game.awayTeamId,
    gameType
  );
  const eventContext = buildTeamShotEventContext(
    args.events,
    game.homeTeamId,
    game.awayTeamId
  );
  const gameOutcome = resolveGameOutcome({
    events: args.events,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    officialPayload: args.officialPayload,
  });

  return [
    {
      teamId: game.homeTeamId,
      opponentTeamId: game.awayTeamId,
      venue: "home" as const,
      isHome: true,
    },
    {
      teamId: game.awayTeamId,
      opponentTeamId: game.homeTeamId,
      venue: "away" as const,
      isHome: false,
    },
  ].flatMap((teamContext) =>
    TEAM_STATS_SUMMARY_SUPPORTED_SCORE_STATES.flatMap((scoreState) =>
      TEAM_STATS_SUMMARY_SUPPORTED_STRENGTHS.map((strength) => {
        const standings = buildStandingsOutcome({
          teamId: teamContext.teamId,
          opponentTeamId: teamContext.opponentTeamId,
          gameOutcome,
          gameType,
        });
        const metrics = accumulateTeamShotMetrics({
          gameParity: args.gameParity,
          eventContext,
          teamId: teamContext.teamId,
          strength,
          scoreState,
        });

        return {
          game_id: game.id,
          season_id: game.seasonId,
          game_type: gameType,
          game_date: game.date,
          team_id: teamContext.teamId,
          opponent_team_id: teamContext.opponentTeamId,
          venue: teamContext.venue,
          is_home: teamContext.isHome,
          strength,
          score_state: scoreState,
          toi_seconds: accumulateTeamToiSeconds({
            segments: strengthSegments,
            teamId: teamContext.teamId,
            homeTeamId: game.homeTeamId,
            awayTeamId: game.awayTeamId,
            strength,
            scoreState
          }),
          ...standings,
          ...metrics
        } satisfies TeamUnderlyingSummaryRow;
      })
    )
  );
}

async function fetchAllRows<TRow>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>
): Promise<TRow[]> {
  return fetchAllSupabasePages<TRow>(({ from, to }) => fetchPage(from, to) as any);
}

async function upsertTeamSummaryRows(args: {
  supabase: TeamUnderlyingSupabaseClient;
  rows: readonly TeamUnderlyingSummaryRow[];
}) {
  const databaseClient = args.supabase as any;
  let count = 0;

  for (let index = 0; index < args.rows.length; index += 100) {
    const batch = args.rows.slice(index, index + 100);
    const { error } = await databaseClient.from(TEAM_STATS_SUMMARY_TABLE).upsert(batch, {
      onConflict: "game_id,team_id,strength,score_state",
    });

    if (error) {
      throw error;
    }

    count += batch.length;
  }

  return count;
}

export async function fetchOfficialGamePayloadByGameId(args: {
  gameIds: readonly number[];
  supabase: TeamUnderlyingSupabaseClient;
}): Promise<Map<number, unknown>> {
  if (args.gameIds.length === 0) {
    return new Map();
  }

  const rows = await fetchAllRows<OfficialGamePayloadRow>((from, to) =>
    (args.supabase as any)
      .from("nhl_api_game_payloads_raw")
      .select("game_id,payload,source_url")
      .eq("endpoint", PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT)
      // Official payloads only: derived summary copies are ~99% of these rows and are discarded below.
      .not("source_url", "like", "derived://%")
      .in("game_id", [...args.gameIds])
      .order("game_id", { ascending: true })
      .order("fetched_at", { ascending: false })
      // Unique tiebreak: offset paging over a non-unique order repeats and skips rows.
      .order("id", { ascending: true })
      .range(from, to)
  );

  const payloadByGameId = new Map<number, unknown>();

  for (const row of rows) {
    const gameId = Number(row.game_id);
    if (!Number.isFinite(gameId) || payloadByGameId.has(gameId)) {
      continue;
    }

    if (typeof row.source_url === "string" && row.source_url.startsWith("derived://")) {
      continue;
    }

    payloadByGameId.set(gameId, row.payload);
  }

  return payloadByGameId;
}

export async function fetchSeasonTeamSummaryGameIdSet(args: {
  supabase?: TeamUnderlyingSupabaseClient;
  seasonId: number;
  requestedGameType?: number | null;
}): Promise<Set<number>> {
  const databaseClient = (args.supabase ?? serviceRoleClient) as any;
  const rows = await fetchAllRows<{
    game_id: number | string | null;
    team_id: number | string | null;
    toi_seconds: number | null;
  }>((from, to) => {
    let query = databaseClient
      .from(TEAM_STATS_SUMMARY_TABLE)
      .select("game_id,team_id,toi_seconds")
      .eq("season_id", args.seasonId)
      .eq("strength", "allStrengths")
      .eq("score_state", "allScores");

    if (args.requestedGameType != null) {
      query = query.eq("game_type", args.requestedGameType);
    }

    return query
      .order("game_id", { ascending: true })
      .order("team_id", { ascending: true })
      .range(from, to);
  });

  const sampledTeamsByGame = new Map<number, Set<number>>();

  for (const row of rows) {
    const gameId = Number(row.game_id);
    const teamId = Number(row.team_id);
    if (!Number.isFinite(gameId) || !Number.isFinite(teamId)) {
      continue;
    }

    if ((row.toi_seconds ?? 0) <= 0) {
      continue;
    }

    const sampledTeams = sampledTeamsByGame.get(gameId) ?? new Set<number>();
    sampledTeams.add(teamId);
    sampledTeamsByGame.set(gameId, sampledTeams);
  }

  return new Set(
    [...sampledTeamsByGame.entries()]
      .filter(([, teamIds]) => teamIds.size >= 2)
      .map(([gameId]) => gameId)
  );
}

export async function warmTeamStatsLandingSeasonAggregateCache(_args: {
  seasonId: number;
  gameType?: number | null;
  supabase?: TeamUnderlyingSupabaseClient;
}) {
  return;
}

type TeamSummaryKey = {
  game_id: number;
  team_id: number;
  strength: string;
  score_state: string;
};

const teamSummaryKey = (row: TeamSummaryKey) =>
  `${row.game_id}:${row.team_id}:${row.strength}:${row.score_state}`;

// Stored keys for these games that the rebuilt rows no longer contain. Upserts never remove them.
export async function findStaleTeamSummaryKeys(args: {
  gameIds: readonly number[];
  rows: readonly TeamSummaryKey[];
  supabase?: TeamUnderlyingSupabaseClient;
}): Promise<TeamSummaryKey[]> {
  if (args.gameIds.length === 0) return [];
  const databaseClient = (args.supabase ?? serviceRoleClient) as any;
  const stored = await fetchAllRows<TeamSummaryKey>((from, to) =>
    databaseClient
      .from(TEAM_STATS_SUMMARY_TABLE)
      .select("game_id,team_id,strength,score_state")
      .in("game_id", [...args.gameIds])
      .order("game_id", { ascending: true })
      .order("team_id", { ascending: true })
      .order("strength", { ascending: true })
      .order("score_state", { ascending: true })
      .range(from, to)
  );
  const rebuilt = new Set(args.rows.map(teamSummaryKey));
  return stored
    .map((row) => ({ ...row, game_id: Number(row.game_id), team_id: Number(row.team_id) }))
    .filter((row) => !rebuilt.has(teamSummaryKey(row)));
}

// Final games in an explicit date window, for rebuilding games that already have summaries.
// Rule 19: finality comes from the stored game state (contract nhl-game-state-v1);
// start + 8 h decides only while the state is unknown. A late game dated before
// today can still be live, so the date alone never makes a game final.
export async function fetchTeamSummaryRebuildGameIds(args: {
  seasonId: number;
  startDate: string;
  endDate: string;
  gameType?: number | null;
  supabase?: TeamUnderlyingSupabaseClient;
  now?: Date;
}): Promise<number[]> {
  const databaseClient = (args.supabase ?? serviceRoleClient) as any;
  const now = args.now ?? new Date();
  const rows = await fetchAllRows<GameFinalityInput & { id: number | string | null }>(
    (from, to) => {
      let query = databaseClient
        .from("games")
        .select("id,startTime,game_state,game_schedule_state,game_state_observed_at")
        .eq("seasonId", args.seasonId)
        .gte("date", args.startDate)
        .lte("date", args.endDate);
      if (args.gameType != null) query = query.eq("type", args.gameType);
      return query.order("id", { ascending: true }).range(from, to);
    }
  );
  return rows
    .filter((row) => resolveGameFinality(row, now).isFinal)
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));
}

export async function refreshTeamUnderlyingSummaryRowsForGameIds(args: {
  gameIds: readonly number[];
  seasonId?: number | null;
  requestedGameType?: number | null;
  shouldWarmLandingCache?: boolean;
  supabase?: TeamUnderlyingSupabaseClient;
  /** Build the rows and report stale keys without writing. */
  dryRun?: boolean;
  reportStaleKeys?: boolean;
}) {
  const supabase = args.supabase ?? serviceRoleClient;
  const games = await fetchPlayerStatsLandingGamesByIds(args.gameIds, supabase);

  if (games.length === 0) {
    return {
      rowsUpserted: 0,
      rowsGenerated: 0,
      gameIdsProcessed: [],
      staleKeys: [] as TeamSummaryKey[],
    };
  }

  const bundle = await fetchPlayerStatsLandingSourceBundleForGames({
    games,
    shouldFetchRosterSpots: false,
    client: supabase,
  });
  const parityByGame = buildPlayerStatsLandingParityByGame(bundle);
  const officialPayloadByGameId = await fetchOfficialGamePayloadByGameId({
    gameIds: games.map((game) => game.id),
    supabase,
  });
  const rows = parityByGame.flatMap((gameParity) =>
    buildTeamUnderlyingSummaryRowsForGame({
      gameParity,
      events: bundle.eventsByGameId.get(gameParity.game.id) ?? [],
      officialPayload: officialPayloadByGameId.get(gameParity.game.id),
    })
  );
  const staleKeys = args.reportStaleKeys
    ? await findStaleTeamSummaryKeys({ gameIds: games.map((game) => game.id), rows, supabase })
    : [];
  const rowsUpserted = args.dryRun
    ? 0
    : await upsertTeamSummaryRows({
        supabase,
        rows,
      });

  if (!args.dryRun && args.shouldWarmLandingCache && args.seasonId != null) {
    await warmTeamStatsLandingSeasonAggregateCache({
      seasonId: args.seasonId,
      gameType: args.requestedGameType,
      supabase,
    });
  }

  return {
    rowsUpserted,
    rowsGenerated: rows.length,
    gameIdsProcessed: games.map((game) => game.id),
    staleKeys,
  };
}
