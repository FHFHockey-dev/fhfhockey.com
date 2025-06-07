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
import { formatStatValue, STAT_DISPLAY_NAMES as SHARED_STAT_DISPLAY_NAMES } from "./types";

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
  playoffGameLog?: GameLogEntry[]; // Add optional playoff game log
  selectedStats: string[];
  isGoalie: boolean;
  showPlayoffData?: boolean; // Add flag to show playoff vs regular season
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
  toi_per_game: { elite: 1320, good: 1080, average: 840 }, // Updated to seconds (22min=1320s, 18min=1080s, 14min=840s)
  sat_pct: { elite: 55, good: 52, average: 48 },

  // NST Advanced Stats - Possession Metrics (percentages)
  cf_pct: { elite: 55, good: 52, average: 48 },
  ff_pct: { elite: 55, good: 52, average: 48 },
  sf_pct: { elite: 55, good: 52, average: 48 },
  gf_pct: { elite: 60, good: 55, average: 45 },
  xgf_pct: { elite: 55, good: 52, average: 48 },
  scf_pct: { elite: 55, good: 52, average: 48 },
  hdcf_pct: { elite: 55, good: 52, average: 48 },
  mdcf_pct: { elite: 55, good: 52, average: 48 },
  ldcf_pct: { elite: 55, good: 52, average: 48 },

  // NST Advanced Stats - Per 60 Individual Production
  ixg_per_60: { elite: 2.5, good: 2.0, average: 1.2 },
  icf_per_60: { elite: 12, good: 9, average: 6 },
  iff_per_60: { elite: 10, good: 8, average: 5 },
  iscfs_per_60: { elite: 8, good: 6, average: 4 },
  hdcf_per_60: { elite: 6, good: 4, average: 2.5 },
  shots_per_60: { elite: 12, good: 9, average: 6 },
  goals_per_60: { elite: 2.0, good: 1.5, average: 0.8 },
  total_assists_per_60: { elite: 2.5, good: 1.8, average: 1.0 },
  total_points_per_60: { elite: 4.0, good: 3.0, average: 1.8 },
  rush_attempts_per_60: { elite: 3.0, good: 2.0, average: 1.0 },
  rebounds_created_per_60: { elite: 1.5, good: 1.0, average: 0.5 },

  // NST Advanced Stats - Per 60 Defensive/Against
  hdca_per_60: { elite: 4.0, good: 5.5, average: 7.0 }, // Lower is better
  sca_per_60: { elite: 8.0, good: 10.0, average: 12.0 }, // Lower is better
  shots_blocked_per_60: { elite: 4.0, good: 3.0, average: 2.0 },
  xga_per_60: { elite: 2.0, good: 2.5, average: 3.0 }, // Lower is better
  ga_per_60: { elite: 2.0, good: 2.5, average: 3.0 }, // Lower is better

  // NST Advanced Stats - Zone Usage (percentages)
  off_zone_start_pct: { elite: 65, good: 55, average: 45 },
  def_zone_start_pct: { elite: 65, good: 55, average: 45 }, // For defensemen, higher is better
  neu_zone_start_pct: { elite: 40, good: 30, average: 20 },
  off_zone_faceoff_pct: { elite: 60, good: 55, average: 45 },

  // NST Advanced Stats - On-Ice Impact
  on_ice_sh_pct: { elite: 10.5, good: 9.0, average: 7.5 },
  on_ice_sv_pct: { elite: 92.5, good: 91.0, average: 89.5 },
  pdo: { elite: 102, good: 100.5, average: 99.0 },

  // NST Advanced Stats - Discipline Per 60
  pim_per_60: { elite: 0.5, good: 1.0, average: 1.8 }, // Lower is better
  total_penalties_per_60: { elite: 0.3, good: 0.6, average: 1.0 }, // Lower is better
  penalties_drawn_per_60: { elite: 1.5, good: 1.0, average: 0.6 },
  giveaways_per_60: { elite: 1.5, good: 2.5, average: 4.0 }, // Lower is better
  takeaways_per_60: { elite: 2.0, good: 1.5, average: 1.0 },
  hits_per_60: { elite: 6.0, good: 4.0, average: 2.5 },

  // Goalie thresholds
  save_pct: { elite: 0.925, good: 0.915, average: 0.9 },
  goals_against_avg: { elite: 2.2, good: 2.7, average: 3.2 }, // Inverted: lower is better
  wins: { elite: 0.7, good: 0.5, average: 0.3 }, // Win rate
  saves: { elite: 30, good: 25, average: 20 },
  shutouts: { elite: 0.15, good: 0.08, average: 0.03 } // Per game
};

