// components/WiGO/ToiLineChart.tsx
import React, { useState, useEffect, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, // For X-axis labels (dates)
  LinearScale, // For Y-axis values (TOI)
  PointElement, // For points on the line
  LineElement, // For the line itself
  Tooltip, // For hover interactions
  Legend, // To label datasets (optional)
  TimeScale, // If using actual time objects on x-axis
  Title, // For chart title (optional)
  Filler // To fill area under line (optional)
} from "chart.js";
import {
  fetchPlayerGameLogToi,
  fetchPlayerPerGameTotals,
  SkaterGameLogToiData,
  SkaterTotalsData
} from "utils/fetchWigoPlayerStats"; // Adjust path
import { formatSecondsToMMSS, formatDateToMMDD } from "utils/formattingUtils";
import styles from "styles/wigoCharts.module.scss";
import zoomPlugin from "chartjs-plugin-zoom";

// Register necessary Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale, // Register if using time scale for x-axis
  Title,
  Filler,
  zoomPlugin
);

interface ToiLineChartProps {
  playerId: number | null | undefined;
}

const ToiLineChart: React.FC<ToiLineChartProps> = ({ playerId }) => {
  const [gameLogData, setGameLogData] = useState<SkaterGameLogToiData[]>([]);
  const [averageToi, setAverageToi] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<ChartJS<"line", (number | null)[], string>>(null); // Ref for chart instance

  useEffect(() => {
    if (!playerId) {
      setGameLogData([]);
      setAverageToi(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const loadChartData = async () => {
      setIsLoading(true);
      setError(null);
      setGameLogData([]); // Clear previous data
      setAverageToi(null);

      try {
        // 1. Fetch totals to get average TOI and latest season
        const totals = await fetchPlayerPerGameTotals(playerId);

        if (!totals || !totals.season || totals.toi_per_game === null) {
          throw new Error("Missing required totals data (season or avg TOI).");
        }
        setAverageToi(totals.toi_per_game); // Set the average
        const currentSeason = totals.season; // Get the season to filter game logs

        // 2. Fetch game log data for that season
        const gameLogs = await fetchPlayerGameLogToi(playerId, currentSeason);
        setGameLogData(gameLogs);
      } catch (err: any) {
        console.error("Failed to load TOI chart data:", err);
        setError(`Failed to load data: ${err.message || "Unknown error"}`);
        setGameLogData([]); // Clear data on error
        setAverageToi(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadChartData();
  }, [playerId]);

  // Prepare data for Chart.js
  const chartData = {
    labels: gameLogData.map((log) => formatDateToMMDD(log.date)), // Use MM/DD for labels
    datasets: [
      {
        label: "TOI per Game",
        data: gameLogData.map((log) => log.toi_per_game),
        // --- Colors ---
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        fill: true,
        // --- other styles ---
        tension: 0.1, // Slightly smooth the line
        pointBackgroundColor: "rgb(75, 192, 192)",
        pointRadius: 2, // Small points
        pointHoverRadius: 4
      },
      ...(averageToi !== null
        ? [
            {
              label: "Season Avg TOI",
              data: gameLogData.map(() => averageToi), // Repeat avg value (seconds)
              borderColor: "rgb(255, 99, 132)", // Pink/Red
              borderDash: [3, 3], // Make it dotted
              fill: false,
              pointRadius: 0, // No points on the average line
              pointHoverRadius: 0,
              tension: 0 // Straight line
            }
          ]
        : []) // Add empty array if averageToi is null
    ]
  };

  // Prepare options for Chart.js
  const chartOptions: any = {
    // Use 'any' for simplicity or define a proper ChartOptions type
    responsive: true,
    maintainAspectRatio: false, // Important to fill container
    scales: {
      y: {
        beginAtZero: true, // Start y-axis at 0
        title: {
          display: true,
          text: "Time On Ice (Minutes)",
          font: { size: 10 },
          color: "#ccc"
        },
        ticks: {
          color: "#ccc", // Y-axis labels color
          font: { size: 9 },
          callback: function (value: number | string) {
            // value represents the tick value in seconds
            if (typeof value === "number") {
              return formatSecondsToMMSS(value); // Display as MM:SS
            }
            return value;
          }
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)" // Lighter grid lines
        }
      },
      x: {
        title: {
          display: false // Hide x-axis title for space
          // text: 'Date',
        },
        ticks: {
          color: "#ccc", // X-axis labels color
          font: { size: 9 },
          maxRotation: 90, // Rotate labels if they overlap
          minRotation: 45,
          autoSkip: true, // Automatically skip labels to prevent overlap
          maxTicksLimit: 10 // Limit number of visible ticks for clarity
        },
        grid: {
          display: false // Hide vertical grid lines
        }
      }
    },
    plugins: {
      legend: {
        display: true, // Show legend (TOI per Game, Season Avg TOI)
        position: "top" as const,
        align: "end" as const,
        labels: {
          color: "#ccc",
          boxWidth: 12,
          font: { size: 10 }
        }
      },
      datalabels: {
        display: false // Explicitly disable the plugin for this chart
      },
      tooltip: {
        enabled: true,
        mode: "index" as const,
        intersect: false,
        callbacks: {
          // Format tooltip title (usually the x-label)
          // title: function(tooltipItems: any[]) {
          //     return tooltipItems[0]?.label ? `Date: ${tooltipItems[0].label}` : '';
          // },
          // Format tooltip body label
          // Inside chartOptions.plugins.tooltip.callbacks
          label: function (context: any) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              // Use the correct formatter for seconds
              label += formatSecondsToMMSS(context.parsed.y);
            }
            return label;
          }
        }
      },
      // Add zoom plugin options if installed and registered
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
    interaction: {
      // Improve hover/tooltip interaction
      mode: "index",
      intersect: false
    }
  };

  return (
    <div className={styles.chartContainer}>
      <div
        className={styles.ratesLabel}
        style={{
          backgroundColor: "#164352",
          // gridRow: "1/2", // Not needed with gridTemplateRows
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "5px 0" // Add some padding
        }}
      >
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>TOI</h3>
      </div>
      <div className={styles.chartCanvasContainer}>
        {isLoading && (
          <div
            style={{ color: "#ccc", textAlign: "center", paddingTop: "20px" }}
          >
            Loading Chart...
          </div>
        )}
        {error && (
          <div
            style={{
              color: "#ff6b6b",
              textAlign: "center",
              paddingTop: "20px"
            }}
          >
            Error: {error}
          </div>
        )}
        {!isLoading && !error && gameLogData.length === 0 && playerId && (
          <div
            style={{ color: "#aaa", textAlign: "center", paddingTop: "20px" }}
          >
            No Time On Ice data available.
          </div>
        )}
        {!isLoading && !error && !playerId && (
          <div
            style={{ color: "#aaa", textAlign: "center", paddingTop: "20px" }}
          >
            Select a player to view chart.
          </div>
        )}
        {!isLoading && !error && gameLogData.length > 0 && (
          <Line ref={chartRef} options={chartOptions} data={chartData} />
        )}
      </div>
    </div>
  );
};

export default ToiLineChart;
