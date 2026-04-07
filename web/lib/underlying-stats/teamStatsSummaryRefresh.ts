import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "lib/supabase/database-generated.types";
import serviceRoleClient from "lib/supabase/server";
import { evaluateNormalizedEventInclusion } from "lib/supabase/Upserts/nhlEventInclusion";
import {
  classifyTeamStrengthState,
  formatStrengthExact,
  parseSituationCode,
  type StrengthState,
} from "lib/supabase/Upserts/nhlStrengthState";

import {
  buildPlayerStatsLandingParityByGame,
  fetchPlayerStatsLandingGamesByIds,
  fetchPlayerStatsLandingSourceBundleForGames,
  type PlayerStatsLandingNativeGameParity,
  type PlayerStatsSourceEventRow,
} from "./playerStatsLandingServer";
import type {
  PlayerStatsScoreState,
  PlayerStatsStrength,
} from "./playerStatsTypes";

const SUPABASE_PAGE_SIZE = 1000;
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
  strengthExact: string | null;
  homeState: StrengthState | null;
  awayState: StrengthState | null;
  awayGoalie: number;
  awaySkaters: number;
  homeSkaters: number;
  homeGoalie: number;
  homeScore: number | null;
  awayScore: number | null;
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

function resolvePeriodDurationSeconds(event: PlayerStatsSourceEventRow): number | null {
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

  if (
    normalizedPeriodType === "OT" ||
    normalizedPeriodType === "OVERTIME" ||
    normalizedPeriodType === "REGULAR_SEASON_OT"
  ) {
    return NHL_REGULAR_SEASON_OVERTIME_SECONDS;
  }

  return NHL_REGULATION_PERIOD_SECONDS;
}

function buildStrengthSegments(
  events: readonly PlayerStatsSourceEventRow[],
  homeTeamId: number,
  awayTeamId: number
): TeamStrengthSegment[] {
  const sorted = sortEvents(events).filter(
    (event) =>
      evaluateNormalizedEventInclusion(event).includeInOnIceParity &&
      event.period_number != null &&
      event.period_seconds_elapsed != null
  );
  const segments: TeamStrengthSegment[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index];
    const next =
      index < sorted.length - 1 &&
      sorted[index + 1].game_id === event.game_id &&
      sorted[index + 1].period_number === event.period_number
        ? sorted[index + 1]
        : null;
    const parsed = parseSituationCode(event.situation_code);
    const startSecond = event.period_seconds_elapsed ?? null;
    const endSecond =
      next?.period_seconds_elapsed ?? resolvePeriodDurationSeconds(event);

    if (
      parsed == null ||
      startSecond == null ||
      endSecond == null ||
      endSecond <= startSecond
    ) {
      continue;
    }

    segments.push({
      periodNumber: event.period_number,
      startSecond,
      endSecond,
      strengthExact: formatStrengthExact(parsed),
      homeState: classifyTeamStrengthState(parsed, homeTeamId, homeTeamId, awayTeamId),
      awayState: classifyTeamStrengthState(parsed, awayTeamId, homeTeamId, awayTeamId),
      awayGoalie: parsed.awayGoalie,
      awaySkaters: parsed.awaySkaters,
      homeSkaters: parsed.homeSkaters,
      homeGoalie: parsed.homeGoalie,
      homeScore: event.home_score ?? null,
      awayScore: event.away_score ?? null,
    });
  }

  return segments;
}

function parseStrengthExactCounts(
  strengthExact: string | null
): { homeSkaters: number | null; awaySkaters: number | null } {
  const match = strengthExact?.match(/^(\d+)v(\d+)$/);

  if (!match) {
    return { homeSkaters: null, awaySkaters: null };
  }

  return {
    homeSkaters: Number(match[1]),
    awaySkaters: Number(match[2]),
  };
}

function getTeamScoreDiffBucket(diff: number): Exclude<PlayerStatsScoreState, "allScores"> {
  if (diff === 0) {
    return "tied";
  }

  if (diff === 1) {
    return "upOne";
  }

  if (diff === -1) {
    return "downOne";
  }

  return diff > 0 ? "leading" : "trailing";
}

function matchesTeamScoreState(
  scoreState: PlayerStatsScoreState,
  teamScoreDiff: number | null
) {
  if (scoreState === "allScores") {
    return true;
  }

  if (teamScoreDiff == null) {
    return false;
  }

  if (scoreState === "withinOne") {
    return Math.abs(teamScoreDiff) <= 1;
  }

  return getTeamScoreDiffBucket(teamScoreDiff) === scoreState;
}

