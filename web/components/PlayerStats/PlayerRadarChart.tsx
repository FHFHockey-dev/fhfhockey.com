import React, { useMemo, useState, useCallback, useEffect } from "react";
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
import {
  formatStatValue,
  STAT_DISPLAY_NAMES as SHARED_STAT_DISPLAY_NAMES
} from "./types";
import supabase from "../../lib/supabase";
import useCurrentSeason from "../../hooks/useCurrentSeason";

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
    isInverted: true
  },
  penalties: {
    method: "per_game",
    description: "Penalties per game",
    isInverted: true
  },
  penalty_minutes: {
    method: "per_game",
    description: "Penalty minutes per game",
    isInverted: true
  },

  // Percentage stats (weighted average)
  shooting_percentage: {
    method: "percentage",
    description: "Shooting percentage (weighted)"
  },
  save_pct: { method: "percentage", description: "Save percentage (weighted)" },
  fow_percentage: {
    method: "percentage",
    description: "Faceoff win percentage (weighted)"
  },
  sat_pct: {
    method: "percentage",
    description: "Shot attempt percentage (weighted)"
  },
  cf_pct: { method: "percentage", description: "Corsi For percentage" },
  ff_pct: { method: "percentage", description: "Fenwick For percentage" },
  sf_pct: { method: "percentage", description: "Shot For percentage" },
  gf_pct: { method: "percentage", description: "Goals For percentage" },
  xgf_pct: {
    method: "percentage",
    description: "Expected Goals For percentage"
  },

  // Time-based stats
  toi_per_game: {
    method: "per_game",
    description: "Time on ice per game (seconds)"
  },
  pp_toi_per_game: {
    method: "per_game",
    description: "Power play time on ice per game"
  },

  // Per 60 minute stats
  goals_per_60: { method: "per_60", description: "Goals per 60 minutes" },
  total_assists_per_60: {
    method: "per_60",
    description: "Assists per 60 minutes"
  },
  total_points_per_60: {
    method: "per_60",
    description: "Points per 60 minutes"
  },
  shots_per_60: { method: "per_60", description: "Shots per 60 minutes" },
  ixg_per_60: {
    method: "per_60",
    description: "Individual expected goals per 60 minutes"
  },
  icf_per_60: {
    method: "per_60",
    description: "Individual Corsi For per 60 minutes"
  },
  hdcf_per_60: {
    method: "per_60",
    description: "High danger chances for per 60 minutes"
  },
  hdca_per_60: {
    method: "per_60",
    description: "High danger chances against per 60 minutes",
    isInverted: true
  },
  hits_per_60: { method: "per_60", description: "Hits per 60 minutes" },
  pim_per_60: {
    method: "per_60",
    description: "Penalty minutes per 60 minutes",
    isInverted: true
  },

  // Goalie stats
  goals_against_avg: {
    method: "rate",
    description: "Goals against average",
    isInverted: true
  },
  wins: { method: "rate", description: "Win rate (wins per game)" },
  saves: { method: "per_game", description: "Saves per game" },
  shutouts: { method: "rate", description: "Shutout rate (shutouts per game)" }
};

// Updated position categories based on your clarification
const POSITION_CATEGORIES = {
  forward: ["C", "LW", "RW", "W", "F", "L", "R"], // Include both old and new formats
  defenseman: ["D", "LD", "RD"],
  goalie: ["G", "GK", "GOALIE"]
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
    GOALIE: "G"
  };
  return positionMap[pos] || pos;
};

// Fallback percentile calculation using simplified thresholds
// TODO: Replace this with actual database queries
const calculateFallbackPercentile = (
  stat: string,
  value: number,
  playerCategory: string
): number => {
  // These are very basic fallback thresholds - should be replaced with real data
  const basicThresholds: Record<
    string,
    Record<string, { elite: number; good: number; average: number }>
  > = {
    forward: {
      points: { elite: 1.0, good: 0.7, average: 0.4 },
      goals: { elite: 0.5, good: 0.3, average: 0.15 },
      assists: { elite: 0.6, good: 0.4, average: 0.2 },
      shots: { elite: 3.0, good: 2.2, average: 1.5 },
      hits: { elite: 2.0, good: 1.5, average: 1.0 }
    },
    defenseman: {
      points: { elite: 0.6, good: 0.4, average: 0.2 },
      goals: { elite: 0.2, good: 0.1, average: 0.05 },
      assists: { elite: 0.5, good: 0.3, average: 0.15 },
      blocked_shots: { elite: 2.0, good: 1.5, average: 1.0 },
      hits: { elite: 2.5, good: 1.8, average: 1.2 }
    },
    goalie: {
      save_pct: { elite: 0.92, good: 0.91, average: 0.9 },
      goals_against_avg: { elite: 2.5, good: 2.8, average: 3.2 },
      wins: { elite: 0.65, good: 0.5, average: 0.35 }
    }
  };

  const thresholds = basicThresholds[playerCategory]?.[stat];
  if (!thresholds) return 50; // Default to average

  const statInfo = STAT_CALCULATION_METHODS[stat];
  const isInverted = statInfo?.isInverted || stat === "goals_against_avg";

  if (isInverted) {
    if (value <= thresholds.elite) return 90;
    else if (value <= thresholds.good) return 75;
    else if (value <= thresholds.average) return 50;
    else return Math.max(10, 50 - (value - thresholds.average) * 10);
  } else {
    if (value >= thresholds.elite) return 90;
    else if (value >= thresholds.good) return 75;
    else if (value >= thresholds.average) return 50;
    else return Math.max(10, (value / thresholds.average) * 50);
  }
};

