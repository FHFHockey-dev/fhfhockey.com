// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\utils\getPowerPlayBlocks.ts

import { NORMAL_PERIOD_IN_SECONDS } from "hooks/useGoals";
import Fetch from "lib/cors-fetch";
import {
  classifyTeamManpower,
  parseSituationCode
} from "lib/supabase/Upserts/nhlStrengthState";
import { useEffect, useState } from "react";

export type Time = {
  period: 1 | 2 | 3;
  type: "REG" | "OT";
  timeInPeriod: string;
};

export type Block = {
  teamId: number;
  start: Time;
  end: Time;
};

/**
 * Parse a time string into seconds
 * @param timeString 00:00
 * @returns
 */
export function parseTime(timeString: string) {
  const [minutes, seconds] = timeString.split(":");
  const result = Number(minutes) * 60 + Number(seconds);
  return result;
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const _seconds = seconds - minutes * 60;
  return `${minutes.toString().padStart(2, "0")}:${_seconds
    .toFixed(0)
    .padStart(2, "0")}`;
}

function getTimeAfter(time: Time, elapsed: string): Time {
  const SECONDS_PER_PERIOD = 20 * 60;
  // convert these two times into seconds
  const startTimeInSeconds = parseTime(time.timeInPeriod);
  const elapsedTimeInSeconds = parseTime(elapsed);
  const endTimeInSeconds = startTimeInSeconds + elapsedTimeInSeconds;
  const overflow = endTimeInSeconds > SECONDS_PER_PERIOD;
  const result = { ...time };

  if (overflow) {
    // increment the period
    result.period++;
    const overflowTimeInSeconds = endTimeInSeconds - SECONDS_PER_PERIOD;
    if (time.period === 3) {
      result.type = "OT";
    }
    result.timeInPeriod = formatTime(overflowTimeInSeconds);
  } else {
    result.timeInPeriod = formatTime(endTimeInSeconds);
  }
  return result;
}

function getTeamIds(plays: any) {
  const ids = new Set<number>();
  for (let i = 0; i < plays.length; i++) {
    if (ids.size === 2) {
      break;
    }
    if (plays[i]?.details?.eventOwnerTeamId) {
      ids.add(plays[i].details.eventOwnerTeamId);
    }
  }
  return [...ids] as [number, number];
}

function playsWithinInterval(
  plays: any,
  startTime: Time,
  duration: string
): any[] {
  const result = [] as any[];
  const endTime = getTimeAfter(startTime, duration);
  const startTimeInSeconds = parseTime(startTime.timeInPeriod);
  const endTimeInSeconds = parseTime(endTime.timeInPeriod);
  for (let i = 0; i < plays.length; i++) {
    const play = plays[i];
    // same period
    if (startTime.period === endTime.period) {
      if (play.period === startTime.period) {
        const playTimeInSeconds = parseTime(play.timeInPeriod);
        if (
          startTimeInSeconds <= playTimeInSeconds &&
          playTimeInSeconds <= endTimeInSeconds
        ) {
          result.push(play);
        }
      }
    }
    // across 2 periods
    if (startTime.period !== endTime.period) {
      if (play.period === startTime.period) {
        const playTimeInSeconds = parseTime(play.timeInPeriod);
        if (startTimeInSeconds <= playTimeInSeconds) {
          result.push(play);
        }
      } else if (play.period === endTime.period) {
        const playTimeInSeconds = parseTime(play.timeInPeriod);
        if (playTimeInSeconds <= endTimeInSeconds) {
          result.push(play);
        }
      }
    }
  }
  return result;
}

function goalsWithinInterval(
  teamId: number,
  plays: any,
  time: Time,
  duration: string
) {
  const filteredPlays = playsWithinInterval(plays, time, duration);
  const goals = filteredPlays.filter(
    (play) =>
      play.typeDescKey === "goal" && play.details.eventOwnerTeamId === teamId
  );
  return goals;
}

function groupPenalties(penalties: any[]) {
  if (penalties.length === 0) return [];
  const grouped: Record<string, any[]> = {};

  for (let i = 0; i < penalties.length; i++) {
    const key = `${penalties[i].periodDescriptor.number}-${penalties[i].timeInPeriod}`;
    if (grouped[key] === undefined) {
      grouped[key] = [];
    }
    grouped[key].push(penalties[i]);
  }
  return Object.values(grouped);
}

