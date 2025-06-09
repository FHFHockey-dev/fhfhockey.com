import React from "react";
import styles from "../../styles/GoalieWorkloadBars.module.scss";

const GoalieWorkloadBars = ({ goalieData, teamColors, mobileView }) => {
  if (!goalieData || goalieData.length === 0) {
    return <div className={styles.noData}>No goalie data available</div>;
  }

  // Calculate total games for percentage calculations
  const totalGames = goalieData.reduce(
    (sum, goalie) => sum + goalie.gamesPlayed,
    0
  );

  return (
    <div className={styles.workloadContainer}>
      {goalieData.map((goalie, index) => {
        const percentage =
          totalGames > 0 ? (goalie.gamesPlayed / totalGames) * 100 : 0;
        const barColor = teamColors[index % teamColors.length];

        return (
          <div key={goalie.goalieId || index} className={styles.goalieBar}>
            <div className={styles.goalieInfo}>
              <span className={styles.goalieName}>
                {mobileView ? goalie.lastName : goalie.goalieFullName}
              </span>
              <span className={styles.goalieStats}>
                {goalie.gamesPlayed}G ({percentage.toFixed(1)}%)
              </span>
            </div>
            <div className={styles.barContainer}>
              <div
                className={styles.workloadBar}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: barColor,
                  boxShadow: `0 0 8px ${barColor}40`
                }}
              />
            </div>
            <div className={styles.additionalStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>W-L-OT:</span>
                <span className={styles.statValue}>
                  {goalie.wins}-{goalie.losses}-{goalie.otLosses}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>SV%:</span>
                <span className={styles.statValue}>
                  {goalie.savePercentage?.toFixed(3) || "0.000"}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>GAA:</span>
                <span className={styles.statValue}>
                  {goalie.goalsAgainstAverage?.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GoalieWorkloadBars;