export function PlayerRadarChart({
  player,
  gameLog,
  playoffGameLog,
  selectedStats,
  isGoalie,
  showPlayoffData
}: PlayerRadarChartProps) {
  const radarData = useMemo(() => {
    const log = showPlayoffData && playoffGameLog ? playoffGameLog : gameLog;

    if (log.length === 0 || selectedStats.length === 0) return null;

    // Calculate averages for selected stats
    const gamesPlayed = log.reduce(
      (sum, game) => sum + (game.games_played || 0),
      0
    );

    const averages: { [key: string]: number } = {};
    const percentiles: { [key: string]: number } = {};

    selectedStats.forEach((stat) => {
      const values = log.map((game) => Number(game[stat]) || 0);

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
        const weights = log.map((game) => game.games_played || 1);
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
      (stat) => SHARED_STAT_DISPLAY_NAMES[stat] || stat
    );
    const data = selectedStats.map((stat) => percentiles[stat] || 0);

    return {
      labels,
      datasets: [
        {
          label: player.fullName,
          data,
          backgroundColor: isGoalie
            ? "rgba(239, 68, 68, 0.15)"
            : "rgba(20, 162, 210, 0.15)",
          borderColor: isGoalie ? "#ef4444" : "#14a2d2",
          borderWidth: 2.5,
          pointBackgroundColor: isGoalie ? "#ef4444" : "#14a2d2",
          pointBorderColor: "#1a1d21",
          pointBorderWidth: 2,
          pointHoverBackgroundColor: "#ffffff",
          pointHoverBorderColor: isGoalie ? "#ef4444" : "#14a2d2",
          pointHoverBorderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7
        }
      ],
      averages,
      percentiles
    };
  }, [
    gameLog,
    playoffGameLog,
    selectedStats,
    isGoalie,
    player.fullName,
    showPlayoffData
  ]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
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
            const statIndex = context[0].dataIndex;
            return (
              SHARED_STAT_DISPLAY_NAMES[selectedStats[statIndex]] ||
              selectedStats[statIndex]
            );
          },
          label: (context: any) => {
            const statIndex = context.dataIndex;
            const stat = selectedStats[statIndex];
            const percentile = context.parsed.r;
            const average = radarData?.averages[stat];

            const formattedValue = average !== undefined ? formatStatValue(average, stat) : "-";

            return [
              `Value: ${formattedValue}`,
              `Percentile: ${percentile.toFixed(0)}%`
            ];
          },
          labelColor: (context: any) => ({
            borderColor: isGoalie ? "#ef4444" : "#14a2d2",
            backgroundColor: isGoalie ? "#ef4444" : "#14a2d2",
            borderWidth: 2,
            borderRadius: 2
          })
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
            size: 11,
            family: "'Roboto Condensed', sans-serif"
          },
          color: "#9ca3af",
          backdropColor: "transparent",
          callback: function (value: any) {
            return `${value}%`;
          }
        },
        grid: {
          color: "rgba(156, 163, 175, 0.2)",
          lineWidth: 1
        },
        angleLines: {
          color: "rgba(156, 163, 175, 0.25)",
          lineWidth: 1
        },
        pointLabels: {
          font: {
            size: 12,
            weight: 600,
            family: "'Roboto Condensed', sans-serif"
          },
          color: "#cccccc",
          padding: 8
        }
      }
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6,
        borderWidth: 2,
        hoverBorderWidth: 3
      },
      line: {
        borderWidth: 2.5,
        tension: 0.1
      }
    }
  };

  if (!radarData || gameLog.length === 0) {
    return (
      <div className={styles.radarContainer}>
        <div className={styles.radarHeader}>
          <h3>Performance Profile</h3>
          <p>Percentile rankings vs league peers</p>
        </div>
        <div className={styles.radarWrapper}>
          <div className={styles.noData}>No data available for radar chart</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.radarContainer}>
      <div className={styles.radarHeader}>
        <h3>Performance Profile</h3>
        <p>
          Percentile rankings vs {isGoalie ? "goalies" : `${player.position}s`}
          {showPlayoffData ? " (Playoffs)" : " (Regular Season)"}
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
            <strong>Below 50th:</strong> Below Average
          </span>
        </div>
      </div>

      <div className={styles.radarStats}>
        {selectedStats.map((stat) => (
          <div key={stat} className={styles.statBreakdown}>
            <span className={styles.statName}>
              {SHARED_STAT_DISPLAY_NAMES[stat] || stat}:
            </span>
            <span className={styles.statValue}>
              {formatStatValue(radarData.averages[stat], stat)}
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