function handleCoincidingPenalties(penaltiesGroups: any[]) {
  const penalties = [] as any[];
  for (const group of penaltiesGroups) {
    // more than one penalties - coinciding penalties
    if (group.length > 1) {
      // TJ: the other team committed a larger penalty which cancelled out their penalty
      if (group[0].details.duration > group[1].details.duration) {
        penalties.push({
          ...group[0],
          details: {
            ...group[0].details,
            duration: group[0].details.duration - group[1].details.duration,
          },
        });
      } else if (group[0].details.duration < group[1].details.duration) {
        penalties.push({
          ...group[1],
          details: {
            ...group[1].details,
            duration: group[1].details.duration - group[0].details.duration,
          },
        });
      } else if (group[0].details.duration == group[1].details.duration) {
        // no power play
      }
    }
    // normal penalty
    else {
      penalties.push(group[0]);
    }
  }
  return penalties;
}

function getIntervalInSeconds(start: Time, end: Time) {
  const startTimeInSeconds = parseTime(start.timeInPeriod);
  const endTimeInSeconds = parseTime(end.timeInPeriod);
  if (start.period === end.period) {
    return endTimeInSeconds - startTimeInSeconds;
  } else {
    return NORMAL_PERIOD_IN_SECONDS - startTimeInSeconds + endTimeInSeconds;
  }
}

/**
 * One block per penalty, as written to `pp_timeframes`. It is not manpower: blocks overlap, it reads `play.period`
 * (which the play-by-play no longer sends, so goals end nothing unless the caller adds it) and it treats misconducts
 * as power plays. Use the default export for power-play time.
 *  - Minor penalties end either after the duration has completed, or a goal is scored during the duration.
 *  - Double Minors If opponent scores goal Reduces to multiple of 2 min. A maximum of 2 goals can be scored during a double minor.
 *  - A Major penalty will always run the duration, with no goal limit.
 * @param plays
 * @returns
 */
export function getPenaltyPowerPlayBlocks(plays: any[]): Block[] {
  const [teamA, teamB] = getTeamIds(plays);

  var penalties = plays.filter(
    (play) => play.typeDescKey === "penalty" && play.details.duration >= 2
  );
  const process = (penalty: any): Block => {
    // check if the penalty is a major penalty
    const penaltyType = penalty.details.typeCode as "MIN" | "MAJ";
    const duration = formatTime(penalty.details.duration * 60);
    const time: Time = {
      period: penalty.periodDescriptor.number,
      type: penalty.periodDescriptor.periodType,
      timeInPeriod: penalty.timeInPeriod,
    };
    const opposingTeamId =
      penalty.details.eventOwnerTeamId === teamA ? teamB : teamA;

    const expectedTime = getTimeAfter(time, duration);

    const result: Block = {
      teamId: opposingTeamId,
      start: time,
      end: expectedTime,
    };

    if (penaltyType === "MAJ") {
      result.end = expectedTime;
    } else if (penaltyType === "MIN" || penaltyType === "BEN") {
      // Minor penalties end either after the duration has completed, or a goal is scored during the duration.

      // check if there is a goal in the duration
      let goals = goalsWithinInterval(opposingTeamId, plays, time, duration);

      if (goals.length === 0) {
        // the power play ends after the duration has completed
        result.end = expectedTime;
      } else {
        if (duration === "02:00") {
          result.end = {
            period: goals[0].periodDescriptor.number,
            type: goals[0].periodDescriptor.periodType,
            timeInPeriod: goals[0].timeInPeriod,
          };
        } else if (duration === "04:00") {
          // a goal can reduce 2 minutes of power play
          const TWO_MINUTES_IN_SECONDS = 2 * 60;
          const goalTime = {
            period: goals[0].periodDescriptor.number,
            type: goals[0].periodDescriptor.periodType,
            timeInPeriod: goals[0].timeInPeriod,
          };
          const remainingPowerPlayTimeInSeconds = getIntervalInSeconds(
            goalTime,
            expectedTime
          );
          const newPowerPlayTimeInSeconds =
            remainingPowerPlayTimeInSeconds - TWO_MINUTES_IN_SECONDS;

          if (newPowerPlayTimeInSeconds < 0) {
            result.end = goalTime;
          } else {
            const adjustedGoals = goalsWithinInterval(
              opposingTeamId,
              plays,
              goalTime,
              formatTime(newPowerPlayTimeInSeconds)
            );
            // the team scores twice in a 4 minutes power play, so the power play ends earlier
            if (adjustedGoals.length > 0) {
              result.end = {
                period: adjustedGoals[0].periodDescriptor.number,
                type: adjustedGoals[0].periodDescriptor.periodType,
                timeInPeriod: adjustedGoals[0].timeInPeriod,
              };
            }
          }
        }
      }
    }

    return result;
  };

  const result: Block[] = [];

  const groupedPenalties = groupPenalties(penalties);
  const processedPenalties = handleCoincidingPenalties(groupedPenalties);

  processedPenalties.forEach((penalty) => {
    result.push(process(penalty));
  });
  return result;
}

