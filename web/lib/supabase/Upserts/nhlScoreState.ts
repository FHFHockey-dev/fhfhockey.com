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
