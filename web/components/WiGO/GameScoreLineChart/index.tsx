// components/WiGO/GameScoreLineChart.tsx
import React from "react";
import { useQuery } from "@tanstack/react-query";
import supabase from "lib/supabase/client";
import RollingAverageChart from "./RollingAverageChart";
import Spinner from "components/Spinner";
import {
  calculateRollingAverage,
  formatDateToMMDD
} from "utils/formattingUtils";
import { ChartOptions, ChartData, ChartDataset } from "chart.js";
import { WIGO_COLORS, addAlpha, CHART_COLORS } from "styles/wigoColors";
import { WIGO_ERROR_MESSAGES } from "../errorMessages";
import useWigoGameLog from "hooks/useWigoGameLog";

// --- Define props and dummy labels ---
type GameScoreLineChartProps = {
  playerId: number | null | undefined; // Allow null/undefined
  seasonId?: number | null;
  resetKey?: number;
};
const dummyLabels = ["", "Start", "", "Mid", "", "End", ""];

// --- Define expected structure from RPC ---
interface GameScoreDataPoint {
  game_date: string | null;
  game_score: number | null;
  // Add other fields if your RPC returns more
}

export default function GameScoreLineChart({
  playerId,
  seasonId,
  resetKey
}: GameScoreLineChartProps) {
  const queryKey = ["skaterGameScoresForSeason", playerId, seasonId];

  const {
    data: scoreData,
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
    enabled: Number.isSafeInteger(playerId) && Number.isSafeInteger(seasonId) && playerId! > 0 && seasonId! > 0,
    staleTime: 60_000
    // Keep previous data while loading new player/season? Optional.
    // keepPreviousData: true,
  });

  // Share the canonical game calendar with PPG. The score RPC omits games with
  // incomplete inputs; those games must still occupy their rolling-window slot.
  const logs = useWigoGameLog(playerId, seasonId);
  const scoresByDate = new Map<string, (number | null)[]>();
  for (const score of scoreData ?? []) {
    if (!score.game_date) continue;
    const values = scoresByDate.get(score.game_date) ?? [];
    values.push(score.game_score);
    scoresByDate.set(score.game_date, values);
  }
  const gamesPerDate = new Map<string, number>();
  for (const game of logs.data ?? []) {
    gamesPerDate.set(game.date, (gamesPerDate.get(game.date) ?? 0) + 1);
  }
  const rawData: GameScoreDataPoint[] = (logs.data ?? []).map(game => {
    const scores = scoresByDate.get(game.date);
    // The existing RPC exposes dates, not game IDs. Ambiguous matches are gaps.
    const score = gamesPerDate.get(game.date) === 1 && scores?.length === 1 ? scores[0] : null;
    return { game_date: game.date, game_score: score != null && Number.isFinite(score) ? score : null };
  });
  const missingScores = rawData.filter(game => game.game_score == null).length;

  // --- Determine effective loading and error states ---
  // Consider loading if query is running OR if we have a player but no season yet
  const isLoading =
    isQueryLoading || logs.isLoading ||
    (typeof playerId === "number" && typeof seasonId !== "number");
  const error = queryError || logs.error;

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
      : gameLogData.map((item) => item.game_score ?? null);

    // Prepare datasets for rolling averages
    const rollingAvgDatasets = windowSizes.map((windowSize, index) => {
      const rollingAvgData = useDummyData
        ? getNullData()
        : calculateRollingAverage(
            gameLogData,
            windowSize,
            (item) => item.game_score
          ); // Handle nulls in calculation
      const lineColor =
        index === 0 ? CHART_COLORS.LINE_PRIMARY : CHART_COLORS.PP_TOI;
      return {
        type: "line" as const,
        label: `${windowSize}-Game Rolling Avg`,
        data: rollingAvgData,
        borderColor: useDummyData ? WIGO_COLORS.TRANSPARENT : lineColor,
        backgroundColor: addAlpha(CHART_COLORS.LINE_PRIMARY, 0.2),
        fill: true, // Typically don't fill rolling averages
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
            ? WIGO_COLORS.TRANSPARENT
            : CHART_COLORS.BAR_PRIMARY,
          backgroundColor: useDummyData
            ? WIGO_COLORS.TRANSPARENT
            : addAlpha(CHART_COLORS.BAR_PRIMARY, 0.7),

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
            display: false,
            text: "Game Score",
            font: { size: 12 },
            color: "#ccc"
          },
          ticks: { color: "#ccc", font: { size: 12 }, maxTicksLimit: 3, precision: 1 }, // Allow decimals?
          grid: { color: "rgba(255, 255, 255, 0.1)" }
        },
        x: {
          title: { display: false },
          ticks: {
            color: "#ccc",
            font: { size: 12 },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6
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
          pan: { enabled: true, mode: "x", modifierKey: "shift" },
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
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Render the presentational chart component if NO error */}
      {/* It receives dummy data/options while loading */}
      {!error && (
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <RollingAverageChart
          key={`${playerId}:${seasonId}`}
          resetKey={resetKey}
          chartType="bar" // Base type
          chartData={chartData}
          chartOptions={chartOptions}
        />
        </div>
      )}

      {!isLoading && !error && missingScores > 0 && (
        <span role="status" style={{ flexShrink: 0, fontSize: 12, lineHeight: "16px" }} title="Missing scores remain gaps. Five- and ten-game averages require every game in the window.">
          Game Score unavailable for {missingScores} of {rawData.length} games.
        </span>
      )}

      {/* --- Overlapping Status Indicators --- */}
      {isLoading && (
        <div style={loadingOverlayStyle}>
          <Spinner />
        </div>
      )}
      {error && !isLoading && (
        <div style={placeholderStyle}>{WIGO_ERROR_MESSAGES.chart}</div>
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
    </div>
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
