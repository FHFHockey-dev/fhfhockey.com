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
import {
  PlayerStatsChartProps,
  CHART_COLORS,
  STAT_DISPLAY_NAMES,
  formatStatValue
} from "./types";

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
          backgroundColor: `${color}15`,
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: color,
          pointBorderColor: "#1a1d21",
          pointBorderWidth: 2,
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 2,
          tension: 0.15,
          fill: false
        };

        // Add rolling average if requested and available
        if (
          showRollingAverage &&
          gameLog.some((game) => game[`${stat}_5game_avg`] !== undefined)
        ) {
          const rollingData = sortedGames.map(
            (game) => Number(game[`${stat}_5game_avg`]) || 0
          );
          // Return both main dataset and rolling average
          return [
            dataset,
            {
              ...dataset,
              label: `${STAT_DISPLAY_NAMES[stat] || stat} (5-game avg)`,
              data: rollingData,
              borderColor: `${color}80`,
              backgroundColor: `${color}08`,
              borderDash: [5, 5],
              pointRadius: 2,
              pointHoverRadius: 4
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
          align: "start" as const,
          labels: {
            boxWidth: 14,
            boxHeight: 14,
            padding: 16,
            usePointStyle: true,
            pointStyle: "circle",
            font: {
              size: 13,
              family: "'Roboto Condensed', sans-serif",
              weight: 500
            },
            color: "#cccccc",
            generateLabels: (chart: any) => {
              const original =
                ChartJS.defaults.plugins.legend.labels.generateLabels;
              const labels = original(chart);

              return labels.map((label: any) => ({
                ...label,
                pointStyle: "circle",
                radius: 6
              }));
            }
          }
        },
        title: {
          display: false
        },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          backgroundColor: "rgba(26, 29, 33, 0.95)",
          titleColor: "#ffffff",
          bodyColor: "#cccccc",
          borderColor: "#404040",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 16,
          titleFont: {
            size: 14,
            weight: 600,
            family: "'Roboto Condensed', sans-serif"
          },
          bodyFont: {
            size: 13,
            family: "'Roboto Condensed', sans-serif"
          },
          displayColors: true,
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          callbacks: {
            title: (context: any) => {
              if (context.length === 0) return "";
              const gameIndex = context[0].dataIndex;
              const log =
                showPlayoffData && playoffGameLog ? playoffGameLog : gameLog;
              const sortedGames = [...log].sort(
                (a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime()
              );
              const game = sortedGames[gameIndex];
              return new Date(game.date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric"
              });
            },
            label: (context: any) => {
              const label = context.dataset.label || "";
              const value = context.parsed.y;

              // Extract the stat name from the dataset label to get proper formatting
              const statName =
                selectedStats.find(
                  (stat) =>
                    (STAT_DISPLAY_NAMES[stat] || stat) ===
                    label.replace(" (5-game avg)", "")
                ) || label;

              const formattedValue = formatStatValue(value, statName);
              return `${label}: ${formattedValue}`;
            },
            labelColor: (context: any) => ({
              borderColor: context.dataset.borderColor,
              backgroundColor: context.dataset.borderColor,
              borderWidth: 2,
              borderRadius: 2
            })
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: "rgba(156, 163, 175, 0.15)",
            drawBorder: false
          },
          ticks: {
            maxTicksLimit: 15,
            font: {
              size: 11,
              family: "'Roboto Condensed', sans-serif"
            },
            color: "#9ca3af",
            padding: 8
          },
          border: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(156, 163, 175, 0.15)",
            drawBorder: false
          },
          ticks: {
            font: {
              size: 11,
              family: "'Roboto Condensed', sans-serif"
            },
            color: "#9ca3af",
            padding: 12,
            callback: function (value: any) {
              return typeof value === "number" ? value.toFixed(1) : value;
            }
          },
          border: {
            display: false
          }
        }
      },
      interaction: {
        mode: "index" as const,
        intersect: false
      },
      elements: {
        point: {
          hoverBorderWidth: 3
        },
        line: {
          borderJoinStyle: "round" as const,
          borderCapStyle: "round" as const
        }
      }
    }),
    [selectedStats, gameLog, playoffGameLog, showPlayoffData]
  );

  if (!chartData) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <h3>{title}</h3>
        </div>
        <div className={styles.noData}>No data available for chart</div>
      </div>
    );
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3>{title}</h3>
        {showPlayoffData && playoffGameLog && (
          <span className={styles.chartSubtitle}>Playoff Data</span>
        )}
      </div>
      <div className={styles.chartWrapper}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