type PenaltySegment = { seconds: number; endsOnGoal: boolean };
type ServedPenalty = { segments: PenaltySegment[]; remaining: number };
type TeamPenaltyBox = { serving: ServedPenalty[]; waiting: PenaltySegment[][] };

const MINOR_SECONDS = 2 * 60;
const MAJOR_SECONDS = 5 * 60;
const MAX_PENALTIES_SERVING = 2;

function getGameSecond(play: any) {
  return (
    (play.periodDescriptor.number - 1) * NORMAL_PERIOD_IN_SECONDS +
    parseTime(play.timeInPeriod)
  );
}

function getTimeAtGameSecond(gameSecond: number): Time {
  const period = Math.floor(gameSecond / NORMAL_PERIOD_IN_SECONDS) + 1;
  return {
    period: period as Time["period"],
    type: period > 3 ? "OT" : "REG",
    timeInPeriod: formatTime(gameSecond % NORMAL_PERIOD_IN_SECONDS)
  };
}

/** Misconducts and game misconducts carry a duration but leave the team at full strength. */
function getManpowerSegments(penalty: any): PenaltySegment[] {
  const { typeCode, duration } = penalty.details;
  if (typeCode === "MIS" || typeCode === "GAM" || typeCode === "GMIS") return [];
  if (duration === 2) return [{ seconds: MINOR_SECONDS, endsOnGoal: true }];
  if (duration === 4) {
    return [
      { seconds: MINOR_SECONDS, endsOnGoal: true },
      { seconds: MINOR_SECONDS, endsOnGoal: true }
    ];
  }
  if (duration === 5) return [{ seconds: MAJOR_SECONDS, endsOnGoal: false }];
  return [];
}

/**
 * Coinciding penalties cancel minor for minor and major for major across the two teams. What survives is grouped by
 * player, because one player's penalties run one after another while two players' run together.
 */
function getPenaltiesAfterCancelling(
  stoppagePenalties: any[],
  teamIds: number[]
): Record<number, PenaltySegment[][]> {
  const units = teamIds.map((teamId) =>
    stoppagePenalties
      .filter((penalty) => penalty.details.eventOwnerTeamId === teamId)
      .flatMap((penalty) =>
        getManpowerSegments(penalty).map((segment) => ({
          ...segment,
          server: penalty.details.committedByPlayerId ?? `event-${penalty.eventId}`
        }))
      )
  );
  const countOf = (teamIndex: number, endsOnGoal: boolean) =>
    units[teamIndex].filter((unit) => unit.endsOnGoal === endsOnGoal).length;
  const result: Record<number, PenaltySegment[][]> = {};
  teamIds.forEach((teamId, teamIndex) => {
    const remove = {
      minor: Math.min(countOf(0, true), countOf(1, true)),
      major: Math.min(countOf(0, false), countOf(1, false))
    };
    const byServer = new Map<unknown, PenaltySegment[]>();
    for (const { server, ...segment } of units[teamIndex]) {
      const kind = segment.endsOnGoal ? "minor" : "major";
      if (remove[kind] > 0) {
        remove[kind]--;
        continue;
      }
      // A major is served ahead of a minor assessed with it.
      const segments = byServer.get(server) ?? [];
      if (segment.endsOnGoal) segments.push(segment);
      else segments.unshift(segment);
      byServer.set(server, segments);
    }
    result[teamId] = [...byServer.values()];
  });
  return result;
}

function startWaitingPenalties(box: TeamPenaltyBox) {
  while (box.serving.length < MAX_PENALTIES_SERVING && box.waiting.length > 0) {
    const segments = box.waiting.shift() as PenaltySegment[];
    box.serving.push({ segments, remaining: segments[0].seconds });
  }
}

function endCurrentSegment(box: TeamPenaltyBox, penalty: ServedPenalty) {
  penalty.segments = penalty.segments.slice(1);
  if (penalty.segments.length > 0) {
    penalty.remaining = penalty.segments[0].seconds;
    return;
  }
  box.serving.splice(box.serving.indexOf(penalty), 1);
  startWaitingPenalties(box);
}

/**
 * The stretches of game clock in which a team has more skaters because of penalties, one block per stretch. Blocks
 * for a game never overlap, so a 5-on-3 is counted once and 4-on-4 not at all.
 *  - A minor ends early when the team with the advantage scores. A double minor loses its current two minutes.
 *  - A major always runs its full length.
 *  - Coinciding penalties cancel, and a team serves at most two at once while the rest wait.
 * @param plays
 * @returns
 */
