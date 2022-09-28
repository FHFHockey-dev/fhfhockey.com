import { DAYS, TeamRowData } from "../TeamRow";

let runtime: any = null;

export default async function calcWinOdds(homeTeam: string, awayTeam: string) {
  // [odds, winOdds, xx]
  const result = await runtime.runPythonAsync(
    `get_game_scores("${homeTeam}","${awayTeam}")`
  );
  const parsed = JSON.parse(result) as [number, number, number];

  return parsed[1];
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
export function convertTeamRowToWinOddsList(row: TeamRowData) {
  const winOddsList: (number | null)[] = [];
  DAYS.forEach((day, i) => {
    const winOdds = row[day]?.winOdds;
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
  teams: TeamRowData[],
  dilutedFactor: number = 0.75
): void {
  teams.forEach((row) => {
    const winOddsList = convertTeamRowToWinOddsList(row);
    DAYS.forEach((day, i) => {
      const oldWinOdds = row[day]?.winOdds;
      if (!oldWinOdds) return;
      // test if the current day is the 2d back-to-back game
      if (isBackToBack(winOddsList, i)) {
        // multiply by 0.75
        row[day]!.winOdds = oldWinOdds * dilutedFactor;
      }
      // test if the opponent is also playing a 2d back-to-back game
      const opponent = teams.find((item) => {
        return item.teamName === row[day]?.opponentName;
      });

      if (opponent) {
        const opponentWinOddsList = convertTeamRowToWinOddsList(opponent);
        if (
          isBackToBack(winOddsList, i) &&
          isBackToBack(opponentWinOddsList, i)
        ) {
          // don't multiply by 0.75
          row[day]!.winOdds = oldWinOdds;
        }
      }
    });
  });
}

/**
 * WinOdds would have to be adjusted to be within a -5 to 5 range, with 50% being 0.
  - 75% winOdds = 2.5
  - 25% winOdds = -2.5
 * @param winOdds A floating point number between 0 and 1
 * @returns A string of floating point number within a -5 to 5 range.
 */
export function formatWinOdds(winOdds: number) {
  return (winOdds * 10 - 5).toFixed(2);
}
