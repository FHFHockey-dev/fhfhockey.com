// components/WiGO/ToiLineChart.tsx
import React, { useState, useEffect, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
  Title,
  Filler,
  ChartOptions,
  ChartData
} from "chart.js";
import {
  fetchPlayerPerGameTotals,
  SkaterTotalsData,
  SkaterGameLogStatsData,
  fetchPlayerGameLogStats
} from "utils/fetchWigoPlayerStats";
import { formatSecondsToMMSS, formatDateToMMDD } from "utils/formattingUtils";
import styles from "styles/wigoCharts.module.scss";
import zoomPlugin from "chartjs-plugin-zoom";
import Spinner from "components/Spinner";
import { WIGO_COLORS, CHART_COLORS, addAlpha } from "styles/wigoColors"; // Adjust path

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
  Title,
  Filler,
  zoomPlugin
);
interface ToiLineChartProps {
  playerId: number | null | undefined;
}

// --- Define the possible chart views ---
type ChartView = "toi" | "pp_pct";
// --- Dummy labels for loading state ---
const dummyLabels = ["", "Start", "", "Mid", "", "End", ""];

type NumericSkaterLogKeys = {
  [K in keyof SkaterGameLogStatsData]: SkaterGameLogStatsData[K] extends
    | number
    | null
    ? K
    : never;
}[keyof SkaterGameLogStatsData];

