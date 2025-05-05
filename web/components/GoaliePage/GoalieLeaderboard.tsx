// web/components/GoaliePage/GoalieLeaderboard.tsx

import React, { FC } from "react";
import styles from "styles/Goalies.module.scss";
// Import updated types
import type {
  GoalieRanking,
  Ranking,
  StatColumn, // Import StatColumn
  NumericGoalieStatKey // Import NumericGoalieStatKey
} from "components/GoaliePage/goalieTypes";

interface Props {
  goalieRankings: GoalieRanking[];
  setView: React.Dispatch<React.SetStateAction<"leaderboard" | "week">>;
  statColumns: StatColumn[]; // Receive stat columns for percentile headers
}

const GoalieLeaderboard: FC<Props> = ({
  goalieRankings,
  setView,
  statColumns
}) => {
  if (!goalieRankings || goalieRankings.length === 0) {
    return (
      <p className={styles.standoutNote}>
        No rankings available. Select a date range, ensure data is fetched, and
        check fantasy settings.
      </p>
    );
  }

  // Function to determine percentage class (unchanged)
  const getPercentageClass = (percentage: number | undefined): string => {
    const p = percentage ?? 0;
    if (p >= 65) return styles.percentHigh;
    if (p >= 50) return styles.percentMedium;
    return styles.percentLow;
  };

  // Helper to safely access week counts (unchanged)
  const getWeekCount = (goalie: GoalieRanking, rank: Ranking): number => {
    return goalie?.weekCounts?.[rank] ?? 0;
  };

  // Get stat keys that have percentiles calculated (based on calculation logic)
  const percentileKeys = statColumns
    .map((c) => c.value)
    .filter(
      (key) =>
        goalieRankings[0]?.percentiles && // Check if percentiles exist on first goalie
        goalieRankings[0].percentiles[key] !== undefined
    ) as NumericGoalieStatKey[];

  return (
    <div className={styles.tableContainer}>
      <h2 className={styles.tableHeader}>Goalie Ranking Leaderboard</h2>
      <table className={styles.goalieTable}>
        <thead>
          <tr>
            {/* Core Info */}
            <th>Rank</th>
            <th>Name</th>
            <th>Team</th>
            {/* WoW Ranking */}
            <th>WoW Pts</th>
            <th>El Wk</th>
            <th>Ql Wk</th>
            <th>Av Wk</th>
            <th>Bd Wk</th>
            <th>RB Wk</th>
            <th>% OK</th>
            <th>% Good</th>
            {/* Variance */}
            <th>
              WoW Var{" "}
              <span title="Week-over-Week Ranking Variance (StdDev of Weekly Points vs League Avg)">
                &#9432;
              </span>
            </th>
            <th>
              GoG Var{" "}
              <span title="Game-over-Game Fantasy Point Variance (StdDev of Game fPts)">
                &#9432;
              </span>
            </th>
            {/* Fantasy Points */}
            <th>
              Avg fPts/G{" "}
              <span title="Average Fantasy Points Scored Per Game Played">
                &#9432;
              </span>
            </th>
            <th>
              +/- Lg Avg fPts{" "}
              <span title="Goalie Avg fPts/G vs League Avg fPts/G for the period">
                &#9432;
              </span>
            </th>
            {/* Percentiles */}
            <th>
              Avg %ile{" "}
              <span title="Average Percentile Rank across key statistics">
                &#9432;
              </span>
            </th>
            {/* Uncomment to show individual percentiles */}
            {/* {percentileKeys.map(key => {
                            const col = statColumns.find(c => c.value === key);
                            return <th key={`pctl-th-${key}`}>{col?.label ?? key} %ile</th>;
                        })} */}
            {/* Overall Stats */}
            <th>GP</th>
            {/* <th>W</th> */}
            <th>SV%</th>
            <th>GAA</th>
          </tr>
        </thead>
        <tbody>
          {goalieRankings.map((goalie, index) => {
            if (!goalie) return null;

            // Calculate fPts difference from league average
            const fPtsDiff =
              goalie.leagueAverageFantasyPointsPerGame !== undefined
                ? goalie.averageFantasyPointsPerGame -
                  goalie.leagueAverageFantasyPointsPerGame
                : undefined;

            return (
              <tr key={`${goalie.playerId}-${index}`}>
                {/* Core Info */}
                <td>{index + 1}</td>
                <td>{goalie.goalieFullName ?? "N/A"}</td>
                <td>{goalie.team ?? "N/A"}</td>
                {/* WoW Ranking */}
                <td>{goalie.totalPoints ?? 0}</td>
                <td>{getWeekCount(goalie, "Elite")}</td>
                <td>{getWeekCount(goalie, "Quality")}</td>
                <td>{getWeekCount(goalie, "Average")}</td>
                <td>{getWeekCount(goalie, "Bad")}</td>
                <td>{getWeekCount(goalie, "Really Bad")}</td>
                <td
                  className={getPercentageClass(goalie.percentAcceptableWeeks)}
                >
                  {(goalie.percentAcceptableWeeks ?? 0).toFixed(1)}%
                </td>
                <td className={getPercentageClass(goalie.percentGoodWeeks)}>
                  {(goalie.percentGoodWeeks ?? 0).toFixed(1)}%
                </td>
                {/* Variance */}
                <td>{goalie.wowVariance?.toFixed(2) ?? "N/A"}</td>
                <td>{goalie.gogVariance?.toFixed(2) ?? "N/A"}</td>
                {/* Fantasy Points */}
                <td>
                  {goalie.averageFantasyPointsPerGame?.toFixed(2) ?? "N/A"}
                </td>
                <td>
                  {fPtsDiff !== undefined
                    ? `${fPtsDiff >= 0 ? "+" : ""}${fPtsDiff.toFixed(2)}`
                    : "N/A"}
                </td>
                {/* Percentiles */}
                <td
                  className={getPercentageClass(goalie.averagePercentileRank)}
                >
                  {goalie.averagePercentileRank?.toFixed(1) ?? "N/A"}%
                </td>
                {/* Uncomment to show individual percentiles */}
                {/* {percentileKeys.map(key => (
                                    <td key={`pctl-td-${goalie.playerId}-${key}`} className={getPercentageClass(goalie.percentiles?.[key])}>
                                        {goalie.percentiles?.[key]?.toFixed(1) ?? 'N/A'}%
                                    </td>
                                ))} */}
                {/* Overall Stats */}
                <td>{goalie.totalGamesPlayed ?? "N/A"}</td>
                {/* <td>{goalie.totalWins ?? "N/A"}</td> */}
                <td>{goalie.overallSavePct?.toFixed(3) ?? "N/A"}</td>
                <td>{goalie.overallGaa?.toFixed(2) ?? "N/A"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.varianceNote}>
        Lower Variance (WoW Var, GoG Var) indicates more consistent performance.
        Avg %ile shows overall statistical rank vs peers (higher is better).
        Fantasy Points (fPts) calculated based on settings.
      </p>
    </div>
  );
};

export default GoalieLeaderboard;