export default function getPowerPlayBlocks(plays: any[]): Block[] {
  const clockPlays = plays.filter(
    (play) => play.periodDescriptor?.periodType !== "SO"
  );
  if (clockPlays.length === 0) return [];
  const [teamA, teamB] = getTeamIds(clockPlays);
  const teamIds = [teamA, teamB];
  const boxes: Record<number, TeamPenaltyBox> = {
    [teamA]: { serving: [], waiting: [] },
    [teamB]: { serving: [], waiting: [] }
  };

  const eventsBySecond = new Map<number, any[]>();
  for (const play of clockPlays) {
    if (play.typeDescKey !== "goal" && play.typeDescKey !== "penalty") continue;
    const second = getGameSecond(play);
    eventsBySecond.set(second, [...(eventsBySecond.get(second) ?? []), play]);
  }
  const gameEnd = Math.max(...clockPlays.map(getGameSecond));

  const result: Block[] = [];
  let openTeamId: number | null = null;
  let openStart = 0;
  const closeBlock = (end: number) => {
    if (openTeamId === null) return;
    result.push({
      teamId: openTeamId,
      start: getTimeAtGameSecond(openStart),
      end: getTimeAtGameSecond(end)
    });
  };

  for (let second = 0; second < gameEnd; second++) {
    for (const teamId of teamIds) {
      const box = boxes[teamId];
      for (const penalty of [...box.serving]) {
        if (penalty.remaining === 0) endCurrentSegment(box, penalty);
      }
    }

    const events = eventsBySecond.get(second) ?? [];
    for (const event of events) {
      if (event.typeDescKey !== "goal") continue;
      const scorer = event.details.eventOwnerTeamId;
      const opponent = scorer === teamA ? teamB : teamA;
      if (boxes[scorer].serving.length >= boxes[opponent].serving.length) continue;
      const box = boxes[opponent];
      const firstToExpire = box.serving
        .filter((penalty) => penalty.segments[0].endsOnGoal)
        .sort((a, b) => a.remaining - b.remaining)[0];
      if (firstToExpire) endCurrentSegment(box, firstToExpire);
    }
    const stoppagePenalties = events.filter(
      (event) => event.typeDescKey === "penalty"
    );
    if (stoppagePenalties.length > 0) {
      const penalties = getPenaltiesAfterCancelling(stoppagePenalties, teamIds);
      for (const teamId of teamIds) {
        boxes[teamId].waiting.push(...penalties[teamId]);
        startWaitingPenalties(boxes[teamId]);
      }
    }

    const servingA = boxes[teamA].serving.length;
    const servingB = boxes[teamB].serving.length;
    const teamWithAdvantage =
      servingA === servingB ? null : servingA < servingB ? teamA : teamB;
    if (teamWithAdvantage !== openTeamId) {
      closeBlock(second);
      openTeamId = teamWithAdvantage;
      openStart = second;
    }

    for (const teamId of teamIds) {
      for (const penalty of boxes[teamId].serving) penalty.remaining--;
    }
  }
  closeBlock(gameEnd);

  return result;
}

function getBlockGameSecond(time: Time) {
  return (time.period - 1) * NORMAL_PERIOD_IN_SECONDS + parseTime(time.timeInPeriod);
}

/** Seconds a team spends with a penalty advantage, summed over its blocks. */
export function teamPpClockSeconds(blocks: readonly Block[], teamId: number) {
  return blocks
    .filter((block) => block.teamId === teamId)
    .reduce(
      (sum, block) =>
        sum + Math.max(getBlockGameSecond(block.end) - getBlockGameSecond(block.start), 0),
      0
    );
}

export type PpSituationDisagreement = {
  eventId: number | null;
  gameSecond: number;
  situationCode: string;
  /** Team with the advantage per the penalty-box simulation (null = even). */
  simulatedAdvantageTeamId: number | null;
  /** Team with the advantage per L1's manpower predicate (null = even). */
  situationAdvantageTeamId: number | null;
};

/**
 * Checks the penalty-box simulation against the official per-event situation
 * codes, classified by L1's manpower predicate (decision 70): 6v5 without a
 * penalty is even, a pulled goalie during a real PP or PK keeps the PP/PK.
 * Events on a block's first or last second are skipped, because the stoppage
 * that starts or ends a power play carries the state from before the change.
 * Penalty-shot and shootout codes are skipped. A disagreement is evidence
 * against qualifying the clock for that game (decision 71); it is never
 * corrected silently.
 */