const ToiLineChart: React.FC<ToiLineChartProps> = ({ playerId }) => {
  const [gameLogData, setGameLogData] = useState<SkaterGameLogStatsData[]>([]);
  const [averageToi, setAverageToi] = useState<number | null>(null);
  const [averagePpToiPct, setAveragePpToiPct] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<ChartJS<"line">>(null);
  // --- State to control which chart is displayed ---
  const [chartView, setChartView] = useState<ChartView>("toi"); // Default to 'toi'

  useEffect(() => {
    if (!playerId) {
      // Clear data, reset loading/error for empty state
      setGameLogData([]);
      setAverageToi(null);
      setAveragePpToiPct(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const loadChartData = async () => {
      setIsLoading(true);
      setError(null);
      setGameLogData([]);
      setAverageToi(null);
      setAveragePpToiPct(null);

      try {
        // 1. Fetch totals (still needed for season and average total TOI)
        const totals: SkaterTotalsData | null =
          await fetchPlayerPerGameTotals(playerId); // Use updated type

        if (!totals || !totals.season) {
          throw new Error("Missing required totals data (season).");
        }
        // Set average total TOI if available
        setAverageToi(totals.toi_per_game ?? null);
        setAveragePpToiPct(totals.pp_toi_pct_per_game ?? null);
        const currentSeason = totals.season;

        // 2. Fetch *all* relevant game log stats for that season
        const gameLogs = await fetchPlayerGameLogStats(playerId, currentSeason);
        setGameLogData(gameLogs);
      } catch (err: any) {
        console.error("Failed to load chart data:", err);
        setError(`Failed to load data: ${err.message || "Unknown error"}`);
        setGameLogData([]); // Clear data on error
        setAverageToi(null);
        setAveragePpToiPct(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadChartData();
  }, [playerId]);

  // --- Prepare Chart Data based on the selected view ---
  const getChartData = (): ChartData<"line", (number | null)[], string> => {
    const useDummyData = isLoading || gameLogData.length === 0;
    const labels = useDummyData
      ? dummyLabels
      : gameLogData.map((log) => formatDateToMMDD(log.date));

    // --- Update the type of logField ---
    const getData = (logField: NumericSkaterLogKeys) => {
      return useDummyData
        ? dummyLabels.map(() => null)
        : // Now TypeScript knows log[logField] will be number | null
          gameLogData.map((log) => log[logField]);
    };

    // getAvgData remains the same as it doesn't use logField
    const getAvgData = (avgValue: number | null) => {
      return useDummyData
        ? dummyLabels.map(() => null)
        : gameLogData.map(() => avgValue);
    };

    if (chartView === "toi") {
      return {
        labels: labels,
        datasets: [
          {
            label: "Total TOI",
            data: getData("toi_per_game"),
            borderColor: useDummyData
              ? WIGO_COLORS.TRANSPARENT
              : CHART_COLORS.BAR_PRIMARY,
            backgroundColor: useDummyData
              ? WIGO_COLORS.TRANSPARENT
              : addAlpha(CHART_COLORS.BAR_PRIMARY, 0.2),
            fill: !useDummyData,
            yAxisID: "yTime",
            pointRadius: useDummyData ? 0 : 2,
            tension: 0.1,
            pointHoverRadius: 4
          },
          {
            label: "PP TOI",
            data: getData("pp_toi_per_game"),
            borderColor: useDummyData
              ? WIGO_COLORS.TRANSPARENT
              : CHART_COLORS.PP_TOI,
            backgroundColor: useDummyData
              ? WIGO_COLORS.TRANSPARENT
              : addAlpha(CHART_COLORS.PP_TOI, 0.2),
            fill: false,
            yAxisID: "yTime",
            pointRadius: useDummyData ? 0 : 2,
            tension: 0.1,
            pointHoverRadius: 4
          },
          ...(averageToi !== null
            ? [
                {
                  label: "Season Avg Total TOI",
                  data: getAvgData(averageToi),
                  borderColor: useDummyData
                    ? WIGO_COLORS.TRANSPARENT
                    : CHART_COLORS.AVG_LINE_PRIMARY,
                  borderDash: [3, 3],
                  fill: false,
                  pointRadius: 0,
                  pointHoverRadius: 0,
                  tension: 0,
                  yAxisID: "yTime"
                }
              ]
            : [])
        ]
      };
    } else {
      // --- PP TOI % Chart ---
      return {
        labels: labels,
        datasets: [
          {
            label: "PP TOI % per Game",
            data: getData("pp_toi_pct_per_game"),
            borderColor: useDummyData
              ? WIGO_COLORS.TRANSPARENT
              : CHART_COLORS.LINE_TERTIARY, // Use semantic tertiary line color
            backgroundColor: useDummyData
              ? WIGO_COLORS.TRANSPARENT
              : addAlpha(CHART_COLORS.LINE_TERTIARY, 0.2),
            fill: !useDummyData,
            yAxisID: "yPercentage",
            pointRadius: useDummyData ? 0 : 2,
            tension: 0.1,
            pointHoverRadius: 4
          },
          ...(averagePpToiPct !== null
            ? [
                {
                  label: "Season Avg PP TOI %",
                  data: getAvgData(averagePpToiPct),
                  borderColor: useDummyData
                    ? WIGO_COLORS.TRANSPARENT
                    : CHART_COLORS.AVG_LINE_SECONDARY,
                  borderDash: [3, 3],
                  fill: false,
                  pointRadius: 0,
                  pointHoverRadius: 0,
                  tension: 0,
                  yAxisID: "yPercentage"
                }
              ]
            : [])
        ]
      };
    }
  };

  // --- Prepare Chart Options based on the selected view ---
  const getChartOptions = (): ChartOptions<"line"> => {
    const baseOptions: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: isLoading ? 0 : 400 // Disable animation while loading
      },
      scales: {
        x: {
          title: { display: false },
          ticks: {
            color: CHART_COLORS.TICK_LABEL,
            font: { size: 9 },
            maxRotation: 90,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: 10
          },
          grid: { display: false },
          border: { color: CHART_COLORS.AXIS_BORDER }
        },
        // Define TWO Y-axes one for toi/pptoi and one for PP%
        // only one will be active depending on the view
        yTime: {
          // Axis for TOI (seconds formatted as MM:SS)
          display: chartView === "toi", // Only display if view is 'toi'
          beginAtZero: true,
          min: 0,
          max: 60 * 30,
          title: {
            display: true,
            text: "Time On Ice (Minutes)",
            font: { size: 10 },
            color: CHART_COLORS.TICK_LABEL
          },
          ticks: {
            color: CHART_COLORS.TICK_LABEL,
            font: { size: 9 },
            callback: (value) =>
              typeof value === "number" ? formatSecondsToMMSS(value) : value
          },
          grid: { color: CHART_COLORS.GRID_LINE },
          border: { color: CHART_COLORS.AXIS_BORDER }
        },
        yPercentage: {
          // Axis for PP TOI %
          display: chartView === "pp_pct",
          min: 0,
          max: 100,
          title: {
            display: true,
            text: "PP TOI Percentage (%)",
            font: { size: 10 },
            color: CHART_COLORS.TICK_LABEL
          },
          ticks: {
            color: CHART_COLORS.TICK_LABEL,
            font: { size: 9 },
            callback: (value) =>
              typeof value === "number" ? `${value}%` : value // Format as percentage
          },
          grid: { color: CHART_COLORS.GRID_LINE },
          border: { color: CHART_COLORS.AXIS_BORDER }
        }
      },
      plugins: {
        legend: {
          display: false, // Enable legend to see dataset labels
          position: "top" as const,
          align: "end" as const,
          labels: {
            color: CHART_COLORS.TICK_LABEL,
            boxWidth: 12,
            font: { size: 10 }
          }
        },
        datalabels: { display: false },
        tooltip: {
          enabled: true,
          mode: "index" as const,
          intersect: false,
          backgroundColor: CHART_COLORS.TOOLTIP_BACKGROUND,
          titleColor: CHART_COLORS.TOOLTIP_TEXT,
          bodyColor: CHART_COLORS.TOOLTIP_TEXT,
          borderColor: CHART_COLORS.TOOLTIP_BORDER,
          borderWidth: 1,
          callbacks: {
            title: (tooltipItems) =>
              tooltipItems[0]?.label ? `Date: ${tooltipItems[0].label}` : "",
            label: (context) => {
              let label = context.dataset.label || "";
              if (label) {
                label += ": ";
              }
              if (context.parsed.y !== null) {
                if (context.dataset.yAxisID === "yPercentage") {
                  // Use .toFixed(1) for potentially non-integer averages
                  label += `${context.parsed.y.toFixed(1)}%`;
                } else {
                  label += formatSecondsToMMSS(context.parsed.y);
                }
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
        }
      },
      interaction: { mode: "index", intersect: false }
    };

    return baseOptions;
  };

  // ---  Title based on view ---
  const chartTitle = chartView === "toi" ? "Time On Ice" : "Power Play TOI %";
  const chartData = getChartData();
  const chartOptions = getChartOptions();

  return (
    <div className={styles.chartContainer}>
      {/* --- Header with Title and Toggle Buttons --- */}
      <div className={styles.chartHeader}>
        <h3>{chartTitle}</h3>

        {/* Basic Toggle Buttons */}
        <div className={styles.toggleButtons}>
          <button
            onClick={() => setChartView("toi")}
            disabled={chartView === "toi"} // Disable if active
          >
            TOI
          </button>
          <button
            onClick={() => setChartView("pp_pct")}
            disabled={chartView === "pp_pct"} // Disable if active
          >
            PP TOI %
          </button>
        </div>
      </div>

      {/* --- Chart Canvas --- */}
      {/* Chart Canvas Container */}
      <div className={styles.chartCanvasContainer}>
        {/* Render the chart structure if NO error */}
        {/* It will show the empty state (with dummy labels) while loading */}
        {!error && (
          <Line ref={chartRef} options={chartOptions} data={chartData} />
        )}

        {/* --- Overlapping Status Indicators --- */}

        {/* Loading Indicator (overlaps the chart) */}
        {isLoading && (
          <div style={loadingOverlayStyle}>
            <Spinner />
          </div>
        )}

        {/* Error Message (replaces chart or overlaps) */}
        {/* Show error overlay if an error occurred */}
        {error &&
          !isLoading && ( // Show only if not also loading
            <div style={placeholderStyle}>Error: {error}</div>
          )}

        {/* "Select Player" Placeholder (overlaps empty chart if !isLoading, !error, !playerId) */}
        {!isLoading && !error && !playerId && (
          <div style={placeholderStyle}>Select a player to view chart.</div>
        )}

        {/* "No Data" Placeholder (overlaps empty chart if !isLoading, !error, playerId, and gameLogData is empty) */}
        {!isLoading && !error && playerId && gameLogData.length === 0 && (
          <div style={placeholderStyle}>
            No game log data available for this player.
          </div>
        )}
      </div>
    </div>
  );
};

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
  backgroundColor: "rgba(16, 16, 16, 0.3)" // Darker semi-transparent background
};

// Style for the loading overlay
const loadingOverlayStyle: React.CSSProperties = {
  ...placeholderBaseStyle,
  backgroundColor: "rgba(16, 16, 16, 0.7)", // Darker semi-transparent background
  color: "#eee",
  zIndex: 10 // Ensure it's on top
};

export default ToiLineChart;
