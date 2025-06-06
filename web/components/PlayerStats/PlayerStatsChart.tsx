import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import styles from "./PlayerStats.module.scss";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface GameLogEntry {
  date: string;
  [key: string]: any;
}

interface PlayerStatsChartProps {
  gameLog: GameLogEntry[];
  playoffGameLog?: GameLogEntry[]; // Add optional playoff game log
  selectedStats: string[];
  showRollingAverage?: boolean;
  title?: string;
  showPlayoffData?: boolean; // Add flag to show playoff vs regular season
}

const CHART_COLORS = [
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#10B981", // Green
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16" // Lime
];

const STAT_DISPLAY_NAMES: { [key: string]: string } = {
  points: "Points",
  goals: "Goals",
  assists: "Assists",
  shots: "Shots",
  shooting_percentage: "SH%",
  save_pct: "SV%",
  goals_against_avg: "GAA",
  wins: "Wins",
  saves: "Saves",
  toi_per_game: "TOI/GP",
  hits: "Hits",
  blocked_shots: "Blocks",
  fow_percentage: "FO%",
  sat_pct: "CF%",
  zone_start_pct: "ZS%"
};

export function PlayerStatsChart({
  gameLog,
  playoffGameLog,
  selectedStats,
  showRollingAverage = false,
  title = "Performance Trends",
  showPlayoffData = false
}: PlayerStatsChartProps) {
  const chartData = useMemo(() => {
    const log = showPlayoffData && playoffGameLog ? playoffGameLog : gameLog;

    if (log.length === 0) return null;

    // Sort games by date
    const sortedGames = [...log].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const labels = sortedGames.map((game) =>
      new Date(game.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      })
    );

    const datasets = selectedStats
      .map((stat, index) => {
        const data = sortedGames.map((game) => Number(game[stat]) || 0);
        const color = CHART_COLORS[index % CHART_COLORS.length];

        const dataset = {
          label: STAT_DISPLAY_NAMES[stat] || stat,
          data,
          borderColor: color,
          backgroundColor: `${color}20`,
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.1,
          fill: false
        };

        // Add rolling average if requested
        if (
          showRollingAverage &&
          gameLog.some((game) => game[`${stat}_5game_avg`] !== undefined)
        ) {
          const rollingData = sortedGames.map(
            (game) => Number(game[`${stat}_5game_avg`]) || 0
          );

          return [
            dataset,
            {
              label: `${STAT_DISPLAY_NAMES[stat] || stat} (5-game avg)`,
              data: rollingData,
              borderColor: `${color}80`,
              backgroundColor: `${color}10`,
              borderWidth: 1,
              borderDash: [5, 5],
              pointRadius: 1,
              pointHoverRadius: 3,
              tension: 0.3,
              fill: false
            }
          ];
        }

        return dataset;
      })
      .flat();

    return {
      labels,
      datasets
    };
  }, [
    gameLog,
    playoffGameLog,
    selectedStats,
    showRollingAverage,
    showPlayoffData
  ]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top" as const,
          labels: {
            boxWidth: 12,
            padding: 15,
            font: {
              size: 12
            }
          }
        },
        title: {
          display: true,
          text: title,
          font: {
            size: 16,
            weight: "bold" as const
          },
          padding: 20
        },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          backgroundColor: "rgba(17, 24, 39, 0.95)",
          titleColor: "#F9FAFB",
          bodyColor: "#F9FAFB",
          borderColor: "#374151",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            title: (context: any) => {
              const gameIndex = context[0].dataIndex;
              const game = gameLog[gameIndex];
              return `${context[0].label} ${game ? `(Game ${gameIndex + 1})` : ""}`;
            },
            label: (context: any) => {
              const stat = selectedStats.find((s) =>
                context.dataset.label.includes(STAT_DISPLAY_NAMES[s] || s)
              );
              let value = context.parsed.y;

              // Format specific stats
              if (stat?.includes("percentage") || stat?.includes("pct")) {
                value = `${value.toFixed(1)}%`;
              } else if (stat === "goals_against_avg") {
                value = value.toFixed(2);
              } else if (stat === "save_pct") {
                value = value.toFixed(3);
              } else {
                value = Math.round(value * 100) / 100;
              }

              return `${context.dataset.label}: ${value}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: "rgba(156, 163, 175, 0.2)"
          },
          ticks: {
            maxTicksLimit: 12,
            font: {
              size: 11
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(156, 163, 175, 0.2)"
          },
          ticks: {
            font: {
              size: 11
            },
            callback: function (value: any) {
              // Format y-axis labels based on the data range
              if (typeof value === "number") {
                if (value < 1 && value > 0) {
                  return value.toFixed(2);
                } else if (value < 10) {
                  return value.toFixed(1);
                }
              }
              return value;
            }
          }
        }
      },
      interaction: {
        mode: "nearest" as const,
        axis: "x" as const,
        intersect: false
      },
      elements: {
        point: {
          hoverBackgroundColor: "#FFFFFF",
          hoverBorderWidth: 2
        }
      }
    }),
    [title, gameLog, selectedStats]
  );

  if (!chartData || gameLog.length === 0) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.noData}>
          <h3>{title}</h3>
          <p>No data available for selected timeframe</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartWrapper}>
        <Line data={chartData} options={options} />
      </div>

      {selectedStats.length > 4 && (
        <div className={styles.chartNote}>
          <p>
            <strong>Tip:</strong> Click legend items to hide/show specific stats
            for better visualization
          </p>
        </div>
      )}

      {showRollingAverage && (
        <div className={styles.chartNote}>
          <p>
            <strong>Rolling Average:</strong> Dashed lines show 5-game moving
            averages to identify trends
          </p>
        </div>
      )}
    </div>
  );
}
