import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  // Boxplot specific imports
  BarController, // Boxplot might use BarController as a base or for elements
  BarElement // For the bars in the boxplot
} from "chart.js";
import { Chart } from "react-chartjs-2";
import {
  BoxPlotController,
  BoxAndWiskers
} from "@sgratzl/chartjs-chart-boxplot";

// Register all necessary components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  // Boxplot specific
  BoxPlotController,
  BoxAndWiskers,
  BarController, // Register BarController as BoxPlotController might depend on it or its elements
  BarElement // Register BarElement
);

interface RoundPerformanceChartProps {
  labels: string[]; // Will be empty for linear x-axis, but prop kept for boxplot
  datasets: any[];
  styles?: Record<string, string>;
  chartType: "line" | "boxplot";
  yAxisLabel: string;
}

const RoundPerformanceChart: React.FC<RoundPerformanceChartProps> = ({
  labels,
  datasets,
  styles,
  chartType,
  yAxisLabel
}) => {
  const chartData = useMemo(
    () => ({
      // For line chart with numeric x-axis, labels array can be empty if x values are in datasets.
      // For boxplot, labels array is used for categories.
      labels: chartType === "boxplot" ? labels : [],
      datasets: datasets
    }),
    [labels, datasets, chartType]
  );

  const options: any = useMemo(() => {
    const baseOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: chartType === "line", // Actual FP starts at 0
          title: {
            display: true,
            text: yAxisLabel,
            color: "#DDDDDD"
          },
          grid: {
            color: function (context: any) {
              if (
                chartType === "boxplot" &&
                context.tick &&
                context.tick.value === 0
              ) {
                return "#07aae2";
              }
              return "rgba(255, 255, 255, 0.1)";
            },
            lineWidth: function (context: any) {
              if (
                chartType === "boxplot" &&
                context.tick &&
                context.tick.value === 0
              ) {
                return 2;
              }
              return 1;
            }
          },
          ticks: {
            color: "#DDDDDD",
            callback: function (value: string | number) {
              if (chartType === "boxplot" && typeof value === "number")
                return value + "%";
              if (chartType === "line" && typeof value === "number")
                return value.toFixed(1);
              return value;
            }
          }
        },
        x: {
          title: {
            display: true,
            text:
              chartType === "line" ? "Yahoo Average Pick (ADP)" : "Draft Round",
            color: "#DDDDDD"
          },
          grid: {
            display: chartType === "line" ? true : false, // Show grid for line chart x-axis
            color: "rgba(255, 255, 255, 0.05)" // Lighter grid for line chart x-axis
          },
          ticks: {
            color: "#DDDDDD"
            // For line chart, ticks will be auto-generated on the linear scale.
            // For boxplot, labels are used as ticks.
          }
        }
      },
      plugins: {
        legend: {
          position: "top" as const,
          labels: {
            color: "#DDDDDD",
            boxWidth: chartType === "line" ? 15 : 40,
            padding: chartType === "line" ? 20 : 10
          }
        },
        title: {
          display: true,
          text:
            chartType === "line"
              ? "Actual Fantasy Points by Position vs. ADP"
              : "Player-Level Fantasy Points Projection Accuracy by Round",
          color: "#FFFFFF",
          font: { size: 16 }
        },
        tooltip: {
          callbacks: {
            title: function (tooltipItems: any[]) {
              // For line chart, show ADP as title. For boxplot, use category label.
              if (chartType === "line" && tooltipItems.length > 0) {
                const point = tooltipItems[0].raw as {
                  x: number;
                  playerFullName?: string;
                };
                return `ADP: ${point.x.toFixed(1)}`;
              }
              return tooltipItems[0]?.label || ""; // Default for boxplot
            },
            label: function (context: any) {
              let label = context.dataset.label || ""; // Position or Boxplot series label

              if (chartType === "boxplot") {
                const stats = context.raw;
                if (stats && typeof stats.median !== "undefined") {
                  label = `Median: ${stats.median.toFixed(1)}%`;
                } else if (typeof context.parsed.y === "number") {
                  label = `${context.parsed.y.toFixed(1)}% (Diff)`;
                }
              } else {
                // For line chart, context.raw is {x, y, playerFullName, ...}
                const pointData = context.raw as {
                  y: number;
                  playerFullName?: string;
                };
                if (label) label += ": ";
                label += `${pointData.y.toFixed(1)} FP`;
                if (pointData.playerFullName) {
                  return [label, `Player: ${pointData.playerFullName}`];
                }
              }
              return label;
            }
          }
        }
      }
    };

    if (chartType === "line") {
      baseOptions.scales.x.type = "linear";
      // Optional: Suggest min/max for x-axis if data can be very sparse or to control zoom
      // baseOptions.scales.x.min = 0;
      // baseOptions.scales.x.max = 210; // ~17.5 rounds
    }
    return baseOptions;
  }, [chartType, yAxisLabel, labels]);

  return (
    <div
      className={styles?.chartContainer}
      style={{
        height: "650px",
        width: "100%",
        padding: "1rem 0",
        backgroundColor: "rgba(0,0,0,0.1)"
      }}
    >
      <Chart type={chartType} data={chartData} options={options} />
    </div>
  );
};

export default RoundPerformanceChart;
