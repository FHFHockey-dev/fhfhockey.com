// components/WiGO/PpgLineChart.tsx
import React, { useState, useEffect, useRef } from "react";
import { Chart } from "react-chartjs-2"; // Use mixed type Chart component
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Title,
  Filler,
  LineController,
  BarController,
  ChartOptions,
  ChartData
} from "chart.js";
import {
  fetchPlayerGameLogPoints,
  fetchPlayerPerGameTotals,
  SkaterGameLogPointsData,
  SkaterTotalsData
} from "utils/fetchWigoPlayerStats";
import { formatDateToMMDD } from "utils/formattingUtils";
import { calculateRollingAverage } from "utils/formattingUtils";
import styles from "styles/wigoCharts.module.scss";
import Spinner from "components/Spinner";
import Zoom from "chartjs-plugin-zoom";
import { WIGO_COLORS, CHART_COLORS, addAlpha } from "styles/wigoColors";
import useCurrentSeason from "hooks/useCurrentSeason";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Title,
  Filler,
  LineController,
  BarController,
  Zoom
);

interface PpgLineChartProps {
  playerId: number | null | undefined;
}

const dummyLabels = ["", "Start", "", "Mid", "", "End", ""];

const PpgLineChart: React.FC<PpgLineChartProps> = ({ playerId }) => {
  const [gameLogData, setGameLogData] = useState<SkaterGameLogPointsData[]>([]);
  const [averagePpg, setAveragePpg] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<ChartJS<"bar" | "line"> | null>(null);
  const currentSeasonData = useCurrentSeason();
  const currentSeasonId = currentSeasonData?.seasonId;

  useEffect(() => {
    if (!playerId || !currentSeasonId) {
      setGameLogData([]);
      setAveragePpg(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const loadChartData = async () => {
      setIsLoading(true);
      setError(null);
      setGameLogData([]);
      setAveragePpg(null);

      try {
        // Fetch totals for averages (but not for season selection)
        const totals = await fetchPlayerPerGameTotals(playerId);
        setAveragePpg(totals?.points_per_game ?? null);

        // Use currentSeasonId from hook for fetching game log
        const gameLogs = await fetchPlayerGameLogPoints(
          playerId,
          String(currentSeasonId)
        );
        setGameLogData(gameLogs);
      } catch (err: any) {
        console.error("Failed to load PPG chart data:", err);
        setError(`Failed to load data: ${err.message || "Unknown error"}`);
        setGameLogData([]);
        setAveragePpg(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadChartData();
  }, [playerId, currentSeasonId]);

  // --- Prepare Chart Data ---
  const getChartData = (): ChartData<
    "bar" | "line",
    (number | null)[],
    string
  > => {
    const useDummyData = isLoading || gameLogData.length === 0;
    const labels = useDummyData
      ? dummyLabels
      : gameLogData.map((log) => formatDateToMMDD(log.date));

    // Helper to generate null data for dummy state
    const getNullData = () => dummyLabels.map(() => null);

    // Calculate rolling averages ONLY if not using dummy data
    const rollingAvg5 = useDummyData
      ? getNullData()
      : calculateRollingAverage(gameLogData, 5, (item) => item.points);
    const rollingAvg10 = useDummyData
      ? getNullData()
      : calculateRollingAverage(gameLogData, 10, (item) => item.points);
    const pointsData = useDummyData
      ? getNullData()
      : gameLogData.map((log) => log.points ?? 0); // Use null data for dummy
    const avgPpgData = useDummyData
      ? getNullData()
      : gameLogData.map(() => averagePpg);

    return {
      labels: labels,
      datasets: [
        {
          // Bar dataset for actual points
          type: "bar" as const,
          label: "Points per Game",
          data: pointsData,
          // Make transparent if dummy
          borderColor: useDummyData
            ? WIGO_COLORS.TRANSPARENT
            : CHART_COLORS.BAR_PRIMARY,
          backgroundColor: useDummyData
            ? WIGO_COLORS.TRANSPARENT
            : addAlpha(CHART_COLORS.BAR_PRIMARY, 0.7),
          order: 4
        },
        {
          // 5-Game Rolling Average Line
          type: "line" as const,
          label: "5-Game Rolling Avg",
          data: rollingAvg5,
          borderColor: useDummyData
            ? WIGO_COLORS.TRANSPARENT
            : CHART_COLORS.LINE_PRIMARY,
          backgroundColor: addAlpha(CHART_COLORS.LINE_PRIMARY, 0.2),
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 3,
          order: 2
        },
        {
          // 10-Game Rolling Average Line
          type: "line" as const,
          label: "10-Game Rolling Avg",
          data: rollingAvg10,
          borderColor: useDummyData
            ? WIGO_COLORS.TRANSPARENT
            : CHART_COLORS.PP_TOI,
          backgroundColor: useDummyData
            ? WIGO_COLORS.TRANSPARENT
            : addAlpha(CHART_COLORS.PP_TOI, 0.2),
          fill: false,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 3,
          order: 1
        },
        // Season Average Line (conditionally added)
        ...(averagePpg !== null
          ? [
              {
                type: "line" as const,
                label: "Season Avg PPG",
                data: avgPpgData,
                borderColor: useDummyData
                  ? WIGO_COLORS.TRANSPARENT
                  : CHART_COLORS.AVG_LINE_PRIMARY,
                borderDash: [3, 3],
                // Keep fill transparent or remove if not desired for avg line
                fill: false,
                backgroundColor: WIGO_COLORS.TRANSPARENT,
                pointRadius: 0,
                pointHoverRadius: 0,
                tension: 0,
                order: 0
              }
            ]
          : [])
      ]
    };
  };

  // --- Prepare Chart Options ---
  const getChartOptions = (): ChartOptions<"bar" | "line"> => {
    // Options remain largely the same
    const baseOptions: ChartOptions<"bar" | "line"> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: isLoading ? 0 : 400 // Disable animation during loading
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Points",
            font: { size: 10 },
            color: "#ccc"
          },
          ticks: {
            color: "#ccc",
            font: { size: 9 },
            stepSize: 1,
            precision: 0 // Display ticks as whole numbers
          },
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
        legend: {
          display: false,
          position: "top" as const,
          align: "end" as const,
          labels: { color: "#ccc", boxWidth: 12, font: { size: 10 } }
        },
        datalabels: {
          display: false // Explicitly disable the plugin for this chart
        },
        tooltip: {
          enabled: true,
          mode: "index" as const,
          intersect: false,
          // Add callbacks if specific formatting is needed for points vs averages
          callbacks: {
            label: function (context: any) {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              if (context.parsed.y !== null) {
                // Format averages to 2 decimal places, points as integers
                if (
                  context.dataset.type === "line" &&
                  !context.dataset.borderDash
                ) {
                  // Rolling average lines
                  label += context.parsed.y.toFixed(2);
                } else {
                  // Bars or average line
                  label += context.parsed.y.toFixed(2);
                }
              }
              return label;
            }
          }
        },
        zoom: {
          pan: {
            enabled: true, // Enable panning
            mode: "x" // Allow panning only on the x-axis
            // modifierKey: 'ctrl', // Optional: Require Ctrl key for panning
          },
          zoom: {
            wheel: {
              enabled: true // Enable zooming with mouse wheel
            },
            pinch: {
              enabled: true // Enable zooming with pinch gesture
            },
            drag: {
              enabled: true // Enable drag-to-zoom (box selection) - THIS IS CLOSEST TO BRUSHING
            },
            mode: "x" // Allow zooming only on the x-axis
          }
        }
      },
      interaction: { mode: "index", intersect: false }
    };
    return baseOptions;
  };

  const chartData = getChartData();
  const chartOptions = getChartOptions();
  return (
    <div className={styles.chartContainer}>
      {/* Header remains the same */}
      <div className={styles.chartHeader}>
        <h3>Points / Game</h3>
      </div>

      {/* Chart Canvas Container */}
      <div className={styles.chartCanvasContainer}>
        {/* Render the chart structure if NO error */}
        {/* Shows empty state (with dummy labels) while loading */}
        {!error && (
          <Chart // Use the mixed type Chart component
            ref={chartRef}
            type="bar" // Base type is bar, lines override in datasets
            options={chartOptions}
            data={chartData}
          />
        )}

        {/* --- Overlapping Status Indicators --- */}

        {/* Loading Indicator */}
        {isLoading && (
          <div style={loadingOverlayStyle}>
            <Spinner />
          </div>
        )}

        {/* Error Message */}
        {error && !isLoading && (
          <div style={placeholderStyle}>Error: {error}</div>
        )}

        {/* "Select Player" Placeholder */}
        {!isLoading && !error && !playerId && (
          <div style={placeholderStyle}>Select a player to view chart.</div>
        )}

        {/* "No Data" Placeholder */}
        {!isLoading && !error && playerId && gameLogData.length === 0 && (
          <div style={placeholderStyle}>
            No Points data available for this player.
          </div>
        )}
      </div>
    </div>
  );
};

// --- Copy styles from ToiLineChart ---
// Base style for overlapping text placeholders
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
// Style for general placeholders (Select Player, No Data, Error)
const placeholderStyle: React.CSSProperties = {
  ...placeholderBaseStyle,
  color: "#aaa",
  backgroundColor: "rgba(16, 16, 16, 0.3)" // Match ToiLineChart
};
// Style for the loading overlay
const loadingOverlayStyle: React.CSSProperties = {
  ...placeholderBaseStyle,
  backgroundColor: "rgba(16, 16, 16, 0.7)", // Match ToiLineChart
  color: "#eee",
  zIndex: 10
};

export default PpgLineChart;
