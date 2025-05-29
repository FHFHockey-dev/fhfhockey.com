// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\TotalGamesPerDayRow.tsx

import { DAYS, DAY_ABBREVIATION, TeamDataWithTotals } from "lib/NHL/types";
import styles from "./GameGrid.module.scss";
import clsx from "clsx";

type TotalGamesPerDayRowProps = {
  games: number[];
  excludedDays: DAY_ABBREVIATION[];
  extended: boolean;
  weekData: TeamDataWithTotals[];
};

// Function to determine intensity based on game count
const getIntensity = (numGames: number): string => {
  if (numGames <= 7) return "high"; // Green (Fewest games = highest intensity day for streaming)
  if (numGames <= 8) return "medium-high"; // Yellow
  if (numGames <= 9) return "low"; // red
  return "low"; // Red (Most games = lowest intensity day for streaming)
};

function TotalGamesPerDayRow({
  games,
  excludedDays,
  extended,
  weekData
}: TotalGamesPerDayRowProps) {
  const excludedDaysIdx = excludedDays.map((dayAbbreviation) =>
    DAYS.findIndex((item) => item === dayAbbreviation)
  );

  const opponentsSummary = weekData.map((team: TeamDataWithTotals) => {
    const week1Opponents = team.weeks.find(
      (w: {
        weekNumber: number;
        opponents: { abbreviation: string; teamId: number }[];
        gamesPlayed: number;
        offNights: number;
      }) => w.weekNumber === 1
    )?.opponents;
    return week1Opponents
      ? week1Opponents
          .map((o: { abbreviation: string; teamId: number }) => o.abbreviation)
          .join(", ")
      : "";
  });

  return (
    <tr className={styles.totalGamesPerDayRow}>
      {/* First cell: Title */}
      <td className={styles.title}>
        <span className={styles.desktopText}>GP/Day</span>
        <span className={styles.mobileText}>GP/Day</span>
      </td>

      {/* Day cells */}
      {games.map((numGames, i) => {
        const intensity = getIntensity(numGames);
        const isExcluded = !extended && excludedDaysIdx.includes(i);
        return (
          <td key={i} data-intensity={intensity}>
            {/* gray overlay for excluded days */}
            {isExcluded && <div className={styles.excludedOverlay} />}
            {numGames}
          </td>
        );
      })}

      {/* Summary columns (only if not extended) */}
      {!extended && (
        <>
          {/* Total GP */}
          <td>{calcTotalGP(games, excludedDays)}</td>
          {/* Total Off-Nights */}
          <td>{calcTotalOffNights(games, excludedDays)}</td>
          {/* Week Score Placeholder */}
          <td>-</td>
        </>
      )}
    </tr>
  );
}

/**
 * Calculate Total Number of Games Played for the week.
 * @param games A list The number of games per day
 * @param excludedDays The days to be ignored.
 * @returns The number of games played in the week.
 */
export function calcTotalGP(games: number[], excludedDays: DAY_ABBREVIATION[]) {
  let total = 0;
  // ["Fri","Tue"] => [4, 1]
  const excludedDaysIdx = excludedDays.map((day) => DAYS.indexOf(day));
  games.forEach((gamesPlayed, i) => {
    const excluded = excludedDaysIdx.includes(i);
    if (!excluded) {
      total += gamesPlayed;
    }
  });
  return total;
}

/**
 * That will be a total of a teams # of Games played
 * that week on a day where <=8 games are occurring.
 * @param games A list of num games played.
 * @returns The number of off-night games for the week.
 */
function calcTotalOffNights(games: number[], excludedDays: DAY_ABBREVIATION[]) {
  let total = 0;
  // ["Fri","Tue"] => [4, 1]
  const excludedDaysIdx = excludedDays.map((day) => DAYS.indexOf(day));
  games.forEach((gamesPlayed, i) => {
    const excluded = excludedDaysIdx.includes(i);
    if (!excluded && gamesPlayed <= 8) {
      total++;
    }
  });
  return total;
}

export default TotalGamesPerDayRow;
