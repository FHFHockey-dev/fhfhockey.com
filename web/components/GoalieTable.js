import React from "react";
import styles from "styles/Goalies.module.scss";
import { calculateRanking } from "../pages/goalies";

const calculateAverages = (goalies) => {
  const totals = goalies.reduce(
    (acc, goalie) => {
      acc.gamesPlayed += goalie.gamesPlayed;
      acc.gamesStarted += goalie.gamesStarted;
      acc.wins += goalie.wins;
      acc.losses += goalie.losses;
      acc.otLosses += goalie.otLosses;
      acc.saves += goalie.saves;
      acc.shotsAgainst += goalie.shotsAgainst;
      acc.goalsAgainst += goalie.goalsAgainst;
      acc.shutouts += goalie.shutouts;
      acc.timeOnIce += goalie.timeOnIce;
      return acc;
    },
    {
      gamesPlayed: 0,
      gamesStarted: 0,
      wins: 0,
      losses: 0,
      otLosses: 0,
      saves: 0,
      shotsAgainst: 0,
      goalsAgainst: 0,
      shutouts: 0,
      timeOnIce: 0,
    }
  );

  const numGoalies = goalies.length;

  return {
    gamesPlayed: (totals.gamesPlayed / numGoalies).toFixed(2),
    gamesStarted: (totals.gamesStarted / numGoalies).toFixed(2),
    wins: (totals.wins / numGoalies).toFixed(2),
    losses: (totals.losses / numGoalies).toFixed(2),
    otLosses: (totals.otLosses / numGoalies).toFixed(2),
    saves: (totals.saves / numGoalies).toFixed(2),
    shotsAgainst: (totals.shotsAgainst / numGoalies).toFixed(2),
    goalsAgainst: (totals.goalsAgainst / numGoalies).toFixed(2),
    savePct: (totals.saves / totals.shotsAgainst).toFixed(3),
    goalsAgainstAverage: (totals.goalsAgainst / numGoalies).toFixed(2),
    shutouts: (totals.shutouts / numGoalies).toFixed(2),
    timeOnIce: (totals.timeOnIce / numGoalies).toFixed(2),
  };
};

const GoalieTable = ({
  goalies,
  selectedStats,
  statColumns,
  handleStatChange,
  setView,
}) => {
  const averages = calculateAverages(goalies);

  const goaliesWithRankings = goalies.map((goalie) => {
    const { percentage, ranking } = calculateRanking(
      goalie,
      averages,
      selectedStats
    );
    return { ...goalie, percentage, ranking };
  });

  const sortedGoalies = goaliesWithRankings.sort(
    (a, b) => b.percentage - a.percentage
  );

  const compareStats = (stat, value) => {
    const statMap = {
      gamesPlayed: "larger",
      gamesStarted: "larger",
      wins: "larger",
      losses: "smaller",
      otLosses: "smaller",
      saves: "larger",
      shotsAgainst: "larger",
      goalsAgainst: "smaller",
      savePct: "larger",
      goalsAgainstAverage: "smaller",
      shutouts: "larger",
      timeOnIce: "larger",
    };

    const averageValue = averages[stat];
    const comparisonType = statMap[stat];
    if (comparisonType === "larger") {
      return value >= averageValue ? styles.better : styles.worse;
    } else {
      return value <= averageValue ? styles.better : styles.worse;
    }
  };

  return (
    <div>
      <button onClick={() => setView("leaderboard")}>
        Back to Leaderboard
      </button>
      <table className={styles.goalieTable}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Team</th>
            {statColumns.map((stat) => (
              <th key={stat.value}>{stat.label}</th>
            ))}
          </tr>
          <tr>
            <td colSpan="2">Compare</td>
            {statColumns.map((stat) => (
              <td key={stat.value}>
                <input
                  type="checkbox"
                  value={stat.value}
                  checked={selectedStats.includes(stat.value)}
                  onChange={handleStatChange}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td colSpan="2">Averages</td>
            {statColumns.map((stat) => (
              <td key={stat.value}>{averages[stat.value]}</td>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedGoalies.map((goalie) => (
            <tr key={goalie.playerId}>
              <td>{goalie.goalieFullName}</td>
              <td>{goalie.team}</td>
              {statColumns.map((stat) => (
                <td
                  key={stat.value}
                  className={
                    selectedStats.includes(stat.value)
                      ? compareStats(stat.value, goalie[stat.value])
                      : ""
                  }
                >
                  {goalie[stat.value]}
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
