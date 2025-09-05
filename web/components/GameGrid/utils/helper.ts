// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\utils\helper.ts

import {
  DAYS,
  DAY_ABBREVIATION,
  WeekData,
  ExtendedWeekData
} from "lib/NHL/types";

/**
 * Test if the match up exist.
 * If a match up does not exist, then its home and away will both be false.
 * @param matchUp A match up.
 * @returns true if the match up exist, otherwise false.
 */
function hasMatchUp(matchUp: WeekData["MON"] | undefined) {
  return matchUp !== undefined;
}

export function getTotalGamePlayed(
  matchUps: WeekData,
  excludedDays: DAY_ABBREVIATION[] = []
) {
  let num = 0;
  DAYS.forEach((day) => {
    if (excludedDays.includes(day)) return;

    const hasMatchUp_ = hasMatchUp(matchUps[day]);
    if (hasMatchUp_) num++;
  });
  return num;
}

/**
 * If a team plays game at off night day, then increment counter by 1.
 * @param matchUps All match ups. Monday ~ Sunday
 * @returns Total Off Nights
 */
export function calcTotalOffNights(
  matchUps: WeekData,
  numGamesPerDay: number[],
  excludedDays: DAY_ABBREVIATION[] = []
) {
  let num = 0;
  DAYS.forEach((day, i) => {
    if (excludedDays.includes(day)) return;

    const matchUp = matchUps[day];
    const hasMatchUp_ = hasMatchUp(matchUp);
    // when a day has <= 8 games, mark that day as off night
    const offNight = numGamesPerDay[i] <= 8;
    if (hasMatchUp_ && offNight) num++;
  });
  return num;
}

/**
 * Calculate a weighted sum of off‑night games for a team.
 * Lighter NHL nights (fewer total games) contribute a larger weight.
 *
 * Weight function for off nights (<= 8 NHL games):
 *   weight = clamp01((9 - numGames) / 7)
 *   - If 2 games: (9-2)/7 = 1.0 (max bonus)
 *   - If 7 games: (9-7)/7 ≈ 0.286
 *   - If 8 games: (9-8)/7 ≈ 0.143
 * Heavier nights (> 8) contribute 0.
 */
export function calcWeightedOffNights(
  matchUps: WeekData,
  numGamesPerDay: number[],
  excludedDays: DAY_ABBREVIATION[] = []
) {
  let total = 0;
  DAYS.forEach((day, i) => {
    if (excludedDays.includes(day)) return;

    const matchUp = matchUps[day];
    const hasMatchUp_ = hasMatchUp(matchUp);
    const games = numGamesPerDay[i] ?? 0;
    const isOffNight = games <= 8;
    if (hasMatchUp_ && isOffNight) {
      const weight = Math.max(0, Math.min(1, (9 - games) / 7));
      total += weight;
    }
  });
  return total;
}

/**
 * Constructs an ExtendedWeekData object.
 *
 * @param teamId - The unique identifier for the team.
 * @param weekNumber - The week number (1 through 4).
 * @param weekData - The schedule data for the week.
 * @param totalGamesPlayed - Total games played by the team in the week.
 * @param totalOffNights - Total off-nights for the team in the week.
 * @param weekScore - The computed week score.
 * @returns An object conforming to ExtendedWeekData.
 */
export function createExtendedWeekData(
  teamId: number,
  weekNumber: number,
  weekData: WeekData,
  totalGamesPlayed: number,
  totalOffNights: number,
  weekScore: number
): ExtendedWeekData {
  return {
    teamId,
    weekNumber,
    ...weekData,
    totalGamesPlayed,
    totalOffNights,
    weekScore
  };
}
