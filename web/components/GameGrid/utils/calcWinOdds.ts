// components/GameGrid/utils/calcWinOdds.ts

import { DAYS, EXTENDED_DAY_ABBREVIATION, WeekData } from "lib/NHL/types";
import { ScheduleArray } from "./useSchedule";
import { isRegularScheduleGame } from "./helper";

export function calculateBlendedWinOdds(
  winOdds: number | null | undefined,
  apiWinOdds: number | null | undefined
): number | null {
  if (winOdds === null || winOdds === undefined) {
    return null;
  }
  if (apiWinOdds !== null && apiWinOdds !== undefined) {
    return winOdds;
  } else {
    return winOdds;
  }
}

export function formatWinOdds(winOdds: number): string {
  return (
    winOdds.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + "%"
  );
}

/**
 * Convert a TeamRowData to a list of blended WinOdds.
 * @param row A team's stats for a week
 * @returns A list of WinOdds. e.g., [null, 0.3, null, 0.3, 6.4, null, 2.7]
 */

export function convertTeamRowToWinOddsList(
  row: WeekData & { teamId: number; weekNumber: number },
  excludedDays: readonly EXTENDED_DAY_ABBREVIATION[] = [],
  days: readonly EXTENDED_DAY_ABBREVIATION[] = DAYS
) {
  const winOddsList = days.map((day) => {
    const game = row[day];
    if (isRegularScheduleGame(game)) {
      const ourTeam =
        row.teamId === game.homeTeam.id ? game.homeTeam : game.awayTeam;
      return calculateBlendedWinOdds(
        ourTeam.winOdds,
        ourTeam.apiWinOdds
      );

    }
    return null;
  });
  return winOddsList.map((winOdds, i) => {
    if (excludedDays.includes(days[i])) return null;
    // A bench/excluded day still happened on the NHL schedule. Preserve its
    // existing back-to-back effect, while excluding its odds from the average.
    return winOdds !== null && isBackToBack(winOddsList, i)
      ? winOdds * 0.75
      : winOdds;
  });
}

/**
 * Adjust the WinOdds for back-to-back games.
 * @param teams The whole league
 * @param dilutedFactor The penalty term for the 2nd game.
 */
export function adjustBackToBackGames(
  teams: ScheduleArray,
  dilutedFactor: number = 0.75
): void {
  // This function is no longer needed since adjustments are applied in convertTeamRowToWinOddsList
}

/**
 * Test if the day is the 2nd day of a back-to-back.
 * @param winOddsList A list of WinOdds
 * @param day The index of the day
 * @returns true if the `day` is 2nd day of a back-to-back. Otherwise, false.
 */
export function isBackToBack(winOddsList: (number | null)[], day: number) {
  if (day <= 0) return false;
  const playedYesterday = winOddsList[day - 1] !== null;
  const playedToday = winOddsList[day] !== null;

  if (!playedToday) return false;
  if (playedYesterday && playedToday) return true;
  return false;
}
