import React from "react";
import { Chart, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Define props types for the component
interface RollingAverageChartProps<T> {
  data: T[]; // The main dataset to calculate rolling averages
  windowSizes: number[]; // Array of window sizes for rolling averages (e.g. [5, 10, 15])
  getLabel: (item: T, index: number) => string;
  getValue: (item: T) => number;
  loading?: boolean;
}

const COLOR_PALLET = [
  {
    borderColor: "rgb(75, 192, 192)",
    backgroundColor: "rgba(75, 192, 192, 0.2)",
  }, // Teal
  {
    borderColor: "rgb(255, 99, 132)",
    backgroundColor: "rgba(255, 99, 132, 0.2)",
  }, // Pink
  {
    borderColor: "rgb(153, 102, 255)",
    backgroundColor: "rgba(153, 102, 255, 0.2)",
  }, // Purple
  {
    borderColor: "rgb(255, 159, 64)",
    backgroundColor: "rgba(255, 159, 64, 0.2)",
  }, // Orange
  {
    borderColor: "rgb(255, 205, 86)",
    backgroundColor: "rgba(255, 205, 86, 0.2)",
  }, // Yellow
];

function RollingAverageChart<T>({
  data,
  windowSizes,
  getValue,
  getLabel,
  loading = false,
}: RollingAverageChartProps<T>) {
  // Function to calculate rolling averages for a given window size
  function calculateRollingAverage(
    data: T[],
    windowSize: number
  ): (number | null)[] {
    return data.map((_, index) => {
      if (index < windowSize - 1) return null; // Not enough data points for the window
      const window = data.slice(index - windowSize + 1, index + 1);
      const sum = window.reduce((acc, val) => acc + getValue(val), 0);
      return sum / windowSize;
    });
  }

  // Prepare the datasets for each rolling average based on the window sizes
  const datasets = windowSizes.map((windowSize, index) => {
    const rollingAverage = calculateRollingAverage(data, windowSize);
    const { borderColor, backgroundColor } = COLOR_PALLET[index];
    return {
      label: `${windowSize}-Day Rolling Average`,
      data: rollingAverage,
      borderColor,
      backgroundColor,
      fill: true,
      tension: 0.1,
      type: "line" as const,
    };
  });

  // Chart data configuration
  const chartData = {
    labels: data.map(getLabel),
    datasets: [
      {
        label: "Game Score",
        data: data.map(getValue),
        borderColor: "rgb(54, 162, 235)",
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        fill: true,
        tension: 0.1,
        type: "bar" as const,
      },
      ...datasets, // Include the rolling averages datasets
    ],
  };

  return (
    <Chart
      type="line"
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: {
            position: "bottom",
            display: false,
          },
        },
      }}
    />
  );
}

export default RollingAverageChart;
