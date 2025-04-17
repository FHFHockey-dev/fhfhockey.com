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
  BarController
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
  BarController
);

const COLOR_PALLET = [
  {
    borderColor: "rgb(75, 192, 192)",
    backgroundColor: "rgba(75, 192, 192, 0.2)"
  }, // Teal
  {
    borderColor: "rgb(153, 102, 255)",
    backgroundColor: "rgba(153, 102, 255, 0.2)"
  }, // Purple
  {
    borderColor: "rgb(255, 159, 64)",
    backgroundColor: "rgba(255, 159, 64, 0.2)"
  }, // Orange
  {
    borderColor: "rgb(255, 205, 86)",
    backgroundColor: "rgba(255, 205, 86, 0.2)"
  } // Yellow
];
const PpgBarColor = {
  borderColor: "rgb(54, 162, 235)",
  backgroundColor: "rgba(54, 162, 235, 0.5)"
}; // Blue for bars
const AvgPpgLineColor = { borderColor: "rgb(255, 99, 132)" }; // Pink/Red for dotted average

interface PpgLineChartProps {
  playerId: number | null | undefined;
}

const PpgLineChart: React.FC<PpgLineChartProps> = ({ playerId }) => {
  const [gameLogData, setGameLogData] = useState<SkaterGameLogPointsData[]>([]);
  const [averagePpg, setAveragePpg] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    // Reset logic when playerId is null/undefined
    if (!playerId) {
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
        // 1. Fetch totals for average PPG and season
        const totals = await fetchPlayerPerGameTotals(playerId);
        if (!totals || !totals.season || totals.points_per_game === null) {
          throw new Error("Missing required totals data (season or avg PPG).");
        }
        setAveragePpg(totals.points_per_game);
        const currentSeason = totals.season;

        // 2. Fetch game log points for that season
        const gameLogs = await fetchPlayerGameLogPoints(
          playerId,
          currentSeason
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
  }, [playerId]);

  // --- Calculate Rolling Averages ---
  const rollingAvg5 = calculateRollingAverage(
    gameLogData,
    5,
    (item) => item.points
  );
  const rollingAvg10 = calculateRollingAverage(
    gameLogData,
    10,
    (item) => item.points
  );
  // --- ------------------------ ---

  // Prepare data for Chart.js
  const chartData = {
    labels: gameLogData.map((log) => formatDateToMMDD(log.date)),
    datasets: [
      {
        type: "bar" as const, // Specify type for this dataset
        label: "Points per Game",
        data: gameLogData.map((log) => log.points ?? 0), // Default null points to 0 for bar chart
        borderColor: PpgBarColor.borderColor,
        backgroundColor: PpgBarColor.backgroundColor,
        order: 4 // Render bars behind lines
      },
      {
        type: "line" as const,
        label: "5-Game Rolling Avg",
        data: rollingAvg5,
        borderColor: COLOR_PALLET[0].borderColor, // Teal
        backgroundColor: COLOR_PALLET[0].backgroundColor,
        fill: false,

        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 3,
        order: 2
      },
      {
        type: "line" as const,
        label: "10-Game Rolling Avg",
        data: rollingAvg10,
        borderColor: COLOR_PALLET[1].borderColor, // Purple
        backgroundColor: COLOR_PALLET[1].backgroundColor,
        fill: false,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 3,
        order: 1 // Render above 5-game avg
      },
      ...(averagePpg !== null
        ? [
            {
              type: "line" as const,
              label: "Season Avg PPG",
              data: gameLogData.map(() => averagePpg),
              borderColor: AvgPpgLineColor.borderColor, // Pink/Red
              borderDash: [3, 3],
              fill: true,
              backgroundColor: "rgba(255, 99, 132, 0.25)", // Transparent fill
              pointRadius: 0,
              pointHoverRadius: 0,
              tension: 0,
              order: 0 // Render on top
            }
          ]
        : [])
    ]
  };

  // Prepare options for Chart.js
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
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

  return (
    // Use shared layout classes
    <div className={styles.chartContainer}>
      <div
        className={styles.ratesLabel}
        style={{
          backgroundColor: "Rgb(6, 47, 61)",
          // gridRow: "1/2", // Not needed with gridTemplateRows
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "5px 0" // Add some padding
        }}
      >
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
          Points / Game
        </h3>
      </div>
      <div className={styles.chartCanvasContainer}>
        {/* Loading/Error/Chart rendering logic */}
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
            No Points data available.
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
          <Chart
            ref={chartRef}
            type="bar"
            options={chartOptions}
            data={chartData}
          />
        )}
      </div>
    </div>
  );
};

export default PpgLineChart;
