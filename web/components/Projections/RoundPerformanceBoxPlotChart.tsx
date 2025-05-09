// /Users/tim/Desktop/fhfhockey.com/web/components/RoundPerformanceBoxPlotChart.tsx (New File)
import React from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  Tooltip,
  Legend,
  Chart as ChartJS
} from "chart.js";
import { Chart } from "react-chartjs-2";
import {
  BoxAndWiskers,
  BoxPlotController
} from "@sgratzl/chartjs-chart-boxplot";

// Chart.js v3+ requires explicit controller, element, scale registration
// For Chart.js v4, BoxPlotController.id is 'boxplot', BarController.id is 'bar'
ChartJS.register(
  BoxPlotController,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BoxAndWiskers,
  Tooltip,
  Legend
);

interface RoundPerformanceBoxPlotChartProps {
  labels: string[]; // e.g., ["Round 1", "Round 2", ...]
  data: number[][]; // Array of arrays, e.g., [[diffs for R1], [diffs for R2], ...]
  styles?: Record<string, string>; // For SCSS modules if needed for container
}

const RoundPerformanceBoxPlotChart: React.FC<
  RoundPerformanceBoxPlotChartProps
> = ({ labels, data, styles }) => {
  const chartData = {
    labels: labels,
    datasets: [
      {
        label: "Player Fantasy Points Diff % by Round (Actual vs. Projected)",
        data: data,
        backgroundColor: "#07aae2",
        borderColor: "#07aae2", // Box border
        borderWidth: 1,
        itemRadius: 3, // Radius for outlier points
        itemStyle: "circle" as const, // Style of outlier points
        outlierColor: "#FF0000", // Color of outlier points (often red)
        medianColor: "#FFFFFF" // Color of the median line
      }
    ]
  };

  const options: any = {
    // Use any for options if type conflicts are tricky with plugins
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: "Individual Player Difference %",
          color: "#DDDDDD" // Light color for title
        },
        grid: {
          color: function (context: any) {
            if (context.tick && context.tick.value === 0) {
              return "#07aae2"; // Your primary color for the zero line
            }
            return "rgba(255, 255, 255, 0.1)"; // Default grid line color
          },
          lineWidth: function (context: any) {
            if (context.tick && context.tick.value === 0) {
              return 2; // Make the zero line slightly thicker
            }
            return 1; // Default grid line width
          }
        },
        ticks: {
          color: "#DDDDDD", // Lighter tick labels
          callback: function (value: string | number) {
            if (typeof value === "number") return value + "%";
            return value;
          }
        }
      },
      x: {
        title: {
          display: true,
          text: "Draft Round",
          color: "#DDDDDD" // Light color for title
        },
        grid: {
          display: false // Hide vertical grid lines for cleaner look
        },
        ticks: {
          color: "#DDDDDD" // Lighter tick labels
        }
      }
    },
    plugins: {
      legend: {
        position: "top" as const,
        labels: { color: "#DDDDDD" } // Light color for legend
      },
      title: {
        display: true,
        text: "Player-Level Fantasy Points Projection Accuracy by Round",
        color: "#FFFFFF", // Brightest for main title
        font: { size: 16 }
      },
      tooltip: {
        callbacks: {
          // You can customize tooltips to show min, max, median, quartiles for the box plot
          // The default tooltip for box plots is usually quite informative.
        }
      }
    }
  };

  // Note: The plugin uses 'boxplot' as the chart type.
  // For react-chartjs-2, you might need to render <Chart type="boxplot" ... />
  // The `@sgratzl/chartjs-chart-boxplot` library provides `BoxPlotChart` which you can use directly.
  // Or if using react-chartjs-2 v4+ with Chart.js v3+, you'd use <Chart type='boxplot' ... />

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
      <Chart type="boxplot" data={chartData} options={options} />
    </div>
  );
};
export default RoundPerformanceBoxPlotChart;
