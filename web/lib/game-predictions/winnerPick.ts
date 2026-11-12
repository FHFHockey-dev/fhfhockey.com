import { displayedWinPair } from "components/HomePage/homepageWinPair";

/**
 * The picked winner follows the displayed probabilities (owner decision 43):
 * the homepage rule rounds the larger side to a whole percent and the other
 * side is its complement, and a displayed 50/50 is a tie with no pick (null).
 * An incoherent or missing pair has no pick either.
 */
export function displayedWinnerTeamId(args: {
  homeWinProbability: unknown;
  awayWinProbability: unknown;
  homeTeamId: number;
  awayTeamId: number;
}): number | null {
  const displayed = displayedWinPair(
    args.awayWinProbability,
    args.homeWinProbability,
  );
  if (!displayed) return null;
  if (displayed.pick === "home") return args.homeTeamId;
  if (displayed.pick === "away") return args.awayTeamId;
  return null;
}

/** Whether a pick was right; a tie (no pick) is neither right nor wrong. */
export function winnerPickCorrect(
  predictedWinnerTeamId: number | null,
  actualWinnerTeamId: number,
): boolean | null {
  return predictedWinnerTeamId == null
    ? null
    : predictedWinnerTeamId === actualWinnerTeamId;
}

/**
 * Winner accuracy over games with a pick (TJ, 2026-11-11): ties are excluded
 * from the denominator and counted separately.
 */
export function tallyWinnerPicks(
  rows: ReadonlyArray<{ predictedWinnerCorrect: boolean | null }>,
): {
  correctGames: number;
  wrongGames: number;
  tieGames: number;
  accuracy: number | null;
} {
  let correctGames = 0;
  let wrongGames = 0;
  for (const row of rows) {
    if (row.predictedWinnerCorrect === true) correctGames += 1;
    else if (row.predictedWinnerCorrect === false) wrongGames += 1;
  }
  const decided = correctGames + wrongGames;
  return {
    correctGames,
    wrongGames,
    tieGames: rows.length - decided,
    accuracy:
      decided === 0 ? null : Number((correctGames / decided).toFixed(6)),
  };
}
