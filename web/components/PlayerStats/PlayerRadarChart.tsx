import React, { useMemo } from "react";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from "chart.js";
import styles from "./PlayerStats.module.scss";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface GameLogEntry {
  date: string;
  [key: string]: any;
}

interface PlayerInfo {
  id: number;
  fullName: string;
  position: string;
}

interface PlayerRadarChartProps {
  player: PlayerInfo;
  gameLog: GameLogEntry[];
  selectedStats: string[];
  isGoalie: boolean;
}

const PERCENTILE_THRESHOLDS = {
  // Skater thresholds (per game averages)
  points: { elite: 1.2, good: 0.8, average: 0.5 },
  goals: { elite: 0.6, good: 0.4, average: 0.25 },
  assists: { elite: 0.8, good: 0.5, average: 0.3 },
  shots: { elite: 3.5, good: 2.5, average: 1.8 },
  shooting_percentage: { elite: 15, good: 12, average: 8 },
  hits: { elite: 2.5, good: 1.8, average: 1.0 },
  blocked_shots: { elite: 1.5, good: 1.0, average: 0.6 },
  fow_percentage: { elite: 55, good: 50, average: 45 },
  toi_per_game: { elite: 22, good: 18, average: 14 },
  sat_pct: { elite: 55, good: 52, average: 48 },

  // Goalie thresholds
  save_pct: { elite: 0.925, good: 0.915, average: 0.9 },
  goals_against_avg: { elite: 2.2, good: 2.7, average: 3.2 }, // Inverted: lower is better
  wins: { elite: 0.7, good: 0.5, average: 0.3 }, // Win rate
  saves: { elite: 30, good: 25, average: 20 },
  shutouts: { elite: 0.15, good: 0.08, average: 0.03 } // Per game
};

const STAT_DISPLAY_NAMES: { [key: string]: string } = {
  points: "PTS",
  goals: "G",
  assists: "A",
  shots: "SOG",
  shooting_percentage: "SH%",
  hits: "HIT",
  blocked_shots: "BLK",
  fow_percentage: "FO%",
  toi_per_game: "TOI/GP",
  sat_pct: "CF%",
  save_pct: "SV%",
  goals_against_avg: "GAA",
  wins: "W",
  shutouts: "SO"
};

