import type { ParsedNhlPbpEvent } from "./nhlPlayByPlayParser";

export type NhlScoreStateContext = {
  gameId: number;
  eventId: number;
  homeScoreBeforeEvent: number;
  awayScoreBeforeEvent: number;
  homeScoreDiffBeforeEvent: number;
  awayScoreDiffBeforeEvent: number;
  ownerScoreDiffBeforeEvent: number | null;
  ownerScoreDiffBucket: string | null;
  scoreEffectsGameTimeSegment: string | null;
  ownerScoreDiffByGameTimeBucket: string | null;
  isLateGameClose: boolean | null;
  isLateGameTrailing: boolean | null;
  isLateGameLeading: boolean | null;
  isFinalFiveMinutes: boolean | null;
  isFinalTwoMinutes: boolean | null;
};

function sortEvents(events: ParsedNhlPbpEvent[]): ParsedNhlPbpEvent[] {
  return [...events].sort((left, right) => {
    if (left.game_id !== right.game_id) return left.game_id - right.game_id;
    const leftOrder = left.sort_order ?? left.event_id;
    const rightOrder = right.sort_order ?? right.event_id;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.event_id - right.event_id;
  });
}

function toOwnerScoreDiff(
  event: ParsedNhlPbpEvent,
  homeScore: number,
  awayScore: number
): number | null {
  if (event.event_owner_side === "home") {
    return homeScore - awayScore;
  }

  if (event.event_owner_side === "away") {
    return awayScore - homeScore;
  }

  return null;
}

function bucketOwnerScoreDiff(scoreDiff: number | null): string | null {
  if (scoreDiff == null) return null;
  if (scoreDiff <= -2) return "trail-2plus";
  if (scoreDiff === -1) return "trail-1";
  if (scoreDiff === 0) return "tied";
  if (scoreDiff === 1) return "lead-1";
  return "lead-2plus";
}

function isLateGameWindow(event: ParsedNhlPbpEvent): boolean {
  const gameSecondsElapsed = event.game_seconds_elapsed ?? null;
  return gameSecondsElapsed != null && gameSecondsElapsed >= 50 * 60;
}

function getScoreEffectsGameTimeSegment(
  event: ParsedNhlPbpEvent
): string | null {
  const gameSecondsElapsed = event.game_seconds_elapsed ?? null;
  if (gameSecondsElapsed == null) return null;

  if (event.period_type === "OT") {
    return "overtime";
  }

  if (event.period_type === "SO") {
    return "shootout";
  }

  if (gameSecondsElapsed < 20 * 60) {
    return "early-regulation";
  }

  if (gameSecondsElapsed < 40 * 60) {
    return "mid-regulation";
  }

  if (gameSecondsElapsed < 55 * 60) {
    return "late-regulation";
  }

  return "final-five-regulation";
}

function isFinalFiveMinutesWindow(event: ParsedNhlPbpEvent): boolean | null {
  const gameSecondsElapsed = event.game_seconds_elapsed ?? null;
  if (gameSecondsElapsed == null || event.period_type !== "REG") {
    return null;
  }

  return gameSecondsElapsed >= 55 * 60;
}

function isFinalTwoMinutesWindow(event: ParsedNhlPbpEvent): boolean | null {
  const gameSecondsElapsed = event.game_seconds_elapsed ?? null;
  if (gameSecondsElapsed == null || event.period_type !== "REG") {
    return null;
  }

  return gameSecondsElapsed >= 58 * 60;
}

function updateRunningScore(
  event: ParsedNhlPbpEvent,
  homeScore: number,
  awayScore: number
): { homeScore: number; awayScore: number } {
  if (event.is_goal) {
    if (event.home_score != null && event.away_score != null) {
      return {
        homeScore: Math.max(homeScore, event.home_score),
        awayScore: Math.max(awayScore, event.away_score),
      };
    }

    if (event.event_owner_side === "home") {
      return { homeScore: homeScore + 1, awayScore };
    }

    if (event.event_owner_side === "away") {
      return { homeScore, awayScore: awayScore + 1 };
    }
  }

  return {
    homeScore:
      event.home_score != null ? Math.max(homeScore, event.home_score) : homeScore,
    awayScore:
      event.away_score != null ? Math.max(awayScore, event.away_score) : awayScore,
  };
}

