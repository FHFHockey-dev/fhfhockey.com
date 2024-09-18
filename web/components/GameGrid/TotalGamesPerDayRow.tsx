// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\TotalGamesPerDayRow.tsx

import { DAYS, DAY_ABBREVIATION } from "lib/NHL/types";
import styles from "./GameGrid.module.scss";

type TotalGamesPerDayRowProps = {
  games: number[];
  excludedDays: DAY_ABBREVIATION[];
  extended: boolean;
};

function TotalGamesPerDayRow({
  games,
  excludedDays,
  extended,
}: TotalGamesPerDayRowProps) {
  const excludedDaysIdx = excludedDays.map((dayAbbreviation) =>
    DAYS.findIndex((item) => item === dayAbbreviation)
  );
  return (
    <tr className={styles.totalGamesPerDayRow}>
      {/* show GP on mobile */}
      <td className={styles.title}>{/* Total Games Per Day */}</td>
      {games.map((numGames, i) => (
        <td
          className={`${styles.totalGamesPerDayCell} ${
            numGames > 8 ? styles.redBorder : styles.greenBorder
          }`}
          key={i}
          style={{ position: "relative" }}
        >
          {/* gray block */}
          <div
            style={
              !extended && excludedDaysIdx.includes(i)
                ? {
                    backgroundColor: "rgb(80, 80, 80, 0.85)",
                    width: "100%",
                    height: "100%",
                    position: "absolute",
                    left: 0,
                    top: 0,
                  }
                : {}
            }
          />
          {numGames}
        </td>
      ))}
      {!extended && (
        <>
          {/* Total GP */}
          <td>{calcTotalGP(games, excludedDays)}</td>
          {/* Total Off-Nights */}
          <td>{calcTotalOffNights(games, excludedDays)}</td>
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
