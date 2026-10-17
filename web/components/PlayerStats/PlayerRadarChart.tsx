import React, { useMemo, useState, useEffect } from "react";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import styles from "./PlayerStats.module.scss";
import {
  formatStatValue,
  STAT_DISPLAY_NAMES as SHARED_STAT_DISPLAY_NAMES,
  TimeFrame,
} from "./types";
import supabase from "../../lib/supabase";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
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

type ComparisonType = "position" | "category" | "league";
type CalculationMethod =
  | "per_game"
  | "per_60"
  | "percentage"
  | "rate"
  | "total";

interface StatCalculationInfo {
  method: CalculationMethod;
  description: string;
  isInverted?: boolean; // For stats where lower is better
}

interface PlayerRadarChartProps {
  player: PlayerInfo;
  gameLog: GameLogEntry[];
  playoffGameLog?: GameLogEntry[];
  selectedStats: string[];
  isGoalie: boolean;
  showPlayoffData?: boolean;
  seasonId?: string | number | null;
  timeFrame?: TimeFrame;
  usedGameLogFallback?: boolean;
}

// Define how each stat is calculated and compared
const STAT_CALCULATION_METHODS: Record<string, StatCalculationInfo> = {
  // Basic counting stats (per game)
  points: { method: "per_game", description: "Points per game" },
  goals: { method: "per_game", description: "Goals per game" },
  assists: { method: "per_game", description: "Assists per game" },
  shots: { method: "per_game", description: "Shots per game" },
  hits: { method: "per_game", description: "Hits per game" },
  blocked_shots: { method: "per_game", description: "Blocked shots per game" },
  takeaways: { method: "per_game", description: "Takeaways per game" },
  giveaways: {
    method: "per_game",
    description: "Giveaways per game",
    isInverted: true,
  },
  penalties: {
    method: "per_game",
    description: "Penalties per game",
    isInverted: true,
  },
  penalty_minutes: {
    method: "per_game",
    description: "Penalty minutes per game",
    isInverted: true,
  },

  // Percentage stats (weighted average)
  shooting_percentage: {
    method: "percentage",
    description: "Shooting percentage (weighted)",
  },
  save_pct: { method: "percentage", description: "Save percentage (weighted)" },
  fow_percentage: {
    method: "percentage",
    description: "Faceoff win percentage (weighted)",
  },
  sat_pct: {
    method: "percentage",
    description: "Shot attempt percentage (weighted)",
  },
  cf_pct: { method: "percentage", description: "Corsi For percentage" },
  ff_pct: { method: "percentage", description: "Fenwick For percentage" },
  sf_pct: { method: "percentage", description: "Shot For percentage" },
  gf_pct: { method: "percentage", description: "Goals For percentage" },
  xgf_pct: {
    method: "percentage",
    description: "Expected Goals For percentage",
  },

  // Time-based stats
  toi_per_game: {
    method: "per_game",
    description: "Time on ice per game (seconds)",
  },
  pp_toi_per_game: {
    method: "per_game",
    description: "Power play time on ice per game",
  },

  // Per 60 minute stats
  goals_per_60: { method: "per_60", description: "Goals per 60 minutes" },
  total_assists_per_60: {
    method: "per_60",
    description: "Assists per 60 minutes",
  },
  total_points_per_60: {
    method: "per_60",
    description: "Points per 60 minutes",
  },
  shots_per_60: { method: "per_60", description: "Shots per 60 minutes" },
  ixg_per_60: {
    method: "per_60",
    description: "Individual expected goals per 60 minutes",
  },
  icf_per_60: {
    method: "per_60",
    description: "Individual Corsi For per 60 minutes",
  },
  hdcf_per_60: {
    method: "per_60",
    description: "High danger chances for per 60 minutes",
  },
  hdca_per_60: {
    method: "per_60",
    description: "High danger chances against per 60 minutes",
    isInverted: true,
  },
  hits_per_60: { method: "per_60", description: "Hits per 60 minutes" },
  pim_per_60: {
    method: "per_60",
    description: "Penalty minutes per 60 minutes",
    isInverted: true,
  },

  // Goalie stats
  goals_against_avg: {
    method: "rate",
    description: "Goals against average",
    isInverted: true,
  },
  wins: { method: "rate", description: "Win rate (wins per game)" },
  saves: { method: "per_game", description: "Saves per game" },
  shutouts: { method: "rate", description: "Shutout rate (shutouts per game)" },
};

