// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\utils\calcWinOdds.ts

import { DAYS } from "lib/NHL/types";
import { ScheduleArray } from "./useSchedule";

const cache: any = {};
export default async function calcWinOdds(
  us: string,
  opponent: string,
  season: string | number
) {
  let SERVERLESS_API_URL = process.env.NEXT_PUBLIC_SERVERLESS_API_URL || "";

  // [odds, winOdds, xx]
  SERVERLESS_API_URL += "/api/winOdds?";
  SERVERLESS_API_URL += `HomeTeam=${encodeURIComponent(us)}`;
  SERVERLESS_API_URL += `&AwayTeam=${encodeURIComponent(opponent)}`;
  SERVERLESS_API_URL += `&Season=${season}`;
  const key = SERVERLESS_API_URL;
  if (cache[key] !== undefined) {
    return cache[key];
  }

  try {
    const result = (await fetch(SERVERLESS_API_URL).then((res) => res.json()))
      .winOdds as number;
    cache[key] = result;
    return result;
  } catch (e: any) {
    console.error("failed: " + SERVERLESS_API_URL, e.message);
    return -1;
  }
}

/**
 * Test if the day is the 2d day of a back-to-back.
 * @param winOddsList A list of WinOdds
 * @param day The index of the day
 * @returns true if the `day` is 2d day of a back-to-back. Otherwise, false.
 */
export function isBackToBack(winOddsList: (number | null)[], day: number) {
  if (day <= 0) return false;
  const playedYesterday = winOddsList[day - 1] !== null;
  const playedToday = winOddsList[day] !== null;

  if (!playedToday) return false;
  if (playedYesterday && playedToday) return true;
  return false;
}

/**
 * Convert a TeamRowData to a list of WinOdds.
 * @param row A team's stats for a week
 * @returns A list of WinOdds. e.g., [null, 0.3, null, 0.3, 6.4, null, 2.7]
 */
export function convertTeamRowToWinOddsList(row: ScheduleArray[0]) {
  const winOddsList: (number | null)[] = [];
  DAYS.forEach((day, i) => {
    // const winOdds = row[day]?.winOdds;
    const winOdds =
      row.teamId === row[day]?.homeTeam.id
        ? row[day]?.homeTeam.winOdds
        : row[day]?.awayTeam.winOdds;
    winOddsList[i] = winOdds !== undefined ? winOdds : null;
  });
  return winOddsList;
}

/**
 *
 * Adjust the **WinOdds** if a team plays 2x in 2 nights (called a back to back), the WinOdds is multiplied by `dilutedFactor` for the second game.
 *
 * If a team also plays a team that is playing game 2/2 in a back to back, no handicap is placed
 *
 * Higher the WinOdds, the better a chance a team has to win.
 *
 * Directly operates on the argument.
 *
 * @param teams The whole league
 * @param dilutedFactor The penalty term for the 2d game.
 */
export function adjustBackToBackGames(
  teams: ScheduleArray,
  dilutedFactor: number = 0.75
): void {
  teams.forEach((row) => {
    const winOddsList = convertTeamRowToWinOddsList(row);
    DAYS.forEach((day, i) => {
      const ourTeam =
        row.teamId === row[day]?.homeTeam.id
          ? row[day]?.homeTeam
          : row[day]?.awayTeam;
      const opponentTeam =
        row.teamId !== row[day]?.homeTeam.id
          ? row[day]?.homeTeam
          : row[day]?.awayTeam;

      const oldWinOdds = ourTeam?.winOdds;
      if (!oldWinOdds) return;
      // test if the current day is the 2d back-to-back game
      if (isBackToBack(winOddsList, i)) {
        // multiply by 0.75
        ourTeam.winOdds = oldWinOdds * dilutedFactor;
      }
      // test if the opponent is also playing a 2d back-to-back game
      const opponent = teams.find((team) => team.teamId === opponentTeam?.id);

      if (opponent) {
        const opponentWinOddsList = convertTeamRowToWinOddsList(opponent);
        if (
          isBackToBack(winOddsList, i) &&
          isBackToBack(opponentWinOddsList, i)
        ) {
          // don't multiply by 0.75
          ourTeam.winOdds = oldWinOdds;
        }
      }
    });
  });
}

/**
 * format the number in percentage.
 * @param winOdds A floating point number between 0 and 1
 * @returns percentage
 */
export function formatWinOdds(winOdds: number) {
  return winOdds.toLocaleString(undefined, { style: "percent" });
}