export function PlayerRadarChart({
  player,
  gameLog,
  playoffGameLog,
  selectedStats,
  isGoalie,
  showPlayoffData
}: PlayerRadarChartProps) {
  const [comparisonType, setComparisonType] =
    useState<ComparisonType>("position");
  const [showCalculationInfo, setShowCalculationInfo] = useState(false);

  // Get current season for filtering database queries
  const currentSeason = useCurrentSeason();

  // State for database percentiles and rankings
  const [databasePercentiles, setDatabasePercentiles] = useState<
    Record<string, number>
  >({});
  const [nhlRankings, setNhlRankings] = useState<
    Record<string, { rank: number; total: number }>
  >({});
  const [percentileLoading, setPercentileLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(true);

  // State to store actual player values from per_game view
  const [playerPerGameValues, setPlayerPerGameValues] = useState<
    Record<string, number>
  >({});

  // Determine player category using normalized position
  const playerCategory = useMemo(() => {
    if (isGoalie) return "goalie";
    const normalizedPos = normalizePosition(player.position);
    if (POSITION_CATEGORIES.forward.includes(normalizedPos)) return "forward";
    if (POSITION_CATEGORIES.defenseman.includes(normalizedPos))
      return "defenseman";
    return "forward"; // Default fallback
  }, [player.position, isGoalie]);

  // Fetch percentiles from database
  const fetchPercentiles = useCallback(
    async (stats: string[], playerValues: Record<string, number>) => {
      if (stats.length === 0 || !currentSeason?.seasonId) return;

      setPercentileLoading(true);

      try {
        const normalizedPos = normalizePosition(player.position);
        const tableName = isGoalie
          ? "wgo_goalie_stats_per_game"
          : "wgo_skater_stats_per_game";
        const positionField = isGoalie ? "position_code" : "position_code";

        // Convert season ID to string format for the database query
        const seasonString = currentSeason.seasonId.toString(); // Convert 20242025 to "20242025"

        // Build position filter based on comparison type
        let positionFilter: string[] = [];
        switch (comparisonType) {
          case "position":
            positionFilter = [normalizedPos];
            break;
          case "category":
            if (playerCategory === "forward") {
              positionFilter = ["C", "LW", "RW"];
            } else if (playerCategory === "defenseman") {
              positionFilter = ["D"];
            } else if (playerCategory === "goalie") {
              positionFilter = ["G"];
            }
            break;
          case "league":
            // For league comparison, don't filter by position
            positionFilter = [];
            break;
        }

        const newPercentiles: Record<string, number> = {};
        const newRankings: Record<string, { rank: number; total: number }> = {};

        console.log(`Fetching percentiles for season: ${seasonString}`);

        // First, get the player's actual values from the per_game view
        let playerQuery = supabase
          .from(tableName)
          .select("*")
          .eq("player_id", player.id)
          .eq("season", seasonString)
          .single();

        const { data: playerData, error: playerError } = await playerQuery;

        if (playerError || !playerData) {
          console.error(
            `Error fetching player data from ${tableName}:`,
            playerError
          );
          setUsingFallback(true);
          return;
        }

        console.log(
          `[PlayerRadarChart] Player data from ${tableName}:`,
          playerData
        );

        // Store player values for display - filter to only numeric stats
        const numericPlayerData: Record<string, number> = {};
        Object.entries(playerData).forEach(([key, value]) => {
          const numericValue = Number(value);
          if (!isNaN(numericValue) && value !== null && value !== undefined) {
            numericPlayerData[key] = numericValue;
          }
        });
        setPlayerPerGameValues(numericPlayerData);

        // Fetch percentiles and rankings for each stat
        for (const stat of stats) {
          const playerValue = Number((playerData as any)[stat]);
          if (
            isNaN(playerValue) ||
            playerValue === null ||
            playerValue === undefined
          ) {
            console.warn(
              `[PlayerRadarChart] Invalid value for ${stat}: ${(playerData as any)[stat]}`
            );
            continue;
          }

          console.log(
            `[PlayerRadarChart] Using ${stat} value: ${playerValue} from per_game view`
          );

          let query = supabase
            .from(tableName)
            .select(stat)
            .not(stat, "is", null)
            .eq("season", seasonString); // Use "season" column with string value

          // Apply position filter if needed
          if (positionFilter.length > 0) {
            query = query.in(positionField, positionFilter);
          }

          const { data, error } = await query;

          if (error) {
            console.error(
              `Error fetching ${stat} data for season ${seasonString}:`,
              error
            );
            continue;
          }

          if (data && data.length > 0) {
            const values = data
              .map((row) => Number((row as any)[stat]))
              .filter((val) => !isNaN(val))
              .sort((a, b) => a - b);

            if (values.length > 0) {
              const statInfo = STAT_CALCULATION_METHODS[stat];
              const isInverted =
                statInfo?.isInverted || stat === "goals_against_avg";

              // Calculate percentile rank and NHL rank consistently
              let percentile: number;
              let rank: number;

              if (isInverted) {
                // For inverted stats (lower is better)
                const betterCount = values.filter(
                  (v) => v < playerValue
                ).length;
                const equalCount = values.filter(
                  (v) => v === playerValue
                ).length;

                // Percentile: what percentage of players this player is better than
                percentile = (betterCount / values.length) * 100;

                // Rank: 1st place goes to lowest value
                // Count how many have strictly lower values, then add 1
                rank = betterCount + 1;
              } else {
                // For normal stats (higher is better)
                const worseCount = values.filter((v) => v < playerValue).length;
                const equalCount = values.filter(
                  (v) => v === playerValue
                ).length;

                // Percentile: what percentage of players this player is better than
                percentile = (worseCount / values.length) * 100;

                // Rank: 1st place goes to highest value
                // Count how many have strictly higher values, then add 1
                const betterCount = values.filter(
                  (v) => v > playerValue
                ).length;
                rank = betterCount + 1;
              }

              newPercentiles[stat] = Math.round(percentile);
              newRankings[stat] = { rank, total: values.length };

              console.log(
                `${stat}: ${playerValue} -> ${percentile.toFixed(1)}% (rank ${rank}/${values.length})`
              );
            }
          }
        }

        if (Object.keys(newPercentiles).length > 0) {
          setDatabasePercentiles(newPercentiles);
          setNhlRankings(newRankings);
          setUsingFallback(false);
          console.log(
            `Successfully calculated percentiles for ${Object.keys(newPercentiles).length} stats`
          );
        } else {
          console.warn("No valid percentile data calculated");
          setUsingFallback(true);
        }
      } catch (error) {
        console.error("Error fetching season-filtered percentiles:", error);
        setUsingFallback(true);
      } finally {
        setPercentileLoading(false);
      }
    },
    [
      player.position,
      player.id,
      isGoalie,
      comparisonType,
      playerCategory,
      currentSeason?.seasonId
    ]
  );

  // Calculate percentiles using database or fallback
  const calculatePercentile = useCallback(
    (stat: string, value: number): number => {
      // Use database percentile if available
      if (!usingFallback && databasePercentiles[stat] !== undefined) {
        return databasePercentiles[stat];
      }

      // Fallback to simplified calculation
      return calculateFallbackPercentile(stat, value, playerCategory);
    },
    [databasePercentiles, usingFallback, playerCategory]
  );

  const radarData = useMemo(() => {
    const log = showPlayoffData && playoffGameLog ? playoffGameLog : gameLog;

    if (log.length === 0 || selectedStats.length === 0) return null;

    const gamesPlayed = log.reduce(
      (sum, game) => sum + (game.games_played || 0),
      0
    );

    const averages: { [key: string]: number } = {};
    const percentiles: { [key: string]: number } = {};
    const calculationMethods: { [key: string]: StatCalculationInfo } = {};

    selectedStats.forEach((stat) => {
      const values = log.map((game) => Number(game[stat]) || 0);
      const statInfo = STAT_CALCULATION_METHODS[stat];
      calculationMethods[stat] = statInfo || {
        method: "per_game",
        description: "Per game average"
      };

      // Calculate stat value based on its calculation method
      switch (statInfo?.method) {
        case "per_game":
          const total = values.reduce((sum, val) => sum + val, 0);
          averages[stat] = gamesPlayed > 0 ? total / gamesPlayed : 0;
          break;

        case "percentage":
        case "rate":
          // Weighted average for percentages and rates
          const weights = log.map((game) => game.games_played || 1);
          const weightedSum = values.reduce(
            (sum, val, idx) => sum + val * weights[idx],
            0
          );
          const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
          averages[stat] = totalWeight > 0 ? weightedSum / totalWeight : 0;
          break;

        case "per_60":
          // These should already be calculated as per-60 in the data
          const per60Total = values.reduce((sum, val) => sum + val, 0);
          averages[stat] = gamesPlayed > 0 ? per60Total / gamesPlayed : 0;
          break;

        default:
          // Default to per-game calculation
          const defaultTotal = values.reduce((sum, val) => sum + val, 0);
          averages[stat] = gamesPlayed > 0 ? defaultTotal / gamesPlayed : 0;
      }

      // Special handling for specific stats
      if (stat === "wins" && isGoalie) {
        const wins = values.reduce((sum, val) => sum + val, 0);
        averages[stat] = gamesPlayed > 0 ? wins / gamesPlayed : 0;
      } else if (stat === "shutouts" && isGoalie) {
        const shutouts = values.reduce((sum, val) => sum + val, 0);
        averages[stat] = gamesPlayed > 0 ? shutouts / gamesPlayed : 0;
      }

      // Calculate shooting percentage properly
      if (stat === "shooting_percentage") {
        const totalGoals = log.reduce(
          (sum, game) => sum + (Number(game.goals) || 0),
          0
        );
        const totalShots = log.reduce(
          (sum, game) => sum + (Number(game.shots) || 0),
          0
        );
        averages[stat] = totalShots > 0 ? (totalGoals / totalShots) * 100 : 0;
      }

      // Calculate percentile using current method
      percentiles[stat] = calculatePercentile(stat, averages[stat]);
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
      percentiles,
      calculationMethods
    };
  }, [
    gameLog,
    playoffGameLog,
    selectedStats,
    isGoalie,
    player.fullName,
    showPlayoffData,
    calculatePercentile
  ]);

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
            const calcMethod = radarData?.calculationMethods[stat];

            const formattedValue =
              average !== undefined ? formatStatValue(average, stat) : "-";

            return [
              `Value: ${formattedValue}`,
              `Percentile: ${percentile.toFixed(0)}%`,
              `Method: ${calcMethod?.description || "Per game"}`,
              `Comparison: ${getComparisonDescription()}`
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

  // Supabase data fetching effect
  useEffect(() => {
    const fetchData = async () => {
      if (!player.id) return;

      // Example query - adjust as needed
      const { data, error } = await supabase
        .from("wgo_skater_stats_per_game")
        .select("*")
        .eq("player_id", player.id);

      if (error) {
        console.error("Error fetching player data:", error);
      } else {
        console.log("Player data:", data);
        // Process and integrate data as needed
      }
    };

    fetchData();
  }, [player.id]);

  // Fetch percentiles on mount and when comparison type or other dependencies change
  useEffect(() => {
    if (
      gameLog.length > 0 &&
      selectedStats.length > 0 &&
      currentSeason?.seasonId
    ) {
      // Clear existing percentiles when comparison type changes
      setDatabasePercentiles({});
      setUsingFallback(true);

      // Extract stats to calculate percentiles for
      const statsToFetch = selectedStats.filter(
        (stat) => STAT_CALCULATION_METHODS[stat]
      );

      // Prepare player values for percentile calculation
      const playerValues: Record<string, number> = {};
      selectedStats.forEach((stat) => {
        const values = gameLog.map((game) => Number(game[stat]) || 0);
        const gamesPlayed = gameLog.reduce(
          (sum, game) => sum + (game.games_played || 0),
          0
        );

        // Calculate the same way we do in radarData
        const statInfo = STAT_CALCULATION_METHODS[stat];
        let calculatedValue = 0;

        switch (statInfo?.method) {
          case "per_game":
            const total = values.reduce((sum, val) => sum + val, 0);
            calculatedValue = gamesPlayed > 0 ? total / gamesPlayed : 0;
            break;
          case "percentage":
          case "rate":
            // Weighted average for percentages and rates
            const weights = gameLog.map((game) => game.games_played || 1);
            const weightedSum = values.reduce(
              (sum, val, idx) => sum + val * weights[idx],
              0
            );
            const totalWeight = weights.reduce(
              (sum, weight) => sum + weight,
              0
            );
            calculatedValue = totalWeight > 0 ? weightedSum / totalWeight : 0;
            break;
          case "per_60":
            const per60Total = values.reduce((sum, val) => sum + val, 0);
            calculatedValue = gamesPlayed > 0 ? per60Total / gamesPlayed : 0;
            break;
          default:
            const defaultTotal = values.reduce((sum, val) => sum + val, 0);
            calculatedValue = gamesPlayed > 0 ? defaultTotal / gamesPlayed : 0;
        }

        // Special handling for specific stats
        if (stat === "wins" && isGoalie) {
          const wins = values.reduce((sum, val) => sum + val, 0);
          calculatedValue = gamesPlayed > 0 ? wins / gamesPlayed : 0;
        } else if (stat === "shutouts" && isGoalie) {
          const shutouts = values.reduce((sum, val) => sum + val, 0);
          calculatedValue = gamesPlayed > 0 ? shutouts / gamesPlayed : 0;
        } else if (stat === "shooting_percentage") {
          const totalGoals = gameLog.reduce(
            (sum, game) => sum + (Number(game.goals) || 0),
            0
          );
          const totalShots = gameLog.reduce(
            (sum, game) => sum + (Number(game.shots) || 0),
            0
          );
          calculatedValue =
            totalShots > 0 ? (totalGoals / totalShots) * 100 : 0;
        }

        playerValues[stat] = calculatedValue;

        // Debug logging for troubleshooting
        console.log(`[PlayerRadarChart] ${stat} calculation:`, {
          values: values.slice(0, 5), // Show first 5 game values
          gamesPlayed,
          total:
            stat === "points"
              ? values.reduce((sum, val) => sum + val, 0)
              : "N/A",
          calculatedValue,
          formattedValue: formatStatValue(calculatedValue, stat)
        });
      });

      console.log(
        `[PlayerRadarChart] Final playerValues for percentile calculation:`,
        playerValues
      );

      fetchPercentiles(statsToFetch, playerValues);
    }
  }, [
    gameLog,
    selectedStats,
    player.id,
    isGoalie,
    comparisonType,
    currentSeason?.seasonId, // Added currentSeason as dependency
    fetchPercentiles
  ]);

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

        {/* Comparison Type Selector */}
        <div className={styles.comparisonControls}>
          <p>
            Percentile rankings {getComparisonDescription()}
            {showPlayoffData ? " (Playoffs)" : " (Regular Season)"}
            {/* Loading and status indicators */}
            {percentileLoading && (
              <div
                style={{
                  fontSize: "0.8em",
                  color: "#14a2d2",
                  marginLeft: "0.5rem",
                  fontStyle: "italic",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem"
                }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    border: "2px solid #14a2d2",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }}
                />
                Calculating...
              </div>
            )}
          </p>

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

        {/* Warning about fallback percentiles - only show after queries complete and fail */}
        {!percentileLoading && usingFallback && (
          <div
            style={{
              fontSize: "0.8em",
              color: "#f97316",
              marginTop: "0.5rem",
              fontStyle: "italic"
            }}
          >
            ⚠️ Using simplified percentile calculations. Database queries failed
            or returned no data.
          </div>
        )}
      </div>

      <div className={styles.radarWrapper}>
        <Radar data={radarData} options={options} />
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
              const getRankColorClass = (percentile: number) => {
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
                        {/* Use actual value from per_game view if available, otherwise fall back to calculated */}
                        {!usingFallback &&
                        playerPerGameValues[stat] !== undefined
                          ? formatStatValue(playerPerGameValues[stat], stat)
                          : formatStatValue(statValue, stat)}
                      </span>
                    </div>

                    <div className={styles.rankingContainer}>
                      <span className={styles.statLabel}>NHL Rank:</span>
                      {!usingFallback && ranking ? (
                        <span
                          className={`${styles.nhlRank} ${getRankColorClass(percentile)}`}
                        >
                          {formatOrdinal(ranking.rank)} / {ranking.total}
                        </span>
                      ) : (
                        <span className={styles.nhlRank}>
                          {usingFallback ? "Est." : "Loading..."}
                        </span>
                      )}
                    </div>

                    <div className={styles.percentileContainer}>
                      <span className={styles.statLabel}>Percentile:</span>
                      <span
                        className={`${styles.percentileValue} ${getRankColorClass(percentile)}`}
                      >
                        {percentile.toFixed(0)}%
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

          {!usingFallback && (
            <div className={styles.rankingNote}>
              <em>
                NHL rankings are calculated from current season data and update
                when comparison type changes.
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
                  percentile >= 90
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
                {percentile.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
