import React from "react";
import styles from "styles/Goalies.module.scss";

const GoalieLeaderboard = ({ goalieRankings, setView }) => {
  return (
    <div>
      <button onClick={() => setView("week")}>Select Week</button>
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
          </tr>
        </thead>
        <tbody>
          {goalieRankings.map((goalie, index) => (
            <tr key={goalie.playerId}>
              <td>{goalie.goalieFullName}</td>
              <td>{index + 1}</td>
              <td>{goalie.weekCounts["Elite Week"]}</td>
              <td>{goalie.weekCounts["Quality Week"]}</td>
              <td>{goalie.weekCounts["Week"]}</td>
              <td>{goalie.weekCounts["Bad Week"]}</td>
              <td>{goalie.weekCounts["Really Bad Week"]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GoalieLeaderboard;
