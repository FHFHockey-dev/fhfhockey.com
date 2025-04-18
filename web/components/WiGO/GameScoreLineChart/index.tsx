// components/WiGO/GameScoreLineChart.tsx
import React from "react";
import { useQuery } from "@tanstack/react-query";
import supabase from "lib/supabase/client";
import RollingAverageChart from "./RollingAverageChart"; // The refactored presentational chart
import useCurrentSeason from "hooks/useCurrentSeason";
import Spinner from "components/Spinner"; // Import Spinner
import {
  calculateRollingAverage,
  formatDateToMMDD
} from "utils/formattingUtils"; // Import formatters/calculators
import { ChartOptions, ChartData, ChartDataset } from "chart.js"; // Import Chart.js types

// Import the base styles (assuming styles object is available if needed, otherwise define inline)
// import styles from "styles/wigoCharts.module.scss"; // If needed for specific styling

// --- Define props and dummy labels ---
type GameScoreLineChartProps = {
  playerId: number | null | undefined; // Allow null/undefined
};
const dummyLabels = ["", "Start", "", "Mid", "", "End", ""];

// --- Define expected structure from RPC ---
interface GameScoreDataPoint {
  game_date: string | null;
  game_score: number | null;
  // Add other fields if your RPC returns more
}

// --- Color definitions (can be moved to a constants file) ---
const COLOR_PALLET = [
  {
    borderColor: "rgb(75, 192, 192)",
    backgroundColor: "rgba(75, 192, 192, 0.2)"
  }, // Teal
  {
    borderColor: "rgb(153, 102, 255)",
    backgroundColor: "rgba(153, 102, 255, 0.2)"
  } // Purple
  // ... add more if windowSizes can exceed 2
];
const GameScoreBarColor = {
  borderColor: "rgb(54, 162, 235)",
  backgroundColor: "rgba(54, 162, 235, 0.5)"
}; // Blue