// Updated position categories based on your clarification
const POSITION_CATEGORIES = {
  forward: ["C", "LW", "RW", "W", "F", "L", "R"], // Include both old and new formats
  defenseman: ["D", "LD", "RD"],
  goalie: ["G", "GK", "GOALIE"],
};

// Function to normalize position codes
const normalizePosition = (position: string): string => {
  const pos = position?.toUpperCase();
  // Map old position codes to new ones
  const positionMap: Record<string, string> = {
    L: "LW",
    R: "RW",
    F: "C", // Generic forward becomes center
    GK: "G",
    GOALIE: "G",
  };
  return positionMap[pos] || pos;
};

const finiteStatValue = (value: unknown): number | null => {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

interface RadarComparison {
  key: string;
  values: Record<string, number>;
  percentiles: Record<string, number>;
  rankings: Record<string, { rank: number; total: number }>;
}

export function PlayerRadarChart({
  player,
  gameLog,
  selectedStats,
  isGoalie,
  showPlayoffData = false,
  seasonId,
  timeFrame = "season",
  usedGameLogFallback = false,
}: PlayerRadarChartProps) {
  const [comparisonType, setComparisonType] =
    useState<ComparisonType>("position");
  const [showCalculationInfo, setShowCalculationInfo] = useState(false);
  const [comparison, setComparison] = useState<RadarComparison | null>(null);

  const seasonString = String(seasonId ?? "");
  const seasonNumber = /^\d{8}$/.test(seasonString) &&
    Number(seasonString.slice(4)) === Number(seasonString.slice(0, 4)) + 1
      ? Number(seasonString)
      : null;
  const scopeLabel = `${seasonString.slice(0, 4)}-${seasonString.slice(6)} regular season · Full season`;
  const unavailableScope = showPlayoffData
    ? "Rankings unavailable for playoffs. Comparisons use full-season regular-season aggregates."
    : timeFrame !== "season"
      ? "Rankings unavailable for the selected game window. Select Full Season for regular-season comparisons."
      : usedGameLogFallback
        ? "Rankings unavailable for fallback game logs. Select a season with matching game data."
        : seasonNumber === null
          ? "Rankings unavailable because no valid season is selected."
          : null;
  const hasSelectedData = gameLog.length > 0 && selectedStats.length > 0;

  const playerCategory = useMemo(() => {
    if (isGoalie) return "goalie";
    const normalizedPos = normalizePosition(player.position);
    if (POSITION_CATEGORIES.forward.includes(normalizedPos)) return "forward";
    if (POSITION_CATEGORIES.defenseman.includes(normalizedPos))
      return "defenseman";
    return "forward";
  }, [player.position, isGoalie]);

  const comparisonKey = JSON.stringify([
    player.id, player.position, isGoalie, comparisonType, seasonNumber,
    timeFrame, showPlayoffData, usedGameLogFallback, hasSelectedData, selectedStats,
  ]);
  const currentComparison = comparison?.key === comparisonKey ? comparison : null;
  const percentileLoading = !unavailableScope && hasSelectedData && !currentComparison;
  const nhlRankings = currentComparison?.rankings ?? {};

  useEffect(() => {
    let cancelled = false;
    setComparison(null);
    if (unavailableScope || !hasSelectedData || seasonNumber === null) return;

    const fetchPercentiles = async () => {
      const next: RadarComparison = {
        key: comparisonKey, values: {}, percentiles: {}, rankings: {},
      };
      try {
        const { data: playerData, error: playerError } = isGoalie
          ? await supabase
              .from("wgo_goalie_stats_per_game")
              .select("*")
              .eq("goalie_id", player.id)
              .eq("season_id", seasonNumber)
              .single()
          : await supabase
              .from("wgo_skater_stats_per_game")
              .select("*")
              .eq("player_id", player.id)
              .eq("season", String(seasonNumber))
              .single();

        if (cancelled) return;
        if (playerError || !playerData) {
          console.error("Unable to load the selected-season radar values", playerError);
          return;
        }

        const normalizedPos = normalizePosition(player.position);
        const positionFilter = comparisonType === "position"
          ? [normalizedPos]
          : comparisonType === "category"
            ? playerCategory === "forward" ? ["C", "LW", "RW"] : ["D"]
            : [];

        for (const stat of selectedStats) {
          if (cancelled) return;
          const statInfo = STAT_CALCULATION_METHODS[stat];
          if (!statInfo) continue;
          const playerValue = finiteStatValue((playerData as any)[stat]);
          if (playerValue === null) continue;
          next.values[stat] = playerValue;

          try {
            let data;
            let error;
            if (isGoalie) {
              const result = await supabase
                .from("wgo_goalie_stats_per_game")
                .select(stat)
                .not(stat, "is", null)
                .eq("season_id", seasonNumber);
              data = result.data;
              error = result.error;
            } else {
              let query = supabase
                .from("wgo_skater_stats_per_game")
                .select(stat)
                .not(stat, "is", null)
                .eq("season", String(seasonNumber));
              if (positionFilter.length > 0) {
                query = query.in("position_code", positionFilter);
              }
              const result = await query;
              data = result.data;
              error = result.error;
            }
            if (cancelled) return;
            if (error) {
              console.error(`Unable to load the ${stat} radar comparison`, error);
              continue;
            }

            const values = (data ?? [])
              .map((row) => finiteStatValue((row as any)[stat]))
              .filter((value): value is number => value !== null);
            if (values.length === 0) continue;

            const isInverted = statInfo.isInverted || stat === "goals_against_avg";
            const worseCount = values.filter((value) =>
              isInverted ? value > playerValue : value < playerValue,
            ).length;
            const betterCount = values.filter((value) =>
              isInverted ? value < playerValue : value > playerValue,
            ).length;
            next.percentiles[stat] = Math.round((worseCount / values.length) * 100);
            next.rankings[stat] = { rank: betterCount + 1, total: values.length };
          } catch (error) {
            console.error(`Unable to load the ${stat} radar comparison`, error);
          }
        }
      } catch (error) {
        console.error("Unable to load the selected-season radar comparison", error);
      } finally {
        if (!cancelled) setComparison(next);
      }
    };

    void fetchPercentiles();
    return () => { cancelled = true; };
  }, [
    comparisonKey, unavailableScope, hasSelectedData, seasonNumber,
    player.id, player.position, isGoalie, comparisonType, playerCategory, selectedStats,
  ]);

  const radarData = useMemo(() => {
    if (!hasSelectedData) return null;
    const averages = currentComparison?.values ?? {};
    const percentiles = currentComparison?.percentiles ?? {};
    const calculationMethods: Record<string, StatCalculationInfo> = {};
    selectedStats.forEach((stat) => {
      calculationMethods[stat] = STAT_CALCULATION_METHODS[stat] || {
        method: "per_game", description: "Per game average",
      };
    });
    return {
      labels: selectedStats.map((stat) => SHARED_STAT_DISPLAY_NAMES[stat] || stat),
      datasets: [
        {
          label: player.fullName,
          data: selectedStats.map((stat) => percentiles[stat] ?? null),
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
          pointHoverRadius: 7,
        },
      ],
      averages,
      percentiles,
      calculationMethods,
    };
  }, [hasSelectedData, currentComparison, selectedStats, isGoalie, player.fullName]);

  // Get comparison description
  const getComparisonDescription = () => {
    const normalizedPos = normalizePosition(player.position);
    switch (comparisonType) {
      case "position":
        return `vs ${normalizedPos}s`;
      case "category":
        return `vs ${playerCategory}s`;
      case "league":
        return isGoalie ? "vs all goalies" : "vs entire league";
      default:
        return `vs ${normalizedPos}s`;
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
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
          family: "'Roboto Condensed', sans-serif",
        },
        bodyFont: {
          size: 13,
          family: "'Roboto Condensed', sans-serif",
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
            const percentile = radarData?.percentiles[stat];
            const average = radarData?.averages[stat];
            const calcMethod = radarData?.calculationMethods[stat];

            const formattedValue =
              average !== undefined ? formatStatValue(average, stat) : "-";

            return [
              `Value: ${formattedValue}`,
              `Percentile: ${percentile === undefined ? "Unavailable" : `${percentile.toFixed(0)}%`}`,
              `Method: ${calcMethod?.description || "Per game"}`,
              `Comparison: ${getComparisonDescription()}`,
              `Scope: ${scopeLabel}`,
            ];
          },
          labelColor: (context: any) => ({
            borderColor: isGoalie ? "#ef4444" : "#14a2d2",
            backgroundColor: isGoalie ? "#ef4444" : "#14a2d2",
            borderWidth: 2,
            borderRadius: 2,
          }),
        },
      },
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
            family: "'Roboto Condensed', sans-serif",
          },
          color: "#9ca3af",
          backdropColor: "transparent",
          callback: function (value: any) {
            return `${value}%`;
          },
        },
        grid: {
          color: "rgba(156, 163, 175, 0.2)",
          lineWidth: 1,
        },
        angleLines: {
          color: "rgba(156, 163, 175, 0.25)",
          lineWidth: 1,
        },
        pointLabels: {
          font: {
            size: 12,
            weight: 600,
            family: "'Roboto Condensed', sans-serif",
          },
          color: "#cccccc",
          padding: 8,
        },
      },
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6,
        borderWidth: 2,
        hoverBorderWidth: 3,
      },
      line: {
        borderWidth: 2.5,
        tension: 0.1,
      },
    },
  };

  if (unavailableScope || !radarData) {
    return (
      <div className={styles.radarContainer}>
        <div className={styles.radarHeader}>
          <h3>Performance Profile</h3>
          <p>Percentile rankings vs league peers</p>
        </div>
        <div className={styles.radarWrapper}>
          <div className={styles.noData}>
            {unavailableScope || "No data available for radar chart"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.radarContainer}>
      <div className={styles.radarHeader}>
        <h3>Performance Profile</h3>

        {/* Comparison Type Selector */}
        <div className={styles.comparisonControls}>
          <div>
            <p>
              Percentile rankings {getComparisonDescription()}
              {` · ${scopeLabel}`}
            </p>
            {percentileLoading && (
              <div
                style={{
                  fontSize: "0.8em",
                  color: "#14a2d2",
                  marginLeft: "0.5rem",
                  fontStyle: "italic",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    border: "2px solid #14a2d2",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Calculating...
              </div>
            )}
          </div>

          <div className={styles.comparisonButtons}>
            <button
              onClick={() => setComparisonType("position")}
              className={`${styles.comparisonButton} ${comparisonType === "position" ? styles.active : ""}`}
            >
              Position ({normalizePosition(player.position)})
            </button>
            <button
              onClick={() => setComparisonType("category")}
              className={`${styles.comparisonButton} ${comparisonType === "category" ? styles.active : ""}`}
            >
              {playerCategory.charAt(0).toUpperCase() + playerCategory.slice(1)}
              s
            </button>
            {!isGoalie && (
              <button
                onClick={() => setComparisonType("league")}
                className={`${styles.comparisonButton} ${comparisonType === "league" ? styles.active : ""}`}
              >
                League
              </button>
            )}
            <button
              onClick={() => setShowCalculationInfo(!showCalculationInfo)}
              className={styles.infoButton}
              title="Show calculation methods"
            >
              <span className={styles.infoIcon}>i</span>
            </button>
          </div>
        </div>

        {!percentileLoading && selectedStats.some((stat) => radarData.percentiles[stat] === undefined) && (
          <div
            style={{
              fontSize: "0.8em",
              color: "#f97316",
              marginTop: "0.5rem",
              fontStyle: "italic",
            }}
          >
            Some selected statistics have no matching comparison data. Their
            rankings are unavailable.
          </div>
        )}
      </div>

      <div className={styles.radarWrapper}>
        {Object.keys(radarData.percentiles).length > 0 ? (
          <Radar data={radarData} options={options} />
        ) : (
          <div className={styles.noData}>
            {percentileLoading ? "Calculating rankings..." : "No rankings available for the selected statistics"}
          </div>
        )}
      </div>

      {/* Player Statistics with NHL Rankings */}
      {showCalculationInfo && (
        <div className={styles.calculationInfo}>
          <h4>Player Statistics & NHL Rankings</h4>
          <div className={styles.calculationGrid}>
            {selectedStats.map((stat) => {
              const statValue = radarData.averages[stat];
              const percentile = radarData.percentiles[stat];
              const ranking = nhlRankings[stat];
              const method = radarData.calculationMethods[stat];

              // Determine rank color based on percentile
              const getRankColorClass = (percentile: number | undefined) => {
                if (percentile === undefined) return "";
                if (percentile >= 90) return styles.elite;
                if (percentile >= 75) return styles.good;
                if (percentile >= 50) return styles.average;
                if (percentile >= 25) return styles.belowAverage;
                return styles.poor;
              };

              // Format ordinal numbers (1st, 2nd, 3rd, etc.)
              const formatOrdinal = (num: number) => {
                const suffix = ["th", "st", "nd", "rd"];
                const v = num % 100;
                return num + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
              };

              return (
                <div key={stat} className={styles.calculationItem}>
                  <div className={styles.statHeader}>
                    <span className={styles.statNameInfo}>
                      {SHARED_STAT_DISPLAY_NAMES[stat] || stat}
                    </span>
                    <span className={styles.statDescription}>
                      {method?.description || "Per game average"}
                      {method?.isInverted && " (lower is better)"}
                    </span>
                  </div>

                  <div className={styles.statDataRow}>
                    <div className={styles.statValueContainer}>
                      <span className={styles.statLabel}>Value:</span>
                      <span className={styles.statValueLarge}>
                        {formatStatValue(statValue, stat)}
                      </span>
                    </div>

                    <div className={styles.rankingContainer}>
                      <span className={styles.statLabel}>NHL Rank:</span>
                      {ranking ? (
                        <span
                          className={`${styles.nhlRank} ${getRankColorClass(percentile)}`}
                        >
                          {formatOrdinal(ranking.rank)} / {ranking.total}
                        </span>
                      ) : (
                        <span className={styles.nhlRank}>
                          {percentileLoading ? "Loading..." : "Unavailable"}
                        </span>
                      )}
                    </div>

                    <div className={styles.percentileContainer}>
                      <span className={styles.statLabel}>Percentile:</span>
                      <span
                        className={`${styles.percentileValue} ${getRankColorClass(percentile)}`}
                      >
                        {percentile === undefined ? "Unavailable" : `${percentile.toFixed(0)}%`}
                      </span>
                    </div>
                  </div>

                  <div className={styles.comparisonNote}>
                    {getComparisonDescription()}
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(nhlRankings).length > 0 && (
            <div className={styles.rankingNote}>
              <em>
                Rankings use {scopeLabel} values and peers from the same source.
              </em>
            </div>
          )}
        </div>
      )}

      <div className={styles.radarLegend}>
        <div className={styles.percentileGuide}>
          <span className={styles.percentileItem}>
            <strong>90th+ percentile:</strong> Elite
          </span>
          <span className={styles.percentileItem}>
            <strong>75th+ percentile:</strong> Above Average
          </span>
          <span className={styles.percentileItem}>
            <strong>50th percentile:</strong> Average
          </span>
          <span className={styles.percentileItem}>
            <strong>25th+ percentile:</strong> Below Average
          </span>
          <span className={styles.percentileItem}>
            <strong>Below 25th:</strong> Poor
          </span>
        </div>
      </div>

      <div className={styles.radarStats}>
        {selectedStats.map((stat) => {
          const percentile = radarData.percentiles[stat];
          const method = radarData.calculationMethods[stat];
          return (
            <div key={stat} className={styles.statBreakdown}>
              <span className={styles.statName}>
                {SHARED_STAT_DISPLAY_NAMES[stat] || stat}:
              </span>
              <span className={styles.statValue}>
                {formatStatValue(radarData.averages[stat], stat)}
              </span>
              <span
                className={`${styles.percentile} ${
                  percentile === undefined
                    ? ""
                    : percentile >= 90
                    ? styles.elite
                    : percentile >= 75
                      ? styles.good
                      : percentile >= 50
                        ? styles.average
                        : percentile >= 25
                          ? styles.belowAverage
                          : styles.poor
                }`}
                title={method?.description}
              >
                {percentile === undefined ? "Unavailable" : `${percentile.toFixed(0)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
