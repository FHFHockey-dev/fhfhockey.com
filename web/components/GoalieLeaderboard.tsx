// web/components/GoalieLeaderboard.tsx

import React from "react";
import styles from "../styles/Goalies.module.scss";
import { GoalieRanking } from "lib/supabase/GoaliePage/types";

interface Props {
  goalieRankings: GoalieRanking[];
  setView: React.Dispatch<React.SetStateAction<string>>;
}

const GoalieLeaderboard: React.FC<Props> = ({ goalieRankings, setView }) => {
  console.log("Rendering Goalie Leaderboard with Rankings:", goalieRankings);

  if (goalieRankings.length === 0) {
    return <p>No rankings available. Please select a range and submit.</p>;
  }

  // Function to determine percentage class
  const getPercentageClass = (percentage: number) => {
    if (percentage > 65) return styles.percentHigh;
    if (percentage > 50) return styles.percentMedium;
    return styles.percentLow;
  };

  return (
    <div className={styles.tableContainer}>
      <button
        className={styles.weekLeaderboardButton}
        onClick={() => setView("week")}
      >
        View Detailed Stats
      </button>
      <table className={styles.goalieTable}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Ranking</th>
            <th>Elite Weeks</th>
            <th>Quality Weeks</th>
            <th>Weeks</th>
            <th>Bad Weeks</th>
            <th>Really Bad Weeks</th>
            <th>% OK Weeks</th> {/* New Column */}
            <th>% Good Weeks</th> {/* New Column */}
          </tr>
        </thead>
        <tbody>
          {goalieRankings.map((goalie, index) => (
            <tr key={`${goalie.playerId}-${index}`}>
              <td>{goalie.goalieFullName}</td>
              <td>{index + 1}</td>
              <td>{goalie.weekCounts["Elite Week"] || 0}</td>
              <td>{goalie.weekCounts["Quality Week"] || 0}</td>
              <td>{goalie.weekCounts["Week"] || 0}</td>
              <td>{goalie.weekCounts["Bad Week"] || 0}</td>
              <td>{goalie.weekCounts["Really Bad Week"] || 0}</td>
              <td
                className={getPercentageClass(
                  goalie.percentAcceptableWeeks || 0
                )}
              >
                {(goalie.percentAcceptableWeeks ?? 0).toFixed(2)}%
              </td>
              <td className={getPercentageClass(goalie.percentGoodWeeks || 0)}>
                {(goalie.percentGoodWeeks ?? 0).toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GoalieLeaderboard;
