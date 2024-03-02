import { parseTime } from "utils/getPowerPlayBlocks";
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
export function getPairwiseTOI(data: Shift[], p1: number, p2: number): number {
  const p1Data = data.filter((item) => item.playerId === p1);
  const p2Data = data.filter((item) => item.playerId === p2);

  const p1Groups = groupBy(p1Data, ({ period }) => period.toString());
  const p2Groups = groupBy(p2Data, ({ period }) => period.toString());

  const getTogetherDuration = (a: Shift[], b: Shift[]) => {
    const p1TimeArray = convertToTimeArray(a);
    const p2TimeArray = convertToTimeArray(b);
    let togetherDuration = 0;
    for (let i = 0; i < p1TimeArray.length; i++) {
      if (p1TimeArray[i] && p1TimeArray[i] === p2TimeArray[i]) {
        togetherDuration++;
      }
    }
    return togetherDuration;
  };

  let totalDuration = 0;
  const periods = Object.keys(p1Groups);

  periods.forEach((period) => {
    totalDuration += getTogetherDuration(
      p1Groups[period] ?? [],
      p2Groups[period] ?? []
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
