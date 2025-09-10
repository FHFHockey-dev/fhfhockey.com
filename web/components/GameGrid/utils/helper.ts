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

    const matchUp = matchUps[day];
    const hasMatchUp_ = hasMatchUp(matchUp);
    const isRegularSeason = matchUp?.gameType === 2;
    if (hasMatchUp_ && isRegularSeason) num++;
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
    const hasMatchUp_ = hasMatchUp(matchUp) && matchUp?.gameType === 2;
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
 * New model (baseline anchored at 7 games):
 * - Treat nights with <= 8 NHL games as off‑nights.
 * - Preserve the existing 7‑game weight (~0.2857) to avoid shifting baselines.
 * - Apply a multiplier based on the absolute reduction in teams playing vs 7 games.
 *   share(teams at g games) = g / 16 (2 teams per game, 32 total)
 *   baselineShare = 7 / 16 = 43.75%
 *   multiplier = 1 + max(0, baselineShare - g/16)
 *   Examples: g=7 -> x1.000; g=6 -> x1.0625; g=5 -> x1.125; g=8 -> x1.000 (no penalty)
 */
export function calcWeightedOffNights(
  matchUps: WeekData,
  numGamesPerDay: number[],
  excludedDays: DAY_ABBREVIATION[] = []
) {
  // Parameters for the weighting model
  const TOTAL_TEAMS = 32; // NHL total teams
  const BASELINE_GAMES = 7; // Baseline off-night (keeps current scoring baseline)
  const OFF_NIGHT_THRESHOLD = 8; // Off-night definition remains <= 8

  // Preserve current baseline weight at 7 games so existing scores don’t shift
  const BASELINE_WEIGHT_AT_7 = (9 - 7) / 7; // ≈ 0.285714 from previous model

  let total = 0;
  DAYS.forEach((day, i) => {
    if (excludedDays.includes(day)) return;

    const matchUp = matchUps[day];
    const hasMatchUp_ = hasMatchUp(matchUp) && matchUp?.gameType === 2;
    const games = numGamesPerDay[i] ?? 0;
    const isOffNight = games <= OFF_NIGHT_THRESHOLD;

    if (hasMatchUp_ && isOffNight) {
      // Share of teams playing this night (2 teams per game)
      const sharePerGame = 2 / TOTAL_TEAMS; // = 1/16
      const baselineShare = BASELINE_GAMES * sharePerGame; // 7/16 = 43.75%
      const nightShare = games * sharePerGame; // g/16

      // Absolute difference from baseline (6.25% steps per game)
      // Clamp to avoid penalizing 8-game nights below the 7-game baseline
      const shareDiff = Math.max(0, baselineShare - nightShare);

      // Multiplier increases as games decrease: 7 -> 1.0, 6 -> 1.0625, 5 -> 1.125, ...
      const multiplier = 1 + shareDiff;

      // Apply multiplier to the preserved baseline weight at 7 games
      const weight = BASELINE_WEIGHT_AT_7 * multiplier;
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
