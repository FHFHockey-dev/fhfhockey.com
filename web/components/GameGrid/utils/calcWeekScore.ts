// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\utils\calcWeekScore.ts

/** Interim win-odds heuristic: percentages, with unknown games contributing zero. */
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
 * matchup swing is one point, so it cannot outweigh one extra off night at
 * equal GP, or the two-point schedule edge of 4GP/1ON over 3GP/2ON.
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
  totalTeamGames: number
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
    calculateMatchupBonus(winOddsList, totalTeamGames)
  );
}

export function formatWeekScore(weekScore: number) {
  return weekScore.toFixed(1);
}
