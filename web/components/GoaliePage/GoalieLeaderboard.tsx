// web/components/GoaliePage/GoalieLeaderboard.tsx

import React, { FC } from "react";
import styles from "styles/Goalies.module.scss";
// Import the GoalieRanking type which now includes variance
import type { GoalieRanking, Ranking } from "components/GoaliePage/goalieTypes"; // Adjust path

interface Props {
  goalieRankings: GoalieRanking[]; // Expects rankings with variance
  setView: React.Dispatch<React.SetStateAction<"leaderboard" | "week">>;
  // selectedStats?: NumericGoalieStatKey[]; // Optional: if needed for context
}

const GoalieLeaderboard: FC<Props> = ({ goalieRankings, setView }) => {
  if (!goalieRankings || goalieRankings.length === 0) {
    return (
      <p className={styles.standoutNote}>
        No rankings available. Select a date range and ensure data is fetched.
      </p>
    );
  }

  // Function to determine percentage class (unchanged)
  const getPercentageClass = (percentage: number | undefined): string => {
    // ... (keep existing logic)
    const p = percentage ?? 0; // Default to 0 if undefined
    if (p >= 65) return styles.percentHigh; // Use >= for clarity
    if (p >= 50) return styles.percentMedium;
    return styles.percentLow;
  };

  // Helper to safely access week counts (unchanged)
  const getWeekCount = (goalie: GoalieRanking, rank: Ranking): number => {
    // Use new ranking names ('Average' instead of 'Week')
    return goalie?.weekCounts?.[rank] ?? 0;
  };

  return (
    <div className={styles.tableContainer}>
      {/* Button to switch to single week view (now goes to 'week' state) */}
      {/* <button
         className={styles.weekLeaderboardButton}
         onClick={() => setView("week")} // Keep if desired, maybe less prominent
       >
         View Single Week Stats
       </button> */}
      <h2 className={styles.tableHeader}>Goalie Ranking Leaderboard</h2>
      <table className={styles.goalieTable}>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Team</th>
            <th>Total Pts</th>
            <th>Elite Wks</th>
            <th>Qual. Wks</th>
            <th>Avg. Wks</th>
            {/* Changed */}
            <th>Bad Wks</th>
            <th>R. Bad Wks</th>
            <th>% OK Wks</th>
            <th>% Good Wks</th>
            <th>
              WoW Var{" "}
              <span title="Week-over-Week Performance Variance (StdDev of Weekly Points)">
                &#9432;
              </span>
            </th>
            {/* Added */}
            <th>
              GoG Var{" "}
              <span title="Game-over-Game Performance Variance (StdDev of Game Points)">
                &#9432;
              </span>
            </th>
            {/* Added */}
            {/* Optional: Add overall stats */}
            <th>GP</th>
            <th>W</th>
            <th>SV%</th>
            <th>GAA</th>
          </tr>
        </thead>
        <tbody>
          {goalieRankings.map((goalie, index) =>
            !goalie ? null : ( // Basic check
              <tr key={`${goalie.playerId}-${index}`}>
                <td>{index + 1}</td>
                <td>{goalie.goalieFullName ?? "N/A"}</td>
                <td>{goalie.team ?? "N/A"}</td>
                <td>{goalie.totalPoints ?? 0}</td>
                {/* Use helper with updated Ranking names */}
                <td>{getWeekCount(goalie, "Elite")}</td>
                <td>{getWeekCount(goalie, "Quality")}</td>
                <td>{getWeekCount(goalie, "Average")}</td>
                {/* Changed */}
                <td>{getWeekCount(goalie, "Bad")}</td>
                <td>{getWeekCount(goalie, "Really Bad")}</td>
                {/* Percentage columns (unchanged logic) */}
                <td
                  className={getPercentageClass(goalie.percentAcceptableWeeks)}
                >
                  {(goalie.percentAcceptableWeeks ?? 0).toFixed(1)}%
                </td>
                <td className={getPercentageClass(goalie.percentGoodWeeks)}>
                  {(goalie.percentGoodWeeks ?? 0).toFixed(1)}%
                </td>
                {/* Variance columns */}
                <td>{goalie.wowVariance?.toFixed(2) ?? "N/A"}</td>
                {/* Added */}
                <td>{goalie.gogVariance?.toFixed(2) ?? "N/A"}</td>
                {/* Added */}
                {/* Optional: Display overall stats */}
                <td>{goalie.totalGamesPlayed ?? "N/A"}</td>
                <td>{goalie.totalWins ?? "N/A"}</td>
                <td>{goalie.overallSavePct?.toFixed(3) ?? "N/A"}</td>
                <td>{goalie.overallGaa?.toFixed(2) ?? "N/A"}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
      <p className={styles.varianceNote}>
        Lower Variance (WoW Var, GoG Var) indicates more consistent performance
        week-to-week and game-to-game respectively.
      </p>
    </div>
  );
};

export default GoalieLeaderboard;