export default function GameScoreLineChart({
  playerId
}: GameScoreLineChartProps) {
  const currentSeason = useCurrentSeason();
  const seasonId = currentSeason?.seasonId;

  const queryKey = ["skaterGameScoresForSeason", playerId, seasonId];

  const {
    data: rawData,
    isLoading: isQueryLoading,
    error: queryError
  } = useQuery<GameScoreDataPoint[]>({
    // Add type to useQuery
    queryKey: queryKey,
    queryFn: async ({ queryKey }) => {
      const pId = queryKey[1] as number | undefined | null;
      const sId = queryKey[2] as number | undefined;

      // Only proceed if IDs are valid numbers
      if (typeof pId !== "number" || typeof sId !== "number") {
        console.log(
          "GameScoreLineChart: Player ID or Season ID invalid, skipping fetch."
        );
        return []; // Return empty, query is disabled anyway but good practice
      }

      console.log(
        `GameScoreLineChart: Fetching game scores for player ${pId} in season ${sId}.`
      );
      const { data: rpcData, error: rpcError } = await supabase
        .rpc("get_skater_game_scores_for_season", {
          p_player_id: pId,
          p_season_id: sId
        })
        .order("game_date", { ascending: true });

      if (rpcError) {
        console.error(
          "GameScoreLineChart: Error fetching game scores:",
          rpcError
        );
        throw rpcError;
      }
      return rpcData ?? [];
    },
    // Enable query only when both IDs are valid numbers
    enabled: typeof playerId === "number" && typeof seasonId === "number"
    // Keep previous data while loading new player/season? Optional.
    // keepPreviousData: true,
  });

  // --- Determine effective loading and error states ---
  // Consider loading if query is running OR if we have a player but no season yet
  const isLoading =
    isQueryLoading ||
    (typeof playerId === "number" && typeof seasonId !== "number");
  const error = queryError as Error | null; // Cast error type

  // --- Prepare Chart Data (including dummy data) ---
  const getChartData = (): ChartData<
    "bar" | "line",
    (number | null)[],
    string
  > => {
    const gameLogData = rawData ?? []; // Use fetched data or empty array
    const useDummyData = isLoading || gameLogData.length === 0;
    const labels = useDummyData
      ? dummyLabels
      : gameLogData.map((item) =>
          item.game_date ? formatDateToMMDD(item.game_date) : ""
        );

    const getNullData = () => dummyLabels.map(() => null);
    const windowSizes = [5, 10]; // Define window sizes here

    // Prepare base game score data
    const gameScoreValues = useDummyData
      ? getNullData()
      : gameLogData.map((item) => item.game_score ?? 0); // Default null to 0 for bars

    // Prepare datasets for rolling averages
    const rollingAvgDatasets = windowSizes.map((windowSize, index) => {
      const rollingAvgData = useDummyData
        ? getNullData()
        : calculateRollingAverage(
            gameLogData,
            windowSize,
            (item) => item.game_score ?? 0
          ); // Handle nulls in calculation
      const colorIndex = index % COLOR_PALLET.length; // Cycle through colors

      return {
        type: "line" as const,
        label: `${windowSize}-Game Rolling Avg`,
        data: rollingAvgData,
        borderColor: useDummyData
          ? "transparent"
          : COLOR_PALLET[colorIndex].borderColor,
        backgroundColor: useDummyData
          ? "transparent"
          : COLOR_PALLET[colorIndex].backgroundColor,
        fill: false, // Typically don't fill rolling averages
        tension: 0.2,
        pointRadius: 0, // No points on rolling average lines
        pointHoverRadius: 3,
        order: index + 1 // Render lines above bars (lower order renders later/on top)
      };
    });

    return {
      labels: labels,
      datasets: [
        // Base Game Score Bars
        {
          type: "bar" as const,
          label: "Game Score",
          data: gameScoreValues,
          borderColor: useDummyData
            ? "transparent"
            : GameScoreBarColor.borderColor,
          backgroundColor: useDummyData
            ? "transparent"
            : GameScoreBarColor.backgroundColor,
          order: windowSizes.length + 1 // Render bars behind all lines
        },
        // Spread the rolling average datasets
        ...rollingAvgDatasets
      ]
    };
  };

  // --- Prepare Chart Options ---
  const getChartOptions = (): ChartOptions<"bar" | "line"> => {
    const baseOptions: ChartOptions<"bar" | "line"> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: isLoading ? 0 : 400 // Disable animation while loading
      },
      scales: {
        y: {
          beginAtZero: true,
          // Adjust suggestedMax based on typical Game Score range if needed
          // suggestedMax: 5,
          title: {
            display: true,
            text: "Game Score",
            font: { size: 10 },
            color: "#ccc"
          },
          ticks: { color: "#ccc", font: { size: 9 }, precision: 1 }, // Allow decimals?
          grid: { color: "rgba(255, 255, 255, 0.1)" }
        },
        x: {
          title: { display: false },
          ticks: {
            color: "#ccc",
            font: { size: 9 },
            maxRotation: 90,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: 10
          },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false }, // Hide legend for simplicity
        tooltip: {
          enabled: true,
          mode: "index",
          intersect: false,
          // Add specific formatting if needed
          callbacks: {
            label: (context) => {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              if (context.parsed.y !== null) {
                // Format rolling averages differently?
                label += context.parsed.y.toFixed(2);
              }
              return label;
            }
          }
        },
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            drag: { enabled: true },
            mode: "x"
          }
        },
        datalabels: { display: false }
      },
      interaction: { mode: "index", intersect: false }
    };
    return baseOptions;
  };

  const chartData = getChartData();
  const chartOptions = getChartOptions();

  return (
    // This component now renders the chart AND the status overlays
    <>
      {/* Render the presentational chart component if NO error */}
      {/* It receives dummy data/options while loading */}
      {!error && (
        <RollingAverageChart
          chartType="bar" // Base type
          chartData={chartData}
          chartOptions={chartOptions}
        />
      )}

      {/* --- Overlapping Status Indicators --- */}
      {isLoading && (
        <div style={loadingOverlayStyle}>
          <Spinner />
        </div>
      )}
      {error && !isLoading && (
        <div style={placeholderStyle}>Error: {error.message}</div>
      )}
      {!isLoading && !error && !playerId && (
        <div style={placeholderStyle}>Select a player to view chart.</div>
      )}
      {/* Show message if waiting for season ID */}
      {!isLoading &&
        !error &&
        typeof playerId === "number" &&
        typeof seasonId !== "number" && (
          <div style={placeholderStyle}>Loading season info...</div>
        )}
      {/* Show No Data message if player/season selected but data is empty */}
      {!isLoading &&
        !error &&
        typeof playerId === "number" &&
        typeof seasonId === "number" &&
        (!rawData || rawData.length === 0) && (
          <div style={placeholderStyle}>
            No Game Score data available for this player.
          </div>
        )}
    </>
  );
}

// --- Styles (should be defined globally or imported) ---
const placeholderBaseStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  textAlign: "center",
  padding: "20px",
  fontSize: "12px",
  pointerEvents: "none"
};
const placeholderStyle: React.CSSProperties = {
  ...placeholderBaseStyle,
  color: "#aaa",
  backgroundColor: "rgba(16, 16, 16, 0.3)"
};
const loadingOverlayStyle: React.CSSProperties = {
  ...placeholderBaseStyle,
  backgroundColor: "rgba(16, 16, 16, 0.7)",
  color: "#eee",
  zIndex: 10
};
// --- End Styles ---
