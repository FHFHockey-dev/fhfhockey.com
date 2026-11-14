// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\utils\calcWeekScore.ts

/** Provisional v4: odds stay withheld; quiet-night bonus is capped per horizon. */
export const WEEK_SCORE_VERSION = "schedule-v4-provisional-quiet-night-0.40-r1";

/** One centered adjustment for the entire included horizon, not per game. */
export function calculateSlateCrowding(
  slateCounts: readonly (number | null | undefined)[],
  totalTeamGames: number,
  scheduleComplete = true
) {
  const validCounts = slateCounts.filter((count): count is number =>
    typeof count === "number" && Number.isInteger(count) && count >= 1 && count <= 16);
  const complete = scheduleComplete && totalTeamGames > 0 &&
    slateCounts.length === totalTeamGames && validCounts.length === totalTeamGames;
  const meanGrade = complete
    ? validCounts.reduce((sum, count) => sum + (16 - count) / 15, 0) / totalTeamGames : null;
  return {
    adjustment: meanGrade == null ? 0 : 0.25 * (2 * meanGrade - 1),
    meanGrade,
    knownGames: validCounts.length,
    expectedGames: totalTeamGames,
    status: totalTeamGames === 0 ? "no_games" as const : complete ? "available" as const : "unavailable" as const
  };
}

/** Separate from centered crowding and the displayed integer off-night count. */
export function calculateQuietNightBonus(
  slateCounts: readonly (number | null | undefined)[],
  totalTeamGames: number,
  offNights: number,
  totalGamesPerWeek: number,
  scheduleComplete = true
) {
  const coverage = calculateSlateCrowding(slateCounts, totalTeamGames, scheduleComplete);
  const coherent = scheduleComplete === true && coverage.status === "available" &&
    Number.isInteger(totalTeamGames) && Number.isInteger(totalGamesPerWeek) &&
    totalGamesPerWeek >= totalTeamGames && Number.isInteger(offNights) &&
    offNights === slateCounts.filter(count => typeof count === "number" && count <= 8).length;
  const uncappedAdjustment = coherent ? slateCounts.reduce<number>((sum, count) =>
    sum + 0.25 * Math.max(0, Math.min(1, (7 - count!) / 5)), 0) : 0;
  return {
    adjustment: Math.min(0.40, uncappedAdjustment),
    uncappedAdjustment,
    status: totalTeamGames === 0 ? "no_games" as const : coherent ? "available" as const : "unavailable" as const
  };
}

/**
 * Interim win-odds heuristic: percentages, with unknown games contributing zero.
 * Game Grid odds are withheld (decision 64), so served callers pass nulls and
 * this term is 0; any future odds must stay in [0, 100] and complementary.
 */
export function calculateMatchupBonus(
  winOddsList: readonly (number | null | undefined)[],
  totalTeamGames: number
) {
  if (!Number.isFinite(totalTeamGames) || totalTeamGames <= 0) return 0;

  const totalBonus = winOddsList.reduce<number>((total, odds) => {
    if (typeof odds !== "number" || !Number.isFinite(odds)) return total;
    const percentage = Math.max(0, Math.min(100, odds));
    return total + percentage / 100 - 0.5;
  }, 0);

  // Divide by all included games so missing odds remain neutral. The final
  // clamp also keeps the bound if a caller supplies more odds than games.
  return Math.max(-0.5, Math.min(0.5, totalBonus / totalTeamGames));
}

/**
 * Prioritize included game volume and displayed off-night games. The complete
 * matchup swing is one point, crowding half a point, and quiet-night bonus
 * at most 0.40, preserving the two-point base edge of 4GP/1ON over 3GP/2ON.
 * @param winOddsList Current adjusted win odds on a 0–100 percentage scale.
 * @param offNights Displayed integer count of included off-night games.
 * @param totalGamesPerWeek Included league games, each game counted once.
 * @param totalTeamGames Included regular-season games for this team.
 * @returns Week score
 */
export default function calcWeekScore(
  winOddsList: readonly (number | null | undefined)[],
  offNights: number,
  totalGamesPerWeek: number,
  totalTeamGames: number,
  slateCounts: readonly (number | null | undefined)[] = [],
  scheduleComplete = true,
  quietNightInputsCoherent = true
) {
  if (totalTeamGames === 0) return -100;

  const totalGamesWeight = 6;
  const offNightsWeight = 4;
  // Two team appearances per game across 32 NHL teams.
  const avgTeamGames = totalGamesPerWeek / 16;

  const adjustedTeamGames = totalTeamGames - avgTeamGames;

  return (
    adjustedTeamGames * totalGamesWeight +
    offNights * offNightsWeight +
    calculateMatchupBonus(winOddsList, totalTeamGames) +
    calculateSlateCrowding(slateCounts, totalTeamGames, scheduleComplete).adjustment +
    calculateQuietNightBonus(slateCounts, totalTeamGames, offNights, totalGamesPerWeek, scheduleComplete && quietNightInputsCoherent).adjustment
  );
}

export function formatWeekScore(weekScore: number) {
  return weekScore.toFixed(1);
}
