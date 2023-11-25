import { DAYS, DAY_ABBREVIATION, WeekData } from "lib/NHL/types";

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
