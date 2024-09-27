// web/components/GoalieTable.tsx

import React from "react";
import styles from "../styles/Goalies.module.scss";
import {
  GoalieWithRanking,
  NumericStatKey,
} from "lib/supabase/GoaliePage/types";
import { calculateAverages } from "lib/supabase/GoaliePage/calculateAverages";

interface Props {
  goalies: GoalieWithRanking[];
  selectedStats: NumericStatKey[];
  statColumns: { label: string; value: string }[];
  setView: React.Dispatch<React.SetStateAction<string>>;
  startDate: string;
  endDate: string;
}

const GoalieTable: React.FC<Props> = ({
  goalies,
  selectedStats,
  statColumns,
  setView,
  startDate,
  endDate,
}) => {
  // Calculate league averages based on the provided goalies
  const averages = calculateAverages(goalies);

  // Function to determine class based on percentage
  const getPercentageClass = (percentage: number) => {
    if (percentage > 75) return styles.percentHigh;
    if (percentage > 50) return styles.percentMedium;
    return styles.percentLow;
  };

  return (
    <div>
      <button
        className={styles.weekLeaderboardButton}
        onClick={() => setView("leaderboard")}
      >
        Back to Leaderboard
      </button>
      <h2 className={styles.tableHeader}>
        True Goalie Value from {startDate} to {endDate}
      </h2>
      <table className={styles.goalieTable}>
        <thead>
          <tr>
            <td colSpan={2}>League Averages:</td>
            {statColumns.map((stat) => (
              <td key={stat.value}>
                {stat.value === "savePct" ||
                stat.value === "goalsAgainstAverage"
                  ? averages[stat.value as NumericStatKey].toFixed(3)
                  : averages[stat.value as NumericStatKey].toFixed(2)}
              </td>
            ))}
            <td colSpan={2}></td>
          </tr>
          <tr>
            <th>Name</th>
            <th>Team</th>
            {statColumns.map((stat) => (
              <th key={stat.value}>{stat.label}</th>
            ))}
            <th>% &gt; AVG</th>
            <th>Ranking</th>
          </tr>
        </thead>
        <tbody>
          {goalies.map((goalie) => (
            <tr key={goalie.playerId}>
              <td>{goalie.goalieFullName}</td>
              <td>{goalie.team}</td>
              {statColumns.map((stat) => (
                <td
                  key={stat.value}
                  className={
                    selectedStats.includes(stat.value as NumericStatKey)
                      ? goalie[stat.value as NumericStatKey] !== undefined
                        ? goalie[stat.value as NumericStatKey] >=
                          averages[stat.value as NumericStatKey]
                          ? styles.better
                          : styles.worse
                        : ""
                      : ""
                  }
                >
                  {stat.value === "savePct" ||
                  stat.value === "goalsAgainstAverage"
                    ? goalie[stat.value as NumericStatKey].toFixed(2)
                    : goalie[stat.value as NumericStatKey]}
                </td>
              ))}
              <td>{goalie.percentage.toFixed(2)}%</td>
              <td>{goalie.ranking}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GoalieTable;
