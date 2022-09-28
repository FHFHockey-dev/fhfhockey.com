const average = (array: (number | null)[]) => {
  let total = 0;
  array.forEach((num) => {
    if (num !== null) total += num;
  });
  return total / array.length;
};

/**
 * Calculate week score for a team. If there is no games, return -100
 *
 * ((offNights*.5)+(totalTeamGames-((TotalGamesPerWeek)/16))+(avg(gameScore)))
 * @param winOddsList Win Odds for each game of the week.
 * @param offNights Number of off nights of the team.
 * @param totalGamesPerWeek Total number of games of the week, including all teams.
 * @param totalTeamGames Total number of games of the week, only including the team.
 * @returns Week score
 */
export default function calcWeekScore(
  winOddsList: (number | null)[],
  offNights: number,
  totalGamesPerWeek: number,
  totalTeamGames: number
) {
  if (totalTeamGames === 0) return -100;
  return (
    offNights * 0.5 +
    (totalTeamGames - totalGamesPerWeek / 16) +
    average(winOddsList)
  );
}

export function formatWeekScore(weekScore: number) {
  return weekScore.toFixed(1);
}
