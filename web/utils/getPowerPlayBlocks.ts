// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\utils\getPowerPlayBlocks.ts

import { NORMAL_PERIOD_IN_SECONDS } from "hooks/useGoals";
import Fetch from "lib/cors-fetch";
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
 *  - Minor penalties end either after the duration has completed, or a goal is scored during the duration.
 *  - Double Minors If opponent scores goal Reduces to multiple of 2 min. A maximum of 2 goals can be scored during a double minor.
 *  - A Major penalty will always run the duration, with no goal limit.
 * @param plays
 * @returns
 */
export default function getPowerPlayBlocks(plays: any[]): Block[] {
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