export function auditPpBlocksAgainstSituationCodes(
  plays: readonly any[],
  blocks: readonly Block[],
  teams: { homeTeamId: number; awayTeamId: number }
) {
  const spans = blocks.map((block) => ({
    teamId: block.teamId,
    start: getBlockGameSecond(block.start),
    end: getBlockGameSecond(block.end)
  }));
  const boundaries = new Set(spans.flatMap((span) => [span.start, span.end]));
  const disagreements: PpSituationDisagreement[] = [];
  let checkedEvents = 0;

  for (const play of plays) {
    if (play.periodDescriptor?.periodType === "SO") continue;
    const parsed = parseSituationCode(play.situationCode);
    const home = classifyTeamManpower(parsed, "home");
    if (!home || home.manpowerState === null) continue;
    const gameSecond = getGameSecond(play);
    if (boundaries.has(gameSecond)) continue;

    checkedEvents++;
    const simulatedAdvantageTeamId =
      spans.find((span) => span.start < gameSecond && gameSecond < span.end)?.teamId ?? null;
    const situationAdvantageTeamId =
      home.manpowerState === "PP"
        ? teams.homeTeamId
        : home.manpowerState === "PK"
          ? teams.awayTeamId
          : null;
    if (simulatedAdvantageTeamId !== situationAdvantageTeamId) {
      disagreements.push({
        eventId: play.eventId ?? null,
        gameSecond,
        situationCode: String(play.situationCode),
        simulatedAdvantageTeamId,
        situationAdvantageTeamId
      });
    }
  }

  return { checkedEvents, disagreements };
}

/**
 * Decision-71 team PP clock contract (consumed by L6 `teamPpClock` and L4b).
 * `seconds` is the penalty-box simulation for one team in one game. It may be
 * served as observed PP time only when `qualified` is true; until the
 * simulation passes validation against official records (team PP TOI and
 * situation codes across regulation, OT, expiry, overlapping penalties and
 * extra-attacker states) with complete coverage, `qualified` stays false and
 * readers withhold or flag PP time and share.
 */
export type TeamPpClockContract = {
  gameId: number;
  teamId: number;
  /** Penalty-advantage seconds; null when the play-by-play is missing. */
  seconds: number | null;
  source: typeof PP_CLOCK_SOURCE;
  qualified: boolean;
  /** Why the clock is not qualified (null when qualified). */
  unqualifiedReason: string | null;
  audit: { checkedEvents: number; disagreements: number } | null;
};

export const PP_CLOCK_SOURCE = "fhfh-penalty-box-simulation-v1";
export const PP_CLOCK_QUALIFIED = false;
export const PP_CLOCK_UNQUALIFIED_REASON =
  "Penalty-box simulation not yet validated against official records (decision 71).";

export function buildTeamPpClock(args: {
  gameId: number;
  teamId: number;
  homeTeamId: number;
  awayTeamId: number;
  plays: readonly any[] | null | undefined;
}): TeamPpClockContract {
  if (!args.plays || args.plays.length === 0) {
    return {
      gameId: args.gameId,
      teamId: args.teamId,
      seconds: null,
      source: PP_CLOCK_SOURCE,
      qualified: false,
      unqualifiedReason: "No play-by-play for this game.",
      audit: null
    };
  }
  const blocks = getPowerPlayBlocks(args.plays as any[]);
  const audit = auditPpBlocksAgainstSituationCodes(args.plays, blocks, args);
  return {
    gameId: args.gameId,
    teamId: args.teamId,
    seconds: teamPpClockSeconds(blocks, args.teamId),
    source: PP_CLOCK_SOURCE,
    qualified: PP_CLOCK_QUALIFIED && audit.disagreements.length === 0,
    unqualifiedReason: PP_CLOCK_QUALIFIED
      ? audit.disagreements.length === 0
        ? null
        : `${audit.disagreements.length} event(s) disagree with the official situation codes.`
      : PP_CLOCK_UNQUALIFIED_REASON,
    audit: {
      checkedEvents: audit.checkedEvents,
      disagreements: audit.disagreements.length
    }
  };
}

export function usePowerPlayBlocks(id: string | number) {
  const [powerPlays, setPowerPlays] = useState<Block[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setPowerPlays([]);
      try {
        const { plays } = await Fetch(
          `https://api-web.nhle.com/v1/gamecenter/${id}/play-by-play`
        ).then((res) => res.json());

        const blocks = getPowerPlayBlocks(plays);
        setPowerPlays(blocks);
      } catch (e: any) {
        console.error("Error when obtain play by play data", e);
        setPowerPlays([]);
      }
    })();
  }, [id]);

  return powerPlays;
}