export function PlayerRadarChart({
  player,
  gameLog,
  selectedStats,
  isGoalie
}: PlayerRadarChartProps) {
  const radarData = useMemo(() => {
    if (gameLog.length === 0 || selectedStats.length === 0) return null;

    // Calculate averages for selected stats
    const gamesPlayed = gameLog.reduce(
      (sum, game) => sum + (game.games_played || 0),
      0
    );

    const averages: { [key: string]: number } = {};
    const percentiles: { [key: string]: number } = {};

    selectedStats.forEach((stat) => {
      const values = gameLog.map((game) => Number(game[stat]) || 0);

      if (stat === "wins" && isGoalie) {
        // Special handling for goalie win percentage
        const wins = values.reduce((sum, val) => sum + val, 0);
        averages[stat] = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
      } else if (stat === "shutouts" && isGoalie) {
        // Shutouts per game
        const shutouts = values.reduce((sum, val) => sum + val, 0);
        averages[stat] = gamesPlayed > 0 ? (shutouts / gamesPlayed) * 100 : 0;
      } else if (
        [
          "shooting_percentage",
          "save_pct",
          "fow_percentage",
          "sat_pct"
        ].includes(stat)
      ) {
        // Weighted average for percentages
        const weights = gameLog.map((game) => game.games_played || 1);
        const weightedSum = values.reduce(
          (sum, val, idx) => sum + val * weights[idx],
          0
        );
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        averages[stat] = totalWeight > 0 ? weightedSum / totalWeight : 0;
      } else {
        // Per-game average for counting stats
        const total = values.reduce((sum, val) => sum + val, 0);
        averages[stat] = gamesPlayed > 0 ? total / gamesPlayed : 0;
      }

      // Calculate percentile based on thresholds
      const thresholds =
        PERCENTILE_THRESHOLDS[stat as keyof typeof PERCENTILE_THRESHOLDS];
      if (thresholds) {
        const value = averages[stat];

        if (stat === "goals_against_avg") {
          // Inverted for GAA (lower is better)
          if (value <= thresholds.elite) percentiles[stat] = 95;
          else if (value <= thresholds.good) percentiles[stat] = 75;
          else if (value <= thresholds.average) percentiles[stat] = 50;
          else
            percentiles[stat] = Math.max(
              20,
              50 - (value - thresholds.average) * 10
            );
        } else {
          if (value >= thresholds.elite) percentiles[stat] = 95;
          else if (value >= thresholds.good) percentiles[stat] = 75;
          else if (value >= thresholds.average) percentiles[stat] = 50;
          else
            percentiles[stat] = Math.max(10, (value / thresholds.average) * 50);
        }
      } else {
        percentiles[stat] = 50; // Default to average if no thresholds
      }
    });

    const labels = selectedStats.map(
      (stat) => STAT_DISPLAY_NAMES[stat] || stat
    );
    const data = selectedStats.map((stat) => percentiles[stat] || 0);

    return {
      labels,
      datasets: [
        {
          label: player.fullName,
          data,
          backgroundColor: isGoalie
            ? "rgba(239, 68, 68, 0.2)"
            : "rgba(59, 130, 246, 0.2)",
          borderColor: isGoalie
            ? "rgba(239, 68, 68, 0.8)"
            : "rgba(59, 130, 246, 0.8)",
          borderWidth: 2,
          pointBackgroundColor: isGoalie
            ? "rgba(239, 68, 68, 1)"
            : "rgba(59, 130, 246, 1)",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: isGoalie
            ? "rgba(239, 68, 68, 1)"
            : "rgba(59, 130, 246, 1)",
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ],
      averages,
      percentiles
    };
  }, [gameLog, selectedStats, isGoalie, player.fullName]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        borderColor: "#333333",
        borderWidth: 1,
        cornerRadius: 4,
        padding: 8,
        callbacks: {
          label: (context: any) => {
            return `${STAT_DISPLAY_NAMES[selectedStats[context.dataIndex]] || selectedStats[context.dataIndex]}: ${context.formattedValue}`;
          }
        }
      }
    },
    scales: {
      r: {
        beginAtZero: true,
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          font: {
            size: 10
          },
          color: "#888888"
        },
        grid: {
          color: "#333333"
        },
        angleLines: {
          color: "#333333"
        },
        pointLabels: {
          font: {
            size: 11,
            weight: "bold" as const
          },
          color: "#ffffff"
        }
      }
    },
    elements: {
      point: {
        radius: 3,
        hoverRadius: 5
      },
      line: {
        borderWidth: 2
      }
    }
  };

  if (!radarData || gameLog.length === 0) {
    return (
      <div className={styles.radarContainer}>
        <h3>Performance Profile</h3>
        <div className={styles.noData}>No data available for radar chart</div>
      </div>
    );
  }

  return (
    <div className={styles.radarContainer}>
      <div className={styles.radarHeader}>
        <h3>Performance Profile</h3>
        <p>
          Percentile rankings vs {isGoalie ? "goalies" : `${player.position}s`}
        </p>
      </div>

      <div className={styles.radarWrapper}>
        <Radar data={radarData} options={options} />
      </div>

      <div className={styles.radarLegend}>
        <div className={styles.percentileGuide}>
          <span className={styles.percentileItem}>
            <strong>95th+ percentile:</strong> Elite
          </span>
          <span className={styles.percentileItem}>
            <strong>75th+ percentile:</strong> Above Average
          </span>
          <span className={styles.percentileItem}>
            <strong>50th percentile:</strong> League Average
          </span>
          <span className={styles.percentileItem}>
            <strong>25th percentile:</strong> Below Average
          </span>
        </div>
      </div>

      <div className={styles.radarStats}>
        {selectedStats.map((stat) => (
          <div key={stat} className={styles.statBreakdown}>
            <span className={styles.statName}>
              {STAT_DISPLAY_NAMES[stat] || stat}:
            </span>
            <span className={styles.statValue}>
              {(() => {
                const average = radarData.averages[stat];
                if (
                  stat === "shooting_percentage" ||
                  stat === "save_pct" ||
                  stat === "fow_percentage" ||
                  stat === "sat_pct"
                ) {
                  return `${average.toFixed(1)}%`;
                } else if (stat === "goals_against_avg") {
                  return average.toFixed(2);
                } else if (stat === "toi_per_game") {
                  const minutes = Math.floor(average);
                  const seconds = Math.round((average - minutes) * 60);
                  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
                } else {
                  return average.toFixed(2);
                }
              })()}
            </span>
            <span
              className={`${styles.percentile} ${
                radarData.percentiles[stat] >= 75
                  ? styles.good
                  : radarData.percentiles[stat] >= 50
                    ? styles.average
                    : styles.poor
              }`}
            >
              {radarData.percentiles[stat].toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