function matchesTeamStrength(args: {
  strength: PlayerStatsStrength;
  teamSkaters: number | null;
  opponentSkaters: number | null;
  teamGoalieOnIce: boolean | null;
  opponentGoalieOnIce: boolean | null;
}) {
  const {
    strength,
    teamSkaters,
    opponentSkaters,
    teamGoalieOnIce,
    opponentGoalieOnIce,
  } = args;

  if (strength === "allStrengths") {
    return true;
  }

  if (teamSkaters == null || opponentSkaters == null) {
    return false;
  }

  if (strength === "evenStrength") {
    return teamSkaters === opponentSkaters;
  }

  if (strength === "fiveOnFive") {
    return (
      teamGoalieOnIce === true &&
      opponentGoalieOnIce === true &&
      teamSkaters === 5 &&
      opponentSkaters === 5
    );
  }

  if (strength === "powerPlay") {
    return teamSkaters > opponentSkaters;
  }

  if (strength === "penaltyKill") {
    return teamSkaters < opponentSkaters;
  }

  if (strength === "fiveOnFourPP") {
    return (
      teamGoalieOnIce === true &&
      opponentGoalieOnIce === true &&
      teamSkaters === 5 &&
      opponentSkaters === 4
    );
  }

  if (strength === "fourOnFivePK") {
    return (
      teamGoalieOnIce === true &&
      opponentGoalieOnIce === true &&
      teamSkaters === 4 &&
      opponentSkaters === 5
    );
  }

  if (strength === "threeOnThree") {
    return (
      teamGoalieOnIce === true &&
      opponentGoalieOnIce === true &&
      teamSkaters === 3 &&
      opponentSkaters === 3
    );
  }

  if (strength === "withEmptyNet") {
    return teamGoalieOnIce === false;
  }

  return opponentGoalieOnIce === false;
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

function resolveTeamScoreDiffForShot(args: {
  teamId: number;
  eventOwnerTeamId: number | null;
  ownerScoreDiffBeforeEvent: number | null;
}) {
  if (args.ownerScoreDiffBeforeEvent == null || args.eventOwnerTeamId == null) {
    return null;
  }

  return args.eventOwnerTeamId === args.teamId
    ? args.ownerScoreDiffBeforeEvent
    : args.ownerScoreDiffBeforeEvent * -1;
}

function resolveTeamSituationForSegment(args: {
  teamId: number;
  homeTeamId: number;
  awayTeamId: number;
  segment: TeamStrengthSegment;
}) {
  if (args.teamId === args.homeTeamId) {
    return {
      teamSkaters: args.segment.homeSkaters,
      opponentSkaters: args.segment.awaySkaters,
      teamGoalieOnIce: args.segment.homeGoalie > 0,
      opponentGoalieOnIce: args.segment.awayGoalie > 0,
      teamScoreDiff:
        args.segment.homeScore != null && args.segment.awayScore != null
          ? args.segment.homeScore - args.segment.awayScore
          : null,
    };
  }

  return {
    teamSkaters: args.segment.awaySkaters,
    opponentSkaters: args.segment.homeSkaters,
    teamGoalieOnIce: args.segment.awayGoalie > 0,
    opponentGoalieOnIce: args.segment.homeGoalie > 0,
    teamScoreDiff:
      args.segment.homeScore != null && args.segment.awayScore != null
        ? args.segment.awayScore - args.segment.homeScore
        : null,
  };
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

  for (const segment of args.segments) {
    const relative = resolveTeamSituationForSegment({
      teamId: args.teamId,
      homeTeamId: args.homeTeamId,
      awayTeamId: args.awayTeamId,
      segment,
    });

    if (
      !matchesTeamStrength({
        strength: args.strength,
        teamSkaters: relative.teamSkaters,
        opponentSkaters: relative.opponentSkaters,
        teamGoalieOnIce: relative.teamGoalieOnIce,
        opponentGoalieOnIce: relative.opponentGoalieOnIce,
      }) ||
      !matchesTeamScoreState(args.scoreState, relative.teamScoreDiff)
    ) {
      continue;
    }

    total += segment.endSecond - segment.startSecond;
  }

  return total;
}

function accumulateTeamShotMetrics(args: {
  gameParity: PlayerStatsLandingNativeGameParity;
  teamId: number;
  strength: PlayerStatsStrength;
  scoreState: PlayerStatsScoreState;
}) {
  const metrics = defaultMetrics();
  const isHome = args.gameParity.game.homeTeamId === args.teamId;

  for (const shot of args.gameParity.shotFeatures) {
    if (shot.isShootoutEvent) {
      continue;
    }

    const teamScoreDiff = resolveTeamScoreDiffForShot({
      teamId: args.teamId,
      eventOwnerTeamId: shot.eventOwnerTeamId,
      ownerScoreDiffBeforeEvent: shot.ownerScoreDiffBeforeEvent,
    });

    if (!matchesTeamScoreState(args.scoreState, teamScoreDiff)) {
      continue;
    }

    const { homeSkaters, awaySkaters } = parseStrengthExactCounts(shot.strengthExact);
    const teamSkaters = isHome ? homeSkaters : awaySkaters;
    const opponentSkaters = isHome ? awaySkaters : homeSkaters;
    const isTeamOwner = shot.eventOwnerTeamId === args.teamId;
    const teamGoalieOnIce = isTeamOwner
      ? shot.ownerGoalieOnIce
      : shot.opponentGoalieOnIce;
    const opponentGoalieOnIce = isTeamOwner
      ? shot.opponentGoalieOnIce
      : shot.ownerGoalieOnIce;

    if (
      !matchesTeamStrength({
        strength: args.strength,
        teamSkaters,
        opponentSkaters,
        teamGoalieOnIce,
        opponentGoalieOnIce,
      })
    ) {
      continue;
    }

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

function resolveGameOutcome(args: {
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

function buildStandingsOutcome(args: {
  teamId: number;
  opponentTeamId: number;
  gameOutcome: TeamGameOutcome;
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

  const overtimeLoss =
    args.gameOutcome.outcomeType === "overtime" ||
    args.gameOutcome.outcomeType === "shootout";

  return {
    wins: 0,
    losses: overtimeLoss ? 0 : 1,
    otl: overtimeLoss ? 1 : 0,
    row_wins: 0,
    points: overtimeLoss ? 1 : 0,
  };
}

function buildTeamUnderlyingSummaryRowsForGame(args: {
  gameParity: PlayerStatsLandingNativeGameParity;
  events: readonly PlayerStatsSourceEventRow[];
}) {
  const { game } = args.gameParity;
  const strengthSegments = buildStrengthSegments(
    args.events,
    game.homeTeamId,
    game.awayTeamId
  );
  const gameOutcome = resolveGameOutcome({
    events: args.events,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
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
        });
        const metrics = accumulateTeamShotMetrics({
          gameParity: args.gameParity,
          teamId: teamContext.teamId,
          strength,
          scoreState,
        });

        return {
          game_id: game.id,
          season_id: game.seasonId,
          game_type: game.type,
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
            scoreState,
          }),
          ...standings,
          ...metrics,
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
  const rows: TRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) {
      throw error;
    }

    const pageRows = (data ?? []) as TRow[];

    if (pageRows.length === 0) {
      break;
    }

    rows.push(...pageRows);

    if (pageRows.length < SUPABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
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

export async function fetchSeasonTeamSummaryGameIdSet(args: {
  supabase?: TeamUnderlyingSupabaseClient;
  seasonId: number;
}): Promise<Set<number>> {
  const databaseClient = (args.supabase ?? serviceRoleClient) as any;
  const rows = await fetchAllRows<{ game_id: number | string | null }>((from, to) =>
    databaseClient
      .from(TEAM_STATS_SUMMARY_TABLE)
      .select("game_id")
      .eq("season_id", args.seasonId)
      .range(from, to)
  );

  return new Set(
    rows
      .map((row) => Number(row.game_id))
      .filter((gameId) => Number.isFinite(gameId))
  );
}

export async function warmTeamStatsLandingSeasonAggregateCache(_args: {
  seasonId: number;
  gameType?: number | null;
  supabase?: TeamUnderlyingSupabaseClient;
}) {
  return;
}

export async function refreshTeamUnderlyingSummaryRowsForGameIds(args: {
  gameIds: readonly number[];
  seasonId?: number | null;
  requestedGameType?: number | null;
  shouldWarmLandingCache?: boolean;
  supabase?: TeamUnderlyingSupabaseClient;
}) {
  const supabase = args.supabase ?? serviceRoleClient;
  const games = await fetchPlayerStatsLandingGamesByIds(args.gameIds, supabase);

  if (games.length === 0) {
    return {
      rowsUpserted: 0,
      gameIdsProcessed: [],
    };
  }

  const bundle = await fetchPlayerStatsLandingSourceBundleForGames({
    games,
    shouldFetchRosterSpots: false,
    client: supabase,
  });
  const parityByGame = buildPlayerStatsLandingParityByGame(bundle);
  const rows = parityByGame.flatMap((gameParity) =>
    buildTeamUnderlyingSummaryRowsForGame({
      gameParity,
      events: bundle.eventsByGameId.get(gameParity.game.id) ?? [],
    })
  );
  const rowsUpserted = await upsertTeamSummaryRows({
    supabase,
    rows,
  });

  if (args.shouldWarmLandingCache && args.seasonId != null) {
    await warmTeamStatsLandingSeasonAggregateCache({
      seasonId: args.seasonId,
      gameType: args.requestedGameType,
      supabase,
    });
  }

  return {
    rowsUpserted,
    gameIdsProcessed: games.map((game) => game.id),
  };
}