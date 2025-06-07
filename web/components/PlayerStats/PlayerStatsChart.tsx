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
  "#14a2d2", // Primary blue
  "#07aae2", // Secondary blue
  "#00ff99", // Success green
  "#ffcc00", // Warning yellow
  "#ff6384", // Danger red
  "#9b59b6", // Purple
  "#4bc0c0", // Teal
  "#ff9f40" // Orange
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
  zone_start_pct: "ZS%",

  // NST Advanced Stats - Possession Metrics
  cf_pct: "CF%",
  ff_pct: "FF%",
  sf_pct: "SF%",
  gf_pct: "GF%",
  xgf_pct: "xGF%",
  scf_pct: "SCF%",
  hdcf_pct: "HDCF%",
  mdcf_pct: "MDCF%",
  ldcf_pct: "LDCF%",

  // NST Advanced Stats - Individual Per 60
  ixg_per_60: "ixG/60",
  icf_per_60: "iCF/60",
  iff_per_60: "iFF/60",
  iscfs_per_60: "iSCF/60",
  hdcf_per_60: "HDCF/60",
  shots_per_60: "SOG/60",
  goals_per_60: "G/60",
  total_assists_per_60: "A/60",
  total_points_per_60: "P/60",
  rush_attempts_per_60: "Rush/60",
  rebounds_created_per_60: "Reb/60",

  // NST Advanced Stats - Defensive Per 60
  hdca_per_60: "HDCA/60",
  sca_per_60: "SCA/60",
  shots_blocked_per_60: "BLK/60",
  xga_per_60: "xGA/60",
  ga_per_60: "GA/60",

  // NST Advanced Stats - Zone Usage
  off_zone_start_pct: "OZ Start%",
  def_zone_start_pct: "DZ Start%",
  neu_zone_start_pct: "NZ Start%",
  off_zone_faceoff_pct: "OZ FO%",

  // NST Advanced Stats - On-Ice Impact
  on_ice_sh_pct: "oiSH%",
  on_ice_sv_pct: "oiSV%",
  pdo: "PDO",

  // NST Advanced Stats - Discipline Per 60
  pim_per_60: "PIM/60",
  total_penalties_per_60: "Pen/60",
  penalties_drawn_per_60: "PenD/60",
  giveaways_per_60: "GV/60",
  takeaways_per_60: "TK/60",
  hits_per_60: "HIT/60"
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
              backgroundColor: `${color}08`,
              borderWidth: 2,
              borderDash: [8, 4],
              pointRadius: 2,
              pointHoverRadius: 4,
              pointBackgroundColor: `${color}80`,
              pointBorderColor: "#1a1d21",
              pointBorderWidth: 1,
              tension: 0.25,
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

              labels.forEach((label: any) => {
                label.borderRadius = 2;
              });

              return labels;
            }
          }
        },
        title: {
          display: false // We'll handle title in component wrapper
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
              const gameIndex = context[0].dataIndex;
              const game = (
                showPlayoffData && playoffGameLog ? playoffGameLog : gameLog
              )[gameIndex];
              return `${context[0].label}${game ? ` (Game ${gameIndex + 1})` : ""}`;
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
              } else if (stat === "toi_per_game") {
                const minutes = Math.floor(value);
                const seconds = Math.round((value - minutes) * 60);
                value = `${minutes}:${seconds.toString().padStart(2, "0")}`;
              } else {
                value = Math.round(value * 100) / 100;
              }

              return `${context.dataset.label}: ${value}`;
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
              // Format y-axis labels based on the data range
              if (typeof value === "number") {
                if (value >= 1000) {
                  return `${(value / 1000).toFixed(1)}k`;
                }
                if (value % 1 === 0) {
                  return value.toString();
                }
                return value.toFixed(value < 10 ? 1 : 0);
              }
              return value;
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
      <div className={styles.trendContainer}>
        <div className={styles.trendHeader}>
          <h3>{title}</h3>
          <p>Track performance metrics over time</p>
        </div>
        <div className={styles.chartWrapper}>
          <div className={styles.noData}>No data available for chart</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.trendContainer}>
      <div className={styles.trendHeader}>
        <h3>{title}</h3>
        <p>
          {showPlayoffData ? "Playoff" : "Regular Season"} performance trends
          {selectedStats.length > 0 &&
            ` for ${selectedStats.map((stat) => STAT_DISPLAY_NAMES[stat] || stat).join(", ")}`}
        </p>
      </div>
      <div className={styles.chartWrapper}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
