// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\utilities.ts

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
  const timeArray: boolean[] = new Array(size).fill(false);

  data.forEach((item) => {
    const start = parseTime(item.startTime);
    const duration = parseTime(item.duration ?? "00:00");
    if (duration === 0) {
      console.warn(
        `Shift with ID ${item.id} has null duration and is being treated as 0.`
      );
    }
    for (let i = 0; i < duration; i++) {
      timeArray[start + i] = true;
    }
  });

  return timeArray;
}

export function isForward(position: string): boolean {
  const FORWARDS_POSITIONS = ["L", "R", "C"];
  return FORWARDS_POSITIONS.includes(position);
}

export function isDefense(position: string): boolean {
  const DEFENSE_POSITIONS = ["D"];
  return DEFENSE_POSITIONS.includes(position);
}

export function getColor(p1Pos: string, p2Pos: string): string {
  const RED = "#D65108";
  const BLUE = "#0267C1";
  const PURPLE = "#EFA00B";

  if (isForward(p1Pos) && isForward(p2Pos)) return RED;
  if (isDefense(p1Pos) && isDefense(p2Pos)) return BLUE;
  if (
    (isForward(p1Pos) && isDefense(p2Pos)) ||
    (isForward(p2Pos) && isDefense(p1Pos))
  )
    return PURPLE;

  throw new Error("impossible");
}
