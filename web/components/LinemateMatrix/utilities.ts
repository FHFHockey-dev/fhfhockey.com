// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\LinemateMatrix\utilities.ts

import { Block, parseTime } from "utils/getPowerPlayBlocks";
import groupBy from "utils/groupBy";

export type Shift = {
  id: number;
  gameId: number;
  playerId: number;
  period: number;
  firstName: string;
  lastName: string;
  teamId: number;
  teamName: string;
  duration: string | null;
  startTime: string;
  endTime: string;
};
// [0,0,1,1,0,0,0,1,1,1,1]
// [1,1,1,0,0,0,0,1,1,0,0,0,0]

/**
 * Calculate the number of seconds that 2 players stay on ice together.
 * @param data shift data
 * @param p1 player id
 * @param p2 player id
 * @returns The number in seconds
 */
export function getPairwiseTOI(
  data: Shift[],
  p1: number,
  p2: number,
  ppBlocks?: Block[]
): number {
  const ppOnly = ppBlocks !== undefined;
  const teamId = data[0].teamId;
  const p1Data = data.filter((item) => item.playerId === p1);
  const p2Data = data.filter((item) => item.playerId === p2);

  const p1Groups = groupBy(p1Data, ({ period }) => period.toString());
  const p2Groups = groupBy(p2Data, ({ period }) => period.toString());
  const allPPTimeArray = ppOnly ? createTimeArrayForPP(teamId, ppBlocks) : null;

  const getTogetherDuration = (
    a: Shift[],
    b: Shift[],
    ppTimeArray: boolean[]
  ) => {
    const p1TimeArray = convertToTimeArray(a);
    const p2TimeArray = convertToTimeArray(b);
    let togetherDuration = 0;
    for (let i = 0; i < p1TimeArray.length; i++) {
      if (p1TimeArray[i] && p1TimeArray[i] === p2TimeArray[i]) {
        if (!ppOnly) {
          togetherDuration++;
          continue;
        }
        if (ppTimeArray[i]) {
          togetherDuration++;
        }
      }
    }
    return togetherDuration;
  };

  let totalDuration = 0;
  const periods = Object.keys(p1Groups) as ("1" | "2" | "3" | "4")[];

  periods.forEach((period) => {
    totalDuration += getTogetherDuration(
      p1Groups[period] ?? [],
      p2Groups[period] ?? [],
      allPPTimeArray !== null ? allPPTimeArray[period] : []
    );
  });
  return totalDuration;
}

function convertToTimeArray(data: Shift[], size: number = 1200) {
  // 20 minutes per period
  // 20 * 60 === 1200 seconds per period
  const timeArray: boolean[] = new Array(size).fill(false);

  // populate the `time`
  data.forEach((item) => {
    const start = parseTime(item.startTime);
    const duration = parseTime(item.duration ?? "00:00");
    for (let i = 0; i < duration; i++) {
      timeArray[start + i] = true;
    }
  });

  return timeArray;
}

function createTimeArrayForPP(
  teamId: number,
  ppBlocks: Block[]
): Record<"1" | "2" | "3" | "4", boolean[]> {
  const PERIODS = ["1", "2", "3", "4"] as const;
  const NORMAL_GAME_DURATION_IN_SECONDS = 1200;
  const OT_GAME_DURATION_IN_SECONDS = 300;
  const result: Record<"1" | "2" | "3" | "4", boolean[]> = {
    "1": new Array(NORMAL_GAME_DURATION_IN_SECONDS).fill(false),
    "2": new Array(NORMAL_GAME_DURATION_IN_SECONDS).fill(false),
    "3": new Array(NORMAL_GAME_DURATION_IN_SECONDS).fill(false),
    "4": new Array(OT_GAME_DURATION_IN_SECONDS).fill(false),
  };
  for (let i = 0; i < PERIODS.length; i++) {
    const period = PERIODS[i];
    const ppTimeArray = result[period];
    const blocksOfPeriod = ppBlocks.filter(
      (block) =>
        block.teamId === teamId &&
        (`${block.end.period}` === period || `${block.start.period}` === period)
    );
    blocksOfPeriod.forEach((block) => {
      const start = parseTime(block.start.timeInPeriod);
      const end = parseTime(block.end.timeInPeriod);
      if (
        `${block.start.period}` === period &&
        `${block.end.period}` === period
      ) {
        for (let i = start; i < end; i++) {
          ppTimeArray[i] = true;
        }
      } else if (
        `${block.start.period}` === period &&
        `${block.end.period}` !== period
      ) {
        for (let i = start; i < NORMAL_GAME_DURATION_IN_SECONDS; i++) {
          ppTimeArray[i] = true;
        }
      } else if (
        `${block.start.period}` !== period &&
        `${block.end.period}` === period
      ) {
        for (let i = 0; i < end; i++) {
          ppTimeArray[i] = true;
        }
      }
    });
  }

  return result;
}