export function buildScoreStateContexts(
  events: ParsedNhlPbpEvent[]
): NhlScoreStateContext[] {
  const sorted = sortEvents(events);
  const contexts: NhlScoreStateContext[] = [];

  let currentGameId: number | null = null;
  let homeScore = 0;
  let awayScore = 0;

  for (const event of sorted) {
    if (currentGameId !== event.game_id) {
      currentGameId = event.game_id;
      homeScore = 0;
      awayScore = 0;
    }

    const ownerScoreDiff = toOwnerScoreDiff(event, homeScore, awayScore);
    const lateGameWindow = isLateGameWindow(event);
    const scoreEffectsGameTimeSegment = getScoreEffectsGameTimeSegment(event);
    const finalFiveMinutes = isFinalFiveMinutesWindow(event);
    const finalTwoMinutes = isFinalTwoMinutesWindow(event);

    contexts.push({
      gameId: event.game_id,
      eventId: event.event_id,
      homeScoreBeforeEvent: homeScore,
      awayScoreBeforeEvent: awayScore,
      homeScoreDiffBeforeEvent: homeScore - awayScore,
      awayScoreDiffBeforeEvent: awayScore - homeScore,
      ownerScoreDiffBeforeEvent: ownerScoreDiff,
      ownerScoreDiffBucket: bucketOwnerScoreDiff(ownerScoreDiff),
      scoreEffectsGameTimeSegment,
      ownerScoreDiffByGameTimeBucket:
        ownerScoreDiff == null || scoreEffectsGameTimeSegment == null
          ? null
          : `${bucketOwnerScoreDiff(ownerScoreDiff)}@${scoreEffectsGameTimeSegment}`,
      isLateGameClose:
        ownerScoreDiff == null ? null : lateGameWindow && Math.abs(ownerScoreDiff) <= 1,
      isLateGameTrailing:
        ownerScoreDiff == null ? null : lateGameWindow && ownerScoreDiff < 0,
      isLateGameLeading:
        ownerScoreDiff == null ? null : lateGameWindow && ownerScoreDiff > 0,
      isFinalFiveMinutes: finalFiveMinutes,
      isFinalTwoMinutes: finalTwoMinutes,
    });

    const updated = updateRunningScore(event, homeScore, awayScore);
    homeScore = updated.homeScore;
    awayScore = updated.awayScore;
  }

  return contexts;
}

// ---------------------------------------------------------------------------
// Shared running-score / score-segment helper (decision 11; W1-2 D1).
//
// Contract:
// - Events are ordered by (game, sort_order ?? event_id, event_id).
// - `before` is the score when the event happened: classify the EVENT by it
//   (a goal never sees its own updated score).
// - `after` is the score once the event is applied: classify the INTERVAL
//   that starts at this event by it. A goal and a stoppage on one clock tick
//   need no special case: the score is cumulative and zero-length intervals
//   carry no time.
// - Each game starts 0-0. A goal with scoreboard fields re-anchors the score;
//   a goal without them adds one to its owner. A goal with neither makes the
//   score unknown (null) until a later event carries both scoreboard fields.
//   Unknown is never treated as tied.
// - Shootout events never change the running score.
// ---------------------------------------------------------------------------

export type RunningScore = {
  homeScore: number | null;
  awayScore: number | null;
};

export type EventRunningScore = {
  gameId: number;
  eventId: number;
  before: RunningScore;
  after: RunningScore;
};

/** Score states; decision 11: Leading/Trailing include one-goal margins. */
export type ScoreStateFilter =
  | "allScores"
  | "tied"
  | "leading"
  | "trailing"
  | "withinOne"
  | "upOne"
  | "downOne";

