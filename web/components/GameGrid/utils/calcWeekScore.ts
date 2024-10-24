// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\utils\calcWeekScore.ts

const average = (array: (number | null)[]) => {
  let total = 0;
  let count = 0;
  array.forEach((num) => {
    if (num !== null) {
      total += num;
      count++;
    }
  });
  return count > 0 ? total / count : 0;
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

  const totalGamesWeight = 6;
  const offNightsWeight = 4;
  const winOddsWeight = 0.15;

  const averageWinOdds = average(winOddsList) || 0;
  const numberOfTeams = 16; // Adjust to your league's actual number of teams
  const avgTeamGames = totalGamesPerWeek / numberOfTeams;

  const adjustedTeamGames = totalTeamGames - avgTeamGames;

  return (
    adjustedTeamGames * totalGamesWeight +
    offNights * offNightsWeight +
    averageWinOdds * winOddsWeight
  );
}

export function formatWeekScore(weekScore: number) {
  return weekScore.toFixed(1);
}
