//////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\utilities.ts

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

export type PlayerData = {
  id: number;
  teamId: number;
  position: string;
  name: string;
  playerAbbrevName: string;
  lastName: string;
  totalTOI: number; // Ensure totalTOI is always a number
  timesOnLine: Record<string, number>;
  timesOnPair: Record<string, number>;
  percentToiWith: Record<number, number>;
  percentToiWithMixed: Record<number, number>;
  timeSpentWith: Record<number, string>;
  timeSpentWithMixed: Record<number, string>;
  GP: number;
  timesPlayedWith: Record<number, number>;
  ATOI: string;
  percentOfSeason: Record<number, number>;
  displayPosition: string;
  comboPoints: number;
  mutualSharedToi?: Record<number, number>;
  playerType?: string;
};

export function isForward(position: string): boolean {
  const FORWARDS_POSITIONS = ["LW", "RW", "C"];
  return FORWARDS_POSITIONS.includes(position);
}

export function isDefense(position: string): boolean {
  const DEFENSE_POSITIONS = ["D"];
  return DEFENSE_POSITIONS.includes(position);
}

export function getColor(p1Pos: string, p2Pos: string): string {
  const RED = "#D65108";
  const BLUE = "#0267C1";
  const YELLOW = "#EFA00B";

  if (isForward(p1Pos) && isForward(p2Pos)) return RED;
  if (isDefense(p1Pos) && isDefense(p2Pos)) return BLUE;
  if (
    (isForward(p1Pos) && isDefense(p2Pos)) ||
    (isForward(p2Pos) && isDefense(p1Pos))
  )
    return YELLOW;

  //console.warn("Unexpected position combination:", p1Pos, p2Pos);
  return "#101010"; // Default color for unexpected cases
}

export function parseTime(time: string): number {
  if (!time) return 0;
  const [minutes, seconds] = time.split(":").map(Number);
  return minutes * 60 + seconds;
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}