type RunningScoreEvent = Pick<
  ParsedNhlPbpEvent,
  | "game_id"
  | "event_id"
  | "sort_order"
  | "is_goal"
  | "home_score"
  | "away_score"
  | "event_owner_side"
  | "period_type"
>;

export function runningScoreEventKey(gameId: number, eventId: number): string {
  return `${gameId}:${eventId}`;
}

function isShootoutPeriod(periodType: string | null | undefined): boolean {
  const normalized = periodType?.trim().toUpperCase() ?? "";
  return normalized === "SO" || normalized.includes("SHOOTOUT");
}

function applyEventToRunningScore(
  event: RunningScoreEvent,
  score: RunningScore
): RunningScore {
  if (isShootoutPeriod(event.period_type)) return score;

  const hasScoreboard = event.home_score != null && event.away_score != null;
  if (event.is_goal) {
    if (hasScoreboard) {
      return { homeScore: event.home_score!, awayScore: event.away_score! };
    }
    if (score.homeScore == null || score.awayScore == null) {
      return { homeScore: null, awayScore: null };
    }
    if (event.event_owner_side === "home") {
      return { homeScore: score.homeScore + 1, awayScore: score.awayScore };
    }
    if (event.event_owner_side === "away") {
      return { homeScore: score.homeScore, awayScore: score.awayScore + 1 };
    }
    return { homeScore: null, awayScore: null };
  }

  if (hasScoreboard && (score.homeScore == null || score.awayScore == null)) {
    return { homeScore: event.home_score!, awayScore: event.away_score! };
  }
  return score;
}

export function buildRunningScoreTimeline<T extends RunningScoreEvent>(
  events: T[]
): EventRunningScore[] {
  const sorted = [...events].sort((left, right) => {
    if (left.game_id !== right.game_id) return left.game_id - right.game_id;
    const leftOrder = left.sort_order ?? left.event_id;
    const rightOrder = right.sort_order ?? right.event_id;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.event_id - right.event_id;
  });
  const timeline: EventRunningScore[] = [];
  let currentGameId: number | null = null;
  let score: RunningScore = { homeScore: 0, awayScore: 0 };

  for (const event of sorted) {
    if (event.game_id !== currentGameId) {
      currentGameId = event.game_id;
      score = { homeScore: 0, awayScore: 0 };
    }
    const before = score;
    score = applyEventToRunningScore(event, score);
    timeline.push({
      gameId: event.game_id,
      eventId: event.event_id,
      before,
      after: score,
    });
  }

  return timeline;
}

export function buildRunningScoreByEventKey<T extends RunningScoreEvent>(
  events: T[]
): Map<string, EventRunningScore> {
  return new Map(
    buildRunningScoreTimeline(events).map((entry) => [
      runningScoreEventKey(entry.gameId, entry.eventId),
      entry,
    ])
  );
}

/** Goal differential from one side's point of view; null when unknown. */
export function getSideScoreDiff(
  score: RunningScore | null | undefined,
  side: "home" | "away" | null
): number | null {
  if (!score || side == null) return null;
  if (score.homeScore == null || score.awayScore == null) return null;
  return side === "home"
    ? score.homeScore - score.awayScore
    : score.awayScore - score.homeScore;
}

/**
 * Overlapping score-state predicates (decision 11): tied / leading / trailing
 * partition known time; up one and down one are subsets of leading and
 * trailing; within one overlaps all three. An unknown score matches only
 * "allScores".
 */
export function matchesScoreState(
  scoreState: ScoreStateFilter,
  diff: number | null
): boolean {
  if (scoreState === "allScores") return true;
  if (diff == null) return false;
  switch (scoreState) {
    case "tied":
      return diff === 0;
    case "leading":
      return diff > 0;
    case "trailing":
      return diff < 0;
    case "withinOne":
      return Math.abs(diff) <= 1;
    case "upOne":
      return diff === 1;
    case "downOne":
      return diff === -1;
  }
}
