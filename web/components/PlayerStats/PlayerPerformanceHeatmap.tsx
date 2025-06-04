import React, { useMemo } from "react";
import styles from "./PlayerStats.module.scss";

interface GameLogEntry {
  date: string;
  [key: string]: any;
}

interface PlayerPerformanceHeatmapProps {
  gameLog: GameLogEntry[];
  selectedStats: string[];
}

export function PlayerPerformanceHeatmap({
  gameLog,
  selectedStats
}: PlayerPerformanceHeatmapProps) {
  const heatmapData = useMemo(() => {
    if (gameLog.length === 0 || selectedStats.length === 0) return null;

    // Calculate composite performance score for each game
    const gamesWithScores = gameLog.map((game) => {
      let totalScore = 0;
      let validStats = 0;

      selectedStats.forEach((stat) => {
        const value = Number(game[stat]);
        if (!isNaN(value)) {
          // Normalize different stat types to 0-100 scale
          let normalizedScore = 0;

          if (stat === "points") {
            normalizedScore = Math.min(value * 25, 100); // 4 points = 100%
          } else if (stat === "goals") {
            normalizedScore = Math.min(value * 33, 100); // 3 goals = 100%
          } else if (stat === "assists") {
            normalizedScore = Math.min(value * 25, 100); // 4 assists = 100%
          } else if (stat === "save_pct") {
            normalizedScore = Math.max(0, (value - 0.85) * 667); // .850-.950 = 0-100%
          } else if (stat === "goals_against_avg") {
            normalizedScore = Math.max(0, 100 - (value - 1.5) * 40); // 1.5-4.0 GAA = 100-0%
          } else if (stat === "shooting_percentage") {
            normalizedScore = Math.min(value * 5, 100); // 20% = 100%
          } else if (stat === "shots") {
            normalizedScore = Math.min(value * 12.5, 100); // 8 shots = 100%
          } else if (stat === "hits") {
            normalizedScore = Math.min(value * 12.5, 100); // 8 hits = 100%
          } else if (stat === "blocked_shots") {
            normalizedScore = Math.min(value * 16.7, 100); // 6 blocks = 100%
          } else if (stat === "wins" && value > 0) {
            normalizedScore = 100; // Win = 100%
          } else if (stat === "saves") {
            normalizedScore = Math.min((value - 15) * 2.86, 100); // 15-50 saves = 0-100%
          } else {
            // Default: use value directly up to 10
            normalizedScore = Math.min(value * 10, 100);
          }

          totalScore += normalizedScore;
          validStats++;
        }
      });

      const averageScore = validStats > 0 ? totalScore / validStats : 0;

      return {
        ...game,
        performanceScore: averageScore,
        date: new Date(game.date)
      };
    });

    // Sort by date
    gamesWithScores.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Group by month for layout
    const monthGroups: { [key: string]: typeof gamesWithScores } = {};
    gamesWithScores.forEach((game) => {
      const monthKey = `${game.date.getFullYear()}-${game.date.getMonth()}`;
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(game);
    });

    return {
      games: gamesWithScores,
      monthGroups,
      maxScore: Math.max(...gamesWithScores.map((g) => g.performanceScore)),
      minScore: Math.min(...gamesWithScores.map((g) => g.performanceScore))
    };
  }, [gameLog, selectedStats]);

  const getPerformanceColor = (score: number, maxScore: number): string => {
    if (score === 0) return "#1f2937"; // Dark gray for no data

    const intensity = Math.min(score / Math.max(maxScore, 50), 1); // Cap at reasonable max

    if (intensity >= 0.8) return "#10b981"; // Excellent - Green
    if (intensity >= 0.6) return "#3b82f6"; // Good - Blue
    if (intensity >= 0.4) return "#f59e0b"; // Average - Amber
    if (intensity >= 0.2) return "#ef4444"; // Poor - Red
    return "#6b7280"; // Very poor - Gray
  };

  const getPerformanceLabel = (score: number): string => {
    if (score === 0) return "No Data";
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Average";
    if (score >= 20) return "Below Average";
    return "Poor";
  };

  if (!heatmapData || gameLog.length === 0) {
    return (
      <div className={styles.heatmapContainer}>
        <h3>Performance Calendar</h3>
        <div className={styles.noData}>No games available to display</div>
      </div>
    );
  }

  return (
    <div className={styles.heatmapContainer}>
      <div className={styles.heatmapHeader}>
        <h3>Performance Calendar</h3>
        <div className={styles.legend}>
          <span className={styles.legendLabel}>Performance:</span>
          {[
            { label: "Excellent", color: "#10b981" },
            { label: "Good", color: "#3b82f6" },
            { label: "Average", color: "#f59e0b" },
            { label: "Poor", color: "#ef4444" },
            { label: "No Data", color: "#1f2937" }
          ].map((item) => (
            <div key={item.label} className={styles.legendItem}>
              <div
                className={styles.legendColor}
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.heatmapGrid}>
        {Object.entries(heatmapData.monthGroups).map(([monthKey, games]) => {
          const firstGame = games[0];
          const monthName = firstGame.date.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
          });

          return (
            <div key={monthKey} className={styles.monthGroup}>
              <h4 className={styles.monthHeader}>{monthName}</h4>
              <div className={styles.gamesGrid}>
                {games.map((game, index) => (
                  <div
                    key={`${game.date.toISOString()}-${index}`}
                    className={styles.gameCell}
                    style={{
                      backgroundColor: getPerformanceColor(
                        game.performanceScore,
                        heatmapData.maxScore
                      )
                    }}
                    title={`${game.date.toLocaleDateString()}: ${getPerformanceLabel(game.performanceScore)} (${game.performanceScore.toFixed(1)})`}
                  >
                    <div className={styles.gameDate}>{game.date.getDate()}</div>
                    <div className={styles.gameScore}>
                      {game.performanceScore.toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.heatmapFooter}>
        <p className={styles.explanation}>
          Each cell represents one game. Color intensity and score reflect
          overall performance based on selected statistics. Hover for details.
        </p>
        <div className={styles.stats}>
          <span>Best Game: {heatmapData.maxScore.toFixed(1)}</span>
          <span>
            Average:{" "}
            {(
              heatmapData.games.reduce(
                (sum, g) => sum + g.performanceScore,
                0
              ) / heatmapData.games.length
            ).toFixed(1)}
          </span>
          <span>Total Games: {heatmapData.games.length}</span>
        </div>
      </div>
    </div>
  );
}
